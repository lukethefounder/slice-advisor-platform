import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import ResearchRouteBoundary from "@/components/connected-workspace/research-route-boundary";

import { AdvisorRoutingDock } from "@/components/advisor-routing-dock";
import { serverWorkspaceAccess } from "@/lib/instant-workspace/access";
import WorkspaceShell from "@/components/workspace/core/workspace-shell";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { access, session } = await serverWorkspaceAccess();
  // A cookie's presence is not an authenticated session. Check the server-side
  // account and firm before rendering any workspace route or its navigation.
  if (!access) redirect("/founder-login");
  return (
    <WorkspaceShell initialSession={session}>
      <Suspense fallback={<div role="status" className="p-8">Loading research context…</div>}>
        <ResearchRouteBoundary>{children}</ResearchRouteBoundary>
      </Suspense>
      <AdvisorRoutingDock />
    </WorkspaceShell>
  );
}
