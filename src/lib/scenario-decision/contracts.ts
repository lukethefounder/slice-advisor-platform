import type { BacktestResult, StrategySpec } from "@/lib/strategy-lab/contracts";
import type { MarketReceipt, MarketSeries, MarketQuote } from "@/lib/market-evidence/contracts";
import type { ScenarioAssumptions } from "@/lib/connected-research/contracts";
import type { ForwardResult } from "@/lib/connected-research/scenario-core";
export const DECISION_VERSION = "slice-decision-snapshot-1" as const;
export const EVIDENCE_SECTIONS = ["quote", "history", "news", "insiders", "institutions"] as const;
export type EvidenceSection = typeof EVIDENCE_SECTIONS[number];
export type NewsItem = { title: string; url: string; source: string; publishedAt: string; summary: string; sentiment: number | null; relevance: number | null };
export type NewsEvidence = { rows: NewsItem[]; weightedScore: number | null; scoredCount: number; note: string };
export type InsiderRow = { date: string; filingDate: string | null; symbol: string; person: string; title: string; security: string; code: string; label: string; shares: number | null; price: number | null; disclosedValue: number | null };
export type InsiderEvidence = { rows: InsiderRow[]; received: number; omitted: number; note: string };
export type InstitutionalEvidence = { fields: Array<{ field: string; value: string }>; truncated: boolean; note: string };
export type EvidenceData = { quote: MarketQuote[]; history: MarketSeries; news: NewsEvidence; insiders: InsiderEvidence; institutions: InstitutionalEvidence };
export type SavedEvidence<S extends EvidenceSection = EvidenceSection> = {
 id: string; version: 1; section: S; symbol: string; preparedAt: string; data: EvidenceData[S];
 receipts: MarketReceipt[]; sourceSnapshotId: string; outputHash: string;
};
export type ScenarioRecord = {
 id: string; name: string; sourceRunId: string; status: string; acceptedSessions: number;
 lastSession: string | null; version: number; frozenAt: string | null; earliestStart: string | null;
 lastCheckedAt: string | null; lastError: string | null; nextCheckAt: string | null;
 definitionHash?: string; resultHash?: string | null;
};
export type ScenarioDetail = {
 scenario: ScenarioRecord; spec: StrategySpec; assumptions: ScenarioAssumptions;
 result: ForwardResult | null; reviewRequired: boolean; ignoredAdjustedRevisions: number;
 shock: { returnPct: number; hypotheticalValue: number; cashWeightPct: number; rows: Array<{symbol:string;weightPct:number;shockPct:number;contributionPct:number}>; note: string };
 datasets: Array<{ id: string; symbol: string; retrievedAt: string; lastDate: string; sourceSha256: string }>;
 sources: Array<{ datasetId: string; rawSha256: string; retrievedAt: string; symbol: string; acceptedThrough: string }>;
};
export type DecisionSource = {
 runId: string; runCreatedAt: string; sourceHash: string; result: BacktestResult;
 scenario: ScenarioDetail | null;
};
export type DecisionReport = {
 version: typeof DECISION_VERSION; id: string; createdAt: string; title: string;
 requestHash: string; source: DecisionSource; evidence: SavedEvidence[]; interpretation: string[];
 limitations: string[]; outputHash: string;
};
export type RunSummary = { id: string; name: string; createdAt: string; summary: { start: string; end: string; universe: string[]; benchmark: string } };
export type ReportSummary = { id: string; title: string; createdAt: string };
export type PinnedPriceSeries={symbol:string;classification:"historical"|"registered-paper";sourceHash:string;datasetId:string;bars:Array<{date:string;open:number;high:number;low:number;close:number;volume:number}>;trades:BacktestResult["trades"];note:string};
