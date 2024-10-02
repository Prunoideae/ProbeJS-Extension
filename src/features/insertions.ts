import * as vscode from "vscode";
import { ProbeWebClient } from "../probe";
import { HighlightItem, HighlightedItems, toComponentString } from "../payload/highlightItems";
import { HighlighBlock, toPropertyString } from "../payload/highlightBlock";
import { SessionInfo } from "../payload/sessionInfo";

export function setupInsertions(probeClient: ProbeWebClient) {
    // Used for minecraft shaped recipes
    const SYMBOL_STRING = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    function acceptItem(data: HighlightItem[]) {
        let tabStop = 0;
        let dataString = data.map((item) => {
            let itemString = item.item.id;
            if (item.item.components) {
                let components = toComponentString(item);
                let componentStrings = components.map((comp, index, arr) => {
                    // escape } in the component string since it will be used in snippet
                    comp = comp.replace(/([}])/g, "\\$1");
                    let commaComp = index === arr.length - 1 ? comp : comp + ",";
                    return `\${${++tabStop}:${commaComp}}`;
                }).join("");
                itemString = `${item.item.id}\${${++tabStop}:[${componentStrings}]}`;
            }
            if (item.item.count > 1) {
                itemString = `${item.item.count}x ${itemString}`;
            }
            return itemString;
        });
        // enclose each item in single quotes
        dataString = dataString.map((str) => `'${str}'`);
        let snippetString = dataString.length === 1 ? dataString[0] : `[${dataString.join(", ")}]`;

        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
    }

    function indexesToXy(items: HighlightItem[], map: Map<string, string>): string {
        let xy: {
            symbol: string;
            x: number;
            y: number;
        }[] = [];
        let maxY = 0;
        let maxX = 0;

        // assert we are in player/chest inventory, so width is 9
        items.forEach((item) => {
            let slot = item.slot || 0;
            let x = slot % 9;
            let y = Math.floor(slot / 9);
            xy.push({ symbol: map.get(item.string) || "", x, y });
            maxY = Math.max(maxY, y);
            maxX = Math.max(maxX, x);
        });

        // Create a 2D array of " " with maxY + 1 rows and maxX + 1 columns
        let grid: string[][] = Array.from({ length: maxY + 1 }, () => Array(maxX + 1).fill(" "));
        xy.forEach((item) => {
            grid[item.y][item.x] = item.symbol;
        });
        return JSON.stringify(grid.map((row) => row.join("")));
    }

    function acceptItemShaped(data: HighlightItem[]) {
        if (data.filter(item => !item.slot || item.slot < 0).length > 1) {
            acceptItem(data);
            return;
        }
        // for slot index 0-9, add 27 to it so they will be column 3
        data.forEach((item) => {
            if (item.slot && item.slot < 9) {
                item.slot += 36;
            }
        });
        // sort by slot index from lowest to highest
        data.sort((a, b) => (a.slot || 0) - (b.slot || 0));
        // get lowest slot index and offset all slot indexes by that value
        let offset = data[0].slot || 0;
        data.forEach((item) => {
            item.slot = (item.slot || 0) - offset;
        });

        let symbolMap = new Map<string, string>();
        let symbolIndex = 0;

        // Get all items and assign a symbol to each unique item
        data.forEach((item) => {
            let itemString = item.string;
            if (!symbolMap.has(itemString)) {
                symbolMap.set(itemString, SYMBOL_STRING[symbolIndex++]);
            }
        });

        let grid = indexesToXy(data, symbolMap);
        let reversedObject: { [key: string]: string } = {};
        symbolMap.forEach((value, key) => {
            reversedObject[value] = key;
        });
        let map = "{" + Object.keys(reversedObject).map((key) => `${key}:${reversedObject[key]}`).join(", ") + "}";

        let snippetString = `${grid}, ${map}`;
        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(snippetString));
    }

    function acceptBlock(data: HighlighBlock) {
        let dataString = data.id;
        if (Object.keys(data.properties).length > 0) {
            let properties = toPropertyString(data).map((prov, index, arr) => {
                // make it tabstop with default value
                let commaProv = index === arr.length - 1 ? prov : prov + ", ";
                return `\${${index + 1}:${commaProv}}`;
            }).join("");
            dataString += `\${0:[${properties}]}`;
        }
        dataString = `"${dataString}"`;
        vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(dataString));
    }

    probeClient.registerWSHandler("api/updates", async (event, data) => {
        if (event === "server/highlight/items") {
            if (Array.isArray(data)) { acceptItem(data as HighlightItem[]); }
            else {
                let { items, flags } = data as HighlightedItems;
                // shift - 1, ctrl - 2, alt - 4, bitwise OR
                if (flags && flags.ctrl) {
                    acceptItemShaped(items);
                } else {
                    acceptItem(items);
                }
            }
        } else if (event === "server/highlight/block") {
            acceptBlock(data as HighlighBlock);
        }
    });
    probeClient.registerWSInitializer("api/updates", SessionInfo.asPayloadInitializer({ source: "probejs", tags: ["highlight"] }));
}