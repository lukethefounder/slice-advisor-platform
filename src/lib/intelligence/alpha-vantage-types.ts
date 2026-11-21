export const ALPHA_INTRADAY_INTERVALS = [
  "1min",
  "5min",
  "15min",
  "30min",
  "60min",
] as const;

export type AlphaIntradayInterval =
  (typeof ALPHA_INTRADAY_INTERVALS)[number];

export type AlphaEntitlement =
  | "realtime"
  | "delayed"
  | null;

export type AlphaFreshnessMode =
  | "realtime"
  | "delayed"
  | "market_closed"
  | "end_of_day"
  | "stale"
  | "unavailable";

export type AlphaCacheState =
  | "network"
  | "fresh-cache"
  | "stale-cache"
  | "unavailable";

export type AlphaMarketStatus = {
  marketType: string;
  region: string;
  primaryExchanges: string;
  localOpen: string;
  localClose: string;
  currentStatus: string;
  isOpen: boolean;
  notes: string;
};

export type AlphaQuoteSnapshot = {
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number | null;
  latestTradingDay: string | null;
  /** Observation time belongs to this price, never a separately fetched series. */
  observedAt?: string | null;
  sourceKind?: "global-quote" | "intraday-bar" | "native-index-daily";
  interval?: AlphaIntradayInterval | null;
  volumeScope?: "bar" | "daily";
  /** Null means the numeric previous-close/change fields are neutral model sentinels. */
  comparisonSource?: "global-quote-previous-close" | "global-quote-close" | "daily-history-close" | "native-index-prior-close" | null;
  comparisonAsOf?: string | null;
};

export type AlphaIntradayBar = {
  timestamp: string;
  providerTimestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AlphaIntradaySnapshot = {
  interval: AlphaIntradayInterval;
  timeZone: string;
  lastRefreshed: string | null;
  bars: AlphaIntradayBar[];
  session: {
    date: string | null;
    open: number;
    high: number;
    low: number;
    latest: number;
    vwap: number;
    volume: number;
    changePercent: number;
  } | null;
};

export type AlphaCompanyOverview = {
  name: string;
  description: string;
  exchange: string;
  currency: string;
  country: string;
  sector: string;
  industry: string;
  marketCap: number | null;
  peRatio: number | null;
  pegRatio: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  eps: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  quarterlyRevenueGrowthYOY: number | null;
  quarterlyEarningsGrowthYOY: number | null;
  analystTargetPrice: number | null;
  beta: number | null;
  week52High: number | null;
  week52Low: number | null;
  movingAverage50Day: number | null;
  movingAverage200Day: number | null;
  sharesOutstanding: number | null;
  latestQuarter: string | null;
};

export type AlphaTechnicalSnapshot = {
  historyPointCount: number;
  /** Date of the newest observed daily bar; this is not the quote or retrieval time. */
  historyAsOf?: string | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  volatility20Daily: number | null;
  volatility20Annualized: number | null;
  /** Backward-compatible daily-volatility alias. */
  volatility20: number | null;
  momentum30: number | null;
  drawdownFrom60DayHigh: number | null;
  /** Backward-compatible drawdown alias. */
  drawdownFromHigh: number | null;
  averageTrueRange14: number | null;
  volumeTrendPercent: number | null;
  /** Backward-compatible volume-trend alias. */
  volumeTrend: number | null;
  trendScore: number | null;
  momentumScore: number | null;
  riskScore: number | null;
  volumeScore: number | null;
  /** Fraction of original component weight supported by actual measurements. */
  componentCoverage?: { trend: number; momentum: number; risk: number; volume: number };
  technicalSummary: string;
};

export type AlphaNewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceDomain: string;
  publishedAt: string | null;
  overallSentimentScore: number;
  overallSentimentLabel: string;
  tickerRelevance: number;
  tickerSentimentScore: number;
  tickerSentimentLabel: string;
  topics: string[];
  sentimentBasis?: "provider-ticker" | "provider-overall-index-context";
  /** Original provider response collection time; cache reads do not advance it. */
  retrievedAt?: string;
};

export type AlphaNewsSnapshot = {
  /** Latest original provider collection time; cache reads do not advance it. */
  retrievedAt?: string;
  articleCount: number;
  latestPublishedAt: string | null;
  averageSentiment: number;
  relevanceWeightedSentiment: number;
  averageRelevance: number;
  latestTitle: string;
  items: AlphaNewsItem[];
};

export type AlphaProviderIssueCode =
  | "rate_limited"
  | "entitlement_required"
  | "not_configured"
  | "unsupported"
  | "timeout"
  | "provider_error"
  | "transport_error"
  | "invalid_response";

export type AlphaNewsQueryDiagnostic = {
  query: string;
  status: "ready" | "empty" | AlphaProviderIssueCode;
  message: string;
  cacheState: AlphaCacheState;
  retrievedAt: string | null;
  returnedItems: number;
  acceptedItems: number;
};

export type AlphaFreshnessSnapshot = {
  requestedEntitlement: AlphaEntitlement;
  mode: AlphaFreshnessMode;
  isRealtime: boolean;
  isDelayed: boolean;
  providerAsOf: string | null;
  retrievedAt: string;
  ageSeconds: number | null;
  label: string;
  explanation: string;
};

export type AlphaProviderHealth = {
  configured: boolean;
  endpointCount: number;
  successfulEndpointCount: number;
  failedEndpointCount: number;
  degraded: boolean;
  recommendedPollMs: number;
  cache: Record<string, AlphaCacheState>;
  errors: Record<string, string>;
  warnings: string[];
  newsDiagnostics?: AlphaNewsQueryDiagnostic[];
  /** Original successful provider fetch time for each endpoint, including cache hits. */
  retrievedAt?: Record<string, string>;
};

export type AlphaVantageIntelligenceResponse = {
  schemaVersion: "slice-alpha-intelligence-3.0.0";
  ok: boolean;
  symbol: string;
  instrument?: import("./research-instrument").ResearchInstrumentIdentity;
  provider: "Alpha Vantage";
  retrievedAt: string;
  /** Backward-compatible alias for retrieval time. */
  updatedAt: string;
  providerAsOf: string | null;
  providerTimeZone: string;
  entitlement: AlphaEntitlement;
  market: AlphaMarketStatus | null;
  freshness: AlphaFreshnessSnapshot;
  quote: AlphaQuoteSnapshot | null;
  intraday: AlphaIntradaySnapshot | null;
  overview: AlphaCompanyOverview | null;
  technicals: AlphaTechnicalSnapshot | null;
  news: AlphaNewsSnapshot | null;
  health: AlphaProviderHealth;
  error?: string;
};
