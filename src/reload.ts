import * as vscode from 'vscode';
import { ProbeWebClient } from './probe';

type ScriptType = "server_scripts" | "client_scripts" | "startup_scripts";

export class ReloadProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;

    constructor(private readonly probeClient: ProbeWebClient) {

    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const firstLineRange = new vscode.Range(0, 0, 0, 0);
        const codeLenses: vscode.CodeLens[] = [];

        // check for script type.
        if (document.uri.fsPath.includes('server_scripts')) {
            const reloadServerScriptCodeLens = new vscode.CodeLens(firstLineRange, {
                title: "Reload Script",
                command: "probejs.reloadScript",
                tooltip: "Reload the script",
                arguments: ["server_scripts"]
            });
            codeLenses.push(reloadServerScriptCodeLens);
        } else if (document.uri.fsPath.includes('client_scripts')) {
            const reloadClientScriptCodeLens = new vscode.CodeLens(firstLineRange, {
                title: "Reload Script",
                command: "probejs.reloadScript",
                tooltip: "Reload the script",
                arguments: ["client_scripts"]
            });
            codeLenses.push(reloadClientScriptCodeLens);
        } else if (document.uri.fsPath.includes('startup_scripts')) {
            const reloadStartupScriptCodeLens = new vscode.CodeLens(firstLineRange, {
                title: "Reload Script",
                command: "probejs.reloadScript",
                tooltip: "Reload the script",
                arguments: ["startup_scripts"]
            });
            codeLenses.push(reloadStartupScriptCodeLens);
        }

        return codeLenses;
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }

    public async reloadScript(scriptType: ScriptType) {
        switch (scriptType) {
            case "startup_scripts":
                await this.probeClient.post("api/reload/startup");
                break;
            case "server_scripts":
                await this.probeClient.post("api/reload/server");
                break;
            case "client_scripts":
                await this.probeClient.post("api/reload/client");
                break;
        };
    }
}