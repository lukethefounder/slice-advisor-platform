"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, RefreshCw, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { HORIZONS, type CanonicalBundle, type CanonicalHorizon } from "@/lib/intelligence-unified/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import css from "./knowledge-graph-focus.module.css";

function number(value:number|null|undefined,digits=1) { return typeof value==="number"&&Number.isFinite(value)?value.toLocaleString("en-US",{maximumFractionDigits:digits}):"—"; }
function date(value:string|null|undefined) { return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():"Unavailable"; }

/** Reads only the canonical forecast attached to the graph currently displayed. */
export default function KnowledgeGraphOutcomes({symbol,runId}:{symbol:string;runId:string|null}) {
  return <PinnedOutcomes key={`${symbol}:${runId??"none"}`} symbol={symbol} runId={runId}/>;
}

function PinnedOutcomes({symbol,runId}:{symbol:string;runId:string|null}) {
  const [bundle,setBundle]=useState<CanonicalBundle|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(runId));
  const [horizon,setHorizon]=useState<CanonicalHorizon>("2-5d");
  useEffect(()=>{
    if(!runId)return;
    const controller=new AbortController();let current=true;
    const params=new URLSearchParams({symbol,researchRunId:runId});
    void intelligenceFetch<{bundle:CanonicalBundle|null}>(`/api/intelligence/canonical?${params}`,{signal:controller.signal},{timeoutMs:18000,retries:0})
      .then(response=>{if(current){const next=response.bundle;setBundle(next?.symbol===symbol&&next.researchRunId===runId?next:null);}})
      .catch(caught=>{if(current&&!isAbortError(caught))setError(caught instanceof Error?caught.message:"The matching forecast could not be loaded.");})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;controller.abort();};
  },[symbol,runId]);
  const current=bundle?.symbol===symbol&&bundle.researchRunId===runId?bundle:null;
  const metric=current?.forecast.horizons.find(row=>row.horizon===horizon);
  const probability=metric&&Number.isFinite(metric.positiveReturnProbability)&&metric.positiveReturnProbability>=0&&metric.positiveReturnProbability<=100?metric.positiveReturnProbability:null;
  const forecastHref=`/workspace/intelligence/forecast-lab?${new URLSearchParams({symbol,...(runId?{researchRunId:runId}:{}),forecastHorizon:horizon})}`;
  return <section className={css.section} aria-label="Outcomes supported by this research run">
    <div className={css.sectionHead}><div><p className={css.eyebrow}><Target size={13}/>What this graph suggests</p><h2>Probabilities, with the evidence attached.</h2><p>Model estimates for the exact research run above. The selected horizon defines the outcome being estimated.</p></div><Link className={css.secondary} href={forecastHref} prefetch={false}>Forecast lab<ArrowUpRight size={14}/></Link></div>
    {loading?<p className={css.fine} role="status"><RefreshCw size={13} className={css.loading}/> Loading the matching forecast…</p>:error?<p className={`${css.notice} ${css.error}`} role="alert">{error}</p>:current&&metric&&probability!==null?<>
      <div className={css.horizons} role="group" aria-label="Forecast time horizon">{HORIZONS.map(value=><button type="button" key={value} className={`${css.horizon} ${value===horizon?css.selected:""}`} aria-pressed={value===horizon} onClick={()=>setHorizon(value)}>{value}</button>)}</div>
      <div className={css.forecastGrid}><div><p className={css.probabilityLabel}>{symbol} · {metric.label}</p><div className={css.probability}>{number(probability)}<span style={{fontSize:".55em"}}>%</span></div><p className={css.probabilityLabel}>Estimated likelihood of a positive return</p><div className={css.probabilityBar} role="img" aria-label={`${number(probability)} percent positive return; ${number(100-probability)} percent zero or negative return`}><span style={{width:`${probability}%`}}/></div><div className={css.probabilityLegend}><span>Above 0% return · {number(probability)}%</span><span>At or below 0% · {number(100-probability)}%</span></div><p className={css.fine}>These two outcomes sum to 100%. Sentiment and model confidence are separate measures.</p></div>
        <div className={css.forecastStats}><div className={css.forecastStat}><span>Expected return</span><strong>{number(metric.expectedReturnPercent,2)}%</strong><small>{horizon} horizon</small></div><div className={css.forecastStat}><span>Expected price</span><strong>{number(metric.expectedPrice,2)}</strong><small>{current.market.currency}</small></div><div className={css.forecastStat}><span>Stored price range</span><strong>{number(metric.expectedPriceRange.low,2)}–{number(metric.expectedPriceRange.high,2)}</strong><small>Model range · {current.market.currency}</small></div><div className={css.forecastStat}><span>Model confidence score</span><strong>{number(metric.confidence,0)} / 100</strong><small>{metric.dataQuality} data quality</small></div></div></div>
      <p className={css.uncertainty}><strong>What could change the outcome</strong><br/>{metric.primaryUncertainty||"New information and changing market conditions can invalidate this estimate."}</p>
      <div className={css.pills} style={{marginTop:14}}><span className={css.pill}><Clock3 size={11}/>Provider observation: {date(current.score.providerAsOf)}</span><span className={css.pill}>Target: {date(current.targets[horizon])}</span><span className={css.pill}>Model estimate</span></div>
      <details className={css.details}><summary>Model, contribution trail, and limitations</summary><div className={css.detailBody}><p>Model: {current.forecast.modelVersion} · Calibration version: {current.forecast.calibrationVersion}</p><p>Research run: {current.researchRunId}<br/>Forecast run: {current.forecastRunId}</p><p>The stored range does not imply a verified coverage percentage. Probability reliability must be assessed against settled outcomes.</p><ul>{metric.contributions.slice().sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,5).map(row=><li key={row.factor}><strong>{row.factor}:</strong> {row.explanation}</li>)}</ul>{current.forecast.limitations.slice(0,5).map((text,index)=><p key={index}>{text}</p>)}</div></details>
    </>:<p className={css.notice}>{runId?"No matching published forecast is available for this graph. The evidence remains inspectable; no likelihood is inferred from the sentiment score.":"Build a research graph to attach a matching forecast and its source trail."}</p>}
  </section>;
}
