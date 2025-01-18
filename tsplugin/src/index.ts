import tss from 'typescript/lib/tsserverlibrary';
import { DetailEntry, DynamicRegistry, EntryWithDisplay, RegistryData } from './fetcher';
import axios from 'axios';
import { ProbeImages } from './image';

interface SpecialEntry {
    name: string,
    prefix: string | undefined,
}

function init(modules: { typescript: typeof tss }): tss.server.PluginModule {
    let enabled = false;
    let cachedPort: number | undefined = undefined;
    let cachedData: DynamicRegistry = new DynamicRegistry();
    let cachedImages: ProbeImages = new ProbeImages();

    let logger: tss.server.Logger | null = null;

    function onConfigurationChanged(config: {
        enabled: boolean,
        port: number | undefined,
        imageBasePath: string
    }) {
        if (config.enabled) {
            enabled = config.enabled;
            logger?.info(`ProbeJS tsserver plugin is now ${enabled ? "enabled" : "disabled"}`);
            if (config.port === cachedPort) { return; }
            cachedPort = config.port;
            cachedImages.basePath = config.imageBasePath;
            axios.defaults.baseURL = `http://localhost:${config.port}`;
            cachedData.refreshData(logger!);
        }
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

    function makeCompletionItem(
        name: string, displayName: string,
        prefix: string | undefined, registry: string
    ): tss.CompletionEntry {
        let detail = name.includes(":") && name !== displayName ? ` ${name.split(":")[0]}` : "";
        if (prefix) {
            name = prefix + name;
            displayName = prefix + displayName;
        }

        return {
            name: displayName,
            kind: tss.ScriptElementKind.string,
            kindModifiers: "",
            sortText: displayName,
            labelDetails: { description: registry, detail },
            insertText: name,
        };
    }

    function makeCompletionItemFromEntry(entry: EntryWithDisplay, prefix: string | undefined): tss.CompletionEntry {
        let displayName = prefix?.concat(entry.displayName) ?? entry.displayName;
        let completionEntry: tss.CompletionEntry = {
            name: displayName,
            kind: tss.ScriptElementKind.string,
            kindModifiers: "",
            sortText: displayName,
            labelDetails: {},
            insertText: prefix?.concat(entry.actual) ?? entry.actual,
        };

        if (entry.detail) { completionEntry.labelDetails!.detail = " " + entry.detail; }
        if (entry.description) { completionEntry.labelDetails!.description = entry.description; }

        return completionEntry;
    }

    function makeCompletionDetails(name: string, entry: DetailEntry): tss.CompletionEntryDetails {
        return {
            name,
            kind: tss.ScriptElementKind.string,
            kindModifiers: '',
            displayParts: entry.name ? [{ kind: 'text', text: entry.name }] : [],
            documentation: [{ kind: 'text', text: entry.content }],
        };
    }

    function processSpecialNames(name: string): tss.CompletionEntryDetails | undefined {
        let data = cachedData.getData();
        if (!data) { return undefined; }

        let nameWithoutPrefix = name.slice(1);
        if (data.itemMap.has(name)) {
            let item = data.itemMap.get(name)!;
            let imageUri = cachedData.getItemPath(name);
            let tags = (item.tags ?? []).map(tag => `- ${tag}`).join("\n");
            imageUri = imageUri ? `![icon](${imageUri})` : "Image not found...?";

            return makeCompletionDetails(name,
                { content: `#### ${item.name}\n${imageUri}\n#### Tags\n${tags}` }
            );
        } else if (data.translations.has(name)) {
            return makeCompletionDetails(name, {
                name, content: "**Translation**\n\n" + data.translations.get(name)!
            });
        } else if (data.tags['minecraft:item'].includes(name)) {
            let [namespace, path] = name.split(':');
            let imageUri = cachedImages.getTagImage('item', namespace, path, 64);
            imageUri = imageUri ? `![icon](${imageUri})` : "**Image is still loading... Re-triggering the completion will work**";
            return makeCompletionDetails(name, {
                name, content: `**${name}**\n\n${imageUri}`
            });
        } else if (data.tags['minecraft:item'].includes(nameWithoutPrefix)) {
            let [namespace, path] = nameWithoutPrefix.split(':');
            let imageUri = cachedImages.getTagImage('item', namespace, path, 64);
            imageUri = imageUri ? `![icon](${imageUri})` : "**Image is still loading... Re-triggering the completion will work**";
            return makeCompletionDetails(name, {
                name, content: `**${name}**\n\n${imageUri}`
            });
        }
    }

    function processEntries(entries: tss.CompletionEntry[]): [tss.CompletionEntry[], SpecialEntry[]] {
        // get all special entries (string starts with probejs$$)
        let specialEntries: SpecialEntry[] = [];
        let newEntries: tss.CompletionEntry[] = [];

        for (let entry of entries) {
            if (entry.name.startsWith("probejs$$")) {
                specialEntries.push({ name: entry.name.slice("probejs$$".length), prefix: undefined });
            } else if (entry.name.slice(1).startsWith("probejs$$")) {
                specialEntries.push({ name: entry.name.slice("probejs$$".length + 1), prefix: entry.name[0] });
            } else {
                newEntries.push(entry);
            }
        }

        // filter out all special entries and entries ending with $$Static
        newEntries = newEntries.filter(entry => !entry.name.endsWith("$$Static"));
        return [newEntries, specialEntries];
    }

    function rlToDisplayName(rl: string): string {
        const withoutNamespace = rl.split(':').pop() || '';
        const lastPart = withoutNamespace.split('/').pop() || '';
        return lastPart
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    function processSpecialEntry(entry: SpecialEntry): tss.CompletionEntry[] {
        let data = cachedData.getData();
        if (!data) { return []; }

        let { name, prefix } = entry;
        if (name.startsWith("itemStack")) {
            return data.items.map(item => makeCompletionItemFromEntry(item, prefix));
        }

        if (name.startsWith("mod")) {
            return data.mods.map(mod => makeCompletionItemFromEntry(mod, prefix));
        }

        if (name.startsWith("recipeId")) {
            return data.recipeIds.map(recipeId => makeCompletionItemFromEntry(recipeId, prefix));
        }

        if (name.startsWith("object$$")) {
            name = name.slice("object$$".length);
            return (data.objects[name] ?? [])
                .map((object) => makeCompletionItem(object, rlToDisplayName(object), prefix, name));
        }

        if (name.startsWith("tag$$")) {
            name = name.slice("tag$$".length);
            return (data.tags[name] ?? [])
                .map((tag) => makeCompletionItem(tag, tag, prefix, name));
        }

        if (name.startsWith("translation")) {
            return Array.from(data.translations.keys()).map((key) => makeCompletionItem(key, key, prefix, name));
        }

        return [];
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
            if (!enabled) { return oldDetails; }
            if (!oldDetails) {
                return processSpecialNames(name);
            }

            let newDetails: tss.CompletionEntryDetails = {
                ...oldDetails,
                codeActions: oldDetails.codeActions?.map(patchCodeAction)
            };
            return newDetails;
        };

        proxy.getCompletionsAtPosition = (fileName, position, options, formatOptions) => {
            let oldCompletions = info.languageService.getCompletionsAtPosition(fileName, position, options, formatOptions);
            if (!oldCompletions) {
                // item == "<- triggers here
                let definition = info.languageService.getTypeDefinitionAtPosition(fileName, position - 5);
                // item==" <- triggers here
                if (!definition) { definition = info.languageService.getTypeDefinitionAtPosition(fileName, position - 3); }
                if (definition && definition[0].name === "$ItemStack") {
                    return {
                        isGlobalCompletion: true,
                        isMemberCompletion: false,
                        isNewIdentifierLocation: false,
                        entries: definition.map((def) => {
                            return {
                                name: def.name,
                                kind: def.kind,
                                sortText: def.name,
                            };
                        }),
                    };
                }
                return oldCompletions;
            }
            if (!enabled) { return oldCompletions; }

            let [newEntries, specialEntries] = processEntries(oldCompletions.entries);
            let addedEntries = [];

            for (let specialEntry of specialEntries) {
                addedEntries.push(...processSpecialEntry(specialEntry));
            }

            let newCompletions: tss.CompletionInfo = {
                ...oldCompletions,
                entries: newEntries.concat(addedEntries)
            };

            logger?.info(JSON.stringify(oldCompletions.metadata));
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