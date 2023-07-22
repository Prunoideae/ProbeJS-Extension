import * as vscode from "vscode";
import { Uri } from "vscode";
import { FluidAttribute, ItemAttribute, LanguageAttribute, TagAttribute } from "./attributes";
import * as fs from "fs";
import { provideFluid, provideItem, provideItemHover, provideLangKey, provideTag } from "./providers";

export class Collector {
    private items: ItemAttribute[];

    private itemTags: TagAttribute[];

    private fluids: FluidAttribute[];

    private itemCompletions: vscode.CompletionItem[];

    private langKeys: LanguageAttribute[];

    private itemHover: Map<string, vscode.Hover>;
    private fluidHover: Map<string, vscode.Hover>;
    private langHover: Map<string, vscode.Hover>;

    constructor() {
        this.items = [];
        this.itemTags = [];
        this.itemCompletions = [];
        this.fluids = [];
        this.langKeys = [];
        this.itemHover = new Map();
        this.fluidHover = new Map();
        this.langHover = new Map();
    }

    /**
     * Collects all items attributes from the given file
     * 
     * @param uri {Uri} Path to the file
     * @returns {boolean} Whether the file exists
     */
    public collectItem(uri: Uri): boolean {
        let fsPath = uri.fsPath;
        if (!fs.existsSync(fsPath)) { return false; }
        let data = fs.readFileSync(fsPath);
        let array = JSON.parse(data.toString()) as ItemAttribute[];
        array = array.map((item) => Object.assign(new ItemAttribute(), item));
        this.items.push(...array);
        return true;
    }

    /**
     * Collects all fluids attributes from the given file
     * 
     * @param uri {Uri} Path to the file
     * @returns {boolean} If the file exists
     */
    public collectFluid(uri: Uri): boolean {
        let fsPath = uri.fsPath;
        if (!fs.existsSync(fsPath)) { return false; }
        let data = fs.readFileSync(fsPath);
        let array = JSON.parse(data.toString()) as FluidAttribute[];
        array = array.map((item) => Object.assign(new FluidAttribute(), item));
        this.fluids.push(...array);
        return true;
    }

    public collectTag(uri: Uri): boolean {
        let fsPath = uri.fsPath;
        if (!fs.existsSync(fsPath)) { return false; }
        let data = fs.readFileSync(fsPath);
        let array = JSON.parse(data.toString()) as TagAttribute[];
        array = array.map((item) => Object.assign(new TagAttribute(), item));
        this.itemTags.push(...array);
        return true;
    }

    public collectLangKeys(uri: Uri): boolean {
        let fsPath = uri.fsPath;
        if (!fs.existsSync(fsPath)) { return false; }
        let data = fs.readFileSync(fsPath);
        let array = JSON.parse(data.toString()) as LanguageAttribute[];
        array = array.map((item) => Object.assign(new LanguageAttribute(), item));
        this.langKeys.push(...array);
        return true;
    }

    public clear() {
        this.itemCompletions.length = 0;
        this.items.length = 0;
        this.itemTags.length = 0;
        this.fluids.length = 0;
        this.langKeys.length = 0;
        this.fluidHover.clear();
        this.itemHover.clear();
        this.langHover.clear();
    }

    public getItems(): ItemAttribute[] {
        return this.items;
    }

    public getTags(): TagAttribute[] {
        return this.itemTags;
    }

    public getItemCompletions(): vscode.CompletionItem[] {
        return this.itemCompletions;
    }

    public buildCompletions(workspace: Uri) {
        this.itemCompletions = this.items.map((item) => provideItem(item, workspace.with({ path: workspace.path + "/" })));
    }

    public getHover(id: string, workspace: Uri): vscode.Hover | undefined {
        if (this.itemHover.size === 0) {
            this.items.forEach((item) => {
                this.itemHover.set(item.id, provideItemHover(item, workspace.with({ path: workspace.path + "/" })));
            });
            this.itemTags.forEach((tag) => {
                this.itemHover.set(`#${tag.id}`, provideTag(tag, workspace.with({ path: workspace.path + "/" })));
            });
        }

        if (this.fluidHover.size === 0) {
            this.fluids.forEach((fluid) => {
                this.fluidHover.set(fluid.id, provideFluid(fluid, workspace.with({ path: workspace.path + "/" })));
            });
        }

        if (this.langHover.size === 0) {
            this.langKeys.forEach((lang) => {
                this.langHover.set(lang.key, provideLangKey(lang));
            });
        }

        if (this.langHover.has(id)) {
            return this.langHover.get(id);
        }

        if (!id.includes(":")) {
            id = "minecraft:" + id;
        }

        if (this.itemHover.has(id)) {
            return this.itemHover.get(id);
        } else if (this.itemHover.has(`#${id}`)) {
            return this.itemHover.get(`#${id}`);
        } else if (this.fluidHover.has(id)) {
            return this.fluidHover.get(id);
        }
        return undefined;
    }
}