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
import { buildEndpointPath, extractPageItems } from './helpers/utils';
import { loadOptions } from './methods/loadOptions';
import { resourceMapping } from './methods/resourceMapping';
import { pactoApiRequest, type PactoRequestOptions } from './transport';

const CREDENTIAL_HEADERS = new Set(['authorization', 'empresaid']);

function hasValue(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function formatDateValue(
	field: PactoOperationDefinition['inputFields'][number],
	value: unknown,
): unknown {
	if (field.type !== 'dateTime' || typeof value !== 'string') return value;
	if (/yyyy\s*[-/]?mm\s*[-/]?dd/i.test(field.description ?? '')) {
		return value.replace(/\D/g, '').slice(0, 8);
	}
	return value;
}

function setNestedValue(target: IDataObject, path: string[], value: unknown): void {
	let current = target;
	for (const segment of path.slice(0, -1)) {
		if (!current[segment] || typeof current[segment] !== 'object') {
			current[segment] = {};
		}
		current = current[segment] as IDataObject;
	}
	(current as Record<string, unknown>)[path[path.length - 1]] = value;
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

function getFieldValues(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const fields = context.getNodeParameter('fields', itemIndex, {}) as {
		value?: IDataObject | null;
	};
	return fields.value ?? {};
}

function splitInputValues(
	context: IExecuteFunctions,
	itemIndex: number,
	operation: PactoOperationDefinition,
	values: IDataObject,
): { path: IDataObject; query: IDataObject; headers: IDataObject; body: IDataObject } {
	const request = { path: {}, query: {}, headers: {}, body: {} } as {
		path: IDataObject;
		query: IDataObject;
		headers: IDataObject;
		body: IDataObject;
	};

	for (const field of operation.inputFields) {
		const value = formatDateValue(field, values[field.id]);
		const credentialHeader =
			field.location === 'header' && CREDENTIAL_HEADERS.has(field.path[0].toLowerCase());
		if (!credentialHeader && field.required && !hasValue(value)) {
			throw new NodeOperationError(
				context.getNode(),
				`Preencha o campo obrigatório "${field.displayName}"`,
				{ itemIndex },
			);
		}
		if (!hasValue(value) || credentialHeader) continue;

		if (field.location === 'body') setNestedValue(request.body, field.path, value);
		else request[field.location][field.path[0]] = value;
	}

	return request;
}

function createRequest(
	operation: PactoOperationDefinition,
	input: ReturnType<typeof splitInputValues>,
): PactoRequestOptions {
	const request: PactoRequestOptions = {
		qs: input.query,
		headers: input.headers,
		json: true,
		timeout: 30000,
	};

	if (operation.requestContentTypes.includes('application/json')) {
		request.body = input.body;
		request.headers = { ...input.headers, 'Content-Type': 'application/json' };
	} else if (operation.requestContentTypes.includes('application/x-www-form-urlencoded')) {
		const body = new URLSearchParams();
		for (const [key, value] of Object.entries(input.body)) body.append(key, String(value));
		request.body = body;
		request.headers = {
			...input.headers,
			'Content-Type': 'application/x-www-form-urlencoded',
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
			'Use Pacto Soluções with friendly fields generated from the official API documentation.',
		defaults: { name: 'Pacto' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'pactoApi', required: true }],
		properties: [
			{
				displayName: 'Area',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: PACTO_AREA_OPTIONS,
				default: 'Clientes',
				description: 'Área funcional da API Pacto',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPactoOperations' },
				default: '',
				required: true,
				description: 'Operação que será executada',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'resourceMapper',
				default: { mappingMode: 'defineBelow', value: null },
				noDataExpression: true,
				typeOptions: {
					loadOptionsDependsOn: ['resource', 'operation'],
					resourceMapper: {
						resourceMapperMethod: 'getPactoFields',
						mode: 'add',
						valuesLabel: 'Campos da operação',
						fieldWords: { singular: 'campo', plural: 'campos' },
						addAllFields: true,
						supportAutoMap: false,
						hideNoDataError: true,
					},
				},
				description:
					'Campos amigáveis da operação. Empresa ID e Secret Key são configurados na credencial.',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Retornar todos os resultados de uma operação de listagem',
			},
		],
	};

	methods = {
		loadOptions,
		resourceMapping,
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
						`Operação "${operationKey}" não encontrada na área "${area}"`,
						{ itemIndex },
					);
				}

				const values = getFieldValues(this, itemIndex);
				const input = splitInputValues(this, itemIndex, operation, values);
				const endpoint = buildEndpointPath(this, operation, input.path);
				const request = createRequest(operation, input);
				const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;

				if (returnAll) {
					if (operation.method !== 'GET') {
						throw new NodeOperationError(
							this.getNode(),
							'Return All só pode ser usado em operações GET',
							{ itemIndex },
						);
					}

					const allItems: unknown[] = [];
					for (let page = 0; page < 1000; page++) {
						const response = await pactoApiRequest.call(this, operation.method, endpoint, {
							...request,
							qs: { ...(request.qs ?? {}), page, size: 100 },
						});
						const pageItems = extractPageItems(responseBody(response), '');
						allItems.push(...pageItems);
						if (shouldStopPagination(response, pageItems.length, 100, page)) break;
					}
					returnData.push(
						...this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray(allItems as IDataObject[]),
							{ itemData: { item: itemIndex } },
						),
					);
					continue;
				}

				const response = await pactoApiRequest.call(this, operation.method, endpoint, request);
				const asArray = Array.isArray(response) ? response : [response];
				const normalized = asArray.map((entry) =>
					entry !== null && typeof entry === 'object' ? entry : { data: entry },
				) as IDataObject[];
				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(normalized), {
						itemData: { item: itemIndex },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
