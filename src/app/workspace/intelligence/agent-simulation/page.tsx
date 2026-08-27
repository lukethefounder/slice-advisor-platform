import type { Metadata } from "next";

import ResearchSwarmInspector from "@/components/intelligence/research-swarm-inspector";

export const metadata: Metadata = {
  title: "Research Swarm Inspector",
  description:
    "Inspect the evidence assignments, drivers, contradictions, and scores of bounded Slice research pathways.",
};

export default function ResearchSwarmPage() {
  return <ResearchSwarmInspector />;
}