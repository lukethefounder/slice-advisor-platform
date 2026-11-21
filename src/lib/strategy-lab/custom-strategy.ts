import { defaultSpec, METRICS, VERSION_3_METRICS, type Metric, type Rule, type RuleSet, type StrategySpec } from "./contracts";

export type MetricGuide = { category: "Trend" | "Momentum" | "Risk" | "Volume" | "Price"; unit: string; description: string; example: string; threshold: number };
export const METRIC_GUIDE: Record<Metric, MetricGuide> = {
  momentumPct: { category: "Momentum", unit: "%", description: "Price return over the chosen number of completed trading sessions, adjusted only for splits already observed.", example: "Above 5 means the price rose more than 5% over that window.", threshold: 0 },
  relativeMomentumPct: { category: "Momentum", unit: "percentage points", description: "The instrument's trailing return minus the benchmark's return over the same window.", example: "Above 3 means outperformance of more than 3 percentage points.", threshold: 0 },
  distanceSmaPct: { category: "Trend", unit: "%", description: "Closing price above or below its simple moving average. Zero is the moving average.", example: "Crosses above 0 detects a move through the moving average.", threshold: 0 },
  distanceEmaPct: { category: "Trend", unit: "%", description: "Closing price above or below its exponentially weighted moving average, using Slice's recorded seed convention.", example: "Below 0 places the close below its exponential average.", threshold: 0 },
  rsi: { category: "Momentum", unit: "0–100", description: "Relative strength from simple-window gains and losses. This is Slice's simple-window RSI, not Wilder smoothing.", example: "Below 30 screens for weak recent prices; above 60 can define a recovery exit.", threshold: 30 },
  volatilityPct: { category: "Risk", unit: "annualized %", description: "Sample standard deviation of daily log returns, annualized with 252 trading sessions.", example: "Below 25 limits eligibility to lower observed trailing volatility.", threshold: 25 },
  drawdownPct: { category: "Risk", unit: "% below high", description: "Closing-price decline from the highest closing price within the selected window. Values are zero or negative.", example: "Below -10 means more than 10% beneath that closing high.", threshold: -10 },
  breakoutPct: { category: "Trend", unit: "%", description: "Closing price compared with the prior window's highest close; today's close is excluded from that reference high.", example: "Above 0 identifies a close above the previous closing high.", threshold: 0 },
  averageDollarVolume: { category: "Volume", unit: "USD / session", description: "Average raw close multiplied by daily volume across the chosen window.", example: "Above 10000000 requires more than $10 million of average daily dollar volume.", threshold: 10000000 },
  atrPct: { category: "Risk", unit: "% of close", description: "Simple average true range divided by the close. Includes previous-close gaps and split normalization.", example: "Below 4 selects a trailing average range below 4% of price.", threshold: 4 },
  rawClose: { category: "Price", unit: "USD", description: "The observed as-traded closing price. The lookback field does not change this single-session value.", example: "Between 10 and 100 selects closing prices in that dollar range.", threshold: 10 },
  volumeRatio: { category: "Volume", unit: "× prior average", description: "Latest split-normalized volume divided by the average of the preceding window. The latest observation is excluded from the denominator.", example: "Above 1.5 means more than 50% more volume than the prior average. A zero-volume baseline is unavailable.", threshold: 1.5 },
  priceRangePositionPct: { category: "Momentum", unit: "0–100", description: "The close's position between the lowest low and highest high in the window, including that close. A flat range is neutral at 50.", example: "Below 20 places the close in the bottom fifth of its recent trading range.", threshold: 20 },
  bollingerZ: { category: "Price", unit: "standard deviations", description: "Close minus the rolling simple average, divided by the window's population standard deviation. A flat window gives zero.", example: "Below -2 means more than two standard deviations below the rolling average.", threshold: -2 },
  trendEfficiencyPct: { category: "Trend", unit: "0–100", description: "Absolute net price movement divided by total absolute daily movement. Zero indicates no net movement; 100 is an uninterrupted direction.", example: "Above 60 identifies a more directional path. Pair it with momentum to choose up or down.", threshold: 60 },
};

export function supportedMetrics(version: StrategySpec["version"]) {
  return METRICS.filter(metric => version === 3 || !VERSION_3_METRICS.has(metric.id));
}

export function newMetricRule(metric: Metric): Rule {
  const definition = METRICS.find(item => item.id === metric)!;
  return { metric, period: definition.defaultPeriod, comparator: ">", value: METRIC_GUIDE[metric].threshold, subject: "instrument" };
}

/** A new empty design. It does not overwrite a starter idea or a saved definition. */
export function createCustomSpec(prior: StrategySpec = defaultSpec()): StrategySpec {
  return structuredClone({ ...prior, version: 3, template: "custom", name: "My own strategy",
    entry: { mode: "all", rules: [] }, exit: { mode: "any", rules: [] }, regime: undefined,
    allocationGroups: [], stopLossPct: null, takeProfitPct: null, trailingStopPct: null,
    maxHoldingSessions: null, portfolioStopPct: null, ranking: "alphabetical", weighting: "equal" });
}

/** Explicit user action: create a current-version editable copy; keep the saved original intact. */
export function customizeSpec(prior: StrategySpec): StrategySpec {
  return structuredClone({ ...prior, version: 3, template: "custom", stopLossPct: prior.stopLossPct ?? null, takeProfitPct: prior.takeProfitPct ?? null });
}

const CONDITIONS: Record<Rule["comparator"], string> = { ">": "above", ">=": "at least", "<": "below", "<=": "at most", between: "between", crossesAbove: "crosses above", crossesBelow: "crosses below" };
export function describeRule(rule: Rule, benchmark: string): string {
  const metric = METRICS.find(item => item.id === rule.metric);
  return `${rule.subject === "benchmark" ? benchmark : "the instrument"}: ${metric?.label ?? rule.metric}${rule.metric === "rawClose" ? "" : ` (${rule.period} sessions)`} ${CONDITIONS[rule.comparator]} ${rule.value}${rule.comparator === "between" ? ` and ${rule.upper ?? rule.value}` : ""}`;
}

export function describeRuleSet(set: RuleSet, benchmark: string, empty: string): string {
  const rows = [...set.rules.map(rule => describeRule(rule, benchmark)), ...(set.groups ?? []).map(group => `(${describeRuleSet(group, benchmark, "empty group — complete before testing")})`)];
  return rows.length ? rows.join(set.mode === "all" ? " AND " : " OR ") : empty;
}
