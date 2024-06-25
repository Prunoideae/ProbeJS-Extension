import { existsSync } from 'fs';
import * as vscode from 'vscode';
import { Uri } from 'vscode';

/**
 * Decorates the script properties:
 * // priority: int
 * // requires: mod_name
 * // enabled: bool
 * // packmode: string
 */
export class ProbeDecorator {
    private readonly _matcher = /\/\/\s*(priority|requires|enabled|packmode):\s*(\w+)/g;
    // private readonly _matcher = /"minecraft:apple"/g;

    // Matches a JS string, including escaped quotes: "foo" or 'bar'
    private readonly _matcherJSString = /(["'])(?:(?=(\\?))\2.)*?\1/g;

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

    constructor(private readonly path: vscode.Uri) {

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
        while ((match = this._matcher.exec(text)) !== null) {
            const startPos = this._textEditor.document.positionAt(match.index);
            const endPos = this._textEditor.document.positionAt(match.index + match[0].length);
            // const path = Uri.file(this.path.with({ path: this.path.fsPath + '\\test.gif' }).fsPath);

            const decoration: vscode.DecorationOptions = {
                range: new vscode.Range(startPos, endPos), hoverMessage: 'This is a KubeJS script property.',
                // renderOptions: {
                //     before: {
                //         contentIconPath: path,
                //         margin: "center",
                //         height: "16px",
                //         width: "16px"
                //     }
                // }
            };
            decorations.push(decoration);
        }

        // while ((match = this._matcherJSString.exec(text)) !== null) {
        //     const startPos = this._textEditor.document.positionAt(match.index);
        //     const endPos = this._textEditor.document.positionAt(match.index + match[0].length);
        //     // replace only the start and end single quotes to double quotes
        //     let content = match[0].replace(/(^['"])|(['"]$)/g, '"');
        //     content = JSON.parse(content);

        //     const decoration: vscode.DecorationOptions = {
        //         range: new vscode.Range(startPos, endPos),
        //         hoverMessage: `This is a string: ${content}`
        //     };
        //     decorations.push(decoration);
        // }

        this._textEditor.setDecorations(this._style, decorations);
    }
}