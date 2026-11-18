import { analyzeLoadedSeries } from "@/lib/instant-workspace/chart-analysis";
import type { MarketQuote, MarketSeries, MarketEvidence, MarketRange } from "@/lib/market-evidence/contracts";
import type { ChartSettings } from "@/lib/market-evidence/chart-settings";
export type LensView = "structure" | "risk" | "sources";
export const LENS_VIEWS: LensView[] = ["structure", "risk", "sources"];
export function lensPreferenceKey(scope: string) { return `slice-market-lens-view-v1:${encodeURIComponent(scope)}`; }
export function safeLensView(value: unknown): LensView { return LENS_VIEWS.includes(value as LensView) ? value as LensView : "structure"; }
export function lensModel(symbol: string, series: MarketSeries | null, quote: MarketQuote | null, range?: MarketRange, session: ChartSettings["session"] = "all", evidence?: MarketEvidence|null) {
 const matching = Boolean(series && series.symbol === symbol && (!range || range === series.range));
 let data:ReturnType<typeof analyzeLoadedSeries> = null; let calculationError:string|null=null;
 try {data=matching&&series?analyzeLoadedSeries(series,session):null;}catch(error){calculationError=error instanceof Error?error.message:"History could not be analyzed.";}
 const q = quote && quote.symbol === symbol && Number.isFinite(quote.price) && quote.price>0 ? quote : null;
 const receipts = (evidence?.receipts ?? []).filter(r=>r.symbols.includes(symbol));
 const snapshots = (evidence?.snapshots ?? []).filter(r=>r.symbol === symbol);
 const lastMove = data?.distanceSma20Pct ?? null;
 const trend = lastMove === null ? "Trend pending" : lastMove > 0 ? "Above SMA 20" : lastMove < 0 ? "Below SMA 20" : "At SMA 20";
 return { data, calculationError, quote:q, matching, receipts, snapshots, trend, session,
  basis: matching ? series!.basis : null,
  coverage: matching ? series!.coverage ?? "available" : null,
  note: matching ? series!.note : null,
  headlineCount: (evidence?.news ?? []).filter(n=>n.symbols.includes(symbol)).length,
  quoteAt: q?.observedAt ?? null, historyAt: data?.lastAt ?? null,
  sourceMismatch: Boolean(q && data && q.observedAt !== data.lastAt),
 };
}
export function lensPercent(value:number|null|undefined,digits=2){ return value==null||!Number.isFinite(value)?"Not available":`${value>0?"+":""}${value.toFixed(digits)}%`; }
export function lensNumber(value:number|null|undefined,digits=2){return value==null||!Number.isFinite(value)?"Not available":value.toLocaleString("en-US",{maximumFractionDigits:digits});}
