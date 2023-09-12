import { MarkdownString, Uri } from "vscode";
import * as fs from "fs";

type ToolType = "axe" | "hoe" | "pickaxe" | "shovel" | "sword" | "shears" | "trident" | "bow" | "crossbow" | "shield" | "armor";

export class BlockAttribute {
    crop: boolean = false;
}

export class FoodProperty {
    nutrition: number = 0;
    saturation: number = 0;
    alwaysEdible: boolean = false;
}

export class ItemAttribute {
    id!: `${string}:${string}`;
    localized?: string;

    maxDamage: number = 0;
    maxStackSize: number = 64;

    toolType?: ToolType;
    food?: FoodProperty;
    block?: BlockAttribute;

    private getImagePath(): string {
        let [base, loc] = this.id.split(":");
        loc = loc.replace("/", "_");
        let path = `./kubejs/probe/cache/rich/${base}/${loc}.png`;
        return fs.existsSync(path) ? path : `./kubejs/probe/cache/rich/item/${base}/${loc}.png`;
    }

    private getDescription(): string {
        let desc = [];

        if (this.block) {
            desc.push(this.block.crop ? "**crop**" : "**block**");
        } else if (this.toolType) {
            desc.push(`**${this.toolType}**`);
        }

        if (this.food) {
            desc.unshift(desc.length !== 0 ? "edible" : "**food**");
        }

        return desc.join(" ");
    }

    public getSimpleDesc(): string {
        if (this.block) {
            return this.block.crop ? "Crop" : "Block";
        }
        if (this.toolType) {
            return this.toolType.charAt(0).toUpperCase() + this.toolType.slice(1);
        }
        if (this.food) {
            return "Food";
        }
        return "Item";
    }

    public getMarkdown(baseUri: Uri, iconMap: Map<string, string>): MarkdownString {
        const md = new MarkdownString("### " + this.localized ?? this.id);
        md.baseUri = baseUri;

        if (iconMap !== undefined && iconMap.size !== 0) {
            if (iconMap.has(this.id)) {
                md.appendMarkdown(`\n\n![Image](${iconMap.get(this.id)})`);
            }
        } else if (fs.existsSync(baseUri.with({ path: baseUri.path + "/" + this.getImagePath() }).fsPath)) {
            md.appendMarkdown(`\n\n![Image](${this.getImagePath()})`);
        }

        if (this.getDescription()) {
            md.appendMarkdown(`\n\nThis is a ${this.getDescription()}`);
        }
        if (this.localized) {
            md.appendMarkdown(`\n\n**ID**: ${this.id}`);
        }
        md.appendMarkdown(`\n\n**Stacks To**: ${this.maxStackSize}`);
        if (this.maxDamage > 0) {
            md.appendMarkdown(`\n\n**Durability**: ${this.maxDamage}`);
        }
        if (this.food) {
            md.appendMarkdown(`\n\n**Nutrition**: ${this.food.nutrition}`);
            md.appendMarkdown(`\n\n**Saturation**: ${this.food.saturation}`);
            if (this.food.alwaysEdible) {
                md.appendMarkdown(`\n\n**Always Edible**: ${this.food.alwaysEdible}`);
            }
        }
        return md;
    }
}



export class TagAttribute {
    id!: `${string}:${string}`;
    items!: string[];

    private getImagePath(id: string): string {
        let [base, loc] = id.split(":");
        loc = loc.replace("/", "_");
        let path = `./kubejs/probe/cache/rich/${base}/${loc}.png`;
        return fs.existsSync(path) ? path : `./kubejs/probe/cache/rich/item/${base}/${loc}.png`;
    }

    private getImageMarkdowns(iconMap: Map<string, string>): string {
        let itemMds = iconMap.size !== 0 ?
            this.items.map((item) => `![Image](${iconMap.get(item)})`) :
            this.items.map((item) => `![Image](${this.getImagePath(item)})`);

        // start a new line for every 6 items, max at 12 in total
        for (let i = 6; i < itemMds.length; i += 6) {
            itemMds[i] = "\n\n" + itemMds[i];
        }
        // clamp the length to 12, add ... if there are more
        if (itemMds.length > 12) {
            itemMds.length = 12;
            itemMds.push("**...**");
        }
        return itemMds.join(" ");
    }

    public getMarkdown(baseUri: Uri, iconMap: Map<string, string>): MarkdownString {
        const md = new MarkdownString("### " + this.id);
        md.baseUri = baseUri;
        md.appendMarkdown(`\n\n${this.getImageMarkdowns(iconMap)}`);
        md.appendMarkdown(`\n\n**Count**: ${this.items.length}`);
        return md;
    }
}

export class FluidAttribute {
    id!: `${string}:${string}`;
    localized?: string;
    hasBucket?: boolean;
    hasBlock?: boolean;

    bucketItem?: `${string}:${string}`;

    private getImagePath(): string {
        let [base, loc] = this.id.split(":");
        loc = loc.replace("/", "_");
        return `./kubejs/probe/cache/rich/fluid/${base}/${loc}.png`;
    }

    private getBucketImagePath(): string {
        let [base, loc] = this.bucketItem!.split(":");
        loc = loc.replace("/", "_");
        return `./kubejs/probe/cache/rich/item/${base}/${loc}.png`;
    }

    public getMarkdown(baseUri: Uri, fluidIconMap: Map<string, string>, itemIconMap: Map<string, string>): MarkdownString {
        const md = new MarkdownString("### " + this.localized ?? this.id);
        md.baseUri = baseUri;

        if (fluidIconMap !== undefined && fluidIconMap.size !== 0) {
            if (fluidIconMap.has(this.id)) {
                md.appendMarkdown(`\n\n![Image](${fluidIconMap.get(this.id)})`);
            }
        } else if (fs.existsSync(baseUri.with({ path: baseUri.path + "/" + this.getImagePath() }).fsPath)) {
            md.appendMarkdown(`\n\n![Image](${this.getImagePath()})`);
        }

        if (this.localized) {
            md.appendMarkdown(`\n\n**ID**: ${this.id}`);
        }

        if (this.hasBlock) {
            md.appendMarkdown(`\n\nThis fluid has a **block**.`);
        }

        if (this.hasBucket) {
            md.appendMarkdown(`\n\nThis fluid has a **bucket item**:`);
            if (itemIconMap !== undefined && itemIconMap.size !== 0) {
                if (itemIconMap.has(this.bucketItem!)) {
                    md.appendMarkdown(`\n\n![Image](${itemIconMap.get(this.bucketItem!)})`);
                }
            } else if (fs.existsSync(baseUri.with({ path: baseUri.path + "/" + this.getBucketImagePath() }).fsPath)) {
                md.appendMarkdown(`\n\n![Image](${this.getBucketImagePath()})`);
            }
        }

        return md;
    }
}

export class LanguageAttribute {
    key!: string;
    selected!: string;
    languages!: { [key: string]: string };

    public getMarkdown(): MarkdownString {
        const md = new MarkdownString("", true);

        let missingTranslations = [];

        // append a table with `lang` and `translation`
        md.appendMarkdown(`| Language | Translation |\n`);
        md.appendMarkdown(`| -------- | ----------- |\n`);
        // append the selected language
        md.appendMarkdown(`| **${this.selected}** | **${this.languages[this.selected]}** |\n`);

        if (this.languages[this.selected] === this.languages['en_us']) {
            missingTranslations.push(this.selected);
        }

        // append the rest of the languages
        for (const lang in this.languages) {
            if (lang !== this.selected && lang !== "en_us") {
                if (this.languages[lang] !== this.languages['en_us']) {
                    md.appendMarkdown(`| ${lang} | ${this.languages[lang]} |\n`);
                } else {
                    missingTranslations.push(lang);
                }
            }
        }
        // append the en_us as fallback
        if (this.selected !== "en_us") {
            md.appendMarkdown(`| en_us | ${this.languages["en_us"]} |\n`);
        }

        if (missingTranslations.length > 0 && !this.selected.startsWith("en")) {
            md.appendMarkdown(`\n\n**Missing Translations: ${missingTranslations.join(", ")}**`);
        }

        return md;
    }
}