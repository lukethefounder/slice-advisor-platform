import "server-only";
import { getAccessContextForUser, requireCurrentAccessContext, type AccessContext } from "@/lib/access-control";
import { isFounderEmail } from "@/lib/founder-access";
import { ApiError } from "@/lib/api-route";
import { AgentDeskError, type DeskScope } from "./contracts";

/** The sole allowlist is SLICE_FOUNDER_EMAILS. No role, client flag, test login,
 * platform permission, or default address can grant this capability. */
export function isAgentDeskFounder(email: unknown): boolean {
  return typeof email === "string" && Boolean(email.trim()) && isFounderEmail(email);
}
function permitted(access: AccessContext | null, scope?: DeskScope) {
  return Boolean(access && isAgentDeskFounder(access.user.email) && access.user.platformStatus === "Active" && access.firm?.platformStatus === "Active" && (!scope || access.user.id === scope.userId && access.firm.id === scope.firmId));
}
export async function requireAgentDeskAccess(scope: DeskScope): Promise<AccessContext> {
  const access = await getAccessContextForUser(scope);
  if (!permitted(access, scope)) throw new AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "The agent network is available only to active accounts listed in SLICE_FOUNDER_EMAILS.", 403);
  return access!;
}
export async function requireCurrentAgentDeskAccess(): Promise<DeskScope> {
  const access = await requireCurrentAccessContext({ requireFirm: true });
  if (!permitted(access)) throw new AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "The agent network is available only to configured founder accounts.", 403);
  return { userId: access.user.id, firmId: access.firm!.id };
}
export function isAgentDeskJob(key: string) { return key === "agent_desk_cycle" || key === "agent_desk_scout"; }
export function assertAgentJobViewer(access: AccessContext, job: { jobKey: string; userId: string; firmId: string | null }) {
  if (isAgentDeskJob(job.jobKey) && (!permitted(access) || job.userId !== access.user.id || job.firmId !== access.firm?.id))
    throw new ApiError({ status: 403, code: "FOUNDER_AGENT_ACCESS_REQUIRED", message: "This private agent job belongs to its configured founder and workspace.", expose: true });
}
