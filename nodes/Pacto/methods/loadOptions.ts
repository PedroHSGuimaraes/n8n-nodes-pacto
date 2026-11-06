import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { PACTO_OPERATIONS } from '../helpers/catalog.generated';

export const loadOptions = {
	async getPactoOperations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		const area = this.getNodeParameter('resource') as string;
		// Versão do node que o editor está mostrando: 1 = workflow salvo, 2 = node novo.
		const typeVersion = this.getNode().typeVersion;
		return (
			PACTO_OPERATIONS
				// Operação `legacy` é a que a documentação da Pacto removeu mas workflows salvos ainda
				// usam: a versão 1 mantém na lista (para o workflow abrir), a versão 2 esconde.
				.filter((operation) => operation.area === area && (typeVersion < 2 || !operation.legacy))
				.map((operation) => ({
					name: `${operation.name} [${operation.method}]`,
					value: operation.key,
				}))
		);
	},
};
