import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { BETA_TRACKING_TASKS, runTrackingTask, workerConfiguration } from "../run-beta-worker.mjs";

const require = createRequire(import.meta.url), ts = require("typescript");
const repo = fileURLToPath(new URL("../..", import.meta.url));
let assertions = 0;
const check = (value, expected, message) => { assert.deepEqual(JSON.parse(JSON.stringify(value)), expected, message); assertions++; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => value == null ? value : structuredClone(value);

function harness(env = {}) {
  const rows = new Map(); let locked = false, lockTail = Promise.resolve(), ownerActive = true, executions = 0;
  let work = async () => { await pause(20); return { runId: "run-1", symbol: "MSFT" }; };
  const logger = { child: () => logger, info() {}, warn() {}, error() {} };
  const matches = (row, where) => Object.entries(where || {}).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("lt" in value) return row[key] < value.lt;
      if ("in" in value) return value.in.includes(row[key]);
    }
    return row[key] === value;
  });
  const model = {
    async findUnique({ where }) { return clone(rows.get(where.id)); },
    async findFirst({ where }) { return clone([...rows.values()].find(row => matches(row, where)) || null); },
    async findMany({ where, take }) { return clone([...rows.values()].filter(row => matches(row, where)).slice(0, take)); },
    async update({ where, data }) {
      assert.ok(locked, "All control and worker updates must hold the claim row lock");
      const row = { ...rows.get(where.id), ...clone(data), updatedAt: new Date() }; rows.set(where.id, row); return clone(row);
    },
  };
  const prisma = {
    backendJobRun: model,
    backendPlatformEvent: { async update() { return {}; } },
    backendJobDefinition: { async updateMany() { return { count: 1 }; } },
    user: { async findFirst() { return ownerActive ? { id: "u1", name: "Fixture", email: "fixture@example.test" } : null; } },
    firmMembership: { async findFirst() { return { firmId: "f1" }; } },
    firm: { async findFirst() { return null; } },
    async $queryRaw() { assert.ok(locked); return []; },
    async $transaction(action) {
      const previous = lockTail; let release; lockTail = new Promise(resolve => { release = resolve; }); await previous;
      locked = true;
      try { return await action(prisma); } finally { locked = false; release(); }
    },
  };
  const context = createContext({ console, process: { env }, Buffer, Date, Headers, Response, Request, URL, AbortController, DOMException,
    performance, setTimeout, clearTimeout, setInterval, clearInterval });
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    let source = readFileSync(resolve(repo, file), "utf8");
    if (file.endsWith("background-jobs/worker.ts")) source += "\nexport const __executeClaimedJob = executeClaimedJob;";
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const imports = name => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name === "@/lib/prisma") return { prisma };
      if (name === "@/lib/logger") return { createLogger: () => logger };
      if (name === "@/lib/backend/events") return { emitBackendEvent: async () => ({}) };
      if (name === "@/lib/backend/jobs") return { executeBackendJob: async (...args) => { executions++; return work(...args); }, isSupportedBackgroundJobKey: () => true };
      if (name.startsWith("@/lib/")) return load(`src/lib/${name.slice(6)}.ts`);
      throw new Error(`Unexpected test import: ${name}`);
    };
    runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: file })(imports, module, module.exports);
    return module.exports;
  }
  const policy = load("src/lib/research/beta-policy.ts"), api = load("src/lib/api-route.ts"), queue = load("src/lib/background-jobs/queue.ts");
  function seed(overrides = {}) {
    const now = new Date(), envelope = { version: 1, payload: {}, idempotencyKeyHash: "test", idempotencyEventKey: "fixture", attempt: 1,
      maxAttempts: 2, timeoutMs: 5, backoffMs: 1000, availableAt: now.toISOString(), workerId: "worker-1", lockedAt: now.toISOString(),
      leaseExpiresAt: new Date(Date.now() + 75_000).toISOString(), cancellationRequestedAt: null,
      progress: { value: 2, message: "Working", updatedAt: now.toISOString() }, output: null, lastError: null, queuedAt: now.toISOString(), ...overrides };
    const row = { id: "job-1", userId: "u1", firmId: "f1", jobKey: "intelligence_graph_refresh", jobName: "Research", status: "Processing",
      startedAt: now, completedAt: null, durationMs: null, resultJson: JSON.stringify(envelope), error: null, createdAt: now, updatedAt: now };
    rows.set(row.id, row); return { row: clone(row), envelope };
  }
  return { env, policy, api, queue, load, rows, seed, get executions() { return executions; }, setOwnerActive(value) { ownerActive = value; }, setWork(value) { work = value; } };
}

const h = harness();
check(h.policy.researchBetaEnabled({}), true, "Beta is the release default");
check(h.policy.researchBetaEnabled({ SLICE_PULSE_BETA_UNCAPPED: "false" }), false);
check(h.policy.scenarioTrackingEnabled({}), true);
check(h.policy.scenarioTrackingEnabled({ SLICE_SCENARIO_CRON_ENABLED: "false" }), false);
check(h.policy.scenarioTrackingEnabled({ SLICE_PULSE_BETA_UNCAPPED: "false", SLICE_SCENARIO_CRON_ENABLED: "true" }), true);
assert.throws(() => h.policy.researchBetaEnabled({ SLICE_PULSE_BETA_UNCAPPED: "perhaps" })); assertions++;
let timedSignal;
const handler = h.api.withApiRoute({ route: "/api/test", timeoutMs: 2 }, async ({ signal }) => { timedSignal = signal; await pause(12); return Response.json({ ok: true }); });
check((await handler(new Request("https://example.test/api/test"))).status, 200, "Beta keeps the request beyond its former elapsed cutoff");
check(timedSignal.aborted, false);
h.env.SLICE_PULSE_BETA_UNCAPPED = "false";
const limited = await handler(new Request("https://example.test/api/test"));
check([limited.status, (await limited.json()).error.code, timedSignal.aborted], [504, "ROUTE_TIMEOUT", true]);
h.env.SLICE_PULSE_BETA_UNCAPPED = "true";
const controller = new AbortController(); const cancelled = handler(new Request("https://example.test/api/test", { signal: controller.signal })); controller.abort();
const cancelledResponse = await cancelled;
check([cancelledResponse.status, (await cancelledResponse.json()).error.code], [499, "REQUEST_CANCELLED"], "User cancellation remains effective without a time cutoff");
let started = false; const already = h.api.withApiRoute({ route: "/api/test" }, () => { started = true; return Response.json({}); });
check((await already(new Request("https://example.test/api/test", { signal: controller.signal }))).status, 499);
check(started, false, "An already aborted request cannot begin work");

h.seed({ attempt: 20, leaseExpiresAt: new Date(Date.now() - 1000).toISOString() });
const recovered = await h.queue.failBackgroundJob({ jobId: "job-1", code: "JOB_LEASE_EXPIRED", error: new Error("Interrupted host"), retryable: true });
check(recovered.status, "Retrying", "Hosting interruptions do not exhaust beta research by elapsed time");
check(recovered.attempt, 20, "Recovery retains the true attempt count");
h.seed({ attempt: 20 });
check(await h.queue.failBackgroundJob({ jobId: "job-1", code: "JOB_LEASE_EXPIRED", error: new Error("stale scan"), retryable: true }), null, "Recovery rechecks a renewed lease under the row lock");
check(h.rows.get("job-1").status, "Processing");
h.seed();
await Promise.all([
  h.queue.requestBackgroundJobCancellation({ jobId: "job-1", userId: "u1", firmId: "f1" }),
  h.queue.heartbeatBackgroundJob({ jobId: "job-1", workerId: "worker-1", progress: 70, message: "Late progress" }),
]);
check(Boolean(JSON.parse(h.rows.get("job-1").resultJson).cancellationRequestedAt), true, "Concurrent progress cannot erase cancellation");
check(JSON.parse(h.rows.get("job-1").resultJson).progress.message, "Cancellation requested");
check(await h.queue.completeBackgroundJob({ jobId: "job-1", workerId: "worker-1", output: {} }), null, "Cancellation cannot be overwritten as success");
check((await h.queue.failBackgroundJob({ jobId: "job-1", workerId: "worker-1", code: "JOB_CANCELLED", error: new Error("cancelled"), retryable: false })).status, "Cancelled");
h.seed({ workerId: "new-worker" });
check(await h.queue.completeBackgroundJob({ jobId: "job-1", workerId: "worker-1", output: {} }), null);
check(await h.queue.failBackgroundJob({ jobId: "job-1", workerId: "worker-1", code: "LATE_FAILURE", error: new Error("old worker"), retryable: true }), null);
check((await h.queue.heartbeatBackgroundJob({ jobId: "job-1", workerId: "worker-1" })).active, false);
check(JSON.parse(h.rows.get("job-1").resultJson).workerId, "new-worker");
await assert.rejects(h.queue.requestBackgroundJobCancellation({ jobId: "job-1", userId: "other-user", firmId: "f1" }), e => e.status === 404); assertions++;
h.seed(); await h.queue.completeBackgroundJob({ jobId: "job-1", workerId: "worker-1", output: { runId: "saved" } });
check(await h.queue.failBackgroundJob({ jobId: "job-1", workerId: "worker-1", code: "LATE_FAILURE", error: new Error("late"), retryable: true }), null);
check(h.rows.get("job-1").status, "Complete", "Late cleanup errors cannot reverse a completed result");

const worker = h.load("src/lib/background-jobs/worker.ts");
h.setOwnerActive(false); const inactive = h.seed();
const before = h.executions;
check((await worker.__executeClaimedJob({ workerId: "worker-1", claimed: inactive })).status, "Failed");
check(h.executions, before, "An inactive owner never begins research");
check(JSON.parse(h.rows.get("job-1").resultJson).lastError.code, "JOB_OWNER_INACTIVE");
h.setOwnerActive(true); const betaJob = h.seed();
check((await worker.__executeClaimedJob({ workerId: "worker-1", claimed: betaJob })).status, "Complete", "Beta background work survives its previous5ms deadline");
check(JSON.parse(h.rows.get("job-1").resultJson).output.runId, "run-1");
h.env.SLICE_PULSE_BETA_UNCAPPED = "false"; const standardJob = h.seed();
check((await worker.__executeClaimedJob({ workerId: "worker-1", claimed: standardJob })).status, "Retrying");
check(JSON.parse(h.rows.get("job-1").resultJson).lastError.code, "JOB_TIMEOUT");
await pause(25); check(h.rows.get("job-1").status, "Retrying", "Late operation completion does not complete an expired attempt");

check(workerConfiguration({ CRON_SECRET: "test-secret" }).origin, "http://localhost:3000");
assert.throws(() => workerConfiguration({})); assertions++;
assert.throws(() => workerConfiguration({ CRON_SECRET: "x", SLICE_BETA_WORKER_URL: "http://remote.example.test" })); assertions++;
assert.throws(() => workerConfiguration({ CRON_SECRET: "x", SLICE_BETA_WORKER_URL: "https://user:password@example.test" })); assertions++;
check(BETA_TRACKING_TASKS.length, 5);
check(BETA_TRACKING_TASKS.find(task => task.path === "/api/cron/agent-desk"), { name: "Founder agent monitoring", path: "/api/cron/agent-desk", intervalMs: 15_000 }, "Founder monitoring is included in the independent beta worker tasks");
const stop = new AbortController(), waits = [], calls = []; let active = 0;
await runTrackingTask({ name: "Fixture", path: "/api/cron/test", intervalMs: 10 }, workerConfiguration({ CRON_SECRET: "test-secret" }), stop.signal, {
  log() {}, async fetch(url, init) { check(active++, 0, "Worker checks never overlap"); calls.push({ path: url.pathname, auth: init.headers.authorization, redirect: init.redirect }); await pause(2); active--; return Response.json({ ok: calls.length > 1 }, { status: calls.length > 1 ? 200 : 503 }); },
  async sleep(ms) { waits.push(ms); if (waits.length === 2) stop.abort(); },
});
check(waits, [20, 10], "Failure backoff resets after a successful check");
check(calls[0], { path: "/api/cron/test", auth: "Bearer test-secret", redirect: "error" }, "Cron credentials never follow redirects");
let sleeps = 0;
await runTrackingTask({ name: "Denied", path: "/api/cron/test", intervalMs: 10 }, workerConfiguration({ CRON_SECRET: "x" }), new AbortController().signal,
  { log() {}, fetch: async () => Response.json({}, { status: 401 }), sleep: async () => { sleeps++; } });
check(sleeps, 0, "An unauthorized local worker does not loop on rejected credentials");

// The unwrapped streaming/market routes must obey the same beta policy as
// withApiRoute. A virtual timer advances past real configured deadlines while
// injected provider boundaries wait for release or actual signal cancellation.
const flush = () => new Promise(resolve => setImmediate(resolve));
function routeHarness(beta = true) {
  const env = { SLICE_PULSE_BETA_UNCAPPED: String(beta), CRON_SECRET: "fixture-cron", SLICE_WORKSPACE_PRIME_ENABLED: "true" };
  const timers = new Map(), signals = {}, gates = new Map(), savedStates = []; let elapsed = 0, timerId = 0, releases = 0;
  const schedule = (fn, ms) => { const id = ++timerId; timers.set(id, { fn, at: elapsed + ms }); return id; };
  function elapse(ms) { elapsed += ms; for (const [id, timer] of timers) if (timer.at <= elapsed) { timers.delete(id); timer.fn(); } }
  function stage(name, signal) {
    signals[name] = signal;
    return new Promise((resolve, reject) => {
      const cancelled = () => { signal.removeEventListener("abort", cancelled); reject(signal.reason); };
      gates.set(name, () => { signal.removeEventListener("abort", cancelled); resolve(); });
      if (signal.aborted) cancelled(); else signal.addEventListener("abort", cancelled, { once: true });
    });
  }
  class FixtureError extends Error { constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; } }
  const scope = { userId: "fixture-user", firmId: "fixture-firm" };
  const mocks = {
    "@/lib/studio/request": {
      studioAccess: async () => scope, limitedJson: request => request.json(), PRIVATE_HEADERS: { "Cache-Control": "no-store" },
      limitedBytes: async request => new Uint8Array(await request.arrayBuffer()),
      failure: error => Response.json({ ok: false, code: error.code ?? error.name }, { status: error.status ?? (error.name === "AbortError" ? 499 : 502) }),
    },
    "@/lib/studio/store": {
      acquireOperation: async () => ({ release: async () => { releases++; } }), credentialFingerprint: () => "fixture", saveHealth: async () => {},
      beginTurn: async () => ({ thread: { id: "thread", title: "Fixture" }, previous: [], user: { text: "Fixture prompt" }, assistant: { text: "", state: "running" } }),
      persistThread: async (_scope, _thread, state) => { savedStates.push(state ?? "saved"); },
    },
    "@/lib/studio/core": { StudioError: FixtureError, parseChat: body => ({ mode: "research", research: null, ...body }), conversationInput: () => [] },
    "@/lib/studio/research": { resolveResearch: async () => null, instructions: () => "Fixture instructions" },
    "@/lib/studio/health-state": { healthAfterFailure: () => null },
    "@/lib/studio/market-coverage": { gatherStudioEvidence: async (_scope, _input, _previous, signal) => { await stage("evidence", signal); return null; }, evidenceOnlyText: () => "Fixture evidence" },
    "@/lib/studio/provider": {
      providerConfiguration: () => ({ model: "fixture-model", key: "fixture-only" }),
      openResponse: async input => { signals.open = input.signal; return { requestId: "fixture-request", body: {} }; },
      readResponse: async (_body, signal, delta) => { await stage("text", signal); delta("Fixture response"); return "Fixture response"; },
      testConnection: async signal => { await stage("transport", signal); return { state: "verified", configured: true }; },
      transcribe: async (_file, signal) => { await stage("transport", signal); return { text: "Fixture transcript" }; },
    },
    "@/lib/studio/contracts": { STUDIO_LIMITS: { audioBytes: 3_000_000 } },
    "@/lib/market-evidence/core": { MarketError: FixtureError, parseMarketRequest: body => body },
    "@/lib/market-evidence/provider": { collectMarket: async (_input, _storage, signal) => { await stage("market", signal); return { quotes: [], issues: [] }; } },
    "@/lib/market-evidence/storage": { marketStorage: () => ({}), readMarketHealth: async () => ({}), saveMarketHealth: async () => ({}), readPreferences: async () => ({ preferences: { range: "3M" } }) },
    "@/lib/market-visuals/service": { loadMarketSection: async (_task, _storage, signal) => { await stage("prime", signal); return {}; } },
    "@/lib/instant-workspace/compose": { workspaceRequests: () => [{ section: "quote", symbol: "AAPL" }] },
    "@/lib/access-control": { getAccessContextForUser: async () => ({ user: { id: scope.userId }, firm: { id: scope.firmId } }) },
    "@/lib/prisma": { prisma: { backendPlatformEvent: {
      findMany: async ({ where }) => where.eventType === "SLICE_PULSE_PREFERENCES_V1" ? [{ userId: scope.userId, sourceId: scope.firmId }] : [],
      upsert: async () => ({ id: "fixture-marker", metadataJson: "{}" }), updateMany: async () => ({ count: 1 }),
    } } },
  };
  const context = createContext({ console, process: { env }, Error, Buffer, Date, Headers, Response, Request, URL, File, FormData, ReadableStream, TextEncoder, AbortController, DOMException,
    AbortSignal: { any: signals => AbortSignal.any(signals), timeout(ms) { const controller = new AbortController(); schedule(() => controller.abort(new DOMException("Fixture deadline", "TimeoutError")), ms); return controller.signal; } } });
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = readFileSync(resolve(repo, file), "utf8"), compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const imports = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "node:crypto") return require(name);
      if (name === "@/lib/research/beta-policy") return load("src/lib/research/beta-policy.ts");
      throw new Error(`Unexpected route test import: ${name}`);
    };
    runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: file })(imports, module, module.exports);
    return module.exports;
  }
  return { load, elapse, signals, release: name => gates.get(name)?.(), savedStates, get releases() { return releases; } };
}
const jsonRequest = (url, signal) => new Request(`https://example.test${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Fixture prompt", symbols: ["AAPL"] }), signal });
const streamEvents = async response => (await response.text()).trim().split("\n").filter(Boolean).map(row => JSON.parse(row));

{
  const fixture = routeHarness(), route = fixture.load("src/app/api/ai-studio/chat/route.ts");
  const response = await route.POST(jsonRequest("/api/ai-studio/chat"));
  fixture.elapse(110_000); check(fixture.signals.evidence.aborted, false, "Beta evidence collection survives both former Studio deadlines");
  fixture.release("evidence"); await flush();
  fixture.elapse(110_000); check(fixture.signals.text.aborted, false, "The streamed beta response has no aggregate elapsed cutoff");
  fixture.release("text"); const events = await streamEvents(response);
  check(events.at(-1).type, "complete"); check(events.at(-1).message.state, "complete"); check(fixture.releases, 1, "A completed stream releases its operation lease once");
}
{
  const fixture = routeHarness(false), route = fixture.load("src/app/api/ai-studio/chat/route.ts");
  const response = await route.POST(jsonRequest("/api/ai-studio/chat")); fixture.elapse(45_001);
  check(fixture.signals.evidence.aborted, true, "Standard-mode evidence collection retains its configured limit");
  check((await streamEvents(response)).at(-1).type, "failure"); check(fixture.releases, 1);
  const textFixture = routeHarness(false), textRoute = textFixture.load("src/app/api/ai-studio/chat/route.ts");
  const textResponse = await textRoute.POST(jsonRequest("/api/ai-studio/chat")); textFixture.release("evidence"); await flush(); textFixture.elapse(100_001);
  check(textFixture.signals.text.aborted, true, "Standard-mode response generation retains its configured limit");
  check((await streamEvents(textResponse)).at(-1).type, "failure");
}
{
  const fixture = routeHarness(), control = new AbortController(), route = fixture.load("src/app/api/ai-studio/chat/route.ts");
  const response = await route.POST(jsonRequest("/api/ai-studio/chat", control.signal)); control.abort();
  check(fixture.signals.evidence.aborted, true, "Beta forwards client cancellation to evidence collection");
  const events = await streamEvents(response); check(events.at(-1).type, "failure"); check(fixture.releases, 1);
  const cancelled = routeHarness(), cancelRoute = cancelled.load("src/app/api/ai-studio/chat/route.ts");
  const cancelResponse = await cancelRoute.POST(jsonRequest("/api/ai-studio/chat")); await cancelResponse.body.cancel(); await flush();
  check(cancelled.signals.evidence.aborted, true, "Cancelling the output stream stops its beta operation"); check(cancelled.releases, 1);
}

for (const kind of ["market", "prime"]) {
  const file = kind === "market" ? "src/app/api/market-evidence/route.ts" : "src/app/api/workspace/prime/route.ts";
  const invoke = (fixture, signal) => kind === "market" ? fixture.load(file).POST(jsonRequest("/api/market-evidence", signal)) : fixture.load(file).GET(new Request("https://example.test/api/workspace/prime", { headers: { authorization: "Bearer fixture-cron" }, signal }));
  for (const beta of [true, false]) {
    const fixture = routeHarness(beta), running = invoke(fixture); await flush(); fixture.elapse(60_000);
    check(fixture.signals[kind].aborted, !beta, `${kind} aggregate deadline follows the beta policy`);
    if (beta) fixture.release(kind);
    const body = await (await running).json();
    check(kind === "market" ? body.ok : body.completed, beta ? (kind === "market" ? true : 1) : (kind === "market" ? false : 0));
  }
  const fixture = routeHarness(), control = new AbortController(), running = invoke(fixture, control.signal); await flush(); control.abort(); await running;
  check(fixture.signals[kind].aborted, true, `${kind} request cancellation remains effective in beta`);
}

// Connection tests and transcription are single external requests, so their
// transport recovery bounds remain active even while aggregate beta work is uncapped.
for (const kind of ["connection", "transcribe"]) {
  const fixture = routeHarness(), route = fixture.load(`src/app/api/ai-studio/${kind}/route.ts`);
  let request;
  if (kind === "connection") request = new Request("https://example.test/api/ai-studio/connection", { method: "POST", body: JSON.stringify({ confirm: true }) });
  else { const form = new FormData(); form.append("audio", new File([new Uint8Array([0, 1, 2])], "fixture.webm", { type: "audio/webm" })); request = new Request("https://example.test/api/ai-studio/transcribe", { method: "POST", body: form }); }
  const running = route.POST(request);
  for (let i = 0; i < 20 && !fixture.signals.transport; i++) await flush();
  assert.ok(fixture.signals.transport, `${kind} must reach the injected provider before advancing time`);
  fixture.elapse(45_001);
  check(fixture.signals.transport.aborted, true, `${kind} retains its individual provider transport bound`);
  const response = await running, body = await response.json();
  check(kind === "connection" ? body.health.state : body.code, kind === "connection" ? "timeout" : "AUDIO_TIMEOUT"); check(fixture.releases, 1);
}

// Email fallback can outlast its former total budget. Each simulated provider
// request still has its own deadline and manual cancellation signal.
function emailHarness(beta, mode, onFetch, onBody) {
  let now = Date.parse("2026-11-19T19:00:00Z"), serial = 0, calls = 0;
  const timers = new Map(), durations = [], env = { SLICE_PULSE_BETA_UNCAPPED: String(beta), OPENAI_API_KEY: "fixture-key-with-no-network-access", OPENAI_EMAIL_FAST_MODEL: "fixture-first", OPENAI_EMAIL_QUALITY_MODEL: "fixture-first" };
  class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now); } static now() { return now; } }
  const context = createContext({ console, process: { env }, Error, Date: Clock, Headers, Response, Request, AbortController, DOMException,
    setTimeout(fn, ms) { const id = ++serial; durations.push(ms); timers.set(id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id),
    async fetch(_url, init) {
      calls++; onFetch?.(); now += calls < 5 ? (mode === "Quick" ? 18_000 : 36_000) : 1_000;
      for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
      if (init.signal.aborted) throw init.signal.reason;
      const response = calls < 5
        ? Response.json({ error: { message: "Fixture temporary provider failure" } }, { status: 503 })
        : Response.json({ status: "completed", output_text: JSON.stringify({ options: [{ subject: "Fixture follow-up", body: "Hello, this is a complete fixture response for testing saved generation fallback after provider failures. Please review the source records before making any changes.", strategy: "Fixture", complianceNotes: [], promptCoverage: [], factsUsed: [] }] }) });
      if (onBody) { const json = response.json.bind(response); response.json = async () => { onBody(init.signal); return json(); }; }
      return response;
    },
  });
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const compiled = ts.transpileModule(readFileSync(resolve(repo, file), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const imports = name => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return require(name);
      if (name === "@/lib/env") return { getOptionalEnv: key => env[key] ?? "" };
      if (name === "@/lib/integrations/ai") return { getOpenAiRuntimeStatus: () => ({ fastModel: "fixture-second", qualityModel: "fixture-second", model: "fixture-last" }) };
      if (name === "@/lib/research/beta-policy") return load("src/lib/research/beta-policy.ts");
      throw new Error(`Unexpected email test import: ${name}`);
    };
    runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: file })(imports, module, module.exports);
    return module.exports;
  }
  return { generator: load("src/lib/email-center/ai-generator.ts"), durations, get calls() { return calls; } };
}
for (const mode of ["Quick", "Researched"]) {
  const input = { prompt: "Fixture prompt", instructions: "Fixture instructions", optionCount: 1, speedMode: mode, safetyIdentifier: "fixture-user" };
  const beta = emailHarness(true, mode), betaResult = await beta.generator.generateCustomAiEmailOptions(input);
  check([betaResult.ok, beta.calls, betaResult.options.length], [true, 5, 1], `${mode} beta generation continues to a successful model beyond the former total budget`);
  check(beta.durations, Array(5).fill(mode === "Quick" ? 20_000 : 38_000), "Individual provider transport deadlines remain finite");
  const standard = emailHarness(false, mode), standardResult = await standard.generator.generateCustomAiEmailOptions(input);
  check([standardResult.ok, standard.calls, standardResult.options.length], [false, 4, 0], `${mode} standard mode keeps its configured aggregate budget`);
  const cancelled = emailHarness(true, mode), control = new AbortController(); control.abort();
  await assert.rejects(cancelled.generator.generateCustomAiEmailOptions({ ...input, signal: control.signal }), error => error.name === "AbortError"); assertions++;
  check(cancelled.calls, 0, "An already cancelled generation cannot start a provider request");
  const midwayControl = new AbortController(), midway = emailHarness(true, mode, () => midwayControl.abort());
  await assert.rejects(midway.generator.generateCustomAiEmailOptions({ ...input, signal: midwayControl.signal }), error => error.name === "AbortError"); assertions++;
  check(midway.calls, 1, "Cancellation during a provider request stops further model fallback");
  const bodyControl = new AbortController(), body = emailHarness(true, mode, undefined, signal => { bodyControl.abort(); check(signal.aborted, true, "Caller cancellation still reaches an email response body after headers arrive"); });
  await assert.rejects(body.generator.generateCustomAiEmailOptions({ ...input, signal: bodyControl.signal }), error => error.name === "AbortError"); assertions++;
  check(body.calls, 1, "A cancelled response body cannot advance to a fallback model or successful result");
}
console.log(`Beta runtime checks passed (${assertions} assertions): application and aggregate route deadlines, stream cancellation, provider transport bounds, email model fallback, durable lease recovery, scoped/fenced worker writes, inactive owners, and continuous-worker behavior.`);
