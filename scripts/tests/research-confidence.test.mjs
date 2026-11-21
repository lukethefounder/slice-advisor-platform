import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { mock } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../../src/lib/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: path,
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  const resolve = name => name === "server-only" ? {} : Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "module", "exports", compiled.outputText)(resolve, module, module.exports);
  return module.exports;
}

const config = await load("intelligence/research-config.ts");
const evidence = await load("intelligence/research-evidence.ts");
const live = await load("intelligence-forecast/live-snapshot.ts");
const instrument = await load("intelligence/research-instrument.ts");
const { normalizeMarketSnapshot } = await load("intelligence-forecast/validation.ts", {
  "@/lib/intelligence/research-instrument": instrument,
});
const { runResearchSwarm } = await load("intelligence/research-swarm.ts", {
  "./research-config": config,
  "./research-evidence": evidence,
  "@/lib/intelligence-forecast/live-snapshot": live,
});

const now = Date.parse("2026-11-18T15:00:00.000Z");
const asOf = new Date(now).toISOString();
const hoursBefore = hours => new Date(now - hours * 3_600_000).toISOString();
const families = ["Earnings revenue", "Merger acquisition", "Regulatory lawsuit", "Product customer", "Market sentiment"];

function fixture() {
  const news = Array.from({ length: 40 }, (_, index) => ({
    id: `publication-${index}`,
    title: `${families[index % families.length]}: independent observation ${index} about the fixture company`,
    summary: `Distinct synthetic source ${index}; these fixtures are not actual market evidence.`,
    source: `Fixture publisher ${index}`,
    sourceDomain: `publisher-${index}.example`,
    url: `https://publisher-${index}.example/observation-${index}`,
    publishedAt: asOf,
    tickerSentimentScore: 0.3,
    tickerRelevance: 1,
    overallSentimentScore: 0.3,
    topics: [families[index % families.length]],
  }));
  return {
    symbol: "TEST", requestedAgents: 30, scan: null, graphMode: "summary",
    researchWeights: { media: 1, technical: 1, economy: 1 },
    alpha: {
      ok: true, symbol: "TEST", retrievedAt: asOf, providerAsOf: asOf, providerTimeZone: "UTC",
      quote: { price: 100, previousClose: 98.159509202454, change: 1.840490797546, changePercent: 1.875, volume: 1_000_000 },
      freshness: { mode: "realtime", isRealtime: true, isDelayed: false, label: "Current fixture quote", explanation: "Synthetic observed quote" },
      health: { warnings: [], endpointCount: 4, successfulEndpointCount: 4 },
      market: { isOpen: true, currentStatus: "open" },
      technicals: { historyAsOf: hoursBefore(2), historyPointCount: 252,
        trendScore: 65, momentumScore: 65, riskScore: 65, volumeScore: 65,
        rsi14: 55, sma50: 95, volatility20Annualized: 20, volatility20Daily: 1.25,
        momentum30: 3, drawdownFrom60DayHigh: -2, volumeTrendPercent: 5, technicalSummary: "Synthetic aligned indicators" },
      news: { retrievedAt: asOf, articleCount: news.length, relevanceWeightedSentiment: 0.3, items: news },
      overview: null, intraday: null,
    },
    economy: {
      retrievedAt: asOf, sector: "Technology", industry: "Software", regime: "Balanced", score: 65, confidence: 95, warnings: [],
      series: ["Inflation CPI", "Unemployment labor", "Treasury yield", "WTI oil", "GDP demand"].map((label, index) => ({
        functionName: `FIXTURE_${index}`, label, description: "Synthetic economic observation", interval: "monthly",
        latestValue: 4, previousValue: 3.5, change: 0.5, changePercent: 14.2,
        industrySensitivity: 1, source: "Alpha Vantage", sourceUrl: "https://www.alphavantage.co/documentation/",
        asOf, retrievedAt: asOf, score: 65, confidence: 95, warning: null,
      })),
    },
  };
}

const weightedConfidence = run => Object.entries(run.score.cohorts)
  .reduce((sum, [key, cohort]) => sum + cohort.confidence * run.score.weighting[key], 0);

mock.timers.enable({ apis: ["Date"], now });
try {
  const input = fixture(), frozenInput = JSON.stringify(input);
  const current = runResearchSwarm(input);
  assert.equal(JSON.stringify(input), frozenInput, "Confidence synthesis must not mutate collected observations");
  assert.equal(current.score.methodology.version, "slice-evidence-robust-2.2.0");
  assert.equal(current.score.cohorts.technical.robustness.version, "slice-evidence-robust-2.2.0");
  const audit = current.score.confidenceAudit;
  assert.equal(audit.version, "slice-confidence-audit-1.0.0");
  assert.equal(audit.validInputs, true);
  assert.equal(audit.components.reduce((sum, row) => sum + row.contribution, 0), audit.supportBeforePenalties, "The persisted calculation retains enough precision to reconstruct every subtotal");
  assert.equal(audit.cohorts.reduce((sum, row) => sum + row.contribution, 0), audit.weightedCohortConfidence);
  assert.deepEqual(audit.components.map(row => row.weight), [.55, .20, .10, .15]);
  assert.equal(audit.supportAfterPenalties, Math.max(0, Math.min(100, audit.supportBeforePenalties - audit.contradictionPenalty - audit.freshnessPenalty)));
  assert.equal(audit.finalConfidence, Math.round(Math.min(audit.confidenceCap, audit.supportAfterPenalties) * 100) / 100);
  assert.equal(audit.finalConfidence, current.score.confidence);
  assert.ok(audit.inputs.derived.includes("trend score"));
  assert.ok(audit.inputs.neutralized.some(value => value.startsWith("P/E unavailable")));
  assert.equal(current.score.cohorts.technical.confidence, 52, "The existing single-provider cohort cap remains");
  assert.equal(current.score.cohorts.economy.confidence, 52);
  assert.equal(current.score.overall, 61.73, "Separating forecast decision time from price observation time preserves directional synthesis");
  assert.ok(current.score.confidence >= 60, "Coherent current evidence can reach the unchanged numeric confidence threshold");
  assert.ok(current.score.confidence <= weightedConfidence(current) + 0.005, "Overall confidence never exceeds measured weighted cohort confidence");
  const previousMultiplier = 0.75 + 0.25 * (1 - Math.exp(-current.score.methodology.effectiveSourceCount / 3));
  assert.ok(current.score.confidence * previousMultiplier < 60, "The same observations were barred by the redundant final concentration discount");
  assert.equal(current.score.methodology.sourceConcentrationPercent, 66.67, "Shared vendor exposure remains visible to the independent interpretation gate");
  assert.equal(current.score.methodology.sourceInfluence.find(source => source.domain === "alphavantage.co").weightPercent, 66.67);
  assert.ok(current.score.methodology.limitations.some(value => value.includes("without a second concentration multiplier")));

  // Directional synthesis is unchanged by the confidence composition revision.
  const directionalScore = Object.entries(current.score.cohorts)
    .reduce((sum, [key, cohort]) => sum + cohort.score * current.score.weighting[key], 0);
  assert.equal(current.score.overall, Math.round(directionalScore * 100) / 100);
  for (const cohort of Object.values(current.score.cohorts)) {
    assert.ok(cohort.robustness.rawScore > cohort.score && cohort.score > 50, "Conservative directional shrinkage remains in force");
  }

  const repeated = fixture();
  repeated.alpha.news.items.push(...Array.from({ length: 100 }, (_, index) => ({
    ...repeated.alpha.news.items[0], id: `copy-${index}`,
    url: `${repeated.alpha.news.items[0].url}?utm_source=copy-${index}`,
  })));
  repeated.alpha.news.articleCount = repeated.alpha.news.items.length;
  const duplicateRun = runResearchSwarm(repeated);
  assert.equal(duplicateRun.score.confidence, current.score.confidence, "Repeated source records cannot manufacture confidence");
  assert.equal(duplicateRun.score.overall, current.score.overall);
  assert.equal(duplicateRun.score.cohorts.media.evidenceCount, current.score.cohorts.media.evidenceCount);
  const moreAgents = runResearchSwarm({ ...input, requestedAgents: 300 });
  assert.equal(moreAgents.score.confidence, current.score.confidence, "Extra analytical agents do not add evidence");
  assert.equal(moreAgents.score.overall, current.score.overall);

  const lowRelevance = fixture();
  lowRelevance.alpha.news.items = lowRelevance.alpha.news.items.map(item => ({ ...item, tickerRelevance: 0.1 }));
  const weak = runResearchSwarm(lowRelevance);
  assert.ok(weak.score.confidence < 40, "Weak evidence stays below the minimum; there is no artificial confidence floor");

  let previous = current.score.confidence;
  for (const ageHours of [24, 72, 168, 169]) {
    const older = fixture();
    older.alpha.news.items = older.alpha.news.items.map(item => ({ ...item, publishedAt: hoursBefore(ageHours) }));
    const run = runResearchSwarm(older);
    assert.ok(run.score.confidence < previous, "Older unchanged research cannot gain confidence");
    previous = run.score.confidence;
    if (ageHours === 169) {
      assert.equal(run.score.cohorts.media.confidence, 0, "Articles beyond seven days remain excluded");
      assert.equal(run.score.cohorts.media.robustness.exclusions.stale, 40);
    }
  }

  const missing = fixture();
  missing.economy.series = [];
  const incomplete = runResearchSwarm(missing);
  assert.equal(incomplete.score.cohorts.economy.confidence, 0);
  assert.equal(incomplete.score.weighting.economy, 1 / 3, "A requested missing cohort is not silently reweighted away");
  assert.ok(incomplete.score.confidence <= weightedConfidence(incomplete) + 0.005);
  assert.ok(incomplete.score.confidence < current.score.confidence);

  const unknownVolume = fixture();
  unknownVolume.alpha.quote.volume = null;
  const unknownVolumeRun = runResearchSwarm(unknownVolume);
  assert.equal(unknownVolumeRun.market.volume, null, "An unreported index volume remains unknown at the public boundary");
  assert.ok(unknownVolumeRun.evidence.find(item => item.kind === "quote").summary.includes("volume not reported"));

  const indexInput = fixture();
  indexInput.alpha.providerAsOf = hoursBefore(16);
  indexInput.alpha.quote = { ...indexInput.alpha.quote, volume: null, observedAt: hoursBefore(16), sourceKind: "native-index-daily" };
  indexInput.alpha.technicals.volumeScore = null;
  indexInput.alpha.market.isOpen = false;
  indexInput.alpha.freshness = { mode: "end_of_day", isRealtime: false, isDelayed: false, label: "Completed native index session", explanation: "Synthetic daily index level" };
  const indexRun = runResearchSwarm(indexInput);
  const indexObservation = indexRun.evidence.find(item => item.kind === "quote");
  assert.equal(indexRun.market.volume, null);
  assert.equal(indexObservation.confidence, 72, "Native index observation quality uses freshness without requiring inapplicable traded volume");
  assert.equal(indexObservation.source, "Alpha Vantage INDEX_DATA");
  assert.equal(indexObservation.metrics.priceObservationKind, "native-index-daily");
  assert.equal(indexObservation.asOf, hoursBefore(16));
  assert.equal(indexRun.forecastSnapshot.asOf, indexRun.score.generatedAt, "The forecast decision snapshot is timestamped when research is generated");
  assert.equal(indexRun.forecastSnapshot.asOf, asOf, "Horizon calculations receive the current decision time, not the previous index session");
  assert.equal(indexRun.forecastSnapshot.price.observedAt, hoursBefore(16), "The original native index observation remains separately recorded");
  assert.equal(indexRun.providerAsOf, hoursBefore(16));
  const normalizedIndex = normalizeMarketSnapshot(indexRun.forecastSnapshot);
  assert.equal(normalizedIndex.asOf, asOf);
  assert.equal(normalizedIndex.price.observedAt, hoursBefore(16), "Snapshot normalization must retain original price provenance");
  assert.equal(normalizedIndex.slice.staleData, false, "A 16-hour-old observation is still inside the model's stricter 36-hour limit");
  assert.ok(indexRun.score.cohorts.technical.confidence <= 52, "A new decision time does not bypass the single-provider confidence cap");
  assert.ok(!indexObservation.topics.includes("volume"));
  assert.ok(!indexRun.evidence.some(item => item.id === "technical:volume"), "A missing liquidity measurement is never synthesized for an index");

  const datedQuote = fixture();
  datedQuote.alpha.quote = { ...datedQuote.alpha.quote, observedAt: hoursBefore(6), sourceKind: "intraday-bar" };
  const datedRun = runResearchSwarm(datedQuote);
  const datedObservation = datedRun.evidence.find(item => item.kind === "quote");
  assert.equal(datedObservation.asOf, hoursBefore(6), "A quote keeps its own observation time instead of borrowing a newer envelope time");
  assert.equal(datedObservation.source, "Alpha Vantage TIME_SERIES_INTRADAY");
  assert.equal(datedRun.forecastSnapshot.asOf, asOf);
  assert.equal(datedRun.forecastSnapshot.price.observedAt, hoursBefore(6), "A newer envelope timestamp cannot replace the quote's own timestamp in model inputs");
  datedQuote.alpha.quote.observedAt = null;
  assert.throws(() => runResearchSwarm(datedQuote), /current, verified market quote/, "An explicitly missing quote timestamp stays missing");

  const olderPrice = fixture();
  olderPrice.alpha.providerAsOf = hoursBefore(48);
  olderPrice.alpha.freshness = { mode: "end_of_day", isRealtime: false, isDelayed: false, label: "Previous daily close", explanation: "Synthetic older market observation" };
  const olderPriceRun = runResearchSwarm(olderPrice);
  assert.equal(olderPriceRun.forecastSnapshot.asOf, asOf);
  assert.equal(olderPriceRun.forecastSnapshot.price.observedAt, hoursBefore(48), "Legacy quotes without their own timestamp retain the provider observation time");
  const normalizedOlderPrice = normalizeMarketSnapshot(olderPriceRun.forecastSnapshot);
  assert.equal(normalizedOlderPrice.asOf, asOf);
  assert.equal(normalizedOlderPrice.price.observedAt, hoursBefore(48));
  assert.equal(normalizedOlderPrice.slice.staleData, true, "A fresh research decision never clears the model's 36-hour price staleness gate");

  for (const ageHours of [168, 169]) {
    const oldHistory = fixture();
    oldHistory.alpha.technicals.historyAsOf = hoursBefore(ageHours);
    const run = runResearchSwarm(oldHistory);
    assert.equal(run.cohorts.technical.robustness.exclusions.stale, ageHours === 169 ? 4 : 0, "Current technical factors are restricted to the last seven days");
    if (ageHours === 169) assert.equal(run.cohorts.technical.evidenceCount, 1, "An expired history cannot contribute indicators through a still-current quote");
  }

  const indexNews = fixture();
  indexNews.alpha.news.items[0] = { ...indexNews.alpha.news.items[0], retrievedAt: hoursBefore(1), publishedAt: hoursBefore(2), sentimentBasis: "provider-overall-index-context" };
  const indexArticle = runResearchSwarm(indexNews).evidence.find(item => item.sourceDomain === "publisher-0.example");
  assert.equal(indexArticle.retrievedAt, hoursBefore(1), "Per-article retrieval provenance is retained when collections are merged");
  assert.equal(indexArticle.metrics.sentimentBasis, "provider-overall-index-context");
  assert.ok(indexArticle.warnings.some(value => value.includes("overall sentiment about this index")));

  const provenance = fixture();
  provenance.alpha.quote = { ...provenance.alpha.quote, observedAt: hoursBefore(4), sourceKind: "global-quote" };
  provenance.alpha.providerAsOf = hoursBefore(4);
  provenance.alpha.technicals.historyAsOf = hoursBefore(12);
  provenance.alpha.health.retrievedAt = { quote: hoursBefore(3), index: hoursBefore(3.5), intraday: hoursBefore(2), daily: hoursBefore(5), overview: hoursBefore(6) };
  provenance.alpha.intraday = {
    interval: "5min", timeZone: "UTC", lastRefreshed: hoursBefore(2.5),
    bars: [{ timestamp: hoursBefore(2.5), providerTimestamp: hoursBefore(2.5), open: 100, high: 102, low: 99, close: 101, volume: 1000 }],
    session: { date: "2026-11-18", open: 100, high: 102, low: 99, latest: 101, vwap: 100.5, volume: 1000, changePercent: 1 },
  };
  provenance.alpha.overview = { name: "Fixture company", currency: "USD", sector: "Technology", industry: "Software",
    latestQuarter: "2026-09-30", marketCap: 1e9, peRatio: 20, pegRatio: 1.5, analystTargetPrice: 110,
    profitMargin: .2, operatingMargin: .25, returnOnEquity: .3, quarterlyRevenueGrowthYOY: .1, quarterlyEarningsGrowthYOY: .12 };
  const sourceClockRun = runResearchSwarm(provenance);
  assert.equal(sourceClockRun.evidence.find(item => item.kind === "quote").retrievedAt, hoursBefore(3), "A quote cache hit keeps its original provider fetch time");
  assert.equal(sourceClockRun.evidence.find(item => item.kind === "intraday").retrievedAt, hoursBefore(2), "Intraday evidence keeps its distinct original collection time");
  assert.ok(sourceClockRun.evidence.some(item => item.kind === "technical"));
  assert.ok(sourceClockRun.evidence.filter(item => item.kind === "technical").every(item => item.retrievedAt === hoursBefore(5)), "Daily-derived factors retain the daily endpoint's original fetch time");
  assert.ok(sourceClockRun.evidence.some(item => item.kind === "fundamental"));
  assert.ok(sourceClockRun.evidence.filter(item => item.kind === "fundamental").every(item => item.retrievedAt === hoursBefore(6)), "Fundamentals retain the overview endpoint's original fetch time");
  const fullValuation = sourceClockRun.evidence.find(item => item.id === "technical:fundamental:valuation");
  assert.ok(Math.abs(fullValuation.score - ((100 - 12 / 37 * 100) * .4 + (100 - 1 / 3.5 * 100) * .25 + 60 * .35)) < 1e-10, "Fully observed fundamentals preserve the existing component weights");
  assert.equal(fullValuation.metrics.observedComponentWeight, 1);
  assert.equal(sourceClockRun.retrievedAt, asOf, "Response assembly time remains separate from individual source provenance");
  provenance.alpha.quote = { ...provenance.alpha.quote, volume: null, sourceKind: "native-index-daily" };
  provenance.alpha.intraday = null;
  provenance.alpha.overview = null;
  const nativeSourceClockRun = runResearchSwarm(provenance);
  assert.equal(nativeSourceClockRun.evidence.find(item => item.kind === "quote").retrievedAt, hoursBefore(3.5), "An index level uses the native endpoint receipt, not the equity quote receipt");
  assert.ok(nativeSourceClockRun.evidence.filter(item => item.kind === "technical").every(item => item.retrievedAt === hoursBefore(3.5)), "Index-derived technical factors share their actual INDEX_DATA collection time");

  const nullInputs = fixture();
  nullInputs.alpha.technicals = { historyPointCount: 2, historyAsOf: hoursBefore(12), sma20: null, sma50: null, sma200: null, rsi14: null, volatility20Daily: null, volatility20Annualized: null, momentum30: null, drawdownFrom60DayHigh: null, averageTrueRange14: null, volumeTrendPercent: null, trendScore: null, momentumScore: null, riskScore: null, volumeScore: null };
  nullInputs.alpha.overview = { name: "Incomplete fixture company", latestQuarter: "2026-09-30", marketCap: null, peRatio: null, pegRatio: null, analystTargetPrice: null, profitMargin: null, operatingMargin: null, returnOnEquity: null, quarterlyRevenueGrowthYOY: null, quarterlyEarningsGrowthYOY: null, beta: null };
  const neutralModel = live.buildLiveMarketSnapshot({ symbol: "TEST", alpha: nullInputs.alpha });
  for (const field of ["trendScore", "momentumScore", "riskScore", "volumeScore", "rsi14"]) assert.equal(neutralModel.snapshot.technicals[field], 50, `Missing ${field} uses the explicit neutral model default, never Number(null) = 0`);
  assert.equal(neutralModel.snapshot.technicals.volatility20, 2.5);
  assert.equal(neutralModel.snapshot.fundamentals.beta, 1);
  assert.ok(neutralModel.coverage.neutralized.some(value => value.includes("volatility assumption 2.5%")));
  assert.ok(!neutralModel.coverage.derived.includes("20-return annualized realized volatility"));
  const nullRun = runResearchSwarm(nullInputs);
  assert.ok(!nullRun.evidence.some(item => item.kind === "fundamental"), "An overview full of unknown fields cannot create bearish or neutral fundamental evidence");
  assert.ok(!nullRun.evidence.some(item => item.kind === "technical"), "Missing lookbacks do not create artificial trend, momentum, risk, or volume factors");
  assert.ok(nullRun.score.confidenceAudit.inputs.neutralized.some(value => value.startsWith("trend score unavailable")));
  const partialTechnicals = fixture();
  partialTechnicals.alpha.technicals.componentCoverage = { trend: .24, momentum: 1, risk: 1, volume: 1 };
  const partialTechnicalRun = runResearchSwarm(partialTechnicals);
  const partialTrend = partialTechnicalRun.evidence.find(item => item.id === "technical:trend");
  assert.equal(partialTrend.confidence, 24, "A partial technical composite cannot borrow full confidence from its missing components");
  assert.equal(partialTrend.metrics.observedComponentWeight, .24);
  assert.ok(partialTechnicalRun.score.confidenceAudit.inputs.neutralized.some(value => value.includes("76% unobserved component weight")));
  nullInputs.alpha.overview.profitMargin = 0;
  const observedZero = runResearchSwarm(nullInputs).evidence.find(item => item.id === "technical:fundamental:quality");
  assert.equal(observedZero.score, 0, "An actually reported zero profit margin remains a valid measured input");
  assert.equal(observedZero.metrics.observedComponentWeight, .3);
  assert.ok(observedZero.summary.includes("operating margin unavailable"));
  assert.ok(observedZero.confidence <= 30, "One observed quality component cannot inherit confidence from two missing components");
  const noComparison = fixture();
  noComparison.alpha.quote = { ...noComparison.alpha.quote, observedAt: asOf, sourceKind: "intraday-bar", interval: "5min", volumeScope: "bar", comparisonSource: null, comparisonAsOf: null, changePercent: 0, previousClose: 100 };
  const noComparisonRun = runResearchSwarm(noComparison);
  const unscoredReturn = noComparisonRun.evidence.find(item => item.kind === "quote");
  assert.equal(unscoredReturn.confidence, 0, "A usable current price without a prior close does not create confident flat-return evidence");
  assert.equal(unscoredReturn.metrics.comparisonAvailable, false);
  assert.ok(noComparisonRun.score.confidenceAudit.inputs.neutralized.some(value => value.includes("previous session close unavailable")));

  const supported = {
    weightedCohortConfidence: 70, evidenceCoverage: 80, sourceDiversity: 70,
    evidenceAvailabilityPercent: 100, contradictionPenalty: 0, freshnessPenalty: 0,
  };
  const combined = evidence.composeResearchConfidence(supported);
  const supportedAudit = evidence.explainResearchConfidence(supported);
  assert.equal(supportedAudit.supportBeforePenalties, 76.5);
  assert.equal(supportedAudit.confidenceCap, 70);
  assert.equal(supportedAudit.finalConfidence, 70);
  assert.equal(evidence.composeResearchConfidence({ ...supported, weightedCohortConfidence: 0 }), 0);
  assert.ok(evidence.composeResearchConfidence({ ...supported, contradictionPenalty: 25 }) < combined);
  assert.ok(evidence.composeResearchConfidence({ ...supported, freshnessPenalty: 13 }) < combined);
  assert.ok(evidence.composeResearchConfidence({ ...supported, evidenceCoverage: 0 }) < combined);
  assert.ok(evidence.composeResearchConfidence({ ...supported, evidenceAvailabilityPercent: 0 }) < combined);
  for (const key of Object.keys(supported)) {
    const invalidAudit = evidence.explainResearchConfidence({ ...supported, [key]: NaN });
    assert.equal(invalidAudit.validInputs, false);
    assert.equal(evidence.composeResearchConfidence({ ...supported, [key]: NaN }), 0, "Malformed confidence inputs fail closed");
    const missingInput = { ...supported }; delete missingInput[key];
    assert.equal(evidence.explainResearchConfidence(missingInput).validInputs, false, "An omitted required input cannot be labeled a valid calculation");
  }

  console.log(`Research confidence checks passed: current coherent fixture ${current.score.confidence}/100; previously ${(current.score.confidence * previousMultiplier).toFixed(2)}/100 with repeated concentration discount. Low-relevance fixture ${weak.score.confidence}/100. Versioned composition preserves cohort caps, source audit, aging, missing cohorts, duplicates, agent invariance, and unknown volume.`);
} finally {
  mock.timers.reset();
}
