import { studioAccess, PRIVATE_HEADERS, failure } from "@/lib/studio/request";
import { marketStorage } from "@/lib/market-evidence/storage";
import { MarketError } from "@/lib/market-evidence/core";
import { boardInstrument, boardPlan, buildBoardSnapshot, BOARD_METRICS } from "@/lib/market-visuals/board-snapshot";
import { loadMarketSection } from "@/lib/market-visuals/service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Compatibility path. Board prices now come directly from verified provider sections. */
export async function GET(request: Request) {
  try {
    const access = await studioAccess(request), url = new URL(request.url);
    const tvSymbol = (url.searchParams.get("tvSymbol") || url.searchParams.get("symbol") || "AAPL").trim().toUpperCase();
    let symbol: string;
    try { symbol = boardInstrument(tvSymbol); } catch (error) { throw new MarketError("BOARD_INSTRUMENT", error instanceof Error ? error.message : "Unsupported board instrument."); }
    const selected = [...new Set((url.searchParams.get("metrics") || "last-price,change-pct,volume,rsi-14,macd,sma-50,atr-14,directional-bias").split(","))].filter(id => (BOARD_METRICS as readonly string[]).includes(id));
    const storage = marketStorage(access), started = performance.now();
    const results = await Promise.allSettled(boardPlan(symbol, selected).map(input => loadMarketSection({ ...input, confirmOptions: false }, storage, request.signal)));
    const sections = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    if (!sections.length) throw (results.find(result => result.status === "rejected") as PromiseRejectedResult | undefined)?.reason ?? new MarketError("BOARD_EMPTY", "No verified market sections were returned.", 503);
    const snapshot = buildBoardSnapshot(symbol, tvSymbol, selected, sections);
    return Response.json({ ...snapshot, scope: `${access.userId}:${access.firmId}` }, { headers: { ...PRIVATE_HEADERS, "X-Slice-Market-Provider": "Alpha-Vantage", "Server-Timing": `board;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch (error) {
    if (error instanceof MarketError) return Response.json({ ok: false, code: error.code, message: error.message, retryAt: error.retryAt }, { status: error.status, headers: { ...PRIVATE_HEADERS, ...([409, 429].includes(error.status) ? { "Retry-After": String(error.retryAfterSeconds || 30) } : {}) } });
    return failure(error);
  }
}
