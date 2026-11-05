"use client";
import { useMemo } from "react";
import type { MarketSeries } from "@/lib/market-evidence/contracts";
import type { ChartSettings } from "@/lib/market-evidence/chart-settings";
import { analyzeLoadedSeries, miniPath } from "@/lib/instant-workspace/chart-analysis";
import { observationLabel, priceText } from "@/lib/market-evidence/chart-model";
import css from "./surface.module.css";
const pct = (v: number | null) => v === null ? "Not enough history" : `${v > 0 ? "+" : ""}${priceText(v, 2)}%`;
export default function ChartInsights({ series, session }: { series: MarketSeries; session: ChartSettings["session"] }) {
  const a = useMemo(() => { try { return analyzeLoadedSeries(series, session); } catch { return null; } }, [series,session]);
  if (!a) return null;
  return <section className={css.insights} aria-label="Historical research detail">
    <div className={css.heading}><div><span>OBSERVED STRUCTURE</span><h3>Beyond the price line.</h3></div><small>{a.count} bars · {observationLabel(a.firstAt)} — {observationLabel(a.lastAt)}</small></div>
    <div className={css.tracks}>
      {([ ["returnPct", "Raw-price change", pct(a.changePct)], ["drawdownPct", "Worst closing drawdown", pct(a.drawdownPct)], ["rsi", "Simple-window RSI · 14", a.rsi14 === null ? "Warming up" : priceText(a.rsi14,1)] ] as const).map(([key,label,value]) => <article key={key} className={css.track} data-kind={key}><small>{label}</small><strong>{value}</strong><svg viewBox="0 0 360 64" role="img" aria-label={`${label} over loaded observations`}><path d="M6 58H354" className={css.axis}/><path d={miniPath(a.points,key)} className={css.spark}/></svg></article>)}
    </div>
    <div className={css.rangeLine}><span>Loaded low <b>{priceText(a.low)}</b></span><div role="meter" aria-label="Latest close within loaded high-low range" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.position)}><i style={{ left: `${Math.min(100,Math.max(0,a.position))}%` }}/></div><span>Loaded high <b>{priceText(a.high)}</b></span></div>
    <div className={css.statRow}><span>{a.volatilityLabel}<b>{a.volatilityPct === null ? "—" : `${priceText(a.volatilityPct,2)}%`}</b></span><span>Distance from SMA 20<b>{pct(a.distanceSma20Pct)}</b></span><span>Loaded volume<b>{new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:2}).format(a.volume)}</b></span><span>Intraday gaps<b>{a.gaps}</b></span></div>
    <p className={css.note}>Calculated from the full loaded range, not just the zoom window. Raw prices are not adjusted total returns; splits can affect these statistics. RSI uses simple windows, not Wilder smoothing. Daily volatility assumes 252 sessions; intraday volatility is per five-minute bar. These are historical descriptions, not forecasts or calibrated probabilities.</p>
  </section>;
}
