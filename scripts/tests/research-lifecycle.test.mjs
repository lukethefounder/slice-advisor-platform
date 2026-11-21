import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

// Execute the actual TSX request handlers and effects. Only presentation, browser
// services, and React's small hook scheduler are substituted; transport promises
// deliberately ignore abort signals to expose missing ownership checks.
const require = createRequire(import.meta.url), ts = require("typescript");
const repo = fileURLToPath(new URL("../..", import.meta.url));
const GRAPH = "src/components/intelligence/knowledge-graph-workspace.tsx";
const CONTROL = "src/components/intelligence/intelligence-control-plane.tsx";
const OUTCOMES = "src/components/intelligence/knowledge-graph-outcomes.tsx";
const FORECAST = "src/components/intelligence-unified/unified-forecast-panel.tsx";
const CLIENT = "src/lib/intelligence/client.ts";
const compiled = new Map(), failures = [];
let assertions = 0, scenarios = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
const flush = () => new Promise(done => setImmediate(done));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function test(name, run) {
  try { await run(); scenarios++; }
  catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}:`, error.message); }
}
function events() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) { const group = listeners.get(type) ?? new Set(); group.add(callback); listeners.set(type, group); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatchEvent(event) { for (const callback of [...(listeners.get(event.type) ?? [])]) callback(event); },
    listenerCount() { return [...listeners.values()].reduce((total, group) => total + group.size, 0); },
  };
}
function hookDriver() {
  const slots = [];
  let cursor = 0, pending = [], disposed = false, dirty = true, lateWrites = 0;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  return {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => {
        if (disposed) { lateWrites++; return; }
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useMemo(callback, dependencies) { const index = cursor++; if (!slots[index] || changed(slots[index].dependencies, dependencies)) slots[index] = { value: callback(), dependencies }; return slots[index].value; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) {
        const previous = slots[index]; slots[index] = { dependencies, cleanup: previous?.cleanup };
        pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
    render(component) {
      if (disposed) return;
      let result, turns = 0;
      do {
        cursor = 0; pending = []; dirty = false; result = component();
        for (const effect of pending) effect();
        if (++turns > 30) throw new Error("Hook fixture did not settle");
      } while (dirty);
      return result;
    },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); },
    lateWrites: () => lateWrites,
  };
}
function instrument(path, source) {
  let marker, extra;
  if (path === GRAPH) {
    marker = "  const progress =";
    extra = "globalThis.__state={activeSymbol,graphView,syncResult,currentGraph,currentRunId,metadata,state,job,error,isBusy};globalThis.__actions={loadGraph,runGraph,pollJob,cancelJob,stopPolling,setSymbolInput};";
  } else if (path === CONTROL) {
    marker = "  return <IntelligencePage";
    extra = "globalThis.__state={activeSymbol,swarm,bootstrap,current,saved,graph,runId,stage,job,error,busy};globalThis.__actions={loadSaved,runResearch,cancelResearch,setSymbolInput};";
  } else if (path === OUTCOMES) {
    marker = "  return <section";
    extra = "globalThis.__state={horizon,now,bundle,researchOnly,analysis,currentEstimate,error,loading};globalThis.__actions={chooseHorizon};";
    source += "\nexport const __PinnedOutcomes= PinnedOutcomes;";
  } else if (path === FORECAST) {
    marker = "  return <section";
    extra = "globalThis.__state={horizon,now,bundle,researchOnly,analysis,currentEstimate,error,busy};globalThis.__actions={chooseHorizon,load,generate};";
  }
  if (marker) {
    check(source.split(marker).length, 2, `Unique instrumentation point in ${path}`);
    source = source.replace(marker, `${extra}\n${marker}`);
  }
  return source;
}
function harness(path, options = {}) {
  let now = Date.parse("2026-11-18T18:00:00Z"), location = new URL(options.url ?? "https://slice.example/workspace/intelligence?symbol=MSFT");
  const timers = new Map(), requests = [], fetches = [], historyWrites = [], cache = new Map(), driver = hookDriver();
  let timerId = 0, tree = null, component;
  const addTimer = (callback, delay, interval = false) => { const id = ++timerId; timers.set(id, { callback, delay, interval }); return id; };
  const window = { ...events(), setTimeout: (callback, delay) => addTimer(callback, delay), clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => addTimer(callback, delay, true), clearInterval: id => timers.delete(id),
    history: { state: { retained: true }, replaceState(state, _title, value) { this.state = state; location = new URL(value, location); historyWrites.push(location.href); }, pushState(state, title, value) { this.replaceState(state, title, value); } } };
  Object.defineProperty(window, "location", { get: () => location });
  const document = { ...events(), visibilityState: "visible" };
  function request(list, url, init = {}, requestOptions = {}) {
    const pending = deferred(), item = { ...pending, url: String(url), init, options: requestOptions, taken: false, settled: false };
    item.resolve = value => { item.settled = true; pending.resolve(value); };
    item.reject = error => { item.settled = true; pending.reject(error); };
    list.push(item); return pending.promise;
  }
  class ClockDate extends Date { constructor(...values) { super(...(values.length ? values : [now])); } static now() { return now; } }
  const context = createContext({ window, document, navigator: { onLine: true }, console, Date: ClockDate, URL, URLSearchParams,
    Headers, FormData, AbortController, AbortSignal, DOMException, Error, TypeError, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    setInterval: window.setInterval, clearInterval: window.clearInterval, fetch: (url, init) => request(fetches, url, init) });
  const stub = function PresentationStub() {};
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    if (!compiled.has(relative)) {
      const source = instrument(relative, readFileSync(resolve(repo, relative), "utf8"));
      const result = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
      check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${relative} transpiles`);
      compiled.set(relative, result.outputText);
    }
    const module = { exports: {} }; cache.set(relative, module);
    const imports = specifier => {
      if (specifier === "react") return { ...driver, useCallback: (callback, dependencies) => driver.useMemo(() => callback, dependencies) };
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (specifier === "next/dynamic") return { __esModule: true, default: () => stub };
      if (specifier === "next/navigation") return { useRouter: () => ({ push: url => window.history.pushState(window.history.state, "", url) }) };
      if (specifier === "@/lib/research/beta-client") return { browserBetaEnabled: () => true, applicationRequestTimeout: () => 0 };
      if (specifier === "@/lib/intelligence/client") return { ...load(CLIENT), intelligenceFetch: (url, init, opts) => request(requests, url, init, opts) };
      if (specifier === "@/lib/intelligence/research-config") return load("src/lib/intelligence/research-config.ts");
      if (specifier.endsWith("/research-instrument")) return load("src/lib/intelligence/research-instrument.ts");
      if (specifier === "@/lib/intelligence-unified/contracts") return load("src/lib/intelligence-unified/contracts.ts");
      if (specifier === "@/lib/intelligence/score-interpretation") return load("src/lib/intelligence/score-interpretation.ts");
      if (specifier === "@/components/intelligence/intelligence-ui") return load("src/components/intelligence/intelligence-ui.tsx");
      if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => ({ agentDeskFounder: false }) };
      if (specifier.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
      return { __esModule: true, default: stub };
    };
    runInContext(`(function(require,module,exports){${compiled.get(relative)}\n})`, context, { filename: relative })(imports, module, module.exports);
    return module.exports;
  }
  if (path) { const module = load(path); component = () => (path === OUTCOMES ? module.__PinnedOutcomes : module.default)(options.props ?? {}); }
  const h = { context, window, document, requests, fetches, timers, historyWrites, load,
    get state() { return context.__state; }, get actions() { return context.__actions; }, get now() { return now; }, get tree() { return tree; },
    advance(milliseconds) { now += milliseconds; },
    render() { tree = driver.render(component); return tree; },
    async flush() { await flush(); if (component) h.render(); await flush(); if (component) h.render(); },
    next(method, pathname, list = requests) {
      const found = list.find(item => !item.taken && String(item.init.method ?? "GET").toUpperCase() === method && new URL(item.url, location).pathname === pathname);
      assert.ok(found, `Expected ${method} ${pathname}; recorded: ${list.map(item => `${item.init.method ?? "GET"} ${item.url}${item.taken ? " [taken]" : ""}`).join(", ")}`);
      found.taken = true; return found;
    },
    fire(delay, interval = false) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay && timer.interval === interval);
      assert.ok(entry, `Expected ${interval ? "interval" : "timer"} at ${delay}ms; available: ${[...timers.values()].map(timer => timer.delay).join(", ")}`);
      if (!interval) timers.delete(entry[0]); return entry[1].callback();
    },
    timerCount: () => [...timers.values()].filter(timer => !timer.interval).length,
    unmount() { driver.unmount(); }, lateWrites: driver.lateWrites,
  };
  return h;
}

const iso = "2026-11-18T17:59:00Z";
function graph(symbol, runId = `run-${symbol}`) {
  return { symbol, runId, generatedAt: iso, nodeCount: 1, edgeCount: 0, nodes: [], edges: [],
    projection: { mode: "overview", originalNodeCount: 1, originalEdgeCount: 0 } };
}
function view(symbol, runId = `run-${symbol}`) {
  return { symbol, runId, generatedAt: iso, graph: graph(symbol, runId), analytics: { centralityTop: [], communities: [] },
    metadata: { companyName: `${symbol} company`, score: 76, confidence: 75, providerAsOf: iso }, persistence: { status: "persisted" } };
}
const persistence = { configured: true, enabled: true, database: "postgresql", missing: [] };
const graphResponse = value => ({ ok: true, symbol: value?.symbol ?? "MSFT", view: value, persistence, message: "No saved graph." });
const savedResponse = value => ({ ok: true, latest: value, integrations: [], persistence });
function swarm(symbol, runId = `sync-${symbol}`) {
  return { symbol, runId, executionMode: "sync", companyName: symbol, graph: graph(symbol, runId), graphAnalytics: { centralityTop: [], communities: [] },
    score: { overall: 76, confidence: 75, weighting: { media: .2, technical: .5, economy: .3 } }, market: { price: 100 },
    graphPersistence: { status: "persisted" }, requestedAgents: 600, activeAgents: 600, warnings: [] };
}
function job(id, status = "Processing", output = null) {
  return { id, jobKey: "intelligence_graph_refresh", jobName: "Research", status, progress: { value: 30, message: "Researching", updatedAt: iso },
    attempt: 1, maxAttempts: 4, output, error: null, lastError: null, completedAt: null };
}
const queued = (id, symbol = "MSFT") => ({ ok: true, executionMode: "background", job: job(id, "Queued"), symbol, message: "Research queued." });
async function ready(path, initialView = null) {
  const h = harness(path); h.render(); if (path === CONTROL) h.fire(0);
  h.next("GET", path === GRAPH ? "/api/intelligence/research-graph" : "/api/intelligence/research-swarm").resolve(path === GRAPH ? graphResponse(initialView) : savedResponse(initialView));
  await h.flush(); return h;
}
function build(h, path, symbol) {
  if (path === GRAPH) return h.actions.runGraph({ symbol, selectedPreset: "quick", forceRefresh: true });
  h.actions.setSymbolInput(symbol); h.render(); return h.actions.runResearch({ preventDefault() {} });
}
const phase = h => h.state.stage ?? h.state.state;
const activeRun = h => h.state.runId ?? h.state.currentRunId ?? null;
const savedPath = path => path === GRAPH ? "/api/intelligence/research-graph" : "/api/intelligence/research-swarm";
const cancel = (h, path) => path === GRAPH ? h.actions.cancelJob() : h.actions.cancelResearch();
async function startQueued(h, path, id, symbol = "MSFT") {
  const work = build(h, path, symbol); h.next("POST", "/api/intelligence/research-swarm").resolve(queued(id, symbol));
  await h.flush(); if (path === CONTROL) h.fire(1500);
  return { work, poll: h.next("GET", `/api/jobs/${id}`) };
}

await test("client preserves body abort and never returns a fabricated empty result", async () => {
  for (const rejectBody of [true, false]) {
    const h = harness(), api = h.load(CLIENT), controller = new AbortController(), body = deferred();
    const work = api.intelligenceFetch("/fixture", { signal: controller.signal }, { retries: 0 });
    const observed = assert.rejects(work, error => error instanceof DOMException && error.name === "AbortError");
    h.next("GET", "/fixture", h.fetches).resolve({ ok: true, json: () => body.promise }); await h.flush();
    controller.abort(); if (rejectBody) body.reject(new DOMException("Body aborted", "AbortError")); else body.resolve({ ok: true });
    await observed; assertions++; check(h.fetches.length, 1, "An aborted body is not retried");
  }
  const h = harness(), api = h.load(CLIENT);
  const work = api.intelligenceFetch("/fixture", { method: "POST", body: "{}" }, { retries: 5 });
  const observed = assert.rejects(work, error => error.code === "INVALID_RESPONSE");
  h.next("POST", "/fixture", h.fetches).resolve({ ok: true, json: async () => { throw new SyntaxError("Truncated JSON"); } });
  await observed; assertions++; check(h.fetches.length, 1, "Incomplete write responses do not replay the write");
});

for (const path of [GRAPH, CONTROL]) {
  const name = path === GRAPH ? "graph" : "control";
  await test(`${name}: switching stocks clears prior graph and score immediately`, async () => {
    const h = await ready(path, view("MSFT")); check(activeRun(h), "run-MSFT");
    let work = build(h, path, "MSFT"); h.next("POST", "/api/intelligence/research-swarm").resolve(swarm("MSFT")); await work; await h.flush();
    check(activeRun(h), "sync-MSFT");
    work = build(h, path, "NVDA"); h.render();
    check(h.state.activeSymbol, "NVDA"); check(activeRun(h), null, "Stock B never inherits stock A's research identity");
    check(path === GRAPH ? h.state.syncResult : h.state.swarm, null, "The old fallback score is cleared");
    check(path === GRAPH ? h.state.currentGraph : h.state.graph, null, "The old graph is cleared");
    h.next("POST", "/api/intelligence/research-swarm").resolve(swarm("NVDA")); await work; await h.flush();
    check(activeRun(h), "sync-NVDA"); check(phase(h), "complete"); h.unmount();
  });

  await test(`${name}: older saved loads cannot overwrite a newer stock`, async () => {
    const h = await ready(path);
    const load = (symbol, runId) => path === GRAPH ? h.actions.loadGraph({ symbol, runId, projection: "overview" }) : h.actions.loadSaved(symbol, runId);
    const oldWork = load("MSFT", "run-MSFT"), old = h.next("GET", savedPath(path));
    const newWork = load("NVDA", "run-NVDA"), fresh = h.next("GET", savedPath(path));
    yes(old.init.signal.aborted, "The older transport is aborted");
    fresh.resolve(path === GRAPH ? graphResponse(view("NVDA")) : savedResponse(view("NVDA"))); await newWork; await h.flush();
    old.resolve(path === GRAPH ? graphResponse(view("MSFT")) : savedResponse(view("MSFT"))); await oldWork; await h.flush();
    check(h.state.activeSymbol, "NVDA"); check(activeRun(h), "run-NVDA");
    check(new URL(h.window.location.href).searchParams.get("symbol"), "NVDA", "A late result cannot repin the URL"); h.unmount();
  });

  for (const rejectOld of [false, true]) await test(`${name}: stale build ${rejectOld ? "failure" : "success"} is fenced`, async () => {
    const h = await ready(path), oldWork = build(h, path, "MSFT"), old = h.next("POST", "/api/intelligence/research-swarm");
    const freshWork = build(h, path, "NVDA"), fresh = h.next("POST", "/api/intelligence/research-swarm");
    fresh.resolve(swarm("NVDA")); await freshWork; await h.flush();
    if (rejectOld) old.reject(new Error("Old transport failed after replacement")); else old.resolve(swarm("MSFT"));
    await oldWork; await h.flush();
    check(h.state.activeSymbol, "NVDA"); check(activeRun(h), "sync-NVDA"); check(phase(h), "complete"); check(h.state.error, ""); h.unmount();
  });

  await test(`${name}: missing resumed jobs exit permanently rather than polling forever`, async () => {
    const h = harness(path, { url: "https://slice.example/workspace/intelligence?symbol=MSFT&researchJobId=missing-job" });
    h.render(); if (path === CONTROL) { h.fire(0); h.render(); }
    const missing = Object.assign(new Error("Missing job"), { status: 404 });
    h.next("PATCH", "/api/jobs/missing-job").reject(missing);
    if (path === CONTROL) h.fire(1500);
    h.next("GET", "/api/jobs/missing-job").reject(missing); await h.flush();
    check(phase(h), "error"); check(h.state.job, null); check(h.state.isBusy ?? h.state.busy, false);
    check(h.timerCount(), 0, "A permanent404 is not rescheduled"); check(h.requests.length, 2, "No latest-research fallback is made"); h.unmount();
  });

  for (const [label, output, jobKey] of [["missing run", null], ["empty run", { runId: "", symbol: "MSFT" }], ["wrong stock", { runId: "other", symbol: "NVDA" }], ["different job type", { runId: "valid", symbol: "MSFT" }, "market_scan"]]) {
    await test(`${name}: completed job with ${label} cannot load latest research`, async () => {
      const h = await ready(path), { work, poll } = await startQueued(h, path, "job-invalid");
      poll.resolve({ job: { ...job("job-invalid", "Complete", output), ...(jobKey ? { jobKey } : {}) } });
      await work; await h.flush();
      check(phase(h), "error"); check(activeRun(h), null); check(h.timerCount(), 0);
      check(h.requests.filter(item => new URL(item.url, h.window.location).pathname === savedPath(path) && (item.init.method ?? "GET") === "GET").length, 1, "Only the initial saved load exists"); h.unmount();
    });
  }

  await test(`${name}: successful completion loads only the exact completed run`, async () => {
    const h = await ready(path), { work, poll } = await startQueued(h, path, "job-valid");
    poll.resolve({ job: job("job-valid", "Complete", { runId: "completed-run", symbol: "MSFT" }) }); await h.flush();
    const saved = h.next("GET", savedPath(path));
    check(new URL(saved.url, h.window.location).searchParams.get("runId"), "completed-run");
    saved.resolve(path === GRAPH ? graphResponse(view("MSFT", "completed-run")) : savedResponse(view("MSFT", "completed-run")));
    await work; await h.flush(); check(phase(h), "complete"); check(activeRun(h), "completed-run"); h.unmount();
  });

  for (const rejectCancel of [false, true]) await test(`${name}: late cancellation ${rejectCancel ? "failure" : "success"} cannot stop a new run`, async () => {
    const h = await ready(path), first = await startQueued(h, path, "job-A");
    first.poll.resolve({ job: job("job-A") }); await first.work; await h.flush();
    const cancelling = cancel(h, path), cancellation = h.next("PATCH", "/api/jobs/job-A");
    const second = await startQueued(h, path, "job-B", "NVDA");
    second.poll.resolve({ job: job("job-B") }); await second.work; await h.flush();
    const timersBefore = h.timerCount();
    if (rejectCancel) cancellation.reject(new Error("Old cancellation failed")); else cancellation.resolve({ job: job("job-A", "Cancelled") });
    await cancelling; await h.flush();
    check(h.state.activeSymbol, "NVDA"); check(h.state.job?.id, "job-B"); yes(["queued", "processing"].includes(phase(h)));
    check(h.timerCount(), timersBefore, "The new poll remains scheduled"); check(h.state.error, ""); h.unmount();
  });

  await test(`${name}: stale poll completion cannot revive a replaced job`, async () => {
    const h = await ready(path), first = await startQueued(h, path, "job-A");
    // The old response is delivered before React flushes cleanup of the job effect.
    const freshWork = build(h, path, "NVDA"), fresh = h.next("POST", "/api/intelligence/research-swarm");
    first.poll.resolve({ job: job("job-A", "Complete", { runId: "run-A", symbol: "MSFT" }) }); await h.flush();
    check(h.requests.filter(item => new URL(item.url, h.window.location).pathname === savedPath(path) && (item.init.method ?? "GET") === "GET").length, 1, "A superseded completion never starts an old saved load");
    fresh.resolve(swarm("NVDA")); await freshWork; await first.work; await h.flush();
    check(activeRun(h), "sync-NVDA"); check(phase(h), "complete"); h.unmount();
  });

  for (const mismatch of ["symbol", "runId"]) await test(`${name}: saved response cannot substitute another ${mismatch}`, async () => {
    const h = await ready(path);
    const work = path === GRAPH ? h.actions.loadGraph({ symbol: "MSFT", runId: "pinned", projection: "overview" }) : h.actions.loadSaved("MSFT", "pinned");
    const wrong = view(mismatch === "symbol" ? "NVDA" : "MSFT", mismatch === "runId" ? "other-run" : "pinned");
    h.next("GET", savedPath(path)).resolve(path === GRAPH ? graphResponse(wrong) : savedResponse(wrong)); await work; await h.flush();
    check(phase(h), "error"); check(activeRun(h), null, "A mismatched response never becomes the displayed run"); h.unmount();
  });

  await test(`${name}: synchronous response must match the requested stock`, async () => {
    const h = await ready(path), work = build(h, path, "MSFT");
    h.next("POST", "/api/intelligence/research-swarm").resolve(swarm("NVDA")); await work; await h.flush();
    check(phase(h), "error"); check(activeRun(h), null); h.unmount();
  });

  await test(`${name}: navigation fences pending load and poll callbacks`, async () => {
    const h = harness(path); h.render(); if (path === CONTROL) h.fire(0);
    const pending = h.next("GET", savedPath(path)), before = h.window.location.href;
    h.unmount(); pending.resolve(path === GRAPH ? graphResponse(view("MSFT")) : savedResponse(view("MSFT"))); await h.flush();
    check(h.lateWrites(), 0); check(h.window.location.href, before); check(h.timerCount(), 0);
    const running = await ready(path), { work, poll } = await startQueued(running, path, "job-exit");
    running.unmount(); poll.resolve({ job: job("job-exit") }); await work; await running.flush();
    check(running.lateWrites(), 0); check(running.timerCount(), 0, "An unmounted poll cannot reschedule itself");
  });
}

await test("graph: completed-job graph loading cannot overwrite a later build", async () => {
  const h = await ready(GRAPH), first = await startQueued(h, GRAPH, "job-A");
  first.poll.resolve({ job: job("job-A", "Complete", { runId: "finished-A", symbol: "MSFT" }) }); await h.flush();
  const oldLoad = h.next("GET", "/api/intelligence/research-graph");
  const freshWork = build(h, GRAPH, "NVDA"), fresh = h.next("POST", "/api/intelligence/research-swarm");
  fresh.resolve(swarm("NVDA")); await freshWork; await h.flush();
  oldLoad.resolve(graphResponse(view("MSFT", "finished-A"))); await first.work; await h.flush();
  check(h.state.activeSymbol, "NVDA"); check(activeRun(h), "sync-NVDA"); check(phase(h), "complete"); check(h.state.error, ""); h.unmount();
});

function canonical(h, horizon = "5-30m") {
  const cohort = score => ({ score, confidence: 80, evidenceCount: 12 });
  const row = value => ({ horizon: value, label: value, positiveReturnProbability: 68, expectedReturnPercent: 2, expectedPrice: 102,
    expectedRangePercent: { low: -3, high: 5 }, expectedPriceRange: { low: 97, high: 105 }, confidence: 70, volatilityPercent: 5,
    modelAgreement: "High", dataQuality: "High", primaryUncertainty: "Earnings", contributions: [] });
  return { symbol: "MSFT", researchRunId: "run-MSFT", forecastRunId: "forecast-MSFT", outputSha256: "fixture", asOf: iso,
    market: { price: 100, currency: "USD", realTimeConfirmed: true, delayed: false, marketOpen: true, freshnessMode: "realtime" },
    score: { overall: 76, confidence: 75, generatedAt: iso, providerAsOf: iso, weighting: { media: .2, technical: .5, economy: .3 },
      cohorts: { media: cohort(72), technical: cohort(78), economy: cohort(75) }, quality: { evidenceCoverage: 85, contradictionPenalty: 0 },
      methodology: { eligibleEvidenceCount: 36, sourceConcentrationPercent: 30, maximumSourceImpact: 1, sourceSensitivityBand: { low: 74, high: 77 } },
      drivers: { positive: ["Earnings"], negative: ["Valuation"], contradictions: [] } },
    forecast: { symbol: "MSFT", horizons: [row("5-30m"), row("1d"), row("2-5d")], drivers: { positive: [], negative: [], contradictions: [] }, limitations: [] },
    targets: { "5-30m": new Date(h.now + 60000).toISOString(), "1d": new Date(h.now + 86400000).toISOString(), "2-5d": new Date(h.now + 2 * 86400000).toISOString() },
    operations: { warehouse: "audited" }, chosen: horizon };
}
for (const path of [OUTCOMES, FORECAST]) await test(`${path === OUTCOMES ? "graph outcomes" : "forecast"}: selected horizon and visibility refresh preserve current meaning`, async () => {
  const h = harness(path, { url: "https://slice.example/workspace/intelligence/knowledge-graph?symbol=MSFT&runId=run-MSFT&researchRunId=run-MSFT&forecastHorizon=1d#research-sources",
    props: { symbol: "MSFT", runId: "run-MSFT", researchRunId: "run-MSFT" } });
  h.render(); if (path === FORECAST) h.fire(180);
  h.next("GET", "/api/intelligence/canonical").resolve({ bundle: canonical(h) }); await h.flush();
  check(h.state.horizon, "1d", "A linked horizon is restored"); check(h.state.analysis.horizon, "1d");
  h.actions.chooseHorizon("5-30m"); h.render();
  check(new URL(h.window.location.href).searchParams.get("forecastHorizon"), "5-30m", "Chosen horizon is copyable and reloadable");
  check(new URL(h.window.location.href).searchParams.get("researchRunId"), "run-MSFT");
  check(h.state.analysis.stance, "favorable");
  h.document.visibilityState = "hidden"; h.advance(120000); h.fire(60000, true); await h.flush();
  check(h.state.currentEstimate, true, "Hidden views defer their cosmetic clock");
  h.document.visibilityState = "visible"; h.document.dispatchEvent({ type: "visibilitychange" }); await h.flush();
  check(h.state.currentEstimate, false, "Returning to an expired target immediately withholds current likelihood");
  check(h.state.analysis.gain.probability, null); check(h.state.analysis.stance, "insufficient");
  h.unmount(); check(h.document.listenerCount(), 0); check(h.window.listenerCount(), 0); check(h.timers.size, 0);
});

function researchOnly(h, symbol = "MSFT", runId = "only-MSFT") {
  const original = canonical(h);
  return { schemaVersion: "slice-research-only-bundle-1.0.0", id: `saved-${runId}`, symbol, researchRunId: runId,
    generatedAt: iso, classification: "research-only-no-forecast", score: { ...original.score, confidence: 21 }, market: original.market,
    currentResearch: { symbol, publication: "research-only", discoveredNewsCount: 2, scoredNewsCount: 0 }, warnings: [] };
}

for (const path of [OUTCOMES, FORECAST]) {
  await test(`${path === OUTCOMES ? "graph outcomes" : "forecast"}: a research-only run clears the previous forecast and retains its own score`, async () => {
    const props = { symbol: "MSFT", runId: "run-MSFT", researchRunId: "run-MSFT" };
    const h = harness(path, { props }); h.render(); if (path === FORECAST) h.fire(180);
    h.next("GET", "/api/intelligence/canonical").resolve({ bundle: canonical(h), researchOnly: null }); await h.flush();
    check(h.state.analysis.gain.probability, 68);
    props.runId = "only-MSFT"; props.researchRunId = "only-MSFT"; h.render();
    check(h.state.analysis, null, "Old forecast is not displayed under a new run identity");
    if (path === FORECAST) h.fire(180);
    const current = researchOnly(h);
    h.next("GET", "/api/intelligence/canonical").resolve({ bundle: null, researchOnly: current }); await h.flush();
    check(h.state.bundle, null); check(h.state.researchOnly.researchRunId, "only-MSFT");
    check(h.state.analysis.confidence, 21); check(h.state.analysis.stance, "insufficient");
    check(h.state.analysis.gain.probability, null); check(h.state.analysis.gain.storedProbability, null);
    check(h.state.analysis.gain.targetAt, null); check(h.state.analysis.currentResearch.scoredNewsCount, 0);
    check(h.state.error, ""); h.unmount(); check(h.lateWrites(), 0);
  });

  await test(`${path === OUTCOMES ? "graph outcomes" : "forecast"}: a mismatched research-only response is rejected`, async () => {
    const h = harness(path, { props: { symbol: "MSFT", runId: "only-MSFT", researchRunId: "only-MSFT" } });
    h.render(); if (path === FORECAST) h.fire(180);
    h.next("GET", "/api/intelligence/canonical").resolve({ bundle: null, researchOnly: researchOnly(h, "NVDA", "only-NVDA") }); await h.flush();
    check(h.state.researchOnly, null); check(h.state.analysis, null);
    yes(h.state.error.includes("does not match"), "Run and symbol mismatch is reported instead of mixing research contexts");
    h.unmount();
  });

  await test(`${path === OUTCOMES ? "graph outcomes" : "forecast"}: conflicting publication states fail closed`, async () => {
    const h = harness(path, { props: { symbol: "MSFT", runId: "run-MSFT", researchRunId: "run-MSFT" } });
    h.render(); if (path === FORECAST) h.fire(180);
    h.next("GET", "/api/intelligence/canonical").resolve({ bundle: canonical(h), researchOnly: researchOnly(h, "MSFT", "run-MSFT") }); await h.flush();
    check(h.state.analysis, null); yes(h.state.error.includes("conflicting publication states")); h.unmount();
  });
}

await test("forecast: generation can save a research-only result and navigate to its exact run", async () => {
  const props = { symbol: "MSFT", researchRunId: "run-MSFT" };
  const h = harness(FORECAST, { props }); h.render(); h.fire(180);
  h.next("GET", "/api/intelligence/canonical").resolve({ bundle: canonical(h), researchOnly: null }); await h.flush();
  const work = h.actions.generate();
  h.next("POST", "/api/intelligence/canonical").resolve({ bundle: null, researchOnly: researchOnly(h) }); await work; await h.flush();
  check(new URL(h.window.location.href).searchParams.get("researchRunId"), "only-MSFT");
  check(h.state.bundle, null); check(h.state.error, ""); check(h.state.busy, false);
  props.researchRunId = "only-MSFT"; h.render(); h.fire(180);
  h.next("GET", "/api/intelligence/canonical").resolve({ bundle: null, researchOnly: researchOnly(h) }); await h.flush();
  check(h.state.analysis.gain.probability, null); check(h.state.analysis.researchOnly, true); h.unmount();
});

await test("forecast: a late generation cannot overwrite a later instrument selection", async () => {
  const props = { symbol: "MSFT", researchRunId: "run-MSFT" };
  const h = harness(FORECAST, { props }); h.render(); h.fire(180);
  h.next("GET", "/api/intelligence/canonical").resolve({ bundle: canonical(h), researchOnly: null }); await h.flush();
  const work = h.actions.generate(), pending = h.next("POST", "/api/intelligence/canonical");
  props.symbol = "NVDA"; props.researchRunId = "only-NVDA"; h.render();
  yes(pending.init.signal.aborted, "Selection cleanup aborts the obsolete generation request");
  h.fire(180); h.next("GET", "/api/intelligence/canonical").resolve({ bundle: null, researchOnly: researchOnly(h, "NVDA", "only-NVDA") }); await h.flush();
  const historyCount = h.historyWrites.length;
  pending.resolve({ bundle: null, researchOnly: researchOnly(h) }); await work; await h.flush();
  check(h.state.analysis.symbol, "NVDA"); check(h.state.researchOnly.researchRunId, "only-NVDA");
  check(h.historyWrites.length, historyCount, "A response that ignores abort cannot navigate back to its obsolete run");
  check(h.state.error, ""); h.unmount();
});

await test("forecast: generation teardown prevents late writes and navigation", async () => {
  const h = harness(FORECAST, { props: { symbol: "MSFT" } }); h.render();
  const work = h.actions.generate(), pending = h.next("POST", "/api/intelligence/canonical");
  h.unmount(); yes(pending.init.signal.aborted);
  pending.resolve({ bundle: null, researchOnly: researchOnly(h) }); await work; await h.flush();
  check(h.lateWrites(), 0); check(h.historyWrites.length, 0); check(h.timers.size, 0);
});

if (failures.length) throw new AggregateError(failures, `${failures.length} research lifecycle scenario(s) failed`);
console.log(`Research lifecycle checks passed (${scenarios} scenarios, ${assertions} assertions): actual parent handlers, request ownership, exact run context, cancellation races, permanent missing-job exits, body aborts, horizon links, and visibility freshness.`);
