/*
 * Funções puras que montam o catálogo do node Pacto a partir da especificação OpenAPI.
 *
 * Este módulo não faz rede nem lê o disco: recebe a especificação (e o catálogo anterior)
 * como objetos e devolve objetos. Assim os testes alimentam o gerador com uma
 * especificação pequena e conferem o resultado sem depender da documentação viva.
 * O `update-pacto-catalog.mjs` é a casca que busca a especificação, chama estas funções
 * e grava os arquivos `*.generated.ts`.
 */

export const DOCS_URL = 'https://api-docs.pactosolucoes.com.br/';
export const API_BASE_URL = 'https://apigw.pactosolucoes.com.br';
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

// Segue um `$ref` interno ("#/components/...") até o objeto real da especificação.
export function resolveReference(spec, value) {
	if (!value?.$ref?.startsWith('#/')) return value;
	return value.$ref
		.slice(2)
		.split('/')
		.reduce(
			(current, segment) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')],
			spec,
		);
}

// Tira HTML e marcações Markdown das descrições para o texto aparecer limpo no n8n.
export function plainText(value = '') {
	return value
		.replace(/<[^>]+>/g, ' ')
		.replace(/[#*_`>⚠️]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function schemaType(spec, schema) {
	const resolved = resolveReference(spec, schema) ?? {};
	if (resolved.type === 'array') {
		return `array<${schemaType(spec, resolved.items) || 'object'}>`;
	}
	return resolved.type ?? (resolved.properties ? 'object' : undefined);
}

// Junta os blocos `allOf` de um schema num só, para ler todas as propriedades de uma vez.
export function mergeSchema(spec, schema) {
	const resolved = resolveReference(spec, schema) ?? {};
	if (!resolved.allOf?.length) return resolved;
	return resolved.allOf.reduce(
		(merged, part) => {
			const next = mergeSchema(spec, part);
			return {
				...merged,
				...next,
				properties: { ...(merged.properties ?? {}), ...(next.properties ?? {}) },
				required: [...new Set([...(merged.required ?? []), ...(next.required ?? [])])],
			};
		},
		{ ...resolved, allOf: undefined },
	);
}

function titleCase(value) {
	const terms = {
		dt: 'Data',
		data: 'Data',
		inicio: 'Início',
		fim: 'Fim',
		codigo: 'Código',
		cnpj: 'CNPJ',
		cpf: 'CPF',
		email: 'E-mail',
		id: 'ID',
		matricula: 'Matrícula',
		telefone: 'Telefone',
		url: 'URL',
	};
	return value
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => terms[word.toLowerCase()] ?? `${word[0].toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

function isDateField(schema, name = '', description = '') {
	return (
		schema.format === 'date' ||
		schema.format === 'date-time' ||
		/(^|[_-])(dt|data|date)([_-]|$)/i.test(name) ||
		/\bdata\b|\bdate\b|yyyy\s*[-/]?mm\s*[-/]?dd/i.test(description)
	);
}

function mapperFieldType(schema, name, description) {
	if (schema.enum?.length) return 'options';
	if (schema.type === 'boolean') return 'boolean';
	if (schema.type === 'integer' || schema.type === 'number') return 'number';
	if (schema.type === 'array') return 'array';
	if (isDateField(schema, name, description)) return 'dateTime';
	return 'string';
}

function mapperOptions(schema) {
	if (!schema.enum?.length) return undefined;
	return schema.enum.map((value) => ({ name: titleCase(String(value)), value }));
}

function primitiveDefault(value) {
	return ['string', 'number', 'boolean'].includes(typeof value) || value === null
		? value
		: undefined;
}

function getBodyFields(spec, schema, parent = [], required = false, depth = 0) {
	const resolved = mergeSchema(spec, schema);
	if (depth > 4 || !resolved.properties) return [];
	const requiredProperties = new Set(resolved.required ?? []);
	return Object.entries(resolved.properties).flatMap(([name, property]) => {
		const propertySchema = mergeSchema(spec, property);
		const propertyPath = [...parent, name];
		const isRequired = required || requiredProperties.has(name);
		if (propertySchema.properties) {
			return getBodyFields(spec, propertySchema, propertyPath, isRequired, depth + 1);
		}
		return [
			{
				id: `body__${propertyPath.join('__')}`,
				location: 'body',
				path: propertyPath,
				displayName: propertyPath.map(titleCase).join(' — '),
				required: isRequired,
				type: mapperFieldType(propertySchema, name, propertySchema.description),
				options: mapperOptions(propertySchema),
				description: plainText(propertySchema.description),
				defaultValue: primitiveDefault(propertySchema.example ?? propertySchema.default),
			},
		];
	});
}

function getInputFields(spec, parameters, requestBody) {
	const parameterFields = parameters.map((parameter) => {
		const schema = mergeSchema(spec, parameter.schema);
		return {
			id: `${parameter.in}__${parameter.name}`,
			location: parameter.in,
			path: [parameter.name],
			displayName: titleCase(parameter.name),
			required: parameter.required,
			type: mapperFieldType(schema, parameter.name, parameter.description),
			options: mapperOptions(schema),
			description: parameter.description,
			defaultValue: primitiveDefault(parameter.example ?? schema.example ?? schema.default),
		};
	});
	const jsonSchema = requestBody?.content?.['application/json']?.schema;
	return [...parameterFields, ...getBodyFields(spec, jsonSchema)];
}

// Lê a especificação inteira e devolve { areas, operations } no formato do catálogo.
export function buildCatalog(spec) {
	const documentedTags = new Map((spec.tags ?? []).map((tag) => [tag.name, tag.description]));
	const operations = [];

	for (const [endpointPath, pathItem] of Object.entries(spec.paths ?? {})) {
		const commonParameters = pathItem.parameters ?? [];
		for (const [method, rawOperation] of Object.entries(pathItem)) {
			if (!HTTP_METHODS.has(method)) continue;

			const operation = resolveReference(spec, rawOperation);
			const parameters = [...commonParameters, ...(operation.parameters ?? [])]
				.map((parameter) => resolveReference(spec, parameter))
				.filter(
					(parameter) =>
						parameter &&
						typeof parameter.name === 'string' &&
						['path', 'query', 'header', 'cookie'].includes(parameter.in),
				)
				.map((parameter) => ({
					name: parameter.name,
					in: parameter.in,
					required: parameter.required === true,
					type: schemaType(spec, parameter.schema),
					description: plainText(parameter.description),
					example: parameter.example ?? parameter.schema?.example,
				}));
			const requestBody = resolveReference(spec, operation.requestBody);
			const contentTypes = Object.keys(requestBody?.content ?? {});
			const tags = operation.tags?.length ? operation.tags : ['Other'];

			for (const area of tags) {
				const description = plainText(operation.description);
				const scope =
					operation['x-scope'] ??
					description.match(
						/Escopo de permissão necessário para uso do endpoint:\s*([^\s]+)/i,
					)?.[1];
				operations.push({
					key: `${method.toUpperCase()}:${endpointPath}`,
					area,
					name:
						plainText(operation.summary) ||
						operation.operationId ||
						`${method.toUpperCase()} ${endpointPath}`,
					method: method.toUpperCase(),
					path: endpointPath,
					operationId: operation.operationId,
					description,
					scope,
					parameters,
					inputFields: getInputFields(spec, parameters, requestBody),
					requestBodyRequired: requestBody?.required === true,
					requestContentTypes: contentTypes,
					responseContentTypes: [
						...new Set(
							Object.values(operation.responses ?? {}).flatMap((response) =>
								Object.keys(resolveReference(spec, response)?.content ?? {}),
							),
						),
					],
				});
			}
		}
	}

	const uniqueAreas = [...new Set(operations.map((operation) => operation.area))];
	const areas = uniqueAreas
		.map((name) => ({
			name,
			value: name,
			description: plainText(documentedTags.get(name) ?? `Operações da área ${name}`),
		}))
		.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
	operations.sort(
		(left, right) =>
			left.area.localeCompare(right.area, 'pt-BR') ||
			left.name.localeCompare(right.name, 'pt-BR') ||
			left.path.localeCompare(right.path),
	);

	return { areas, operations };
}

// Marcas de texto estragado: a documentação viva às vezes traz "ï¿½" (os três caracteres que
// aparecem quando o byte EF BF BD é lido como Latin-1) ou o próprio U+FFFD no lugar do acento.
const BROKEN_CHAR = /ï¿½|�/;
const BROKEN_CHAR_GLOBAL = /ï¿½|�/g;

// Escapa texto para entrar literal numa expressão regular.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Procura, entre os valores antigos, o único que casa com o nome estragado.
// Cada marca estragada vale por exatamente um caractere ("ç" e "ã" viram duas marcas).
function findRestoredName(brokenName, previousValues) {
	const pattern = brokenName
		.split(BROKEN_CHAR_GLOBAL)
		.map(escapeRegExp)
		.join('.');
	const matcher = new RegExp(`^${pattern}$`, 'u');
	return previousValues.filter((value) => !BROKEN_CHAR.test(value) && matcher.test(value));
}

// Troca nomes de área com caractere de substituição pelo valor que o 1.0.3 já publica.
// O valor da área é guardado nos workflows salvos, então ele nunca pode mudar de nome.
// Sem uma correspondência única, o gerador para e lista os nomes (a pessoa decide o valor).
export function restoreAreaNames(catalog, previousAreaValues) {
	const renames = new Map();
	const unresolved = [];
	for (const area of catalog.areas) {
		if (!BROKEN_CHAR.test(area.value)) continue;
		const candidates = findRestoredName(area.value, previousAreaValues);
		if (candidates.length === 1) renames.set(area.value, candidates[0]);
		else unresolved.push(`${area.value} (${candidates.length} correspondências)`);
	}
	if (unresolved.length > 0) {
		throw new Error(
			`Áreas com caractere de substituição sem correspondência única no catálogo anterior: ${unresolved.join('; ')}`,
		);
	}
	if (renames.size === 0) return catalog;

	const rename = (name) => renames.get(name) ?? name;
	// Duas áreas podem virar a mesma; a primeira com descrição de verdade fica.
	// A descrição padrão ("Operações da área X") também cita o nome, então troca junto.
	const areaByValue = new Map();
	for (const area of catalog.areas) {
		const value = rename(area.value);
		if (!areaByValue.has(value)) {
			areaByValue.set(value, {
				...area,
				name: value,
				value,
				description: (area.description ?? '').replaceAll(area.value, value),
			});
		}
	}
	return {
		areas: [...areaByValue.values()].sort((left, right) =>
			left.name.localeCompare(right.name, 'pt-BR'),
		),
		operations: catalog.operations.map((operation) => ({
			...operation,
			area: rename(operation.area),
		})),
	};
}

// Troca texto estragado (nome e descrição de operação e de campo) pelo texto do 1.0.3.
// A documentação viva às vezes perde o acento ("Armï¿½rio"). O 1.0.3 guardou o texto bom.
// Para o mesmo campo da mesma operação, o texto antigo vence se ele casa com o estragado
// (cada marca vale por um caractere). Texto novo sem par antigo fica como veio e é contado.
export function repairBrokenText(catalog, previous) {
	const previousByPair = new Map(
		previous.operations.map((operation) => [`${operation.area}|${operation.key}`, operation]),
	);
	let remaining = 0;

	// Acha no outro lado da comparação o item de lista que corresponde a este.
	const findPeer = (item, index, peers) => {
		if (!Array.isArray(peers)) return undefined;
		if (item && typeof item === 'object' && item.id !== undefined) {
			return peers.find((peer) => peer?.id === item.id);
		}
		if (item && typeof item === 'object' && item.name !== undefined && item.in !== undefined) {
			return peers.find((peer) => peer?.name === item.name && peer?.in === item.in);
		}
		return peers[index];
	};

	const repair = (value, old) => {
		if (typeof value === 'string') {
			if (!BROKEN_CHAR.test(value)) return value;
			const matcher = new RegExp(`^${value.split(BROKEN_CHAR_GLOBAL).map(escapeRegExp).join('.')}$`, 'u');
			if (typeof old === 'string' && !BROKEN_CHAR.test(old) && matcher.test(old)) return old;
			remaining += 1;
			return value;
		}
		if (Array.isArray(value)) {
			return value.map((item, index) => repair(item, findPeer(item, index, old)));
		}
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).map(([key, inner]) => [key, repair(inner, old?.[key])]),
			);
		}
		return value;
	};

	return {
		catalog: {
			areas: catalog.areas,
			operations: catalog.operations.map((operation) =>
				repair(operation, previousByPair.get(`${operation.area}|${operation.key}`)),
			),
		},
		remaining,
	};
}

// Mantém no catálogo o que o 1.0.3 publicava e a documentação viva já não lista.
// Workflow salvo guarda a área e a chave da operação; se elas sumirem, o workflow quebra.
// A operação antiga volta marcada `legacy: true` (a versão 2 do node a esconde da lista).
export function mergeLegacy(catalog, previous) {
	const livePairs = new Set(
		catalog.operations.map((operation) => `${operation.area}|${operation.key}`),
	);
	const legacyOperations = previous.operations
		.filter((operation) => !livePairs.has(`${operation.area}|${operation.key}`))
		.map((operation) => ({ ...operation, legacy: true }));
	if (legacyOperations.length === 0) return catalog;

	const knownAreas = new Set(catalog.areas.map((area) => area.value));
	const legacyAreas = previous.areas.filter((area) => !knownAreas.has(area.value));
	return {
		areas: [...catalog.areas, ...legacyAreas].sort((left, right) =>
			left.name.localeCompare(right.name, 'pt-BR'),
		),
		operations: [...catalog.operations, ...legacyOperations],
	};
}

// Mantém, nas operações vivas, os campos que o catálogo anterior tinha e a documentação viva tirou.
// Por quê: o workflow salvo na versão 1 guarda esses campos em `fields` e o node só envia o que o
// catálogo conhece; sem eles, o PUT de Atividades perdia o body e passava a exigir outros campos.
// O campo que volta é opcional, porque a documentação nova já não o exige, e vai depois dos campos
// vivos. Rodar de novo sobre o próprio resultado não muda nada (o catálogo anterior já os tem).
export function keepRetiredFields(catalog, previous) {
	const before = new Map(
		previous.operations.map((operation) => [`${operation.area}|${operation.key}`, operation]),
	);
	const operations = catalog.operations.map((operation) => {
		const old = before.get(`${operation.area}|${operation.key}`);
		// Operação legada já vem inteira do catálogo anterior; operação nova não tem passado.
		if (operation.legacy || !old) return operation;
		const present = new Set(operation.inputFields.map((field) => field.id));
		const retired = old.inputFields
			.filter((field) => !present.has(field.id))
			.map((field) => ({ ...field, required: false }));
		return retired.length === 0
			? operation
			: { ...operation, inputFields: [...operation.inputFields, ...retired] };
	});
	return { ...catalog, operations };
}

// Motivo da maioria das bases descartadas: a rota base nem existe como listagem.
export const NO_GET_REASON = 'sem GET na base';

// Campos do item que servem de rótulo na lista, na ordem de preferência.
const LABEL_FIELDS = ['nome', 'descricao', 'name', 'titulo'];

// Nomes dos parâmetros de query de uma operação GET.
function queryParameters(spec, operation) {
	return (operation.parameters ?? [])
		.map((parameter) => resolveReference(spec, parameter))
		.filter((parameter) => parameter?.in === 'query');
}

// Propriedades do item que a listagem devolve em `content` (lista ou objeto único).
function listItemProperties(spec, operation) {
	const response = resolveReference(spec, operation.responses?.['200']);
	const media = response?.content?.['application/json'] ?? response?.content?.['*/*'];
	const envelope = mergeSchema(spec, media?.schema);
	const content = envelope.properties?.content;
	const item = mergeSchema(spec, content?.items ?? content);
	return Object.keys(item.properties ?? {});
}

// Como a listagem aceita busca por texto: parâmetro `quicksearchValue` na query, ou dentro
// do JSON do parâmetro `filters` quando a descrição dele cita o filtro. Sem nenhum dos dois,
// o node filtra a página sozinho.
function searchSupport(spec, listOperation) {
	const parameters = queryParameters(spec, listOperation);
	if (parameters.some((parameter) => parameter.name === 'quicksearchValue')) {
		return { kind: 'query', name: 'quicksearchValue' };
	}
	const filters = parameters.find((parameter) => parameter.name === 'filters');
	if (filters && /quicksearchValue/.test(filters.description ?? '')) {
		return { kind: 'filters', name: 'quicksearchValue' };
	}
	return null;
}

// Decide a lista de uma base. Devolve { lookup } ou { reason } quando não dá para usar.
function lookupForBase(spec, base, pathParam) {
	const listOperation = resolveReference(spec, spec.paths?.[base]?.get);
	if (!listOperation) return { reason: NO_GET_REASON };
	const names = queryParameters(spec, listOperation).map((parameter) => parameter.name);
	if (!names.includes('page') || !names.includes('size')) {
		return { reason: 'a listagem não tem page e size' };
	}
	const properties = listItemProperties(spec, listOperation);
	const labelField = LABEL_FIELDS.find((field) => properties.includes(field));
	if (!labelField) return { reason: 'o item não tem campo de rótulo (nome, descricao, name, titulo)' };
	// O valor da lista é o campo com o mesmo nome do parâmetro de caminho (id para {id}).
	if (!properties.includes(pathParam)) return { reason: `o item não tem o campo ${pathParam}` };
	return {
		lookup: {
			listPath: base,
			pathParam,
			valueField: pathParam,
			labelField,
			search: searchSupport(spec, listOperation),
		},
	};
}

// Descobre, para cada operação com ID de caminho, a rota de listagem que alimenta o seletor.
// Devolve as listas por "area:key", as bases descartadas com o motivo e as chaves de operação
// que aceitam a Busca Rápida (parâmetro `filters` citando `quicksearchValue`).
export function buildLookups(spec, operations) {
	const lookups = {};
	const skippedByBase = new Map();
	const baseResults = new Map();
	for (const operation of operations) {
		const match = operation.path.match(/^(.*?)\/\{([^}]+)\}/);
		if (!match) continue;
		const [, base, pathParam] = match;
		const cacheKey = `${base}|${pathParam}`;
		if (!baseResults.has(cacheKey)) baseResults.set(cacheKey, lookupForBase(spec, base, pathParam));
		const result = baseResults.get(cacheKey);
		if (result.lookup) lookups[`${operation.area}:${operation.key}`] = result.lookup;
		else if (!skippedByBase.has(base)) skippedByBase.set(base, result.reason);
	}
	const quickSearchKeys = [
		...new Set(
			operations
				.filter((operation) =>
					operation.inputFields.some(
						(field) =>
							field.id === 'query__filters' && /quicksearchValue/.test(field.description ?? ''),
					),
				)
				.map((operation) => operation.key),
		),
	].sort();
	return {
		lookups,
		skipped: [...skippedByBase].map(([base, reason]) => ({ base, reason })),
		quickSearchKeys,
	};
}

// Garante que toda lista aponta para uma rota GET que existe na documentação.
// Rota inventada mostraria registros de outra entidade no seletor, então o gerador para.
export function assertLookupRoutes(spec, lookups) {
	for (const [key, lookup] of Object.entries(lookups)) {
		if (!spec.paths?.[lookup.listPath]?.get) {
			throw new Error(`Rota de listagem ausente na documentação: GET ${lookup.listPath} (${key})`);
		}
	}
}

// Quantas operações cada pedaço do catálogo guarda (veja o comentário de `serializeCatalog`).
const OPERATIONS_PER_CHUNK = 500;

// Texto do arquivo `catalog.generated.ts`.
// As operações saem em pedaços de 500, cada um anotado com o tipo: com mais de 4 mil operações num
// único literal o TypeScript tentava juntar tudo numa união gigante e parava com TS2590.
export function serializeCatalog(catalog, spec, generatedAt = new Date().toISOString()) {
	const chunkNames = [];
	let operationChunks = '';
	for (let start = 0; start < catalog.operations.length; start += OPERATIONS_PER_CHUNK) {
		const name = `PACTO_OPERATIONS_PART_${chunkNames.length}`;
		chunkNames.push(name);
		const part = catalog.operations.slice(start, start + OPERATIONS_PER_CHUNK);
		operationChunks += `const ${name}: PactoOperationDefinition[] = ${JSON.stringify(part, null, '\t')};\n`;
	}
	return `// Generated from ${DOCS_URL}
// Run \`npm run update:catalog\` to refresh this file.

import type { INodePropertyOptions } from 'n8n-workflow';

export type PactoParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface PactoParameterDefinition {
\tname: string;
\tin: PactoParameterLocation;
\trequired: boolean;
\ttype?: string;
\tdescription?: string;
\texample?: unknown;
}

export interface PactoInputFieldDefinition {
\tid: string;
\tlocation: 'path' | 'query' | 'header' | 'body';
\tpath: string[];
\tdisplayName: string;
\trequired: boolean;
\ttype: 'boolean' | 'number' | 'string' | 'dateTime' | 'array' | 'options';
\toptions?: INodePropertyOptions[];
\tdescription?: string;
\tdefaultValue?: string | number | boolean | null;
}

export interface PactoOperationDefinition {
\tkey: string;
\tarea: string;
\tname: string;
\tmethod: string;
\tpath: string;
\toperationId?: string;
\tdescription?: string;
\tscope?: string;
\tparameters: PactoParameterDefinition[];
\tinputFields: PactoInputFieldDefinition[];
\trequestBodyRequired: boolean;
\trequestContentTypes: string[];
\tresponseContentTypes: string[];
\tlegacy?: boolean;
}

export const PACTO_API_BASE_URL = ${JSON.stringify(API_BASE_URL)};
export const PACTO_OPENAPI_VERSION = ${JSON.stringify(spec.openapi)};
export const PACTO_CATALOG_GENERATED_AT = ${JSON.stringify(generatedAt)};
export const PACTO_AREA_OPTIONS: INodePropertyOptions[] = ${JSON.stringify(catalog.areas, null, '\t')};
${operationChunks}
export const PACTO_OPERATIONS: PactoOperationDefinition[] = [${chunkNames.map((name) => `...${name}`).join(', ')}];

const operationByKey = new Map(
\tPACTO_OPERATIONS.map((operation) => [\`\${operation.area}:\${operation.key}\`, operation]),
);

export function getPactoOperation(area: string, key: string): PactoOperationDefinition | undefined {
\treturn operationByKey.get(\`\${area}:\${key}\`);
}
`;
}

// Texto do arquivo `lookups.generated.ts`.
// Ele guarda as listas dos seletores e as operações que aceitam a Busca Rápida.
export function serializeLookups(result, generatedAt = new Date().toISOString()) {
	// Chaves distintas de operação (sem a área), usadas no `displayOptions` do node.
	const operationKeys = [
		...new Set(Object.keys(result.lookups).map((key) => key.slice(key.indexOf(':') + 1))),
	].sort();
	return `// Generated by scripts/update-pacto-catalog.mjs from ${DOCS_URL}
// Run \`npm run update:catalog\` to refresh this file. Generated at ${generatedAt}.

export interface PactoLookup {
\t// Rota GET que lista os registros (ex.: /psec/alunos).
\tlistPath: string;
\t// Nome do parâmetro de caminho que o seletor substitui (ex.: id).
\tpathParam: string;
\t// Campos do item da lista usados como valor e como rótulo.
\tvalueField: string;
\tlabelField: string;
\t// Como a listagem aceita busca por texto; null = o node filtra a página sozinho.
\tsearch: { kind: 'query' | 'filters'; name: string } | null;
}

export const PACTO_LOOKUPS: Record<string, PactoLookup> = ${JSON.stringify(result.lookups, null, '\t')};

export const PACTO_LOOKUP_OPERATION_KEYS: string[] = ${JSON.stringify(operationKeys, null, '\t')};

export const PACTO_QUICK_SEARCH_OPERATION_KEYS: string[] = ${JSON.stringify(result.quickSearchKeys, null, '\t')};

export function getPactoLookup(area: string, key: string): PactoLookup | undefined {
\treturn PACTO_LOOKUPS[\`\${area}:\${key}\`];
}
`;
}
