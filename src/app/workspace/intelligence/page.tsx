import type { Metadata } from "next";

import IntelligenceControlPlane from "@/components/intelligence/intelligence-control-plane";

export const metadata: Metadata = {
  title: "Knowledge Graph Intelligence",
  description:
    "Explore connected stock research, personal research weights, inspectable sources, and model-estimated outcomes in the Slice knowledge graph.",
};

export default function IntelligenceControlPlanePage() {
  return <IntelligenceControlPlane />;
}
