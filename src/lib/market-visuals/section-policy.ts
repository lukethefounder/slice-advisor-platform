import type { Entitlement } from "@/lib/market-evidence/contracts";
import { isIndex } from "@/lib/market-evidence/instruments";
import { MarketError } from "@/lib/market-evidence/core";
import type { SectionRequest } from "./contracts";
/** One endpoint/parameter policy for all three research surfaces. */
export function sectionPolicy(input: SectionRequest, entitlement: Entitlement) {
  const symbol = input.symbol;
  if(isIndex(symbol)) {
    if(input.section !== "quote" && input.section !== "history") throw new MarketError("INDEX_SECTION", "Native index levels have no company earnings, equity news filter, or equity options chain in this view. Choose Market or Technicals; an ETF proxy is never substituted.", 422);
    if(input.section === "history" && input.range === "1D") throw new MarketError("INDEX_INTERVAL", "Native indices use completed daily bars. Choose 1M or longer.", 422);
    return {endpoint:"INDEX_DATA",params:{symbol:symbol.slice(6),interval:"daily"} as Record<string,string>,ttlMs:3_600_000};
  }
  switch (input.section) {
    case "quote": return entitlement === "realtime"
      ? { endpoint: "REALTIME_BULK_QUOTES", params: { symbol } as Record<string, string>, ttlMs: 45_000 }
      : { endpoint: "GLOBAL_QUOTE", params: { symbol, ...(entitlement === "delayed" ? { entitlement: "delayed" } : {}) } as Record<string, string>, ttlMs: entitlement === "historical" ? 900_000 : 60_000 };
    case "history": {
      const intraday = input.range === "1D";
      if (intraday && entitlement === "historical") throw new MarketError("INTRADAY_ACCESS", "Choose a daily range or verify entitled intraday access.", 422);
      return { endpoint: intraday ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY", params: {
        symbol, outputsize: intraday || input.range === "6M" || input.range === "1Y" ? "full" : "compact",
        ...(intraday ? { interval: "5min", adjusted: "false", extended_hours: "true", entitlement } : {}),
      } as Record<string, string>, ttlMs: intraday ? 60_000 : 3_600_000 };
    }
    case "news": return { endpoint: "NEWS_SENTIMENT", params: { tickers: symbol, sort: "LATEST", limit: "30" } as Record<string, string>, ttlMs: 900_000 };
    case "fundamentals": return { endpoint: "OVERVIEW", params: { symbol } as Record<string, string>, ttlMs: 21_600_000 };
    case "earnings": return { endpoint: "EARNINGS", params: { symbol } as Record<string, string>, ttlMs: 21_600_000 };
    case "options": {
      if (!input.confirmOptions) throw new MarketError("OPTIONS_CONFIRM", "Approve the options snapshot request.");
      return { endpoint: "REALTIME_OPTIONS", params: { symbol, require_greeks: "true" } as Record<string, string>, ttlMs: 30_000 };
    }
  }
}
