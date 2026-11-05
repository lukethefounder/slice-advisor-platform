import "server-only";
import { ApiError } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { checkRateLimit, getClientIp, hashForSecurity, isPotentiallyCrossSiteUnsafeRequest } from "@/lib/security";
import { StrategyError } from "./contracts";
export async function strategyAccess(request: Request, write: boolean) {
  if (write && isPotentiallyCrossSiteUnsafeRequest(request)) throw new ApiError({ status: 403, code: "CROSS_SITE_BLOCKED", message: "Cross-site requests are not permitted.", expose: true });
  const access = await requireCurrentAccessContext({ requireFirm: true });
  const rate = checkRateLimit({ key: `strategy:${write ? "write" : "read"}:${access.user.id}:${hashForSecurity(getClientIp(request))}`, limit: write ? 30 : 120, windowMs: 60000 });
  if (!rate.allowed) throw new ApiError({ status: 429, code: "RATE_LIMITED", message: "Too many research requests. Retry shortly.", expose: true });
  return access.user.id;
}
export async function readResearchJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) throw new StrategyError("JSON_REQUIRED", "Use application/json.", 415);
  const reader = request.body?.getReader(); if (!reader) throw new StrategyError("BODY_REQUIRED", "Request body is required.", 400);
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 64000) { await reader.cancel(); throw new StrategyError("BODY_TOO_LARGE", "Request exceeds 64 KB.", 413); } chunks.push(chunk.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0; for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required"); return value as Record<string, unknown>;
  } catch { throw new StrategyError("INVALID_JSON", "Provide a valid JSON object.", 400); }
}
export function strategyFailure(error: unknown): never {
  if (error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
  throw error;
}
