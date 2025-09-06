
import * as vscode from 'vscode';

// { text: "Such vein should be located in Z > 1400..." } or {italic: true, text:"Some text", color: "red"}
const componentTypeMatcher = /\{\s*([^}]*?)text:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*([^}]*?)\s*\}/gs;
// Component.of("Such vein should be located in Z > 1400...")
const componentOfMatcher = /Component\.of\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;
// Text.of("Such vein should be located in Z > 1400...")
const textOfMatcher = /Text\.of\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;

function randomLangKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `probejs.langkey.${result}`;
}

export async function extractTranslationKey() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active text editor found.");
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    if (!text) {
        vscode.window.showErrorMessage("No text selected.");
        return;
    }

    let keyTextMap = new Map<string, string>();
    // Replace {text:"Some text"} patterns with {translate: key}
    let modifiedText = text.replace(componentTypeMatcher, (match, beforeText, textContent, afterText) => {
        const key = randomLangKey();
        const cleanText = textContent.slice(1, -1); // Remove quotes
        keyTextMap.set(key, cleanText);

        // Reconstruct the object with translate instead of text
        const before = beforeText.trim();
        const after = afterText.trim();

        let result = '{';
        if (before) {
            // Remove trailing comma if it exists
            const cleanBefore = before.endsWith(',') ? before.slice(0, -1) : before;
            result += ` ${cleanBefore},`;
        }
        result += ` translate: \`${key}\``;
        if (after) {
            // Add leading comma if afterText doesn't start with one and isn't empty
            const cleanAfter = after.startsWith(',') ? after : (after ? `, ${after}` : '');
            result += cleanAfter;
        }
        result += ' }';

        return result;
    });
    // Replace Component.of("Some text") patterns with Component.translate(key)
    modifiedText = modifiedText.replace(componentOfMatcher, (match, textContent) => {
        const key = randomLangKey();
        const cleanText = textContent.slice(1, -1); // Remove quotes
        keyTextMap.set(key, cleanText);
        return `Component.translate(\`${key}\`)`;
    });

    // Replace Text.of("Some text") patterns with Text.translate(key)
    modifiedText = modifiedText.replace(textOfMatcher, (match, textContent) => {
        const key = randomLangKey();
        const cleanText = textContent.slice(1, -1); // Remove quotes
        keyTextMap.set(key, cleanText);
        return `Text.translate(\`${key}\`)`;
    });

    // Replace the selected text with the modified version
    await editor.edit(editBuilder => {
        editBuilder.replace(selection, modifiedText);
    });

    // Copy key-text mappings to clipboard
    if (keyTextMap.size > 0) {
        const clipboardContent = Array.from(keyTextMap.entries())
            .map(([key, text]) => `"${key}": "${text}"`)
            .join(',\n');

        await vscode.env.clipboard.writeText(clipboardContent);
        vscode.window.showInformationMessage(`Copied ${keyTextMap.size} translation key(s) to clipboard.`);
    }
}