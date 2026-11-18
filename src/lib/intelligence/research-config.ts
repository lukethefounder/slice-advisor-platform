import type { ResearchCohort, ResearchWeights } from "./research-swarm-types";

export const MAX_RESEARCH_AGENTS = 10_000;
export const MIN_RESEARCH_AGENTS = 30;
export const DEFAULT_RESEARCH_AGENTS = 600;
export const DEFAULT_RESEARCH_WEIGHTS: Readonly<ResearchWeights> = Object.freeze({
  media: 1 / 3,
  technical: 1 / 3,
  economy: 1 / 3,
});
export const RESEARCH_WEIGHT_KEYS = ["media", "technical", "economy"] as const;

/** Accept percentages or ratios; the returned values always sum to one. */
export function normalizeResearchWeights(value: unknown): ResearchWeights {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_RESEARCH_WEIGHTS };
  }
  const record = value as Record<string, unknown>;
  const values = RESEARCH_WEIGHT_KEYS.map((key) => {
    const raw = record[key];
    const parsed = typeof raw === "number" || typeof raw === "string" ? Number(raw) : 0;
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1_000_000, parsed)) : 0;
  });
  const total = values.reduce((sum, item) => sum + item, 0);
  if (!total) return { ...DEFAULT_RESEARCH_WEIGHTS };
  return { media: values[0] / total, technical: values[1] / total, economy: values[2] / total };
}

/** Largest-remainder apportionment preserves the exact requested total. */
export function allocateResearchAgents(totalInput: unknown, weightsInput?: unknown) {
  const parsed = typeof totalInput === "number" || typeof totalInput === "string" ? Number(totalInput) : NaN;
  const total = Number.isFinite(parsed)
    ? Math.max(MIN_RESEARCH_AGENTS, Math.min(MAX_RESEARCH_AGENTS, Math.round(parsed)))
    : DEFAULT_RESEARCH_AGENTS;
  const weights = normalizeResearchWeights(weightsInput);
  const allocation: Record<ResearchCohort, number> = { media: 0, technical: 0, economy: 0 };
  const portions = RESEARCH_WEIGHT_KEYS.map((key, index) => {
    const exact = weights[key] * total;
    allocation[key] = Math.floor(exact);
    return { key, index, remainder: exact - allocation[key] };
  }).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const missing = total - RESEARCH_WEIGHT_KEYS.reduce((sum, key) => sum + allocation[key], 0);
  for (let index = 0; index < missing; index += 1) allocation[portions[index % portions.length].key] += 1;
  return { total, allocation, weights };
}

export function hasEqualResearchWeights(weights: ResearchWeights) {
  return RESEARCH_WEIGHT_KEYS.every((key) => Math.abs(weights[key] - 1 / 3) < 1e-8);
}
