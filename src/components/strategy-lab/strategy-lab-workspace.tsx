"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Check, Database, FlaskConical, History, Layers3, Loader2, Plus, Save, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { defaultSpec, templateSpec, TEMPLATES, METRICS, SECTOR_ETFS, type StrategySpec, type RuleSet, type Rule, type DatasetManifest, type BacktestResult, type Performance } from "@/lib/strategy-lab/contracts";
import { intelligenceFetch } from "@/lib/intelligence/client";
import css from "@/components/intelligence-unified/research-surface.module.css";

import RuleBuilder from "./rule-tree-editor";
import AdvancedAllocation from "./advanced-allocation";
import DecisionInspector from "./decision-inspector";
import { importHistoryQueue, researchPost, type ImportState } from "@/lib/strategy-lab/import-client";
import type { Readiness } from "@/lib/strategy-lab/readiness";
import pro from "./strategy-pro.module.css";

const StrategyChart = dynamic(() => import("./strategy-chart"), { ssr: false, loading: () => <div className={css.empty}>Opening saved calculation…</div> });

type DatasetRow = Omit<DatasetManifest, "vintage">;
type RunSummary = { id: string; name: string; createdAt: string; engineVersion: string; summary: { start: string; end: string; benchmark: string; universe: string[]; strategy: Performance; benchmarkPerformance: Performance } };
type Saved = { id: string; name: string; updatedAt: string; spec: StrategySpec };
type RunResponse = { ok: true; runId: string; inputSha256: string; outputSha256: string; result: BacktestResult };
type ResultTab = "performance" | "trades" | "monthly" | "evidence";
const number = (v: number | null | undefined, digits = 2) => v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits });
const percent = (v: number | null | undefined) => v == null ? "—" : `${number(v)}%`;
const money = (v: number | null | undefined) => v == null ? "—" : `$${number(v)}`;
const errorText = (e: unknown) => e instanceof Error ? e.message : "This operation did not complete. No substitute data was used.";
function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) { return <label className={css.field}><span>{label}</span>{children}{helper && <small>{helper}</small>}</label>; }
function NumberField({ label, value, onChange, min, max, step = 1, optional = false }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; optional?: boolean }) {
  return <Field label={label}><input type="number" value={value ?? ""} min={min} max={max} step={step} placeholder={optional ? "Disabled" : undefined} onChange={e => onChange(e.target.value === "" && optional ? null : Number(e.target.value))} /></Field>;
}
function Stat({ label, value, helper }: { label: string; value: string; helper?: string }) { return <div className={css.stat}><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>; }
function download(run: RunResponse) { const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `slice-strategy-${run.runId}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export default function StrategyLabWorkspace() {
  const [spec, setSpec] = useState<StrategySpec>(() => defaultSpec());
  const [symbolsInput, setSymbolsInput] = useState("XLK, XLF, XLV, XLE, XLI");
  const [datasets, setDatasets] = useState<DatasetRow[]>([]), [selection, setSelection] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<RunSummary[]>([]), [saved, setSaved] = useState<Saved[]>([]);
  const [result, setResult] = useState<RunResponse | null>(null), [comparison, setComparison] = useState<RunResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("Choose a template, configure your rules, and import verified daily history.");
  const [progress, setProgress] = useState(0), [tab, setTab] = useState<ResultTab>("performance"), [tradePage, setTradePage] = useState(0);
  const [importRows, setImportRows] = useState<Record<string, ImportState>>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessKey, setReadinessKey] = useState("");
  const operation = useRef(false);
  const alive = useRef(true), importsCancelled = useRef(false), sequence = useRef(0);
  const needed = useMemo(() => [...new Set([...spec.symbols, spec.benchmark])], [spec.symbols, spec.benchmark]);
  function patch<K extends keyof StrategySpec>(key: K, value: StrategySpec[K]) { setSpec(current => ({ ...current, [key]: value, ...(key === "symbols" && Array.isArray(value) ? { maxHoldings: Math.min(current.maxHoldings, Math.max(1, value.length)) } : {}) })); }
  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      intelligenceFetch<{ datasets: DatasetRow[] }>("/api/strategy-lab/datasets", {}, { retries: 0 }),
      intelligenceFetch<{ runs: RunSummary[] }>("/api/strategy-lab/runs", {}, { retries: 0 }),
      intelligenceFetch<{ saved: Saved[] }>("/api/strategy-lab/templates", {}, { retries: 0 }),
    ]);
    if (!alive.current) return;
    const [a, b, c] = results;
    if (a.status === "fulfilled") {
      setDatasets(a.value.datasets);
      setSelection(prev => { const next = { ...prev }; for (const d of a.value.datasets) if (!next[d.symbol]) next[d.symbol] = d.id; return next; });
    }
    if (b.status === "fulfilled") setRuns(b.value.runs);
    if (c.status === "fulfilled") setSaved(c.value.saved);
    const failures = results.flatMap((r, i) => r.status === "rejected" ? [`${["Datasets", "Saved runs", "Saved templates"][i]}: ${errorText(r.reason)}`] : []);
    setError(failures.join(" · "));

  }, []);
  useEffect(() => { alive.current = true; void refresh().then(async () => { const id = new URLSearchParams(window.location.search).get("strategyRunId"); if (!id || !alive.current) return; const stored = await intelligenceFetch<RunResponse>(`/api/strategy-lab/runs?id=${encodeURIComponent(id)}`); if (alive.current) { setResult(stored); setMessage("Opened the exact saved historical run from connected research."); } }).catch(e => { if (alive.current) setError(errorText(e)); }); return () => { alive.current = false; importsCancelled.current = true; sequence.current++; }; }, [refresh]);
  function inputForTest() { return { spec, datasetIds: needed.map(symbol => selection[symbol]).filter(Boolean) }; }
  async function importAll(force = false, failuresOnly = false) {
    if (busy || operation.current) return;
    operation.current = true; setBusy("import"); setError(""); setProgress(0); setReadiness(null); importsCancelled.current = false;
    const symbols = failuresOnly ? needed.filter(symbol => !["ready", "cached"].includes(importRows[symbol]?.state ?? "pending")) : needed;
    const failures: string[] = []; let done = 0;
    setImportRows(previous => Object.fromEntries(needed.map(symbol => [symbol, symbols.includes(symbol) ? { symbol, state: "pending" as const } : previous[symbol] ?? { symbol, state: "pending" as const }])));
    try {
      const status = await importHistoryQueue({ symbols, force, cancelled: () => importsCancelled.current || !alive.current,
        onState(row) { if (!alive.current) return; setImportRows(previous => ({ ...previous, [row.symbol]: row }));
          if (row.state === "loading") setMessage(`Checking ${row.symbol} · one symbol at a time. Saved history is reused when valid.`);
          if (["ready", "cached", "failed"].includes(row.state)) { done++; setProgress(done / Math.max(1, symbols.length) * 100); }
          if (row.state === "failed") failures.push(`${row.symbol}: ${row.message}`);
        },
        onDataset(dataset) { if (!alive.current) return; setDatasets(previous => [dataset, ...previous.filter(d => d.id !== dataset.id)]); setSelection(previous => ({ ...previous, [dataset.symbol]: dataset.id })); },
      });
      if (alive.current) { await refresh(); setError(failures.join(" · ")); setMessage(`${status.completed} verified import(s) ready; ${status.failed} failed. ${status.paused ? "Queue paused. Completed datasets stay saved; resume only after reviewing the blocker." : "Inspect coverage before running."}`); }
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { operation.current = false; if (alive.current) setBusy(null); }
  }
  async function checkReadiness() {
    if (busy || operation.current) return; operation.current = true; setBusy("preflight"); setError("");
    const input = inputForTest();
    try { const data = await researchPost<{ readiness: Readiness }>("/api/strategy-lab/readiness", input, 25000);
      if (alive.current) { setReadiness(data.readiness); setReadinessKey(JSON.stringify(input)); setMessage(data.readiness.ok ? "Data and rules pass preflight. No dates were changed." : "Review the exact coverage issues before simulating."); }
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { operation.current = false; if (alive.current) setBusy(null); }
  }
  async function run() {
    if (busy || operation.current) return; operation.current = true; setBusy("run"); setError(""); setMessage("Validating pinned history and rules before simulation. No provider calls are made during this calculation.");
    const input = inputForTest();
    try {
      const checked = await researchPost<{ readiness: Readiness }>("/api/strategy-lab/readiness", input, 25000);
      if (!alive.current) return;
      setReadiness(checked.readiness); setReadinessKey(JSON.stringify(input));
      if (!checked.readiness.ok) { setError(checked.readiness.issues.map(issue => issue.message).join(" · ")); return; }
      const data = await researchPost<RunResponse>("/api/strategy-lab/runs", input, 58000);
      if (!alive.current) return; setResult(data); setComparison(null); setTradePage(0); setTab("performance"); await refresh();
      setMessage("Simulation saved with exact rules, pinned datasets, engine version, and order ledger. Use Inspect saved decision to audit individual sessions.");
    } catch (e) { if (alive.current) setError(errorText(e)); }
    finally { operation.current = false; if (alive.current) setBusy(null); }
  }
  async function save() { if (busy) return; setBusy("save"); setError(""); try { await intelligenceFetch("/api/strategy-lab/templates", { method: "POST", body: JSON.stringify({ spec }) }); if (alive.current) { await refresh(); setMessage("A new immutable strategy definition was saved. Previous definitions remain unchanged."); } } catch (e) { if (alive.current) setError(errorText(e)); } finally { if (alive.current) setBusy(null); } }
  async function loadRun(id: string, compare = false) {
    if (!id) { if (compare) setComparison(null); return; } const token = ++sequence.current; setBusy("load"); setError("");
    try { const data = await intelligenceFetch<RunResponse>(`/api/strategy-lab/runs?id=${encodeURIComponent(id)}`); if (!alive.current || token !== sequence.current) return; if (compare) setComparison(data); else { setResult(data); setComparison(null); setTradePage(0); } }
    catch (e) { if (alive.current) setError(errorText(e)); } finally { if (alive.current && token === sequence.current) setBusy(null); }
  }
  function useSpec(next: StrategySpec) { setSpec(structuredClone({ ...next, version: 2 })); setSymbolsInput(next.symbols.join(", ")); setReadiness(null); if (next.version === 1) setMessage("Created a new version-2 draft from the saved rules. The original definition, results, and launched scenarios remain unchanged."); }
  const ready = needed.length > 0 && needed.every(s => datasets.some(d => d.id === selection[s] && d.symbol === s));
  const comparable = !!(result && comparison && result.result.engineVersion === comparison.result.engineVersion && result.result.effectiveStart === comparison.result.effectiveStart && result.result.effectiveEnd === comparison.result.effectiveEnd && result.result.spec.benchmark === comparison.result.spec.benchmark && result.result.spec.initialCapital === comparison.result.spec.initialCapital);
  const chart = useMemo(() => {
    if (!result) return []; const b = new Map(result.result.benchmarkEquity.map(p => [p.date, p.equity])); const c = new Map(comparable ? comparison!.result.equity.map(p => [p.date, p.equity]) : []);
    return result.result.equity.map(p => ({ date: p.date, strategy: p.equity, benchmark: b.get(p.date), compare: c.get(p.date), drawdown: p.drawdownPct }));
  }, [result, comparison, comparable]);
  const trades = result?.result.trades.slice(tradePage * 40, tradePage * 40 + 40) ?? [];
  const selectedManifest = needed.map(s => datasets.find(d => d.id === selection[s] && d.symbol === s));
  return <main className={`${css.suite} ${css.page}`}>
    <header className={css.hero}><div><div className={css.topline}><span className={css.pill}><FlaskConical size={13} /> Strategy Lab</span><span className={css.pill}><Database size={13} /> Alpha Vantage only</span><span className={`${css.pill} ${css.pillAlt}`}>Historical simulation · not a forecast</span></div><h1 className={css.title}>Turn an investment idea<br />into a testable strategy.</h1><p className={css.lede}>Choose a template. Define entry, exit, sizing, and risk rules. Replay verified daily observations with visible costs and an inspectable trade ledger.</p></div><Link className={css.secondary} href="/workspace/intelligence/scenarios" prefetch={false}><Layers3 size={15}/>Scenario Studio</Link><Link href="/workspace/intelligence" className={css.secondary}>Intelligence <ArrowRight size={15} /></Link></header>
    <nav className={pro.steps} aria-label="Strategy setup steps"><a href="#strategy-framework">1 · Template</a><a href="#strategy-universe">2 · Universe</a><a href="#strategy-rules">3 · Rules</a><a href="#strategy-allocation">4 · Risk</a><a href="#strategy-data">5 · Import & verify</a><a href="#strategy-results">6 · Results</a></nav>
    <div className={css.layout}><div className={css.main}>
      <fieldset disabled={!!busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className={css.main}>
      <section id="strategy-framework" className={css.card}><div className={css.sectionHead}><h2 className={css.heading}><span className={css.step}>01</span>Start with a framework</h2><Layers3 size={18} /></div>
        <div className={css.tiles}>{TEMPLATES.map(t => <button type="button" className={`${css.tile} ${spec.template === t.id ? css.selected : ""}`} key={t.id} onClick={() => useSpec(templateSpec(t.id, spec))}><strong>{t.name}</strong><small>{t.description}</small></button>)}</div>
        <div className={css.grid} style={{ marginTop: 16 }}><Field label="Strategy name"><input value={spec.name} maxLength={100} onChange={e => patch("name", e.target.value)} /></Field><Field label="Saved definitions"><select defaultValue="" onChange={e => { const item = saved.find(s => s.id === e.target.value); if (item) useSpec(item.spec); }}><option value="">Load a saved version</option>{saved.map(s => <option key={s.id} value={s.id}>{s.name} · {new Date(s.updatedAt).toLocaleDateString()}</option>)}</select></Field></div>
      </section>
      <section id="strategy-universe" className={css.card}><div className={css.sectionHead}><h2 className={css.heading}><span className={css.step}>02</span>Define the universe and period</h2></div>
        <div className={css.grid}><Field label="Universe"><select value={spec.universeMode} onChange={e => useSpec({ ...spec, universeMode: e.target.value as StrategySpec["universeMode"], symbols: e.target.value === "sector-etfs" ? ["XLK", "XLF", "XLV", "XLE", "XLI"] : spec.symbols })}><option value="sector-etfs">Fixed sector ETFs</option><option value="fixed-symbols">My fixed stock / ETF basket</option></select></Field><Field label="Benchmark (US-listed, USD)"><input value={spec.benchmark} maxLength={16} onChange={e => patch("benchmark", e.target.value.trim().toUpperCase())} /></Field></div>
        {spec.universeMode === "sector-etfs" ? <div className={css.checks} style={{ margin: "14px 0" }}>{SECTOR_ETFS.map(s => <label key={s.symbol} className={css.check}><input type="checkbox" checked={spec.symbols.includes(s.symbol)} onChange={() => patch("symbols", spec.symbols.includes(s.symbol) ? spec.symbols.filter(v => v !== s.symbol) : [...spec.symbols, s.symbol])} /><span><b>{s.symbol}</b> · {s.name}</span></label>)}</div> : <div style={{ margin: "14px 0" }}><Field label="Symbols, separated by commas (maximum 12)" helper="Current identity is verified only for US venue and USD currency. No current sector membership is backdated."><input value={symbolsInput} onChange={e => setSymbolsInput(e.target.value.toUpperCase())} onBlur={() => patch("symbols", [...new Set(symbolsInput.split(/[\s,;]+/).filter(Boolean))])} /></Field><button type="button" className={css.secondary} onClick={() => patch("symbols", [...new Set(symbolsInput.split(/[\s,;]+/).filter(Boolean))])} style={{ marginTop: 8 }}>Apply symbols</button></div>}
        <div className={css.grid3}><Field label="Start date"><input type="date" value={spec.startDate} onChange={e => patch("startDate", e.target.value)} /></Field><Field label="End date (completed sessions only)"><input type="date" value={spec.endDate} onChange={e => patch("endDate", e.target.value)} /></Field><NumberField label="Starting capital (USD)" value={spec.initialCapital} min={100} max={1e9} onChange={v => patch("initialCapital", v ?? 100000)} /></div>
        <p className={`${css.notice} ${css.warning}`} style={{ marginTop: 14 }}>A chosen ETF basket is not a reconstructed historical sector index. Fixed stocks can introduce survivor and selection bias. Tests cannot begin before every selected instrument has enough history.</p>
        <label className={css.check} style={{ marginTop: 10 }}><input type="checkbox" checked={spec.acknowledgeFixedUniverse} onChange={e => patch("acknowledgeFixedUniverse", e.target.checked)} />I understand this is a fixed, selected universe—not a survivorship-free historical market universe.</label>
      </section>
      <section id="strategy-rules" className={css.card}><div className={css.sectionHead}><h2 className={css.heading}><span className={css.step}>03</span>Build the decision rules</h2><SlidersHorizontal size={18} /></div><p className={css.description} style={{ marginBottom: 18 }}>Rules use completed prior-session information. Trading decisions fill at the next session’s observed open, with your costs. Window lengths are trading sessions.</p><RuleBuilder title="Entry conditions" value={spec.entry} onChange={v => patch("entry", v)} /><div className={css.divider} /><RuleBuilder title="Exit conditions" value={spec.exit} onChange={v => patch("exit", v)} /><div className={css.divider} /><RuleBuilder title="Benchmark market regime" value={spec.regime ?? { mode: "all", rules: [] }} onChange={v => patch("regime", v)} /><p className={css.caption}>Regime rules use the benchmark. A failed regime exits held positions at the next observed open; re-entry waits for a scheduled rebalance. Crossovers fire only on the crossing session.</p></section>
      <section id="strategy-allocation" className={css.card}><h2 className={css.heading}><span className={css.step}>04</span>Allocate and control risk</h2><div className={css.grid3} style={{ marginTop: 18 }}>
        <Field label="Rank eligible instruments"><select value={spec.ranking} onChange={e => patch("ranking", e.target.value as StrategySpec["ranking"])}><option value="momentum">Highest trailing return</option><option value="relative-strength">Return above benchmark</option><option value="low-volatility">Lowest volatility</option><option value="alphabetical">Alphabetical / fixed order</option></select></Field>
        <NumberField label="Ranking lookback (sessions)" value={spec.rankingPeriod} min={2} max={252} onChange={v => patch("rankingPeriod", v ?? 63)} />
        <Field label="Position weights"><select value={spec.weighting} onChange={e => patch("weighting", e.target.value as StrategySpec["weighting"])}><option value="equal">Equal weight</option><option value="inverse-volatility">Inverse volatility</option></select></Field>
        <Field label="Rebalance"><select value={spec.rebalance} onChange={e => patch("rebalance", e.target.value as StrategySpec["rebalance"])}>{["once", "daily", "weekly", "monthly", "quarterly"].map(v => <option key={v} value={v}>{v}</option>)}</select></Field>
        <NumberField label="Maximum holdings" value={spec.maxHoldings} min={1} max={Math.max(1, spec.symbols.length)} onChange={v => patch("maxHoldings", v ?? 3)} />
        <NumberField label="Target position cap (%)" value={spec.maxPositionPct} min={1} max={100} onChange={v => patch("maxPositionPct", v ?? 34)} />
        <NumberField label="Target total exposure (%)" value={spec.maxExposurePct} min={1} max={100} onChange={v => patch("maxExposurePct", v ?? 100)} />
        <NumberField label="Closing trailing stop (%)" value={spec.trailingStopPct} min={0.1} max={99} step={0.1} optional onChange={v => patch("trailingStopPct", v)} />
        <NumberField label="Maximum holding sessions" value={spec.maxHoldingSessions} min={1} max={2520} optional onChange={v => patch("maxHoldingSessions", v)} />
        <NumberField label="Portfolio drawdown stop (%)" value={spec.portfolioStopPct} min={0.1} max={99} step={0.1} optional onChange={v => patch("portfolioStopPct", v)} />
        <NumberField label="Exit cooldown (sessions)" value={spec.cooldownSessions} min={0} max={252} onChange={v => patch("cooldownSessions", v ?? 1)} />
      </div><p className={css.caption}>Stops are evaluated at close, not intraday. A triggered portfolio stop moves to cash at the next open and stays there for the rest of the test. Target weight caps can drift between rebalances.</p><AdvancedAllocation symbols={spec.symbols} groups={spec.allocationGroups ?? []} onChange={v => patch("allocationGroups", v)} /></section>
      <section className={css.card}><h2 className={css.heading}><span className={css.step}>05</span>Set realistic cost assumptions</h2><div className={css.grid} style={{ marginTop: 18 }}>
        <NumberField label="Fee per trade (basis points)" value={spec.feeBps} min={0} max={500} step={0.1} onChange={v => patch("feeBps", v ?? 0)} />
        <NumberField label="Slippage each way (basis points)" value={spec.slippageBps} min={0} max={500} step={0.1} onChange={v => patch("slippageBps", v ?? 0)} />
        <NumberField label="Fixed commission per order (USD)" value={spec.commissionUsd} min={0} max={10000} step={0.01} onChange={v => patch("commissionUsd", v ?? 0)} />
        <NumberField label="Sharpe reference rate (% annually)" value={spec.riskFreeRatePct} min={-5} max={30} step={0.1} onChange={v => patch("riskFreeRatePct", v ?? 0)} />
      </div><p className={css.caption}>These are your assumptions—not Alpha Vantage observations. Cash earns zero. Taxes, borrowing, market impact, and spreads beyond your slippage assumption are not modeled.</p></section>
      </fieldset>
      <section id="strategy-data" className={css.card}><div className={css.sectionHead}><div><h2 className={css.heading}><span className={css.step}>06</span>Inspect history, then test</h2><p className={css.description}>One immutable vendor response per selected version. Imported history is checked for missing sessions and sufficient warmup when the test runs.</p></div></div>
        <div className={css.actions}><button className={css.button} disabled={!!busy || !spec.symbols.length} onClick={() => void importAll(false)}><Database size={15} /> Import / reuse history</button><button className={css.secondary} disabled={!!busy || !spec.symbols.length} onClick={() => void importAll(true)}>Import new versions</button>{busy === "import" && <button className={css.secondary} onClick={() => { importsCancelled.current = true; }}>Stop after this symbol</button>}</div>
        <div className={pro.tools}><button type="button" disabled={!!busy || !needed.some(symbol => importRows[symbol]?.state === "failed" || importRows[symbol]?.state === "pending")} onClick={() => void importAll(false, true)}>Resume unfinished imports</button><button type="button" disabled={!!busy || !spec.acknowledgeFixedUniverse} onClick={() => void checkReadiness()}>{busy === "preflight" ? "Checking…" : "Check exact data readiness"}</button><small>Imports are sequential. Completed symbols remain saved. No automatic retry loop consumes the provider allowance.</small></div>
        <div className={pro.queue} aria-live="polite">{needed.filter(symbol => importRows[symbol]).map(symbol => { const row = importRows[symbol]; return <div key={symbol} className={pro.queueItem} data-state={row.state}><strong>{symbol}</strong><span className={pro.status}>{row.state}</span><span>{row.message || (row.state === "pending" ? "Awaiting import" : "Verifying identity and history")}{row.retryAt && <small> · Retry no earlier than {new Date(row.retryAt).toLocaleString()}</small>}</span></div>; })}</div>
        {readiness && <div className={pro.readiness} data-ok={readiness.ok && readinessKey === JSON.stringify(inputForTest())}><h3>{readinessKey !== JSON.stringify(inputForTest()) ? "Draft changed · check readiness again" : readiness.ok ? "Ready for historical replay" : "History needs attention"}</h3><p>{readiness.requiredWarmup} prior sessions required · {readiness.engineVersion}</p>{readiness.ok && <p>{readiness.effectiveStart} → {readiness.effectiveEnd} · {readiness.sessionCount} completed sessions</p>}{readiness.issues.map(issue => <p key={issue.code}><b>{issue.code}</b> · {issue.message}</p>)}{readiness.instruments.map(item => <p key={item.symbol}><b>{item.symbol}</b> · {item.firstDate ?? "not imported"} → {item.lastDate ?? "not imported"} · {item.priorSessions} prior rows{item.missingSessions.length ? ` · Missing session examples: ${item.missingSessions.join(", ")}` : ""}</p>)}<p>{readiness.note}</p></div>}
        {busy === "import" && <div className={css.progress}><div style={{ width: `${progress}%` }} /></div>}
        <div className={css.tableWrap} style={{ marginTop: 14 }}><table className={css.table}><thead><tr><th>Instrument</th><th>Dataset version</th><th>Coverage</th><th>Rows</th></tr></thead><tbody>{needed.map((symbol, i) => { const d = selectedManifest[i]; return <tr key={symbol}><td><b>{symbol}</b>{symbol === spec.benchmark && <small> · benchmark</small>}</td><td><select aria-label={`Dataset for ${symbol}`} disabled={!!busy} value={selection[symbol] ?? ""} onChange={e => setSelection(prev => ({ ...prev, [symbol]: e.target.value }))}><option value="">Not imported</option>{datasets.filter(v => v.symbol === symbol).map(v => <option key={v.id} value={v.id}>{new Date(v.retrievedAt).toLocaleString()}</option>)}</select></td><td>{d ? `${d.firstDate} → ${d.lastDate}` : "Unavailable"}</td><td>{d ? number(d.barCount, 0) : "—"}</td></tr>; })}</tbody></table></div>
        <div className={css.actions} style={{ marginTop: 17 }}><button className={css.button} disabled={!!busy || !ready || !spec.acknowledgeFixedUniverse} onClick={() => void run()}>{busy === "run" ? <Loader2 size={15} /> : <FlaskConical size={15} />} Run historical simulation</button><button className={css.secondary} disabled={!!busy || !spec.acknowledgeFixedUniverse} onClick={() => void save()}><Save size={14} /> Save definition</button></div>
      </section>
    </div><aside className={css.aside}>
      <section className={css.card}><p className={css.eyebrow}>Your research contract</p><h2 className={css.heading}>{spec.name || "Untitled strategy"}</h2><div className={css.divider} />{[["Universe", `${spec.symbols.length} instruments`], ["Period", `${spec.startDate} → ${spec.endDate}`], ["Benchmark", spec.benchmark], ["Rebalance", spec.rebalance], ["Signal", "Previous close"], ["Fill", "Next session open"], ["Source", "Alpha Vantage"]].map(([k, v]) => <div className={css.row} key={k}><span className={css.muted}>{k}</span><b style={{ textAlign: "right" }}>{v}</b></div>)}<p className={css.notice}>Changing settings never changes an existing run. Each new run pins its rules, datasets, and engine version.</p></section>
      <section className={css.card}><div className={css.topline}><ShieldCheck size={18} /><h2 className={css.heading}>No invented history</h2></div><p className={css.description}>Missing data, pre-inception dates, and insufficient warmup block a run. Original fundamental revisions, historical sector membership, macro vintages, and news-at-the-time rules are not enabled.</p><div className={css.divider} /><p className={css.description}>Daily bars only. Raw prices drive fills; splits change share counts; dividends become cash on the ex-date. This is not a broker’s realized return.</p></section>
      <section className={css.card}><p className={css.eyebrow}>Saved runs</p><div className={css.stack}>{runs.slice(0, 8).map(r => <button key={r.id} className={css.secondary} disabled={!!busy} style={{ textAlign: "left", justifyContent: "flex-start" }} onClick={() => void loadRun(r.id)}><History size={14} /><span>{r.name}<small style={{ display: "block", fontWeight: 400 }}>{r.summary.start} → {r.summary.end}</small></span></button>)}{!runs.length && <p className={css.description}>Your completed tests will appear here. No sample results are displayed.</p>}</div></section>
    </aside></div>
    <div role={error ? "alert" : "status"} aria-live="polite" className={`${css.notice} ${error ? css.error : ""}`} style={{ margin: "18px 0" }}>{busy && <Loader2 size={14} style={{ display: "inline", marginRight: 8 }} />}{error || message}</div>
    {result ? <section className={css.card} id="strategy-results"><div className={css.sectionHead}><div><p className={css.eyebrow}>Saved historical simulation</p><h2 className={css.heading}>{result.result.spec.name}</h2><p className={css.description}>{result.result.effectiveStart} → {result.result.effectiveEnd} · {result.result.engineVersion}</p></div><Link className={css.button} href={`/workspace/intelligence/scenarios?sourceRunId=${encodeURIComponent(result.runId)}`} prefetch={false}><Layers3 size={15}/>Create forward scenario</Link><button className={css.secondary} onClick={() => download(result)}><ArrowDownToLine size={15} /> Export audit JSON</button></div>
      <div className={css.topline}><span className={`${css.pill} ${css.pillWarn}`}>Hypothetical—not actual client performance</span><span className={css.pill}><Check size={12} /> Saved source hashes</span><span className={css.pill}>{result.result.signalWarmupSessions} warmup sessions</span></div>
      <div className={css.stats}><Stat label="Total return" value={percent(result.result.strategy.totalReturnPct)} helper={`Benchmark ${percent(result.result.benchmark.totalReturnPct)}`} /><Stat label="Annualized return" value={percent(result.result.strategy.cagrPct)} /><Stat label="Maximum drawdown" value={percent(result.result.strategy.maxDrawdownPct)} /><Stat label="Final equity" value={money(result.result.strategy.finalEquity)} /><Stat label="Annualized volatility" value={percent(result.result.strategy.annualizedVolatilityPct)} /><Stat label="Sharpe" value={number(result.result.strategy.sharpe)} helper={`Reference rate ${result.result.spec.riskFreeRatePct}%`} /><Stat label="Fees + slippage" value={money(result.result.strategy.fees + result.result.strategy.slippage)} /><Stat label="Trades / exposure" value={`${result.result.strategy.tradeCount} / ${percent(result.result.strategy.averageExposurePct)}`} /></div>
      <div className={css.grid}><Field label="Compare another saved run"><select disabled={!!busy} value={comparison?.runId ?? ""} onChange={e => void loadRun(e.target.value, true)}><option value="">No comparison</option>{runs.filter(r => r.id !== result.runId).map(r => <option key={r.id} value={r.id}>{r.name} · {r.summary.start} → {r.summary.end}</option>)}</select></Field><p className={css.description}>Comparison overlays require identical dates, benchmark, starting capital, and engine version. Different rules and assumptions remain visible in each exported record.</p></div>
      {comparison && !comparable && <p className={`${css.notice} ${css.warning}`}>Comparison is not aligned. Dates, benchmark, capital, or engine differ; no overlay or ranking is shown.</p>}
      <nav className={css.tabs} aria-label="Strategy results">{(["performance", "trades", "monthly", "evidence"] as ResultTab[]).map(t => <button className={`${css.tab} ${tab === t ? css.tabActive : ""}`} key={t} onClick={() => setTab(t)} aria-pressed={tab === t}>{t === "evidence" ? "Data & assumptions" : t === "trades" ? "Trade ledger" : t === "monthly" ? "Monthly returns" : "Performance & interpretation"}</button>)}</nav>
      {tab === "performance" && <><div className={css.topline}><span className={css.pill}>Green: strategy</span><span className={css.pill}>Cyan: benchmark</span>{comparable && <span className={`${css.pill} ${css.pillAlt}`}>Purple: {comparison!.result.spec.name}</span>}</div><StrategyChart rows={chart} comparison={Boolean(comparable)} kind="equity"/>
      <h3 className={css.heading}>Underwater curve</h3><StrategyChart rows={chart} comparison={Boolean(comparable)} kind="drawdown"/>
      <div className={css.grid}>{result.result.interpretation.map((text, i) => <p className={css.notice} key={i}>{text}</p>)}</div><p className={css.caption}>Interpretations are deterministic summaries of this run—not AI-created evidence or investment recommendations.</p></>}
      {tab === "trades" && <><div className={css.tableWrap}><table className={css.table}><thead><tr><th>Signal / fill date</th><th>Symbol</th><th>Side</th><th>Shares</th><th>Observed open</th><th>Fill with slip</th><th>Fees</th><th>Reason</th></tr></thead><tbody>{trades.map((t, i) => <tr key={`${t.date}-${t.symbol}-${i}`}><td>{t.signalDate}<br />{t.date}</td><td><b>{t.symbol}</b></td><td>{t.side}</td><td>{number(t.shares, 5)}</td><td>{money(t.rawOpen)}</td><td>{money(t.fillPrice)}</td><td>{money(t.fee)}</td><td>{t.reason}</td></tr>)}</tbody></table></div><div className={css.actions} style={{ marginTop: 12 }}><button className={css.secondary} disabled={tradePage === 0} onClick={() => setTradePage(v => v - 1)}>Previous</button><span className={css.muted}>Page {tradePage + 1} · {result.result.trades.length} orders</span><button className={css.secondary} disabled={(tradePage + 1) * 40 >= result.result.trades.length} onClick={() => setTradePage(v => v + 1)}>Next</button></div><p className={css.caption}>Corporate-action cash and share changes are recorded separately in the audit export.</p></>}
      {tab === "monthly" && <div className={css.tableWrap}><table className={css.table}><thead><tr><th>Month</th><th>Strategy</th><th>Benchmark</th><th>Difference (pp)</th></tr></thead><tbody>{result.result.monthly.map(m => <tr key={m.month}><td>{m.month}</td><td className={m.strategyPct < 0 ? css.negative : css.positive}>{percent(m.strategyPct)}</td><td>{percent(m.benchmarkPct)}</td><td>{number(m.strategyPct - m.benchmarkPct)}</td></tr>)}</tbody></table></div>}
      {tab === "evidence" && <><div className={css.stack}>{result.result.warnings.map(w => <div className={`${css.notice} ${css.warning}`} key={w}>{w}</div>)}</div><div className={css.tableWrap} style={{ marginTop: 16 }}><table className={css.table}><thead><tr><th>Dataset</th><th>Coverage / rows</th><th>Retrieved</th><th>Raw response SHA-256</th></tr></thead><tbody>{result.result.manifests.map(m => <tr key={m.id}><td><b>{m.symbol}</b><br />{m.provider}<br />{m.vintage}</td><td>{m.firstDate} → {m.lastDate}<br />{m.barCount} rows</td><td>{new Date(m.retrievedAt).toLocaleString()}</td><td className={css.mono}>{m.sourceSha256}</td></tr>)}</tbody></table></div><div className={css.notice} style={{ marginTop: 14 }}><b>Result integrity</b><p className={css.mono}>Input: {result.inputSha256}<br />Output: {result.outputSha256}<br />Run: {result.runId}</p></div></>}
    <DecisionInspector key={result.runId} runId={result.runId} result={result.result} /></section> : <section className={css.empty}><FlaskConical size={26} style={{ margin: "0 auto 12px", color: "#087e60" }} /><strong>Evidence first. Results second.</strong><p>Complete the builder and verify imported history. No returns, prices, or successful test results are pre-populated.</p></section>}
  </main>;
}
