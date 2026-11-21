"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, RefreshCw, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { HORIZONS, type CanonicalBundle, type CanonicalHorizon, type ResearchOnlyBundle } from "@/lib/intelligence-unified/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { interpretCanonicalScore, interpretResearchOnlyScore, interpretResearchScore } from "@/lib/intelligence/score-interpretation";
import type { ResearchSwarmResponse, SliceAgenticScore } from "@/lib/intelligence/research-swarm-types";
import KnowledgeGraphScoring from "./knowledge-graph-scoring";
import ScoreDecisionPanel, { ResearchReadinessPanel, ScoreBandGuide } from "./score-decision-panel";
import css from "./knowledge-graph-focus.module.css";

function number(value:number|null|undefined,digits=1) { return typeof value==="number"&&Number.isFinite(value)?value.toLocaleString("en-US",{maximumFractionDigits:digits}):"—"; }
function date(value:string|null|undefined) { return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():"Unavailable"; }

/** Reads only the canonical forecast attached to the graph currently displayed. */
type OutcomeProps = {symbol:string;runId:string|null;score?:SliceAgenticScore;market?:ResearchSwarmResponse["market"];currentResearch?:ResearchSwarmResponse["currentResearch"]};
export default function KnowledgeGraphOutcomes(props:OutcomeProps) {
  return <PinnedOutcomes key={`${props.symbol}:${props.runId??"none"}`} {...props}/>;
}

function PinnedOutcomes({symbol,runId,score,market,currentResearch}:OutcomeProps) {
  const [bundle,setBundle]=useState<CanonicalBundle|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(runId));
  const [researchOnly,setResearchOnly]=useState<ResearchOnlyBundle|null>(null);
  const [horizon,setHorizon]=useState<CanonicalHorizon>("2-5d");
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const restore=()=>{
      const value=new URLSearchParams(window.location.search).get("forecastHorizon");
      setHorizon(HORIZONS.includes(value as CanonicalHorizon)?value as CanonicalHorizon:"2-5d");
    };
    restore();window.addEventListener("popstate",restore);
    return()=>window.removeEventListener("popstate",restore);
  },[]);
  useEffect(()=>{
    const tick=()=>{if(document.visibilityState==="visible")setNow(Date.now());};
    const timer=window.setInterval(tick,60000);document.addEventListener("visibilitychange",tick);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",tick);};
  },[]);
  useEffect(()=>{
    if(!runId)return;
    const controller=new AbortController();let current=true;
    const params=new URLSearchParams({symbol,researchRunId:runId});
    void intelligenceFetch<{bundle:CanonicalBundle|null;researchOnly:ResearchOnlyBundle|null}>(`/api/intelligence/canonical?${params}`,{signal:controller.signal},{timeoutMs:18000,retries:0})
      .then(response=>{
        if(!current)return;
        const next=response.bundle??response.researchOnly;
        if(response.bundle&&response.researchOnly)throw new Error("The saved research returned conflicting publication states.");
        if(next&&(next.symbol!==symbol||next.researchRunId!==runId))throw new Error("The saved research does not match the displayed graph.");
        setBundle(response.bundle??null);setResearchOnly(response.researchOnly??null);
      })
      .catch(caught=>{if(current&&!isAbortError(caught))setError(caught instanceof Error?caught.message:"The matching forecast could not be loaded.");})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;controller.abort();};
  },[symbol,runId]);
  const current=bundle?.symbol===symbol&&bundle.researchRunId===runId?bundle:null;
  const currentOnly=researchOnly?.symbol===symbol&&researchOnly.researchRunId===runId?researchOnly:null;
  const report=current?.currentResearch??currentOnly?.currentResearch??(currentResearch?.symbol===symbol?currentResearch:undefined);
  const metric=current?.forecast.horizons.find(row=>row.horizon===horizon);
  const probability=metric&&Number.isFinite(metric.positiveReturnProbability)&&metric.positiveReturnProbability>=0&&metric.positiveReturnProbability<=100?metric.positiveReturnProbability:null;
  const analysis=current?interpretCanonicalScore(current,horizon,now):currentOnly?interpretResearchOnlyScore(currentOnly,horizon,now):score?interpretResearchScore({symbol,score,market,horizon,currentResearch:report,nowMs:now}):null;
  const currentEstimate=analysis?.gain.status==="current-model";
  const forecastHref=`/workspace/intelligence/forecast-lab?${new URLSearchParams({symbol,...(runId?{researchRunId:runId}:{}),forecastHorizon:horizon})}`;
  function chooseHorizon(value:CanonicalHorizon) {
    setHorizon(value);
    const url=new URL(window.location.href);
    url.searchParams.set("symbol",symbol);url.searchParams.set("forecastHorizon",value);
    if(runId){url.searchParams.set("runId",runId);url.searchParams.set("researchRunId",runId);}
    window.history.replaceState(window.history.state,"",`${url.pathname}${url.search}${url.hash}`);
  }
  return <section className={css.section} aria-label="Outcomes supported by this research run">
    <div className={css.sectionHead}><div><p className={css.eyebrow}><Target size={13}/>What this graph supports</p><h2>Research readiness and modeled outcomes.</h2><p>The explanation uses the exact research run above. Inspect current evidence, dated context, and source coverage before reviewing any published forecast.</p></div><Link className={css.secondary} href={forecastHref} prefetch={false}>Forecast lab<ArrowUpRight size={14}/></Link></div>
    {current&&<div className={css.horizons} role="group" aria-label="Forecast time horizon">{HORIZONS.map(value=><button type="button" key={value} className={`${css.horizon} ${value===horizon?css.selected:""}`} aria-pressed={value===horizon} onClick={()=>chooseHorizon(value)}>{value}</button>)}</div>}
    {analysis&&<ScoreDecisionPanel analysis={analysis} sourcesHref="#research-sources"/>}
    {!analysis&&report&&<ResearchReadinessPanel report={report}/>}
    {loading?<p className={css.fine} role="status"><RefreshCw size={13} className={css.loading}/> Loading the matching forecast…</p>:error?<p className={`${css.notice} ${css.error}`} role="alert">{error}</p>:current&&metric&&probability!==null?<>
      <details className={css.details}><summary>{currentEstimate?"Inspect the selected forecast and price range":"Inspect archived forecast values · current likelihood withheld"}</summary><div className={css.detailBody}>
      <div className={css.forecastGrid}><div><p className={css.probabilityLabel}>{symbol} · {metric.label}{!currentEstimate?" · archived estimate":""}</p><div className={css.probability}>{number(probability)}<span style={{fontSize:".55em"}}>%</span></div><p className={css.probabilityLabel}>{currentEstimate?"Modeled likelihood of a price gain before costs":"Recorded likelihood at this run’s original timestamp"}</p><div className={css.probabilityBar} role="img" aria-label={`${number(probability)} percent price gain; ${number(100-probability)} percent flat or lower price`}><span style={{width:`${probability}%`}}/></div><div className={css.probabilityLegend}><span>Price gain · {number(probability)}%</span><span>Flat or lower · {number(100-probability)}%</span></div><p className={css.fine}>These two modeled outcomes sum to 100%. Costs and taxes are excluded; sentiment and model confidence are separate measures.</p></div>
        <div className={css.forecastStats}><div className={css.forecastStat}><span>Expected return</span><strong>{number(metric.expectedReturnPercent,2)}%</strong><small>{horizon} horizon</small></div><div className={css.forecastStat}><span>Expected price</span><strong>{number(metric.expectedPrice,2)}</strong><small>{current.market.currency}</small></div><div className={css.forecastStat}><span>Stored price range</span><strong>{number(metric.expectedPriceRange.low,2)}–{number(metric.expectedPriceRange.high,2)}</strong><small>Model range · {current.market.currency}</small></div><div className={css.forecastStat}><span>Model confidence score</span><strong>{number(metric.confidence,0)} / 100</strong><small>{metric.dataQuality} data quality</small></div></div></div>
      <p className={css.uncertainty}><strong>What could change the outcome</strong><br/>{metric.primaryUncertainty||"New information and changing market conditions can invalidate this estimate."}</p>
      <div className={css.pills} style={{marginTop:14}}><span className={css.pill}><Clock3 size={11}/>Provider observation: {date(current.score.providerAsOf)}</span><span className={css.pill}>Target: {date(current.targets[horizon])}</span><span className={css.pill}>Model estimate</span></div>
      </div></details>
      <details className={css.details}><summary>Model, contribution trail, and limitations</summary><div className={css.detailBody}><p>Model: {current.forecast.modelVersion} · Calibration version: {current.forecast.calibrationVersion}</p><p>Research run: {current.researchRunId}<br/>Forecast run: {current.forecastRunId}</p><p>The stored range does not imply a verified coverage percentage. Probability reliability must be assessed against settled outcomes.</p><ul>{metric.contributions.slice().sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,5).map(row=><li key={row.factor}><strong>{row.factor}:</strong> {row.explanation}</li>)}</ul>{current.forecast.limitations.slice(0,5).map((text,index)=><p key={index}>{text}</p>)}</div></details>
    </>:<p className={css.notice}>{currentOnly?"This research run and its source trail were saved without a forecast. Review the readiness gaps and use Build research graph above to collect new evidence.":runId?"No matching published forecast is available for this graph. The evidence remains inspectable; no likelihood is inferred from the sentiment score.":"Build a research graph to collect current evidence and inspect its source trail."}</p>}
    {!analysis&&!loading&&<ScoreBandGuide/>}
    {(current||currentOnly)&&<KnowledgeGraphScoring score={(current??currentOnly)!.score}/>}
  </section>;
}
