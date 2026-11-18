"use client";
import Link from "@/components/unified-studio/studio-link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import { useMarketResources } from "@/lib/market-visuals/client";
import { strategyRead } from "@/lib/strategy-space/request-once";
import { quoteObservation, shouldWatch, type ScenarioWatch } from "@/lib/strategy-space/live-core";
import { validRecordId } from "@/lib/strategy-space/routes";
import css from "./strategy-space.module.css";
type Item={id:string;name:string;status:string};
const pct=(v:number|null|undefined)=>v==null?"—":`${v.toFixed(2)}%`;
const usd=(v:number|null|undefined)=>v==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(v);
export default function LiveWatch(){
 const session=useWorkspaceSession(),scope=session.user&&session.firm?`${session.user.id}:${session.firm.id}`:null;
 const [items,setItems]=useState<Item[]>([]),[cursor,setCursor]=useState<string|null>(null),[id,setId]=useState("");
 const [watch,setWatch]=useState<ScenarioWatch|null>(null),[error,setError]=useState(""),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[completed,setCompleted]=useState<string|null>(null);
 const scopeRef=useRef(scope); scopeRef.current=scope;
 const alive=useRef(true),generation=useRef(0),busyRef=useRef(false),enabledRef=useRef(false);
 const unauthorized=useCallback(()=>{setEnabled(false);setError("Your private session changed. Reload before requesting more observations.");},[]);
 const market=useMarketResources(scope,unauthorized);const {get,load}=market;
 useEffect(()=>{enabledRef.current=enabled;},[enabled]);
 const list=useCallback(async(before?:string)=>{
  if(!scope)return;const data=await strategyRead<{scenarios:Item[];nextCursor?:string|null}>(scope,"/api/strategy-lab/scenarios"+(before?`?before=${encodeURIComponent(before)}`:""));
  if(!alive.current||scopeRef.current!==scope)return;setItems(prior=>before?[...prior,...data.scenarios.filter(v=>!prior.some(p=>p.id===v.id))]:data.scenarios);setCursor(data.nextCursor??null);
  setId(prior=>prior||(()=>{const value=new URLSearchParams(window.location.search).get("scenarioId");return validRecordId(value)?value:data.scenarios[0]?.id??"";})());
 },[scope]);
 useEffect(()=>{alive.current=true;setItems([]);setWatch(null);setId("");setEnabled(false);setCompleted(null);if(scope)void list().catch(e=>{if(alive.current)setError(e instanceof Error?e.message:"Scenario list failed.");});return()=>{alive.current=false;generation.current++;};},[scope,list]);
 const read=useCallback(async()=>{
  if(!scope||!id)return;const seq=++generation.current;setReading(true);
  try{const data=await strategyRead<{watch:ScenarioWatch;scope:string}>(scope,`/api/strategy-lab/watch?id=${encodeURIComponent(id)}`);if(alive.current&&scopeRef.current===scope&&seq===generation.current){if(data.scope!==scope)throw new Error("Session scope changed. Reload to continue.");setWatch(data.watch);setError("");const u=new URL(window.location.href);u.searchParams.delete("id");u.searchParams.delete("sourceRunId");u.searchParams.set("scenarioId",data.watch.id);u.searchParams.set("runId",data.watch.sourceRunId);window.history.replaceState(null,"",u.pathname+u.search);}}
  catch(e){if(alive.current&&scopeRef.current===scope&&seq===generation.current)setError(e instanceof Error?e.message:"Scenario read failed.");}
  finally{if(alive.current&&scopeRef.current===scope&&seq===generation.current)setReading(false);}
 },[scope,id]);
 useEffect(()=>{setWatch(null);setEnabled(false);enabledRef.current=false;setCompleted(null);void read();return()=>{generation.current++;};},[read]);
 useEffect(()=>{
  if(!enabled||!watch||!scope)return;let cancelled=false;
  const symbols=[...new Set([...watch.symbols,watch.benchmark])];
  async function tick(){
   if(!shouldWatch({enabled:enabledRef.current,visible:document.visibilityState==="visible",online:navigator.onLine,busy:busyRef.current,retryAt:null}))return;
   busyRef.current=true;setBusy(true);
   try{for(const symbol of symbols){if(cancelled||!enabledRef.current||document.hidden||!navigator.onLine)break;const r=get("quote",symbol,"1M");if(r.retryAt>Date.now())continue;await load("quote",symbol,"1M");}if(!cancelled&&alive.current){setCompleted(new Date().toISOString());await read();}}
   finally{busyRef.current=false;if(alive.current)setBusy(false);}
  }
  void tick();const timer=setInterval(()=>void tick(),60000);const resume=()=>void tick();window.addEventListener("online",resume);document.addEventListener("visibilitychange",resume);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener("online",resume);document.removeEventListener("visibilitychange",resume);};
 },[enabled,watch?.id,scope,get,load,read]); // Quotes never update the saved daily strategy checkpoint.
 const symbols=watch?[...new Set([...watch.symbols,watch.benchmark])]:[];
 return <main className={css.page}><header className={css.hero}><div><span className={css.eyebrow}>FORWARD RESEARCH / TWO CLEAR CLOCKS</span><h1>Your rules. The unfolding market.</h1><p className={css.muted}>Watch provider observations beside a frozen paper strategy. Daily results and current quotes stay separate and inspectable.</p></div><span className={css.badge}>{enabled?<><span className={css.pulse}/>Visible-page watch enabled</>:"Observation watch paused"}</span></header>
 {session.error&&<div className={`${css.notice} ${css.error}`}>{session.error}</div>}{error&&<div role="alert" className={`${css.notice} ${css.error}`}>{error}</div>}
 <section className={css.panel}><div className={css.grid}><label className={css.field}>Saved scenario<select value={id} disabled={busy||reading} onChange={e=>setId(e.target.value)}><option value="">Select a registered or draft scenario</option>{id&&!items.some(x=>x.id===id)&&<option value={id}>{watch?.name??"Opening directly linked scenario"}</option>}{items.map(x=><option key={x.id} value={x.id}>{x.name} · {x.status}</option>)}</select></label><div className={css.actions}><button className={css.secondary} disabled={!id||reading} onClick={()=>void read()}>Reload saved checkpoint</button>{cursor&&<button className={css.secondary} onClick={()=>void list(cursor).catch(e=>setError(String(e)))}>Load more scenarios</button>}</div></div>
 {!watch?<p className={css.muted}>{reading?"Reading the saved scenario…":"Create a scenario from a saved historical run. No future result is prefilled."}</p>:<>
 <div className={css.grid}><div className={css.stat}><span>Recorded paper return</span><strong>{pct(watch.performance?.totalReturnPct)}</strong><small>{watch.lastSession?`Through ${watch.lastSession}`:"No accepted post-launch session yet"}</small></div><div className={css.stat}><span>Accepted sessions</span><strong>{watch.acceptedSessions} / {watch.targetSessions}</strong><small>{watch.status} · {watch.engineVersion}</small></div><div className={css.stat}><span>Recorded maximum drawdown</span><strong>{pct(watch.performance?.maxDrawdownPct)}</strong><small>Completed daily observations only</small></div></div>
 <div className={css.actions}><button className={css.button} onClick={()=>{enabledRef.current=!enabled;setEnabled(!enabled);}}>{enabled?"Pause quote watch":"Start quote watch"}</button><Link className={css.secondary} href={`/workspace/strategy-lab/scenarios?id=${encodeURIComponent(watch.id)}`} prefetch={false}>Import & update daily track</Link><Link className={css.secondary} href={`/workspace/strategy-lab?strategyRunId=${encodeURIComponent(watch.sourceRunId)}`} prefetch={false}>Original historical result</Link></div>
 <p className={css.muted}>Starting this watch can request up to {symbols.length} quotes each minute while visible and online. Cached responses and retry delays are respected. Daily checkpoints require the existing import/update workflow or configured scheduler. Pausing prevents new requests; an already running request may finish.</p>
 <div className={css.tableWrap}><table className={css.table}><thead><tr><th>Instrument</th><th>Observed price</th><th>Provider time</th><th>Data state / provenance</th><th>Accepted close weight</th></tr></thead><tbody>{symbols.map(symbol=>{const r=get("quote",symbol,"1M"),q=quoteObservation(r.value?.data.find(q=>q.symbol===symbol),r.value?.receipts??[]);return <tr key={symbol}><td><Link href={`/market-visuals?symbol=${encodeURIComponent(symbol)}`} prefetch={false}><b>{symbol}</b></Link><small>{symbol===watch.benchmark?"Benchmark":"Strategy universe"}</small></td><td><strong key={q?.observedAt}>{usd(q?.price)}</strong><small>{q?pct(q.changePct):r.busy?"Loading…":"Not requested / unavailable"}</small></td><td>{q?.observedAt??"—"}<small>{q?.precision??"No observation"}</small></td><td>{q?.state??"unavailable"}{r.error&&<small role="status">{r.error}</small>}{r.value?.snapshotId&&<details><summary>Exact source</summary><span className={css.hash}>{r.value.snapshotId}</span></details>}</td><td>{watch.performance&&watch.symbols.includes(symbol)?pct(watch.holdings[symbol]??0):"—"}<small>Not a live position or order</small></td></tr>})}</tbody></table></div>
 <p className={css.muted} role="status">{busy?"Reading shared source observations…":completed?`Latest browser read cycle: ${new Date(completed).toLocaleTimeString()}. This is not the provider observation time.`:"Provider timestamps determine freshness—not the animation or refresh button."}</p>
 <div className={css.notice}>Intraday quotes do not rerun daily rules, alter registered history, or imply fills. No live equity is calculated from potentially split-misaligned holdings. Market prices can be delayed or end-of-day depending on provider access.</div>
 {watch.lastError&&<div className={`${css.notice} ${css.error}`}>Daily track: {watch.lastError}</div>}
 <details><summary>Frozen definition and accepted result</summary><p className={css.hash}>Scenario: {watch.id}<br/>Definition: {watch.definitionHash}<br/>Accepted result: {watch.resultHash??"Not yet available"}<br/>Registered: {watch.frozenAt??"Draft — not launched"}</p><p className={css.muted}>Rebalance: {watch.ruleSummary.rebalance} · Weighting: {watch.ruleSummary.weighting} · Target exposure cap: {watch.ruleSummary.maxExposurePct}%</p></details>
 </>}</section></main>;
}
