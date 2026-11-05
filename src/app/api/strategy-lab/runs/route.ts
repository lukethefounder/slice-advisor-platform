import { createHash } from "node:crypto";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { runBacktest } from "@/lib/strategy-lab/engine";
import { loadDatasets } from "@/lib/strategy-lab/provider";
import { StrategyError, engineVersionFor, manifestOf } from "@/lib/strategy-lab/contracts";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { strategyAccess, readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const GET = withApiRoute({ route: "/api/strategy-lab/runs", timeoutMs: 15000 }, async ({ request }) => {
  const userId = await strategyAccess(request, false), id = new URL(request.url).searchParams.get("id");
  if (id) {
    const run = await prisma.sliceStrategyRun.findFirst({ where: { id: id.slice(0, 100), userId } });
    if (!run) return apiJson({ ok: false, error: "Run not found." }, { status: 404 });
    if (hash(run.resultJson) !== run.outputSha256) return apiJson({ ok: false, error: "Result integrity check failed." }, { status: 409 });
    return apiJson({ ok: true, runId: run.id, createdAt: run.createdAt, inputSha256: run.inputSha256, outputSha256: run.outputSha256, result: JSON.parse(run.resultJson) as unknown });
  }
  const rows = await prisma.sliceStrategyRun.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, name: true, createdAt: true, engineVersion: true, summaryJson: true } });
  return apiJson({ ok: true, runs: rows.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, engineVersion: r.engineVersion, summary: JSON.parse(r.summaryJson) as unknown })) });
});
export const POST = withApiRoute({ route: "/api/strategy-lab/runs", timeoutMs: 55000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    const body = await readResearchJson(request), spec = validateSpec(body.spec);
    if (!Array.isArray(body.datasetIds) || body.datasetIds.some(id => typeof id !== "string" || id.length > 100)) throw new StrategyError("DATASET_IDS", "Provide the IDs of imported historical datasets.");
    const datasets = await loadDatasets(userId, body.datasetIds as string[]);
    const inputSha256 = hash(JSON.stringify({ spec, engineVersion: engineVersionFor(spec), sources: datasets.map(manifestOf).sort((a, b) => a.symbol.localeCompare(b.symbol)) }));
    const result = runBacktest(spec, datasets), resultJson = JSON.stringify(result);
    if (Buffer.byteLength(resultJson, "utf8") > 3200000) throw new StrategyError("RESULT_LIMIT", "This run exceeds the interactive audit-result limit. Reduce the date range, universe size, or rebalance frequency; no partial result was saved.");
    const outputSha256 = hash(resultJson);
    const run = await prisma.sliceStrategyRun.create({ data: { userId, name: spec.name, engineVersion: engineVersionFor(spec), inputSha256, outputSha256,
      datasetIdsJson: JSON.stringify(body.datasetIds), resultJson,
      summaryJson: JSON.stringify({ start: result.effectiveStart, end: result.effectiveEnd, benchmark: spec.benchmark, universe: spec.symbols, strategy: result.strategy, benchmarkPerformance: result.benchmark }) } });
    return apiJson({ ok: true, runId: run.id, inputSha256, outputSha256, result });
  } catch (error) { strategyFailure(error); }
});
