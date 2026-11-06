import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	getPactoOperation,
	PACTO_AREA_OPTIONS,
	type PactoOperationDefinition,
} from './helpers/catalog.generated';
import {
	getPactoLookup,
	PACTO_LOOKUP_OPERATION_KEYS,
	PACTO_QUICK_SEARCH_OPERATION_KEYS,
} from './helpers/lookups.generated';
import { buildEndpointPath, extractPageItems } from './helpers/utils';
import { mergeQuickSearch, withRecordId } from './helpers/versionedInputs';
import { listSearch } from './methods/listSearch';
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

// A API pode devolver o corpo direto ou o envelope { body, statusCode } do n8n; `unknown`
// obriga a checar o formato antes de ler qualquer campo (antes era `any`, que o lint recusa).
function responseBody(response: unknown): unknown {
	const envelope = response as { body?: unknown; statusCode?: unknown } | null | undefined;
	return envelope?.body !== undefined && envelope?.statusCode !== undefined
		? envelope.body
		: response;
}

function shouldStopPagination(
	response: unknown,
	itemCount: number,
	pageSize: number,
	currentPage: number,
): boolean {
	// Só os campos de paginação importam aqui; o tipo parcial evita o `any` do código antigo.
	const body = responseBody(response) as {
		last?: boolean;
		hasNext?: boolean;
		has_more?: boolean;
		totalPages?: number;
		total_pages?: number;
	} | null;
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

		// O campo do catálogo diz `header` (singular), mas o objeto da requisição guarda os
		// cabeçalhos em `headers`. Sem este mapa, qualquer cabeçalho que não é da credencial
		// (ex.: user-agent) quebrava com "Cannot set properties of undefined".
		if (field.location === 'body') setNestedValue(request.body, field.path, value);
		else if (field.location === 'header') request.headers[field.path[0]] = value as string;
		else request[field.location][field.path[0]] = value as string;
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
		// Versão leve: workflows salvos ficam na 1 (campos como no 1.0.3) e node novo nasce na 2.
		version: [1, 2],
		defaultVersion: 2,
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
				// Título no padrão "<Entidade> Name or ID" que o lint exige para lista carregada da API.
				displayName: 'Operation Name or ID',
				// O nome interno não muda: workflows salvos guardam a operação com este nome.
				name: 'operation',
				// Lista de opções que o usuário escolhe (cada operação do catálogo).
				type: 'options',
				// A operação não aceita expressão: ela define quais campos aparecem no formulário.
				noDataExpression: true,
				// As opções vêm do método getPactoOperations, que lê a área escolhida.
				typeOptions: { loadOptionsMethod: 'getPactoOperations' },
				// Sem operação escolhida ainda, o campo começa vazio.
				default: '',
				// Sem operação o node não sabe qual rota chamar.
				required: true,
				// Texto padrão que o lint exige para lista dinâmica (aceita ID por expressão).
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				// Seletor do registro (versão 2): lista pesquisável da API ou ID colado.
				displayName: 'Registro',
				// Nome novo: o ID de caminho da versão 1 mora dentro do `fields` e continua lá.
				name: 'recordId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Escolha o registro na lista ou cole o ID',
				// Só node novo (versão 2) e só operações que a geração ligou a uma lista da API.
				displayOptions: {
					show: {
						'@version': [{ _cnd: { gte: 2 } }],
						operation: PACTO_LOOKUP_OPERATION_KEYS,
					},
				},
				modes: [
					{
						displayName: 'Da Lista',
						name: 'list',
						type: 'list',
						placeholder: 'Escolha um registro...',
						typeOptions: { searchListMethod: 'searchPactoRecords', searchable: true },
					},
					{
						displayName: 'Por ID',
						name: 'id',
						type: 'string',
						placeholder: 'ex.: 42',
					},
				],
			},
			{
				// Busca Rápida (versão 2): vira o `quicksearchValue` dentro do JSON de `filters`.
				displayName: 'Busca Rápida',
				name: 'quickSearch',
				type: 'string',
				default: '',
				description: 'Texto para buscar na listagem, sem escrever JSON no campo Filters',
				displayOptions: {
					show: {
						'@version': [{ _cnd: { gte: 2 } }],
						operation: PACTO_QUICK_SEARCH_OPERATION_KEYS,
					},
				},
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
				description: 'Whether to return all results or only up to a given limit',
			},
		],
	};

	methods = {
		loadOptions,
		resourceMapping,
		listSearch,
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

				let values = getFieldValues(this, itemIndex);
				// Versão do node deste item: 1 lê tudo do `fields`; 2 também lê recordId e quickSearch.
				const typeVersion = this.getNode().typeVersion;
				const lookup = typeVersion >= 2 ? getPactoLookup(area, operationKey) : undefined;
				// O ID escolhido no seletor ocupa o lugar do campo de caminho (antes digitado à mão).
				if (lookup) values = withRecordId(this, itemIndex, lookup, values);
				// A Busca Rápida entra no JSON de `filters` só nas operações que aceitam esse filtro.
				if (typeVersion >= 2 && PACTO_QUICK_SEARCH_OPERATION_KEYS.includes(operationKey)) {
					const quickSearch = this.getNodeParameter('quickSearch', itemIndex, '') as string;
					const merged = mergeQuickSearch(this, itemIndex, values.query__filters, quickSearch);
					values = { ...values, query__filters: merged as string };
				}
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
				// Erro da API fica NodeApiError (com o código HTTP, ex.: 401); reembrulhar tudo em
				// NodeOperationError escondia o código de quem trata o erro. O construtor devolve o
				// mesmo erro quando recebe um NodeApiError, então nada é perdido.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
