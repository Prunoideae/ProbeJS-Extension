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

let probeClient: ProbeWebClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }

	let workspace = ws[0].uri;
	let project = new ProbeJSProject(workspace);
	if (!project.configAvailable) { return; }
	let config = project.webServerConfig;

	if (config['enabled']) {
		let port = config['port'] ?? 61423;
		probeClient = new ProbeWebClient(port);
		let probeImages = new ProbeImages(probeClient);
		setupInsertions(probeClient);

		let jumpSourceProvider = new JavaSourceProvider(project.decompiledPath);
		vscode.languages.registerCodeLensProvider('javascript', jumpSourceProvider);
		vscode.commands.registerCommand('probejs.jumpToSource', jumpSourceProvider.jumpToSource.bind(jumpSourceProvider));
		let traceProvider = new StacktraceSourceProvider(project.decompiledPath);
		vscode.languages.registerCodeLensProvider('plaintext', traceProvider);
		vscode.commands.registerCommand('probejs.jumpToStackSource', traceProvider.jumpToSource.bind(traceProvider));

		let reloadProvider = new ReloadProvider(probeClient);
		vscode.languages.registerCodeLensProvider('javascript', reloadProvider);
		vscode.commands.registerCommand('probejs.reloadScript', reloadProvider.reloadScript.bind(reloadProvider));

		let sync = new InfoSync(probeClient);

		// let evaluateProvider = new EvaluateProvider(probeClient, sync);
		// vscode.languages.registerCodeLensProvider('javascript', evaluateProvider);
		// vscode.commands.registerCommand('probejs.evaluate', evaluateProvider.evaluate.bind(evaluateProvider));

		let hover = new ProbeHover(probeImages);
		vscode.languages.registerHoverProvider('javascript', hover);
		vscode.languages.registerHoverProvider('plaintext', hover);
		vscode.languages.registerHoverProvider('json', hover);
		vscode.languages.registerHoverProvider('toml', hover);

		const probeDecorator = new ProbeDecorator(probeImages);
		probeClient.onConnected(async () => { context.subscriptions.push(await probeDecorator.setupDecoration()); });

		vscode.commands.registerCommand('probejs.reconnect', async () => {
			if (!await probeClient?.tryConnect()) {
				vscode.window.showErrorMessage('Failed to connect to ProbeJS Webserver, is MC 1.21+ running?');
				return;
			}
			probeDecorator.clearCache();
			if (vscode.window.activeTextEditor) { await probeDecorator.decorate(); }
		});


		// hello vscode!
		vscode.window.showInformationMessage('ProbeJS Extension is now active!');
		await probeClient.tryConnect();

		const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
		if (!tsExtension) { return; }
		await tsExtension.activate();
		// repeatly configure the plugin every 2 seconds
		setInterval(() => {
			if (!tsExtension.exports || !tsExtension.exports.getAPI) { return; }

			const api = tsExtension.exports.getAPI(0);
			if (!api) { return; }

			api.configurePlugin('sample', {
				enabled: true,
			});
		}, 2000);

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