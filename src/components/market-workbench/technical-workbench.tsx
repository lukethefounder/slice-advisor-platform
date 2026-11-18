"use client";
import {memo,useMemo} from "react";
import type {MarketSeries} from "@/lib/market-evidence/contracts";
import type {ChartSettings} from "@/lib/market-evidence/chart-settings";
import {chartRows} from "@/lib/market-evidence/chart-model";
import {technicalWorkbench} from "@/lib/market-workbench/technicals";
import css from "./workbench.module.css";
const fmt=(v:number|null)=>v===null?"Not enough data":v.toLocaleString(undefined,{maximumFractionDigits:3});
function TechnicalWorkbench({series,session}:{series:MarketSeries;session:ChartSettings["session"]}){
 const view=useMemo(()=>technicalWorkbench(chartRows(series,session),series.range==="1D"),[series,session]),tail=view.macd.slice(-100),values=tail.flatMap(p=>[p.line,p.signal,p.histogram]),extent=Math.max(0.001,...values.map(Math.abs)),y=(n:number)=>95-n/extent*76,x=(i:number)=>35+i*710/Math.max(1,tail.length-1),line=(key:"line"|"signal")=>tail.map((p,i)=>`${i?"L":"M"}${x(i)},${y(p[key])}`).join(" ");
 return <section className={css.root} aria-label="Expanded technical analysis"><header><div><small>TECHNICAL WORKBENCH / LOADED EVIDENCE</small><h2>{view.trend}</h2><p>{series.symbol} · {view.barsUsed} loaded bars used · {series.observedAt}</p></div><span>{series.range==="1D"?"5-minute periods":"Daily periods"}</span></header><div className={css.metrics}>{view.metrics.map(m=><article key={m.label}><small>{m.label}</small><strong>{fmt(m.value)}<em>{m.value===null?"":m.suffix}</em></strong><p>{m.detail}</p></article>)}</div>
 <div className={css.chart}><div><h3>Momentum detail</h3><p>MACD <b>12/26</b> · signal <b>9</b> · histogram around zero</p></div>{tail.length>1?<svg viewBox="0 0 780 210" role="img" aria-label="MACD spread, signal and histogram for the last loaded observations"><line x1="30" x2="752" y1="95" y2="95" stroke="currentColor" opacity=".2"/>{tail.map((p,i)=><rect key={p.at} x={x(i)-2} y={Math.min(95,y(p.histogram))} width={Math.max(2,500/tail.length)} height={Math.max(.5,Math.abs(95-y(p.histogram)))} fill={p.histogram>=0?"#38b493":"#b77a9d"} opacity=".6"/>)}<path d={line("line")} fill="none" stroke="#12947c" strokeWidth="2.5"/><path d={line("signal")} fill="none" stroke="#9580d0" strokeWidth="2"/><text x="32" y="200" fontSize="10" fill="currentColor">{tail[0].at.slice(0,16)}</text><text x="748" y="200" textAnchor="end" fontSize="10" fill="currentColor">{tail.at(-1)?.at.slice(0,16)}</text></svg>:<p>At least 34 contiguous closing observations are needed to display MACD and its signal.</p>}</div>
 <details><summary>Calculation notes and limitations</summary>{view.warnings.map(t=><p key={t}>{t}</p>)}<p>Indicators here use the full loaded, session-filtered history, not the chart zoom window. Wilder RSI is deliberately named separately from the existing simple-window RSI. Values are not sent back into saved forecasts or strategy results.</p></details></section>;
}
export default memo(TechnicalWorkbench);
