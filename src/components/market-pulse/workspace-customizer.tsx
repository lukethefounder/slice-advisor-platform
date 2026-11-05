"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { PulsePreferences, MarketRange } from "@/lib/market-evidence/contracts";
import { INDEX_CHOICES, isIndex } from "@/lib/market-evidence/instruments";
import { DEFAULT_HOME } from "@/lib/market-evidence/home-presentation";
import { parsePreferences } from "@/lib/market-evidence/core";
import { DEFAULT_CHART, WIDGET_IDS, type ChartSettings, type WidgetId } from "@/lib/market-evidence/chart-settings";
import css from "./customizer.module.css";
const LABELS: Record<WidgetId,string> = { tasks:"Focus queue", research:"Saved research", scenarios:"Paper scenarios", news:"Current headlines" };
export default function WorkspaceCustomizer({ preferences, suggested, saving, message, onSave, onClose }: {
  preferences: PulsePreferences; suggested: string[]; saving: boolean; message: string;
  onSave: (value: PulsePreferences) => void; onClose: () => void;
}) {
  const [draft,setDraft]=useState<PulsePreferences>(()=>({...preferences,chart:{...(preferences.chart??DEFAULT_CHART)},widgetOrder:[...(preferences.widgetOrder??WIDGET_IDS)]}));
  const [symbolText,setSymbolText]=useState(preferences.primary), [error,setError]=useState("");
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};},[]);
  const chart=draft.chart??DEFAULT_CHART,order=draft.widgetOrder??[...WIDGET_IDS];
  const home=draft.presentation??DEFAULT_HOME;
  function patchHome(p:Partial<typeof home>){setDraft({...draft,presentation:{...home,...p}});}
  const options=symbolText.trim()?[symbolText.trim().toUpperCase()]:[];
  function patchChart(p:Partial<ChartSettings>){setDraft({...draft,chart:{...chart,...p}});}
  function move(index:number,by:number){const next=[...order],target=index+by;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];setDraft({...draft,widgetOrder:next});}
  function submit(){setError("");try{onSave(parsePreferences({...draft,symbols:[symbolText.trim()],primary:symbolText.trim(),chart:{...chart,compareSymbol:null},range:isIndex(symbolText.trim().toUpperCase())&&draft.range==="1D"?"1M":draft.range}));}catch(e){setError(e instanceof Error?e.message:"Check your workspace preferences.");}}
  return <dialog ref={dialog} className={css.dialog} aria-labelledby="slice-customize-title" onCancel={e=>{e.preventDefault();if(!saving)onClose();}}>
    <div className={css.header}><div><small>MAKE IT YOURS</small><h2 id="slice-customize-title">Your workspace, refined.</h2><p>Saved to your account and firm. Your sidebar stays unchanged.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close customization"><X size={19}/></button></div>
    <fieldset className={css.body} disabled={saving}>
      <section><h3>01 / Your opening instrument</h3><div className={css.grid}><label className={css.wide}>One stock, ETF, or native index<input aria-label="Opening instrument" value={symbolText} maxLength={21} list="slice-focus-instruments" onChange={e=>setSymbolText(e.target.value.toUpperCase())}/><small>Exactly one instrument is shown and saved for your next visit. Stocks: MSFT. Native indices: INDEX:SPX.</small></label>
      <datalist id="slice-focus-instruments">{[...new Set(suggested)].map(s=><option key={s} value={s}/>)}{INDEX_CHOICES.map(i=><option key={i.symbol} value={i.symbol}>{i.name}</option>)}</datalist>
      <label>Default range<select aria-label="Default chart range" value={draft.range} onChange={e=>setDraft({...draft,range:e.target.value as MarketRange})}><option value="1D" disabled={isIndex(symbolText.trim().toUpperCase())}>1D · latest intraday session</option><option value="1M">1M · up to 23 daily bars</option><option value="3M">3M · up to 65 daily bars</option><option value="6M">6M · up to 126 daily bars</option><option value="1Y">1Y · up to 252 daily bars</option></select></label></div>
      <div className={css.suggestions}>{suggested.slice(0,6).map(s=><button type="button" key={s} onClick={()=>setSymbolText(s)}>{s}</button>)}</div><p className={css.hint}>INDEX: identifiers use Alpha Vantage native completed daily index levels, not an ETF proxy. Index, intraday, and longer-history access depend on your provider account. No index volume is invented.</p></section>
      <section><h3>02 / Chart appearance</h3><div className={css.grid}>
      <label>Default chart<select value={chart.mode} onChange={e=>patchChart({mode:e.target.value as ChartSettings["mode"]})}><option value="area">Area</option><option value="line">Line</option><option value="candles">Candlesticks</option></select></label>
      <label>Default scale<select value={chart.scale} onChange={e=>patchChart({scale:e.target.value as ChartSettings["scale"]})}><option value="price">Raw price</option><option value="percent">Percentage</option><option value="log">Logarithmic</option></select></label>
      <label>Chart accent<select value={chart.accent} onChange={e=>patchChart({accent:e.target.value as ChartSettings["accent"]})}><option value="emerald">Emerald</option><option value="cyan">Cyan</option><option value="violet">Violet</option></select></label>
      <label>Chart height<select value={chart.height} onChange={e=>patchChart({height:e.target.value as ChartSettings["height"]})}><option value="compact">Compact</option><option value="standard">Standard</option><option value="tall">Tall</option></select></label></div>
      <div className={css.checks}>{([["showVolume","Volume"],["showGrid","Grid"],["showCrosshair","Crosshair"],["sma20","SMA 20"],["sma50","SMA 50"],["ema20","EMA 20"],["bands20","20-bar dispersion bands"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={chart[key]} onChange={e=>patchChart({[key]:e.target.checked})}/>{label}</label>)}</div></section>
      <section><h3>03 / Arrange your information</h3><ol className={css.widgetList}>{order.map((id,index)=>{const visibility={tasks:"showTasks",research:"showResearch",scenarios:"showScenarios",news:"showNews"}[id] as "showTasks"|"showResearch"|"showScenarios"|"showNews";return <li key={id}><span>{index+1}</span><label><input type="checkbox" checked={draft[visibility]} onChange={e=>setDraft({...draft,[visibility]:e.target.checked})}/>{LABELS[id]}</label><button type="button" aria-label={`Move ${LABELS[id]} earlier`} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={14}/></button><button type="button" aria-label={`Move ${LABELS[id]} later`} disabled={index===order.length-1} onClick={()=>move(index,1)}><ArrowDown size={14}/></button></li>;})}</ol></section>
      <section><h3>04 / Make the page yours</h3><div className={css.grid}>
       <label className={css.wide}>Workspace heading<input maxLength={60} value={home.title} placeholder="Your personal market workspace" onChange={e=>patchHome({title:e.target.value})}/></label>
       <label className={css.wide}>Subtitle<input maxLength={140} value={home.subtitle} onChange={e=>patchHome({subtitle:e.target.value})}/></label>
       <label>Page layout<select value={home.layout} onChange={e=>patchHome({layout:e.target.value as "split"|"wide"})}><option value="split">Chart with side rail</option><option value="wide">Full-width chart first</option></select></label>
       <label>Page density<select value={home.density} onChange={e=>patchHome({density:e.target.value as "comfortable"|"compact"})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      </div><div className={css.checks}>{([["showFocus","Daily intention"],["showAttention","Attention summary"],["showSources","Source-version details"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={home[key]} onChange={e=>patchHome({[key]:e.target.checked})}/>{label}</label>)}</div></section>
      <section><h3>05 / Your working rhythm</h3><div className={css.grid}><label>Automatic refresh<select value={draft.refreshSeconds} onChange={e=>setDraft({...draft,refreshSeconds:Number(e.target.value) as PulsePreferences["refreshSeconds"]})}><option value={0}>Off · manual</option><option value={60}>Every 60 seconds</option><option value={180}>Every 3 minutes</option><option value={600}>Every 10 minutes</option></select><small>Paused in hidden tabs, while offline, and while editing. Provider quotas still apply.</small></label>
      <label>Workspace emphasis<select value={draft.focus} onChange={e=>setDraft({...draft,focus:e.target.value as PulsePreferences["focus"]})}><option value="balanced">Balanced</option><option value="markets">Markets</option><option value="clients">Client work</option></select></label><label className={css.wide}>Daily intention<input value={draft.dailyFocus} maxLength={180} placeholder="Your most important focus today" onChange={e=>setDraft({...draft,dailyFocus:e.target.value})}/></label></div><label className={css.motion}><input type="checkbox" checked={draft.motion} onChange={e=>setDraft({...draft,motion:e.target.checked})}/>Subtle animation. Reduced-motion accessibility settings take priority.</label></section>
    </fieldset>
    <div className={css.footer}>{(error||message)&&<p role="alert">{error||message}</p>}<div><button type="button" className={css.cancel} onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={css.save} onClick={submit} disabled={saving}>{saving?"Saving…":"Save my workspace"}</button></div><small>Your opening instrument, layout, chart, visibility, and order are saved per user and firm. The sidebar is unchanged.</small></div>
  </dialog>;
}
