import * as vscode from 'vscode';

export class TextContentProvider implements vscode.TextDocumentContentProvider {
    public static scheme = 'probejs';

    private _textContent: Map<string, string> = new Map();
    private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChangeEmitter.event;

    public registerText(path: string, content: string): void {
        this._textContent.set(path, content);
        this._onDidChangeEmitter.fire(vscode.Uri.parse(`${TextContentProvider.scheme}:${path}`));
    }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const content = this._textContent.get(uri.path);
        if (content) {
            return content;
        } else {
            return `No content found for ${uri.path}`;
        }
    }
}