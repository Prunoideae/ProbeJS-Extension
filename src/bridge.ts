import { WebSocket } from "ws";
import * as vscode from 'vscode';

function randomNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class ProbeClient {
    private _ws: WebSocket | undefined;
    private _sentCommands: Map<string, [(result: any) => void, (error: any) => void]> = new Map();
    private _eventHandlers: Map<string, (event: any) => void> = new Map();
    private _connected = false;
    private _statusBar: vscode.StatusBarItem;

    constructor(private port: number) {

        this.connect(port);
        this._sentCommands = new Map();
        this._eventHandlers = new Map();

        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBar.text = 'ProbeJS Connecting...';
        this._statusBar.command = 'probejs.reconnect';
        this._statusBar.show();
    }

    public connect(port: number) {
        this._ws = new WebSocket(`ws://localhost:${port}`, {
            timeout: 1,
        });

        this._ws.on('open', () => {
            this._connected = true;
            this._statusBar.text = '$(zap) ProbeJS Connected!';
            this._statusBar.color = 'green';
            vscode.window.showInformationMessage('ProbeJS WebSocket connection established!');
        });

        this._ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            if (response.id) { // This is a response to a command
                const nonce = response.id;
                const callback = this._sentCommands.get(nonce);
                if (callback) {
                    if (response.error) {
                        callback[1](response.error);
                    } else {
                        callback[0](response.payload);
                    }
                }
            } else { // Server-sent event
                const event = response.event;
                const handler = this._eventHandlers.get(event);

                if (handler) {
                    handler(response.payload);
                }
            }
        });

        this._ws.on('close', () => {
            this._connected = false;
            this._statusBar.text = '$(debug-disconnect) Click to reconnect to ProbeJS...';
            this._statusBar.color = 'yellow';
        });

        this._ws.on('error', (error) => {
            this._connected = false;
            this._statusBar.text = '$(debug-disconnect) Click to reconnect to ProbeJS...';
            this._statusBar.color = 'red';
            vscode.window.showErrorMessage(`ProbeJS WebSocket connection failed: ${error}`);
        });
    }

    private constructPayload(command: string, payload: any): {
        id: string;
        command: string;
        payload: any;

    } {
        const nonce = randomNonce();
        return {
            id: nonce,
            command: command,
            payload: payload
        };
    }

    public async command<T>(command: string, payload: any): Promise<T> {
        const constructedPayload = this.constructPayload(command, payload);
        return new Promise((resolve, reject) => {
            if (!this._ws) {
                reject('WebSocket is not connected');
                return;
            }

            this._ws.send(JSON.stringify(constructedPayload));
            this._sentCommands.set(constructedPayload.id, [resolve, reject]);
        });
    }

    public on(event: string, callback: (event: any) => void) {
        this._eventHandlers.set(event, callback);
    }

    public close() {
        if (this._ws) {
            this._ws.close();
        }
    }

    public get connected(): boolean { return this._connected; }
}