type Tag = string | number | boolean | any[] | { [key: string]: any };

function resolveTagToString(tag: Tag): string {
    return JSON.stringify(tag);
}

export function toComponentString(components: { [key: string]: Tag }): string {
    let result = [];
    for (let key in components) {
        result.push(`${key}=${resolveTagToString(components[key])}`);
    }
    return `[${result.join(",")}]`;
}