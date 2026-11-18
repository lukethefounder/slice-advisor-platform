"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Library, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import type { ResearchCohort, ResearchEvidence } from "@/lib/intelligence/research-swarm-types";
import { safeResearchSourceUrl } from "@/lib/intelligence/research-evidence";
import css from "./knowledge-graph-focus.module.css";

type Response={ok:true;runId:string;symbol:string;items:ResearchEvidence[];total:number;page:number;pageSize:number;sourceCount:number};

function timestamp(value:string|null) {return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():"Not supplied";}

/** Pages through the complete saved evidence registry, independently of graph projection. */
export default function KnowledgeGraphSources({symbol,runId}:{symbol:string;runId:string|null}) {
  return <PinnedSources key={`${symbol}:${runId??"none"}`} symbol={symbol} runId={runId}/>;
}

function PinnedSources({symbol,runId}:{symbol:string;runId:string|null}) {
  const [data,setData]=useState<Response|null>(null),[finishedKey,setFinishedKey]=useState(""),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[cohort,setCohort]=useState<ResearchCohort|"all">("all"),[page,setPage]=useState(1);
  const [refresh,setRefresh]=useState(0);
  const requestKey=JSON.stringify([symbol,runId,page,cohort,query,refresh]);
  const loading=Boolean(runId)&&finishedKey!==requestKey;
  useEffect(()=>{
    if(!runId)return;
    const controller=new AbortController();let current=true;
    const params=new URLSearchParams({symbol,runId,page:String(page),pageSize:"12",q:query});if(cohort!=="all")params.set("cohort",cohort);
    const timer=window.setTimeout(()=>{void intelligenceFetch<Response>(`/api/intelligence/research-sources?${params}`,{signal:controller.signal},{timeoutMs:18000,retries:0})
      .then(response=>{if(current){setData(response.symbol===symbol&&response.runId===runId?response:null);setError("");}})
      .catch(caught=>{if(current&&!isAbortError(caught)){setError(caught instanceof Error?caught.message:"The source registry could not be loaded.");setData(null);}})
      .finally(()=>{if(current)setFinishedKey(requestKey);});},query?220:0);
    return()=>{current=false;window.clearTimeout(timer);controller.abort();};
  },[symbol,runId,page,cohort,query,refresh,requestKey]);
  const current=data?.symbol===symbol&&data.runId===runId&&finishedKey===requestKey?data:null;
  const pages=current?Math.max(1,Math.ceil(current.total/current.pageSize)):1;
  return <section className={css.section} id="research-sources" aria-label="Complete research source registry">
    <div className={css.sectionHead}><div><p className={css.eyebrow}><Library size={13}/>The complete source trail</p><h2>Open the research behind the graph.</h2><p>Browse the saved evidence and original sites used in this run, including sources outside the graph’s visible projection.</p></div>{current&&<span className={css.pill}>{current.sourceCount} source domains · {current.total} matching records</span>}</div>
    {runId?<>
      <div className={css.sourceControls}><label style={{display:"flex",flex:1,minWidth:180,alignItems:"center",gap:9}}><Search size={15}/><input type="search" className={css.sourceSearch} placeholder="Search title, source, or research topic" aria-label="Search research sources" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}}/></label><div className={css.actions} role="group" aria-label="Filter source cohort">{(["all","media","technical","economy"] as const).map(value=><button key={value} type="button" className={`${css.tab} ${cohort===value?css.selected:""}`} aria-pressed={cohort===value} onClick={()=>{setCohort(value);setPage(1);}}>{value=== "all"?"All research":value.charAt(0).toUpperCase()+value.slice(1)}</button>)}</div></div>
      {loading?<p className={css.fine} role="status"><RefreshCw size={13} className={css.loading}/> Loading saved sources…</p>:error?<div className={`${css.notice} ${css.error}`} role="alert">{error}<div style={{marginTop:10}}><button className={css.secondary} type="button" onClick={()=>setRefresh(value=>value+1)}>Retry source request</button></div></div>:current?.items.length?<div className={css.sourceList}>{current.items.map(item=>{const href=safeResearchSourceUrl(item.sourceUrl);return <article className={css.source} key={item.id}><div className={css.sourceTop}><span className={css.pill}>{item.cohort}</span><span>{item.source}</span><span>· {item.kind}</span></div><h3>{item.title}</h3><p>{item.summary}</p><small>Published / observed: {timestamp(item.asOf)}<br/>Retrieved: {timestamp(item.retrievedAt)}</small>{href?<a href={href} target="_blank" rel="noopener noreferrer">Open original source<ArrowUpRight size={13}/></a>:<small>Original source link unavailable</small>}{item.relatedSources?.length ? <details className={css.details}><summary>Additional sites carrying this evidence ({item.relatedSources.length})</summary><div className={css.detailBody}><p>These links were grouped as duplicates and are not counted as independent evidence.</p>{item.relatedSources.map((related,index)=>{const relatedUrl=safeResearchSourceUrl(related.url);return relatedUrl?<div key={`${relatedUrl}:${index}`}><a href={relatedUrl} target="_blank" rel="noopener noreferrer">{related.source||new URL(relatedUrl).hostname}<ArrowUpRight size={13}/></a><small>Observed: {timestamp(related.asOf)}</small></div>:null;})}</div></details>:null}{item.warnings.length>0&&<details className={css.details}><summary>Evidence qualifications</summary><div className={css.detailBody}>{item.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div></details>}</article>;})}</div>:<p className={css.notice}>{query||cohort!=="all"?"No saved evidence matches these filters.":"This run has no source records available in the saved registry."}</p>}
      {current&&<div className={css.pagination}><span>Page {current.page} of {pages} · {current.total} matching evidence records</span><div className={css.actions}><button type="button" className={css.secondary} disabled={loading||page<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}><ChevronLeft size={13}/>Previous</button><button type="button" className={css.secondary} disabled={loading||page>=pages} onClick={()=>setPage(value=>value+1)}>Next<ChevronRight size={13}/></button></div></div>}
    </>:<p className={css.notice}>The complete source registry appears after a research run is selected.</p>}
  </section>;
}
