import * as vscode from 'vscode';
import { ProbeWebClient } from "../probe";

export async function insertItemArray(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<string[]>('/api/registries');
    if (!resp0) { vscode.window.showErrorMessage("Failed to get available registries"); return; }

    let registries = resp0.data;
    let registry = await vscode.window.showQuickPick(registries);
    if (!registry) { return; }
    let [namespace, path] = registry.split(':');

    let resp1 = await client.get<string[]>(`/api/registries/${namespace}/${encodeURIComponent(path)}/keys`);
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

export async function insertLangKeys(client: ProbeWebClient | null) {
    if (client === null) { return; }

    let resp0 = await client.get<{ [key: string]: string }>('/api/missing-lang-keys');
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