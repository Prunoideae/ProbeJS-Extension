import * as utils from '../utils';
import * as vscode from 'vscode';
import { ProbeImages } from './imageClient';

export class ProbeHover implements vscode.HoverProvider {
    constructor(private readonly httpClient?: ProbeImages) {

    }



    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null | undefined> {
        // get currently selected text and test if position is within selected range
        const selectedRange = vscode.window.activeTextEditor?.selection;
        console.log(selectedRange, selectedRange?.contains(position));
        if (!selectedRange?.contains(position)) { return; }
        // get text from selected range
        const selectedText = document.getText(selectedRange);


        let images: vscode.MarkdownString = new vscode.MarkdownString();

        let parsed = utils.parseItemString(selectedText);
        if (parsed) {
            let imageUri = await this.httpClient?.getItemImage(parsed.id, parsed.components, 64);
            if (imageUri) {
                images.appendMarkdown(`### Item Image\n\n![Item Image](${imageUri})\n\n`);
            }
        }

        if (parsed) {
            let imageUri = await this.httpClient?.getBlockIamge(parsed.id, parsed.components ? utils.parseBlockState(parsed.components) : new Map(), 64);
            if (imageUri) {
                images.appendMarkdown(`### Block Image\n\n![Block Image](${imageUri})\n\n`);
            }
        }

        if (parsed) {
            let imageUri = await this.httpClient?.getFluidImage(parsed.id, parsed.components, 64);
            if (imageUri) {
                images.appendMarkdown(`### Fluid Image\n\n![Fluid Image](${imageUri})\n\n`);
            }
        }
        return new vscode.Hover(images, selectedRange);
    }
}