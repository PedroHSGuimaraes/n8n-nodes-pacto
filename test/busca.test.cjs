/*
 * Testes da Busca Rápida da versão 2 (slice S4 do plano node-cli-campos-v2).
 *
 * Em vez de escrever JSON no campo `filters`, a pessoa digita o texto em "Busca Rápida" e o
 * node o coloca no JSON como `quicksearchValue`, sem perder o que já estava em `filters`.
 */
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { NodeOperationError } = require('n8n-workflow');

const { Pacto } = require('../dist/nodes/Pacto/Pacto.node');
const { PACTO_OPERATIONS } = require('../dist/nodes/Pacto/helpers/catalog.generated');
const {
	PACTO_QUICK_SEARCH_OPERATION_KEYS,
} = require('../dist/nodes/Pacto/helpers/lookups.generated');
const { makeContext } = require('./helpers.cjs');

const node = new Pacto();

// Roda o `execute` em GET /psec/alunos (rota cujo `filters` aceita quicksearchValue).
async function runSearch({ typeVersion = 2, quickSearch, filters }) {
	const value = filters === undefined ? {} : { query__filters: filters };
	const context = makeContext({
		typeVersion,
		parameters: {
			resource: 'Clientes',
			operation: 'GET:/psec/alunos',
			fields: { mappingMode: 'defineBelow', value },
			returnAll: false,
			quickSearch,
		},
		responder: () => ({ content: [] }),
	});
	await node.execute.call(context);
	return context.requests[0].options.qs;
}

describe('Busca Rápida', () => {
	it('[C29] aparece na versão 2 só nas operações cujo filters cita quicksearchValue', () => {
		const quick = node.description.properties.find((property) => property.name === 'quickSearch');
		assert.equal(quick.displayName, 'Busca Rápida');
		assert.deepEqual(quick.displayOptions.show['@version'], [{ _cnd: { gte: 2 } }]);
		assert.deepEqual(quick.displayOptions.show.operation, PACTO_QUICK_SEARCH_OPERATION_KEYS);
		// A lista tem de ser exatamente as operações vivas com esse filtro no catálogo.
		const fromCatalog = [
			...new Set(
				PACTO_OPERATIONS.filter(
					(operation) =>
						!operation.legacy &&
						operation.inputFields.some(
							(field) =>
								field.id === 'query__filters' && /quicksearchValue/.test(field.description ?? ''),
						),
				).map((operation) => operation.key),
			),
		].sort();
		assert.deepEqual(PACTO_QUICK_SEARCH_OPERATION_KEYS, fromCatalog);
		assert.ok(PACTO_QUICK_SEARCH_OPERATION_KEYS.includes('GET:/psec/alunos'));
	});

	it('[C30] com filters vazio envia só o quicksearchValue', async () => {
		const qs = await runSearch({ quickSearch: 'silva' });
		assert.equal(qs.filters, '{"quicksearchValue":"silva"}');
	});

	it('[C31] junta o texto ao JSON que já estava em filters', async () => {
		const qs = await runSearch({ quickSearch: 'silva', filters: '{"situacoesEnuns":["AT"]}' });
		assert.equal(qs.filters, '{"situacoesEnuns":["AT"],"quicksearchValue":"silva"}');
	});

	it('[C32] recusa filters que não é objeto JSON quando há Busca Rápida', async () => {
		for (const filters of ['isto não é json', '[1,2]', '"texto"']) {
			await assert.rejects(runSearch({ quickSearch: 'silva', filters }), (error) => {
				assert.ok(error instanceof NodeOperationError);
				assert.match(error.message, /O campo Filters precisa ser um objeto JSON/);
				return true;
			});
		}
	});

	it('[C33] com Busca Rápida vazia envia filters exatamente como a pessoa escreveu', async () => {
		const qs = await runSearch({ quickSearch: '', filters: 'isto não é json' });
		assert.equal(qs.filters, 'isto não é json');
		// Na versão 1 o campo não existe, então nada é reescrito mesmo com texto no parâmetro.
		const v1 = await runSearch({ typeVersion: 1, quickSearch: 'silva', filters: '{"a":1}' });
		assert.equal(v1.filters, '{"a":1}');
	});
});
