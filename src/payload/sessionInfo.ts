import { WebSocket } from "ws";

interface SessionInfo {
    source: string;
    tags: string[];
}

export namespace SessionInfo {
    export function asPayloadInitializer(sessionInfo: SessionInfo): (ws: WebSocket) => Promise<void> {
        return async (ws: WebSocket) => {
            const payload = {
                type: "$",
                payload: sessionInfo
            };

            ws.send(JSON.stringify(payload));
        };
    }
}

