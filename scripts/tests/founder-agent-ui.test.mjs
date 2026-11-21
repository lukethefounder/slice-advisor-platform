import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

const require = createRequire(import.meta.url), ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server"), repo = fileURLToPath(new URL("../..", import.meta.url));
const CONTROLLER = "src/components/intelligence/agent-collaboration.tsx", VIEW = "src/components/intelligence/agent-collaboration-view.tsx";
const ENDPOINT = "/api/intelligence/agent-desk/collaboration", compiled = new Map(), modules = new Map();
let assertions = 0, scenarios = 0, session = { agentDeskFounder: false }, gateError = null, gateCalls = 0;
const check = (value, expected, message) => { assert.deepEqual(value, expected, message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
const flush = () => new Promise(done => setImmediate(done));
function compile(path) {
  if (!compiled.has(path)) {
    const result = ts.transpileModule(readFileSync(resolve(repo, path), "utf8"), { fileName: path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`); compiled.set(path, result.outputText);
  }
  return compiled.get(path);
}
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const imports = specifier => {
    if (specifier.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (specifier === "next/link") return { __esModule: true, default: ({ prefetch: _prefetch, ...props }) => React.createElement("a", props) };
    if (specifier === "next/navigation") return { usePathname: () => "/workspace/intelligence", notFound: () => { throw new Error("NEXT_NOT_FOUND"); } };
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => session };
    if (specifier === "@/components/intelligence/intelligence-ui") return { cx: (...parts) => parts.filter(Boolean).join(" ") };
    if (specifier === "@/components/intelligence/agent-desk") return { __esModule: true, default: () => null };
    if (specifier === "@/lib/agent-desk/access") return { requireCurrentAgentDeskAccess: async () => { gateCalls++; if (gateError) throw gateError; return { userId: "owner", firmId: "firm" }; } };
    if (specifier === "@/lib/agent-desk/contracts") return load("src/lib/agent-desk/contracts.ts");
    return require(specifier);
  };
  new Function("require", "module", "exports", compile(path))(imports, module, module.exports); return module.exports;
}
const view = load(VIEW), roles = load("src/lib/agent-desk/contracts.ts").AGENT_ROLES, now = "2026-11-18T18:00:00.000Z";
const learning = (overrides = {}) => ({ version: "slice-agent-learning-1.0.0", generatedAt: now, symbol: null, closedTrades: 0, linkedTrades: 0, unattributedTrades: 0, wins: 0, losses: 0, breakeven: 0, netPnl: 0, observedWinRatePct: null, byRole: roles.map(role => ({ role, reviewedTrades: 0, wins: 0, losses: 0, breakeven: 0, netPnl: 0, observedWinRatePct: null })), lessons: [], recentOutcomes: [], sampleWindow: { limit: 400, totalRecordedTrades: 0, truncated: false, oldestClosedAt: null, newestClosedAt: null }, advisoryOnly: true, limitations: ["Recorded samples are not a future prediction."], ...overrides });
const message = (overrides = {}) => ({ version: 1, id: "message-one", cycleId: "cycle-one", symbol: "MSFT", round: 1, phase: "research", from: "sentiment", to: "team", replyToIds: [], body: "Observed market participation has weakened.", evidenceIds: ["macro-1"], createdAt: now, researchRunId: "run-one", sourceHash: "actual-source-hash", ...overrides });
const brief = (overrides = {}) => ({ version: 1, id: "brief-one", cycleId: "cycle-one", symbol: "MSFT", side: "BUY", title: "MSFT paper entry", summary: "A simulated entry passed the recorded policy.", createdAt: now, readAt: null, delivery: "in-app", classification: "paper-simulation", fill: { id: "fill-one", cycleId: "cycle-one", sequence: 1, classification: "paper-simulation", fillModel: "observed-price-plus-configured-costs", symbol: "MSFT", side: "BUY", quantity: 10, observedPrice: 100, observedAt: now, filledAt: now, fillPrice: 100.1, notional: 1001, fees: 1, slippageCost: 1, realizedPnl: 0, reason: "Recorded Chief rationale.", researchRunId: "run-one" }, contextQuote: null, executionQuote: null, researchRunId: "run-one", sourceHash: "actual-source-hash", entryCycleId: null, realized: false, netPnl: null, netReturnPct: null, attribution: "entry-open", ...overrides });
const aggregate = (overrides = {}) => ({ board: [], briefs: [], learning: learning(), ...overrides });
const props = (mode, value, overrides = {}) => ({ mode, value, loading: false, error: "", notice: "", pending: null, body: "", to: "team", onBody() {}, onTo() {}, onMessage() {}, onRead() {}, onReload() {}, ...overrides });
const html = (mode, value, overrides) => renderToStaticMarkup(React.createElement(view.default, props(mode, value, overrides)));
const failures = [];
async function test(name, action) { try { await action(); scenarios++; } catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); } }

await test("Search and actual Intelligence navigation hide founder tools by default", () => {
  const core = load("src/lib/workspace-green-core.ts"), navigation = load("src/components/intelligence/intelligence-navigation.tsx");
  const desk = core.WORKSPACE_TOOLS.find(tool => tool.id === "agent-desk");
  check(core.workspaceToolVisible(desk), false); check(core.workspaceToolVisible(desk, true), true);
  yes(!core.searchWorkspaceTools("agents").some(tool => tool.id === "agent-desk"));
  yes(core.searchWorkspaceTools("agents", true).some(tool => tool.id === "agent-desk"));
  session = { role: "Founder", agentDeskFounder: false };
  const hidden = renderToStaticMarkup(React.createElement(navigation.default));
  yes(!hidden.includes("/workspace/intelligence/agent-desk")); yes(hidden.includes("/workspace/intelligence/knowledge-graph"));
  session = { agentDeskFounder: true };
  yes(renderToStaticMarkup(React.createElement(navigation.default)).includes("/workspace/intelligence/agent-desk"));
});

await test("Server page checks access before returning the agent client and conceals expected denials", async () => {
  const page = load("src/app/workspace/intelligence/agent-desk/page.tsx");
  const allowed = await page.default(); yes(allowed); check(gateCalls, 1);
  for (const status of [401, 403]) { gateError = Object.assign(new Error("Denied"), { status }); await assert.rejects(page.default(), /NEXT_NOT_FOUND/); assertions++; }
  gateError = new Error("Unexpected storage failure"); await assert.rejects(page.default(), /Unexpected storage failure/); assertions++; gateError = null;
});

await test("Conversation renders actual rounds, citations, replies and escaped untrusted content", () => {
  const value = aggregate({ board: [message(), message({ id: "chief-one", from: "chief", round: 3, phase: "decision", replyToIds: ["message-one"], body: "<script>not executable</script> Keep exposure unchanged." })] });
  const rendered = html("board", value);
  for (const text of ["Founder access", "Sentiment", "Chief", "round 3", "actual-source-hash", "macro-1", "researchRunId=run-one", "#agent-message-message-one", "Post to private channel", 'maxLength="4000"']) yes(rendered.includes(text), text);
  yes(!rendered.includes("<script>")); yes(rendered.includes("&lt;script&gt;"));
  yes(rendered.includes("does not place an order"));
});

await test("Trade briefs distinguish open entries from closed outcomes and display private read state", () => {
  const entry = html("briefs", aggregate({ briefs: [brief()] }));
  yes(entry.includes("Open · not realized")); yes(entry.includes("Pending exit")); yes(entry.includes("Mark as read"));
  yes(entry.includes("Private in-app delivery · paper simulation")); yes(!entry.includes("Net realized P&amp;L"));
  const exit = html("briefs", aggregate({ briefs: [brief({ side: "SELL", title: "MSFT paper exit", realized: true, netPnl: -18.2, netReturnPct: -1.8, attribution: "legacy-entry-unavailable", readAt: now })] }));
  yes(exit.includes("-$18.20")); yes(exit.includes("-1.8%")); yes(exit.includes("matching entry’s research record is unavailable"));
  yes(!exit.includes("Mark as read")); yes(exit.includes("0 unread")); yes(exit.includes("Recorded Chief rationale."));
});

await test("Learning exposes sample size and associated outcomes without manufactured forecasts", () => {
  const empty = html("desk", aggregate());
  for (const text of ["No sample", "No lessons asserted yet", "does not contain invented performance", "do not retrain model weights", "not forecasts of profit"]) yes(empty.includes(text), text);
  const sample = learning({ closedTrades: 4, linkedTrades: 3, unattributedTrades: 1, wins: 1, losses: 3, netPnl: -40, observedWinRatePct: 25, lessons: [{ version: 1, id: "lesson-one", title: "Repeated liquidity gaps", description: "Three of four saved trades had losses.", condition: "spread-risk", status: "review-candidate", sampleCount: 4, lossCount: 3, netPnl: -40, relatedCycleIds: ["cycle-one"], firstObservedAt: now, lastObservedAt: now, advisoryOnly: true }], sampleWindow: { limit: 4, totalRecordedTrades: 6, truncated: true, oldestClosedAt: now, newestClosedAt: now } });
  const rendered = html("desk", aggregate({ learning: sample }));
  for (const text of ["25%", "Review candidate", "4 trades", "3 losses", "most recent 4", "Memory version 1", "not independent returns", "cycle-one"]) yes(rendered.includes(text), text);
});

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function events() { const listeners = new Map(); return { addEventListener(type, fn) { const group = listeners.get(type) ?? new Set(); group.add(fn); listeners.set(type, group); }, removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }, dispatchEvent(event) { for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event); }, count() { return [...listeners.values()].reduce((total, group) => total + group.size, 0); } }; }
function hooks() {
  const slots = []; let cursor = 0, dirty = true, pending = [], disposed = false, lateWrites = 0;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  return {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { if (disposed) { lateWrites++; return; } const value = typeof next === "function" ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps, fn, cleanup: old?.cleanup }; pending.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
    render(component) { if (disposed) return; let result, count = 0; do { cursor = 0; dirty = false; pending = []; result = component(); for (const effect of pending) effect(); if (++count > 30) throw new Error("Hooks did not settle"); } while (dirty); return result; },
    replay() { for (const slot of slots) if (slot.fn) { slot.cleanup?.(); slot.cleanup = slot.fn(); } },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); }, lateWrites: () => lateWrites,
  };
}
function harness() {
  const driver = hooks(), timers = new Map(), requests = [], document = { ...events(), visibilityState: "visible" }, navigator = { onLine: true };
  let counter = 0, tree, owner = { loading: false, user: { id: "owner" }, firm: { id: "firm" }, agentDeskFounder: true };
  const window = { ...events(), setTimeout(callback, delay) { const id = ++counter; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  const context = createContext({ window, document, navigator, console, AbortController, Error }), module = { exports: {} }, stub = function Stub() {};
  const imports = specifier => {
    if (specifier === "react") return { ...driver, useCallback: (fn, deps) => driver.useMemo(() => fn, deps) };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => owner };
    if (specifier === "@/lib/intelligence/client") return { intelligenceFetch: (url, init, options) => { const waiting = deferred(), item = { ...waiting, url, init, options, taken: false }; requests.push(item); return waiting.promise; }, isAbortError: error => error?.name === "AbortError" };
    return { __esModule: true, default: stub };
  };
  runInContext(`(function(require,module,exports){${compile(CONTROLLER)}\n})`, context)(imports, module, module.exports);
  const h = { window, document, navigator, requests, timers, get props() { return tree.props; }, render() { tree = driver.render(() => module.exports.AgentCollaborationWorkspace({ mode: "board" })); }, async flush() { await flush(); h.render(); await flush(); h.render(); }, next(method = "GET") { const found = requests.find(item => !item.taken && (item.init.method ?? "GET") === method); yes(found, `${method} request exists`); found.taken = true; check(found.url, ENDPOINT); return found; }, async fire() { const item = [...timers][0]; yes(item); timers.delete(item[0]); return item[1].callback(); }, owner(next) { owner = next; return module.exports.default({ mode: "board" }); }, replay() { driver.replay(); h.render(); }, unmount: driver.unmount, lateWrites: driver.lateWrites };
  h.render(); return h;
}
async function ready(value = aggregate()) { const h = harness(); await h.flush(); h.next().resolve({ ok: true, collaboration: value }); await h.flush(); return h; }

await test("Founder wrapper requires exact permission and keys every owner and firm", async () => {
  const h = harness(), owner = { loading: false, user: { id: "one" }, firm: { id: "firm" }, agentDeskFounder: true };
  for (const denied of [{ ...owner, agentDeskFounder: false }, { ...owner, agentDeskFounder: undefined }, { ...owner, agentDeskFounder: "true" }, { ...owner, user: null }, { ...owner, firm: null }, { ...owner, loading: true }]) check(h.owner(denied), null);
  check(h.owner(owner).key, "one:firm:board"); check(h.owner({ ...owner, user: { id: "two" } }).key, "two:firm:board"); check(h.owner({ ...owner, firm: { id: "other" } }).key, "one:other:board");
  h.unmount(); await flush(); check(h.requests.length, 0, "Unmounted channel never starts a delayed initial fetch");
});

await test("Posting review notes uses server identity and fences stale GET responses", async () => {
  const h = await ready(); const polling = h.fire(); const old = h.next();
  h.props.onBody("  Review liquidity.  "); h.props.onTo("skeptic"); h.render(); h.props.onMessage(); h.render();
  const write = h.next("POST"); yes(old.init.signal.aborted);
  check(JSON.parse(write.init.body), { action: "message", body: "Review liquidity.", to: "skeptic" });
  write.resolve({ ok: true, collaboration: aggregate({ board: [message()] }) }); await h.flush();
  old.resolve({ ok: true, collaboration: aggregate() }); await polling; await h.flush();
  check(h.props.value.board.length, 1); check(h.props.body, ""); yes(h.props.notice.includes("stored")); h.unmount();
});

await test("Read acknowledgments are exact IDs and failed writes retain review notes", async () => {
  const h = await ready(aggregate({ briefs: [brief()] })); h.props.onRead("brief-one"); h.render();
  const write = h.next("POST"); check(JSON.parse(write.init.body), { action: "read-brief", id: "brief-one" });
  write.resolve({ ok: true, collaboration: aggregate({ briefs: [brief({ readAt: now })] }) }); await h.flush(); check(h.props.value.briefs[0].readAt, now);
  h.props.onBody("Review uncertainty"); h.render(); h.props.onMessage(); h.render(); h.next("POST").reject(new Error("Save failed")); await h.flush();
  check(h.props.body, "Review uncertainty"); yes(h.props.error.includes("Save failed")); check(h.props.pending, null); h.unmount();
});

await test("Revocation and session termination clear private data and block late responses", async () => {
  const h = await ready(aggregate({ board: [message()] })); h.props.onBody("Private unsaved note"); h.render();
  const polling = h.fire(); h.next().reject(Object.assign(new Error("Founder removed"), { status: 403 })); await polling; await h.flush();
  check(h.props.value, null); check(h.props.body, ""); yes(h.props.error.includes("Private agent data has been cleared"));
  const count = h.requests.length; await h.fire(); check(h.requests.length, count); h.unmount();
  const signedOut = await ready(aggregate({ briefs: [brief()] })); const pending = signedOut.fire(), late = signedOut.next(); signedOut.window.dispatchEvent({ type: "slice-session-ended" }); signedOut.render();
  yes(late.init.signal.aborted); late.resolve({ ok: true, collaboration: aggregate({ briefs: [brief()] }) }); await pending; await signedOut.flush(); check(signedOut.props.value, null); signedOut.unmount();
});

await test("Visibility, Strict Mode and unmount preserve one polling loop and no late writes", async () => {
  const h = harness(); h.replay(); await h.flush(); check(h.requests.length, 1); h.next().resolve({ ok: true, collaboration: aggregate() }); await h.flush(); check(h.timers.size, 1);
  h.document.visibilityState = "hidden"; await h.fire(); check(h.requests.length, 1); h.document.visibilityState = "visible"; h.navigator.onLine = false; await h.fire(); check(h.requests.length, 1);
  h.navigator.onLine = true; const tick = h.fire(), late = h.next(); h.unmount(); yes(late.init.signal.aborted); late.resolve({ ok: true, collaboration: aggregate() }); await tick; await flush();
  check(h.lateWrites(), 0); check(h.timers.size, 0); check(h.window.count() + h.document.count(), 0);
});

if (failures.length) throw new AggregateError(failures, `${failures.length} founder UI scenarios failed`);
console.log(`Founder agent UI: ${scenarios} scenarios and ${assertions} assertions passed.`);
