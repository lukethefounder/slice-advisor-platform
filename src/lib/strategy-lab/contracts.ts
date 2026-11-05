/** Shared contracts. Vendor observations and model/backtest outputs are separate. */
export const ENGINE_VERSION = "slice-daily-event-ledger-2.0.0";
export const PROVIDER = "Alpha Vantage" as const;
export const SECTOR_ETFS = [
  { symbol: "XLK", name: "Technology" }, { symbol: "XLF", name: "Financials" },
  { symbol: "XLV", name: "Health care" }, { symbol: "XLE", name: "Energy" },
  { symbol: "XLI", name: "Industrials" }, { symbol: "XLY", name: "Consumer discretionary" },
  { symbol: "XLP", name: "Consumer staples" }, { symbol: "XLU", name: "Utilities" },
  { symbol: "XLB", name: "Materials" }, { symbol: "XLRE", name: "Real estate" },
  { symbol: "XLC", name: "Communication services" },
] as const;
export const METRICS = [
  { id: "momentumPct", label: "Trailing price return (%)", defaultPeriod: 63, min: -100, max: 10000 },
  { id: "relativeMomentumPct", label: "Return minus benchmark (percentage points)", defaultPeriod: 63, min: -10000, max: 10000 },
  { id: "distanceSmaPct", label: "Distance above/below moving average (%)", defaultPeriod: 200, min: -100, max: 10000 },
  { id: "distanceEmaPct", label: "Distance above/below exponential average (%)", defaultPeriod: 50, min: -100, max: 10000 },
  { id: "rsi", label: "RSI (simple-window, 0–100)", defaultPeriod: 14, min: 0, max: 100 },
  { id: "volatilityPct", label: "Annualized trailing volatility (%)", defaultPeriod: 21, min: 0, max: 10000 },
  { id: "drawdownPct", label: "Drawdown from trailing closing high (%)", defaultPeriod: 63, min: -100, max: 0 },
  { id: "breakoutPct", label: "Distance above prior closing high (%)", defaultPeriod: 50, min: -100, max: 10000 },
  { id: "averageDollarVolume", label: "Average daily dollar volume (USD)", defaultPeriod: 20, min: 0, max: 1e15 },
  { id: "atrPct", label: "Average true range / close (%)", defaultPeriod: 14, min: 0, max: 10000 },
  { id: "rawClose", label: "As-traded close (USD)", defaultPeriod: 2, min: 0, max: 1e9 },
] as const;
export type Metric = typeof METRICS[number]["id"];
export type Comparator = ">" | ">=" | "<" | "<=" | "between" | "crossesAbove" | "crossesBelow";
export type Rule = { metric: Metric; period: number; comparator: Comparator; value: number; upper?: number; subject?: "instrument" | "benchmark" };
export type RuleSet = { mode: "all" | "any"; rules: Rule[]; groups?: RuleSet[] };
export type AllocationGroup = { name: string; symbols: string[]; maxExposurePct: number };
export type StrategySpec = {
  version: 1 | 2; name: string; template: string;
  universeMode: "sector-etfs" | "fixed-symbols"; symbols: string[]; benchmark: string;
  startDate: string; endDate: string; initialCapital: number;
  entry: RuleSet; exit: RuleSet;
  regime?: RuleSet; allocationGroups?: AllocationGroup[];
  ranking: "momentum" | "low-volatility" | "relative-strength" | "alphabetical";
  rankingPeriod: number; weighting: "equal" | "inverse-volatility";
  rebalance: "once" | "daily" | "weekly" | "monthly" | "quarterly";
  maxHoldings: number; maxPositionPct: number; maxExposurePct: number;
  trailingStopPct: number | null; maxHoldingSessions: number | null;
  portfolioStopPct: number | null; cooldownSessions: number;
  feeBps: number; slippageBps: number; commissionUsd: number;
  riskFreeRatePct: number; acknowledgeFixedUniverse: boolean;
};
export type DailyBar = {
  date: string; open: number; high: number; low: number; close: number;
  adjustedClose: number; volume: number; dividend: number; split: number;
};
export type Dataset = {
  id: string; provider: typeof PROVIDER; symbol: string; currency: "USD";
  retrievedAt: string; sourceSha256: string; bars: DailyBar[];
};
export type DatasetManifest = {
  id: string; provider: typeof PROVIDER; symbol: string; currency: "USD";
  retrievedAt: string; sourceSha256: string; firstDate: string; lastDate: string; barCount: number;
  vintage: "vendor-current-history";
};
export type Trade = {
  date: string; signalDate: string; symbol: string; side: "BUY" | "SELL";
  shares: number; rawOpen: number; fillPrice: number; notional: number;
  fee: number; slippage: number; reason: string;
};
export type ActionEvent = { date: string; symbol: string; type: "SPLIT" | "DIVIDEND"; value: number; shares: number; cash: number };
export type EquityPoint = { date: string; equity: number; cash: number; invested: number; drawdownPct: number; dailyReturnPct: number; weights: Record<string, number> };
export type Performance = {
  totalReturnPct: number; cagrPct: number | null; maxDrawdownPct: number;
  annualizedVolatilityPct: number | null; sharpe: number | null;
  dailyWinRatePct: number | null; tradeCount: number; fees: number; slippage: number;
  dividends: number; averageExposurePct: number; finalEquity: number;
};
export type BacktestResult = {
  version: 1; engineVersion: string; classification: "hypothetical-historical-simulation";
  spec: StrategySpec; effectiveStart: string; effectiveEnd: string; signalWarmupSessions: number;
  manifests: DatasetManifest[]; strategy: Performance; benchmark: Performance;
  equity: EquityPoint[]; benchmarkEquity: EquityPoint[]; trades: Trade[];
  corporateActions: ActionEvent[]; warnings: string[]; interpretation: string[];
  monthly: { month: string; strategyPct: number; benchmarkPct: number }[];
};
export class StrategyError extends Error {
  constructor(public code: string, message: string, public status = 422, public retryAfterSeconds?: number) { super(message); this.name = "StrategyError"; }
}
export function manifestOf(d: Dataset): DatasetManifest {
  return { id: d.id, provider: d.provider, symbol: d.symbol, currency: d.currency,
    retrievedAt: d.retrievedAt, sourceSha256: d.sourceSha256,
    firstDate: d.bars[0]?.date ?? "", lastDate: d.bars.at(-1)?.date ?? "", barCount: d.bars.length,
    vintage: "vendor-current-history" };
}
export function defaultSpec(): StrategySpec {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 3);
  return { version: 2, name: "Sector momentum", template: "sector-momentum", universeMode: "sector-etfs",
    symbols: ["XLK", "XLF", "XLV", "XLE", "XLI"], benchmark: "SPY",
    startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), initialCapital: 100000,
    entry: { mode: "all", rules: [{ metric: "distanceSmaPct", period: 200, comparator: ">", value: 0 },
      { metric: "momentumPct", period: 63, comparator: ">", value: 0 }] },
    exit: { mode: "any", rules: [{ metric: "distanceSmaPct", period: 200, comparator: "<", value: 0 }] },
    ranking: "momentum", rankingPeriod: 63, weighting: "equal", rebalance: "monthly",
    maxHoldings: 3, maxPositionPct: 34, maxExposurePct: 100,
    trailingStopPct: null, maxHoldingSessions: null, portfolioStopPct: null, cooldownSessions: 1,
    feeBps: 2, slippageBps: 5, commissionUsd: 0, riskFreeRatePct: 0, acknowledgeFixedUniverse: false };
}
export const TEMPLATES = [
  { id: "sector-momentum", name: "Sector momentum", description: "Rank chosen sector ETFs by trailing return, with a long-term trend filter." },
  { id: "trend-following", name: "Trend following", description: "Hold when price is above a selected moving average; move to cash when it falls below." },
  { id: "mean-reversion", name: "Mean reversion", description: "Buy low RSI readings in a positive long-term trend; exit on recovery." },
  { id: "low-volatility", name: "Low volatility", description: "Rank the chosen basket by trailing volatility and apply inverse-volatility weights." },
  { id: "buy-and-hold", name: "Buy and hold", description: "Allocate once; keep dividends as cash. Useful as an additional comparison." },
  { id: "custom", name: "Custom rules", description: "Build your own entry, exit, ranking, sizing, cost, and risk rules." },
] as const;
export function templateSpec(id: string, prior: StrategySpec = defaultSpec()): StrategySpec {
  const base = defaultSpec(); const s: StrategySpec = { ...base, name: TEMPLATES.find(t => t.id === id)?.name ?? "Custom strategy",
    template: id, symbols: [...prior.symbols], universeMode: prior.universeMode, startDate: prior.startDate,
    endDate: prior.endDate, initialCapital: prior.initialCapital, benchmark: prior.benchmark, acknowledgeFixedUniverse: prior.acknowledgeFixedUniverse };
  if (id === "trend-following") { s.entry.rules = [{ metric: "distanceSmaPct", period: 200, comparator: ">", value: 0 }]; s.rebalance = "weekly"; }
  if (id === "mean-reversion") {
    s.entry.rules = [{ metric: "rsi", period: 14, comparator: "<", value: 30 }, { metric: "distanceSmaPct", period: 200, comparator: ">", value: 0 }];
    s.exit.rules = [{ metric: "rsi", period: 14, comparator: ">", value: 60 }]; s.rebalance = "daily"; s.maxHoldingSessions = 20;
  }
  if (id === "low-volatility") { s.ranking = "low-volatility"; s.weighting = "inverse-volatility"; s.rankingPeriod = 63;
    s.entry.rules = [{ metric: "volatilityPct", period: 63, comparator: "<", value: 30 }]; s.exit.rules = []; }
  if (id === "buy-and-hold") { s.entry.rules = []; s.exit.rules = []; s.ranking = "alphabetical"; s.rebalance = "once"; s.maxHoldings = prior.symbols.length; s.maxPositionPct = 100; }
  if (id === "custom") { s.entry.rules = []; s.exit.rules = []; }
  return s;
}

/** Saved version-1 simulations and registered scenarios keep their original engine. */
export function engineVersionFor(spec: Pick<StrategySpec, "version">): string {
  return spec.version === 1 ? "slice-daily-event-ledger-1.0.0" : ENGINE_VERSION;
}
