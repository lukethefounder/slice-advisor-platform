import type { Metadata } from "next";
import { Suspense } from "react";
import UnifiedStudio from "@/components/unified-studio/unified-studio";
export const metadata:Metadata={title:"Strategy Studio | Slice",description:"Build, backtest, inspect and monitor strategies in one evidence-linked workspace."};
export default function Page(){return <Suspense fallback={<div role="status" style={{padding:24}}>Opening Strategy Studio…</div>}><UnifiedStudio/></Suspense>;}
