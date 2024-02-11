import * as vscode from "vscode";
import * as util from "util";
import WebSocket = require("ws");


export async function createRepl(context: vscode.ExtensionContext, port: number) {
    if (!Repl.instance.tryConnect(port)) { return; }
    Repl.instance.setContext(context);
    Repl.instance.createWebviewPanel();
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

class Repl {
    public static instance = new Repl();

    private ws?: WebSocket;
    private panel?: vscode.WebviewPanel;
    private promises: Map<string, [(value: any) => void, (value: any) => void]> = new Map();
    private context!: vscode.ExtensionContext;
    private connected = false;

    constructor() { }

    public tryConnect(port: number): boolean {
        if (this.connected) { return false; } // keep only one connection
        try {
            this.ws = new WebSocket(`ws://localhost:${port}`);
            this.ws.on("open", () => {
                this.connected = true;
                vscode.window.showInformationMessage("Connected to ProbeJS server");
            });
            this.ws.on("close", () => {
                vscode.window.showInformationMessage("Disconnected from ProbeJS server");
                if (this.panel) { this.panel.dispose(); }
            });
            this.ws.on("message", data => {
                const message = JSON.parse(data.toString());
                if (message.id && this.promises.has(message.id)) {
                    let [resolve, reject] = this.promises.get(message.id)!;
                    if (message.error) { reject(message.error); }
                    else { resolve(message.result); }
                    this.promises.delete(message.id);
                }
            });
            return true;
        } catch (e) {
            vscode.window.showErrorMessage("Failed to connect to ProbeJS server, is it running?");
            return false;
        }
    }

    public setContext(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public async invoke<T>(command: string, payload: any): Promise<T> {
        const id = Math.random().toString(36).substring(2, 15);
        let promise = new Promise<T>((resolve, reject) => {
            this.promises.set(id, [resolve, reject]);
        });
        this.ws?.send(JSON.stringify({ id, command, payload }));
        return promise;
    }

    private async evaluate(code: string, type: string, pack: string) {
        let result = await this.invoke<any>("evaluate", { input: code, type, pack });
        if (result === "dev.latvian.mods.rhino.Undefined@0") { return "undefined"; };
        let inspect = util.inspect(result, {

        });
        // replace all '$$ProbeJS$$text$$ProbeJS$$' to text
        // FIXME: need a fix for case when text has single $ in it
        inspect = inspect.replace(/'\$\$ProbeJS\$\$([^$]+)\$\$ProbeJS\$\$'/g, "$1");
        inspect = inspect.replace(/"\$\$ProbeJS\$\$([^$]+)\$\$ProbeJS\$\$"/g, "$1");
        return inspect;
    }

    private async getPacks(type: string) {
        return this.invoke<string[]>("getPacks", { type });
    }

    private async getGlobals(type: string, pack: string) {
        return this.invoke<string[]>("getGlobals", { type, pack });
    }

    public createWebviewPanel() {
        this.panel = vscode.window.createWebviewPanel(
            "kubejs-repl",
            "KubeJS Console",
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
        this.panel.webview.onDidReceiveMessage(async ({ id, command, payload }) => {
            try {
                switch (command) {
                    case "evaluate":
                        let { type, pack, input } = payload;
                        let result = await this.evaluate(input, type, pack);
                        this.panel?.webview.postMessage({ id, payload: result });
                        break;
                    case "getPacks":
                        let packs = await this.getPacks(payload);
                        console.log(packs);
                        this.panel?.webview.postMessage({ id, payload: packs });
                        break;
                    case "getGlobals":
                        let globals = await this.getGlobals(payload.type, payload.pack);
                        this.panel?.webview.postMessage({ id, payload: globals });
                        break;
                }
            } catch (e) {
                console.error(e);
                this.panel?.webview.postMessage({ id, error: e });
            }
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.ws?.close();
            this.ws = undefined;
            this.connected = false;
        });
    }

    public getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'asset', 'repl.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'asset', 'repl.css'));
        const w3Uri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'asset', 'w3.css'));
        const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "out", "webview.js"));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy"
                content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>KubeJS Console</title>
            <link href="${styleUri}" rel="stylesheet">
            <link href="${w3Uri}" rel="stylesheet">
            <link href="${codiconsUri}" rel="stylesheet">
        </head>
        
        <body>
            <div>
                <vscode-dropdown id="scriptType">
                    <vscode-option>startup_scripts</vscode-option>
                    <vscode-option>server_scripts</vscode-option>
                    <vscode-option>client_scripts</vscode-option>
                </vscode-dropdown>

                <vscode-dropdown id="scriptPack">
                    <vscode-option>startup_scripts</vscode-option>
                </vscode-dropdown>

                <div class="repl-container">
                </div>

                <vscode-text-field id="repl-input" autofocus></vscode-text-field>
            </div>
            <script nonce="${nonce}" type="module" src="${webviewUri}"></script>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

