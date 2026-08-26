export type PublicMarketState =
  | "Live"
  | "Delayed"
  | "Closed"
  | "Stale";

export type PublicMarketEntitlement =
  | "realtime"
  | "delayed"
  | "unconfigured";

export type PublicMarketCacheStatus =
  | "network"
  | "fresh-cache"
  | "stale-cache";

export type PublicMarketSnapshot = {
  symbol: string;
  providerSymbol: string;
  assetType: "Equity";
  provider: "Alpha Vantage";
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  currency: "USD";
  marketState: PublicMarketState;
  isRealtime: boolean;
  qualityScore: number;
  providerTimestamp: string | null;
  receivedAt: string;
  warnings: string[];
};

export type PublicMarketSummarySuccess = {
  schemaVersion: "slice-public-market-summary-1.0.0";
  ok: true;
  provider: "Alpha Vantage";
  keyStatus: "verified";
  entitlement: PublicMarketEntitlement;
  generatedAt: string;
  pollAfterMs: number;
  cacheStatus: PublicMarketCacheStatus;
  requestedSymbols: string[];
  realtimeCount: number;
  delayedCount: number;
  staleCount: number;
  warnings: string[];
  snapshots: PublicMarketSnapshot[];
};

export type PublicMarketSummaryFailure = {
  schemaVersion: "slice-public-market-summary-1.0.0";
  ok: false;
  provider: "Alpha Vantage";
  keyStatus: "missing" | "unverified";
  entitlement: PublicMarketEntitlement;
  generatedAt: string;
  code:
    | "ALPHA_VANTAGE_NOT_CONFIGURED"
    | "ALPHA_VANTAGE_UNAVAILABLE"
    | "MARKET_SUMMARY_FAILED";
  message: string;
};

export type PublicMarketSummaryPayload =
  | PublicMarketSummarySuccess
  | PublicMarketSummaryFailure;