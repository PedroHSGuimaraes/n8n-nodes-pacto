import { randomBytes } from 'node:crypto';

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	getPactoOperation,
	PACTO_AREA_OPTIONS,
	type PactoOperationDefinition,
} from './helpers/catalog.generated';
import {
	buildEndpointPath,
	extractPageItems,
	parseObjectParameter,
	removeAuthorizationHeader,
} from './helpers/utils';
import { loadOptions } from './methods/loadOptions';
import { pactoApiRequest, type PactoRequestOptions } from './transport';

function hasRequestBody(operation: PactoOperationDefinition): boolean {
	return operation.requestContentTypes.length > 0;
}

function responseBody(response: any): any {
	return response?.body !== undefined && response?.statusCode !== undefined
		? response.body
		: response;
}

function shouldStopPagination(
	response: any,
	itemCount: number,
	pageSize: number,
	currentPage: number,
): boolean {
	const body = responseBody(response);
	if (itemCount === 0 || itemCount < pageSize) return true;
	if (body?.last === true || body?.hasNext === false || body?.has_more === false) return true;
	if (typeof body?.totalPages === 'number' && currentPage + 1 >= body.totalPages) return true;
	if (typeof body?.total_pages === 'number' && currentPage + 1 >= body.total_pages) return true;
	return false;
}

function multipartHeaderValue(value: string): string {
	return value.replace(/[\r\n"]/g, '_');
}

function hasValue(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function validateRequiredRequestParameters(
	context: IExecuteFunctions,
	itemIndex: number,
	operation: PactoOperationDefinition,
	query: IDataObject,
	headers: IDataObject,
): void {
	const normalizedHeaders = new Map(
		Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
	);
	for (const parameter of operation.parameters.filter((candidate) => candidate.required)) {
		if (parameter.in === 'query' && !hasValue(query[parameter.name])) {
			throw new NodeOperationError(
				context.getNode(),
				`Query parameter "${parameter.name}" is required for ${operation.method} ${operation.path}`,
				{ itemIndex },
			);
		}
		if (
			parameter.in === 'header' &&
			parameter.name.toLowerCase() !== 'authorization' &&
			!hasValue(normalizedHeaders.get(parameter.name.toLowerCase()))
		) {
			throw new NodeOperationError(
				context.getNode(),
				`Header parameter "${parameter.name}" is required for ${operation.method} ${operation.path}`,
				{ itemIndex },
			);
		}
	}
}

async function buildRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	operation: PactoOperationDefinition,
): Promise<PactoRequestOptions> {
	const query = parseObjectParameter(
		this,
		this.getNodeParameter('queryParameters', itemIndex, '{}'),
		'Query Parameters',
	);
	const customHeaders = parseObjectParameter(
		this,
		this.getNodeParameter('headerParameters', itemIndex, '{}'),
		'Header Parameters',
	);
	const headers = removeAuthorizationHeader(customHeaders);
	validateRequiredRequestParameters(this, itemIndex, operation, query, headers);
	const bodyType = this.getNodeParameter('bodyType', itemIndex) as string;
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const request: PactoRequestOptions = {
		qs: query,
		headers,
		timeout: (options.timeout as number) || 30000,
		ignoreHttpStatusErrors: options.ignoreHttpStatusErrors === true,
		returnFullResponse: options.includeResponseHeadersAndStatus === true,
	};

	const responseFormat = (options.responseFormat as string) || 'auto';
	if (responseFormat === 'file') {
		request.encoding = 'arraybuffer';
		request.json = false;
	} else if (responseFormat === 'text') {
		request.encoding = 'text';
		request.json = false;
	} else {
		request.json = true;
	}

	let resolvedBodyType = bodyType;
	if (bodyType === 'auto') {
		const officialType = operation.requestContentTypes[0];
		resolvedBodyType =
			officialType === 'application/x-www-form-urlencoded'
				? 'formUrlEncoded'
				: officialType === 'multipart/form-data'
					? 'multipart'
					: officialType?.startsWith('text/')
						? 'raw'
						: officialType
							? 'json'
							: 'none';
	}
	if (operation.requestBodyRequired && resolvedBodyType === 'none') {
		throw new NodeOperationError(
			this.getNode(),
			`A request body is required for ${operation.method} ${operation.path}`,
			{ itemIndex },
		);
	}

	if (resolvedBodyType === 'json' && hasRequestBody(operation)) {
		request.body = parseObjectParameter(
			this,
			this.getNodeParameter('jsonBody', itemIndex, '{}'),
			'JSON Body',
		);
		request.headers = { ...headers, 'Content-Type': 'application/json' };
	} else if (resolvedBodyType === 'formUrlEncoded') {
		const formFields = parseObjectParameter(
			this,
			this.getNodeParameter('jsonBody', itemIndex, '{}'),
			'JSON Body',
		);
		const form = new URLSearchParams();
		for (const [name, value] of Object.entries(formFields)) {
			if (value !== undefined && value !== null) form.append(name, String(value));
		}
		request.body = form;
		request.headers = {
			...headers,
			'Content-Type': 'application/x-www-form-urlencoded',
		};
		request.json = false;
	} else if (resolvedBodyType === 'raw') {
		request.body = this.getNodeParameter('rawBody', itemIndex, '') as string;
		request.headers = {
			...headers,
			'Content-Type': this.getNodeParameter('rawContentType', itemIndex, 'text/plain') as string,
		};
		request.json = false;
	} else if (resolvedBodyType === 'multipart') {
		const boundary = `----n8n-pacto-${randomBytes(16).toString('hex')}`;
		const parts: Buffer[] = [];
		const fields = parseObjectParameter(
			this,
			this.getNodeParameter('multipartFields', itemIndex, '{}'),
			'Multipart Fields',
		);
		for (const [name, value] of Object.entries(fields)) {
			if (value === undefined || value === null) continue;
			parts.push(
				Buffer.from(
					`--${boundary}\r\nContent-Disposition: form-data; name="${multipartHeaderValue(name)}"\r\n\r\n${String(value)}\r\n`,
				),
			);
		}

		const binaryProperty = this.getNodeParameter('inputBinaryProperty', itemIndex, '') as string;
		if (binaryProperty) {
			const binaryData = this.helpers.assertBinaryData(itemIndex, binaryProperty);
			const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
			const fieldName = this.getNodeParameter('binaryFieldName', itemIndex, 'file') as string;
			parts.push(
				Buffer.from(
					`--${boundary}\r\nContent-Disposition: form-data; name="${multipartHeaderValue(fieldName)}"; filename="${multipartHeaderValue(binaryData.fileName || 'file')}"\r\nContent-Type: ${binaryData.mimeType || 'application/octet-stream'}\r\n\r\n`,
				),
				buffer,
				Buffer.from('\r\n'),
			);
		}
		parts.push(Buffer.from(`--${boundary}--\r\n`));
		request.body = Buffer.concat(parts);
		request.headers = {
			...headers,
			'Content-Type': `multipart/form-data; boundary=${boundary}`,
		};
		request.json = false;
	}

	return request;
}

export class Pacto implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pacto',
		name: 'pacto',
		icon: { light: 'file:pacto.svg', dark: 'file:pacto.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description:
			'Call any operation in the official Pacto Soluções API. Select an API area and operation, then provide path, query, header and body parameters. Supports pagination, files and AI Agent tool usage.',
		defaults: {
			name: 'Pacto',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'pactoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Area',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: PACTO_AREA_OPTIONS,
				default: 'Clientes',
				description: 'Functional area (OpenAPI tag) from the official Pacto API catalog',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getPactoOperations',
				},
				default: '',
				required: true,
				description:
					'Official Pacto operation to execute. Each option shows HTTP method and endpoint path.',
			},
			{
				displayName: 'Path Parameters',
				name: 'pathParameters',
				type: 'json',
				default: '{}',
				description:
					'JSON object whose keys replace placeholders in the endpoint path, e.g. {"codigo": 123}',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'json',
				default: '{}',
				description:
					'JSON object sent in the query string. For filters documented as JSON strings, stringify the nested filter value.',
			},
			{
				displayName: 'Header Parameters',
				name: 'headerParameters',
				type: 'json',
				default: '{}',
				description:
					'JSON object with operation-specific headers, commonly {"empresaId": 123}. Authorization always comes from the credential.',
			},
			{
				displayName: 'Body Type',
				name: 'bodyType',
				type: 'options',
				options: [
					{
						name: 'Automatic (Official Content Type)',
						value: 'auto',
						description: 'Use the first request content type declared by the selected operation',
					},
					{ name: 'Form URL Encoded', value: 'formUrlEncoded' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Multipart Form Data', value: 'multipart' },
					{ name: 'None', value: 'none' },
					{ name: 'Raw Text', value: 'raw' },
				],
				default: 'json',
				description: 'How to encode the request body',
			},
			{
				displayName: 'JSON Body',
				name: 'jsonBody',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						bodyType: ['auto', 'json', 'formUrlEncoded'],
					},
				},
				description:
					'Request body as a JSON object. With Form URL Encoded, object keys become form fields.',
			},
			{
				displayName: 'Raw Body',
				name: 'rawBody',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				displayOptions: {
					show: {
						bodyType: ['raw'],
					},
				},
				description: 'Raw text sent as the request body',
			},
			{
				displayName: 'Raw Content Type',
				name: 'rawContentType',
				type: 'string',
				default: 'text/plain',
				displayOptions: {
					show: {
						bodyType: ['raw'],
					},
				},
				description: 'Content-Type header for the raw request body',
			},
			{
				displayName: 'Multipart Fields',
				name: 'multipartFields',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						bodyType: ['multipart'],
					},
				},
				description: 'JSON object with text fields to add to the multipart body',
			},
			{
				displayName: 'Binary Property',
				name: 'inputBinaryProperty',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						bodyType: ['multipart'],
					},
				},
				description: 'Optional input binary property containing the file to upload',
			},
			{
				displayName: 'Binary Field Name',
				name: 'binaryFieldName',
				type: 'string',
				default: 'file',
				displayOptions: {
					show: {
						bodyType: ['multipart'],
					},
				},
				description: 'Multipart field name used for the binary file',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description:
					'Whether to paginate a list endpoint until all results are returned. Intended for GET operations.',
			},
			{
				displayName: 'Pagination',
				name: 'pagination',
				type: 'collection',
				placeholder: 'Add Pagination Option',
				default: {},
				displayOptions: {
					show: {
						returnAll: [true],
					},
				},
				options: [
					{
						displayName: 'Initial Page',
						name: 'initialPage',
						type: 'number',
						default: 0,
						description: 'First page number used by this endpoint, commonly 0 or 1',
					},
					{
						displayName: 'Max Pages',
						name: 'maxPages',
						type: 'number',
						default: 1000,
						typeOptions: { minValue: 1, maxValue: 10000 },
						description: 'Safety limit for the number of requests',
					},
					{
						displayName: 'Page Parameter',
						name: 'pageParameter',
						type: 'string',
						default: 'page',
						description: 'Query parameter that carries the current page number',
					},
					{
						displayName: 'Page Size',
						name: 'pageSize',
						type: 'number',
						default: 100,
						typeOptions: { minValue: 1 },
						description: 'Number of records requested per page',
					},
					{
						displayName: 'Page Size Parameter',
						name: 'pageSizeParameter',
						type: 'string',
						default: 'size',
						description: 'Query parameter that carries page size',
					},
					{
						displayName: 'Results Property',
						name: 'resultsProperty',
						type: 'string',
						default: '',
						description:
							'Dot path to the array in the response, e.g. content or data.items. Leave blank for automatic detection.',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Binary Property',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'Output binary property used when Response Format is File',
					},
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: 'pacto-response',
						description: 'File name used for a binary response',
					},
					{
						displayName: 'Ignore HTTP Status Errors',
						name: 'ignoreHttpStatusErrors',
						type: 'boolean',
						default: false,
						description: 'Whether to return non-2xx responses instead of failing the node',
					},
					{
						displayName: 'Include Response Headers and Status',
						name: 'includeResponseHeadersAndStatus',
						type: 'boolean',
						default: false,
						description: 'Whether to return body, headers and HTTP status together',
					},
					{
						displayName: 'MIME Type',
						name: 'mimeType',
						type: 'string',
						default: 'application/octet-stream',
						description: 'MIME type assigned to a binary response',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{ name: 'Auto-Detect / JSON', value: 'auto' },
							{ name: 'File', value: 'file' },
							{ name: 'JSON', value: 'json' },
							{ name: 'Text', value: 'text' },
						],
						default: 'auto',
						description: 'Expected response format',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						typeOptions: { minValue: 1 },
						description: 'Request timeout in milliseconds',
					},
				],
			},
		],
	};

	methods = {
		loadOptions,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const area = this.getNodeParameter('resource', itemIndex) as string;
				const operationKey = this.getNodeParameter('operation', itemIndex) as string;
				const operation = getPactoOperation(area, operationKey);
				if (!operation) {
					throw new NodeOperationError(
						this.getNode(),
						`Operation "${operationKey}" was not found in area "${area}"`,
						{ itemIndex },
					);
				}

				const pathParameters = parseObjectParameter(
					this,
					this.getNodeParameter('pathParameters', itemIndex, '{}'),
					'Path Parameters',
				);
				const endpoint = buildEndpointPath(this, operation, pathParameters);
				const request = await buildRequest.call(this, itemIndex, operation);
				const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
				const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
				const responseFormat = (options.responseFormat as string) || 'auto';

				if (returnAll) {
					if (operation.method !== 'GET') {
						throw new NodeOperationError(
							this.getNode(),
							'Return All can only be used with GET operations',
							{ itemIndex },
						);
					}
					if (responseFormat === 'file') {
						throw new NodeOperationError(
							this.getNode(),
							'Return All cannot be used with a file response',
							{ itemIndex },
						);
					}

					const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
					const pageParameter = (pagination.pageParameter as string) || 'page';
					const pageSizeParameter = (pagination.pageSizeParameter as string) || 'size';
					const pageSize = (pagination.pageSize as number) || 100;
					const maxPages = (pagination.maxPages as number) || 1000;
					const resultsProperty = (pagination.resultsProperty as string) || '';
					let currentPage = (pagination.initialPage as number) ?? 0;
					const allItems: unknown[] = [];

					for (let pageCount = 0; pageCount < maxPages; pageCount++) {
						const pageRequest: PactoRequestOptions = {
							...request,
							qs: {
								...(request.qs ?? {}),
								[pageParameter]: currentPage,
								[pageSizeParameter]: pageSize,
							},
						};
						const response = await pactoApiRequest.call(
							this,
							operation.method,
							endpoint,
							pageRequest,
						);
						const pageItems = extractPageItems(responseBody(response), resultsProperty);
						allItems.push(...pageItems);
						if (shouldStopPagination(response, pageItems.length, pageSize, currentPage)) break;
						currentPage += 1;
					}

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(allItems as IDataObject[]),
						{ itemData: { item: itemIndex } },
					);
					returnData.push(...executionData);
					continue;
				}

				const response = await pactoApiRequest.call(this, operation.method, endpoint, request);

				if (responseFormat === 'file') {
					const rawBody = responseBody(response);
					const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
					const binaryPropertyName = (options.binaryPropertyName as string) || 'data';
					const binaryData = await this.helpers.prepareBinaryData(
						buffer,
						(options.fileName as string) || 'pacto-response',
						(options.mimeType as string) || 'application/octet-stream',
					);
					const json: IDataObject =
						response?.statusCode !== undefined
							? {
									statusCode: response.statusCode,
									headers: response.headers,
								}
							: {};
					returnData.push({
						json,
						binary: { [binaryPropertyName]: binaryData },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				const responseData =
					response?.body !== undefined && response?.statusCode !== undefined
						? {
								body: response.body,
								headers: response.headers,
								statusCode: response.statusCode,
							}
						: response;
				const asArray = Array.isArray(responseData) ? responseData : [responseData];
				const normalized = asArray.map((entry) =>
					entry !== null && typeof entry === 'object' ? entry : { data: entry },
				) as IDataObject[];
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(normalized),
					{ itemData: { item: itemIndex } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex,
				});
			}
		}

		return [returnData];
	}
}
