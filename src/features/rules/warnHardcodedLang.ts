import * as vscode from 'vscode';

export function warnHardcodedLang(context: vscode.ExtensionContext) {
    const collection = vscode.languages.createDiagnosticCollection("probejs.hardcodedLang");
    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document, collection);
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'javascript' || event.document.languageId === 'json') {
                updateDiagnostics(event.document, collection);
            }
        })
    );
}


// Regular expressions to match hardcoded language keys
const componentTypeMatcher = /\{\s*([^}]*?)text:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*([^}]*?)\s*\}/gs;
const componentOfMatcher = /Component\.of\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;
const textOfMatcher = /Text\.of\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;

function _addDiagnostics(
    regex: RegExp,
    text: string,
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
) {
    let match;
    while ((match = regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        
        const diagnostic = new vscode.Diagnostic(
            range,
            'Use of hardcoded text function. Consider using language keys instead.',
            vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'ProbeJS';
        diagnostics.push(diagnostic);
    }
    // Reset regex state
    regex.lastIndex = 0;
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    
    // Check all patterns for hardcoded text
    const patterns = [componentTypeMatcher, componentOfMatcher, textOfMatcher];
    patterns.forEach(pattern => {
        _addDiagnostics(pattern, text, document, diagnostics);
    });
    
    collection.set(document.uri, diagnostics);
}