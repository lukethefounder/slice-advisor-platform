"use client";
import Link from "next/link";
import {DEFAULT_HOME} from "@/lib/market-evidence/home-presentation";
import {isIndex,instrumentLabel} from "@/lib/market-evidence/instruments";
import focusCss from "@/components/market-pulse/focus-home.module.css";
import DataReadinessPanel from "@/components/data-readiness/data-readiness-panel";
import { prioritizedWorkspaceRequests } from "@/lib/data-readiness/priority";
import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, ChevronRight, CirclePause, Clock3, Focus, Newspaper, RefreshCw, Settings2, Sparkles, ShieldCheck } from "lucide-react";
import { useWorkspaceSession } from "./session";
import { studioJson } from "@/lib/studio/client";
import type { HomeSummary } from "@/lib/workspace/home-contract";
import type { MarketRange, PreferenceResponse, PulsePreferences } from "@/lib/market-evidence/contracts";
import { freshness, parsePreferences } from "@/lib/market-evidence/core";
import { figure, formatObservation } from "@/components/market-pulse/market-evidence-card";
import { DEFAULT_CHART, parseChartSettings, WIDGET_IDS, type ChartSettings } from "@/lib/market-evidence/chart-settings";
import css from "@/components/market-pulse/pulse.module.css";
import PriceChart from "@/components/market-pulse/price-chart";
import { useMarketResources } from "@/lib/market-visuals/client";
import { composeWorkspaceEvidence } from "@/lib/instant-workspace/compose";
import type { WorkspaceSeed } from "@/lib/instant-workspace/contracts";
import SourceContinuity from "@/components/instant-workspace/source-continuity";
const GatewayStatus = dynamic(() => import("@/components/market-pulse/gateway-status"));
const MarketConnectionPanel = dynamic(() => import("@/components/market-pulse/market-connection-panel"));
const WorkspaceCustomizer = dynamic(() => import("@/components/market-pulse/workspace-customizer"));
function requestKey(p: PulsePreferences) { return JSON.stringify({symbols:p.symbols,primary:p.primary,range:p.range,news:p.showNews,comparison:p.chart?.compareSymbol??null}); }
function dayLabel() { return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
function statusLabel(state: string) { return state === "realtime" ? "Recent realtime observation" : state === "end-of-day" ? "Date-only quote" : state === "delayed" ? "Delayed observation" : "Last observed · stale"; }
export default function WorkspaceHome({ initial }: { initial?: WorkspaceSeed }) {
 const session = useWorkspaceSession();
 const userKey = `${session.user?.id || ""}:${session.firm?.id || ""}`;
 const [settings, setSettings] = useState<PreferenceResponse | null>(initial?.settings ?? null), [summary, setSummary] = useState<HomeSummary | null>(initial?.summary ?? null);
 const [savedPreferences, setSavedPreferences] = useState<PulsePreferences | null>(initial?.settings?.preferences ?? null), [customizing, setCustomizing] = useState(false), [saving, setSaving] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [summaryError, setSummaryError] = useState(""), [preferenceError, setPreferenceError] = useState(""), [connection, setConnection] = useState(false), [visible, setVisible] = useState(true), [online, setOnline] = useState(true), [day, setDay] = useState("Your working day"), [now, setNow] = useState(initial?.preparedAt ? Date.parse(initial.preparedAt) : Date.now()), [osReduced, setOsReduced] = useState(false), [localPaused, setLocalPaused] = useState(false), [saveMessage, setSaveMessage] = useState("");
 const marketAbort = useRef<AbortController | null>(null), bootAbort = useRef<AbortController | null>(null), marketSerial = useRef(0), inFlight = useRef(false), initialized = useRef(0), root = useRef<HTMLElement>(null), saveAbort = useRef<AbortController | null>(null);
 const [viewOwner, setViewOwner] = useState(initial?.scope ?? userKey);
 const prefs = settings?.preferences, presentation=prefs?.presentation??DEFAULT_HOME, motion = Boolean(prefs?.motion && !osReduced && visible && !localPaused);
 const refreshSummary = useCallback(async (signal?: AbortSignal) => { try { const r = await studioJson<HomeSummary>("/api/workspace/home", { signal }); if (!signal?.aborted) { setSummary(r); setSummaryError(""); } } catch (e) { if (!signal?.aborted) setSummaryError(e instanceof Error ? e.message : "Your priorities are unavailable."); } }, []);
 const unauthorized = useCallback(() => { setSettings(null); setSummary(null); setPreferenceError("Your session or firm changed. Reload before accessing private data."); }, []);
 const resources = useMarketResources(session.user && session.firm ? userKey : null, unauthorized, initial?.sections ?? []);
 const { load, all } = resources;
 const evidence = composeWorkspaceEvidence(prefs, settings?.market.entitlement ?? "historical", all(), initial?.preparedAt ?? new Date(now).toISOString());
 const loadMarket = useCallback(async (p: PulsePreferences, _reset = false, force = false) => {
  const serial = ++marketSerial.current; inFlight.current = true; setLoading(true); setError("");
  try {
    for (const batch of prioritizedWorkspaceRequests(p).map(batch=>batch.filter(r=>r.section!=="news"))) {
      if (serial !== marketSerial.current) break;
      await Promise.allSettled(batch.map(r => load(r.section, r.symbol, p.range, force)));
    }
  }
  finally { if (serial === marketSerial.current) { setLoading(false); inFlight.current = false; } }
 }, [load]);
 useEffect(() => {
  const change = () => { setVisible(!document.hidden); setOnline(navigator.onLine); setDay(dayLabel()); setNow(Date.now()); };
  const media = matchMedia("(prefers-reduced-motion: reduce)"), reduce = () => setOsReduced(media.matches); reduce(); change();
  const t = window.setInterval(() => { if (!document.hidden) { setNow(Date.now()); setDay(dayLabel()); } }, 60000);
  document.addEventListener("visibilitychange", change); window.addEventListener("online", change); window.addEventListener("offline", change); media.addEventListener("change", reduce);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", change); window.removeEventListener("online", change); window.removeEventListener("offline", change); media.removeEventListener("change", reduce); };
 }, []);
 useEffect(() => {
  const generation = ++initialized.current, c = new AbortController(); bootAbort.current?.abort(); bootAbort.current = c; marketAbort.current?.abort(); marketSerial.current++; inFlight.current = false;
  const seedMatches = initial?.scope === userKey && Boolean(initial.settings);
  saveAbort.current?.abort(); setSaving(false); setSavedPreferences(seedMatches ? initial!.settings!.preferences : null); setViewOwner(userKey); setSettings(seedMatches ? initial!.settings : null); setSummary(seedMatches ? initial!.summary : null); setCustomizing(false); setConnection(false); setError(""); setPreferenceError(""); setLoading(false); setLocalPaused(false);
  if (!session.user || !session.firm) return () => c.abort();
  if (!seedMatches || !initial?.summary) void refreshSummary(c.signal);
  if (seedMatches) {
    if (initial!.settings!.market.configured) void loadMarket(initial!.settings!.preferences);
  } else {
    void studioJson<PreferenceResponse>("/api/workspace/pulse", { signal: c.signal }).then(r => { if (c.signal.aborted || generation !== initialized.current) return; setSettings(r); setSavedPreferences(r.preferences); if (r.market.configured) void loadMarket(r.preferences); }).catch(e => { if (!c.signal.aborted) setPreferenceError(e instanceof Error ? e.message : "Your saved workspace could not be loaded."); });
  }
  return () => { c.abort(); saveAbort.current?.abort(); marketAbort.current?.abort(); marketSerial.current++; inFlight.current = false; };
 // Identity changes invalidate every client-held response; sensitive payloads are not in browser storage.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [userKey, loadMarket, refreshSummary]);
 useEffect(() => {
  if (!prefs?.refreshSeconds || !settings?.market.configured || !visible || !online || localPaused || customizing || saving) return;
  const t = window.setInterval(() => { if (!document.hidden && navigator.onLine && !inFlight.current) { void loadMarket(prefs, false, true); void refreshSummary(bootAbort.current?.signal); } }, prefs.refreshSeconds * 1000);
  return () => clearInterval(t);
 }, [prefs, settings?.market.configured, visible, online, localPaused, customizing, saving, loadMarket, refreshSummary]);
 function customize() { if (!prefs) return; setSaveMessage(""); setCustomizing(true); }
 async function persist(nextInput: PulsePreferences, closePanel = false) {
  if (!settings || saving) return; let next: PulsePreferences; setSaveMessage("");
  try { next = parsePreferences(nextInput); } catch (e) { setSaveMessage(e instanceof Error ? e.message : "Check your preferences."); return; }
  const c = new AbortController(); saveAbort.current?.abort(); saveAbort.current = c;
  const generation = initialized.current, previousRequest = requestKey(settings.preferences); setSaving(true);
  try {
   const r = await studioJson<{ preferences: PulsePreferences; revision: string }>("/api/workspace/pulse", { method: "PUT", signal: c.signal, body: JSON.stringify({ preferences: next, revision: settings.revision }) });
   if (c.signal.aborted || generation !== initialized.current) return;
   setSettings(current => current ? { ...current, preferences: r.preferences, revision: r.revision } : current);
   setSavedPreferences(r.preferences); setSaveMessage("Workspace view saved to your account.");
   if (closePanel) setCustomizing(false);
   if (settings.market.configured && previousRequest !== requestKey(r.preferences)) void loadMarket(r.preferences);
  } catch (e) { if (!c.signal.aborted && generation === initialized.current) setSaveMessage(e instanceof Error ? e.message : "Preferences were not saved. Your local view is still open."); }
  finally { if (generation === initialized.current) setSaving(false); }
 }
 function updateChart(next: ChartSettings) {
  if (!prefs || !settings || saving) return;
  setSaveMessage(""); const chart = parseChartSettings({...next,compareSymbol:null},[prefs.primary],prefs.primary), p = { ...prefs, chart };
  setSettings({ ...settings, preferences:p });
  if (chart.compareSymbol && (prefs.chart?.compareSymbol ?? null) !== chart.compareSymbol && settings.market.configured) void loadMarket(p);
 }
 function range(r: MarketRange) { if (!prefs || !settings || saving) return; setSaveMessage(""); const p = { ...prefs, range: r }; setSettings({ ...settings, preferences: p }); if(settings.market.configured) void loadMarket(p, true); }
 function selectSymbol(s: string) { if (!prefs || !settings || saving) return; setSaveMessage(""); const chart = { ...parseChartSettings(prefs.chart,prefs.symbols,s), referencePrice: null }; const p = { ...prefs, primary: s, chart }; setSettings({ ...settings, preferences: p }); if(settings.market.configured) void loadMarket(p, true); }
 const dirty = Boolean(prefs && savedPreferences && JSON.stringify(prefs) !== JSON.stringify(savedPreferences));
 const quotes = (evidence?.quotes || []).map(q => { try { return { ...q, ...freshness(q.observedAt, q.precision, evidence!.entitlement, now) }; } catch { return { ...q, state: "unavailable" as const }; } });
 const quote = quotes.find(q => q.symbol === prefs?.primary), identity = summary?.identity, firstName = (identity?.name || session.user?.name || "").split(" ")[0];
 const taskData = summary?.tasks.state === "ready" ? summary.tasks.data : null, scenarioData = summary?.scenarios.state === "ready" ? summary.scenarios.data : null, researchData = summary?.research.state === "ready" ? summary.research.data.filter(r=>r.symbol===prefs?.primary) : null;
 const studioHref = `/workspace/personal-bot?marketSymbol=${encodeURIComponent(prefs?.primary || "SPY")}&prompt=${encodeURIComponent(`Explain the latest verified observations for ${prefs?.primary || "SPY"}, note the source times and any limitations, and identify questions worth researching. Do not invent a forecast.`)}`;
 if (viewOwner !== userKey) return <main className={css.dashboard}><p role="status">Loading your workspace…</p></main>;
 return <main ref={root} className={`${css.dashboard} ${focusCss.home}`} data-layout={presentation.layout} data-density={presentation.density} data-accent={prefs?.chart?.accent??"emerald"} data-motion={motion ? "on" : "off"} data-focus={prefs?.focus || "balanced"}>
  <div className={css.ambient} aria-hidden="true"/><header className={css.topline}><div><div className={css.eyebrow}>PERSONAL WORKSPACE <span> / </span> {day}</div><h1>{presentation.title || (firstName ? `${firstName}’s market focus` : "Your market focus")}<span>.</span></h1><p>{presentation.subtitle}</p></div><div className={css.topActions}><button className={css.iconButton} title="Refresh observations and priorities" aria-label="Refresh observations and priorities" disabled={!prefs || loading || !online || saving} onClick={() => { if (prefs) void loadMarket(prefs, false, true); void refreshSummary(bootAbort.current?.signal); }}><RefreshCw size={16} className={loading ? css.spin : ""}/></button><button className={css.button} onClick={customize} disabled={!prefs || saving}><Settings2 size={15}/>Personalize</button></div></header>
  {(preferenceError || session.error) && <p className={css.warning} role="alert">{preferenceError || session.error} <button className={css.textButton} onClick={() => window.location.reload()}>Reload workspace</button></p>}
  {!session.loading && !session.user && <p className={css.warning}><Link href="/advisor-login">Sign in to load your own workspace.</Link></p>}
  <div className={css.controlLine}><span className={css.statePill}><i className={loading ? css.busyDot : ""}/>{loading ? "Updating observations" : evidence?.quotes.length || evidence?.series ? "Alpha Vantage evidence" : evidence?.issues.length ? "Data needs attention" : settings?.market.configured ? "Ready to load observations" : "Market connection needs verification"}</span><span>{prefs?.refreshSeconds ? `Refresh ${prefs.refreshSeconds}s${localPaused ? " · paused" : ""}` : "Manual refresh"}</span><button className={css.textButton} onClick={() => setLocalPaused(v => !v)} disabled={!prefs}><CirclePause size={13}/>{localPaused ? "Resume motion & refresh" : "Pause motion & refresh"}</button><button className={css.textButton} onClick={() => setConnection(v => !v)}><ShieldCheck size={13}/>Connection</button>{!online && <strong className={css.down}>Offline</strong>}</div>
  {connection && <><MarketConnectionPanel symbol={prefs?.primary || "SPY"} disabled={loading}/><GatewayStatus/></>}
  {error && <p className={css.warning} role="alert">{error}{evidence ? " Previously received data remains below with its original observation times." : ""}</p>}
  {evidence?.issues.length ? <details className={css.issueDetails}><summary>{evidence.issues.length} data notice{evidence.issues.length === 1 ? "" : "s"} · review coverage</summary>{evidence.issues.map(i => <p key={i.scope + i.code}>{i.scope}: {i.message}</p>)}</details> : null}
  <div className={css.viewSave}><span>{dirty ? "Unsaved view · display changes are local until saved" : "Your saved workspace view"}</span><button type="button" className={css.button} disabled={!dirty || saving || !online} onClick={() => prefs && void persist(prefs)}>{saving ? "Saving…" : "Save view"}</button>{saveMessage && !customizing && <small role="status">{saveMessage}</small>}</div>
  <details className={css.issueDetails}><summary>Storage and connection readiness</summary><DataReadinessPanel /></details>
  {presentation.showSources && <SourceContinuity rows={all().flatMap(r => r.value ? [r.value] : [])} symbol={prefs?.primary ?? ""} updating={loading} cold={!evidence} />}
  <section className={focusCss.instrument} aria-label="Your one saved opening instrument"><div className={focusCss.instrumentMark} aria-hidden="true">{isIndex(prefs?.primary??"")?"I":"S"}</div><div><small>YOUR OPENING INSTRUMENT</small><h2>{instrumentLabel(prefs?.primary||"Choose your instrument")}</h2><p>{prefs?.primary} · {isIndex(prefs?.primary??"")?"Native index · completed daily levels":"Stock / ETF · provider observations"}</p></div><button type="button" className={css.button} onClick={customize} disabled={!prefs}>Change & personalize</button></section>
  <div className={`${css.mainGrid} ${focusCss.mainGrid}`}>
   <section className={`${css.card} ${css.marketCard}`}><div className={css.cardTop}><div><div className={css.eyebrow}>MARKET LENS</div><h2>{prefs?.primary || "Your instrument"}<span className={css.soft}> / Observed price</span></h2></div><div className={css.segment} role="group" aria-label="Chart range">{(["1D", "1M", "3M", "6M", "1Y"] as MarketRange[]).map(r => <button key={r} className={prefs?.range === r ? css.segmentActive : ""} aria-pressed={prefs?.range === r} disabled={saving || !prefs || (r === "1D" && (settings?.market.entitlement === "historical" || isIndex(prefs?.primary??"")))} onClick={() => range(r)}>{r}</button>)}</div></div>
   <div className={css.marketHeadline}><div><strong>{figure(quote?.price)}</strong><span className={quote?.changePct != null && quote.changePct < 0 ? css.down : css.up}>{quote?.changePct != null && quote.changePct > 0 ? "+" : ""}{quote?.changePct==null?"—":`${figure(quote.changePct)}%`}<small>vs. previous close</small></span></div><small>{quote ? statusLabel(quote.state) : "Awaiting a verified quote"}<br/>{quote ? quote.priceKind : "No placeholder prices"}</small></div>
   <div className={focusCss.quoteFacts}><span><small>Previous close</small><b>{figure(quote?.previousClose)}</b></span><span><small>{isIndex(prefs?.primary??"")?"Daily change · points":"Quote change"}</small><b>{figure(quote?.change)}</b></span><span><small>Provider volume</small><b>{quote?.volume==null?"Not supplied":figure(quote.volume,0)}</b></span><span><small>Observed at</small><b>{quote?formatObservation(quote.observedAt):"Awaiting source"}</b></span></div>
   {evidence?.series && evidence.series.symbol === prefs?.primary && evidence.series.range === prefs?.range ? <PriceChart series={evidence.series} comparison={evidence.comparison} motion={motion} options={prefs.chart ?? DEFAULT_CHART} symbols={[prefs.primary]} onOptionsChange={saving ? undefined : updateChart}/> : <div className={css.chartEmpty}><Activity size={32}/><h3>{loading ? "Finding your market's rhythm…" : "Your chart starts with verified data."}</h3><p>{settings?.market.configured ? "Refresh to retrieve observed Alpha Vantage history. Missing or restricted data stays visible as unavailable." : "Verify the server's Alpha Vantage connection. No synthetic market curve is shown."}</p>{settings && <button className={css.button} onClick={() => setConnection(true)}>Check market connection</button>}</div>}
   <div className={css.chartFooter}><span>Alpha Vantage · {isIndex(prefs?.primary??"")?"native index levels, not ETF returns":"raw prices, not total return"}</span><Link href={studioHref} prefetch={false}>Explain this in AI Studio<ArrowUpRight size={13}/></Link></div></section>
   {(presentation.showFocus||presentation.showAttention)&&<aside className={css.focusRail}>{presentation.showFocus&&<section className={css.focusCard}><div className={css.eyebrow}>YOUR DAILY INTENTION <Focus size={14}/></div><h2>{prefs?.dailyFocus || "A clear view. A considered decision."}</h2><p>{prefs?.dailyFocus ? "Your saved focus note. Only your account's workspace can change it." : "Set a personal focus, follow your chosen instrument, and keep the work that matters in view."}</p><button className={css.intentButton} onClick={customize} disabled={!prefs}>Tune my workspace<ArrowUpRight size={15}/></button><div className={css.signalArc} aria-hidden="true"><i/><i/><i/><span/></div></section>}
   {presentation.showAttention&&<section className={css.card}><div className={css.cardTop}><h3>Attention, not noise.</h3><Clock3 size={15}/></div><div className={css.attention}><div><b>{taskData?.count ?? "—"}</b><span>owned open tasks</span></div><div><b>{summary?.approvals.state === "ready" ? summary.approvals.data.count : "—"}</b><span>assistant approvals</span></div><div><b>{scenarioData?.count ?? "—"}</b><span>open scenarios</span></div></div><p className={css.finePrint}>Scoped to your accessible work. Counts are not portfolio performance.</p>{summaryError && <p className={css.warning}>{summaryError}</p>}</section>}</aside>}
  </div>
  <div className={css.contentGrid}>{(prefs?.widgetOrder ?? [...WIDGET_IDS]).map(widgetId => <Fragment key={widgetId}>
   {widgetId === "tasks" && prefs?.showTasks && <section className={`${css.card} ${css.tasksCard}`}><div className={css.cardTop}><div><div className={css.eyebrow}>FOCUS QUEUE</div><h2>The next right actions.</h2></div><span className={css.smallCount}>{taskData?.count ?? "—"}</span></div>{taskData ? taskData.items.length ? <ol className={css.taskList}>{taskData.items.map(t => <li key={t.id}><span className={css.taskMark}><Clock3 size={12}/></span><div><b>{t.title}</b><small>{t.dueAt ? formatObservation(t.dueAt) : "No due date"} · {t.priority}</small></div></li>)}</ol> : <p className={css.empty}>No open tasks were returned for your account.</p> : <p className={css.empty}>Task details are unavailable.</p>}<Link className={css.inlineLink} href="/workspace/team-board" prefetch={false}>Review team coordination<ChevronRight size={13}/></Link></section>}
   {widgetId === "research" && prefs?.showResearch && <section className={`${css.card} ${css.researchCard}`}><div className={css.cardTop}><div><div className={css.eyebrow}>RESEARCH CONTINUITY</div><h2>Pick up the thread.</h2></div><Sparkles size={16}/></div>{researchData ? researchData.length ? researchData.map(r => <Link key={r.runId} className={css.researchRow} prefetch={false} href={`/workspace/intelligence/forecast-lab?symbol=${encodeURIComponent(r.symbol)}&researchRunId=${encodeURIComponent(r.runId)}&horizon=2-5d`}><span className={css.instrument}>{r.symbol}</span><div><b>Saved multi-horizon research</b><small>Provider as of {formatObservation(r.asOf)}</small><small>Run {r.runId.slice(0, 12)} · historical model result</small></div><ArrowUpRight size={14}/></Link>) : <p className={css.empty}>Your saved research will appear here after you publish a run.</p> : <p className={css.empty}>Research could not be loaded. No model value is being inferred.</p>}<p className={css.finePrint}>Links preserve the exact research run. Current quotes do not rewrite saved forecasts.</p></section>}
   {widgetId === "scenarios" && prefs?.showScenarios && <section className={`${css.card} ${css.scenarioCard}`}><div className={css.cardTop}><div><div className={css.eyebrow}>IDEAS IN OBSERVATION</div><h2>Follow the hypothesis.</h2></div><Activity size={16}/></div>{scenarioData ? scenarioData.items.length ? scenarioData.items.map(s => <Link key={s.id} className={css.scenarioRow} href={`/workspace/intelligence/scenarios?scenarioId=${encodeURIComponent(s.id)}`} prefetch={false}><div><b>{s.name}</b><small>Last session {s.lastSession || "not observed"}</small></div><span>{s.status}</span></Link>) : <p className={css.empty}>No open paper scenarios are stored in your current firm workspace.</p> : <p className={css.empty}>Scenario data is unavailable.</p>}<p className={css.finePrint}>Paper observations, never brokerage execution. No outcome is fabricated.</p></section>}
   {widgetId === "news" && prefs?.showNews && <section className={`${css.card} ${css.newsCard}`}><div className={css.cardTop}><div><div className={css.eyebrow}>YOUR MARKET CONTEXT</div><h2>Beyond the price.</h2></div><Newspaper size={17}/></div><button type="button" className={css.button} disabled={!prefs||!online||isIndex(prefs.primary)} onClick={()=>prefs&&void load("news",prefs.primary,prefs.range,true)}>Load matching headlines</button>{isIndex(prefs?.primary??"")&&<p className={css.finePrint}>Equity-ticker news is not requested for a native index.</p>}{evidence?.news.length ? <div className={css.newsGrid}>{evidence.news.map(n => <a className={css.newsItem} key={n.url} href={n.url} target="_blank" rel="noopener noreferrer"><small>{n.source} · {formatObservation(n.publishedAt)}</small><h3>{n.title}</h3><p>{n.summary}</p><span>{prefs?.primary}<ArrowUpRight size={13}/></span></a>)}</div> : <p className={css.empty}>{loading ? "Checking recent source headlines…" : !evidence || !evidence.newsRetrieved ? "Current headlines are unavailable or have not been loaded. This does not mean there is no news." : "No returned article passed the matching-symbol and seven-day publication checks."}</p>}</section>}
  </Fragment>)}</div>
  <footer className={css.footer}><span>{identity?.firm || session.firm?.name || "Slice"} / personal decision workspace</span><span>Last receipt {evidence ? formatObservation(evidence.preparedAt) : "not received"}. Provider observation times are shown separately.</span></footer>
  {customizing && prefs && <WorkspaceCustomizer preferences={prefs} suggested={settings?.suggestedSymbols ?? []} saving={saving} message={saveMessage} onSave={next => void persist(next,true)} onClose={() => { if(!saving)setCustomizing(false); }}/>}
 </main>;
}
