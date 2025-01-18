export interface ItemEntry {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    cache_key: string,
    id: string,
    name: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    icon_path: string,
    components?: { [key: string]: any },
    tags?: string[],
}

export interface ItemSearch {
    results: ItemEntry[],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    icon_path_root: string,
}

export interface ModSearch {
    id: string,
    name: string,
    version: string,
}