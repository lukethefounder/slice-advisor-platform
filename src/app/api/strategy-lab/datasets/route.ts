import { requireResearchStorage } from "@/lib/data-readiness/server";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { importHistory } from "@/lib/strategy-lab/provider";
import { PROVIDER, StrategyError } from "@/lib/strategy-lab/contracts";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { requiredWarmup } from "@/lib/strategy-lab/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRoute({ route: "/api/strategy-lab/datasets", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false);
  const datasets = await prisma.sliceResearchDataset.findMany({ where: { userId, provider: PROVIDER, endpoint: "TIME_SERIES_DAILY_ADJUSTED" }, orderBy: { retrievedAt: "desc" }, take: 200,
    select: { id: true, provider: true, symbol: true, currency: true, sourceSha256: true, retrievedAt: true, firstDate: true, lastDate: true, barCount: true } });
  return apiJson({ ok: true, datasets, source: PROVIDER, frequency: "daily", vintage: "vendor-current-history" });
});
export const POST = withApiRoute({ route: "/api/strategy-lab/datasets", timeoutMs: 85000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    const body = await readResearchJson(request);
    const spec = body.spec == null ? null : validateSpec(body.spec);
    if (spec && ![...spec.symbols, spec.benchmark].includes(String(body.symbol).toUpperCase()))
      throw new StrategyError("SYMBOL_MISMATCH", "The requested history must belong to the selected test.");
    const coverage = spec ? { startDate: spec.startDate, endDate: spec.endDate, warmupSessions: requiredWarmup(spec) } : undefined;
    // Existing immutable history is reused before any provider request is needed.
    await requireResearchStorage(["BackendPlatformEvent"]);
    const dataset = await importHistory(userId, body.symbol, body.force === true, coverage);
    return apiJson({ ok: true, dataset });
  }
  catch (error) {
    if (error instanceof StrategyError) return apiJson({ ok: false, code: error.code, error: error.message,
      retryAfterSeconds: error.retryAfterSeconds ?? null }, { status: error.status,
      headers: { "Cache-Control": "private, no-store", ...(error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {}) } });
    strategyFailure(error);
  }
});
