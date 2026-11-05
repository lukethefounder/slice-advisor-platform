import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAccessContextForUser } from "@/lib/access-control";
import { readPreferences, marketStorage } from "@/lib/market-evidence/storage";
import { loadMarketSection } from "@/lib/market-visuals/service";
import { workspaceRequests } from "@/lib/instant-workspace/compose";
import { randomUUID } from "node:crypto";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
/** Operator-scheduled cache priming. Disabled by default; never enabled by page navigation. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "", supplied = request.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(supplied);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ ok: false }, { status: 401, headers });
  if (process.env.SLICE_WORKSPACE_PRIME_ENABLED !== "true") return Response.json({ ok: false, message: "Workspace priming is disabled." }, { status: 503, headers });
  const candidates = await prisma.backendPlatformEvent.findMany({ where: { eventType: "SLICE_PULSE_PREFERENCES_V1", status: "Active", sourceId: { not: null } }, orderBy: { updatedAt: "desc" }, take: 32, select: { userId: true, sourceId: true } });
  const markers = await prisma.backendPlatformEvent.findMany({ where: { eventType: "SLICE_WORKSPACE_PRIME_V1", userId: { in: candidates.map(x => x.userId) } }, select: { userId: true, sourceId: true, updatedAt: true } });
  candidates.sort((a,b) => (markers.find(m => m.userId === a.userId && m.sourceId === a.sourceId)?.updatedAt.getTime() || 0) - (markers.find(m => m.userId === b.userId && m.sourceId === b.sourceId)?.updatedAt.getTime() || 0));
  for (const candidate of candidates) {
    const firmId = candidate.sourceId!;
    const context = await getAccessContextForUser({ userId: candidate.userId, firmId });
    if (!context?.firm || context.firm.id !== firmId) continue;
    const scope = { userId: context.user.id, firmId }, eventKey = `workspace-prime:${firmId}`;
    const marker = await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey } }, update: {}, create: { userId: scope.userId, eventKey, eventType: "SLICE_WORKSPACE_PRIME_V1", area: "Workspace", title: "Workspace cache preparation", severity: "Info", status: "Idle", sourceType: "CachePrime", sourceId: firmId, metadataJson: "{}" }, select: { id: true, metadataJson: true } });
    const token = randomUUID();
    const lock = await prisma.backendPlatformEvent.updateMany({ where: { id: marker.id, OR: [{ status: { not: "Running" } }, { updatedAt: { lt: new Date(Date.now() - 120000) } }] }, data: { status: "Running", detail: token } });
    if (!lock.count) continue;
    let completed = 0, failed = 0, cursor = 0;
    try {
      try { const p = JSON.parse(marker.metadataJson); cursor = Number.isSafeInteger(p.cursor) && p.cursor >= 0 ? p.cursor : 0; } catch { /* Start at the first source. */ }
      const { preferences: p } = await readPreferences(scope), tasks = workspaceRequests(p);
      const selected = Array.from({ length: Math.min(3,tasks.length) }, (_,i) => tasks[(cursor+i)%tasks.length]);
      for (const task of selected) {
        try { await loadMarketSection({ ...task, range: p.range, confirmOptions: false }, marketStorage(scope), AbortSignal.any([request.signal,AbortSignal.timeout(14000)])); completed++; } catch { failed++; }
      }
      cursor = (cursor + selected.length) % tasks.length;
      await prisma.backendPlatformEvent.updateMany({ where: { id: marker.id, detail: token }, data: { status: failed ? "Partial" : "Ready", detail: null, metadataJson: JSON.stringify({ cursor, completed, failed, checkedAt: new Date().toISOString() }) } });
      return Response.json({ ok: true, completed, failed, note: "One accessible account; at most three source reads. No data or identities returned." }, { headers });
    } catch {
      await prisma.backendPlatformEvent.updateMany({ where: { id: marker.id, detail: token }, data: { status: "Failed", detail: null } });
      return Response.json({ ok: false, message: "Cache preparation did not finish. Check server diagnostics." }, { status: 503, headers });
    }
  }
  return Response.json({ ok: true, completed: 0, message: "No eligible workspace was available." }, { headers });
}
