import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { getResearchNetwork, relateResearch } from "@/lib/connected-research/network-service";
import { readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/connected-research", timeoutMs: 20000, cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
 const scope = await connectedAccess(request);
 try { const value = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() || null;
  if (value && !/^[A-Z][A-Z0-9.-]{0,14}$/.test(value)) throw new StrategyError("INVALID_SYMBOL", "Use an uppercase US symbol.", 400);
  return apiJson({ ok: true, network: await getResearchNetwork(scope, value) });
 } catch (e) { strategyFailure(e); }
});
export const POST = withApiRoute({ route: "/api/connected-research", timeoutMs: 15000, cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
 const scope = await connectedAccess(request, true);
 try { await relateResearch(scope, await readResearchJson(request)); return apiJson({ ok: true }); } catch (e) { strategyFailure(e); }
});
