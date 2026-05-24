import * as vscode from 'vscode';
import { ProbeDecorator } from './features/display/decoration';
import { ProbeHover } from './features/display/hover';
import { ProbeJSProject } from './project';
import { ReloadProvider } from './reload';
import { ProbeWebClient } from './probe';
import { ProbeImages } from './features/display/imageClient';
import path = require('path');
import { insertItemArray, insertItemArrayFromTags, insertLangKeys, insertRecipeJson } from './features/commands/insertCommands';
import { registerChatTools } from './features/copilot';
import { extractTranslationKey } from './features/commands/extractCommand';
import { warnHardcodedLang } from './features/rules/warnHardcodedLang';
import { ProbeColorProvider } from './features/colorProvider';
import { KubedexHandler } from './features/kubedex';

let probeClient: ProbeWebClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }

	let workspace = ws[0].uri;
	let project = new ProbeJSProject(workspace);
	if (!project.configAvailable) { return; }
	let config = project.webServerConfig;
	if (config['enabled']) {
		warnHardcodedLang(context);

		context.subscriptions.push(vscode.languages.registerColorProvider('javascript', new ProbeColorProvider()));

		probeClient = new ProbeWebClient(config.port ?? 61423, "Bearer " + config.auth);
		let probeImages = new ProbeImages(probeClient);

		let reloadProvider = new ReloadProvider(probeClient);
		context.subscriptions.push(
			vscode.languages.registerCodeLensProvider('javascript', reloadProvider),
			vscode.commands.registerCommand('probejs.reloadScript', reloadProvider.reloadScript.bind(reloadProvider)),
		);

		let hover = new ProbeHover(probeImages);
		context.subscriptions.push(
			vscode.languages.registerHoverProvider('javascript', hover),
			vscode.languages.registerHoverProvider('plaintext', hover),
			vscode.languages.registerHoverProvider('json', hover),
			vscode.languages.registerHoverProvider('toml', hover),
		);
		
		const probeDecorator = new ProbeDecorator(probeImages);
		probeClient.onConnected(async () => { context.subscriptions.push(await probeDecorator.setupDecoration()); });

		registerChatTools(context, probeClient);

		context.subscriptions.push(
			vscode.commands.registerCommand('probejs.reconnect', async () => {
				await probeClient?.disconnect();
				if (!await probeClient?.tryConnect(false)) {
					vscode.window.showErrorMessage('Failed to connect to ProbeJS Webserver, is MC 1.21+ running?');
					return;
				}
				await probeClient?.connectKubedex();
				probeDecorator.clearCache();
				if (vscode.window.activeTextEditor) { await probeDecorator.decorate(); }
			}),
			vscode.commands.registerCommand('probejs.insertArray', async () => await insertItemArray(probeClient)),
			vscode.commands.registerCommand('probejs.insertArrayFromTags', async () => await insertItemArrayFromTags(probeClient)),
			vscode.commands.registerCommand('probejs.insertLangKeys', async () => await insertLangKeys(probeClient)),
			vscode.commands.registerCommand('probejs.insertRecipeJson', async () => await insertRecipeJson(probeClient)),
			vscode.commands.registerCommand('probejs.generateTranslation', async () => await extractTranslationKey())
		);

		let kubdexHandler = new KubedexHandler(probeClient);

		// hello vscode!
		vscode.window.showInformationMessage('ProbeJS Extension is now active!');
		probeClient.tryConnect(true).then(success => {
			if (success) { return probeClient?.connectKubedex(); }
		});
	} else {
		if (config['enabled'] === undefined) {
			project.enableProbeJS();
			vscode.window.showInformationMessage('ProbeJS Extension has been enabled! Please restart the game and VSCode to start using it.');
		} else {
			vscode.window.showInformationMessage('ProbeJS Extension is not enabled...');
		}
	}
}

export function deactivate() {
	if (probeClient) {
		probeClient.disconnect();
	}
}