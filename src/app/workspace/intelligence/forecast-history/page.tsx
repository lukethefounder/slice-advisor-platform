import type { Metadata } from "next";

import ModelGovernanceWorkspace from "@/components/intelligence/model-governance-workspace";

export const metadata: Metadata = {
  title: "Model Governance",
  description:
    "Validate, govern, promote, and monitor Slice forecasting models with human approval and point-in-time evidence.",
};

export default function ModelGovernancePage() {
  return <ModelGovernanceWorkspace />;
}