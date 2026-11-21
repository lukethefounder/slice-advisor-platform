import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript");
let assertions = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const yes = (actual, message) => { assert.ok(actual, message); assertions++; };
const rejected = async (action, code, message) => { await assert.rejects(action, error => error.code === code, message); assertions++; };
const throws = (action, code, message) => { assert.throws(action, error => error.code === code, message); assertions++; };
const clone = value => structuredClone(value);
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: path, reportDiagnostics: true });
  same(result.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`);
  const module = { exports: {} };
  const resolve = name => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "server-only" ? {} : name.startsWith("node:") ? require(name) : (() => { throw new Error(`Unmocked dependency ${name}`); })();
  new Function("require", "module", "exports", "fetch", "process", result.outputText)(resolve, module, module.exports,
    () => { throw new Error("No live service may be called by memory tests"); }, { env: {} });
  return module.exports;
}

function database() {
  let rows = [], sequence = 0, clock = "2026-11-19T15:00:00.000Z", failKind = null;
  const calls = [];
  const match = (row, where) => Object.entries(where ?? {}).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if ("in" in expected) return expected.in.includes(actual);
      if ("lte" in expected && !(new Date(actual).getTime() <= new Date(expected.lte).getTime())) return false;
      if ("gte" in expected && !(new Date(actual).getTime() >= new Date(expected.gte).getTime())) return false;
      return true;
    }
    return actual === expected;
  });
  const select = (row, fields) => row && (fields ? Object.fromEntries(Object.keys(fields).filter(key => fields[key]).map(key => [key, clone(row[key])])) : clone(row));
  const events = {
    async findFirst(input) { calls.push({ method: "findFirst", input: clone(input) }); return select(rows.find(row => match(row, input.where)) ?? null, input.select); },
    async findMany(input) {
      calls.push({ method: "findMany", input: clone(input) });
      const found = rows.filter(row => match(row, input.where));
      if (input.orderBy) found.sort((a, b) => {
        for (const order of input.orderBy) {
          const [key, direction] = Object.entries(order)[0];
          const left = a[key] instanceof Date ? a[key].getTime() : a[key], right = b[key] instanceof Date ? b[key].getTime() : b[key];
          if (left < right) return direction === "desc" ? 1 : -1;
          if (left > right) return direction === "desc" ? -1 : 1;
        }
        return 0;
      });
      return found.slice(0, input.take ?? found.length).map(row => select(row, input.select));
    },
    async count(input) { calls.push({ method: "count", input: clone(input) }); return rows.filter(row => match(row, input.where)).length; },
    async upsert(input) {
      calls.push({ method: "upsert", input: clone(input) });
      same(input.update, {}, "Agent artifacts cannot replace a prior report or outcome");
      const key = input.where.userId_eventKey;
      let row = rows.find(row => row.userId === key.userId && row.eventKey === key.eventKey);
      if (!row) {
        if (failKind && input.create.eventType === failKind) { const error = new Error("controlled storage interruption"); error.code = "INJECTED_STORAGE_FAILURE"; throw error; }
        row = { id: `event-${String(++sequence).padStart(6, "0")}`, createdAt: new Date(clock), updatedAt: new Date(clock), ...clone(input.create) }; rows.push(row);
      }
      return select(row, input.select);
    },
  };
  const db = { backendPlatformEvent: events };
  return { db, calls, get rows() { return rows; }, setClock(value) { clock = value; }, failOn(kind) { failKind = kind; },
    async transaction(action) { const snapshot = clone(rows); try { return await action(db); } catch (error) { rows = snapshot; throw error; } },
    seed(row) { rows.push(clone(row)); }, mutate(id, change) { const row = rows.find(item => item.id === id); Object.assign(row, change); } };
}
const harness = database(), scope = { userId: "founder-owner", firmId: "firm-private" }, outsider = { userId: "other-owner", firmId: "firm-private" }, otherFirm = { userId: "founder-owner", firmId: "other-firm" };
const guards = await load("src/lib/agent-desk/guardrails.ts");
const contracts = await load("src/lib/agent-desk/contracts.ts");
const storage = await load("src/lib/agent-desk/collaboration-storage.ts", { "@/lib/prisma": { prisma: harness.db }, "./contracts": contracts });
const learning = await load("src/lib/agent-desk/learning.ts", { "./contracts": contracts, "./collaboration-storage": storage });
const collaboration = await load("src/lib/agent-desk/collaboration.ts", { "./contracts": contracts, "./guardrails": guards, "./collaboration-storage": storage, "./learning": learning });
const { appendAgentBoardMessage, readAgentBoard, writeCycleArtifacts, readAgentBriefs, markAgentBriefRead, readAgentCollaboration } = collaboration;

const digest = "a".repeat(64), first = "2026-11-19T15:00:00.000Z";
const report = role => ({ role, status: "complete", stance: role === "sentiment" ? "neutral" : "bullish", summary: `${role} controlled report`,
  findings: [{ claim: "Controlled source supports review.", evidenceIds: ["evidence:one"] }], risks: ["A future observation can reverse the setup."], missingData: role === "charts" ? ["No bid/ask spread measurement."] : [], veto: false,
  action: role === "chief" ? "buy" : "hold", allocationPct: role === "chief" ? 10 : null, model: "fixture-model", requestId: "fixture-request", startedAt: first, completedAt: first, error: null, toolCalls: [{ tool: "inspect_evidence", evidenceIds: ["evidence:one"], at: first }] });
const message = (patch = {}) => ({ id: "cycle-1:research:news", cycleId: "cycle-1", symbol: "MSFT", round: 1, phase: "research", from: "news", to: "team", replyToIds: [], body: "The dated source supports a cautious review.", evidenceIds: ["evidence:one"], createdAt: first, researchRunId: "research-1", sourceHash: digest, report: report("news"), ...patch });

const input = message(), original = clone(input);
await appendAgentBoardMessage(scope, input);
same(input, original, "Message persistence does not mutate caller data");
same((await appendAgentBoardMessage(scope, input)).id, input.id, "Identical retries preserve the original message");
same((await readAgentBoard(scope)).length, 1);
same(await readAgentBoard(outsider), [], "Messages remain private to the owner");
same(await readAgentBoard(otherFirm), [], "Messages remain private to the firm");
await rejected(() => appendAgentBoardMessage(scope, message({ body: "Changed hindsight account" })), "AGENT_ARTIFACT_REPLAY_CONFLICT");
same((await readAgentBoard(scope))[0].body, original.body, "A replay cannot rewrite history");
const reply = message({ id: "cycle-1:challenge:skeptic", phase: "challenge", round: 2, from: "skeptic", to: "news", report: report("skeptic"), createdAt: "2026-11-19T15:00:01.000Z", replyToIds: [input.id], body: "How does the quoted source support that interpretation?" });
await appendAgentBoardMessage(scope, reply);
same((await readAgentBoard(scope, { cycleId: "cycle-1" })).map(item => item.phase), ["research", "challenge"]);
await rejected(() => appendAgentBoardMessage(outsider, reply), "INVALID_AGENT_REPLY", "Another owner cannot reply to this private thread");
await rejected(() => appendAgentBoardMessage(scope, { ...reply, id: "cycle-2:reply", cycleId: "cycle-2" }), "INVALID_AGENT_REPLY");
await rejected(() => appendAgentBoardMessage(scope, { ...reply, id: "cycle-1:future-parent", createdAt: "2026-11-19T14:59:00.000Z" }), "INVALID_AGENT_REPLY");
await rejected(() => appendAgentBoardMessage(scope, { ...reply, id: "cycle-1:self", replyToIds: ["cycle-1:self"] }), "INVALID_AGENT_REPLY");
same((await readAgentBoard(scope, { before: first })).map(item => item.id), [input.id], "A later message is unavailable to a past cutoff");
for (const patch of [{ from: "broker" }, { to: "everyone" }, { round: 17 }, { body: "" }, { body: "x".repeat(12001) }, { createdAt: "invalid" }, { sourceHash: "not-a-hash" }, { evidenceIds: ["unsafe/path"] }, { replyToIds: Array(25).fill("same") }, { report: report("chief") }])
  await rejected(() => appendAgentBoardMessage(scope, message({ ...patch, id: "invalid-message" })), "INVALID_AGENT_MESSAGE");
await rejected(() => appendAgentBoardMessage(scope, message({ id: "founder:fake", from: "founder", report: null })), "INVALID_FOUNDER_MESSAGE");
await appendAgentBoardMessage(scope, message({ id: "founder:note", from: "founder", to: "chief", phase: "challenge", report: null, evidenceIds: [], body: "Review the previous closed-trade lessons before another entry." }));
same((await readAgentBoard(scope)).find(item => item.from === "founder").to, "chief");
for (const call of harness.calls.filter(item => ["findFirst", "findMany", "count"].includes(item.method))) {
  yes(call.input.where.userId && call.input.where.firmId, "Every retrieval is explicitly owner/firm scoped");
  yes(call.input.where.eventType.startsWith("SLICE_AGENT_DESK_"), "Artifact types use the private desk namespace");
}

// Checksums and embedded scope defend against accidental corruption or a wrong-row response.
const encoded = storage.encodePrivateArtifact(scope, "board", { version: 1 });
same(storage.decodePrivateArtifact(encoded, scope, "board"), { version: 1 });
throws(() => storage.decodePrivateArtifact(encoded, outsider, "board"), "AGENT_ARTIFACT_INVALID");
throws(() => storage.decodePrivateArtifact(encoded, scope, "brief"), "AGENT_ARTIFACT_INVALID");
const broken = JSON.parse(encoded); broken.payload = broken.payload.replace("founder-owner", "someone-else");
throws(() => storage.decodePrivateArtifact(JSON.stringify(broken), scope, "board"), "AGENT_ARTIFACT_INVALID");

function quote(price, observedAt, retrievedAt) { return { symbol: "MSFT", price, observedAt, retrievedAt, marketOpen: true, realTimeConfirmed: true, instrumentKind: "equity", currency: "USD", sourceKind: "intraday-bar", exchange: "NASDAQ" }; }
function cycle(id, result, q, timestamp, agents = contracts.AGENT_ROLES.map(report)) {
  return { version: 1, id, symbol: "MSFT", status: "complete", startedAt: timestamp, completedAt: timestamp, settingsRevision: 1,
    researchRunId: "research-1", researchScore: { confidence: 55, quality: { evidenceCoverage: 55, contradictionPenalty: 2 }, methodology: { sourceConcentrationPercent: 70 } }, currentResearch: null,
    agents, evidence: [], proposal: { action: result.fill?.side === "SELL" ? "sell" : "buy", symbol: "MSFT", referencePrice: q.price, allocationPct: 10, rationale: "Grounded controlled fixture" },
    decision: result.decision, fill: result.fill, errors: [], sourceHash: digest, equity: result.equity, unrealizedPnl: result.unrealizedPnl, contextQuote: q, executionQuote: q, mode: "paper", executionStatus: result.fill ? "filled" : "blocked" };
}
const policy = { ...clone(guards.DEFAULT_DESK_POLICY), feeBps: 1, commissionUsd: 1 };
const controls = { armed: true, autonomous: true, paused: false, killSwitch: false };
const assessment = { researchRunId: "research-1", evaluatedAt: first, confidence: 55, coverage: 55, evidenceVerified: true, allAgentsCompleted: true, skepticVeto: false };
const initial = guards.createPaperAccount({ initialCapital: 100000, now: first });
const buyQuote = quote(200, "2026-11-19T14:59:00.000Z", "2026-11-19T14:59:10.000Z");
const buyResult = guards.applyPaperCycle({ account: initial, policy, controls, cycleId: "buy-1", expectedSequence: 0, now: first, quote: buyQuote, assessment,
  proposal: { action: "buy", symbol: "MSFT", referencePrice: 200, allocationPct: 10, rationale: "Controlled bullish research" } });
same(buyResult.decision.code, "PAPER_BUY");
const buyCycle = cycle("buy-1", buyResult, buyQuote, first), buyInput = { cycle: buyCycle, beforeAccount: initial, afterAccount: buyResult.account };
const immutableBefore = JSON.stringify(buyInput);
const beforeBuyRows = harness.rows.length;
const buyArtifacts = await harness.transaction(tx => writeCycleArtifacts(tx, scope, buyInput));
same(JSON.stringify(buyInput), immutableBefore, "Artifact creation preserves the original account/report inputs");
same(harness.rows.length - beforeBuyRows, 3, "An entry atomically persists original entry, personal brief, and execution message");
same(buyArtifacts.outcome, null, "Opening a position cannot manufacture a realized outcome");
same(buyArtifacts.brief.netPnl, null);
same(buyArtifacts.brief.realized, false);
same(buyArtifacts.brief.readAt, null);
same(buyArtifacts.brief.delivery, "in-app", "No unsupported email-delivery claim is made");
same(buyArtifacts.brief.executionQuote.retrievedAt, buyQuote.retrievedAt);
same((await learning.readAgentLearning(scope, { now: first })).closedTrades, 0);
await harness.transaction(tx => writeCycleArtifacts(tx, scope, buyInput));
same(harness.rows.length - beforeBuyRows, 3, "Entry artifact retries remain idempotent");

const entryKey = collaboration.entryArtifactId(buyResult.account.position);
const positionWithNewMark = { ...buyResult.account.position, peakPrice: 300, stopLossPct: .5 };
same(collaboration.entryArtifactId(positionWithNewMark), entryKey, "Marks and tightened exit settings retain the same original entry identity");
yes(collaboration.entryArtifactId({ ...positionWithNewMark, quantity: positionWithNewMark.quantity + 1 }) !== entryKey);

let briefs = await readAgentBriefs(scope);
same(briefs.length, 1);
same(await readAgentBriefs(outsider), []);
same(await readAgentBriefs(otherFirm), []);
await rejected(() => markAgentBriefRead(outsider, briefs[0].id, harness.db, first), "AGENT_BRIEF_NOT_FOUND");
await rejected(() => markAgentBriefRead(scope, briefs[0].id, harness.db, "2026-11-19T14:00:00.000Z"), "INVALID_AGENT_TIME");
const readAt = "2026-11-19T15:00:02.000Z";
same((await markAgentBriefRead(scope, briefs[0].id, harness.db, readAt)).readAt, readAt);
same((await markAgentBriefRead(scope, briefs[0].id, harness.db, "2026-11-19T15:00:03.000Z")).readAt, readAt, "Repeated read acknowledgment preserves its first receipt");
same((await readAgentBriefs(scope))[0].readAt, readAt);

const closedAt = "2026-11-19T15:10:00.000Z";
harness.setClock(closedAt);
const sellQuote = quote(190, "2026-11-19T15:09:00.000Z", "2026-11-19T15:09:04.000Z");
const sellResult = guards.applyPaperCycle({ account: buyResult.account, policy, controls, cycleId: "sell-1", expectedSequence: buyResult.account.sequence, now: closedAt,
  quote: sellQuote, assessment: null, proposal: null });
same(sellResult.decision.code, "STOP_LOSS_EXIT");
const sellCycle = cycle("sell-1", sellResult, sellQuote, closedAt, []);
sellCycle.researchScore = null; sellCycle.researchRunId = null; sellCycle.proposal = null;
const sellInput = { cycle: sellCycle, beforeAccount: buyResult.account, afterAccount: sellResult.account };
const beforeExitRows = harness.rows.length;
harness.failOn(storage.DESK_ARTIFACT_TYPES.brief);
await rejected(() => harness.transaction(tx => writeCycleArtifacts(tx, scope, sellInput)), "INJECTED_STORAGE_FAILURE");
same(harness.rows.length, beforeExitRows, "A failed personal brief write rolls the new outcome back with the transaction");
same((await learning.readAgentLearning(scope, { now: closedAt })).closedTrades, 0, "Interrupted publication cannot leave partial learning");
harness.failOn(null);
const sellArtifacts = await harness.transaction(tx => writeCycleArtifacts(tx, scope, sellInput));
same(harness.rows.length - beforeExitRows, 4, "An exit stores outcome, personal brief, execution, and learning notice together");
same(sellArtifacts.outcome.entryCycleId, "buy-1");
same(sellArtifacts.outcome.netPnl, sellResult.fill.realizedPnl);
same(sellArtifacts.brief.realized, true);
same(sellArtifacts.brief.netPnl, sellResult.fill.realizedPnl);
same(sellArtifacts.brief.attribution, "linked-entry");
same(sellArtifacts.outcome.entryAgents.map(item => item.role), contracts.AGENT_ROLES, "Exit attribution retains the original entry reports, not a protective check's empty team");
same(sellArtifacts.outcome.holdingMinutes, 10);
yes(sellArtifacts.outcome.netReturnPct < 0);
same(sellArtifacts.outcome.entryFees, buyResult.fill.fees);
same(sellArtifacts.outcome.exitFees, sellResult.fill.fees);
yes(sellArtifacts.outcome.entryConditions.includes("documented-missing-inputs"));
yes(sellArtifacts.outcome.entryConditions.includes("source-concentration-over-65"));
yes(sellArtifacts.outcome.entryConditions.includes("sentiment-not-bullish"));
same(sellArtifacts.outcome.entryConfidence, 55);
await harness.transaction(tx => writeCycleArtifacts(tx, scope, sellInput));
same(harness.rows.length - beforeExitRows, 4, "Repeated exit processing cannot add another outcome or brief");
const remembered = await learning.readAgentLearning(scope, { now: closedAt });
same(remembered.closedTrades, 1);
same(remembered.linkedTrades, 1);
same(remembered.losses, 1);
same(remembered.observedWinRatePct, 0);
same(remembered.netPnl, sellResult.fill.realizedPnl);
same(remembered.byRole.map(item => item.reviewedTrades), [1, 1, 1, 1, 1, 1]);
yes(remembered.lessons.length > 0);
yes(remembered.lessons.every(item => item.status === "review-candidate" && item.sampleCount === 1 && item.advisoryOnly));
yes(remembered.lessons.every(item => item.relatedCycleIds.includes("sell-1")));
same((await learning.readAgentLearning(outsider, { now: closedAt })).closedTrades, 0);
same((await learning.readAgentLearning(scope, { symbol: "NVDA", now: closedAt })).closedTrades, 0);
same((await learning.readAgentLearning(scope, { now: first })).closedTrades, 0, "A future close cannot leak into an earlier research decision");
same((await readAgentBoard(scope, { cycleId: "sell-1" })).map(item => item.phase), ["execution", "learning"]);

// Legacy positions get a real accounting outcome without inventing an entry model history.
const legacy = learning.closedTradeOutcome(sellCycle, buyResult.account, null);
same(legacy.attribution, "legacy-entry-unavailable");
same(legacy.entryAgents, []);
same(legacy.entryConditions, []);
same(learning.buildAgentLearning([legacy], { now: closedAt }).lessons, []);
same(learning.buildAgentLearning([legacy], { now: closedAt }).unattributedTrades, 1);

// Reject anything that would manufacture a fill, change the source clock, or relabel paper performance.
for (const change of [
  value => { value.cycle.fill.realizedPnl += 1; },
  value => { value.afterAccount.cash += 1; },
  value => { value.cycle.executionQuote.retrievedAt = closedAt; },
  value => { value.cycle.executionQuote.observedAt = closedAt; },
  value => { value.cycle.fill.classification = "live-broker"; },
  value => { value.cycle.executionStatus = "blocked"; },
  value => { value.cycle.executionQuote = null; },
]) {
  const changed = clone(sellInput); change(changed);
  await assert.rejects(() => harness.transaction(tx => writeCycleArtifacts(tx, scope, changed)), error => /INVALID_AGENT_TRADE|INVALID_LEARNING_CLOSE|INVALID_ACCOUNT/.test(error.code)); assertions++;
}
same(harness.rows.length - beforeExitRows, 4, "Rejected transitions cannot add artifacts");

const outcome2 = { ...clone(sellArtifacts.outcome), id: "outcome:sell-2", exitCycleId: "sell-2", closedAt: "2026-11-19T15:20:00.000Z", holdingMinutes: 20 };
const outcome3 = { ...clone(sellArtifacts.outcome), id: "outcome:sell-3", exitCycleId: "sell-3", closedAt: "2026-11-19T15:30:00.000Z", holdingMinutes: 30, exitPrice: 210 };
const round = number => Math.round(number * 1e8) / 1e8, outcome3Basis = outcome3.quantity * outcome3.entryPrice + outcome3.entryFees;
outcome3.netPnl = round(outcome3.quantity * outcome3.exitPrice - outcome3.exitFees - outcome3Basis);
outcome3.netReturnPct = round(outcome3.netPnl / outcome3Basis * 100);
const three = learning.buildAgentLearning([sellArtifacts.outcome, outcome2, outcome3], { now: "2026-11-19T16:00:00.000Z" });
same(three.closedTrades, 3); same(three.losses, 2); same(three.wins, 1);
same(three.observedWinRatePct, 33.33333333, "Observed frequency uses every included closed trade, including losses");
yes(three.lessons.every(item => item.status === "observed-pattern" && item.sampleCount === 3 && item.lossCount === 2));
same(three.sampleWindow.oldestClosedAt, closedAt);
same(three.sampleWindow.newestClosedAt, outcome3.closedAt);
const restricted = learning.buildAgentLearning([sellArtifacts.outcome, outcome2, outcome3], { now: "2026-11-19T16:00:00.000Z", limit: 2, totalRecordedTrades: 30 });
same(restricted.closedTrades, 2); same(restricted.sampleWindow.totalRecordedTrades, 30); same(restricted.sampleWindow.truncated, true);
same(learning.buildAgentLearning([sellArtifacts.outcome, sellArtifacts.outcome], { now: closedAt }).closedTrades, 1, "Duplicate identities do not increase the learning sample");
throws(() => learning.buildAgentLearning([sellArtifacts.outcome, { ...sellArtifacts.outcome, exitReason: "Conflicting explanation" }], { now: closedAt }), "CONFLICTING_AGENT_OUTCOME");
throws(() => learning.buildAgentLearning([{ ...sellArtifacts.outcome, netPnl: NaN }], { now: closedAt }), "AGENT_OUTCOME_INVALID");
same(learning.buildAgentLearning([], { now: closedAt }).observedWinRatePct, null, "An empty account has no fabricated win rate");
same(learning.buildAgentLearning([outcome3], { now: first }).closedTrades, 0);
same(learning.buildAgentLearning([outcome3], { now: "2026-11-19T16:00:00.000Z", symbol: "NVDA" }).closedTrades, 0);
const snapshot = await readAgentCollaboration(scope);
same(Object.keys(snapshot).sort(), ["board", "briefs", "learning"]);
same(snapshot.briefs.length, 2); same(snapshot.learning.closedTrades, 1);
yes(snapshot.board.some(item => item.from === "founder"));
yes(snapshot.board.some(item => item.phase === "learning"));
same(snapshot.briefs.find(item => item.side === "BUY").readAt, readAt);
same(snapshot.briefs.find(item => item.side === "SELL").readAt, null);
const noFill = { ...clone(sellInput), cycle: { ...sellCycle, fill: null } };
same(await writeCycleArtifacts(harness.db, scope, noFill), { brief: null, outcome: null });
same(harness.rows.length - beforeExitRows, 4);

for (const badScope of [{ firmId: scope.firmId }, { userId: scope.userId }, { userId: "", firmId: scope.firmId }, null]) {
  await rejected(() => readAgentBoard(badScope), "AGENT_ARTIFACT_SCOPE", "Missing scope cannot omit a Prisma privacy filter");
  await rejected(() => readAgentBriefs(badScope), "AGENT_ARTIFACT_SCOPE");
  await rejected(() => learning.readAgentLearning(badScope), "AGENT_ARTIFACT_SCOPE");
}
for (const value of [NaN, Infinity, -Infinity, "100"]) {
  await rejected(() => readAgentBoard(scope, { limit: value }), "INVALID_AGENT_LIMIT");
  await rejected(() => readAgentBriefs(scope, { limit: value }), "INVALID_AGENT_LIMIT");
  await rejected(() => learning.readAgentLearning(scope, { limit: value }), "INVALID_AGENT_LIMIT");
}
await rejected(() => learning.readAgentLearning(scope, { now: "not-a-date" }), "INVALID_LEARNING_TIME");
await rejected(() => learning.readAgentLearning(scope, { symbol: "../other" }), "INVALID_AGENT_SYMBOL");
for (const patch of [{ quantity: 0 }, { entryFees: NaN }, { exitPrice: 0 }, { netPnl: 200 }, { netReturnPct: 100 }, { holdingMinutes: 1 }, { entryAgents: [null] }, { entryAgents: [{ role: "chief" }] }, { closedAt: "invalid" }, { attribution: "verified-live" }, { exitSourceHash: "fake" }])
  throws(() => learning.buildAgentLearning([{ ...sellArtifacts.outcome, ...patch }], { now: closedAt }), "AGENT_OUTCOME_INVALID");
for (const patch of [{ totalRecordedTrades: NaN }, { totalRecordedTrades: -1 }]) throws(() => learning.buildAgentLearning([], { now: closedAt, ...patch }), "INVALID_LEARNING_COUNT");

console.log(`Agent Desk learning: ${assertions} checks passed (private durable discussion/replies, original entry attribution, atomic trade briefs and outcomes, replay/integrity/scope, empirical lessons, no future outcome leakage, and read receipts; controlled storage and paper engine only).`);
