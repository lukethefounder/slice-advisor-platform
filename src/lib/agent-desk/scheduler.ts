import "server-only";
import { AgentDeskError } from "./contracts";
import { readDeskRecord, replaceDeskRecord, scheduledDeskScopes } from "./store";
import { requireDeskAccess, monitorDeskPosition, queueDeskCycle, recoverDeskCycleLease, checkScheduledAgentReview } from "./service";
import { scheduledBrokerScopes, runBrokerMonitoring, getBrokerView } from "@/lib/agent-broker/service";
import { queueDeskScout, recoverScoutLease } from "./scouting";
import { requestBackgroundJobCancellation } from "@/lib/background-jobs/queue";

export function paperSessionWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (key: string) => parts.find(value => value.type === key)?.value;
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  return !["Sat", "Sun"].includes(part("weekday") ?? "") && minute >= 570 && minute < 960;
}

/** Durable state and queue leases fence overlapping worker/cron invocations.
 * Monitoring never waits for the team discussion. A minute is a polling cadence,
 * not a promise of a continuous market feed or a guaranteed stop fill. */
export async function runAgentDeskSchedule(input: { limit?: number; concurrency?: number } = {}) {
  const limit = Math.max(1, Math.min(20, Math.floor(input.limit ?? 8)));
  const [paperScopes, brokerScopes] = await Promise.all([scheduledDeskScopes(limit), scheduledBrokerScopes(limit)]);
  const scopes = [...new Map([...brokerScopes, ...paperScopes].map(scope => [`${scope.userId}:${scope.firmId}`, scope])).values()].slice(0, limit);
  const results: Array<{ state: string; filled?: boolean; code?: string; jobId?: string; brokerStatus?: string; monitoringIssues?: string[] }> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(scopes.length, Math.max(1, Math.min(2, input.concurrency ?? 2))) }, async () => {
    while (cursor < scopes.length) {
      const scope = scopes[cursor++];
      try {
        await requireDeskAccess(scope);
        const [paperMonitoring, brokerMonitoring] = await Promise.allSettled([monitorDeskPosition(scope), runBrokerMonitoring(scope)]);
        // A failure in one account must not prevent protective monitoring of the
        // other. Neither failure is relabeled as a successful fill.
        const monitored = paperMonitoring.status === "fulfilled" ? paperMonitoring.value : { checked: false, filled: false };
        const monitoringIssues = [paperMonitoring.status === "rejected" ? "Local simulation monitoring was unavailable." : null, brokerMonitoring.status === "rejected" ? "Broker reconciliation was unavailable; inspect the broker connection before new entries." : null].filter((value): value is string => Boolean(value));
        let record = await recoverDeskCycleLease(scope);
        record = await recoverScoutLease(scope, record);
        if (!monitored.checked) {
          record = await replaceDeskRecord(scope, record, { ...record.state, lastCheckedAt: new Date().toISOString() });
        }
        const enabled = !record.state.controls.killSwitch;
        const due = enabled && paperSessionWindow() && record.state.controls.autonomous && !record.state.controls.paused && (!record.state.nextRunAt || Date.parse(record.state.nextRunAt) <= Date.now());
        const broker = await getBrokerView(scope);
        const brokerDue = enabled && brokerMonitoring.status === "fulfilled" && broker.connected && broker.controls.enabled && broker.controls.autonomous && !broker.controls.paused && broker.clock?.isOpen === true && Date.now() - Date.parse(broker.lastCheckedAt ?? "") <= 60_000;
        const brokerSymbol = broker.activePositionSymbol ?? record.state.settings.symbol;
        let researchJob: string | null = null;
        if (!record.state.busy) {
          // The held position gets its due review first. A candidate can be
          // researched between reviews, but it cannot fill against another stock's position.
          if (brokerDue && broker.activePositionSymbol) {
            if ((await checkScheduledAgentReview(scope, brokerSymbol)).review) researchJob = await queueDeskCycle(scope, record.state.revision, true, undefined, brokerSymbol);
          } else if (due && record.state.account.position) {
            if ((await checkScheduledAgentReview(scope)).review) researchJob = await queueDeskCycle(scope, record.state.revision, true);
          }
          else if (enabled && record.state.settings.scouting?.autoResearch && record.state.scouting.pendingResearch) {
            const pending = record.state.scouting.pendingResearch;
            researchJob = await queueDeskCycle(scope, record.state.revision, false, { scanId: pending.scanId, symbol: pending.symbol });
          } else if (brokerDue) {
            if ((await checkScheduledAgentReview(scope, brokerSymbol)).review) researchJob = await queueDeskCycle(scope, record.state.revision, true, undefined, brokerSymbol);
          } else if (due && (await checkScheduledAgentReview(scope)).review) researchJob = await queueDeskCycle(scope, record.state.revision, true);
        }
        record = await readDeskRecord(scope);
        let scoutJob: string | null = null;
        if (enabled && record.state.settings.scouting?.enabled && !record.state.scouting.busy && !record.state.scouting.pendingResearch && (!record.state.scouting.nextScanAt || Date.parse(record.state.scouting.nextScanAt) <= Date.now())) scoutJob = await queueDeskScout(scope, record.state.revision, true);
        results.push({ state: researchJob ? "queued" : scoutJob ? "scouting" : "observed", filled: monitored.filled, brokerStatus: brokerMonitoring.status === "fulfilled" ? brokerMonitoring.value.status : "unavailable", ...(monitoringIssues.length ? { monitoringIssues } : {}), ...(researchJob || scoutJob ? { jobId: researchJob ?? scoutJob! } : {}) });
      } catch (error) {
        const code = error instanceof AgentDeskError ? error.code : "DESK_CHECK_UNAVAILABLE";
        if (!["DESK_BUSY", "DESK_CONFLICT", "DESK_NOT_DUE", "DESK_REVISION_CHANGED", "SCOUT_BUSY", "SCOUT_SUPERSEDED"].includes(code)) {
          const record = await readDeskRecord(scope).catch(() => null);
          if (record && ["FOUNDER_AGENT_ACCESS_REQUIRED", "DESK_ACCESS_REQUIRED"].includes(code)) {
            await replaceDeskRecord(scope, record, { ...record.state, revision: record.state.revision + 1,
              controls: { armed: false, autonomous: false, paused: true, killSwitch: true }, busy: null, nextRunAt: null,
              settings: { ...record.state.settings, scouting: { ...record.state.settings.scouting!, enabled: false } },
              scouting: { ...record.state.scouting, busy: null, pendingResearch: null, nextScanAt: null },
              lastCheckedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastError: "Founder access is no longer active. All agent work and paper authority were revoked." }).catch(() => undefined);
            for (const jobId of [record.state.busy?.jobId, record.state.scouting.busy?.jobId]) if (jobId) await requestBackgroundJobCancellation({ ...scope, jobId }).catch(() => undefined);
          } else if (record) await replaceDeskRecord(scope, record, { ...record.state, lastCheckedAt: new Date().toISOString(),
            lastError: error instanceof AgentDeskError ? error.message : "The scheduled observation could not complete. No fill was invented.",
            nextRunAt: new Date(Date.now() + 5 * 60_000).toISOString(), updatedAt: new Date().toISOString() }).catch(() => undefined);
        }
        results.push({ state: "deferred", code });
      }
    }
  }));
  return { checkedAt: new Date().toISOString(), scanned: scopes.length, results };
}
