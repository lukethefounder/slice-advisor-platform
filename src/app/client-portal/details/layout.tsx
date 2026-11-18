import type { ReactNode } from "react";
import Link from "next/link";
import { ClientPortalDocumentDock } from "@/components/client-portal-document-dock";
import { ClientPortalRoutingBridge } from "@/components/client-portal-routing-bridge";
export default function AdvancedPortalLayout({children}:{children:ReactNode}){return <><div style={{padding:"14px 20px",background:"#0b2e25",color:"#d4f4e4",fontSize:12}}><Link href="/client-portal" style={{color:"inherit"}}>← Client overview</Link><span style={{marginLeft:20}}>Advanced tools: browser-local proposals and profile drafts are not live custody balances or confirmed orders.</span></div>{children}<ClientPortalRoutingBridge/><ClientPortalDocumentDock/></>;}
