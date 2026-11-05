import { apiJson, withApiRoute } from "@/lib/api-route";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { loadDatasets } from "@/lib/strategy-lab/provider";
import { assessReadiness } from "@/lib/strategy-lab/readiness";
import { StrategyError } from "@/lib/strategy-lab/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = withApiRoute({ route: "/api/strategy-lab/readiness", timeoutMs: 20000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    await requireResearchStorage(["SliceResearchDataset"]);
    const body = await readResearchJson(request);
    if (!Array.isArray(body.datasetIds) || body.datasetIds.some(id => typeof id !== "string" || id.length > 100)) throw new StrategyError("DATASET_IDS", "Provide the selected historical dataset IDs.");
    const datasets = body.datasetIds.length ? await loadDatasets(userId, body.datasetIds as string[]) : [];
    return apiJson({ readiness: assessReadiness(body.spec, datasets) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { strategyFailure(error); }
});
