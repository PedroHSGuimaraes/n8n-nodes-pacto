/*
 * Testes da versão 1 do node Pacto (slice S2 do plano node-cli-campos-v2).
 *
 * A versão 1 é a que os workflows salvos no 1.0.3 usam. Estes testes garantem
 * que ela envia a mesma requisição de antes e mantém os mesmos parâmetros.
 */
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Pacto } = require('../dist/nodes/Pacto/Pacto.node');
const { makeContext } = require('./helpers.cjs');

// Parâmetros comuns de uma chamada ao `execute`.
function params(extra) {
	return { returnAll: false, ...extra };
}

describe('versão 1 do node Pacto', () => {
	it('[C9] busca um aluno pelo ID de caminho com credencial e timeout', async () => {
		const context = makeContext({
			typeVersion: 1,
			parameters: params({
				resource: 'Clientes',
				operation: 'GET:/psec/alunos/{id}',
				fields: { mappingMode: 'defineBelow', value: { path__id: '42' } },
			}),
			responder: () => ({ id: 42 }),
		});
		await new Pacto().execute.call(context);
		assert.equal(context.requests.length, 1);
		const { credentialType, options } = context.requests[0];
		assert.equal(credentialType, 'pactoApi');
		assert.equal(options.method, 'GET');
		assert.equal(options.baseURL, 'https://apigw.pactosolucoes.com.br');
		assert.equal(options.url, '/psec/alunos/42');
		assert.equal(options.timeout, 30000);
	});

	it('[C10] returnAll pede page 0, 1 e 2 com size 100 e junta 230 itens', async () => {
		const sizes = [100, 100, 30];
		const context = makeContext({
			typeVersion: 1,
			parameters: params({
				resource: 'Clientes',
				operation: 'GET:/psec/alunos',
				fields: { mappingMode: 'defineBelow', value: {} },
				returnAll: true,
			}),
			// Cada página devolve o número de itens combinado, dentro de `content`.
			responder: (options) => ({
				content: Array.from({ length: sizes[options.qs.page] ?? 0 }, (_, i) => ({ id: i })),
			}),
		});
		const [output] = await new Pacto().execute.call(context);
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

	it('[C11] mantém name e type dos parâmetros do 1.0.3 para a versão 1', () => {
		const { properties } = new Pacto().description;
		// Parâmetro da versão 1 = o que não é exclusivo da versão 2 (@version com _cnd).
		const v1 = properties.filter((property) => {
			const versions = property.displayOptions?.show?.['@version'];
			return !versions || versions.some((version) => version === 1);
		});
		assert.deepEqual(
			v1.map((property) => [property.name, property.type]),
			[
				['resource', 'options'],
				['operation', 'options'],
				['fields', 'resourceMapper'],
				['returnAll', 'boolean'],
			],
		);
	});

	it('[C36] envia no cabeçalho um parâmetro de header que não é da credencial', async () => {
		const context = makeContext({
			typeVersion: 1,
			parameters: params({
				resource: 'Programa de Treino',
				operation: 'GET:/psec/programas/pre-definido',
				fields: { mappingMode: 'defineBelow', value: { 'header__user-agent': 'n8n-teste' } },
			}),
			responder: () => ({ content: [] }),
		});
		await new Pacto().execute.call(context);
		assert.equal(context.requests[0].options.headers['user-agent'], 'n8n-teste');
	});
});
