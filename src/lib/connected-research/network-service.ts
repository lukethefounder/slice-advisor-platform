import "server-only";
import { prisma } from "@/lib/prisma";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import type { Scope } from "./contracts";
import { buildNetwork } from "./network-core";
function parse(value: string): Record<string, unknown> { try { const v = JSON.parse(value) as unknown; return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; } catch { return {}; } }
function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; }
export async function getResearchNetwork(scope: Scope, symbol: string | null) {
 const [forecasts, datasets, runs, scenarios, relationships] = await Promise.all([
  prisma.sliceForecastBundle.findMany({ where: { userId: scope.userId, status: "Ready", ...(symbol ? { symbol } : {}) }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, symbol: true, researchRunId: true, asOfAt: true, status: true } }),
  prisma.sliceResearchDataset.findMany({ where: { userId: scope.userId, provider: "Alpha Vantage", ...(symbol ? { symbol } : {}) }, orderBy: { retrievedAt: "desc" }, take: 12, select: { id: true, symbol: true, lastDate: true, retrievedAt: true } }),
  prisma.sliceStrategyRun.findMany({ where: { userId: scope.userId }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, name: true, createdAt: true, summaryJson: true, datasetIdsJson: true } }),
  prisma.sliceForwardScenario.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, name: true, status: true, specJson: true, sourceRunId: true, lastSession: true, createdAt: true } }),
  prisma.sliceResearchRelationship.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 100, select: { sourceKind: true, sourceId: true, targetKind: true, targetId: true } }),
 ]);
 return buildNetwork({ forecasts: forecasts.map(r => ({ ...r, asOfAt: r.asOfAt.toISOString() })), datasets: datasets.map(r => ({ ...r, retrievedAt: r.retrievedAt.toISOString() })), backtests: runs.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt.toISOString(), symbols: list(parse(r.summaryJson).universe), datasetIds: (() => { try { return list(JSON.parse(r.datasetIdsJson) as unknown); } catch { return []; } })() })), scenarios: scenarios.map(r => ({ id: r.id, name: r.name, sourceRunId: r.sourceRunId, status: r.status, lastSession: r.lastSession, createdAt: r.createdAt.toISOString(), symbols: list(parse(r.specJson).symbols) })), relationships }, symbol, new Date().toISOString());
}
async function verifyNode(scope: Scope, kind: string, id: string) {
 const where = { id, userId: scope.userId };
 if (kind === "forecast") return Boolean(await prisma.sliceForecastBundle.findFirst({ where, select: { id: true } }));
 if (kind === "dataset") return Boolean(await prisma.sliceResearchDataset.findFirst({ where, select: { id: true } }));
 if (kind === "backtest") return Boolean(await prisma.sliceStrategyRun.findFirst({ where, select: { id: true } }));
 if (kind === "scenario") return Boolean(await prisma.sliceForwardScenario.findFirst({ where: { id, ...scope }, select: { id: true } }));
 return false;
}
export async function relateResearch(scope: Scope, body: Record<string, unknown>) {
 const source = typeof body.source === "string" ? body.source.split(":") : [];
 const target = typeof body.target === "string" ? body.target.split(":") : [];
 if (source.length !== 2 || target.length !== 2 || body.source === body.target || [...source, ...target].some(v => !/^[a-zA-Z0-9_-]{1,100}$/.test(v))) throw new StrategyError("RELATIONSHIP_INPUT", "Choose two different owned research records.", 400);
 if (!await verifyNode(scope, source[0], source[1]) || !await verifyNode(scope, target[0], target[1])) throw new StrategyError("RECORD_NOT_FOUND", "A research record is not accessible.", 404);
 const keys = { ...scope, sourceKind: source[0], sourceId: source[1], targetKind: target[0], targetId: target[1] };
 if (body.action === "remove") return prisma.sliceResearchRelationship.deleteMany({ where: keys });
 return prisma.sliceResearchRelationship.upsert({ where: { userId_firmId_sourceKind_sourceId_targetKind_targetId: keys }, create: keys, update: {} });
}
