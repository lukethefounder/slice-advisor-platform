import { Suspense, type ReactNode } from "react";
import ResearchRouteBoundary from "@/components/connected-workspace/research-route-boundary";

import { AdvisorRoutingDock } from "@/components/advisor-routing-dock";
import { serverWorkspaceAccess } from "@/lib/instant-workspace/access";
import WorkspaceShell from "@/components/workspace/core/workspace-shell";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { session } = await serverWorkspaceAccess();
  return (
    <WorkspaceShell initialSession={session}>
      <Suspense fallback={<div role="status" className="p-8">Loading research context…</div>}>
        <ResearchRouteBoundary>{children}</ResearchRouteBoundary>
      </Suspense>
      <AdvisorRoutingDock />
    </WorkspaceShell>
  );
}
