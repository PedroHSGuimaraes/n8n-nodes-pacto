import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { PACTO_OPERATIONS } from '../helpers/catalog.generated';

export const loadOptions = {
	async getPactoOperations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const area = this.getNodeParameter('resource') as string;
		return PACTO_OPERATIONS.filter((operation) => operation.area === area).map((operation) => ({
			name: `${operation.name} [${operation.method}]`,
			value: operation.key,
		}));
	},
};
