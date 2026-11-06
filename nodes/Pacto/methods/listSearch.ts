/*
 * Lista pesquisável do Resource Locator `recordId` (versão 2 do node Pacto).
 *
 * O editor do n8n chama `searchPactoRecords` toda vez que a pessoa abre a lista, digita na
 * busca ou rola até o fim. Cada chamada pede UMA página à API da Pacto e devolve os registros
 * como { name, value }; quem rola pede a página seguinte pelo `paginationToken`.
 * A rota de listagem vem da tabela gerada (`lookups.generated.ts`), nunca de um palpite.
 */
import type { IDataObject, ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { extractPageItems } from '../helpers/utils';
import { getPactoLookup, type PactoLookup } from '../helpers/lookups.generated';
import { pactoApiRequest } from '../transport';

// Itens por página da lista: curto o bastante para abrir rápido no editor.
const PAGE_SIZE = 20;

// Compara texto sem ligar para maiúscula nem acento ("armario" acha "Armário").
const normalize = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

// Monta a query da página: sempre page e size, e a busca onde a API da Pacto a aceita.
function buildQuery(lookup: PactoLookup, page: number, filter?: string): IDataObject {
	const qs: IDataObject = { page, size: PAGE_SIZE };
	if (!filter || !lookup.search) return qs;
	if (lookup.search.kind === 'query') qs[lookup.search.name] = filter;
	// Em `filters` a Pacto espera um JSON em texto, ex.: {"quicksearchValue":"ana"}.
	else qs.filters = JSON.stringify({ [lookup.search.name]: filter });
	return qs;
}

// Número da página que a API diz ter devolvido (`number` no envelope Spring, `page` no outro).
// Usar o número da resposta evita errar se a API contar a partir de 1 e não de 0.
function answeredPage(body: IDataObject, requestedPage: number): number {
	for (const candidate of [body.number, body.page]) {
		if (typeof candidate === 'number' && Number.isInteger(candidate)) return candidate;
	}
	return requestedPage;
}

// Diz se existe uma página depois desta, pelos sinais que a API devolve.
function hasNextPage(body: IDataObject, itemCount: number, currentPage: number): boolean {
	if (body.last === true) return false;
	if (itemCount < PAGE_SIZE) return false;
	if (typeof body.totalPages === 'number' && currentPage + 1 >= body.totalPages) return false;
	return true;
}

export const listSearch = {
	async searchPactoRecords(
		this: ILoadOptionsFunctions,
		filter?: string,
		paginationToken?: string,
	): Promise<INodeListSearchResult> {
		// No editor o valor ainda não foi salvo, por isso lê com getCurrentNodeParameter.
		const area = this.getCurrentNodeParameter('resource') as string;
		const operationKey = this.getCurrentNodeParameter('operation') as string;
		const lookup = getPactoLookup(area, operationKey);
		// Operação sem lista: o seletor mostra "sem resultados" e a pessoa cola o ID.
		if (!lookup) return { results: [] };

		// Token que não é número inteiro (lixo do editor) recomeça na página 0, em vez de page=NaN.
		const requested = Number(paginationToken);
		const page = Number.isInteger(requested) && requested >= 0 ? requested : 0;
		const response = await pactoApiRequest.call(this, 'GET', lookup.listPath, {
			qs: buildQuery(lookup, page, filter),
			json: true,
			// Sem limite, uma API lenta deixaria o seletor do editor carregando para sempre.
			timeout: 30000,
		});

		const body = (response ?? {}) as IDataObject;
		const items = extractPageItems(body, '') as IDataObject[];

		let results = items
			// Item sem o campo de valor não dá para escolher; é ignorado.
			.filter((item) => item[lookup.valueField] !== undefined && item[lookup.valueField] !== null)
			.map((item) => {
				const value = String(item[lookup.valueField]);
				const label = item[lookup.labelField];
				// Sem rótulo (ou rótulo vazio), o próprio ID aparece como nome.
				const name = label === undefined || label === null ? '' : String(label);
				return { name: name === '' ? value : name, value };
			});

		// Rota sem busca na API: filtra só a página que veio (a rota não oferece outra forma).
		if (filter && !lookup.search) {
			const wanted = normalize(filter);
			results = results.filter((entry) => normalize(entry.name).includes(wanted));
		}

		const currentPage = answeredPage(body, page);
		return hasNextPage(body, items.length, currentPage)
			? { results, paginationToken: String(currentPage + 1) }
			: { results };
	},
};
