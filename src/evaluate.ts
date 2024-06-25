import * as vscode from 'vscode';
import { ProbeClient } from './bridge';
import { InfoSync } from './errorSync';

export class EvaluateProvider implements vscode.CodeLensProvider {

    onDidChangeCodeLenses?: vscode.Event<void> | undefined;


    // regex to match functions with no params
    // e.g. function foo() {}
    private readonly matchFunction = /function\s+(\w+)\s*\(\s*\)\s*\{/g;

    // regex to match arrow functions with no params
    // e.g. const foo = () => {} or let foo = () => {} or var foo = () => {}
    private readonly matchArrowFunction = /(?:const|let|var)\s+(\w+)\s*=\s*\(\s*\)\s*=>\s*\{/g;

    // regex to match variables (and constants), must be top level so no space is 
    // allowed before var/let/const
    // e.g. const foo = 1 or let foo = 1 or var foo = 1
    private readonly matchVariable = /(?:const|let|var)\s+(\w+)\s*=\s*[^=]*;/g;

    constructor(private readonly probeClient: ProbeClient, private readonly infoSync: InfoSync) {

    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        let scriptType;
        if (document.uri.fsPath.includes('server_scripts')) {
            scriptType = "server_scripts";
        } else if (document.uri.fsPath.includes('client_scripts')) {
            scriptType = "client_scripts";
        } else if (document.uri.fsPath.includes('startup_scripts')) {
            scriptType = "startup_scripts";
        }
        if (!scriptType) {
            return codeLenses;
        }

        let matches;
        while ((matches = this.matchFunction.exec(document.getText())) !== null) {
            const functionCall = matches[1] + "()";
            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            // check if the function is having space before it, if so then ignore it
            if (document.getText().charAt(matches.index - 1) !== "\n") {
                continue;
            }

            const codeLens = new vscode.CodeLens(range, {
                title: "Evaluate",
                command: "probejs.evaluate",
                arguments: [functionCall, range, document.uri, scriptType]
            });
            codeLenses.push(codeLens);
        }
        while ((matches = this.matchArrowFunction.exec(document.getText())) !== null) {
            const functionCall = matches[1] + "()";
            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            // check if the function is having space before it, if so then ignore it
            if (document.getText().charAt(matches.index - 1) !== "\n") {
                continue;
            }
            const codeLens = new vscode.CodeLens(range, {
                title: "Evaluate",
                command: "probejs.evaluate",
                arguments: [functionCall, range, document.uri, scriptType]
            });
            codeLenses.push(codeLens);
        }
        while ((matches = this.matchVariable.exec(document.getText())) !== null) {
            const variable = matches[1];
            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            // check if the variable is having space before it, if so then ignore it
            if (document.getText().charAt(matches.index - 1) !== "\n") {
                continue;
            }
            const codeLens = new vscode.CodeLens(range, {
                title: "Evaluate",
                command: "probejs.evaluate",
                arguments: [variable, range, document.uri, scriptType]
            });
            codeLenses.push(codeLens);
        }

        return codeLenses;
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }

    public async evaluate(content: string, range: vscode.Range, uri: vscode.Uri, scriptType: string) {
        let response = await this.probeClient.command("evaluate", {
            scriptType,
            content
        });
        if (response === undefined) {
            response = "undefined";
        }

        this.infoSync.addDiagnostic(uri, new vscode.Diagnostic(
            range,
            JSON.stringify(response),
            vscode.DiagnosticSeverity.Information
        ));

    }
}