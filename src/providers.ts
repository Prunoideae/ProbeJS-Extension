import * as vscode from "vscode";
import { ItemAttribute } from "./attributes";

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