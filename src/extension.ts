import * as vscode from 'vscode';
import { ProbeClient } from './bridge';
import { ProbeJSProject } from './project';
import { JavaSourceProvider, StacktraceSourceProvider } from './lens';
import { ErrorSync } from './errorSync';
import { ProbeDecorator } from './decoration';

let probeClient: ProbeClient | undefined;

export function activate(context: vscode.ExtensionContext) {
	let ws = vscode.workspace.workspaceFolders;
	if (!ws) { return; }

	let workspace = ws[0].uri;
	let project = new ProbeJSProject(workspace);
	let config = project.probeJSConfig;
	if (!config) { return; }

	const probeDecorator = new ProbeDecorator();
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
		let port = project.probeJSConfig['probejs.interactivePort'] ?? 7796;
		probeClient = new ProbeClient(port);

		probeClient.on("accept_items", (data: string[]) => {
			let dataString = "";
			if (data.length === 1) {
				dataString = data[0];
			} else {
				dataString = `[${data.join(", ")}]`;
			}
			// check if current cursor is next to ), if is then add a comma
			let editor = vscode.window.activeTextEditor;
			let cursorPosition = editor?.selection.active;
			let line = editor?.document.lineAt(cursorPosition!);
			let lineText = line?.text;
			let nextChar = lineText?.charAt(cursorPosition!.character);
			if (nextChar === ")") {
				dataString += ", ";
			}
			vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(dataString));
		});

		vscode.commands.registerCommand('probejs.reconnect', () => {
			probeClient?.close();
			probeClient?.connect(port);
		});

		let provider = new JavaSourceProvider(project.decompiledPath);
		vscode.languages.registerCodeLensProvider('javascript', provider);
		vscode.commands.registerCommand('probejs.jumpToSource', provider.jumpToSource.bind(provider));
		let traceProvider = new StacktraceSourceProvider(project.decompiledPath);
		vscode.languages.registerCodeLensProvider('plaintext', traceProvider);
		vscode.commands.registerCommand('probejs.jumpToStackSource', traceProvider.jumpToSource.bind(traceProvider));

		let sync = new ErrorSync(probeClient);

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