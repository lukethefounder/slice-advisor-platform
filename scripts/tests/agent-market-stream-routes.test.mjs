import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url), ts = require("typescript"), repo = fileURLToPath(new URL("../..", import.meta.url));
let assertions = 0, scenarios = 0; const failures = [];
const check = (a, b, message) => { assert.deepEqual(a, b, message); assertions++; }, yes = (a, message) => { assert.ok(a, message); assertions++; };
const settle = () => new Promise(done => setImmediate(done));
async function test(name, action) { try { await action(); scenarios++; } catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); } }
class ApiError extends Error { constructor(input) { super(input.message); Object.assign(this, input); } }
class AgentDeskError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status; } }
const api = { ApiError, withApiRoute: (_options, fn) => request => fn({ request }), apiJson: (value, init) => Response.json(value, init) };
function load(path, dependencies, extra = {}) {
  const source = readFileSync(resolve(repo, path), "utf8"), module = { exports: {} };
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true }); check(result.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
  const names = Object.keys(extra), values = Object.values(extra);
  new Function("require", "module", "exports", ...names, result.outputText)(name => dependencies[name] ?? (name.startsWith("node:") ? require(name) : (() => { throw new Error(`Unexpected import ${name}`); })()), module, module.exports, ...values);
  return module.exports;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function sse() {
  const timers = new Map(), abort = new AbortController(), scope = { userId: "founder", firmId: "firm" }; let timerId = 0, time = 0;
  const h = { timers, abort, scope, reads: 0, sessionChecks: 0, founderChecks: 0, sessionError: null, founderError: null, nextScope: null, readError: null, readImpl: null };
  class Clock extends Date { static now() { return time; } }
  const route = load("src/app/api/intelligence/agent-desk/market-stream/route.ts", {
    "@/lib/api-route": api, "@/lib/agent-desk/contracts": { AgentDeskError },
    "@/lib/connected-research/access": { connectedAccess: async () => { h.sessionChecks++; if (h.sessionError) throw h.sessionError; return h.nextScope || scope; } },
    "@/lib/agent-desk/access": { requireAgentDeskAccess: async actor => { h.founderChecks++; check(actor, h.nextScope || scope); if (h.founderError) throw h.founderError; } },
    "@/lib/agent-desk/market-stream": { readAgentMarket: async actor => { h.reads++; check(actor, scope); if (h.readError) throw h.readError; return h.readImpl ? h.readImpl() : { version: 1, status: "offline", feed: null, checkedAt: "2026-11-21T00:00:00Z", lastMessageAt: null, quotes: [], message: "No observations" }; } },
  }, { Date: Clock, setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, due: time + ms }); return id; }, clearTimeout(id) { timers.delete(id); } });
  h.start = () => route.GET(new Request("http://localhost/api/intelligence/agent-desk/market-stream", { signal: abort.signal }));
  h.advance = async ms => { const target = time + ms; while (true) { await settle(); const item = [...timers].filter(([, value]) => value.due <= target).sort((a, b) => a[1].due - b[1].due)[0]; if (!item) break; timers.delete(item[0]); time = item[1].due; item[1].fn(); } time = target; await settle(); };
  return h;
}

await test("SSE rejects unauthorized founders before reading any market data", async () => {
  const h = sse(); h.founderError = new AgentDeskError("FOUNDER_ONLY", "Denied", 403); await assert.rejects(h.start(), error => error.status === 403); assertions++; check(h.reads, 0); check(h.timers.size, 0);
});
await test("SSE response is private, noncacheable and bounds queued snapshots for a slow consumer", async () => {
  const h = sse(), response = await h.start(); check(response.headers.get("content-type"), "text/event-stream"); yes(response.headers.get("cache-control").includes("private, no-store")); check(response.headers.get("vary"), "Cookie");
  await h.advance(5000); check(h.reads, 1, "Only one unread snapshot is queued"); const reader = response.body.getReader(), first = await reader.read(); yes(new TextDecoder().decode(first.value).includes("event: market")); await reader.cancel(); await settle(); check(h.timers.size, 0);
});
await test("Request abort closes a pending read immediately and ignores a later database result", async () => {
  const h = sse(), pending = deferred(); h.readImpl = () => pending.promise; const response = await h.start(), reader = response.body.getReader(), waiting = reader.read(); h.abort.abort();
  check((await waiting).done, true); check(h.timers.size, 0); pending.resolve({ private: "late-result" }); await settle(); check((await reader.read()).done, true); check(h.timers.size, 0);
});
await test("A pre-aborted request creates a closed stream and no data lookup", async () => {
  const h = sse(); h.abort.abort(); const response = await h.start(); check((await response.body.getReader().read()).done, true); check(h.reads, 0);
});
await test("Original session revocation is rechecked at 30 seconds even while the client is not draining snapshots", async () => {
  const h = sse(), response = await h.start(); h.sessionError = new ApiError({ status: 401, code: "SESSION_REVOKED", message: "Private internal session detail" });
  await h.advance(29_000); check(h.sessionChecks, 1); await h.advance(1000); check(h.sessionChecks, 2); const reader = response.body.getReader(); await reader.read(); const event = new TextDecoder().decode((await reader.read()).value); yes(event.includes("event: revoked")); yes(!event.includes("Private internal")); check((await reader.read()).done, true); check(h.timers.size, 0);
});
await test("Changed session identity closes rather than switching a private stream to another firm", async () => {
  const h = sse(), response = await h.start(); h.nextScope = { userId: "founder", firmId: "other" }; await h.advance(30_000); const reader = response.body.getReader(); await reader.read(); yes(new TextDecoder().decode((await reader.read()).value).includes("event: revoked")); check((await reader.read()).done, true); check(h.reads, 1);
});
await test("Data read failures expose a generic status without raw private error details", async () => {
  const h = sse(); h.readError = new Error("SQL contained fixture-private-key"); const response = await h.start(), reader = response.body.getReader(); const event = new TextDecoder().decode((await reader.read()).value); yes(event.includes('"status":"error"')); yes(!event.includes("fixture-private-key")); await reader.cancel(); await settle(); check(h.timers.size, 0);
});

function cron() {
  const h = { configurations: 0, ingests: [] };
  h.route = load("src/app/api/cron/agent-market/route.ts", { "@/lib/api-route": api, "@/lib/agent-desk/contracts": { AgentDeskError }, "@/lib/agent-desk/market-stream": {
    agentMarketWorkerConfiguration: async () => { h.configurations++; return { connections: [{ key: "fixture-private-key", secret: "fixture-private-secret" }] }; },
    ingestAgentMarket: async value => { h.ingests.push(value); return { accepted: 0 }; },
  } }, { process: { env: { CRON_SECRET: "test-worker-secret" } } });
  h.request = (body, headers = {}) => new Request("http://localhost/api/cron/agent-market", { method: body === undefined ? "GET" : "POST", ...(body === undefined ? {} : { body }), headers: { authorization: "Bearer test-worker-secret", ...headers } });
  return h;
}
await test("Credential-bearing cron configuration requires exact authorization and is never publicly cacheable", async () => {
  const h = cron(); for (const authorization of ["", "Bearer wrong", "test-worker-secret", "Bearer  test-worker-secret"]) { await assert.rejects(h.route.GET(h.request(undefined, { authorization })), error => error.status === 401); assertions++; }
  check(h.configurations, 0); const response = await h.route.GET(h.request()); yes(response.headers.get("cache-control").includes("private, no-store")); check(response.headers.get("vary"), "Authorization"); const value = await response.json(); check(value.connections[0].key, "fixture-private-key"); check(h.configurations, 1);
});
await test("Cron input size is bounded for unadvertised bodies and malformed JSON never reaches persistence", async () => {
  const h = cron(); await assert.rejects(h.route.POST(h.request("x".repeat(32_769))), error => error.status === 413); assertions++;
  await assert.rejects(h.route.POST(h.request("{}", { "content-length": "40000" })), error => error.status === 413); assertions++;
  await assert.rejects(h.route.POST(h.request("not-json")), error => error.status === 400); assertions++; check(h.ingests.length, 0);
  const response = await h.route.POST(h.request(JSON.stringify({ id: "owner-stream", quotes: [] }))); check((await response.json()).accepted, 0); check(h.ingests.length, 1); yes(response.headers.get("cache-control").includes("no-store"));
});

if (failures.length) throw new AggregateError(failures, `${failures.length} market stream route scenarios failed`);
console.log(`Market stream routes: ${scenarios} scenarios, ${assertions} assertions passed.`);
