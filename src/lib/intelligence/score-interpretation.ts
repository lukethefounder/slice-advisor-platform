import type { CanonicalBundle, CanonicalHorizon, ResearchOnlyBundle } from "@/lib/intelligence-unified/contracts";
import type { ForecastResponse } from "@/lib/intelligence-forecast/types";
import type { ResearchCohort, ResearchSwarmResponse, SliceAgenticScore } from "./research-swarm-types";
import type { CurrentResearchReport } from "./research-current-types";

/** Interpretation rules are explicit review thresholds, not an empirically calibrated trading model. */
export const SCORE_INTERPRETATION_POLICY = {
  version: "slice-score-interpretation-1.2.0",
  minimumConfidence: 40,
  favorableConfidence: 60,
  minimumCoverage: 40,
  favorableCoverage: 60,
  favorableProbability: 55,
  unfavorableProbability: 45,
  maximumResearchAgeMs: 24 * 60 * 60 * 1000,
  maximumProviderAgeMs: 168 * 60 * 60 * 1000,
  futureClockToleranceMs: 5 * 60 * 1000,
} as const;

export const SCORE_BANDS = [
  { id: "strongly-bearish", label: "Strongly bearish", range: "0–28", description: "Strong adverse evidence. Avoid a new long position until the investment case materially improves.", tone: "negative" },
  { id: "bearish", label: "Bearish", range: ">28–42", description: "Risks outweigh supporting evidence. Review existing exposure and seek a stronger entry case.", tone: "negative" },
  { id: "neutral", label: "Neutral / mixed", range: ">42–<58", description: "No clear directional advantage. Keep on the watchlist and wait for corroborating evidence.", tone: "neutral" },
  { id: "bullish", label: "Bullish", range: "58–<72", description: "Supporting evidence leads. Consider a long investment only when current data and the selected forecast agree.", tone: "positive" },
  { id: "strongly-bullish", label: "Strongly bullish", range: "72–100", description: "Strong favorable evidence. Still check valuation, downside, data quality, and position suitability.", tone: "positive" },
] as const;
export type ScoreBand = typeof SCORE_BANDS[number];
export type ResearchStance = "favorable" | "watch" | "unfavorable" | "insufficient";
type Context = {
  symbol: string;
  score: SliceAgenticScore | null;
  horizon: CanonicalHorizon;
  forecast?: ForecastResponse | null;
  evidenceAudit?: string | null;
  market?: ResearchSwarmResponse["market"] | null;
  targetAt?: string | null;
  currentResearch?: CurrentResearchReport | null;
  researchOnly?: boolean;
  nowMs: number;
};
type CohortExplanation = {
  key: ResearchCohort; label: string; weightPercent: number; score: number | null;
  confidence: number | null; evidenceCount: number; contribution: number | null;
};
export type ScoreInterpretation = {
  version: typeof SCORE_INTERPRETATION_POLICY.version;
  symbol: string; horizon: CanonicalHorizon; score: number | null; band: ScoreBand | null;
  stance: ResearchStance; title: string; action: string; summary: string;
  confidence: number | null; coverage: number | null;
  confidenceExplanation: string; confidenceReasons: string[];
  confidenceAudit: SliceAgenticScore["confidenceAudit"] | null;
  currentResearch: CurrentResearchReport | null; researchOnly: boolean;
  blockers: string[]; cautions: string[]; supporting: string[]; opposing: string[]; contradictions: string[];
  cohorts: CohortExplanation[]; riskLabel: string; riskDescription: string;
  gain: {
    status: "current-model" | "recorded-only" | "unavailable";
    probability: number | null; storedProbability: number | null; nonPositiveProbability: number | null;
    expectedReturn: number | null; range: { low: number; high: number } | null;
    confidence: number | null; targetAt: string | null; explanation: string;
  };
  providerAsOf: string | null; generatedAt: string | null;
};

const COHORTS: ResearchCohort[] = ["media", "technical", "economy"];
const LABELS: Record<ResearchCohort, string> = { media: "Media & narrative", technical: "Technical & company", economy: "Economy & sectors" };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const percent = (value: unknown) => finite(value) && value >= 0 && value <= 100 ? value : null;
const stamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
const distinct = (values: string[], limit = 6) => [...new Set(values.filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))].slice(0, limit);
const n = (value: number, digits = 1) => value.toLocaleString("en-US", { maximumFractionDigits: digits });

/** Matches the engine's existing decimal boundaries exactly. Invalid scores have no band. */
export function scoreBand(value: unknown): ScoreBand | null {
  const score = percent(value);
  if (score === null) return null;
  if (score <= 28) return SCORE_BANDS[0];
  if (score <= 42) return SCORE_BANDS[1];
  if (score < 58) return SCORE_BANDS[2];
  if (score < 72) return SCORE_BANDS[3];
  return SCORE_BANDS[4];
}

/** Reads immutable research and forecast outputs; never derives probability from the sentiment score. */
export function interpretResearchScore(input: Context): ScoreInterpretation {
  const policy = SCORE_INTERPRETATION_POLICY;
  const score = input.score;
  const currentResearch = input.currentResearch?.symbol === input.symbol ? input.currentResearch : null;
  const researchOnly = input.researchOnly === true || currentResearch?.publication === "research-only";
  const overall = percent(score?.overall), confidence = percent(score?.confidence);
  const coverage = percent(score?.quality.evidenceCoverage), band = scoreBand(overall);
  const forecast = !researchOnly && input.forecast?.symbol === input.symbol ? input.forecast : null;
  const horizon = forecast?.horizons.find(row => row.horizon === input.horizon) ?? null;
  const probability = percent(horizon?.positiveReturnProbability);
  const modelConfidence = percent(horizon?.confidence);
  const expectedReturn = finite(horizon?.expectedReturnPercent) ? horizon.expectedReturnPercent : null;
  const lo = horizon?.expectedRangePercent.low, hi = horizon?.expectedRangePercent.high;
  const range = finite(lo) && finite(hi) && lo <= hi && lo >= -100 ? { low: lo, high: hi } : null;
  const targetAt = stamp(input.targetAt), generatedAt = stamp(score?.generatedAt), providerAsOf = stamp(score?.providerAsOf);
  const blockers: string[] = [], cautions: string[] = [];
  if (forecast && input.evidenceAudit !== "audited") {
    if (input.evidenceAudit === "needs-review") blockers.push("The point-in-time evidence audit found unsafe chronology, such as information dated after the decision snapshot. Resolve this audit before using the forecast for a current decision.");
    else if (input.evidenceAudit === "failed") blockers.push("The point-in-time evidence audit failed to complete. The input chronology is unverified; retry verification before using the forecast for a current decision.");
    else blockers.push("A successful point-in-time evidence audit is not recorded for this forecast. Complete verification before using its likelihood for a current investment decision.");
  }
  const active = COHORTS.filter(key => finite(score?.weighting[key]) && score!.weighting[key] > 0);
  const weightTotal = active.reduce((sum, key) => sum + score!.weighting[key], 0);
  const cohorts: CohortExplanation[] = COHORTS.map(key => {
    const cohort = score?.cohorts[key], weight = score?.weighting[key];
    const validWeight = finite(weight) && weight >= 0 && weight <= 1;
    const cohortScore = percent(cohort?.score);
    return { key, label: LABELS[key], weightPercent: validWeight ? weight * 100 : 0,
      score: cohortScore, confidence: percent(cohort?.confidence),
      evidenceCount: finite(cohort?.evidenceCount) && cohort.evidenceCount >= 0 ? cohort.evidenceCount : 0,
      contribution: validWeight && cohortScore !== null ? cohortScore * weight : null };
  });
  if (!band) blockers.push("A valid score between 0 and 100 has not been recorded.");
  if (!active.length || Math.abs(weightTotal - 1) > .001 || COHORTS.some(key => !finite(score?.weighting[key]) || score!.weighting[key] < 0 || score!.weighting[key] > 1)) {
    blockers.push("The saved research mix is incomplete or invalid.");
  }
  const missing = cohorts.filter(row => row.weightPercent > 0 && (!row.evidenceCount || row.confidence === null || row.confidence <= 0 || row.score === null));
  if (missing.length) blockers.push(`${missing.map(row => row.label).join(", ")} has no usable evidence for its assigned weight.`);
  if (score?.methodology && score.methodology.eligibleEvidenceCount < 1) blockers.push("No eligible evidence supports this score after source and freshness checks.");
  if (confidence === null || confidence < policy.minimumConfidence) blockers.push(`Research confidence is ${confidence === null ? "unavailable" : `${n(confidence)} / 100`}. The evidence does not meet the ${policy.minimumConfidence} / 100 review standard. Check the research coverage, source relevance, dates, and disagreement below before using this run for an investment decision.`);
  else if (confidence < policy.favorableConfidence) cautions.push(`Research confidence is ${n(confidence)} / 100, below the ${policy.favorableConfidence} threshold for a favorable stance.`);
  if (coverage === null || coverage < policy.minimumCoverage) blockers.push(`Evidence coverage is ${coverage === null ? "unavailable" : `${n(coverage)} / 100`}; material inputs are missing.`);
  else if (coverage < policy.favorableCoverage) cautions.push(`Evidence coverage is ${n(coverage)} / 100. Confirm the missing inputs before considering an entry.`);

  const nowValid = finite(input.nowMs);
  if (!nowValid) blockers.push("Current time is unavailable; freshness cannot be verified.");
  if (!generatedAt || !providerAsOf) blockers.push("The research or provider timestamp is missing or invalid.");
  if (nowValid && generatedAt) {
    const age = input.nowMs - Date.parse(generatedAt);
    if (age < -policy.futureClockToleranceMs) blockers.push("The research timestamp is in the future; refresh or check the provider clock.");
    else if (age > policy.maximumResearchAgeMs) blockers.push("This analysis is more than 24 hours old. Refresh research before using it for a new investment decision.");
  }
  if (nowValid && providerAsOf) {
    const age = input.nowMs - Date.parse(providerAsOf);
    if (age < -policy.futureClockToleranceMs) blockers.push("The provider observation is in the future and cannot support a current decision.");
    else if (age > policy.maximumProviderAgeMs) blockers.push("The provider observation is outside the latest seven-day research window. Refresh market data.");
    const shortHorizon = input.horizon === "5-30m" || input.horizon === "intraday";
    if (shortHorizon && (age > 15 * 60 * 1000 || !input.market?.realTimeConfirmed || input.market.marketOpen !== true)) {
      blockers.push("Short-horizon entry analysis requires a confirmed live observation within 15 minutes and an open market.");
    }
  }
  if (input.market?.freshnessMode === "stale" || input.market?.freshnessMode === "unavailable" || forecast?.staleDataWarning) blockers.push("The saved run flags stale or unavailable inputs. Its forecast remains historical evidence, not a current entry signal.");
  if (!input.market || !finite(input.market.price) || input.market.price <= 0) blockers.push("An observed market price is unavailable.");
  else if (input.market.delayed || !input.market.realTimeConfirmed) cautions.push(`${input.market.freshnessLabel || "This run does not contain a confirmed live quote"}. Recheck the current entry price.`);

  if (!horizon || probability === null || expectedReturn === null || !range || modelConfidence === null) blockers.push(researchOnly
    ? "This run preserves the research and sources without publishing a forecast. Price-gain likelihood remains unavailable until the evidence and forecast publication checks pass."
    : "A complete matching forecast for the selected horizon is unavailable; profit likelihood is not inferred from the score.");
  else {
    if (horizon.dataQuality === "Low" || !["Moderate", "High", "Very High"].includes(horizon.dataQuality)) blockers.push("The selected forecast has insufficient data quality for a current investment stance.");
    if (modelConfidence < policy.minimumConfidence) blockers.push(`Forecast confidence is only ${n(modelConfidence)} / 100.`);
    else if (modelConfidence < 50) cautions.push(`Forecast confidence is ${n(modelConfidence)} / 100; wait for stronger agreement.`);
    if (horizon.modelAgreement === "Low" || horizon.modelAgreement === "Very Low") cautions.push("The forecast models have weak agreement about this outcome.");
    if (range.low < 0) cautions.push(`The stored model range includes a ${n(Math.abs(range.low), 2)}% price decline. The range is not a worst-case loss limit.`);
    if (finite(horizon.volatilityPercent) && horizon.volatilityPercent >= 10) cautions.push(`Modeled volatility is ${n(horizon.volatilityPercent, 2)}% over this horizon; large price swings remain possible.`);
    if (horizon.primaryUncertainty?.trim()) cautions.push(horizon.primaryUncertainty.trim());
  }
  if (!targetAt && !researchOnly) blockers.push("The forecast target time is unavailable.");
  else if (targetAt && nowValid && Date.parse(targetAt) <= input.nowMs) blockers.push("This forecast horizon has elapsed. Review its recorded outcome or generate a new run.");

  const method = score?.methodology;
  const confidenceReasons: string[] = [];
  const concentration = percent(method?.sourceConcentrationPercent);
  const sourceSensitive = finite(method?.maximumSourceImpact) && method.maximumSourceImpact >= 8;
  const crossesNeutral = finite(method?.sourceSensitivityBand.low) && finite(method?.sourceSensitivityBand.high) && method.sourceSensitivityBand.low <= 50 && method.sourceSensitivityBand.high >= 50;
  if (concentration !== null && concentration > 65) cautions.push(`One source domain accounts for ${n(concentration)}% of effective evidence weight; agreement may be concentrated.`);
  if (sourceSensitive) cautions.push(`Removing one publisher can move the score by ${n(method!.maximumSourceImpact)} points.`);
  if (crossesNeutral) cautions.push("The source-removal score range crosses neutral. The direction depends on which sources are retained.");
  if (!method) cautions.push("This saved run predates the expanded source-sensitivity audit. A new run can record those checks.");
  if (missing.length) confidenceReasons.push(`${missing.map(row => row.label).join(", ")} lacks usable evidence for its selected research weight. The remaining cohorts are not reweighted to hide that gap.`);
  if (concentration !== null && concentration > 65) confidenceReasons.push(`${n(concentration)}% of effective evidence weight comes from one source domain. Repeated articles, related indicators, and additional agents do not create independent corroboration.`);
  if (finite(score?.quality.contradictionPenalty) && score.quality.contradictionPenalty > 0) confidenceReasons.push(`The active research cohorts disagree, adding a ${n(score.quality.contradictionPenalty)}-point confidence penalty before the overall confidence cap.`);
  const excludedStale = active.reduce((sum, key) => sum + (score?.cohorts[key].robustness?.exclusions.stale ?? 0), 0);
  if (excludedStale > 0) confidenceReasons.push(`${n(excludedStale, 0)} outdated observation${excludedStale === 1 ? " was" : "s were"} excluded. A new retrieval timestamp does not make an old observation current.`);
  if (currentResearch && currentResearch.discoveredNewsCount > 0 && currentResearch.scoredNewsCount === 0) confidenceReasons.push("Recent public articles were found, but no eligible provider-scored news supports this run. Those discovery links remain available for review and do not increase the score or confidence.");
  if (finite(method?.freshnessScore) && method.freshnessScore < 60) confidenceReasons.push(`The weighted evidence freshness score is ${n(method.freshnessScore)} / 100. Older observations carry less weight; economic and financial reporting periods use their own release cadence.`);
  const confidenceExplanation = confidence === null
    ? "Research confidence has not been established. Review the collected sources and the missing inputs for each selected research category."
    : `Research confidence of ${n(confidence)} / 100 measures the support behind this evidence score. It combines source independence, relevance, observation age, and agreement. ${confidence < policy.minimumConfidence ? "Fresh articles can still provide weak support when they are only loosely related, repeated, or contradictory." : "Current information and a high article count do not by themselves establish a reliable investment signal."} It is not a probability of profit.`;
  const opposing = distinct([...(score?.drivers.negative ?? []), ...(forecast?.drivers.negative ?? [])]);
  const supporting = distinct([...(score?.drivers.positive ?? []), ...(forecast?.drivers.positive ?? [])]);
  const contradictions = distinct([...(score?.drivers.contradictions ?? []), ...(forecast?.drivers.contradictions ?? [])]);
  if (contradictions.length) cautions.push(`${contradictions.length} recorded contradiction${contradictions.length === 1 ? " requires" : "s require"} review.`);
  const weightedScores = cohorts.filter(row => row.weightPercent > 0 && row.score !== null).map(row => row.score!);
  const splitCohorts = weightedScores.some(value => value <= 42) && weightedScores.some(value => value >= 58);
  if (splitCohorts) cautions.push("The active research cohorts point in opposing directions; the combined score hides that disagreement.");

  const available = blockers.length === 0;
  const bullishEvidence = overall !== null && overall >= 58;
  const bearishEvidence = overall !== null && overall <= 42;
  const bullishForecast = probability !== null && probability >= policy.favorableProbability && expectedReturn !== null && expectedReturn > 0;
  const bearishForecast = probability !== null && probability <= policy.unfavorableProbability && expectedReturn !== null && expectedReturn <= 0;
  const conflict = (bullishEvidence && bearishForecast) || (bearishEvidence && bullishForecast);
  const majorCaution = !method || sourceSensitive || crossesNeutral || (concentration !== null && concentration > 65) || splitCohorts
    || (horizon?.modelAgreement === "Low" || horizon?.modelAgreement === "Very Low")
    || (percent(score?.quality.contradictionPenalty) ?? 0) >= 10;
  let stance: ResearchStance = "insufficient";
  if (available) {
    if (conflict) stance = "watch";
    else if (bearishEvidence || bearishForecast) stance = "unfavorable";
    else if (bullishEvidence && bullishForecast && confidence! >= policy.favorableConfidence && coverage! >= policy.favorableCoverage && modelConfidence! >= 50 && !majorCaution) stance = "favorable";
    else stance = "watch";
  }
  if (conflict) cautions.unshift("The evidence score and selected forecast disagree. Neither should override the other without review.");
  const decisions: Record<ResearchStance, { title: string; action: string }> = {
    favorable: { title: "Favorable for further investment review", action: "Consider a long investment after checking the current price, valuation, downside tolerance, and portfolio fit." },
    watch: { title: "Watch / wait for confirmation", action: "Do not treat this run as a clear entry signal. Resolve the conflicting or weak evidence before adding a new long position." },
    unfavorable: { title: "Unfavorable for a new long investment", action: "Avoid a new long entry on this evidence. Review existing exposure against the recorded risks; this does not imply a short-sale recommendation." },
    insufficient: { title: researchOnly ? "Research collected · forecast withheld" : "Insufficient current evidence", action: "Review the research readiness and source trail below. Refresh research to check for new observations or resolve the reported provider and coverage gaps before making an investment decision." },
  };
  const mix = cohorts.filter(row => row.weightPercent > 0).map(row => `${row.key} ${n(row.weightPercent)}%`).join(" · ");
  const summary = overall === null || !band ? "A final research score is not available yet." :
    `${input.symbol}'s ${n(overall, 2)} / 100 score is ${band.label.toLowerCase()}. It summarizes the direction of the recorded evidence using ${mix || "the saved research mix"}.${method ? " Related factors, evidence freshness, and source robustness are included in the recorded scoring method." : " Expanded robustness diagnostics are unavailable for this older run."} The score is not the percentage chance of making money.`;
  const gainExplanation = available && probability !== null && expectedReturn !== null ?
    `The stored ${input.horizon} model assigns ${n(probability)}% to a price gain and ${n(100 - probability)}% to a flat or lower price. Its expected price return is ${expectedReturn > 0 ? "+" : ""}${n(expectedReturn, 2)}%. Fees, slippage, taxes, and investor-specific cash flows are not included, so this is not a net-profit probability.` :
    "A current price-gain likelihood is withheld because the selected run does not pass the evidence, freshness, and horizon checks. No probability is calculated from the score.";
  const riskLabel = !available ? "Risk cannot be assessed reliably" : majorCaution || bearishEvidence || bearishForecast ? "Elevated concerns in this analysis" : "Downside still requires review";
  const riskDescription = !available ? "The available evidence or forecast checks do not support a dependable current risk assessment. Review the specific readiness gaps below; a high saved score does not resolve them." :
    `${range && range.low < 0 ? `The model range includes a ${n(Math.abs(range.low), 2)}% decline. ` : "The modeled range does not establish a floor on losses. "}${opposing.length ? "Recorded adverse drivers are listed below. " : "No specific adverse driver was recorded; that absence does not establish low risk. "}A favorable score measures evidence direction, not capital protection or investment suitability.`;
  return { version: policy.version, symbol: input.symbol, horizon: input.horizon, score: overall, band, stance, ...decisions[stance], summary,
    confidence, coverage, confidenceExplanation, confidenceReasons: distinct(confidenceReasons, 6), currentResearch, researchOnly,
    blockers: distinct(blockers, 16), cautions: distinct(cautions, 12), supporting, opposing, contradictions, cohorts,
    riskLabel, riskDescription, providerAsOf, generatedAt, confidenceAudit: score?.confidenceAudit ?? null,
    gain: { status: available ? "current-model" : probability !== null ? "recorded-only" : "unavailable", probability: available ? probability : null,
      storedProbability: probability, nonPositiveProbability: available && probability !== null ? 100 - probability : null,
      expectedReturn, range, confidence: modelConfidence, targetAt, explanation: gainExplanation } };
}

export function interpretCanonicalScore(bundle: CanonicalBundle, horizon: CanonicalHorizon, nowMs: number) {
  return interpretResearchScore({ symbol: bundle.symbol, score: bundle.score, horizon, forecast: bundle.forecast, market: bundle.market,
    evidenceAudit: bundle.operations?.warehouse, targetAt: bundle.targets[horizon], currentResearch: bundle.currentResearch, nowMs });
}

export function interpretResearchOnlyScore(bundle: ResearchOnlyBundle, horizon: CanonicalHorizon, nowMs: number) {
  return interpretResearchScore({ symbol: bundle.symbol, score: bundle.score, horizon, market: bundle.market,
    currentResearch: bundle.currentResearch, researchOnly: true, nowMs });
}
