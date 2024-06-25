import { ProbeClient } from "./bridge";
import * as vscode from "vscode";

export function setupInsertions(probeClient: ProbeClient) {

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

    probeClient.on("accept_block", (data: {
        id: string,
        properties: string[] | undefined,
    }) => {
        let dataString = data.id;
        if (data.properties) {
            let properties = data.properties.map((prov, index, arr) => {
                // make it tabstop with default value
                let commaProv = index === arr.length - 1 ? prov : prov + ", ";
                return `\${${index + 1}:${commaProv}}`;
            }).join("");
            dataString += `\${0:[${properties}]}`;
        }
        dataString = `"${dataString}"`;
        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(dataString));
    });
}