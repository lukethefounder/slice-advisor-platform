import type { ResearchCohort, ResearchCohortResult, ResearchConfidenceAudit, ResearchEvidence, ResearchEvidenceRobustness, ResearchScoreMethodology, ResearchWeights } from "./research-swarm-types";

const PRIVATE_PARAMETER = /(?:api[-_]?key|access[-_]?key|(?:^|[-_])key(?:$|[-_])|token|auth|password|secret|signature|(?:^|[-_])sig(?:$|[-_])|credential|session|jwt|^code$)/i;
const TRACKING_PARAMETER = /^(?:utm_.+|fbclid|gclid|msclkid|_hs.+|mc_cid|mc_eid)$/i;

/** Provenance links are public HTTP(S) URLs, never provider credentials. */
export function safeResearchSourceUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (PRIVATE_PARAMETER.test(key) || TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return "";
  }
}

/** Domains, rather than endpoint names, are the unit of publisher diversity. */
export function researchSourceIdentity(evidence: Pick<ResearchEvidence, "sourceUrl" | "source">) {
  const url = safeResearchSourceUrl(evidence.sourceUrl);
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, "") : "";
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function evidenceKeys(evidence: ResearchEvidence) {
  const url = safeResearchSourceUrl(evidence.sourceUrl);
  const narrative = evidence.kind === "news" || evidence.kind === "social-narrative" || evidence.kind === "filing";
  const prefix = `${evidence.cohort}:${evidence.symbol}:${evidence.kind}:`;
  const title = normalized(evidence.title);
  const day = evidence.asOf?.slice(0, 10) ?? "undated";
  // Measurements can share an API documentation URL without being duplicates.
  if (!narrative) return [`${prefix}${title}:${evidence.asOf ?? ""}`];
  return [
    ...(url ? [`${prefix}url:${url}`] : []),
    `${prefix}text:${title}:${day}:${title.length >= 32 ? "" : normalized(evidence.summary)}`,
  ];
}

function mergeRelatedSources(sources: NonNullable<ResearchEvidence["relatedSources"]>, primaryUrl: string) {
  const unique = new Map<string, NonNullable<ResearchEvidence["relatedSources"]>[number]>();
  for (const source of sources) {
    const url = safeResearchSourceUrl(source.url);
    if (url && url !== primaryUrl && !unique.has(url)) unique.set(url, { ...source, url });
  }
  return [...unique.values()];
}

export function deduplicateResearchEvidence(input: ResearchEvidence[], options: { evaluatedAt?: string } = {}) {
  const records: ResearchEvidence[] = [];
  const keys = new Map<string, number>();
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const timestamp = (value: string | null) => {
    const parsed = Date.parse(value ?? "");
    return Number.isFinite(parsed) ? parsed : -Number.MAX_SAFE_INTEGER;
  };
  const stableKey = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableKey(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "undefined";
  };
  // Choose a coherent original record before collapsing identities. A missing,
  // stale or future date must not hide a valid duplicate merely by arriving first.
  // Only provenance aliases/counts are merged; scores and dates are never grafted.
  const candidates = input.map(original => {
    const sourceUrl = safeResearchSourceUrl(original.sourceUrl);
    const item: ResearchEvidence = {
      ...original,
      sourceUrl,
      canonicalUrl: sourceUrl || null,
      sourceDomain: researchSourceIdentity({ ...original, sourceUrl }) || null,
      duplicateCount: original.duplicateCount ?? 0,
      relatedSources: mergeRelatedSources(original.relatedSources ?? [], sourceUrl).sort((a, b) => a.url.localeCompare(b.url)),
    };
    const freshness = researchEvidenceFreshness(item, evaluatedAt);
    const quality = bounded(item.confidence) * bounded(item.relevanceScore);
    const eligible = Boolean(item.sourceDomain) && !freshness.reason && Number.isFinite(item.score) && quality > 0;
    const temporalRank = freshness.reason === null ? 3 : freshness.reason === "stale" ? 2 : freshness.reason === "missingTimestamp" ? 1 : 0;
    return { item, eligible: Number(eligible), temporalRank, verified: Number(Boolean(item.sourceDomain)),
      observed: timestamp(item.asOf), retrieved: timestamp(item.retrievedAt), quality,
      key: `${item.id}\u0000${stableKey(item)}` };
  }).sort((a, b) => b.eligible - a.eligible || b.temporalRank - a.temporalRank || b.verified - a.verified
    || b.observed - a.observed || b.retrieved - a.retrieved || b.quality - a.quality || a.key.localeCompare(b.key));
  let duplicates = 0;
  for (const { item } of candidates) {
    const sourceUrl = item.sourceUrl;
    const identities = evidenceKeys(item);
    const existingIndex = identities.map((key) => keys.get(key)).find((index) => index !== undefined);
    if (existingIndex !== undefined) {
      duplicates += 1;
      const existing = records[existingIndex];
      const primaryUrl = existing.sourceUrl;
      const aliases = mergeRelatedSources([
        ...(existing.relatedSources ?? []),
        ...(item.relatedSources ?? []),
        { source: item.source, url: sourceUrl, asOf: item.asOf },
      ], primaryUrl).sort((a, b) => a.url.localeCompare(b.url));
      records[existingIndex] = {
        ...existing,
        duplicateCount: (existing.duplicateCount ?? 0) + (item.duplicateCount ?? 0) + 1,
        relatedSources: aliases,
      };
      for (const identity of identities) keys.set(identity, existingIndex);
      continue;
    }
    for (const identity of identities) keys.set(identity, records.length);
    records.push(item);
  }
  return { evidence: records, duplicateCount: duplicates };
}

function bounded(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0; }
function rounded(value: number) { return Math.round(value * 100) / 100; }
const HOUR = 3_600_000;
export const RESEARCH_SCORING_VERSION = "slice-evidence-robust-2.2.0" as const;

/**
 * Cohort confidence already discounts publisher concentration, related factors,
 * source-removal sensitivity, age and disagreement. Applying another publisher
 * concentration multiplier after weighting those cohorts penalizes the same
 * limitation twice. Keep that limitation in the source audit and interpretation
 * checks, and cap combined confidence at the measured cohort confidence instead.
 * These engineering scores are not calibrated probabilities of a future return.
 */
type ConfidenceInputs = {
  weightedCohortConfidence: number;
  evidenceCoverage: number;
  sourceDiversity: number;
  evidenceAvailabilityPercent: number;
  contradictionPenalty: number;
  freshnessPenalty: number;
};

/** Exact, inspectable confidence composition; never a probability or override. */
export function explainResearchConfidence(input: ConfidenceInputs): Omit<ResearchConfidenceAudit, "cohorts" | "inputs"> {
  const validInputs = [input.weightedCohortConfidence, input.evidenceCoverage, input.sourceDiversity,
    input.evidenceAvailabilityPercent, input.contradictionPenalty, input.freshnessPenalty].every(Number.isFinite);
  const measured = (value: number) => validInputs ? bounded(value) : 0;
  const budget = measured(input.weightedCohortConfidence);
  const definitions = [
    { key: "cohort-support", label: "Weighted cohort confidence", value: budget, weight: 0.55 },
    { key: "coverage", label: "Observed evidence coverage", value: measured(input.evidenceCoverage), weight: 0.20 },
    { key: "source-diversity", label: "Source diversity", value: measured(input.sourceDiversity), weight: 0.10 },
    { key: "weighted-availability", label: "Evidence for selected research weights", value: measured(input.evidenceAvailabilityPercent), weight: 0.15 },
  ];
  const supportBeforePenalties = definitions.reduce((sum, row) => sum + row.value * row.weight, 0);
  const contradictionPenalty = measured(input.contradictionPenalty), freshnessPenalty = measured(input.freshnessPenalty);
  const supported = bounded(supportBeforePenalties - contradictionPenalty - freshnessPenalty);
  return {
    version: "slice-confidence-audit-1.0.0", validInputs,
    weightedCohortConfidence: budget, confidenceCap: budget,
    supportBeforePenalties, contradictionPenalty, freshnessPenalty,
    supportAfterPenalties: supported, finalConfidence: rounded(Math.min(budget, supported)),
    components: definitions.map(row => ({ ...row, contribution: row.value * row.weight })),
  };
}

export function composeResearchConfidence(input: ConfidenceInputs) {
  return explainResearchConfidence(input).finalConfidence;
}

/** These are correlation buckets, not a claim that the underlying factors are independent. */
export function researchFactorFamily(item: ResearchEvidence) {
  const context = `${item.id} ${item.title} ${item.topics.join(" ")}`.toLowerCase();
  if (item.kind === "quote" || item.kind === "intraday") return "price-structure";
  if (item.kind === "technical") {
    if (/volatility|drawdown|atr|tail.risk/.test(context)) return "price-risk";
    if (/volume|liquidity/.test(context)) return "liquidity";
    return "price-structure"; // Trend, momentum, RSI, VWAP and moving averages share price inputs.
  }
  if (item.kind === "fundamental") {
    if (/valuation|target|price.to|p\/e/.test(context)) return "valuation";
    if (/growth|revenue|earnings/.test(context)) return "company-growth";
    return "financial-quality";
  }
  if (item.kind === "economic-series") {
    if (/inflation|cpi|ppi|price.index/.test(context)) return "macro-inflation";
    if (/unemployment|payroll|employment|labor/.test(context)) return "macro-labor";
    if (/treasury|yield|federal.funds|interest|policy.rate|credit|money.supply/.test(context)) return "macro-rates-credit";
    if (/wti|brent|oil|natural.gas|commodity|copper/.test(context)) return "macro-input-costs";
    return "macro-demand";
  }
  if (/earnings|revenue|guidance|profit|financial.results/.test(context)) return "narrative-earnings";
  if (/merger|acquisition|capital.allocation|buyback/.test(context)) return "narrative-capital";
  if (/regulat|litigat|lawsuit|filing|governance|management/.test(context) || item.kind === "filing") return "narrative-governance";
  if (/product|customer|demand|supply.chain|competitor/.test(context)) return "narrative-business";
  return "narrative-market";
}

function freshnessPolicy(item: ResearchEvidence): [number, number] {
  // Half-life and maximum age in hours. Observation periods for slow releases
  // must not be judged by the clock used for intraday prices or breaking news.
  if (item.kind === "economic-series") {
    const interval = String(item.metrics.interval ?? "").toLowerCase();
    const context = `${item.id} ${item.title} ${item.topics.join(" ")}`.toLowerCase();
    if (interval === "annual") return [730 * 24, 2190 * 24];
    if (interval === "quarterly" || /gdp/.test(context)) return [270 * 24, 1095 * 24];
    if (interval === "daily" || /treasury|federal.funds|wti|brent/.test(context)) return [14 * 24, 90 * 24];
    if (interval === "weekly") return [30 * 24, 120 * 24];
    return [90 * 24, 400 * 24];
  }
  if (item.kind === "fundamental") return [90 * 24, 400 * 24];
  if (item.kind === "filing") return [30 * 24, 365 * 24];
  if (item.kind === "technical") return [96, 168];
  if (item.kind === "intraday") return [8, 96];
  if (item.kind === "quote") return [36, 168];
  if (item.kind === "social-narrative") return [12, 72];
  return [36, 168];
}

/** Reference time is frozen for the research run; retrieval never replaces observation time. */
export function researchEvidenceFreshness(item: ResearchEvidence, evaluatedAt: string) {
  const reference = Date.parse(evaluatedAt), observed = Date.parse(item.asOf ?? ""), retrieved = Date.parse(item.retrievedAt);
  if (![reference, observed, retrieved].every(Number.isFinite)) return { weight: 0, reason: "missingTimestamp" as const };
  const tolerance = 5 * 60_000;
  if (observed > reference + tolerance || retrieved > reference + tolerance || observed > retrieved + tolerance) return { weight: 0, reason: "futureTimestamp" as const };
  const age = Math.max(0, (reference - observed) / HOUR);
  const [halfLife, maximumAge] = freshnessPolicy(item);
  if (age > maximumAge) return { weight: 0, reason: "stale" as const };
  return { weight: Math.pow(0.5, age / halfLife), reason: null };
}

type WeightedValue = { value: number; weight: number };
function weightedMedian(values: WeightedValue[]) {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, row) => sum + row.weight, 0) / 2;
  let cumulative = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    cumulative += sorted[index].weight;
    if (Math.abs(cumulative - half) < 1e-12 && sorted[index + 1]) return (sorted[index].value + sorted[index + 1].value) / 2;
    if (cumulative >= half) return sorted[index].value;
  }
  return sorted.at(-1)?.value ?? 50;
}

/** Huber reweighting limits a single extreme observation without deleting its disagreement. */
function robustLocation(values: WeightedValue[]) {
  if (!values.length) return { center: 50, weights: [] as number[] };
  let center = weightedMedian(values);
  const mad = weightedMedian(values.map(row => ({ value: Math.abs(row.value - center), weight: row.weight })));
  const threshold = Math.max(10, Math.min(25, 1.5 * 1.4826 * mad));
  let weights = values.map(row => row.weight);
  for (let step = 0; step < 6; step += 1) {
    weights = values.map(row => row.weight * Math.min(1, threshold / Math.max(1e-12, Math.abs(row.value - center))));
    const total = weights.reduce((sum, value) => sum + value, 0);
    center = values.reduce((sum, row, index) => sum + row.value * weights[index], 0) / total;
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  return { center, weights: weights.map(weight => weight / total) };
}

type EligibleEvidence = { item: ResearchEvidence; source: string; family: string; quality: number; freshness: number };
type FactorBucket = { family: string; score: number; quality: number; variance: number; freshness: number; evidenceCount: number };
type SourceBucket = { domain: string; score: number; quality: number; variance: number; freshness: number; factors: FactorBucket[]; factorWeights: number[] };

function buildSourceBuckets(rows: EligibleEvidence[]) {
  const sources = new Map<string, Map<string, EligibleEvidence[]>>();
  for (const row of rows) {
    const factors = sources.get(row.source) ?? new Map<string, EligibleEvidence[]>();
    const evidence = factors.get(row.family) ?? [];
    evidence.push(row); factors.set(row.family, evidence); sources.set(row.source, factors);
  }
  return [...sources.entries()].sort(([a], [b]) => a.localeCompare(b)).map<SourceBucket>(([domain, entries]) => {
    const factors = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map<FactorBucket>(([family, evidence]) => {
      evidence.sort((a, b) => a.item.id.localeCompare(b.item.id));
      const total = evidence.reduce((sum, row) => sum + row.quality, 0);
      const score = robustLocation(evidence.map(row => ({ value: bounded(row.item.score), weight: row.quality }))).center;
      return { family, score,
        quality: evidence.reduce((sum, row) => sum + row.quality, 0) / evidence.length,
        freshness: evidence.reduce((sum, row) => sum + row.freshness * row.quality, 0) / total,
        variance: evidence.reduce((sum, row) => sum + row.quality * (bounded(row.item.score) - score) ** 2, 0) / total,
        evidenceCount: evidence.length };
    });
    const location = robustLocation(factors.map(factor => ({ value: factor.score, weight: factor.quality })));
    const total = factors.reduce((sum, factor) => sum + factor.quality, 0);
    return { domain, score: location.center, factors, factorWeights: location.weights,
      quality: total / factors.length,
      freshness: factors.reduce((sum, factor) => sum + factor.freshness * factor.quality, 0) / total,
      variance: factors.reduce((sum, factor) => sum + factor.quality * (factor.variance + (factor.score - location.center) ** 2), 0) / total };
  });
}

function composeSources(sources: SourceBucket[]) {
  if (!sources.length) return { score: 50, rawScore: 50, weights: [] as number[], quality: 0, shrinkage: 0, dispersion: 0, effectiveSources: 0, freshness: 0 };
  const location = robustLocation(sources.map(source => ({ value: source.score, weight: source.quality })));
  const total = sources.reduce((sum, source) => sum + source.quality, 0);
  const quality = sources.reduce((sum, source) => sum + source.quality ** 2, 0) / total;
  // Disagreement is measured before robust downweighting, so outliers remain visible as risk.
  const dispersion = Math.sqrt(sources.reduce((sum, source) => sum + source.quality * (source.variance + (source.score - location.center) ** 2), 0) / total);
  const effectiveSources = 1 / location.weights.reduce((sum, weight) => sum + weight ** 2, 0);
  const support = 1 - Math.exp(-effectiveSources / 2);
  const shrinkage = quality * (0.55 + 0.45 * support) * (0.65 + 0.35 * Math.exp(-Math.pow(dispersion / 32, 2)));
  return { score: 50 + (location.center - 50) * shrinkage, rawScore: location.center,
    weights: location.weights, quality, shrinkage, dispersion, effectiveSources,
    freshness: sources.reduce((sum, source) => sum + source.quality * source.freshness, 0) / total };
}

/**
 * Robust evidence synthesis: collapse correlated source/factor groups, cap outlier
 * influence, shrink weak evidence toward neutral, and audit source removal.
 * Constants are explicit engineering priors, not fitted or calibrated probabilities.
 */
export function aggregateResearchEvidence(input: ResearchEvidence[], options: { evaluatedAt?: string } = {}) {
  const measured = input.filter(item => item.kind !== "industry-context");
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  const { evidence } = deduplicateResearchEvidence(measured, { evaluatedAt });
  const exclusions = { missingTimestamp: 0, futureTimestamp: 0, stale: 0, unverifiedSource: 0, zeroQuality: 0 };
  const rows: EligibleEvidence[] = [];
  for (const item of evidence) {
    const source = researchSourceIdentity(item);
    if (!source) { exclusions.unverifiedSource += 1; continue; }
    const freshness = researchEvidenceFreshness(item, evaluatedAt);
    if (freshness.reason) { exclusions[freshness.reason] += 1; continue; }
    const quality = bounded(item.confidence) / 100 * bounded(item.relevanceScore) / 100 * freshness.weight;
    if (!Number.isFinite(item.score) || quality <= 0) { exclusions.zeroQuality += 1; continue; }
    rows.push({ item, source, family: researchFactorFamily(item), quality, freshness: freshness.weight });
  }
  const sources = buildSourceBuckets(rows), result = composeSources(sources);
  const sourceRemovals = sources.map((_, index) => composeSources(sources.filter((_, i) => i !== index)));
  const withoutSources = sources.map((source, index) => ({ domain: source.domain, weightPercent: rounded(result.weights[index] * 100),
    withoutSourceScore: rounded(sourceRemovals[index].score), impact: 0 }));
  for (const source of withoutSources) source.impact = rounded(Math.abs(source.withoutSourceScore - rounded(result.score)));
  const maximumSourceImpact = Math.max(0, ...withoutSources.map(source => source.impact));
  const maximumRawSourceImpact = Math.max(0, ...sourceRemovals.map(removal => Math.abs(removal.rawScore - result.rawScore)));
  const factorFamilies = new Map<string, { weight: number; totalScore: number; count: number; sources: Set<string> }>();
  sources.forEach((source, index) => source.factors.forEach((factor, factorIndex) => {
    const weight = result.weights[index] * source.factorWeights[factorIndex];
    const current = factorFamilies.get(factor.family) ?? { weight: 0, totalScore: 0, count: 0, sources: new Set<string>() };
    current.weight += weight; current.totalScore += weight * factor.score; current.count += factor.evidenceCount; current.sources.add(source.domain);
    factorFamilies.set(factor.family, current);
  }));
  const diversity = 0.45 + 0.3 * (1 - Math.exp(-result.effectiveSources / 3)) + 0.25 * (1 - Math.exp(-factorFamilies.size / 3));
  const confidence = rows.length ? Math.min(90, 40 + 12 * Math.sqrt(result.effectiveSources),
    100 * result.quality * diversity * Math.exp(-Math.pow(result.dispersion / 32, 2)) * (1 - Math.min(0.45, maximumRawSourceImpact / 100))) : 0;
  const robustness: ResearchEvidenceRobustness = {
    version: RESEARCH_SCORING_VERSION, evaluatedAt,
    eligibleEvidenceCount: rows.length, excludedEvidenceCount: evidence.length - rows.length,
    sourceCount: sources.length, effectiveSourceCount: rounded(result.effectiveSources),
    sourceConcentrationPercent: rounded(Math.max(0, ...result.weights) * 100),
    factorFamilyCount: factorFamilies.size, freshnessScore: rounded(result.freshness * 100),
    rawScore: rounded(result.rawScore), shrinkagePercent: rounded((1 - result.shrinkage) * 100),
    stabilityScore: rows.length ? rounded(bounded(100 - maximumSourceImpact * 4)) : 0, maximumSourceImpact,
    sourceSensitivityBand: { low: rounded(Math.min(result.score, ...withoutSources.map(source => source.withoutSourceScore))), high: rounded(Math.max(result.score, ...withoutSources.map(source => source.withoutSourceScore))), meaning: "source-removal-sensitivity-not-a-prediction-interval" },
    exclusions,
    factors: [...factorFamilies.entries()].map(([family, value]) => ({ family, label: family.replace(/-/g, " "),
      weightPercent: rounded(value.weight * 100), score: rounded(value.totalScore / value.weight),
      contribution: rounded((value.totalScore - value.weight * 50) * result.shrinkage), evidenceCount: value.count, sourceCount: value.sources.size })),
    sourceInfluence: withoutSources.sort((a, b) => b.impact - a.impact || a.domain.localeCompare(b.domain)),
  };
  return { score: rounded(result.score), confidence: rounded(confidence), dispersion: rounded(result.dispersion),
    agreement: rows.length ? rounded(bounded(100 - result.dispersion * 3.5)) : 0,
    sourceCount: sources.length, evidenceCount: rows.length, eligibleEvidenceIds: rows.map(row => row.item.id).sort(), robustness };
}

/** Removes the same publisher across all weighted cohorts for a combined score sensitivity audit. */
export function buildResearchScoreMethodology(cohorts: Record<ResearchCohort, ResearchCohortResult>, weights: ResearchWeights, evaluatedAt: string): ResearchScoreMethodology {
  const active = (["media", "technical", "economy"] as const).filter(cohort => weights[cohort] > 0);
  const score = active.reduce((sum, cohort) => sum + cohorts[cohort].score * weights[cohort], 0);
  const sourceWeights = new Map<string, number>();
  for (const cohort of active) for (const source of cohorts[cohort].robustness?.sourceInfluence ?? []) sourceWeights.set(source.domain, (sourceWeights.get(source.domain) ?? 0) + weights[cohort] * source.weightPercent / 100);
  const total = [...sourceWeights.values()].reduce((sum, value) => sum + value, 0);
  const sourceInfluence = [...sourceWeights.entries()].map(([domain, weight]) => {
    const withoutSourceScore = active.reduce((sum, cohort) => sum + weights[cohort] * (cohorts[cohort].robustness?.sourceInfluence.find(source => source.domain === domain)?.withoutSourceScore ?? cohorts[cohort].score), 0);
    return { domain, weightPercent: rounded(weight / Math.max(total, 1e-12) * 100), withoutSourceScore: rounded(withoutSourceScore), impact: rounded(Math.abs(withoutSourceScore - score)) };
  }).sort((a, b) => b.impact - a.impact || a.domain.localeCompare(b.domain));
  const maximumSourceImpact = Math.max(0, ...sourceInfluence.map(source => source.impact));
  const eligibleEvidenceCount = active.reduce((sum, cohort) => sum + (cohorts[cohort].robustness?.eligibleEvidenceCount ?? 0), 0);
  return {
    version: RESEARCH_SCORING_VERSION, evaluatedAt, semantics: "evidence-sentiment-not-outcome-probability",
    stabilityScore: eligibleEvidenceCount ? rounded(bounded(100 - maximumSourceImpact * 4)) : 0, maximumSourceImpact,
    sourceSensitivityBand: { low: rounded(Math.min(score, ...sourceInfluence.map(source => source.withoutSourceScore))), high: rounded(Math.max(score, ...sourceInfluence.map(source => source.withoutSourceScore))), meaning: "source-removal-sensitivity-not-a-prediction-interval" },
    effectiveSourceCount: total ? rounded(total ** 2 / [...sourceWeights.values()].reduce((sum, value) => sum + value ** 2, 0)) : 0,
    sourceConcentrationPercent: Math.max(0, ...sourceInfluence.map(source => source.weightPercent)),
    freshnessScore: rounded(active.reduce((sum, cohort) => sum + weights[cohort] * (cohorts[cohort].robustness?.freshnessScore ?? 0), 0)),
    eligibleEvidenceCount,
    excludedEvidenceCount: active.reduce((sum, cohort) => sum + (cohorts[cohort].robustness?.excludedEvidenceCount ?? 0), 0),
    factorFamilyCount: active.reduce((sum, cohort) => sum + (cohorts[cohort].robustness?.factorFamilyCount ?? 0), 0),
    contributions: active.map(cohort => ({ cohort, weightPercent: rounded(weights[cohort] * 100), score: cohorts[cohort].score,
      confidence: cohorts[cohort].confidence, contribution: rounded(weights[cohort] * cohorts[cohort].score),
      rawScore: cohorts[cohort].robustness?.rawScore ?? cohorts[cohort].score, shrinkagePercent: cohorts[cohort].robustness?.shrinkagePercent ?? 0 })),
    sourceInfluence,
    limitations: [
      "Freshness decay, robust weights, and neutral shrinkage are versioned engineering priors; no out-of-sample accuracy improvement is asserted.",
      "Combined confidence cannot exceed weighted cohort confidence. Publisher concentration is discounted within cohorts and remains an explicit interpretation check, without a second concentration multiplier after synthesis.",
      "Source domains and factor families are correlation proxies. Common ownership, shared upstream datasets, and latent dependencies may remain.",
      "The source-removal band measures sensitivity of the evidence score. It is not a price interval or a probability calibration result.",
      "Slow-release observation periods are age-adjusted by cadence; retrieval time alone does not establish historical publication availability.",
    ],
  };
}
