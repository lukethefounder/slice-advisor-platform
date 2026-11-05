import { createHash } from "node:crypto";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { strategyAccess, strategyFailure, readResearchJson } from "@/lib/strategy-lab/http";
import { loadDatasets } from "@/lib/strategy-lab/provider";
import { explainDecision } from "@/lib/strategy-lab/execution-audit";
import { StrategyError, type BacktestResult } from "@/lib/strategy-lab/contracts";
import { isoDate, symbolOf } from "@/lib/strategy-lab/validation";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export const POST = withApiRoute({ route: "/api/strategy-lab/explain", timeoutMs: 25000 }, async ({ request }) => {
  const userId = await strategyAccess(request, true);
  try {
    await requireResearchStorage(["SliceStrategyRun", "SliceResearchDataset"]);
    const body = await readResearchJson(request);
    if (typeof body.runId !== "string" || body.runId.length > 100) throw new StrategyError("RUN_ID", "Select a saved run.");
    const row = await prisma.sliceStrategyRun.findFirst({ where: { userId, id: body.runId } });
    if (!row) throw new StrategyError("RUN_NOT_FOUND", "Run not found.", 404);
    if (createHash("sha256").update(row.resultJson).digest("hex") !== row.outputSha256) throw new StrategyError("RUN_INTEGRITY", "Saved result failed its checksum.", 409);
    const run = JSON.parse(row.resultJson) as BacktestResult;
    const datasets = await loadDatasets(userId, run.manifests.map(m => m.id));
    return apiJson({ ok: true, audit: explainDecision(run, datasets, isoDate(body.date, "Execution date"), symbolOf(body.symbol)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { strategyFailure(error); }
});
