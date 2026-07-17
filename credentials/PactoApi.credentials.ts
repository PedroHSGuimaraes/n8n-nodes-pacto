import type {
	IAuthenticate,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

export class PactoApi implements ICredentialType {
	name = 'pactoApi';

	displayName = 'Pacto API';

	icon = { light: 'file:pacto.svg', dark: 'file:pacto.dark.svg' } as const;

	documentationUrl = 'https://api-docs.pactosolucoes.com.br/';

	properties: INodeProperties[] = [
		{
			displayName: 'Empresa ID',
			name: 'empresaId',
			type: 'number',
			default: 0,
			required: true,
			description:
				'ID da empresa/unidade no Sistema Pacto. Enviado automaticamente no header empresaId em todas as requisições.',
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Secret_Key generated in Pacto under Settings → Integrations → ADM → API Sistema Pacto. The key is sent as a Bearer token.',
		},
	];

	authenticate: IAuthenticate = async (
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> => {
		requestOptions.headers ??= {};
		const isCredentialValidator = requestOptions.url.includes('/psec/credential-validator');
		requestOptions.headers.Authorization = isCredentialValidator
			? String(credentials.secretKey)
			: `Bearer ${String(credentials.secretKey)}`;
		requestOptions.headers.empresaId = String(credentials.empresaId);
		return requestOptions;
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://apigw.pactosolucoes.com.br',
			url: '/psec/credential-validator',
		},
	};
}
