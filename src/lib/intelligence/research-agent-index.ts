import type { ResearchAgent, ResearchCohort, ResearchKnowledgeGraph } from "./research-swarm-types";

export type ResearchAgentQuery = {
  page?: number; pageSize?: number; q?: string;
  cohort?: ResearchCohort | null;
  status?: ResearchAgent["status"] | null;
};
function string(value: unknown) { return typeof value === "string" ? value : ""; }
function list(value: unknown): string[] {
  try { const parsed: unknown = JSON.parse(string(value)); return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : []; }
  catch { return []; }
}

/** Materializes details only for the requested page, regardless of the configured workforce. */
export function pageResearchAgents(graph: ResearchKnowledgeGraph, query: ResearchAgentQuery = {}) {
  const agents = graph.nodes.filter(node => node.kind === "agent");
  const text = string(query.q).trim().toLocaleLowerCase().slice(0,200);
  const matches = agents.filter(node => (!query.cohort || node.cohort === query.cohort) && (!query.status || node.properties.status === query.status) &&
    (!text || `${node.label} ${node.properties.role} ${node.properties.pathway} ${node.properties.researchQuestion} ${node.properties.sector} ${node.properties.industry} ${node.properties.positiveDriversJson} ${node.properties.negativeDriversJson}`.toLocaleLowerCase().includes(text)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(query.pageSize || 24)));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.max(1, Math.min(pages, Math.floor(query.page || 1)));
  const selected = matches.slice((page - 1) * pageSize, page * pageSize);
  const selectedIds = new Set(selected.map(node => node.id));
  const evidenceByAgent = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "USES_EVIDENCE" || !selectedIds.has(edge.source)) continue;
    const ids = evidenceByAgent.get(edge.source) ?? [];
    ids.push(edge.target.replace(/^evidence:/,""));
    evidenceByAgent.set(edge.source, ids);
  }
  const items: ResearchAgent[] = selected.map(node => {
    const p = node.properties;
    return {
      id: node.id,
      cohort: node.cohort === "technical" || node.cohort === "economy" ? node.cohort : "media",
      ordinal: typeof p.ordinal === "number" ? p.ordinal : Number(/#(\d+)$/.exec(node.label)?.[1] ?? 0),
      role: string(p.role) || node.label, pathway: string(p.pathway),
      status: p.status === "completed" || p.status === "degraded" ? p.status : "insufficient-evidence",
      score: node.score ?? 50, confidence: node.confidence ?? 0, agreement: typeof p.agreement === "number" ? p.agreement : 0,
      evidenceIds: evidenceByAgent.get(node.id) ?? [], primaryEvidenceId: string(p.primaryEvidenceId) || null,
      positiveDrivers: list(p.positiveDriversJson), negativeDrivers: list(p.negativeDriversJson), contradictions: list(p.contradictionsJson),
      latencyMs: typeof p.latencyMs === "number" ? p.latencyMs : 0, generatedAt: string(p.generatedAt) || graph.generatedAt,
      missionKey: string(p.missionKey), sector: string(p.sector), industry: string(p.industry), researchQuestion: string(p.researchQuestion),
      evidenceFingerprint: string(p.evidenceFingerprint), evidenceReused: p.evidenceReused === true,
    };
  });
  return { items, total: matches.length, page, pageSize, pages, recordedAgentCount: agents.length };
}
