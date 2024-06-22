import * as vscode from "vscode";
import { ProbeClient } from "./bridge";

export class ErrorSync {

    private collection: vscode.DiagnosticCollection;

    constructor(private readonly bridge: ProbeClient) {
        this.collection = vscode.languages.createDiagnosticCollection("probejs");
        this.connect(bridge);
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
            const range = new vscode.Range(data.line, data.column, data.line, data.column);
            const diagnostic = new vscode.Diagnostic(range, data.message, this.getSeverity(data.level));
            this.collection.set(uri, [diagnostic]);
        });

        bridge.on('clear_error', () => {
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