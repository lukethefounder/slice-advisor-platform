"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Database, FlaskConical, GitBranch, Lightbulb, Loader2, Save } from "lucide-react";
import { defaultSpec, templateSpec, TEMPLATES, type DatasetManifest, type StrategySpec } from "@/lib/strategy-lab/contracts";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { prepareGuidedHistory, executeGuidedHistory, type GuidedProgress, type GuidedStage, type PreparedHistory } from "@/lib/strategy-ease/guided-workflow";
import { researchPost } from "@/lib/strategy-lab/import-client";
import { strategyRead } from "@/lib/strategy-space/request-once";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import { browserBetaEnabled } from "@/lib/research/beta-client";
import { createCustomSpec, customizeSpec, describeRuleSet } from "@/lib/strategy-lab/custom-strategy";
import CustomStrategyEditor from "@/components/strategy-lab/custom-strategy-editor";
import css from "./ease.module.css";

type LibraryRow = Omit<DatasetManifest, "vintage">;
type SavedDefinition = { id: string; name: string; updatedAt: string; spec: StrategySpec };
const request = <T,>(url: string, body: unknown, signal: AbortSignal) => researchPost<T>(url, body, 90_000, signal);
const stageText: Record<GuidedStage, string> = { history: "Preparing saved or provider history", validation: "Checking every required session", simulation: "Calculating and saving the result" };

export default function GuidedTest({ onRunReady, onBusyChange, active = true }: {
  onRunReady: (id: string) => void; onBusyChange?: (busy: boolean) => void; active?: boolean;
}) {
  const session = useWorkspaceSession(), scope = session.user && session.firm ? `${session.user.id}:${session.firm.id}` : null;
  const [base, setBase] = useState<StrategySpec>(() => ({ ...defaultSpec(), universeMode: "fixed-symbols", symbols: ["SPY"], name: "My strategy", maxHoldings: 1, maxPositionPct: 100 }));
  const [custom, setCustom] = useState<StrategySpec>(() => createCustomSpec(base)), [mode, setMode] = useState<"custom" | "ideas">("custom");
  const [saved, setSaved] = useState<SavedDefinition[]>([]), [saving, setSaving] = useState(false), [savedMessage, setSavedMessage] = useState(""), [definitionsError, setDefinitionsError] = useState("");
  const [symbols, setSymbols] = useState("SPY"), [template, setTemplate] = useState("trend-following");
  const [stage, setStage] = useState<GuidedStage | null>(null), [error, setError] = useState("");
  const [progress, setProgress] = useState<Record<string, GuidedProgress>>({});
  const [ready, setReady] = useState<{ key: string; prepared: PreparedHistory } | null>(null);
  const [library, setLibrary] = useState<LibraryRow[]>([]), [libraryError, setLibraryError] = useState("");
  const control = useRef<AbortController | null>(null), running = useRef(false), alive = useRef(true), pause = useRef(false);
  const busy = stage !== null || saving;
  useEffect(() => { alive.current = true; return () => { alive.current = false; control.current?.abort(); onBusyChange?.(false); }; }, [onBusyChange]);
  useEffect(() => {
    let current = true;
    if (scope && active) void strategyRead<{ datasets: LibraryRow[] }>(scope, "/api/strategy-lab/datasets").then(data => {
      if (current) { setLibrary(data.datasets); setLibraryError(""); }
    }).catch(() => { if (current) setLibraryError("Saved history could not be listed. Prepare history will verify it directly."); });
    if (scope && active) void strategyRead<{ saved: SavedDefinition[] }>(scope, "/api/strategy-lab/templates").then(data => {
      if (current) { setSaved(data.saved); setDefinitionsError(""); }
    }).catch(() => { if (current) setDefinitionsError("Saved definitions could not be listed. Your current draft is still available."); });
    return () => { current = false; };
  }, [scope, active]);
  const spec = useMemo(() => {
    const value = mode === "custom" ? structuredClone(custom) : templateSpec(template, base);
    value.name = base.name; value.symbols = symbols.split(/[ ,\n]+/).filter(Boolean).map(symbol => symbol.toUpperCase());
    value.universeMode = base.universeMode; value.startDate = base.startDate; value.endDate = base.endDate; value.initialCapital = base.initialCapital; value.benchmark = base.benchmark;
    if (mode === "ideas") { value.maxHoldings = value.symbols.length; value.maxPositionPct = 100; }
    value.feeBps = base.feeBps; value.slippageBps = base.slippageBps; value.commissionUsd = base.commissionUsd;
    value.acknowledgeFixedUniverse = base.acknowledgeFixedUniverse;
    return value;
  }, [base, symbols, template, custom, mode]);
  const key = JSON.stringify(spec), current = ready?.key === key ? ready.prepared : null;
  const required = [...new Set([...spec.symbols, spec.benchmark])];
  const savedCount = required.filter(symbol => library.some(row => row.symbol === symbol)).length;
  const patch = <K extends keyof StrategySpec>(field: K, value: StrategySpec[K]) => setBase(previous => ({ ...previous, [field]: value }));
  function range(years: number) {
    const endDate = defaultSpec().endDate, start = new Date(`${endDate}T00:00:00Z`);
    start.setUTCFullYear(start.getUTCFullYear() - years);
    setBase(previous => ({ ...previous, startDate: start.toISOString().slice(0, 10), endDate }));
  }
  function loadDefinition(value: SavedDefinition) {
    try {
      const next = validateSpec(value.spec);
      setBase(structuredClone(next)); setCustom(structuredClone(next)); setSymbols(next.symbols.join(", ")); setMode("custom"); setReady(null); setError("");
      setSavedMessage(`Loaded ${value.name} as an editable copy. Version ${next.version}, saved results, and existing forward tracking remain intact.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This saved definition could not be opened."); }
  }
  async function saveDefinition() {
    if (running.current) return;
    let validated: StrategySpec;
    try { validated = validateSpec(spec); } catch (cause) { setError(cause instanceof Error ? cause.message : "Review the strategy inputs."); return; }
    running.current = true; setSaving(true); setError(""); setSavedMessage(""); onBusyChange?.(true);
    const controller = new AbortController(); control.current = controller;
    try {
      const result = await researchPost<{ id: string; name: string }>("/api/strategy-lab/templates", { spec: validated }, 25_000, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setSaved(previous => [{ id: result.id, name: result.name, spec: validated, updatedAt: new Date().toISOString() }, ...previous]);
      setSavedMessage("A new definition is saved to your account. Load it here whenever you want to edit a copy or test another period.");
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Definition could not be saved."); }
    finally { running.current = false; if (alive.current) { setSaving(false); onBusyChange?.(false); } }
  }
  async function begin(calculate: boolean) {
    if (running.current) return;
    let validated: StrategySpec;
    try { validated = validateSpec(spec); } catch (cause) { setError(cause instanceof Error ? cause.message : "Review the test inputs."); return; }
    running.current = true; pause.current = false; onBusyChange?.(true); setError("");
    const controller = new AbortController(); control.current = controller;
    try {
      let prepared = current?.readiness.ok ? current : null;
      if (!prepared) {
        setProgress({}); setReady(null);
        prepared = await prepareGuidedHistory({ spec: validated, signal: controller.signal, request, parallelism: browserBetaEnabled() ? 2 : 1, paused: () => pause.current,
          onStage(value) { if (alive.current) setStage(value); },
          onProgress(value) {
            if (!alive.current) return;
            setProgress(previous => ({ ...previous, [value.symbol]: value }));
            if (value.dataset) setLibrary(previous => [value.dataset!, ...previous.filter(row => row.id !== value.dataset!.id)]);
          },
        });
        if (!alive.current) return;
        setReady({ key, prepared });
      }
      if (calculate && prepared.readiness.ok && !pause.current) {
        const result = await executeGuidedHistory({ spec: validated, prepared, signal: controller.signal, request,
          onStage(value) { if (alive.current) setStage(value); } });
        if (alive.current) onRunReady(result.runId);
      }
    } catch (cause) {
      if (alive.current) setError(controller.signal.aborted
        ? "Request stopped. Completed imports remain saved. If calculation had started, check Past results before submitting again."
        : cause instanceof Error ? cause.message : "The test could not finish. Saved history remains available.");
    } finally { running.current = false; if (alive.current) { setStage(null); onBusyChange?.(false); } }
  }
  return <section className={css.root}>
    <header className={css.guidedHeader}><div><span className={css.eyebrow}>YOUR STRATEGY / PAST TO FORWARD</span><h2>Build a strategy that is yours.</h2><p>Choose your own metrics and exit plan, or begin with an idea. Test verified history, then track the same rules as future sessions arrive.</p></div><span className={css.libraryBadge}><Database size={14} />{savedCount} / {required.length} instruments in your library</span></header>
    <div className={css.modeCards} role="group" aria-label="Choose how to design your strategy">
      <button type="button" disabled={busy} aria-pressed={mode === "custom"} onClick={() => setMode("custom")}><GitBranch size={21} /><span><strong>Build my own</strong><small>Your metrics, entry logic, exits, and position sizes.</small></span><span className={css.modeBadge}>CUSTOM</span></button>
      <button type="button" disabled={busy} aria-pressed={mode === "ideas"} onClick={() => setMode("ideas")}><Lightbulb size={21} /><span><strong>Start with an idea</strong><small>Use a starter strategy, then make an editable copy.</small></span></button>
    </div>
    <section className={css.savedBar}><label>My saved definitions<select disabled={busy} value="" onChange={event => { const value = saved.find(item => item.id === event.target.value); if (value) loadDefinition(value); }}><option value="">{saved.length ? `Open one of ${saved.length} saved definitions` : "No saved definitions yet"}</option>{saved.map(value => <option key={value.id} value={value.id}>{value.name} · v{value.spec.version} · {new Date(value.updatedAt).toLocaleDateString()}</option>)}</select></label><p>Saving creates a new immutable definition. Editing a copy never rewrites a past result or an active forward strategy.</p></section>
    <div className={css.split}>
      <section className={css.card}>
        <fieldset disabled={busy} className={css.form}>
          <label>Strategy name<input value={base.name} maxLength={100} onChange={event => patch("name", event.target.value)} /></label>
          {mode === "ideas" && <label>Strategy idea<select value={template} onChange={event => setTemplate(event.target.value)}>{TEMPLATES.filter(value => value.id !== "custom" && value.id !== "sector-momentum").map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>}
          <label className={mode === "ideas" ? css.wide : undefined}>Stocks or ETFs<input value={symbols} maxLength={180} onChange={event => { setSymbols(event.target.value); patch("universeMode", "fixed-symbols"); const count = event.target.value.split(/[ ,\n]+/).filter(Boolean).length; setCustom(previous => ({ ...previous, maxHoldings: Math.min(previous.maxHoldings, Math.max(1, count)) })); }} placeholder="MSFT, AAPL" /><small>Separate symbols with commas. US-listed USD instruments.</small></label>
          {mode === "ideas" && <button type="button" className={css.wide} onClick={() => { setCustom(customizeSpec(spec)); setMode("custom"); }}>Make this idea my own — edit every rule</button>}
          <div className={`${css.wide} ${css.rangeBar}`}><span>Historical period</span>{[1, 3, 5, 10].map(years => <button type="button" key={years} onClick={() => range(years)}>{years} year{years > 1 ? "s" : ""}</button>)}</div>
          <label>Start date<input type="date" value={base.startDate} max={base.endDate} onChange={event => patch("startDate", event.target.value)} /></label>
          <label>End date<input type="date" value={base.endDate} max={defaultSpec().endDate} onChange={event => patch("endDate", event.target.value)} /></label>
          <label>Starting capital<input type="number" min={100} value={base.initialCapital} onChange={event => patch("initialCapital", Number(event.target.value))} /></label>
          <label>Compare against<input value={base.benchmark} onChange={event => patch("benchmark", event.target.value.toUpperCase())} maxLength={16} /></label>
          {mode === "custom" && <div className={css.wide}><CustomStrategyEditor spec={spec} onChange={setCustom} /></div>}
          <details className={css.wide}><summary>Trading costs</summary><div className={css.form}>
            <label>Fee (basis points)<input type="number" min={0} value={base.feeBps} onChange={event => patch("feeBps", Number(event.target.value))} /></label>
            <label>Slippage (basis points)<input type="number" min={0} value={base.slippageBps} onChange={event => patch("slippageBps", Number(event.target.value))} /></label>
            <label>Commission per order ($)<input type="number" min={0} value={base.commissionUsd} onChange={event => patch("commissionUsd", Number(event.target.value))} /></label>
          </div></details>
          <label className={`${css.wide} ${css.check}`}><input type="checkbox" checked={base.acknowledgeFixedUniverse} onChange={event => patch("acknowledgeFixedUniverse", event.target.checked)} />I understand that I selected this basket today; it does not reconstruct every stock that existed in the past.</label>
        </fieldset>
        <div className={css.actions}>
          <button disabled={busy} onClick={() => void begin(true)} className={css.primary}>{busy ? <Loader2 size={15} /> : <FlaskConical size={15} />}{busy ? saving ? "Saving definition…" : "Test in progress…" : current?.readiness.ok ? "Run verified history" : "Prepare history & run test"}{!busy && <ArrowRight size={15} />}</button>
          {!busy && <button onClick={() => void begin(false)}>Verify history only</button>}
          {!busy && <button onClick={() => void saveDefinition()}><Save size={14} />Save my definition</button>}
          {busy && <button onClick={() => { pause.current = true; control.current?.abort(); }}>Stop request</button>}
        </div>
        <p>Uses your saved Alpha Vantage daily-adjusted data first. New imports require the configured provider access and may count toward its allowance. Costs remain included in the simulation.</p>
      </section>
      <aside className={css.card}>
        <h3>Your strategy, in plain language</h3><p>{mode === "custom" ? "Your selected rules determine eligibility and exits. No starter template overrides your choices." : TEMPLATES.find(value => value.id === template)?.description}</p>
        <div className={css.summaryRows}><p><span>Rebalance</span><b>{spec.rebalance}</b></p><p><span>Allocation</span><b>{spec.weighting}</b></p><p><span>Trading costs</span><b>{spec.feeBps + spec.slippageBps} bps + ${spec.commissionUsd} / order</b></p></div>
        <ol className={css.stageList} aria-label="Historical test stages">{([['history', 'Retrieve real history'], ['validation', 'Verify coverage and warmup'], ['simulation', 'Simulate and save']] as const).map(([value, label], index) => <li key={value} data-current={stage === value}><span>{current?.readiness.ok && index < 2 ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>
        <p role="status" aria-live="polite">{stage ? stageText[stage] : current?.readiness.ok ? `Ready: ${current.readiness.sessionCount.toLocaleString()} sessions, ${current.readiness.effectiveStart} – ${current.readiness.effectiveEnd}.` : "No history is generated or filled in. Missing or inconsistent sessions stop the test."}</p>
        {current && !current.readiness.ok && <div className={css.error}><strong>Coverage needs attention</strong>{current.readiness.issues.map(issue => <p key={issue.code}>{issue.message}</p>)}</div>}
        <details><summary>Exact strategy rules</summary><pre>{JSON.stringify(spec, null, 2)}</pre></details>
        {mode === "custom" && <details><summary>Read entry and exit conditions</summary><p><b>Entry: </b>{describeRuleSet(spec.entry, spec.benchmark, "All selected instruments are eligible, subject to ranking and allocation.")}</p><p><b>Exit: </b>{describeRuleSet(spec.exit, spec.benchmark, "Only protective exits and scheduled allocation changes apply.")}</p></details>}
        <div className={css.forwardNote}><strong>Use this strategy going forward</strong><p>After the historical test, choose <b>Track forward</b>. The saved run supplies this exact definition. Once monitoring starts, it is frozen and later completed sessions are recorded separately.</p></div>
        <p>Historical performance describes this period and these assumptions. Review drawdown, benchmark return, costs, and a separate untouched period before monitoring the strategy forward.</p>
      </aside>
    </div>
    {(Object.keys(progress).length > 0 || library.length > 0) && <section className={css.card}><div className={css.resultHead}><h3>Historical evidence</h3><small>Original dates and source hashes retained</small></div><div className={css.historyTable}>
      {required.map(symbol => { const item = progress[symbol], data = item?.dataset ?? library.find(row => row.symbol === symbol); return <article key={symbol}><strong>{symbol}</strong><span>{item?.state === "loading" ? "Checking saved history / provider…" : data ? `${data.barCount.toLocaleString()} daily bars · ${data.firstDate} – ${data.lastDate}` : "History needed"}</span><small>{item?.dataset ? item.dataset.cached ? "Reused verified history" : "New provider import saved" : data ? "Saved version; verified again before use" : "Collected when you start"}</small>{data && <details><summary>Source and version</summary><p>{data.provider} · USD · retrieved {new Date(data.retrievedAt).toLocaleString()}</p><p className={css.hash}>{data.sourceSha256}</p><p>Vendor-current historical vintage; daily closes, dividends, and splits. Not a live quote feed or historical constituent database.</p></details>}</article>; })}
    </div></section>}
    {savedMessage && <p className={css.notice} role="status">{savedMessage}</p>}{definitionsError && <p role="status">{definitionsError}</p>}{libraryError && <p role="status">{libraryError}</p>}{error && <p className={css.error} role="alert">{error}</p>}
  </section>;
}
