import type { HomePresentation } from "./home-presentation";
import type { ChartSettings, WidgetId } from "./chart-settings";
/** Browser-safe evidence contracts. Credentials never cross this boundary. */
export type MarketRange = "1D" | "1M" | "3M" | "6M" | "1Y";
export type MarketState = "realtime" | "delayed" | "end-of-day" | "stale" | "unavailable";
export type Entitlement = "realtime" | "delayed" | "historical";
export type MarketQuote = {
 symbol: string; price: number; previousClose: number | null; change: number | null; changePct: number | null;
 volume: number | null; observedAt: string; precision: "timestamp" | "date";
 endpoint: "REALTIME_BULK_QUOTES" | "GLOBAL_QUOTE" | "INDEX_DATA"; priceKind: "regular-session quote" | "extended-hours quote" | "completed index close";
 state: MarketState; note: string;
};
export type MarketBar = { at: string; close: number; open: number; high: number; low: number; volume: number | null };
export type MarketSeries = {
 symbol: string; range: MarketRange; endpoint: "TIME_SERIES_DAILY" | "TIME_SERIES_INTRADAY" | "INDEX_DATA";
 bars: MarketBar[]; providerTimeZone: string; observedAt: string; precision: "date" | "timestamp";
 requestedBars?: number; coverage?: "available" | "limited";
 state: MarketState; note: string; basis: "raw as-traded; no dividend adjustment" | "index level; not an investable total return";
};
export type MarketNews = { title: string; summary: string; url: string; source: string; publishedAt: string; symbols: string[] };
export type MarketIssue = { scope: string; code: string; message: string };
export type MarketReceipt = { endpoint: string; symbols: string[]; retrievedAt: string; cacheHit: boolean; sha256: string; cacheState?: "fresh" | "stale" | "retained"; cacheAgeMs?: number; refreshNotice?: string; retryAt?: string };
export type MarketEvidence = {
 version: "slice-market-evidence-v1"; evidenceId: string; provider: "Alpha Vantage"; preparedAt: string;
 requestedSymbols: string[]; entitlement: Entitlement; quotes: MarketQuote[]; series: MarketSeries | null;
 news: MarketNews[]; receipts: MarketReceipt[]; issues: MarketIssue[];
 comparison?: MarketSeries | null; comparisonRequested?: string | null;
 newsRequested: boolean; newsRetrieved: boolean; marketIsOpen: null; snapshots?: Array<{ section: string; symbol: string; snapshotId: string }>; delivery?: "saved" | "refreshed"; details?: Array<{ section: string; symbol: string; snapshotId: string; receipts: MarketReceipt[]; data: Record<string, unknown> }>; retrievalNote?: string;
};
export type MarketRequest = { symbols: string[]; chartSymbol?: string; range?: MarketRange; news?: boolean; comparisonSymbol?: string };
export type MarketConnection = {
 configured: boolean; entitlement: Entitlement; state: "missing" | "unverified" | "verified" | "restricted" | "rate-limited" | "unavailable";
 message: string; checkedAt: string | null; observationAt: string | null; observationState: MarketState | null;
};
export type PulsePreferences = {
 version: 1; symbols: string[]; primary: string; range: MarketRange; refreshSeconds: 0 | 60 | 180 | 600;
 motion: boolean; showNews: boolean; showResearch: boolean; showTasks: boolean; showScenarios: boolean;
 focus: "balanced" | "markets" | "clients"; dailyFocus: string;
 chart?: ChartSettings; widgetOrder?: WidgetId[]; presentation?: HomePresentation;
};
export type PreferenceResponse = { ok: true; preferences: PulsePreferences; revision: string | null; suggestedSymbols: string[]; market: MarketConnection };
