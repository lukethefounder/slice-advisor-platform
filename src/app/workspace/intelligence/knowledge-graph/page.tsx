import type { Metadata } from "next";

import KnowledgeGraphWorkspace from "@/components/intelligence/knowledge-graph-workspace";

export const metadata: Metadata = {
  title: "Research Knowledge Graph",
  description:
    "Build, persist, project, search, and inspect the Slice intelligence knowledge graph.",
};

export default function IntelligenceKnowledgeGraphPage() {
  return <KnowledgeGraphWorkspace />;
}