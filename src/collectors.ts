import * as vscode from "vscode";
import { Uri } from "vscode";
import { ItemAttribute } from "./attributes";
import * as fs from "fs";
import { provideItem } from "./providers";

export class Collector {
    private items: ItemAttribute[];

    private itemCompletions: vscode.CompletionItem[];

    constructor() {
        this.items = [];
        this.itemCompletions = [];
    }

    /**
     * Collects all items attributes from the given file
     * 
     * @param uri {Uri} Path to the file
     */
    public collect(uri: Uri) {
        let fsPath = uri.fsPath;
        if (!fs.existsSync(fsPath)) { return; }
        let data = fs.readFileSync(fsPath);
        let array = JSON.parse(data.toString()) as ItemAttribute[];
        array = array.map((item) => Object.assign(new ItemAttribute(), item));
        this.items.push(...array);
    }

    public clear() {
        this.itemCompletions.length = 0;
        this.items.length = 0;
    }

    public getItems(): ItemAttribute[] {
        return this.items;
    }

    public getItemCompletions(): vscode.CompletionItem[] {
        return this.itemCompletions;
    }

    public buildCompletions(workspace: Uri) {
        this.itemCompletions = this.items.map((item) => provideItem(item, workspace.with({ path: workspace.path + "/" })));
    }

}