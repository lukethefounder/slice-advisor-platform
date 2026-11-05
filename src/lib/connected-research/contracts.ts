/** Cross-screen identities; values are never recomputed in the navigation layer. */
export type ResearchContext = { symbol: string; researchRunId: string | null; horizon: string };
export const CONTEXT_HORIZONS = ["5-30m", "intraday", "1d", "2-5d", "1-4w", "1-3m", "3-12m", "1-3y"] as const;
export const SCENARIO_VERSION = "slice-registered-paper-replay-1.0.0";
export type ScenarioStatus = "Draft" | "Watching" | "Complete" | "Archived";
export type ScenarioAssumptions = { targetSessions: number; shocksPct: Record<string, number>; reviewDrawdownPct: number; notes: string };
export type Scope = { userId: string; firmId: string };
export type NetworkNode = { id: string; kind: "symbol" | "forecast" | "backtest" | "scenario" | "dataset"; label: string; subtitle: string; href: string; asOf: string | null; state: string; classification: "observation" | "estimate" | "simulation" | "assumption" | "identity" };
export type NetworkEdge = { source: string; target: string; relation: "uses-symbol" | "uses-dataset" | "derived-from" | "related-by-user" };
export type ResearchNetwork = { generatedAt: string; nodes: NetworkNode[]; edges: NetworkEdge[]; limits: { perType: number; truncated: boolean }; note: string };
export function contextFrom(params: URLSearchParams): ResearchContext {
  const value = (params.get("symbol") ?? "").trim().toUpperCase();
  const run = params.get("researchRunId"); const h = params.get("forecastHorizon");
  return { symbol: /^[A-Z][A-Z0-9.-]{0,14}$/.test(value) ? value : "MSFT",
    researchRunId: run && /^[a-zA-Z0-9_-]{1,100}$/.test(run) ? run : null,
    horizon: CONTEXT_HORIZONS.includes(h as typeof CONTEXT_HORIZONS[number]) ? h! : "2-5d" };
}
export function researchHref(path: string, context: ResearchContext): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Only local research routes are allowed.");
  const u = new URL(path, "https://slice.local");
  u.searchParams.set("symbol", context.symbol); u.searchParams.set("forecastHorizon", context.horizon);
  if (context.researchRunId) u.searchParams.set("researchRunId", context.researchRunId);
  if (u.pathname.includes("knowledge-graph") && context.researchRunId) u.searchParams.set("runId", context.researchRunId);
  if (u.pathname === "/market-visuals") u.searchParams.set("view", "forecast");
  return u.pathname + u.search;
}
export function routeKey(path: string, params: URLSearchParams): string {
  if (path !== "/market-visuals" && path !== "/workspace/connected" && !path.startsWith("/workspace/intelligence")) return path;
  const c = contextFrom(params); return [path, c.symbol, c.researchRunId ?? "latest", c.horizon, params.get("runId") ?? "", params.get("strategyRunId") ?? "", params.get("sourceRunId") ?? ""].join(":");
}
