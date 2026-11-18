"use client";
import { memo, useId, useMemo, useState } from "react";
import type { BacktestResult } from "@/lib/strategy-lab/contracts";
import { samplePoints } from "@/lib/scenario-decision/core";
import { money, pct } from "@/lib/scenario-decision/client";
import css from "./decision.module.css";
function path(values:Array<number|null>,low:number,high:number,width:number,height:number){let started=false;return values.map((v,i)=>{if(v===null||!Number.isFinite(v)){started=false;return "";}const p=`${started?"L":"M"}${(48+i/Math.max(1,values.length-1)*(width-64)).toFixed(2)},${(18+(high-v)/Math.max(high-low,1e-8)*(height-48)).toFixed(2)}`;started=true;return p;}).join(" ");}
export default memo(function PerformanceCharts({result,compact=false}:{result:BacktestResult;compact?:boolean}){
 const [index,setIndex]=useState(-1),id=useId().replace(/:/g,"");
 const model=useMemo(()=>{const rows=samplePoints(result.equity,900),benchmark=new Map(result.benchmarkEquity.map(p=>[p.date,p.equity]));const b=rows.map(p=>benchmark.get(p.date)??null),values=[...rows.map(r=>r.equity),...b.filter((v):v is number=>v!==null)];let low=Math.min(...values),high=Math.max(...values);const pad=Math.max((high-low)*.12,Math.abs(high)*.005,1);low-=pad;high+=pad;return {rows,b,low,high,price:path(rows.map(p=>p.equity),low,high,900,280),benchmark:path(b,low,high,900,280),drawdown:path(rows.map(p=>p.drawdownPct),Math.min(-.01,...rows.map(p=>p.drawdownPct)),0,900,120)};},[result]);
 const selected=model.rows[Math.min(model.rows.length-1,index<0?model.rows.length-1:index)];
 if(!model.rows.length)return <p className={css.empty}>No accepted observations are attached to this result.</p>;
 return <div className={css.chartGroup}>
  <div className={css.chartHeading}><div><span className={css.eyebrow}>Recorded simulation</span><h3>Strategy against {result.spec.benchmark}</h3></div><div className={css.legend}><span><i className={css.greenDot}/>Strategy</span><span><i className={css.blueDot}/>Benchmark</span></div></div>
  <svg className={css.equitySvg} viewBox="0 0 900 280" role="img" aria-label={`Hypothetical equity from ${result.effectiveStart} to ${result.effectiveEnd}. Strategy ${pct(result.strategy.totalReturnPct)}, benchmark ${pct(result.benchmark.totalReturnPct)}.`}>
   <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".22"/><stop offset="1" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
   {[0,1,2,3].map(n=><g key={n}><line x1="48" x2="884" y1={18+n*77.3} y2={18+n*77.3} className={css.gridLine}/><text x="42" y={22+n*77.3} textAnchor="end" className={css.axisText}>{Math.round((model.high-(model.high-model.low)*n/3)/1000)}k</text></g>)}
   <path d={`${model.price} L884,250 L48,250 Z`} fill={`url(#${id})`}/><path d={model.benchmark} className={css.benchmarkLine}/><path d={model.price} className={css.strategyLine}/>
   <text x="48" y="275" className={css.axisText}>{model.rows[0].date}</text><text x="884" y="275" textAnchor="end" className={css.axisText}>{model.rows.at(-1)!.date}</text>
   {selected&&<circle cx={48+Math.min(index<0?model.rows.length-1:index,model.rows.length-1)/Math.max(1,model.rows.length-1)*836} cy={18+(model.high-selected.equity)/(model.high-model.low)*232} r="5" className={css.lastPoint}/>}
  </svg>
  {!compact&&<label className={css.sliderLabel}>Inspect an observation<input aria-label="Inspect strategy equity observation" type="range" min={0} max={model.rows.length-1} value={index<0?model.rows.length-1:Math.min(index,model.rows.length-1)} onChange={e=>setIndex(Number(e.target.value))}/><span>{selected?.date} · {money(selected?.equity)} · {pct(selected?.drawdownPct)} drawdown</span></label>}
  <div className={css.chartHeading}><h3>Closing drawdown</h3><span className={css.muted}>From the running equity peak</span></div>
  <svg viewBox="0 0 900 120" className={css.drawdownSvg} role="img" aria-label={`Maximum strategy drawdown ${pct(result.strategy.maxDrawdownPct)}`}><line x1="48" x2="884" y1="18" y2="18" className={css.gridLine}/><path d={model.drawdown} className={css.drawdownLine}/><text x="42" y="22" textAnchor="end" className={css.axisText}>0%</text><text x="42" y="94" textAnchor="end" className={css.axisText}>{result.strategy.maxDrawdownPct.toFixed(1)}%</text></svg>
  <p className={css.caption}>USD equity. Values are hypothetical; chart ends at the last recorded session. {result.equity.length>900?"Display sampled to 900 points; original results and exports are unchanged.":"No future observations are plotted."}</p>
  {!compact&&<div className={css.split}><section><h3>Latest recorded allocation</h3><div className={css.allocations}>{[...Object.entries(result.equity.at(-1)?.weights??{}),["Cash",result.equity.at(-1)?.equity?(result.equity.at(-1)!.cash/result.equity.at(-1)!.equity)*100:0] as [string,number]].map(([s,w])=><div key={s}><span>{s}</span><meter min={0} max={100} value={Math.min(100,Math.max(0,w))} aria-label={`${s} allocation ${w.toFixed(2)} percent`}/><b>{pct(w)}</b></div>)}</div></section><section><h3>Periodic returns</h3><div className={css.months}>{result.monthly.slice(-12).map(m=><div key={m.month} data-tone={m.strategyPct>=0?"positive":"negative"}><small>{m.month}</small><strong>{pct(m.strategyPct)}</strong><span>{pct(m.benchmarkPct)} benchmark</span></div>)}</div><p className={css.caption}>Latest 12 months shown. The full series is retained in the saved result.</p></section></div>}
 </div>;
});
