import type { ResearchGraphNode, ResearchKnowledgeGraph } from "@/lib/intelligence/research-swarm-types";

export type NeuralPoint = { x: number; y: number; z: number };
export type NeuralVertex = NeuralPoint & { id: string; phase: number; color: string; radius: number; node?: ResearchGraphNode };
export type NeuralLink = { source: number; target: number; phase: number; strength: number; contradiction: boolean };
export const NEURAL_COLORS = { media: "#73c6ff", technical: "#48f0cc", economy: "#b095ff", shared: "#b9fff0" };

export function neuralHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** Twin cortical surfaces with a central fissure; deterministic across server/client. */
export function cortexPoint(side: number, vertical: number, angle: number, depth = 1): NeuralPoint {
  const v = Math.max(-0.99, Math.min(0.99, vertical));
  const latitude = Math.sqrt(Math.max(0, 1 - v * v));
  const fold = 1 + Math.sin(angle * 7 + v * 9) * 0.035 + Math.cos(angle * 11 - v * 5) * 0.018;
  return {
    x: side * (0.024 + (0.29 + Math.cos(angle) * 0.285 * depth) * latitude * fold),
    y: v * 0.56 - 0.095 + Math.sin(angle * 5 + v * 8) * 0.014 * latitude,
    z: Math.sin(angle) * latitude * 0.24 * depth + Math.cos(v * Math.PI) * 0.015,
  };
}

export function researchBrainPosition(node: ResearchGraphNode, index: number, count: number): NeuralPoint {
  if (node.kind === "asset") return { x: 0, y: -0.105, z: 0.38 };
  if (node.kind === "score") return { x: 0, y: 0.15, z: 0.32 };
  if (node.kind === "run") return { x: 0, y: 0.47, z: 0.04 };
  if (node.kind === "cohort") {
    return node.cohort === "media" ? { x: -0.34, y: -0.08, z: 0.26 }
      : node.cohort === "technical" ? { x: 0.34, y: -0.08, z: 0.26 }
      : { x: 0, y: 0.39, z: 0.22 };
  }
  if (node.kind === "sector") return { x: -0.19, y: 0.46, z: 0.15 };
  if (node.kind === "industry") return { x: 0.19, y: 0.46, z: 0.15 };
  const hash = neuralHash(node.id);
  const side = node.cohort === "media" ? -1 : node.cohort === "technical" ? 1 : hash % 2 ? 1 : -1;
  const ordinal = (index + 0.5) / Math.max(1, count);
  const vertical = node.cohort === "economy" ? 0.28 + ordinal * 0.64 : ordinal * 1.86 - 0.93;
  const angle = index * 2.3999632297 + (hash % 1000) / 1000;
  const depth = node.kind === "agent" ? 0.48 + (hash % 48) / 100 : 0.84 + (hash % 16) / 100;
  return cortexPoint(side, vertical, angle, depth);
}

export function neuralDrift(point: NeuralPoint, phase: number, seconds: number, enabled = true): NeuralPoint {
  if (!enabled) return point;
  return {
    x: point.x + Math.sin(seconds * 0.46 + phase) * 0.0045,
    y: point.y + Math.cos(seconds * 0.38 + phase * 1.3) * 0.0035,
    z: point.z + Math.sin(seconds * 0.3 + phase * 0.8) * 0.005,
  };
}

/** Perspective projection is shared by drawing and hit testing. */
export function projectNeuralPoint(point: NeuralPoint, yaw: number, pitch: number) {
  const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const z = point.z * Math.cos(yaw) - point.x * Math.sin(yaw);
  const y = point.y * Math.cos(pitch) - z * Math.sin(pitch);
  const depth = z * Math.cos(pitch) + point.y * Math.sin(pitch);
  const perspective = 1 / (1.7 - depth * 0.33);
  return { x: x * perspective * 1.7, y: y * perspective * 1.7, z: depth };
}

export function buildNeuralGeometry(graph: ResearchKnowledgeGraph | null, limit = 680) {
  if (graph) {
    const priorities: Record<string, number> = { asset: 20, score: 19, cohort: 18, forecast: 17, evidence: 15, "economic-series": 15, source: 14, sector: 13, industry: 13, agent: 4 };
    const nodes = [...graph.nodes].sort((a, b) => (priorities[b.kind] ?? 8) - (priorities[a.kind] ?? 8) || a.id.localeCompare(b.id)).slice(0, limit);
    const counts = new Map<string, number>(), indexes = new Map<string, number>();
    for (const node of nodes) { const key = `${node.cohort}:${node.kind}`; counts.set(key, (counts.get(key) ?? 0) + 1); }
    const vertices: NeuralVertex[] = nodes.map(node => {
      const key = `${node.cohort}:${node.kind}`, index = indexes.get(key) ?? 0;
      indexes.set(key, index + 1);
      return { ...researchBrainPosition(node, index, counts.get(key) ?? 1), id: node.id, node, phase: (neuralHash(node.id) % 1000) / 159,
        color: NEURAL_COLORS[node.cohort], radius: node.kind === "asset" ? 15 : node.kind === "score" ? 9 : node.kind === "cohort" ? 6 : node.kind === "forecast" ? 3.5 : node.kind === "agent" ? 1.15 : 2.2 };
    });
    const mapping = new Map(vertices.map((node, index) => [node.id, index]));
    const links: NeuralLink[] = [];
    for (const edge of graph.edges) {
      const source = mapping.get(edge.source), target = mapping.get(edge.target);
      if (source === undefined || target === undefined) continue;
      links.push({ source, target, phase: (neuralHash(edge.id) % 1000) / 1000, strength: edge.weight, contradiction: edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES" });
      if (links.length >= 2000) break;
    }
    return { vertices, links, illustrative: false };
  }
  const vertices: NeuralVertex[] = Array.from({ length: Math.min(limit, 680) }, (_, index) => {
    const side = index % 2 ? 1 : -1, ordinal = Math.floor(index / 2), count = Math.ceil(Math.min(limit, 680) / 2);
    const point = cortexPoint(side, ((ordinal + 0.5) / count) * 1.94 - 0.97, ordinal * 2.3999632297, 0.74 + (neuralHash(String(index)) % 26) / 100);
    return { ...point, id: `illustration:${index}`, phase: (neuralHash(`phase:${index}`) % 1000) / 159, color: index % 7 === 0 ? NEURAL_COLORS.economy : side < 0 ? NEURAL_COLORS.media : NEURAL_COLORS.technical, radius: index % 31 === 0 ? 2.8 : index % 11 === 0 ? 1.8 : 0.95 };
  });
  // Local axons plus sparse cross-hemisphere fibres. Geometry is decorative only.
  const links: NeuralLink[] = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const point = vertices[index];
    const neighbors: Array<{ index: number; distance: number }> = [];
    for (let candidate = Math.max(0, index - 105); candidate < index; candidate += 1) {
      const other = vertices[candidate];
      const distance = Math.hypot(point.x - other.x, point.y - other.y, (point.z - other.z) * 0.65);
      if (distance < 0.23) neighbors.push({ index: candidate, distance });
    }
    neighbors.sort((a, b) => a.distance - b.distance);
    for (const other of neighbors.slice(0, 3)) links.push({ source: index, target: other.index, phase: (neuralHash(`${index}:${other.index}`) % 1000) / 1000, strength: 0.55, contradiction: false });
    if (index % 18 === 0 && index + 1 < vertices.length) links.push({ source: index, target: index + 1, phase: (index % 91) / 91, strength: 0.75, contradiction: false });
  }
  return { vertices, links, illustrative: true };
}
