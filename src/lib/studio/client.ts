import { record, StudioError } from "./core";
import type { StudioEvent } from "./contracts";
export async function studioJson<T>(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(timeoutMs)]), headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
    const p = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new StudioError(typeof p.code === "string" ? p.code : "REQUEST_FAILED", typeof p.message === "string" ? p.message : "The request could not be completed.", response.status);
    return p as T;
}
export async function consumeStudioStream(response: Response, onEvent: (e: StudioEvent) => void) {
    if (!response.ok) {
        const p = record(await response.json().catch(() => ({})));
        throw new StudioError(String(p.code || "REQUEST_FAILED"), typeof p.message === "string" ? p.message : "The message could not be sent.", response.status);
    }
    if (!response.body)
        throw new Error("No response stream was returned.");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", terminal = false;
    const consume = (line: string) => { if (!line.trim())
        return; const e = record(JSON.parse(line)); if (!["start", "status", "market", "delta", "complete", "failure"].includes(String(e.type)))
        return; if (e.type === "delta" && typeof e.text !== "string")
        throw new Error("Invalid message stream."); onEvent(e as StudioEvent); if (e.type === "complete" || e.type === "failure")
        terminal = true; };
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > 1000000)
                throw new Error("Response event too large.");
            let end;
            while ((end = buffer.indexOf("\n")) >= 0) {
                consume(buffer.slice(0, end));
                buffer = buffer.slice(end + 1);
            }
        }
        buffer += decoder.decode();
        if (buffer.trim())
            consume(buffer);
        if (!terminal)
            throw new Error("The response connection ended before completion. Reload to check saved history.");
    }
    finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
