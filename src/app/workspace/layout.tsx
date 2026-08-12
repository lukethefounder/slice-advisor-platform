import type { ReactNode } from "react";

import { AdvisorRoutingDock } from "@/components/advisor-routing-dock";
import WorkspaceShell from "@/components/workspace/core/workspace-shell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell>
      {children}
      <AdvisorRoutingDock />
    </WorkspaceShell>
  );
}