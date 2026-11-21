import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

// Production Scout lifecycle and desk-store validation/CAS; controlled provider,
// model, access checks, job queue and transactional storage. No network or DB.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const NOW = new Date("2026-11-20T15:00:00.000Z"), scope = { userId: "founder-fixture", firmId: "firm-fixture" };
let checks = 0;
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); checks++; };
const yes = (actual, message) => { assert.ok(actual, message); checks++; };
const rejects = async (callback, code) => { await assert.rejects(callback, error => error.code === code); checks++; };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW.getTime()])); } static now() { return NOW.getTime(); } }

const mocks = {}, cache = new Map(), environment = { env: { ALPHA_VANTAGE_API_KEY: "fixture-only" } };
const context = vm.createContext({ Date: Clock, Buffer, structuredClone, URL, AbortController, AbortSignal, DOMException, process: environment,
  fetch: () => { throw Error("Live network must never be used by Scout lifecycle tests"); } });
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
const contracts = load("src/lib/agent-desk/contracts.ts"), guardrails = load("src/lib/agent-desk/guardrails.ts");
const { AgentDeskError } = contracts;
let database, allowed, calls, hooks, modelPatch, inventory, apiKey;
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
function table(bucket) {
  return {
    findFirst: async ({ where }) => [bucket.state, ...bucket.events].find(row => matches(row, where)) ?? null,
    updateMany: async ({ where, data }) => {
      if (!matches(bucket.state, where)) return { count: 0 };
      bucket.state = { ...bucket.state, ...data }; return { count: 1 };
    },
    create: async ({ data }) => {
      same(data.userId, scope.userId); same(data.firmId, scope.firmId);
      if (bucket.events.some(row => row.eventKey === data.eventKey && row.userId === data.userId)) throw Error("Unique event replay");
      const row = { id: `receipt-${bucket.events.length}`, ...structuredClone(data) }; bucket.events.push(row); return row;
    },
    upsert: async () => { throw Error("Unexpected state initialization"); },
  };
}
const prisma = {
  backendPlatformEvent: {
    findFirst: input => table(database).findFirst(input), updateMany: input => table(database).updateMany(input), create: input => table(database).create(input), upsert: input => table(database).upsert(input),
  },
  backendJobRun: { findFirst: async ({ where }) => {
    same(where.userId, scope.userId); same(where.firmId, scope.firmId);
    return database.jobs.find(row => row.id === where.id) ?? null;
  } },
  $transaction: async callback => {
    if (hooks.beforeTransaction) { const run = hooks.beforeTransaction; hooks.beforeTransaction = null; await run(); }
    const draft = structuredClone(database), transaction = { backendPlatformEvent: table(draft), draft };
    const result = await callback(transaction);
    if (hooks.beforeTransactionCommit) { const run = hooks.beforeTransactionCommit; hooks.beforeTransactionCommit = null; await run(); }
    database = draft; return result;
  },
};
mocks["@/lib/prisma"] = { prisma };
mocks["@/lib/data-readiness/core"] = { configured: value => Boolean(value) };
mocks["@/lib/data-readiness/server"] = { requireResearchStorage: async models => { same(models, ["BackendPlatformEvent"], "The schema probe uses a table it actually inventories"); } };
mocks["./access"] = { requireAgentDeskAccess: async actor => {
  calls.access++;
  if (!allowed || actor.userId !== scope.userId || actor.firmId !== scope.firmId) throw new AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "Configured founder required", 403);
  return { user: { id: scope.userId }, firm: { id: scope.firmId } };
} };
mocks["@/lib/background-jobs/queue"] = {
  enqueueBackgroundJob: async input => {
    same(input.context, scope); same(input.jobKey, "agent_desk_scout");
    calls.queued.push(plain(input));
    if (hooks.enqueue) await hooks.enqueue();
    const job = { id: `job-${calls.queued.length}`, status: "Queued" }; database.jobs.push(job); return { job, duplicate: false };
  },
  requestBackgroundJobCancellation: async input => { same(input.userId, scope.userId); same(input.firmId, scope.firmId); calls.canceled.push(input.jobId); },
};
const candidate = symbol => ({ symbol, name: `Controlled ${symbol}`, rank: 1, reason: "Observed controlled activity", origins: ["most-active"], observedAt: "2026-11-19T21:00:00.000Z", retrievedAt: NOW.toISOString(), price: 100, changePct: 2, volume: 1000000, state: "end-of-day", source: "Controlled provider", sourceUrl: "https://provider.example/source", sourceSha256: "a".repeat(64), tradableByPolicy: false });
const discovery = () => ({ version: 1, checkedAt: NOW.toISOString(), candidates: inventory.map(candidate), receipts: [], issues: [], refreshAfterMs: 60000, scannedCount: inventory.length, method: "Controlled genuine-inventory boundary", tradingAllowlistChanged: false });
const evidence = value => value.candidates.map(row => ({ id: `desk-scout-${row.symbol}`, title: row.name, summary: row.reason, source: row.source, url: row.sourceUrl, observedAt: row.observedAt, retrievedAt: row.retrievedAt, kind: "tool-research", cohort: "discovery", metrics: { symbol: row.symbol } }));
mocks["./research-tools"] = {
  discoverScoutCandidates: async (actor, input) => {
    same(actor, scope); calls.discovery.push(plain({ universe: input.universe, limit: input.limit, exclude: input.exclude }));
    input.signal.throwIfAborted(); if (hooks.discovery) await hooks.discovery(); return discovery();
  },
  scoutDiscoveryEvidence: evidence,
};
mocks["./learning"] = { readAgentLearning: async (actor, input) => { same(actor, scope); calls.learning++; return { version: "fixture-learning", lessons: [], closedTrades: 0, generatedAt: input.now }; } };
mocks["./collaboration"] = {
  readAgentBoard: async (actor, input) => { same(actor, scope); calls.board++; return database.messages.filter(row => row.createdAt <= input.before); },
  appendAgentBoardMessage: async (actor, input, transaction) => {
    same(actor, scope); yes(Boolean(transaction?.draft), "Scout messages are written inside the state/receipt transaction");
    if (hooks.append) await hooks.append();
    for (const reply of input.replyToIds) {
      const parent = transaction.draft.messages.find(row => row.id === reply);
      if (!parent || parent.cycleId !== input.cycleId) throw new AgentDeskError("INVALID_AGENT_REPLY", "Reply is outside this exact discussion");
    }
    transaction.draft.messages.push({ ...plain(input), version: 1 }); return input;
  },
  writeCycleArtifacts: async () => { throw Error("Scout cannot create paper trade artifacts"); },
};
mocks["./agents"] = {
  agentProviderConfiguration: () => ({ key: apiKey, model: "fixture-model" }),
  runResearchAgent: async (role, input, peers, actor) => {
    same(role, "scout"); same(peers, []); same(input.purpose, "discovery"); same(input.score, null); same(actor.ownerId, scope.userId);
    yes(input.learning && input.board, "The real Scout receives shared learning and Team Board context");
    await actor.authorize(); calls.model++;
    if (hooks.model) await hooks.model();
    return { role: "scout", status: "complete", stance: "neutral", summary: "Investigate the observed candidate before making any investment decision.", findings: [{ claim: "The controlled candidate has an observed activity record.", evidenceIds: ["desk-scout-TEST"] }], risks: ["Discovery is not a trade thesis."], missingData: ["Full intelligence review is still required."], veto: false,
      action: "hold", allocationPct: null, model: "fixture-model", requestId: "request-fixture", startedAt: NOW.toISOString(), completedAt: NOW.toISOString(), error: null, candidateSymbol: "TEST", phase: "discovery", round: 0,
      messages: [{ to: "news", body: "Investigate recent original reports for the observed candidate.", evidenceIds: ["desk-scout-TEST"], replyToIds: [] }], ...modelPatch };
  },
};
const store = load("src/lib/agent-desk/store.ts"), scouting = load("src/lib/agent-desk/scouting.ts");
function reset(settings = {}) {
  allowed = true; hooks = {}; modelPatch = {}; inventory = ["TEST", "OTHER"]; apiKey = "fixture-key";
  calls = { access: 0, queued: [], canceled: [], discovery: [], model: 0, learning: 0, board: 0 };
  const state = { version: 1, revision: 0, settings: { symbol: "MSFT", intervalMinutes: 15, initialCapital: 10000, policy: structuredClone(guardrails.DEFAULT_DESK_POLICY), scouting: { ...contracts.DEFAULT_DESK_SCOUTING, enabled: true, autoResearch: true, ...settings } },
    controls: { ...guardrails.DEFAULT_DESK_CONTROLS }, account: guardrails.createPaperAccount({ initialCapital: 10000, now: NOW.toISOString() }), busy: null, scouting: store.emptyScoutingState(), latestCycleId: null, nextRunAt: null, lastCheckedAt: null, lastError: null, updatedAt: NOW.toISOString() };
  database = { state: { id: "state-fixture", ...scope, eventKey: `agent-desk-state:${scope.firmId}`, eventType: store.DESK_STATE_EVENT, status: "Scouting", metadataJson: store.encodeDeskEnvelope(state) }, events: [], jobs: [], messages: [] };
}
function state() { return store.decodeDeskEnvelope(database.state.metadataJson); }
function mutate(callback) { const next = state(); callback(next); database.state.metadataJson = store.encodeDeskEnvelope(next); }
async function queued(scheduled = false) {
  const id = await scouting.queueDeskScout(scope, state().revision, scheduled);
  return id ? { jobId: id, scope, payload: calls.queued.at(-1).payload, signal: new AbortController().signal, progress: async () => {} } : null;
}

reset();
const originalAccount = plain(state().account), originalPolicy = plain(state().settings.policy), runtime = await queued(true);
yes(runtime && state().scouting.busy.jobId === runtime.jobId);
const first = await scouting.runDeskScoutJob(runtime);
same(first.selectedSymbol, "TEST"); same(first.queuedForResearch, true);
same(state().scouting.pendingResearch, { scanId: runtime.payload.scanId, symbol: "TEST", selectedAt: NOW.toISOString() });
same(state().account, originalAccount, "Scout does not modify the paper account"); same(state().settings.policy, originalPolicy, "Scout never widens the user's execution allowlist");
same(state().scouting.busy, null); same(state().scouting.nextScanAt, "2026-11-20T15:15:00.000Z");
same(database.events.length, 1); same(database.events[0].eventType, scouting.DESK_SCOUT_EVENT);
same(database.messages.length, 2, "Both the actual Scout report and its addressed message are durable");
same(database.messages[0].report.candidateSymbol, "TEST"); same(database.messages[1].to, "news");
yes(calls.access >= 8, "Founder authorization is rechecked around tools, model calls and transaction commit");
const replay = await scouting.runDeskScoutJob(runtime);
same(replay.reused, true); same(calls.model, 1); same(database.events.length, 1); same(database.messages.length, 2, "Job replay does not duplicate provider work or discussion");
allowed = false;
await rejects(() => scouting.runDeskScoutJob(runtime), "FOUNDER_AGENT_ACCESS_REQUIRED");
same(calls.model, 1, "A revoked founder cannot replay a private receipt");
allowed = true;
await rejects(() => scouting.runDeskScoutJob({ ...runtime, scope: { ...scope, userId: "different-user" } }), "FOUNDER_AGENT_ACCESS_REQUIRED");
await rejects(() => queued(), "SCOUT_RESEARCH_PENDING");
same(state().scouting.pendingResearch.symbol, "TEST", "A new scan cannot overwrite an undrained research outbox");

reset({ enabled: false });
same(await queued(true), null, "Continuous discovery is opt-in");
const manual = await queued(false); yes(manual, "Manual discovery is possible while paper trading is paused");
same((await scouting.runDeskScoutJob(manual)).queuedForResearch, false, "Disabled discovery does not silently enable automatic research");
reset({ autoResearch: false });
same((await scouting.runDeskScoutJob(await queued())).queuedForResearch, false);
same(state().scouting.pendingResearch, null);
reset(); mutate(value => { value.scouting.nextScanAt = "2026-11-20T16:00:00.000Z"; });
same(await queued(true), null, "The scheduled interval is respected");
reset(); mutate(value => { value.controls.killSwitch = true; });
await rejects(() => queued(), "DESK_KILLED"); same(calls.queued.length, 0);
reset(); apiKey = "";
await rejects(() => queued(), "SCOUT_PROVIDERS_REQUIRED"); same(calls.queued.length, 0);

for (const phase of ["discovery", "model"]) {
  reset(); const run = await queued();
  hooks[phase] = async () => { allowed = false; };
  await rejects(() => scouting.runDeskScoutJob(run), "FOUNDER_AGENT_ACCESS_REQUIRED");
  same(database.events.length, 0); same(database.messages.length, 0); same(state().scouting.pendingResearch, null);
  same(calls.model, phase === "model" ? 1 : 0, "Revocation prevents the next stage and any commit");
}
reset(); const changedSettings = await queued();
hooks.discovery = async () => mutate(value => { value.revision++; value.scouting.busy = null; value.settings.scouting.universe = ["OTHER"]; });
await rejects(() => scouting.runDeskScoutJob(changedSettings), "SCOUT_SUPERSEDED");
same(state().settings.scouting.universe, ["OTHER"]); same(database.events.length, 0);
reset(); const killed = await queued();
hooks.model = async () => mutate(value => { value.revision++; value.controls.killSwitch = true; value.scouting.busy = null; });
await rejects(() => scouting.runDeskScoutJob(killed), "SCOUT_SUPERSEDED");
same(state().controls.killSwitch, true); same(state().scouting.pendingResearch, null); same(database.messages.length, 0);

for (const patch of [{ candidateSymbol: "INVENTED" }, { action: "buy", allocationPct: 5 }, { candidateSymbol: "OTHER" }, { findings: [{ claim: "Unknown evidence", evidenceIds: ["other-owner-source"] }] }]) {
  reset(); modelPatch = patch;
  await rejects(async () => scouting.runDeskScoutJob(await queued()), patch.action ? "SCOUT_RESEARCH_ONLY" : "SCOUT_SELECTION_INVALID");
  same(database.events.length, 0); same(state().scouting.pendingResearch, null); same(state().account.sequence, 0);
}
reset(); inventory = [];
const empty = await scouting.runDeskScoutJob(await queued());
same(empty.selectedSymbol, null); same(calls.model, 0, "No AI participation is invented when discovery has no evidence");
same(database.messages[0].from, "system"); same(database.messages[0].report, undefined);
reset(); modelPatch = { status: "failed", candidateSymbol: null, findings: [], messages: [], error: "Controlled model failure" };
same((await scouting.runDeskScoutJob(await queued())).selectedSymbol, null);
same(state().scouting.lastError, "Controlled model failure"); same(database.messages[0].report.status, "failed");

reset(); const expire = await queued();
mutate(value => { value.scouting.busy.expiresAt = "2026-11-20T14:59:00.000Z"; });
const recovered = await queued();
yes(recovered.payload.scanId !== expire.payload.scanId, "An expired lease receives a new unique scan identity");
await rejects(() => scouting.runDeskScoutJob(expire), "SCOUT_SUPERSEDED");
same(state().scouting.busy.id, recovered.payload.scanId);
await scouting.runDeskScoutJob(recovered);
reset(); const renewal = await queued();
mutate(value => { value.scouting.busy.expiresAt = "2026-11-20T15:01:00.000Z"; });
hooks.discovery = async () => yes(Date.parse(state().scouting.busy.expiresAt) - NOW.getTime() >= 20 * 60000, "A healthy owned lease is renewed before expensive stages");
await scouting.runDeskScoutJob(renewal);

for (const reason of ["revision", "kill", "disabled", "terminal"]) {
  reset(); const stranded = await queued(true);
  if (reason === "revision") mutate(value => { value.revision++; });
  if (reason === "kill") mutate(value => { value.controls.killSwitch = true; });
  if (reason === "disabled") mutate(value => { value.settings.scouting.enabled = false; });
  if (reason === "terminal") database.jobs[0].status = "Cancelled";
  const recoveredRecord = await scouting.recoverScoutLease(scope);
  same(recoveredRecord.state.scouting.busy, null, `Scheduler can recover a ${reason} lease before queue eligibility checks`);
  yes(calls.canceled.includes(stranded.jobId), "Revoked leases also cancel their exact durable job");
}
reset({ enabled: false }); await queued(false);
yes((await scouting.recoverScoutLease(scope)).state.scouting.busy, "Disabled continuous discovery does not cancel a valid manual scan");
allowed = false;
await rejects(() => scouting.recoverScoutLease(scope), "FOUNDER_AGENT_ACCESS_REQUIRED");

reset(); const conflict = await queued();
hooks.beforeTransaction = async () => mutate(value => { value.lastCheckedAt = "2026-11-20T14:55:00.000Z"; });
await scouting.runDeskScoutJob(conflict);
same(state().lastCheckedAt, "2026-11-20T14:55:00.000Z", "CAS retry preserves unrelated concurrent state changes");
same(database.events.length, 1); same(database.messages.length, 2);
reset(); const transactionalRevocation = await queued();
hooks.beforeTransaction = async () => { allowed = false; };
await rejects(() => scouting.runDeskScoutJob(transactionalRevocation), "FOUNDER_AGENT_ACCESS_REQUIRED");
same(database.events.length, 0); same(database.messages.length, 0); same(state().scouting.pendingResearch, null, "Revocation at the commit boundary rolls back the complete handoff");
reset(); const badReply = await queued();
modelPatch = { messages: [{ to: "chief", body: "Wrong thread reply", evidenceIds: ["desk-scout-TEST"], replyToIds: ["old-cycle-message"] }] };
await rejects(() => scouting.runDeskScoutJob(badReply), "INVALID_AGENT_REPLY");
same(database.events.length, 0); same(state().scouting.pendingResearch, null, "A failed board write rolls back the state and receipt together");
reset(); const canceled = await queued(), controller = new AbortController();
controller.abort();
await assert.rejects(() => scouting.runDeskScoutJob({ ...canceled, signal: controller.signal }), error => error.name === "AbortError"); checks++;
same(calls.discovery.length, 0); same(calls.model, 0);
console.log(`Agent desk Scout lifecycle: ${checks} assertions passed (controlled I/O; production leases and CAS store).`);
