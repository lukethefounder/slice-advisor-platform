import { manifestOf, StrategyError, type Dataset } from "@/lib/strategy-lab/contracts";
import type { HistoricalAnalogues, HistoricalFrequency, HistoricalRegime, HistoricalSample, HistoricalScenario } from "./research-tool-types";

const HORIZONS = [1, 5, 20, 63, 126] as const;
const WARMUP = 50;
const MAX_BARS = 2520;
const round = (value: number) => Math.round(value * 10000) / 10000;
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Only the prefix through `index` participates. Future bars cannot influence a historical feature. */
export function historicalFeatures(closes: number[], index: number) {
  if (index < WARMUP - 1 || index >= closes.length) return null;
  const window = closes.slice(index - WARMUP + 1, index + 1);
  if (window.some(value => !Number.isFinite(value) || value <= 0)) return null;
  const returns = closes.slice(index - 20, index + 1).slice(1).map((value, offset) => Math.log(value / closes[index - 20 + offset]));
  const average = mean(returns), variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return {
    momentum20Pct: (closes[index] / closes[index - 20] - 1) * 100,
    distanceSma50Pct: (closes[index] / mean(window) - 1) * 100,
    annualizedVolatility20Pct: Math.sqrt(variance * 252) * 100,
  };
}

function regime(features: NonNullable<ReturnType<typeof historicalFeatures>>, threshold: number, asOf: string): HistoricalRegime {
  return { asOf, momentum20Pct: round(features.momentum20Pct), distanceSma50Pct: round(features.distanceSma50Pct), annualizedVolatility20Pct: round(features.annualizedVolatility20Pct),
    trend: features.distanceSma50Pct >= 0 ? "above-sma50" : "below-sma50",
    momentum: features.momentum20Pct > 0 ? "positive" : "nonpositive", volatility: features.annualizedVolatility20Pct > threshold ? "higher" : "lower" };
}

export function summarizeHistoricalSamples(observations: HistoricalSample[]): HistoricalFrequency {
  const values = observations.map(item => item.forwardReturnPct), n = values.length, positive = values.filter(value => value > 0).length;
  if (!n) return { samples: 0, positiveSamples: 0, positiveReturnFrequencyPct: null, meanReturnPct: null, medianReturnPct: null, worstReturnPct: null, bestReturnPct: null, wilson95Pct: null, reliability: "unavailable", firstSignalDate: null, lastOutcomeDate: null, observations: [] };
  const z = 1.959963984540054, p = positive / n, denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator;
  return { samples: n, positiveSamples: positive, positiveReturnFrequencyPct: round(p * 100), meanReturnPct: round(mean(values)), medianReturnPct: round(median(values)), worstReturnPct: round(Math.min(...values)), bestReturnPct: round(Math.max(...values)),
    wilson95Pct: [round(Math.max(0, center - margin) * 100), round(Math.min(1, center + margin) * 100)],
    reliability: n < 30 ? "sparse" : "historical-only", firstSignalDate: observations[0].signalDate, lastOutcomeDate: observations.at(-1)!.outcomeDate, observations };
}

/** Fixed, auditable selector; no parameter or horizon is chosen for the best historical result. */
export function buildHistoricalAnalogues(dataset: Dataset): HistoricalAnalogues {
  const bars = dataset.bars.slice(-MAX_BARS), closes = bars.map(bar => bar.adjustedClose);
  if (bars.some((bar, index) => !/^\d{4}-\d{2}-\d{2}$/.test(bar.date) || !Number.isFinite(Date.parse(bar.date)) || new Date(bar.date).toISOString().slice(0, 10) !== bar.date || (index > 0 && bars[index - 1].date >= bar.date) || !Number.isFinite(bar.adjustedClose) || bar.adjustedClose <= 0))
    throw new StrategyError("SCENARIO_DATA", "Historical scenarios require valid, ascending, unique completed observations; no missing value was interpolated.");
  const warnings = [
    "Observed positive-return frequencies are descriptive historical evidence, not calibrated future profit probabilities or intraday forecasts.",
    "Vendor-current adjusted history can contain revisions. Features use only information through each signal date, but the dataset is not an archival point-in-time vintage and a selected surviving stock is subject to selection bias.",
    "Returns use adjusted closes before fees, slippage and taxes. Outcomes do not model executable next-open fills; Strategy Studio simulations below do.",
    "A fixed 70/30 chronological split separates development from validation. Development outcomes finish before validation starts; no validation observations set the volatility threshold. No strategy is selected by its validation result.",
    "Each horizon uses nonoverlapping observations within each partition. Wilson intervals describe sampling uncertainty under a binomial approximation; market observations remain dependent and regimes can change.",
  ];
  if (dataset.bars.length > MAX_BARS) warnings.push(`The analogy window is the most recent ${MAX_BARS} completed sessions; the full immutable import remains available in Strategy Studio.`);
  const empty: HistoricalAnalogues = { version: 1, status: "insufficient", symbol: dataset.symbol, manifest: manifestOf(dataset), currentRegime: null, developmentVolatilityThresholdPct: null, validationStartDate: null, scenarios: [], warnings,
    method: "Same sign of 20-session momentum and distance to SMA50, and same side of the development-only median 20-session annualized log-return volatility. Report every fixed horizon: 1, 5, 20, 63 and 126 sessions.", basis: "vendor-adjusted closing returns before trading costs" };
  if (bars.length < 150) { empty.warnings.push("At least 150 completed daily observations are needed for the regime split. Missing long-history scenarios are unavailable."); return empty; }
  const split = WARMUP + Math.floor((bars.length - WARMUP) * 0.7);
  const features = closes.map((_, index) => historicalFeatures(closes, index));
  const devVolatility = features.slice(WARMUP, split).flatMap(value => value ? [value.annualizedVolatility20Pct] : []);
  const threshold = median(devVolatility), latest = features.at(-1);
  if (!latest || !Number.isFinite(threshold)) return empty;
  const currentRegime = regime(latest, threshold, bars.at(-1)!.date);
  function sample(horizon: number, from: number, endExclusive: number): HistoricalFrequency {
    const observations: HistoricalSample[] = [];
    let nextEligible = from;
    for (let index = from; index + horizon < endExclusive; index++) {
      if (index < nextEligible || !features[index]) continue;
      const state = regime(features[index]!, threshold, bars[index].date);
      if (state.trend !== currentRegime.trend || state.momentum !== currentRegime.momentum || state.volatility !== currentRegime.volatility) continue;
      observations.push({ signalDate: bars[index].date, outcomeDate: bars[index + horizon].date, forwardReturnPct: round((closes[index + horizon] / closes[index] - 1) * 100) });
      nextEligible = index + horizon; // Adjacent windows can share their boundary close, not a return observation.
    }
    return summarizeHistoricalSamples(observations);
  }
  const scenarios: HistoricalScenario[] = HORIZONS.map(horizonSessions => ({ horizonSessions, horizon: horizonSessions <= 5 ? "short" : horizonSessions <= 20 ? "medium" : "long",
    development: sample(horizonSessions, WARMUP, split), validation: sample(horizonSessions, split, bars.length), classification: "historical-conditional-frequency", calibratedForecastProbability: null }));
  if (scenarios.some(row => row.validation.samples < 30)) warnings.push("One or more validation horizons have fewer than 30 matches. Treat sparse frequencies and their wide intervals as weak evidence; do not turn them into a confident trade forecast.");
  return { ...empty, status: "available", currentRegime, developmentVolatilityThresholdPct: round(threshold), validationStartDate: bars[split].date, scenarios };
}

export function benchmarkRiskAppetite(dataset: Dataset) {
  const closes = dataset.bars.map(bar => bar.adjustedClose), last = closes.length - 1, features = historicalFeatures(closes, last);
  const momentum = (period: number) => last >= period && closes[last - period] > 0 ? round((closes[last] / closes[last - period] - 1) * 100) : null;
  return { symbol: dataset.symbol, asOf: dataset.bars.at(-1)?.date ?? "", momentum20Pct: momentum(20), momentum63Pct: momentum(63), annualizedVolatility20Pct: features ? round(features.annualizedVolatility20Pct) : null };
}
