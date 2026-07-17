import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DOCS_URL = 'https://api-docs.pactosolucoes.com.br/';
const API_BASE_URL = 'https://apigw.pactosolucoes.com.br';
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.resolve(currentDirectory, '../nodes/Pacto/helpers/catalog.generated.ts');

async function fetchText(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Could not download ${url}: HTTP ${response.status}`);
	}
	return response.text();
}

function resolveReference(spec, value) {
	if (!value?.$ref?.startsWith('#/')) return value;
	return value.$ref
		.slice(2)
		.split('/')
		.reduce(
			(current, segment) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')],
			spec,
		);
}

function plainText(value = '') {
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

async function loadOfficialSpec() {
	const html = await fetchText(DOCS_URL);
	const mainPath = html.match(/\/static\/js\/main\.[^"]+\.js/)?.[0];
	if (!mainPath) throw new Error('Could not find the documentation main bundle');

	const mainBundle = await fetchText(new URL(mainPath, DOCS_URL));
	const docsChunkHash =
		mainBundle.match(/983:"([^"]+)"/)?.[1] ?? mainBundle.match(/983:'([^']+)'/)?.[1];
	if (!docsChunkHash) throw new Error('Could not find the OpenAPI documentation chunk');

	const sourceMapUrl = new URL(`/static/js/983.${docsChunkHash}.chunk.js.map`, DOCS_URL);
	const sourceMap = JSON.parse(await fetchText(sourceMapUrl));
	const sourceIndex = sourceMap.sources.findIndex((source) => source.endsWith('apiDocs.js'));
	if (sourceIndex < 0 || !sourceMap.sourcesContent?.[sourceIndex]) {
		throw new Error('Could not find apiDocs.js in the documentation source map');
	}

	const source = sourceMap.sourcesContent[sourceIndex]
		.replace(/export\s+default\s+function\s+apiDocs/, 'function apiDocs')
		.concat('\nglobalThis.__pactoApiDocs = apiDocs;\n');
	const sandbox = {};
	vm.runInNewContext(source, sandbox, { timeout: 30_000 });
	return sandbox.__pactoApiDocs();
}

function buildCatalog(spec) {
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

function serialize(catalog, spec) {
	const generatedAt = new Date().toISOString();
	return `/* eslint-disable */
// Generated from ${DOCS_URL}
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
\trequestBodyRequired: boolean;
\trequestContentTypes: string[];
\tresponseContentTypes: string[];
}

export const PACTO_API_BASE_URL = ${JSON.stringify(API_BASE_URL)};
export const PACTO_OPENAPI_VERSION = ${JSON.stringify(spec.openapi)};
export const PACTO_CATALOG_GENERATED_AT = ${JSON.stringify(generatedAt)};
export const PACTO_AREA_OPTIONS: INodePropertyOptions[] = ${JSON.stringify(catalog.areas, null, '\t')};
export const PACTO_OPERATIONS: PactoOperationDefinition[] = ${JSON.stringify(catalog.operations, null, '\t')};

const operationByKey = new Map(
\tPACTO_OPERATIONS.map((operation) => [\`\${operation.area}:\${operation.key}\`, operation]),
);

export function getPactoOperation(area: string, key: string): PactoOperationDefinition | undefined {
\treturn operationByKey.get(\`\${area}:\${key}\`);
}
`;
}

const spec = await loadOfficialSpec();
const catalog = buildCatalog(spec);
await writeFile(outputFile, serialize(catalog, spec), 'utf8');

console.log(
	`Pacto catalog updated: ${catalog.areas.length} areas, ${catalog.operations.length} tagged operations, ${Object.keys(spec.paths ?? {}).length} paths.`,
);
