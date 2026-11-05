import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { listScenarios, scenarioDetail, createScenario, editScenario, armScenario, archiveScenario, advanceScenario } from "@/lib/connected-research/scenario-service";
import { readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const GET = withApiRoute({ route: "/api/strategy-lab/scenarios", timeoutMs: 20000, cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
 const scope = await connectedAccess(request); const url = new URL(request.url), id = url.searchParams.get("id");
 try { return apiJson(id ? { ok: true, ...await scenarioDetail(scope, id, url.searchParams.get("audit") === "1", url.searchParams.get("after")) } : { ok: true, scenarios: await listScenarios(scope), automaticChecksEnabled: process.env.SLICE_SCENARIO_CRON_ENABLED === "true", observationFrequency: "completed-daily-sessions" }); } catch (e) { strategyFailure(e); }
});
export const POST = withApiRoute({ route: "/api/strategy-lab/scenarios", timeoutMs: 55000, cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
 const scope = await connectedAccess(request, true);
 try {
  const body = await readResearchJson(request); let id: string;
  switch (body.action) {
   case "create": id = await createScenario(scope, body); break;
   case "save": id = await editScenario(scope, body); break;
   case "launch": id = await armScenario(scope, body); break;
   case "archive": id = await archiveScenario(scope, body); break;
   case "advance": { const result = await advanceScenario(scope, body.id); return apiJson({ ok: true, ...result }); }
   default: throw new StrategyError("ACTION_REQUIRED", "Choose create, save, launch, archive, or advance.", 400);
  }
  return apiJson({ ok: true, id });
 } catch (e) { strategyFailure(e); }
});
