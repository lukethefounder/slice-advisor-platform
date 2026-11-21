import "server-only";
import { ApiError, apiJson } from "@/lib/api-route";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";

export function teamError(status: number, code: string, message: string) {
  return new ApiError({ status, code, message, expose: true });
}
/** Browser writes must originate from this app. Forwarded Host is not an authority. */
export function requireTeamOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin"), referrer = request.headers.get("referer");
  const expected = new URL(request.url).origin;
  try {
    if (site === "cross-site" || (origin && new URL(origin).origin !== expected) || (!origin && referrer && new URL(referrer).origin !== expected)) {
      throw new Error("origin");
    }
    if (!origin && !referrer && site !== "same-origin") throw new Error("missing origin");
  } catch { throw teamError(403, "ORIGIN_REJECTED", "Open Slice in this browser and retry the action from the platform."); }
}
export async function readTeamJson(request: Request, maximum = 16_384): Promise<Record<string, unknown>> {
  requireTeamOrigin(request);
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw teamError(415, "JSON_REQUIRED", "Use a JSON request.");
  if (Number(request.headers.get("content-length")) > maximum) throw teamError(413, "BODY_TOO_LARGE", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw teamError(400, "BODY_REQUIRED", "Request details are required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw teamError(413, "BODY_TOO_LARGE", "The request is too large."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("record");
    return parsed as Record<string, unknown>;
  } catch { throw teamError(400, "INVALID_JSON", "Request details must be a JSON object."); }
}
export async function guardTeamRate(request: Request, scope: string, key: string, limit: number, windowMs = 15 * 60_000) {
  const result = await consumeRateLimit({ scope: `team:${scope}`, key, limit, windowMs, failOpen: false });
  if (!result.allowed) throw new ApiError({ status: 429, code: "TEAM_RATE_LIMIT", message: "Too many attempts. Wait before trying again.", expose: true, details: { retryAfterSeconds: result.retryAfterSeconds } });
}
export function teamRequestIp(request: Request) { return getClientIp(request); }
/** Compatibility routes return a safe error without disclosing database failures. */
export function teamFailure(error: unknown) {
  const known = error instanceof ApiError;
  return apiJson({ ok: false, error: known ? error.message : "The team action could not complete. Refresh its status before retrying.", code: known ? error.code : "TEAM_ACTION_FAILED" }, { status: known ? error.status : 500 });
}
