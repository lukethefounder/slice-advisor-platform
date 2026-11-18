"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, ArrowUpRight, Bot, Clock3, Database, Network, RefreshCw, Search, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { IntelligencePage } from "@/components/intelligence/intelligence-ui";
import { cleanIntelligenceSymbol, intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { allocateResearchAgents, DEFAULT_RESEARCH_WEIGHTS, MAX_RESEARCH_AGENTS, normalizeResearchWeights } from "@/lib/intelligence/research-config";
import type { ResearchCohort, ResearchGraphViewResponse, ResearchSwarmResponse, ResearchWeights } from "@/lib/intelligence/research-swarm-types";
import KnowledgeGraphOutcomes from "./knowledge-graph-outcomes";
import KnowledgeGraphSources from "./knowledge-graph-sources";
import css from "./knowledge-graph-focus.module.css";

const ResearchKnowledgeGraphCanvas=dynamic(()=>import("./research-knowledge-graph"),{ssr:false,loading:()=> <div className={css.empty} role="status"><div><RefreshCw size={24} className={css.loading}/><p>Preparing the interactive evidence map…</p></div></div>});
type Preferences={weights:ResearchWeights;agentCount:number};
type BootstrapResponse={ok:true;maximumAgents:number;latest:ResearchGraphViewResponse|null;researchPreferences?:Preferences;integrations:Array<{key:string;label:string;configured:boolean;safeStatus:string;note:string}>;persistence:{configured:boolean;enabled:boolean}};
type ResearchJob={id:string;status:string;progress:{value:number;message:string|null};output:Record<string,unknown>|null;error:string|null;lastError?:{message:string}|null};
type BuildResponse=(ResearchSwarmResponse&{executionMode?:"sync";executionFallback?:string|null})|{ok:true;executionMode:"background";job:ResearchJob;message:string;researchPreferences?:Preferences};
type Stage="loading"|"idle"|"research"|"queued"|"complete"|"error";
const COHORTS=["media","technical","economy"] as const;
const COLORS={media:"#b8872f",technical:"#118b9c",economy:"#8972bc"};
const LABELS={media:"Media & narrative",technical:"Technical & company",economy:"Economy & sectors"};
const integer=(value:number|undefined|null)=>typeof value==="number"?value.toLocaleString("en-US"):"—";
const date=(value:string|null|undefined)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():"Unavailable";

function pinLocation(symbol:string,runId:string|null) {
  const url=new URL(window.location.href);url.searchParams.set("symbol",symbol);url.searchParams.delete("runId");
  if(runId)url.searchParams.set("researchRunId",runId);else url.searchParams.delete("researchRunId");
  if(url.href!==window.location.href)window.history.replaceState(window.history.state,"",url.pathname+url.search);
}

function redistribute(weights:ResearchWeights,cohort:ResearchCohort,percentage:number):ResearchWeights {
  const chosen=Math.min(100,Math.max(0,percentage))/100,other=COHORTS.filter(value=>value!==cohort);
  const remaining=other.reduce((sum,value)=>sum+weights[value],0),next={...weights,[cohort]:chosen};
  for(const value of other)next[value]=(1-chosen)*(remaining>0?weights[value]/remaining:.5);
  return normalizeResearchWeights(next);
}

/** The graph and all dependent panels share one immutable research run identity. */
export default function IntelligenceControlPlane() {
  const [symbolInput,setSymbolInput]=useState("MSFT"),[activeSymbol,setActiveSymbol]=useState("MSFT");
  const [agentCount,setAgentCount]=useState(600),[weights,setWeights]=useState<ResearchWeights>(DEFAULT_RESEARCH_WEIGHTS);
  const [background,setBackground]=useState(false),[bootstrap,setBootstrap]=useState<BootstrapResponse|null>(null);
  const [swarm,setSwarm]=useState<ResearchSwarmResponse|null>(null),[stage,setStage]=useState<Stage>("loading"),[job,setJob]=useState<ResearchJob|null>(null);
  const [message,setMessage]=useState("Loading your saved evidence map."),[error,setError]=useState("");
  const mounted=useRef(true),sequence=useRef(0),controller=useRef<AbortController|null>(null),preferencesLoaded=useRef(false);
  const busy=stage==="loading"||stage==="research"||stage==="queued";
  const allocation=useMemo(()=>allocateResearchAgents(agentCount,weights),[agentCount,weights]);

  const loadSaved=useCallback(async(symbol:string,runId?:string|null)=>{
    controller.current?.abort();const request=new AbortController();controller.current=request;const seq=++sequence.current;
    setStage("loading");setError("");setMessage(`Loading the saved ${symbol} graph.`);setSwarm(null);setBootstrap(null);setActiveSymbol(symbol);setSymbolInput(symbol);
    const query=new URLSearchParams({symbol,projection:"overview"});if(runId)query.set("runId",runId);
    try {
      const response=await intelligenceFetch<BootstrapResponse>(`/api/intelligence/research-swarm?${query}`,{signal:request.signal},{timeoutMs:18000,retries:1});
      if(!mounted.current||seq!==sequence.current)return;
      if(response.latest&&(response.latest.symbol!==symbol||(runId&&response.latest.runId!==runId)))throw new Error("The saved graph does not match the requested research run.");
      setBootstrap(response);setStage(response.latest?"complete":"idle");
      if(!preferencesLoaded.current&&response.researchPreferences){setWeights(normalizeResearchWeights(response.researchPreferences.weights));setAgentCount(allocateResearchAgents(response.researchPreferences.agentCount,response.researchPreferences.weights).total);preferencesLoaded.current=true;}
      setMessage(response.latest?`Saved ${symbol} research is ready. The graph, forecast, and sources use the same run.`:`No saved ${symbol} graph yet. Choose your research mix and build the first map.`);
      pinLocation(symbol,response.latest?.runId??null);
    } catch(caught) {if(!mounted.current||seq!==sequence.current||isAbortError(caught))return;setStage("error");setError(caught instanceof Error?caught.message:"Saved research could not be loaded.");}
  },[]);

  useEffect(()=>{
    mounted.current=true;const params=new URLSearchParams(window.location.search),symbol=cleanIntelligenceSymbol(params.get("symbol"))||"MSFT";
    const timer=window.setTimeout(()=>void loadSaved(symbol,params.get("researchRunId")||params.get("runId")),0);
    return()=>{window.clearTimeout(timer);mounted.current=false;controller.current?.abort();};
  },[loadSaved]);

  useEffect(()=>{
    if(!job?.id)return;
    let current=true,timer:number|undefined,request:AbortController|null=null,failures=0;
    const jobId=job.id,symbol=activeSymbol;
    const poll=async()=>{
      if(!current)return;
      if(document.visibilityState!=="visible"||!navigator.onLine){timer=window.setTimeout(poll,7000);return;}
      request=new AbortController();
      try {
        const response=await intelligenceFetch<{job:ResearchJob}>(`/api/jobs/${encodeURIComponent(jobId)}`,{signal:request.signal},{timeoutMs:15000,retries:0});
        if(!current||!mounted.current)return;failures=0;setJob(response.job);setMessage(response.job.progress.message||`Research job: ${response.job.status}`);
        if(response.job.status==="Complete"){
          const runId=response.job.output?.runId;setJob(null);
          if(typeof runId!=="string"||!runId){setStage("error");setError("The job completed without a research run identifier. Refresh saved research to inspect its status.");return;}
          await loadSaved(symbol,runId);return;
        }
        if(["Failed","DeadLetter","Cancelled"].includes(response.job.status)){setJob(null);setStage("error");setError(response.job.lastError?.message||response.job.error||`Research ended with status ${response.job.status}.`);return;}
      } catch(caught) {if(!current||isAbortError(caught))return;failures++;if(failures>=5){setJob(null);setStage("error");setError("Job status is unavailable. The job may still be running; reload saved research shortly.");return;}}
      timer=window.setTimeout(poll,3000);
    };
    timer=window.setTimeout(poll,1500);
    return()=>{current=false;if(timer)window.clearTimeout(timer);request?.abort();};
  },[job?.id,activeSymbol,loadSaved]);

  async function runResearch(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const symbol=cleanIntelligenceSymbol(symbolInput);
    if(!symbol){setError("Enter a stock symbol before starting research.");return;}
    controller.current?.abort();const request=new AbortController();controller.current=request;const seq=++sequence.current;
    setActiveSymbol(symbol);setSymbolInput(symbol);setSwarm(null);setBootstrap(null);setJob(null);setStage("research");setError("");
    setMessage(`Collecting evidence and evaluating ${integer(allocation.total)} research pathways for ${symbol}.`);
    try {
      const response=await intelligenceFetch<BuildResponse>("/api/intelligence/research-swarm",{method:"POST",signal:request.signal,body:JSON.stringify({symbol,agentCount:allocation.total,researchWeights:allocation.weights,simulationPaths:300,graphMode:"full",detailMode:"graph",projection:"overview",persistGraph:background,forceRefresh:true,executionMode:background?"background":"sync"})},{timeoutMs:178000,retries:0});
      if(!mounted.current||seq!==sequence.current)return;preferencesLoaded.current=true;
      if(response.executionMode==="background"){setStage("queued");setJob(response.job);setMessage(response.message);return;}
      if(response.symbol!==symbol)throw new Error("The completed research does not match the requested stock.");
      setSwarm(response);setStage("complete");setMessage(`${integer(response.researchPlan?.evaluatedAgents??response.activeAgents)} analytical pathways evaluated. Sources and model outcomes are attached to this run.`);
      pinLocation(response.symbol,response.runId);
    } catch(caught){if(!mounted.current||seq!==sequence.current||isAbortError(caught))return;setStage("error");setError(caught instanceof Error?caught.message:"Research did not complete.");}
  }

  const saved=bootstrap?.latest?.symbol===activeSymbol?bootstrap.latest:null;
  const current=swarm?.symbol===activeSymbol?swarm:null;
  const graph=current?.graph??saved?.graph??null,runId=current?.runId??saved?.runId??null;
  const analytics=current?.graphAnalytics??saved?.analytics??null;
  const plan=current?.researchPlan??saved?.metadata.researchPlan;
  const runWeights=current?.score.weighting??saved?.metadata.researchWeights;
  const fullHref=`/workspace/intelligence/knowledge-graph?${new URLSearchParams({symbol:activeSymbol,...(runId?{runId,researchRunId:runId}:{})})}`;
  const providerAsOf=current?.providerAsOf??saved?.metadata.providerAsOf;
  const score=current?.score.overall??saved?.metadata.score;
  return <IntelligencePage className={css.page}>
    <header className={css.header}><div><p className={css.eyebrow}><Network size={14}/>Slice / connected intelligence</p><h1 className={css.title}>The knowledge graph comes first.</h1><p className={css.description}>Follow the connections between a company, its sectors, the news, and the economy. Inspect the evidence, then assess the possibilities.</p></div><Link className={css.secondary} href="/workspace" prefetch={false}>Back to workspace<ArrowUpRight size={14}/></Link></header>

    <form onSubmit={runResearch}>
      <div className={css.controls}><label className={css.field}><span>Research a stock</span><input className={css.symbolInput} autoComplete="off" maxLength={24} aria-label="Stock symbol" value={symbolInput} disabled={busy} onChange={event=>setSymbolInput(event.target.value.toUpperCase())}/></label><button className={css.button} type="submit" disabled={busy}>{busy?<RefreshCw size={15} className={css.loading}/>:<Search size={15}/>} {busy?"Research in progress":"Build research graph"}</button><button className={css.secondary} type="button" disabled={busy} onClick={()=>void loadSaved(cleanIntelligenceSymbol(symbolInput)||activeSymbol)}><RefreshCw size={14}/>Load saved</button><p className={css.controlNote}>Your research mix is saved to your account when you run. Existing forecasts keep their original assumptions.</p></div>
      <details className={css.plan}><summary><span className={css.planSummary}><span><Settings2 size={13} style={{display:"inline",verticalAlign:"middle",marginRight:7}}/>Next research run</span><small>{integer(allocation.total)} agents · {Math.round(weights.media*100)}% media / {Math.round(weights.technical*100)}% technical / {Math.round(weights.economy*100)}% economy</small></span></summary><div className={css.planBody}>
        <div className={css.countRow}><label className={css.field} htmlFor="research-agent-count"><span>Analytical agents</span><input id="research-agent-count" type="number" min={30} max={MAX_RESEARCH_AGENTS} step={1} disabled={busy} value={agentCount} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value))setAgentCount(Math.max(30,Math.min(MAX_RESEARCH_AGENTS,value)));}}/></label><input type="range" min={100} max={MAX_RESEARCH_AGENTS} step={100} disabled={busy} value={Math.max(100,agentCount)} aria-label="Number of analytical research agents" onChange={event=>setAgentCount(Number(event.target.value))}/><span className={css.pill}>Up to 10,000 pathways</span></div>
        <div className={css.planGrid}>{COHORTS.map(cohort=><label key={cohort} className={css.ratio} style={{"--cohort-color":COLORS[cohort]} as CSSProperties}><span className={css.ratioHeading}><span>{LABELS[cohort]}</span><strong>{Math.round(weights[cohort]*100)}%</strong></span><input type="range" min={0} max={100} step={1} value={Math.round(weights[cohort]*100)} disabled={busy} aria-label={`${LABELS[cohort]} research weight`} onChange={event=>setWeights(value=>redistribute(value,cohort,Number(event.target.value)))}/><small>{integer(allocation.allocation[cohort])} assigned agents</small></label>)}</div>
        <div className={css.allocation} aria-hidden="true">{COHORTS.map(cohort=><span key={cohort} style={{width:`${weights[cohort]*100}%`,background:COLORS[cohort]}}/>)}</div><p className={css.fine}>Agents analyze distinct research questions over the evidence actually retrieved. Shared sources are counted once; a larger agent count does not establish more independent evidence.</p>
        <label className={css.fine} style={{display:"flex",alignItems:"center",gap:8,marginTop:14}}><input type="checkbox" checked={background} disabled={busy} onChange={event=>setBackground(event.target.checked)}/>Run through the background worker</label>
      </div></details>
    </form>

    <div className={`${css.notice} ${error?css.error:""}`} role={error?"alert":"status"} aria-live="polite">{error||message}{job&&<div style={{marginTop:8}}><progress max={100} value={Math.max(0,Math.min(100,job.progress.value))} aria-label="Research worker progress" style={{width:"100%",accentColor:"#0a8c65"}}/><span className={css.fine}>{job.status} · {Math.round(job.progress.value)}% reported by worker</span></div>}</div>

    <section className={css.network} aria-label={`${activeSymbol} research knowledge graph`}>
      <div className={css.networkHeading}><div><p className={css.eyebrow}><span className={css.dot}/>Evidence → relationships → outcomes</p><h2>{activeSymbol} / {current?.companyName??saved?.metadata.companyName??"research network"}</h2><p>{current?.sector??saved?.metadata.sector??"Company, sector, and macro context"}{runWeights?` · Saved mix: media ${Math.round(runWeights.media*100)}% / technical ${Math.round(runWeights.technical*100)}% / economy ${Math.round(runWeights.economy*100)}%`:""}</p></div><div className={css.actions}><a className={css.secondary} href="#research-sources">Inspect sources<ArrowUpRight size={13}/></a><Link className={css.secondary} href={fullHref} prefetch={false}>Full graph workspace<ArrowUpRight size={13}/></Link></div></div>
      {graph?<ResearchKnowledgeGraphCanvas key={graph.runId} graph={graph} analytics={analytics} height={570} live={false}/>:<div className={css.empty}><div>{busy?<RefreshCw size={38} className={css.loading} style={{margin:"0 auto",color:"#0b9a6d"}}/>:<Network size={46} style={{margin:"0 auto",color:"#0b9a6d"}}/>}<h3>{busy?"Connecting your evidence":"Start with a stock. Reveal the connections."}</h3><p>{busy?"The graph will appear when the evidence is ready. Research progress reflects returned data and worker status.":"Choose your stock and research mix above. The graph will connect the sources, analytical pathways, sector relationships, and resulting forecast."}</p></div></div>}
      <div className={css.metrics}><div className={css.metric}><span>Evaluated pathways</span><strong>{integer(plan?.evaluatedAgents??current?.activeAgents??saved?.metadata.activeAgents)}</strong><small>Analytical agents</small></div><div className={css.metric}><span>Graph relationships</span><strong>{graph?integer(graph.projection?.originalEdgeCount??graph.edgeCount):"—"}</strong><small>Focused visual overview</small></div><div className={css.metric}><span>Unique source domains</span><strong>{plan?integer(plan.uniqueSourceCount):"See registry"}</strong><small>Shared inputs counted once</small></div><div className={css.metric}><span>Slice research score</span><strong>{typeof score==="number"?`${score.toFixed(1)} / 100`:"—"}</strong><small>Sentiment, not a probability</small></div></div>
    </section>
    {graph&&<p className={css.fine}><Clock3 size={11} style={{display:"inline",verticalAlign:"middle",marginRight:4}}/>Provider observation: {date(providerAsOf)} · Research completed: {date(current?.completedAt??saved?.generatedAt)}</p>}

    <KnowledgeGraphOutcomes symbol={activeSymbol} runId={runId}/>
    <KnowledgeGraphSources symbol={activeSymbol} runId={runId}/>

    {(current||bootstrap)&&<details className={css.details}><summary><Activity size={13} style={{display:"inline",verticalAlign:"middle",marginRight:7}}/>Research coverage, provider status, and diagnostics</summary><div className={css.detailBody}>
      {plan&&<p>{integer(plan.uniqueEvidenceCount)} unique evidence items; {integer(plan.duplicateEvidenceCount)} duplicates removed. {integer(plan.uniqueEvidenceAssignments)} unique evidence assignments and {integer(plan.reusedEvidenceAssignments)} reused assignments across {integer(plan.allocatedAgents)} configured pathways.</p>}
      {runId&&<p>Research run: {runId}</p>}
      {analytics&&<p>Graph nodes: {integer(analytics.analyzedNodeCount)} · Edges analyzed: {integer(analytics.analyzedEdgeCount)} · Source concentration: {analytics.sourceConcentration===undefined?"Unavailable":`${analytics.sourceConcentration.toFixed(1)}%`}</p>}
      {bootstrap?.integrations.map(provider=><p key={provider.key}><strong>{provider.label} · {provider.safeStatus}</strong><br/>{provider.note}</p>)}
      {current?.warnings.map((warning,index)=><p key={index}>{warning}</p>)}
    </div></details>}
    <nav className={css.links} aria-label="Deeper research tools"><Link className={css.secondary} href={`/workspace/intelligence/agent-simulation?${new URLSearchParams({symbol:activeSymbol,...(runId?{runId,researchRunId:runId}:{})})}`} prefetch={false}><Bot size={14}/>Agent inspector</Link><Link className={css.secondary} href="/workspace/intelligence/forecast-history" prefetch={false}><Activity size={14}/>Observed outcomes</Link><Link className={css.secondary} href="/workspace/intelligence/data-warehouse" prefetch={false}><Database size={14}/>Evidence warehouse</Link></nav>
  </IntelligencePage>;
}
