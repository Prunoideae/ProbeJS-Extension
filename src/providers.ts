import * as vscode from "vscode";
import { ItemAttribute, TagAttribute } from "./attributes";

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
        documentation: item.getMarkdown(uri),
        insertText: `"${item.id}"`,
    };
}

export function provideHover(
    item: ItemAttribute,
    uri: vscode.Uri,
): vscode.Hover {
    return new vscode.Hover(item.getMarkdown(uri));
}

export function provideTag(
    tag: TagAttribute,
    uri: vscode.Uri,
): vscode.Hover {
    return new vscode.Hover(tag.getMarkdown(uri));
}