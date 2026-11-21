import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
let assertions = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: path, reportDiagnostics: true });
  check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`);
  const module = { exports: {} };
  const resolve = specifier => Object.hasOwn(dependencies, specifier) ? dependencies[specifier] : specifier.endsWith(".module.css") ? new Proxy({}, { get: (_target, key) => String(key) }) : require(specifier);
  new Function("require", "module", "exports", result.outputText)(resolve, module, module.exports);
  return module.exports;
}

const logic = await load("src/lib/intelligence/score-interpretation.ts");
const { scoreBand, interpretCanonicalScore, interpretResearchScore, interpretResearchOnlyScore } = logic;
const provenance = await load("src/lib/intelligence/research-evidence.ts");
const ui = await load("src/components/intelligence/score-decision-panel.tsx", { "@/lib/intelligence/score-interpretation": logic, "@/lib/intelligence/research-evidence": provenance });
const now = Date.parse("2026-11-18T18:00:00.000Z");
const iso = offset => new Date(now + offset).toISOString();
const cohort = (name, score) => ({ cohort: name, label: name, requestedAgents: 100, completedAgents: 100, degradedAgents: 0,
  evidenceCount: 12, independentSourceCount: 4, score, confidence: 80, agreement: 80, dispersion: 10, contributionToSliceScore: 0,
  topPositiveDrivers: ["Recorded improvement"], topNegativeDrivers: ["Recorded valuation risk"], contradictions: [] });
function fixture() {
  return {
    schemaVersion: "slice-canonical-bundle-1.0.0", id: "bundle-a", symbol: "TEST", researchRunId: "research-a", forecastRunId: "forecast-a",
    inputSha256: "input", outputSha256: "output", asOf: iso(-300000), generatedAt: iso(-60000), dataProvider: "Alpha Vantage", classification: "model-estimate-not-provider-observation",
    score: { schemaVersion: "slice-agentic-score-1.0.0", overall: 74.2, confidence: 72, label: "Strongly Bullish", generatedAt: iso(-60000), providerAsOf: iso(-300000),
      weighting: { media: .2, technical: .5, economy: .3 }, cohorts: { media: cohort("media", 70), technical: cohort("technical", 76), economy: cohort("economy", 74) },
      methodology: { version: "slice-evidence-robust-2.0.0", evaluatedAt: iso(-60000), semantics: "evidence-sentiment-not-outcome-probability", stabilityScore: 90,
        maximumSourceImpact: 1.5, sourceSensitivityBand: { low: 72, high: 76, meaning: "source-removal-sensitivity-not-a-prediction-interval" },
        effectiveSourceCount: 4, sourceConcentrationPercent: 30, freshnessScore: 90, eligibleEvidenceCount: 36, excludedEvidenceCount: 2, factorFamilyCount: 8,
        contributions: [], sourceInfluence: [], limitations: [] },
      quality: { realTimeConfirmed: true, delayed: false, marketOpen: true, evidenceCoverage: 85, sourceDiversity: 75, agentCompletionRate: 100, contradictionPenalty: 2, freshnessPenalty: 0 },
      drivers: { positive: ["Recorded earnings improvement", "Recorded earnings improvement"], negative: ["Recorded valuation risk"], contradictions: [] },
      safeguards: { equalThirdWeighting: false, autonomousTradingEnabled: false, unavailableInputsNeutralized: true, simulatedAgentsAreObservedTruth: false, externalCallsPerAgent: false } },
    market: { provider: "Alpha Vantage", price: 100, previousClose: 99, change: 1, changePercent: 1.01, volume: 100000, currency: "USD", freshnessMode: "realtime", freshnessLabel: "Fresh provider observation", realTimeConfirmed: true, delayed: false, marketOpen: true, marketStatus: "Open", providerTimeZone: "America/New_York" },
    forecast: { schemaVersion: "slice-forecast-output-1.0.0", symbol: "TEST", requestId: "research-a", generatedAt: iso(-60000), asOf: iso(-300000), engineVersion: "fixture", modelVersion: "fixture", calibrationVersion: "fixture", sliceSentimentScore: 74.2, marketRegime: "Range Bound", dataQualityScore: 85, staleDataWarning: null,
      horizons: [{ horizon: "2-5d", label: "Two to five days", direction: "Bullish", positiveReturnProbability: 68.5, expectedReturnPercent: 2.4, expectedPrice: 102.4,
        expectedRangePercent: { low: -4.1, high: 6.2 }, expectedPriceRange: { low: 95.9, high: 106.2 }, volatilityPercent: 5, confidence: 68,
        modelAgreement: "High", simulationAgreement: "High", dataQuality: "High", modelDisagreement: 20, primaryUncertainty: "Future earnings may change this case.", contributions: [] }],
      drivers: { positive: ["Recorded earnings improvement"], negative: ["Margin sensitivity"], contradictions: [], technical: [], macro: [], environmental: [], supplyChain: [], optionsAndPositioning: [], historicalAnalogies: [] }, limitations: [] },
    targets: { "2-5d": iso(2 * 86400000) }, graphAnalytics: {}, operations: { warehouse: "audited" }, warnings: [],
  };
}
const interpret = bundle => interpretCanonicalScore(bundle, "2-5d", now);

for (const [score, id] of [[0,"strongly-bearish"],[28,"strongly-bearish"],[28.00001,"bearish"],[42,"bearish"],[42.00001,"neutral"],[57.99999,"neutral"],[58,"bullish"],[71.99999,"bullish"],[72,"strongly-bullish"],[100,"strongly-bullish"]]) check(scoreBand(score)?.id, id, `Exact engine boundary ${score}`);
for (const score of [-1, 100.01, NaN, Infinity, -Infinity, null, undefined, "80"]) check(scoreBand(score), null, "Malformed scores do not receive a valid band");
yes(Array.from({ length: 10001 }, (_, value) => value / 100).every(value => scoreBand(value)), "Every valid hundredth from0 through100 belongs to a band");

const original = fixture(), before = JSON.stringify(original), favorable = interpret(original);
check(favorable.stance, "favorable");
check(favorable.gain.probability, 68.5, "Probability comes from the matching forecast, not the74.2 score");
check(favorable.gain.nonPositiveProbability, 31.5);
check(favorable.score, 74.2);
check(favorable.cohorts.map(row => row.weightPercent), [20, 50, 30], "Personal research mix replaces a hardcoded equal-third explanation");
check(favorable.cohorts.map(row => Math.round(row.contribution * 10) / 10), [14, 38, 22.2]);
check(favorable.supporting, ["Recorded earnings improvement"], "Repeated prose is not promoted as independent support");
check(favorable.opposing, ["Recorded valuation risk", "Margin sensitivity"]);
yes(favorable.riskDescription.includes("4.1% decline"), "Favorable evidence still explains the modeled downside");
yes(favorable.gain.explanation.includes("not a net-profit probability"));
yes(favorable.summary.includes("not the percentage chance"));
check(JSON.stringify(original), before, "Interpretation never changes the immutable recorded run");

const weak = fixture(); weak.score.confidence = 50;
check(interpret(weak).stance, "watch", "Weak confidence does not inherit a high-score favorable stance");
const lowConfidence = fixture(); lowConfidence.score.confidence = 20;
check(interpret(lowConfidence).stance, "insufficient");
const sourceSensitive = fixture(); sourceSensitive.score.methodology.maximumSourceImpact = 9;
check(interpret(sourceSensitive).stance, "watch", "A source-fragile score is not automatically favorable");
const concentrated = fixture(); concentrated.score.methodology.sourceConcentrationPercent = 90;
check(interpret(concentrated).stance, "watch");
const crossing = fixture(); crossing.score.methodology.sourceSensitivityBand.low = 48;
check(interpret(crossing).stance, "watch");
const split = fixture(); split.score.cohorts.media.score = 30;
check(interpret(split).stance, "watch", "Conflicting active cohorts are visible even when the aggregate score is high");
const legacy = fixture(); delete legacy.score.methodology;
check(interpret(legacy).stance, "watch", "An older run with no robustness audit remains readable but gets no favorable entry stance");

const bearish = fixture(); bearish.score.overall = 25; bearish.forecast.horizons[0].positiveReturnProbability = 35; bearish.forecast.horizons[0].expectedReturnPercent = -2;
check(interpret(bearish).stance, "unfavorable");
yes(interpret(bearish).action.includes("Avoid a new long entry"));
const conflict = fixture(); conflict.forecast.horizons[0].positiveReturnProbability = 35; conflict.forecast.horizons[0].expectedReturnPercent = -2;
check(interpret(conflict).stance, "watch", "High sentiment cannot override a bearish forecast");
const inverse = fixture(); inverse.score.overall = 25;
check(interpret(inverse).stance, "watch", "A bullish forecast cannot silently override bearish evidence");
const noPositiveExpectation = fixture(); noPositiveExpectation.forecast.horizons[0].expectedReturnPercent = -2;
check(interpret(noPositiveExpectation).stance, "watch", "A high win probability with negative expected payoff is not favorable");

for (const [label, mutate] of [
  ["old run", b => { b.score.generatedAt = iso(-86400001); }],
  ["old provider", b => { b.score.providerAsOf = iso(-169 * 3600000); }],
  ["future provider", b => { b.score.providerAsOf = iso(360000); }],
  ["future research", b => { b.score.generatedAt = iso(360000); }],
  ["missing observation time", b => { b.score.providerAsOf = null; }],
  ["expired target", b => { b.targets["2-5d"] = iso(-1); }],
  ["missing target", b => { delete b.targets["2-5d"]; }],
  ["missing price", b => { b.market.price = 0; }],
  ["explicit stale input", b => { b.forecast.staleDataWarning = "Stale evidence"; }],
  ["provider stale mode", b => { b.market.freshnessMode = "stale"; }],
  ["empty weighted cohort", b => { b.score.cohorts.media.evidenceCount = 0; }],
  ["excluded evidence", b => { b.score.methodology.eligibleEvidenceCount = 0; }],
  ["missing coverage", b => { b.score.quality.evidenceCoverage = 0; }],
  ["invalid weighting", b => { b.score.weighting.media = .4; }],
  ["negative weighting", b => { b.score.weighting.media = -.2; }],
  ["low forecast quality", b => { b.forecast.horizons[0].dataQuality = "Low"; }],
  ["low forecast confidence", b => { b.forecast.horizons[0].confidence = 10; }],
  ["different symbol", b => { b.forecast.symbol = "OTHER"; }],
  ["invalid probability", b => { b.forecast.horizons[0].positiveReturnProbability = 101; }],
  ["invalid model range", b => { b.forecast.horizons[0].expectedRangePercent = { low: 5, high: -5 }; }],
  ["unsafe evidence chronology", b => { b.operations.warehouse = "needs-review"; }],
  ["failed evidence audit", b => { b.operations.warehouse = "failed"; }],
  ["pending evidence audit", b => { b.operations.warehouse = "pending"; }],
  ["missing evidence audit", b => { delete b.operations.warehouse; }],
  ["unknown evidence audit", b => { b.operations.warehouse = "unrecognized"; }],
]) {
  const bundle = fixture(); mutate(bundle); const analysis = interpret(bundle);
  check(analysis.stance, "insufficient", `${label}: current investment stance is withheld`);
  check(analysis.gain.probability, null, `${label}: current likelihood is withheld`);
  yes(analysis.blockers.length, `${label}: exact reason is provided`);
}

const unsafeAudit = fixture(); unsafeAudit.operations.warehouse = "needs-review";
yes(interpret(unsafeAudit).blockers.some(reason => reason.includes("unsafe chronology")), "Known unsafe chronology is distinguished from unavailable verification");
check(interpret(unsafeAudit).gain.storedProbability, 68.5, "Unsafe forecasts remain auditable only as recorded estimates");
const failedAudit = fixture(); failedAudit.operations.warehouse = "failed";
yes(interpret(failedAudit).blockers.some(reason => reason.includes("failed to complete")), "Failed audit is not claimed to prove unsafe evidence");
const pendingAudit = fixture(); pendingAudit.operations.warehouse = "pending";
yes(interpret(pendingAudit).blockers.some(reason => reason.includes("not recorded")), "Pending verification is not presented as successful verification");
const graphSyncFailed = fixture(); graphSyncFailed.operations.neo4j = "failed";
check(interpret(graphSyncFailed).stance, "favorable", "An unrelated graph synchronization failure does not invalidate a completed chronology audit");

const inactive = fixture(); inactive.score.weighting = { media: 0, technical: .7, economy: .3 }; inactive.score.cohorts.media.evidenceCount = 0; inactive.score.cohorts.media.confidence = 0; inactive.score.cohorts.media.score = 0;
check(interpret(inactive).stance, "favorable", "A deliberately unweighted cohort does not create a false missing-evidence block");
const short = fixture(); short.forecast.horizons[0].horizon = "5-30m"; short.targets["5-30m"] = iso(1800000);
check(interpretCanonicalScore(short, "5-30m", now).stance, "favorable");
short.market.delayed = true; short.market.realTimeConfirmed = false;
check(interpretCanonicalScore(short, "5-30m", now).stance, "insufficient", "A delayed feed cannot support a live short-horizon entry view");
short.market.delayed = false; short.market.realTimeConfirmed = true; short.market.marketOpen = false;
check(interpretCanonicalScore(short, "5-30m", now).stance, "insufficient", "Market closure is explicit for short-horizon decisions");
const absent = interpretResearchScore({ symbol: "TEST", score: fixture().score, horizon: "2-5d", market: fixture().market, nowMs: now });
check(absent.score, 74.2, "Unpublished research still explains its actual score");
check(absent.stance, "insufficient"); check(absent.gain.storedProbability, null, "A missing forecast is never replaced with sentiment as probability");
const unknown = interpretResearchScore({ symbol: "TEST", score: null, horizon: "2-5d", nowMs: now });
check(unknown.stance, "insufficient"); check(unknown.score, null);

const expired = fixture(); expired.targets["2-5d"] = iso(-1); const historical = interpret(expired);
check(historical.gain.status, "recorded-only"); check(historical.gain.storedProbability, 68.5);
const markup = renderToStaticMarkup(React.createElement(ui.default, { analysis: historical, sourcesHref: "/workspace/intelligence#research-sources" }));
yes(markup.includes("Insufficient current evidence")); yes(markup.includes("Withheld"));
yes(markup.includes("Archived estimate for this run: 68.5%"), "The original value remains separately auditable");
yes(markup.includes("Current band")); yes(markup.includes("20%") && markup.includes("50%") && markup.includes("30%"));
yes(markup.includes("/workspace/intelligence#research-sources"), "Source registry remains accessible beside the explanation");
const guide = renderToStaticMarkup(React.createElement(ui.ScoreBandGuide));
check((guide.match(/scope="row"/g) ?? []).length, 5, "All score bands are available before the first run");

check(logic.SCORE_INTERPRETATION_POLICY.minimumConfidence, 40, "The current-interpretation confidence requirement remains unchanged");
check(logic.SCORE_INTERPRETATION_POLICY.favorableConfidence, 60);
const edgeOfWeek = fixture(); edgeOfWeek.score.providerAsOf = iso(-168 * 3600000);
yes(!interpret(edgeOfWeek).blockers.some(reason => reason.includes("seven-day")), "An observation exactly seven days old is inside the current research window");
edgeOfWeek.score.providerAsOf = iso(-168 * 3600000 - 1);
yes(interpret(edgeOfWeek).blockers.some(reason => reason.includes("seven-day")), "An observation beyond seven days is not current");

const report = {
  version: "slice-current-research-1.0.0", symbol: "TEST", instrumentKind: "equity", checkedAt: iso(0), windowStart: iso(-168 * 3600000), windowHours: 168,
  status: "incomplete", publication: "research-only", priceObservedAt: iso(-300000),
  currentEvidenceCount: 6, contextEvidenceCount: 4, excludedEvidenceCount: 3, scoredNewsCount: 0, scoredPublisherCount: 0, discoveredNewsCount: 1,
  cohorts: [
    { cohort: "media", weightPercent: 20, confidence: 0, eligibleCount: 0, currentCount: 0, contextCount: 0, sourceCount: 0, status: "missing" },
    { cohort: "technical", weightPercent: 50, confidence: 30, eligibleCount: 6, currentCount: 6, contextCount: 0, sourceCount: 1, status: "limited" },
    { cohort: "economy", weightPercent: 30, confidence: 20, eligibleCount: 4, currentCount: 0, contextCount: 4, sourceCount: 1, status: "limited" },
  ],
  collection: [{ provider: "Alpha Vantage", query: "NEWS_SENTIMENT · TEST", status: "rate-limited", detail: "The provider limit prevented this query from returning evidence.", retrievedAt: iso(-3600000), cacheState: "cooldown", acceptedCount: 0 }],
  gaps: [{ code: "media-coverage", description: "Scored media research is missing.", action: "Review provider availability and refresh research after the request limit resets." }],
  discoveries: [{ id: "discovery-one", title: "A current company announcement for review", summary: "A public discovery with no assigned sentiment.",
    url: "https://news.google.com/rss/articles/fixture?utm_source=test&apikey=PRIVATE", publisher: "Fixture publication", publisherUrl: "https://publisher.example/", publisherDomain: "publisher.example",
    publisherAttribution: "feed-reported", linkKind: "aggregator", publishedAt: iso(-7200000), retrievedAt: iso(-3600000), feedUrl: "https://news.google.com/rss/search?q=TEST",
    discoveryProvider: "Google News RSS", matchedBy: "ticker", sentiment: null, duplicateCount: 0, relatedSources: [] }],
  notes: ["Quarterly releases retain their actual reporting-period dates."],
};
const researchOnlySource = fixture();
researchOnlySource.score.confidence = 21;
researchOnlySource.score.quality.contradictionPenalty = 6;
researchOnlySource.score.methodology.sourceConcentrationPercent = 80;
researchOnlySource.score.cohorts.media.evidenceCount = 0;
researchOnlySource.score.cohorts.media.confidence = 0;
const only = { schemaVersion: "slice-research-only-bundle-1.0.0", id: "research-only-a", symbol: "TEST", researchRunId: "research-a", generatedAt: iso(-60000),
  classification: "research-only-no-forecast", score: researchOnlySource.score, market: researchOnlySource.market, currentResearch: report, warnings: [] };
const beforeOnly = JSON.stringify(only), onlyAnalysis = interpretResearchOnlyScore(only, "2-5d", now);
check(onlyAnalysis.stance, "insufficient"); check(onlyAnalysis.confidence, 21, "Explanation does not silently change the recorded confidence");
check(onlyAnalysis.gain.status, "unavailable"); check(onlyAnalysis.gain.probability, null); check(onlyAnalysis.gain.storedProbability, null); check(onlyAnalysis.gain.expectedReturn, null);
check(onlyAnalysis.gain.targetAt, null, "Research-only data has no invented target or forecast");
check(onlyAnalysis.title, "Research collected · forecast withheld");
yes(onlyAnalysis.confidenceExplanation.includes("loosely related, repeated, or contradictory"));
yes(onlyAnalysis.confidenceReasons.some(reason => reason.includes("80% of effective evidence weight")));
yes(onlyAnalysis.confidenceReasons.some(reason => reason.includes("6-point confidence penalty")));
yes(onlyAnalysis.confidenceReasons.some(reason => reason.includes("no eligible provider-scored news")));
check(JSON.stringify(only), beforeOnly, "Readiness and interpretation preserve immutable recorded evidence and dates");
const readinessMarkup = renderToStaticMarkup(React.createElement(ui.default, { analysis: onlyAnalysis, sourcesHref: "/workspace/intelligence#research-sources" }));
yes(readinessMarkup.includes("Research readiness") && !readinessMarkup.includes("What must be resolved"));
yes(readinessMarkup.includes("Latest 7 days") && readinessMarkup.includes("Dated context observations"));
yes(readinessMarkup.includes("unscored articles") && readinessMarkup.includes("do not increase confidence or create a forecast"));
yes(readinessMarkup.includes("Publisher reported by feed") && readinessMarkup.includes("Aggregator link"));
yes(readinessMarkup.includes(iso(-7200000)) && readinessMarkup.includes(iso(-3600000)), "Public research exposes original publication and retrieval times");
yes(readinessMarkup.includes('href="https://news.google.com/rss/articles/fixture"') && !readinessMarkup.includes("PRIVATE"), "Source links are safe, public, and stripped of private parameters");
yes(readinessMarkup.includes("rate limited") && readinessMarkup.includes("cooldown") && readinessMarkup.includes("request limit resets"));
const mismatchedReport = interpretResearchScore({ symbol: "TEST", score: fixture().score, horizon: "2-5d", currentResearch: { ...report, symbol: "OTHER" }, nowMs: now });
check(mismatchedReport.currentResearch, null, "Readiness from another instrument cannot be grafted onto the selected score");
const unsafeReport = { ...report, discoveries: [{ ...report.discoveries[0], url: "javascript:alert(1)" }] };
const unsafeMarkup = renderToStaticMarkup(React.createElement(ui.ResearchReadinessPanel, { report: unsafeReport }));
yes(!unsafeMarkup.includes("javascript:"), "A malformed archived discovery cannot become an unsafe link");

const audited = fixture();
audited.score.confidence = 21;
audited.score.confidenceAudit = {
  version: "slice-confidence-audit-1.0.0", validInputs: true,
  weightedCohortConfidence: 24, supportBeforePenalties: 40, contradictionPenalty: 6,
  freshnessPenalty: 13, supportAfterPenalties: 21, confidenceCap: 24, finalConfidence: 21,
  components: [
    { key: "cohort", label: "Weighted cohort support", value: 24, weight: .55, contribution: 13.2 },
    { key: "coverage", label: "Observed coverage", value: 59, weight: .2, contribution: 11.8 },
    { key: "sources", label: "Source diversity", value: 0, weight: .1, contribution: 0 },
    { key: "availability", label: "Weighted cohort availability", value: 100, weight: .15, contribution: 15 },
  ],
  cohorts: [
    { cohort: "media", weightPercent: 20, confidence: 20, contribution: 4, evidenceCount: 2, sourceCount: 1 },
    { cohort: "technical", weightPercent: 50, confidence: 28, contribution: 14, evidenceCount: 4, sourceCount: 1 },
    { cohort: "economy", weightPercent: 30, confidence: 20, contribution: 6, evidenceCount: 2, sourceCount: 1 },
  ],
  inputs: { observed: ["Original provider quote"], derived: ["RSI calculated from dated bars"], neutralized: ["Unavailable company margins", "<script>do not execute</script>"] },
};
const auditBefore = JSON.stringify(audited), auditedAnalysis = interpret(audited);
check(auditedAnalysis.confidenceAudit, audited.score.confidenceAudit, "The exact stored confidence calculation passes through without recalculation");
check(auditedAnalysis.stance, "insufficient", "Displaying confidence arithmetic never promotes a21-confidence run into an investment stance");
check(auditedAnalysis.gain.probability, null, "A complete confidence audit does not supply a trade probability");
check(JSON.stringify(audited), auditBefore, "The explanation leaves the stored audit unchanged");
const auditMarkup = renderToStaticMarkup(React.createElement(ui.default, { analysis: auditedAnalysis }));
for (const label of ["How the 21 / 100 confidence was calculated", "Support before penalties", "Cohort disagreement penalty", "Market freshness penalty", "Weighted cohort confidence cap", "Final confidence", "Observed inputs", "Calculated from observations", "Unavailable or neutralized inputs"])
  yes(auditMarkup.includes(label), `The recorded calculation exposes ${label}`);
yes(auditMarkup.includes("−6") && auditMarkup.includes("−13") && auditMarkup.includes("24"), "The21-point result exposes its actual penalties and cohort cap");
yes(auditMarkup.includes("RSI calculated from dated bars") && auditMarkup.includes("Unavailable company margins"), "Observed, derived, and neutralized input provenance remain distinct");
yes(!auditMarkup.includes("<script>"), "Model or evidence text cannot execute through calculation rendering");
check(interpret(fixture()).confidenceAudit, null, "Older saved runs remain valid without the new audit field");
const legacyAudit = renderToStaticMarkup(React.createElement(ui.ConfidenceCalculation, { audit: null }));
yes(legacyAudit.includes("Generate current research"), "A prior run invites an actual new collection instead of inventing an audit");
const invalidInputsMarkup = renderToStaticMarkup(React.createElement(ui.ConfidenceCalculation, { audit: { ...audited.score.confidenceAudit, validInputs: false, finalConfidence: 0 } }));
yes(invalidInputsMarkup.includes('role="alert"') && invalidInputsMarkup.includes("required numeric inputs were unavailable or invalid"), "Invalid calculation inputs remain distinct from a low but valid evidence score");
yes(invalidInputsMarkup.includes("collect a new research run"), "A calculation failure does not authorize execution or silently invent replacement inputs");

console.log(`Score interpretation checks passed (${assertions} assertions): exact bands, actual weights, recorded probability, current-data gates, conflicting evidence, source fragility, missing forecasts, immutable inputs, and accessible explanation markup.`);
