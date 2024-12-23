import axios from "axios";
import ts from "typescript/lib/tsserverlibrary";

export interface RegistryData {
    timestamp: number;
    objects: { [key: string]: string[] };
    tags: { [key: string]: string[] };
}

export class DynamicRegistry {
    private cachedData: RegistryData | undefined;
    private cachedPort: number = -1;

    public constructor() { }

    public async refreshData(port: number | undefined, logger: ts.server.Logger): Promise<void> {
        if (!port || this.cachedPort === port) { return; }
        this.cachedPort = port;
        axios.defaults.baseURL = `http://localhost:${port}`;
        this.cachedData = {
            timestamp: Date.now(),
            objects: {},
            tags: {},
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

        logger.info(`Data refreshed: ${JSON.stringify(this.cachedData)}`);
    }

    public getData(): RegistryData | undefined {
        return this.cachedData;
    }
}