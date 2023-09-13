import * as vscode from 'vscode';
import { Collector } from './collectors';
import { getColors } from './colors';
import { provideDefinition, provideEventHover } from './definitions';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }
	let workspace = ws[0].uri;

	let itemAttributes = workspace.with({ path: workspace.path + "/.vscode/item-attributes.json" });
	let iconPath = workspace.with({
		path: workspace.fsPath + "/" + fs.readdirSync(workspace.fsPath).find((item) => item.startsWith("icon-exports-"))
	});
	console.log(iconPath);
	let fluidAttributes = workspace.with({ path: workspace.path + "/.vscode/fluid-attributes.json" });
	let tagsPath = workspace.with({ path: workspace.path + "/.vscode/item-tag-attributes.json" });
	let langPath = workspace.with({ path: workspace.path + "/.vscode/lang-keys.json" });
	let groupsPath = workspace.with({ path: workspace.path + "/local/kubejs/event_groups" });

	const collector = new Collector();
	let collected = true;
	collector.collectIcons(iconPath);
	collected &&= collector.collectItem(itemAttributes);
	collected &&= collector.collectFluid(fluidAttributes);
	collected &&= collector.collectTag(tagsPath);
	collected &&= collector.collectLangKeys(langPath);

	collector.buildCompletions(workspace);

	// Should cover all languages that are used in the Minecraft modpack development
	let languages = ["javascript", "json", "zenscript", "plaintext", "toml", "yaml"];

	languages.forEach((lang) => {
		context.subscriptions.push(vscode.languages.registerHoverProvider(lang, {
			provideHover(document, position) {
				var range = document.getWordRangeAtPosition(position, /(["`'])((?:\\\1|(?:(?!\1)).)*)(\1)/);
				if (!range) { return undefined; }
				var word = document.getText(range);
				// strip quotes
				word = word.substring(1, word.length - 1);

				// if the word is `{number}x {item}`, remove the number and the x
				if (word.match(/^\d+x /)) {
					word = word.substring(word.indexOf(" ") + 1);
				}

				return collector.getHover(word, workspace);

			}
		}));
	});

	context.subscriptions.push(vscode.languages.registerDefinitionProvider("javascript", provideDefinition(groupsPath)));
	context.subscriptions.push(vscode.languages.registerHoverProvider("javascript", provideEventHover(groupsPath)));
	context.subscriptions.push(vscode.languages.registerColorProvider("javascript", getColors()));

	if (!collected) {
		// warn vscode user that the attributes file is not found
		vscode.window.showWarningMessage("ProbeJS: Some attribute files are not found. Things might not work.");
	}

	context.subscriptions.push(vscode.commands.registerCommand("probejs.reload", () => {
		collector.clear();
		collector.collectItem(itemAttributes);
		collector.collectFluid(fluidAttributes);
		collector.collectTag(tagsPath);
		collector.collectLangKeys(langPath);
		collector.collectIcons(iconPath);
		collector.buildCompletions(workspace);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
