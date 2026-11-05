import { apiJson, withApiRoute } from "@/lib/api-route";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { symbolOf } from "@/lib/strategy-lab/validation";
import { buildResearchSwarmForUser } from "@/lib/intelligence/research-swarm-service";
import { readCanonical } from "@/lib/intelligence-unified/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const GET = withApiRoute({ route: "/api/intelligence/canonical", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false);
  try {
    const url = new URL(request.url), symbol = symbolOf(url.searchParams.get("symbol")), run = url.searchParams.get("researchRunId")?.slice(0,100);
    const bundle = await readCanonical(userId, symbol, run);
    return apiJson({ ok: true, bundle, message: bundle ? "Saved canonical forecast loaded." : "No Alpha Vantage-only forecast is published for this selection. Generate current research." });
  } catch (error) { strategyFailure(error); }
});
export const POST = withApiRoute({ route: "/api/intelligence/canonical", timeoutMs: 175000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    const body = await readResearchJson(request), symbol = symbolOf(body.symbol);
    const research = await buildResearchSwarmForUser({ userId, symbol, requestedAgents: 600, simulationPaths: 300, graphMode: "summary", detailMode: "summary", projection: "overview", persistGraph: false, forceRefresh: true });
    const bundle = await readCanonical(userId, symbol, research.runId);
    return apiJson({ ok: true, bundle });
  } catch (error) { strategyFailure(error); }
});
