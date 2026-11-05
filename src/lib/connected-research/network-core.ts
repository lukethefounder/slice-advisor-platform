import { researchHref, type ResearchContext, type ResearchNetwork, type NetworkNode, type NetworkEdge } from "./contracts";
export type NetworkRows = {
 forecasts: Array<{ id: string; symbol: string; researchRunId: string; asOfAt: string; status: string }>;
 datasets: Array<{ id: string; symbol: string; lastDate: string; retrievedAt: string }>;
 backtests: Array<{ id: string; name: string; createdAt: string; symbols: string[]; datasetIds: string[] }>;
 scenarios: Array<{ id: string; name: string; sourceRunId: string; status: string; lastSession: string | null; createdAt: string; symbols: string[] }>;
 relationships: Array<{ sourceKind: string; sourceId: string; targetKind: string; targetId: string }>;
};
export function buildNetwork(rows: NetworkRows, filter: string | null, generatedAt: string): ResearchNetwork {
 const nodes: NetworkNode[] = [], edges: NetworkEdge[] = []; const seen = new Set<string>();
 const add = (n: NetworkNode) => { if (!seen.has(n.id)) { nodes.push(n); seen.add(n.id); } };
 const symbol = (s: string) => { if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(s)) return null; const c: ResearchContext = { symbol: s, researchRunId: null, horizon: "2-5d" }; const id = `symbol:${s}`; add({ id, kind: "symbol", label: s, subtitle: "Shared instrument identity", href: researchHref("/workspace/intelligence", c), asOf: null, state: "Identity", classification: "identity" }); return id; };
 const uses = (id: string, symbols: string[]) => { for (const s of symbols) { const target = symbol(s); if (target) edges.push({ source: id, target, relation: "uses-symbol" }); } };
 for (const r of rows.forecasts) { if (filter && r.symbol !== filter) continue; const id = `forecast:${r.id}`; add({ id, kind: "forecast", label: `${r.symbol} research`, subtitle: r.researchRunId, href: researchHref("/workspace/intelligence", { symbol: r.symbol, researchRunId: r.researchRunId, horizon: "2-5d" }), asOf: r.asOfAt, state: r.status, classification: "estimate" }); uses(id, [r.symbol]); }
 for (const r of rows.datasets) { if (filter && r.symbol !== filter) continue; const id = `dataset:${r.id}`; add({ id, kind: "dataset", label: `${r.symbol} daily history`, subtitle: `Retrieved ${r.retrievedAt.slice(0, 10)}`, href: "/workspace/intelligence/strategy-lab", asOf: r.lastDate, state: "Imported", classification: "observation" }); uses(id, [r.symbol]); }
 for (const r of rows.backtests) { if (filter && !r.symbols.includes(filter)) continue; const id = `backtest:${r.id}`; add({ id, kind: "backtest", label: r.name, subtitle: "Hypothetical historical simulation", href: `/workspace/intelligence/strategy-lab?strategyRunId=${encodeURIComponent(r.id)}`, asOf: r.createdAt, state: "Saved", classification: "simulation" }); uses(id, r.symbols); for (const d of r.datasetIds) edges.push({ source: id, target: `dataset:${d}`, relation: "uses-dataset" }); }
 for (const r of rows.scenarios) { if (filter && !r.symbols.includes(filter)) continue; const id = `scenario:${r.id}`; add({ id, kind: "scenario", label: r.name, subtitle: r.status === "Draft" ? "User-defined assumptions" : "Frozen-rule paper replay", href: `/workspace/intelligence/scenarios?id=${encodeURIComponent(r.id)}`, asOf: r.lastSession ?? r.createdAt, state: r.status, classification: r.status === "Draft" ? "assumption" : "simulation" }); uses(id, r.symbols); edges.push({ source: id, target: `backtest:${r.sourceRunId}`, relation: "derived-from" }); }
 for (const r of rows.relationships) edges.push({ source: `${r.sourceKind}:${r.sourceId}`, target: `${r.targetKind}:${r.targetId}`, relation: "related-by-user" });
 const dedupe = new Set<string>();
 return { generatedAt, nodes, edges: edges.filter(e => { const key = `${e.source}:${e.target}:${e.relation}`; if (!seen.has(e.source) || !seen.has(e.target) || e.source === e.target || dedupe.has(key)) return false; dedupe.add(key); return true; }), limits: { perType: 12, truncated: [rows.forecasts, rows.datasets, rows.backtests, rows.scenarios].some(r => r.length >= 12) }, note: "Private research lineage. Shared symbols indicate related context, not causal evidence or automatic approval. Client messages, documents, and profile content are not copied into this graph." };
}
