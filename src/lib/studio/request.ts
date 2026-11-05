import "server-only";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { isPotentiallyCrossSiteUnsafeRequest, checkRateLimit } from "@/lib/security";
import { StudioError, record } from "./core";
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function studioAccess(request: Request, write = false) {
    if (write && isPotentiallyCrossSiteUnsafeRequest(request))
        throw new StudioError("CROSS_SITE", "Cross-site requests are blocked.", 403);
    const context = await requireCurrentAccessContext({ requireFirm: true });
    if (!context.firm)
        throw new StudioError("FIRM_REQUIRED", "An active firm is required.", 403);
    const rate = checkRateLimit({ key: `studio-read:${context.user.id}:${context.firm.id}`, limit: 120, windowMs: 60000 });
    if (!rate.allowed)
        throw new StudioError("READ_RATE", "Too many requests. Please wait before refreshing.", 429);
    return { context, userId: context.user.id, firmId: context.firm.id };
}
export type StudioScope = Pick<Awaited<ReturnType<typeof studioAccess>>, "userId" | "firmId">;
export async function limitedBytes(request: Request, maximum: number): Promise<Uint8Array> {
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > maximum)
        throw new StudioError("BODY_SIZE", "The request exceeds the upload limit.", 413);
    if (!request.body)
        return new Uint8Array();
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > maximum) {
                await reader.cancel();
                throw new StudioError("BODY_SIZE", "The request exceeds the upload limit.", 413);
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}
export async function limitedJson(request: Request, maximum = 40000) {
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
        throw new StudioError("CONTENT_TYPE", "Send application/json.", 415);
    const raw = new TextDecoder().decode(await limitedBytes(request, maximum));
    try {
        const value = JSON.parse(raw) as unknown;
        if (!value || Array.isArray(value) || typeof value !== "object")
            throw new Error();
        return record(value);
    }
    catch {
        throw new StudioError("JSON_INVALID", "The request must contain a JSON object.");
    }
}
export function failure(error: unknown): Response {
    const e = record(error);
    const isKnown = error instanceof StudioError || e.expose === true;
    const status = isKnown && typeof e.status === "number" ? e.status : 500;
    return Response.json({ ok: false, code: isKnown ? e.code : "SERVICE_ERROR", message: isKnown && error instanceof Error ? error.message : "The operation could not be completed. Your administrator can check the server logs.", requestId: error instanceof StudioError ? error.requestId : null }, { status, headers: { ...PRIVATE_HEADERS, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
