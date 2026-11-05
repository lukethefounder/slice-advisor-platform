import { apiJson, withApiRoute } from "@/lib/api-route";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { symbolOf } from "@/lib/strategy-lab/validation";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { readCanonical } from "@/lib/intelligence-unified/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const GET = withApiRoute({ route: "/api/intelligence/forecast", timeoutMs: 10000 }, async ({ request }) => {
  await strategyAccess(request, false);
  return apiJson({ ok: true, service: "Slice canonical forecast", generationRoute: "/api/intelligence/canonical", acceptsClientSuppliedMarketData: false });
});
export const POST = withApiRoute({ route: "/api/intelligence/forecast", timeoutMs: 25000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    const body = await readResearchJson(request), symbol = symbolOf(body.symbol);
    if (typeof body.researchRunId !== "string" || body.researchRunId.length > 100) throw new StrategyError("SERVER_RESEARCH_REQUIRED", "Generate server research first and supply its researchRunId. Browser-provided market snapshots are no longer treated as verified evidence.", 409);
    const b = await readCanonical(userId, symbol, body.researchRunId);
    if (!b) throw new StrategyError("FORECAST_NOT_PUBLISHED", "The selected research run does not have a published forecast.", 409);
    return apiJson({ ...b.forecast, canonical: { id: b.id, researchRunId: b.researchRunId, inputSha256: b.inputSha256, outputSha256: b.outputSha256 },
      persistence: { status: "stored", runId: b.forecastRunId, storedAt: b.generatedAt },
      shadowPersistence: { status: b.operations.horizonModels }, evidenceWarehouse: { status: b.operations.warehouse }, knowledgeGraph: { status: b.operations.neo4j } });
  } catch (error) { strategyFailure(error); }
});
