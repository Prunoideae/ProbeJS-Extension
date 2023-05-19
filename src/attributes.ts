import { MarkdownString, Uri } from "vscode";

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
        return `./kubejs/probe/cache/rich/${base}/${loc}.png`;
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

    public getMarkdown(baseUri: Uri): MarkdownString {
        const md = new MarkdownString("### " + this.localized ?? this.id);
        md.baseUri = baseUri;

        md.appendMarkdown(`\n\n![Image](${this.getImagePath()})`);

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