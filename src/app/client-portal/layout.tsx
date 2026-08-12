import type { ReactNode } from "react";

import { ClientPortalDocumentDock } from "@/components/client-portal-document-dock";
import { ClientPortalRoutingBridge } from "@/components/client-portal-routing-bridge";

export default function ClientPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <ClientPortalRoutingBridge />
      <ClientPortalDocumentDock />
    </>
  );
}