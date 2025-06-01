import * as vscode from 'vscode';
import { ProbeWebClient } from '../probe';

export function registerChatTools(context: vscode.ExtensionContext, client: ProbeWebClient) {
    context.subscriptions.push(vscode.lm.registerTool('probejs-list_registries', new RegistryListing(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_by_regex', new ChatItemProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_tags_by_regex', new ChatTagProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_tagged_objects', new ChatTagItemProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-list_supported_recips', new RecipeListing(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-fetch_recipe_docs', new FetchRecipeDoc(client)));
}

function splitEncode(rl: string): [string, string] {
    let [namespace, path] = rl.split(':');
    return [encodeURIComponent(namespace), encodeURIComponent(path)];
}

interface RegexQuery {
    exclude: boolean;
    pattern: string;
}

interface Queries {
    queries: RegexQuery[];
    registry: string;
}

export class RegistryListing implements vscode.LanguageModelTool<RegexQuery> {
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<RegexQuery>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let resp0 = (await this.client.get<string[]>('/api/registries'))?.data ?? [];
        let regexFilter = new RegExp(options.input?.pattern || '.*');
        resp0 = resp0.filter(reg => regexFilter.test(reg));
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(resp0, null, 4))]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<RegexQuery>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching available registries...",
        };
    }
}

export class ChatItemProvider implements vscode.LanguageModelTool<Queries>{

    constructor(private readonly client: ProbeWebClient) { }

    async queryItems(registry: string, queries: RegexQuery[]): Promise<string[] | { error: string }> {
        if (!this.client.mcConnected()) {
            return { error: "The plugin is not connected to a running Minecraft instance. No result can be provided." };
        }

        let [namespace, path] = splitEncode(registry);
        // Get all keys from the registry
        let resp1 = await this.client.get<string[]>(`/api/registries/${namespace}/${path}/keys`);
        if (!resp1) { return []; }

        let allQueries = queries.map(q => ({
            exclude: q.exclude,
            query: new RegExp(q.pattern)
        }));

        let filteredKeys = resp1.data.filter(key => {
            for (const query of allQueries) {
                if (query.exclude && query.query.test(key)) {
                    return false;
                } else if (!query.exclude && !query.query.test(key)) {
                    return false;
                }
            }
            return true;
        });

        filteredKeys.sort((a, b) => a.localeCompare(b));
        return filteredKeys;
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<Queries>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        let { queries, registry } = options.input;
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(await this.queryItems(registry, queries)))
        ]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<Queries>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching items from the registry...",
        };
    }
}

export class ChatTagProvider implements vscode.LanguageModelTool<Queries>{
    constructor(private readonly client: ProbeWebClient) { }

    async queryItems(registry: string, queries: RegexQuery[]): Promise<string[] | { error: string }> {
        if (!this.client.mcConnected()) {
            return { error: "The plugin is not connected to a running Minecraft instance. No result can be provided." };
        }

        let [namespace, path] = splitEncode(registry);
        // Get all keys from the registry
        let resp1 = await this.client.get<string[]>(`/api/tags/${namespace}/${path}`);
        if (!resp1) { return []; }

        let allQueries = queries.map(q => ({
            exclude: q.exclude,
            query: new RegExp(q.pattern)
        }));

        let filteredKeys = resp1.data.filter(key => {
            for (const query of allQueries) {
                if (query.exclude && query.query.test(key)) {
                    return false;
                } else if (!query.exclude && !query.query.test(key)) {
                    return false;
                }
            }
            return true;
        });

        filteredKeys.sort((a, b) => a.localeCompare(b));
        return filteredKeys;
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<Queries>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        let { queries, registry } = options.input;
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(await this.queryItems(registry, queries)))
        ]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<Queries>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching tags from the registry...",
        };
    }
}

interface Tags {
    registry: string;
    tags: string[];
}

export class ChatTagItemProvider implements vscode.LanguageModelTool<Tags>{
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<Tags>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let [namespace, path] = splitEncode(options.input.registry);

        let allTags: { [key: string]: string[] } = {};
        for (const tag of options.input.tags) {
            let [tagNamespace, tagPath] = splitEncode(tag);
            let resp = await this.client.get<string[]>(`/api/tags/${namespace}/${path}/values/${tagNamespace}/${tagPath}`);
            allTags[tag] = resp?.data ?? [];
        }
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(allTags, null, 4))
        ]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<Tags>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching available tags...",
        };
    }
}

export class RecipeListing implements vscode.LanguageModelTool<RegexQuery>{
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<RegexQuery>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let resp0 = (await this.client.get<string[]>('/api/probejs/list-supported-recipes'))?.data ?? [];
        let regexFilter = new RegExp(options.input?.pattern || '.*');
        resp0 = resp0.filter(reg => regexFilter.test(reg));
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(resp0, null, 4))]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<RegexQuery>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching available recipes support...",
        };
    }
}

interface MultiRecipeDoc {
    recipeTypes: string[];
}

export class FetchRecipeDoc implements vscode.LanguageModelTool<MultiRecipeDoc>{
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<MultiRecipeDoc>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let recipeTypes = options.input.recipeTypes;
        let resp = await this.client.post<string>(`/api/probejs/get-recipe-docs`, recipeTypes);
        if (!resp) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("No recipe documentation found for the specified types.")]);
        }
        resp = '```js\n' + resp + '\n```';
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(resp)]);
    }
}