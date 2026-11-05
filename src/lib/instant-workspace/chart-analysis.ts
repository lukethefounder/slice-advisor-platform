import type { MarketSeries } from "@/lib/market-evidence/contracts";
import type { ChartSettings } from "@/lib/market-evidence/chart-settings";
import { chartRows } from "@/lib/market-evidence/chart-model";
export type AnalysisPoint = { at: string; gap: boolean; returnPct: number; drawdownPct: number; rsi: number | null };
export function analyzeLoadedSeries(series: MarketSeries, session: ChartSettings["session"] = "all") {
  const rows = chartRows(series, session); if (rows.length < 2) return null;
  const first = rows[0], last = rows[rows.length - 1];
  let peak = first.close, worst = 0, run: number[] = [], volume = 0, high = first.high, low = first.low;
  const logReturns: number[] = [];
  const points: AnalysisPoint[] = rows.map((r, index) => {
    if (r.gapBefore) run = [];
    if (index && !r.gapBefore) logReturns.push(Math.log(r.close / rows[index-1].close));
    run.push(r.close); peak = Math.max(peak, r.close);
    const drawdownPct = (r.close / peak - 1) * 100; worst = Math.min(worst, drawdownPct);
    volume += r.volume ?? 0; high = Math.max(high, r.high); low = Math.min(low, r.low);
    let rsi: number | null = null;
    if (run.length >= 15) {
      let up = 0, down = 0;
      for (let i = run.length - 14; i < run.length; i++) { const delta = run[i] - run[i-1]; up += Math.max(0, delta); down += Math.max(0, -delta); }
      rsi = up === 0 && down === 0 ? 50 : down === 0 ? 100 : 100 - 100 / (1 + up / down);
    }
    return { at: r.at, gap: r.gapBefore, returnPct: (r.close / first.close - 1) * 100, drawdownPct, rsi };
  });
  const mean = logReturns.length ? logReturns.reduce((a,b) => a+b,0) / logReturns.length : 0;
  const sampleVol = logReturns.length > 1 ? Math.sqrt(logReturns.reduce((n,v) => n+(v-mean)**2,0)/(logReturns.length-1))*100 : null;
  const vol = sampleVol === null ? null : sampleVol * (series.range === "1D" ? 1 : Math.sqrt(252));
  return { points, count: rows.length, firstAt: first.at, lastAt: last.at, lastClose: last.close, high, low, position: high === low ? 50 : (last.close - low)/(high-low)*100, volume: rows.every(r=>r.volume!==null)?volume:null,
    changePct: points.at(-1)!.returnPct, drawdownPct: worst, rsi14: points.at(-1)!.rsi, volatilityPct: vol,
    volatilityLabel: series.range === "1D" ? "Per-bar log volatility" : "Annualized sample volatility",
    distanceSma20Pct: last.sma20 === null ? null : (last.close/last.sma20-1)*100, gaps: rows.filter(r => r.gapBefore).length,
  };
}
export function miniPath(points: AnalysisPoint[], key: "returnPct" | "drawdownPct" | "rsi", width = 360, height = 64) {
  const values = points.flatMap(p => p[key] === null ? [] : [p[key] as number]); if (!values.length) return "";
  const low = key === "rsi" ? 0 : Math.min(0, ...values), high = key === "rsi" ? 100 : Math.max(0, ...values), spread = Math.max(high-low, .0001);
  let drawing = false;
  return points.map((p,i) => { const value = p[key]; if (value === null) { drawing=false; return ""; } if(p.gap)drawing=false; const s = `${drawing ? "L" : "M"}${(6+i/Math.max(1,points.length-1)*(width-12)).toFixed(2)},${(height-6-(value-low)/spread*(height-12)).toFixed(2)}`; drawing=true;return s; }).join(" ");
}
