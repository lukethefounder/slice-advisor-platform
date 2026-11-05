import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessContextForUser } from "@/lib/access-control";
import { importHistory } from "@/lib/strategy-lab/provider";
import { advanceScenario } from "@/lib/connected-research/scenario-service";
import type { StrategySpec } from "@/lib/strategy-lab/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
 const secret = process.env.CRON_SECRET?.trim();
 const got = Buffer.from(request.headers.get("authorization") ?? "");
 const expected = Buffer.from(secret ? `Bearer ${secret}` : "");
 if (!secret || got.length !== expected.length || !timingSafeEqual(got, expected)) return json({ ok: false, error: "Unauthorized." }, 401);
 if (process.env.SLICE_SCENARIO_CRON_ENABLED !== "true") return json({ ok: true, skipped: true, reason: "Scheduled scenario imports are disabled. Manual updates remain available." });
 const now = new Date();
 const row = await prisma.sliceForwardScenario.findFirst({ where: { status: "Watching", nextCheckAt: { lte: now } }, orderBy: [{ nextCheckAt: "asc" }, { createdAt: "asc" }], select: { id: true, userId: true, firmId: true, specJson: true, nextCheckAt: true, refreshStartedAt: true } });
 if (!row) return json({ ok: true, skipped: true, reason: "No scenario is due." });
 // Atomically lease one queue item. CAS on version also protects the final result write.
 const cycleStart = row.refreshStartedAt ?? now;
 const claim = await prisma.sliceForwardScenario.updateMany({ where: { id: row.id, userId: row.userId, firmId: row.firmId, status: "Watching", nextCheckAt: row.nextCheckAt }, data: { nextCheckAt: new Date(now.getTime() + 10 * 60000), refreshStartedAt: cycleStart, lastCheckedAt: now } });
 if (claim.count !== 1) return json({ ok: true, skipped: true, reason: "Another worker claimed this scenario." });
 try {
  const access = await getAccessContextForUser({ userId: row.userId, firmId: row.firmId });
  if (!access || access.firm?.id !== row.firmId || (!access.isFounder && access.membership?.status !== "Active")) {
    await prisma.sliceForwardScenario.updateMany({ where: { id: row.id, userId: row.userId, firmId: row.firmId }, data: { nextCheckAt: new Date(Date.now() + 24 * 3600000), lastError: "Scheduled check blocked: active firm access is required." } });
    return json({ ok: false, error: "Scenario owner is not authorized for scheduled access." }, 403);
  }
  const spec = JSON.parse(row.specJson) as StrategySpec, symbols = [...new Set([...spec.symbols, spec.benchmark])];
  const manifests = await prisma.sliceResearchDataset.findMany({ where: { userId: row.userId, provider: "Alpha Vantage", symbol: { in: symbols } }, distinct: ["symbol"], orderBy: { retrievedAt: "desc" }, select: { symbol: true, retrievedAt: true } });
  const bySymbol = new Map(manifests.map(d => [d.symbol, d.retrievedAt.getTime()]));
  const missing = symbols.filter(s => (bySymbol.get(s) ?? 0) < cycleStart.getTime()).sort((a, b) => (bySymbol.get(a) ?? 0) - (bySymbol.get(b) ?? 0));
  // A stable cycle cutoff prevents long universes starving behind a moving TTL.
  // At most two instruments per invocation (up to four vendor calls). No unbounded fan-out.
  for (const symbol of missing.slice(0, 2)) await importHistory(row.userId, symbol, true);
  if (missing.length > 2) {
    await prisma.sliceForwardScenario.updateMany({ where: { id: row.id, userId: row.userId, firmId: row.firmId, status: "Watching" }, data: { nextCheckAt: new Date(Date.now() + 60000), lastError: `Import progress: ${missing.length - 2} instruments await their next scheduled batch.` } });
    return json({ ok: true, pending: true, imported: 2, remaining: missing.length - 2 });
  }
  return json({ ok: true, ...await advanceScenario({ userId: row.userId, firmId: row.firmId }, row.id) });
 } catch {
  await prisma.sliceForwardScenario.updateMany({ where: { id: row.id, userId: row.userId, firmId: row.firmId }, data: { nextCheckAt: new Date(Date.now() + 3600000), lastError: "Scheduled refresh could not complete. Inspect the scenario and provider import status; previous observations remain preserved." } }).catch(() => undefined);
  return json({ ok: false, error: "Scheduled scenario refresh failed; existing results were preserved." }, 503);
 }
}
