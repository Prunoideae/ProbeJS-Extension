import { json } from "node:stream/consumers";

/* eslint-disable @typescript-eslint/naming-convention */
interface SessionInfo {
    source?: string;
    tags?: string[];
}

type Payload = SessionInfo;

interface WSPayload {
    type: string;
    payload: Payload;
}

//----------------------------------------------------------------
interface HighlightFlags {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
}

interface ItemInfo {
    item: { id: string, count: number, components: { [key: string]: any } };
    string: string;
    name: string;
    icon: string;
    slot: number;
    component_string: string;
    tags: string[];
}

export interface ItemHighlight {
    flags: HighlightFlags;
    items: ItemInfo[];
}

interface BlockInfo {
    pos: { x: number, y: number, z: number };
    id: string;
    dimension: string;
    properties: { [key: string]: string };

    block_entity?: {
        components: { [key: string]: any };
        data: { [key: string]: any };
        id: string;
    }
}

export interface BlockHighlight {
    flags: HighlightFlags;
    block: BlockInfo;
}

interface EntityInfo {
    network_id: number;
    unique_id: string;
    data: { [key: string]: any };
    pos: { x: number, y: number, z: number };
    id: string;
    dimension: string;
}

export interface EntityHighlight {
    flags: HighlightFlags;
    entity: EntityInfo;
}


export type WSResponse = {
    type: "server/highlight/items";
    payload: ItemHighlight;
} | {
    type: "server/highlight/block";
    payload: BlockHighlight;
} | {
    type: "server/highlight/entity";
    payload: EntityHighlight;
};
export type MessageTypes = 'server/highlight/items' | 'server/highlight/block' | 'server/highlight/entity';
export type PayloadTypes = ItemHighlight | BlockHighlight | EntityHighlight;
export type PayloadMap = {
    "server/highlight/items": ItemHighlight;
    "server/highlight/block": BlockHighlight;
    "server/highlight/entity": EntityHighlight;
};

//----------------------------------------------------------------

export function encodePayload(type: string, payload: Payload): string {
    let data: WSPayload = { type, payload };
    return JSON.stringify(data).trim();
}