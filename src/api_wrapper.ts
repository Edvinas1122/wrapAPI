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
	logging?: boolean;
	retryTimes?: number;
}

class FetchHandler {
	constructor(
		private fetchMethod: () => Promise<any>,
		private retryTimes: number,
		private logging: boolean,
	){}
	
	public async fetch(): Promise<any> {
		const response = await this.fetchMethod();
		if (this.logging) {
			console.log('response', response);
		}
		if (!response.ok) {
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				if (!retryAfter) {
					throw new Error(`APIFetcher - retry parse failure: ${response.status} ${response?.statusText}`);
				}
				return this.retryRecursively(response, retryAfter, this.retryTimes);
			}
			throw new Error(`APIFetcher: ${response.status} ${response?.statusText}`);
		}
		return this.getResponseObject(response);
	}

	private async retryRecursively(response: Response, retryAfter: number, retryCount: number): Promise<any> {
		if (retryCount > 0) {
			await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
			const response = await this.fetchMethod();
			if (response.ok) {
				return this.getResponseObject(response);
			}
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				if (retryAfter) {
					const retryAfterSeconds = parseInt(retryAfter, 10);
					return this.retryRecursively(response, retryAfterSeconds, retryCount - 1);
				}
			}
		}
	}

	private async getResponseObject(response: Response): Promise<any> {
		const contentType = response.headers.get('content-type');
		if (this.logging) {
			console.log('contentType', contentType);
		}
		if (contentType && contentType.indexOf('application/json') !== -1) {
			if (this.logging) {
				console.log('json');
			}
			try {
				return await response.json();
			} catch (e: any) {
				if (this.logging) {
					console.log("BU", response.bodyUsed);
					console.error('json parse error', response);
				}
				if (response?.bodyUsed) { // not sure about this
					if (this.logging) {
						console.log('body used', response);
					}
				}
				return null;
			}
		}
		return await response.text();
	}
}

class APIFetcher {
	private	apiBaseUrl: string;
	private	fetch: (url: string, params: any) => Promise<any>;
	private	caching: boolean;
	private	headers: any;
	private	endpoints: Record<string, Endpoint>;
	private defaultParams: DefaultParams;
	private logging: boolean;
	private retryTimes: number = 5;

	constructor({
		apiBaseUrl = '',
		authToken = '',
		fetchAdapter,
		caching = false,
		headers = {},
		endpoints = [],
		defaultParams = {},
		logging = false,
		retryTimes = 5,
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
		this.logging = logging;
		this.retryTimes = retryTimes;
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
		if (theEndpoint.method !== 'GET' && requestBody) {
			fetchParams = {
				...fetchParams,
				body: JSON.stringify(requestBody),
			};
		}
		const fetcher = new FetchHandler(
			() => this.fetch(`${this.apiBaseUrl}${filledEndpoint}`, fetchParams),
			this.retryTimes,
			this.logging,
		);
		return await fetcher.fetch();
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
	logging?: boolean;
	retryCount?: number;
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
			logging: apiInfo.logging,
			retryTimes: apiInfo.retryCount,
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
