import axios, { AxiosResponse } from "axios";
import { WebSocket } from "ws";
import * as vscode from "vscode";

export class ProbeWebClient {
    private _wsHandlers: Map<string, ((event: string, data: any) => Promise<void>)[]> = new Map();
    private _ws: WebSocket[] = [];
    private _connected = 0;
    private _portConnected = false;
    private _statusBar: vscode.StatusBarItem;
    private _onConnected: (() => Promise<void>)[] = [];


    constructor(private port: number) {
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

    public onConnected(handler: () => Promise<void>) {
        this._onConnected.push(handler);
    }

    private async connected() {
        vscode.window.showInformationMessage("Connected to KubeJS webserver");
        this._statusBar.text = "$(zap) ProbeJS Connected!";
        this._statusBar.color = "green";
        this._portConnected = true;
        this.connectWS();

        for (let handler of this._onConnected) {
            await handler();
        }
    }

    public async tryConnect(): Promise<boolean> {
        this._portConnected = false;
        let originalPort = this.port;
        for (let i = 0; i < 10; i++) {
            axios.defaults.baseURL = `http://localhost:${this.port}`;
            console.log(`Trying to connect to http://localhost:${this.port}`);
            if (await this.ping()) {
                await this.connected();
                return true;
            }
            this.port++;
        }

        this.port = originalPort;
        axios.defaults.baseURL = `http://localhost:${this.port}`;
        if (await this.ping()) {
            await this.connected();
            return true;
        }

        vscode.window.showErrorMessage("ProbeJS connection failed, is MC 1.21+ running?");
        this._statusBar.text = "$(debug-disconnect) Click to reconnect to webserver...";
        this._statusBar.color = "red";
        return false;
    }

    public connectWS() {
        this._ws.forEach(ws => ws.close());
        this._ws = [];

        this._wsHandlers.forEach((handlers, path) => {
            let ws = new WebSocket(`ws://localhost:${this.port}/${path}`);

            ws.on("open", () => {
                this._connected++;
                if (this._connected === this._ws.length) {
                    this._statusBar.text = "$(zap) ProbeJS Connected!";
                    this._statusBar.color = "green";
                }
            });
            ws.on("message", async (data) => {
                const response = JSON.parse(data.toString());
                if (response.payload) {
                    for (let h of handlers) {
                        console.log(response);
                        await h(response.type, response.payload);
                    }
                }
            });
            ws.on("close", () => {
                this._connected--;
                if (this._connected === 0) {
                    this._statusBar.text = "$(debug-disconnect) Click to reconnect to webserver...";
                    if (this._statusBar.color !== "red") { this._statusBar.color = "yellow"; }
                }
            });
            ws.on("error", () => {
                this._connected = 0;
                this._ws.forEach(ws => ws.close());
                this._statusBar.text = "$(debug-disconnect) Click to reconnect to webserver...";
                this._statusBar.color = "red";
                vscode.window.showErrorMessage("ProbeJS connection failed, is MC 1.21+ running?");
            });

            this._ws.push(ws);
        });
    }

    public registerWSHandler(path: string, handler: (event: string, data: any) => Promise<void>) {
        if (!this._wsHandlers.has(path)) {
            this._wsHandlers.set(path, []);
        }
        this._wsHandlers.get(path)?.push(handler);
    }

    public ws(path: string): WebSocket | null {
        return this._ws.find(ws => ws.url.includes(path)) ?? null;
    }

    public async post<T>(path: string, data?: any): Promise<T | null> {
        if (!this._portConnected) {
            await this.tryConnect();
        }

        try {
            let resp = await axios.post(path, data);
            return resp.data;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public async get<T>(path: string): Promise<AxiosResponse<T> | null> {
        if (!this._portConnected) {
            await this.tryConnect();
        }

        try {
            let resp = await axios.get(path);
            return resp;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    public async disconnect() {
        this._ws.forEach(ws => ws.close());
    }
}