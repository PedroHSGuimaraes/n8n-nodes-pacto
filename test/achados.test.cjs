/*
 * Testes que fecham os achados do Verifier independente (feature node-cli-campos-v2).
 *
 * Cada teste aqui protege um defeito real que os testes anteriores deixavam passar:
 * filtro perdido na Busca Rápida, erro de API que perdia o tipo, corpo da requisição sem teste,
 * rótulo vazio e token de página inválido no seletor, e credencial sem timeout.
 */
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { NodeApiError, NodeOperationError } = require('n8n-workflow');

const { PactoApi } = require('../dist/credentials/PactoApi.credentials');
const { Pacto } = require('../dist/nodes/Pacto/Pacto.node');
const { makeContext } = require('./helpers.cjs');

const node = new Pacto();

// Roda a busca de alunos na versão 2 com o `query__filters` e a Busca Rápida dados.
async function runAlunos(filters, quickSearch) {
	const context = makeContext({
		typeVersion: 2,
		parameters: {
			resource: 'Clientes',
			operation: 'GET:/psec/alunos',
			fields: { mappingMode: 'defineBelow', value: { query__filters: filters } },
			returnAll: false,
			quickSearch,
		},
		responder: () => ({ content: [] }),
	});
	await node.execute.call(context);
	return context.requests[0].options.qs.filters;
}

describe('achados do Verifier', () => {
	it('[C31b] mantém o filtro que chega como objeto (expressão) e ignora Busca Rápida só de espaços', async () => {
		// Expressão do n8n entrega um objeto, não texto: o filtro do usuário não pode sumir.
		assert.equal(
			await runAlunos({ situacoesEnuns: ['AT'] }, 'silva'),
			'{"situacoesEnuns":["AT"],"quicksearchValue":"silva"}',
		);
		// Só espaços não é busca: o filters sai exatamente como veio.
		assert.equal(await runAlunos('{"a":1}', '   '), '{"a":1}');
	});

	it('[C38] erro 401 da API chega do execute como NodeApiError', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: {
				resource: 'Clientes',
				operation: 'GET:/psec/alunos',
				fields: { mappingMode: 'defineBelow', value: {} },
				returnAll: false,
			},
			responder: () => {
				throw Object.assign(new Error('Unauthorized'), { httpCode: '401' });
			},
		});
		await assert.rejects(node.execute.call(context), (error) => {
			assert.ok(error instanceof NodeApiError, `veio ${error.constructor.name}`);
			assert.equal(error.httpCode, '401');
			return true;
		});
	});

	it('[C39] operação com corpo JSON envia o corpo montado e o Content-Type', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: {
				resource: 'Acompanhar',
				operation: 'POST:/psec/acompanhar/motivos-pausa',
				fields: {
					mappingMode: 'defineBelow',
					value: { body__descricao: 'Viagem', body__ativo: true, body__codigo: 0 },
				},
				returnAll: false,
			},
			responder: () => ({ content: {} }),
		});
		await node.execute.call(context);
		const { options } = context.requests[0];
		assert.equal(options.method, 'POST');
		assert.equal(options.url, '/psec/acompanhar/motivos-pausa');
		assert.deepEqual(options.body, { descricao: 'Viagem', ativo: true, codigo: 0 });
		assert.equal(options.headers['Content-Type'], 'application/json');
		assert.equal(options.timeout, 30000);
	});

	it('[C40] o seletor mostra o ID quando o rótulo vem vazio e ignora token de página inválido', async () => {
		const context = makeContext({
			typeVersion: 2,
			parameters: { resource: 'Clientes', operation: 'GET:/psec/alunos/{id}' },
			responder: () => ({ content: [{ id: 0, nome: '' }], last: true }),
		});
		const result = await node.methods.listSearch.searchPactoRecords.call(context, '', 'abc');
		assert.deepEqual(result.results, [{ name: '0', value: '0' }]);
		// Token 'abc' não é número: a busca recomeça da página 0 em vez de pedir page=NaN.
		assert.equal(context.requests[0].options.qs.page, 0);
	});

	it('[C41] o teste da credencial tem timeout', () => {
		assert.equal(new PactoApi().test.request.timeout, 30000);
	});
});
