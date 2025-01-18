import axios from "axios";
import ts from "typescript/lib/tsserverlibrary";
import { toComponentString } from "./component";
import { ItemEntry, ItemSearch, ModSearch } from "./model";

export interface EntryWithDisplay {
    displayName: string,
    actual: string,
    detail?: string,
    description?: string,
}

export interface DetailEntry {
    name?: string,
    content: string,
}

export interface RegistryData {
    timestamp: number;
    objects: { [key: string]: string[] };
    tags: { [key: string]: string[] };

    // Specialized for different stuffs
    items: EntryWithDisplay[];
    mods: EntryWithDisplay[];
    recipeIds: EntryWithDisplay[];
    translations: Map<string, string>;

    // checkers
    itemMap: Map<string, ItemEntry>;
}

export class DynamicRegistry {
    private cachedData: RegistryData | undefined;
    public basePath: string | undefined;

    public constructor() { }

    public async refreshData(logger: ts.server.Logger): Promise<void> {
        this.cachedData = {
            timestamp: Date.now(),
            objects: {},
            tags: {},
            items: [],
            mods: [],
            recipeIds: [],
            translations: new Map(),
            itemMap: new Map(),
        };

        let registries = (await axios.get<string[]>("/api/registries"))?.data;
        logger.info(`baseUrl: ${axios.defaults.baseURL}`);
        logger.info(`Registries: ${registries}`);

        for (const registry of registries) {
            let [namespace, path] = registry.split(":");
            path = encodeURIComponent(path);
            let objects = (await axios.get<string[]>(`/api/registries/${namespace}/${path}/keys`))?.data;
            let tags = (await axios.get<string[]>(`/api/tags/${namespace}/${path}`))?.data;

            if (objects) { this.cachedData.objects[registry] = objects; }
            if (tags) { this.cachedData.tags[registry] = tags; }
        }

        let itemSearch = (await axios.get<ItemSearch>("/api/client/search/items?render-icons=64&tags=true"))?.data;
        this.basePath = itemSearch.icon_path_root;
        // /api/client/search/items
        for (const itemStack of itemSearch.results) {
            let actual = itemStack.id + (itemStack.components ? toComponentString(itemStack.components) : "");
            this.cachedData.items.push({
                displayName: itemStack.name,
                actual,
                detail: itemStack.id.split(":")[0],
                description: "item_stack",
            });
            this.cachedData.itemMap.set(itemStack.name, itemStack);
        }

        // /api/mods
        for (const mod of (await axios.get<ModSearch[]>("/api/mods"))?.data) {
            this.cachedData.mods.push({
                displayName: mod.name,
                actual: mod.id,
                detail: mod.version,
                description: "mod",
            });
        }

        // /api/recipe-ids
        this.cachedData.recipeIds = (await axios.get<string[]>("/api/recipe-ids"))?.data.map(id => {
            return {
                displayName: id,
                actual: id,
                description: "recipe_id",
            };
        });

        // /api/lang-keys
        for (const [key, value] of Object.entries((await axios.get<{ [key: string]: string }>("/api/lang-keys"))?.data)) {
            this.cachedData.translations.set(key, value);
        }
    }

    public getItemPath(name: string): string | undefined {
        if (!this.basePath) { return undefined; }
        let itemEntry = this.cachedData?.itemMap.get(name);
        if (!itemEntry) { return undefined; }
        return `${this.basePath}${itemEntry.icon_path}`;
    }

    public getData(): RegistryData | undefined {
        return this.cachedData;
    }
}