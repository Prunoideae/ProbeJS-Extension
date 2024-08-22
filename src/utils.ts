interface Item {
    id: string;
    components?: string;
}

interface Fluid {
    id: string;
    components?: string;
}

enum StringType {
    item,
    itemTag,
    fluid,
    fluidTag,
    block,
    blockTag,
}

export function guessStringType(s: string) {

}

const validateResourceLocation = /^[a-z0-9_]+:[a-z0-9_\/]+$/;

export function parseItemString(s: string): Item | undefined {
    // strip off ${number}x at the start, like 1x or 64x
    let match = s.match(/^\d+x/);
    if (match) {
        s = s.substring(match[0].length);
    }
    s = s.trim();

    if (s.includes("#")) { return undefined; }

    // find first [
    let start = s.indexOf("[");
    if (start === -1) {
        if (!s.includes(":")) { s = "minecraft:" + s; }
        if (!validateResourceLocation.test(s)) { return undefined; }
        return { id: s };
    }

    if (!s.endsWith("]")) { return undefined; }


    // don't include the brackets
    let id = s.substring(0, start).trim();
    if (!id.includes(":")) { id = "minecraft:" + id; }
    if (!validateResourceLocation.test(id)) { return undefined; }
    // include the brackets
    let components = s.substring(start);
    console.log("parseItemString", id, components);
    return { id, components };
}

export function parseItemTag(s: string): [string, string] | undefined {
    if (s.startsWith("#")) { s = s.substring(1); }
    if (s.includes(" ")) { return undefined; }
    if (!s.includes(":")) { s = "minecraft:" + s; }
    console.log("parseItemTag", s, validateResourceLocation.test(s));
    if (!validateResourceLocation.test(s)) { return undefined; }
    return s.split(":") as [string, string];
}

export function parseBlockState(s: string): Map<string, string> {
    s = s.substring(1, s.length - 1);
    let map = new Map<string, string>();
    let parts = s.split(",");
    for (let part of parts) {
        let [key, value] = part.trim().split("=");
        map.set(key, value);
    }
    return map;
}