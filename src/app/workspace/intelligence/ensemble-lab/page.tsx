import type { Metadata } from "next";

import EnsembleLabWorkspace from "@/components/intelligence/ensemble-lab-workspace";

export const metadata: Metadata = {
  title: "Ensemble Lab",
  description:
    "Train, evaluate, and operate calibrated Slice forecast ensembles with retained component evidence.",
};

export default function EnsembleLabPage() {
  return <EnsembleLabWorkspace />;
}