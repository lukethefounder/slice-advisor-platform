import type { ForecastResponse } from "@/lib/intelligence-forecast/types";
import type { ResearchSwarmResponse, SliceAgenticScore, ResearchGraphAnalytics } from "@/lib/intelligence/research-swarm-types";
export const HORIZONS = ["5-30m", "intraday", "1d", "2-5d", "1-4w", "1-3m", "3-12m", "1-3y"] as const;
export type CanonicalHorizon = typeof HORIZONS[number];
export type CanonicalBundle = {
  schemaVersion: "slice-canonical-bundle-1.0.0";
  id: string; symbol: string; researchRunId: string; forecastRunId: string;
  inputSha256: string; outputSha256: string; asOf: string; generatedAt: string;
  dataProvider: "Alpha Vantage"; classification: "model-estimate-not-provider-observation";
  score: SliceAgenticScore; market: ResearchSwarmResponse["market"];
  forecast: ForecastResponse; targets: Record<string, string>;
  graphAnalytics: ResearchGraphAnalytics;
  operations: Record<string, string>; warnings: string[];
};
export function selectHorizon(bundle: CanonicalBundle, horizon: string) {
  return bundle.forecast.horizons.find(h => h.horizon === horizon) ?? null;
}
export function canonicalMetric(bundle: CanonicalBundle, horizon: string) {
  const h = selectHorizon(bundle, horizon);
  return h ? { bundleId: bundle.id, researchRunId: bundle.researchRunId, symbol: bundle.symbol, horizon: h.horizon,
    asOf: bundle.asOf, targetAt: bundle.targets[h.horizon] ?? null,
    probabilityPositive: h.positiveReturnProbability, expectedReturnPct: h.expectedReturnPercent,
    expectedPrice: h.expectedPrice, low: h.expectedPriceRange.low, high: h.expectedPriceRange.high,
    confidence: h.confidence, sliceScore: bundle.score.overall } : null;
}
