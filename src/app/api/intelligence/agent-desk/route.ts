import { after } from "next/server";
import { apiJson, withApiRoute, ApiError } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { databaseFailure } from "@/lib/data-readiness/core";
import { processBackgroundJobIds } from "@/lib/background-jobs/worker";
import { AgentDeskError } from "@/lib/agent-desk/contracts";
import { DeskGuardrailError } from "@/lib/agent-desk/guardrails";
import { readAgentDesk, queueDeskCycle, updateDeskControls, approveDeskCycle } from "@/lib/agent-desk/service";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { queueDeskScout } from "@/lib/agent-desk/scouting";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown): never {
  const database = databaseFailure(error);
  if (database) throw new ApiError({ ...database, expose: true });
  if (error instanceof AgentDeskError || error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
  if (error instanceof DeskGuardrailError) throw new ApiError({ status: 400, code: error.code, message: error.message, expose: true });
  throw error;
}
export const GET = withApiRoute({ route: "/api/intelligence/agent-desk" }, async ({ request }) => {
  const scope = await connectedAccess(request);
  try { await requireAgentDeskAccess(scope); await requireResearchStorage(["BackendPlatformEvent"]); return apiJson({ ok: true, desk: await readAgentDesk(scope) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { failure(error); }
});
export const POST = withApiRoute({ route: "/api/intelligence/agent-desk" }, async ({ request }) => {
  const scope = await connectedAccess(request, true);
  try {
    await requireAgentDeskAccess(scope);
    await requireResearchStorage(["BackendPlatformEvent"]);
    const body = await readResearchJson(request);
    const allowed = body.action === "settings" ? ["action", "revision", "settings"] : body.action === "approve" ? ["action", "revision", "cycleId", "paperOnly"] : ["arm", "enable"].includes(String(body.action)) ? ["action", "revision", "paperOnly"] : ["action", "revision"];
    if (Object.keys(body).some(key => !allowed.includes(key)) || !Number.isSafeInteger(body.revision)) throw new AgentDeskError("INVALID_DESK_COMMAND", "Supply an action and the current desk revision without execution overrides.", 400);
    let jobId: string | null = null;
    if (body.action === "cycle") jobId = await queueDeskCycle(scope, body.revision as number);
    else if (body.action === "scout") jobId = await queueDeskScout(scope, body.revision as number);
    else if (body.action === "approve") await approveDeskCycle(scope, body.revision as number, String(body.cycleId ?? ""), body.paperOnly);
    else {
      await updateDeskControls(scope, body);
      if (body.action === "enable") {
        const updated = await readAgentDesk(scope);
        jobId = await queueDeskCycle(scope, updated.revision, true);
      }
    }
    if (jobId) { const queuedId = jobId; after(async () => { await processBackgroundJobIds({ jobIds: [queuedId], concurrency: 1, workerPrefix: "agent-desk" }); }); }
    return apiJson({ ok: true, desk: await readAgentDesk(scope) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { failure(error); }
});
