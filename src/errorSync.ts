import * as vscode from "vscode";
import { ProbeClient } from "./bridge";

export class InfoSync {

    private collection: vscode.DiagnosticCollection;

    constructor(private readonly bridge: ProbeClient) {
        this.collection = vscode.languages.createDiagnosticCollection("probejs");
        this.connect(bridge);
    }

    public addDiagnostic(uri: vscode.Uri, diagnostic: vscode.Diagnostic) {
        if (!this.collection.has(uri)) {
            this.collection.set(uri, [diagnostic]);
        } else {
            const diagnostics = this.collection.get(uri)
                ?.filter(v => v.range.start.line !== diagnostic.range.start.line);
            this.collection.set(uri, [...diagnostics!, diagnostic]);
        }
    }

    private connect(bridge: ProbeClient) {
        bridge.on('accept_error', (data: {
            file: string;
            level: string;
            line: number;
            column: number;
            message: string;
        }) => {
            const uri = vscode.Uri.file(data.file);
            // mark the entire line
            const range = new vscode.Range(data.line - 1, 0, data.line - 1, Number.MAX_VALUE);
            const diagnostic = new vscode.Diagnostic(range, data.message, this.getSeverity(data.level));

            this.addDiagnostic(uri, diagnostic);
        });

        bridge.on('accept_error_no_line', (data: {
            message: string,
            stackTrace: string[]
        }) => {
            // Show a message box with the error and a button to open
            // the stack trace
            vscode.window.showErrorMessage(data.message, 'Show Stack Trace')
                .then((value) => {
                    if (value === 'Show Stack Trace') {
                        let formattedError = `${data.message}\n\nStacktrace:\n${data.stackTrace.map(s => "\t" + s).join('\n')}`;
                        vscode.workspace.openTextDocument({
                            content: formattedError,
                        }).then(doc => {
                            vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
                        });
                    }
                });
        });

        bridge.on('clear_error', () => {
            this.collection.clear();
        });

        bridge.on('close', () => {
            this.collection.clear();
        });
    }

    private getSeverity(level: string): vscode.DiagnosticSeverity {
        switch (level) {
            // because the level is from Java, so they are uppercase
            case 'ERROR':
                return vscode.DiagnosticSeverity.Error;
            case 'WARNING':
                return vscode.DiagnosticSeverity.Warning;
            case 'INFO':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Error;
        }
    }
}