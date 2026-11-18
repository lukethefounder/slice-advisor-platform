"use client";

import Link from "next/link";
import { ArrowUpRight, Network, RefreshCw } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { intelligenceFetch, isAbortError, cleanIntelligenceSymbol } from "@/lib/intelligence/client";
import type { ResearchGraphViewResponse, ResearchKnowledgeGraph } from "@/lib/intelligence/research-swarm-types";
import css from "./knowledge-graph-focus.module.css";

type Props = { symbol?: string; researchRunId?: string | null; variant?: "workspace" | "public"; scopeKey?: string; enabled?: boolean };
type VisualNode = { id: string; x: number; y: number; label: string; color: string; radius: number; kind: string };
const colors = { media: "#b8872f", technical: "#118b9c", economy: "#8972bc", shared: "#08956c" };
const centers = { media: [210, 150], technical: [590, 150], economy: [400, 327], shared: [400, 205] } as const;

function visualNodes(graph: ResearchKnowledgeGraph | null, symbol: string): VisualNode[] {
  if (!graph) {
    const nodes: VisualNode[] = [{ id: "asset", x:400, y:202, label:symbol, color:colors.shared, radius:30, kind:"asset" }];
    for (const cohort of ["media", "technical", "economy"] as const) {
      const [x,y] = centers[cohort];
      nodes.push({id:cohort,x,y,label:cohort === "economy" ? "ECONOMY" : cohort.toUpperCase(),color:colors[cohort],radius:15,kind:"cohort"});
      for (let i=0;i<11;i++) {
        const angle=i*Math.PI*2/11, radius=40+(i%3)*14;
        nodes.push({id:`${cohort}-${i}`,x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius*.75,label:["Sources", "Evidence", "Relationships"][i%3],color:colors[cohort],radius:i%4===0?5:3,kind:"evidence"});
      }
    }
    return nodes;
  }
  const ranked = [...graph.nodes].sort((a,b) => priority(b.kind)-priority(a.kind) || (b.confidence??0)-(a.confidence??0)).slice(0,72);
  const seen = new Map<string,number>();
  return ranked.map(node => {
    const [cx,cy] = centers[node.cohort];
    const idx=seen.get(node.cohort)??0; seen.set(node.cohort,idx+1);
    const core=node.kind==="asset"||node.kind==="score"||node.kind==="cohort";
    const angle=idx*2.399963, radius=core?0:35+Math.sqrt(idx)*12;
    return {id:node.id,x:node.kind==="asset"?400:node.kind==="score"?400:cx+Math.cos(angle)*radius,
      y:node.kind==="asset"?182:node.kind==="score"?245:cy+Math.sin(angle)*radius*.7,
      label:node.kind==="asset"?symbol:node.label,color:colors[node.cohort],radius:node.kind==="asset"?24:core?13:node.kind==="forecast"?8:4,kind:node.kind};
  });
}
function priority(kind:string) { return ({asset:10,score:9,cohort:8,forecast:7,source:6,evidence:5,"economic-series":5,sector:4,industry:4} as Record<string,number>)[kind]??1; }

export default function KnowledgeGraphSpotlight(props: Props) {
  return <ScopedSpotlight key={`${props.scopeKey??"anonymous"}:${props.enabled!==false}:${props.variant??"workspace"}:${props.symbol??"MSFT"}:${props.researchRunId??"latest"}`} {...props}/>;
}

function ScopedSpotlight({symbol="MSFT",researchRunId,variant="workspace",enabled=true}:Props) {
  const requestedSymbol=cleanIntelligenceSymbol(symbol)||"MSFT";
  const [view,setView]=useState<ResearchGraphViewResponse|null>(null), [loading,setLoading]=useState(variant==="workspace"&&enabled), [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const publicView=variant==="public";
  useEffect(() => {
    if(publicView||!enabled)return;
    const controller=new AbortController(); let active=true;
    const query=new URLSearchParams({symbol:requestedSymbol,projection:"overview"});
    if(researchRunId)query.set("runId",researchRunId);
    void intelligenceFetch<{view:ResearchGraphViewResponse|null}>(`/api/intelligence/research-graph?${query}`,{signal:controller.signal},{timeoutMs:18000,retries:0})
      .then(response=>{if(active)setView(response.view?.symbol===requestedSymbol&&(!researchRunId||response.view.runId===researchRunId)?response.view:null);})
      .catch(caught=>{if(active&&!isAbortError(caught))setError(caught instanceof Error?caught.message:"Saved research is unavailable.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[publicView,enabled,requestedSymbol,researchRunId]);
  const displayView=enabled&&view?.symbol===requestedSymbol?view:null;
  const graph=displayView?.graph??null;
  const nodes=useMemo(()=>visualNodes(graph,publicView?"STOCK":requestedSymbol),[graph,publicView,requestedSymbol]);
  const nodeMap=useMemo(()=>new Map(nodes.map(node=>[node.id,node])),[nodes]);
  const links=useMemo(()=>graph?graph.edges.filter(edge=>nodeMap.has(edge.source)&&nodeMap.has(edge.target)).slice(0,150).map(edge=>({source:edge.source,target:edge.target,color:colors[edge.cohort]})):
    nodes.filter(node=>node.id!=="asset").map(node=>({source:node.kind==="cohort"?"asset":node.id.split("-")[0],target:node.id,color:node.color})),[graph,nodes,nodeMap]);
  const chosen=nodes.find(node=>node.id===selected);
  const id=useId().replace(/:/g,"");
  const query=new URLSearchParams({symbol:requestedSymbol});
  if(displayView){query.set("researchRunId",displayView.runId);query.set("runId",displayView.runId);}
  return <section className={css.spotlight} aria-label={publicView?"Illustration of a Slice knowledge graph":`Saved ${requestedSymbol} knowledge graph`}>
    <div className={css.spotlightHead}><div><p className={css.eyebrow}><Network size={13}/>The research network</p><strong>{publicView?"Every signal has a connection.":`${requestedSymbol} · your evidence map`}</strong><small>{publicView?"Illustrative topology · no live forecast values":loading?"Loading your saved research…":displayView?`Saved ${new Date(displayView.generatedAt).toLocaleString()}`:"Run research to populate your graph."}</small></div>{loading?<RefreshCw size={17} className={css.loading}/>:<span className={css.pill}>{publicView?"Explore the method":displayView?"Saved research":"Ready to research"}</span>}</div>
    <svg className={css.constellation} viewBox="0 0 800 440" role="img" aria-label={graph?"Bounded overview of saved research relationships. Open the full graph for all nodes and sources.":"Illustrative network connecting a stock to media, technical, and economy research."}>
      <defs><radialGradient id={`${id}glow`}><stop offset="0" stopColor="#20c998" stopOpacity=".15"/><stop offset="1" stopColor="#20c998" stopOpacity="0"/></radialGradient><pattern id={`${id}grid`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#6d9f8b" opacity=".2"/></pattern></defs>
      <rect width="800" height="440" fill={`url(#${id}grid)`}/><ellipse cx="400" cy="210" rx="200" ry="155" fill={`url(#${id}glow)`}/>
      {[90,145,205].map(radius=><ellipse key={radius} cx="400" cy="210" rx={radius*1.5} ry={radius} fill="none" stroke="#65a98c" strokeOpacity=".1" strokeDasharray="3 8"/>)}
      {links.map((link,index)=>{const from=nodeMap.get(link.source),to=nodeMap.get(link.target);return from&&to?<path key={`${link.source}:${link.target}:${index}`} d={`M${from.x},${from.y} Q${(from.x+to.x)/2},${(from.y+to.y)/2-15} ${to.x},${to.y}`} fill="none" stroke={link.color} strokeOpacity={graph ? 0.3 : 0.25} strokeWidth={from.kind==="asset"?1.8:1}/>:null;})}
      {nodes.map(node=><g key={node.id} role={graph?"button":undefined} tabIndex={graph?0:undefined} aria-label={graph?`${node.kind}: ${node.label}`:undefined} onClick={()=>graph&&setSelected(node.id)} onKeyDown={e=>{if(graph&&(e.key==="Enter"||e.key===" ")){e.preventDefault();setSelected(node.id);}}}>
        {node.radius>10&&<circle cx={node.x} cy={node.y} r={node.radius+8} fill={node.color} fillOpacity=".06" stroke={node.color} strokeOpacity=".13"/>}
        <circle cx={node.x} cy={node.y} r={node.radius} fill={node.radius>10?"var(--slice-surface-strong, #f9fdfb)":node.color} stroke={node.color} strokeOpacity=".8" strokeWidth={selected===node.id?3:1.2}/>
        {node.kind==="asset"?<text x={node.x} y={node.y+4} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--slice-heading,#093c2d)">{node.label.slice(0,9)}</text>:node.kind==="cohort"?<text x={node.x} y={node.y+31} textAnchor="middle" fontSize="9" fontWeight="750" letterSpacing="1.5" fill={node.color}>{node.label.slice(0,26)}</text>:null}
      </g>)}
    </svg>
    <div className={css.spotlightFoot}><p>{error?error:chosen?`${chosen.kind}: ${chosen.label}`:publicView?"Media, price structure, and the economy meet in one inspectable network.":graph?`${graph.projection?.originalNodeCount??graph.nodeCount} graph nodes. Select a visible node, then open the full evidence trail.`:"Your saved graph will replace this illustrative layout after your first research run."}</p><Link className={css.secondary} prefetch={false} href={publicView?"/knowledge-graph":`/workspace/intelligence?${query}`}>{publicView?"Explore knowledge graphs":"Open intelligence"}<ArrowUpRight size={14}/></Link></div>
  </section>;
}
