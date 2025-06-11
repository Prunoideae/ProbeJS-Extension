import * as vscode from 'vscode';
import { ProbeWebClient } from '../probe';
import { TextContentProvider } from './textProvider';
import { ProbeImages } from './imageClient';

export function registerChatTools(context: vscode.ExtensionContext, client: ProbeWebClient, images: ProbeImages, textProvider: TextContentProvider) {
    context.subscriptions.push(vscode.lm.registerTool('probejs-list_registries', new RegistryListing(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_by_regex', new ChatItemProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_tags_by_regex', new ChatTagProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-query_tagged_objects', new ChatTagItemProvider(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-list_supported_recips', new RecipeListing(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-fetch_recipe_docs', new FetchRecipeDoc(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-list_commands', new ListCommands(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-run_commands', new RunCommands(client)));
    context.subscriptions.push(vscode.lm.registerTool('probejs-display_report', new DisplayReport(textProvider, images)));
}

function splitEncode(rl: string): [string, string] {
    let [namespace, path] = rl.split(':');
    return [encodeURIComponent(namespace), encodeURIComponent(path)];
}

interface Query {
    pattern: string;
    registry: string;
}

interface RegexQuery {
    pattern: string;
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

export class ChatItemProvider implements vscode.LanguageModelTool<Query>{

    constructor(private readonly client: ProbeWebClient) { }

    async queryItems(registry: string, pattern: string): Promise<string[] | { error: string }> {
        if (!this.client.mcConnected()) {
            return { error: "The plugin is not connected to a running Minecraft instance. No result can be provided." };
        }

        let [namespace, path] = splitEncode(registry);
        // Get all keys from the registry
        let resp1 = await this.client.get<string[]>(`/api/registries/${namespace}/${path}/keys`);
        if (!resp1) { return []; }

        let regexFilter = new RegExp(pattern);
        let filteredKeys = resp1.data.filter(key => regexFilter.test(key));

        filteredKeys.sort((a, b) => a.localeCompare(b));
        return filteredKeys;
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<Query>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        let { pattern, registry } = options.input;
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(await this.queryItems(registry, pattern)))
        ]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<Query>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching items from the registry...",
        };
    }
}

export class ChatTagProvider implements vscode.LanguageModelTool<Query>{
    constructor(private readonly client: ProbeWebClient) { }

    async queryItems(registry: string, pattern: string): Promise<string[] | { error: string }> {
        if (!this.client.mcConnected()) {
            return { error: "The plugin is not connected to a running Minecraft instance. No result can be provided." };
        }

        let [namespace, path] = splitEncode(registry);
        // Get all keys from the registry
        let resp1 = await this.client.get<string[]>(`/api/tags/${namespace}/${path}`);
        if (!resp1) { return []; }

        let regexFilter = new RegExp(pattern);
        let filteredKeys = resp1.data.filter(key => regexFilter.test(key));

        filteredKeys.sort((a, b) => a.localeCompare(b));
        return filteredKeys;
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<Query>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        let { pattern, registry } = options.input;
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(await this.queryItems(registry, pattern)))
        ]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<Query>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
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

interface CommandList {
    playerName: string;
    commands: string[];
}

export class ListCommands implements vscode.LanguageModelTool<RegexQuery>{
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<RegexQuery>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let resp0 = (await this.client.get<CommandList>('/api/probejs/list-commands'))?.data;
        if (!resp0) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("No commands found.")]);
        }
        let regexFilter = new RegExp(options.input?.pattern || '.*');
        let { playerName, commands } = resp0;
        commands = commands.filter(cmd => regexFilter.test(cmd));
        if (commands.length === 0) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`No commands found matching the pattern.`)]);
        }
        let result = `Player target ${playerName}:\n` + commands.map(cmd => `- ${cmd}`).join('\n');
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<RegexQuery>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "Fetching available commands...",
        };
    }
}

interface CommandOutputLine {
    type: string;
    content: string;
}

export class RunCommands implements vscode.LanguageModelTool<{ commands: string[] }> {
    constructor(private readonly client: ProbeWebClient) { }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commands: string[] }>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        if (!this.client.mcConnected()) {
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("The plugin is not connected to a running Minecraft instance. No result can be provided.")]);
        }
        let commands = options.input.commands;
        let lines: string[] = [];

        for (const command of commands) {
            let resp = await this.client.post<CommandOutputLine[]>(`/api/probejs/run-command`, { command });
            if (!resp) {
                return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart("Failed to run the command.")]);
            }
            lines.push(...resp.map(line => `[${line.type}]\t${line.content}`));
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(lines.join('\n'))]);
    }

    prepareInvocation?(options: vscode.LanguageModelToolInvocationPrepareOptions<{ commands: string[] }>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        let commands = options.input.commands.map(cmd => cmd.trim()).join('\n');
        return {
            invocationMessage: "Running the specified command...", confirmationMessages: {
                title: "Run Command",
                message: `Will run following commands in game:\n\`\`\`text\n${commands}\n\`\`\`\nAre you sure?`,
            }
        };
    }
}

// probejs-display_report
export class DisplayReport implements vscode.LanguageModelTool<{ markdownContent: string, title: string }>{
    constructor(private readonly textProvider: TextContentProvider, private readonly images: ProbeImages) { }


    async invoke(options: vscode.LanguageModelToolInvocationOptions<{ markdownContent: string; title: string; }>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        const { markdownContent, title } = options.input;
        const uri = vscode.Uri.parse(`${TextContentProvider.scheme}:${title}`);
        this.textProvider.registerText(title, markdownContent);
        await vscode.commands.executeCommand('markdown.showPreview', uri);

        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`Report "${title}" has been displayed in a new tab.`)]);
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<{ markdownContent: string; title: string; }>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return { invocationMessage: "Display the report in a new tab..." };
    }
}