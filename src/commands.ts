import * as vscode from 'vscode';
import { Collector } from './collectors';


export function reloadAll(collector: Collector,
    item: vscode.Uri,
    fluid: vscode.Uri,
    tag: vscode.Uri,
    lang: vscode.Uri,
    icon: vscode.Uri,
    workspace: vscode.Uri
): vscode.Disposable {
    return vscode.commands.registerCommand("probejs.reload", () => {
        collector.clear();
        collector.collectItem(item);
        collector.collectFluid(fluid);
        collector.collectTag(tag);
        collector.collectLangKeys(lang);
        collector.collectIcons(icon);
        collector.buildCompletions(workspace);
    });
}

export function populateLang(collector: Collector): vscode.Disposable {
    return vscode.commands.registerCommand("probejs.populateLang", async () => {
        let text = vscode.window.activeTextEditor;
        let filterString = await vscode.window.showInputBox({
            placeHolder: "Filter",
            prompt: "Only populate keys that contain this string, or leave blank to populate all keys."
        });
        if (!filterString) { filterString = undefined; }

        if (!text) { return; }
        let snippet = new vscode.SnippetString();
        collector.getLangs()
            .filter(lang => lang.languages[lang.selected] === lang.key && lang.key.includes('.') && !lang.key.includes(' '))
            .filter(lang => !filterString || lang.key.includes(filterString))
            .forEach((lang, index, arr) => {
                snippet.appendText(`"${lang.key}": "`);
                snippet.appendTabstop();
                snippet.appendText(index === arr.length - 1 ? '"' : '",\n');
            });
        text.insertSnippet(snippet);
    });
}