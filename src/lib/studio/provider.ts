import "server-only";
import { StudioError, classifyProviderError, record, text } from "./core";
import { sseFrames } from "./stream";
import { STUDIO_LIMITS, type ProviderHealth } from "./contracts";
export function providerConfiguration() {
    const key = (process.env.OPENAI_API_KEY || "").trim();
    const model = (process.env.OPENAI_STUDIO_MODEL || process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini").trim();
    return { key, model, transcriptionModel: (process.env.OPENAI_FAST_TRANSCRIBE_MODEL || process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe").trim() };
}
// Low reasoning effort is set only for the original GPT-5 family known to support it.
function speedOptions(model: string) { return /^gpt-5(?:-mini|-nano)?(?:-\d{4}-\d{2}-\d{2})?$/.test(model) ? { reasoning: { effort: "low" } } : {}; }
function requireKey() { const c = providerConfiguration(); if (!c.key)
    throw new StudioError("PROVIDER_MISSING", "The server AI credential is missing. Ask your administrator to configure it and restart or redeploy.", 503); return c; }
function requestHeaders(key: string, json = true) { return { Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}), ...(process.env.OPENAI_PROJECT_ID?.trim() ? { "OpenAI-Project": process.env.OPENAI_PROJECT_ID.trim() } : {}) }; }
export async function openResponse(input: {
    instructions: string;
    messages: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
    signal: AbortSignal;
    safetyIdentifier: string;
}) {
    const c = requireKey();
    const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", cache: "no-store", signal: input.signal, headers: requestHeaders(c.key), body: JSON.stringify({ model: c.model, ...speedOptions(c.model), instructions: input.instructions, input: input.messages, stream: true, store: false, max_output_tokens: 2500, safety_identifier: input.safetyIdentifier }) });
    const id = r.headers.get("x-request-id");
    if (!r.ok) {
        const mapped = classifyProviderError(r.status, await r.json().catch(() => ({})));
        throw new StudioError(mapped.code, mapped.message, mapped.status, id);
    }
    if (!r.body)
        throw new StudioError("STREAM_EMPTY", "The provider returned no response stream.", 502, id);
    return { body: r.body, requestId: id, model: c.model };
}
export async function readResponse(body: ReadableStream<Uint8Array>, signal: AbortSignal, onDelta: (delta: string) => void) {
    let output = "", complete = false;
    for await (const raw of sseFrames(body, signal)) {
        const e = record(raw), type = e.type;
        if (type === "response.output_text.delta" || type === "response.refusal.delta") {
            const delta = typeof e.delta === "string" ? e.delta : "";
            if (output.length + delta.length > STUDIO_LIMITS.responseCharacters)
                throw new StudioError("OUTPUT_LIMIT", "The response reached the Studio output limit. Start a more focused request.", 502);
            output += delta;
            onDelta(delta);
        }
        if (type === "error" || type === "response.failed") {
            const response = record(e.response), err = record(response.error || e.error || e);
            const mapped = classifyProviderError(typeof err.status === "number" ? err.status : 500, { error: err });
            throw new StudioError(mapped.code, mapped.message, mapped.status);
        }
        if (type === "response.incomplete")
            throw new StudioError("RESPONSE_INCOMPLETE", "The provider stopped before completing the answer. Partial text is retained but is not marked complete.", 502);
        if (type === "response.completed") {
            complete = true;
            break;
        }
    }
    if (!complete || !output.trim())
        throw new StudioError("STREAM_INTERRUPTED", "The provider response did not complete. Partial text is retained; no automatic retry was made.", 502);
    return output;
}
export async function testConnection(signal: AbortSignal): Promise<ProviderHealth> {
    const c = providerConfiguration(), started = Date.now();
    if (!c.key)
        return { state: "missing", configured: false, model: c.model, message: "No server AI credential is configured.", checkedAt: new Date().toISOString(), latencyMs: 0, requestId: null };
    const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", cache: "no-store", signal, headers: requestHeaders(c.key), body: JSON.stringify({ model: c.model, ...speedOptions(c.model), input: "Reply with the single word OK.", store: false, max_output_tokens: 512 }) });
    const id = r.headers.get("x-request-id"), payload = await r.json().catch(() => ({})), p = record(payload);
    const base = { configured: true, model: c.model, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, requestId: id };
    if (!r.ok) {
        const mapped = classifyProviderError(r.status, payload);
        return { ...base, state: mapped.state, message: mapped.message };
    }
    const output = Array.isArray(p.output) ? p.output : [];
    const hasText = output.some(item => Array.isArray(record(item).content) && (record(item).content as unknown[]).some(content => text(record(content).text, 100).length > 0));
    if (p.status !== "completed" || !hasText)
        return { ...base, state: "unavailable", message: "The request was accepted, but a complete text response was not returned. Model access is not yet verified." };
    return { ...base, state: "verified", message: "A real text response completed with the configured model. Audio permissions are tested separately when used." };
}
export async function transcribe(file: File, signal: AbortSignal) {
    const c = requireKey(), data = new FormData();
    data.append("file", file);
    data.append("model", c.transcriptionModel);
    data.append("response_format", "json");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", cache: "no-store", headers: requestHeaders(c.key, false), body: data, signal });
    const p = await r.json().catch(() => ({}));
    if (!r.ok) {
        const e = classifyProviderError(r.status, p);
        throw new StudioError(e.code, e.message, e.status, r.headers.get("x-request-id"));
    }
    const transcript = text(record(p).text, STUDIO_LIMITS.promptCharacters);
    if (!transcript)
        throw new StudioError("NO_SPEECH", "No clear speech was returned. Try again or type your message.", 422);
    return { text: transcript, model: c.transcriptionModel };
}
