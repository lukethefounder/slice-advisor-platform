import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

// Render the real React views. Execute the real client handlers with a controlled
// hook scheduler and transports that deliberately ignore cancellation signals.
const require = createRequire(import.meta.url), ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const repo = fileURLToPath(new URL("../..", import.meta.url));
const CONTROLLER = "src/components/intelligence/agent-desk.tsx";
const VIEW = "src/components/intelligence/agent-desk-view.tsx";
const ENDPOINT = "/api/intelligence/agent-desk", compiled = new Map(), modules = new Map();
let assertions = 0, scenarios = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
const flush = () => new Promise(done => setImmediate(done));
function compile(path) {
  if (!compiled.has(path)) {
    const result = ts.transpileModule(readFileSync(resolve(repo, path), "utf8"), { fileName: path, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`);
    compiled.set(path, result.outputText);
  }
  return compiled.get(path);
}
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const imports = specifier => {
    if (specifier === "./agent-collaboration" || specifier === "@/components/agent-broker/broker-proposal-approval") return { __esModule: true, default: () => null };
    if (specifier.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
    const files = {
      "@/lib/agent-desk/contracts": "src/lib/agent-desk/contracts.ts",
      "@/lib/intelligence/research-evidence": "src/lib/intelligence/research-evidence.ts",
      "@/lib/intelligence/score-interpretation": "src/lib/intelligence/score-interpretation.ts",
      "@/lib/workspace-green-core": "src/lib/workspace-green-core.ts",
      "./intelligence-ui": "src/components/intelligence/intelligence-ui.tsx",
      "./score-decision-panel": "src/components/intelligence/score-decision-panel.tsx",
      "./agent-operations-view": "src/components/intelligence/agent-operations-view.tsx",
      "./agent-market-stream": "src/components/intelligence/agent-market-stream.tsx",
    };
    return files[specifier] ? load(files[specifier]) : require(specifier);
  };
  new Function("require", "module", "exports", compile(path))(imports, module, module.exports);
  return module.exports;
}
const { DEFAULT_DESK_POLICY, DEFAULT_DESK_CONTROLS, createPaperAccount } = load("src/lib/agent-desk/guardrails.ts");
const { AGENT_ROLES } = load("src/lib/agent-desk/contracts.ts");
const view = load(VIEW), now = "2026-11-18T18:00:00.000Z";
const copy = value => JSON.parse(JSON.stringify(value));
function desk(overrides = {}) {
  return { version: 1, revision: 1, settings: { symbol: "MSFT", intervalMinutes: 10, initialCapital: 100000, policy: copy(DEFAULT_DESK_POLICY) },
    controls: copy(DEFAULT_DESK_CONTROLS), account: createPaperAccount({ initialCapital: 100000, now }),
    executionMode: "paper", liveExecutionAvailable: false, providers: { ai: "configured-unverified", market: "configured-unverified", model: "recorded-model" },
    busy: null, latestCycle: null, history: [], nextRunAt: null, lastError: null, updatedAt: now,
    worker: { requiredForAutonomy: true, command: "npm run beta:worker", lastCheckedAt: null }, ...overrides };
}
const source = (id, overrides = {}) => ({ id, title: `Source ${id}`, summary: `Observed record ${id}`, source: "Original Publisher", url: `https://example.org/${id}?apikey=do-not-expose&utm_source=tracking`, observedAt: "2026-11-18T17:55:00Z", retrievedAt: now, kind: "scored-evidence", cohort: "media", metrics: { price: 100, missing: null }, ...overrides });
const finding = (role, overrides = {}) => ({ role, status: "complete", stance: "neutral", summary: `${role} recorded reasoning`, findings: [{ claim: "Recorded and attributed observation", evidenceIds: ["source-a"] }], risks: ["Observed uncertainty"], missingData: [], veto: false, action: "hold", allocationPct: null, model: "recorded-model", requestId: "actual-request", startedAt: now, completedAt: now, error: null, ...overrides });
const cycle = (overrides = {}) => ({ version: 1, id: "cycle-one", symbol: "MSFT", status: "blocked", startedAt: now, completedAt: now, settingsRevision: 1, researchRunId: "research-one", researchScore: { confidence: 21, quality: { evidenceCoverage: 25 } }, currentResearch: null, agents: AGENT_ROLES.map(role => finding(role)), evidence: [source("source-a")], proposal: { action: "hold", symbol: "MSFT", referencePrice: 100, allocationPct: null, rationale: "The recorded evidence is insufficient." }, decision: { status: "blocked", code: "LOW_CONFIDENCE", message: "Insufficient evidence blocks new exposure.", reasons: ["Research confidence 21 is below the saved 40-point floor."], action: "hold", protective: false, cycleId: "cycle-one", checkedAt: now, sequence: 0 }, fill: null, errors: [], sourceHash: "recorded-hash", equity: 100000, unrealizedPnl: 0, mode: "paper", executionStatus: "blocked", ...overrides });
const busy = { cycleId: "pending-cycle", jobId: "job-real", startedAt: now, expiresAt: "2026-11-18T18:15:00Z", stage: "Reading recorded evidence", progress: 32 };
function props(value = desk(), overrides = {}) {
  return { desk: value, draft: value?.settings ?? null, symbolsText: value?.settings.policy.allowedSymbols.join(", ") ?? "", scoutUniverseText: value?.settings.scouting?.universe.join(", ") ?? "", dirty: false, conflict: false, loading: false, pending: null, error: "", message: "", incomingSymbol: null,
    onAction() {}, onReload() {}, onDiscard() {}, onSave() {}, onDraft() {}, onSymbols() {}, onScoutUniverse() {}, onUseIncoming() {}, ...overrides };
}
const html = (value, overrides) => renderToStaticMarkup(React.createElement(view.default, props(value, overrides)));
function button(markup, label) {
  const match = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(row => row[0]).find(row => row.replace(/<[^>]*>/g, "").includes(label));
  yes(match, `Button '${label}' is present`); return match;
}
const failures = [];
async function test(name, run) {
  try { await run(); scenarios++; }
  catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); }
}

await test("Empty account renders all six roles without simulated findings", () => {
  const rendered = html(desk());
  for (const role of AGENT_ROLES) yes(rendered.includes(`data-role="${role}"`));
  check((rendered.match(/class="roleStatus">Not run<\/span>/g) ?? []).length, 6);
  yes(rendered.includes("Broker connection &amp; permissions"));
  yes(rendered.includes("This ledger records local paper fills"));
  yes(rendered.includes("Paper account · simulated fills"));
  yes(rendered.includes("No cycles recorded yet"));
  yes(rendered.includes("No open paper position"));
  yes(!rendered.includes("recorded reasoning"));
  yes(rendered.includes("npm run beta:worker"));
  yes(!/disabled/.test(button(rendered, "Analyze MSFT now")));
  yes(rendered.includes("not six independent data sources or a calibrated probability of profit"));
});

await test("Source links and role findings use only the recorded cycle evidence", () => {
  const recorded = cycle({ evidence: [source("source-a"), source("discovery", { kind: "public-discovery" }), source("execution", { kind: "execution-reference" }), source("unsafe", { url: "javascript:alert(1)", title: "<script>alert('unsafe')</script>" })], agents: [finding("chief", { findings: [{ claim: "<script>injected()</script>", evidenceIds: ["source-a", "execution", "unknown-id"] }], toolCalls: [{ tool: "inspect_evidence", evidenceIds: ["source-a"], at: now }] }), finding("skeptic", { status: "failed", veto: true, error: "Provider unavailable", summary: "", action: "buy" })] });
  const rendered = html(desk({ latestCycle: recorded, history: [recorded] }));
  yes(rendered.includes('href="https://example.org/source-a"'));
  yes(!rendered.includes("do-not-expose")); yes(!rendered.includes("utm_source"));
  yes(!rendered.includes('href="javascript:'));
  yes(!rendered.includes("<script>")); yes(rendered.includes("&lt;script&gt;injected()&lt;/script&gt;"));
  yes(rendered.includes("Source unavailable in this recorded cycle"));
  yes(rendered.includes("Public discovery · unscored"));
  check((rendered.match(/Execution reference · unscored/g) ?? []).length, 2, "Execution price is unscored in both source records and agent citations");
  yes(rendered.includes("Provider unavailable")); yes(rendered.includes("No executable proposal"));
  yes(rendered.includes("Veto · new exposure blocked"));
  yes(rendered.includes("21.0 / 100")); yes(rendered.includes("40 / 100"));
  yes(rendered.includes("researchRunId=research-one")); yes(rendered.includes("symbol=MSFT"));
  yes(rendered.includes("inspect_evidence · 1 referenced records"));
  yes(rendered.includes("Nov 18, 2026, 12:55 PM ET"));
  yes(rendered.includes("Recorded inputs")); yes(rendered.includes("Unavailable"));
  yes(!rendered.includes("Approve this paper proposal"));
});

await test("Pending work still permits emergency stop and pause", () => {
  const value = desk({ controls: { armed: true, autonomous: true, paused: false, killSwitch: false }, busy });
  const rendered = html(value, { pending: "cycle", error: "A refresh is delayed", dirty: true });
  yes(/disabled/.test(button(rendered, "Cycle in progress")));
  yes(!/disabled/.test(button(rendered, "Pause new entries")));
  yes(!/disabled/.test(button(rendered, "Stop desk &amp; new broker entries")));
  yes(rendered.includes("Reading recorded evidence"));
  yes(rendered.includes('value="32"'));
  yes(rendered.includes("last completed cycle until the new results are saved"));
  yes(rendered.includes("stops all local simulated fills and revokes new broker entries"));
  yes(rendered.includes("Broker-native protective orders"));
  yes(rendered.includes("broker risk monitoring and reconciliation remain active"));
  yes(rendered.includes("Neither control liquidates positions"));
  yes(rendered.includes("Your trade briefs"));
});

await test("A later protective check retains the last actual six-agent research with explicit dates", () => {
  const prior = cycle(), protection = cycle({ id: "protective-check", completedAt: "2026-11-18T18:05:00Z", researchRunId: null, researchScore: null, agents: [], evidence: [], proposal: null, decision: { ...prior.decision, protective: true, message: "Protective exit is waiting for a usable observation." } });
  const rendered = html(desk({ latestCycle: protection, history: [protection, prior] }));
  yes(rendered.includes("Protective exit is waiting for a usable observation."));
  yes(rendered.includes("protective check did not produce new agent research"));
  yes(rendered.includes("chief recorded reasoning")); yes(rendered.includes("charts recorded reasoning"));
  check((rendered.match(/class="roleStatus">Not run<\/span>/g) ?? []).length, 0);
  yes(rendered.includes("researchRunId=research-one"));
  yes(rendered.includes("records available to the MSFT AI cycle from Nov 18, 2026, 1:00 PM ET"));
});

await test("Observed price audit preserves distinct AI and execution prices, original times, and quality", () => {
  const contextQuote = { symbol: "MSFT", price: 101.123456, observedAt: "2026-11-18T17:55:00.000Z", retrievedAt: "2026-11-18T17:55:23.400Z", marketOpen: true, realTimeConfirmed: true, instrumentKind: "equity", currency: "USD", sourceKind: "intraday-bar" };
  const executionQuote = { ...contextQuote, price: 102.987654, observedAt: "2026-11-18T17:59:00.000Z", retrievedAt: "2026-11-18T18:00:02.750Z", realTimeConfirmed: false, marketOpen: false };
  const recorded = cycle({ contextQuote, executionQuote, sourceHash: "provider-source-hash" }), before = JSON.stringify(recorded);
  const rendered = html(desk({ latestCycle: recorded, history: [recorded] }));
  for (const text of ["Observed price audit", "Before AI deliberation", "At execution check", "USD 101.123456", "USD 102.987654", contextQuote.observedAt, contextQuote.retrievedAt, executionQuote.observedAt, executionQuote.retrievedAt, "Confirmed by provider", "Not confirmed", "Open in the recorded check", "Closed or not confirmed open", "Intraday bar", "provider-source-hash", "not an executable bid/ask quote"])
    yes(rendered.includes(text), `The audit exposes ${text}`);
  check(JSON.stringify(recorded), before, "Reading an audit never replaces its recorded market prices or dates");
  const legacy = renderToStaticMarkup(React.createElement(view.ObservedPriceAudit, { cycle: cycle() }));
  yes(legacy.includes("No separate context or execution quote was recorded"));
  yes(legacy.includes("A current price is not substituted into an older decision"));
  const onlyExecution = renderToStaticMarkup(React.createElement(view.ObservedPriceAudit, { cycle: cycle({ contextQuote: null, executionQuote }) }));
  yes(onlyExecution.includes("Not recorded")); yes(!onlyExecution.includes("101.123456"));
});

await test("Approvals require manual armed state and cannot ignore unsaved edits", () => {
  const value = desk({ latestCycle: cycle({ executionStatus: "awaiting-approval" }) });
  yes(/disabled/.test(button(html(value), "Approve this paper proposal")));
  value.controls = { armed: true, autonomous: false, paused: false, killSwitch: false };
  yes(!/disabled/.test(button(html(value), "Approve this paper proposal")));
  yes(/disabled/.test(button(html(value, { dirty: true }), "Approve this paper proposal")));
  yes(/disabled/.test(button(html(value, { loading: true }), "Approve this paper proposal")));
  value.controls.killSwitch = true;
  yes(/disabled/.test(button(html(value), "Approve this paper proposal")));
  yes(html(value).includes("Resume desk · autonomy stays off"));
  value.controls.killSwitch = false; value.controls.paused = true;
  yes(!/disabled/.test(button(html(value), "Enable manual paper approvals")), "Paused manual accounts can be explicitly re-armed without enabling autonomy");
  value.controls.paused = false; value.revision = 2;
  yes(/disabled/.test(button(html(value), "Approve this paper proposal")));
  yes(html(value).includes("Run a new research cycle before approving an order"));
});

await test("Safeguards retain minimum evidence quality and honest execution limits", () => {
  const value = desk(), rendered = html(value);
  yes(rendered.includes('min="40" max="100"'));
  yes(rendered.includes("Cannot go below the platform’s 40-point evidence standard"));
  yes(rendered.includes("Confirmed") === false); // A configured key is never claimed as a verified provider.
  yes(rendered.includes("Native indices remain research-only"));
  yes(rendered.includes("An open position keeps the exit rules recorded when it was entered"));
  yes(rendered.includes("gaps, missed observations, and costs"));
  value.account.position = { symbol: "MSFT", quantity: 10, averageEntry: 100, entryFees: 1, openedAt: now, sessionDate: "2026-11-18", peakPrice: 105, stopLossPct: 1, takeProfitPct: 2, trailingStopPct: null, maxHoldingMinutes: 90, flattenBeforeCloseMinutes: 5 };
  value.account.lastFillAt = now; value.account.lastObservedPrice = 105; value.account.lastObservedAt = now; value.account.cash = 98999;
  value.latestCycle = cycle({ equity: 0, unrealizedPnl: -999 });
  const held = html(value);
  yes(/<input\b(?=[^>]*value="MSFT")(?=[^>]*disabled="")[^>]*>/.test(held));
  yes(/<input\b(?=[^>]*value="100000")(?=[^>]*disabled="")[^>]*>/.test(held));
  yes(held.includes("$100,049.00"), "Paper equity follows the latest recorded account mark, not an older cycle mark");
  yes(held.includes("$49.00")); yes(!held.includes("-$999.00"));
  value.providers.ai = "missing";
  yes(/disabled/.test(button(html(value), "Analyze MSFT now")));
  yes(/disabled/.test(button(html(desk({ providers: { ai: "missing", market: "configured-unverified", model: "recorded-model" } })), "Scan candidates now")));
  yes(!html(value).includes('type="password"'));
});

await test("Workspace navigation resolves the new desk without activating two tools", () => {
  const nav = load("src/lib/workspace/navigation.ts"), path = "/workspace/intelligence/agent-desk";
  check(nav.workspaceRouteMeta(path).label, "Six-Agent Trading Desk");
  check(nav.workspaceToolIsActive(path, path), true);
  check(nav.workspaceToolIsActive(path, "/workspace/intelligence"), false);
  check(nav.workspaceToolIsActive("/workspace/intelligence/knowledge-graph", "/workspace/intelligence"), true);
  check(nav.workspaceBreadcrumbs(path).map(item => item.label), ["Workspace", "Intelligence", "Six-Agent Trading Desk"]);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function events() {
  const listeners = new Map();
  return { addEventListener(type, listener) { const group = listeners.get(type) ?? new Set(); group.add(listener); listeners.set(type, group); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) { for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event); },
    count() { return [...listeners.values()].reduce((sum, group) => sum + group.size, 0); } };
}
function hookDriver() {
  const slots = []; let cursor = 0, dirty = true, pending = [], disposed = false, lateWrites = 0;
  const changed = (left, right) => !left || !right || left.length !== right.length || left.some((value, index) => !Object.is(value, right[index]));
  return {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial }; return [slots[index].value, next => { if (disposed) { lateWrites++; return; } const value = typeof next === "function" ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useMemo(callback, dependencies) { const index = cursor++; if (!slots[index] || changed(slots[index].dependencies, dependencies)) slots[index] = { value: callback(), dependencies }; return slots[index].value; },
    useEffect(callback, dependencies) { const index = cursor++; if (!slots[index] || changed(slots[index].dependencies, dependencies)) { const previous = slots[index]; slots[index] = { dependencies, callback, cleanup: previous?.cleanup }; pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); }); } },
    render(component) { if (disposed) return; let result, turns = 0; do { cursor = 0; dirty = false; pending = []; result = component(); for (const effect of pending) effect(); if (++turns > 30) throw new Error("Hook fixture did not settle"); } while (dirty); return result; },
    strictReplay() { for (const slot of slots) if (slot.callback) { slot.cleanup?.(); slot.cleanup = slot.callback(); } },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); }, lateWrites: () => lateWrites,
  };
}
function harness(options = {}) {
  const driver = hookDriver(), timers = new Map(), requests = [], document = { ...events(), visibilityState: "visible" }, navigator = { onLine: true };
  let counter = 0, tree = null, session = { loading: false, user: { id: "owner-one" }, firm: { id: "firm-one" }, role: "Founder", agentDeskFounder: true, error: "" };
  const window = { ...events(), location: new URL(options.url ?? "https://slice.example/workspace/intelligence/agent-desk"), setTimeout(callback, delay) { const id = ++counter; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  const request = (url, init, options) => { const waiting = deferred(), item = { ...waiting, url, init, options, taken: false }; requests.push(item); return waiting.promise; };
  const context = createContext({ console, window, document, navigator, URL, URLSearchParams, AbortController, Error, Number, JSON });
  const module = { exports: {} }, stub = function Stub() {};
  const imports = specifier => {
    if (specifier === "react") return { ...driver, useCallback: (callback, dependencies) => driver.useMemo(() => callback, dependencies) };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
    if (specifier === "@/lib/intelligence/client") return { intelligenceFetch: request, isAbortError: error => error?.name === "AbortError" };
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => session };
    if (specifier === "@/lib/agent-desk/contracts") return load("src/lib/agent-desk/contracts.ts");
    if (specifier === "./intelligence-ui") return { IntelligencePage: stub };
    return { __esModule: true, default: stub };
  };
  runInContext(`(function(require,module,exports){${compile(CONTROLLER)}\n})`, context, { filename: CONTROLLER })(imports, module, module.exports);
  const h = { window, document, navigator, requests, timers,
    get props() { return tree.props; }, get tree() { return tree; },
    render() { tree = driver.render(() => module.exports.AgentDeskWorkspace()); return tree; },
    async flush() { await flush(); h.render(); await flush(); h.render(); },
    next(method = "GET") { const found = requests.find(item => !item.taken && (item.init?.method ?? "GET") === method); yes(found, `Expected ${method} request`); found.taken = true; check(found.url, ENDPOINT); return found; },
    fire(delay) { const found = [...timers].find(([, value]) => value.delay === delay); yes(found, `Expected ${delay}ms poll`); timers.delete(found[0]); return found[1].callback(); },
    strictReplay() { driver.strictReplay(); h.render(); }, unmount() { driver.unmount(); }, lateWrites: driver.lateWrites,
    owner(next) { session = next; return module.exports.default(); },
  };
  h.render(); return h;
}
async function ready(value = desk(), options) { const h = harness(options); h.next().resolve({ ok: true, desk: value }); await h.flush(); return h; }
async function refresh(h, next) { h.props.onReload(); h.render(); h.next().resolve({ ok: true, desk: next }); await h.flush(); }

await test("Polling follows saved job status and pauses hidden/offline requests", async () => {
  const h = await ready();
  check(h.props.desk.revision, 1); check(h.props.loading, false); check(h.timers.size, 1);
  const tick = h.fire(20000), request = h.next();
  h.document.dispatchEvent({ type: "visibilitychange" }); check(h.requests.length, 2, "Visibility wake cannot overlap a read");
  request.resolve({ ok: true, desk: desk({ busy }) }); await tick; await h.flush(); check(h.timers.size, 1);
  const quick = h.fire(5000); h.next().resolve({ ok: true, desk: desk({ busy: null }) }); await quick; await h.flush();
  h.document.visibilityState = "hidden"; const count = h.requests.length; await h.fire(20000); check(h.requests.length, count);
  h.document.visibilityState = "visible"; h.navigator.onLine = false; await h.fire(20000); check(h.requests.length, count);
  h.navigator.onLine = true; h.window.dispatchEvent({ type: "online" });
  h.next().resolve({ ok: true, desk: desk() }); await h.flush();
  h.unmount(); check(h.timers.size, 0); check(h.window.count() + h.document.count(), 0);
});

await test("Draft safeguards survive polling and controls-only revisions", async () => {
  const h = await ready();
  h.props.onDraft(value => ({ ...value, intervalMinutes: 17 })); h.render(); check(h.props.dirty, true);
  const control = desk({ revision: 2, controls: { armed: true, autonomous: false, paused: true, killSwitch: false } });
  await refresh(h, control); check(h.props.draft.intervalMinutes, 17); check(h.props.conflict, false);
  h.props.onSave(); h.render(); const write = h.next("POST"), command = JSON.parse(write.init.body);
  check(command.action, "settings"); check(command.revision, 2); check(command.settings.intervalMinutes, 17); check(write.options.retries, 0);
  const saved = desk({ revision: 3, settings: command.settings }); write.resolve({ ok: true, desk: saved }); await h.flush();
  check(h.props.dirty, false); check(h.props.draft.intervalMinutes, 17); h.next().resolve({ ok: true, desk: saved }); await h.flush(); h.unmount();
});

await test("A conflicting saved policy preserves the draft and prevents overwrite", async () => {
  const h = await ready(); h.props.onDraft(value => ({ ...value, intervalMinutes: 17 })); h.render();
  const remote = desk(); remote.revision = 3; remote.settings.intervalMinutes = 30;
  await refresh(h, remote); check(h.props.conflict, true); check(h.props.draft.intervalMinutes, 17);
  const count = h.requests.length; h.props.onSave(); check(h.requests.length, count);
  h.props.onDiscard(); h.render(); check(h.props.conflict, false); check(h.props.dirty, false); check(h.props.draft.intervalMinutes, 30); h.unmount();
});

await test("Incoming research selects a draft without silently authorizing trading", async () => {
  const h = await ready(desk(), { url: "https://slice.example/workspace/intelligence/agent-desk?symbol=SPY" });
  check(h.props.incomingSymbol, "SPY"); check(h.props.desk.settings.symbol, "MSFT");
  h.props.onUseIncoming(); h.render(); check(h.props.draft.symbol, "SPY"); check(h.props.dirty, true); check(h.props.incomingSymbol, null);
  h.props.onAction("enable"); check(h.requests.length, 1, "An unsaved policy cannot enable autonomy"); h.unmount();
});

await test("Explicit index research preserves its identity and never joins the equity allowlist", async () => {
  const h = await ready(desk(), { url: "https://slice.example/workspace/intelligence/agent-desk?symbol=INDEX%3ASPX" });
  check(h.props.incomingSymbol, "INDEX:SPX"); h.props.onUseIncoming(); h.render();
  check(h.props.draft.symbol, "INDEX:SPX"); yes(!h.props.draft.policy.allowedSymbols.includes("INDEX:SPX"));
  h.props.onSave(); h.render(); const request = h.next("POST"), command = JSON.parse(request.init.body);
  check(command.settings.symbol, "INDEX:SPX"); yes(!command.settings.policy.allowedSymbols.includes("INDEX:SPX"));
  h.unmount(); request.resolve({ ok: true, desk: desk({ settings: command.settings }) }); await flush(); check(h.lateWrites(), 0);
});

await test("Enable is explicitly paper-only and an emergency kill fences its late completion", async () => {
  const h = await ready(); h.props.onAction("enable"); h.render(); const enable = h.next("POST");
  check(JSON.parse(enable.init.body), { action: "enable", revision: 1, paperOnly: true });
  h.props.onAction("enable"); check(h.requests.length, 2, "Double-clicks do not send duplicate execution mutations");
  h.props.onAction("kill"); h.render(); const kill = h.next("POST"); yes(enable.init.signal.aborted);
  check(JSON.parse(kill.init.body), { action: "kill", revision: 1 });
  const stopped = desk({ revision: 3, controls: { armed: false, autonomous: false, paused: true, killSwitch: true } });
  kill.resolve({ ok: true, desk: stopped }); await h.flush();
  h.next().resolve({ ok: true, desk: stopped }); await h.flush();
  enable.resolve({ ok: true, desk: desk({ revision: 2, controls: { armed: true, autonomous: true, paused: false, killSwitch: false } }) }); await h.flush();
  check(h.props.desk.controls.killSwitch, true); check(h.props.desk.controls.autonomous, false); check(h.props.pending, null); h.unmount();
});

await test("Busy emergency pause is sent and cycle queues switch to fast polling", async () => {
  const active = desk({ controls: { armed: true, autonomous: true, paused: false, killSwitch: false } });
  const h = await ready(active); h.props.onAction("cycle"); h.render(); const start = h.next("POST");
  check(JSON.parse(start.init.body), { action: "cycle", revision: 1 });
  const working = { ...active, busy }; start.resolve({ ok: true, desk: working }); await h.flush();
  yes([...h.timers.values()].some(timer => timer.delay === 5000));
  const oldRead = h.next(); h.props.onAction("pause"); h.render(); yes(oldRead.init.signal.aborted);
  const pause = h.next("POST"); check(JSON.parse(pause.init.body).action, "pause");
  const paused = desk({ revision: 2, controls: { armed: true, autonomous: false, paused: true, killSwitch: false } });
  pause.resolve({ ok: true, desk: paused }); await h.flush(); h.next().resolve({ ok: true, desk: paused }); await h.flush();
  oldRead.resolve({ ok: true, desk: working }); await h.flush(); check(h.props.desk.busy, null); check(h.props.desk.controls.paused, true); h.unmount();
});

await test("Manual approval pins the actual cycle and accepts the checked result", async () => {
  const proposal = cycle({ executionStatus: "awaiting-approval" });
  const h = await ready(desk({ latestCycle: proposal, controls: { armed: true, autonomous: false, paused: false, killSwitch: false } }));
  h.props.onAction("approve"); h.render(); const approval = h.next("POST");
  check(JSON.parse(approval.init.body), { action: "approve", revision: 1, cycleId: "cycle-one", paperOnly: true });
  approval.resolve({ ok: true, desk: desk({ latestCycle: cycle({ executionStatus: "blocked" }) }) }); await h.flush();
  h.next().resolve({ ok: true, desk: desk({ latestCycle: cycle({ executionStatus: "blocked" }) }) }); await h.flush();
  const count = h.requests.length; h.props.onAction("approve"); check(h.requests.length, count); check(h.props.desk.latestCycle.executionStatus, "blocked"); h.unmount();
});

await test("Reload fences an earlier read and recovers from mutation errors", async () => {
  const h = await ready(); h.props.onAction("arm"); h.render(); const write = h.next("POST");
  write.reject(Object.assign(new Error("Policy revision changed; reload before retrying."), { status: 409 })); await h.flush();
  const oldRead = h.next(); yes(h.props.error.includes("revision changed"));
  h.props.onReload(); h.render(); const fresh = h.next(); yes(oldRead.init.signal.aborted);
  fresh.resolve({ ok: true, desk: desk({ revision: 3 }) }); await h.flush(); check(h.props.error, ""); check(h.props.loading, false);
  oldRead.resolve({ ok: true, desk: desk({ revision: 1 }) }); await h.flush(); check(h.props.desk.revision, 3); h.unmount();
});

for (const method of ["GET", "POST"]) await test(`${method} authorization failure clears private account and unsaved policy`, async () => {
  const h = await ready();
  if (method === "POST") h.props.onAction("arm"); else h.props.onReload();
  h.render(); h.next(method).reject(Object.assign(new Error("Forbidden"), { status: 403 })); await h.flush();
  check(h.props.desk, null); check(h.props.draft, null); check(h.props.pending, null); check(h.props.dirty, false);
  yes(h.props.error.includes("Access to this private desk has changed"));
  const count = h.requests.length; h.window.dispatchEvent({ type: "online" }); await h.flush(); check(h.requests.length, count); h.unmount();
});

await test("Session end fences late mutations and erases the recorded account", async () => {
  const h = await ready(); h.props.onAction("enable"); h.render(); const write = h.next("POST");
  h.window.dispatchEvent({ type: "slice-session-ended" }); h.render(); yes(write.init.signal.aborted);
  write.resolve({ ok: true, desk: desk({ revision: 9 }) }); await h.flush();
  check(h.props.desk, null); check(h.props.draft, null); check(h.props.pending, null); yes(h.props.error.includes("session ended"));
  check(h.timers.size, 0); h.unmount(); check(h.lateWrites(), 0);
});

await test("Strict Mode starts a replacement read and leaves only one polling timer", async () => {
  const h = harness(), abandoned = h.next(); h.strictReplay(); const current = h.next();
  yes(abandoned.init.signal.aborted); current.resolve({ ok: true, desk: desk({ revision: 2 }) }); await h.flush();
  abandoned.resolve({ ok: true, desk: desk({ revision: 1 }) }); await h.flush();
  check(h.props.desk.revision, 2); check(h.timers.size, 1); h.unmount();
});

await test("Unmount fences late requests and signed-in ownership changes the workspace key", async () => {
  const h = harness(), pending = h.next();
  const owner = { loading: false, user: { id: "a" }, firm: { id: "firm" }, role: "Member", agentDeskFounder: true, error: "" };
  check(h.owner(owner).key, "a:firm"); check(h.owner({ ...owner, user: { id: "b" } }).key, "b:firm");
  check(h.owner({ ...owner, user: null }).props.children.props.role, "alert");
  check(h.owner({ ...owner, role: "Founder", agentDeskFounder: false }).props.children.props.role, "alert", "A founder role label does not grant access without server permission");
  check(h.owner({ ...owner, agentDeskFounder: undefined }).props.children.props.role, "alert", "Missing server permission fails closed");
  h.unmount(); pending.resolve({ ok: true, desk: desk() }); await flush(); await flush();
  check(h.lateWrites(), 0); check(h.timers.size, 0); check(h.window.count() + h.document.count(), 0);
});

await test("Unsupported live account responses are rejected before controls become available", async () => {
  const h = harness(); h.next().resolve({ ok: true, desk: desk({ executionMode: "live", liveExecutionAvailable: true }) }); await h.flush();
  check(h.props.desk, null); yes(h.props.error.includes("incomplete or unsupported"));
  h.props.onAction("enable"); check(h.requests.length, 1); h.unmount();
});

await test("Scout commands queue exact revision and poll recorded discovery jobs", async () => {
  const h = await ready(); h.props.onAction("scout"); h.render();
  const request = h.next("POST"); check(JSON.parse(request.init.body), { action: "scout", revision: 1 });
  request.resolve({ ok: true, desk: desk({ revision: 2, scouting: { lastScanAt: null, nextScanAt: null, busy: { jobId: "scan-job", startedAt: now }, lastError: null, discovery: null } }) }); await h.flush();
  check(h.props.desk.scouting.busy.jobId, "scan-job"); yes(h.props.message.includes("allowlist are unchanged") || h.props.message.includes("allowed trading symbols are unchanged"));
  yes([...h.timers.values()].some(timer => timer.delay === 5000));
  const count = h.requests.length; h.props.onAction("cycle"); h.props.onAction("scout"); check(h.requests.length, count, "Overlapping discovery/research requests are blocked"); h.unmount();
});

await test("Scout settings preserve unparsed drafts and keep the trading allowlist separate", async () => {
  const h = await ready(); const before = [...h.props.desk.settings.policy.allowedSymbols];
  h.props.onScoutUniverse("AMD, NVDA, "); h.render(); check(h.props.scoutUniverseText, "AMD, NVDA, "); check(h.props.dirty, true);
  h.props.onDraft(value => ({ ...value, scouting: { ...value.scouting, enabled: true, autoResearch: true, maxCandidates: 5 } })); h.render();
  h.props.onSave(); h.render(); const request = h.next("POST"), body = JSON.parse(request.init.body);
  check(body.settings.scouting.universe, ["AMD", "NVDA"]); check(body.settings.scouting.enabled, true); check(body.settings.scouting.autoResearch, true); check(body.settings.scouting.maxCandidates, 5);
  check(body.settings.policy.allowedSymbols, before, "Discovery grants no additional trading permission");
  request.resolve({ ok: true, desk: desk({ revision: 2, settings: body.settings }) }); await h.flush(); check(h.props.dirty, false); check(h.props.scoutUniverseText, "AMD, NVDA"); h.unmount();
});

await test("Discovery and tool audits show actual timestamps and historical sample limitations", () => {
  const observation = { symbol: "AMD", name: "Observed candidate", rank: 1, reason: "Provider reported unusually high activity.", origins: ["most-active"], observedAt: now, retrievedAt: now, price: 100, changePct: 2, volume: 200000, state: "delayed", source: "Provider", sourceUrl: "https://example.org/candidate?apikey=private", sourceSha256: "recorded-fingerprint", tradableByPolicy: false };
  const sample = { samples: 7, positiveSamples: 4, positiveReturnFrequencyPct: 57.14, meanReturnPct: 1.2, medianReturnPct: 1.1, worstReturnPct: -4, bestReturnPct: 5, wilson95Pct: [25, 84], reliability: "sparse", firstSignalDate: "2020-01-01", lastOutcomeDate: "2026-01-01", observations: [] };
  const tools = { version: 1, symbol: "MSFT", checkedAt: now, economy: { status: "unavailable", snapshot: null, riskAppetite: null, interpretationLimits: ["Market proxy unavailable"] }, charts: { status: "partial", barCount: 200, historyBasis: "Raw daily bars", snapshot: { symbol: "MSFT", asOf: now, session: "delayed", metrics: { "rsi-14": { display: "48.2", source: "Daily history", asOf: now, status: "calculated", detail: "Recorded calculation" } } } }, scenarios: { status: "partial", manifests: [], strategies: [], savedDefinitionsChecked: 0, skippedDefinitions: [], analogues: { method: "Matching trend and volatility", basis: "vendor-adjusted closing returns before trading costs", validationStartDate: "2024-01-01", scenarios: [{ horizonSessions: 20, horizon: "medium", development: { ...sample, samples: 30 }, validation: sample, calibratedForecastProbability: null }], warnings: ["Sparse validation sample"] } }, evidence: [], issues: [{ tool: "economy", message: "Economic dataset unavailable" }] };
  const recorded = cycle({ researchTools: tools });
  const rendered = html(desk({ latestCycle: recorded, history: [recorded], scouting: { lastScanAt: now, nextScanAt: null, busy: null, lastError: null, discovery: { version: 1, checkedAt: now, scannedCount: 3, method: "Observed market activity", candidates: [observation], receipts: [], issues: [], tradingAllowlistChanged: false } } }));
  for (const text of ["Discovery rank 1", "symbol=AMD", 'href="https://example.org/candidate"', "recorded-fingerprint", "delayed", "48.2", "57.1%", "25.0%–84.0%", "Sparse validation sample", "not calibrated probabilities of future profit", "Economic dataset unavailable"]) yes(rendered.includes(text), text);
  yes(!rendered.includes("apikey=private"));
});

await test("Tool provenance opens only allowlisted authenticated strategy ledgers", () => {
  const internal = source("strategy", { kind: "tool-research", url: "/api/strategy-lab/runs?id=run-123_abc" });
  check(view.agentEvidenceHref(internal), "/api/strategy-lab/runs?id=run-123_abc");
  check(view.agentEvidenceHref({ ...internal, url: "/api/strategy-lab/datasets" }), "/api/strategy-lab/datasets");
  for (const url of ["/api/auth/logout", "/api/strategy-lab/runs?id=one&id=two", "/api/strategy-lab/runs?id=one&apikey=private", "/api/strategy-lab/runs?id=..%2Fadmin", "/api/strategy-lab/runs?id=one#fragment", "/api/strategy-lab/datasets?secret=one", "javascript:alert(1)", "//malicious.example/collect"]) yes(!view.agentEvidenceHref({ ...internal, url }), url);
  yes(!view.agentEvidenceHref({ ...internal, kind: "public-discovery" }));
  const recorded = cycle({ evidence: [internal], agents: [finding("skeptic", { findings: [{ claim: "Historical comparison", evidenceIds: ["strategy"] }] })] });
  const rendered = html(desk({ latestCycle: recorded, history: [recorded] }));
  check((rendered.match(/href="\/api\/strategy-lab\/runs\?id=run-123_abc"/g) ?? []).length, 2, "Both the role citation and evidence room reach the immutable result");
  yes(rendered.includes("Research tool · unscored"));
});

if (failures.length) throw new AggregateError(failures, `${failures.length} agent-desk UI scenarios failed`);
console.log(`Agent desk UI: ${scenarios} scenarios and ${assertions} assertions passed.`);
