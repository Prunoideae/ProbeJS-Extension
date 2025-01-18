import axios from "axios";

export class ProbeImages {
    private readonly imageCache: Map<string, string> = new Map();
    public basePath: string | undefined;
    public constructor() { }

    public async retrieveImage(
        url: string,
        pathLocator: (cacheKey: string, size: number, basePath: string) => string,
        size: number): Promise<void> {
        if (!this.basePath) { return; }

        let resp = await axios.get(url);
        let xHeader = resp.headers['x-kubejs-cache-key'];
        if (xHeader) {
            let filePath = pathLocator(xHeader, size, this.basePath);
            this.imageCache.set(url, filePath);
        }
    }

    public getImage(
        url: string,
        pathLocator: (cacheKey: string, size: number, basePath: string) => string,
        size: number = 16): string | undefined {
        // Send the request to the server, but the image is not immediately available
        if (!this.imageCache.has(url)) { this.retrieveImage(url, pathLocator, size); }
        return this.imageCache.get(url);
    }

    private static getLocator(type: string, extension: string): (cacheKey: string, size: number, basePath: string) => string {
        return (cacheKey: string, size: number, basePath: string) => {
            const first2 = cacheKey.slice(0, 2);
            return `${basePath}/${type}/${first2}/${cacheKey}_${size}.${extension}`;
        };
    }

    private getImageWithComponent(
        type: string,
        id: string,
        components?: string,
        size: number = 16): string | undefined {
        let [namespace, path] = id.split(':');

        components = components === undefined ? undefined : encodeURIComponent(components);
        let url = `/img/${size}/${type}/${namespace}/${path}`;
        if (components) { url += `?components=${components}`; }

        return this.getImage(url, ProbeImages.getLocator(type, 'png'), size);
    }

    public getItemImage(id: string, components?: string, size: number = 16): string | undefined {
        return this.getImageWithComponent('item', id, components, size);
    }

    public getFluidImage(id: string, components?: string, size: number = 16): string | undefined {
        return this.getImageWithComponent('fluid', id, components, size);
    }

    public getTagImage(type: string, namespace: string, path: string, size: number = 16): string | undefined {
        path = encodeURIComponent(path);
        let url = `/img/${size}/${type}-tag/${namespace}/${path}`;
        return this.getImage(url, ProbeImages.getLocator(`${type}_tag`, 'gif'), size);
    }
}