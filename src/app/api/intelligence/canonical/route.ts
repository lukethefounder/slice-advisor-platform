import { apiJson, withApiRoute } from "@/lib/api-route";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { normalizeResearchSymbol } from "@/lib/intelligence/research-instrument";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { buildResearchSwarmForUser } from "@/lib/intelligence/research-swarm-service";
import { readCanonical, readResearchOnly } from "@/lib/intelligence-unified/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function symbolOf(value: unknown) {
  try { return normalizeResearchSymbol(String(value ?? "")); }
  catch { throw new StrategyError("INVALID_SYMBOL", "Use a valid stock symbol or explicit index such as INDEX:SPX.", 400); }
}

export const GET = withApiRoute({ route: "/api/intelligence/canonical", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false);
  try {
    const url = new URL(request.url), symbol = symbolOf(url.searchParams.get("symbol")), run = url.searchParams.get("researchRunId")?.slice(0,100);
    const researchOnly = await readResearchOnly(userId, symbol, run);
    const bundle = researchOnly ? null : await readCanonical(userId, symbol, run);
    return apiJson({ ok: true, bundle, researchOnly, message: bundle ? "Saved forecast loaded." : researchOnly ? "Research is saved; a forecast is withheld until the missing scored evidence is available." : "No research is saved for this selection. Generate current research." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { strategyFailure(error); }
});
export const POST = withApiRoute({ route: "/api/intelligence/canonical", timeoutMs: 175000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    const body = await readResearchJson(request), symbol = symbolOf(body.symbol);
    const research = await buildResearchSwarmForUser({ userId, symbol, simulationPaths: 300, graphMode: "summary", detailMode: "summary", projection: "overview", persistGraph: false, forceRefresh: true });
    const bundle = await readCanonical(userId, symbol, research.runId);
    const researchOnly = bundle ? null : await readResearchOnly(userId, symbol, research.runId);
    return apiJson({ ok: true, bundle, researchOnly }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { strategyFailure(error); }
});
