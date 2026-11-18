import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const temporary = await mkdtemp(join(tmpdir(), "slice-knowledge-graph-"));
const modules = {
  "research-config": "intelligence/research-config.ts",
  "research-evidence": "intelligence/research-evidence.ts",
  "research-result-cache": "intelligence/research-result-cache.ts",
  "research-swarm": "intelligence/research-swarm.ts",
  "graph-engine": "intelligence/graph-engine.ts",
  "live-snapshot": "intelligence-forecast/live-snapshot.ts",
};

try {
  for (const [name, path] of Object.entries(modules)) {
    const source = await readFile(new URL(`../../src/lib/${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source.replace(/^import ["']server-only["'];?\s*$/m, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      fileName: path,
      reportDiagnostics: true,
    });
    assert.equal(compiled.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0);
    const output = compiled.outputText.replace(/from ["'](?:@\/lib\/(?:intelligence|intelligence-forecast)\/|\.\/)(research-config|research-evidence|live-snapshot)["']/g, 'from "./$1.mjs"');
    await writeFile(join(temporary, `${name}.mjs`), output);
  }
  const config = await import(pathToFileURL(join(temporary, "research-config.mjs")).href);
  const provenance = await import(pathToFileURL(join(temporary, "research-evidence.mjs")).href);
  const resultCache = await import(pathToFileURL(join(temporary, "research-result-cache.mjs")).href);
  const { runResearchSwarm } = await import(pathToFileURL(join(temporary, "research-swarm.mjs")).href);
  const graphEngine = await import(pathToFileURL(join(temporary, "graph-engine.mjs")).href);

  assert.equal(resultCache.RESEARCH_RESULT_CACHE_LIMITS.maxBytes, 32 * 1024 * 1024);
  const cached = new Map(), limits = { maxBytes: 20, maxEntries: 2 };
  const cacheRecord = (value, byteCount = 8, expiresAt = 200) => ({ value, byteCount, expiresAt });
  assert.equal(resultCache.researchResultByteSize({ text: "é🙂" }), Buffer.byteLength(JSON.stringify({ text: "é🙂" })));
  const circular = {}; circular.self = circular;
  assert.equal(resultCache.researchResultByteSize(circular), Infinity);
  resultCache.retainResearchResult(cached, "a", cacheRecord("a"), 100, limits);
  resultCache.retainResearchResult(cached, "b", cacheRecord("b"), 100, limits);
  resultCache.retainResearchResult(cached, "c", cacheRecord("c"), 100, limits);
  assert.deepEqual([...cached.keys()], ["b", "c"], "Insertion prunes immediately by count/bytes");
  resultCache.retainResearchResult(cached, "large", cacheRecord("large", 18), 100, limits);
  assert.deepEqual([...cached.keys()], ["large"], "Byte budget applies even below the entry limit");
  assert.equal(resultCache.retainResearchResult(cached, "large", cacheRecord("oversized", 21), 100, limits), false);
  assert.equal(cached.size, 0, "An oversized replacement is not retained or served from its stale predecessor");
  resultCache.retainResearchResult(cached, "fresh", cacheRecord("fresh"), 100, limits);
  cached.set("expired", cacheRecord("expired", 2, 99));
  cached.set("legacy", { value: "old cache schema", expiresAt: 200 });
  cached.set("invalid", cacheRecord("invalid", Infinity));
  assert.deepEqual(resultCache.pruneResearchResultCache(cached, 100, limits), { bytes: 8, entries: 1 });
  assert.equal(resultCache.retainResearchResult(cached, "expired-new", cacheRecord("expired-new", 5, 100), 100, limits), false);
  assert.equal(resultCache.pruneResearchResultCache(cached, 201, limits).entries, 0);
  for (let index = 0; index < 100; index += 1) resultCache.retainResearchResult(cached, String(index), cacheRecord(index, 1), 100);
  assert.equal(cached.size, resultCache.RESEARCH_RESULT_CACHE_LIMITS.maxEntries);
  const flights = new Map(), older = Promise.resolve("old"), newer = Promise.resolve("new");
  flights.set("same-request", older); flights.set("same-request", newer);
  resultCache.releaseResearchFlight(flights, "same-request", older);
  assert.equal(flights.get("same-request"), newer, "A late old refresh must not release the newer flight");
  resultCache.releaseResearchFlight(flights, "same-request", newer);
  assert.equal(flights.size, 0);

  assert.deepEqual(config.allocateResearchAgents(10_000, { media: 55, technical: 30, economy: 15 }).allocation, { media: 5500, technical: 3000, economy: 1500 });
  for (const total of [30, 31, 601, 9999, 10_000, 50_000, NaN]) {
    for (const weights of [{ media: 1, technical: 2, economy: 7 }, { media: 0, technical: 100, economy: 0 }, { media: -5, economy: NaN }, null]) {
      const result = config.allocateResearchAgents(total, weights);
      assert.equal(Object.values(result.allocation).reduce((a, b) => a + b), result.total);
      assert.ok(result.total >= 30 && result.total <= 10_000);
      assert.ok(Math.abs(Object.values(result.weights).reduce((a, b) => a + b) - 1) < 1e-12);
      for (const key of ["media", "technical", "economy"]) {
        assert.ok(Number.isInteger(result.allocation[key]) && result.allocation[key] >= 0);
        if (!result.weights[key]) assert.equal(result.allocation[key], 0);
      }
    }
  }
  assert.equal(provenance.safeResearchSourceUrl("javascript:alert(1)"), "");
  assert.equal(provenance.safeResearchSourceUrl("https://user:password@example.com/story"), "");
  assert.equal(provenance.safeResearchSourceUrl("https://example.com/story?apikey=PRIVATE&token=PRIVATE&utm_source=feed&id=7#private"), "https://example.com/story?id=7");

  const asOf = "2026-11-18T20:00:00.000Z";
  const record = (changes = {}) => ({
    id: "a", cohort: "media", kind: "news", title: "A specific company announces its quarterly earnings results", summary: "Fixture evidence", source: "Example News", sourceUrl: "https://example.com/earnings", asOf, retrievedAt: asOf,
    score: 75, confidence: 85, freshnessScore: 90, relevanceScore: 100, polarity: "positive", symbol: "TEST", sector: "Technology", industry: "Software", topics: ["earnings"], metrics: {}, warnings: [], ...changes,
  });
  const a = record();
  const b = record({ id: "b", title: "Independent demand survey signals lower customer growth", source: "Second News", sourceUrl: "https://second.example/demand", score: 30 });
  const duplicates = Array.from({ length: 300 }, (_, index) => record({ id: `dup-${index}`, sourceUrl: `https://example.com/earnings?utm_campaign=${index}` }));
  assert.deepEqual(provenance.aggregateResearchEvidence([a, b]), provenance.aggregateResearchEvidence([a, b, ...duplicates]));
  assert.equal(provenance.aggregateResearchEvidence([]).confidence, 0);
  assert.equal(provenance.aggregateResearchEvidence([]).score, 50);
  const syndicated = provenance.deduplicateResearchEvidence([a, record({ id: "syndicated", source: "Republisher", sourceUrl: "https://syndicated.example/story" })]);
  assert.equal(syndicated.evidence.length, 1);
  assert.equal(syndicated.duplicateCount, 1);
  assert.equal(syndicated.evidence[0].relatedSources[0].url, "https://syndicated.example/story");
  const mergedAliases = provenance.deduplicateResearchEvidence([a, { ...syndicated.evidence[0], relatedSources: [...syndicated.evidence[0].relatedSources, { source: "Third publication", url: "https://third.example/story?access_token=PRIVATE", asOf }, { source: "Unsafe", url: "javascript:alert(1)", asOf }] }]);
  assert.deepEqual(mergedAliases.evidence[0].relatedSources.map((source) => source.url), ["https://syndicated.example/story", "https://third.example/story"]);
  const technical = [record({ id: "technical1", cohort: "technical", kind: "technical", title: "Momentum", source: "Provider momentum", sourceUrl: "https://provider.example/docs" }), record({ id: "technical2", cohort: "technical", kind: "technical", title: "Volume", source: "Provider volume", sourceUrl: "https://provider.example/docs" })];
  assert.equal(provenance.deduplicateResearchEvidence(technical).evidence.length, 2);
  assert.equal(provenance.aggregateResearchEvidence(technical).sourceCount, 1);

  const alpha = {
    ok: true, symbol: "TEST", retrievedAt: asOf, providerAsOf: asOf, providerTimeZone: "UTC",
    quote: { price: 100, previousClose: 99, change: 1, changePercent: 1.01, volume: 1_000_000 },
    freshness: { mode: "end_of_day", isRealtime: false, isDelayed: false, label: "Daily close", explanation: "Fixture daily data" },
    health: { warnings: [], endpointCount: 3, successfulEndpointCount: 3 },
    market: { isOpen: false, currentStatus: "closed" },
    news: { articleCount: 2, relevanceWeightedSentiment: 0.15, items: [a, b].map((item) => ({ id: item.id, title: item.title, summary: item.summary, source: item.source, sourceDomain: new URL(item.sourceUrl).hostname, url: item.sourceUrl, publishedAt: asOf, tickerSentimentScore: (item.score - 50) / 50, tickerRelevance: 1, overallSentimentScore: 0.2, topics: item.topics })) },
  };
  const economy = {
    retrievedAt: asOf, sector: "Technology", industry: "Software", regime: "Balanced", score: 45, confidence: 65, warnings: [],
    series: [{ functionName: "TEST_RATE", label: "Test policy rate", description: "Synthetic test input", latestValue: 4, previousValue: 3.5, change: 0.5, changePercent: 14.2, industrySensitivity: 0.9, source: "Macro fixture provider", sourceUrl: "https://macro.example/rates", asOf, retrievedAt: asOf, score: 35, confidence: 70, warning: null }],
  };
  const input = { symbol: "TEST", alpha, economy, scan: null, graphMode: "full", researchWeights: { media: 55, technical: 30, economy: 15 } };
  const small = runResearchSwarm({ ...input, requestedAgents: 30 });
  const started = performance.now();
  const large = runResearchSwarm({ ...input, requestedAgents: 10_000 });
  const computeDuration = performance.now() - started;
  assert.equal(large.agents.length, 10_000);
  assert.equal(new Set(large.agents.map((agent) => agent.missionKey)).size, 10_000);
  const nodeIndex = new Map(large.graph.nodes.map((node) => [node.id, node]));
  for (const agent of [large.agents[0], large.agents[4999], large.agents[9999]]) {
    const node = nodeIndex.get(`${large.runId}:${agent.id}`);
    assert.ok(node, "Evaluated agents must be recoverable from the persisted graph");
    assert.equal(node.properties.ordinal, agent.ordinal);
    assert.equal(node.properties.agreement, agent.agreement);
    assert.equal(node.properties.primaryEvidenceId, agent.primaryEvidenceId);
    assert.equal(node.properties.evidenceFingerprint, agent.evidenceFingerprint);
    assert.equal(node.properties.generatedAt, agent.generatedAt);
    assert.deepEqual(JSON.parse(node.properties.positiveDriversJson), agent.positiveDrivers);
    assert.deepEqual(JSON.parse(node.properties.negativeDriversJson), agent.negativeDrivers);
    assert.deepEqual(JSON.parse(node.properties.contradictionsJson), agent.contradictions);
  }
  assert.equal(large.score.overall, small.score.overall, "More shared-evidence agents must not change the evidence score");
  assert.equal(large.score.confidence, small.score.confidence, "Agent count must not manufacture confidence");
  assert.equal(large.forecastSnapshot.slice.dataQuality, small.forecastSnapshot.slice.dataQuality);
  assert.equal(large.forecastVector.expectedDriftPercent, small.forecastVector.expectedDriftPercent);
  assert.equal(large.forecastVector.confidenceLift, small.forecastVector.confidenceLift);
  assert.deepEqual(large.forecastVector, small.forecastVector, "Repeating evaluations cannot improve a forecast-pressure vector");
  assert.equal(large.researchPlan.uniqueSourceCount, 4);
  assert.ok(large.researchPlan.reusedEvidenceAssignments > 9000);
  assert.equal(large.researchPlan.uniqueEvidenceAssignments + large.researchPlan.reusedEvidenceAssignments, large.researchPlan.evidenceBackedAgents);
  assert.equal(large.score.safeguards.equalThirdWeighting, false);
  const repeatedNews = [...alpha.news.items, ...Array.from({ length: 200 }, (_, index) => ({ ...alpha.news.items[0], id: `duplicate-${index}`, url: `${alpha.news.items[0].url}?utm_campaign=${index}` }))];
  const duplicatedRun = runResearchSwarm({ ...input, alpha: { ...alpha, news: { ...alpha.news, items: repeatedNews, articleCount: repeatedNews.length } }, requestedAgents: 30 });
  assert.equal(duplicatedRun.score.overall, small.score.overall);
  assert.equal(duplicatedRun.score.confidence, small.score.confidence, "Duplicate provider rows must not inflate snapshot coverage/confidence");
  assert.equal(duplicatedRun.researchPlan.duplicateEvidenceCount, 200);
  const technicalOnly = runResearchSwarm({ ...input, requestedAgents: 100, researchWeights: { media: 0, technical: 1, economy: 0 } });
  assert.equal(technicalOnly.score.overall, technicalOnly.cohorts.technical.score);
  assert.equal(technicalOnly.allocation.media, 0);
  assert.equal(technicalOnly.allocation.economy, 0);
  const withoutMedia = runResearchSwarm({ ...input, alpha: { ...alpha, news: null }, requestedAgents: 100, researchWeights: { media: 1, technical: 0, economy: 0 } });
  assert.equal(withoutMedia.score.overall, 50);
  assert.equal(withoutMedia.score.confidence, 0);
  assert.equal(withoutMedia.agents.every((agent) => agent.status === "insufficient-evidence"), true);
  assert.equal(withoutMedia.agents.every((agent) => agent.agreement === 0), true);
  assert.equal(withoutMedia.botTopology.consensusScore, 0);
  assert.equal(withoutMedia.forecastVector.expectedDriftPercent, 0);

  const analyticsStart = performance.now();
  const analytics = graphEngine.analyzeResearchGraph(large.graph, large.score);
  const analysisDuration = performance.now() - analyticsStart;
  const fullProjection = graphEngine.projectResearchGraph(large.graph, { mode: "full", analytics });
  assert.equal(graphEngine.graphProjectionLimits("full").nodes, 1600);
  assert.equal(graphEngine.graphProjectionLimits("full").edges, 5600);
  assert.ok(fullProjection.nodes.length <= 1600 && fullProjection.edges.length <= 5600);
  const projectedAgent = fullProjection.nodes.find((node) => node.kind === "agent");
  assert.ok(projectedAgent);
  for (const key of ["positiveDriversJson", "negativeDriversJson", "contradictionsJson"]) {
    assert.equal(Object.hasOwn(projectedAgent.properties, key), false, "Projection excludes archive-only driver fields");
    assert.equal(typeof nodeIndex.get(projectedAgent.id).properties[key], "string", "Projection must not mutate persisted agent details");
    assert.equal(typeof graphEngine.getResearchGraphNodeDetail(large.graph, projectedAgent.id).node.properties[key], "string", "Selected-node detail retains its driver archive");
  }
  const fullProjectionBytes = Buffer.byteLength(JSON.stringify(fullProjection));
  assert.ok(fullProjectionBytes < 3 * 1024 * 1024, `Full fixture graph exceeded its payload regression budget: ${fullProjectionBytes} bytes`);
  for (const kind of ["cohort", "evidence", "agent"]) {
    const selected = large.graph.nodes.find((node) => node.kind === kind);
    const projected = graphEngine.projectResearchGraph(large.graph, { mode: "overview", selectedNodeId: selected.id, analytics });
    const limits = graphEngine.graphProjectionLimits("overview");
    assert.ok(projected.nodes.length <= limits.nodes, `Selecting a ${kind} hub must not bypass node cap`);
    assert.ok(projected.edges.length <= limits.edges);
    assert.ok(projected.nodes.some((node) => node.id === selected.id));
    const ids = new Set(projected.nodes.map((node) => node.id));
    assert.ok(projected.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)));
    assert.equal(projected.projection.originalNodeCount, large.graph.nodes.length);
    assert.equal(projected.projection.clipped, true);
  }
  assert.ok(computeDuration < 15_000, `10k evaluations exceeded the regression budget: ${computeDuration}ms`);
  assert.ok(analysisDuration < 15_000, `10k-node analysis exceeded the regression budget: ${analysisDuration}ms`);
  console.log(`Knowledge graph research checks passed. 10,000 evaluations: ${computeDuration.toFixed(0)}ms; ${large.graph.nodeCount} nodes / ${large.graph.edgeCount} edges analyzed: ${analysisDuration.toFixed(0)}ms; full graph projection: ${fullProjectionBytes} bytes.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
