export interface HighlightItem {
    item: { count: number, id: string, components?: { [key: string]: Tag } };
    string: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    block_tags: string[];
    name: string;
    icon: string;
    tags: string[];
}

type Tag = string | number | boolean | any[] | { [key: string]: any };

function resolveTagToString(tag: Tag): string {
    if (typeof tag === "string") {
        return JSON.stringify(tag);
    } else if (typeof tag === "number" || typeof tag === "boolean") {
        return tag.toString();
    } else if (Array.isArray(tag)) {
        return `[${tag.map(resolveTagToString).join(",")}]`;
    } else {
        let components = [];
        for (let key in tag) {
            components.push(`${key}=${resolveTagToString(tag[key])}`);
        }
        return `{${components.join(",")}}`;
    }
}

export function toComponentString(item: HighlightItem): string[] {
    let components = [];
    for (let key in item.item.components) {
        components.push(`${key}=${resolveTagToString(item.item.components[key])}`);
    }
    return components;
}