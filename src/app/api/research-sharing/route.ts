import { apiJson, withApiRoute, ApiError } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { databaseFailure } from "@/lib/data-readiness/core";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { AgentDeskError } from "@/lib/agent-desk/contracts";
import { getResearchSharingPreference, setResearchSharingPreference } from "@/lib/agent-desk/research-access-sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const route = "/api/research-sharing", headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown): never {
  const database = databaseFailure(error);
  if (database) throw new ApiError({ ...database, expose: true });
  if (error instanceof AgentDeskError || error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
  throw error;
}
/** Every account controls its own consent; this does not grant access to agents. */
export const GET = withApiRoute({ route }, async ({ request }) => {
  const scope = await connectedAccess(request);
  try { await requireResearchStorage(["BackendPlatformEvent"]); return apiJson({ ok: true, preference: await getResearchSharingPreference(scope) }, { headers }); }
  catch (error) { failure(error); }
});
export const POST = withApiRoute({ route }, async ({ request }) => {
  const scope = await connectedAccess(request, true);
  try {
    await requireResearchStorage(["BackendPlatformEvent"]);
    const body = await readResearchJson(request);
    if (Object.keys(body).length !== 1 || typeof body.enabled !== "boolean") throw new AgentDeskError("RESEARCH_SHARING_INPUT", "Send only the enabled sharing preference. Account and workspace identities are server-bound.", 400);
    return apiJson({ ok: true, preference: await setResearchSharingPreference(scope, body.enabled) }, { headers });
  } catch (error) { failure(error); }
});
