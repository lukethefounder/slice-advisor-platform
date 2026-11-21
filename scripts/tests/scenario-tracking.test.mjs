import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

// Execute the production scheduler and replay code with deterministic clocks and
// an in-memory Prisma boundary. No database, provider, browser, or network access.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const HOUR = 3_600_000, MINUTE = 60_000;
let now = Date.parse("2026-11-19T17:20:00Z"), checks = 0;
class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now); } static now() { return now; } }
const clone = value => structuredClone(value);
const check = (actual, expected, message) => { assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const rejects = async (work, code) => { await assert.rejects(work, error => error.code === code, code); checks++; };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

function modules(mocks) {
  const cache = new Map();
  const context = vm.createContext({ console, Date: Clock, Buffer, structuredClone, process: { env: {} } });
  function load(file) {
    let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
    if (!path.extname(absolute)) absolute += ".ts";
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(name);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
      if (!name.startsWith("node:")) throw new Error(`Unexpected external dependency: ${name}`);
      return nativeRequire(name);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  }
  return load;
}

const scalar = value => value instanceof Date ? value.getTime() : value;
function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return expected.some(part => matches(row, part));
    const value = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === "in") return operand.includes(value);
        if (value === null || value === undefined) return false;
        if (operator === "lte") return scalar(value) <= scalar(operand);
        if (operator === "lt") return scalar(value) < scalar(operand);
        if (operator === "gte") return scalar(value) >= scalar(operand);
        throw new Error(`Unsupported fixture predicate: ${operator}`);
      });
    }
    return scalar(value) === scalar(expected);
  });
}
function readRows(rows, query = {}) {
  let values = rows.filter(row => matches(row, query.where));
  const ordering = query.orderBy ? (Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy]) : [];
  values = values.sort((a, b) => {
    for (const item of ordering) for (const [field, direction] of Object.entries(item)) {
      const left = scalar(a[field]), right = scalar(b[field]);
      if (left !== right) return (left < right ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  });
  if (query.distinct) { const seen = new Set(); values = values.filter(row => { const key = JSON.stringify(query.distinct.map(field => row[field])); if (seen.has(key)) return false; seen.add(key); return true; }); }
  if (query.take !== undefined) values = values.slice(0, query.take);
  return clone(values.map(row => query.select ? Object.fromEntries(Object.keys(query.select).filter(key => query.select[key]).map(key => [key, row[key]])) : row));
}

function harness({ actualAdvance = false } = {}) {
  const h = { rows: [], datasets: [], observations: [], imports: [], advances: [], accesses: [], queries: [], updates: [], inserts: 0, transactions: 0 };
  const prisma = {
    sliceForwardScenario: {
      async findMany(query) { h.queries.push({ model: "scenario", query: clone(query) }); return readRows(h.rows, query); },
      async findFirst(query) { h.queries.push({ model: "scenario", query: clone(query) }); return readRows(h.rows, { ...query, take: 1 })[0] ?? null; },
      async updateMany(input) {
        await h.beforeUpdate?.(input);
        const rows = h.rows.filter(row => matches(row, input.where));
        for (const row of rows) for (const [key, value] of Object.entries(input.data)) row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : clone(value);
        h.updates.push({ ...clone(input), count: rows.length });
        return { count: rows.length };
      },
    },
    sliceResearchDataset: { async findMany(query) { h.queries.push({ model: "dataset", query: clone(query) }); await h.beforeDatasets?.(); return readRows(h.datasets, query); } },
    sliceScenarioObservation: {
      async findMany(query) { return readRows(h.observations, query); },
      async findFirst(query) { return readRows(h.observations, { ...query, take: 1 })[0] ?? null; },
      async createMany({ data }) { h.inserts++; await h.beforeInsert?.(); h.observations.push(...clone(data)); return { count: data.length }; },
    },
    async $transaction(work) {
      h.transactions++; await h.beforeTransaction?.();
      const savedRows = clone(h.rows), savedObservations = clone(h.observations);
      try { return await work(prisma); } catch (error) { h.rows = savedRows; h.observations = savedObservations; throw error; }
    },
  };
  const mocks = {
    "@/lib/prisma": { prisma },
    "@/lib/access-control": { async getAccessContextForUser(scope) { h.accesses.push(clone(scope)); return h.access ? h.access(scope) : { firm: { id: scope.firmId }, membership: { status: "Active" }, isFounder: false }; } },
    "@/lib/strategy-lab/provider": {
      async importHistory(userId, symbol, force) {
        h.imports.push({ userId, symbol, force }); await h.importing?.(userId, symbol);
        h.datasets.push({ id: `${userId}-${symbol}-${h.imports.length}`, userId, symbol, provider: "Alpha Vantage", endpoint: "TIME_SERIES_DAILY_ADJUSTED", retrievedAt: new Date(now) });
      },
      hydrate: row => clone(row.dataset),
    },
  };
  h.load = modules(mocks);
  const { defaultSpec, StrategyError } = h.load("src/lib/strategy-lab/contracts.ts"); h.StrategyError = StrategyError;
  h.spec = symbols => ({ ...defaultSpec(), universeMode: "fixed-symbols", symbols, benchmark: "SPY", acknowledgeFixedUniverse: true, startDate: "2026-01-02", endDate: "2026-11-13", maxHoldings: 1, ranking: "alphabetical", rankingPeriod: 2, entry: { mode: "all", rules: [] }, exit: { mode: "any", rules: [] }, rebalance: "once", maxPositionPct: 100 });
  h.row = (id, options = {}) => ({ id, userId: "owner-a", firmId: "firm-a", status: "Watching", specJson: JSON.stringify(h.spec(["AAPL"])), nextCheckAt: new Date(now - HOUR), refreshStartedAt: null, version: 0, createdAt: new Date(now - 2 * HOUR), ...options });
  if (!actualAdvance) mocks["./scenario-service"] = { async advanceScenario(scope, id, lease) {
    h.advances.push({ scope: clone(scope), id, lease: clone(lease) });
    const changed = await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id, nextCheckAt: lease.expiresAt, refreshStartedAt: lease.cycleStart, status: "Watching" }, data: { nextCheckAt: new Date(now + HOUR), refreshStartedAt: null } });
    if (changed.count !== 1) throw new StrategyError("SCENARIO_LEASE_LOST", "Fixture replacement worker", 409);
    return { appendedSessions: 0 };
  } };
  h.scheduler = h.load("src/lib/connected-research/scenario-scheduler.ts");
  if (actualAdvance) h.service = h.load("src/lib/connected-research/scenario-service.ts");
  h.seedFresh = (userId = "owner-a", symbols = ["AAPL", "SPY"]) => { for (const symbol of symbols) h.datasets.push({ id: `${userId}-${symbol}`, userId, symbol, provider: "Alpha Vantage", endpoint: "TIME_SERIES_DAILY_ADJUSTED", retrievedAt: new Date(now) }); };
  return h;
}

// Oldest-due selection and deterministic tie breaks: future, complete, and
// archived scenarios cannot consume a worker slot.
{
  const h = harness(); h.seedFresh();
  h.rows = [h.row("newer", { nextCheckAt: new Date(now - MINUTE) }), h.row("tie-b"), h.row("future", { nextCheckAt: new Date(now + MINUTE) }), h.row("complete", { status: "Complete" }), h.row("tie-a"), h.row("oldest", { nextCheckAt: new Date(now - 2 * HOUR) }), h.row("z-created-first", { createdAt: new Date(now - 3 * HOUR) })];
  const result = await h.scheduler.runScenarioSchedule({ limit: 3, concurrency: 1 });
  check(result.results.map(row => row.id), ["oldest", "z-created-first", "tie-a"], "Oldest due rows win, then creation time, then ID");
  check([result.scanned, result.processed, result.tracked], [3, 3, 3]);
  check(h.imports.length, 0, "This hour's verified manifests avoid redownloading history");
  const next = await h.scheduler.runScenarioSchedule({ limit: 2, concurrency: 1 });
  check(next.results.map(row => row.id), ["tie-b", "newer"], "Updated rows yield fairly to the remaining due work");
  h.rows = Array.from({ length: 15 }, (_, i) => h.row(`bounded-${String(i).padStart(2, "0")}`));
  check((await h.scheduler.runScenarioSchedule({ limit: 100, concurrency: 1 })).processed, 12, "A large requested batch stays bounded");
}

// Concurrent workers are bounded and independent, while each scenario imports
// only two instruments per pass.
{
  const h = harness(), gates = new Map(); let active = 0, peak = 0;
  h.rows = ["AAPL", "MSFT", "NVDA"].map(symbol => h.row(symbol, { specJson: JSON.stringify({ ...h.spec([symbol]), benchmark: symbol }) }));
  h.importing = async (_user, symbol) => { active++; peak = Math.max(peak, active); const gate = deferred(); gates.set(symbol, gate); await gate.promise; active--; };
  const running = h.scheduler.runScenarioSchedule({ limit: 3, concurrency: 100 }); await flush();
  check([...gates.keys()], ["AAPL", "MSFT"], "At most two provider operations begin concurrently");
  gates.get("AAPL").resolve(); await flush(); check([...gates.keys()], ["AAPL", "MSFT", "NVDA"]);
  gates.get("MSFT").resolve(); gates.get("NVDA").resolve(); await running; check(peak, 2);
}

// Access and manifests remain scoped to their actual owners, including when two
// firms or users have the same symbols.
{
  const h = harness(); h.seedFresh("other-user");
  h.rows = [h.row("inactive", { userId: "owner-inactive" }), h.row("wrong-firm"), h.row("active", { userId: "owner-b", firmId: "firm-b" })];
  h.access = scope => scope.userId === "owner-b" ? { firm: { id: scope.firmId }, membership: { status: "Active" } } : scope.userId === "owner-inactive" ? { firm: { id: scope.firmId }, membership: { status: "Suspended" } } : { firm: { id: "foreign-firm" }, membership: { status: "Active" }, isFounder: true };
  const result = await h.scheduler.runScenarioSchedule({ limit: 3, concurrency: 1 });
  // Alphabetical due ties process active first, then inactive and wrong-firm.
  check(result.results.filter(row => row.state === "access-blocked").length, 2);
  check(h.imports.map(row => [row.userId, row.symbol]), [["owner-b", "AAPL"], ["owner-b", "SPY"]], "Another user's fresh history is never reused");
  check(h.advances.map(row => row.scope), [{ userId: "owner-b", firmId: "firm-b" }]);
  ok(h.rows.filter(row => row.id !== "active").every(row => row.nextCheckAt.getTime() === now + 24 * HOUR));
  ok(h.accesses.every(scope => scope.userId && scope.firmId), "Both ownership dimensions reach access control");
}

// A universe spanning multiple batches keeps its original cycle even when the
// clock crosses an hour. Completed imports are durable and are not repeated.
{
  now = Date.parse("2026-11-19T17:58:00Z"); const h = harness();
  h.rows = [h.row("large", { specJson: JSON.stringify(h.spec(["AAPL", "GOOG", "MSFT"])) })];
  const first = await h.scheduler.runScenarioSchedule({ concurrency: 1 });
  check(first.results.map(row => [row.state, row.imported, row.remaining]), [["importing", 2, 2]]);
  const cycle = h.rows[0].refreshStartedAt.toISOString(); check(cycle, "2026-11-19T17:00:00.000Z");
  check(h.advances.length, 0, "Partial history does not create an observation");
  now = Date.parse("2026-11-19T18:02:00Z");
  const second = await h.scheduler.runScenarioSchedule({ concurrency: 1 });
  check(second.results.map(row => row.state), ["tracked"]);
  check(h.imports.map(row => row.symbol), ["AAPL", "GOOG", "MSFT", "SPY"], "Resume downloads only the unfinished symbols");
  check(h.advances[0].lease.cycleStart.toISOString(), cycle, "The import cycle stays stable across the hour boundary");
  check(h.rows[0].refreshStartedAt, null, "Successful advancement releases the cycle");
  const shared = harness(); shared.rows = [shared.row("first"), shared.row("second")];
  await shared.scheduler.runScenarioSchedule({ concurrency: 1 });
  check(shared.imports.length, 2, "Scenarios owned by the same user reuse the current cycle's imports");
  check(shared.advances.map(row => row.lease.cycleStart.toISOString()), ["2026-11-19T18:00:00.000Z", "2026-11-19T18:00:00.000Z"]);
}

// Provider Retry-After pauses fresh work, retains completed imports, and resumes
// the unfinished cycle. Authentication failures use a longer recovery interval.
{
  now = Date.parse("2026-11-19T18:20:00Z"); const h = harness();
  h.rows = [h.row("a-rate-limited"), h.row("b-deferred"), h.row("c-deferred")];
  let limited = true;
  h.importing = async (_user, symbol) => { if (symbol === "SPY" && limited) throw new h.StrategyError("PROVIDER_RATE_LIMIT", "Fixture provider cooldown", 429, 120); };
  const first = await h.scheduler.runScenarioSchedule({ concurrency: 1 });
  check([first.processed, first.deferred, first.retrying, first.providerCoolingDown], [1, 2, 1, true]);
  check(h.rows[0].nextCheckAt.getTime(), now + 2 * MINUTE, "Retry-After controls the durable next attempt");
  check(h.datasets.map(row => row.symbol), ["AAPL"], "Successful imports survive a later provider error");
  check(h.advances.length, 0, "A provider failure never becomes a complete observation");
  h.rows[1].status = "Archived"; h.rows[2].status = "Archived";
  now += MINUTE; check((await h.scheduler.runScenarioSchedule()).processed, 0, "The scheduler respects the retry window");
  now += MINUTE; limited = false; await h.scheduler.runScenarioSchedule({ concurrency: 1 });
  check(h.imports.map(row => row.symbol), ["AAPL", "SPY", "SPY"], "The saved instrument is not downloaded again after rate limiting");
  for (const [status, retry, delay] of [[403, undefined, 24 * HOUR], [503, undefined, 15 * MINUTE], [429, 1, MINUTE], [429, 1_000_000, 24 * HOUR]]) {
    const failure = harness(); failure.rows = [failure.row(`failure-${status}-${retry ?? "none"}`)];
    failure.importing = async () => { throw new failure.StrategyError("FIXTURE_PROVIDER_ERROR", "Fixture failure", status, retry); };
    await failure.scheduler.runScenarioSchedule(); check(failure.rows[0].nextCheckAt.getTime(), now + delay, `Recovery interval for provider ${status}`);
  }
}

// Two schedulers racing for the same row cannot both import it. A worker whose
// partial import lease was replaced cannot overwrite the replacement's state.
{
  const h = harness(); h.rows = [h.row("claimed")];
  let first = true;
  h.beforeUpdate = input => { if (first && input.data.refreshStartedAt) { first = false; h.rows[0].nextCheckAt = new Date(now + HOUR); } };
  check((await h.scheduler.runScenarioSchedule()).results[0].state, "already-claimed"); check(h.imports.length, 0); check(h.advances.length, 0);
  const partial = harness(); partial.rows = [partial.row("superseded", { specJson: JSON.stringify(partial.spec(["AAPL", "GOOG", "MSFT"])) })];
  partial.importing = () => { if (partial.imports.length === 2) { partial.rows[0].nextCheckAt = new Date(now + 2 * HOUR); partial.rows[0].lastError = "Replacement worker owns this cycle"; } };
  check((await partial.scheduler.runScenarioSchedule()).results[0].state, "superseded");
  check([partial.rows[0].nextCheckAt.getTime(), partial.rows[0].lastError], [now + 2 * HOUR, "Replacement worker owns this cycle"]);
}

// Real forward replay integration: only the persistence/provider boundary is
// injected. Checksums, completed-session validation, replay, and the audit chain
// are the production implementations.
function replayFixture() {
  now = Date.parse("2026-11-19T19:00:00Z"); const h = harness({ actualAdvance: true });
  h.core = h.load("src/lib/connected-research/scenario-core.ts");
  h.scope = { userId: "owner-a", firmId: "firm-a" };
  h.lease = { expiresAt: new Date(now + 10 * MINUTE), cycleStart: new Date(now) };
  const baselineDates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
  const observedDates = [...baselineDates, "2026-11-16", "2026-11-17", "2026-11-18"];
  h.dataset = (symbol, dates = observedDates) => {
    const bars = dates.map((date, i) => ({ date, open: 100 + i, high: 103 + i, low: 99 + i, close: 101 + i, adjustedClose: 101 + i, volume: 100_000, dividend: 0, split: 1 }));
    return { id: `verified-${symbol}-${dates.at(-1)}`, provider: "Alpha Vantage", symbol, currency: "USD", retrievedAt: new Date(now).toISOString(), sourceSha256: h.core.digest(JSON.stringify(bars)), bars };
  };
  const spec = h.spec(["AAPL"]), frozenAt = new Date("2026-11-16T19:00:00Z");
  const baseline = ["AAPL", "SPY"].map(symbol => ({ ...h.dataset(symbol, baselineDates), retrievedAt: frozenAt.toISOString() }));
  const journal = h.core.freezeJournal(spec, baseline, frozenAt), journalJson = JSON.stringify(journal);
  const specJson = JSON.stringify(spec), assumptionsJson = JSON.stringify({ targetSessions: 5, shocksPct: { AAPL: 0 }, reviewDrawdownPct: 10, notes: "" }), baselineWeightsJson = JSON.stringify({ AAPL: 100 });
  h.rows = [h.row("replay", { ...h.scope, nextCheckAt: h.lease.expiresAt, refreshStartedAt: h.lease.cycleStart, specJson, assumptionsJson, baselineWeightsJson,
    definitionHash: h.core.digest(specJson + "\n" + assumptionsJson + "\n" + baselineWeightsJson), journalJson, journalHash: h.core.digest(journalJson), sourcesJson: JSON.stringify(journal.sources), sourcesHash: h.core.digest(JSON.stringify(journal.sources)), frozenAt, earliestStart: journal.earliestStart, resultJson: null, resultHash: null, acceptedSessions: 0, lastSession: null })];
  h.setDatasets = datasets => { h.datasets = datasets.map(dataset => ({ id: dataset.id, userId: h.scope.userId, provider: dataset.provider, symbol: dataset.symbol, endpoint: "TIME_SERIES_DAILY_ADJUSTED", retrievedAt: new Date(dataset.retrievedAt), dataset })); };
  h.setDatasets([h.dataset("AAPL"), h.dataset("SPY")]);
  h.baseline = baseline; h.observedDates = observedDates;
  h.advance = lease => h.service.advanceScenario(h.scope, "replay", lease);
  return h;
}

{
  const h = replayFixture(), result = await h.advance(h.lease);
  check(result.appendedSessions, 2, "Only the two completed eligible sessions are appended");
  check(h.observations.map(row => row.sessionDate), ["2026-11-17", "2026-11-18"]);
  check([h.rows[0].acceptedSessions, h.rows[0].version, h.transactions, h.inserts], [2, 1, 1, 1]);
  ok(h.observations.every(row => row.userId === h.scope.userId && row.firmId === h.scope.firmId));
  const payload = JSON.parse(h.observations[0].payloadJson);
  check(payload.classification, "registered-rule-paper-replay");
  check(payload.sourceBatch.map(source => source.symbol), ["AAPL", "SPY"]);
  ok(payload.sourceBatch.every(source => source.rawSha256.length === 64 && source.retrievedAt === new Date(now).toISOString()), "Every appended checkpoint retains its source checksums and retrieval times");
  check(h.core.verifyObservationChain(h.observations, h.rows[0].definitionHash, h.rows[0].frozenAt.toISOString(), 2).records, 2);
  const saved = [h.rows[0].resultJson, h.rows[0].journalHash, h.rows[0].version, h.observations.map(row => row.recordHash)];
  check((await h.advance()).appendedSessions, 0, "Repeated reads cannot invent or duplicate a market session");
  check([h.rows[0].resultJson, h.rows[0].journalHash, h.rows[0].version, h.observations.map(row => row.recordHash)], JSON.parse(JSON.stringify(saved)));
  check(h.rows[0].nextCheckAt.getTime(), now + HOUR, "An idle beta scenario remains scheduled for future observations");
  h.setDatasets([h.dataset("AAPL", [...h.observedDates, "2026-11-19"]), h.dataset("SPY", [...h.observedDates, "2026-11-19"])]);
  await rejects(() => h.advance(), "INCOMPLETE_SESSION");
  check([h.rows[0].resultJson, h.rows[0].journalHash, h.rows[0].version, h.observations.map(row => row.recordHash)], JSON.parse(JSON.stringify(saved)), "An incomplete current session cannot rewrite accepted evidence");
}

{
  const empty = replayFixture(); empty.setDatasets(empty.baseline); const original = empty.rows[0].journalHash;
  check((await empty.advance(empty.lease)).appendedSessions, 0);
  check([empty.transactions, empty.inserts, empty.observations.length, empty.rows[0].acceptedSessions], [0, 0, 0, 0]);
  check(empty.rows[0].journalHash, original, "An empty eligible window preserves the frozen baseline");
  const cases = [
    ["IMPORT_REQUIRED", h => { h.datasets.pop(); }],
    ["SCENARIO_PROVENANCE", h => { h.datasets[0].dataset.provider = "Demo fallback"; }],
    ["SCENARIO_PROVENANCE", h => { h.datasets[0].dataset.sourceSha256 = "unverified"; }],
    ["INCOMPLETE_SESSION", h => { h.setDatasets([h.dataset("AAPL", [...h.observedDates, "2026-11-20"]), h.dataset("SPY", [...h.observedDates, "2026-11-20"])]); }],
    ["OUT_OF_SYNC", h => { h.datasets[0].dataset.bars.pop(); }],
    ["INVALID_BAR", h => { h.datasets[0].dataset.bars.at(-1).close = 0; }],
    ["HISTORICAL_REVISION", h => { h.datasets[0].dataset.bars[0].volume++; }],
    ["NONTRADABLE_BAR", h => { h.datasets[0].dataset.bars.find(row => row.date === "2026-11-17").volume = 0; }],
  ];
  for (const [code, alter] of cases) {
    const h = replayFixture(), before = h.rows[0].journalHash; alter(h); await rejects(() => h.advance(h.lease), code);
    check([h.observations.length, h.inserts, h.rows[0].acceptedSessions, h.rows[0].journalHash], [0, 0, 0, before], `${code} cannot publish a substitute price or partial observation`);
  }
}

// Loss before the read, during calculation, or immediately before a transaction
// all leave the replacement worker's lease and journal untouched.
{
  const wrongOwner = replayFixture();
  await rejects(() => wrongOwner.service.advanceScenario({ userId: "other-user", firmId: "firm-a" }, "replay", wrongOwner.lease), "SCENARIO_NOT_FOUND");
  await rejects(() => wrongOwner.service.advanceScenario({ userId: "owner-a", firmId: "other-firm" }, "replay", wrongOwner.lease), "SCENARIO_NOT_FOUND");
  check([wrongOwner.updates.length, wrongOwner.inserts], [0, 0], "Neither ownership mismatch can mutate the scenario");
  const stale = replayFixture(); stale.rows[0].nextCheckAt = new Date(now + HOUR);
  await rejects(() => stale.advance(stale.lease), "SCENARIO_LEASE_LOST"); check([stale.updates.length, stale.inserts], [0, 0]);
  for (const noNewSession of [false, true]) {
    const h = replayFixture(), original = h.rows[0].journalHash;
    if (noNewSession) h.setDatasets(h.baseline);
    const replace = () => { h.rows[0].nextCheckAt = new Date(now + 2 * HOUR); h.rows[0].refreshStartedAt = new Date(now + HOUR); h.rows[0].lastError = "Replacement worker owns this cycle"; };
    if (noNewSession) h.beforeDatasets = replace; else h.beforeTransaction = replace;
    await rejects(() => h.advance(h.lease), "UPDATE_CONFLICT");
    check([h.rows[0].nextCheckAt.getTime(), h.rows[0].refreshStartedAt.getTime(), h.rows[0].lastError], [now + 2 * HOUR, now + HOUR, "Replacement worker owns this cycle"], "A stale worker cannot reschedule or mark the new worker failed");
    check([h.inserts, h.observations.length, h.rows[0].acceptedSessions, h.rows[0].journalHash], [0, 0, 0, original], "Lease loss cannot publish replay observations");
  }
  const rollback = replayFixture(), original = rollback.rows[0].journalHash;
  rollback.beforeInsert = () => { throw new rollback.StrategyError("FIXTURE_INSERT_FAILURE", "Fixture atomic write failure", 503); };
  await rejects(() => rollback.advance(rollback.lease), "FIXTURE_INSERT_FAILURE");
  check([rollback.observations.length, rollback.rows[0].acceptedSessions, rollback.rows[0].version, rollback.rows[0].journalHash], [0, 0, 0, original], "A failed observation insert rolls back its checkpoint update");
}

console.log(`Scenario tracking checks passed (${checks} assertions): oldest-due bounded work, ownership, stable import cycles, provider cooldown, complete verified sessions, idempotent audit trails, atomic writes, and lease-loss races.`);
