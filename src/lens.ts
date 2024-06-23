// Jumps to the definition of an import {} from 'module' statement

import { existsSync } from 'fs';
import * as vscode from 'vscode';

export class JavaSourceProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;

    /**
     * import .* from (capture this)
     */
    private matchImport: RegExp = /import\s+.*\s+from\s+['"](.*)['"]/g;

    /**
     * require((capture this including quotes))
     */
    private matchRequire = /require\(['"](.*)['"]\)/g;

    /**
     * import (capture this)
     * e.g. import java.util.List;
     */
    private matchJavaImport = /import\s+(.*);/g;

    constructor(private readonly decompiledPath: vscode.Uri) {
    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        let matches;

        while ((matches = this.matchImport.exec(document.getText())) !== null) {
            const importPath = matches[1];
            if (!this.isImportValid(importPath)) {
                continue;
            }

            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            const codeLens = new vscode.CodeLens(range);
            codeLenses.push(codeLens);
        }

        while ((matches = this.matchRequire.exec(document.getText())) !== null) {
            const importPath = matches[1];
            if (!this.isImportValid(importPath)) {
                continue;
            }

            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            const codeLens = new vscode.CodeLens(range);
            codeLenses.push(codeLens);
        }

        return codeLenses;
    }

    private isImportValid(importPath: string): boolean {
        if (!importPath.startsWith("packages/")) {
            return false;
        }
        // Check if file exists
        let path = this.decompiledPath.with({ path: this.decompiledPath.path + "/" + this.processImportPath(importPath) });
        return existsSync(path.fsPath);
    }

    private isJavaImportValid(importPath: string): boolean {
        return false;
    }


    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        codeLens.command = {
            title: "Jump to the Java source",
            command: "probejs.jumpToSource",
            tooltip: "Jump to the vineflower-decompiled Java file produced by ProbeJS",
            arguments: [codeLens.range]
        };

        return codeLens;
    }

    private processImportPath(importPath: string): string {
        importPath = importPath.substring("packages/".length);
        let parts = importPath.split("/");
        // Last part -> $Class to Class.java
        let lastPart = parts[parts.length - 1];
        if (lastPart.startsWith("$")) {
            lastPart = lastPart.substring(1);
        }
        if (lastPart.includes("$")) {
            lastPart = lastPart.substring(0, lastPart.indexOf("$"));
        }
        lastPart = lastPart + ".java";
        parts[parts.length - 1] = lastPart;
        return parts.join("/");
    }

    public jumpToSource(range: vscode.Range) {
        let content = vscode.window.activeTextEditor?.document.getText(range);

        // match the import or require to extract the path
        let matches = this.matchImport.exec(content!);
        if (!matches) {
            matches = this.matchRequire.exec(content!);
        }
        if (!matches) {
            return;
        }
        let importPath = matches[1];
        let path = this.decompiledPath.with({ path: this.decompiledPath.path + "/" + this.processImportPath(importPath) });
        let uri = vscode.Uri.file(path.fsPath);
        // open the file in side panel
        vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside });
    }
}

export class StacktraceSourceProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void> | undefined;

    // Example stack trace:
    // 	java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
    // 	TRANSFORMER/kubejs@2100.7.0-build.42/dev.latvian.mods.kubejs.core.PlayerKJS.kjs$give(PlayerKJS.java:67)
    // Capture java.base/jdk.internal.reflect.DirectMethodHandleAccessor and 103
    private matchStackTrace = /(.*)\((.*):(\d+)\)/g;

    constructor(private readonly decompiledPath: vscode.Uri) {
    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        let matches;

        while ((matches = this.matchStackTrace.exec(document.getText())) !== null) {
            let classPath = matches[1];

            if (!this.isStackTraceValid(classPath)) {
                continue;
            }

            const range = new vscode.Range(document.positionAt(matches.index), document.positionAt(matches.index + matches[0].length));
            const codeLens = new vscode.CodeLens(range);
            codeLenses.push(codeLens);
        }

        return codeLenses;
    }

    private isStackTraceValid(stacktrace: string): boolean {
        let path = this.decompiledPath.with({ path: this.decompiledPath.path + "/" + this.processStacktrace(stacktrace) });
        return existsSync(path.fsPath);
    }

    private processStacktrace(stacktrace: string): string {
        let paths = stacktrace.split("/");
        let classPathWithMethod = paths[paths.length - 1];
        let parts = classPathWithMethod.split(".");
        parts.pop();
        let classPath = parts.join("/");
        classPath = classPath + ".java";
        return classPath;
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        codeLens.command = {
            title: "Jump to the Java source",
            command: "probejs.jumpToStackSource",
            tooltip: "Jump to the vineflower-decompiled Java file produced by ProbeJS. Line numbers may be inaccurate.",
            arguments: [codeLens.range]
        };

        return codeLens;
    }

    public jumpToSource(range: vscode.Range) {
        let content = vscode.window.activeTextEditor?.document.getText(range);
        let matches = this.matchStackTrace.exec(content!);
        if (!matches) {
            return;
        }
        let classPath = matches[1];
        let path = this.decompiledPath.with({ path: this.decompiledPath.path + "/" + this.processStacktrace(classPath) });
        let uri = vscode.Uri.file(path.fsPath);
        // We don't offset the line because the line number is probably wrong
        vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside });
    }
}