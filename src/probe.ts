import axios, { AxiosResponse } from "axios";
import * as vscode from "vscode";
import { WebSocket } from "ws";
import { encodePayload, MessageTypes, PayloadMap, PayloadTypes, WSResponse } from "./payload/kubedex";

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class ProbeWebClient {
    private _connected = 0;
    private _portConnected = false;
    private _statusBar: vscode.StatusBarItem;
    private _onConnected: ((port: number) => Promise<void>)[] = [];
    private _onKubedexUpdate: { [key in MessageTypes]?: ((payload: PayloadTypes) => Promise<void>)[] } = {};
    private _port: number = 61423;
    private _ws: WebSocket | null = null;


    constructor(private originalPort: number, private auth: string) {
        this._port = originalPort;
        this._statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBar.text = "ProbeJS Web Client...";
        this._statusBar.command = "probejs.reconnect";
        this._statusBar.show();
    }

    public async ping(): Promise<boolean> {
        try {
            let resp = await axios.get("/", { timeout: 20 });
            return resp.status === 200;
        } catch (e) {
            return false;
        }
    }

    public onConnected(handler: (port: number) => Promise<void>) {
        this._onConnected.push(handler);
    }

    private async connected() {
        vscode.window.showInformationMessage("Connected to KubeJS webserver");
        this._statusBar.text = "$(zap) ProbeJS Connected!";
        this._statusBar.color = "green";
        this._portConnected = true;

        for (let handler of this._onConnected) { await handler(this._port); }
    }

    public async tryConnect(firstStart: boolean): Promise<boolean> {
        if (firstStart) { await sleep(4000); }
        this._portConnected = false;
        let originalPort = this._port;
        for (let i = 0; i < 10; i++) {
            axios.defaults.baseURL = `http://localhost:${this._port}`;
            console.log(`Trying to connect to http://localhost:${this._port}`);
            if (await this.ping()) {
                if (firstStart) { await sleep(1000); }
                await this.connected();
                return true;
            }
            this._port++;
        }

        this._port = originalPort;
        axios.defaults.baseURL = `http://localhost:${this._port}`;
        if (await this.ping()) {
            await sleep(1000);
            await this.connected();
            return true;
        }

        vscode.window.showErrorMessage("ProbeJS connection failed, is MC 1.21+ running?");
        this._statusBar.text = "$(debug-disconnect) Click to reconnect to webserver...";
        this._statusBar.color = "red";
        return false;
    }

    public async post<T>(path: string, data?: any): Promise<T | null> {
        if (!this._portConnected) {
            await this.tryConnect(false);
        }

        try {
            let resp = await axios.post(path, data, {
                headers: {
                    ["Authorization"]: this.auth
                }
            });
            return resp.data;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public async get<T>(path: string, timeout?: number | undefined): Promise<AxiosResponse<T> | null> {
        if (!this._portConnected) {
            await this.tryConnect(false);
        }

        try {
            let resp = await axios.get(path, { headers: { ["Authorization"]: this.auth }, timeout: timeout });
            return resp;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public async disconnect() {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
    }

    public connectedPort(): number | undefined {
        return this._portConnected ? this._port : undefined;
    }

    public mcConnected(): boolean {
        return this._portConnected;
    }

    // Use only for listening kubedex update events
    public async connectKubedex() {
        if (!this._portConnected) { return; }
        if (this._ws) { this._ws.close(); }

        this._ws = new WebSocket(`ws://localhost:${this._port}/api/updates`);
        this._ws.on("open", () => {
            vscode.window.showInformationMessage("Websocket connected!");
            this._ws?.send(encodePayload('$', { tags: ['highlight'], source: 'probejs' }));
        });

        this._ws.on("message", async (data) => {
            try {
                let { type, payload } = JSON.parse(data.toString()) as WSResponse;
                let handlers = this._onKubedexUpdate[type];
                if (handlers) { for (let handler of handlers) { await handler(payload); } }
            } catch (e) {
                console.error("Failed to parse websocket message", e);
            }
        });
    }

    public listenKubedex<T extends MessageTypes>(type: T, handler: ((payload: PayloadMap[T]) => Promise<void>)) {
        if (!this._onKubedexUpdate[type]) { this._onKubedexUpdate[type] = []; }
        this._onKubedexUpdate[type]?.push(handler as any);
    }
}