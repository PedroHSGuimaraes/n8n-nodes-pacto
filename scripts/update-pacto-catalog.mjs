/*
 * Atualiza os arquivos gerados do node Pacto (`catalog.generated.ts` e `lookups.generated.ts`).
 *
 * Uso:
 *   npm run update:catalog                       lê a documentação viva da Pacto
 *   node scripts/update-pacto-catalog.mjs --spec arquivo.json --previous catalogo.ts --out-dir pasta
 *
 * As opções `--spec`, `--previous` e `--out-dir` existem para os testes e para rodar sem rede:
 * a primeira troca a documentação viva por um arquivo, a segunda diz qual catálogo anterior
 * preservar e a terceira diz onde gravar. Exige Node 24 ou mais novo, porque lê o catálogo
 * anterior (um arquivo .ts) direto, sem compilar.
 *
 * Toda a regra de montagem fica em `catalog-builder.mjs`; este arquivo só busca os dados,
 * chama o gerador e grava o resultado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
	assertLookupRoutes,
	buildCatalog,
	buildLookups,
	DOCS_URL,
	NO_GET_REASON,
	keepRetiredFields,
	mergeLegacy,
	repairBrokenText,
	restoreAreaNames,
	serializeCatalog,
	serializeLookups,
} from './catalog-builder.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutDir = path.resolve(currentDirectory, '../nodes/Pacto/helpers');

// Lê `--nome valor` da linha de comando.
function readOption(name) {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function fetchText(url) {
	// Sem timeout o download travaria o terminal se a documentação ficasse fora do ar.
	const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
	if (!response.ok) {
		throw new Error(`Could not download ${url}: HTTP ${response.status}`);
	}
	return response.text();
}

// A documentação publicada é uma página React; a OpenAPI mora no source map do bloco `983`.
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

// Carrega o catálogo anterior (arquivo .ts gerado por este mesmo script) para preservá-lo.
async function loadPreviousCatalog(file) {
	if (!existsSync(file)) return { areas: [], operations: [] };
	const module = await import(pathToFileURL(file).href);
	return { areas: module.PACTO_AREA_OPTIONS ?? [], operations: module.PACTO_OPERATIONS ?? [] };
}

async function main() {
	const specFile = readOption('spec');
	const outDir = path.resolve(readOption('out-dir') ?? defaultOutDir);
	const previousFile = path.resolve(
		readOption('previous') ?? path.join(defaultOutDir, 'catalog.generated.ts'),
	);

	const spec = specFile ? JSON.parse(readFileSync(specFile, 'utf8')) : await loadOfficialSpec();
	const previous = await loadPreviousCatalog(previousFile);

	// Ordem importa: primeiro o nome da área volta ao valor antigo, depois o legado entra,
	// e só então as listas são inferidas (elas usam o nome final da área).
	const fresh = buildCatalog(spec);
	const restored = restoreAreaNames(
		fresh,
		previous.areas.map((area) => area.value),
	);
	const { catalog: repaired, remaining } = repairBrokenText(restored, previous);
	// Primeiro as operações removidas entram como legacy; depois as vivas recuperam os campos que perderam.
	const catalog = keepRetiredFields(mergeLegacy(repaired, previous), previous);
	const liveOperations = catalog.operations.filter((operation) => !operation.legacy);
	const lookupResult = buildLookups(spec, liveOperations);
	assertLookupRoutes(spec, lookupResult.lookups);

	await mkdir(outDir, { recursive: true });
	await writeFile(path.join(outDir, 'catalog.generated.ts'), serializeCatalog(catalog, spec), 'utf8');
	await writeFile(path.join(outDir, 'lookups.generated.ts'), serializeLookups(lookupResult), 'utf8');

	const legacyCount = catalog.operations.filter((operation) => operation.legacy).length;
	console.log(
		`Pacto catalog updated: ${catalog.areas.length} areas, ${catalog.operations.length} operations ` +
			`(${legacyCount} legacy), ${Object.keys(lookupResult.lookups).length} lookups, ` +
			`${Object.keys(spec.paths ?? {}).length} paths.`,
	);
	// Texto novo da documentação com acento perdido não tem como voltar; o aviso conta quantos.
	if (remaining > 0) {
		console.log(`Texto com caractere de substituição sem correspondência no 1.0.3: ${remaining}`);
	}
	// Lista as bases que não viraram seletor para o dono decidir se quer completar à mão.
	// As bases sem GET (maioria) não são candidatas; elas entram só na contagem para não afogar o resto.
	const withoutGet = lookupResult.skipped.filter((item) => item.reason === NO_GET_REASON);
	console.log(`Lookup skipped: ${withoutGet.length} bases (${NO_GET_REASON})`);
	for (const item of lookupResult.skipped.filter((entry) => entry.reason !== NO_GET_REASON)) {
		console.log(`Lookup skipped: ${item.base} (${item.reason})`);
	}
}

main().catch((error) => {
	// Qualquer falha encerra com código 1 e diz o motivo, para o CI e o dono notarem.
	console.error(`ERRO: ${error.message}`);
	process.exit(1);
});
