import type {
	GenericValue,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
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

export async function pactoApiRequest(
	this: IExecuteFunctions,
	method: string,
	endpoint: string,
	request: PactoRequestOptions = {},
): Promise<any> {
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
