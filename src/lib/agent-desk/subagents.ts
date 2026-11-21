import "server-only";
import { createHash } from "node:crypto";
import { runResearchAgent, type AgentContext } from "./agents";
import { type AgentEvidence, type AgentFinding, type AgentHelperReport, type AgentRole, type DeskOperationsSettings } from "./contracts";

export type AgentHelperTask = { id: string; parentRole: AgentRole; focus: string; evidenceIds: string[]; sourceHash: string };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const buckets: Array<{ parentRole: AgentRole; label: string; accepts: (source: AgentEvidence) => boolean }> = [
  { parentRole: "news", label: "Verify distinct media sources, dates, attribution and conflicting claims", accepts: row => /media|news|discovery/i.test(row.cohort) },
  { parentRole: "sentiment", label: "Check economic evidence, risk appetite proxies and missing measurements", accepts: row => /economy|macro|sentiment/i.test(row.cohort) },
  { parentRole: "charts", label: "Audit technical observations, price timestamps and contradictory metrics", accepts: row => /technical|chart|market/i.test(row.cohort) },
  { parentRole: "skeptic", label: "Challenge historical comparisons, sample size, costs and out-of-sample limits", accepts: row => /strategy|historical|scenario/i.test(row.cohort) },
  { parentRole: "scout", label: "Connect authorized workspace context to the current stock without inferring trading permission", accepts: () => true },
];

/** Helpers are created only for a source backlog. A source belongs to one
 * delegated chunk; multiple summaries of it never become independent votes. */
export function planAgentHelpers(evidence: AgentEvidence[], settings: DeskOperationsSettings): AgentHelperTask[] {
  if (!settings.helpersEnabled || settings.maxHelpers <= 0) return [];
  const sourceKey = (row: AgentEvidence) => {
    if (row.kind !== "public-discovery" && !/media|news/i.test(row.cohort)) return `record:${row.id}`;
    try {
      const url = new URL(row.url); if (!["http:", "https:"].includes(url.protocol)) return `record:${row.id}`;
      url.hash = ""; for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key); url.searchParams.sort();
      return `article:${url.toString()}`;
    } catch { return `record:${row.id}`; }
  };
  // Technical/economic observations retain their own identity even if their
  // provenance link is the same API documentation page. Article syndication
  // and tracking links are deduplicated by the original public URL instead.
  const distinct = [...new Map(evidence.map(row => [sourceKey(row), row])).values()];
  const assigned = new Set<string>(), queues: AgentHelperTask[][] = [];
  for (const bucket of buckets) {
    const rows = distinct.filter(row => !assigned.has(row.id) && bucket.accepts(row));
    for (const row of rows) assigned.add(row.id);
    // Small assignments stay with their specialist, avoiding unnecessary calls.
    if (rows.length <= 12) continue;
    const tasks: AgentHelperTask[] = [];
    for (let offset = 0; offset < rows.length; offset += 8) {
      const chunk = rows.slice(offset, offset + 8), sourceHash = digest(chunk);
      tasks.push({ id: `${bucket.parentRole}-${sourceHash.slice(0, 16)}`, parentRole: bucket.parentRole,
        focus: `${bucket.label}. Source group ${Math.floor(offset / 8) + 1}; inspect only these ${chunk.length} original records.`, evidenceIds: chunk.map(row => row.id), sourceHash });
    }
    queues.push(tasks);
  }
  // Round-robin across overloaded specialists rather than allocating every
  // helper to the first source-rich domain.
  const result: AgentHelperTask[] = [];
  while (queues.some(queue => queue.length) && result.length < Math.min(12, settings.maxHelpers)) {
    for (const queue of queues) {
      const task = queue.shift(); if (task) result.push(task);
      if (result.length >= Math.min(12, settings.maxHelpers)) break;
    }
  }
  return result;
}

export async function runAgentHelpers(context: AgentContext, settings: DeskOperationsSettings, input: {
  ownerId: string; signal: AbortSignal; authorize?: () => Promise<void>; publishReport?: (report: AgentFinding) => Promise<void>;
}, dependencies: { run?: typeof runResearchAgent } = {}): Promise<AgentHelperReport[]> {
  const tasks = planAgentHelpers(context.evidence, settings), results: AgentHelperReport[] = new Array(tasks.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(tasks.length, Math.max(1, Math.min(3, settings.maxConcurrentHelpers))) }, async () => {
    while (cursor < tasks.length) {
      input.signal.throwIfAborted(); await input.authorize?.();
      const index = cursor++, task = tasks[index], ids = new Set(task.evidenceIds);
      const report = await (dependencies.run ?? runResearchAgent)(task.parentRole,
        { ...context, evidence: context.evidence.filter(row => ids.has(row.id)), helpers: [], helperTask: { id: task.id, parentRole: task.parentRole, focus: task.focus } }, [],
        { ...input, round: 0, phase: "research" });
      // A helper never gains a path from a model proposal to an execution.
      if (report.action !== "hold" || report.allocationPct !== null) throw new Error("A delegated research task returned execution authority.");
      input.signal.throwIfAborted(); await input.authorize?.(); await input.publishReport?.(report);
      results[index] = { ...task, report };
    }
  }));
  return results;
}
