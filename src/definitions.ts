import { DefinitionProvider, Hover, HoverProvider, Range, Uri } from "vscode";
import * as fs from "fs";

export function provideDefinition(groupsPath: Uri): DefinitionProvider {
    return {
        provideDefinition(document, position, token) {
            // matches the event group like `{EventGroup}.{eventName}`
            // both the group and the event name are captured
            const regex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
            const range = document.getWordRangeAtPosition(position, regex);
            if (!range) { return null; }
            const word = document.getText(range);
            // get group and event name
            const match = regex.exec(word);
            if (!match) { return null; }
            const group = match[1];
            const event = match[2];
            // get the file path, `{Uri}/{group}/{event}.md`
            const path = groupsPath.with({ path: groupsPath.path + "/" + group + "/" + event + ".md" });
            if (!fs.existsSync(path.fsPath)) { return null; }
            return {
                uri: path,
                range: new Range(0, 0, 0, 0)
            };
        }
    };
}

export function provideEventHover(groupsPath: Uri): HoverProvider {
    let hoverCache = new Map<string, Hover>();
    return {
        provideHover(document, position, token) {
            // matches the event group like `{EventGroup}.{eventName}`
            // both the group and the event name are captured
            const regex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
            const range = document.getWordRangeAtPosition(position, regex);
            if (!range) { return null; }
            const word = document.getText(range);
            // get group and event name
            const match = regex.exec(word);
            if (!match) { return null; }
            const group = match[1];
            const event = match[2];
            // get the file path, `{Uri}/{group}/{event}.md`
            const path = groupsPath.with({ path: groupsPath.path + "/" + group + "/" + event + ".md" });
            if (!fs.existsSync(path.fsPath)) { return null; }

            // cache the hover
            if (hoverCache.has(path.fsPath)) {
                return hoverCache.get(path.fsPath);
            }
            let newHover = new Hover(fs.readFileSync(path.fsPath, "utf8"));
            hoverCache.set(path.fsPath, newHover);
            return newHover;
        }
    };
}