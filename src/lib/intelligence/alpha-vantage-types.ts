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
  volume: number;
  latestTradingDay: string | null;
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
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  bookValue: number;
  dividendYield: number;
  eps: number;
  profitMargin: number;
  operatingMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  quarterlyRevenueGrowthYOY: number;
  quarterlyEarningsGrowthYOY: number;
  analystTargetPrice: number;
  beta: number;
  week52High: number;
  week52Low: number;
  movingAverage50Day: number;
  movingAverage200Day: number;
  sharesOutstanding: number;
  latestQuarter: string | null;
};

export type AlphaTechnicalSnapshot = {
  historyPointCount: number;
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
  trendScore: number;
  momentumScore: number;
  riskScore: number;
  volumeScore: number;
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
};

export type AlphaNewsSnapshot = {
  articleCount: number;
  latestPublishedAt: string | null;
  averageSentiment: number;
  relevanceWeightedSentiment: number;
  averageRelevance: number;
  latestTitle: string;
  items: AlphaNewsItem[];
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
};

export type AlphaVantageIntelligenceResponse = {
  schemaVersion: "slice-alpha-intelligence-3.0.0";
  ok: boolean;
  symbol: string;
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