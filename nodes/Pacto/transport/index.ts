import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { PACTO_API_BASE_URL } from '../helpers/catalog.generated';

export interface PactoRequestOptions {
	body?: IHttpRequestOptions['body'];
	headers?: IDataObject;
	qs?: IDataObject;
	encoding?: IHttpRequestOptions['encoding'];
	json?: boolean;
	returnFullResponse?: boolean;
	ignoreHttpStatusErrors?: boolean;
	timeout?: number;
}

// `this` pode ser o contexto do execute ou o do editor (listSearch): os dois têm `helpers` e
// `getNode`, que é tudo que esta função usa.
export async function pactoApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	endpoint: string,
	request: PactoRequestOptions = {},
): Promise<unknown> {
	const options: IHttpRequestOptions = {
		method: method as IHttpRequestMethods,
		baseURL: PACTO_API_BASE_URL,
		url: endpoint,
		headers: request.headers,
		qs: request.qs,
		body: request.body,
		encoding: request.encoding,
		json: request.json,
		returnFullResponse: request.returnFullResponse,
		ignoreHttpStatusErrors: request.ignoreHttpStatusErrors,
		timeout: request.timeout,
	};

	for (const key of Object.keys(options) as Array<keyof IHttpRequestOptions>) {
		const value = options[key];
		if (
			value === undefined ||
			(value &&
				typeof value === 'object' &&
				!Array.isArray(value) &&
				!(value instanceof Buffer) &&
				Object.keys(value).length === 0)
		) {
			delete options[key];
		}
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'pactoApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
