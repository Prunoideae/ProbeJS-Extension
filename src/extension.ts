import * as vscode from 'vscode';
import { Collector } from './collectors';
import { getAppropriateNearestColor, matchColor, matchDirect, matchOf, matchPredefined, matchRGBA } from './colors';

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }
	let workspace = ws[0].uri;

	let itemAttributes = workspace.with({ path: workspace.path + "/.vscode/item-attributes.json" });
	let fluidAttributes = workspace.with({ path: workspace.path + "/.vscode/fluid-attributes.json" });
	let tagsPath = workspace.with({ path: workspace.path + "/.vscode/item-tag-attributes.json" });
	let langPath = workspace.with({ path: workspace.path + "/.vscode/lang-keys.json" });

	const collector = new Collector();
	let collected = true;
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

	context.subscriptions.push(vscode.languages.registerColorProvider("javascript", {
		provideColorPresentations(color, context, token) {
			// get selected text
			let text = context.document.getText(context.range);
			let formatted = undefined;

			if (text.startsWith("Color.rgba")) {
				// color to 0-255
				let r = Math.round(color.red * 255);
				let g = Math.round(color.green * 255);
				let b = Math.round(color.blue * 255);
				let a = Math.round(color.alpha * 255);

				formatted = `Color.rgba(${r}, ${g}, ${b}, ${a})`;
			} else if (text.startsWith("Color.of")) {
				// find text is hex or int by checking if it starts with `#`, hex can be 6 or 8 digits
				let isHex = text.match(/#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}/);
				// extract the quotes from `text`
				let quote = text.substring(9, 10);
				if (isHex) {
					// check if it is 6 or 8 digits
					let hex = isHex[0].substring(1);
					if (hex.length === 6) {
						// convert color to hex
						let r = Math.round(color.red * 255).toString(16).padStart(2, "0");
						let g = Math.round(color.green * 255).toString(16).padStart(2, "0");
						let b = Math.round(color.blue * 255).toString(16).padStart(2, "0");
						formatted = `Color.of(${quote}#${r}${g}${b}${quote})`;
					} else {
						let r = Math.round(color.red * 255).toString(16).padStart(2, "0");
						let g = Math.round(color.green * 255).toString(16).padStart(2, "0");
						let b = Math.round(color.blue * 255).toString(16).padStart(2, "0");
						let a = Math.round(color.alpha * 255).toString(16).padStart(2, "0");
						formatted = `Color.of(${quote}#${a}${r}${g}${b}${quote})`;
					}
				} else {
					// check if it is a valid int
					if (isNaN(parseInt(text.substring(8, text.length - 1)))) {
						// get the predefined color
						let predefined = text.substring(10, text.length - 2);

						// extract the quotes from `text`
						let quote = text.substring(9, 10);
						return [new vscode.ColorPresentation(`Color.of(${quote}${getAppropriateNearestColor(color, predefined)}${quote})`)];
					}

					// convert rgb to int
					let r = Math.round(color.red * 255);
					let g = Math.round(color.green * 255);
					let b = Math.round(color.blue * 255);
					// add up rgb to int
					let int = (r << 16) + (g << 8) + b;
					formatted = `Color.of(${int})`;
				}
			} else {
				// Match the color, `Color.XXXX`, capture the `XXXX`
				let match = text.match(/Color\.([A-Z_]+)/);
				if (match) {
					// get the predefined color
					let predefined = match[1];
					return [new vscode.ColorPresentation(`Color.${getAppropriateNearestColor(color, predefined)}`)];
				} else {
					// color to 0-255
					let r = Math.round(color.red * 255);
					let g = Math.round(color.green * 255);
					let b = Math.round(color.blue * 255);
					let a = Math.round(color.alpha * 255);

					formatted = `Color.rgba(${r}, ${g}, ${b}, ${a})`;
				}
			}

			if (formatted === undefined) { return []; }

			return [new vscode.ColorPresentation(formatted)];
		},
		provideDocumentColors(document, token) {
			let ranges = matchRGBA(document);
			ranges.push(...matchOf(document));
			ranges.push(...matchPredefined(document));
			ranges.push(...matchDirect(document));
			ranges.push(...matchColor(document));
			return ranges;
		}
	}));

	if (!collected) {
		// warn vscode user that the attributes file is not found
		vscode.window.showWarningMessage("ProbeJS: Some attributes file are not found. Things might not work.");
	}

	context.subscriptions.push(vscode.commands.registerCommand("probejs.reload", () => {
		collector.clear();
		collector.collectItem(itemAttributes);
		collector.collectFluid(fluidAttributes);
		collector.collectTag(tagsPath);
		collector.collectLangKeys(langPath);
		collector.buildCompletions(workspace);
	}));
}

// This method is called when your extension is deactivated
export function deactivate() { }
