import * as vscode from 'vscode';
import { Collector } from './collectors';
import { getColors } from './colors';
import * as commands from './commands';
import { provideDefinition, provideEventHover } from './definitions';
import * as fs from 'fs';
import { Config } from './config';

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }
	let workspace = ws[0].uri;

	let itemAttributes = workspace.with({ path: workspace.path + "/.vscode/item-attributes.json" });
	let iconPath = workspace.with({
		path: workspace.fsPath + "/" + fs.readdirSync(workspace.fsPath).find((item) => item.startsWith("icon-exports-"))
	});

	let fluidAttributes = workspace.with({ path: workspace.path + "/.vscode/fluid-attributes.json" });
	let tagsPath = workspace.with({ path: workspace.path + "/.vscode/item-tag-attributes.json" });
	let langPath = workspace.with({ path: workspace.path + "/.vscode/lang-keys.json" });
	let groupsPath = workspace.with({ path: workspace.path + "/local/kubejs/event_groups" });

	let config = workspace.with({ path: workspace.path + "/kubejs/config/probejs.json" });
	let configData = Config.fromData(JSON.parse(fs.readFileSync(config.fsPath, "utf-8")));
	console.log(configData);
	if (!configData.enabled) { return; }

	if (configData.isInteractiveValid()) {
		if (configData.interactiveMode === 0) {
			configData.interactiveMode = 1;
			vscode.window.showInformationMessage("ProbeJS: Interactive mode is enabled. You can now use the REPL after reloading game.");
			fs.writeFileSync(config.fsPath, JSON.stringify(configData.overwrite(JSON.parse(fs.readFileSync(config.fsPath, "utf-8"))), null, 4));
		}

		// won't start if mode is not 1 e.g. manually disabled
		if (configData.interactiveMode === 1) {
			context.subscriptions.push(
				commands.createRepl(context, configData.port)
			);
		}
	}

	// TODO: Read config to get the ws server status and port
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

	if (collected) {
		context.subscriptions.push(
			vscode.workspace.createFileSystemWatcher(workspace.fsPath + "/.vscode/*").onDidChange(() => {
				vscode.commands.executeCommand("probejs.reload");
			}));
	}

	context.subscriptions.push(
		commands.reloadAll(
			collector,
			itemAttributes, fluidAttributes,
			tagsPath, langPath, iconPath,
			workspace
		));

	context.subscriptions.push(
		commands.populateLang(collector)
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
