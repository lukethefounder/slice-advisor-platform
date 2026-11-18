"use client";
import { ArrowUpRight, Settings2, RefreshCw, Pause, Play } from "lucide-react";
import Link from "next/link";
import {useAmbientMotion} from "./use-ambient-motion";
import css from "./future.module.css";
import type {MarketQuote} from "@/lib/market-evidence/contracts";
type Props={name:string;firm:string;title:string;subtitle:string;symbol:string;quote?:MarketQuote|null;day:string;motion:boolean;loading:boolean;disabled:boolean;canRefresh:boolean;onCustomize:()=>void;onRefresh:()=>void};
export default function WorkspaceIntro(p:Props){const a=useAmbientMotion(p.motion);const q=p.quote?.symbol===p.symbol&&Number.isFinite(p.quote.price)&&p.quote.price>0?p.quote:null;return <header ref={a.ref} className={css.intro} data-moving={a.moving?"true":"false"}>
 <div className={css.introMesh} aria-hidden="true"/><div className={css.introContent}>
 <div className={css.eyebrow}>{p.firm || "SLICE"} / PERSONAL COMMAND SPACE <span>{p.day}</span></div>
 <h1>{p.title || (p.name ? `${p.name}’s perspective.` : "Your perspective.")}</h1><p>{p.subtitle || "One market focus. Every decision connected."}</p>
 <div className={css.quoteStrip}><b>{p.symbol||"YOUR MARKET"}</b><strong>{q?q.price.toLocaleString("en-US",{maximumFractionDigits:2}):"Awaiting observation"}</strong>{q&&<span data-direction={q.changePct!=null&&q.changePct<0?"down":"up"}>{q.changePct==null?"Change unavailable":`${q.changePct>0?"+":""}${q.changePct.toFixed(2)}%`}</span>}<small>{q?`${q.priceKind} · ${q.observedAt} · ${q.state}`:"Saved observations appear when available; no placeholder prices."}</small></div>
 <div className={css.introActions}><button className={css.primary} onClick={p.onCustomize} disabled={p.disabled}><Settings2 size={15}/>Personalize workspace</button><Link href="/workspace/strategy-lab" prefetch={false} className={css.ghost}>Strategy Studio<ArrowUpRight size={15}/></Link><button className={css.icon} disabled={!p.canRefresh} onClick={p.onRefresh} aria-label="Refresh observations and priorities"><RefreshCw size={16} className={p.loading?css.spin:""}/></button></div>
 </div><div className={css.focusIdentity}><div className={css.orbit} aria-hidden="true"><i/><i/><i/><span>◎</span></div><small>YOUR SAVED INSTRUMENT</small><strong>{p.symbol || "SELECT"}</strong><span>No additional ticker requests</span><button onClick={a.toggle} className={css.motionButton} aria-label={a.paused?"Resume ambient motion":"Pause ambient motion"}>{a.paused?<Play size={13}/>:<Pause size={13}/>}<span>{a.paused?"Resume motion":"Pause motion"}</span></button></div>
 </header>;}
