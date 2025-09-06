import * as vscode from 'vscode';
import * as utils from '../../utils';
import { ProbeImages } from './imageClient';
import { ProbeWebClient } from '../../probe';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

    // Matches a string that is a resource location e.g. "modid:item_name" or 'modid:item_name' or `modid:item_name` (a-z0-9, _, :, /)
    private readonly _matcherRL = /(["'`])([a-z0-9_:/]+)\1/g;

    // Matches a langkey, e.g. "kubejs.langkey.something" (a-zA-Z0-9, _, .)
    private readonly _matcherLangKey = /(["'`])([a-zA-Z0-9_.]+)\1/g;

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

    // We insert icon here, so no need to decorate the string with different style
    private readonly _styleRLString = vscode.window.createTextEditorDecorationType({});

    private _textEditor: vscode.TextEditor | undefined;
    private _cachedImages: Map<string, vscode.Uri | null> = new Map();
    private _setup = false;
    private _langKeys: Map<string, string> = new Map();
    private readonly _client: ProbeWebClient;

    constructor(private readonly images: ProbeImages) {
        this._client = images.client;
    }

    public set editor(editor: vscode.TextEditor) {
        this._textEditor = editor;
        this._langKeys.clear();
    }

    public clearCache() {
        this._cachedImages.clear();
        this._langKeys.clear();
    }

    public async setupDecoration(): Promise<vscode.Disposable> {
        if (vscode.window.activeTextEditor) {
            this.editor = vscode.window.activeTextEditor;
            await this.decorate();
        }

        if (this._setup) {
            return new vscode.Disposable(() => { });
        }
        this._setup = true;
        let changeWindow = vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (editor) {
                this.editor = editor;
                await this.decorate();
            }
        });
        let changeText = vscode.workspace.onDidChangeTextDocument(async event => {
            if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                await this.decorate();
            }
        });

        return new vscode.Disposable(() => {
            changeWindow.dispose();
            changeText.dispose();
        });
    }

    private async guessImageBase64(content: string): Promise<vscode.Uri | null> {
        if (this._cachedImages.has(content)) {
            return this._cachedImages.get(content)!;
        }

        let parsed, uri;
        if ((parsed = utils.parseItemString(content))) {
            uri = await this.images?.getItemImage(parsed.id, parsed.components);
            if (!uri) { uri = await this.images?.getFluidImage(parsed.id, parsed.components); }
            if (!uri) {
                let blockProperties = parsed.components ? utils.parseBlockState(parsed.components) : new Map();
                uri = await this.images?.getBlockIamge(parsed.id, blockProperties);
            }
        } else if (parsed = utils.parseItemTag(content)) {
            uri = await this.images?.getItemTagImage(parsed[0], parsed[1]);
            if (!uri) { uri = await this.images?.getFluidTagImage(parsed[0], parsed[1]); }
            if (!uri) { uri = await this.images?.getBlockTagImage(parsed[0], parsed[1]); }
        }

        if (uri === undefined) {
            uri = null;
        }
        this._cachedImages.set(content, uri);
        return uri;
    }

    public async decorate() {
        if (!this._textEditor) {
            return;
        }
        const text = this._textEditor.document.getText();
        const decorations: vscode.DecorationOptions[] = [];
        const stringDecorations: vscode.DecorationOptions[] = [];

        if (this._textEditor.document.fileName.endsWith('.d.ts')) {
            return;
        }

        let match;
        while ((match = this._matcher.exec(text)) !== null) {
            const startPos = this._textEditor.document.positionAt(match.index);
            const endPos = this._textEditor.document.positionAt(match.index + match[0].length);

            const decoration: vscode.DecorationOptions = {
                range: new vscode.Range(startPos, endPos),
                hoverMessage: 'This is a KubeJS script property.',
            };
            decorations.push(decoration);
        }

        while ((match = this._matcherRL.exec(text)) !== null) {
            const startPos = this._textEditor.document.positionAt(match.index);
            const endPos = this._textEditor.document.positionAt(match.index + match[0].length);

            let content = match[0];
            if (content.startsWith("'")) {
                // escape double quotes since it won't be escaped in single quotes
                content = content.replace(/"/g, '\\"');
            }
            if (content.startsWith("`")) {
                // escape double quotes since they won't be escaped in backticks
                content = content.replace(/"/g, '\\"');
            }
            // replace only the start and end quotes (single, double, or backtick) to double quotes
            content = content.replace(/(^['"`])|(['"`]$)/g, '"');
            content = JSON.parse(content);

            if (!content.includes(":")) {
                continue;
            }
            let imageUri = await this.guessImageBase64(content);

            if (!imageUri) {
                continue;
            }

            // get the image from the server to check if it exists
            const decoration: vscode.DecorationOptions = {
                range: new vscode.Range(startPos, endPos),
                renderOptions: {
                    before: {
                        contentIconPath: imageUri,
                        height: '16px',
                        width: '16px',

                    }
                }
            };
            stringDecorations.push(decoration);
        }

        if (this._langKeys.size === 0) {
            let langKeys = (await this._client.get<{ [key: string]: string }>("/api/probejs/lang-keys"))?.data;
            if (langKeys) {
                for (const [key, value] of Object.entries(langKeys)) {
                    this._langKeys.set(key, value);
                }
            }
        }

        while ((match = this._matcherLangKey.exec(text)) !== null) {
            const startPos = this._textEditor.document.positionAt(match.index);
            const endPos = this._textEditor.document.positionAt(match.index + match[0].length);

            let content = match[0];
            if (content.startsWith("'")) {
                content = content.replace(/"/g, '\\"');
            }
            if (content.startsWith("`")) {
                content = content.replace(/"/g, '\\"');
            }
            content = content.replace(/(^['"`])|(['"`]$)/g, '"');
            content = JSON.parse(content);

            if (this._langKeys.has(content)) {
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(startPos, endPos),
                    hoverMessage: this._langKeys.get(content),
                };
                decorations.push(decoration);
            }
        }

        this._textEditor.setDecorations(this._style, decorations);
        this._textEditor.setDecorations(this._styleRLString, stringDecorations);
    }
}