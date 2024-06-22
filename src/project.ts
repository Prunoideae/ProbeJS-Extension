/* eslint-disable @typescript-eslint/naming-convention */
import { readFileSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';

interface ProbeJSConfig {
    "probejs.interactive": boolean;
    "probejs.interactivePort": number;
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

    get probeJSConfigPath(): vscode.Uri {
        return this.withPath("kubejs/config/probe-settings.json");
    }

    get probeJSConfig(): ProbeJSConfig {
        return JSON.parse(readFileSync(this.probeJSConfigPath.fsPath, 'utf8'));
    }

    get decompiledPath(): vscode.Uri {
        return this.withPath(".probe/decompiled");
    }

    public enableProbeJS(): void {
        const probeJSConfig = this.probeJSConfig;
        probeJSConfig["probejs.interactive"] = true;
        probeJSConfig["probejs.interactivePort"] = 7796;
        writeFileSync(this.probeJSConfigPath.fsPath, JSON.stringify(probeJSConfig, null, 4));
    }
}