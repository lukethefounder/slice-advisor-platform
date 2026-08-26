import type { Metadata } from "next";

import EvidenceWarehouseWorkspace from "@/components/intelligence/evidence-warehouse-workspace";

export const metadata: Metadata = {
  title: "Evidence Warehouse",
  description:
    "Audit and retain immutable point-in-time evidence for Slice forecast reproducibility.",
};

export default function DataWarehousePage() {
  return <EvidenceWarehouseWorkspace />;
}