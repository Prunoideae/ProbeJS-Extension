
import tss from 'typescript/lib/tsserverlibrary';
function init(modules: { typescript: typeof tss }) {

    let enabled = false;
    let logger: tss.server.Logger | null = null;

    function onConfigurationChanged(config: { enabled: boolean }) {
        enabled = config.enabled;
        logger?.info(`ProbeJS tsserver plugin is now ${enabled ? "enabled" : "disabled"}`);
    }

    function patchCodeAction(action: tss.CodeAction): tss.CodeAction {
        if (!enabled) { return action; }
        let newAction: tss.CodeAction = {
            ...action,
            changes: action.changes.map((change) => {
                let newChange: tss.FileTextChanges = {
                    ...change,
                    textChanges: change.textChanges.map((textChange) => {
                        let newTextChange: tss.TextChange = {
                            ...textChange,
                            newText: textChange.newText
                                .replace("{ ", "")
                                .replace(" }", "")
                                .replace("require", "Java.loadClass")
                                .replace("const ", "let ")
                                .replace("\n\n", "\n")
                        };
                        return newTextChange;
                    })
                };
                return newChange;
            })
        };
        return newAction;
    }

    function create(info: tss.server.PluginCreateInfo) {
        // Set up decorator
        const proxy: tss.LanguageService = Object.create(null);

        info.project.projectService.logger.info(
            "ProbeJS tsserver plugin is loading!"
        );

        logger = info.project.projectService.logger;

        for (let k of Object.keys(info.languageService) as Array<keyof tss.LanguageService>) {
            const x = info.languageService[k];
            // @ts-expect-error JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
        }

        proxy.getCompletionEntryDetails = (fileName, position, name, formatOptions, source, preferences, data) => {
            let oldDetails = info.languageService.getCompletionEntryDetails(fileName, position, name, formatOptions, source, preferences, data);
            if (!oldDetails) { return oldDetails; }
            if (!enabled) { return oldDetails; }

            let newDetails: tss.CompletionEntryDetails = {
                ...oldDetails,
                codeActions: oldDetails.codeActions?.map(patchCodeAction)
            };
            return newDetails;
        };

        proxy.getCompletionsAtPosition = (fileName, position, options, formatOptions) => {
            let oldCompletions = info.languageService.getCompletionsAtPosition(fileName, position, options, formatOptions);
            if (!oldCompletions) { return oldCompletions; }
            if (!enabled) { return oldCompletions; }

            let newCompletions: tss.CompletionInfo = {
                ...oldCompletions,
                entries: oldCompletions.entries.filter(entry => !entry.name.endsWith("$$Static"))
            };
            return {
                ...newCompletions,
                metadata: oldCompletions.metadata
            };
        };

        return proxy;
    }

    return { create, onConfigurationChanged };
}

export = init;