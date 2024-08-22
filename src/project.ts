/* eslint-disable @typescript-eslint/naming-convention */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';

interface ProbeJSConfig {
    "enabled": boolean;
    "port": number;
    "public_address": string;
}

export class ProbeJSProject {
    private workspace: vscode.Uri;

    constructor(workspace: vscode.Uri) {
        this.workspace = workspace;
    }

    public withPath(path: string): vscode.Uri {
        return this.workspace.with({ path: this.workspace.path + `/${path}` });
    }

    get vsCodePath(): vscode.Uri {
        return this.withPath(".vscode");
    }

    get kubeJSPath(): vscode.Uri {
        return this.withPath("kubejs");
    }

    get webServerConfigPath(): vscode.Uri {
        return this.withPath("kubejs/config/web_server.json");
    }

    get configAvailable(): boolean {
        return existsSync(this.webServerConfigPath.fsPath);
    }

    get webServerConfig(): ProbeJSConfig {
        return JSON.parse(readFileSync(this.webServerConfigPath.fsPath, 'utf8'));
    }

    get decompiledPath(): vscode.Uri {
        return this.withPath(".probe/decompiled");
    }

    public enableProbeJS(): void {
        const probeJSConfig = this.webServerConfig;
        probeJSConfig["enabled"] = true;
        probeJSConfig["port"] = 61423;
        writeFileSync(this.webServerConfigPath.fsPath, JSON.stringify(probeJSConfig, null, 4));
    }
}