import type { Metadata } from "next";

import IntelligenceControlPlane from "@/components/intelligence/intelligence-control-plane";

export const metadata: Metadata = {
  title: "Intelligence Control Plane",
  description:
    "Evidence-aware research, knowledge graph diagnostics, and forecast pressure for the Slice advisor workspace.",
};

export default function IntelligenceControlPlanePage() {
  return <IntelligenceControlPlane />;
}
