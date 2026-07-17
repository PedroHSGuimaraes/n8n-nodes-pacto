import type {
	ILoadOptionsFunctions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';

import { getPactoOperation } from '../helpers/catalog.generated';

const CREDENTIAL_FIELDS = new Set(['authorization', 'empresaid']);

export const resourceMapping = {
	async getPactoFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const area = this.getCurrentNodeParameter('resource') as string;
		const operationKey = this.getCurrentNodeParameter('operation') as string;
		const operation = getPactoOperation(area, operationKey);
		if (!operation) return { fields: [] };

		const fields: ResourceMapperField[] = operation.inputFields
			.filter(
				(field) =>
					field.location !== 'header' || !CREDENTIAL_FIELDS.has(field.path[0].toLowerCase()),
			)
			.map((field) => ({
				id: field.id,
				displayName: field.displayName,
				defaultMatch: false,
				canBeUsedToMatch: false,
				required: field.required,
				display: true,
				type: field.type,
				options: field.options,
				defaultValue: field.defaultValue,
			}));

		return {
			fields,
			emptyFieldsNotice:
				'Esta operação não precisa de campos adicionais. Empresa ID e autenticação vêm da credencial Pacto API.',
		};
	},
};
