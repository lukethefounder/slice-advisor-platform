import "server-only";
import { cache } from "react";
import { requireCurrentAccessContext } from "@/lib/access-control";
import type { WorkspaceSession } from "@/components/workspace/premium/session";
import { isAgentDeskFounder } from "@/lib/agent-desk/access";
/** React request memoization only. Never a global cache of another user's access. */
export const serverWorkspaceAccess = cache(async () => {
  try {
    const context = await requireCurrentAccessContext({ requireFirm: true });
    if (!context.firm) throw new Error("Active firm required");
    return { access: { userId: context.user.id, firmId: context.firm.id, context }, session: { loading: false, error: "", user: { id: context.user.id, name: context.user.name }, firm: { id: context.firm.id, name: context.firm.name }, role: context.membership?.role || "Firm access", agentDeskFounder: context.user.platformStatus === "Active" && context.firm.platformStatus === "Active" && isAgentDeskFounder(context.user.email) } satisfies WorkspaceSession };
  } catch {
    return { access: null, session: { loading: false, error: "Sign in to an active firm workspace to load private information.", user: null, firm: null, role: "", agentDeskFounder: false } satisfies WorkspaceSession };
  }
});
