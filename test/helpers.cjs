/*
 * Contexto falso do n8n usado pelos testes do node Pacto.
 *
 * O node só fala com o n8n por `this.getNodeParameter`, `this.getNode`,
 * `this.helpers.httpRequestWithAuthentication` e poucos helpers de saída. Este
 * arquivo reproduz esses pontos e grava cada requisição HTTP que o node faria,
 * para os testes conferirem rota, query, cabeçalhos e timeout sem rede.
 */

// Monta o contexto do `execute` e do `listSearch`.
//  - typeVersion: versão do node (1 = workflow antigo, 2 = campos guiados)
//  - parameters:  valores que `getNodeParameter` devolve, por nome
//  - responder:   função (options, chamada) => resposta falsa da API
function makeContext({ typeVersion = 2, parameters = {}, responder, continueOnFail = false }) {
	const requests = [];
	const context = {
		requests,
		getNode: () => ({ name: 'Pacto', type: 'n8n-nodes-pacto.pacto', typeVersion }),
		getInputData: () => [{ json: {} }],
		continueOnFail: () => continueOnFail,
		// Devolve o parâmetro pelo nome; sem ele, usa o valor padrão como o n8n faz.
		getNodeParameter: (name, _itemIndex, defaultValue) =>
			Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : defaultValue,
		// No editor (listSearch e resourceMapper) o n8n lê o valor ainda não salvo.
		getCurrentNodeParameter: (name) => parameters[name],
		helpers: {
			httpRequestWithAuthentication: async (credentialType, options) => {
				requests.push({ credentialType, options });
				return responder(options, requests.length - 1);
			},
			returnJsonArray: (items) => items.map((json) => ({ json })),
			constructExecutionMetaData: (items, meta) =>
				items.map((item) => ({ ...item, pairedItem: meta.itemData })),
		},
	};
	return context;
}

module.exports = { makeContext };
