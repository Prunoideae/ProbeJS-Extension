import * as vscode from 'vscode';

export class ProbeColorProvider {
    // Matches a color int, usually 0xRRGGBB or 0xAARRGGBB
    private readonly _matcherColorInt = /0x[0-9A-Fa-f]{6,8}/g;

}