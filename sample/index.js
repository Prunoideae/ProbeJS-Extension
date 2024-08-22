"use strict";
function init(modules) {
    let enabled = false;
    let logger = null;
    function onConfigurationChanged(config) {
        enabled = config.enabled;
        logger === null || logger === void 0 ? void 0 : logger.info(`ProbeJS tsserver plugin is now ${enabled ? "enabled" : "disabled"}`);
    }
    function patchCodeAction(action) {
        if (!enabled) {
            return action;
        }
        let newAction = Object.assign(Object.assign({}, action), { changes: action.changes.map((change) => {
                let newChange = Object.assign(Object.assign({}, change), { textChanges: change.textChanges.map((textChange) => {
                        let newTextChange = Object.assign(Object.assign({}, textChange), { newText: textChange.newText
                                .replace("{ ", "")
                                .replace(" }", "")
                                .replace("require", "Java.loadClass")
                                .replace("const ", "let ")
                                .replace("\n\n", "\n") });
                        return newTextChange;
                    }) });
                return newChange;
            }) });
        return newAction;
    }
    function create(info) {
        // Set up decorator
        const proxy = Object.create(null);
        info.project.projectService.logger.info("ProbeJS tsserver plugin is loading!");
        for (let k of Object.keys(info.languageService)) {
            const x = info.languageService[k];
            // @ts-expect-error JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args) => x.apply(info.languageService, args);
        }
        proxy.getCompletionEntryDetails = (fileName, position, name, formatOptions, source, preferences, data) => {
            var _a;
            let oldDetails = info.languageService.getCompletionEntryDetails(fileName, position, name, formatOptions, source, preferences, data);
            if (!oldDetails) {
                return oldDetails;
            }
            if (!enabled) {
                return oldDetails;
            }
            let newDetails = Object.assign(Object.assign({}, oldDetails), { codeActions: (_a = oldDetails.codeActions) === null || _a === void 0 ? void 0 : _a.map(patchCodeAction) });
            return newDetails;
        };
        proxy.getCompletionsAtPosition = (fileName, position, options, formatOptions) => {
            let oldCompletions = info.languageService.getCompletionsAtPosition(fileName, position, options, formatOptions);
            if (!oldCompletions) {
                return oldCompletions;
            }
            if (!enabled) {
                return oldCompletions;
            }
            let newCompletions = Object.assign(Object.assign({}, oldCompletions), { entries: oldCompletions.entries.filter(entry => !entry.name.endsWith("$$Static")) });
            return Object.assign(Object.assign({}, newCompletions), { metadata: oldCompletions.metadata });
        };
        return proxy;
    }
    return { create, onConfigurationChanged };
}
module.exports = init;
