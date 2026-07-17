import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { PactoOperationDefinition } from './catalog.generated';

export function parseObjectParameter(
	context: { getNode(): any },
	value: unknown,
	displayName: string,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), `${displayName} must be a JSON object`);
	}

	try {
		const parsed = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('The value is not an object');
		}
		return parsed as IDataObject;
	} catch (error) {
		throw new NodeOperationError(
			context.getNode(),
			`${displayName} contains invalid JSON: ${(error as Error).message}`,
		);
	}
}

export function buildEndpointPath(
	context: { getNode(): any },
	operation: PactoOperationDefinition,
	pathParameters: IDataObject,
): string {
	return operation.path.replace(/\{([^}]+)\}/g, (_match, parameterName: string) => {
		const value = pathParameters[parameterName];
		if (value === undefined || value === null || value === '') {
			throw new NodeOperationError(
				context.getNode(),
				`Path parameter "${parameterName}" is required for ${operation.method} ${operation.path}`,
			);
		}
		return encodeURIComponent(String(value));
	});
}

export function getByPath(value: unknown, path: string): unknown {
	if (!path) return value;
	return path.split('.').reduce<unknown>((current, key) => {
		if (current === null || current === undefined || typeof current !== 'object') {
			return undefined;
		}
		return (current as Record<string, unknown>)[key];
	}, value);
}

export function extractPageItems(response: unknown, resultsProperty: string): unknown[] {
	const selected = resultsProperty ? getByPath(response, resultsProperty) : response;
	if (Array.isArray(selected)) return selected;
	if (!selected || typeof selected !== 'object') return [];

	for (const property of ['content', 'data', 'items', 'results', 'records']) {
		const candidate = (selected as Record<string, unknown>)[property];
		if (Array.isArray(candidate)) return candidate;
	}
	return [];
}

export function removeAuthorizationHeader(headers: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization'),
	) as IDataObject;
}
