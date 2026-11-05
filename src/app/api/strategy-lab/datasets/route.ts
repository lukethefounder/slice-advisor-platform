import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { importHistory } from "@/lib/strategy-lab/provider";
import { PROVIDER } from "@/lib/strategy-lab/contracts";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const GET = withApiRoute({ route: "/api/strategy-lab/datasets", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false);
  const datasets = await prisma.sliceResearchDataset.findMany({ where: { userId, provider: PROVIDER, endpoint: "TIME_SERIES_DAILY_ADJUSTED" }, orderBy: { retrievedAt: "desc" }, take: 200,
    select: { id: true, provider: true, symbol: true, currency: true, sourceSha256: true, retrievedAt: true, firstDate: true, lastDate: true, barCount: true } });
  return apiJson({ ok: true, datasets, source: PROVIDER, frequency: "daily", vintage: "vendor-current-history" });
});
export const POST = withApiRoute({ route: "/api/strategy-lab/datasets", timeoutMs: 85000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try { const body = await readResearchJson(request); const dataset = await importHistory(userId, body.symbol, body.force === true); return apiJson({ ok: true, dataset }); }
  catch (error) { strategyFailure(error); }
});
