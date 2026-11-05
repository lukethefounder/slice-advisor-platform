"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { HORIZONS, canonicalMetric, type CanonicalBundle, type CanonicalHorizon } from "@/lib/intelligence-unified/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import styles from "./research-surface.module.css";
const number = (v: number | null | undefined, digits = 2) => v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const date = (v: string) => new Date(v).toLocaleString();
export default function UnifiedForecastPanel({ symbol, researchRunId, refreshKey }: { symbol: string; researchRunId?: string | null; refreshKey?: string | null }) {
  const router = useRouter();
  const [bundle, setBundle] = useState<CanonicalBundle | null>(null);
  const [horizon, setHorizon] = useState<CanonicalHorizon>("2-5d");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(Date.now()); const sequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const seq = ++sequence.current; const query = new URLSearchParams({ symbol });
    const requested = researchRunId || new URLSearchParams(window.location.search).get("researchRunId");
    if (requested) query.set("researchRunId", requested);
    try {
      const response = await intelligenceFetch<{ bundle: CanonicalBundle | null }>(`/api/intelligence/canonical?${query}`, { signal }, { timeoutMs: 15000, retries: 0 });
      if (seq === sequence.current) { setBundle(response.bundle); setError(""); }
    } catch (e) { if (!isAbortError(e) && seq === sequence.current) { setBundle(null); setError(e instanceof Error ? e.message : "Forecast could not be read."); } }
  }, [symbol, researchRunId]);
  useEffect(() => {
    const c = new AbortController(); setBundle(null); const pending = window.setTimeout(() => { void load(c.signal); }, 180);
    const initial = new URLSearchParams(window.location.search).get("forecastHorizon");
    if (HORIZONS.includes(initial as CanonicalHorizon)) setHorizon(initial as CanonicalHorizon);
    return () => { window.clearTimeout(pending); c.abort(); sequence.current++; };
  }, [load, refreshKey]);
  useEffect(() => { const t = window.setInterval(() => { if (document.visibilityState === "visible") setNow(Date.now()); }, 60000); return () => clearInterval(t); }, []);
  const metric = bundle ? canonicalMetric(bundle, horizon) : null;
  const matching = bundle?.symbol === symbol;
  const age = bundle ? Math.max(0, (now - Date.parse(bundle.market ? bundle.score.providerAsOf ?? bundle.asOf : bundle.asOf)) / 60000) : null;
  const pinned = (path: string) => bundle ? `${path}?${new URLSearchParams({ symbol: bundle.symbol, researchRunId: bundle.researchRunId, forecastHorizon: horizon, ...(path.includes("knowledge-graph") ? { runId: bundle.researchRunId } : {}), ...(path === "/market-visuals" ? { view: "forecast" } : {}) })}` : path;
  function chooseHorizon(value: CanonicalHorizon) {
    setHorizon(value);
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", symbol); url.searchParams.set("forecastHorizon", value);
    if (bundle) url.searchParams.set("researchRunId", bundle.researchRunId);
    if (url.pathname === "/market-visuals") url.searchParams.set("view", "forecast");
    // Navigate the pinned context without reloading the document. The route boundary refreshes matching child views.
    router.push(url.pathname + url.search);
  }
  async function generate() {
    setBusy(true); setError("");
    try {
      const r = await intelligenceFetch<{ bundle: CanonicalBundle | null }>("/api/intelligence/canonical", { method: "POST", body: JSON.stringify({ symbol }) }, { timeoutMs: 178000, retries: 0 });
      if (!r.bundle) throw new Error("No forecast was published.");
      // Navigate to the exact run: parent cards and graph reload the matching research, not older state.
      const u = new URL(window.location.href); u.searchParams.set("symbol", r.bundle.symbol); u.searchParams.set("researchRunId", r.bundle.researchRunId);
      if (u.pathname.includes("knowledge-graph")) u.searchParams.set("runId", r.bundle.researchRunId);
      u.searchParams.set("forecastHorizon", horizon); router.push(u.pathname + u.search);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed."); } finally { setBusy(false); }
  }
  return <section className={`${styles.suite} ${styles.card}`} aria-label="Canonical forecast" style={{ marginTop: 20, marginBottom: 20 }}>
    <div className={styles.sectionHead}><div><p className={styles.eyebrow}>One research run · three connected views</p><h2 className={styles.heading}>Unified forecast / {symbol}</h2><p className={styles.description}>The same stored forecast appears in Market Visuals, Intelligence, and the research graph.</p></div>
      <Link className={styles.secondary} href="/workspace/intelligence/strategy-lab" prefetch={false}>Strategy Lab ↗</Link></div>
    <div className={styles.actions}>
      <label className={styles.field}><span>Forecast horizon</span><select value={horizon} onChange={e => chooseHorizon(e.target.value as CanonicalHorizon)}>{HORIZONS.map(h => <option key={h}>{h}</option>)}</select></label>
      <button className={styles.secondary} disabled={busy} onClick={() => void load()}>Reload saved run</button>
      <button className={styles.button} disabled={busy} onClick={() => void generate()}>{busy ? "Collecting provider evidence…" : "Generate current research"}</button>
    </div>
    {error && <p className={`${styles.notice} ${styles.error}`} role="alert">{error}</p>}
    {bundle && metric && matching ? <>
      <div className={styles.topline} style={{ marginTop: 16 }}><span className={styles.pill}>Alpha Vantage observations</span><span className={`${styles.pill} ${styles.pillAlt}`}>Model estimate · not observed future data</span><span className={`${styles.pill} ${styles.pillWarn}`}>{age === null ? "Timestamp unknown" : `Observation age ${Math.round(age)} min`}</span></div>
      <div className={styles.stats}>
        {[["Positive return", `${number(metric.probabilityPositive, 1)}%`, "Probability, not the sentiment score"], ["Expected return", `${number(metric.expectedReturnPct)}%`, `For ${horizon} only`], ["Expected price", number(metric.expectedPrice), bundle.market.currency], ["Model confidence", `${number(metric.confidence, 1)}%`, "Not a success guarantee"]].map(([label, value, detail]) => <div className={styles.stat} key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
      </div>
      <div className={styles.grid3} style={{ marginBottom: 16 }}>{(["media", "technical", "economy"] as const).map(name => <div className={styles.notice} key={name}><strong style={{ textTransform: "capitalize" }}>{name} · ⅓ weight</strong><div className={styles.row}><span>Research score</span><b>{number(bundle.score.cohorts[name].score, 1)} / 100</b></div><p className={styles.caption}>{bundle.score.cohorts[name].evidenceCount} evidence items · {number(bundle.score.cohorts[name].confidence, 0)}% model confidence</p></div>)}</div>
      <div className={styles.interval}><div className={styles.row}><strong>Stored model range</strong><span>{number(metric.low)} — {number(metric.high)} {bundle.market.currency}</span></div>
        <HorizonIntervals bundle={bundle} selected={horizon} />
        <p className={styles.caption}>Independent horizon estimates, not a fabricated continuous price path. The chart uses the stored engine range; no 95% coverage claim is added.</p></div>
      <div className={styles.grid} style={{ marginTop: 16 }}><div><p className={styles.muted}>Slice sentiment score: <strong>{number(metric.sliceScore, 1)} / 100</strong>. This score and forecast probability have different meanings.</p><p className={styles.muted}>Decision snapshot: {date(bundle.asOf)}<br/>Provider observation: {bundle.score.providerAsOf ? date(bundle.score.providerAsOf) : "Unavailable"}<br/>Target time: {metric.targetAt ? date(metric.targetAt) : "Unavailable"}</p></div><div className={styles.notice}><span className={styles.mono}>Research: {bundle.researchRunId}<br/>Forecast: {bundle.forecastRunId}<br/>Model: {bundle.forecast.modelVersion}<br/>Output checksum: {bundle.outputSha256.slice(0, 20)}…</span></div></div>
      <div className={styles.actions}><Link className={styles.secondary} href={pinned("/market-visuals")} prefetch={false}>Market Visuals ↗</Link><Link className={styles.secondary} href={pinned("/workspace/intelligence")} prefetch={false}>Intelligence ↗</Link><Link className={styles.secondary} href={pinned("/workspace/intelligence/knowledge-graph")} prefetch={false}>Knowledge Graph ↗</Link></div>
      {Object.values(bundle.operations).some(v => v === "failed" || v === "needs-review") && <p className={`${styles.notice} ${styles.warning}`}>The forecast is stored, but a downstream audit or synchronization needs attention: {Object.entries(bundle.operations).map(([k,v]) => `${k}: ${v}`).join(" · ")}.</p>}
    </> : !error && <div className={styles.empty}><strong>No matching published forecast</strong><p>Generate current research to create one immutable forecast. Existing charts remain available; this panel does not substitute a separately calculated prediction.</p></div>}
  </section>;
}
function HorizonIntervals({ bundle, selected }: { bundle: CanonicalBundle; selected: string }) {
  const rows = bundle.forecast.horizons, values = rows.flatMap(h => [h.expectedRangePercent.low, h.expectedRangePercent.high, h.expectedReturnPercent]);
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values), span = Math.max(hi - lo, .01), x = (v: number) => 125 + (v - lo) / span * 565;
  return <svg viewBox={`0 0 830 ${rows.length * 34 + 35}`} role="img" aria-label="Stored expected-return ranges by forecast horizon">
    <line x1={x(0)} x2={x(0)} y1={0} y2={rows.length * 34} stroke="#b4cec4" strokeDasharray="3 5"/>
    {rows.map((h,i) => <g key={h.horizon} opacity={h.horizon === selected ? 1 : .55}><text x={0} y={i*34+22} fontSize={12} fill="var(--slice-heading, #24534b)">{h.horizon}</text><line x1={x(h.expectedRangePercent.low)} x2={x(h.expectedRangePercent.high)} y1={i*34+18} y2={i*34+18} stroke={h.horizon === selected ? "#087e60" : "#658d89"} strokeWidth={7} strokeLinecap="round"/><circle cx={x(h.expectedReturnPercent)} cy={i*34+18} r={5} fill="#6952af" stroke="var(--slice-surface-strong, white)" strokeWidth={2}/><text x={715} y={i*34+22} fontSize={11} fill="var(--slice-heading, #24534b)">{h.expectedReturnPercent.toFixed(2)}%</text></g>)}
    <text x={125} y={rows.length*34+22} fontSize={10} fill="var(--slice-muted, #526f69)">{lo.toFixed(1)}%</text><text x={665} y={rows.length*34+22} fontSize={10} fill="var(--slice-muted, #526f69)">{hi.toFixed(1)}%</text>
  </svg>;
}
