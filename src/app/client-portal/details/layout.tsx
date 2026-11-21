import portalTheme from "@/components/portal-experience/portal-tools.module.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { ClientPortalDocumentDock } from "@/components/client-portal-document-dock";
import { ClientPortalRoutingBridge } from "@/components/client-portal-routing-bridge";
export default function AdvancedPortalLayout({children}:{children:ReactNode}){return <><div className={portalTheme.banner}><Link href="/client-portal" style={{color:"inherit"}}>← Client overview</Link><span>Advanced tools: browser-local proposals and profile drafts are not live custody balances or confirmed orders.</span></div>{children}<ClientPortalRoutingBridge/><ClientPortalDocumentDock/></>;}
