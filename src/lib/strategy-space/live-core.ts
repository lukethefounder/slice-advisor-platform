import type { MarketQuote, MarketReceipt } from "../market-evidence/contracts";
import type { Performance, StrategySpec } from "../strategy-lab/contracts";
export type ScenarioWatch = {
  id: string; name: string; status: string; sourceRunId: string; definitionHash: string; resultHash: string|null;
  frozenAt: string|null; lastSession: string|null; acceptedSessions: number; targetSessions: number;
  symbols: string[]; benchmark: string; engineVersion: string; performance: Performance|null;
  holdings: Record<string,number>; lastError: string|null; nextCheckAt: string|null; updatedAt: string;
  ruleSummary: { rebalance: StrategySpec["rebalance"]; weighting: StrategySpec["weighting"]; maxExposurePct: number };
};
export function quoteObservation(quote: MarketQuote|undefined, receipts: MarketReceipt[], now = Date.now()) {
  if(!quote || !Number.isFinite(quote.price) || quote.price<=0 || !Number.isFinite(Date.parse(quote.observedAt)) || Date.parse(quote.observedAt)>now+60000) return null;
  const ageMs=Math.max(0, now-Date.parse(quote.observedAt));
  // A UI refresh is not proof of a fresh quote or an entitled feed.
  const retained=receipts.some(r=>r.cacheState==="retained" || r.cacheState==="stale");
  const state=retained || quote.precision==="timestamp" && ageMs>15*60000 ? "stale" : quote.precision==="date" && quote.state==="realtime" ? "end-of-day" : quote.state;
  return {...quote,state,ageMs,retained,classification:"provider-observation-not-an-order" as const};
}
export function shouldWatch(input: {enabled:boolean;visible:boolean;online:boolean;busy:boolean;retryAt:number|null}, now=Date.now()) {
  return input.enabled && input.visible && input.online && !input.busy && (input.retryAt===null || input.retryAt<=now);
}
