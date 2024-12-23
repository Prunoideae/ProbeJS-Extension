import { ProbeWebClient } from "../probe";

export interface RegistryData {
    timestamp: number;
    objects: { [key: string]: string[] };
    tags: { [key: string]: string[] };
}

export class DynamicRegistry {
    private cachedData: RegistryData | undefined;

    public constructor(readonly client: ProbeWebClient, readonly onConfigure: () => void) {
        this.client.onConnected(async () => this.onConfigure());
    }

    public async refreshData(): Promise<void> {
        this.cachedData = {
            timestamp: Date.now(),
            objects: {},
            tags: {},
        };

        let registries = (await this.client.get<string[]>("/api/registries"))?.data;

        for (const registry of registries ?? []) {
            let [namespace, path] = registry.split(":");
            path = encodeURIComponent(path);
            let objects = (await this.client.get<string[]>(`/api/registries/${namespace}/${path}/keys`))?.data;
            let tags = (await this.client.get<string[]>(`/api/tags/${namespace}/${path}`))?.data;

            if (objects) { this.cachedData.objects[registry] = objects; }
            if (tags) { this.cachedData.tags[registry] = tags; }
        }
    }

    public getData(): RegistryData | undefined {
        return this.cachedData;
    }
}
