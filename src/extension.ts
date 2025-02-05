import * as vscode from 'vscode';
import { ProbeDecorator } from './features/decoration';
import { InfoSync } from './features/errorSync';
import { ProbeHover } from './features/hover';
import { setupInsertions } from './features/insertions';
import { JavaSourceProvider, StacktraceSourceProvider } from './features/jumpToSource';
import { ProbeJSProject } from './project';
import { ReloadProvider } from './reload';
import { ProbeWebClient } from './probe';
import { ProbeImages } from './features/imageClient';
import path = require('path');
import { insertItemArray, insertLangKeys } from './features/insertArrays';

let probeClient: ProbeWebClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }

	let workspace = ws[0].uri;
	let project = new ProbeJSProject(workspace);
	if (!project.configAvailable) { return; }
	let config = project.webServerConfig;

	if (config['enabled']) {
		probeClient = new ProbeWebClient(config.port ?? 61423, "Bearer " + config.auth);
		let probeImages = new ProbeImages(probeClient);
		setupInsertions(probeClient);

		let jumpSourceProvider = new JavaSourceProvider(project.decompiledPath);
		let traceProvider = new StacktraceSourceProvider(project.decompiledPath);
		let reloadProvider = new ReloadProvider(probeClient);
		context.subscriptions.push(
			vscode.languages.registerCodeLensProvider('javascript', jumpSourceProvider),
			vscode.commands.registerCommand('probejs.jumpToSource', jumpSourceProvider.jumpToSource.bind(jumpSourceProvider)),
			vscode.languages.registerCodeLensProvider('plaintext', traceProvider),
			vscode.commands.registerCommand('probejs.jumpToStackSource', traceProvider.jumpToSource.bind(traceProvider)),
			vscode.languages.registerCodeLensProvider('javascript', reloadProvider),
			vscode.commands.registerCommand('probejs.reloadScript', reloadProvider.reloadScript.bind(reloadProvider)),
		);

		let sync = new InfoSync(probeClient);

		// let evaluateProvider = new EvaluateProvider(probeClient, sync);
		// vscode.languages.registerCodeLensProvider('javascript', evaluateProvider);
		// vscode.commands.registerCommand('probejs.evaluate', evaluateProvider.evaluate.bind(evaluateProvider));

		let hover = new ProbeHover(probeImages);
		context.subscriptions.push(
			vscode.languages.registerHoverProvider('javascript', hover),
			vscode.languages.registerHoverProvider('plaintext', hover),
			vscode.languages.registerHoverProvider('json', hover),
			vscode.languages.registerHoverProvider('toml', hover),
		);

		const probeDecorator = new ProbeDecorator(probeImages);
		probeClient.onConnected(async () => { context.subscriptions.push(await probeDecorator.setupDecoration()); });

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
			vscode.commands.registerCommand('probejs.insertLangKeys', async () => await insertLangKeys(probeClient)),
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