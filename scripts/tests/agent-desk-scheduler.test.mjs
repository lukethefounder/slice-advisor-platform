import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

// Scheduling decisions use the production coordinator. Scope, quote monitoring,
// CAS state and durable queues are controlled boundaries; no provider or DB I/O.
const NOW = new Date("2026-11-20T15:00:00.000Z"), scope = { userId: "founder", firmId: "firm" };
let assertions = 0;
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const same = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW.getTime()])); } static now() { return NOW.getTime(); } }
class AgentDeskError extends Error { constructor(code, message) { super(message); this.code = code; } }
let saved, log, failAccess, monitorChange, recoverCycle, recoverScout, cancellations, brokerView, brokerScheduled, reviewDue, brokerMonitorFails;
function reset() {
  saved = { id: "state", raw: "revision0", state: { version: 1, revision: 0, settings: { symbol: "MSFT", intervalMinutes: 15, policy: { allowedSymbols: ["MSFT"] }, scouting: { enabled: true, autoResearch: true, intervalMinutes: 15, universe: [], maxCandidates: 8 } },
    controls: { autonomous: true, paused: false, armed: true, killSwitch: false }, account: { position: null, sequence: 0 }, busy: null, nextRunAt: null,
    scouting: { busy: null, pendingResearch: null, nextScanAt: null }, lastCheckedAt: null } };
  log = []; failAccess = false; monitorChange = null; recoverCycle = false; recoverScout = false; cancellations = [];
  brokerView = { connected: false, controls: { enabled: false, autonomous: false, paused: true }, activePositionSymbol: null, clock: null, lastCheckedAt: null, policy: { allowedSymbols: ["MSFT"] } }; brokerScheduled = false; reviewDue = true; brokerMonitorFails = false;
}
const read = async actor => { same(actor, scope); return structuredClone(saved); };
const dependencies = {
  "server-only": {}, "./contracts": { AgentDeskError },
  "./store": {
    scheduledDeskScopes: async limit => { yes(limit >= 1 && limit <= 20); return [scope]; },
    readDeskRecord: read,
    replaceDeskRecord: async (actor, previous, next) => { same(actor, scope); same(previous.raw, saved.raw); saved = { id: "state", raw: `${saved.raw}-next`, state: structuredClone(next) }; return structuredClone(saved); },
  },
  "./service": {
    requireDeskAccess: async actor => { same(actor, scope); log.push("access"); if (failAccess) throw new AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "Founder removed"); },
    monitorDeskPosition: async actor => { same(actor, scope); log.push("monitor"); if (monitorChange) monitorChange(); return { checked: Boolean(saved.state.account.position), filled: false }; },
    recoverDeskCycleLease: async actor => { same(actor, scope); log.push("recover-cycle"); if (recoverCycle) saved.state.busy = null; return structuredClone(saved); },
    checkScheduledAgentReview: async actor => { same(actor, scope); log.push("adaptive-check"); return { review: reviewDue, reason: reviewDue ? "Material change" : "No material change" }; },
    queueDeskCycle: async (actor, revision, scheduled, selection, brokerSymbol) => {
      same(actor, scope); same(revision, saved.state.revision); log.push({ type: "research", scheduled, selection: plain(selection), ...(brokerSymbol ? { brokerSymbol } : {}) });
      if (saved.state.busy) throw new AgentDeskError("DESK_BUSY", "A cycle is already running");
      saved.state.busy = { cycleId: "new-cycle", jobId: "research-job" };
      if (selection) { saved.state.scouting.pendingResearch = null; saved.state.scouting.lastQueuedScanId = selection.scanId; }
      return "research-job";
    },
  },
  "@/lib/agent-broker/service": {
    scheduledBrokerScopes: async () => brokerScheduled ? [scope] : [],
    runBrokerMonitoring: async actor => { same(actor, scope); log.push("broker-monitor"); if (brokerMonitorFails) throw Error("Broker offline"); return { status: "noop" }; },
    getBrokerView: async actor => { same(actor, scope); return structuredClone(brokerView); },
  },
  "./scouting": {
    recoverScoutLease: async (actor, previous) => { same(actor, scope); yes(previous, "Scout recovery receives the latest recovered record"); log.push("recover-scout"); if (recoverScout) saved.state.scouting.busy = null; return structuredClone(saved); },
    queueDeskScout: async (actor, revision, scheduled) => {
      same(actor, scope); same(revision, saved.state.revision); same(scheduled, true); log.push({ type: "scout" });
      if (saved.state.scouting.busy) throw new AgentDeskError("SCOUT_BUSY", "A scan is already running");
      saved.state.scouting.busy = { id: "new-scout", jobId: "scout-job" }; return "scout-job";
    },
  },
  "@/lib/background-jobs/queue": { requestBackgroundJobCancellation: async input => { same(input.userId, scope.userId); same(input.firmId, scope.firmId); cancellations.push(input.jobId); } },
};
const source = await readFile(new URL("../../src/lib/agent-desk/scheduler.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
same(output.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
const module = { exports: {} }, context = vm.createContext({ Date: Clock, structuredClone });
vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context)(name => {
  if (!Object.hasOwn(dependencies, name)) throw Error(`Unexpected dependency: ${name}`);
  return dependencies[name];
}, module, module.exports);
const { runAgentDeskSchedule } = module.exports;
const queued = () => log.filter(row => typeof row === "object");
const pending = () => ({ scanId: "observed-scan", symbol: "NVDA", selectedAt: NOW.toISOString() });

reset();
saved.state.controls.autonomous = false; saved.state.busy = { cycleId: "expired-cycle", jobId: "dead-cycle-job" }; saved.state.scouting.busy = { id: "expired-scout", jobId: "dead-scout-job" };
recoverCycle = recoverScout = true;
await runAgentDeskSchedule();
yes(log.indexOf("recover-cycle") > log.indexOf("monitor"), "Protective monitoring runs before recovery or discovery");
yes(log.indexOf("recover-scout") > log.indexOf("recover-cycle"));
same(queued(), [{ type: "scout" }], "Expired busy markers no longer prevent the scheduler from reaching recovery and resuming discovery");
same(saved.state.scouting.busy.jobId, "scout-job");

reset(); saved.state.busy = { cycleId: "healthy-cycle" }; saved.state.scouting.busy = { id: "healthy-scout" };
await runAgentDeskSchedule();
same(queued(), [], "Healthy independent leases are preserved");
yes(log.includes("monitor") && log.includes("recover-cycle") && log.includes("recover-scout"));

reset(); saved.state.account.position = { symbol: "MSFT" }; saved.state.scouting.pendingResearch = pending();
await runAgentDeskSchedule();
same(queued(), [{ type: "research", scheduled: true }], "A due held-position review has priority over the discovered candidate");
same(saved.state.scouting.pendingResearch.symbol, "NVDA", "Held-position review leaves the candidate outbox intact");
same(saved.state.account.position.symbol, "MSFT");

reset(); saved.state.account.position = { symbol: "MSFT" }; saved.state.nextRunAt = "2026-11-20T15:15:00.000Z"; saved.state.scouting.pendingResearch = pending(); saved.state.scouting.nextScanAt = "2026-11-20T15:15:00.000Z";
await runAgentDeskSchedule();
same(queued(), [{ type: "research", scheduled: false, selection: { scanId: "observed-scan", symbol: "NVDA" } }], "Between held-position reviews the saved candidate can be researched");
same(saved.state.account.position.symbol, "MSFT"); same(saved.state.settings.symbol, "MSFT"); same(saved.state.settings.policy.allowedSymbols, ["MSFT"], "Research handoff does not alter trading permission or the held instrument");

reset(); saved.state.scouting.pendingResearch = pending(); saved.state.scouting.nextScanAt = "2026-11-20T15:15:00.000Z";
await runAgentDeskSchedule();
same(queued(), [{ type: "research", scheduled: false, selection: { scanId: "observed-scan", symbol: "NVDA" } }], "A pending discovered candidate precedes an unheld default-symbol refresh");
same(saved.state.scouting.pendingResearch, null); same(saved.state.scouting.lastQueuedScanId, "observed-scan");
await runAgentDeskSchedule();
same(queued().filter(row => row.type === "research").length, 1, "An already consumed candidate is not queued twice while its job holds the lease");

reset(); saved.state.busy = { cycleId: "old-cycle", jobId: "cancel-cycle" }; saved.state.scouting.busy = { id: "old-scout", jobId: "cancel-scout" }; saved.state.scouting.pendingResearch = pending(); failAccess = true;
const revoked = await runAgentDeskSchedule();
same(revoked.results[0].code, "FOUNDER_AGENT_ACCESS_REQUIRED");
same(queued(), []); yes(!log.includes("monitor"), "A removed founder causes no new market observation or agent work");
same(saved.state.controls, { armed: false, autonomous: false, paused: true, killSwitch: true });
same(saved.state.busy, null); same(saved.state.scouting.busy, null); same(saved.state.scouting.pendingResearch, null); same(saved.state.settings.scouting.enabled, false);
same(cancellations.sort(), ["cancel-cycle", "cancel-scout"]);
reset(); reviewDue = false; saved.state.settings.scouting.enabled = false;
await runAgentDeskSchedule();
same(queued(), [], "Unchanged observations skip model jobs");
yes(log.includes("monitor") && log.includes("broker-monitor") && log.includes("adaptive-check"), "Both account monitors continue when model review is skipped");

function activateBroker(symbol = null) {
  brokerScheduled = true;
  brokerView = { connected: true, controls: { enabled: true, autonomous: true, paused: false }, activePositionSymbol: symbol, clock: { isOpen: true }, lastCheckedAt: NOW.toISOString(), policy: { allowedSymbols: ["MSFT", "NVDA"] } };
  saved.state.controls.autonomous = false; saved.state.controls.paused = true; saved.state.settings.scouting.enabled = false;
}
reset(); activateBroker(); await runAgentDeskSchedule();
same(queued(), [{ type: "research", scheduled: true, brokerSymbol: "MSFT" }], "Explicit broker autonomy can research while the separate local simulator is unarmed");
reset(); activateBroker("NVDA"); saved.state.scouting.pendingResearch = pending(); await runAgentDeskSchedule();
same(queued(), [{ type: "research", scheduled: true, brokerSymbol: "NVDA" }], "Actual broker-owned exposure receives review priority");
reset(); activateBroker(); reviewDue = false; await runAgentDeskSchedule(); same(queued(), []); yes(log.includes("broker-monitor"));
reset(); activateBroker(); brokerView.controls.paused = true; await runAgentDeskSchedule(); same(queued(), [], "Paused broker entries cannot schedule autonomous proposals"); yes(log.includes("broker-monitor"), "Paused accounts still reconcile existing exposure");
reset(); activateBroker(); brokerView.clock.isOpen = false; await runAgentDeskSchedule(); same(queued(), [], "A closed broker session cannot start autonomous reviews");
reset(); activateBroker(); brokerView.lastCheckedAt = "2026-11-20T14:50:00.000Z"; await runAgentDeskSchedule(); same(queued(), [], "A stale broker clock cannot start autonomous reviews");
reset(); saved.state.settings.scouting.enabled = false; brokerMonitorFails = true;
const isolated = await runAgentDeskSchedule(); same(queued(), [{ type: "research", scheduled: true }]); yes(isolated.results[0].monitoringIssues.length === 1, "Broker outage is explicit without disabling independent paper monitoring");
console.log(`Agent desk scheduler: ${assertions} assertions passed (controlled orchestration boundaries).`);
