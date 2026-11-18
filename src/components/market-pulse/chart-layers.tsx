"use client";
import { memo } from "react";
import type { ChartModel } from "@/lib/market-evidence/chart-model";
import type { ChartSettings } from "@/lib/market-evidence/chart-settings";
import css from "./chart-pro.module.css";
export const StaticPriceLayer = memo(function StaticPriceLayer({ model, options, id }: { model: ChartModel; options: ChartSettings; id: string }) {
  const comparing = Boolean(model.comparisonCount);
  return <g data-slice-chart-layer="price">
    <defs><linearGradient id={`${id}-gradient`} x1="0" x2="0.9" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-line)" stopOpacity=".28"/><stop offset="58%" stopColor="#20b8d5" stopOpacity=".11"/><stop offset="100%" stopColor="#8e62e8" stopOpacity=".02"/></linearGradient><clipPath id={`${id}-clip`}><rect x="0" y="0" width={model.width} height={model.height}/></clipPath></defs>
    {options.showGrid && model.ticks.map((tick,index) => <line key={index} x1="0" x2={model.width} y1={tick.y} y2={tick.y} className={css.grid}/>)}
    <g clipPath={`url(#${id}-clip)`}>
      {options.mode === "area" && <path d={model.areaPath} fill={`url(#${id}-gradient)`}/>}
      {options.mode !== "candles" ? <path d={model.closePath} fill="none" className={css.priceLine} vectorEffect="non-scaling-stroke"/> : <g data-testid="candlesticks">{model.points.map(point => {
        const width = Math.max(1.5, Math.min(14, (model.width - 26) / model.points.length * .63));
        return <g key={point.at} className={point.close >= point.open ? css.candleUp : css.candleDown}><line x1={point.x} x2={point.x} y1={point.highY} y2={point.lowY} vectorEffect="non-scaling-stroke"/><rect x={point.x - width / 2} y={Math.min(point.openY,point.closeY)} width={width} height={Math.max(.7,Math.abs(point.openY-point.closeY))}/></g>;
      })}</g>}
      {options.bands20 && <g className={css.band}>{(["bandLow","bandHigh"] as const).map(key => <path key={key} d={model.overlayPaths[key]} fill="none" vectorEffect="non-scaling-stroke"/>)}</g>}
      {([["sma20","var(--chart-sma)"],["sma50","var(--chart-sma50)"],["ema20","var(--chart-ema)"]] as const).map(([key,color]) => options[key] && <path key={key} d={model.overlayPaths[key]} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>)}
      {comparing && <path d={model.comparisonPath} fill="none" className={css.compareLine} vectorEffect="non-scaling-stroke"/>}
      {options.referencePrice !== null && <line x1="0" x2={model.width} y1={model.y(options.referencePrice)} y2={model.y(options.referencePrice)} className={css.reference} vectorEffect="non-scaling-stroke"/>}
    </g>
  </g>;
});
export const StaticVolumeLayer = memo(function StaticVolumeLayer({ model, maxVolume }: { model: ChartModel; maxVolume: number }) {
  const width = Math.max(1,Math.min(16,920/model.points.length));
  return <g data-slice-chart-layer="volume">{model.points.filter(p => p.volume !== null).map(p => <rect key={p.at} x={p.x - Math.min(16,920/model.points.length)/2} y={60-(p.volume??0)/maxVolume*58} width={width} height={(p.volume??0)/maxVolume*58} fill={p.close>=p.open?"var(--chart-line)":"var(--chart-negative)"} opacity=".35"/>)}</g>;
});
