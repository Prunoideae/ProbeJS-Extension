import * as vscode from 'vscode';
import { ProbeWebClient } from "../probe";

export async function insertArray(client: ProbeWebClient | null) {
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