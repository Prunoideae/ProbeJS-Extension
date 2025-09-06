import * as vscode from 'vscode';
import { ProbeDecorator } from './features/display/decoration';
import { InfoSync } from './features/game/errorSync';
import { ProbeHover } from './features/display/hover';
import { setupInsertions } from './features/game/insertions';
import { ProbeJSProject } from './project';
import { ReloadProvider } from './reload';
import { ProbeWebClient } from './probe';
import { ProbeImages } from './features/display/imageClient';
import path = require('path');
import { insertItemArray, insertItemArrayFromTags, insertLangKeys, insertRecipeJson } from './features/commands/insertCommands';
import { registerChatTools } from './features/copilot';
import { TextContentProvider } from './features/display/textProvider';
import { registerChatParticipant } from './features/copilotParticipant';
import { extractTranslationKey } from './features/commands/extractCommand';
import { warnHardcodedLang } from './features/rules/warnHardcodedLang';
import { registerConversion } from './features/rules/tsToJsTypeAnnotation';
import { ProbeColorProvider } from './features/colorProvider';

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
		registerConversion(context);
		context.subscriptions.push(
			vscode.languages.registerColorProvider('javascript', new ProbeColorProvider()),
		);

		// Create a new untitled document with a custom name
		let schemeProvider = new TextContentProvider();
		context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(TextContentProvider.scheme, schemeProvider));

		probeClient = new ProbeWebClient(config.port ?? 61423, "Bearer " + config.auth);
		let probeImages = new ProbeImages(probeClient);
		setupInsertions(probeClient);

		let reloadProvider = new ReloadProvider(probeClient);
		context.subscriptions.push(
			vscode.languages.registerCodeLensProvider('javascript', reloadProvider),
			vscode.commands.registerCommand('probejs.reloadScript', reloadProvider.reloadScript.bind(reloadProvider)),
		);

		let sync = new InfoSync(probeClient);
		let hover = new ProbeHover(probeImages);
		context.subscriptions.push(
			vscode.languages.registerHoverProvider('javascript', hover),
			vscode.languages.registerHoverProvider('plaintext', hover),
			vscode.languages.registerHoverProvider('json', hover),
			vscode.languages.registerHoverProvider('toml', hover),
		);
		const probeDecorator = new ProbeDecorator(probeImages);
		probeClient.onConnected(async () => { context.subscriptions.push(await probeDecorator.setupDecoration()); });

		registerChatTools(context, probeClient, probeImages, schemeProvider);
		registerChatParticipant(context);

		context.subscriptions.push(
			vscode.commands.registerCommand('probejs.reconnect', async () => {
				if (!await probeClient?.tryConnect(false)) {
					vscode.window.showErrorMessage('Failed to connect to ProbeJS Webserver, is MC 1.21+ running?');
					return;
				}
				probeDecorator.clearCache();
				if (vscode.window.activeTextEditor) { await probeDecorator.decorate(); }
			}),
			vscode.commands.registerCommand('probejs.insertArray', async () => await insertItemArray(probeClient)),
			vscode.commands.registerCommand('probejs.insertArrayFromTags', async () => await insertItemArrayFromTags(probeClient)),
			vscode.commands.registerCommand('probejs.insertLangKeys', async () => await insertLangKeys(probeClient)),
			vscode.commands.registerCommand('probejs.insertRecipeJson', async () => await insertRecipeJson(probeClient)),
			vscode.commands.registerCommand('probejs.generateTranslation', async () => await extractTranslationKey())
		);

		function configureTSPlugin() {
			if (!tsExtension) { return; }
			if (!tsExtension.exports || !tsExtension.exports.getAPI) { return; }
			const api = tsExtension.exports.getAPI(0);
			if (!api) { return; }

			const workspace = vscode.workspace.workspaceFolders?.[0];
			if (!workspace) { return; }

			const uri = path.resolve(workspace.uri.fsPath, './local/kubejs/cache/web/img');
			api.configurePlugin('sample', {
				enabled: probeClient?.mcConnected(),
				port: probeClient?.connectedPort(),
				auth: "Bearer " + config.auth,
				imageBasePath: `${vscode.Uri.file(uri)}`
			});
		}

		// hello vscode!
		vscode.window.showInformationMessage('ProbeJS Extension is now active!');
		const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
		if (!tsExtension) { return; }
		await tsExtension.activate();

		// repeatly configure the plugin every 2 seconds
		setInterval(configureTSPlugin, 2000);

		probeClient.tryConnect(true);
	} else {
		if (config['enabled'] === undefined) {
			project.enableProbeJS();
			vscode.window.showInformationMessage('ProbeJS Extension has been enabled! Please reload the game and VSCode to start using it.');
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