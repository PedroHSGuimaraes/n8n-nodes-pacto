/*
 * Regras dos campos novos da versão 2 do node Pacto: o ID escolhido no Resource Locator
 * (`recordId`) e a Busca Rápida (`quickSearch`).
 *
 * Ficam aqui, fora do `Pacto.node.ts`, porque cada uma é uma regra pequena e testável sozinha:
 * ler o ID de um jeito só (lista ou colado) e juntar a busca ao JSON de `filters`.
 */
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { PactoLookup } from './lookups.generated';

// Valor que o Resource Locator guarda: o modo escolhido e o texto (ID da lista ou colado).
interface RecordLocator {
	mode?: string;
	value?: unknown;
}

// Lê o ID do `recordId` e devolve sempre texto sem espaços nas pontas.
// Valor vazio vira erro com a orientação para a pessoa, em vez de uma rota quebrada (/psec/alunos/).
export function readRecordId(context: IExecuteFunctions, itemIndex: number): string {
	const locator = context.getNodeParameter('recordId', itemIndex, '') as RecordLocator | string;
	// Expressão ou valor antigo pode chegar como texto puro; o objeto é o formato do locator.
	const raw = typeof locator === 'object' && locator !== null ? locator.value : locator;
	const value = raw === undefined || raw === null ? '' : String(raw).trim();
	if (value === '') {
		throw new NodeOperationError(context.getNode(), 'Escolha um registro na lista ou cole o ID', {
			itemIndex,
		});
	}
	return value;
}

// Põe o ID escolhido no lugar do campo de caminho que o mapeador deixou de mostrar na versão 2.
export function withRecordId(
	context: IExecuteFunctions,
	itemIndex: number,
	lookup: PactoLookup,
	values: IDataObject,
): IDataObject {
	return { ...values, [`path__${lookup.pathParam}`]: readRecordId(context, itemIndex) };
}

// Junta a Busca Rápida ao JSON do parâmetro `filters`.
// - busca vazia (ou só espaços): devolve `filters` exatamente como a pessoa escreveu;
// - busca preenchida: lê o filtro existente (texto JSON ou objeto de expressão) e acrescenta
//   `quicksearchValue`.
export function mergeQuickSearch(
	context: IExecuteFunctions,
	itemIndex: number,
	filters: unknown,
	quickSearch: string,
): unknown {
	// Texto só de espaços não é busca: sem isso o JSON ganharia um quicksearchValue em branco.
	// Uma expressão pode entregar número ou null no lugar do texto; `String(... ?? '')` evita o
	// erro "trim is not a function" e trata null como busca vazia.
	const text = String(quickSearch ?? '').trim();
	if (text === '') return filters;

	let current: IDataObject = {};
	if (typeof filters === 'object' && filters !== null && !Array.isArray(filters)) {
		// Uma expressão do n8n entrega o filtro já como objeto; ele precisa ser mantido.
		current = filters as IDataObject;
	} else if (typeof filters === 'string' && filters.trim() !== '') {
		let parsed: unknown;
		try {
			parsed = JSON.parse(filters);
		} catch {
			parsed = undefined;
		}
		// Só objeto serve: lista, número ou texto não têm onde receber o `quicksearchValue`.
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new NodeOperationError(context.getNode(), 'O campo Filters precisa ser um objeto JSON', {
				itemIndex,
			});
		}
		current = parsed as IDataObject;
	} else if (filters !== undefined && filters !== null && filters !== '') {
		// Lista ou número vindos de expressão também não servem.
		throw new NodeOperationError(context.getNode(), 'O campo Filters precisa ser um objeto JSON', {
			itemIndex,
		});
	}
	return JSON.stringify({ ...current, quicksearchValue: text });
}
