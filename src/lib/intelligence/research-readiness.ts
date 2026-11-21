import type { AlphaNewsQueryDiagnostic, AlphaVantageIntelligenceResponse } from "./alpha-vantage-types";
import type { CurrentResearchReport } from "./research-current-types";
import type { PublicResearchNewsResult } from "./research-public-news";
import type { ResearchSwarmResponse } from "./research-swarm-types";
import { deduplicateResearchEvidence, researchEvidenceFreshness, researchSourceIdentity } from "./research-evidence";

export const CURRENT_RESEARCH_WINDOW_HOURS = 168;
const HOUR = 3_600_000;
const COHORTS = ["media", "technical", "economy"] as const;
const safeDetail = (value: string) => value
  .replace(/\b(?:proxy-)?authorization\s*[:=]\s*[^\r\n]*/gi, "Authorization: [redacted]")
  .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.-]+/gi, "[redacted credential]")
  .replace(/(https?:\/\/)[^\s/@]+@/gi, "$1[redacted]@")
  .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)[^\s&]+/gi, "$1[redacted]").slice(0, 500);

/** The publication gate is unchanged: all weighted cohorts need usable scored
 * evidence. Supplemental reading is preserved without manufacturing sentiment. */
export function hasCompleteScoredResearch(research: ResearchSwarmResponse) {
  return COHORTS.every(key => research.score.weighting[key] <= 0 ||
    (research.cohorts[key].evidenceCount > 0 && research.cohorts[key].confidence > 0));
}

export function buildCurrentResearchReport(input: {
  research: ResearchSwarmResponse;
  alpha: AlphaVantageIntelligenceResponse;
  newsDiagnostics: AlphaNewsQueryDiagnostic[];
  publicNews: PublicResearchNewsResult;
}): CurrentResearchReport {
  const { research, alpha, publicNews } = input;
  const checkedAt = research.completedAt;
  const now = Date.parse(checkedAt);
  if (!Number.isFinite(now)) throw new Error("Research collection requires a valid completion timestamp.");
  const cutoff = now - CURRENT_RESEARCH_WINDOW_HOURS * HOUR;
  const measured = deduplicateResearchEvidence(research.evidence, { evaluatedAt: checkedAt }).evidence;
  const eligible = measured.filter(item => !researchEvidenceFreshness(item, checkedAt).reason &&
    researchSourceIdentity(item) && Number.isFinite(item.score) && item.confidence > 0 && item.relevanceScore > 0);
  const current = eligible.filter(item => Date.parse(item.asOf ?? "") >= cutoff);
  const currentIds = new Set(current.map(item => item.id));
  const cohorts: CurrentResearchReport["cohorts"] = COHORTS.map(cohort => {
    const rows = eligible.filter(item => item.cohort === cohort);
    const currentCount = rows.filter(item => currentIds.has(item.id)).length;
    const result = research.cohorts[cohort], weightPercent = research.score.weighting[cohort] * 100;
    return { cohort, weightPercent, confidence: result.confidence, eligibleCount: rows.length, currentCount,
      contextCount: rows.length - currentCount, sourceCount: new Set(rows.map(item => researchSourceIdentity(item))).size,
      status: weightPercent <= 0 ? "not-weighted" : !rows.length || result.confidence <= 0 ? "missing" : result.confidence < 40 ? "limited" : "covered" };
  });
  const scoredNews = current.filter(item => item.kind === "news");
  const scoredPublisherCount = new Set(scoredNews.map(item => researchSourceIdentity(item))).size;
  const collection: CurrentResearchReport["collection"] = input.newsDiagnostics.map(query => ({
    provider: "Alpha Vantage news", query: query.query, status: query.status, detail: safeDetail(query.message),
    retrievedAt: query.retrievedAt, cacheState: query.cacheState, acceptedCount: query.acceptedItems,
  }));
  collection.push(...publicNews.diagnostics.queries.map(query => ({
    provider: "Google News RSS discovery", query: query.query, status: query.status,
    detail: `${query.acceptedCount} accepted; ${Object.values(query.rejected).reduce((sum, value) => sum + value, 0)} rejected as old, undated, unrelated, unsafe, or duplicate. Discovery articles are unscored.`,
    retrievedAt: query.retrievedAt, cacheState: query.cacheState, acceptedCount: query.acceptedCount,
  })));
  collection.push(...Object.entries(alpha.health.cache).filter(([key]) => key !== "news").map(([key, cacheState]) => ({
    provider: "Alpha Vantage market data", query: key,
    status: alpha.health.errors[key] ? "unavailable" : cacheState === "unavailable" ? "unavailable" : "ready",
    detail: alpha.health.errors[key] ? safeDetail(alpha.health.errors[key]) : "Observation dates are retained on the source evidence.",
    retrievedAt: alpha.health.retrievedAt?.[key] ?? null, cacheState, acceptedCount: 0,
  })));
  collection.push(...research.economy.series.map(series => ({
    provider: "Alpha Vantage economic data", query: series.label,
    status: series.latestValue === null || series.confidence <= 0 ? "unavailable" : "ready",
    detail: safeDetail(series.warning || `Latest ${series.interval} observation period: ${series.asOf ?? "unknown"}.`),
    retrievedAt: series.retrievedAt, cacheState: "provider-series", acceptedCount: series.latestValue === null ? 0 : 1,
  })));
  const gaps: CurrentResearchReport["gaps"] = [];
  for (const cohort of cohorts.filter(row => row.status === "missing")) gaps.push({
    code: `missing-${cohort.cohort}`,
    description: `The ${cohort.cohort} allocation has no usable scored evidence for its ${cohort.weightPercent.toFixed(1)}% weight.`,
    action: "Review the collection results below, restore the required provider access, then refresh this research. Your selected weights have been preserved.",
  });
  const failures = collection.filter(query => !["ready", "ok", "empty"].includes(query.status));
  if (failures.length) gaps.push({ code: "provider-availability", description: `${failures.length} provider queries could not supply usable results.`,
    action: "The query log identifies access, rate-limit, transport, or unsupported-data failures. Public discoveries remain available separately; retry after the reported provider issue is resolved." });
  if (research.score.weighting.media > 0 && scoredNews.length === 0) gaps.push({ code: "no-current-scored-news",
    description: publicNews.articles.length ? `${publicNews.articles.length} current public articles were found, but no eligible provider-scored articles were returned.` : "No eligible company- or index-specific scored news was found in the latest seven days.",
    action: publicNews.articles.length ? "Read the discovered sources below. Headlines are not assigned invented sentiment or counted as scored evidence." : "Review the instrument identity and the provider query results. A quiet news week and an unavailable provider are different conditions." });
  else if (research.score.weighting.media > 0 && scoredPublisherCount < 3) gaps.push({ code: "limited-news-diversity",
    description: `Current scored news comes from ${scoredPublisherCount} publisher domain${scoredPublisherCount === 1 ? "" : "s"}.`,
    action: "Review the independent discoveries and shared-source cautions. Repeated coverage or more analytical agents does not create new independent evidence." });
  if (research.score.confidence < 40 && !cohorts.some(row => row.status === "missing")) gaps.push({ code: "weak-support",
    description: "The selected cohorts contain evidence, but their relevance, freshness, source independence, or agreement provides limited support for a current interpretation.",
    action: "Inspect each cohort’s confidence and the source-sensitivity audit. Current information can still conflict; a refresh cannot guarantee a stronger conclusion." });
  const complete = hasCompleteScoredResearch(research);
  return {
    version: "slice-current-research-1.0.0", symbol: research.symbol, instrumentKind: alpha.instrument?.kind ?? "equity",
    checkedAt, windowStart: new Date(cutoff).toISOString(), windowHours: 168,
    status: !complete ? "incomplete" : gaps.length ? "limited" : "covered",
    publication: complete ? "forecast" : "research-only", priceObservedAt: research.providerAsOf,
    currentEvidenceCount: current.length, contextEvidenceCount: eligible.length - current.length,
    excludedEvidenceCount: measured.length - eligible.length, scoredNewsCount: scoredNews.length, scoredPublisherCount,
    discoveredNewsCount: publicNews.articles.length, cohorts, collection, gaps,
    discoveries: publicNews.articles,
    notes: [
      "The current evidence window uses original publication or observation dates, never the time a cache was read. News, prices, and technical observations older than seven days cannot qualify as current evidence.",
      "Quarterly financial statements and monthly, quarterly, or annual economic series are latest-available historical context. Their original periods remain visible; they are not relabeled as this week’s observations.",
      "Public discovery articles are separate reading material. They do not change the research score, confidence, or modeled probabilities. Feed-reported publisher attribution is labeled separately from a direct publisher link.",
      "Coverage depends on the exact instrument, publications available, and provider entitlements. Collection completeness and confidence in an investment conclusion are different measures.",
      ...research.economy.warnings.map(safeDetail),
      ...publicNews.diagnostics.warnings.map(safeDetail),
    ],
  };
}
