import { requireResearchStorage } from "@/lib/data-readiness/server";
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildForecast, createDisabledCamelFeatures } from "@/lib/intelligence-forecast/engine";
import { normalizeMarketSnapshot } from "@/lib/intelligence-forecast/validation";
import { persistForecastRun } from "@/lib/intelligence-forecast/persistence";
import { auditForecastEvidenceRun } from "@/lib/intelligence-forecast/point-in-time-warehouse";
import { syncForecastRunToGraph } from "@/lib/intelligence-forecast/provenance-graph";
import { isNeo4jConfigured } from "@/lib/neo4j";
import { loadHorizonModelSuite, persistShadowHorizonPredictions, scoreHorizonModelSuite } from "@/lib/intelligence-forecast/horizon-models";
import { analyzeResearchGraph, projectResearchGraph, getResearchGraphNodeDetail } from "@/lib/intelligence/graph-engine";
import type { ResearchSwarmResponse, ResearchKnowledgeGraph, ResearchGraphProjectionMode, ResearchGraphAnalytics } from "@/lib/intelligence/research-swarm-types";
import type { ForecastResponse } from "@/lib/intelligence-forecast/types";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import { HORIZONS, type CanonicalBundle } from "./contracts";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
type Summary = Pick<ResearchSwarmResponse, "score" | "market" | "warnings" | "companyName" | "sector" | "industry" | "requestedAgents" | "activeAgents" | "durationMs">;
/** Called only after the server-side Alpha Vantage-only research collector completes. */
export async function publishAlphaResearch(userId: string, research: ResearchSwarmResponse): Promise<CanonicalBundle> {
  const existing = await readCanonical(userId, research.symbol, research.runId);
  if (existing) return existing;
  if (research.market.provider !== "Alpha Vantage" || !(research.market.price > 0) || !research.providerAsOf || !Number.isFinite(Date.parse(research.providerAsOf)))
    throw new StrategyError("NO_VERIFIED_PRICE", "Canonical forecast requires an observed Alpha Vantage price and provider timestamp.", 409);
  if (research.evidence.some(e => e.cohort === "media" && !e.id.startsWith("media:alpha:")))
    throw new StrategyError("MIXED_SOURCE_BLOCKED", "Research contains media evidence outside Alpha Vantage; this run was not published.", 409);
  if (["media", "technical", "economy"].some(name => {
    const cohort = research.cohorts[name as keyof typeof research.cohorts];
    return cohort.evidenceCount < 1 || cohort.confidence <= 0;
  })) throw new StrategyError("INCOMPLETE_EVIDENCE", "At least one Alpha Vantage research cohort has no usable evidence. Publication is blocked rather than presenting a neutral placeholder as a complete forecast.", 409);
  const snapshot = normalizeMarketSnapshot({ ...research.forecastSnapshot, requestId: research.runId });
  const snapshotJson = JSON.stringify(snapshot), inputSha256 = digest(snapshotJson);
  const summary: Summary = { score: research.score, market: research.market, warnings: research.warnings,
    companyName: research.companyName, sector: research.sector, industry: research.industry, requestedAgents: research.requestedAgents,
    activeAgents: research.activeAgents, durationMs: research.durationMs };
  let reservation: { id: string };
  try {
    reservation = await prisma.sliceForecastBundle.create({ data: { userId, symbol: research.symbol, researchRunId: research.runId,
      status: "Building", provider: "Alpha Vantage", inputSha256, snapshotJson,
      researchJson: JSON.stringify(summary), graphJson: JSON.stringify(research.graph), asOfAt: new Date(snapshot.asOf) } });
  } catch (error) {
    // A uniqueness reservation prevents two workers from overwriting one immutable forecast run.
    const winner = await readCanonical(userId, research.symbol, research.runId);
    if (winner) return winner;
    if (error && typeof error === "object" && "code" in error && error.code === "P2002")
      throw new StrategyError("FORECAST_IN_PROGRESS", "This research run is already publishing. Retry its saved result shortly.", 409);
    throw error;
  }
  try {
    const forecast = buildForecast(snapshot, createDisabledCamelFeatures("External model services are disabled for this Alpha Vantage-only publication. Local model estimates are not observations."));
    if (forecast.horizons.length !== HORIZONS.length || HORIZONS.some(h => !forecast.horizons.some(v => v.horizon === h)))
      throw new StrategyError("FORECAST_HORIZON_CONTRACT", "The engine did not produce the complete canonical horizon set.", 409);
    const stored = await persistForecastRun({ userId, snapshot, forecast });
    const horizons = await prisma.intelligenceForecastHorizon.findMany({ where: { userId, forecastRunId: stored.id }, select: { horizon: true, targetAt: true } });
    const targets = Object.fromEntries(horizons.map(h => [h.horizon, h.targetAt.toISOString()]));
    const graph = attachForecastNodes(research.graph, forecast, reservation.id, stored.id, targets);
    const graphAnalytics = analyzeResearchGraph(graph, research.score);
    const operations: Record<string, string> = { persistence: "stored", warehouse: "pending", neo4j: "not-configured", horizonModels: "pending" };
    // Secondary operational failures do not replace a valid forecast with a different model.
    try { const audited = await auditForecastEvidenceRun({ userId, runId: stored.id }); operations.warehouse = audited.report.pointInTimeSafe ? "audited" : "needs-review"; }
    catch { operations.warehouse = "failed"; }
    try { const suite = await loadHorizonModelSuite(userId); await persistShadowHorizonPredictions({ userId, forecastRunId: stored.id, result: scoreHorizonModelSuite(snapshot, suite) }); operations.horizonModels = "stored-evaluation-only"; }
    catch { operations.horizonModels = "failed"; }
    if (isNeo4jConfigured()) {
      try { await syncForecastRunToGraph({ userId, runId: stored.id }); operations.neo4j = "synced"; }
      catch { operations.neo4j = "failed"; }
    }
    const forecastJson = JSON.stringify(forecast), outputSha256 = digest(forecastJson);
    await prisma.sliceForecastBundle.update({ where: { id: reservation.id }, data: { status: "Ready", forecastRunId: stored.id,
      forecastJson, outputSha256, graphJson: JSON.stringify(graph), operationsJson: JSON.stringify({ operations, targets, graphAnalytics, graphSha256: digest(JSON.stringify(graph)), researchSha256: digest(JSON.stringify(summary)) }) } });
    const bundle = await readCanonical(userId, research.symbol, research.runId);
    if (!bundle) throw new StrategyError("PUBLICATION_FAILED", "Canonical publication could not be read back.", 500);
    return bundle;
  } catch (error) {
    await prisma.sliceForecastBundle.update({ where: { id: reservation.id }, data: { status: "Failed" } }).catch(() => undefined);
    throw error;
  }
}
export async function readCanonical(userId: string, symbol: string, researchRunId?: string | null): Promise<CanonicalBundle | null> {
  await requireResearchStorage(["SliceForecastBundle"]);
  const row = await prisma.sliceForecastBundle.findFirst({ where: { userId, symbol, status: "Ready", provider: "Alpha Vantage", ...(researchRunId ? { researchRunId } : {}) }, orderBy: { createdAt: "desc" } });
  if (!row?.forecastJson || !row.outputSha256 || !row.forecastRunId) return null;
  if (digest(row.forecastJson) !== row.outputSha256 || digest(row.snapshotJson) !== row.inputSha256) throw new StrategyError("FORECAST_INTEGRITY", "Saved forecast integrity check failed.", 409);
  const summary = JSON.parse(row.researchJson) as Summary;
  const aux = JSON.parse(row.operationsJson ?? "{}") as { operations?: Record<string, string>; targets?: Record<string, string>; graphSha256?: string; researchSha256?: string; graphAnalytics?: ResearchGraphAnalytics };
  if (!aux.graphAnalytics) throw new StrategyError("ANALYTICS_MISSING", "Saved graph analytics are unavailable.", 409);
  if (aux.researchSha256 !== digest(row.researchJson)) throw new StrategyError("RESEARCH_INTEGRITY", "Saved research summary integrity check failed.", 409);
  const forecast = JSON.parse(row.forecastJson) as ForecastResponse;
  return { schemaVersion: "slice-canonical-bundle-1.0.0", id: row.id, symbol: row.symbol, researchRunId: row.researchRunId, forecastRunId: row.forecastRunId,
    inputSha256: row.inputSha256, outputSha256: row.outputSha256, asOf: row.asOfAt.toISOString(), generatedAt: forecast.generatedAt, dataProvider: "Alpha Vantage",
    classification: "model-estimate-not-provider-observation", score: summary.score, market: summary.market, forecast,
    graphAnalytics: aux.graphAnalytics, operations: aux.operations ?? {}, targets: aux.targets ?? {}, warnings: summary.warnings };
}
export function attachForecastNodes(graph: ResearchKnowledgeGraph, forecast: ForecastResponse, bundleId: string, forecastRunId: string, targets: Record<string, string>): ResearchKnowledgeGraph {
  const scoreNode = graph.nodes.find(n => n.kind === "score");
  const nodes = forecast.horizons.map(h => ({ id: `canonical:${bundleId}:${h.horizon}`, kind: "forecast" as const, label: `${h.label}: ${h.positiveReturnProbability.toFixed(1)}% positive`, cohort: "shared" as const,
    score: h.positiveReturnProbability, confidence: h.confidence, size: 13, group: "Canonical forecast",
    properties: { bundleId, forecastRunId, horizon: h.horizon, asOf: forecast.asOf, targetAt: targets[h.horizon] ?? "", expectedPrice: h.expectedPrice,
      expectedReturnPercent: h.expectedReturnPercent, low: h.expectedPriceRange.low, high: h.expectedPriceRange.high,
      metric: "Probability of positive return (not the Slice sentiment score)", source: "Stored Slice model estimate over Alpha Vantage observations" } }));
  const edges = scoreNode ? nodes.map(n => ({ id: `canonical-edge:${bundleId}:${n.id}`, source: scoreNode.id, target: n.id,
    kind: "DERIVES" as const, weight: 1, cohort: "shared" as const, properties: { forecastRunId } })) : [];
  return { ...graph, nodes: [...graph.nodes, ...nodes], edges: [...graph.edges, ...edges], nodeCount: graph.nodes.length + nodes.length, edgeCount: graph.edges.length + edges.length };
}
export async function readCanonicalGraph(input: { userId: string; symbol: string; runId?: string; projection?: ResearchGraphProjectionMode; selectedNodeId?: string | null }) {
  await requireResearchStorage(["SliceForecastBundle"]);
  const row = await prisma.sliceForecastBundle.findFirst({ where: { userId: input.userId, symbol: input.symbol, status: "Ready", ...(input.runId ? { researchRunId: input.runId } : {}) }, orderBy: { createdAt: "desc" } });
  if (!row) return null;
  const audit = JSON.parse(row.operationsJson ?? "{}") as { graphSha256?: string; researchSha256?: string; graphAnalytics?: ResearchGraphAnalytics };
  if (audit.graphSha256 !== digest(row.graphJson) || audit.researchSha256 !== digest(row.researchJson)) throw new StrategyError("GRAPH_INTEGRITY", "Saved graph integrity check failed.", 409);
  const graph = JSON.parse(row.graphJson) as ResearchKnowledgeGraph, summary = JSON.parse(row.researchJson) as Summary;
  const analytics = audit.graphAnalytics ?? analyzeResearchGraph(graph, summary.score);
  return { ok: true as const, source: "postgresql" as const, symbol: row.symbol, runId: row.researchRunId, generatedAt: graph.generatedAt,
    graph: retainCanonicalNodes(graph, projectResearchGraph(graph, { mode: input.projection ?? "overview", selectedNodeId: input.selectedNodeId, analytics })), analytics,
    selectedNode: getResearchGraphNodeDetail(graph, input.selectedNodeId),
    metadata: { companyName: summary.companyName, sector: summary.sector, industry: summary.industry, requestedAgents: summary.requestedAgents,
      activeAgents: summary.activeAgents, score: summary.score.overall, confidence: summary.score.confidence, providerAsOf: summary.score.providerAsOf, durationMs: summary.durationMs },
    persistence: { configured: true, status: "available" as const } };
}

/** Canonical horizon nodes remain visible in every projection without rebuilding their numbers. */
export function retainCanonicalNodes(full: ResearchKnowledgeGraph, projected: ResearchKnowledgeGraph): ResearchKnowledgeGraph {
  const ids = new Set(projected.nodes.map(n => n.id));
  const extra = full.nodes.filter(n => (n.kind === "forecast" || n.kind === "score") && !ids.has(n.id));
  extra.forEach(n => ids.add(n.id));
  const edgeIds = new Set(projected.edges.map(e => e.id));
  const edges = [...projected.edges, ...full.edges.filter(e => e.id.startsWith("canonical-edge:") && ids.has(e.source) && ids.has(e.target) && !edgeIds.has(e.id))];
  const nodes = [...projected.nodes, ...extra];
  return { ...projected, nodes, edges, nodeCount: nodes.length, edgeCount: edges.length,
    ...(projected.projection ? { projection: { ...projected.projection, renderedNodeCount: nodes.length, renderedEdgeCount: edges.length, omittedNodeCount: Math.max(0, full.nodes.length - nodes.length), omittedEdgeCount: Math.max(0, full.edges.length - edges.length) } } : {}) };
}
