import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
const require = createRequire(import.meta.url), ts = require("typescript"), React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const repo = fileURLToPath(new URL("../..", import.meta.url));
const componentPath = "src/components/agent-broker/broker-trade-briefs.tsx";
const source = readFileSync(resolve(repo, componentPath), "utf8");
const compiled = ts.transpileModule(source, { fileName: componentPath, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
let assertions = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
same(compiled.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error), []);
const css = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputText)(specifier => {
  if (specifier.endsWith(".module.css")) return css;
  if (specifier === "@/lib/intelligence/client") return {};
  if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => ({ loading: true }) };
  if (specifier === "next/link") return { __esModule: true, default: ({ children, href, className }) => React.createElement("a", { href, className }, children) };
  return require(specifier);
}, module, module.exports);
const api = module.exports, stamp = "2026-11-21T15:30:00.000Z";
function fill(patch = {}) { return { id: "fill-1", classification: "broker-paper", symbol: "MSFT", side: "buy", orderId: "order-one", clientOrderId: "slice_confirmed_one", entryIntentId: "entry-one", cycleId: "cycle-one", cumulativeFilledQuantity: 1, averageFillPrice: 100, filledAt: null, observedAt: stamp, grossRealizedPnl: null, netRealizedPnl: null, feesKnown: false, closedPosition: false, notes: "Broker-reported cumulative fill; fees are unavailable.", ...patch }; }
function response(fills = [fill()]) { return { ok: true, broker: { version: 1, provider: "alpaca", connected: true, lastCheckedAt: stamp, recentFills: fills, account: { id: "never-store-account-id", cash: 999999 }, secret: "never-store-secret" } }; }
const projected = api.checkedBrokerBrief(response([fill(), fill({ id: "fill-2", cumulativeFilledQuantity: 2, averageFillPrice: 100.5, observedAt: "2026-11-21T15:31:00.000Z" }), fill({ id: "fill-live", classification: "broker-live", side: "sell", cumulativeFilledQuantity: 2, averageFillPrice: 104, grossRealizedPnl: 7, closedPosition: true, filledAt: stamp })]));
same(projected.fills.length, 2, "Partial snapshots deduplicate within an order and preserve separate paper/live provenance");
same(projected.fills.find(value => value.classification === "broker-paper").cumulativeFilledQuantity, 2);
yes(!JSON.stringify(projected).includes("never-store"), "The browser state contains only the fill projection");
for (const bad of [response([fill({ averageFillPrice: 0 })]), response([fill({ cumulativeFilledQuantity: -1 })]), response([fill({ classification: "paper-simulation" })]), response([fill({ netRealizedPnl: 7 })]), response([fill({ feesKnown: true })]), response([fill({ observedAt: "bad" })]), { ok: true, broker: {} }]) {
  assert.throws(() => api.checkedBrokerBrief(bad)); assertions++;
}
const html = renderToStaticMarkup(React.createElement(api.BrokerTradeBriefsView, { value: projected, loading: false, error: "", accessLost: false, onReload() {} }));
for (const expected of ["Private founder broker trade briefs", "Live brokerage · real money", "Alpaca paper · simulated brokerage", "latest cumulative snapshot", "Net result", "Not determined", "Fees are not reconciled", "$7.00", "advisor market brief email", "slice_confirmed_one", "Observed cumulative fill"]) yes(html.includes(expected), expected);
yes(!html.includes("never-store-secret") && !html.includes("999,999"));
yes(!html.includes('type="password"') && !html.includes("Enable live"), "The brief is a read-only presentation, without credentials or execution controls");
const emptyHtml = renderToStaticMarkup(React.createElement(api.BrokerTradeBriefsView, { value: { fills: [], connected: false, checkedAt: null }, loading: false, error: "", accessLost: false, onReload() {} }));
yes(emptyHtml.includes("No confirmed broker fills yet")); yes(emptyHtml.includes("broker disconnected"));
const revokedHtml = renderToStaticMarkup(React.createElement(api.BrokerTradeBriefsView, { value: null, loading: false, error: "Founder access ended", accessLost: true, onReload() {} }));
yes(revokedHtml.includes('role="alert"')); yes(revokedHtml.includes("disabled")); yes(!revokedHtml.includes("slice_confirmed_one"));

const tick = () => new Promise(done => setImmediate(done));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function events() { const map = new Map(); return { addEventListener(name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); }, removeEventListener(name, fn) { map.get(name)?.delete(fn); }, emit(name) { for (const fn of [...(map.get(name) ?? [])]) fn(); }, size() { return [...map.values()].reduce((total, values) => total + values.size, 0); } }; }
function hookDriver() {
  const slots = []; let cursor = 0, dirty = true, effects = [], disposed = false, lateWrites = 0;
  const differs = (a, b) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  return {
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { if (disposed) { lateWrites++; return; } const value = typeof next === "function" ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || differs(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || differs(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps, cleanup: old?.cleanup }; effects.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } },
    render(fn) { if (disposed) return; let tree, rounds = 0; do { cursor = 0; dirty = false; effects = []; tree = fn(); for (const effect of effects) effect(); if (++rounds > 30) throw new Error("Hook render loop"); } while (dirty); return tree; },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); }, lateWrites: () => lateWrites,
  };
}
function harness({ hidden = false } = {}) {
  const driver = hookDriver(), timers = new Map(), requests = [], document = { ...events(), visibilityState: hidden ? "hidden" : "visible" }, navigator = { onLine: true };
  let counter = 0, tree, owner = { loading: false, user: { id: "founder-one" }, firm: { id: "firm-one" }, agentDeskFounder: true };
  const window = { ...events(), setTimeout(callback, delay) { const id = ++counter; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  const vm = createContext({ window, document, navigator, AbortController, console, Error }), loaded = { exports: {} };
  runInContext(`(function(require,module,exports){${compiled.outputText}\n})`, vm)(specifier => {
    if (specifier === "react") return { ...driver, useCallback: (fn, deps) => driver.useMemo(() => fn, deps) };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => owner };
    if (specifier === "@/lib/intelligence/client") return { intelligenceFetch: (url, init, options) => { const waiting = deferred(); requests.push({ ...waiting, url, init, options, taken: false }); return waiting.promise; }, isAbortError: error => error?.name === "AbortError" };
    if (specifier.endsWith(".module.css")) return css;
    return { __esModule: true, default() {} };
  }, loaded, loaded.exports);
  const h = { document, navigator, window, timers, requests,
    get props() { return tree.props; },
    render() { tree = driver.render(() => loaded.exports.BrokerTradeBriefsWorkspace()); },
    async flush() { await tick(); h.render(); await tick(); h.render(); },
    next() { const request = requests.find(value => !value.taken); yes(request, "Expected a GET request"); request.taken = true; return request; },
    owner(value) { owner = value; return loaded.exports.default(); },
    fire() { const item = [...timers].find(([, value]) => value.delay === 30_000); yes(item, "A 30-second refresh is scheduled"); timers.delete(item[0]); item[1].callback(); },
    unmount: driver.unmount, lateWrites: driver.lateWrites,
  }; h.render(); return h;
}
const gate = harness();
const founder = { loading: false, user: { id: "one" }, firm: { id: "firm" }, agentDeskFounder: true };
for (const denied of [{ ...founder, agentDeskFounder: false }, { ...founder, agentDeskFounder: "true" }, { ...founder, agentDeskFounder: undefined }, { ...founder, user: null }, { ...founder, firm: null }, { ...founder, loading: true }]) same(gate.owner(denied), null);
same(gate.owner(founder).key, "one:firm"); same(gate.owner({ ...founder, user: { id: "two" } }).key, "two:firm"); same(gate.owner({ ...founder, firm: { id: "other" } }).key, "one:other");
gate.unmount(); await tick(); same(gate.requests.length, 0);

const live = harness(); await live.flush(); const initial = live.next();
same(initial.url, "/api/intelligence/agent-desk/broker"); same(initial.init.method, "GET"); same(initial.init.body, undefined); same(initial.options.retries, 0);
initial.resolve(response()); await live.flush(); same(live.props.value.fills.length, 1); yes(!JSON.stringify(live.props.value).includes("never-store"));
live.fire(); await live.flush(); const inFlight = live.next(); live.props.onReload(); same(live.requests.length, 2, "Concurrent refresh cannot start an overlapping request");
live.document.visibilityState = "hidden"; live.document.emit("visibilitychange"); live.render(); yes(inFlight.init.signal.aborted); same(live.timers.size, 0);
inFlight.resolve(response([fill({ id: "stale", symbol: "AAPL" })])); await live.flush(); same(live.props.value.fills[0].symbol, "MSFT", "An ignored abort cannot revive a stale response");
live.document.visibilityState = "visible"; live.document.emit("visibilitychange"); await live.flush(); const awakened = live.next(); awakened.resolve(response()); await live.flush();
live.props.onReload(); const late = live.next(); live.window.emit("slice-session-ended"); live.render(); yes(late.init.signal.aborted); same(live.props.value, null); same(live.props.accessLost, true); same(live.timers.size, 0);
late.resolve(response([fill({ symbol: "NVDA" })])); await live.flush(); same(live.props.value, null);
const requestCount = live.requests.length; live.props.onReload(); live.window.emit("online"); await live.flush(); same(live.requests.length, requestCount, "Revocation prevents requests until a new authorized session mount");
live.unmount(); same(live.window.size() + live.document.size(), 0); same(live.lateWrites(), 0);

const forbidden = harness(); await forbidden.flush(); forbidden.next().resolve(response()); await forbidden.flush(); forbidden.props.onReload(); forbidden.next().reject(Object.assign(new Error("Access denied"), { status: 403 })); await forbidden.flush();
same(forbidden.props.value, null); same(forbidden.props.accessLost, true); same(forbidden.timers.size, 0); forbidden.unmount();
const hidden = harness({ hidden: true }); await hidden.flush(); same(hidden.requests.length, 0, "Hidden tabs do not poll"); hidden.document.visibilityState = "visible"; hidden.document.emit("visibilitychange"); await hidden.flush(); same(hidden.requests.length, 1);
const unmounted = hidden.next(); hidden.unmount(); yes(unmounted.init.signal.aborted); unmounted.resolve(response()); await tick(); same(hidden.lateWrites(), 0);
const page = readFileSync(resolve(repo, "src/app/workspace/brief/page.tsx"), "utf8");
yes(page.includes("<FounderBrokerTradeBriefs />")); yes(page.includes('<FounderAgentCollaboration mode="briefs" />'), "Real broker briefs do not replace the separate local paper ledger");
console.log(`Broker trade briefs: ${assertions} assertions passed; founder/firm gate, latest cumulative fill projection, gross/net provenance, read-only requests, visibility polling, revocation and stale-reply fencing verified.`);
