import { STUDIO_LIMITS, type ChatRequest, type ProviderState, type StudioMessage } from "./contracts";
import { symbols as parseSymbols } from "../market-evidence/core";
export class StudioError extends Error {
    constructor(public code: string, message: string, public status = 400, public requestId: string | null = null) { super(message); this.name = "StudioError"; }
}
export function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function text(value: unknown, max = 200): string { return typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : ""; }
export function parseChat(value: unknown): ChatRequest {
    const v = record(value), prompt = typeof v.prompt === "string" ? v.prompt.trim() : "";
    if (!prompt || prompt.includes("\0") || prompt.length > STUDIO_LIMITS.promptCharacters)
        throw new StudioError("PROMPT_LENGTH", "Enter a message of 1–8,000 characters.");
    if (typeof v.requestKey !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(v.requestKey))
        throw new StudioError("REQUEST_KEY", "The message identifier is invalid. Refresh and retry.");
    if (v.threadId !== undefined && (typeof v.threadId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(v.threadId)))
        throw new StudioError("THREAD_ID", "Invalid conversation identifier.");
    const mode = v.mode === "concise" || v.mode === "detailed" || v.mode === "balanced" ? v.mode : "balanced";
    let research: ChatRequest["research"] = null;
    if (v.research != null) {
        const r = record(v.research), symbol = text(r.symbol, 24).toUpperCase(), runId = text(r.runId, 120), horizon = text(r.horizon, 20);
        if (!/^[A-Z0-9.\-:$]{1,24}$/.test(symbol) || !/^[a-zA-Z0-9_-]{1,120}$/.test(runId) || !["5-30m", "intraday", "1d", "2-5d", "1-4w", "1-3m", "3-12m", "1-3y"].includes(horizon))
            throw new StudioError("RESEARCH_SELECTION", "Choose a symbol, saved research run, and valid horizon.");
        research = { symbol, runId, horizon };
    }
    let market: ChatRequest["market"] = null;
    if (v.market != null) {
        const m = record(v.market);
        try { market = { symbols: parseSymbols(m.symbols, 3), news: m.news === true }; }
        catch { throw new StudioError("MARKET_SELECTION", "Choose 1–3 exact ticker symbols for market evidence."); }
    }
    return { prompt, requestKey: v.requestKey, threadId: v.threadId as string | undefined, mode, research, market, evidenceMode: v.evidenceMode === "off" || v.evidenceMode === "selected" ? v.evidenceMode : "auto" };
}
export function conversationInput(messages: StudioMessage[], prompt: string) {
    // Include only complete user/assistant pairs. Interrupted answers are never training context.
    const pairs: Array<Array<{
        role: "user" | "assistant";
        content: string;
    }>> = [];
    for (let i = 0; i < messages.length - 1; i++) {
        const a = messages[i], b = messages[i + 1];
        if (a.role === "user" && a.state === "complete" && b.role === "assistant" && b.state === "complete" && a.requestKey === b.requestKey) {
            pairs.push([{ role: "user", content: a.text }, { role: "assistant", content: b.text }]);
            i++;
        }
    }
    const selected: typeof pairs = [];
    let used = prompt.length;
    for (const pair of pairs.slice(-12).reverse()) {
        const length = pair.reduce((n, m) => n + m.content.length, 0);
        if (used + length > STUDIO_LIMITS.contextCharacters)
            break;
        selected.unshift(pair);
        used += length;
    }
    return [...selected.flat(), { role: "user" as const, content: prompt }];
}
export function classifyProviderError(status: number, body: unknown): {
    state: ProviderState;
    code: string;
    message: string;
    status: number;
} {
    const e = record(record(body).error), code = text(e.code, 80).toLowerCase();
    if (status === 401 || code === "invalid_api_key")
        return { state: "invalid", code: "PROVIDER_AUTH", message: "The provider rejected the server credential. Ask the administrator to replace it and redeploy.", status: 503 };
    if (status === 403)
        return { state: "permission", code: "PROVIDER_PERMISSION", message: "This project or credential does not have permission for the requested operation.", status: 503 };
    if (code === "insufficient_quota" || code === "billing_hard_limit_reached")
        return { state: "quota", code: "PROVIDER_QUOTA", message: "The provider account has insufficient quota or billing capacity. Check the API project's billing and limits.", status: 429 };
    if (status === 429)
        return { state: "rate-limited", code: "PROVIDER_RATE", message: "The provider rate limit was reached. Wait before sending again; the message was not automatically retried.", status: 429 };
    if (status === 404 || code === "model_not_found")
        return { state: "model-unavailable", code: "PROVIDER_MODEL", message: "The configured model is unavailable to this API project. Check the model setting and project access.", status: 503 };
    if (status === 400)
        return { state: "unavailable", code: "PROVIDER_REQUEST", message: "The provider rejected this request. Check that the configured model supports the Responses API.", status: 502 };
    return { state: "unavailable", code: "PROVIDER_UNAVAILABLE", message: "The AI provider is temporarily unavailable. No substitute answer was generated.", status: 503 };
}
export function safeInternalHref(value: string): boolean { return value.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x20]/.test(value); }
export function safeExternalHref(value: string): boolean { try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
}
catch {
    return false;
} }
export function titleFromPrompt(prompt: string) { const s = prompt.replace(/\s+/g, " "); return s.length > 64 ? s.slice(0, 61) + "…" : s; }
