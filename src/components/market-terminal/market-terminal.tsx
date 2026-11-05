"use client";

import ResearchBetaBanner from "@/components/strategy-lab/research-beta-banner";
import Link from "next/link";
import {isIndex,instrumentLabel} from "@/lib/market-evidence/instruments";
import DataReadinessPanel from "@/components/data-readiness/data-readiness-panel";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Clock3, Database, LineChart, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { freshness, symbol as exactSymbol } from "@/lib/market-evidence/core";
import { chartRows } from "@/lib/market-evidence/chart-model";
import { DEFAULT_CHART, type ChartSettings } from "@/lib/market-evidence/chart-settings";
import type { Entitlement, MarketRange } from "@/lib/market-evidence/contracts";
import { sectionValue, useMarketResources, type Resource } from "@/lib/market-visuals/client";
import { technicalSummary } from "@/lib/market-visuals/parse";
import type { Section } from "@/lib/market-visuals/contracts";
import css from "./terminal.module.css";
import PriceChart from "@/components/market-pulse/price-chart";
import type { TerminalSeed } from "@/lib/instant-workspace/contracts";
import SourceContinuity from "@/components/instant-workspace/source-continuity";
const GatewayStatus = dynamic(() => import("@/components/market-pulse/gateway-status"));
const Forecast = dynamic(() => import("@/components/intelligence-unified/unified-forecast-panel"), { ssr: false, loading: () => <Placeholder text="Opening the shared forecast…"/> });
const CompanyPanel = dynamic(() => import("./detail-panels").then(m => m.CompanyPanel));
const EarningsPanel = dynamic(() => import("./detail-panels").then(m => m.EarningsPanel));
const NewsPanel = dynamic(() => import("./detail-panels").then(m => m.NewsPanel));
const OptionsPanel = dynamic(() => import("./detail-panels").then(m => m.OptionsPanel));
const EvidencePanel = dynamic(() => import("./detail-panels").then(m => m.EvidencePanel));
const PinePanel = dynamic(() => import("./pine-panel"));
const TABS = [
 ["market", "Market", "Observed price and volume"], ["forecast", "Forecast", "One saved research run"], ["technicals", "Technicals", "Calculated from loaded bars"],
 ["fundamentals", "Company", "Provider overview"], ["earnings", "Earnings", "Reported results"], ["news", "News", "Timestamp-verified sources"],
 ["compare", "Compare", "Timestamp-aligned history"], ["options", "Options", "Explicit entitled lookup"], ["pine", "Pine Lab", "Reviewable code drafts"], ["data", "Data & timing", "Source receipts and load times"],
] as const;
type Tab = typeof TABS[number][0];
type Session = { ok: boolean; scope: string; configured: boolean; entitlement: Entitlement };
const validTab = (v: string | null): Tab => TABS.some(([id]) => id === v) ? v as Tab : v === "overview" || v === "chart" ? "market" : "market";
const validSymbol = (v: string | null) => { try { return exactSymbol(v || "SPY"); } catch { return "SPY"; } };
const number = (v: number | null | undefined, digits = 2) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits });
export function Placeholder({ text = "Waiting for verified provider observations…" }: { text?: string }) { return <div className={css.placeholder} role="status"><div className={css.skeletonLine}/><div className={css.skeletonChart}/><span><Loader2 size={15}/>{text}</span></div>; }
function ResourcePanel({ state, children, title, retry, compact = false }: { state: Resource; children: ReactNode; title: string; retry: () => void; compact?: boolean }) {
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{if(state.retryAt<=Date.now())return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[state.retryAt]);
 const remaining=Math.max(0,Math.ceil((state.retryAt-clock)/1000));
 return <>{state.error && <div className={css.failure} role="alert"><div><strong>{title} could not refresh</strong><p>{state.error}{state.value ? " The last successful snapshot remains visible below; it is not a new observation." : ""}</p></div><button onClick={retry} disabled={state.busy || remaining>0}>{remaining>0?`Retry in ${remaining>=60?`${Math.ceil(remaining/60)} min`:`${remaining}s`}`:"Retry"}</button></div>}
 {state.busy && state.value && <p className={css.update} role="status"><Loader2 size={13}/>Checking for newer evidence…</p>}
 {state.value ? children : state.busy ? compact ? <p className={css.update} role="status"><Loader2 size={13}/>Loading quote independently…</p> : <Placeholder text={`Loading ${title.toLowerCase()} independently…`}/> : !state.error ? <p className={css.empty}>This section loads only when requested.</p> : null}</>;
}
export default function MarketTerminal({ initialData }: { initialData?: TerminalSeed }) {
 const params = useSearchParams(), router = useRouter(), pathname = usePathname();
 const initial = validSymbol(params.get("symbol") || initialData?.defaultSymbol || null), [input, setInput] = useState(initial), [active, setActive] = useState(initial), [tab, setTab] = useState<Tab>(validTab(params.get("view")));
 const [range, setRange] = useState<MarketRange>((["1D","1M","3M","6M","1Y"].includes(params.get("range") || "") ? params.get("range") : params.get("interval") && params.get("interval") !== "daily" ? "1D" : initialData?.defaultRange || "3M") as MarketRange);
 const [session, setSession] = useState<Session | null>(initialData?.session ?? null), [sessionError, setSessionError] = useState(""), [retrySession, setRetrySession] = useState(0);
 const [options, setOptions] = useState<ChartSettings>({ ...DEFAULT_CHART, height: "tall" }), [compareInput, setCompareInput] = useState("SPY"), [comparison, setComparison] = useState<string | null>(null);
 const [auto, setAuto] = useState(false), [online, setOnline] = useState(true), [now, setNow] = useState(initialData?.preparedAt ? Date.parse(initialData.preparedAt) : Date.now()), [notice, setNotice] = useState("");
 const [approvedOptions, setApprovedOptions] = useState(false), [motion, setMotion] = useState(true);
 const tabsRef = useRef<HTMLDivElement>(null);
 const signedOut = useCallback(() => { setSession(null); setSessionError("Session or firm access changed. Sign in again before loading data."); }, []);
 const resources = useMarketResources(session?.scope ?? null, signedOut, initialData?.sections ?? []), { get, load, all } = resources;
 useEffect(() => {
  let alive = true; const c = new AbortController(), t = setTimeout(() => c.abort(), 12000);
  setSessionError("");
  void fetch("/api/market-visuals/sections", { cache: "no-store", credentials: "same-origin", signal: c.signal }).then(async r => {
    const p = await r.json() as Session & { message?: string }; if (r.status === 401 || r.status === 403) { signedOut(); } if (!r.ok || !p.ok) throw new Error(p.message || "Sign in to your firm workspace to use Market Visuals.");
    if (alive) setSession(p);
  }).catch(e => { if (alive) setSessionError(c.signal.aborted ? "Session lookup timed out. Retry without changing your credentials." : e instanceof Error ? e.message : "Session unavailable."); }).finally(() => clearTimeout(t));
  return () => { alive = false; c.abort(); clearTimeout(t); };
 }, [retrySession]);
 useEffect(() => {
  setOnline(navigator.onLine); const update = () => { setOnline(navigator.onLine); setNow(Date.now()); };
  window.addEventListener("online", update); window.addEventListener("offline", update); document.addEventListener("visibilitychange", update);
  const timer = setInterval(() => { if (document.visibilityState === "visible") setNow(Date.now()); }, 30000);
  return () => { clearInterval(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", update); };
 }, []);
 useEffect(() => { const next = validSymbol(params.get("symbol") || initialData?.defaultSymbol || null); setActive(next); setInput(next); setTab(validTab(params.get("view"))); }, [params]);
 const nativeIndex=isIndex(active);
 const wantsChart = ["market", "compare", "technicals"].includes(tab);
 const comparisonSymbol = tab === "compare" ? comparison : options.compareSymbol;
 useEffect(() => {
  if (!session || !session.configured || !online) return;
  if (wantsChart) { void load("quote", active, range); void load("history", active, range); if (comparisonSymbol && comparisonSymbol !== active) void load("history", comparisonSymbol, range); }
  if (!nativeIndex && ["fundamentals", "earnings", "news"].includes(tab)) void load(tab as Section, active, range);
 }, [session, active, tab, range, wantsChart, comparisonSymbol, online, load]);
 useEffect(() => {
  if (!auto || !session?.configured || !wantsChart) return;
  const timer = setInterval(() => { if (navigator.onLine && document.visibilityState === "visible") { void load("quote", active, range, true); void load("history", active, range, true); if (comparisonSymbol && comparisonSymbol !== active) void load("history", comparisonSymbol, range, true); } }, 60000);
  return () => clearInterval(timer);
 }, [auto, session, wantsChart, active, range, comparisonSymbol, load]);
 const q = get("quote", active, range), h = get("history", active, range), quote = sectionValue(q)?.[0] ?? null, series = sectionValue(h);
 const comparative = comparisonSymbol && comparisonSymbol !== active ? get("history", comparisonSymbol, range) : null;
 const company = get("fundamentals", active, range), earnings = get("earnings", active, range), news = get("news", active, range), chain = get("options", active, range);
 useEffect(()=>{const delay=chain.retryAt-Date.now();if(delay<=0)return;const timer=setTimeout(()=>setNow(Date.now()),Math.min(delay+25,86_400_025));return()=>clearTimeout(timer);},[chain.retryAt]);
 const quoteFreshness = quote && session ? freshness(quote.observedAt, quote.precision, session.entitlement, now) : null;
 const receiptRows = all().flatMap(s => s.value?.receipts ?? []), receipts = [...new Map(receiptRows.map(r => [`${r.endpoint}:${r.sha256}`, r])).values()];
 const technicals = useMemo(() => technicalSummary(series ? chartRows(series, options.session) : []), [series, options.session]);
 const currentTab = TABS.find(([id]) => id === tab)!;
 function chooseSymbol() {
  try {
   const s=exactSymbol(input),nextRange=isIndex(s)&&range==="1D"?"1M":range;
   setNotice("");setComparison(null);setApprovedOptions(false);setOptions(previous=>({...previous,compareSymbol:null,referencePrice:null}));
   const query=new URLSearchParams(params.toString());query.set("symbol",s);query.set("range",nextRange);query.delete("researchRunId");query.delete("runId");query.set("view",tab);
   router.replace(`${pathname}?${query}`,{scroll:false});setActive(s);setInput(s);setRange(nextRange);
  } catch(e){setNotice(e instanceof Error?e.message:"Enter a ticker.");}
 }
 function refresh() {
  if (wantsChart) { void load("quote", active, range, true); void load("history", active, range, true); if (comparisonSymbol) void load("history", comparisonSymbol, range, true); }
  else if (!nativeIndex && ["fundamentals", "earnings", "news"].includes(tab)) void load(tab as Section, active, range, true);
 }
 async function share() {
  const u = new URL(window.location.href); u.searchParams.set("symbol", active); u.searchParams.set("view", tab); u.searchParams.set("range", range);
  try { await navigator.clipboard.writeText(u.href); setNotice("Research view link copied. Chart appearance controls remain local to this page."); } catch { setNotice("Copy unavailable. Use the address bar to share the pinned view."); }
 }
 return <main className={css.terminal} data-motion={motion ? "on" : "off"}><ResearchBetaBanner />
  <DataReadinessPanel />
  <div className={css.topline}><Link href="/workspace" prefetch={false}><ArrowLeft size={14}/>Workspace</Link><span>RESEARCH / MARKET VISUALS</span><div><span className={`${css.dot} ${online ? "" : css.offline}`}/>{online ? "Browser online" : "Offline"}</div></div>
  <header className={css.hero}><div className={css.heroText}><p className={css.kicker}><LineChart size={15}/>SLICE MARKET INTELLIGENCE</p><h1>A clearer view.<br/><span>A faster decision.</span></h1><p>Observed markets, explainable signals and one shared forecast. Each section loads independently—without collecting data you did not ask for.</p><div className={css.heroTags}><span><ShieldCheck size={12}/>Alpha Vantage observations</span><span><Zap size={12}/>Local chart controls</span><span><Database size={12}/>Source receipts retained</span></div></div><div className={css.heroQuote}><span className={css.label}>{active} / {nativeIndex?"COMPLETED INDEX CLOSE":"LAST PROVIDER QUOTE"}</span><strong>{quote ? number(quote.price) : "—"}<small>{company.value?.data.currency ? ` ${company.value.data.currency}` : ""}</small></strong><p className={quote?.changePct != null && quote.changePct < 0 ? css.negative : css.positive}>{quote?.changePct == null ? "Open Market to load a quote" : `${quote.changePct > 0 ? "+" : ""}${number(quote.changePct)}% vs prior close`}</p><span className={css.badge}>{quoteFreshness?.state ?? "Not loaded"}</span><small>{quote ? `${quote.observedAt} · ${quote.priceKind}` : "No sample prices. No implied live status."}</small></div></header>
  {sessionError && <div className={css.failure} role="alert"><p>{sessionError}</p><button onClick={() => setRetrySession(v => v+1)}>Retry session</button><Link href="/advisor-login">Sign in</Link></div>}
  {session && !session.configured && <div className={css.failure} role="alert"><p>The server market credential is missing or is a demonstration key. No substitute prices were generated. Ask your administrator to check the private provider configuration.</p></div>}
  {notice && <div className={css.notice} role="status"><p>{notice}</p><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
  <div className={css.commandBar}><form onSubmit={e => { e.preventDefault(); chooseSymbol(); }} className={css.symbolForm}><Search size={17}/><label className={css.srOnly} htmlFor="market-symbol">Instrument symbol</label><input id="market-symbol" value={input} onChange={e => setInput(e.target.value.toUpperCase())} maxLength={21} spellCheck={false} autoComplete="off"/><button type="submit">Load</button></form>
   <div className={css.rangeGroup} aria-label="Observed history range">{(["1D","1M","3M","6M","1Y"] as MarketRange[]).map(r => <button key={r} aria-pressed={range === r} className={range === r ? css.selected : ""} disabled={r==="1D"&&(nativeIndex||session?.entitlement==="historical")} onClick={() => setRange(r)}>{r}</button>)}</div>
   <div className={css.commandActions}><button disabled={!session?.configured || !online || tab === "options" || tab === "forecast" || tab === "pine" || tab === "data"} onClick={refresh}><RefreshCw size={14}/>Refresh section</button><button aria-pressed={auto} onClick={() => setAuto(v => !v)}>{auto ? <Check size={14}/> : <Clock3 size={14}/>}Auto {auto ? "on · 60s" : "off"}</button><button onClick={() => void share()}>Share view</button></div>
  </div>
  <div className={css.tabBar} ref={tabsRef} role="tablist" aria-label="Market research sections">{TABS.map(([id, label, helper], index) => <button id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} key={id} className={tab === id ? css.activeTab : ""} onClick={() => setTab(id)} onKeyDown={e => { let target = index; if (e.key === "ArrowRight") target = (index+1)%TABS.length; else if (e.key === "ArrowLeft") target = (index+TABS.length-1)%TABS.length; else if (e.key === "Home") target = 0; else if (e.key === "End") target = TABS.length-1; else return; e.preventDefault(); setTab(TABS[target][0]); tabsRef.current?.querySelectorAll<HTMLButtonElement>("button")[target]?.focus(); }}><span>{label}</span><small>{helper}</small></button>)}</div>
  <section className={css.panel} role="tabpanel" aria-labelledby={`tab-${tab}`} id={`panel-${tab}`}>
   {!session && !sessionError && <Placeholder text="Checking protected firm access…"/>}
   {session && wantsChart && <><div className={css.sectionHead}><div><p className={css.kicker}>Observed data · {range === "1D" ? "5-minute bars" : "daily bars"}</p><h2>{tab === "compare" ? "Compare on common observations" : tab === "technicals" ? "Price structure, not manufactured scores" : `${active} / ${nativeIndex?"index levels":"price & volume"}`}</h2><p>{range === "1D" ? "Latest returned session. Completed five-minute bars only." : nativeIndex ? "Native daily index levels, not an ETF or an intraday quote. Volume is not supplied." : "Raw as-traded prices. Splits and dividends are not adjusted; percentage change is not total return."}</p></div><button onClick={() => setMotion(v => !v)} aria-pressed={motion}>Chart motion {motion ? "on" : "off"}</button></div>
    {tab === "compare" && <form className={css.controls} onSubmit={e => { e.preventDefault(); try { const s = exactSymbol(compareInput); if (s === active) throw new Error("Choose a different comparison instrument."); setComparison(s); setNotice(""); } catch (err) { setNotice(err instanceof Error ? err.message : "Check the symbol."); } }}><label>Compare with<input value={compareInput} maxLength={21} onChange={e => setCompareInput(e.target.value.toUpperCase())}/></label><button type="submit" className={css.primary}>Load comparison</button>{comparison && <button type="button" onClick={() => setComparison(null)}>Remove</button>}<span className={css.fine}>Exact timestamps; one shared percentage baseline. Missing observations stay missing.</span></form>}
    <ResourcePanel compact state={q} title="Quote" retry={() => void load("quote",active,range,true)}><div className={css.observationStrip}><span><strong>Quote</strong> {quote?.observedAt}</span><span>{quoteFreshness?.note}</span></div></ResourcePanel>
    {comparative?.error && <p className={css.failure} role="alert">Comparison unavailable: {comparative.error}. The primary history is still usable.</p>}
    <ResourcePanel state={h} title="Price history" retry={() => void load("history",active,range,true)}>{series && <><PriceChart series={series} comparison={comparative ? sectionValue(comparative) : null} options={{ ...options, compareSymbol: comparisonSymbol }} symbols={[...new Set([active, comparisonSymbol].filter((v): v is string => Boolean(v)))]} motion={motion} onOptionsChange={next => { setOptions(next); if (tab === "compare") setComparison(next.compareSymbol); }}/><p className={css.fine}>{series.note}</p></>}</ResourcePanel>
    {tab === "technicals" && <div className={css.metricGrid}>{technicals.map(m => <div key={m.label} className={css.metric}><span>{m.label}</span><strong>{number(m.value)} <small>{m.value === null ? "" : m.suffix}</small></strong><small>{m.detail}</small></div>)}</div>}
    <div className={css.connectedStrip}><div><Sparkles size={18}/><span><strong>Continue with the same instrument</strong><small>Saved predictions remain separate from newly observed prices.</small></span></div><Link href={`/workspace/personal-bot?${new URLSearchParams({ marketSymbol: active, prompt: `Explain the observed market evidence for ${active}. Distinguish it from any saved forecasts.` })}`} prefetch={false}>Explain in AI Studio <ArrowUpRight size={14}/></Link>{!nativeIndex&&<button onClick={() => setTab("forecast")}>Open shared forecast →</button>}</div>
   </>}
   {session && !nativeIndex && tab === "forecast" && <Forecast symbol={active} researchRunId={params.get("researchRunId")}/>}
   {session && nativeIndex && ["fundamentals","earnings","news","options","forecast"].includes(tab) && <div className={css.empty}><h3>{instrumentLabel(active)} · native index</h3><p>This view supplies completed daily index levels and price-derived technicals. Company earnings, equity options, equity-news filters, and the equity forecast model are not applied to a native index. Select Market or Technicals; no ETF proxy is substituted.</p></div>}
   {session && !nativeIndex && tab === "fundamentals" && <ResourcePanel state={company} title="Company overview" retry={() => void load("fundamentals",active,range,true)}>{company.value && <CompanyPanel data={company.value.data}/>}</ResourcePanel>}
   {session && !nativeIndex && tab === "earnings" && <ResourcePanel state={earnings} title="Earnings" retry={() => void load("earnings",active,range,true)}>{earnings.value && <EarningsPanel data={earnings.value.data}/>}</ResourcePanel>}
   {session && !nativeIndex && tab === "news" && <ResourcePanel state={news} title="News" retry={() => void load("news",active,range,true)}>{news.value && <NewsPanel items={news.value.data}/>}</ResourcePanel>}
   {session && !nativeIndex && tab === "options" && <><GatewayStatus/><div className={css.optionsGate}><div><h2>Load an entitled options snapshot</h2><p>This section is never collected during initial page loading or automatic refresh. Endpoint access may require an additional entitlement.</p></div><label className={css.check}><input type="checkbox" checked={approvedOptions} onChange={e => setApprovedOptions(e.target.checked)}/>I approve a provider request</label><button className={css.primary} disabled={!approvedOptions || chain.busy || !online || !session.configured || chain.retryAt > now} onClick={() => { void load("options",active,range,true); setApprovedOptions(false); }}>{chain.busy ? "Loading…" : "Request snapshot"}</button></div><ResourcePanel state={chain} title="Options" retry={() => { setApprovedOptions(false); setNotice("Approve another options request using the control above."); }}>{chain.value && <OptionsPanel key={chain.value.preparedAt} data={chain.value.data}/>}</ResourcePanel></>}
   {session && tab === "pine" && <PinePanel key={active} symbol={active} interval={range === "1D" ? "5min" : "daily"} marketContext={{ price: quote?.price, asOf: quote?.observedAt, source: quote?.endpoint, lastCompletedBar: series?.bars.at(-1) }}/>}
   {session && tab === "data" && <><GatewayStatus/><EvidencePanel receipts={receipts}/><h3 className={css.subhead}>Measured section requests in this visit</h3><div className={css.tableWrap}><table><thead><tr><th>Section</th><th>Symbol</th><th>Server time</th><th>Browser round trip</th><th>State</th></tr></thead><tbody>{all().map((r,i) => <tr key={i}><td>{r.value?.section ?? "Unsuccessful request"}</td><td>{r.value?.symbol ?? "—"}</td><td>{r.value ? `${number(r.value.elapsedMs,0)} ms` : "—"}</td><td>{r.durationMs == null ? "—" : `${number(r.durationMs,0)} ms`}</td><td>{r.busy ? "Loading" : r.error ? "Needs attention" : "Loaded"}</td></tr>)}</tbody></table></div><p className={css.fine}>These measurements include network and server work. They are not a promise of future speed. Provider retrieval time and observation time are shown separately.</p></>}
  </section>
  <SourceContinuity rows={all().flatMap(r => r.value ? [r.value] : [])} symbol={active} updating={q.busy || h.busy} cold={!q.value && !h.value} />
  <footer className={css.footer}><span><ShieldCheck size={13}/>No fabricated prices · no autonomous trading</span><span>{currentTab[2]}</span><Link href="/market-visuals/classic" prefetch={false}>Classic tools / legacy intervals <ChevronDown size={12}/></Link></footer>
 </main>;
}
