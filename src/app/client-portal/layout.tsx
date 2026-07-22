import type { ReactNode } from "react";
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
    </>
  );
}