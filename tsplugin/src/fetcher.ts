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

async function getWithAuth<T>(url: string, auth: string | undefined): Promise<T | undefined> {
    if (!auth) { return undefined; }
    return (await axios.get<T>(url, { headers: { ["Authorization"]: auth } }))?.data;
}

export class DynamicRegistry {
    private cachedData: RegistryData | undefined;
    public basePath: string | undefined;
    public auth: string | undefined;

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

        let registries = (await getWithAuth<string[]>("/api/registries", this.auth)) ?? [];
        logger.info(`baseUrl: ${axios.defaults.baseURL}`);
        logger.info(`Registries: ${registries}`);

        for (const registry of registries) {
            let [namespace, path] = registry.split(":");
            path = encodeURIComponent(path);
            let objects = await getWithAuth<string[]>(`/api/registries/${namespace}/${path}/keys`, this.auth);
            let tags = await getWithAuth<string[]>(`/api/tags/${namespace}/${path}`, this.auth);

            if (objects) { this.cachedData.objects[registry] = objects; }
            if (tags) { this.cachedData.tags[registry] = tags; }
        }

        let itemSearch = await getWithAuth<ItemSearch>("/api/client/search/items?render-icons=64&tags=true", this.auth);
        if (!itemSearch) { return; }
        this.basePath = itemSearch.icon_path_root;

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

        for (const mod of (await getWithAuth<ModSearch[]>("/api/mods", this.auth)) ?? []) {
            this.cachedData.mods.push({
                displayName: mod.name,
                actual: mod.id,
                detail: mod.version,
                description: "mod",
            });
        }

        this.cachedData.recipeIds = this.processRecipeIds(
            await getWithAuth<{ [key: string]: string[] }>("/api/probejs/recipe-ids", this.auth)
        ).map(id => {
            return {
                displayName: id,
                actual: id,
                description: "recipe_id",
            };
        });

        const translations = await getWithAuth<{ [key: string]: string }>("/api/probejs/lang-keys", this.auth) ?? {};
        for (const [key, value] of Object.entries(translations)) {
            this.cachedData.translations.set(key, value);
        }
    }

    private processRecipeIds(recipeIds: { [key: string]: string[] } | undefined): string[] {
        if (!recipeIds) { return []; }
        let result: string[] = [];
        for (const values of Object.values(recipeIds)) {
            result.push(...values);
        }
        return result;
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