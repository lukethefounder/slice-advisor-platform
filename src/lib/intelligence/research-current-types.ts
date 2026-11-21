import type { ResearchCohort } from "./research-swarm-types";
import type { PublicResearchArticle } from "./research-public-news";

/** Immutable collection diagnostics; discovery counts never increase a scored confidence. */
export type CurrentResearchReport = {
  version: "slice-current-research-1.0.0";
  symbol: string;
  instrumentKind: "equity" | "index";
  checkedAt: string;
  windowStart: string;
  windowHours: 168;
  status: "covered" | "limited" | "incomplete";
  publication: "forecast" | "research-only";
  priceObservedAt: string | null;
  currentEvidenceCount: number;
  contextEvidenceCount: number;
  excludedEvidenceCount: number;
  scoredNewsCount: number;
  scoredPublisherCount: number;
  discoveredNewsCount: number;
  cohorts: Array<{
    cohort: ResearchCohort;
    weightPercent: number;
    confidence: number;
    eligibleCount: number;
    currentCount: number;
    contextCount: number;
    sourceCount: number;
    status: "covered" | "limited" | "missing" | "not-weighted";
  }>;
  collection: Array<{
    provider: string;
    query: string;
    status: string;
    detail: string;
    retrievedAt: string | null;
    cacheState: string;
    acceptedCount: number;
  }>;
  gaps: Array<{ code: string; description: string; action: string }>;
  discoveries: PublicResearchArticle[];
  notes: string[];
};
