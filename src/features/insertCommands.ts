import * as vscode from 'vscode';
import { ProbeWebClient } from "../probe";

function splitEncode(rl: string): [string, string] {
    let [namespace, path] = rl.split(':');
    return [encodeURIComponent(namespace), encodeURIComponent(path)];
}

export async function insertItemArray(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<string[]>('/api/registries');
    if (!resp0) { vscode.window.showErrorMessage("Failed to get available registries"); return; }

    let registries = resp0.data;
    let registry = await vscode.window.showQuickPick(registries);
    if (!registry) { return; }
    let [namespace, path] = splitEncode(registry);

    let resp1 = await client.get<string[]>(`/api/registries/${namespace}/${path}/keys`);
    if (!resp1) { vscode.window.showErrorMessage("Failed to get available keys"); return; }

    let keys = resp1.data;
    let regexFilter = await vscode.window.showInputBox({ prompt: "Regex filter for keys" });
    if (regexFilter === undefined) { return; }
    if (regexFilter === "") { regexFilter = ".*"; }
    let regex = new RegExp(regexFilter);

    let filteredKeys = keys.filter(key => regex.test(key));
    let snippetString = JSON.stringify(filteredKeys, null, 4);
    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
}



export async function insertItemArrayFromTags(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<string[]>('/api/registries');
    if (!resp0) { vscode.window.showErrorMessage("Failed to get available registries"); return; }

    let registries = resp0.data;
    let registry = await vscode.window.showQuickPick(registries);
    if (!registry) { return; }
    let [namespace, path] = splitEncode(registry);

    let resp1 = await client.get<string[]>(`/api/tags/${namespace}/${path}`);
    if (!resp1) { vscode.window.showErrorMessage("Failed to get available keys"); return; }
    let keys = resp1.data;
    let selectedKeys = await vscode.window.showQuickPick(keys, { canPickMany: true });
    if (!selectedKeys) { return; }

    let values = [];
    for (const selectedKey of selectedKeys) {
        // /api/tags/{namespace}/{path}/values/{tag-namespace}/{tag-path}
        let [valueNamespace, valuePath] = splitEncode(selectedKey);
        let resp2 = await client.get<string[]>(`/api/tags/${namespace}/${path}/values/${valueNamespace}/${valuePath}`);
        if (!resp2) { vscode.window.showErrorMessage("Failed to get available values"); return; }
        values.push(resp2.data);
    }
    if (values.length === 1) { values = values[0]; }

    let snippetString = JSON.stringify(values, null, 4);
    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
}

export async function insertLangKeys(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<{ [key: string]: string }>('/api/probejs/missing-lang-keys');
    if (!resp0) { vscode.window.showErrorMessage("Failed to get missing lang keys"); return; }

    let keys = resp0.data;
    let regexFilter = await vscode.window.showInputBox({ prompt: "Regex filter for keys" });
    if (regexFilter === undefined) { return; }
    if (regexFilter === "") { regexFilter = ".*"; }
    let regex = new RegExp(regexFilter);

    let filteredLangs: { [key: string]: string } = {};
    for (let key in keys) {
        if (regex.test(key)) { filteredLangs[key] = keys[key]; }
    }

    let snippetString = JSON.stringify(filteredLangs, null, 4);
    snippetString = snippetString.replace(/^\s*{\s*/, '');
    snippetString = snippetString.replace(/\s*}\s*$/, '');
    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
}

export async function insertRecipeJson(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<{ [key: string]: string[] }>('/api/probejs/recipe-ids');
    if (!resp0) { vscode.window.showErrorMessage("Failed to get recipe ids"); return; }

    let typeIdsMap = resp0.data;
    let typeSelected = await vscode.window.showQuickPick(Object.keys(typeIdsMap));
    if (!typeSelected) { return; }

    let ids = typeIdsMap[typeSelected];
    let idSelected = await vscode.window.showQuickPick(ids);
    if (!idSelected) { return; }

    let resp1 = await client.get<object>(`/api/probejs/recipe-id?recipe-id=${encodeURIComponent(idSelected)}`);
    if (!resp1) { vscode.window.showErrorMessage("Failed to get recipe"); return; }

    let recipe = resp1.data;
    let snippetString = JSON.stringify(recipe, null, 4);
    vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
}