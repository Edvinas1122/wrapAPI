/*
	an API wrapper for fetching data from multiple APIs
	has unimplemented caching or modular fetching // coudl be implemented with a fetch wrapper

	usage:
	1. create an API instance with a list of APIInfo
	2. interact with the API instance with interact function
	3. interact function takes in an object with apiName, endpoint_name, body
	4. apiName is optional, if not provided, the first API will be used
	5. endpoint_name is required, it is the name of the endpoint
	6. body is optional, it is the body of the request
	7. interact function returns a promise with the response data
	8. the response data is the json data returned from the endpoint

	example:
	const apiConfig: APIInfo = {
		name: 'api1',
		apiBaseUrl: 'https://api1.com',
		headers: {
			'Authorization': `Bearer ${authToken}`,
		}
		endpoints: [
			{ name: 'endpoint1', path: '/endpoint1', method: 'GET' },
			{ name: 'endpoint2', path: '/endpoint2', method: 'POST' },
		],
	};
	const api = new API(apiConfig);

	also default params can be set for each endpoint
	
	example:
	apiConfig.defaultParams = {
		endpoint1: {
			params: { param1: 'value1' },
			body: { body1: 'value1' },
		}
	};


*/

interface APIFetcherConfig {
	apiBaseUrl?: string;
	authToken?: string;
	fetchAdapter?: (url: string, params: any) => Promise<any>;
	caching?: boolean;
	headers?: any;
	endpoints?: Endpoint[];
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
	}: {
		endpoint?: string,
		body?: any,
		params?: Record<string, string | number>,
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
		const response = await this.fetch(`${this.apiBaseUrl}${filledEndpoint}`, {
			method: theEndpoint.method,
			headers: this.headers,
			cache: 'no-store',
			body: theEndpoint.method !== 'GET' ? JSON.stringify(requestBody): undefined,
		});
		const data = response.json();
		return data;
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
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
	name?: string;
	apiBaseUrl: string;
	headers?: Record<string, string>; // include auth way
	endpoints: Endpoint[];
	defaultParams?: DefaultParams;
}

export default class API<EndpointEnum extends string | undefined = string> {
	private apis: Record<string, APIFetcher>;

	constructor(
		apiInfo: APIInfo
	);
	constructor(
		apiInfos: Record<string, APIInfo>
	);
	constructor(
		apiInfoOrInfos: APIInfo | Record<string, APIInfo>
	) {
		this.apis = {};
		const apiInfos = this.handleType(apiInfoOrInfos);

		Object.entries(apiInfos).forEach(([key, apiInfo]) => {
			this.apis[key] = new APIFetcher({
				apiBaseUrl: apiInfo.apiBaseUrl,
				headers: apiInfo.headers,
				endpoints: apiInfo.endpoints,
				defaultParams: apiInfo.defaultParams,
			});
		});
	}

	public async interact({
		apiName,
		endpoint_name,
		body,
		params,
	}: {
		apiName?: string,
		endpoint_name: EndpointEnum,
		body?: any,
		params?: Record<string, string | number>,
	}): Promise<any> {
		const theApiName = apiName || Object.keys(this.apis)[0];
		const api = this.apis[theApiName];
		return await api.fetchData({
			endpoint: endpoint_name,
			body,
			params,
		});
	}

	private handleType(apiInfoOrInfos: APIInfo | Record<string, APIInfo>): Record<string, APIInfo> {
		if ('apiBaseUrl' in apiInfoOrInfos) {
			return { default: apiInfoOrInfos as APIInfo };
		}
		return apiInfoOrInfos as Record<string, APIInfo>;
	}
}
