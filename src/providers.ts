import * as vscode from "vscode";
import { FluidAttribute, ItemAttribute, LanguageAttribute, TagAttribute } from "./attributes";

export function provideItem(
    item: ItemAttribute,
    uri: vscode.Uri,
): vscode.CompletionItem {
    return {
        label: {
            label: (item.localized ?? item.id),
            // detail: " " + item.id, // Removed due to a bit too crowded
            description: item.getSimpleDesc(),
        },
        documentation: item.getMarkdown(uri, new Map<string, string>()),
        insertText: `"${item.id}"`,
    };
}

export function provideItemHover(
    item: ItemAttribute,
    uri: vscode.Uri,
    itemIconMap: Map<string, string>,
): vscode.Hover {
    return new vscode.Hover(item.getMarkdown(uri, itemIconMap));
}

export function provideFluid(
    fluid: FluidAttribute,
    uri: vscode.Uri,
    fluidIconMap: Map<string, string>,
    itemIconMap: Map<string, string>,
): vscode.Hover {
    return new vscode.Hover(fluid.getMarkdown(uri, fluidIconMap, itemIconMap));
}

export function provideTag(
    tag: TagAttribute,
    uri: vscode.Uri,
    itemIconMap: Map<string, string>,
): vscode.Hover {
    return new vscode.Hover(tag.getMarkdown(uri, itemIconMap));
}

export function provideLangKey(
    langkey: LanguageAttribute,
): vscode.Hover {
    return new vscode.Hover(langkey.getMarkdown());
}