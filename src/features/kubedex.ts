import * as vscode from 'vscode';
import { ProbeWebClient } from "../probe";
import { BlockHighlight, EntityHighlight, ItemHighlight } from '../payload/kubedex';

export class KubedexHandler {
    private _currentEditIndex = 0;
    /**
     * Cached string content at each selection index so we can detect
     * user-initiated selection changes without relying on the selection-changed
     * event (which also fires for our own edits).  undefined means the selection
     * is not inside a string literal and should be skipped during cycling.
     */
    private _cachedContent: (string | undefined)[] = [];

    constructor(private readonly client: ProbeWebClient) {
        this.client.listenKubedex('server/highlight/items', async (payload) => this.handleItem(payload));
        this.client.listenKubedex('server/highlight/block', async (payload) => this.handleBlock(payload));
        this.client.listenKubedex('server/highlight/entity', async (payload) => this.handleEntity(payload));
    }

    public async handleItem(payload: ItemHighlight) {
        const itemStrings = payload.items.map(({ item, component_string: component }) => {
            const countPart = item.count > 1 ? `${item.count}x ` : "";
            return countPart + (component ? `${item.id}${component}` : item.id);
        });
        const currentEditor = vscode.window.activeTextEditor;
        if (!currentEditor) { return; }

        if (await this._tryReplaceString(currentEditor, itemStrings)) { return; }
        if (this._tryInsertComment(currentEditor, itemStrings)) { return; }
        this._insertLiteral(currentEditor, itemStrings);
    }

    /**
     * If any cursor sits inside a JS string, replace that string's content with
     * the corresponding item.  Multiple cursors cycle through the items in order.
     * Returns true when at least one replacement happened, false otherwise.
     */
    private async _tryReplaceString(
        editor: vscode.TextEditor,
        itemStrings: string[],
    ): Promise<boolean> {
        const selections = editor.selections;

        // Detect user-initiated selection changes by comparing current string
        // content against our cache.  If anything differs the user moved —
        // rebuild the cache and reset the cycling index.  Our own edits update
        // the cache in-place so they won't trigger a spurious reset.
        if (selections.length !== this._cachedContent.length) {
            this._rebuildCache(editor, selections);
            this._currentEditIndex = 0;
        } else {
            for (let i = 0; i < selections.length; i++) {
                if (this._getStringAtSelection(editor, selections[i]) !== this._cachedContent[i]) {
                    this._rebuildCache(editor, selections);
                    this._currentEditIndex = 0;
                    break;
                }
            }
        }

        // Collect replacements, cycling through selections via _currentEditIndex.
        // Selections whose cached content is undefined (not inside a string)
        // are skipped *without* consuming an item from itemStrings so items
        // always land on actual string positions.
        const replacements: { range: vscode.Range; item: string; cacheIdx: number }[] = [];
        for (const item of itemStrings) {
            // Fast-forward past any selection that isn't inside a string
            while (this._currentEditIndex < selections.length && this._cachedContent[this._currentEditIndex] === undefined) {
                this._currentEditIndex++;
            }
            if (this._currentEditIndex >= selections.length) { break; }

            const idx = this._currentEditIndex;
            const sel = selections[idx];
            const lineText = editor.document.lineAt(sel.active.line).text;
            const enclosing = findEnclosingString(lineText, sel.active.character);
            if (enclosing) {
                const range = new vscode.Range(
                    sel.active.line, enclosing.start,
                    sel.active.line, enclosing.end,
                );
                replacements.push({ range, item, cacheIdx: idx });
            }
            this._currentEditIndex++;
        }

        let didReplace = false;
        if (replacements.length > 0) {
            await editor.edit(editBuilder => {
                for (const { range, item } of replacements) {
                    editBuilder.replace(range, item);
                }
            });
            // Update cache with the new values so the next call doesn't
            // interpret our own edits as a user-initiated change.
            for (const { item, cacheIdx } of replacements) {
                this._cachedContent[cacheIdx] = item;
            }
            didReplace = true;
        }

        if (this._currentEditIndex >= selections.length) {
            this._currentEditIndex = 0;
        }

        return didReplace;
    }

    /** Rebuild the entire content cache from the current editor selections. */
    private _rebuildCache(editor: vscode.TextEditor, selections: readonly vscode.Selection[]): void {
        this._cachedContent = selections.map(s => this._getStringAtSelection(editor, s));
    }

    /** Return the string content at a selection, or undefined if not inside a string literal. */
    private _getStringAtSelection(editor: vscode.TextEditor, sel: vscode.Selection): string | undefined {
        const lineText = editor.document.lineAt(sel.active.line).text;
        const enclosing = findEnclosingString(lineText, sel.active.character);
        return enclosing ? lineText.substring(enclosing.start, enclosing.end) : undefined;
    }

    /**
     * If the active line contains a // comment and the cursor is on or after it,
     * insert the items as additional comment lines (the first item continues the
     * current line).  Returns true when the comment path was taken.
     */
    private _tryInsertComment(
        editor: vscode.TextEditor,
        itemStrings: string[],
    ): boolean {
        const line = editor.document.lineAt(editor.selection.active.line);
        const commentIndex = line.text.indexOf("//");
        if (commentIndex === -1 || editor.selection.active.character < commentIndex) {
            return false;
        }

        const afterComment = line.text.substring(commentIndex + 2, editor.selection.active.character);
        const wsMatch = /^(\s*)/.exec(afterComment);
        const spacing = (wsMatch && wsMatch[1]) ? wsMatch[1] : " ";
        const needsLeadingSpace = afterComment === "" || !/\s$/.test(afterComment);

        const commentText = itemStrings.map((s, i) => {
            if (i === 0) { return needsLeadingSpace ? spacing + s : s; }
            return `//${spacing}${s}`;
        }).join("\n");

        editor.insertSnippet(new vscode.SnippetString(commentText + "\n"));
        return true;
    }

    /**
     * Fallback: insert the item string(s) as a JSON literal.  If the cursor is
     * inside parentheses and nothing but the closing paren follows, a trailing
     * ", " is appended so the user can keep adding arguments.
     */
    private _insertLiteral(
        editor: vscode.TextEditor,
        itemStrings: string[],
    ): void {
        const lineText = editor.document.lineAt(editor.selection.active.line).text;
        const textBefore = lineText.substring(0, editor.selection.active.character);
        const textAfter = lineText.substring(editor.selection.active.character);
        const openParens = (textBefore.match(/\(/g) || []).length;
        const closeParens = (textBefore.match(/\)/g) || []).length;
        let suffix = "";
        if (openParens > closeParens) {
            const nextChar = textAfter.match(/^\s*(.)/)?.[1] ?? "";
            if (nextChar === ")") {
                suffix = ", ";
            }
        }

        if (itemStrings.length === 1) {
            editor.insertSnippet(new vscode.SnippetString(JSON.stringify(itemStrings[0]) + suffix));
        } else {
            editor.insertSnippet(new vscode.SnippetString(JSON.stringify(itemStrings) + suffix));
        }
    }

    public async handleBlock(payload: BlockHighlight) {

    }

    public async handleEntity(payload: EntityHighlight) {

    }
}

/**
 * Find the string literal enclosing the given column position on a line.
 * Supports double-quoted, single-quoted, and backtick strings.
 * Handles escaped quotes with backslashes.
 * Returns the start/end indices of the string *content* (excluding quotes),
 * or null if the cursor is not inside a string.
 */
function findEnclosingString(line: string, cursorCol: number): { start: number; end: number } | null {
    const quoteChars = ['"', "'", '`'];
    for (const q of quoteChars) {
        let i = 0;
        while (i < line.length) {
            i = line.indexOf(q, i);
            if (i === -1 || i >= cursorCol) { break; }

            // scan for the matching closing quote
            let j = i + 1;
            while (j < line.length) {
                if (line[j] === '\\') {
                    j += 2; // skip escaped character
                    continue;
                }
                if (line[j] === q) { break; }
                j++;
            }

            // cursor inside this pair?
            if (j < line.length && cursorCol > i && cursorCol < j) {
                return { start: i + 1, end: j }; // content between quotes
            }

            i = j + 1; // continue after closing quote
        }
    }
    return null;
}