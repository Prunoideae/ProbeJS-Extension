import * as vscode from 'vscode';
import { ProbeClient } from './bridge';

export class ReloadProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;

    constructor(private readonly probeClient: ProbeClient) {

    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const firstLineRange = new vscode.Range(0, 0, 0, Number.MAX_VALUE);
        const codeLenses: vscode.CodeLens[] = [];

        // check for script type.
        if (document.uri.fsPath.includes('server_scripts')) {
            const reloadCodeLens = new vscode.CodeLens(firstLineRange, {
                title: "Reload Script and Datapack",
                command: "probejs.reloadScript",
                tooltip: "Reload the script",
                arguments: ["reload"]
            });

            const reloadServerScriptCodeLens = new vscode.CodeLens(firstLineRange, {
                title: "Reload Script",
                command: "probejs.reloadScript",
                tooltip: "Reload the script",
                arguments: ["server_scripts"]
            });
            codeLenses.push(reloadCodeLens, reloadServerScriptCodeLens);
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

    public async reloadScript(scriptType: string) {
        await this.probeClient.command("reload", {
            scriptType
        });
    }
}