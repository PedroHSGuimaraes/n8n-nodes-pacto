/*
 * Testes do gerador de catálogo e do catálogo gerado (slices S2 e S3 do plano).
 *
 * Duas fontes de prova:
 *  - uma especificação OpenAPI pequena (test/fixtures/mini-spec.json) alimenta o gerador,
 *    para conferir cada regra sem depender da documentação viva da Pacto;
 *  - o catálogo real compilado em `dist` é comparado com a linha de base do 1.0.3
 *    (test/fixtures/catalogo-1.0.3.json), para provar que nada que já foi publicado sumiu.
 */
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const miniSpec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mini-spec.json'), 'utf8'));
const baseline = JSON.parse(
	fs.readFileSync(path.join(__dirname, 'fixtures/catalogo-1.0.3.json'), 'utf8'),
);

// O gerador é um módulo ESM; o teste é CommonJS, então carrega com import dinâmico.
const loadBuilder = () => import(pathToFileURL(path.join(root, 'scripts/catalog-builder.mjs')).href);

// Catálogo anterior de mentira: uma área com acento e uma operação que a documentação já não tem.
const previous = {
	areas: [
		{ name: 'Armário', value: 'Armário', description: 'antiga' },
		{ name: 'Clientes', value: 'Clientes', description: 'antiga' },
		{ name: 'Removida', value: 'Removida', description: 'antiga' },
	],
	operations: [
		{
			area: 'Armário',
			key: 'GET:/gestao-armario',
			name: 'Consultar armários',
			method: 'GET',
			path: '/gestao-armario',
			parameters: [],
			inputFields: [],
			requestBodyRequired: false,
			requestContentTypes: [],
			responseContentTypes: [],
		},
		{
			area: 'Removida',
			key: 'GET:/velha',
			name: 'Rota velha',
			method: 'GET',
			path: '/velha',
			parameters: [],
			inputFields: [],
			requestBodyRequired: false,
			requestContentTypes: [],
			responseContentTypes: [],
		},
	],
};

// Escreve um catálogo anterior como arquivo .ts (o formato que o CLI lê).
function writePrevious(dir) {
	const file = path.join(dir, 'previous.ts');
	fs.writeFileSync(
		file,
		`export const PACTO_AREA_OPTIONS = ${JSON.stringify(previous.areas)};\n` +
			`export const PACTO_OPERATIONS = ${JSON.stringify(previous.operations)};\n`,
	);
	return file;
}

describe('catálogo regenerado sem perda', () => {
	it('[C12] preserva todo par area+key do 1.0.3 e marca como legacy o que a documentação perdeu', async () => {
		const { buildCatalog, restoreAreaNames, mergeLegacy } = await loadBuilder();
		const fresh = buildCatalog(miniSpec);
		const restored = restoreAreaNames(
			{
				// Tira a área sem correspondência para este caso isolar só o legado.
				areas: fresh.areas.filter((area) => area.value !== 'Zï¿½'),
				operations: fresh.operations.filter((operation) => operation.area !== 'Zï¿½'),
			},
			previous.areas.map((area) => area.value),
		);
		const merged = mergeLegacy(restored, previous);
		const byPair = new Map(merged.operations.map((operation) => [`${operation.area}|${operation.key}`, operation]));
		// Par que a documentação ainda tem: presente e sem legacy.
		assert.ok(byPair.has('Armário|GET:/gestao-armario'));
		assert.equal(byPair.get('Armário|GET:/gestao-armario').legacy, undefined);
		// Par que a documentação perdeu: presente e com legacy verdadeiro.
		assert.equal(byPair.get('Removida|GET:/velha')?.legacy, true);
		// A área da operação legada continua nas opções do node.
		assert.ok(merged.areas.some((area) => area.value === 'Removida'));
	});

	it('[C12b] o catálogo gerado contém todos os 3533 pares do 1.0.3', () => {
		const { PACTO_OPERATIONS } = require('../dist/nodes/Pacto/helpers/catalog.generated');
		const present = new Set(PACTO_OPERATIONS.map((operation) => `${operation.area}|${operation.key}`));
		const missing = baseline.pares.filter((pair) => !present.has(pair));
		assert.equal(baseline.pares.length, 3533);
		assert.deepEqual(missing, []);
	});

	it('[C13] troca o nome com caractere de substituição pelo valor do 1.0.3', async () => {
		const { restoreAreaNames } = await loadBuilder();
		const catalog = {
			areas: [{ name: 'Armï¿½rio', value: 'Armï¿½rio', description: 'x' }],
			operations: [{ area: 'Armï¿½rio', key: 'GET:/a' }],
		};
		const restored = restoreAreaNames(catalog, ['Armário', 'Clientes']);
		assert.deepEqual(
			restored.areas.map((area) => area.value),
			['Armário'],
		);
		assert.equal(restored.operations[0].area, 'Armário');
		// Dois caracteres perdidos de uma vez ("ção") também voltam.
		const two = restoreAreaNames(
			{ areas: [{ name: 'Administraï¿½ï¿½o', value: 'Administraï¿½ï¿½o' }], operations: [] },
			['Administração'],
		);
		assert.equal(two.areas[0].value, 'Administração');
	});

	it('[C13b] o gerador sai com código 1 e lista o nome sem correspondência', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pacto-gen-'));
		const run = (spec) => {
			const specFile = path.join(dir, 'spec.json');
			fs.writeFileSync(specFile, JSON.stringify(spec));
			return spawnSync(
				process.execPath,
				[
					path.join(root, 'scripts/update-pacto-catalog.mjs'),
					'--spec',
					specFile,
					'--previous',
					writePrevious(dir),
					'--out-dir',
					path.join(dir, 'out'),
				],
				{ encoding: 'utf8' },
			);
		};
		// A área "Zï¿½" não casa com nenhum valor antigo: o gerador recusa e cita o nome.
		const failed = run(miniSpec);
		assert.equal(failed.status, 1);
		assert.match(failed.stderr, /Zï¿½/);
		// Sem a rota problemática, o gerador termina e grava arquivos sem caractere de substituição.
		const withoutZeta = structuredClone(miniSpec);
		delete withoutZeta.paths['/zeta'];
		const ok = run(withoutZeta);
		assert.equal(ok.status, 0, ok.stderr);
		const catalog = fs.readFileSync(path.join(dir, 'out/catalog.generated.ts'), 'utf8');
		// O nome da área e o texto da operação antiga voltam acentuados; só o texto novo
		// ("Lista ï¿½nica") continua estragado, e o gerador avisa quantos são.
		assert.ok(!catalog.includes('Armï¿½'));
		assert.ok(catalog.includes('"Armário"'));
		assert.match(ok.stdout, /sem correspondência no 1\.0\.3: 1/);
		assert.ok(catalog.includes('"legacy": true'));
	});

	it('[C14] o catálogo carregado não tem área com ï¿½ e mantém as áreas do 1.0.3', () => {
		const { PACTO_AREA_OPTIONS } = require('../dist/nodes/Pacto/helpers/catalog.generated');
		const values = PACTO_AREA_OPTIONS.map((area) => area.value);
		assert.deepEqual(
			values.filter((value) => /ï¿½|�/.test(value)),
			[],
		);
		const lost = baseline.areas.filter((area) => !values.includes(area));
		assert.deepEqual(lost, []);
	});
});

describe('texto estragado da documentação', () => {
	it('[C37] usa o texto do 1.0.3 para o mesmo campo e conta o que ficou sem correspondência', async () => {
		const { buildCatalog, repairBrokenText, restoreAreaNames } = await loadBuilder();
		const fresh = buildCatalog(miniSpec);
		const restored = restoreAreaNames(
			{
				areas: fresh.areas.filter((area) => area.value !== 'Zï¿½'),
				operations: fresh.operations.filter((operation) => operation.area !== 'Zï¿½'),
			},
			previous.areas.map((area) => area.value),
		);
		const { catalog, remaining } = repairBrokenText(restored, previous);
		const armario = catalog.operations.find((operation) => operation.key === 'GET:/gestao-armario');
		// A operação que o 1.0.3 já publica volta com o nome acentuado.
		assert.equal(armario.name, 'Consultar armários');
		// A operação nova com texto estragado continua estragada, mas é contada para o aviso.
		assert.equal(remaining, 1);
		assert.equal(catalog.operations.find((operation) => operation.key === 'GET:/novo-ruim').name, 'Lista ï¿½nica');
	});
});

describe('listas de seletor geradas', () => {
	it('[C17] cria lista só quando há GET paginado com campo do ID e rótulo, e explica o que descartou', async () => {
		const { buildCatalog, buildLookups } = await loadBuilder();
		const operations = buildCatalog(miniSpec).operations;
		const { lookups, skipped, quickSearchKeys } = buildLookups(miniSpec, operations);
		// Casos aceitos: busca por filters (alunos) e por parâmetro direto (produtos, GET e DELETE).
		assert.deepEqual(lookups['Clientes:GET:/psec/alunos/{id}'], {
			listPath: '/psec/alunos',
			pathParam: 'id',
			valueField: 'id',
			labelField: 'nome',
			search: { kind: 'filters', name: 'quicksearchValue' },
		});
		assert.deepEqual(lookups['Produto:GET:/produtos/{codigo}'], {
			listPath: '/produtos',
			pathParam: 'codigo',
			valueField: 'codigo',
			labelField: 'descricao',
			search: { kind: 'query', name: 'quicksearchValue' },
		});
		assert.ok(lookups['Produto:DELETE:/produtos/{codigo}']);
		// Casos descartados: sem page/size, sem rótulo e sem o campo do ID.
		assert.equal(Object.keys(lookups).length, 3);
		const reasons = Object.fromEntries(skipped.map((item) => [item.base, item.reason]));
		assert.match(reasons['/sem-pagina'], /page/);
		assert.match(reasons['/sem-rotulo'], /rótulo/);
		assert.match(reasons['/sem-valor'], /campo id/);
		// Só a rota cujo `filters` cita quicksearchValue ganha a Busca Rápida.
		assert.deepEqual(quickSearchKeys, ['GET:/psec/alunos']);
	});

	it('[C18] recusa uma lista que aponta para rota ausente na documentação', async () => {
		const { assertLookupRoutes } = await loadBuilder();
		assert.throws(
			() => assertLookupRoutes(miniSpec, { 'x:GET:/a/{id}': { listPath: '/nao-existe' } }),
			/\/nao-existe/,
		);
		assert.doesNotThrow(() =>
			assertLookupRoutes(miniSpec, { 'x:GET:/a/{id}': { listPath: '/psec/alunos' } }),
		);
	});
});
