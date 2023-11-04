/*
	API wrapper for automatic method generation.

	A naive simple use for wrapping api endpoints
	swagger is a better solution for more complex apis
	but this is a research project.

*/

interface APIFetcherConfig {
	apiBaseUrl?: string;
	authToken?: string;
	fetchAdapter?: (url: string, params: any) => Promise<any>;
	caching?: boolean;
	headers?: any;
	endpoints: Endpoint[];
	defaultParams?: DefaultParams;
}

class APIFetcher {
	private	apiBaseUrl: string;
	private	fetch: (url: string, params: any) => Promise<any>;
	private	caching: boolean;
	private	headers: any;
	private	endpoints: Record<string, Endpoint>;
	private defaultParams: DefaultParams;

	constructor({
		apiBaseUrl = '',
		authToken = '',
		fetchAdapter,
		caching = false,
		headers = {},
		endpoints = [],
		defaultParams = {}
	}: APIFetcherConfig) {
		this.apiBaseUrl = apiBaseUrl;
		this.fetch = fetchAdapter || this.fetchDefault;
		this.caching = caching;
		this.headers = headers;
		this.endpoints = endpoints.reduce(
			(map: Record<string, Endpoint>, endpoint: Endpoint) => {
				map[endpoint.name] = endpoint;
				return map;
			}, {});
		this.defaultParams = defaultParams;
	}

	private async fetchDefault(url: string, params: any): Promise<any> {
		const response = fetch(url, params);
		return response;
	}

	public async fetchData({
		endpoint = '',
		body,
		params,
		other,
	}: {
		endpoint?: string,
		body?: any,
		params?: Record<string, string | number>,
		other?: any,
	} = {}): Promise<any>
	{
		const defaultParams = this.defaultParams[endpoint] || {};
		const endpointParams = params || defaultParams.params;
		const theEndpoint = this.endpoints[endpoint];
		if (!theEndpoint) {
			return {error: 'endpoint not found', endpoint: endpoint};
		}
		const filledEndpoint = this.fillEndpointParams(theEndpoint.path, endpointParams);
		const requestBody = this.setRequestBody(theEndpoint.name, body);
		let fetchParams = {
			method: theEndpoint.method,
			headers: this.headers,
			...other,
		};
		// console.log(requestBody);
		if (theEndpoint.method !== 'GET' && requestBody) {
			fetchParams = {
				...fetchParams,
				body: JSON.stringify(requestBody),
			};
		}
		const response = await this.fetch(`${this.apiBaseUrl}${filledEndpoint}`, fetchParams);
		// console.log(response);
		if (!response.ok) {
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				if (retryAfter) {
					const retryAfterSeconds = parseInt(retryAfter, 10);
					await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1001));
					return this.fetchData({ endpoint, body, params, other });
				}
			}
			throw new Error(`APIFetcher: ${response.status} ${response?.statusText}`);
		}
		return response.json();
	}

	private fillEndpointParams(endpoint: string, params: Record<string, string | number> = {}): string {
		let filledEndpoint = endpoint;
	  
		for (const [key, value] of Object.entries(params)) {
			filledEndpoint = filledEndpoint.replace(`:${key}`, value.toString());
		}
	  
		return filledEndpoint;
	}

	private setRequestBody(endpoint: string, providedBody: any): any { // shallow merge
		if (!providedBody && !this.defaultParams[endpoint]?.body) {
			return undefined;
		}
		const defaultBody = this.defaultParams[endpoint]?.body || {};
		return { ...defaultBody, ...providedBody };
	}
}

interface Endpoint {
	name: string;
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	body?: any;
	params?: Record<string, string | number>; // path parameters
}

export interface DefaultParams {
	[endpoint: string]: {
		params?: Record<string, string | number>;
		body?: any;
	};
}

export interface APIInfo {
	apiBaseUrl: string;
	headers?: Record<string, string>; // include auth way
	endpoints: Endpoint[];
	defaultParams?: DefaultParams;
	fetchAdapter?: (url: string, params: any) => Promise<any>;
}

type EndpointMethod = {
	(options: { body?: any; params?: Record<string, string | number> }): Promise<any>;
  };

export default class API<EndpointEnum extends string | undefined = string> {
	private api: APIFetcher;
	[key: string]: EndpointMethod | any; // Index signature

	constructor(apiInfo: APIInfo) {
		this.api = new APIFetcher({
			apiBaseUrl: apiInfo.apiBaseUrl,
			headers: apiInfo.headers,
			endpoints: apiInfo.endpoints,
			defaultParams: apiInfo.defaultParams,
			fetchAdapter: apiInfo.fetchAdapter,
		});

		// Automatically assign methods based on the endpoint names
		apiInfo.endpoints.forEach((endpoint) => {
			this[endpoint.name as string] = this.createEndpointMethod(endpoint.name as EndpointEnum);
		});
	}

	private createEndpointMethod(endpointName: EndpointEnum) {
		return async ({
			body,
			params,
			other,
		}: {
			body?: any,
			params?: Record<string, string | number>,
			other?: any,
		}): Promise<any> => {
			return await this.api.fetchData({
				endpoint: endpointName,
				body,
				params,
				other,
			});
		};
	}
}
