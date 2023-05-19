import * as vscode from 'vscode';
import { Collector } from './collectors';

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }
	let workspace = ws[0].uri;

	let attributesPath = workspace.with({ path: workspace.path + "/.vscode/item-attributes.json" });
	const collector = new Collector();
	collector.collect(attributesPath);

	collector.buildCompletions(workspace);
	const provider: vscode.CompletionItemProvider = {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			return collector.getItemCompletions();
		}
	};

	// Should cover all languages that are used in the Minecraft modpack development
	let languages = ["javascript", "json", "zenscript", "plaintext", "toml", "yaml"];
	languages.forEach((lang) => {
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: lang }, provider));
	});

	context.subscriptions.push(vscode.commands.registerCommand("probejs.reload", () => {
		collector.clear();
		collector.collect(attributesPath);
		collector.buildCompletions(workspace);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
