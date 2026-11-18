import type { BacktestResult, RuleSet, StrategySpec } from "@/lib/strategy-lab/contracts";
import { METRICS } from "@/lib/strategy-lab/contracts";
import { analyzeLoadedSeries } from "@/lib/instant-workspace/chart-analysis";
import type { MarketSeries } from "@/lib/market-evidence/contracts";
import type { DecisionSource, SavedEvidence } from "./contracts";
export function validId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value); }
export function evidenceSymbol(value: unknown): string {
 if(typeof value!=="string" || !/^[A-Z][A-Z0-9.\-]{0,14}$/.test(value.trim().toUpperCase())) throw new Error("Select an exact stock or ETF ticker from the saved strategy.");
 return value.trim().toUpperCase();
}
export function rulesText(set: RuleSet | undefined, empty: string, depth = 0): string {
 if(!set || depth>5) return empty;
 const parts = set.rules.map(r => {
  const label=METRICS.find(m=>m.id===r.metric)?.label??r.metric;
  const subject=r.subject==="benchmark"?"benchmark":"instrument";
  return `${subject} ${label} (${r.period} sessions) ${r.comparator} ${r.value}${r.comparator==="between"?` and ${r.upper}`:""}`;
 });
 for(const group of set.groups??[])parts.push(`(${rulesText(group,empty,depth+1)})`);
 return parts.length?parts.join(set.mode==="all"?" AND ":" OR "):empty;
}
export function strategySummary(s: StrategySpec): string[] {
 return [
  `Entry: ${rulesText(s.entry,"no additional entry filter")}.`,
  `Exit: ${rulesText(s.exit,"no rule-based exit; other risk and rebalance rules still apply")}.`,
  `Benchmark filter: ${rulesText(s.regime,"no additional benchmark filter")}.`,
  `Rank by ${s.ranking} over ${s.rankingPeriod} sessions; ${s.weighting} weights; rebalance ${s.rebalance}.`,
  `At rebalance: up to ${s.maxHoldings} holdings, ${s.maxPositionPct}% target per position and ${s.maxExposurePct}% total target exposure. Residual allocation remains cash.`,
  `Modeled execution costs: ${s.feeBps} basis points fees, ${s.slippageBps} basis points slippage, and $${s.commissionUsd} commission per order.`,
  `Completed prior-session signals and next eligible opening fills follow engine version ${s.version}; intraday quotes do not execute this daily strategy.`,
  ...(s.allocationGroups??[]).map(g=>`Group ${g.name}: ${g.symbols.join(", ")}; ${g.maxExposurePct}% target exposure cap at rebalancing.`),
  `Closing trailing stop: ${s.trailingStopPct===null?"disabled":s.trailingStopPct+"%"}; portfolio stop: ${s.portfolioStopPct===null?"disabled":s.portfolioStopPct+"%"}; maximum holding sessions: ${s.maxHoldingSessions??"not set"}; cooldown: ${s.cooldownSessions} sessions.`
 ];
}
export function inspectTechnical(series: MarketSeries) {
 // Deliberately the same history calculation used in Workspace; no alternative score engine.
 const a=analyzeLoadedSeries(series); if(!a)return null;
 const notes=[`Latest loaded close ${a.lastClose.toFixed(4)} at ${a.lastAt}; ${a.count} observations.`,
  a.distanceSma20Pct===null?"SMA 20 has insufficient uninterrupted history.":`Close is ${Math.abs(a.distanceSma20Pct).toFixed(2)}% ${a.distanceSma20Pct>=0?"above":"below"} SMA 20.`,
  a.rsi14===null?"Simple-window RSI 14 has insufficient history.":`Simple-window RSI 14 is ${a.rsi14.toFixed(1)}; this is a measurement, not a standalone order instruction.`,
  `The loaded raw-price change is ${a.changePct.toFixed(2)}%; its worst closing drawdown is ${a.drawdownPct.toFixed(2)}%.`,
  "These current raw-price measurements are not inserted into the historical run or its accepted forward journal. Splits and dividends can make raw-price changes differ from adjusted strategy metrics."];
 return {...a,notes};
}
export function interpretSource(source: DecisionSource, evidence: SavedEvidence[]): string[] {
 const r=source.result, forward=source.scenario?.result;
 return [
  `Historical simulation: ${r.strategy.totalReturnPct.toFixed(2)}% versus ${r.benchmark.totalReturnPct.toFixed(2)}% for ${r.spec.benchmark}, from ${r.effectiveStart} to ${r.effectiveEnd}.`,
  `Historical maximum drawdown: ${r.strategy.maxDrawdownPct.toFixed(2)}%; ${r.trades.length} simulated orders. These are hypothetical results, not executed trades.`,
  forward?`Registered daily paper replay: ${forward.acceptedSessions} accepted sessions through ${forward.throughDate}; ${forward.calculation.strategy.totalReturnPct.toFixed(2)}% recorded return.`:"No accepted forward result is attached. A historical result must not be described as future performance.",
  `Current-evidence snapshots attached: ${evidence.length}. Their observation times are independent of the historical test period.`,
  "Use the recorded entry, exit, benchmark, allocation, cash, and risk conditions to frame a review. No single technical reading, news score, or disclosed trade establishes an optimal buying or selling time."
 ];
}
export const REPORT_LIMITATIONS=[
 "Hypothetical historical and paper performance is not actual account performance or a guarantee of future returns. Human advisor review is required before any client-facing use.",
 "The fixed universe can contain selection and survivorship bias. Industry labels are user-defined groups, not reconstructed historical sector membership.",
 "Current quotes, returned news sentiment, and disclosed activity are contextual evidence; they are not historical strategy inputs unless separately supported and timestamped by the execution engine.",
 "News sentiment describes the returned, deduplicated sample only. Institutional holdings and insider disclosures are not a complete or real-time Wall Street transaction tape.",
 "This report does not place orders, connect to a broker, or identify guaranteed optimal trade times. Source availability and market-data entitlements still apply."
];
export function resultSummary(r:BacktestResult){return {from:r.effectiveStart,to:r.effectiveEnd,orders:r.trades.length,returnPct:r.strategy.totalReturnPct,benchmarkPct:r.benchmark.totalReturnPct,drawdownPct:r.strategy.maxDrawdownPct};}
/** Display-only sampling: all calculations and exports retain the original observations. */
export function samplePoints<T>(rows:T[],maximum=900):T[]{ if(rows.length<=maximum)return rows;const step=(rows.length-1)/(maximum-1);return Array.from({length:maximum},(_,i)=>rows[Math.round(i*step)]); }
export function csvCell(value:unknown){const text=value==null?"":String(value);const guarded=/^[=+@\t\r]/.test(text)||(text.startsWith("-")&&!Number.isFinite(Number(text)))?"'"+text:text;return '"'+guarded.replace(/"/g,'""')+'"';}
export function tradesCsv(r:BacktestResult){const header=["signal_date","execution_date","symbol","side","shares","observed_open","modeled_fill","fees","slippage","reason"];return [header,...r.trades.map(t=>[t.signalDate,t.date,t.symbol,t.side,t.shares,t.rawOpen,t.fillPrice,t.fee,t.slippage,t.reason])].map(row=>row.map(csvCell).join(",")).join("\r\n");}
