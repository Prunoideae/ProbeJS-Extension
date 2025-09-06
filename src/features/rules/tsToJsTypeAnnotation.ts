// Converts TypeScript type annotations to JavaScript type annotations.
// Matches TypeScript type annotations like:
// ```ts
// let myVar: MyType = ...;
// ```
// Converts them to JavaScript type annotations like:
// ```js
// /** @type {MyType} */
// let myVar = ...;

// Provides code actions to do so. Match the type annotation using regex, and then
// replace it with the JavaScript type annotation format.

// Also search for available Java.loadClass in the text and fix the type annotations, like:
// ```js
// let $Predicate = Java.loadClass("java.util.function.Predicate");
//
// let var: $Predicate = ...;
// ```

// Converts it to:
// ```js
// /** @type {typeof import("java.util.function.Predicate").$Predicate} */
// let $Predicate = Java.loadClass("java.util.function.Predicate");
//
// //** @type {import("java.util.function.Predicate").$Predicate} */
// let var = ...;
// ```

import * as vscode from 'vscode';

export function registerConversion(context: vscode.ExtensionContext) {
    const provider = new TsToJsTypeAnnotationProvider();
    const disposable = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript'], provider,
        { providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite] }
    );
    context.subscriptions.push(disposable);
}

class TsToJsTypeAnnotationProvider implements vscode.CodeActionProvider {
    // Regex to match TypeScript type annotations
    // Matches patterns like: variableName: Type, functionParam: Type, etc.
    // Improved to handle generic types, arrays, and union types better
    private readonly typeAnnotationRegex = /(\w+)\s*:\s*([^=,;)\]}\n]+?)(?=\s*[=,;)\]}\n]|$)/g;

    // Regex to match Java.loadClass statements
    // Matches patterns like: let $Predicate = Java.loadClass("java.util.function.Predicate");
    // Also handles: const $Predicate = Java.loadClass('java.util.function.Predicate')
    private readonly javaLoadClassRegex = /(?:let|const|var)\s+(\$\w+)\s*=\s*Java\.loadClass\s*\(\s*["']([^"']+)["']\s*\)/g;

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        // Get the text in the current line or selection
        const text = document.getText(range);
        const lineText = document.lineAt(range.start.line).text;

        // Check if we're in a TypeScript file or if the line contains TypeScript syntax
        if (this.hasTypeAnnotation(lineText)) {
            const action = this.createConversionAction(document, range);
            if (action) {
                actions.push(action);
            }
        }

        return actions;
    }

    private hasTypeAnnotation(text: string): boolean {
        // Reset regex lastIndex to avoid issues with global flag
        this.typeAnnotationRegex.lastIndex = 0;
        return this.typeAnnotationRegex.test(text);
    }

    private createConversionAction(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection
    ): vscode.CodeAction | undefined {
        const line = document.lineAt(range.start.line);
        const lineText = line.text;

        // Reset regex lastIndex
        this.typeAnnotationRegex.lastIndex = 0;
        const matches = Array.from(lineText.matchAll(this.typeAnnotationRegex));

        if (matches.length === 0) {
            return undefined;
        }

        // Scan the entire document for Java.loadClass statements
        const javaClassMap = this.scanForJavaClasses(document);

        // Determine action title based on whether Java classes are involved
        const hasJavaTypes = matches.some(match => {
            const typeName = match[2].trim();
            return javaClassMap.has(typeName);
        });

        const actionTitle = hasJavaTypes
            ? 'Convert TypeScript type annotations to JSDoc (with Java imports)'
            : 'Convert TypeScript type annotations to JSDoc';

        const action = new vscode.CodeAction(actionTitle, vscode.CodeActionKind.RefactorRewrite);
        const edit = new vscode.WorkspaceEdit();

        // Check if this line itself contains a Java.loadClass statement
        const isJavaLoadClassLine = this.isJavaLoadClassStatement(lineText);

        // Process each type annotation in the line
        let convertedLine = lineText;
        let offset = 0;

        for (const match of matches) {
            const fullMatch = match[0];
            const variableName = match[1];
            const typeName = match[2].trim();

            // Find the position of this match in the line
            const matchStart = lineText.indexOf(fullMatch, offset);
            if (matchStart === -1) {
                continue;
            }

            // Remove the type annotation from the variable declaration
            const typePattern = new RegExp(`:\\s*${typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
            const withoutTypeAnnotation = fullMatch.replace(typePattern, '');

            // Replace in the converted line
            convertedLine = convertedLine.replace(fullMatch, withoutTypeAnnotation);

            // Update offset for next match
            offset = matchStart + fullMatch.length;
        }

        // If we found conversions, apply them
        if (convertedLine !== lineText) {
            // Generate JSDoc comments with proper Java import handling
            const jsDocComments = this.extractJsDocComments(lineText, matches, javaClassMap, isJavaLoadClassLine);

            // Insert JSDoc comments above the current line
            const insertPosition = new vscode.Position(line.lineNumber, 0);
            edit.insert(document.uri, insertPosition, jsDocComments);

            // Replace the current line with the version without type annotations
            const lineRange = new vscode.Range(
                line.lineNumber, 0,
                line.lineNumber, line.text.length
            );
            edit.replace(document.uri, lineRange, convertedLine);
        }

        action.edit = edit;
        return action;
    }

    private getLeadingWhitespace(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    private extractJsDocComments(
        lineText: string,
        matches: RegExpMatchArray[],
        javaClassMap: Map<string, string>,
        isJavaLoadClassLine: boolean
    ): string {
        const leadingWhitespace = this.getLeadingWhitespace(lineText);
        let jsDocComments = '';

        // Create a JSDoc comment for each unique type found
        const uniqueTypes = new Set<string>();

        for (const match of matches) {
            const variableName = match[1];
            const typeName = match[2].trim();

            if (!uniqueTypes.has(typeName)) {
                uniqueTypes.add(typeName);

                // Check if this is a Java class type
                const javaClassName = javaClassMap.get(typeName);

                if (javaClassName) {
                    if (isJavaLoadClassLine && this.isVariableInJavaLoadClass(lineText, variableName)) {
                        // This is the Java.loadClass declaration line itself
                        jsDocComments += `${leadingWhitespace}/** @type {typeof import("${javaClassName}").${typeName}} */\n`;
                    } else {
                        // This is usage of a Java class variable
                        jsDocComments += `${leadingWhitespace}/** @type {import("${javaClassName}").${typeName}} */\n`;
                    }
                } else {
                    // Regular type annotation
                    jsDocComments += `${leadingWhitespace}/** @type {${typeName}} */\n`;
                }
            }
        }

        return jsDocComments;
    }

    /**
     * Scans the entire document for Java.loadClass statements and creates a mapping
     * of variable names to Java class names
     */
    private scanForJavaClasses(document: vscode.TextDocument): Map<string, string> {
        const javaClassMap = new Map<string, string>();
        const documentText = document.getText();

        // Reset regex lastIndex
        this.javaLoadClassRegex.lastIndex = 0;

        console.log(`Scanning document for Java.loadClass statements...`);
        let match;
        while ((match = this.javaLoadClassRegex.exec(documentText)) !== null) {
            const variableName = match[1];
            const javaClassName = match[2];
            javaClassMap.set(variableName, javaClassName);
            console.log(`Found Java.loadClass: ${variableName} = ${javaClassName}`);
        }

        return javaClassMap;
    }

    /**
     * Checks if the given line contains a Java.loadClass statement
     */
    private isJavaLoadClassStatement(lineText: string): boolean {
        this.javaLoadClassRegex.lastIndex = 0;
        return this.javaLoadClassRegex.test(lineText);
    }

    /**
     * Checks if the given variable name is being declared in a Java.loadClass statement on this line
     */
    private isVariableInJavaLoadClass(lineText: string, variableName: string): boolean {
        this.javaLoadClassRegex.lastIndex = 0;
        const match = this.javaLoadClassRegex.exec(lineText);
        return match !== null && match[1] === variableName;
    }
}