import type { Metadata } from "next";

import HorizonModelsWorkspace from "@/components/intelligence/horizon-models-workspace";

export const metadata: Metadata = {
  title: "Horizon Models",
  description:
    "Train, evaluate, and operate independent Slice forecast models across eight time horizons.",
};

export default function HorizonModelsPage() {
  return <HorizonModelsWorkspace />;
}
