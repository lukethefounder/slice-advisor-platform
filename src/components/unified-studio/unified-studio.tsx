"use client";
import dynamic from "next/dynamic";
import {useSearchParams} from "next/navigation";
import {useCallback,useEffect,useRef,useState} from "react";
import {FlaskConical,BarChart3,Layers3,Radio,FileText,Search,SlidersHorizontal,ShieldCheck,ArrowUpRight} from "lucide-react";
import Link from "next/link";
import {useWorkspaceSession} from "@/components/workspace/premium/session";
import {readStudioLocation,studioHref,STUDIO_PATH,type StudioView,type StudioLocation} from "@/lib/future-workspace/studio-route";
import type {DecisionStudioProps} from "@/components/scenario-decision/studio";
import type {StudioNavigationDetail} from "./studio-link";
import {ResultBoundary} from "@/components/earnings-lab/result-boundary";
import css from "./unified.module.css";
const loading=()=> <div className={css.loading} role="status">Opening the selected tool…</div>;
const Builder=dynamic(()=>import("@/components/strategy-lab/strategy-lab-workspace"),{loading});
const Decisions=dynamic(()=>import("@/components/scenario-decision/studio"),{loading});
const Costs=dynamic(()=>import("@/components/strategy-space/sensitivity-workspace"),{loading});
const Live=dynamic(()=>import("@/components/strategy-space/live-watch"),{loading});
const Guided=dynamic(()=>import("@/components/strategy-ease/guided-test"),{loading});
const Growth=dynamic(()=>import("@/components/strategy-ease/growth-workspace"),{loading});
const Earnings=dynamic(()=>import("@/components/earnings-lab/earnings-workspace"),{loading});
const Audit=dynamic(()=>import("@/components/connected-workspace/scenario-workspace"),{loading});
const steps=[{id:"guided",label:"Design & test",detail:"Your own rules or an idea",Icon:FlaskConical},{id:"results",label:"Review results",detail:"Return, risk + evidence",Icon:BarChart3},{id:"monitor",label:"Track forward",detail:"Same rules + future sessions",Icon:Layers3}] as const;
const decisionTabs:Partial<Record<StudioView,DecisionStudioProps["selectedTab"]>>={results:"Results",monitor:"Plan & monitor",evidence:"Current evidence",report:"Report"};
const reverseTabs={"Results":"results","Plan & monitor":"monitor","Current evidence":"evidence","Report":"report"} as const;
export default function UnifiedStudio(){const session=useWorkspaceSession();if(session.loading)return loading();if(!session.user||!session.firm)return <div className={css.loading}><p>Sign in to an active firm to access your private strategy workspace.</p><Link href="/advisor-login">Sign in</Link></div>;return <StudioBody key={`${session.user.id}:${session.firm.id}`}/>;}
function StudioBody(){
 const query=useSearchParams(),location=readStudioLocation(new URLSearchParams(query.toString()),"guided");
 const [seen,setSeen]=useState({guided:location.view==="guided",builder:location.view==="build",decisions:Boolean(decisionTabs[location.view])});
 const [builderBusy,setBuilderBusy]=useState(false),[decisionBusy,setDecisionBusy]=useState(false),[extraBusy,setExtraBusy]=useState(false),[notice,setNotice]=useState("");
 const busy=builderBusy||decisionBusy||extraBusy,refs=useRef({location,busy});refs.current={location,busy};
 const decisionActive=Boolean(decisionTabs[location.view]);
 useEffect(()=>{setSeen(s=>({guided:s.guided||location.view==="guided",builder:s.builder||location.view==="build",decisions:s.decisions||Boolean(decisionTabs[location.view])}));},[location.view]);
 const navigate=useCallback((view:StudioView,source?:StudioLocation,force=false)=>{if(refs.current.busy&&!force){setNotice("Finish or stop the current operation before changing tools. Your draft remains here.");return;}setNotice("");const url=studioHref(view,source??readStudioLocation(new URLSearchParams(window.location.search)));window.history.pushState(null,"",url);},[]);
 useEffect(()=>{const handler=(e:Event)=>{const raw=(e as CustomEvent<StudioNavigationDetail>).detail?.href;if(!raw)return;const u=new URL(raw,window.location.href);if(u.origin!==window.location.origin||u.pathname!==STUDIO_PATH)return;const next=readStudioLocation(u.searchParams);navigate(next.view,next);};window.addEventListener("slice:studio-navigate",handler);return()=>window.removeEventListener("slice:studio-navigate",handler);},[navigate]);
 const ready=useCallback((runId:string)=>navigate("results",{view:"results",runId,scenarioId:""},true),[navigate]);
 const changeTab=useCallback((tab:NonNullable<DecisionStudioProps["selectedTab"]>)=>navigate(reverseTabs[tab]),[navigate]);
 useEffect(()=>{if(!busy)return;const before=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before);},[busy]);
 return <div className={css.studio} data-slice-studio-hub="true">
 <header className={css.hero}><div className={css.heroMesh} aria-hidden="true"/><div><span className={css.eyebrow}>SLICE / ONE STRATEGY WORKSPACE</span><h1>Strategy <em>Studio.</em></h1><p>Choose your metrics. Define your exits. Follow your strategy.</p><div className={css.identity}><span><ShieldCheck size={12}/>Versioned calculations preserved</span><span>Historical ≠ paper ≠ current evidence</span></div></div><div className={css.context}><small>SELECTED RESEARCH</small><strong>{location.scenarioId?"Paper scenario linked":location.runId?"Historical run linked":"Your next strategy begins here"}</strong><code>{location.scenarioId||location.runId||"Build your own rules or open a saved definition"}</code><span>No orders are submitted.</span></div></header>
 <div className={css.flow} role="group" aria-label="Strategy Studio workflow">{steps.map(({id,label,detail,Icon},i)=><button key={id} aria-pressed={location.view===id} disabled={busy} onClick={()=>navigate(id)}><span className={css.stepNumber}>{String(i+1).padStart(2,"0")}</span><Icon size={17}/><b>{label}</b><small>{detail}</small></button>)}</div>
 <div className={css.tools}><p>Your custom draft stays here while you review results. Use the same saved definition for historical testing and forward paper tracking.</p><details className={css.advancedTools} open={!["guided","results","monitor"].includes(location.view)||undefined}><summary>More strategy tools</summary><div>{([{id:"build",text:"Detailed research workbench",Icon:FlaskConical},{id:"evidence",text:"Current evidence",Icon:Search},{id:"report",text:"Decision report",Icon:FileText},{id:"growth",text:"Growth what-if",Icon:BarChart3},{id:"earnings",text:"Earnings what-if",Icon:FlaskConical},{id:"sensitivity",text:"Cost stress",Icon:SlidersHorizontal},{id:"live",text:"Quote watch",Icon:Radio},{id:"audit",text:"Advanced controls",Icon:ShieldCheck}] as const).map(({id,text,Icon})=><button key={id} disabled={busy} aria-pressed={location.view===id} onClick={()=>navigate(id)}><Icon size={13}/>{text}</button>)}</div></details></div>
 {(notice||busy)&&<p className={css.notice} role="status">{notice||"Preparing your research. Progress and stop controls appear in the active tool."}</p>}
 <ResultBoundary view={location.view}/><div className={css.body}>
 {(seen.builder||location.view==="build")&&<section hidden={location.view!=="build"} inert={location.view!=="build"} aria-label="Strategy design and backtesting"><Builder embedded onRunReady={ready} onBusyChange={setBuilderBusy}/></section>}
 {(seen.decisions||decisionActive)&&<section hidden={!decisionActive} inert={!decisionActive} aria-label="Scenario results and decision reports"><Decisions embedded active={decisionActive} selectedTab={decisionTabs[location.view]} selection={location} onBusyChange={setDecisionBusy} onTabChange={changeTab}/></section>}
 {(seen.guided||location.view==="guided")&&<section hidden={location.view!=="guided"} inert={location.view!=="guided"} aria-label="Guided historical strategy test"><Guided active={location.view==="guided"} onRunReady={ready} onBusyChange={setExtraBusy}/></section>}
 {location.view==="growth"&&<Growth onBusyChange={setExtraBusy}/>}
 {location.view==="earnings"&&<Earnings onBusyChange={setExtraBusy}/>}
 {location.view==="sensitivity"&&<Costs key={location.runId} onBusyChange={setExtraBusy}/>}
 {location.view==="live"&&<Live key={location.scenarioId}/>}
 {location.view==="audit"&&<Audit key={location.scenarioId||location.runId} onBusyChange={setExtraBusy}/>}
 </div><footer className={css.footer}><span>Historical tests and forward results retain their source records.</span><Link href="/workspace" prefetch={false}>Return to your market focus<ArrowUpRight size={13}/></Link></footer>
 </div>;
}
