import type { AgentEvidence } from "./contracts";
import type { MarketReceipt, MarketState } from "@/lib/market-evidence/contracts";
import type { BoardSnapshot } from "@/lib/market-visuals/board-snapshot";
import type { EconomicResearchSnapshot } from "@/lib/intelligence/research-swarm-types";
import type { DatasetManifest, Performance, StrategySpec } from "@/lib/strategy-lab/contracts";

export type ResearchToolIssue = { tool: "scout" | "economy" | "charts" | "scenarios"; code: string; message: string };
export type ScoutOrigin = "top-gainers" | "top-losers" | "most-active" | "watchlist" | "research-universe";
export type ScoutCandidate = {
  symbol: string; name: string; rank: number; reason: string; origins: ScoutOrigin[];
  observedAt: string; retrievedAt: string; price: number; changePct: number | null;
  volume: number | null; state: MarketState; source: string; sourceUrl: string; sourceSha256: string;
  /** Discovery confers no trading permission. The user's separate policy remains authoritative. */
  tradableByPolicy: false;
};
export type ScoutDiscovery = {
  version: 1; checkedAt: string; candidates: ScoutCandidate[]; receipts: MarketReceipt[];
  issues: ResearchToolIssue[]; refreshAfterMs: number; scannedCount: number;
  method: string; tradingAllowlistChanged: false;
};
export type HistoricalSample = { signalDate: string; outcomeDate: string; forwardReturnPct: number };
export type HistoricalFrequency = {
  samples: number; positiveSamples: number; positiveReturnFrequencyPct: number | null;
  meanReturnPct: number | null; medianReturnPct: number | null; worstReturnPct: number | null;
  bestReturnPct: number | null; wilson95Pct: [number, number] | null;
  reliability: "unavailable" | "sparse" | "historical-only";
  firstSignalDate: string | null; lastOutcomeDate: string | null;
  observations: HistoricalSample[];
};
export type HistoricalRegime = {
  asOf: string; momentum20Pct: number; distanceSma50Pct: number; annualizedVolatility20Pct: number;
  trend: "above-sma50" | "below-sma50"; momentum: "positive" | "nonpositive";
  volatility: "higher" | "lower";
};
export type HistoricalScenario = {
  horizonSessions: 1 | 5 | 20 | 63 | 126; horizon: "short" | "medium" | "long";
  development: HistoricalFrequency; validation: HistoricalFrequency;
  classification: "historical-conditional-frequency"; calibratedForecastProbability: null;
};
export type HistoricalAnalogues = {
  version: 1; status: "available" | "insufficient"; symbol: string; manifest: DatasetManifest;
  currentRegime: HistoricalRegime | null; developmentVolatilityThresholdPct: number | null;
  validationStartDate: string | null; scenarios: HistoricalScenario[]; warnings: string[];
  method: string; basis: "vendor-adjusted closing returns before trading costs";
};
export type StrategyToolResult = {
  definitionId: string | null; source: "fixed-template" | "user-definition";
  name: string; status: "complete" | "unavailable"; spec: StrategySpec;
  runId: string | null; engineVersion: string | null; inputSha256: string | null; outputSha256: string | null;
  effectiveStart: string | null; effectiveEnd: string | null; manifests: DatasetManifest[];
  strategy: Performance | null; benchmark: Performance | null;
  development: Performance | null; validation: Performance | null; validationStartDate: string | null;
  classification: "hypothetical-historical-simulation"; warnings: string[]; error: string | null;
};
export type DeskScenarios = {
  status: "available" | "partial" | "unavailable"; symbol: string; checkedAt: string;
  manifests: DatasetManifest[]; analogues: HistoricalAnalogues | null; strategies: StrategyToolResult[];
  savedDefinitionsChecked: number; skippedDefinitions: Array<{ id: string; name: string; reason: string }>;
  benchmark: { symbol: string; asOf: string; momentum20Pct: number | null; momentum63Pct: number | null; annualizedVolatility20Pct: number | null } | null;
  issues: ResearchToolIssue[];
};
export type DeskEconomy = {
  status: "available" | "partial" | "unavailable";
  snapshot: EconomicResearchSnapshot | null;
  riskAppetite: DeskScenarios["benchmark"];
  interpretationLimits: string[];
};
export type DeskCharts = { status: "available" | "partial" | "unavailable"; snapshot: BoardSnapshot; barCount: number; historyBasis: string | null };
export type DeskResearchTools = {
  version: 1; symbol: string; checkedAt: string; economy: DeskEconomy; charts: DeskCharts;
  scenarios: DeskScenarios; evidence: AgentEvidence[]; issues: ResearchToolIssue[];
};
