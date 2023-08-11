# wrapAPI

npm page: https://www.npmjs.com/package/@edvinas1122/api_wrapper

`api_wrapper` is a simple wrapper that lets explicitly define API endpoints in a configuration file.

It is an API layer abstraction.
An Updated 3rd alpha version autogenerates methods from endpoints.

If you interested in api wrapping, generating automated tests, documentation, check swagger api [here](https://swagger.io/). This project meant to be learning.

## Installation

To add module run in node project root dir

```bash
npm i @edvinas1122/api_wrapper
```

## Initialising

To initialize wrapper follow this configuration pattern. Recommended api.conf.ts

```tsx
export enum NotionEndpoints {
    getPage = 'getPage',
    getBlockChildren = 'getBlockChildren',
    getBlock = 'getBlock',
    getDatabase = 'getDatabase',
    queryDatabase = 'queryDatabase',
    getPagePropertyItem = 'getPagePropertyItem',
    search = 'search',
}

const notionAPIConfig: APIInfo = {
    name: 'NotionAPI',
    apiBaseUrl: 'https://api.notion.com/v1/',
    headers: {
        'Notion-Version': '2022-06-28',
        'Authorization': `Bearer ${process.env.ACCESS_API_KEY}`, // Assuming authToken is available in the scope.
    },
    endpoints: [
        { name: NotionEndpoints.getPage, path: 'pages/:pageId', method: 'GET' },
        { name: NotionEndpoints.getBlockChildren, path: 'blocks/:blockId/children', method: 'GET' },
        { name: NotionEndpoints.getBlock, path: 'blocks/:blockId', method: 'GET' },
        { name: NotionEndpoints.getDatabase, path: 'databases/:databaseId', method: 'GET' },
        { name: NotionEndpoints.queryDatabase, path: 'databases/:databaseId/query', method: 'POST' },
        { name: NotionEndpoints.getPagePropertyItem, path: 'pages/:pageId/properties/:propertyId', method: 'GET' },
        { name: NotionEndpoints.search, path: 'search', method: 'POST' },
    ],
};
```

then allocate your api object like this

```tsx
const notionAPI = new API(notionAPIConfig); // or API<NotionEndpoints>(notionAPIConfig)
```

or recommended

```tsx
export default class NotionAPI extends API<NotionEndpoints> {
    constructor() {
        super(notionAPIConfig);
    }
}
```

## Use

To use the new api wrapper 

```tsx
notionAPI.getPage({
			params: { pageId: "here goes notion page" },
		});
```

An old way of alpha 2 interaction

```tsx
notionAPI.interact({endpoint_name: NotionEndpoints.getPage, params:{pageId: "notion_page_id_here"}});
```

Adjust interaction with a custom service wrapper

```tsx
import NotionAPI from "./api";

export default class NotionService {
	constructor(
		private api: NotionAPI,
	) {}

	async getPage(pageId?: string) {
		return this.api.getPage({
			params: pageId ? { pageId: pageId } : undefined,
		});
	}

	async getDatabase(databaseId?: string) {
		return this.api.getDatabase({
			params: databaseId ? { databaseId: databaseId } : undefined,
		});
	}
```

## Features

### Default Parameters

If params or body are not provided in method parameter then the default configuration would be addressed.

Initialize default parameters like this

```tsx
const rootPageDir = process.env.NEXT_PUBLIC_NOTION_ROOT_PAGE;

notionAPIConfig.defaultParams = {
    getPage: {
        params: { pageId: rootPageDir },
    },
    getBlockChildren: {
        params: { blockId: rootPageDir },
        body: { count: 200 },
    },
    getBlock: {
        params: { blockId: rootPageDir },
    },
    search: {
        body: {
            query: '',
            sort: {
                direction: 'ascending',
                timestamp: 'last_edited_time',
            },
            filter: {
                value: 'page',
                property: 'object',
            },
        },
    },
};
```

The default parameters are overridden by provided method parameters, but only for a single scope, so:

```tsx
notionAPI.interact({
	endpoint_name: NotionEndpoints.search,
	body:{
		sort: {
			direction: 'decending'
		}
	}
});
```

Would result into final the headers like this:

```tsx
sort: {
	direction: 'decending'
},
```

### Multiple APIs per one wrapper (Deprecated since alpha 2)

Possibility to set an array of API definitions and interact through a same wrapper.

```tsx
const Configs = [notionConfig, openAIConfig];

const APIset = new API(Configs);

APIset.interact({apiName: 'NotionAPI', NotionEndpoints.getPage});
```