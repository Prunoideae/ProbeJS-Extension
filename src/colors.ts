import { ColorInformation, TextDocument } from "vscode";
import * as vscode from "vscode";

function matchRGBA(document: TextDocument): ColorInformation[] {
    // lazy match all `Color.rgba(r, g, b, a)`
    // rgba are float
    let regex = /Color\.rgba\((\d+\.?\d*|\d+),\s*(\d+\.?\d*|\d+),\s*(\d+\.?\d*|\d+),\s*(\d+\.?\d*|\d+)\)/g;

    // get all matches and ranges	
    let matches = document.getText().matchAll(regex);

    let ranges = [];
    for (let match of matches) {

        if (match.index === undefined) { continue; }
        let range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length));
        // get the text of the match
        let text = document.getText(range);
        // get r, g, b, a
        let rgba = text.match(/\d+\.?\d*|\d+/g);
        if (!rgba) { continue; }
        // convert to number
        let r = parseFloat(rgba[0]);
        let g = parseFloat(rgba[1]);
        let b = parseFloat(rgba[2]);
        let a = parseFloat(rgba[3]);

        // normalize to 0-1
        r /= 255;
        g /= 255;
        b /= 255;
        a /= 255;
        // create color
        let color = new vscode.Color(r, g, b, a);
        // push to ranges
        ranges.push(new vscode.ColorInformation(range, color));
    }
    return ranges;
}

function matchOf(document: TextDocument): ColorInformation[] {
    // lazy match `Color.of(...)`, where ... can be an float or a `#******` / `#********` hex color
    // the `...` part is captured
    let regex = /Color\.of\((\d+\.?\d*|\d+|(["`'])#[0-9a-fA-F]{6}(["`'])|(["`'])#[0-9a-fA-F]{8}(["`']))\)/g;

    // get all matches and ranges
    let matches = document.getText().matchAll(regex);

    let ranges = [];
    for (let match of matches) {
        // get the range of the match
        if (match.index === undefined) { continue; }

        let range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length));
        // get the text of the match
        let text = document.getText(range);
        // get the color
        let color = text.match(/\d+\.?\d*|\d+|#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}/);
        if (!color) { continue; }
        // check if it is a hex color, convert to int
        let intColor = color[0].startsWith("#") ? parseInt(color[0].substring(1), 16) : parseInt(color[0]);
        // convert to r, g, b, a
        let r = (intColor >> 16) & 0xFF;
        let g = (intColor >> 8) & 0xFF;
        let b = intColor & 0xFF;
        let a = (intColor >> 24) & 0xFF;
        // normalize to 0-1
        r /= 255;
        g /= 255;
        b /= 255;
        a /= 255;

        // if it is #******, set alpha to 1
        if (color[0].startsWith("#") && color[0].length === 7) {
            a = 1;
        }
        // create color
        let colorObj = new vscode.Color(r, g, b, a);

        // push to ranges
        ranges.push(new vscode.ColorInformation(range, colorObj));
    }
    return ranges;
}

const predefinedColors = {

} as { [key: string]: number };

const normalColors = new Set<number>();
const dyeColors = new Set<number>();

function addPredefined(color: number, ...names: string[]) {
    for (let name of names) {
        predefinedColors[name] = color;
        if (name.toLowerCase().endsWith("dye")) {
            dyeColors.add(color);
        } else {
            normalColors.add(color);
        }
    }

}

function getNearestColor(color: vscode.Color, colorSet: Set<number>): number {
    // calculate the nearest color by r, g, b
    let r = color.red * 255;
    let g = color.green * 255;
    let b = color.blue * 255;

    let minDistance = Infinity;
    let minColor = 0;
    for (let c of colorSet) {
        let cr = (c >> 16) & 0xFF;
        let cg = (c >> 8) & 0xFF;
        let cb = c & 0xFF;

        let distance = Math.sqrt((cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2);
        if (distance < minDistance) {
            minDistance = distance;
            minColor = c;
        }
    }
    return minColor;
}

function getColorStrings(color: number): string[] {
    // get all names of a color
    let names = [];
    for (let name in predefinedColors) {
        if (predefinedColors[name] === color) {
            names.push(name);
        }
    }
    return names;
}


function getAppropriateNearestColor(color: vscode.Color, prevColor: string): string {

    let nearestColor = getNearestColor(color, prevColor.toLowerCase().endsWith("dye") ? dyeColors : normalColors);
    let strings = getColorStrings(nearestColor);

    if (strings.length === 1) {
        return strings[0];
    }

    // check if it's all uppercase
    if (prevColor.toUpperCase() === prevColor) {
        return strings.find(s => s.toUpperCase() === s) ?? strings[0];
    } else if (prevColor.toLowerCase() === prevColor) {
        return strings.find(s => s.toLowerCase() === s) ?? strings[0];
    } else {
        // return the camelCase one, example: darkBlue
        return strings.find(s => (s.toLowerCase() === s[0] + s.substring(1).toLowerCase()) && (!s.includes("_"))) ?? strings[0];
    }
}

addPredefined(0, "BLACK", "black");
addPredefined(170, "DARK_BLUE", "dark_blue", "darkBlue");
addPredefined(43520, "DARK_GREEN", "dark_green", "darkGreen");
addPredefined(43690, "DARK_AQUA", "dark_aqua", "darkAqua");
addPredefined(11141120, "DARK_RED", "dark_red", "darkRed");
addPredefined(11141290, "DARK_PURPLE", "dark_purple", "darkPurple");
addPredefined(16755200, "GOLD", "gold");
addPredefined(11184810, "GRAY", "gray");
addPredefined(5592405, "DARK_GRAY", "dark_gray", "darkGray");
addPredefined(5592575, "BLUE", "blue");
addPredefined(5635925, "GREEN", "green");
addPredefined(5636095, "AQUA", "aqua");
addPredefined(16733525, "RED", "red");
addPredefined(16733695, "LIGHT_PURPLE", "light_purple", "lightPurple");
addPredefined(16777045, "YELLOW", "yellow");
addPredefined(16777215, "WHITE", "white");

addPredefined(16777215, "WHITE_DYE", "white_dye", "whiteDye");
addPredefined(16738335, "ORANGE_DYE", "orange_dye", "orangeDye");
addPredefined(16711935, "MAGENTA_DYE", "magenta_dye", "magentaDye");
addPredefined(10141901, "LIGHT_BLUE_DYE", "light_blue_dye", "lightBlueDye");
addPredefined(16776960, "YELLOW_DYE", "yellow_dye", "yellowDye");
addPredefined(12582656, "LIME_DYE", "lime_dye", "limeDye");
addPredefined(16738740, "PINK_DYE", "pink_dye", "pinkDye");
addPredefined(8421504, "GRAY_DYE", "gray_dye", "grayDye");
addPredefined(13882323, "LIGHT_GRAY_DYE", "light_gray_dye", "lightGrayDye");
addPredefined(65535, "CYAN_DYE", "cyan_dye", "cyanDye");
addPredefined(10494192, "PURPLE_DYE", "purple_dye", "purpleDye");
addPredefined(255, "BLUE_DYE", "blue_dye", "blueDye");
addPredefined(9127187, "BROWN_DYE", "brown_dye", "brownDye");
addPredefined(65280, "GREEN_DYE", "green_dye", "greenDye");
addPredefined(16711680, "RED_DYE", "red_dye", "redDye");
addPredefined(0, "BLACK_DYE", "black_dye", "blackDye");


function matchPredefined(document: TextDocument): ColorInformation[] {
    // lazy match `Color.of("...")` where ... is A-Z, a-z, and _, quoted by ' or " or `
    // the `...` part is captured
    let regex = /Color\.of\((["'`])([A-Za-z_]+)\1\)/g;

    // get all matches and ranges
    let matches = document.getText().matchAll(regex);

    let ranges = [];
    for (let match of matches) {
        // get the range of the match
        if (match.index === undefined) { continue; }
        // get the text of the match
        let text = document.getText(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)));

        // get the color
        let colorMatch = text.match(/["'`](.+?)["'`]/);

        if (!colorMatch) { continue; }

        // remove the quotes by string slicing
        let color = colorMatch[0].substring(1, colorMatch[0].length - 1);

        // check if it is a predefined color
        let predefined = predefinedColors[color];

        if (predefined === undefined) { continue; }
        // convert to r, g, b
        let r = (predefined >> 16) & 0xFF;
        let g = (predefined >> 8) & 0xFF;
        let b = predefined & 0xFF;
        // normalize to 0-1
        r /= 255;
        g /= 255;
        b /= 255;
        // create color
        let colorObj = new vscode.Color(r, g, b, 1);

        // push to ranges
        ranges.push(new vscode.ColorInformation(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), colorObj));

    }
    return ranges;
}

function matchDirect(document: TextDocument): ColorInformation[] {
    // lazy match `Color.XXX` where XXX is A-Z, and _, not quoted
    // the `XXX` part is captured
    let regex = /Color\.([A-Z_]+)/g;

    // get all matches and ranges
    let matches = document.getText().matchAll(regex);

    let ranges = [];
    for (let match of matches) {
        // get the range of the match
        if (match.index === undefined) { continue; }
        // get the text of the match
        let text = document.getText(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)));

        // get the color
        let color = text.match(/Color\.([A-Z_]+)/);

        if (!color) { continue; }

        // check if it is a predefined color
        let predefined = predefinedColors[color[1]];

        if (predefined === undefined) { continue; }

        // convert to r, g, b
        let r = (predefined >> 16) & 0xFF;
        let g = (predefined >> 8) & 0xFF;
        let b = predefined & 0xFF;
        // normalize to 0-1
        r /= 255;
        g /= 255;
        b /= 255;
        // create color
        let colorObj = new vscode.Color(r, g, b, 1);

        // push to ranges
        ranges.push(new vscode.ColorInformation(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), colorObj));
    }
    return ranges;
}

function matchColor(document: TextDocument): ColorInformation[] {
    // match `Color` and `Color.` after `.` should not have a-zA-Z_ after it
    // no a-zA-Z_0-9. before Color either
    let regex = /(?<![\w\d\.])Color\.(?![\w\d_])/g;

    // get all matches and ranges
    let matches = document.getText().matchAll(regex);

    let ranges = [];
    for (let match of matches) {
        // get the range of the match
        if (match.index === undefined) { continue; }

        // push to ranges
        ranges.push(new vscode.ColorInformation(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), new vscode.Color(0, 0, 0, 1)));
    }
    return ranges;
}

export function getColors(): vscode.DocumentColorProvider {
    return {
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
    };
}