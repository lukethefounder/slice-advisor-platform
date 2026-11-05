import { studioAccess, limitedJson, PRIVATE_HEADERS, failure } from "@/lib/studio/request";
import { MarketError, parseMarketRequest } from "@/lib/market-evidence/core";
import { collectMarket } from "@/lib/market-evidence/provider";
import { marketStorage, readMarketHealth, saveMarketHealth } from "@/lib/market-evidence/storage";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) { try { const scope = await studioAccess(request); return Response.json({ ok: true, market: await readMarketHealth(scope) }, { headers: PRIVATE_HEADERS }); } catch (e) { return failure(e); } }
export async function POST(request: Request) {
 try {
  const scope = await studioAccess(request, true), body = await limitedJson(request, 4000), input = parseMarketRequest(body);
  if (body.test === true && (body.confirm !== true || input.symbols.length !== 1 || input.chartSymbol || input.news)) throw new MarketError("TEST_CONFIRM", "Confirm a single-symbol provider quote test.");
  const started = Date.now(), evidence = await collectMarket(input, marketStorage(scope), AbortSignal.any([request.signal, AbortSignal.timeout(50000)]), body.test === true);
  const health = body.test === true ? await saveMarketHealth(scope, evidence) : null;
  return Response.json({ ok: true, evidence, health }, { headers: { ...PRIVATE_HEADERS, "Server-Timing": `market;dur=${Date.now() - started}` } });
 } catch (e) { if (e instanceof MarketError) return Response.json({ ok: false, code: e.code, message: e.message }, { status: e.status, headers: PRIVATE_HEADERS }); return failure(e); }
}
