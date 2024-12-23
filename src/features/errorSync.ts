import * as vscode from "vscode";
import { ProbeWebClient } from "../probe";
import { ConsoleInfo } from "../payload/consoleInfo";
import path = require("path");
import { SessionInfo } from "../payload/sessionInfo";

export class InfoSync {

    private collection: vscode.DiagnosticCollection;
    private static readonly scriptTypeToFolder: { [key: string]: string } = {
        "startup": "startup_scripts",
        "server": "server_scripts",
        "client": "client_scripts",
    };

    constructor(client: ProbeWebClient) {
        this.collection = vscode.languages.createDiagnosticCollection("probejs");
        this.connectWS(client);
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

    private connectWS(client: ProbeWebClient) {
        client.registerWSHandler("api/console/startup/stream", this.createScriptHandler("startup_scripts"));
        client.registerWSHandler("api/console/server/stream", this.createScriptHandler("server_scripts"));
        client.registerWSHandler("api/updates", async (event, data) => {
            if (event !== "before_scripts_loaded") { return; }
            await this.beforeReloadHandler(data as { type: string, time: number });
        });

        client.registerWSInitializer("api/console/startup/stream", SessionInfo.asPayloadInitializer({ source: "probejs", tags: ["highlight"] }));
        client.registerWSInitializer("api/console/server/stream", SessionInfo.asPayloadInitializer({ source: "probejs", tags: ["highlight"] }));
        client.registerWSInitializer("api/updates", SessionInfo.asPayloadInitializer({ source: "probejs", tags: ["highlight", "after_scripts_loaded"] }));
    }

    private async beforeReloadHandler(data: { type: string, time: number }) {
        const folder = InfoSync.scriptTypeToFolder[data.type];
        console.log(`Clearing diagnostics for ${folder}`);
        let uris: vscode.Uri[] = [];
        this.collection.forEach((uri, _) => {
            if (uri.fsPath.includes(folder)) {
                uris.push(uri);
            }
        });

        for (const uri of uris) {
            this.collection.delete(uri);
        }
    }

    private createScriptHandler(scriptType: string) {
        const handleInfo = async (_event: string, data: ConsoleInfo) => {

            if (data.script_source_lines) {
                data.script_source_lines.forEach((sourceLine) => {
                    let { source, line } = sourceLine;
                    if (!source) { return; }
                    if (source.includes(":")) { source = source.split(":")[1]; }
                    const relPath = `./kubejs/${scriptType}/${source}`;
                    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
                    if (!workspace) { return; }
                    const uri = vscode.Uri.file(path.resolve(workspace, relPath));
                    const range = new vscode.Range(line - 1, 0, line - 1, Number.MAX_VALUE);
                    const diagnostic = new vscode.Diagnostic(range, data.message, this.getSeverity(data.type));

                    this.addDiagnostic(uri, diagnostic);
                });
            } else {
                vscode.window.showErrorMessage(data.message, 'Show Stack Trace')
                    .then((value) => {
                        if (value === 'Show Stack Trace') {
                            let formattedError = `${data.message}\n\nStacktrace:\n${data.stack_trace.map(s => "\t" + s).join('\n')}`;
                            vscode.workspace.openTextDocument({
                                content: formattedError,
                            }).then(doc => {
                                vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
                            });
                        }
                    });
            }
        };

        return handleInfo;
    }

    private getSeverity(level: string): vscode.DiagnosticSeverity {
        switch (level) {
            // because the level is from Java, so they are uppercase
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warn':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

}