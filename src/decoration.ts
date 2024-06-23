import * as vscode from 'vscode';

/**
 * Decorates the script properties:
 * // priority: int
 * // requires: mod_name
 * // enabled: bool
 * // packmode: string
 */
export class ProbeDecorator {
    private readonly _matcher = /\/\/\s*(priority|requires|enabled|packmode):\s*(\w+)/g;
    private readonly _style = vscode.window.createTextEditorDecorationType({
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '3px',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        light: {
            // used for light colored themes
            overviewRulerColor: 'rgba(0, 0, 0, 0.3)',
            borderColor: 'rgba(0, 0, 0, 0.3)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            color: 'rgba(0, 0, 0, 0.5)'

        },
        dark: {
            // used for dark colored themes
            overviewRulerColor: 'rgba(255, 255, 255, 0.3)',
            borderColor: 'rgba(255, 255, 255, 0.3)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.5)'
        }
    });
    private _textEditor: vscode.TextEditor | undefined;

    constructor() {

    }

    public set editor(editor: vscode.TextEditor) {
        this._textEditor = editor;
    }

    public decorate() {
        if (!this._textEditor) {
            return;
        }
        const text = this._textEditor.document.getText();
        const decorations: vscode.DecorationOptions[] = [];
        let match;
        console.log(11);
        while ((match = this._matcher.exec(text)) !== null) {
            const startPos = this._textEditor.document.positionAt(match.index);
            const endPos = this._textEditor.document.positionAt(match.index + match[0].length);
            const decoration = {
                range: new vscode.Range(startPos, endPos), hoverMessage: 'This is a KubeJS script property.'
            };
            decorations.push(decoration);
        }
        this._textEditor.setDecorations(this._style, decorations);
    }
}