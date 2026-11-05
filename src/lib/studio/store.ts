import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { StudioScope } from "./request";
import { STUDIO_LIMITS, type StudioMessage, type StudioThread, type ProviderHealth } from "./contracts";
import { StudioError, record, titleFromPrompt } from "./core";
const THREAD = "SLICE_STUDIO_THREAD_V1", USAGE = "SLICE_STUDIO_USAGE_V1";
function json(value: string): Record<string, unknown> { try {
    return record(JSON.parse(value));
}
catch {
    return {};
} }
function messages(value: unknown): StudioMessage[] {
    if (!Array.isArray(value))
        return [];
    return value.filter((m): m is StudioMessage => { const r = record(m); return typeof r.id === "string" && typeof r.text === "string" && (r.role === "user" || r.role === "assistant") && typeof r.requestKey === "string" && ["complete", "streaming", "cancelled", "failed"].includes(String(r.state)); });
}
function threadWhere(scope: StudioScope) { return { userId: scope.userId, sourceId: scope.firmId, eventType: THREAD }; }
export async function loadThread(scope: StudioScope, id: string): Promise<StudioThread> {
    const row = await prisma.backendPlatformEvent.findFirst({ where: { ...threadWhere(scope), id }, select: { id: true, title: true, status: true, metadataJson: true, updatedAt: true } });
    if (!row)
        throw new StudioError("THREAD_NOT_FOUND", "Conversation not found in this workspace.", 404);
    const payload = json(row.metadataJson);
    const list = messages(payload.messages);
    // An expired worker is displayed honestly; this read never deletes or rewrites history.
    if (Date.now() - row.updatedAt.getTime() > 120000)
        for (const message of list)
            if (message.state === "streaming")
                message.state = "cancelled";
    return { id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString(), messages: list, archived: row.status === "Archived" };
}
export async function listThreads(scope: StudioScope, before?: string) {
    const parts = before?.split("|");
    if (parts && (parts.length !== 2 || !Number.isFinite(Date.parse(parts[0])) || !/^[a-zA-Z0-9_-]{1,120}$/.test(parts[1])))
        throw new StudioError("CURSOR", "Invalid conversation cursor.");
    const rows = await prisma.backendPlatformEvent.findMany({ where: { ...threadWhere(scope), status: { not: "Archived" }, ...(parts ? { OR: [{ updatedAt: { lt: new Date(parts[0]) } }, { updatedAt: new Date(parts[0]), id: { lt: parts[1] } }] } : {}) }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 31, select: { id: true, title: true, updatedAt: true } });
    const page = rows.slice(0, 30);
    return { threads: page.map(r => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() })), nextBefore: rows.length > 30 ? `${page.at(-1)!.updatedAt.toISOString()}|${page.at(-1)!.id}` : null };
}
function positiveEnv(name: string, fallback: number, maximum: number) { const n = Number(process.env[name]); return Number.isFinite(n) && n > 0 ? Math.min(maximum, Math.floor(n)) : fallback; }
/** One paid operation per user across firm scopes. A DB compare-and-set lease works across server instances. */
export async function acquireOperation(scope: StudioScope, action: "chat" | "test" | "transcribe" | "archive") {
    const eventKey = "studio-lease", token = randomUUID(), now = new Date();
    const row = await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey } }, update: {}, create: { userId: scope.userId, eventKey, eventType: "SLICE_STUDIO_LEASE_V1", area: "AI Studio", title: "AI Studio operation lease", severity: "Info", status: "Idle", sourceType: "StudioLease", sourceId: null, metadataJson: "{}" }, select: { id: true } });
    const claimed = await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, userId: scope.userId, OR: [{ status: { not: "Running" } }, { updatedAt: { lt: new Date(now.getTime() - 120000) } }] }, data: { status: "Running", sourceId: token, metadataJson: JSON.stringify({ action, startedAt: now.toISOString() }) } });
    if (!claimed.count)
        throw new StudioError("OPERATION_RUNNING", "Another Studio operation is running. Stop or finish it before starting another.", 409);
    const release = async () => { await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, userId: scope.userId, sourceId: token }, data: { status: "Idle", sourceId: null } }); };
    try {
        if (action !== "archive") {
            // Fixed daily limits are per authenticated user, not a provider-wide invoice cap.
            const day = new Date(now);
            day.setUTCHours(0, 0, 0, 0);
            const [minute, daily] = await Promise.all([
                prisma.backendPlatformEvent.count({ where: { userId: scope.userId, eventType: USAGE, createdAt: { gte: new Date(now.getTime() - 60000) } } }),
                prisma.backendPlatformEvent.count({ where: { userId: scope.userId, eventType: USAGE, createdAt: { gte: day } } })
            ]);
            if (minute >= positiveEnv("SLICE_STUDIO_REQUESTS_PER_MINUTE", 6, 30) || daily >= positiveEnv("SLICE_STUDIO_REQUESTS_PER_DAY", 120, 1000))
                throw new StudioError("STUDIO_BUDGET", "Your AI Studio request allowance has been reached. Contact your administrator or try later.", 429);
            await prisma.backendPlatformEvent.create({ data: { userId: scope.userId, eventKey: `studio-usage:${token}`, eventType: USAGE, area: "AI Studio", title: `AI Studio ${action}`, severity: "Info", status: "Started", sourceType: "StudioOperation", sourceId: scope.firmId, metadataJson: JSON.stringify({ action, requestId: token }) } });
        }
        return { token, release };
    }
    catch (e) {
        await release().catch(() => undefined);
        throw e;
    }
}
export async function beginTurn(scope: StudioScope, input: {
    threadId?: string;
    prompt: string;
    requestKey: string;
    reference: StudioMessage["reference"];
    model: string;
}) {
    let thread: StudioThread;
    if (input.threadId) {
        thread = await loadThread(scope, input.threadId);
        if (thread.archived)
            throw new StudioError("THREAD_ARCHIVED", "Start a new conversation; this one is archived.", 409);
    }
    else {
        const eventKey = `studio-thread:${scope.firmId}:${input.requestKey}`;
        const prior = await prisma.backendPlatformEvent.findUnique({ where: { userId_eventKey: { userId: scope.userId, eventKey } }, select: { id: true } });
        if (prior)
            throw new StudioError("DUPLICATE_REQUEST", "This message was already submitted. Reload recent conversations to review it.", 409);
        const row = await prisma.backendPlatformEvent.create({ data: { userId: scope.userId, eventKey, eventType: THREAD, area: "AI Studio", title: titleFromPrompt(input.prompt), severity: "Info", status: "Ready", sourceType: "StudioConversation", sourceId: scope.firmId, metadataJson: JSON.stringify({ version: 1, messages: [] }) }, select: { id: true } });
        thread = { id: row.id, title: titleFromPrompt(input.prompt), updatedAt: new Date().toISOString(), messages: [], archived: false };
    }
    if (thread.messages.some(m => m.requestKey === input.requestKey))
        throw new StudioError("DUPLICATE_REQUEST", "This message was already submitted. Reload this conversation to review it.", 409);
    if (JSON.stringify(thread.messages).length + input.prompt.length + STUDIO_LIMITS.responseCharacters + 25000 > 600000 || thread.messages.length + 2 > STUDIO_LIMITS.messagesPerThread || thread.messages.reduce((n, m) => n + m.text.length, 0) + input.prompt.length + STUDIO_LIMITS.responseCharacters > STUDIO_LIMITS.threadCharacters)
        throw new StudioError("THREAD_FULL", "This conversation has reached its size limit. Start a new conversation; the existing history is retained.", 409);
    const createdAt = new Date().toISOString();
    const user: StudioMessage = { id: randomUUID(), role: "user", text: input.prompt, state: "complete", createdAt, requestKey: input.requestKey, reference: input.reference };
    const assistant: StudioMessage = { id: randomUUID(), role: "assistant", text: "", state: "streaming", createdAt, requestKey: input.requestKey, model: input.model, reference: input.reference };
    // Preserve abandoned turns as interrupted; never overwrite their text with a new answer.
    thread.messages = thread.messages.map(m => m.state === "streaming" ? { ...m, state: "cancelled" as const } : m);
    const previous = thread.messages;
    thread.messages = [...previous, user, assistant];
    await persistThread(scope, thread, "Running");
    return { thread, previous, user, assistant };
}
export async function persistThread(scope: StudioScope, thread: StudioThread, status = "Ready") {
    const result = await prisma.backendPlatformEvent.updateMany({ where: { ...threadWhere(scope), id: thread.id, status: { not: "Archived" } }, data: { metadataJson: JSON.stringify({ version: 1, messages: thread.messages }), status } });
    if (result.count !== 1)
        throw new StudioError("HISTORY_SAVE", "The conversation could not be saved. Copy the visible answer before leaving this page.", 409);
}
export async function archiveThread(scope: StudioScope, id: string) {
    await loadThread(scope, id);
    const lease = await acquireOperation(scope, "archive");
    try {
        await prisma.backendPlatformEvent.updateMany({ where: { ...threadWhere(scope), id }, data: { status: "Archived" } });
    }
    finally {
        await lease.release();
    }
}
export function credentialFingerprint(key: string) { return createHash("sha256").update(JSON.stringify([key, process.env.OPENAI_PROJECT_ID || ""])).digest("hex"); }
export async function saveHealth(scope: StudioScope, health: ProviderHealth, fingerprint: string) {
    const eventKey = `studio-health:${scope.firmId}`, values = { eventType: "SLICE_STUDIO_HEALTH_V1", area: "AI Studio", title: "AI provider connection", severity: "Info", status: health.state, sourceType: "StudioHealth", sourceId: scope.firmId, metadataJson: JSON.stringify({ health, fingerprint }) };
    await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey } }, update: values, create: { userId: scope.userId, eventKey, ...values } });
}
export async function readHealth(scope: StudioScope, model: string, key: string): Promise<ProviderHealth> {
    const base: ProviderHealth = { state: key ? "unverified" : "missing", configured: Boolean(key), model, message: key ? "Configured, but not recently tested. Run the connection test." : "A server credential has not been configured.", checkedAt: null, latencyMs: null, requestId: null };
    if (!key)
        return base;
    const row = await prisma.backendPlatformEvent.findUnique({ where: { userId_eventKey: { userId: scope.userId, eventKey: `studio-health:${scope.firmId}` } }, select: { metadataJson: true, updatedAt: true } });
    if (!row || Date.now() - row.updatedAt.getTime() > 300000)
        return base;
    const p = json(row.metadataJson), h = record(p.health);
    if (p.fingerprint !== credentialFingerprint(key) || h.model !== model || !["missing", "unverified", "verified", "invalid", "permission", "quota", "rate-limited", "timeout", "unavailable", "model-unavailable"].includes(String(h.state)))
        return base;
    return { ...base, state: h.state as ProviderHealth["state"], message: typeof h.message === "string" ? h.message : base.message, checkedAt: typeof h.checkedAt === "string" ? h.checkedAt : null, latencyMs: typeof h.latencyMs === "number" ? h.latencyMs : null, requestId: typeof h.requestId === "string" ? h.requestId : null };
}
