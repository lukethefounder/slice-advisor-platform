import type { MarketBar, MarketSeries } from "./contracts";
import type { ChartSettings } from "./chart-settings";

export type ChartRow = MarketBar & {
  sma20: number | null; sma50: number | null; ema20: number | null;
  bandLow: number | null; bandHigh: number | null; gapBefore: boolean;
};
export type ViewWindow = { start: number; end: number };
export type ChartPoint = ChartRow & {
  x: number; closeY: number; openY: number; highY: number; lowY: number;
  sma20Y: number | null; sma50Y: number | null; ema20Y: number | null;
  bandLowY: number | null; bandHighY: number | null;
  compareClose: number | null; compareY: number | null;
};
const nyTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function observationLabel(at: string, long = false, timeZone = "America/New_York"): string {
  // A date-only provider value is a trading-date label, NOT midnight in the browser timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) {
    const d = new Date(at + "T12:00:00Z");
    if (!Number.isFinite(d.getTime())) return "Invalid observation";
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: long ? "numeric" : undefined, month: "short", day: "numeric" }).format(d);
  }
  const date = new Date(at); if (!Number.isFinite(date.getTime())) return "Invalid observation";
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: long ? "numeric" : undefined, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
}
export function priceText(v: number | null | undefined, digits?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits ?? (Math.abs(v) < 1 ? 4 : 2), maximumFractionDigits: digits ?? (Math.abs(v) < 1 ? 4 : 2) }).format(v);
}
export function validBars(bars: MarketBar[]): MarketBar[] {
  if (!Array.isArray(bars) || bars.length > 12000) throw new Error("Chart data exceeds its safe observation limit.");
  let last = -Infinity;
  for (const b of bars) {
    const at = Date.parse(b.at);
    if (!Number.isFinite(at) || at <= last) throw new Error("Chart timestamps must be unique and strictly increasing.");
    if (![b.open,b.high,b.low,b.close].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(b.volume) || b.volume < 0 || b.high < Math.max(b.open,b.close,b.low) || b.low > Math.min(b.open,b.close,b.high)) throw new Error("An invalid OHLCV observation cannot be charted.");
    last = at;
  }
  return bars;
}
function regular(at: string) {
  const p = nyTime.formatToParts(new Date(at));
  const minutes = Number(p.find(x => x.type === "hour")?.value) * 60 + Number(p.find(x => x.type === "minute")?.value);
  return minutes >= 570 && minutes < 960;
}
export function chartRows(series: MarketSeries, session: ChartSettings["session"]): ChartRow[] {
  const checked = validBars(series.bars);
  const bars = series.range === "1D" && session === "regular" ? checked.filter(b => regular(b.at)) : checked;
  let run: number[] = [], sum20 = 0, sum50 = 0, ema: number | null = null;
  return bars.map((bar, i) => {
    const gapBefore = series.range === "1D" && i > 0 && Date.parse(bar.at) - Date.parse(bars[i-1].at) > 300000;
    // Do not carry an indicator through an unknown intraday interval.
    if (gapBefore) { run = []; sum20 = 0; sum50 = 0; ema = null; }
    run.push(bar.close); sum20 += bar.close; sum50 += bar.close;
    if (run.length > 20) sum20 -= run[run.length - 21];
    if (run.length > 50) sum50 -= run[run.length - 51];
    const sma20 = run.length >= 20 ? sum20 / 20 : null, sma50 = run.length >= 50 ? sum50 / 50 : null;
    if (sma20 !== null) ema = ema === null ? sma20 : bar.close * (2 / 21) + ema * (19 / 21);
    // Centered sum avoids cancellation on near-flat, high-priced instruments.
    const sd = sma20 === null ? null : Math.sqrt(run.slice(-20).reduce((total, v) => total + (v - sma20) ** 2, 0) / 20);
    return { ...bar, sma20, sma50, ema20: ema, bandLow: sma20 === null || sd === null ? null : sma20 - 2 * sd, bandHigh: sma20 === null || sd === null ? null : sma20 + 2 * sd, gapBefore };
  });
}
export function clampWindow(size: number, proposed?: Partial<ViewWindow>): ViewWindow {
  if (size < 1) return { start: 0, end: 0 };
  const start = Math.max(0, Math.min(size - 1, Math.floor(Number.isFinite(proposed?.start) ? proposed!.start! : 0)));
  const end = Math.max(start, Math.min(size - 1, Math.floor(Number.isFinite(proposed?.end) ? proposed!.end! : size - 1)));
  return { start, end };
}
export function zoomWindow(size: number, current: ViewWindow, factor: number, anchor = 0.5): ViewWindow {
  if (size < 2) return clampWindow(size);
  const v = clampWindow(size, current), span = v.end - v.start + 1;
  const count = Math.max(Math.min(5, size), Math.min(size, Math.round(span * factor)));
  const start = Math.max(0, Math.min(size - count, Math.round(v.start + span * anchor - count * anchor)));
  return { start, end: start + count - 1 };
}
export function panWindow(size: number, current: ViewWindow, direction: -1 | 1): ViewWindow {
  const v = clampWindow(size,current), count = v.end-v.start+1;
  const start = Math.max(0, Math.min(Math.max(0,size-count), v.start+direction*Math.max(1,Math.round(count/3))));
  return { start, end: start+count-1 };
}
export type ChartModel = {
  rows: ChartRow[]; points: ChartPoint[]; window: ViewWindow; scale: ChartSettings["scale"];
  y: (price: number) => number; ticks: Array<{ y: number; value: number }>;
  min: number; max: number; width: number; height: number; base: number;
  comparisonSymbol: string | null; comparisonCount: number; comparisonBaseAt: string | null; gapCount: number;
  changePct: number; first: ChartRow; last: ChartRow; totalVolume: number; low: number; high: number;
  closePath: string; areaPath: string; comparisonPath: string;
  overlayPaths: Record<"sma20"|"sma50"|"ema20"|"bandLow"|"bandHigh",string>;
};
function pathFor(points: ChartPoint[], key: keyof ChartPoint) {
  let drawing = false; const out: string[] = [];
  for (const p of points) {
    const y = p[key]; if (typeof y !== "number" || !Number.isFinite(y)) { drawing = false; continue; }
    if (p.gapBefore) drawing = false;
    out.push(`${drawing ? "L" : "M"}${p.x.toFixed(2)},${y.toFixed(2)}`); drawing = true;
  }
  return out.join(" ");
}
function areasFor(points: ChartPoint[], bottom: number) {
  const paths: string[] = []; let current: ChartPoint[] = [];
  const flush = () => { if (current.length >= 2) paths.push(pathFor(current,"closeY") + ` L${current[current.length-1].x.toFixed(2)},${bottom} L${current[0].x.toFixed(2)},${bottom} Z`); current=[]; };
  for (const p of points) { if (p.gapBefore) flush(); current.push(p); }
  flush(); return paths.join(" ");
}
export function buildChartModel(series: MarketSeries, options: ChartSettings, proposed?: Partial<ViewWindow>, comparison?: MarketSeries | null, width = 960, height = 320): ChartModel | null {
  const rows = chartRows(series,options.session); if (rows.length < 2) return null;
  const window = clampWindow(rows.length,proposed), visible = rows.slice(window.start,window.end+1);
  if (visible.length < 2) return null;
  const matched = comparison && options.compareSymbol === comparison.symbol && comparison.range === series.range ? chartRows(comparison,options.session) : [];
  const compareByTime = new Map(matched.map(b => [b.at,b.close]));
  const common = visible.filter(b => compareByTime.has(b.at));
  const comparing = common.length >= 2;
  const scale = comparing ? "percent" : options.scale;
  const base = comparing ? common[0].close : visible[0].close;
  const compareBase = comparing ? compareByTime.get(common[0].at)! : null;
  const transform = (v: number) => scale === "percent" ? (v/base-1)*100 : scale === "log" ? Math.log(v) : v;
  const indicator = (v: number | null) => v === null || (scale === "log" && v <= 0) ? null : transform(v);
  const domain: number[] = [];
  for (const b of visible) {
    domain.push(transform(b.close));
    if (options.mode === "candles") domain.push(transform(b.high),transform(b.low));
    if (options.sma20 && b.sma20 !== null) domain.push(transform(b.sma20));
    if (options.sma50 && b.sma50 !== null) domain.push(transform(b.sma50));
    if (options.ema20 && b.ema20 !== null) domain.push(transform(b.ema20));
    if (options.bands20) for (const v of [b.bandLow,b.bandHigh]) { const n=indicator(v); if(n!==null)domain.push(n); }
    if (comparing && b.at >= common[0].at && compareByTime.has(b.at)) domain.push((compareByTime.get(b.at)!/compareBase!-1)*100);
  }
  if (options.referencePrice !== null) domain.push(transform(options.referencePrice));
  const lo=Math.min(...domain),hi=Math.max(...domain),pad=Math.max((hi-lo)*.12,scale==="log"?.002:scale==="percent"?.05:Math.max(Math.abs(hi)*.001,.0001));
  const min=lo-pad,max=hi+pad,top=18,bottom=height-22,left=12,right=width-14;
  const yValue=(n:number)=>top+(max-n)/(max-min)*(bottom-top), y=(price:number)=>yValue(transform(price));
  const mapIndicator=(v:number|null)=>{const n=indicator(v);return n===null?null:yValue(n);};
  const points: ChartPoint[] = visible.map((b,i)=>{
    const compareClose=comparing&&b.at>=common[0].at?compareByTime.get(b.at)??null:null;
    return {...b,x:left+i/(visible.length-1)*(right-left),openY:y(b.open),highY:y(b.high),lowY:y(b.low),closeY:y(b.close),
      sma20Y:mapIndicator(b.sma20),sma50Y:mapIndicator(b.sma50),ema20Y:mapIndicator(b.ema20),bandLowY:mapIndicator(b.bandLow),bandHighY:mapIndicator(b.bandHigh),compareClose,
      compareY:compareClose===null?null:yValue((compareClose/compareBase!-1)*100)};
  });
  const ticks=Array.from({length:5},(_,i)=>{const v=max-(max-min)*i/4;return {y:yValue(v),value:scale==="log"?Math.exp(v):v};});
  const first=visible[0],last=visible[visible.length-1];
  return {rows,points,window,scale,y,ticks,min,max,width,height,base,comparisonSymbol:comparing?options.compareSymbol:null,comparisonCount:comparing?common.length:0,comparisonBaseAt:comparing?common[0].at:null,
    gapCount:visible.slice(1).filter(b=>b.gapBefore).length,first,last,changePct:(last.close/first.close-1)*100,totalVolume:visible.reduce((sum,b)=>sum+b.volume,0),low:Math.min(...visible.map(b=>b.low)),high:Math.max(...visible.map(b=>b.high)),
    closePath:pathFor(points,"closeY"),areaPath:areasFor(points,bottom),comparisonPath:pathFor(points,"compareY"),
    overlayPaths:{sma20:pathFor(points,"sma20Y"),sma50:pathFor(points,"sma50Y"),ema20:pathFor(points,"ema20Y"),bandLow:pathFor(points,"bandLowY"),bandHigh:pathFor(points,"bandHighY")}};
}
export function nearestObservation(points: Array<{x:number}>, fraction: number, width=960): number {
  if (points.length<2) return 0;
  const x=Math.max(0,Math.min(width,fraction*width));
  let lo=0,hi=points.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(points[mid].x<x)lo=mid+1;else hi=mid;}
  return lo>0&&Math.abs(points[lo-1].x-x)<Math.abs(points[lo].x-x)?lo-1:lo;
}
function csvCell(value: string | number | null) {
  if(value===null) return "";
  let v=String(value);if(typeof value==="string"&&/^[=+@\-\t\r]/.test(v))v="'"+v;
  return `"${v.replace(/"/g,'""')}"`;
}
export function chartCsv(series: MarketSeries, model: ChartModel): string {
  const columns=["symbol","observation_at","open","high","low","close","volume","sma20","sma50","ema20","band_low_20_2sd","band_high_20_2sd","comparison_symbol","comparison_close","endpoint","basis"];
  const rows=model.points.map(b=>[series.symbol,b.at,b.open,b.high,b.low,b.close,b.volume,b.sma20,b.sma50,b.ema20,b.bandLow,b.bandHigh,model.comparisonSymbol,b.compareClose,series.endpoint,series.basis].map(csvCell).join(","));
  return [columns.join(","),...rows].join("\r\n")+"\r\n";
}
