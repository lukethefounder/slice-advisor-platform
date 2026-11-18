import type { ResearchCohort, ResearchEvidence, ResearchKnowledgeGraph } from "./research-swarm-types";
import { researchSourceIdentity, safeResearchSourceUrl } from "./research-evidence";

export type ResearchSourceQuery = { page?: number; pageSize?: number; q?: string; cohort?: ResearchCohort | null };

/** Pagination operates on the complete run archive, never on a visual graph projection. */
export function pageResearchSources(evidence: ResearchEvidence[], query: ResearchSourceQuery = {}) {
  const text = (query.q ?? "").trim().toLocaleLowerCase().slice(0, 200);
  const matches = evidence.filter(item => (!query.cohort || item.cohort === query.cohort) &&
    (!text || `${item.title} ${item.summary} ${item.source} ${item.sourceUrl} ${item.topics.join(" ")} ${(item.relatedSources ?? []).map(source => `${source.source} ${safeResearchSourceUrl(source.url)}`).join(" ")}`.toLocaleLowerCase().includes(text)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(query.pageSize || 30)));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.floor(query.page || 1)));
  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize).map(item => ({
      ...item,
      sourceUrl: safeResearchSourceUrl(item.sourceUrl),
      canonicalUrl: safeResearchSourceUrl(item.canonicalUrl) || null,
      relatedSources: item.relatedSources?.map(source => ({ ...source, url: safeResearchSourceUrl(source.url) })),
    })),
    total: matches.length,
    totalEvidence: evidence.length,
    sourceCount: new Set(evidence.map(researchSourceIdentity).filter(Boolean)).size,
    page, pageSize, pages,
  };
}

/** Older immutable runs retained source nodes, but did not store full evidence records. */
export function legacyGraphEvidence(graph: ResearchKnowledgeGraph, symbol: string): ResearchEvidence[] {
  return graph.nodes.filter(node => node.kind === "evidence" || node.kind === "economic-series").map(node => {
    const p = node.properties;
    const cohort: ResearchCohort = node.cohort === "shared" ? "media" : node.cohort;
    const validKinds = ["news", "social-narrative", "filing", "quote", "intraday", "technical", "fundamental", "economic-series", "industry-context"];
    return {
      id: node.id, cohort, kind: validKinds.includes(String(p.kind)) ? p.kind as ResearchEvidence["kind"] : "industry-context",
      title: node.label, summary: typeof p.summary === "string" ? p.summary : "Evidence retained in an earlier graph run.",
      source: typeof p.source === "string" ? p.source : "Source not recorded",
      sourceUrl: safeResearchSourceUrl(p.sourceUrl),
      asOf: typeof p.asOf === "string" ? p.asOf : null,
      retrievedAt: typeof p.retrievedAt === "string" ? p.retrievedAt : graph.generatedAt,
      score: node.score ?? 50, confidence: node.confidence ?? 0,
      freshnessScore: typeof p.freshnessScore === "number" ? p.freshnessScore : 0,
      relevanceScore: typeof p.relevanceScore === "number" ? p.relevanceScore : 0,
      polarity: "mixed", symbol, sector: "", industry: "", topics: [], metrics: {},
      warnings: ["Legacy graph record: missing evidence fields are unavailable. Its saved forecast has not been recalculated."],
    };
  });
}
