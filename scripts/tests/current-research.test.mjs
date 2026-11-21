import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

// Actual report, persistence, API, and orchestration code; all external I/O is
// controlled. A local in-memory Prisma fixture models ownership and uniqueness.
const root = resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const NOW = Date.parse("2026-11-18T20:00:00.000Z"), HOUR = 3_600_000;
const asOf = new Date(NOW).toISOString(), before = hours => new Date(NOW - hours * HOUR).toISOString();
const digest = value => createHash("sha256").update(value).digest("hex");
let assertions = 0;
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const check = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); assertions++; };
const yes = (condition, message) => { assert.ok(condition, message); assertions++; };
const rejects = async (work, code) => { await assert.rejects(work, error => error.code === code); assertions++; };
function loader(overrides = {}, environment = {}) {
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
  const context = createContext({ console, Buffer, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal,
    DOMException, Date: ClockDate, structuredClone, process: { env: environment }, setTimeout, clearTimeout,
    fetch() { throw new Error("Uncontrolled network access"); } });
  const cache = new Map();
  function load(file) {
    let absolute = file.startsWith("@/") ? resolve(root, "src", file.slice(2)) : resolve(root, file);
    if (!extname(absolute)) absolute += ".ts";
    const key = relative(root, absolute);
    if (Object.hasOwn(overrides, key)) return overrides[key];
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const compiled = ts.transpileModule(readFileSync(absolute, "utf8"), { fileName: absolute, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    assert.equal(compiled.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, key + " transpiles");
    const imports = name => {
      if (name === "server-only") return {};
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith("node:")) return nativeRequire(name);
      if (name.startsWith("@/")) return load(name);
      if (name.startsWith(".")) return load(resolve(dirname(absolute), name));
      throw new Error("Uncontrolled dependency: " + name);
    };
    runInContext("(function(require,module,exports){" + compiled.outputText + "\n})", context, { filename: absolute })(imports, module, module.exports);
    return module.exports;
  }
  return { load, context };
}
const pure = loader(), readiness = pure.load("src/lib/intelligence/research-readiness.ts");
const identity = pure.load("src/lib/intelligence/research-instrument.ts");
const evidence = (id, cohort = "media", kind = "news", hours = 1, changes = {}) => ({
  id: "media:alpha:" + id, symbol: "MSFT", cohort, kind, title: "Independent finding " + id, summary: "Synthetic test observation.",
  source: "Fixture " + id, sourceUrl: "https://" + id + ".example/report", asOf: before(hours), retrievedAt: asOf,
  score: 65, confidence: 70, relevanceScore: 90, freshnessScore: 95, polarity: "positive", sector: "Technology",
  industry: "Software", topics: ["earnings"], metrics: {}, warnings: [], ...changes,
});
const analytics = { connectednessScore: 70, networkResilience: 70, contradictionRatio: 0, sourceConcentration: 30,
  centralityTop: [], communities: [] };
function researchFixture({ missingMedia = false, symbol = "MSFT", runId = "run-a" } = {}) {
  const rows = [
    ...(!missingMedia ? [evidence("publisher-a"), evidence("publisher-b"), evidence("publisher-c")] : []),
    evidence("technical-current", "technical", "technical", 2),
    evidence("financial-period", "economy", "fundamental", 45 * 24),
    evidence("monthly-period", "economy", "economic-series", 60 * 24, { metrics: { interval: "monthly" } }),
  ].map(row => ({ ...row, symbol }));
  const graph = { schemaVersion: "slice-research-graph-1.0.0", symbol, runId, generatedAt: asOf, clusters: [],
    nodes: [{ id: "score", kind: "score", label: "Research score", cohort: "shared", score: 63, confidence: 21, size: 10, group: "Score", properties: {} },
      ...rows.map(row => ({ id: "evidence:" + row.id, kind: "evidence", label: row.title, cohort: row.cohort, score: row.score,
        confidence: row.confidence, size: 8, group: row.kind, properties: { kind: row.kind, source: row.source, sourceUrl: row.sourceUrl, asOf: row.asOf } })),
      { id: "agent:technical:1", kind: "agent", label: "Technical agent #1", cohort: "technical", score: 65, confidence: 60, size: 8,
        group: "Agents", properties: { status: "completed", primaryEvidenceId: "media:alpha:technical-current" } }],
    edges: [{ id: "usage", kind: "USES_EVIDENCE", source: "agent:technical:1", target: "evidence:media:alpha:technical-current", weight: 1, cohort: "technical", properties: {} }] };
  graph.nodeCount = graph.nodes.length; graph.edgeCount = graph.edges.length;
  return { ok: true, symbol, runId, completedAt: asOf, providerAsOf: before(.1), companyName: "Microsoft", sector: "Technology", industry: "Software",
    requestedAgents: 30, activeAgents: 30, durationMs: 100, warnings: [], evidence: rows, graph, graphAnalytics: analytics, agents: [],
    score: { overall: 63, confidence: 21, generatedAt: asOf, providerAsOf: before(.1), weighting: { media: .4, technical: .4, economy: .2 },
      quality: { contradictionPenalty: 0, freshnessPenalty: 0 } },
    cohorts: { media: { confidence: missingMedia ? 0 : 21, evidenceCount: missingMedia ? 0 : 3, agreement: 80 },
      technical: { confidence: 60, evidenceCount: 1, agreement: 80 }, economy: { confidence: 60, evidenceCount: 2, agreement: 80 } },
    market: { provider: "Alpha Vantage", price: 100, currency: "USD", realTimeConfirmed: true },
    economy: { warnings: [], series: [{ label: "Monthly fixture", interval: "monthly", latestValue: 2.5, asOf: before(60 * 24),
      retrievedAt: before(1), confidence: 60, warning: "" }] },
    forecastSnapshot: { symbol, asOf: before(.1), price: 100, requestId: runId },
  };
}
function publicFixture(count = 1) {
  return { articles: Array.from({ length: count }, (_, index) => ({
    id: "public-" + index, title: "Microsoft public source " + index, summary: "Unscored feed metadata.",
    url: "https://news.google.com/rss/articles/public-" + index, publisher: "Feed publisher", publisherUrl: "https://publisher.example",
    publisherDomain: "publisher.example", publisherAttribution: "feed-reported", linkKind: "aggregator", publishedAt: before(2),
    retrievedAt: before(1), feedUrl: "https://news.google.com/rss/search?q=Microsoft", discoveryProvider: "Google News RSS",
    matchedBy: "company-name", sentiment: null, duplicateCount: 0, relatedSources: [],
  })), diagnostics: { status: count ? "partial" : "empty", windowStart: before(168), windowEnd: asOf, requestedQueries: 1,
    completedQueries: 1, uniqueArticles: count, publisherCount: count ? 1 : 0, warnings: [],
    queries: [{ query: "Microsoft when:7d", url: "https://news.google.com/rss/search?q=Microsoft", status: "ok",
      cacheState: "cache", retrievedAt: before(1), parsedCount: count, acceptedCount: count,
      rejected: { stale: 0, future: 0, undated: 0, unrelated: 0, unsafeUrl: 0, duplicate: 0 } }] } };
}
function alphaFixture(symbol = "MSFT") {
  return { ok: true, symbol, providerAsOf: before(.1), retrievedAt: asOf, instrument: identity.resolveResearchInstrument(symbol),
    overview: { name: "Microsoft", sector: "Technology", industry: "Software" }, news: null,
    market: { isOpen: true }, freshness: { mode: "realtime" },
    health: { cache: { quote: "fresh", daily: "cache", news: "fresh" }, errors: {}, retrievedAt: { quote: before(.1), daily: before(2) }, newsDiagnostics: [] } };
}
const reportInput = (research, publicNews = publicFixture(), newsDiagnostics = []) => ({ research, publicNews, newsDiagnostics, alpha: alphaFixture(research.symbol) });

// A one-week window is measured from original observations. Slow-release series
// remain dated context; a recent retrieval cannot make old prices/news current.
const scored = researchFixture();
scored.evidence.push(
  evidence("exact-boundary", "technical", "technical", 168),
  evidence("old-news", "media", "news", 169),
  evidence("old-technical", "technical", "technical", 169),
  evidence("old-quote", "technical", "quote", 169),
  evidence("undated", "media", "news", 1, { asOf: null }),
  evidence("future", "media", "news", -1),
  evidence("no-source", "media", "news", 1, { sourceUrl: "" }),
  evidence("zero-quality", "media", "news", 1, { confidence: 0 }),
);
const scoredBefore = structuredClone(scored), report = readiness.buildCurrentResearchReport(reportInput(scored));
check(report.windowStart, before(168)); check(report.windowHours, 168);
check(report.currentEvidenceCount, 5); check(report.contextEvidenceCount, 2); check(report.excludedEvidenceCount, 7);
check(report.scoredNewsCount, 3); check(report.scoredPublisherCount, 3);
check(report.priceObservedAt, before(.1)); check(report.collection.find(row => row.query === "daily").retrievedAt, before(2));
check(report.cohorts.find(row => row.cohort === "economy").contextCount, 2);
check(report.cohorts.find(row => row.cohort === "media").confidence, 21); check(report.status, "limited");
yes(report.gaps.some(row => row.code === "weak-support")); check(report.publication, "forecast");
check(scored, scoredBefore, "Reporting never mutates observations or scores");
const moreReading = readiness.buildCurrentResearchReport(reportInput(scored, publicFixture(100)));
check(moreReading.discoveredNewsCount, 100); check(moreReading.cohorts, report.cohorts);
check(moreReading.currentEvidenceCount, report.currentEvidenceCount); check(moreReading.status, report.status);
check(scored.score.confidence, 21, "Public discovery never raises confidence to a threshold");
check(moreReading.discoveries[0].sentiment, null); check(moreReading.discoveries[0].retrievedAt, before(1));

const incomplete = researchFixture({ missingMedia: true });
incomplete.currentResearch = readiness.buildCurrentResearchReport(reportInput(incomplete));
check(readiness.hasCompleteScoredResearch(incomplete), false); check(incomplete.currentResearch.publication, "research-only");
check(incomplete.currentResearch.status, "incomplete"); check(incomplete.currentResearch.scoredNewsCount, 0);
yes(incomplete.currentResearch.gaps.some(row => row.code === "missing-media"));
yes(incomplete.currentResearch.gaps.some(row => row.code === "no-current-scored-news"));
const technicalOnly = structuredClone(incomplete); technicalOnly.score.weighting = { media: 0, technical: 1, economy: 0 };
check(readiness.hasCompleteScoredResearch(technicalOnly), true);
check(readiness.buildCurrentResearchReport(reportInput(technicalOnly)).cohorts[0].status, "not-weighted");
assert.throws(() => readiness.buildCurrentResearchReport(reportInput({ ...incomplete, completedAt: "invalid" }))); assertions++;
const failures = reportInput(incomplete, publicFixture(), [{ query: "latest-index-news", status: "rate-limited",
  message: "Authorization: Bearer PRIVATE_FIXTURE\nhttps://user:PRIVATE_FIXTURE@provider.example?apikey=PRIVATE_FIXTURE",
  cacheState: "cooldown", retrievedAt: before(1), acceptedItems: 0 }]);
failures.alpha.health.errors.daily = "token=PRIVATE_FIXTURE";
failures.research.economy.warnings = ["Economic series fixture failure: token=PRIVATE_FIXTURE"];
const failedReport = readiness.buildCurrentResearchReport(failures);
yes(!JSON.stringify(failedReport).includes("PRIVATE_FIXTURE"), "Provider diagnostics cannot leak fixture credentials");
yes(failedReport.notes.some(note => note.includes("Economic series fixture failure") && note.includes("[redacted]")), "Failed-series reasons remain visible even without a returned observation");
check(failedReport.collection[0].status, "rate-limited"); check(failedReport.collection[0].retrievedAt, before(1));
yes(failedReport.gaps.some(row => row.code === "provider-availability"));
const indexResearch = researchFixture({ missingMedia: true, symbol: "INDEX:SPX" });
check(readiness.buildCurrentResearchReport(reportInput(indexResearch)).instrumentKind, "index");

class StrategyError extends Error { constructor(code, message, status = 500) { super(message); this.code = code; this.status = status; } }
class ApiError extends Error { constructor(options) { super(options.message); Object.assign(this, options); } }
function memoryStore() {
  const rows = [], queries = []; let sequence = 0;
  const matches = (row, where) => Object.entries(where).every(([key, value]) =>
    value && typeof value === "object" && Array.isArray(value.in) ? value.in.includes(row[key]) : row[key] === value);
  return { rows, queries, table: {
    async findFirst(query) {
      queries.push(query);
      return rows.filter(row => matches(row, query.where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    },
    async create({ data }) {
      if (rows.some(row => row.userId === data.userId && row.researchRunId === data.researchRunId)) throw Object.assign(new Error("Unique run"), { code: "P2002" });
      const row = { id: "bundle-" + ++sequence, forecastRunId: null, forecastJson: null, outputSha256: null,
        createdAt: new Date(NOW + sequence * 1000), ...data };
      rows.push(row); return row;
    },
    async update({ where, data }) { const row = rows.find(row => row.id === where.id); if (!row) throw Error("Missing fixture row"); return Object.assign(row, data); },
  } };
}
const store = memoryStore(), counters = { engine: 0, forecastStorage: 0, storage: [], access: [], canonicalPost: [] };
const forbidden = name => () => { counters[name]++; throw Error("Unexpected " + name + " call"); };
let signedInUser = "owner-a", postResult = incomplete;
const graphOps = { analyzeResearchGraph: () => analytics, projectResearchGraph: graph => graph,
  getResearchGraphNodeDetail: (graph, id) => graph.nodes.find(node => node.id === id) ?? null };
const external = {
  "@/lib/data-readiness/server": { requireResearchStorage: async tables => { counters.storage.push(tables); } },
  "@/lib/prisma": { prisma: { sliceForecastBundle: store.table, intelligenceForecastHorizon: { findMany: forbidden("forecastStorage") } } },
  "@/lib/intelligence-forecast/engine": { buildForecast: forbidden("engine"), createDisabledCamelFeatures: forbidden("engine") },
  "@/lib/intelligence-forecast/validation": { normalizeMarketSnapshot: forbidden("engine") },
  "@/lib/intelligence-forecast/persistence": { persistForecastRun: forbidden("forecastStorage") },
  "@/lib/intelligence-forecast/point-in-time-warehouse": { auditForecastEvidenceRun: forbidden("forecastStorage") },
  "@/lib/intelligence-forecast/provenance-graph": { syncForecastRunToGraph: forbidden("forecastStorage") },
  "@/lib/neo4j": { isNeo4jConfigured: () => false },
  "@/lib/intelligence-forecast/horizon-models": { loadHorizonModelSuite: forbidden("engine"), persistShadowHorizonPredictions: forbidden("engine"), scoreHorizonModelSuite: forbidden("engine") },
  "@/lib/intelligence/graph-engine": graphOps,
  "@/lib/strategy-lab/contracts": { StrategyError },
  "@/lib/api-route": { ApiError, apiJson: (body, init) => new Response(JSON.stringify(body), init), withApiRoute: (_options, handler) => handler },
  "@/lib/strategy-lab/http": { strategyAccess: async (_request, write) => { counters.access.push({ userId: signedInUser, write }); if (!signedInUser) throw new StrategyError("UNAUTHENTICATED", "Sign in", 401); return signedInUser; },
    readResearchJson: request => request.json(), strategyFailure: error => { throw error; } },
  "@/lib/intelligence/research-swarm-service": { buildResearchSwarmForUser: async input => { counters.canonicalPost.push(input); return postResult; } },
};
const persistenceLoader = loader(external), canonical = persistenceLoader.load("src/lib/intelligence-unified/service.ts");
const canonicalRoute = persistenceLoader.load("src/app/api/intelligence/canonical/route.ts");
const saved = await canonical.publishResearchOnly("owner-a", incomplete);
check(saved.classification, "research-only-no-forecast"); check(saved.researchRunId, incomplete.runId);
check(saved.currentResearch, incomplete.currentResearch); check(saved.score.confidence, 21);
check(store.rows[0].status, "ResearchOnly"); check(store.rows[0].forecastJson, null);
check(store.rows[0].forecastRunId, null); check(store.rows[0].outputSha256, null);
check(counters.engine, 0); check(counters.forecastStorage, 0);
await rejects(canonical.publishAlphaResearch("owner-a", incomplete), "INCOMPLETE_EVIDENCE");
check(counters.engine, 0, "Missing scored cohorts are rejected before normalization or engine calls");
const repeated = await canonical.publishResearchOnly("owner-a", { ...incomplete, score: { ...incomplete.score, overall: 99 } });
check(repeated.id, saved.id); check(repeated.score.overall, 63); check(store.rows.length, 1, "Immutable runs are never overwritten on retry");
check(await canonical.readResearchOnly("other-user", "MSFT", incomplete.runId), null);
check(await canonical.readResearchOnly("owner-a", "OTHER", incomplete.runId), null);
check(await canonical.readResearchOnly("owner-a", "MSFT", "missing-run"), null);
check(await canonical.readCanonical("owner-a", "MSFT", incomplete.runId), null);
const graphRead = await canonical.readCanonicalGraph({ userId: "owner-a", symbol: "MSFT", runId: incomplete.runId });
check(graphRead.runId, incomplete.runId); check(graphRead.metadata.currentResearch, incomplete.currentResearch);
const sourceRead = await canonical.readCanonicalResearchSources({ userId: "owner-a", symbol: "MSFT", runId: incomplete.runId });
check(sourceRead.currentResearch.discoveries[0].sentiment, null); check(sourceRead.total, incomplete.evidence.length);
const agentRead = await canonical.readCanonicalResearchAgents({ userId: "owner-a", symbol: "MSFT", runId: incomplete.runId });
check(agentRead.total, 1); check(agentRead.items[0].primaryEvidenceId, "media:alpha:technical-current");
for (const read of ["readCanonicalGraph", "readCanonicalResearchSources", "readCanonicalResearchAgents"]) {
  check(await canonical[read]({ userId: "other-user", symbol: "MSFT", runId: incomplete.runId }), null);
}
yes(store.queries.every(query => query.where.userId), "Every persistence read contains authenticated ownership");
for (const field of ["researchJson", "graphJson", "snapshotJson", "inputSha256", "forecastJson", "forecastRunId", "outputSha256"]) {
  const row = store.rows[0], original = row[field]; row[field] = "tampered";
  await rejects(canonical.readResearchOnly("owner-a", "MSFT", incomplete.runId), "RESEARCH_INTEGRITY");
  row[field] = original;
}
await rejects(canonical.publishResearchOnly("owner-a", { ...incomplete, symbol: "OTHER" }), "RESEARCH_RUN_CONFLICT");
await rejects(canonical.publishResearchOnly("owner-a", { ...incomplete, runId: "invalid-price", market: { ...incomplete.market, price: 0 } }), "NO_VERIFIED_PRICE");
await rejects(canonical.publishResearchOnly("owner-a", { ...incomplete, runId: "invalid-state", currentResearch: { publication: "forecast" } }), "INVALID_RESEARCH_STATUS");

// A later completed forecast wins latest selection; a later incomplete run is
// separately readable and must not cause the API to display an older forecast.
const row = store.rows[0], forecastJson = JSON.stringify({ generatedAt: asOf, asOf, horizons: [] });
await store.table.create({ data: { ...row, id: "ready-fixture", researchRunId: "ready-run", status: "Ready",
  createdAt: new Date(NOW + 10_000), forecastJson, outputSha256: digest(forecastJson), forecastRunId: "forecast-ready" } });
check(await canonical.readResearchOnly("owner-a", "MSFT"), null);
check((await canonical.readCanonical("owner-a", "MSFT")).researchRunId, "ready-run");
const later = structuredClone(incomplete); later.runId = "later-partial"; later.graph.runId = later.runId;
await canonical.publishResearchOnly("owner-a", later);
store.rows.find(item => item.researchRunId === later.runId).createdAt = new Date(NOW + 20_000);
check((await canonical.readResearchOnly("owner-a", "MSFT")).researchRunId, later.runId);
check(await canonical.readCanonical("owner-a", "MSFT"), null, "A newer incomplete run fences every implicit older-forecast read");
check((await canonical.readCanonical("owner-a", "MSFT", "ready-run")).researchRunId, "ready-run", "An explicitly pinned older forecast remains inspectable");
check(await canonical.readResearchOnly("owner-a", "MSFT", "ready-run"), null);
const get = async query => {
  const response = await canonicalRoute.GET({ request: new Request("https://slice.example/api/intelligence/canonical?" + query) });
  check(response.headers.get("cache-control"), "private, no-store");
  return response.json();
};
const latestResponse = await get("symbol=MSFT");
check(latestResponse.bundle, null); check(latestResponse.researchOnly.researchRunId, later.runId);
const explicitReady = await get("symbol=MSFT&researchRunId=ready-run");
check(explicitReady.bundle.researchRunId, "ready-run"); check(explicitReady.researchOnly, null);
check((await get("symbol=MSFT&researchRunId=missing")).researchOnly, null);
signedInUser = "other-user"; const privateResult = await get("symbol=MSFT&researchRunId=" + later.runId);
check(privateResult.bundle, null); check(privateResult.researchOnly, null); signedInUser = "owner-a";
const savedIndex = { ...indexResearch, runId: "index-partial",
  currentResearch: readiness.buildCurrentResearchReport(reportInput(indexResearch)) };
await canonical.publishResearchOnly("owner-a", savedIndex); postResult = savedIndex;
const indexResponse = await get("symbol=%5EGSPC&researchRunId=index-partial");
check(indexResponse.researchOnly.symbol, "INDEX:SPX"); check(indexResponse.bundle, null);
const postResponse = await canonicalRoute.POST({ request: new Request("https://slice.example/api/intelligence/canonical", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol: "^GSPC" }) }) });
check((await postResponse.json()).researchOnly.researchRunId, "index-partial");
check(counters.canonicalPost.at(-1).symbol, "INDEX:SPX"); check(counters.canonicalPost.at(-1).forceRefresh, true);
check(counters.access.at(-1).write, true); check(counters.engine, 0);

// Actual collector orchestration preserves ratios/identity and reaches immutable
// research-only storage while every external provider is replaced by a fixture.
const calls = { alpha: [], news: [], economy: [], public: [], run: [], completed: [] };
let runNumber = 0;
const orchestrationOverrides = { ...external };
delete orchestrationOverrides["@/lib/intelligence/research-swarm-service"];
Object.assign(orchestrationOverrides, {
  "@/lib/intelligence-forecast/production-controls": { guardIntelligenceOperation: async () => ({ id: "ticket" }),
    completeIntelligenceOperation: async input => { calls.completed.push(input); }, IntelligenceGuardError: class extends Error {}, guardErrorResponse: () => ({ status: 409 }) },
  "@/lib/intelligence/alpha-vantage-live": {
    getAlphaVantageIntelligence: async input => { calls.alpha.push(input); return alphaFixture(input.symbol); },
    getExpandedAlphaResearchNews: async input => { calls.news.push(input); return { news: null, requestedQueries: 3, completedQueries: 1, warnings: [],
      diagnostics: [{ query: "latest", status: "rate-limited", message: "Fixture provider quota", cacheState: "cooldown", retrievedAt: before(1), acceptedItems: 0 }] }; },
  },
  "@/lib/intelligence/economic-live": { getEconomicResearch: async input => { calls.economy.push(input); return researchFixture().economy; } },
  "src/lib/intelligence/research-public-news.ts": { collectPublicResearchNews: async input => { calls.public.push(input); return publicFixture(); } },
  "@/lib/intelligence/research-swarm": { runResearchSwarm: input => { calls.run.push(input); const result = researchFixture({ missingMedia: true, symbol: input.symbol, runId: "orchestration-" + ++runNumber });
    result.score.weighting = input.researchWeights; return result; } },
  "@/lib/intelligence/research-graph": { getResearchGraphPersistenceConfiguration: () => ({ configured: false }),
    loadResearchKnowledgeGraphRecord: async () => null, persistResearchKnowledgeGraph: async () => { throw Error("Unexpected graph persistence"); } },
  "src/lib/intelligence/research-preferences.ts": { readResearchPreferences: async () => { throw Error("Explicit ratios should not load preferences"); } },
});
const orchestration = loader(orchestrationOverrides, { ALPHA_VANTAGE_API_KEY: "fixture-only-not-a-provider-key", INTELLIGENCE_SWARM_CACHE_MS: "60000" });
const service = orchestration.load("src/lib/intelligence/research-swarm-service.ts");
const buildInput = { userId: "build-owner", symbol: "^GSPC", requestedAgents: 30, researchWeights: { media: 40, technical: 40, economy: 20 },
  detailMode: "summary", graphMode: "summary", projection: "overview", persistGraph: false, forceRefresh: true };
const built = await service.buildResearchSwarmForUser(buildInput);
check(built.symbol, "INDEX:SPX"); check(built.market.currency, "index points"); check(built.currentResearch.publication, "research-only");
check(built.score.weighting, { media: .4, technical: .4, economy: .2 }); check(built.score.confidence, 21);
check(built.currentResearch.discoveredNewsCount, 1); check(counters.engine, 0); check(counters.forecastStorage, 0);
for (const key of ["alpha", "news", "economy", "public"]) check(calls[key][0].forceRefresh, true, key + " receives explicit refresh");
check(calls.alpha[0].symbol, "INDEX:SPX"); check(calls.news[0].symbol, "INDEX:SPX");
check(calls.public[0].queryName, "S&P 500"); check(calls.public[0].assetType, "index");
yes(calls.public[0].aliases.includes("S&P500")); check(calls.public[0].existing, []);
check(calls.completed.at(-1).success, true);
const builtStored = store.rows.find(item => item.userId === "build-owner" && item.researchRunId === built.runId);
check(builtStored.status, "ResearchOnly"); check(builtStored.forecastJson, null);
const cached = await service.buildResearchSwarmForUser({ ...buildInput, forceRefresh: false });
check(cached.runId, built.runId); check(calls.alpha.length, 1);
const refreshed = await service.buildResearchSwarmForUser(buildInput);
yes(refreshed.runId !== built.runId); check(calls.alpha.length, 2); check(calls.public.length, 2);
check(counters.engine, 0); check(counters.forecastStorage, 0);
console.log("Current research: " + assertions + " deterministic checks passed (readiness, private immutable research-only storage, exact-run API, and refresh orchestration; no live providers).");
