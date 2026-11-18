import type { Metadata } from "next";
import PortalDashboard from "@/components/portal-experience/portal-dashboard";
export const metadata:Metadata={title:"Your Client Space | Slice",robots:{index:false,follow:false}};
export default function ClientPortalPage(){return <PortalDashboard/>;}
