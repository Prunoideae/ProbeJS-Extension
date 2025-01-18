export interface HighlightItem {
    item: { count: number, id: string, components?: { [key: string]: Tag } };
    string: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    block_tags: string[];
    name: string;
    icon: string;
    tags: string[];
    slot?: number;
}

export interface HighlightedItems {
    items: HighlightItem[];
    flags?: { ctrl: number, shift: number, alt: number };
}

type Tag = string | number | boolean | any[] | { [key: string]: any };

function resolveTagToString(tag: Tag): string {
    return JSON.stringify(tag);
}

export function toComponentString(item: HighlightItem): string[] {
    let components = [];
    for (let key in item.item.components) {
        components.push(`${key}=${resolveTagToString(item.item.components[key])}`);
    }
    return components;
}