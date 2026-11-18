"use client";

import Link from "next/link";
import { ArrowUpRight, Bot, ChevronLeft, ChevronRight, Network, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { IntelligencePage } from "./intelligence-ui";
import { cleanIntelligenceSymbol, intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { MAX_RESEARCH_AGENTS } from "@/lib/intelligence/research-config";
import type { ResearchAgent, ResearchCohort, ResearchGraphViewResponse, ResearchSwarmResponse } from "@/lib/intelligence/research-swarm-types";
import css from "./knowledge-graph-focus.module.css";

type PageResult={ok:true;symbol:string;runId:string;items:ResearchAgent[];total:number;page:number;pageSize:number;pages:number;recordedAgentCount:number;requestedAgents:number};
type Filters={query:string;cohort:ResearchCohort|"all";status:ResearchAgent["status"]|"all";page:number};
const initialFilters:Filters={query:"",cohort:"all",status:"all",page:1};
function pinLocation(symbol:string,runId:string|null) {
  const url=new URL(window.location.href);url.searchParams.set("symbol",symbol);url.searchParams.delete("runId");
  if(runId)url.searchParams.set("researchRunId",runId);else url.searchParams.delete("researchRunId");
  if(url.href!==window.location.href)window.history.replaceState(window.history.state,"",url.pathname+url.search);
}

export default function ResearchSwarmInspector() {
  const [symbolInput,setSymbolInput]=useState("MSFT"),[symbol,setSymbol]=useState("MSFT"),[runId,setRunId]=useState<string|null>(null);
  const [agentCount,setAgentCount]=useState(600),[building,setBuilding]=useState(false),[loadingSaved,setLoadingSaved]=useState(true);
  const [filters,setFilters]=useState<Filters>(initialFilters),[data,setData]=useState<PageResult|null>(null),[finishedKey,setFinishedKey]=useState("");
  const [error,setError]=useState(""),[pageError,setPageError]=useState(""),[message,setMessage]=useState("Loading your saved research assignments.");
  const [retry,setRetry]=useState(0);
  const controller=useRef<AbortController|null>(null),mounted=useRef(true),sequence=useRef(0);
  const requestKey=useMemo(()=>JSON.stringify([symbol,runId,filters,retry]),[symbol,runId,filters,retry]);
  const loadingPage=Boolean(runId)&&finishedKey!==requestKey;
  const current=data?.symbol===symbol&&data.runId===runId&&finishedKey===requestKey?data:null;

  const loadSaved=useCallback(async(requestedSymbol:string,requestedRunId?:string|null)=>{
    controller.current?.abort();const request=new AbortController();controller.current=request;const seq=++sequence.current;
    setLoadingSaved(true);setError("");setRunId(null);setSymbol(requestedSymbol);setSymbolInput(requestedSymbol);setFilters(initialFilters);
    const params=new URLSearchParams({symbol:requestedSymbol,projection:"overview"});if(requestedRunId)params.set("runId",requestedRunId);
    try {
      const response=await intelligenceFetch<{latest:ResearchGraphViewResponse|null;researchPreferences?:{agentCount:number}}>(`/api/intelligence/research-swarm?${params}`,{signal:request.signal},{timeoutMs:18000,retries:0});
      if(!mounted.current||seq!==sequence.current)return;
      if(response.latest&&(response.latest.symbol!==requestedSymbol||(requestedRunId&&response.latest.runId!==requestedRunId)))throw new Error("Saved research does not match the requested stock and run.");
      setRunId(response.latest?.runId??null);
      if(response.researchPreferences)setAgentCount(Math.max(30,Math.min(MAX_RESEARCH_AGENTS,response.researchPreferences.agentCount)));
      setMessage(response.latest?"Inspecting the recorded assignments for this research run.":"No saved research exists for this stock. Build a graph to inspect its agent assignments.");
      pinLocation(requestedSymbol,response.latest?.runId??null);
    } catch(caught){if(mounted.current&&seq===sequence.current&&!isAbortError(caught))setError(caught instanceof Error?caught.message:"Saved research could not be loaded.");}
    finally{if(mounted.current&&seq===sequence.current)setLoadingSaved(false);}
  },[]);

  useEffect(()=>{
    mounted.current=true;const params=new URLSearchParams(window.location.search);
    const timer=window.setTimeout(()=>void loadSaved(cleanIntelligenceSymbol(params.get("symbol"))||"MSFT",params.get("runId")||params.get("researchRunId")),0);
    return()=>{window.clearTimeout(timer);mounted.current=false;controller.current?.abort();};
  },[loadSaved]);

  useEffect(()=>{
    if(!runId)return;
    let active=true;const request=new AbortController();
    const params=new URLSearchParams({symbol,runId,page:String(filters.page),pageSize:"24",q:filters.query});
    if(filters.cohort!=="all")params.set("cohort",filters.cohort);if(filters.status!=="all")params.set("status",filters.status);
    const timer=window.setTimeout(()=>{void intelligenceFetch<PageResult>(`/api/intelligence/research-agents?${params}`,{signal:request.signal},{timeoutMs:18000,retries:0})
      .then(response=>{if(active){setData(response.symbol===symbol&&response.runId===runId?response:null);setPageError("");}})
      .catch(caught=>{if(active&&!isAbortError(caught)){setData(null);setPageError(caught instanceof Error?caught.message:"Agent assignments could not be loaded.");}})
      .finally(()=>{if(active)setFinishedKey(requestKey);});},filters.query?220:0);
    return()=>{active=false;window.clearTimeout(timer);request.abort();};
  },[symbol,runId,filters,requestKey]);

  async function run(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const requested=cleanIntelligenceSymbol(symbolInput);if(!requested){setError("Enter a stock symbol.");return;}
    controller.current?.abort();const request=new AbortController();controller.current=request;const seq=++sequence.current;
    setBuilding(true);setRunId(null);setSymbol(requested);setSymbolInput(requested);setFilters(initialFilters);setError("");setMessage(`Building ${agentCount.toLocaleString()} research assignments using your saved research mix.`);
    try {
      const response=await intelligenceFetch<ResearchSwarmResponse>("/api/intelligence/research-swarm",{method:"POST",signal:request.signal,body:JSON.stringify({symbol:requested,agentCount,graphMode:"full",detailMode:"summary",projection:"overview",persistGraph:false,forceRefresh:true,simulationPaths:300,executionMode:"sync"})},{timeoutMs:178000,retries:0});
      if(!mounted.current||seq!==sequence.current)return;if(response.symbol!==requested)throw new Error("Research returned a different stock.");
      setRunId(response.runId);setMessage("Research completed. Agent details load one page at a time.");
      pinLocation(response.symbol,response.runId);
    } catch(caught){if(mounted.current&&seq===sequence.current&&!isAbortError(caught))setError(caught instanceof Error?caught.message:"Research could not be completed.");}
    finally{if(mounted.current&&seq===sequence.current)setBuilding(false);}
  }
  const graphHref=(nodeId?:string)=>`/workspace/intelligence/knowledge-graph?${new URLSearchParams({symbol,...(runId?{runId,researchRunId:runId}:{}),...(nodeId?{nodeId}:{})})}`;
  const busy=building||loadingSaved;
  return <IntelligencePage className={css.page}>
    <header className={css.header}><div><p className={css.eyebrow}><Bot size={14}/>Inside the research network</p><h1 className={css.title}>Inspect the work behind the graph.</h1><p className={css.description}>See each analytical assignment, the question it examined, and whether its evidence was shared with another pathway.</p></div><Link href={`/workspace/intelligence?${new URLSearchParams({symbol,...(runId?{researchRunId:runId}:{})})}`} className={css.secondary} prefetch={false}>Intelligence overview<ArrowUpRight size={14}/></Link></header>
    <form className={css.controls} onSubmit={run}><label className={css.field}><span>Stock symbol</span><input className={css.symbolInput} value={symbolInput} maxLength={24} autoComplete="off" disabled={busy} onChange={event=>setSymbolInput(event.target.value.toUpperCase())}/></label><label className={css.field}><span>Analytical agents</span><input type="number" min={30} max={MAX_RESEARCH_AGENTS} value={agentCount} disabled={busy} style={{width:130}} onChange={event=>setAgentCount(Math.max(30,Math.min(MAX_RESEARCH_AGENTS,Number(event.target.value)||30)))}/></label><button type="submit" className={css.button} disabled={busy}>{busy?<RefreshCw size={14} className={css.loading}/>:<Bot size={14}/>}Build & inspect</button><button type="button" className={css.secondary} disabled={busy} onClick={()=>void loadSaved(cleanIntelligenceSymbol(symbolInput)||symbol)}>Load saved research</button></form>
    <div className={`${css.notice} ${error?css.error:""}`} role={error?"alert":"status"}>{error||message}</div>
    {runId?<section className={css.section} style={{marginTop:0}}><div className={css.sectionHead}><div><p className={css.eyebrow}>{symbol} / recorded analytical pathways</p><h2>{current?`${current.recordedAgentCount.toLocaleString()} assignments available`:"Research assignments"}</h2><p>Only 24 agent records are requested per page. Open a node to inspect its connections and original evidence.</p></div><Link href={graphHref()} className={css.secondary} prefetch={false}><Network size={14}/>Open graph</Link></div>
      {current&&current.recordedAgentCount<current.requestedAgents?<p className={css.notice}>This saved graph retained {current.recordedAgentCount.toLocaleString()} of {current.requestedAgents.toLocaleString()} requested pathways. Only recorded assignments can be inspected; a new full research build retains the complete set.</p>:null}
      <div className={css.sourceControls}><label style={{display:"flex",flex:1,minWidth:180,alignItems:"center",gap:8}}><Search size={15}/><input className={css.sourceSearch} type="search" value={filters.query} placeholder="Search role, research question, or sector" aria-label="Search agents" onChange={event=>setFilters(value=>({...value,query:event.target.value,page:1}))}/></label><label className={css.field}><span>Cohort</span><select value={filters.cohort} onChange={event=>setFilters(value=>({...value,cohort:event.target.value as Filters["cohort"],page:1}))}><option value="all">All cohorts</option><option value="media">Media</option><option value="technical">Technical</option><option value="economy">Economy</option></select></label><label className={css.field}><span>Status</span><select value={filters.status} onChange={event=>setFilters(value=>({...value,status:event.target.value as Filters["status"],page:1}))}><option value="all">All statuses</option><option value="completed">Completed</option><option value="degraded">Degraded</option><option value="insufficient-evidence">Insufficient evidence</option></select></label></div>
      {loadingPage?<p className={css.fine} role="status"><RefreshCw size={13} className={css.loading}/>Loading agent assignments…</p>:pageError?<div className={`${css.notice} ${css.error}`} role="alert">{pageError}<button type="button" className={css.secondary} onClick={()=>setRetry(value=>value+1)} style={{marginLeft:12}}>Retry</button></div>:current?.items.length?<div className={css.sourceList}>{current.items.map(agent=><article key={agent.id} className={css.source}><div className={css.pills}><span className={css.pill}>{agent.cohort}</span><span className={css.pill}>{agent.status}</span></div><h3>{agent.role} #{agent.ordinal}</h3><p>{agent.researchQuestion||agent.pathway}</p><small>{agent.sector||"Sector not recorded"}{agent.industry?` · ${agent.industry}`:""}</small><p className={css.fine}>{agent.evidenceIds.length} evidence links · Confidence score {agent.confidence.toFixed(0)} / 100</p><p className={css.fine}>{!agent.evidenceIds.length?"No supporting evidence assigned.":agent.evidenceReused?"Shares its evidence assignment with another pathway.":"Distinct recorded evidence assignment in this run."}</p><Link href={graphHref(agent.id)} prefetch={false}>Inspect node & evidence<ArrowUpRight size={13}/></Link></article>)}</div>:<p className={css.notice}>No recorded assignments match these filters.</p>}
      {current&&<div className={css.pagination}><span>Page {current.page} of {Math.max(1,current.pages)} · {current.total.toLocaleString()} matching assignments</span><div className={css.actions}><button type="button" className={css.secondary} disabled={filters.page<=1||loadingPage} onClick={()=>setFilters(value=>({...value,page:Math.max(1,value.page-1)}))}><ChevronLeft size={14}/>Previous</button><button type="button" className={css.secondary} disabled={filters.page>=current.pages||loadingPage} onClick={()=>setFilters(value=>({...value,page:value.page+1}))}>Next<ChevronRight size={14}/></button></div></div>}
    </section>:!busy?<div className={css.empty}><div><Bot size={40} style={{margin:"0 auto",color:"#0a946b"}}/><h3>No agent research selected</h3><p>Load a saved stock graph or build research using your personal media, technical, and economy mix.</p></div></div>:null}
  </IntelligencePage>;
}
