import "server-only";
import { prisma } from "@/lib/prisma";
import { getAccessContextForUser } from "@/lib/access-control";
import { importHistory } from "@/lib/strategy-lab/provider";
import { PROVIDER, StrategyError } from "@/lib/strategy-lab/contracts";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { advanceScenario } from "./scenario-service";

const HOUR = 3_600_000;
const LEASE = 10 * 60_000;
const IMPORT_BATCH = 2;

/** A shared observation cycle lets scenarios reuse this hour's verified imports.
 * Cycle starts never move while a larger universe is still being imported. */
export function observationCycle(now: Date, previous: Date | null): Date {
  return previous ?? new Date(Math.floor(now.getTime() / HOUR) * HOUR);
}

function retryDelay(error: unknown): number {
  if (error instanceof StrategyError && error.retryAfterSeconds) return Math.max(60_000, Math.min(86_400_000, error.retryAfterSeconds * 1000));
  if (error instanceof StrategyError && [401, 403].includes(error.status)) return 24 * HOUR;
  return 15 * 60_000;
}

/** Durable daily paper observations. Quote refreshes never become historical bars. */
export async function runScenarioSchedule(input: { limit?: number; concurrency?: number } = {}) {
  const limit = Math.max(1, Math.min(12, Math.floor(input.limit ?? 4)));
  const concurrency = Math.max(1, Math.min(2, Math.floor(input.concurrency ?? 2)));
  const now = new Date();
  const rows = await prisma.sliceForwardScenario.findMany({
    where: { status: "Watching", nextCheckAt: { lte: now } },
    orderBy: [{ nextCheckAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, userId: true, firmId: true, specJson: true, nextCheckAt: true, refreshStartedAt: true, version: true },
  });
  const results: Array<{ id: string; state: string; imported?: number; remaining?: number; appendedSessions?: number; code?: string }> = [];
  let cursor = 0;
  let providerCoolingDown = false;
  async function processRow(row: typeof rows[number]) {
    const cycleStart = observationCycle(now, row.refreshStartedAt);
    const leaseUntil = new Date(Date.now() + LEASE);
    const scope = { userId: row.userId, firmId: row.firmId };
    const claimed = await prisma.sliceForwardScenario.updateMany({
      where: { id: row.id, ...scope, status: "Watching", nextCheckAt: row.nextCheckAt, version: row.version },
      data: { nextCheckAt: leaseUntil, refreshStartedAt: cycleStart, lastCheckedAt: now },
    });
    if (claimed.count !== 1) return { id: row.id, state: "already-claimed" };
    const leaseWhere = { id: row.id, ...scope, status: "Watching", nextCheckAt: leaseUntil, refreshStartedAt: cycleStart, version: row.version };
    try {
      const access = await getAccessContextForUser(scope);
      if (!access || access.firm?.id !== row.firmId || (!access.isFounder && access.membership?.status !== "Active")) {
        await prisma.sliceForwardScenario.updateMany({ where: leaseWhere, data: { nextCheckAt: new Date(Date.now() + 24 * HOUR), refreshStartedAt: null, lastError: "Scheduled tracking requires active access to this firm." } });
        return { id: row.id, state: "access-blocked" };
      }
      const spec = validateSpec(JSON.parse(row.specJson));
      const symbols = [...new Set([...spec.symbols, spec.benchmark])];
      const manifests = await prisma.sliceResearchDataset.findMany({
        where: { userId: row.userId, provider: PROVIDER, endpoint: "TIME_SERIES_DAILY_ADJUSTED", symbol: { in: symbols } },
        distinct: ["symbol"], orderBy: { retrievedAt: "desc" }, select: { symbol: true, retrievedAt: true },
      });
      const retrieved = new Map(manifests.map(item => [item.symbol, item.retrievedAt.getTime()]));
      const missing = symbols.filter(symbol => (retrieved.get(symbol) ?? 0) < cycleStart.getTime())
        .sort((a, b) => (retrieved.get(a) ?? 0) - (retrieved.get(b) ?? 0) || a.localeCompare(b));
      let imported = 0;
      for (const symbol of missing.slice(0, IMPORT_BATCH)) {
        // Each successful import is already stored. Interrupted cycles resume
        // from its manifest, without downloading completed instruments again.
        await importHistory(row.userId, symbol, true);
        imported++;
      }
      if (missing.length > imported) {
        const progress = await prisma.sliceForwardScenario.updateMany({ where: leaseWhere, data: {
          nextCheckAt: new Date(Date.now() + 60_000),
          lastError: `History preparation: ${missing.length - imported} instruments remain. Completed imports are saved.`,
        } });
        return { id: row.id, state: progress.count === 1 ? "importing" : "superseded", imported, remaining: missing.length - imported };
      }
      const result = await advanceScenario(scope, row.id, { expiresAt: leaseUntil, cycleStart });
      return { id: row.id, state: "tracked", imported, appendedSessions: result.appendedSessions };
    } catch (error) {
      if (error instanceof StrategyError && ["UPDATE_CONFLICT", "SCENARIO_LEASE_LOST", "NOT_WATCHING"].includes(error.code)) return { id: row.id, state: "superseded" };
      if (error instanceof StrategyError && error.status === 429) providerCoolingDown = true;
      const code = error instanceof StrategyError ? error.code : "TRACKING_UNAVAILABLE";
      const detail = error instanceof StrategyError ? `${error.code}: ${error.message}` : "Scheduled tracking could not complete. Previously saved observations remain available.";
      await prisma.sliceForwardScenario.updateMany({ where: leaseWhere, data: {
        nextCheckAt: new Date(Date.now() + retryDelay(error)), lastError: detail.slice(0, 1000),
      } }).catch(() => undefined);
      return { id: row.id, state: "retry-scheduled", code };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (cursor < rows.length && !providerCoolingDown) {
      const row = rows[cursor++];
      results.push(await processRow(row));
    }
  }));
  return { checkedAt: now.toISOString(), scanned: rows.length, processed: results.length, deferred: rows.length - results.length,
    tracked: results.filter(item => item.state === "tracked").length,
    pending: results.filter(item => item.state === "importing").length,
    retrying: results.filter(item => item.state === "retry-scheduled").length,
    providerCoolingDown, results };
}
