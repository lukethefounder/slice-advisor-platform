import { studioAccess, limitedJson, PRIVATE_HEADERS, failure } from "@/lib/studio/request";
import { marketStorage } from "@/lib/market-evidence/storage";
import { marketConfiguration } from "@/lib/market-evidence/provider";
import { MarketError } from "@/lib/market-evidence/core";
import { parseSection } from "@/lib/market-visuals/parse";
import { loadMarketSection } from "@/lib/market-visuals/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const access = await studioAccess(request), config = marketConfiguration();
    return Response.json({ ok: true, scope: `${access.userId}:${access.firmId}`, configured: Boolean(config.key) && config.key.toLowerCase() !== "demo", entitlement: config.entitlement }, { headers: PRIVATE_HEADERS });
  } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const access = await studioAccess(request, true), input = parseSection(await limitedJson(request, 2000));
    const started = performance.now();
    const result = await loadMarketSection(input, marketStorage(access), AbortSignal.any([request.signal, AbortSignal.timeout(45000)]));
    return Response.json({ ...result, scope: `${access.userId}:${access.firmId}` }, { headers: { ...PRIVATE_HEADERS, "Server-Timing": `market_section;dur=${(performance.now() - started).toFixed(1)}`, "X-Slice-Market-Section": input.section } });
  } catch (e) {
    if (e instanceof MarketError) return Response.json({ ok: false, code: e.code, message: e.message, retryAt:e.retryAt }, { status: e.status, headers: { ...PRIVATE_HEADERS, ...([409, 429].includes(e.status) ? { "Retry-After": String(e.retryAfterSeconds || 30) } : {}) } });
    return failure(e);
  }
}
