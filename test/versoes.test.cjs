/*
 * Testes de versão do node Pacto (slices S2 e S3 do plano node-cli-campos-v2).
 *
 * A versão 1 é a dos workflows salvos no 1.0.3; a versão 2 é a de node novo, com
 * campos guiados. Estes testes conferem o que muda (e o que não muda) entre as duas.
 */
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { Pacto } = require('../dist/nodes/Pacto/Pacto.node');
const { PACTO_OPERATIONS } = require('../dist/nodes/Pacto/helpers/catalog.generated');
const { makeContext } = require('./helpers.cjs');

// Chaves de operação que a lista devolve para a área, na versão pedida.
async function operationKeys(typeVersion, area) {
	const context = makeContext({ typeVersion, parameters: { resource: area } });
	const options = await new Pacto().methods.loadOptions.getPactoOperations.call(context);
	return options.map((option) => option.value);
}

describe('versões do node', () => {
	it('[C15] a lista da versão 2 omite as operações legacy e a da versão 1 as inclui', async () => {
		const legacy = PACTO_OPERATIONS.filter((operation) => operation.legacy);
		assert.ok(legacy.length > 0, 'o catálogo regenerado deveria ter operações legacy');
		// Confere uma operação legacy de cada área que as tem (a lista toda, não só um exemplo).
		const areas = [...new Set(legacy.map((operation) => operation.area))];
		for (const area of areas) {
			const legacyKeys = legacy.filter((operation) => operation.area === area).map((o) => o.key);
			const v1 = await operationKeys(1, area);
			const v2 = await operationKeys(2, area);
			for (const key of legacyKeys) {
				assert.ok(v1.includes(key), `${area} ${key} deveria aparecer na versão 1`);
				assert.ok(!v2.includes(key), `${area} ${key} não deveria aparecer na versão 2`);
			}
		}
	});

	it('[C16] declara version [1, 2] e defaultVersion 2', () => {
		const { description } = new Pacto();
		assert.deepEqual(description.version, [1, 2]);
		assert.equal(description.defaultVersion, 2);
	});
});
