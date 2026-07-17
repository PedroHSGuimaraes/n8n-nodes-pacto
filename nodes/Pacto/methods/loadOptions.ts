import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { PACTO_OPERATIONS } from '../helpers/catalog.generated';

function operationDescription(operation: (typeof PACTO_OPERATIONS)[number]): string {
	const details: string[] = [];
	if (operation.description) details.push(operation.description);
	if (operation.scope) details.push(`Required scope: ${operation.scope}`);

	const required = operation.parameters
		.filter((parameter) => parameter.required)
		.map((parameter) => `${parameter.in}:${parameter.name}`);
	if (required.length) details.push(`Required parameters: ${required.join(', ')}`);
	if (operation.requestBodyRequired) details.push('Request body required');

	return details.join(' — ').slice(0, 1000);
}

export const loadOptions = {
	async getPactoOperations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const area = this.getNodeParameter('resource') as string;
		return PACTO_OPERATIONS.filter((operation) => operation.area === area).map((operation) => ({
			name: `${operation.name} [${operation.method} ${operation.path}]`,
			value: operation.key,
			description: operationDescription(operation),
		}));
	},
};
