import { createHash } from "node:crypto";
import { runBacktest } from "../strategy-lab/engine";
import { validateSpec } from "../strategy-lab/validation";
import { engineVersionFor, StrategyError, type BacktestResult, type Dataset, type Performance } from "../strategy-lab/contracts";
export const SENSITIVITY_VERSION = "slice-pinned-cost-sensitivity-1";
export type CostCase = { name: string; feeBps: number; slippageBps: number; commissionUsd: number };
export type SensitivityReport = {
  version: typeof SENSITIVITY_VERSION; classification: "historical-cost-sensitivity-not-a-forecast";
  engineVersion: string; period: { start: string; end: string }; symbols: string[]; benchmark: string;
  manifests: BacktestResult["manifests"]; baseline: Performance;
  cases: Array<{ costs: CostCase; performance: Performance; deltaReturnPct: number; changedTradeCount: number }>;
  note: string;
};
export const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export function validateCases(raw: unknown): CostCase[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 4) throw new StrategyError("COST_CASES", "Choose one to four explicit cost cases.");
  const names = new Set<string>();
  return raw.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new StrategyError("COST_CASES", "Each cost case must be an object.");
    const r = value as Record<string, unknown>;
    if (Object.keys(r).some(k=>!["name","feeBps","slippageBps","commissionUsd"].includes(k))) throw new StrategyError("COST_CASES", "Unknown cost parameter.");
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name || name.length > 60 || names.has(name)) throw new StrategyError("COST_CASES", "Use distinct names of 1–60 characters.");
    names.add(name);
    for (const k of ["feeBps","slippageBps","commissionUsd"] as const) {
      const v=r[k]; if(typeof v!=="number" || !Number.isFinite(v) || v<0 || v>(k==="commissionUsd"?1000:500)) throw new StrategyError("COST_CASES", "Costs must be finite and nonnegative; fees/slippage ≤500 bps and commission ≤$1,000.");
    }
    return {name, feeBps:r.feeBps as number,slippageBps:r.slippageBps as number,commissionUsd:r.commissionUsd as number};
  });
}
export function pinnedSources(result: BacktestResult, datasets: Dataset[]): Dataset[] {
  if (result.engineVersion !== engineVersionFor(result.spec)) throw new StrategyError("ENGINE_MISMATCH", "The saved engine version is unsupported; the original result was preserved.",409);
  if (!Array.isArray(result.manifests) || datasets.length!==result.manifests.length) throw new StrategyError("SOURCE_MISMATCH", "Load exactly the datasets pinned to this result.",409);
  return result.manifests.map(m=> {
    const found=datasets.filter(d=>d.id===m.id && d.symbol===m.symbol);
    if(found.length!==1) throw new StrategyError("SOURCE_MISMATCH", "A pinned dataset is missing or duplicated.",409);
    const d=found[0];
    if(d.sourceSha256!==m.sourceSha256 || d.provider!==m.provider || d.currency!==m.currency || d.retrievedAt!==m.retrievedAt || d.bars.length!==m.barCount || d.bars[0]?.date!==m.firstDate || d.bars.at(-1)?.date!==m.lastDate) throw new StrategyError("SOURCE_MISMATCH", "Pinned source identity or coverage changed.",409);
    return d;
  });
}
export function sensitivityInputHash(runId: string, resultHash: string, cases: CostCase[]) {
  return sha(JSON.stringify({version:SENSITIVITY_VERSION,runId,resultHash,cases}));
}
export function costSensitivity(result: BacktestResult, datasets: Dataset[], raw: unknown, now = new Date()): SensitivityReport {
  const cases=validateCases(raw), pinned=pinnedSources(result,datasets);
  const variants=cases.map(costs=> {
    const spec=validateSpec({...result.spec,feeBps:costs.feeBps,slippageBps:costs.slippageBps,commissionUsd:costs.commissionUsd});
    const next=runBacktest(spec,pinned,now);
    if(next.effectiveStart!==result.effectiveStart || next.effectiveEnd!==result.effectiveEnd) throw new StrategyError("PERIOD_MISMATCH","Cost comparison changed the accepted period.",409);
    return {costs,performance:next.strategy,deltaReturnPct:next.strategy.totalReturnPct-result.strategy.totalReturnPct,changedTradeCount:next.trades.length-result.trades.length};
  });
  return {version:SENSITIVITY_VERSION,classification:"historical-cost-sensitivity-not-a-forecast",engineVersion:result.engineVersion,period:{start:result.effectiveStart,end:result.effectiveEnd},symbols:[...result.spec.symbols],benchmark:result.spec.benchmark,manifests:result.manifests,baseline:result.strategy,cases:variants,
    note:"Identical pinned history, rules and execution version; only the displayed fees, slippage and commissions change. Costs can change affordability and later orders. This is neither out-of-sample validation nor a forecast. Original results are not overwritten."};
}
