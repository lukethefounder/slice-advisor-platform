import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url), ts = require("typescript"), React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const repo = fileURLToPath(new URL("../..", import.meta.url)), compiled = new Map(), modules = new Map();
const BROKER = "src/components/agent-broker/broker-settings.tsx", VIEW = "src/components/agent-broker/broker-settings-view.tsx";
const SHARING = "src/components/agent-broker/research-sharing-settings.tsx", STREAM = "src/components/intelligence/agent-market-stream.tsx";
const APPROVAL = "src/components/agent-broker/broker-proposal-approval.tsx";
const ENDPOINT = "/api/intelligence/agent-desk/broker", now = "2026-11-21T15:30:00.000Z";
let assertions = 0, scenarios = 0;
const failures = [], check = (a, b, message) => { assert.deepEqual(a, b, message); assertions++; }, yes = (a, message) => { assert.ok(a, message); assertions++; };
const flush = () => new Promise(done => setImmediate(done));
async function test(name, action) { try { await action(); scenarios++; } catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); } }
function compile(path) {
  if (!compiled.has(path)) { const result = ts.transpileModule(readFileSync(resolve(repo, path), "utf8"), { fileName: path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }); check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`); compiled.set(path, result.outputText); }
  return compiled.get(path);
}
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const imports = specifier => {
    if (specifier.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
    if (specifier === "@/lib/intelligence/client") return {};
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => ({ loading: true }) };
    const paths = { "@/lib/agent-broker/contracts": "src/lib/agent-broker/contracts.ts", "@/lib/agent-desk/contracts": "src/lib/agent-desk/contracts.ts", "@/lib/intelligence/research-evidence": "src/lib/intelligence/research-evidence.ts", "./agent-market-stream": STREAM };
    return paths[specifier] ? load(paths[specifier]) : require(specifier);
  };
  new Function("require", "module", "exports", compile(path))(imports, module, module.exports); return module.exports;
}
const { DEFAULT_BROKER_POLICY } = load("src/lib/agent-broker/contracts.ts");
const policy = () => ({ ...DEFAULT_BROKER_POLICY, allowedSymbols: [...DEFAULT_BROKER_POLICY.allowedSymbols] });
function broker(overrides = {}) { return { version: 1, provider: "alpaca", revision: 3, mode: "paper", encryptionConfigured: true, liveServerEnabled: false, connected: false, credentialsHint: null, connectedAt: null, lastCheckedAt: null, controls: { enabled: false, autonomous: false, paused: true }, policy: policy(), account: null, positions: [], orders: [], clock: null, activePositionSymbol: null, pendingIntent: null, recentIntents: [], lastError: null, updatedAt: now, readiness: { canEnable: false, reasons: ["Connect your broker account."], liveRequiresSip: true }, limitations: ["One owned long position at a time."], ...overrides }; }
const connected = overrides => broker({ connected: true, credentialsHint: "••••ABCD", connectedAt: now, lastCheckedAt: now, account: { id: "broker-account", numberMasked: "••••1234", status: "ACTIVE", cash: 10000, equity: 11000, buyingPower: 10000, currency: "USD" }, readiness: { canEnable: true, reasons: [], liveRequiresSip: true }, ...overrides });
function props(value = broker(), overrides = {}) { return { value, loading: false, pending: null, error: "", notice: "", mode: "paper", apiKey: "", apiSecret: "", policy: value.policy, symbols: value.policy.allowedSymbols.join(", "), dirty: false, conflict: false, acknowledgement: "", autonomous: false, onReload() {}, onMode() {}, onApiKey() {}, onApiSecret() {}, onConnect() {}, onPolicy() {}, onSymbols() {}, onSave() {}, onDiscard() {}, onAcknowledgement() {}, onAutonomous() {}, onEnable() {}, onAction() {}, ...overrides }; }
const render = value => renderToStaticMarkup(React.createElement(load(VIEW).default, value));
function button(html, label) { const value = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(row => row[0]).find(row => row.replace(/<[^>]*>/g, "").includes(label)); yes(value, `Found button ${label}`); return value; }

await test("Broker panel defaults to paper, renders no credential values and keeps connection separate from activation", () => {
  const html = render(props(connected({ unexpectedSecret: "never-render-this" })));
  yes(html.includes('value="paper" selected=""')); check((html.match(/type="password"/g) ?? []).length, 2); yes(!html.includes("never-render-this"));
  yes(html.includes("••••ABCD")); yes(html.includes("Connection alone never arms an agent")); yes(button(html, "Enable broker paper submissions").includes("disabled"));
  yes(html.includes("An accepted order is not a completed fill")); yes(html.includes("It does not cancel orders or close positions"));
});
await test("Live activation remains disabled without server permission even when an acknowledgement is populated", () => {
  const value = connected({ mode: "live", liveServerEnabled: false, policy: { ...policy(), feed: "sip" } });
  const html = render(props(value, { mode: "live", acknowledgement: "ENABLE LIVE TRADING" }));
  yes(button(html, "Enable live submissions").includes("disabled")); yes(html.includes("SLICE_BROKER_LIVE_ENABLED=true"));
  yes(!button(render(props({ ...value, liveServerEnabled: true }, { acknowledgement: "ENABLE LIVE TRADING" })), "Enable live submissions").includes("disabled"));
});
await test("Policy, pending receipts and broker positions keep actual provenance and ownership", () => {
  const receipt = { id: "receipt", cycleId: "cycle", mode: "paper", symbol: "MSFT", side: "buy", quantity: 2, status: "uncertain", createdAt: now, updatedAt: now, clientOrderId: "slice-stable-id", order: null, message: "Transport interrupted; reconciliation required." };
  const value = connected({ pendingIntent: receipt, recentIntents: [receipt], positions: [{ symbol: "MSFT", quantity: 2, side: "long", averageEntryPrice: 100, unrealizedPnl: 2 }], activePositionSymbol: null });
  const html = render(props(value)); for (const expected of ["slice-stable-id", "Outside Slice ownership", "Transport interrupted", "Maximum entry (USD)", "1–30 symbols", "minimum", "max=\"10\""]) if (expected !== "minimum") yes(html.includes(expected), expected);
  yes(html.includes('min="40"')); yes(html.includes('max="20"'));
});

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function events() { const listeners = new Map(); return { addEventListener(type, fn) { const group = listeners.get(type) ?? new Set(); group.add(fn); listeners.set(type, group); }, removeEventListener(type, fn) { listeners.get(type)?.delete(fn); }, emit(type, value = {}) { for (const listener of [...(listeners.get(type) ?? [])]) listener({ type, ...value }); }, count() { return [...listeners.values()].reduce((sum, group) => sum + group.size, 0); } }; }
function hooks() {
  const slots = []; let cursor = 0, dirty = true, pending = [], disposed = false, lateWrites = 0;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  return { useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial }; return [slots[i].value, next => { if (disposed) { lateWrites++; return; } const value = typeof next === "function" ? next(slots[i].value) : next; if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; } }]; }, useRef(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: { current: initial } }; return slots[i].value; }, useMemo(fn, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; }, useEffect(fn, deps) { const i = cursor++; if (!slots[i] || changed(slots[i].deps, deps)) { const old = slots[i]; slots[i] = { deps, fn, cleanup: old?.cleanup }; pending.push(() => { slots[i].cleanup?.(); slots[i].cleanup = fn(); }); } }, render(component) { if (disposed) return; let result, count = 0; do { cursor = 0; dirty = false; pending = []; result = component(); for (const effect of pending) effect(); if (++count > 30) throw new Error("Hook loop"); } while (dirty); return result; }, unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); }, lateWrites: () => lateWrites };
}
function harness(path = BROKER, exportName = "BrokerSettingsWorkspace", parameters) {
  const driver = hooks(), timers = new Map(), requests = [], streams = [], document = { ...events(), visibilityState: "visible" }, navigator = { onLine: true };
  let counter = 0, tree, owner = { loading: false, user: { id: "owner" }, firm: { id: "firm" }, agentDeskFounder: true };
  const window = { ...events(), setTimeout(callback, delay) { const id = ++counter; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } };
  class EventSource { constructor(url) { this.url = url; this.closed = false; this.events = events(); streams.push(this); } addEventListener(...args) { this.events.addEventListener(...args); } close() { this.closed = true; } emit(type, value) { this.events.emit(type, { data: typeof value === "string" ? value : JSON.stringify(value) }); } fail() { this.onerror?.(); } }
  const context = createContext({ window, document, navigator, console, AbortController, Error, EventSource }), module = { exports: {} }, stub = function Stub() {};
  const imports = specifier => {
    if (specifier === "react") return { ...driver, useCallback: (fn, deps) => driver.useMemo(() => fn, deps) };
    if (specifier === "react/jsx-runtime") return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
    if (specifier === "@/components/workspace/premium/session") return { useWorkspaceSession: () => owner };
    if (specifier === "@/lib/intelligence/client") return { intelligenceFetch: (url, init, options) => { const waiting = deferred(); const item = { ...waiting, url, init, options, taken: false }; requests.push(item); return waiting.promise; }, isAbortError: error => error?.name === "AbortError" };
    if (specifier === "@/lib/agent-broker/contracts") return { DEFAULT_BROKER_POLICY };
    return { __esModule: true, default: stub };
  };
  runInContext(`(function(require,module,exports){${compile(path)}\n})`, context)(imports, module, module.exports);
  const h = { window, document, navigator, timers, requests, streams, get props() { return tree.props; }, render() { tree = driver.render(() => module.exports[exportName](parameters)); }, async flush() { await flush(); h.render(); await flush(); h.render(); }, next(method = "GET") { const found = requests.find(item => !item.taken && (item.init.method ?? "GET") === method); yes(found, `${method} request exists`); found.taken = true; return found; }, owner(next) { owner = next; return module.exports.default(parameters); }, unmount: driver.unmount, lateWrites: driver.lateWrites, fireDelay(delay) { const item = [...timers].find(([, value]) => value.delay === delay); yes(item, `Timer ${delay}`); timers.delete(item[0]); item[1].callback(); } };
  h.render(); return h;
}
async function ready(value = broker()) { const h = harness(); await h.flush(); h.next().resolve({ ok: true, broker: value }); await h.flush(); return h; }
await test("Founder wrapper requires exact server capability and remounts for each user and firm", async () => {
  const h = harness(), owner = { loading: false, user: { id: "one" }, firm: { id: "firm" }, agentDeskFounder: true };
  for (const denied of [{ ...owner, agentDeskFounder: false }, { ...owner, agentDeskFounder: undefined }, { ...owner, agentDeskFounder: "true" }, { ...owner, role: "Founder", agentDeskFounder: false }, { ...owner, user: null }, { ...owner, loading: true }]) check(h.owner(denied), null);
  check(h.owner(owner).key, "one:firm"); check(h.owner({ ...owner, firm: { id: "other" } }).key, "one:other"); h.unmount(); await flush(); check(h.requests.length, 0);
});
await test("Credential submission is exact, paper by default, clears fields immediately and never implicitly enables execution", async () => {
  const h = await ready(); h.props.onApiKey("test-key-only"); h.props.onApiSecret("test-secret-only"); h.render(); h.props.onConnect(); h.render();
  const request = h.next("POST"); check(request.url, ENDPOINT); check(request.options.retries, 0); check(JSON.parse(request.init.body), { action: "connect", revision: 3, mode: "paper", apiKey: "test-key-only", apiSecret: "test-secret-only" });
  check(h.props.apiKey, ""); check(h.props.apiSecret, ""); request.resolve({ ok: true, broker: connected({ revision: 4 }) }); await h.flush();
  yes(h.props.notice.includes("remains disabled")); check(h.requests.filter(item => item.init.method === "POST").length, 1); h.unmount();
});
await test("Provider failure redacts submitted keys and does not automatically retry a write", async () => {
  const h = await ready(); h.props.onApiKey("sensitive-key"); h.props.onApiSecret("sensitive-secret"); h.render(); h.props.onConnect(); h.render(); h.next("POST").reject(new Error("Provider echoed sensitive-key and sensitive-secret")); await h.flush();
  yes(!h.props.error.includes("sensitive-key")); yes(!h.props.error.includes("sensitive-secret")); yes(h.props.error.includes("Reload status")); check(h.requests.length, 2); check(h.props.apiSecret, ""); h.unmount();
});
await test("Typed activation and explicit autonomous choice are exact and live permission is independently checked", async () => {
  const h = await ready(connected()); h.props.onAcknowledgement("enable paper trading"); h.render(); h.props.onEnable(); check(h.requests.length, 1);
  h.props.onAcknowledgement("ENABLE PAPER TRADING"); h.props.onAutonomous(true); h.render(); h.props.onEnable(); h.render();
  check(JSON.parse(h.next("POST").init.body), { action: "enable-paper", revision: 3, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" }); check(h.props.acknowledgement, ""); h.unmount();
  const live = await ready(connected({ mode: "live", liveServerEnabled: false })); live.props.onAcknowledgement("ENABLE LIVE TRADING"); live.render(); live.props.onEnable(); check(live.requests.length, 1); live.unmount();
});
await test("A stale GET cannot roll back a successful broker mutation", async () => {
  const h = await ready(connected()); h.props.onReload(); const old = h.next(); h.props.onAction("pause"); const write = h.next("POST"); yes(old.init.signal.aborted);
  write.resolve({ ok: true, broker: connected({ revision: 4, controls: { enabled: true, autonomous: false, paused: true } }) }); await h.flush(); old.resolve({ ok: true, broker: connected({ revision: 3 }) }); await h.flush();
  check(h.props.value.revision, 4); h.unmount();
});
await test("Concurrent policy changes preserve unsaved limits and require explicit discard", async () => {
  const h = await ready(connected()); h.props.onPolicy({ maxOrderUsd: 75 }); h.render(); h.props.onReload(); h.next().resolve({ ok: true, broker: connected({ revision: 4, policy: { ...policy(), maxOrderUsd: 1000 } }) }); await h.flush();
  check(h.props.policy.maxOrderUsd, 75); check(h.props.conflict, true); h.props.onSave(); check(h.requests.length, 2); h.props.onDiscard(); h.render(); check(h.props.policy.maxOrderUsd, 1000); check(h.props.conflict, false); h.unmount();
});
await test("Revocation aborts writes, erases account and entered secrets, ignores late responses and stops polling", async () => {
  const h = await ready(connected()); h.props.onApiKey("unsent-key"); h.props.onApiSecret("unsent-secret"); h.render(); h.props.onAction("refresh"); const write = h.next("POST"); h.window.emit("slice-session-ended"); h.render();
  check(h.props.value, null); check(h.props.apiKey, ""); check(h.props.apiSecret, ""); yes(write.init.signal.aborted); write.resolve({ ok: true, broker: connected({ revision: 20 }) }); await h.flush();
  check(h.props.value, null); check(h.timers.size, 0); h.props.onReload(); check(h.requests.length, 2); h.unmount(); check(h.window.count() + h.document.count(), 0); check(h.lateWrites(), 0);
});
await test("Forbidden status clears owner data and unmount fences ignored cancellation", async () => {
  const h = await ready(connected()); h.props.onReload(); h.next().reject(Object.assign(new Error("Forbidden"), { status: 403 })); await h.flush(); check(h.props.value, null); h.unmount();
  const unmounted = harness(); await unmounted.flush(); const request = unmounted.next(); unmounted.unmount(); request.resolve({ ok: true, broker: connected() }); await flush(); check(unmounted.lateWrites(), 0);
});

const preference = (enabled = false) => ({ version: 1, enabled, updatedAt: null, scope: "opt-in-public-market-sources", detail: "Only public source metadata is contributed.", revocation: "Disabling excludes future reads; historical citations remain." });
await test("Sharing is an authenticated opt-in, accepts ordinary members and transmits no owner identity", async () => {
  const h = harness(SHARING, "ResearchSharingWorkspace"); check(h.props.enabled, false); await h.flush(); h.next().resolve({ ok: true, preference: preference() }); await h.flush();
  const ordinary = { loading: false, user: { id: "member" }, firm: { id: "firm" }, agentDeskFounder: false }; check(h.owner(ordinary).key, "member:firm");
  h.props.onEnabled(true); h.render(); h.props.onSave(); h.render(); const request = h.next("POST"); check(request.url, "/api/research-sharing"); check(JSON.parse(request.init.body), { enabled: true }); check(request.options.retries, 0);
  request.resolve({ ok: true, preference: preference(true) }); await h.flush(); check(h.props.value.enabled, true); h.unmount();
  const html = renderToStaticMarkup(React.createElement(load(SHARING).ResearchSharingView, { value: preference(), enabled: false, loading: false, saving: false, error: "", notice: "", onEnabled() {}, onSave() {}, onReload() {} }));
  yes(html.includes("historical citations remain")); yes(html.includes("disabled by default")); yes(html.includes("Private notes, client documents"));
});
await test("Sharing response cannot restore a session after revocation", async () => {
  const h = harness(SHARING, "ResearchSharingWorkspace"); await h.flush(); const request = h.next(); h.window.emit("slice-session-ended"); h.render(); request.resolve({ ok: true, preference: preference(true) }); await h.flush(); check(h.props.value, null); check(h.props.enabled, false); h.unmount(); check(h.window.count(), 0);
});

const snapshot = () => ({ version: 1, status: "live", feed: "iex", checkedAt: now, lastMessageAt: now, quotes: [{ symbol: "MSFT", bid: 100, ask: 100.01, mid: 100.005, spreadBps: 1, observedAt: now, receivedAt: now, ageMs: 250, transportLagMs: 120 }], message: null });
await test("Market stream uses the founder endpoint, renders true times and tears down while hidden", async () => {
  const h = harness(STREAM, "default"); await h.flush(); check(h.streams.length, 1); const stream = h.streams[0]; check(stream.url, "/api/intelligence/agent-desk/market-stream"); stream.emit("market", snapshot()); h.render(); check(h.props.state, "live"); check(h.props.value.quotes[0].ageMs, 250);
  h.document.visibilityState = "hidden"; h.document.emit("visibilitychange"); h.render(); yes(stream.closed); check(h.props.state, "offline"); check(h.timers.size, 0);
  h.document.visibilityState = "visible"; h.document.emit("visibilitychange"); h.render(); check(h.streams.length, 2); h.unmount(); yes(h.streams[1].closed); check(h.window.count() + h.document.count(), 0); check(h.lateWrites(), 0);
});
await test("Malformed stream observations never become live quotes and reconnects back off", async () => {
  const h = harness(STREAM, "default"); await h.flush(); h.streams[0].emit("market", { ...snapshot(), quotes: [{ symbol: "MSFT", bid: "invented" }] }); h.render(); check(h.props.value, null); check(h.props.state, "stale"); h.fireDelay(5000); h.streams[1].fail(); h.render(); h.fireDelay(10000); check(h.streams.length, 3); h.unmount();
});
await test("Server revocation clears quotes and stops automatic reconnect including late messages", async () => {
  const h = harness(STREAM, "default"); await h.flush(); const stream = h.streams[0]; stream.emit("market", snapshot()); h.render(); stream.emit("revoked", { message: "Access ended" }); h.render(); check(h.props.value, null); check(h.props.state, "offline"); yes(stream.closed); check(h.timers.size, 0);
  stream.emit("market", snapshot()); stream.fail(); h.window.emit("online"); h.render(); check(h.props.value, null); check(h.streams.length, 1); h.unmount();
});
await test("Stream view states age and delivery lag without treating displayed quotes as executable", () => {
  const html = renderToStaticMarkup(React.createElement(load(STREAM).AgentMarketStreamView, { value: snapshot(), state: "stale", message: "Retained observation" }));
  for (const expected of ["Stale / reconnecting", "250 ms", "120 ms", "At server check", "Each order rechecks freshness", "not a guaranteed current quote"]) yes(html.includes(expected), expected);
});

const proposalCycle = (overrides = {}) => ({ id: "exact-cycle", symbol: "MSFT", executionTarget: "alpaca-paper", brokerContextRevision: 3, proposal: { action: "buy" }, ...overrides });
const manualBroker = (overrides = {}) => connected({ controls: { enabled: true, autonomous: false, paused: false }, ...overrides });
await test("Manual broker approval requires matching mode, immutable policy revision and enabled manual controls", () => {
  const reason = load(APPROVAL).brokerApprovalReason, cycle = proposalCycle(), broker = manualBroker();
  check(reason(cycle, broker), null);
  for (const value of [{ ...broker, revision: 4 }, { ...broker, mode: "live" }, { ...broker, connected: false }, { ...broker, controls: { enabled: true, autonomous: true, paused: false } }, { ...broker, controls: { enabled: true, autonomous: false, paused: true } }, { ...broker, recentIntents: [{ cycleId: cycle.id }] }]) yes(reason(cycle, value));
  yes(reason({ ...cycle, brokerContextRevision: undefined }, broker)); yes(reason({ ...cycle, proposal: { action: "hold" } }, broker));
  yes(reason(proposalCycle({ executionTarget: "alpaca-live" }), manualBroker({ mode: "live", liveServerEnabled: false })));
});
await test("Broker approval sends the exact cycle and revision once and presents acceptance separately from fill", async () => {
  const cycle = proposalCycle(), h = harness(APPROVAL, "BrokerProposalWorkspace", { cycle }); await h.flush(); h.next().resolve({ ok: true, broker: manualBroker() }); await h.flush();
  h.props.onApprove(); h.render(); h.props.onApprove(); check(h.requests.length, 2); const request = h.next("POST"); check(JSON.parse(request.init.body), { action: "approve", revision: 3, cycleId: "exact-cycle" }); check(request.options.retries, 0);
  request.resolve({ ok: true, broker: manualBroker({ revision: 4, recentIntents: [{ cycleId: cycle.id }] }), result: { status: "accepted", code: "ACCEPTED", message: "Broker acknowledgment recorded.", intent: null } }); await h.flush();
  const html = renderToStaticMarkup(React.createElement(load(APPROVAL).BrokerProposalView, h.props)); yes(html.includes("Broker accepted the request · fill not yet confirmed")); yes(button(html, "Submit approved Alpaca paper order").includes("disabled")); h.unmount();
});
await test("Unknown submission response disables resubmission and revocation clears late receipts", async () => {
  const cycle = proposalCycle(), h = harness(APPROVAL, "BrokerProposalWorkspace", { cycle }); await h.flush(); h.next().resolve({ ok: true, broker: manualBroker() }); await h.flush(); h.props.onApprove(); h.next("POST").reject(new Error("Connection interrupted")); await h.flush(); yes(h.props.error.includes("not a rejection")); h.props.onApprove(); check(h.requests.length, 2); h.unmount();
  const revoked = harness(APPROVAL, "BrokerProposalWorkspace", { cycle }); await revoked.flush(); revoked.next().resolve({ ok: true, broker: manualBroker() }); await revoked.flush(); revoked.props.onApprove(); const request = revoked.next("POST"); revoked.window.emit("slice-session-ended"); revoked.render(); request.resolve({ ok: true, broker: manualBroker(), result: { status: "accepted" } }); await revoked.flush(); check(revoked.props.broker, null); check(revoked.props.result, null); yes(request.init.signal.aborted); revoked.unmount(); check(revoked.lateWrites(), 0);
});
await test("Confirmed fill snapshots disclose account mode, cumulative shares and gross-only P&L", () => {
  const value = connected({ recentFills: [{ id: "observed-fill", classification: "broker-live", symbol: "MSFT", side: "sell", clientOrderId: "native-exit", cumulativeFilledQuantity: 3, averageFillPrice: 104, filledAt: now, observedAt: now, grossRealizedPnl: 12, netRealizedPnl: null, feesKnown: false, closedPosition: true, notes: "Exit observed at broker." }] });
  const html = render(props(value)); for (const expected of ["broker-observed fill snapshots", "Live brokerage", "native-exit", "$12.00", "Net result", "Not determined", "cumulative snapshots must not be summed"]) yes(html.includes(expected), expected);
});

if (failures.length) throw new AggregateError(failures, `${failures.length} founder broker UI scenarios failed`);
console.log(`Founder broker, consent and market-stream UI: ${scenarios} scenarios, ${assertions} assertions passed.`);
