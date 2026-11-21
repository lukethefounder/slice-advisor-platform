import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";

// Real parsers, technical calculations, regime analysis and Strategy Studio engine.
// All external storage, account data and provider responses are controlled fixtures.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const NOW = new Date("2026-11-20T15:00:00.000Z"), scope = { userId: "founder-fixture", firmId: "workspace-fixture" };
const hash = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const plain = value => JSON.parse(JSON.stringify(value));
let assertions = 0, forbiddenNetwork = 0;
const same = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); assertions++; };
const yes = (actual, message) => { assert.ok(actual, message); assertions++; };
const throws = (callback, code) => { assert.throws(callback, error => error.code === code); assertions++; };
const rejects = async (callback, code) => { await assert.rejects(callback, error => error.code === code); assertions++; };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW.getTime()])); } static now() { return NOW.getTime(); } }

const mocks = {}, cache = new Map();
const context = vm.createContext({ Date: Clock, Buffer, structuredClone, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, DOMException,
  process: { env: {} }, fetch: () => { forbiddenNetwork++; throw Error("Live network is forbidden in research tool tests"); } });
function load(file) {
  let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
  if (!path.extname(absolute)) absolute += ".ts";
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const output = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { fileName: absolute, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  assert.equal(output.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, absolute);
  const require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load(name);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
    if (name.startsWith("node:")) return nativeRequire(name);
    throw Error(`Unmocked dependency: ${name}`);
  };
  vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: absolute })(require, module, module.exports);
  return module.exports;
}
const core = load("src/lib/market-evidence/core.ts"), contracts = load("src/lib/strategy-lab/contracts.ts");
const historical = load("src/lib/agent-desk/historical-scenarios.ts");

function dataset(symbol = "TEST", scale = 1) {
  const bars = [], current = new Date("2020-01-02T12:00:00Z");
  let prior = 100 * scale, index = 0;
  while (current.toISOString().slice(0, 10) <= "2026-11-19") {
    if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6) {
      const close = scale * 100 * Math.exp(index * 0.00025 + Math.sin(index / 30) * 0.12 + Math.sin(index / 7) * 0.02);
      const open = prior * (1 + Math.sin(index / 13) * 0.002);
      bars.push({ date: current.toISOString().slice(0, 10), open, high: Math.max(open, close) * 1.01, low: Math.min(open, close) * 0.99, close, adjustedClose: close, volume: Math.round(1_000_000 * (2 + Math.cos(index / 11))), dividend: 0, split: 1 });
      prior = close; index++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return { id: `dataset-${symbol}`, provider: "Alpha Vantage", symbol, currency: "USD", retrievedAt: NOW.toISOString(), sourceSha256: hash(bars), bars };
}
const primary = dataset(), reference = dataset("SPY", 2), datasets = [primary, reference];
const prefix = primary.bars.map(row => row.adjustedClose);
same(historical.historicalFeatures(prefix.slice(0, 101), 100), historical.historicalFeatures([...prefix.slice(0, 101), 1e12, 1e-8], 100), "Historical features never read future observations");
same(historical.historicalFeatures(prefix, 48), null, "An incomplete lookback is unavailable");
const analogue = historical.buildHistoricalAnalogues(primary);
same(analogue.scenarios.map(row => row.horizonSessions), [1, 5, 20, 63, 126]);
same(analogue.manifest.sourceSha256, primary.sourceSha256);
same(analogue.manifest.vintage, "vendor-current-history", "Current vendor data is never claimed to be an archival vintage");
yes(analogue.scenarios.every(row => row.calibratedForecastProbability === null));
yes(analogue.scenarios.every(row => row.development.observations.every(item => item.outcomeDate < analogue.validationStartDate)), "All development labels finish before holdout begins");
yes(analogue.scenarios.every(row => row.validation.observations.every(item => item.signalDate >= analogue.validationStartDate)), "Validation is chronologically separate");
yes(analogue.scenarios.every(row => [row.development, row.validation].every(part => part.observations.every((item, index, all) => !index || all[index - 1].outcomeDate <= item.signalDate))), "Outcome windows do not overlap within a horizon");
yes(analogue.scenarios.some(row => row.validation.reliability === "sparse"), "Small samples are visible");
const changedHoldout = structuredClone(primary);
changedHoldout.bars.filter(row => row.date >= analogue.validationStartDate).forEach((row, index) => { row.adjustedClose *= 1 + index * 0.002; });
same(historical.buildHistoricalAnalogues(changedHoldout).developmentVolatilityThresholdPct, analogue.developmentVolatilityThresholdPct, "Validation values never set the volatility threshold");
const allPositive = historical.summarizeHistoricalSamples(Array.from({ length: 10 }, (_, i) => ({ signalDate: `2025-01-${String(i + 1).padStart(2, "0")}`, outcomeDate: `2025-02-${String(i + 1).padStart(2, "0")}`, forwardReturnPct: 1 })));
same(allPositive.positiveReturnFrequencyPct, 100);
yes(allPositive.wilson95Pct[0] < 100, "Even all-success observations retain sampling uncertainty");
same(historical.summarizeHistoricalSamples([]).positiveReturnFrequencyPct, null, "Absent samples never become a numeric probability");
same(historical.buildHistoricalAnalogues({ ...primary, bars: primary.bars.slice(0, 80) }).status, "insufficient");
const invalid = structuredClone(primary); invalid.bars[60].date = invalid.bars[59].date;
throws(() => historical.buildHistoricalAnalogues(invalid), "SCENARIO_DATA");

const io = { watchReads: [], definitionReads: [], imported: [], loaded: [], quoteCalls: [], marketScopes: [], saved: [], providerCalls: [], macroCalls: [], queriedRuns: [] };
let watched = [{ ticker: "WATCH", name: "Watched fixture company" }], named = [], definitions = [];
const storedRuns = new Map();
const assertOwner = query => { same(query.where.userId, scope.userId, "All private data reads are owner scoped"); };
mocks["@/lib/prisma"] = { prisma: {
  watchAsset: { findMany: async query => { assertOwner(query); io.watchReads.push(query); return watched; } },
  namedWatchlistItem: { findMany: async query => { assertOwner(query); same(query.where.watchlist.userId, scope.userId); return named; } },
  sliceStrategyDefinition: { findMany: async query => { assertOwner(query); io.definitionReads.push(query); return definitions; } },
  sliceStrategyRun: {
    findFirst: async query => { assertOwner(query); io.queriedRuns.push(query); return storedRuns.get(`${query.where.userId}:${query.where.inputSha256}`) ?? null; },
    create: async query => { same(query.data.userId, scope.userId, "Saved backtests are private to the owner"); const row = { id: `run-${io.saved.length + 1}`, ...query.data }; io.saved.push(row); storedRuns.set(`${row.userId}:${row.inputSha256}`, row); return { id: row.id }; },
  },
} };
let entitlement = "historical";
mocks["@/lib/market-evidence/configuration"] = { marketConfiguration: () => ({ key: "fixture-private-key", fingerprint: "fixture-fingerprint", entitlement }) };
mocks["@/lib/market-evidence/storage"] = { marketStorage: actor => { io.marketScopes.push(plain(actor)); return { cacheNamespace: `fixture:${actor.firmId}:${actor.userId}` }; } };
const moversPayload = {
  last_updated: "2026-11-19 16:15:59 US/Eastern",
  top_gainers: [{ ticker: "GAIN", price: "20", change_percentage: "8.5%", volume: "500000" }, { ticker: "https://bad", price: "10", change_percentage: "2%", volume: "4" }],
  top_losers: [{ ticker: "LOSS", price: "25", change_percentage: "-5.5%", volume: "1000000" }, { ticker: "BAD", price: "-2", change_percentage: "1%", volume: "500" }],
  most_actively_traded: [{ ticker: "GAIN", price: "20", change_percentage: "8.5%", volume: "500000" }, { ticker: "ACTIVE", price: "200", change_percentage: "1%", volume: "8000000" }],
};
const scanReceipt = { endpoint: "TOP_GAINERS_LOSERS", symbols: [], retrievedAt: "2026-11-20T14:59:00.000Z", cacheHit: true, sha256: hash(moversPayload) };
mocks["@/lib/market-evidence/transport"] = {
  safeMarketError: error => error instanceof core.MarketError ? error : new core.MarketError("PROVIDER_NETWORK", "Provider unavailable; no substitutes generated."),
  createMarketReader: (config, storage, signal, receipts, force) => async (endpoint, params, ttl, parser) => {
    io.providerCalls.push({ entitlement: config.entitlement, storage, endpoint, params, ttl, force });
    signal.throwIfAborted(); const rows = parser(moversPayload); receipts.push(structuredClone(scanReceipt)); return rows;
  },
};
function sectionResponse(symbol, section) {
  const endpoint = section === "quote" ? "GLOBAL_QUOTE" : section === "history" ? "TIME_SERIES_DAILY" : "OVERVIEW";
  const receipt = { endpoint, symbols: [symbol], retrievedAt: "2026-11-20T14:58:00.000Z", cacheHit: true, sha256: hash(`${symbol}-${endpoint}`) };
  const data = section === "quote" ? [{ symbol, price: 123, previousClose: 120, change: 3, changePct: 2.5, volume: 2000000, observedAt: "2026-11-19", precision: "date", endpoint, priceKind: "regular-session quote", state: "end-of-day", note: "Dated controlled quote" }]
    : section === "history" ? { symbol, range: "1Y", endpoint, bars: primary.bars.slice(-260).map(bar => ({ at: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume })), providerTimeZone: "US/Eastern", observedAt: "2026-11-19", precision: "date", state: "end-of-day", note: "Completed raw daily observations", basis: "raw as-traded; no dividend adjustment" }
      : { symbol, name: "Controlled fixture issuer", sector: "Technology", industry: "Software", currency: "USD", exchange: "NASDAQ", description: "Controlled fixture", latestQuarter: "2026-09-30", metrics: [{ label: "Beta", value: 1.1, kind: "ratio" }, { label: "Market capitalization", value: 1e9, kind: "money" }] };
  return { ok: true, symbol, section, range: "1Y", preparedAt: NOW.toISOString(), elapsedMs: 1, receipts: [receipt], data };
}
mocks["@/lib/market-visuals/service"] = { loadMarketSection: async (request, storage, signal) => {
  signal.throwIfAborted(); same(storage.cacheNamespace, `fixture:${scope.firmId}:${scope.userId}`, "Market cache namespace includes owner and workspace");
  io.quoteCalls.push(request); return sectionResponse(request.symbol, request.section);
} };
mocks["@/lib/strategy-lab/provider"] = {
  importHistory: async (owner, symbol, force) => { same(owner, scope.userId); io.imported.push({ owner, symbol, force }); const data = datasets.find(row => row.symbol === symbol); if (!data) throw new contracts.StrategyError("DATASET_MISSING", "Controlled fixture is unavailable"); return { ...contracts.manifestOf(data), cached: true }; },
  loadDatasets: async (owner, ids) => { same(owner, scope.userId); io.loaded.push({ owner, ids }); return datasets.filter(row => ids.includes(row.id)); },
};
const macro = { schemaVersion: "slice-economic-research-1.0.0", retrievedAt: NOW.toISOString(), sector: "Technology", industry: "Software", score: 55, confidence: 72, regime: "Balanced", warnings: [],
  series: [{ id: "cpi-fixture", functionName: "CPI", label: "Consumer price index", description: "Controlled economic release", interval: "monthly", unit: "index", source: "Alpha Vantage economic indicator", sourceUrl: "https://www.alphavantage.co/documentation/", asOf: "2026-10-01", retrievedAt: "2026-11-19T12:00:00Z", latestValue: 325, previousValue: 324, change: 1, changePercent: 100 / 324, direction: "deteriorating", score: 45, confidence: 72, industrySensitivity: 0.8, data: [], warning: null }] };
mocks["@/lib/intelligence/economic-live"] = { getEconomicResearch: async input => { io.macroCalls.push(input); return structuredClone(macro); } };
const research = load("src/lib/agent-desk/research-tools.ts");
const signal = new AbortController().signal;

const parsed = research.parseScoutMovers(moversPayload, "historical", NOW.getTime());
same(parsed.length, 3, "Invalid rows are excluded and duplicate buckets are deduplicated");
same(parsed.find(row => row.symbol === "GAIN").origins, ["top-gainers", "most-active"]);
same(parsed[0].observedAt, "2026-11-19T21:15:59.000Z", "Vendor Eastern observation time is converted, not replaced with retrieval time");
same(parsed[0].state, "end-of-day", "Historical entitlement is never labeled realtime");
for (const last_updated of ["2026-01-01 16:15:59 US/Eastern", "2026-11-21 16:15:59 US/Eastern", "2026-11-19T16:15:59", "2026-11-19 16:15:59 UTC"])
  throws(() => research.parseScoutMovers({ ...moversPayload, last_updated }, "realtime", NOW.getTime()), "SCOUT_TIME");
throws(() => research.parseScoutMovers({ ...moversPayload, top_gainers: [], top_losers: [], most_actively_traded: [] }, "historical", NOW.getTime()), "SCOUT_EMPTY");
const discovery = await research.discoverScoutCandidates(scope, { signal, exclude: ["LOSS"] });
same(discovery.candidates.map(row => row.symbol).sort(), ["ACTIVE", "GAIN", "WATCH"]);
same(discovery.tradingAllowlistChanged, false);
yes(discovery.candidates.every(row => row.tradableByPolicy === false), "Discovery cannot grant trading permission");
same(io.providerCalls.at(-1).params, {}, "Historical entitlement does not request premium realtime data");
same(io.providerCalls.at(-1).ttl, 60000, "Discovery shares the bounded cache refresh policy");
const discoveryEvidence = research.scoutDiscoveryEvidence(discovery);
same(discoveryEvidence.map(row => row.id), research.scoutDiscoveryEvidence(discovery).map(row => row.id), "Evidence identifiers are repeatable for identical observations");
yes(discoveryEvidence.every(row => row.id.startsWith("desk-scout-") && row.metrics.sourceSha256 && row.metrics.discoveryAuthorizesTrading === false));
yes(!JSON.stringify(discovery).includes("fixture-private-key"), "No provider credential leaves the transport");
entitlement = "delayed";
const restricted = await research.discoverScoutCandidates(scope, { signal, universe: ["GAIN"] });
same(restricted.candidates.map(row => row.symbol), ["GAIN"], "Configured research universe is respected");
same(io.providerCalls.at(-1).params, { entitlement: "delayed" }, "Provider entitlement is forwarded unchanged");
await rejects(() => research.discoverScoutCandidates(scope, { signal, universe: ["INDEX:SPX"] }), "SCOUT_UNIVERSE");
const beforeQuotes = io.quoteCalls.length;
watched = Array.from({ length: 30 }, (_, index) => ({ ticker: `FIX${index}`, name: `Controlled ${index}` }));
const rotating = await research.discoverScoutCandidates(scope, { signal });
same(io.quoteCalls.length - beforeQuotes, 8, "A refresh never fans out through the complete watched universe");
yes(rotating.issues.some(row => row.code === "SCOUT_ROTATION"));
const none = await research.discoverScoutCandidates(scope, { signal }, { readMovers: async () => { throw Error("secret-provider-detail"); }, readWatchlists: async () => [] });
same(none.candidates, [], "Unavailable discovery never substitutes hardcoded ticker ideas");
yes(!JSON.stringify(none).includes("secret-provider-detail"));
const stopped = new AbortController(); stopped.abort();
await assert.rejects(() => research.discoverScoutCandidates(scope, { signal: stopped.signal }), error => error.name === "AbortError"); assertions++;

const custom = { ...contracts.templateSpec("custom"), name: "My unchanged exits", universeMode: "fixed-symbols", symbols: ["TEST"], benchmark: "SPY", acknowledgeFixedUniverse: true, startDate: "2024-01-02", endDate: "2026-11-19", maxHoldings: 1, maxPositionPct: 100,
  entry: { mode: "all", rules: [{ metric: "momentumPct", period: 5, comparator: ">", value: 0 }] }, exit: { mode: "any", rules: [{ metric: "momentumPct", period: 5, comparator: "<", value: 0 }] }, stopLossPct: 5, takeProfitPct: 10 };
definitions = [
  { id: "custom-owner", name: custom.name, specJson: JSON.stringify(custom) },
  { id: "basket-owner", name: "Two-symbol strategy", specJson: JSON.stringify({ ...custom, symbols: ["TEST", "OTHER"] }) },
  { id: "invalid-owner", name: "Broken saved definition", specJson: "not-json" },
];
const definitionBefore = JSON.stringify(definitions);
const scenarios = await research.loadHistoricalScenarios(scope, { symbol: "TEST", signal });
same(scenarios.strategies.length, 4, "Three fixed scenarios plus the applicable owner strategy run");
yes(scenarios.strategies.every(row => row.status === "complete"), JSON.stringify(scenarios.strategies.map(row => row.error)));
same(scenarios.strategies.find(row => row.definitionId === "custom-owner").spec.stopLossPct, 5);
same(scenarios.strategies.find(row => row.definitionId === "custom-owner").spec.takeProfitPct, 10);
same(JSON.stringify(definitions), definitionBefore, "User strategy definitions are never rewritten");
yes(scenarios.skippedDefinitions.some(row => row.id === "basket-owner"), "Unloaded baskets are disclosed instead of silently rewritten to one stock");
yes(scenarios.strategies.every(row => row.development && row.validation && row.validationStartDate), "Both chronological partitions use the production engine");
yes(scenarios.strategies.every(row => row.strategy.fees >= 0 && row.strategy.slippage >= 0 && row.engineVersion && row.inputSha256 && row.outputSha256));
yes(io.saved.every(row => { const run = JSON.parse(row.resultJson); return row.outputSha256 === hash(row.resultJson) && run.trades.every(trade => trade.signalDate < trade.date); }), "Saved result hashes and next-session signal/fill ordering are preserved");
const savedCount = io.saved.length;
await research.loadHistoricalScenarios(scope, { symbol: "TEST", signal });
same(io.saved.length, savedCount, "Identical historical runs reuse immutable owner-scoped records");
const noIndexSubstitute = await research.loadHistoricalScenarios(scope, { symbol: "INDEX:SPX", signal });
same(noIndexSubstitute.status, "unavailable");
same(noIndexSubstitute.issues[0].code, "INDEX_NOT_INVESTABLE");
const historyFailure = await research.loadHistoricalScenarios(scope, { symbol: "TEST", signal }, { importHistory: async () => { throw new contracts.StrategyError("ENTITLEMENT", "Daily adjusted history is unavailable for this provider subscription."); } });
same(historyFailure.status, "unavailable"); same(historyFailure.analogues, null); same(historyFailure.strategies, []);
const shortHistory = await research.loadHistoricalScenarios(scope, { symbol: "TEST", signal }, { loadDatasets: async () => datasets.map(row => ({ ...row, bars: row.bars.slice(-80) })) });
same(shortHistory.analogues.status, "insufficient");
yes(shortHistory.strategies.every(row => row.status === "unavailable"));
same(shortHistory.status, "unavailable", "Imported bars with no analogue samples or completed simulations cannot masquerade as usable scenario support");
yes(shortHistory.issues.some(row => row.code === "HISTORICAL_SCENARIOS_UNAVAILABLE"));

const tools = await research.loadDeskResearchTools(scope, { symbol: "TEST", signal });
same(tools.charts.barCount, 260);
const mean200 = primary.bars.slice(-200).reduce((sum, row) => sum + row.close, 0) / 200;
yes(Math.abs(tools.charts.snapshot.metrics["sma-200"].value - mean200) < 1e-9, "Charts invokes the same calculated Custom Board metric values");
same(tools.economy.snapshot.series[0].asOf, "2026-10-01", "Release observation date is not replaced by a more recent fetch date");
same(io.macroCalls.at(-1).sector, "Technology", "Sentiment calls economic research with actual company sector context");
same(io.macroCalls.at(-1).industry, "Software");
same(tools.economy.riskAppetite.symbol, "SPY");
yes(tools.economy.interpretationLimits.some(message => message.includes("not a profit probability")));
yes(tools.evidence.some(row => row.cohort === "economy") && tools.evidence.some(row => row.cohort === "technical") && tools.evidence.some(row => row.cohort === "strategy"));
yes(tools.evidence.every(row => row.kind === "tool-research" && row.id.startsWith("desk-tool-") && row.retrievedAt && row.source));
yes(!JSON.stringify(tools).includes("fixture-private-key"));
const missingTechnical = await research.loadDeskResearchTools(scope, { symbol: "TEST", signal }, { loadMarketSection: async () => { throw new core.MarketError("ENTITLEMENT", "Unavailable controlled section"); }, getEconomicResearch: async () => ({ ...macro, confidence: 0, series: [], warnings: ["No measured economic evidence available."] }) });
same(missingTechnical.charts.status, "unavailable"); same(missingTechnical.charts.snapshot.price, null); same(missingTechnical.economy.status, "unavailable");
const noTechnicalLookback = await research.loadDeskResearchTools(scope, { symbol: "TEST", signal }, { loadMarketSection: async request => {
  if (request.section === "history") throw new core.MarketError("ENTITLEMENT", "History unavailable for controlled subscription");
  return sectionResponse(request.symbol, request.section);
} });
same(noTechnicalLookback.charts.snapshot.price, 123, "Available quote measurements remain visible");
same(noTechnicalLookback.charts.snapshot.metrics.beta.value, 1.1);
same(noTechnicalLookback.charts.status, "unavailable", "Fundamentals and a quote alone cannot satisfy the required technical tool");
yes(noTechnicalLookback.issues.some(row => row.code === "TECHNICAL_HISTORY_UNAVAILABLE"));
same(forbiddenNetwork, 0, "No network, production database, credentials or browser were accessed");
console.log(`Agent desk research tools: ${assertions} assertions passed (controlled I/O; production calculators and engine).`);
