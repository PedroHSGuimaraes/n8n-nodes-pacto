/*
 * Testes dos IDs guiados da versão 2 (slice S3 do plano node-cli-campos-v2).
 *
 * Na versão 2, o ID de caminho de uma operação com lista vira o Resource Locator `recordId`:
 * a pessoa escolhe o registro numa lista pesquisável ou cola o ID. Os testes usam o contexto
 * falso para ver a requisição que o `execute` e o `listSearch` fariam.
 */
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { NodeApiError, NodeOperationError } = require('n8n-workflow');

const { Pacto } = require('../dist/nodes/Pacto/Pacto.node');
const { PACTO_LOOKUP_OPERATION_KEYS } = require('../dist/nodes/Pacto/helpers/lookups.generated');
const { makeContext } = require('./helpers.cjs');

const node = new Pacto();
const property = (name) => node.description.properties.find((item) => item.name === name);

// Parâmetros de uma chamada do `execute` na operação GET /psec/alunos/{id}.
function alunoParams(recordId, extra = {}) {
	return {
		resource: 'Clientes',
		operation: 'GET:/psec/alunos/{id}',
		fields: { mappingMode: 'defineBelow', value: {} },
		returnAll: false,
		recordId,
		...extra,
	};
}

// Contexto do editor (listSearch) na mesma operação.
function editorContext(responder, extra = {}) {
	return makeContext({
		typeVersion: 2,
		parameters: { resource: 'Clientes', operation: 'GET:/psec/alunos/{id}', ...extra },
		responder,
	});
}

// Chama o listSearch como o n8n chama: this = contexto, filtro e token como argumentos.
const search = (context, filter, token) =>
	node.methods.listSearch.searchPactoRecords.call(context, filter, token);

describe('Resource Locator recordId', () => {
	it('[C19] recordId tem modos list (padrão, pesquisável) e id, só nas operações com lista, só na v2', async () => {
		const recordId = property('recordId');
		assert.equal(recordId.type, 'resourceLocator');
		assert.deepEqual(recordId.default, { mode: 'list', value: '' });
		const [list, id] = recordId.modes;
		assert.equal(list.name, 'list');
		assert.equal(list.typeOptions.searchable, true);
		assert.equal(list.typeOptions.searchListMethod, 'searchPactoRecords');
		assert.equal(id.name, 'id');
		// Aparece só na versão 2 e só nas operações que têm lista.
		assert.deepEqual(recordId.displayOptions.show['@version'], [{ _cnd: { gte: 2 } }]);
		assert.deepEqual(recordId.displayOptions.show.operation, PACTO_LOOKUP_OPERATION_KEYS);
		assert.ok(PACTO_LOOKUP_OPERATION_KEYS.includes('GET:/psec/alunos/{id}'));
		// O resourceMapper tira o campo de caminho só na versão 2 e só nessas operações.
		const fieldIds = async (typeVersion, parameters) => {
			const context = makeContext({ typeVersion, parameters });
			const { fields } = await node.methods.resourceMapping.getPactoFields.call(context);
			return fields.map((field) => field.id);
		};
		const withList = { resource: 'Clientes', operation: 'GET:/psec/alunos/{id}' };
		assert.ok((await fieldIds(1, withList)).includes('path__id'));
		assert.ok(!(await fieldIds(2, withList)).includes('path__id'));
		// Com dois IDs de caminho, o seletor cobre só o primeiro; o segundo continua no mapeador.
		const twoIds = {
			resource: 'Cliente Mensagem',
			operation: 'GET:/psec/alunos/{id}/{tipoMensagem}/mensagem-matricula',
		};
		const pathFields = (await fieldIds(2, twoIds)).filter((field) => field.startsWith('path__'));
		assert.deepEqual(pathFields, ['path__tipoMensagem']);
	});

	it('[C20] usa o ID escolhido na lista como ID de caminho', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: alunoParams({ mode: 'list', value: '42' }),
			responder: () => ({ id: 42 }),
		});
		await node.execute.call(context);
		assert.equal(context.requests[0].options.method, 'GET');
		assert.equal(context.requests[0].options.url, '/psec/alunos/42');
	});

	it('[C21] usa o ID colado e remove os espaços das pontas', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: alunoParams({ mode: 'id', value: ' 42 ' }),
			responder: () => ({ id: 42 }),
		});
		await node.execute.call(context);
		assert.equal(context.requests[0].options.url, '/psec/alunos/42');
	});

	it('[C22] recusa recordId vazio com a mensagem em português', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: alunoParams({ mode: 'list', value: '' }),
			responder: () => ({}),
		});
		await assert.rejects(node.execute.call(context), (error) => {
			assert.ok(error instanceof NodeOperationError);
			assert.match(error.message, /Escolha um registro na lista ou cole o ID/);
			assert.equal(error.context.itemIndex, 0);
			return true;
		});
		assert.equal(context.requests.length, 0);
	});
});

describe('searchPactoRecords', () => {
	it('[C23] busca alunos com o texto em filters e devolve nome e valor', async () => {
		assert.ok(node.methods.listSearch, 'o node deveria ter o método listSearch');
		const context = editorContext(() => ({
			content: [
				{ id: 42, nome: 'Ana Silva' },
				{ id: 43 },
			],
			last: true,
		}));
		const result = await search(context, 'ana');
		const { options } = context.requests[0];
		assert.equal(options.method, 'GET');
		assert.equal(options.url, '/psec/alunos');
		assert.deepEqual(options.qs, { page: 0, size: 20, filters: '{"quicksearchValue":"ana"}' });
		assert.equal(options.timeout, 30000);
		assert.deepEqual(result.results, [
			{ name: 'Ana Silva', value: '42' },
			{ name: '43', value: '43' },
		]);
	});

	it('[C24] escolhe onde vai a busca: query, filters ou o próprio node', async () => {
		// Rota com parâmetro quicksearchValue na query (hoje existe uma no catálogo gerado).
		const { PACTO_LOOKUPS } = require('../dist/nodes/Pacto/helpers/lookups.generated');
		const inQuery = Object.entries(PACTO_LOOKUPS).find(([, item]) => item.search?.kind === 'query');
		assert.ok(inQuery, 'o catálogo deveria ter uma lista com busca na query');
		const [queryKey] = inQuery;
		const queryArea = queryKey.split(':')[0];
		const produtos = makeContext({
			typeVersion: 2,
			parameters: { resource: queryArea, operation: queryKey.slice(queryArea.length + 1) },
			responder: () => ({ content: [], last: true }),
		});
		await search(produtos, 'cami');
		assert.deepEqual(produtos.requests[0].options.qs, {
			page: 0,
			size: 20,
			quicksearchValue: 'cami',
		});
		// Rota sem busca na API: o node filtra a página, sem diferenciar maiúscula nem acento.
		const noSearch = Object.entries(PACTO_LOOKUPS).find(([, lookup]) => lookup.search === null);
		assert.ok(noSearch, 'o catálogo deveria ter ao menos uma lista sem busca na API');
		const [key, lookup] = noSearch;
		const [area, ...rest] = key.split(':');
		const local = makeContext({
			typeVersion: 2,
			parameters: { resource: area, operation: rest.join(':') },
			responder: () => ({
				content: [
					{ [lookup.valueField]: 1, [lookup.labelField]: 'Armário Grande' },
					{ [lookup.valueField]: 2, [lookup.labelField]: 'Mesa' },
				],
				last: true,
			}),
		});
		const result = await search(local, 'ARMARIO');
		assert.deepEqual(local.requests[0].options.qs, { page: 0, size: 20 });
		assert.deepEqual(result.results, [{ name: 'Armário Grande', value: '1' }]);
	});

	it('[C25] decide se há próxima página pelo fim da lista', async () => {
		const items = (count) => Array.from({ length: count }, (_, i) => ({ id: i, nome: `A${i}` }));
		const run = async (body) => (await search(editorContext(() => body))).paginationToken;
		// 20 itens e sem sinal de fim: a próxima página é a 1.
		assert.equal(await run({ content: items(20), last: false }), '1');
		// Menos itens que o tamanho da página: acabou.
		assert.equal(await run({ content: items(12) }), undefined);
		// Envelope diz que é a última página.
		assert.equal(await run({ content: items(20), last: true }), undefined);
		// Total de páginas já alcançado.
		assert.equal(await run({ content: items(20), totalPages: 1 }), undefined);
	});

	it('[C26] segue o número de página que a resposta devolve', async () => {
		const items = Array.from({ length: 20 }, (_, i) => ({ id: i, nome: `A${i}` }));
		// A API começa em 1: pedimos 0, ela respondeu página 1; a próxima é a 2.
		const result = await search(editorContext(() => ({ content: items, number: 1, last: false })));
		assert.equal(result.paginationToken, '2');
		const viaPage = await search(editorContext(() => ({ content: items, page: 4 })), '', '3');
		assert.equal(viaPage.paginationToken, '5');
	});

	it('[C27] lança NodeApiError quando a listagem devolve 401', async () => {
		const context = editorContext(() => {
			throw Object.assign(new Error('Unauthorized'), { httpCode: '401' });
		});
		await assert.rejects(search(context, 'ana'), (error) => {
			assert.ok(error instanceof NodeApiError);
			assert.equal(error.httpCode, '401');
			return true;
		});
	});

	it('[C28] returnAll na versão 2 pagina como na versão 1', async () => {
		const sizes = [100, 100, 30];
		const context = makeContext({
			typeVersion: 2,
			parameters: {
				resource: 'Clientes',
				operation: 'GET:/psec/alunos',
				fields: { mappingMode: 'defineBelow', value: {} },
				returnAll: true,
			},
			responder: (options) => ({
				content: Array.from({ length: sizes[options.qs.page] ?? 0 }, (_, i) => ({ id: i })),
			}),
		});
		const [output] = await node.execute.call(context);
		assert.deepEqual(
			context.requests.map(({ options }) => [options.qs.page, options.qs.size]),
			[
				[0, 100],
				[1, 100],
				[2, 100],
			],
		);
		assert.equal(output.length, 230);
	});
});
