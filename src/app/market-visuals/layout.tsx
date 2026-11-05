import { Suspense, type ReactNode } from "react";
import ResearchRouteBoundary from "@/components/connected-workspace/research-route-boundary";
export default function MarketVisualsLayout({ children }: { children: ReactNode }) {
 return <Suspense fallback={<div role="status" className="p-8">Loading research context…</div>}><ResearchRouteBoundary>{children}</ResearchRouteBoundary></Suspense>;
}
