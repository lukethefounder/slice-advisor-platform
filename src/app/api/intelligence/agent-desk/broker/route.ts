import { apiJson, withApiRoute, ApiError } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { databaseFailure } from "@/lib/data-readiness/core";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { AgentDeskError } from "@/lib/agent-desk/contracts";
import { AgentBrokerError } from "@/lib/agent-broker/contracts";
import { applyBrokerCommand, getBrokerView } from "@/lib/agent-broker/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Pragma": "no-cache" };
function failure(error: unknown): never {
  const database = databaseFailure(error); if (database) throw new ApiError({ ...database, expose: true });
  if (error instanceof AgentBrokerError || error instanceof AgentDeskError || error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
  // Never forward unknown provider objects, response bodies, request headers, or submitted credentials to the API logger.
  throw new ApiError({ status: 503, code: "BROKER_OPERATION_FAILED", message: "The private broker operation could not be confirmed. Refresh and reconcile before another order.", expose: true });
}
export const GET = withApiRoute({ route: "/api/intelligence/agent-desk/broker" }, async ({ request }) => {
  const scope = await connectedAccess(request);
  try { await requireAgentDeskAccess(scope); await requireResearchStorage(["BackendPlatformEvent"]); return apiJson({ ok: true, broker: await getBrokerView(scope) }, { headers }); }
  catch (error) { failure(error); }
});
export const POST = withApiRoute({ route: "/api/intelligence/agent-desk/broker" }, async ({ request }) => {
  const scope = await connectedAccess(request, true);
  try {
    await requireAgentDeskAccess(scope); await requireResearchStorage(["BackendPlatformEvent"]);
    const body = await readResearchJson(request);
    const result = await applyBrokerCommand(scope, body);
    return apiJson({ ok: true, broker: await getBrokerView(scope), ...(result ? { result } : {}) }, { headers });
  } catch (error) { failure(error); }
});
