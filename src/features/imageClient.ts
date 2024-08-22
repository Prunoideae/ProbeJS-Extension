import * as vscode from "vscode";
import { ProbeWebClient } from "../probe";
import path = require("path");

export class ProbeImages {
    private readonly imageCache: Map<string, vscode.Uri | null> = new Map();

    constructor(readonly client: ProbeWebClient) { }

    public async getImageUri(
        url: string,
        localPath: (cacheKey: string, size: number) => string,
        size: number = 16
    ): Promise<vscode.Uri | null> {
        if (this.imageCache.has(url)) {
            return this.imageCache.get(url)!;
        }

        let resp = await this.client.get(url);
        console.log(url, resp);
        if (resp) {
            let xHeader = resp.headers['x-kubejs-cache-key'];
            console.log(xHeader);
            if (xHeader) {
                let filePath = localPath(xHeader, size);
                const workspace = vscode.workspace.workspaceFolders?.[0];
                if (workspace) {
                    filePath = path.resolve(workspace.uri.fsPath, filePath);
                    const uri = vscode.Uri.file(filePath);
                    console.log(uri);
                    this.imageCache.set(url, uri);
                    return uri;
                }
            }

        }
        this.imageCache.set(url, null);
        return null;
    }

    public clearCache() {
        this.imageCache.clear();
    }

    private static getPng(imageType: string): (cacheKey: string, size: number) => string {
        //`./local/kubejs/cache/web/img/${localPath}/${first2}/${xHeader}_${size}.png`;
        return (cacheKey: string, size: number) => {
            const first2 = cacheKey.slice(0, 2);
            return `./local/kubejs/cache/web/img/${imageType}/${first2}/${cacheKey}_${size}.png`;
        };
    }

    private static getTagGif(imageType: string): (cacheKey: string, size: number) => string {
        return (cacheKey: string, size: number) => {
            const first2 = cacheKey.slice(0, 2);
            return `./local/kubejs/cache/web/img/${imageType}_tag/${first2}/${cacheKey}_${size}.gif`;
        };
    }

    public async getImageWithComponent(type: string, id: string, components?: string, size: number = 16): Promise<vscode.Uri | null> {
        let [namespace, path] = id.split(':');
        components = components === undefined ? undefined : encodeURIComponent(components);

        let url = `/img/${size}/${type}/${namespace}/${path}`;
        if (components) {
            url += `?components=${components}`;
        }
        return await this.getImageUri(url, ProbeImages.getPng(type), size);
    }

    public async getItemImage(id: string, components?: string, size: number = 16): Promise<vscode.Uri | null> {
        return await this.getImageWithComponent("item", id, components, size);
    }

    public async getFluidImage(id: string, components?: string, size: number = 16): Promise<vscode.Uri | null> {
        return await this.getImageWithComponent("fluid", id, components, size);
    }

    public async getBlockIamge(id: string, properties: Map<string, string>, size: number = 16): Promise<vscode.Uri | null> {
        let params = [];
        for (let [key, value] of properties) {
            params.push(`${key}=${encodeURIComponent(value)}`);
        }
        let query = params.join('&');

        let [namespace, path] = id.split(':');
        let url = `/img/${size}/block/${namespace}/${path}`;
        if (query) {
            url += `?${query}`;
        }
        return await this.getImageUri(url, ProbeImages.getPng("block"), size);
    }

    public async getTagImage(type: string, namespace: string, path: string, size: number = 16): Promise<vscode.Uri | null> {
        path = encodeURIComponent(path);
        let url = `/img/${size}/${type}-tag/${namespace}/${path}`;
        return await this.getImageUri(url, ProbeImages.getTagGif(type), size);
    }

    public async getItemTagImage(namespace: string, path: string, size: number = 16): Promise<vscode.Uri | null> {
        return await this.getTagImage("item", namespace, path, size);
    }

    public async getFluidTagImage(namespace: string, path: string, size: number = 16): Promise<vscode.Uri | null> {
        return await this.getTagImage("fluid", namespace, path, size);
    }

    public async getBlockTagImage(namespace: string, path: string, size: number = 16): Promise<vscode.Uri | null> {
        return await this.getTagImage("block", namespace, path, size);
    }
}