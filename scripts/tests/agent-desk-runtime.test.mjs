import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript");
let assertions = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (actual, message) => { assert.ok(actual, message); assertions++; };
const throws = (fn, code, message) => { assert.throws(fn, error => error.code === code, message); assertions++; };
const rejected = async (fn, predicate, message) => { await assert.rejects(fn, predicate, message); assertions++; };
const clone = value => structuredClone(value);
const timers = new Map(); let nextTimer = 0, forbiddenFetches = 0;
const environment = { env: {} };
async function load(path, dependencies = {}, extra = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: path, reportDiagnostics: true });
  same(output.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`);
  const module = { exports: {} };
  const resolve = specifier => Object.hasOwn(dependencies, specifier) ? dependencies[specifier] : specifier === "server-only" ? {} : specifier.startsWith("node:") ? require(specifier) : (() => { throw new Error(`Unmocked dependency: ${specifier}`); })();
  new Function("require", "module", "exports", "process", "fetch", "setTimeout", "clearTimeout", "Date", output.outputText)(resolve, module, module.exports,
    extra.process ?? environment, extra.fetch ?? (() => { forbiddenFetches++; throw new Error("Unexpected live network call"); }),
    extra.setTimeout ?? ((callback, delay) => { same(delay, 90000, "Individual AI transports are bounded"); const id = ++nextTimer; timers.set(id, callback); return id; }),
    extra.clearTimeout ?? (id => timers.delete(id)), extra.Date ?? Date);
  return module.exports;
}
const guards = await load("src/lib/agent-desk/guardrails.ts");
const contracts = await load("src/lib/agent-desk/contracts.ts");
const operations = await load("src/lib/agent-desk/operations.ts", { "./contracts": contracts });
const researchAccessCore = await load("src/lib/agent-desk/research-access-core.ts", { "./contracts": contracts });
const instruments = await load("src/lib/intelligence/research-instrument.ts");
const agents = await load("src/lib/agent-desk/agents.ts", { "./contracts": contracts });
const { AGENT_ROLES } = contracts;
const { runResearchAgent, runSixAgentTeam, executeAgentReadTool, validateAgentOutput, agentProviderConfiguration } = agents;
const now = "2026-11-18T15:00:00.000Z";
function context() {
  const cohort = key => ({ score: 60, confidence: 65, evidenceCount: 4, cohort: key });
  return {
    symbol: "MSFT", researchRunId: "research-private-fixture", collectedAt: now,
    market: { symbol: "MSFT", price: 200, observedAt: "2026-11-18T14:59:00.000Z", retrievedAt: "2026-11-18T14:59:05.000Z", marketOpen: true, realTimeConfirmed: true, instrumentKind: "equity", currency: "USD", sourceKind: "intraday-bar" },
    score: { overall: 62, confidence: 65, confidenceAudit: { version: "controlled-fixture" }, quality: { evidenceCoverage: 80 }, cohorts: { media: cohort("media"), technical: cohort("technical"), economy: cohort("economy") } },
    evidence: [
      { id: "news-one", title: "Microsoft reports controlled earnings fixture", summary: "A fictional observation for deterministic testing.", source: "Example publisher", url: "https://publisher.example/research", observedAt: "2026-11-18T13:00:00.000Z", retrievedAt: "2026-11-18T14:58:00.000Z", kind: "scored-evidence", cohort: "media", metrics: { relevance: 90 } },
      { id: "quote-one", title: "Microsoft observed price fixture", summary: "Observed fixture price is 200 USD.", source: "Fixture provider", url: "https://provider.example/quote", observedAt: "2026-11-18T14:59:00.000Z", retrievedAt: "2026-11-18T14:59:05.000Z", kind: "scored-evidence", cohort: "technical", metrics: { price: 200 } },
      { id: "public-one", title: "Public discovery fixture", summary: "Unscored background article.", source: "Public fixture", url: "https://publisher.example/public", observedAt: "2026-11-18T12:00:00.000Z", retrievedAt: "2026-11-18T14:58:00.000Z", kind: "public-discovery", cohort: "media", metrics: { sentiment: null } },
    ],
    gaps: [], policy: clone(guards.DEFAULT_DESK_POLICY), account: guards.createPaperAccount({ initialCapital: 100000, now }),
  };
}
function report(patch = {}) {
  return { stance: "bullish", summary: "The recorded fixture supports further review.", findings: [{ claim: "The quoted fixture observation is 200 USD.", evidenceIds: ["quote-one"] }], risks: ["The next observation can change."], missingData: [], veto: false, action: "hold", allocationPct: null,
    messages: [], candidateSymbol: null, lessonsReviewed: [], horizonViews: [
      { horizon: "short", stance: "insufficient", summary: "The fixture has no independent short-horizon forecast.", evidenceIds: [] },
      { horizon: "long", stance: "insufficient", summary: "The fixture has no independent long-horizon forecast.", evidenceIds: [] },
    ], ...patch };
}
function response(output, status = "completed") { return new Response(JSON.stringify({ status, output }), { headers: { "content-type": "application/json", "x-request-id": "request-fixture" } }); }
function inspect(ids = ["news-one", "quote-one"], callId = "call-fixture") { return { type: "function_call", call_id: callId, name: "inspect_evidence", arguments: JSON.stringify({ ids }) }; }
function final(value = report()) { return { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }; }
const configuration = () => ({ key: "fixture-only-provider-key", model: "gpt-5-mini" });
const actor = signal => ({ ownerId: "private-owner-fixture", signal: signal ?? new AbortController().signal });
function provider(steps) {
  const calls = [];
  const fetch = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, options, body });
    const next = steps[calls.length - 1]; if (!next) throw new Error("Unexpected provider round");
    return typeof next === "function" ? next(url, options, body) : next;
  };
  return { fetch, calls, now: () => now, configuration };
}

same(agentProviderConfiguration(), { key: "", model: "gpt-5-mini" });
for (const key of ["demo", "your_key", "changeme", "replace-me", " "]) { environment.env.OPENAI_API_KEY = key; same(agentProviderConfiguration().key, "", "Placeholders never enable the AI team"); }
environment.env = { OPENAI_API_KEY: "fixture-key", OPENAI_MODEL: "fallback-model", OPENAI_FAST_MODEL: "fast-model", OPENAI_AGENT_MODEL: "agent-model" };
same(agentProviderConfiguration(), { key: "fixture-key", model: "agent-model" }); environment.env = {};

const ctx = context(), contextBefore = JSON.stringify(ctx);
same(executeAgentReadTool("inspect_evidence", { ids: ["quote-one"] }, ctx, []).evidence.map(item => item.id), ["quote-one"]);
same(executeAgentReadTool("read_market_snapshot", {}, ctx, []).researchRunId, ctx.researchRunId);
same(executeAgentReadTool("read_market_snapshot", {}, ctx, []).confidence, 65);
same(executeAgentReadTool("read_risk_policy", {}, ctx, []).liveExecution, false);
same(executeAgentReadTool("read_peer_reports", {}, ctx, []).reports, []);
same(JSON.stringify(ctx), contextBefore, "Read tools never alter account, policy, or observations");
for (const [name, args] of [
  ["place_order", {}], ["send_email", {}], ["browse", { url: "https://untrusted.example" }], ["set_policy", {}],
  ["inspect_evidence", { ids: ["other-owner-source"] }], ["inspect_evidence", { ids: ["quote-one", "quote-one"] }],
  ["inspect_evidence", { ids: [] }], ["inspect_evidence", { ids: ["quote-one"], symbol: "NVDA" }],
  ["inspect_evidence", { ids: Array.from({ length: 9 }, (_, i) => `id-${i}`) }],
  ["read_market_snapshot", { symbol: "NVDA" }], ["read_risk_policy", { liveExecution: true }],
  ["read_peer_reports", null], ["read_peer_reports", []], ["read_market_snapshot", 1],
]) throws(() => executeAgentReadTool(name, args, ctx, []), "INVALID_AGENT_TOOL", `${name} rejects ${JSON.stringify(args)}`);
same(validateAgentOutput(report(), ctx, new Set(["quote-one"])).findings.length, 1);
throws(() => validateAgentOutput(report(), ctx, new Set(["news-one"])), "UNGROUNDED_AGENT_OUTPUT", "Known but unread records are not acceptable citations");
throws(() => validateAgentOutput(report({ findings: [{ claim: "Unsupported", evidenceIds: ["other-owner-source"] }] }), ctx), "UNGROUNDED_AGENT_OUTPUT");
throws(() => validateAgentOutput(report({ findings: [] }), ctx), "UNGROUNDED_AGENT_OUTPUT");
for (const patch of [
  { action: "short" }, { stance: "certain" }, { veto: "false" }, { summary: "" }, { summary: "x".repeat(2401) },
  { risks: "none" }, { missingData: Array(9).fill("missing") }, { allocationPct: 11 }, { allocationPct: "10" },
  { action: "buy", allocationPct: null }, { action: "buy", allocationPct: 10, stance: "neutral" },
  { action: "buy", allocationPct: 10, veto: true }, { orderExecuted: true },
]) throws(() => validateAgentOutput(report(patch), ctx), "INVALID_AGENT_OUTPUT", JSON.stringify(patch));
same(validateAgentOutput(report({ action: "buy", allocationPct: 10 }), ctx).allocationPct, 10);
same(validateAgentOutput(report({ stance: "insufficient", findings: [], veto: true }), ctx).action, "hold");

const happy = provider([response([inspect()]), response([final()])]);
const result = await runResearchAgent("charts", ctx, [], actor(), happy);
same(result.status, "complete"); same(result.role, "charts"); same(result.action, "hold"); same(result.requestId, "request-fixture");
same(result.toolCalls.map(call => call.tool), ["inspect_evidence"]); same(result.findings[0].evidenceIds, ["quote-one"]);
same(happy.calls.length, 2); same(timers.size, 0, "All transport timers are cleared");
for (const call of happy.calls) {
  same(call.url, "https://api.openai.com/v1/responses"); same(call.options.redirect, "error"); same(call.options.cache, "no-store");
  same(call.body.store, false); same(call.body.parallel_tool_calls, false);
  same(call.body.tools.map(tool => tool.name), ["inspect_evidence", "read_market_snapshot", "read_risk_policy", "read_peer_reports", "read_market_economy", "read_technical_board", "read_strategy_scenarios", "read_scout_candidates", "read_team_board", "read_learning_record"]);
  yes(!call.options.body.includes("fixture-only-provider-key")); yes(!call.options.body.includes("private-owner-fixture"));
  yes(/^[a-f0-9]{64}$/.test(call.body.safety_identifier));
  yes(call.body.instructions.includes("UNTRUSTED DATA")); yes(call.body.instructions.includes("no broker, order"));
}
same(happy.calls[0].body.tool_choice, { type: "function", name: "inspect_evidence" });
same(happy.calls[1].body.tool_choice, "auto");
const supplied = happy.calls[1].body.input.find(row => row.type === "function_call_output");
same(JSON.parse(supplied.output).evidence.map(item => item.id), ["news-one", "quote-one"]);

const groundedFailure = provider([response([inspect(["news-one"])]), response([final()])]);
const ungrounded = await runResearchAgent("charts", ctx, [], actor(), groundedFailure);
same(ungrounded.status, "failed"); same(ungrounded.action, "hold"); same(ungrounded.findings, []);
const noRead = await runResearchAgent("news", ctx, [], actor(), provider([response([final(report({ stance: "insufficient", findings: [] }))])]));
same(noRead.status, "failed", "A complete report cannot claim participation without inspecting available evidence");
const unavailable = await runResearchAgent("skeptic", ctx, [], actor(), { configuration: () => ({ key: "", model: "gpt-5-mini" }), now: () => now });
same(unavailable.status, "failed"); same(unavailable.veto, true); same(unavailable.action, "hold"); same(unavailable.model, "gpt-5-mini");
for (const status of [401, 403, 429, 500]) {
  const failed = await runResearchAgent("chief", ctx, [], actor(), provider([new Response("UNSAFE_PROVIDER_ERROR_AND_SECRET", { status })]));
  same(failed.status, "failed"); same(failed.action, "hold"); same(failed.findings, []);
  yes(!JSON.stringify(failed).includes("UNSAFE_PROVIDER_ERROR_AND_SECRET"));
}
for (const output of [
  response([final()], "incomplete"), new Response("not-json-secret"), new Response(null),
  response([{ type: "message", content: [{ type: "refusal", refusal: "Declined" }] }]),
  response([{ ...inspect(), name: "place_order", arguments: JSON.stringify({ symbol: "MSFT", quantity: 1000 }) }]),
  response([{ ...inspect(), arguments: "not-json" }]), response([{ ...inspect(), call_id: null }]),
  response([inspect(["different-owner-id"])]), new Response(" ".repeat(1_048_577)),
]) {
  const value = await runResearchAgent("news", ctx, [], actor(), provider([output]));
  same(value.status, "failed"); same(value.action, "hold"); same(value.findings, []); same(timers.size, 0);
}
const repeatedTools = provider(Array.from({ length: 7 }, (_, i) => response([inspect(["quote-one"], `call-${i}`)])));
same((await runResearchAgent("news", ctx, [], actor(), repeatedTools)).status, "failed"); same(repeatedTools.calls.length, 7, "Tool deliberation is bounded");
const tooMany = provider([response(Array.from({ length: 7 }, (_, i) => inspect(["quote-one"], `call-${i}`)))]);
same((await runResearchAgent("news", ctx, [], actor(), tooMany)).status, "failed"); same(tooMany.calls.length, 1);

const alreadyAborted = new AbortController(); alreadyAborted.abort();
await rejected(() => runResearchAgent("news", ctx, [], actor(alreadyAborted.signal), provider([])), error => error.name === "AbortError");
let canceledBody = 0;
const bodyController = new AbortController();
const streaming = provider([() => new Response(new ReadableStream({ pull() { bodyController.abort(); }, cancel() { canceledBody++; } }))]);
await rejected(() => runResearchAgent("news", ctx, [], actor(bodyController.signal), streaming), error => error.name === "AbortError");
same(canceledBody, 1, "Caller cancellation reaches the response body"); same(timers.size, 0);
let deadlineStarted;
const transportWait = new Promise(resolve => { deadlineStarted = resolve; });
const deadlineProvider = provider([(_url, options) => new Promise((_resolve, reject) => { options.signal.addEventListener("abort", () => reject(new DOMException("Provider transport ended", "AbortError")), { once: true }); deadlineStarted(); })]);
const deadlineRun = runResearchAgent("news", ctx, [], actor(), deadlineProvider);
await transportWait; for (const fire of [...timers.values()]) fire();
same((await deadlineRun).status, "failed", "Provider transport expiry is a failed role, not a fabricated AI completion"); same(timers.size, 0);

const requestOrder = [], peerCounts = {}, stages = [], published = [], sharedBoard = [], teamToolResults = [];
function forcedTool(body, callId = "forced-read") {
  const name = body.tool_choice?.name;
  const original = JSON.parse(body.input[0].content), inventory = original.inventory ?? [];
  const item = inventory.find(item => item.id === "quote-one") ?? inventory.find(item => item.kind === "execution-reference") ?? inventory[0];
  return name ? { type: "function_call", call_id: callId, name, arguments: JSON.stringify(name === "inspect_evidence" ? { ids: item ? [item.id] : [] } : {}) } : null;
}
const teamProvider = {
  configuration, now: () => now,
  fetch: async (_url, options) => {
    const body = JSON.parse(options.body), role = body.instructions.match(/^You are the (\w+) AI agent/)[1];
    const original = JSON.parse(body.input[0].content), key = `${role}:${original.round}:${original.phase}`; requestOrder.push(key);
    peerCounts[key] = original.peerReports.length;
    const forced = forcedTool(body, `read-${key}-${body.input.length}`);
    if (forced) return response([forced]);
    const reads = body.input.filter(item => item.type === "function_call_output").map(item => JSON.parse(item.output));
    teamToolResults.push({ key, reads });
    const reply = reads.find(item => item.messages)?.messages.find(item => item.cycleId === "team-cycle");
    const finalChief = role === "chief" && original.phase === "decision";
    return response([final(report({ action: finalChief ? "buy" : "hold", allocationPct: finalChief ? 5 : null,
      messages: [{ to: role === "chief" ? "team" : "chief", body: `Review ${role}'s ${original.phase} findings and unresolved risks.`, evidenceIds: ["quote-one"], replyToIds: reply ? [reply.id] : [] }] }))]);
  },
};
const team = await runSixAgentTeam({ ...ctx, discussionCycleId: "team-cycle" }, { ...actor(), progress: async (stage, percent) => { stages.push({ stage, percent }); },
  publishReport: async value => { published.push(clone(value)); sharedBoard.push({ version: 1, id: `team-cycle:${value.round}:${value.phase}:${value.role}`, cycleId: "team-cycle", symbol: "MSFT", round: value.round, phase: value.phase, from: value.role, to: "team", body: value.summary, createdAt: now, evidenceIds: ["quote-one"], replyToIds: [], researchRunId: ctx.researchRunId, sourceHash: "a".repeat(64), report: clone(value) }); },
  readBoard: async () => clone(sharedBoard),
}, teamProvider);
same(team.map(row => row.role), AGENT_ROLES); yes(team.every(row => row.status === "complete")); same(team.find(row => row.role === "chief").action, "buy");
same(new Set(requestOrder.slice(0, 4)), new Set(["news:1:research", "scout:1:research", "sentiment:1:research", "charts:1:research"]), "Four independent specialists start before their adjudicators");
same(peerCounts, { "news:1:research": 0, "scout:1:research": 0, "sentiment:1:research": 0, "charts:1:research": 0,
  "skeptic:1:challenge": 4, "chief:1:challenge": 5, "news:2:reply": 6, "scout:2:reply": 6, "sentiment:2:reply": 6, "charts:2:reply": 6, "skeptic:2:challenge": 4, "chief:2:decision": 5 });
same(stages.map(row => row.percent), [40, 53, 61, 70, 81, 88]);
same(published.length, 12); same(published.filter(row => row.role === "chief" && row.round === 1).map(row => row.action), ["hold"]);
yes(requestOrder.lastIndexOf("news:1:research") < requestOrder.indexOf("skeptic:1:challenge")); yes(requestOrder.lastIndexOf("skeptic:2:challenge") < requestOrder.indexOf("chief:2:decision"));
const revisedNews = teamToolResults.find(item => item.key === "news:2:reply");
same(revisedNews.reads.find(item => item.messages).messages.length, 6, "Specialists read the persisted first-round team before replying");
yes(team.find(row => row.role === "news").messages[0].replyToIds.length === 1, "A revision addresses an actual earlier board message");
same(timers.size, 0);
const failedTeam = await runSixAgentTeam(ctx, actor(), { ...teamProvider, fetch: async (url, options) => JSON.parse(options.body).instructions.startsWith("You are the scout ") ? new Response("failure", { status: 429 }) : teamProvider.fetch(url, options) });
same(failedTeam.find(row => row.role === "scout").status, "failed"); same(failedTeam.find(row => row.role === "scout").action, "hold");
same(failedTeam.length, 6, "Failures remain visible under their actual role identity");
const blockedProgress = provider([]);
await rejected(() => runSixAgentTeam(ctx, { ...actor(), progress: async () => { throw new Error("Lease lost"); } }, blockedProgress), /Lease lost/);
same(blockedProgress.calls.length, 0, "Lost scheduling ownership stops AI work before it starts");
same(forbiddenFetches, 0, "Every provider and network boundary is controlled");

const learnedContext = { ...context(), discussionCycleId: "current-cycle", researchTools: {
  economy: { status: "available", snapshot: { source: "controlled dated macro fixture", series: [] } },
  charts: { status: "available", snapshot: { symbol: "MSFT", metrics: [] } },
  scenarios: { status: "available", analogues: null, strategies: [] },
}, discovery: { candidates: [{ symbol: "NVDA", observedAt: now }], tradingAllowlistChanged: false },
  learning: { version: "slice-agent-learning-1.0.0", closedTrades: 3, lessons: [{ id: "lesson:instrument:MSFT", sampleCount: 3, lossCount: 2, advisoryOnly: true }], recentOutcomes: [], advisoryOnly: true },
  board: [{ id: "older-founder-note", cycleId: "previous-cycle", from: "founder", to: "team", body: "Review past costs", createdAt: now },
    { id: "current-question", cycleId: "current-cycle", from: "skeptic", to: "news", body: "Which observation supports the premise?", createdAt: now }],
};
const validatedReply = report({ messages: [{ to: "skeptic", body: "The quoted observation supports review.", evidenceIds: ["quote-one"], replyToIds: ["current-question"] }],
  lessonsReviewed: ["lesson:instrument:MSFT"], horizonViews: [{ horizon: "short", stance: "bullish", summary: "An evidence-based scenario, without a probability claim.", evidenceIds: ["quote-one"] }, { horizon: "long", stance: "insufficient", summary: "Insufficient long-horizon evidence.", evidenceIds: [] }] });
same(validateAgentOutput(validatedReply, learnedContext, new Set(["quote-one"])).messages[0].replyToIds, ["current-question"]);
for (const patch of [
  { messages: [{ ...validatedReply.messages[0], to: "broker" }] },
  { messages: [{ ...validatedReply.messages[0], replyToIds: ["not-in-private-board"] }] },
  { messages: [{ ...validatedReply.messages[0], replyToIds: ["older-founder-note"] }] },
  { candidateSymbol: "UNOBSERVED" }, { lessonsReviewed: ["other-owner-lesson"] },
  { horizonViews: [validatedReply.horizonViews[0], validatedReply.horizonViews[0]] },
  { messages: Array(5).fill(validatedReply.messages[0]) }, { action: "hold", allocationPct: 2 },
]) throws(() => validateAgentOutput(report(patch), learnedContext, new Set(["quote-one"])), "INVALID_AGENT_OUTPUT");
throws(() => validateAgentOutput(report({ messages: [{ ...validatedReply.messages[0], evidenceIds: ["news-one"] }] }), learnedContext, new Set(["quote-one"])), "UNGROUNDED_AGENT_OUTPUT");
throws(() => validateAgentOutput(report({ horizonViews: [{ ...validatedReply.horizonViews[0], evidenceIds: [] }] }), learnedContext, new Set(["quote-one"])), "UNGROUNDED_AGENT_OUTPUT");
throws(() => validateAgentOutput(report({ action: "buy", allocationPct: 5, candidateSymbol: "NVDA" }), { ...learnedContext, purpose: "discovery" }), "INVALID_AGENT_OUTPUT");
same(validateAgentOutput(report({ candidateSymbol: "NVDA" }), { ...learnedContext, purpose: "discovery" }).candidateSymbol, "NVDA");
same(executeAgentReadTool("read_scout_candidates", {}, learnedContext, []).tradingAllowlistChanged, false);
same(executeAgentReadTool("read_learning_record", {}, learnedContext, []).modelWeightsChanged, false);
same(executeAgentReadTool("read_team_board", {}, learnedContext, []).classification, "untrusted-discussion-not-execution-authority");
same(executeAgentReadTool("read_market_snapshot", {}, { ...ctx, score: null }, []).confidence, null, "Scout discovery has no manufactured research score");
same(executeAgentReadTool("read_market_economy", {}, learnedContext, []).economy.status, "available");
for (const [role, module] of [["sentiment", "read_market_economy"], ["charts", "read_technical_board"], ["skeptic", "read_strategy_scenarios"], ["scout", "read_scout_candidates"], ["chief", null]]) {
  const requests = [];
  const connectedRole = await runResearchAgent(role, learnedContext, [], { ...actor(), phase: role === "chief" ? "decision" : "research" }, { configuration, now: () => now,
    fetch: async (_url, options) => { const body = JSON.parse(options.body); requests.push(body); const forced = forcedTool(body, `mandatory-${requests.length}`); return response(forced ? [forced] : [final(validatedReply)]); } });
  same(connectedRole.status, "complete", `${role} can read its real role module, prior outcomes and discussion: ${connectedRole.error ?? "complete"}; requested ${JSON.stringify(requests.map(value => value.tool_choice))}; completed ${JSON.stringify(connectedRole.toolCalls)}`);
  const toolsRead = connectedRole.toolCalls.map(item => item.tool);
  if (module) yes(toolsRead.includes(module));
  yes(toolsRead.includes("read_learning_record")); yes(toolsRead.includes("read_team_board"));
  same(connectedRole.lessonsReviewed, ["lesson:instrument:MSFT"]);
  yes(requests.length <= 7);
  const bypass = await runResearchAgent(role, learnedContext, [], actor(), provider([response([inspect()]), response([final(validatedReply)])]));
  same(bypass.status, "failed", `${role} cannot claim a complete report after skipping required role/learning/discussion tools`);
}
let stillAuthorized = true;
const revokedProvider = provider([() => { stillAuthorized = false; return response([inspect()]); }]);
await rejected(() => runResearchAgent("news", ctx, [], { ...actor(), authorize: async () => { if (!stillAuthorized) throw new contracts.AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "Revoked during provider work", 403); } }, revokedProvider), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED");
same(revokedProvider.calls.length, 1, "Revocation after the AI response prevents tool access and report publication");
const provisionalEntry = await runResearchAgent("chief", ctx, [], { ...actor(), phase: "challenge" }, provider([response([inspect()]), response([final(report({ action: "buy", allocationPct: 5 }))])]));
same(provisionalEntry.status, "failed"); same(provisionalEntry.action, "hold", "Only the final Chief decision can propose an entry");

// This deliberately small database double models unique keys, exact predicates,
// and serializable atomic transactions. It exercises the actual store module;
// it does not claim to replace an integration test against the production DB.
function memoryDatabase() {
  let rows = [], serial = 0, transactionQueue = Promise.resolve();
  const calls = [];
  const match = (row, where) => Object.entries(where ?? {}).every(([key, value]) => {
    if (key === "userId_eventKey") return match(row, value);
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      if (Object.hasOwn(value, "in")) return value.in.includes(row[key]);
      if (Object.hasOwn(value, "not")) return row[key] !== value.not;
      if (Object.hasOwn(value, "lte")) return Date.parse(row[key]) <= new Date(value.lte).getTime();
      if (Object.hasOwn(value, "gte")) return Date.parse(row[key]) >= new Date(value.gte).getTime();
    }
    return row[key] === value;
  });
  const selected = (row, select) => row ? clone(select ? Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, row[key]])) : row) : null;
  const model = (getRows, transactional = false) => {
    const log = (method, args) => calls.push({ method, args: clone(args), transactional });
    const create = async args => {
      log("create", args); const list = getRows();
      if (list.some(row => row.userId === args.data.userId && row.eventKey === args.data.eventKey)) throw Object.assign(new Error("Unique user/event key"), { code: "P2002" });
      const id = `event-${String(++serial).padStart(4, "0")}`, time = new Date(Date.parse(now) + serial).toISOString();
      const row = { id, createdAt: time, updatedAt: time, ...clone(args.data) }; list.push(row); return clone(row);
    };
    return {
      async findFirst(args) { log("findFirst", args); return selected(getRows().find(row => match(row, args.where)), args.select); },
      async count(args) { log("count", args); return getRows().filter(row => match(row, args.where)).length; },
      async findMany(args) {
        log("findMany", args); const list = getRows().filter(row => match(row, args.where));
        list.sort((a, b) => { for (const order of args.orderBy ?? []) { const [key, direction] = Object.entries(order)[0]; if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (direction === "desc" ? -1 : 1); } return 0; });
        return list.slice(0, args.take).map(row => selected(row, args.select));
      },
      async updateMany(args) {
        log("updateMany", args); let count = 0;
        for (const row of getRows()) if (match(row, args.where)) { Object.assign(row, clone(args.data)); row.updatedAt = new Date(Date.parse(now) + ++serial).toISOString(); count++; }
        return { count };
      },
      async upsert(args) {
        log("upsert", args); const existing = getRows().find(row => match(row, args.where));
        if (existing) { Object.assign(existing, clone(args.update)); return clone(existing); }
        return create({ data: args.create });
      },
      create,
    };
  };
  const prisma = {
    backendPlatformEvent: model(() => rows),
    async $transaction(callback) {
      const ready = transactionQueue; let unlock; transactionQueue = new Promise(resolve => { unlock = resolve; }); await ready;
      const draft = clone(rows);
      try { const result = await callback({ backendPlatformEvent: model(() => draft, true) }); rows = draft; return result; }
      finally { unlock(); }
    },
  };
  return { prisma, calls, rows: () => clone(rows), mutate: fn => fn(rows) };
}
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return Date.parse(now); }
}
const database = memoryDatabase();
async function storeDependencies(database, options = {}) {
  const storage = await load("src/lib/agent-desk/collaboration-storage.ts", { "./contracts": contracts, "@/lib/prisma": { prisma: database.prisma } }, options);
  const learning = await load("src/lib/agent-desk/learning.ts", { "./contracts": contracts, "./collaboration-storage": storage }, options);
  const collaboration = await load("src/lib/agent-desk/collaboration.ts", { "./contracts": contracts, "./guardrails": guards, "./collaboration-storage": storage, "./learning": learning }, options);
  return { "./contracts": contracts, "./guardrails": guards, "./operations": operations, "@/lib/intelligence/research-instrument": instruments, "@/lib/prisma": { prisma: database.prisma }, "./collaboration": collaboration, "./learning": learning };
}
const store = await load("src/lib/agent-desk/store.ts", await storeDependencies(database, { Date: FixtureDate }), { Date: FixtureDate });
const owner = { userId: "owner-a", firmId: "firm-a" }, otherOwner = { userId: "owner-b", firmId: "firm-a" }, otherFirm = { userId: "owner-a", firmId: "firm-b" };
const envelopeValue = { name: "fixture", rows: [1, 2, 3] }, encoded = store.encodeDeskEnvelope(envelopeValue);
same(store.decodeDeskEnvelope(encoded), envelopeValue); same(store.encodeDeskEnvelope(envelopeValue), encoded);
const corruptedEnvelope = JSON.parse(encoded); corruptedEnvelope.payload = JSON.stringify({ ...envelopeValue, name: "changed" });
for (const raw of ["not-json", "[]", "null", JSON.stringify(corruptedEnvelope), JSON.stringify({ ...JSON.parse(encoded), version: 2 }), JSON.stringify({ ...JSON.parse(encoded), checksum: "" })])
  throws(() => store.decodeDeskEnvelope(raw), "DESK_STORAGE_INVALID", "Corrupt or incomplete envelopes are rejected");

const initial = await store.readDeskRecord(owner), initialAgain = await store.readDeskRecord(owner);
same(initialAgain, initial, "Repeated reads reuse the same account"); same(initial.state.controls, guards.DEFAULT_DESK_CONTROLS);
same(initial.state.account.cash, initial.state.settings.initialCapital); same(initial.state.account.sequence, 0);
same(initial.state.latestCycleId, null); same(initial.state.busy, null);
const secondary = await store.readDeskRecord(otherOwner), alternateFirm = await store.readDeskRecord(otherFirm);
same(new Set([initial.id, secondary.id, alternateFirm.id]).size, 3, "Each owner/workspace has a distinct account");
for (const call of database.calls.filter(item => item.method === "findFirst")) {
  yes(typeof call.args.where.userId === "string"); yes(typeof call.args.where.firmId === "string");
  same(call.args.where.eventType, store.DESK_STATE_EVENT);
  same(call.args.where.eventKey, `agent-desk-state:${call.args.where.firmId}`);
}
same(store.validateDeskSettings(initial.state.settings), initial.state.settings);
same(store.validateDeskSettings({ ...initial.state.settings, symbol: "^GSPC" }).symbol, "INDEX:SPX", "Native index identity remains explicit for research even though fills prohibit it");
for (const patch of [{ symbol: "msft" }, { symbol: "MSFT<script>" }, { symbol: "" }, { intervalMinutes: 4 }, { intervalMinutes: 241 }, { intervalMinutes: 5.5 }, { initialCapital: 99 }, { initialCapital: 1_000_000_001 }, { initialCapital: "10000" }, { ordersEnabled: true }])
  throws(() => store.validateDeskSettings({ ...initial.state.settings, ...patch }), "INVALID_SETTINGS");
for (const value of [null, [], {}, { symbol: "MSFT", intervalMinutes: 5, initialCapital: 10000 }]) {
  assert.throws(() => store.validateDeskSettings(value)); assertions++;
}

const firstChange = clone(initial.state); firstChange.revision = 1; firstChange.controls.armed = true;
const replaced = await store.replaceDeskRecord(owner, initial, firstChange);
same(replaced.state.revision, 1); same((await store.readDeskRecord(owner)).state.controls.armed, true);
const replaceQuery = database.calls.findLast(call => call.method === "updateMany");
same(replaceQuery.args.where, { id: initial.id, ...owner, eventKey: "agent-desk-state:firm-a", eventType: store.DESK_STATE_EVENT, metadataJson: initial.raw }, "A write checks owner, firm, exact record type, ID, and complete old contents");
await rejected(() => store.replaceDeskRecord(owner, initial, { ...firstChange, revision: 2 }), error => error.code === "DESK_CONFLICT", "Stale readers cannot overwrite current controls");
await rejected(() => store.replaceDeskRecord(otherOwner, replaced, { ...firstChange, revision: 2 }), error => error.code === "DESK_CONFLICT", "Another owner cannot write through a known state ID");
await rejected(() => store.replaceDeskRecord(otherFirm, replaced, { ...firstChange, revision: 2 }), error => error.code === "DESK_CONFLICT", "The same owner cannot cross a workspace boundary");
await rejected(() => store.replaceDeskRecord(owner, { ...replaced, raw: ` ${replaced.raw}` }, { ...firstChange, revision: 2 }), error => error.code === "DESK_CONFLICT", "CAS compares exact stored strings, not just parsed values");
same((await store.readDeskRecord(owner)).raw, replaced.raw);

const fingerprint = store.positionFingerprint(initial.state.account), marked = clone(initial.state.account);
Object.assign(marked, { lastObservedAt: now, lastObservedPrice: 199, lastCycleId: "monitor-only", lastCycleAt: now, sequence: 1 });
same(store.positionFingerprint(marked), fingerprint, "A harmless mark or monitor cycle does not invalidate an approval");
const position = { symbol: "MSFT", quantity: 10, averageEntry: 200, entryFees: 1, openedAt: now, sessionDate: "2026-11-18", peakPrice: 200, stopLossPct: 1, takeProfitPct: 2, trailingStopPct: null, maxHoldingMinutes: 90, flattenBeforeCloseMinutes: 5 };
const held = { ...clone(initial.state.account), cash: initial.state.account.cash - 2001, position, lastFillAt: now, feesPaid: 1 };
const heldFingerprint = store.positionFingerprint(held); yes(heldFingerprint !== fingerprint);
same(store.positionFingerprint({ ...held, position: { ...position, peakPrice: 202 }, lastObservedPrice: 202 }), heldFingerprint, "Trailing peak updates alone do not impersonate an exposure change");
for (const account of [
  { ...held, cash: held.cash + 1 }, { ...held, position: { ...position, quantity: 11 } },
  { ...held, position: { ...position, averageEntry: 201 } }, { ...held, position: { ...position, symbol: "AAPL" } },
  { ...held, feesPaid: 2 }, { ...held, realizedPnl: -1 }, { ...held, lastFillAt: "2026-11-18T15:01:00.000Z" },
]) yes(store.positionFingerprint(account) !== heldFingerprint, "Exposure, fill, and cost changes invalidate the proposal fingerprint");

function receipt(id, account = initial.state.account) {
  return {
    cycle: { version: 1, id, symbol: "MSFT", status: "complete", startedAt: now, completedAt: now, settingsRevision: 1,
      researchRunId: ctx.researchRunId, researchScore: null, currentResearch: null, agents: [], evidence: [], proposal: null, decision: null, fill: null, errors: [],
      sourceHash: "fixture", equity: account.cash, unrealizedPnl: 0, mode: "paper", executionStatus: "held" },
    assessment: null, positionFingerprint: store.positionFingerprint(account), approvalOf: null,
  };
}
const cycleOne = receipt("cycle-one"), nextState = { ...clone(replaced.state), revision: 2, latestCycleId: cycleOne.cycle.id };
await store.commitDeskCycle(owner, replaced, nextState, cycleOne);
same((await store.readDeskRecord(owner)).state.latestCycleId, "cycle-one"); same(await store.readDeskCycle(owner, "cycle-one"), cycleOne);
same(await store.readDeskCycle(otherOwner, "cycle-one"), null); same(await store.readDeskCycle(otherFirm, "cycle-one"), null);
same((await store.readDeskHistory(owner)).map(cycle => cycle.id), ["cycle-one"]); same(await store.readDeskHistory(otherOwner), []);
const transactionCalls = database.calls.filter(call => call.transactional);
same(transactionCalls.map(call => call.method), ["updateMany", "create"]); same(transactionCalls[0].args.where.metadataJson, replaced.raw);
same(transactionCalls[1].args.data.eventKey, "agent-desk-cycle:firm-a:cycle-one"); same(transactionCalls[1].args.data.userId, owner.userId);
same(transactionCalls[1].args.data.firmId, owner.firmId); same(transactionCalls[1].args.data.sourceType, "PaperSimulation");

const beforeDuplicate = await store.readDeskRecord(owner), persistedBeforeDuplicate = database.rows();
await rejected(() => store.commitDeskCycle(owner, beforeDuplicate, { ...clone(beforeDuplicate.state), revision: 3 }, cycleOne), error => error.code === "P2002", "The database uniqueness fence rejects an already committed cycle");
same(database.rows(), persistedBeforeDuplicate, "A duplicate receipt rolls back the attempted account update");
await rejected(() => store.commitDeskCycle(owner, replaced, { ...clone(replaced.state), revision: 3 }, receipt("stale-cycle")), error => error.code === "DESK_CONFLICT");
same(await store.readDeskCycle(owner, "stale-cycle"), null, "A failed CAS produces no detached execution receipt");

const racers = await store.readDeskRecord(owner);
const outcomes = await Promise.allSettled(["racer-a", "racer-b"].map(id => store.commitDeskCycle(owner, racers, { ...clone(racers.state), revision: 3, latestCycleId: id }, receipt(id))));
same(outcomes.filter(row => row.status === "fulfilled").length, 1, "One writer wins a shared state version");
same(outcomes.filter(row => row.status === "rejected" && row.reason.code === "DESK_CONFLICT").length, 1);
const raceReceipts = await Promise.all([store.readDeskCycle(owner, "racer-a"), store.readDeskCycle(owner, "racer-b")]);
same(raceReceipts.filter(Boolean).length, 1); same((await store.readDeskHistory(owner)).length, 2);

// Histories are scoped and capped, including when the same cycle ID exists for a
// second owner. The transaction body never relies on globally unique cycle IDs.
await store.commitDeskCycle(otherOwner, secondary, { ...clone(secondary.state), latestCycleId: "cycle-one" }, receipt("cycle-one"));
same((await store.readDeskHistory(otherOwner)).map(cycle => cycle.id), ["cycle-one"]);
for (let index = 0; index < 22; index++) {
  const previous = await store.readDeskRecord(owner), id = `history-${String(index).padStart(2, "0")}`;
  await store.commitDeskCycle(owner, previous, { ...clone(previous.state), latestCycleId: id, revision: previous.state.revision + 1 }, receipt(id));
}
same((await store.readDeskHistory(owner)).length, 20); same((await store.readDeskHistory(owner))[0].id, "history-21");
const aSchedule = await store.readDeskRecord(owner), bSchedule = await store.readDeskRecord(otherOwner);
await store.replaceDeskRecord(owner, aSchedule, { ...clone(aSchedule.state), controls: { armed: true, autonomous: true, paused: false, killSwitch: false } });
await store.replaceDeskRecord(otherOwner, bSchedule, { ...clone(bSchedule.state), controls: { armed: true, autonomous: false, paused: true, killSwitch: true } });
same(await store.scheduledDeskScopes(10), [owner]); same(await store.scheduledDeskScopes(1), [owner]);

const tamperDatabase = memoryDatabase();
const tamperStore = await load("src/lib/agent-desk/store.ts", await storeDependencies(tamperDatabase, { Date: FixtureDate }), { Date: FixtureDate });
const tamper = await tamperStore.readDeskRecord(owner);
tamperDatabase.mutate(rows => { rows[0].metadataJson = "corrupt"; });
await rejected(() => tamperStore.readDeskRecord(owner), error => error.code === "DESK_STORAGE_INVALID");
tamperDatabase.mutate(rows => { rows[0].metadataJson = tamperStore.encodeDeskEnvelope({ ...tamper.state, revision: -1 }); });
await rejected(() => tamperStore.readDeskRecord(owner), error => error.code === "DESK_STORAGE_INVALID");
tamperDatabase.mutate(rows => { rows[0].metadataJson = tamperStore.encodeDeskEnvelope({ ...tamper.state, account: { ...tamper.state.account, cash: 1 } }); });
await rejected(() => tamperStore.readDeskRecord(owner), error => error.code === "INVALID_ACCOUNT", "Account invariants remain enforced even with a freshly recomputed checksum");
tamperDatabase.mutate(rows => { rows[0].metadataJson = tamper.raw; rows[0].firmId = "mismatched-firm"; });
await rejected(() => tamperStore.readDeskRecord(owner), error => error.status === 403, "An upsert result must still match the authenticated owner/workspace");
same(forbiddenFetches, 0);

const evidenceTools = await load("src/lib/intelligence/research-evidence.ts");
const researchReadiness = await load("src/lib/intelligence/research-readiness.ts", { "./research-evidence": evidenceTools });
const readiness = await load("src/lib/data-readiness/core.ts");
function researchFixture(clock, symbol = "MSFT") {
  return {
    runId: "research-service-fixture", symbol, completedAt: clock, score: { ...clone(ctx.score), weighting: { media: 0.5, technical: 0.5, economy: 0 } },
    cohorts: clone(ctx.score.cohorts), currentResearch: { symbol, checkedAt: clock, status: "covered", gaps: [], discoveries: [] },
    evidence: ctx.evidence.filter(row => row.kind === "scored-evidence").map(row => ({
      id: row.id, symbol, cohort: row.cohort, kind: row.cohort === "technical" ? "intraday" : "news",
      title: row.title, summary: row.summary, source: row.source, sourceUrl: row.url,
      asOf: row.observedAt, retrievedAt: row.retrievedAt, score: 60, confidence: 65, relevanceScore: 90,
      topics: [], metrics: row.metrics,
    })),
  };
}
function marketFixture(clock = now, price = 200, symbol = "MSFT") {
  return {
    symbol, instrument: instruments.resolveResearchInstrument(symbol), retrievedAt: clock, updatedAt: clock,
    provider: "Alpha Vantage", providerAsOf: clock, providerTimeZone: "America/New_York", entitlement: "realtime",
    quote: { price, observedAt: new Date(Date.parse(clock) - 60_000).toISOString(), sourceKind: "intraday-bar" },
    market: { isOpen: true, region: "United States", currentStatus: "open", localOpen: "09:30", localClose: "16:00" },
    health: { retrievedAt: { intraday: new Date(Date.parse(clock) - 55_000).toISOString(), marketStatus: clock }, cache: { intraday: "network", marketStatus: "network" } },
    freshness: { isRealtime: true }, overview: { currency: "USD", exchange: "NASDAQ" },
  };
}
function discoveryFixture(clock = now, symbols = ["NVDA"]) {
  return { version: 1, checkedAt: clock, candidates: symbols.map((symbol, index) => ({ symbol, name: `${symbol} fixture`, rank: index + 1, reason: "Observed fixture activity", origins: ["research-universe"],
    observedAt: clock, retrievedAt: clock, price: 200, changePct: 1, volume: 1e6, state: "live", source: "Fixture provider", sourceUrl: "https://provider.example/discovery", sourceSha256: "c".repeat(64), tradableByPolicy: false })),
    receipts: [], issues: [], refreshAfterMs: 900000, scannedCount: symbols.length, method: "Controlled observations", tradingAllowlistChanged: false };
}
function discoveryEvidence(discovery) {
  return discovery.candidates.map(candidate => ({ id: `desk-scout-${candidate.symbol}`, title: `${candidate.symbol} observed candidate`, summary: candidate.reason,
    source: candidate.source, url: candidate.sourceUrl, observedAt: candidate.observedAt, retrievedAt: candidate.retrievedAt, kind: "tool-research", cohort: "scout", metrics: { symbol: candidate.symbol, price: candidate.price } }));
}
function emptyAccessFixture(symbol, clock) {
  return { version: 1, symbol, checkedAt: clock, evidence: [], workspace: { capabilities: [], records: [], sources: [], issues: [] },
    web: { status: "disabled", provider: "OpenAI hosted web search", model: null, queries: [], sources: [], summary: null, requestId: null, retrievedAt: null,
      usage: { inputTokens: null, outputTokens: null, searchCalls: 0, billableUsd: null }, cacheHit: false, cacheTtlSeconds: 900, liveAccessRequested: false, detail: "Disabled in the controlled legacy fixture." },
    shared: { status: "disabled", publisherCount: 0, sourceCount: 0, scope: "opt-in-public-market-sources", sources: [], detail: "No cross-owner sources in fixture.", truncated: false }, issues: [] };
}
async function serviceFixture() {
  let clock = now, calls = 0;
  class ServiceDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return Date.parse(clock); } }
  const db = memoryDatabase(), access = { active: true, userStatus: "Active", firmStatus: "Active", memberStatus: "Active", founder: true };
  const jobRows = [], quoteCalls = [], researchCalls = [], teamCalls = [], scoutCalls = [], queueCalls = [], cancellations = [], storageCalls = [], resourceCalls = [], helperCalls = [], brokerCalls = [];
  db.prisma.backendJobRun = { findFirst: async ({ where }) => clone(jobRows.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null) };
  const storedDependencies = await storeDependencies(db, { Date: ServiceDate });
  const stored = await load("src/lib/agent-desk/store.ts", storedDependencies, { Date: ServiceDate });
  const hooks = {};
  const serviceEnvironment = { env: { ALPHA_VANTAGE_API_KEY: "fixture-market-key" } };
  const founderEnvironment = { env: { SLICE_FOUNDER_EMAILS: "configured-founder@example.invalid" } };
  const founderModule = await load("src/lib/founder-access.ts", {}, { process: founderEnvironment });
  const accessContext = { getAccessContextForUser: async scope => {
    calls++; if (hooks.access) return hooks.access(scope);
    return access.active && ["owner-a", "owner-b"].includes(scope.userId) && ["firm-a", "firm-b"].includes(scope.firmId)
      ? { user: { id: scope.userId, email: access.founder ? "configured-founder@example.invalid" : "ordinary-member@example.invalid", platformStatus: access.userStatus, platformRole: "Founder" },
        firm: { id: scope.firmId, platformStatus: access.firmStatus }, membership: { status: access.memberStatus }, isFounder: true } : null;
  } };
  const founderAccess = await load("src/lib/agent-desk/access.ts", { "@/lib/access-control": accessContext, "@/lib/founder-access": founderModule, "./contracts": contracts,
    "@/lib/api-route": { ApiError: class extends Error { constructor(input) { super(input.message); Object.assign(this, input); } } } });
  const settings = { aiKey: "fixture-ai-key" };
  const disabledBroker = () => ({ provider: "Alpaca", mode: "paper", revision: 0, connected: false, controls: { enabled: false, autonomous: false, paused: true }, safeguards: { maxPositionPct: 10, allowedSymbols: ["MSFT"] }, account: null, positions: [], activePositionSymbol: null, pendingOrder: null, observedAt: null, readiness: {}, limitations: ["No broker connected in controlled fixture."] });
  const dependencies = {
    "@/lib/prisma": { prisma: db.prisma }, "./contracts": contracts, "./guardrails": guards, "./store": stored,
    "./access": founderAccess,
    "./operations": operations,
    "./research-access-core": researchAccessCore,
    "./research-access-web": { readAgentResearchSourceFingerprint: async scope => { same(scope, owner); return hooks.sourceFingerprint?.() ?? null; } },
    "./research-access": { loadAgentResearchAccess: async (scope, input) => { resourceCalls.push({ scope: clone(scope), input }); return hooks.resources ? hooks.resources(scope, input) : emptyAccessFixture(input.symbol, clock); } },
    "./subagents": { runAgentHelpers: async (context, settings, input) => { helperCalls.push({ context: clone(context), settings: clone(settings), input }); return hooks.helpers ? hooks.helpers(context, settings, input) : []; } },
    "@/lib/agent-broker/service": {
      getAgentBrokerContext: async scope => { brokerCalls.push({ action: "context", scope: clone(scope) }); return hooks.broker ? hooks.broker(scope) : disabledBroker(); },
      getBrokerView: async scope => hooks.brokerView ? hooks.brokerView(scope) : { ...disabledBroker(), policy: disabledBroker().safeguards },
      getBrokerResearchObservation: async (scope, symbol) => { brokerCalls.push({ action: "observation", scope: clone(scope), symbol }); return hooks.brokerObservation ? hooks.brokerObservation(scope, symbol) : null; },
      pauseBrokerExecution: async (scope, reason) => { brokerCalls.push({ action: "pause", scope: clone(scope), reason }); if (hooks.brokerPause) return hooks.brokerPause(scope, reason); },
      submitChiefBrokerProposal: async (scope, input) => { brokerCalls.push({ action: "proposal", scope: clone(scope), input }); return hooks.brokerProposal ? hooks.brokerProposal(scope, input) : { status: "blocked", code: "FIXTURE_BROKER_DISABLED" }; },
    },
    "./collaboration": storedDependencies["./collaboration"], "./learning": storedDependencies["./learning"],
    "./research-tools": { loadDeskResearchTools: async (_scope, input) => hooks.tools ? hooks.tools(input) : ({ version: 1, symbol: input.symbol, checkedAt: clock,
      economy: { status: "available", snapshot: null, riskAppetite: null, interpretationLimits: [] },
      charts: { status: "available", snapshot: { symbol: input.symbol }, barCount: 250, historyBasis: "controlled-fixture" },
      scenarios: { status: "available", symbol: input.symbol, checkedAt: clock, manifests: [], analogues: null, strategies: [], savedDefinitionsChecked: 0, skippedDefinitions: [], benchmark: null, issues: [] }, evidence: [], issues: [] }),
      scoutDiscoveryEvidence: discoveryEvidence,
      discoverScoutCandidates: async (scope, input) => { scoutCalls.push({ scope: clone(scope), input }); return hooks.discovery ? hooks.discovery(scope, input) : discoveryFixture(clock); } },
    "@/lib/data-readiness/server": { requireResearchStorage: async tables => { storageCalls.push(tables); if (hooks.storage) return hooks.storage(tables); } },
    "@/lib/data-readiness/core": readiness,
    "@/lib/intelligence/research-swarm-service": { buildResearchSwarmForUser: async input => { researchCalls.push(input); return hooks.research ? hooks.research(input) : researchFixture(clock, input.symbol); } },
    "@/lib/intelligence/alpha-vantage-live": { getAlphaVantageIntelligence: async input => { quoteCalls.push(input); return hooks.quote ? hooks.quote(input, quoteCalls.length) : marketFixture(clock, 200, input.symbol); } },
    "@/lib/intelligence/research-evidence": evidenceTools, "@/lib/intelligence/research-instrument": instruments, "@/lib/intelligence/research-readiness": researchReadiness,
    "@/lib/background-jobs/queue": {
      enqueueBackgroundJob: async input => {
        queueCalls.push(clone(input)); if (hooks.enqueue) return hooks.enqueue(input);
        const job = { id: `job-${queueCalls.length}`, ...input.context, status: "Queued", completedAt: null }; jobRows.push(job); return { job };
      },
      requestBackgroundJobCancellation: async input => { cancellations.push(clone(input)); },
    },
    "./agents": {
      agentProviderConfiguration: () => ({ key: settings.aiKey, model: "gpt-5-mini" }),
      runResearchAgent: async (role, input, peers, options) => {
        if (hooks.scoutAgent) return hooks.scoutAgent(role, input, peers, options);
        return runResearchAgent(role, input, peers, options, { configuration, now: () => clock, fetch: async (_url, options) => {
          const body = JSON.parse(options.body), forced = forcedTool(body, `scout-${body.input.length}`);
          if (forced) return response([forced]);
          const candidate = input.discovery.candidates[0], evidenceId = `desk-scout-${candidate.symbol}`;
          return response([final(report({ candidateSymbol: candidate.symbol, findings: [{ claim: "The observed candidate merits further research.", evidenceIds: [evidenceId] }] }))]);
        } });
      },
      runSixAgentTeam: async (input, options) => {
        teamCalls.push({ input: clone(input), options }); if (hooks.team) return hooks.team(input, options);
        return runSixAgentTeam(input, options, { configuration, now: () => clock, fetch: async (_url, options) => {
          const body = JSON.parse(options.body), original = JSON.parse(body.input[0].content), role = body.instructions.match(/^You are the (\w+) AI agent/)[1];
          const forced = forcedTool(body, `service-${role}-${original.round}-${body.input.length}`);
          if (forced) return response([forced]);
          const finalChief = role === "chief" && original.phase === "decision";
          const evidence = body.input.filter(item => item.type === "function_call_output").map(item => JSON.parse(item.output)).find(item => item.evidence?.length)?.evidence[0];
          return response([final(report({ action: finalChief ? "buy" : "hold", allocationPct: finalChief ? 5 : null,
            findings: [{ claim: "The supplied reference supports a controlled review.", evidenceIds: [evidence.id] }] }))]);
        } });
      },
    },
  };
  const service = await load("src/lib/agent-desk/service.ts", dependencies, { Date: ServiceDate, process: serviceEnvironment });
  const scouting = await load("src/lib/agent-desk/scouting.ts", dependencies, { Date: ServiceDate, process: serviceEnvironment });
  const runtime = (queueIndex = queueCalls.length - 1, patch = {}) => {
    const controller = new AbortController();
    return { jobId: `job-${queueIndex + 1}`, payload: clone(queueCalls[queueIndex]?.payload ?? {}), signal: controller.signal,
      throwIfCancelled: async () => controller.signal.throwIfAborted(), reportProgress: async () => undefined, controller, ...patch };
  };
  const arm = async (autonomous = false) => { const record = await stored.readDeskRecord(owner); await service.updateDeskControls(owner, { action: autonomous ? "enable" : "arm", revision: record.state.revision, paperOnly: true }); };
  const queue = async () => { const record = await stored.readDeskRecord(owner); return service.queueDeskCycle(owner, record.state.revision); };
  const run = async (autonomous = false) => { await arm(autonomous); await queue(); return service.executeAgentDeskCycleJob(owner, runtime()); };
  return { db, store: stored, service, scouting, dependencies, ServiceDate, access, hooks, environment: serviceEnvironment, founderEnvironment, founderAccess, settings, runtime, arm, queue, run,
    quoteCalls, researchCalls, teamCalls, scoutCalls, queueCalls, cancellations, storageCalls, jobRows, resourceCalls, helperCalls, brokerCalls,
    clock: () => clock, setClock: value => { clock = value; }, accessCalls: () => calls };
}

const accessFixture = await serviceFixture();
for (const state of [{ active: false }, { firmStatus: "Suspended" }, { userStatus: "Suspended" }, { founder: false }]) {
  const prior = clone(accessFixture.access); Object.assign(accessFixture.access, state);
  await rejected(() => accessFixture.service.requireDeskAccess(owner), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED" && error.status === 403);
  Object.assign(accessFixture.access, prior);
}
await rejected(() => accessFixture.service.requireDeskAccess({ ...owner, userId: "unknown-owner" }), error => error.status === 403);
accessFixture.access.founder = true; accessFixture.access.memberStatus = "Absent";
await accessFixture.service.requireDeskAccess(owner); assertions++; Object.assign(accessFixture.access, { founder: true, memberStatus: "Active" });
accessFixture.founderEnvironment.env.SLICE_FOUNDER_EMAILS = "";
await rejected(() => accessFixture.service.requireDeskAccess(owner), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED", "Legacy Founder roles cannot bypass the exact configured email allowlist");
accessFixture.founderEnvironment.env.SLICE_FOUNDER_EMAILS = " CONFIGURED-FOUNDER@example.invalid ";
await accessFixture.service.requireDeskAccess(owner); assertions++;
same(accessFixture.db.rows().length, 0, "Access checks do not create an account for a denied principal");
same(accessFixture.service.deskProviderStatus(), { ai: "configured-unverified", market: "configured-unverified", model: "gpt-5-mini" });
for (const acknowledgement of [undefined, false, "true", 1]) await rejected(() => accessFixture.service.updateDeskControls(owner, { action: "arm", revision: 0, paperOnly: acknowledgement }), error => error.code === "PAPER_ACK_REQUIRED");
accessFixture.settings.aiKey = "";
await rejected(() => accessFixture.arm(), error => error.code === "DESK_PROVIDERS_REQUIRED"); accessFixture.settings.aiKey = "fixture-ai-key";
accessFixture.environment.env.ALPHA_VANTAGE_API_KEY = "demo";
await rejected(() => accessFixture.arm(), error => error.code === "DESK_PROVIDERS_REQUIRED"); accessFixture.environment.env.ALPHA_VANTAGE_API_KEY = "fixture-market-key";
await accessFixture.arm(); same((await accessFixture.store.readDeskRecord(owner)).state.controls, { armed: true, autonomous: false, paused: false, killSwitch: false });
await rejected(() => accessFixture.service.updateDeskControls(owner, { action: "enable", revision: 0, paperOnly: true }), error => error.code === "DESK_REVISION_CHANGED");
await accessFixture.service.updateDeskControls(owner, { action: "kill", revision: -999 });
same((await accessFixture.store.readDeskRecord(owner)).state.controls.killSwitch, true, "A stale browser cannot prevent an emergency reduction of authority");
await rejected(() => accessFixture.queue(), error => error.code === "DESK_KILLED");
let activeRecord = await accessFixture.store.readDeskRecord(owner);
await accessFixture.service.updateDeskControls(owner, { action: "resume", revision: activeRecord.state.revision });
same((await accessFixture.store.readDeskRecord(owner)).state.controls, { armed: false, autonomous: false, paused: false, killSwitch: false }, "Clearing kill does not silently rearm execution");
activeRecord = await accessFixture.store.readDeskRecord(owner);
await accessFixture.service.updateDeskControls(owner, { action: "settings", revision: activeRecord.state.revision, settings: { ...activeRecord.state.settings, initialCapital: 20000 } });
same((await accessFixture.store.readDeskRecord(owner)).state.account.cash, 20000, "Starting cash can be selected before the first fill");
await accessFixture.arm(true); activeRecord = await accessFixture.store.readDeskRecord(owner);
await rejected(() => accessFixture.service.updateDeskControls(owner, { action: "settings", revision: activeRecord.state.revision, settings: activeRecord.state.settings }), error => error.code === "PAUSE_BEFORE_SETTINGS");

const pauseFailure = await serviceFixture(); await pauseFailure.arm(true); await pauseFailure.queue();
const beforeFailedBrokerPause = await pauseFailure.store.readDeskRecord(owner);
yes(beforeFailedBrokerPause.state.busy); same(beforeFailedBrokerPause.state.controls.autonomous, true);
pauseFailure.hooks.brokerPause = async scope => { same(scope, owner); throw new Error("SECRET_BROKER_STORAGE_FAILURE"); };
await pauseFailure.service.updateDeskControls(owner, { action: "pause", revision: -999 });
const pausedAfterBrokerFailure = await pauseFailure.store.readDeskRecord(owner);
same(pausedAfterBrokerFailure.state.controls.paused, true); same(pausedAfterBrokerFailure.state.controls.autonomous, false); same(pausedAfterBrokerFailure.state.busy, null);
same(pausedAfterBrokerFailure.state.revision, beforeFailedBrokerPause.state.revision + 1);
same(pausedAfterBrokerFailure.state.brokerPausedAtRevision, pausedAfterBrokerFailure.state.revision, "A durable desk epoch revokes previous brokerage activation even if its separate status write fails");
same(pausedAfterBrokerFailure.state.nextRunAt, null); yes(pauseFailure.cancellations.some(row => row.jobId === "job-1"));
yes(pausedAfterBrokerFailure.state.lastError.includes("broker status update failed")); yes(!pausedAfterBrokerFailure.state.lastError.includes("SECRET_BROKER_STORAGE_FAILURE"));
same(pauseFailure.brokerCalls.filter(row => row.action === "pause").length, 1, "The separate broker authority reduction was attempted");
await pauseFailure.service.updateDeskControls(owner, { action: "kill", revision: -999 });
const killedAfterBrokerFailure = await pauseFailure.store.readDeskRecord(owner);
same(killedAfterBrokerFailure.state.controls.killSwitch, true); same(killedAfterBrokerFailure.state.controls.autonomous, false); same(killedAfterBrokerFailure.state.busy, null);
same(killedAfterBrokerFailure.state.brokerPausedAtRevision, killedAfterBrokerFailure.state.revision); yes(killedAfterBrokerFailure.state.brokerPausedAtRevision > pausedAfterBrokerFailure.state.brokerPausedAtRevision);
same(pauseFailure.brokerCalls.filter(row => row.action === "pause").length, 2, "A later emergency request retries the separate broker pause instead of relying on the failed attempt");
delete pauseFailure.hooks.brokerPause;
await pauseFailure.service.updateDeskControls(owner, { action: "pause", revision: -999 });
const recoveredBrokerPause = await pauseFailure.store.readDeskRecord(owner);
same(recoveredBrokerPause.state.lastError, null); same(recoveredBrokerPause.state.controls.killSwitch, true); same(recoveredBrokerPause.state.brokerPausedAtRevision, recoveredBrokerPause.state.revision);
same(pauseFailure.brokerCalls.filter(row => row.action === "pause").length, 3);
await pauseFailure.service.updateDeskControls(owner, { action: "resume", revision: recoveredBrokerPause.state.revision });
const resumedWithoutBrokerActivation = await pauseFailure.store.readDeskRecord(owner);
same(resumedWithoutBrokerActivation.state.brokerPausedAtRevision, recoveredBrokerPause.state.brokerPausedAtRevision, "Clearing the desk kill switch never erases the broker pause fence");
same(resumedWithoutBrokerActivation.state.controls.armed, false); same(pauseFailure.brokerCalls.filter(row => row.action === "pause").length, 3);
pauseFailure.access.active = false;
await rejected(() => pauseFailure.service.updateDeskControls(owner, { action: "kill", revision: -999 }), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED");
same(pauseFailure.brokerCalls.filter(row => row.action === "pause").length, 3, "A denied account cannot reach even the broker-pause endpoint");

const leasing = await serviceFixture(); await leasing.arm();
const queueRace = await Promise.allSettled([leasing.queue(), leasing.queue()]);
same(queueRace.filter(row => row.status === "fulfilled").length, 1); same(leasing.queueCalls.length, 1, "CAS permits only one queued lease for this account");
const issued = leasing.runtime(), publicDesk = await leasing.service.readAgentDesk(owner);
same(publicDesk.busy.cycleId, issued.payload.cycleId); same(publicDesk.busy.jobId, issued.jobId);
yes(!Object.hasOwn(publicDesk.busy, "token")); yes(!JSON.stringify(publicDesk).includes(issued.payload.token), "Worker authority never appears in browser state");
same(leasing.queueCalls[0].context, owner); same(leasing.queueCalls[0].maxAttempts, 1); same(leasing.queueCalls[0].jobKey, "agent_desk_cycle");
yes(leasing.storageCalls.some(tables => tables.includes("SliceForecastBundle")));
for (const change of [{ token: "guessed-token" }, { cycleId: "guessed-cycle" }, { revision: issued.payload.revision + 1 }])
  await rejected(() => leasing.service.executeAgentDeskCycleJob(owner, { ...issued, payload: { ...issued.payload, ...change } }), error => error.code === "DESK_LEASE_LOST");
await rejected(() => leasing.service.executeAgentDeskCycleJob(owner, { ...issued, jobId: "different-job" }), error => error.code === "DESK_LEASE_LOST");
await rejected(() => leasing.service.executeAgentDeskCycleJob(otherOwner, issued), error => error.code === "DESK_LEASE_LOST");
await rejected(() => leasing.service.executeAgentDeskCycleJob({ userId: owner.userId }, issued), error => error.code === "DESK_ACCESS_REQUIRED");
await rejected(() => leasing.service.executeAgentDeskCycleJob(owner, { ...issued, payload: { ...issued.payload, revision: "1" } }), error => error.code === "INVALID_DESK_JOB");
same(leasing.researchCalls.length, 0, "Invalid identity and lease inputs never begin provider research");
leasing.setClock("2026-11-18T15:31:00.000Z");
await rejected(() => leasing.service.executeAgentDeskCycleJob(owner, issued), error => error.code === "DESK_LEASE_LOST", "An elapsed lease cannot revive itself in progress reporting");
same(leasing.researchCalls.length, 0);

const manual = await serviceFixture();
const pendingResult = await manual.run(), pending = await manual.service.readAgentDesk(owner), pendingId = pendingResult.cycleId;
same(pending.latestCycle.executionStatus, "awaiting-approval"); same(pending.account.position, null); same(pending.latestCycle.agents.length, 6);
same(manual.quoteCalls.length, 2, "The price is re-observed after AI deliberation");
yes(manual.quoteCalls.every(call => call.forceRefresh === true && call.interval === "1min"));
same(manual.researchCalls[0].userId, owner.userId); same(manual.researchCalls[0].forceRefresh, true);
same(manual.teamCalls[0].input.score.confidence, 65); same(manual.teamCalls[0].input.policy, pending.settings.policy);
yes(pending.latestCycle.sourceHash.length === 64); same(pending.latestCycle.fill, null);
await rejected(() => manual.service.approveDeskCycle(otherOwner, pending.revision, pendingId, true), error => error.code === "PROPOSAL_NOT_PENDING");
await rejected(() => manual.service.approveDeskCycle(owner, pending.revision, pendingId, false), error => error.code === "INVALID_APPROVAL");
const researchCount = manual.researchCalls.length;
const duplicateRun = await manual.service.executeAgentDeskCycleJob(owner, manual.runtime());
same(duplicateRun.duplicate, true); same(manual.researchCalls.length, researchCount, "A committed cycle is never re-researched or refilled on job replay");
manual.setClock("2026-11-18T15:01:00.000Z");
await manual.service.approveDeskCycle(owner, pending.revision, pendingId, true);
const approved = await manual.service.readAgentDesk(owner);
same(approved.latestCycle.executionStatus, "filled"); same(approved.latestCycle.fill.side, "BUY"); same(approved.account.position.symbol, "MSFT");
yes(approved.account.position.quantity > 0); same(manual.quoteCalls.length, 3);
const approvalReceipt = await manual.store.readDeskCycle(owner, `approval:${pendingId}`);
same(approvalReceipt.approvalOf, pendingId); same(approvalReceipt.cycle.proposal, pending.latestCycle.proposal);
const approvedBriefs = await manual.dependencies["./collaboration"].readAgentBriefs(owner);
same(approvedBriefs.length, 1); same(approvedBriefs[0].side, "BUY"); same(approvedBriefs[0].netPnl, null); same(approvedBriefs[0].delivery, "in-app");
same(approvedBriefs[0].executionQuote.retrievedAt, approved.latestCycle.executionQuote.retrievedAt);
same(await manual.dependencies["./collaboration"].readAgentBriefs(otherOwner), [], "Entry delivery is personal even within one firm");
const approvalArtifacts = manual.db.calls.filter(call => call.transactional && call.method === "create" && call.args.data.sourceId === `approval:${pendingId}`);
same(new Set(approvalArtifacts.map(call => call.args.data.eventType)), new Set(["SLICE_AGENT_DESK_CYCLE_V1", "SLICE_AGENT_DESK_ENTRY_V1", "SLICE_AGENT_DESK_BRIEF_V1", "SLICE_AGENT_DESK_BOARD_V1"]), "Account approval, entry attribution and Brief delivery share the same commit transaction");
await rejected(() => manual.service.approveDeskCycle(owner, pending.revision, pendingId, true), error => error.code === "PROPOSAL_ALREADY_REVIEWED");
same((await manual.service.readAgentDesk(owner)).account, approved.account, "Replayed approval does not change shares or PnL");
await manual.service.updateDeskControls(owner, { action: "pause", revision: -1 });
let capitalRecord = await manual.store.readDeskRecord(owner);
await rejected(() => manual.service.updateDeskControls(owner, { action: "settings", revision: capitalRecord.state.revision, settings: { ...capitalRecord.state.settings, initialCapital: 999999 } }), error => error.code === "PAPER_CAPITAL_LOCKED");
capitalRecord = await manual.store.readDeskRecord(owner);
await rejected(() => manual.service.updateDeskControls(owner, { action: "settings", revision: capitalRecord.state.revision, settings: { ...capitalRecord.state.settings, symbol: "AAPL" } }), error => error.code === "POSITION_SETTINGS_LOCKED");

for (const mode of ["confidence", "stale-research", "drift", "stale-receipt", "missing-readiness", "nonfinite-evidence", "non-us-venue", "revoked-founder", "changed-settings"]) {
  const candidate = await serviceFixture();
  if (mode === "confidence") candidate.hooks.research = () => { const data = researchFixture(candidate.clock()); data.score.confidence = 21; return data; };
  if (mode === "missing-readiness") candidate.hooks.research = () => { const data = researchFixture(candidate.clock()); delete data.currentResearch; return data; };
  if (mode === "nonfinite-evidence") candidate.hooks.research = () => { const data = researchFixture(candidate.clock()); data.evidence = data.evidence.map(row => ({ ...row, score: Number.NaN })); return data; };
  const run = await candidate.run(), before = await candidate.service.readAgentDesk(owner);
  if (mode === "stale-research") candidate.setClock("2026-11-18T15:16:00.000Z");
  if (mode === "drift") candidate.hooks.quote = () => marketFixture(candidate.clock(), 210);
  if (mode === "stale-receipt") candidate.hooks.quote = () => { const data = marketFixture(candidate.clock()); data.health.retrievedAt.intraday = "2026-11-18T14:40:00.000Z"; return data; };
  if (mode === "non-us-venue") candidate.hooks.quote = () => { const data = marketFixture(candidate.clock()); data.overview.exchange = "LSE"; return data; };
  if (mode === "revoked-founder") candidate.hooks.quote = () => { candidate.founderEnvironment.env.SLICE_FOUNDER_EMAILS = ""; return marketFixture(candidate.clock()); };
  if (mode === "changed-settings") await candidate.service.updateDeskControls(owner, { action: "pause", revision: before.revision });
  if (["revoked-founder", "changed-settings"].includes(mode)) await rejected(() => candidate.service.approveDeskCycle(owner, before.revision, run.cycleId, true), error => ["FOUNDER_AGENT_ACCESS_REQUIRED", "DESK_REVISION_CHANGED"].includes(error.code));
  else {
    await candidate.service.approveDeskCycle(owner, before.revision, run.cycleId, true);
    const after = await candidate.service.readAgentDesk(owner);
    same(after.latestCycle.executionStatus, "blocked", `${mode} cannot pass approval revalidation`);
    if (mode === "confidence") same(after.latestCycle.decision.code, "RESEARCH_CONFIDENCE_LOW");
    if (mode === "stale-research") same(after.latestCycle.decision.code, "DECISION_TOO_OLD", "Current server time, not research's frozen clock, governs execution");
    if (["missing-readiness", "nonfinite-evidence"].includes(mode)) same(after.latestCycle.decision.code, "EVIDENCE_INCOMPLETE", "Neither missing readiness nor unscored observations can qualify as verified research");
    if (mode === "nonfinite-evidence") yes(after.latestCycle.evidence.every(row => row.kind !== "scored-evidence"));
    if (mode === "non-us-venue") same(after.latestCycle.decision.code, "SESSION_CLOSED", "The US market clock cannot authorize a foreign venue fill even when its price is in USD");
  }
  same((await candidate.store.readDeskRecord(owner)).state.account.position, null, `${mode} never buys a position`);
}

for (const stage of ["during-agents", "during-execution-quote"]) for (const action of ["kill", "pause"]) {
  const raced = await serviceFixture(); await raced.arm(true); await raced.queue();
  if (stage === "during-agents") {
    const originalTeam = raced.dependencies["./agents"].runSixAgentTeam;
    raced.hooks.team = async (input, options) => { delete raced.hooks.team; await raced.service.updateDeskControls(owner, { action, revision: -1 }); return originalTeam(input, options); };
  } else raced.hooks.quote = async (input, count) => { if (count === 2) await raced.service.updateDeskControls(owner, { action, revision: -1 }); return marketFixture(raced.clock(), 200, input.symbol); };
  await rejected(() => raced.service.executeAgentDeskCycleJob(owner, raced.runtime()), error => error.code === "DESK_LEASE_LOST");
  const after = await raced.service.readAgentDesk(owner);
  same(after.account.position, null); same(after.busy, null); same(after.controls.paused, true); same(after.controls.killSwitch, action === "kill");
  same(after.history.length, 0, "A revoked lease cannot publish an actionable stale result"); yes(raced.cancellations.length >= 1);
}

const protectedDesk = await serviceFixture(); await protectedDesk.run(true);
let protectedView = await protectedDesk.service.readAgentDesk(owner);
same(protectedView.account.position?.symbol, "MSFT");
const firstFillReceipt = marketFixture(protectedDesk.clock(), 196);
protectedDesk.hooks.quote = () => firstFillReceipt;
const cachedMonitor = await protectedDesk.service.monitorDeskPosition(owner);
same(cachedMonitor.filled, false, "Changing the apparent price cannot reuse a consumed original provider receipt");
same((await protectedDesk.service.readAgentDesk(owner)).account.position.quantity, protectedView.account.position.quantity);
delete protectedDesk.hooks.quote; protectedDesk.setClock("2026-11-18T15:01:00.000Z"); await protectedDesk.queue();
const originalTeam = protectedDesk.dependencies["./agents"].runSixAgentTeam;
protectedDesk.hooks.team = async (input, options) => {
  delete protectedDesk.hooks.team; protectedDesk.hooks.quote = () => marketFixture(protectedDesk.clock(), 196);
  const result = await protectedDesk.service.monitorDeskPosition(owner); same(result.filled, true, "A separate price observation can trigger protection without waiting for AI");
  return originalTeam(input, options);
};
await rejected(() => protectedDesk.service.executeAgentDeskCycleJob(owner, protectedDesk.runtime()), error => error.code === "DESK_LEASE_LOST");
protectedView = await protectedDesk.service.readAgentDesk(owner);
same(protectedView.account.position, null); same(protectedView.latestCycle.fill.side, "SELL");
same(protectedView.latestCycle.decision.protective, true); same(protectedView.revision, 2); same(protectedView.busy, null);
same(protectedView.history.filter(cycle => cycle.fill).length, 2, "Only the original entry and independent protective exit commit");
yes(protectedDesk.cancellations.some(row => row.jobId === "job-2"));
const protectedLearning = await protectedDesk.dependencies["./learning"].readAgentLearning(owner), protectedBriefs = await protectedDesk.dependencies["./collaboration"].readAgentBriefs(owner);
same(protectedLearning.closedTrades, 1); same(protectedLearning.linkedTrades, 1); same(protectedLearning.losses, 1);
same(protectedLearning.netPnl, protectedView.latestCycle.fill.realizedPnl);
same(protectedLearning.byRole.map(row => row.reviewedTrades), [1, 1, 1, 1, 1, 1], "An independent protective exit learns from the actual six-role entry decision");
same(protectedBriefs.map(row => row.side), ["SELL", "BUY"]); same(protectedBriefs[0].netPnl, protectedView.latestCycle.fill.realizedPnl);
same(protectedLearning.recentOutcomes[0].entryCycleId, protectedView.history.find(cycle => cycle.fill?.side === "BUY").id);

const revokedAfterTeam = await serviceFixture(); await revokedAfterTeam.arm(true); await revokedAfterTeam.queue();
const allowedTeam = revokedAfterTeam.dependencies["./agents"].runSixAgentTeam;
revokedAfterTeam.hooks.team = async (input, options) => { delete revokedAfterTeam.hooks.team; const result = await allowedTeam(input, options); revokedAfterTeam.founderEnvironment.env.SLICE_FOUNDER_EMAILS = ""; return result; };
await rejected(() => revokedAfterTeam.service.executeAgentDeskCycleJob(owner, revokedAfterTeam.runtime()), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED");
same((await revokedAfterTeam.store.readDeskRecord(owner)).state.account.position, null, "Founder revocation after all AI work still prevents the final paper fill");
same(await revokedAfterTeam.dependencies["./collaboration"].readAgentBriefs(owner), []);
same((await revokedAfterTeam.dependencies["./learning"].readAgentLearning(owner)).closedTrades, 0);
await rejected(() => revokedAfterTeam.service.readAgentDesk(owner), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED", "Revoked founders cannot fetch their former desk through the public service");

async function enableScouting(fixture) {
  const record = await fixture.store.readDeskRecord(owner);
  await fixture.service.updateDeskControls(owner, { action: "settings", revision: record.state.revision,
    settings: { ...record.state.settings, scouting: { enabled: true, autoResearch: true, intervalMinutes: 5, universe: ["NVDA"], maxCandidates: 4 } } });
}
async function scoutRuntime(fixture) {
  const record = await fixture.store.readDeskRecord(owner), jobId = await fixture.scouting.queueDeskScout(owner, record.state.revision);
  const queueIndex = fixture.queueCalls.length - 1;
  return { jobId, scope: owner, payload: clone(fixture.queueCalls[queueIndex].payload), signal: new AbortController().signal, progress: async () => undefined };
}
const discovered = await serviceFixture(); await enableScouting(discovered); await discovered.arm(true);
const priorDiscovery = await discovered.store.readDeskRecord(owner), scoutJob = await scoutRuntime(discovered);
await rejected(() => discovered.scouting.runDeskScoutJob({ ...scoutJob, scope: otherOwner }), error => error.code === "SCOUT_SUPERSEDED");
same(discovered.scoutCalls.length, 0, "A copied Scout lease cannot read another owner's research universe");
const nomination = await discovered.scouting.runDeskScoutJob(scoutJob), discoveredState = (await discovered.store.readDeskRecord(owner)).state;
same(nomination.selectedSymbol, "NVDA"); same(nomination.queuedForResearch, true); same(nomination.classification, "research-only");
same(discoveredState.settings.policy.allowedSymbols, priorDiscovery.state.settings.policy.allowedSymbols); same(discoveredState.account.position, null);
same(discoveredState.scouting.pendingResearch.symbol, "NVDA"); yes(discovered.scoutCalls[0].input.exclude.includes("MSFT"));
same(discovered.queueCalls[0].jobKey, "agent_desk_scout");
const discoveryMessages = await discovered.dependencies["./collaboration"].readAgentBoard(owner, { cycleId: nomination.scanId });
same(discoveryMessages.length, 1); same(discoveryMessages[0].from, "scout"); yes(discoveryMessages[0].evidenceIds.includes("desk-scout-NVDA"));
same(discoveryMessages[0].report.candidateSymbol, "NVDA");
const beforeScoutReplay = discovered.db.rows(); same((await discovered.scouting.runDeskScoutJob(scoutJob)).reused, true); same(discovered.db.rows(), beforeScoutReplay); same(discovered.scoutCalls.length, 1);
await rejected(() => discovered.scouting.runDeskScoutJob({ ...scoutJob, payload: { ...scoutJob.payload, token: "00000000-0000-0000-0000-000000000000" } }), error => error.code === "SCOUT_RECEIPT_INVALID");
await rejected(() => discovered.service.queueDeskCycle(owner, discoveredState.revision, false, { scanId: nomination.scanId, symbol: "AAPL" }), error => error.code === "SCOUT_SELECTION_SUPERSEDED");
await discovered.service.queueDeskCycle(owner, discoveredState.revision, false, { scanId: nomination.scanId, symbol: "NVDA" });
same((await discovered.store.readDeskRecord(owner)).state.busy.symbol, "NVDA");
await discovered.service.executeAgentDeskCycleJob(owner, discovered.runtime());
const candidateView = await discovered.service.readAgentDesk(owner);
same(discovered.researchCalls[0].symbol, "NVDA"); same(discovered.teamCalls[0].input.symbol, "NVDA"); same(candidateView.latestCycle.symbol, "NVDA");
same(candidateView.latestCycle.decision.code, "SYMBOL_NOT_ALLOWED"); same(candidateView.account.position, null);
same(candidateView.settings.symbol, "MSFT"); same(candidateView.settings.policy.allowedSymbols, priorDiscovery.state.settings.policy.allowedSymbols, "Automatic candidate research cannot widen trading permission");
same(await discovered.dependencies["./collaboration"].readAgentBriefs(owner), [], "A research-only nomination or blocked candidate produces no trade delivery");
await rejected(() => discovered.service.queueDeskCycle(owner, candidateView.revision, false, { scanId: nomination.scanId, symbol: "NVDA" }), error => error.code === "SCOUT_SELECTION_SUPERSEDED");

const heldCandidate = await serviceFixture(); await enableScouting(heldCandidate); await heldCandidate.run(true);
const heldBeforeCandidate = (await heldCandidate.store.readDeskRecord(owner)).state.account;
heldCandidate.setClock("2026-11-18T15:01:00.000Z");
const heldScan = await heldCandidate.scouting.runDeskScoutJob(await scoutRuntime(heldCandidate)), heldRecord = await heldCandidate.store.readDeskRecord(owner);
await heldCandidate.service.queueDeskCycle(owner, heldRecord.state.revision, false, { scanId: heldScan.scanId, symbol: "NVDA" });
await heldCandidate.service.executeAgentDeskCycleJob(owner, heldCandidate.runtime());
const reviewedCandidate = await heldCandidate.service.readAgentDesk(owner);
same(reviewedCandidate.latestCycle.symbol, "NVDA"); same(reviewedCandidate.latestCycle.decision.code, "POSITION_SYMBOL_MISMATCH");
same(reviewedCandidate.account.position, heldBeforeCandidate.position); same(reviewedCandidate.account.cash, heldBeforeCandidate.cash);
same(reviewedCandidate.settings.symbol, "MSFT"); same((await heldCandidate.dependencies["./collaboration"].readAgentBriefs(owner)).length, 1);
heldCandidate.setClock("2026-11-18T15:02:00.000Z"); heldCandidate.hooks.quote = input => marketFixture(heldCandidate.clock(), 190, input.symbol);
const heldProtection = await heldCandidate.service.monitorDeskPosition(owner);
same(heldProtection.filled, true); same(heldCandidate.quoteCalls.at(-1).symbol, "MSFT", "Independent protection still observes the held stock after another candidate's research");
same((await heldCandidate.dependencies["./learning"].readAgentLearning(owner)).linkedTrades, 1);

const enqueueFailure = await serviceFixture(); await enqueueFailure.arm();
enqueueFailure.hooks.enqueue = () => { throw new Error("unsafe-provider-body-secret"); };
await rejected(() => enqueueFailure.queue(), /unsafe-provider-body-secret/);
const unqueued = await enqueueFailure.service.readAgentDesk(owner);
same(unqueued.busy, null); yes(!unqueued.lastError.includes("unsafe-provider-body-secret")); same(unqueued.account.position, null);

for (const stage of ["research", "quote"]) {
  const wrongSymbol = await serviceFixture();
  if (stage === "research") wrongSymbol.hooks.research = () => ({ ...researchFixture(wrongSymbol.clock()), symbol: "AAPL" });
  else wrongSymbol.hooks.quote = () => marketFixture(wrongSymbol.clock(), 200, "AAPL");
  await rejected(() => wrongSymbol.run(true), error => error.code === (stage === "research" ? "RESEARCH_SYMBOL_MISMATCH" : "QUOTE_SYMBOL_MISMATCH"));
  same(wrongSymbol.teamCalls.length, 0); same((await wrongSymbol.service.readAgentDesk(owner)).account.position, null);
}
const provenance = await serviceFixture(), originalMarket = marketFixture();
const adaptedQuote = provenance.service.executionQuote(originalMarket);
same(adaptedQuote.retrievedAt, originalMarket.health.retrievedAt.intraday); yes(adaptedQuote.retrievedAt !== originalMarket.retrievedAt);
for (const exchange of ["NASDAQ", "NYSE"]) {
  const quote = provenance.service.executionQuote({ ...clone(originalMarket), overview: { currency: "USD", exchange } });
  same(quote.marketOpen, true, `${exchange} can use a current open US market status`); same(quote.exchange, exchange);
}
for (const exchange of [undefined, "", "Unknown", "LSE", "TSX", "NASDAQ OMX STOCKHOLM"]) {
  const quote = provenance.service.executionQuote({ ...clone(originalMarket), overview: { currency: "USD", exchange } });
  same(quote.marketOpen, false, `${String(exchange)} cannot inherit US open-market authority merely from USD currency`);
}
same(provenance.service.executionQuote({ ...clone(originalMarket), overview: null }).marketOpen, false);
const noOriginalReceipt = clone(originalMarket); delete noOriginalReceipt.health.retrievedAt.intraday;
same(provenance.service.executionQuote(noOriginalReceipt), null, "An assembled response time cannot replace a missing original quote receipt");
for (const altered of [
  { ...clone(originalMarket), market: { ...originalMarket.market, isOpen: false } },
  { ...clone(originalMarket), health: { ...originalMarket.health, retrievedAt: { ...originalMarket.health.retrievedAt, marketStatus: "2026-11-18T14:58:00.000Z" } } },
  { ...clone(originalMarket), health: { ...originalMarket.health, cache: { ...originalMarket.health.cache, marketStatus: "stale-cache" } } },
  { ...clone(originalMarket), health: { ...originalMarket.health, retrievedAt: { ...originalMarket.health.retrievedAt, marketStatus: "2026-11-18T15:05:00.000Z" } } },
]) same(provenance.service.executionQuote(altered).marketOpen, false, "Open-session claims require a current original market-status observation");
const evidencePacket = researchFixture(now), baseEvidence = evidencePacket.evidence[0];
evidencePacket.evidence.push(
  { ...baseEvidence, id: "wrong-stock", symbol: "AAPL" }, { ...baseEvidence, id: "zero-confidence", confidence: 0 },
  { ...baseEvidence, id: "zero-relevance", relevanceScore: 0 }, { ...baseEvidence, id: "stale-news", asOf: "2026-11-01T15:00:00.000Z" },
  { ...baseEvidence, id: "missing-date", asOf: null }, { ...baseEvidence, id: "unsafe-source", sourceUrl: "javascript:alert(1)" },
  { ...baseEvidence, id: "safe-link", title: "Additional distinct current company earnings fixture", sourceUrl: "https://publisher.example/story?api_key=private-fixture&utm_source=tracker&id=123#fragment" },
);
evidencePacket.currentResearch.discoveries = [
  { id: "current-public", title: "Fictional feed summary", summary: "No full article was read.", publisher: "Publisher", url: "https://publisher.example/feed", publishedAt: now, retrievedAt: now, linkKind: "direct", publisherAttribution: "feed" },
  { id: "stale-public", title: "Old", summary: "Old", publisher: "Publisher", url: "https://publisher.example/old", publishedAt: "2026-11-01T15:00:00.000Z", retrievedAt: now },
];
const filteredEvidence = provenance.service.deskEvidence(evidencePacket);
same(filteredEvidence.map(row => row.id), ["news-one", "safe-link", "quote-one", "discovery:current-public"]);
same(filteredEvidence.find(row => row.id === "safe-link").url, "https://publisher.example/story?id=123");
same(filteredEvidence.find(row => row.kind === "public-discovery").metrics.contentScope, "feed-title-and-summary-not-full-article");
yes(!JSON.stringify(filteredEvidence).includes("private-fixture"));
const referenceEvidence = pending.latestCycle.evidence.find(row => row.kind === "execution-reference");
yes(Boolean(referenceEvidence)); same(referenceEvidence.metrics.price, manual.teamCalls[0].input.market.price);
same(referenceEvidence.observedAt, manual.teamCalls[0].input.market.observedAt);

// Exercise real route wrappers, real request parsing, and the shared origin and
// rate controls. Only authenticated-user lookup and external I/O are substituted.
const logs = [];
const logger = { info: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args), child() { return this; } };
const loggerModule = { createLogger: () => logger };
const betaPolicy = await load("src/lib/research/beta-policy.ts");
const api = await load("src/lib/api-route.ts", { "@/lib/logger": loggerModule, "@/lib/research/beta-policy": betaPolicy });
const security = await load("src/lib/security.ts", { "@/lib/logger": loggerModule, "@/lib/prisma": { prisma: {} } }, { Date: FixtureDate });
const strategies = await load("src/lib/strategy-lab/contracts.ts");
const routeFixture = await serviceFixture(); let loggedInScope = owner, requestNumber = 0;
const currentAccess = { requireCurrentAccessContext: async () => {
  if (!loggedInScope) throw new api.ApiError({ status: 401, code: "UNAUTHENTICATED", message: "Sign in first.", expose: true });
  return { user: { id: loggedInScope.userId }, firm: loggedInScope.firmId ? { id: loggedInScope.firmId, platformStatus: "Active" } : null, membership: { status: "Active" } };
} };
const connected = await load("src/lib/connected-research/access.ts", { "@/lib/api-route": api, "@/lib/access-control": currentAccess, "@/lib/security": security });
const requestParsing = await load("src/lib/strategy-lab/http.ts", { "@/lib/api-route": api, "@/lib/access-control": currentAccess, "@/lib/security": security,
  "./contracts": strategies, "@/lib/data-readiness/server": routeFixture.dependencies["@/lib/data-readiness/server"], "@/lib/data-readiness/core": readiness });
const afterCallbacks = [], processedJobs = [];
const route = await load("src/app/api/intelligence/agent-desk/route.ts", {
  "next/server": { after: callback => afterCallbacks.push(callback) }, "@/lib/api-route": api,
  "@/lib/connected-research/access": connected, "@/lib/strategy-lab/http": requestParsing, "@/lib/strategy-lab/contracts": strategies,
  "@/lib/data-readiness/server": routeFixture.dependencies["@/lib/data-readiness/server"], "@/lib/data-readiness/core": readiness,
  "@/lib/background-jobs/worker": { processBackgroundJobIds: async input => { processedJobs.push(clone(input)); } },
  "@/lib/agent-desk/contracts": contracts, "@/lib/agent-desk/guardrails": guards, "@/lib/agent-desk/service": routeFixture.service,
  "@/lib/agent-desk/access": routeFixture.founderAccess,
  "@/lib/agent-desk/scouting": routeFixture.scouting,
});
function routeRequest(method = "GET", body, options = {}) {
  return new Request("https://slice.example/api/intelligence/agent-desk", { method,
    headers: { host: "slice.example", origin: "https://slice.example", "content-type": "application/json", "x-real-ip": `192.0.2.${++requestNumber}`, ...options.headers },
    ...(method === "GET" ? {} : { body: options.raw ?? JSON.stringify(body) }),
  });
}
loggedInScope = null;
let routeResponse = await route.GET(routeRequest()); same(routeResponse.status, 401); same(routeFixture.db.rows().length, 0);
routeResponse = await route.POST(routeRequest("POST", { action: "arm", revision: 0, paperOnly: true }));
same(routeResponse.status, 401); same(routeFixture.db.rows().length, 0, "Unauthenticated requests cannot initialize or mutate an account");
loggedInScope = { userId: owner.userId, firmId: null };
routeResponse = await route.GET(routeRequest()); same(routeResponse.status, 403); same((await routeResponse.json()).error.code, "FIRM_REQUIRED");
loggedInScope = owner;
for (const headers of [{ origin: "https://other.example" }, { "sec-fetch-site": "cross-site" }, { origin: "not-an-origin" }]) {
  routeResponse = await route.POST(routeRequest("POST", { action: "arm", revision: 0, paperOnly: true }, { headers }));
  same(routeResponse.status, 403); same((await routeResponse.json()).error.code, "CROSS_SITE_BLOCKED");
}
same(routeFixture.db.rows().length, 0, "Blocked cross-site writes do not reach the state store");
routeResponse = await route.GET(routeRequest()); same(routeResponse.status, 200); same(routeResponse.headers.get("cache-control"), "private, no-store");
const routeDesk = (await routeResponse.json()).desk; same(routeDesk.executionMode, "paper"); same(routeDesk.liveExecutionAvailable, false);
yes(routeResponse.headers.has("x-request-id")); same(routeResponse.headers.get("x-content-type-options"), "nosniff");
for (const [body, options, status, code] of [
  [{ action: "arm", revision: 0, paperOnly: true, userId: "other-owner" }, {}, 400, "INVALID_DESK_COMMAND"],
  [{ action: "arm", revision: 0, paperOnly: true, quote: { price: 1 } }, {}, 400, "INVALID_DESK_COMMAND"],
  [{ action: "approve", revision: 0, cycleId: "invented", paperOnly: true, approved: true }, {}, 400, "INVALID_DESK_COMMAND"],
  [{ action: "enable", revision: 0, paperOnly: true, live: true }, {}, 400, "INVALID_DESK_COMMAND"],
  [{ action: "arm", revision: "0", paperOnly: true }, {}, 400, "INVALID_DESK_COMMAND"],
  [{ action: "place_order", revision: 0 }, {}, 400, "INVALID_DESK_ACTION"],
  [{ action: "arm", revision: 0, paperOnly: "true" }, {}, 400, "PAPER_ACK_REQUIRED"],
  [{ action: "arm", revision: 0, paperOnly: true }, { headers: { "content-type": "text/plain" } }, 415, "JSON_REQUIRED"],
  [null, { raw: "[1,2,3]" }, 400, "INVALID_JSON"], [null, { raw: "not-json" }, 400, "INVALID_JSON"],
  [null, { raw: " ".repeat(64001) }, 413, "BODY_TOO_LARGE"],
]) {
  routeResponse = await route.POST(routeRequest("POST", body, options)); same(routeResponse.status, status); same((await routeResponse.json()).error.code, code);
}
same((await routeFixture.store.readDeskRecord(owner)).state.controls.armed, false);
same(afterCallbacks.length, 0); same(routeFixture.queueCalls.length, 0, "Invalid client input cannot obtain a worker lease");
routeResponse = await route.POST(routeRequest("POST", { action: "arm", revision: 0, paperOnly: true }));
same(routeResponse.status, 200); same((await routeResponse.json()).desk.controls.armed, true);
routeResponse = await route.POST(routeRequest("POST", { action: "cycle", revision: 1 }));
same(routeResponse.status, 200); const browserQueued = (await routeResponse.json()).desk;
same(browserQueued.busy.jobId, "job-1"); yes(!JSON.stringify(browserQueued).includes(routeFixture.queueCalls[0].payload.token));
same(afterCallbacks.length, 1); await afterCallbacks[0](); same(processedJobs, [{ jobIds: ["job-1"], concurrency: 1, workerPrefix: "agent-desk" }]);
loggedInScope = otherOwner;
routeResponse = await route.POST(routeRequest("POST", { action: "approve", revision: 0, cycleId: browserQueued.busy.cycleId, paperOnly: true }));
same(routeResponse.status, 409); same((await routeResponse.json()).error.code, "PROPOSAL_NOT_PENDING");
routeResponse = await route.GET(routeRequest()); same((await routeResponse.json()).desk.busy, null, "Session identity selects the account, never request body identifiers");
loggedInScope = owner;
for (let index = 0; index < 21; index++) routeResponse = await route.POST(routeRequest("POST", { action: "unsupported", revision: 1 }, { headers: { "x-real-ip": "192.0.2.250" } }));
same(routeResponse.status, 429); same((await routeResponse.json()).error.code, "RATE_LIMITED");

const scheduled = await serviceFixture(); await scheduled.arm(true);
const scheduler = await load("src/lib/agent-desk/scheduler.ts", { "./contracts": contracts, "./store": scheduled.store, "./service": scheduled.service,
  "./scouting": scheduled.scouting, "@/lib/background-jobs/queue": scheduled.dependencies["@/lib/background-jobs/queue"],
  "@/lib/agent-broker/service": { scheduledBrokerScopes: async () => [], runBrokerMonitoring: async () => ({ status: "disabled" }), getBrokerView: scheduled.dependencies["@/lib/agent-broker/service"].getBrokerView } }, { Date: scheduled.ServiceDate });
const scheduleRuns = await Promise.all([scheduler.runAgentDeskSchedule(), scheduler.runAgentDeskSchedule()]);
same(scheduled.queueCalls.length, 1, "Overlapping scheduler invocations share the same durable queue fence");
same(scheduleRuns.reduce((count, run) => count + run.results.filter(row => row.state === "queued").length, 0), 1);
yes(scheduleRuns.every(run => run.scanned === 1)); same(scheduled.teamCalls.length, 0, "Scheduling itself does not run blocking AI work");
yes(scheduled.queueCalls[0].payload.scheduled === true);
scheduled.hooks.quote = () => { const data = marketFixture(); data.market.isOpen = false; return data; };
const closedRun = await scheduled.service.executeAgentDeskCycleJob(owner, scheduled.runtime());
same(closedRun.deferred, true); same(scheduled.researchCalls.length, 0); same(scheduled.teamCalls.length, 0);
same((await scheduled.service.readAgentDesk(owner)).account.position, null, "A closed regular session does not spend autonomous AI calls or invent a fill");
await scheduled.service.updateDeskControls(owner, { action: "kill", revision: -1 });
same((await scheduler.runAgentDeskSchedule()).scanned, 0, "Killed accounts do not remain in the autonomous queue");

const cronEnvironment = { env: {} }; let scheduleCalls = 0;
const cron = await load("src/app/api/cron/agent-desk/route.ts", { "@/lib/api-route": api, "@/lib/agent-desk/scheduler": { runAgentDeskSchedule: async () => { scheduleCalls++; return { scanned: 0, results: [] }; } } }, { process: cronEnvironment });
function cronRequest(authorization) { return new Request("https://slice.example/api/cron/agent-desk", { headers: authorization ? { authorization } : {} }); }
routeResponse = await cron.GET(cronRequest()); same(routeResponse.status, 401); same(scheduleCalls, 0);
cronEnvironment.env.CRON_SECRET = "fixture-cron-secret";
for (const value of [undefined, "Bearer wrong", "Bearer fixture-cron-secreu"]) { routeResponse = await cron.GET(cronRequest(value)); same(routeResponse.status, 401); }
same(scheduleCalls, 0); routeResponse = await cron.GET(cronRequest("Bearer fixture-cron-secret"));
same(routeResponse.status, 200); same(scheduleCalls, 1); same((await routeResponse.json()).ok, true);

// New orchestration uses the same real service and six-agent protocol, with
// controlled resource/helper/broker boundaries. No external broker is called.
const integrated = await serviceFixture();
const integratedSource = { id: "integrated-public-source", title: "Observed source inventory fixture", summary: "A bounded public source reference.", source: "Controlled public source", url: "https://issuer.example.com/filing", observedAt: now, retrievedAt: now, kind: "tool-research", cohort: "media", metrics: { increasesResearchConfidence: false } };
integrated.hooks.resources = (scope, input) => {
  same(scope, owner); same(input.symbol, "MSFT"); same(input.webEnabled, true); same(input.includeShared, true);
  const result = emptyAccessFixture(input.symbol, integrated.clock());
  result.evidence = [clone(integratedSource)]; result.web.status = "cached"; result.web.cacheHit = true;
  result.web.sources = [{ id: integratedSource.id, title: integratedSource.title, url: integratedSource.url, publisher: integratedSource.source, publishedAt: now, retrievedAt: now, contentScope: "search-reference", excerpt: null, sha256: null, scope: "owner" }];
  result.workspace.capabilities = [{ id: "strategies", label: "Saved strategies", status: "empty", recordCount: 0, scope: "owner", detail: "Controlled empty owner inventory." }];
  return result;
};
integrated.hooks.broker = scope => {
  same(scope, owner);
  return { provider: "Alpaca", revision: 7, mode: "paper", connected: true, controls: { enabled: true, autonomous: false, paused: false },
    safeguards: { maxPositionPct: 7, allowedSymbols: ["MSFT"] }, account: { cash: 125000, equity: 200000, buyingPower: 125000, status: "ACTIVE" },
    positions: [{ symbol: "MSFT", quantity: 2, averageEntryPrice: 190 }], activePositionSymbol: "MSFT", pendingOrder: null, observedAt: integrated.clock(), readiness: {}, limitations: [] };
};
integrated.hooks.brokerObservation = (scope, symbol) => { same(scope, owner); return { symbol, bid: 199.99, ask: 200.01, observedAt: integrated.clock(), receivedAt: integrated.clock(), marketOpen: true, feed: "iex" }; };
integrated.hooks.helpers = async (context, settings, input) => {
  same(context.executionTarget, "alpaca-paper"); same(context.broker.account.cash, 125000); same(input.ownerId, owner.userId); same(settings.mode, "economy");
  yes(context.evidence.some(row => row.id === integratedSource.id));
  const worker = { id: "news-resource-fixture", parentRole: "news", focus: "Inspect the one controlled source reference." };
  const helperReport = { ...report({ findings: [{ claim: "The public reference retains its original date.", evidenceIds: [integratedSource.id] }], horizonViews: [] }), role: "news", status: "complete", startedAt: integrated.clock(), completedAt: integrated.clock(), model: "controlled-fixture", requestId: null, error: null, phase: "research", round: 0, worker,
    usage: { requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, measuredResponses: 0, unmeasuredResponses: 0 } };
  await input.publishReport(helperReport);
  return [{ ...worker, evidenceIds: [integratedSource.id], sourceHash: "d".repeat(64), report: helperReport }];
};
const integratedResult = await integrated.run();
const integratedView = await integrated.service.readAgentDesk(owner), integratedContext = integrated.teamCalls[0].input;
same(integratedContext.executionTarget, "alpaca-paper"); same(integratedContext.broker.account.cash, 125000); same(integratedContext.account.position, null, "Observed broker holdings remain separate from the local simulation");
same(integratedContext.broker.positions[0].quantity, 2); same(integratedContext.policy.maxPositionPct, Math.min(integratedView.settings.policy.maxPositionPct, 7));
same(integratedContext.helpers.length, 1); yes(integratedContext.board.some(row => row.report?.worker?.id === "news-resource-fixture"));
yes(integratedView.latestCycle.evidence.some(row => row.id === integratedSource.id)); same(integratedView.latestCycle.helpers.length, 1); same(integratedView.latestCycle.resources.internet.cacheHit, true);
same(integratedView.latestCycle.deliberation.reports, 12, "Helpers are attributed separately from the twelve principal-round reports");
same(integratedView.latestCycle.usage.requests, 24, "Twelve role reports use two controlled provider calls each in combined-read mode");
same(integrated.brokerCalls.filter(row => row.action === "proposal").map(row => row.input.cycleId), [integratedResult.cycleId], "Only the backend receives the final cycle identity, never model order parameters");
same(integrated.quoteCalls.length, 0, "Enabled brokerage research uses broker observations rather than a different provider's simulation quote");
yes(!JSON.stringify(integratedContext).includes("fixture-only-provider-key"));

// An enabled brokerage connection must not turn native index research into
// an equity lookup or reject a legitimate manual index research request.
const brokerWithIndex = await serviceFixture();
brokerWithIndex.hooks.broker = integrated.hooks.broker;
brokerWithIndex.hooks.brokerObservation = () => { assert.fail("Native index research must never request an Alpaca equity quote"); };
brokerWithIndex.hooks.quote = input => {
  same(input.symbol, "INDEX:SPX");
  const data = marketFixture(brokerWithIndex.clock(), 6500, input.symbol);
  data.quote.sourceKind = "native-index-daily"; data.freshness.isRealtime = false;
  data.health.retrievedAt.index = brokerWithIndex.clock(); data.health.cache.index = "network";
  return data;
};
const indexSettings = await brokerWithIndex.store.readDeskRecord(owner);
await brokerWithIndex.service.updateDeskControls(owner, { action: "settings", revision: indexSettings.state.revision, settings: { ...indexSettings.state.settings, symbol: "^GSPC" } });
await brokerWithIndex.run();
const nativeIndexView = await brokerWithIndex.service.readAgentDesk(owner), nativeIndexContext = brokerWithIndex.teamCalls[0].input;
same(brokerWithIndex.researchCalls.map(call => call.symbol), ["INDEX:SPX"]); same(brokerWithIndex.quoteCalls.length, 2);
same(brokerWithIndex.brokerCalls.filter(call => ["observation", "proposal"].includes(call.action)), [], "Index research neither asks the broker for an equity quote nor submits a Chief proposal to it");
same(nativeIndexContext.symbol, "INDEX:SPX"); same(nativeIndexContext.executionTarget, "local-simulation"); same(nativeIndexContext.market.instrumentKind, "index"); same(nativeIndexContext.market.realTimeConfirmed, false);
same(nativeIndexView.latestCycle.symbol, "INDEX:SPX"); same(nativeIndexView.latestCycle.proposal.symbol, "INDEX:SPX"); same(nativeIndexView.latestCycle.executionTarget, "local-simulation");
same(nativeIndexView.latestCycle.agents.length, 6); yes(nativeIndexView.latestCycle.agents.every(agent => agent.status === "complete"));
yes(nativeIndexView.latestCycle.evidence.some(row => row.kind === "execution-reference" && row.source === "Alpha Vantage"));
same(nativeIndexView.latestCycle.fill, null); same(nativeIndexView.account.position, null, "A native index remains non-tradable even when the controlled model fixture proposes a buy");
same(forbiddenFetches, 0); same(timers.size, 0);
console.log(`Agent Desk runtime: ${assertions} checks passed (actual agents, store, service, scheduler, authenticated API/cron routes, read-only tools, grounding, cancellation, atomic receipts, leases, replay, stale approvals, protective exits, CSRF, and input boundaries; controlled provider and database doubles only).`);
