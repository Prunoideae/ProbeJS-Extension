import * as vscode from 'vscode';
import { ProbeClient } from './bridge';
import { ProbeJSProject } from './project';
import { JavaSourceProvider, StacktraceSourceProvider } from './jumpToSource';
import { InfoSync } from './errorSync';
import { ProbeDecorator } from './decoration';
import { setupInsertions } from './insertions';
import { ReloadProvider } from './reload';
import { EvaluateProvider } from './evaluate';

let probeClient: ProbeClient | undefined;

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }

	let workspace = ws[0].uri;
	let project = new ProbeJSProject(workspace);
	if (!project.configAvailable) { return; }
	let config = project.probeJSConfig;


	const probeDecorator = new ProbeDecorator(workspace);
	if (vscode.window.activeTextEditor) {
		probeDecorator.editor = vscode.window.activeTextEditor;
		probeDecorator.decorate();
	}
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			probeDecorator.editor = editor;
			probeDecorator.decorate();
		}
	});
	vscode.workspace.onDidChangeTextDocument(event => {
		if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
			probeDecorator.decorate();
		}
	});

	if (config['probejs.interactive']) {
		let port = config['probejs.interactivePort'] ?? 7796;
		probeClient = new ProbeClient(port);

		setupInsertions(probeClient);

		vscode.commands.registerCommand('probejs.reconnect', () => {
			probeClient?.close();
			probeClient?.connect(port);
		});

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
		let evaluateProvider = new EvaluateProvider(probeClient, sync);
		vscode.languages.registerCodeLensProvider('javascript', evaluateProvider);
		vscode.commands.registerCommand('probejs.evaluate', evaluateProvider.evaluate.bind(evaluateProvider));

		// hello vscode!
		vscode.window.showInformationMessage('ProbeJS Extension is now active!');
	} else {
		if (config['probejs.interactive'] === undefined) {
			project.enableProbeJS();
			vscode.window.showInformationMessage('ProbeJS Extension has been enabled! Please reload the game and VSCode to start using it.');
		} else {
			vscode.window.showInformationMessage('ProbeJS Extension is not enabled. You can enable it by using `/probejs interactive` in the game.');
		}
	}
}


export function deactivate() {
	if (probeClient) {
		probeClient.close();
	}
}