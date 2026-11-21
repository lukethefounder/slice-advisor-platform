import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";

// Production calculators, route handlers and TSX event handlers; deterministic
// observations and in-memory I/O boundaries. No live providers, DB or browser.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const NOW = new Date("2026-11-19T18:00:00Z");
let checks = 0;
const plain = value => JSON.parse(JSON.stringify(value));
const check = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (actual, expected, message, tolerance = 1e-9) => { assert.ok(actual !== null && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`); checks++; };
const throws = (work, code) => { assert.throws(work, error => error.code === code, code); checks++; };
const rejects = async (work, code) => { await assert.rejects(work, error => error.code === code, code); checks++; };
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const flush = () => new Promise(resolve => setImmediate(resolve));
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW.getTime()])); } static now() { return NOW.getTime(); } }

function modules({ mocks = {}, revision, instrument = source => source, globals = {} } = {}) {
  const cache = new Map(), context = vm.createContext({ console, Date: Clock, Buffer, structuredClone, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, DOMException, process: { env: {} }, ...globals });
  function load(file) {
    let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
    if (!path.extname(absolute)) absolute += fs.existsSync(absolute + ".ts") ? ".ts" : ".tsx";
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const relative = path.relative(root, absolute);
    const source = revision && relative.startsWith("src/lib/strategy-lab/")
      ? execFileSync("git", ["show", `${revision}:${relative}`], { cwd: root, encoding: "utf8" }) : fs.readFileSync(absolute, "utf8");
    const output = ts.transpileModule(instrument(source, relative), { fileName: absolute, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    assert.equal(output.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, relative);
    const require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(name);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
      if (!name.startsWith("node:")) throw Error(`Unexpected external dependency: ${name}`);
      return nativeRequire(name);
    };
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  }
  return { load, context };
}

const { load } = modules();
const { defaultSpec, engineVersionFor, METRICS, VERSION_3_METRICS, manifestOf } = load("src/lib/strategy-lab/contracts.ts");
const { validateSpec, validateRuleSet } = load("src/lib/strategy-lab/validation.ts");
const { Series, evaluateRules, traceRules } = load("src/lib/strategy-lab/indicators.ts");
const { runBacktest } = load("src/lib/strategy-lab/engine.ts");
const { createCustomSpec, customizeSpec, newMetricRule, supportedMetrics, METRIC_GUIDE } = load("src/lib/strategy-lab/custom-strategy.ts");
function dates(count, first = "2026-01-05") {
  const result = [], day = new Date(first + "T00:00:00Z");
  while (result.length < count) { if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) result.push(day.toISOString().slice(0, 10)); day.setUTCDate(day.getUTCDate() + 1); }
  return result;
}
function dataset(symbol = "AAA", values = Array(30).fill(100), options = {}) {
  const calendar = options.dates ?? dates(values.length);
  const bars = values.map((value, i) => {
    const item = typeof value === "number" ? { close: value } : value;
    const open = item.open ?? item.close;
    return { date: calendar[i], open, high: Math.max(open, item.close) + 1, low: Math.max(Math.min(open, item.close) / 2, Math.min(open, item.close) - 1), adjustedClose: item.close, volume: 1000, dividend: 0, split: 1, ...item };
  });
  return { id: `fixture-${symbol}`, provider: "Alpha Vantage", symbol, currency: "USD", retrievedAt: "2026-11-18T22:00:00.000Z", sourceSha256: hash(bars), bars };
}
function specFor(data, patch = {}) {
  return { ...createCustomSpec(defaultSpec()), name: "Fixture custom strategy", universeMode: "fixed-symbols", symbols: [data.symbol], benchmark: data.symbol, startDate: data.bars[6].date, endDate: data.bars.at(-1).date,
    initialCapital: 10000, rankingPeriod: 2, ranking: "alphabetical", rebalance: "once", weighting: "equal", maxHoldings: 1, maxPositionPct: 100, maxExposurePct: 100,
    cooldownSessions: 0, feeBps: 0, slippageBps: 0, commissionUsd: 0, acknowledgeFixedUniverse: true, ...patch };
}
function rule(metric, value = 0, comparator = ">", extra = {}) { return { metric, period: 2, value, comparator, ...extra }; }

// Every exposed metric has explanatory units, valid defaults, and a supported
// data implementation. Legacy definitions cannot silently acquire v3 semantics.
check(METRICS.length, 15); check(Object.keys(METRIC_GUIDE).length, 15);
check(supportedMetrics(1).length, 11); check(supportedMetrics(2).length, 11); check(supportedMetrics(3).length, 15);
check([1, 2, 3].map(version => engineVersionFor({ version })), ["slice-daily-event-ledger-1.0.0", "slice-daily-event-ledger-2.0.0", "slice-daily-event-ledger-3.0.0"]);
const flat = dataset(), base = specFor(flat);
for (const metric of METRICS) {
  ok(METRIC_GUIDE[metric.id].description && METRIC_GUIDE[metric.id].example && METRIC_GUIDE[metric.id].unit);
  check(validateRuleSet({ mode: "all", rules: [newMetricRule(metric.id)] }, "metric", 3).rules[0].metric, metric.id);
  if (VERSION_3_METRICS.has(metric.id)) for (const version of [1, 2]) throws(() => validateSpec({ ...base, version, stopLossPct: undefined, takeProfitPct: undefined, allocationGroups: undefined, entry: { mode: "all", rules: [rule(metric.id)] } }, NOW), "VERSION_REQUIRED");
}
for (const version of [1, 2]) for (const field of ["stopLossPct", "takeProfitPct"]) throws(() => validateSpec({ ...base, version, allocationGroups: undefined, stopLossPct: undefined, takeProfitPct: undefined, [field]: 5 }, NOW), "VERSION_REQUIRED");
for (const field of ["stopLossPct", "takeProfitPct"]) for (const value of [0, -.1, Infinity, "10"]) throws(() => validateSpec({ ...base, [field]: value }, NOW), "INVALID_NUMBER");
for (const metric of ["earningsGrowth", "newsSentiment", "futureReturn", "indexMemberAtDate"]) throws(() => validateSpec({ ...base, entry: { mode: "all", rules: [rule(metric)] } }, NOW), "UNSUPPORTED_HISTORICAL_CRITERION");
throws(() => validateSpec({ ...base, hiddenFutureFilter: true }, NOW), "UNKNOWN_FIELDS");
const prior = { ...defaultSpec(), acknowledgeFixedUniverse: true };
const upgraded = customizeSpec(prior); upgraded.entry.rules[0].value = 45;
check(prior.version, 2); check(prior.entry.rules[0].value, 0, "Explicit upgrade clones rules and preserves original definition");
check([createCustomSpec(prior).entry.rules.length, createCustomSpec(prior).exit.rules.length], [0, 0], "Custom mode starts with the user's own empty rule sets");

// Independent mathematical expectations for the four new metrics.
const sample = new Series(dataset("AAA", [10, 11, 13, 12, 15].map((close, i) => ({ close, volume: [100, 200, 300, 500, 700][i] }))));
near(sample.metric("volumeRatio", 2, 2), 2, "Volume compares to the PRIOR average");
near(sample.metric("volumeRatio", 2, 3), 2, "Current high volume is excluded from its own denominator");
near(sample.metric("priceRangePositionPct", 2, 2), 75, "Close within rolling high-low range");
near(sample.metric("bollingerZ", 2, 2), 1, "Population standard deviation, positive z");
near(sample.metric("bollingerZ", 2, 3), -1, "Population standard deviation, negative z");
near(sample.metric("trendEfficiencyPct", 2, 2), 100, "Monotonic movement is perfectly directional");
near(sample.metric("trendEfficiencyPct", 2, 3), 100 / 3, "Reversal reduces directional efficiency");
const flatPrices = new Series(dataset("AAA", Array.from({ length: 7 }, () => ({ close: 100, high: 100, low: 100, volume: 0 }))));
check(flatPrices.metric("volumeRatio", 2, 6), null, "No invented ratio from a zero-volume baseline");
check([flatPrices.metric("priceRangePositionPct", 2, 6), flatPrices.metric("bollingerZ", 2, 6), flatPrices.metric("trendEfficiencyPct", 2, 6)], [50, 0, 0]);
const splitSeries = new Series(dataset("AAA", [100, 100, { close: 50, split: 2, volume: 2000 }, { close: 50, volume: 2000 }]));
near(splitSeries.metric("volumeRatio", 2, 2), 1, "Split-related share volume is normalized without future information");
near(splitSeries.metric("momentumPct", 2, 2), 0, "Split does not create price momentum");
const tinyMoves = Array.from({ length: 45 }, (_, i) => 1000000 + Math.sin(i) * .001);
const stable = new Series(dataset("BIG", tinyMoves));
for (let i = 7; i < tinyMoves.length; i++) {
  const window = tinyMoves.slice(i - 6, i + 1), origin = window[0], shifted = window.map(value => value - origin), average = shifted.reduce((a, b) => a + b, 0) / 7;
  const variance = shifted.reduce((sum, value) => sum + (value - average) ** 2, 0) / 7;
  near(stable.metric("bollingerZ", 7, i), (window.at(-1) - (origin + average)) / Math.sqrt(variance), "Stable z for a high nominal price and tiny movement", 2e-6);
}
const extended = structuredClone(sample.data); extended.bars.push(...dataset("AAA", [999, { close: 1, split: 20 }], { dates: dates(7).slice(5) }).bars);
const full = new Series(extended);
for (const metric of VERSION_3_METRICS) for (let i = 0; i < sample.data.bars.length; i++) check(full.metric(metric, 2, i), sample.metric(metric, 2, i), "Future bars and splits cannot rewrite earlier metric values");
const nested = { mode: "all", rules: [rule("momentumPct", 0)], groups: [{ mode: "any", rules: [rule("volumeRatio", 1.5), rule("bollingerZ", 0)] }] };
check(evaluateRules(nested, sample, 2, sample, true), true); check(traceRules(nested, sample, 2, sample, true).pass, true);
check(evaluateRules({ mode: "all", rules: [rule("bollingerZ", 0, "crossesBelow")] }, sample, 3, sample, true), true, "Crossovers compare two completed session values");

// Exit thresholds are closing conditions, not intraday order simulations.
const stopData = dataset("AAA", [...Array(6).fill(100), { open: 100, close: 100, low: 50, high: 160 }, 90, { open: 75, close: 80 }, 80]);
const stopped = runBacktest(specFor(stopData, { stopLossPct: 10 }), [stopData], NOW);
check(stopped.trades.map(t => [t.side, t.date, t.signalDate, t.fillPrice]), [["BUY", stopData.bars[6].date, stopData.bars[5].date, 100], ["SELL", stopData.bars[8].date, stopData.bars[7].date, 75]], "Stop at exactly 10% fills at the following observed gap-open, ignoring intraday low");
near(stopped.strategy.totalReturnPct, -25, "Gap loss is not capped at the requested stop");
ok(stopped.trades[1].reason.includes("stop-loss"));
check(stopped.benchmark.tradeCount, 1, "Strategy stop must not alter buy-and-hold benchmark");
const profitData = dataset("AAA", [...Array(6).fill(100), { open: 100, close: 100, high: 160 }, 110, { open: 105, close: 105 }, 105]);
const tookProfit = runBacktest(specFor(profitData, { takeProfitPct: 10 }), [profitData], NOW);
check(tookProfit.trades.map(t => [t.side, t.date, t.fillPrice]), [["BUY", profitData.bars[6].date, 100], ["SELL", profitData.bars[8].date, 105]], "Exact 10% close threshold handles floating-point multiplication and ignores intraday high");
near(tookProfit.strategy.totalReturnPct, 5, "A take-profit trigger does not guarantee its requested percentage at execution");
const splitStopData = dataset("AAA", [...Array(6).fill(100), 100, { close: 50, split: 2 }, 50, 45, { open: 42, close: 42 }]);
const splitStop = runBacktest(specFor(splitStopData, { stopLossPct: 10 }), [splitStopData], NOW);
check(splitStop.trades.map(t => [t.side, t.shares, t.fillPrice]), [["BUY", 100, 100], ["SELL", 200, 42]], "A split updates average entry and shares; only the actual 10% price decline triggers");
check(splitStop.trades[1].date, splitStopData.bars[10].date);
const incomeData = dataset("AAA", [...Array(6).fill(100), 100, { close: 100, dividend: 20 }, 100, 100]);
const income = runBacktest(specFor(incomeData, { takeProfitPct: 10, commissionUsd: 3, feeBps: 20 }), [incomeData], NOW);
check(income.trades.length, 1, "Dividend cash is performance income, not a price-based take-profit trigger");
ok(income.strategy.dividends > 0 && income.strategy.fees > 0, "Fees and income remain in actual portfolio accounting");
const costlyData = dataset("AAA", [...Array(6).fill(100), 100, 110, 110, 110]);
const costly = runBacktest(specFor(costlyData, { takeProfitPct: 10, commissionUsd: 300, feeBps: 200 }), [costlyData], NOW);
ok(costly.trades[1]?.reason.includes("take-profit"), "Commissions do not move a price-based trigger");
ok(costly.strategy.totalReturnPct < 0, "A price take-profit can still lose money after sufficiently high modeled costs");
const slipData = dataset("AAA", [...Array(6).fill(100), 100, 90, { open: 80, close: 80 }, 80]);
const slip = runBacktest(specFor(slipData, { stopLossPct: 10, slippageBps: 100, commissionUsd: 100 }), [slipData], NOW);
near(slip.trades[0].fillPrice, 101, "Purchase slippage is included in average fill");
check(slip.trades[1].date, slipData.bars[8].date);
near(slip.trades[1].fillPrice, 79.2, "Exit includes its own slippage");
const cooldownData = dataset("AAA", [...Array(6).fill(100), 100, 89, 89, 89, 89, 89, 89]);
const cooled = runBacktest(specFor(cooldownData, { stopLossPct: 10, rebalance: "daily", cooldownSessions: 2 }), [cooldownData], NOW);
check(cooled.trades.map(t => [t.side, t.date]), [["BUY", cooldownData.bars[6].date], ["SELL", cooldownData.bars[8].date], ["BUY", cooldownData.bars[11].date]], "Exit cannot repurchase at the same open; cooldown skips two following sessions");
const averageData = dataset("AAA", [...Array(6).fill(100), 100, 50, 70, 75, 75, 95, 96, 96]);
const averaged = runBacktest(specFor(averageData, { maxExposurePct: 50, rebalance: "daily", takeProfitPct: 10 }), [averageData], NOW);
ok(averaged.trades.some(t => t.side === "BUY" && t.date === averageData.bars[7].date), "Rebalancing adds shares after a fall");
const totalBuys = averaged.trades.filter(t => t.side === "BUY" && t.date <= averageData.bars[8].date);
const averageFill = totalBuys.reduce((n, t) => n + t.notional, 0) / totalBuys.reduce((n, t) => n + t.shares, 0);
ok(averageFill < 100 && averageFill > 70, "Weighted additions update entry basis without resetting it to the latest purchase");
ok(!averaged.trades.some(t => t.reason.includes("take-profit") && t.date < averageData.bars[12].date), "Partial sales leave weighted entry basis intact; a 70 close does not profit against that basis");
check(averaged.trades.filter(t => t.reason.includes("take-profit")).map(t => [t.date, t.fillPrice]), [[averageData.bars[12].date, 96]], "Weighted average of additions lowers the exit threshold; later partial sales do not change it");
throws(() => runBacktest(specFor(stopData, { startDate: stopData.bars[1].date }), [stopData], NOW), "WARMUP_REQUIRED");

// Full result snapshots were recorded from baseline 1efc8d5, including economic
// actions, metrics, warnings, manifests and engine identity. Optional explicit
// revision comparison aids maintainers; normal tests require no Git history.
const longDates = dates(95), legacyData = ["AAA", "BBB", "SPY"].map((symbol, j) => dataset(symbol, longDates.map((_, i) => {
  const split = i >= 42 ? 2 : 1, center = (100 + i * (j + 1) * .17 + Math.sin(i / (j + 2)) * 8) / split;
  return { open: center * .997, close: center, high: center * 1.01, low: center * .989, volume: (10000 + i * 10) * split, split: i === 42 ? 2 : 1, dividend: i === 55 ? .3 : 0 };
}), { dates: longDates }));
const legacyBase = { ...defaultSpec(), version: 2, name: "Legacy ledger fixture", template: "custom", universeMode: "fixed-symbols", symbols: ["AAA", "BBB"], benchmark: "SPY", startDate: longDates[25], endDate: longDates.at(-1), acknowledgeFixedUniverse: true, rankingPeriod: 5, maxHoldings: 2, maxPositionPct: 60,
  entry: { mode: "all", rules: [rule("distanceSmaPct", -5, ">", { period: 5 })] }, exit: { mode: "any", rules: [rule("rsi", 80, ">", { period: 3 })] }, rebalance: "daily", feeBps: 7, slippageBps: 12, commissionUsd: 2, trailingStopPct: 8, maxHoldingSessions: 12, portfolioStopPct: 30, cooldownSessions: 2 };
const legacySpecs = [legacyBase, { ...legacyBase, version: 1 }, { ...legacyBase, weighting: "inverse-volatility", ranking: "relative-strength", regime: { mode: "all", rules: [rule("momentumPct", -10)] }, allocationGroups: [{ name: "Selected group", symbols: ["AAA", "BBB"], maxExposurePct: 50 }], entry: nested.rules.length ? { mode: "any", rules: [rule("distanceEmaPct", 0, "crossesAbove", { period: 5 })], groups: [{ mode: "all", rules: [rule("momentumPct", 0, ">", { period: 3, subject: "benchmark" }), rule("averageDollarVolume", 500000)] }] } : nested }];
const golden = ["af8bfa3b4faa74769f7b7b41453493b4d386c9ba974b2d1718033bd648dada2c", "cdc6768946b71d047fcbc86fa94603996095eafecf734e5341c55498a534dff3", "376000bae4128b21211ee89b58780c53b5b62701c3a0b54d8468be4d364cd663"];
const baselineRun = process.env.SLICE_TEST_BASELINE_REVISION ? modules({ revision: process.env.SLICE_TEST_BASELINE_REVISION }).load("src/lib/strategy-lab/engine.ts").runBacktest : null;
for (let i = 0; i < legacySpecs.length; i++) {
  const actual = runBacktest(legacySpecs[i], legacyData, NOW);
  if (baselineRun) { const expected = baselineRun(legacySpecs[i], legacyData, NOW); check(actual, expected, "Entire old-engine result remains byte-for-byte reproducible"); console.log(`Legacy golden ${i}: ${hash(expected)}`); }
  else check(hash(actual), golden[i], "Entire old-engine result remains unchanged from 1efc8d5");
}

// Persisted definitions are owner scoped, immutable, and reject unsupported
// historical inputs before writing. Reopening never upgrades old definitions.
{
  const rows = []; let user = "owner-a"; const queries = [];
  const { load: routeLoad } = modules({ mocks: {
    "@/lib/api-route": { withApiRoute: (_options, handler) => request => handler({ request }), apiJson: body => Response.json(body) },
    "@/lib/strategy-lab/http": { strategyAccess: async () => user, readResearchJson: request => request.json(), strategyFailure: error => { throw error; } },
    "@/lib/prisma": { prisma: { sliceStrategyDefinition: {
      async create({ data }) { const row = { id: `definition-${rows.length + 1}`, updatedAt: NOW.toISOString(), ...data }; rows.push(row); return row; },
      async findMany(query) { queries.push(query); return rows.filter(row => row.userId === query.where.userId); },
    } } },
  } });
  const route = routeLoad("src/app/api/strategy-lab/templates/route.ts");
  const submit = spec => route.POST(new Request("https://slice.test/api/strategy-lab/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec }) }));
  const first = await (await submit({ ...base, entry: nested, stopLossPct: 5, takeProfitPct: 20 })).json();
  const original = rows[0].specJson, savedSpec = JSON.parse(original);
  check(savedSpec.version, 3); check(savedSpec.entry, nested); check([savedSpec.stopLossPct, savedSpec.takeProfitPct], [5, 20]);
  await submit({ ...savedSpec, name: "Edited copy", takeProfitPct: 30 });
  check(rows[0].specJson, original, "Saving an edit leaves the original definition intact"); check(rows[1].id !== first.id, true);
  const get = () => route.GET(new Request("https://slice.test/api/strategy-lab/templates"));
  check((await (await get()).json()).saved.length, 2); check(queries.at(-1).where.userId, "owner-a");
  user = "owner-b"; check((await (await get()).json()).saved.length, 0, "Saved definitions do not leak across accounts");
  await rejects(submit({ ...base, entry: { mode: "all", rules: [rule("newsSentiment")] } }), "UNSUPPORTED_HISTORICAL_CRITERION"); check(rows.length, 2);
}

// One validated custom definition passes unchanged through imports, preflight,
// the saved historical run and future journal replay. Dates change only for the
// observation window; all metrics, exit settings and costs remain frozen.
{
  const workflow = load("src/lib/strategy-ease/guided-workflow.ts");
  const submitted = [], custom = validateSpec({ ...base, entry: nested, stopLossPct: 5, takeProfitPct: 20 }, NOW);
  const request = async (url, body) => { submitted.push({ url, body: structuredClone(body) }); if (url.endsWith("datasets")) return { dataset: manifestOf(flat) }; if (url.endsWith("readiness")) return { readiness: { ok: true, issues: [] } }; return { runId: "historical-custom" }; };
  const signal = new AbortController().signal;
  const prepared = await workflow.prepareGuidedHistory({ spec: custom, request, signal });
  check((await workflow.executeGuidedHistory({ spec: custom, prepared, request, signal })).runId, "historical-custom");
  for (const item of submitted) check(item.body.spec, custom, "The exact definition reaches every historical stage");
  await assert.rejects(workflow.executeGuidedHistory({ spec: { ...custom, stopLossPct: 7 }, prepared, request, signal }), /inputs changed/); checks++;
  const core = load("src/lib/connected-research/scenario-core.ts");
  const forwardDates = dates(16, "2026-11-02"), values = [...Array(8).fill(100), 100, 100, 100, 90, 75, 75, 75, 75];
  const forwardData = dataset("AAA", values, { dates: forwardDates }); forwardData.retrievedAt = "2026-11-12T22:00:00Z";
  const historicalSpec = specFor(flat, { stopLossPct: 10, entry: { mode: "all", rules: [rule("volumeRatio", 1, ">="), rule("priceRangePositionPct", 0, ">="), rule("bollingerZ", 0, ">="), rule("trendEfficiencyPct", 0, ">=")] } }), definitionHash = hash(historicalSpec);
  const historicalRun = runBacktest(historicalSpec, [flat], NOW), historicalHash = hash(historicalRun);
  const slice = count => { const data = structuredClone(forwardData); data.bars = data.bars.slice(0, count); data.sourceSha256 = hash(data.bars); data.retrievedAt = new Date(Date.parse(data.bars.at(-1).date) + 86400000 + 18 * 3600000).toISOString(); return data; };
  const frozen = core.freezeJournal(historicalSpec, [slice(8)], new Date("2026-11-12T19:00:00Z"));
  check(core.replayForward(historicalSpec, frozen, 4, null, new Date("2026-11-12T20:00:00Z")), null, "No results exist for future sessions before observations arrive");
  const journal1 = core.appendObservations(historicalSpec, frozen, [slice(11)], new Date("2026-11-17T19:00:00Z"));
  const paper1 = core.replayForward(historicalSpec, journal1, 4, null, new Date("2026-11-17T19:00:00Z"));
  const journal2 = core.appendObservations(historicalSpec, journal1, [slice(14)], new Date("2026-11-20T19:00:00Z"));
  const paper2 = core.replayForward(historicalSpec, journal2, 4, paper1, new Date("2026-11-20T19:00:00Z"));
  check(paper2.calculation.engineVersion, "slice-daily-event-ledger-3.0.0");
  const trackedRules = plain(paper2.calculation.spec), sourceRules = plain(validateSpec(historicalSpec, NOW));
  delete trackedRules.startDate; delete trackedRules.endDate; delete sourceRules.startDate; delete sourceRules.endDate;
  check(trackedRules, sourceRules, "Forward replay keeps all saved rules and costs");
  check(paper2.calculation.trades.some(t => t.reason.includes("stop-loss")), true, "Forward observations use the same v3 exit engine");
  check(paper2.calculation.equity.slice(0, paper1.calculation.equity.length), paper1.calculation.equity, "New observations never rewrite accepted paper equity");
  check(hash(historicalSpec), definitionHash); check(hash(historicalRun), historicalHash, "Forward calculation cannot rewrite saved historical results");
  check(frozen.datasets[0].bars.length, 8, "Appending observations does not mutate the frozen baseline");
  throws(() => core.replayForward(historicalSpec, journal2, 4, { ...paper1, calculation: { ...paper1.calculation, engineVersion: "slice-daily-event-ledger-2.0.0" } }, new Date("2026-11-20T19:00:00Z")), "ENGINE_CHANGED");
  for (const version of [1, 2]) {
    const legacy = plain({ ...historicalSpec, version, stopLossPct: undefined, takeProfitPct: undefined, allocationGroups: undefined, entry: { mode: "all", rules: [] } });
    const replay = core.replayForward(legacy, journal2, 4, null, new Date("2026-11-20T19:00:00Z"));
    check(replay.calculation.engineVersion, engineVersionFor(legacy), "Existing forward engines keep their saved version");
  }
}

// Actual GuidedTest handlers run with a small hook scheduler. Presentation
// components are opaque so this exercises state and request wiring without a
// browser, visual claims or implementation-mirroring markup snapshots.
function hooks() {
  const slots = []; let cursor = 0, effects = [], dirty = true, disposed = false, lateWrites = 0;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  return {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { if (disposed) { lateWrites++; return; } slots[i].value = typeof next === "function" ? next(slots[i].value) : next; dirty = true; }]; },
    useRef(value) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: value } }; return slots[i].value; },
    useMemo(work, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: work(), deps }; return slots[i].value; },
    useEffect(work, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const cleanup = slots[i]?.cleanup; slots[i] = { deps, cleanup }; effects.push(() => { cleanup?.(); slots[i].cleanup = work(); }); } },
    render(work) { if (disposed) return; let tree, turns = 0; do { dirty = false; cursor = 0; effects = []; tree = work(); for (const effect of effects) effect(); if (++turns > 20) throw Error("Hook fixture did not settle"); } while (dirty); return tree; },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); }, lateWrites: () => lateWrites,
  };
}
{
  const driver = hooks(), calls = [], saved = [], transitions = [], ready = [];
  const props = { onRunReady: id => ready.push(id), onBusyChange: value => transitions.push(value) };
  const presentation = () => null;
  const h = modules({ mocks: {
    react: driver, "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "lucide-react": new Proxy({}, { get: () => presentation }),
    "./ease.module.css": { __esModule: true, default: {} },
    "@/components/strategy-lab/custom-strategy-editor": { __esModule: true, default: presentation },
    "@/components/workspace/premium/session": { useWorkspaceSession: () => ({ user: { id: "owner-a" }, firm: { id: "firm-a" } }) },
    "@/lib/research/beta-client": { browserBetaEnabled: () => true },
    "@/lib/strategy-space/request-once": { strategyRead: async (_scope, url) => url.endsWith("templates") ? { saved } : { datasets: [] } },
    "@/lib/strategy-lab/import-client": { researchPost: async (url, body, _timeout, signal) => {
      signal.throwIfAborted(); calls.push({ url, body: structuredClone(body) });
      if (url.endsWith("templates")) { const value = { id: `saved-${saved.length}`, name: body.spec.name, spec: body.spec, updatedAt: NOW.toISOString() }; saved.push(value); return value; }
      if (url.endsWith("datasets")) return { dataset: { ...manifestOf(flat), symbol: body.symbol, id: `dataset-${body.symbol}` } };
      if (url.endsWith("readiness")) return { readiness: { ok: true, issues: [], sessionCount: 20, effectiveStart: base.startDate, effectiveEnd: base.endDate } };
      return { runId: "guided-custom-result" };
    } },
  }, instrument(source, relative) {
    if (relative === "src/components/strategy-ease/guided-test.tsx") return source.replace("  return <section", "  globalThis.__state = { spec, mode, saved, busy, error }; globalThis.__actions = { setMode, setCustom, setBase, setSymbols, loadDefinition, saveDefinition, begin };\n  return <section");
    return source;
  } });
  const Guided = h.load("src/components/strategy-ease/guided-test.tsx").default;
  const render = () => driver.render(() => Guided(props));
  render(); await flush(); render();
  check(h.context.__state.mode, "custom", "Own strategy is a primary mode, with no template prerequisite");
  const userSpec = { ...base, name: "My metric logic", entry: nested, stopLossPct: 7, takeProfitPct: 24 };
  h.context.__actions.loadDefinition({ id: "fixture", name: userSpec.name, spec: userSpec }); render();
  check(h.context.__state.spec, userSpec, "Loading custom definition retains every selected setting");
  h.context.__actions.setMode("ideas"); render(); h.context.__actions.setMode("custom"); render();
  check(h.context.__state.spec, userSpec, "Browsing ideas does not overwrite the custom draft");
  await h.context.__actions.saveDefinition(); render();
  check(calls.at(-1).body.spec, validateSpec(userSpec, NOW), "Save persists the actual editable custom definition");
  await h.context.__actions.begin(true); render();
  check(calls.find(item => item.url.endsWith("runs")).body.spec, validateSpec(userSpec, NOW), "Guided test submits the user's exact rules and exits");
  check(ready, ["guided-custom-result"]); check(h.context.__state.busy, false);
  const legacy = validateSpec({ ...legacyBase, universeMode: "sector-etfs", symbols: ["XLK", "XLF"] }, NOW);
  h.context.__actions.loadDefinition({ id: "legacy", name: "Legacy copy", spec: legacy }); render();
  check(h.context.__state.spec, legacy, "Reopening a sector-mode v2 definition does not silently change its version or universe");
  check(transitions, [true, false, true, false], "Parent navigation stays locked only during save or calculation");
  driver.unmount(); check(driver.lateWrites(), 0);
}

console.log(`Custom strategy: ${checks} deterministic checks passed.`);
