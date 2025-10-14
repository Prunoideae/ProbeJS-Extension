/* eslint-disable @typescript-eslint/naming-convention */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';

interface ProbeJSConfig {
    "enabled": boolean;
    "port": number;
    "public_address": string;
    "auth": string;
}

interface FallbackData {
    "registry": string;
    "objects": string[];
};

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

    public getBackupData(): FallbackData[] | undefined {
        let file = this.withPath(".probe/registry_objects.json");
        if (!existsSync(file.fsPath)) { return undefined; }
        let data: { [s: string]: string[] } = JSON.parse(readFileSync(file.fsPath, 'utf8'));
        let result: FallbackData[] = [];
        for (const registry of Object.keys(data)) {
            if (!Array.isArray(data[registry])) { return undefined; }
            result.push({ registry: registry, objects: data[registry] });
        }
        return result;
    }

    public enableProbeJS(): void {
        const probeJSConfig = this.webServerConfig;
        probeJSConfig["enabled"] = true;
        probeJSConfig["port"] = 61423;
        writeFileSync(this.webServerConfigPath.fsPath, JSON.stringify(probeJSConfig, null, 4));
    }
}