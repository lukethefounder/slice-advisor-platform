"use client";
import { useEffect, useRef, useState } from "react";
import type { BacktestResult } from "@/lib/strategy-lab/contracts";
import type { GroupTrace, RuleTrace } from "@/lib/strategy-lab/indicators";
import type { explainDecision } from "@/lib/strategy-lab/execution-audit";
import { researchPost } from "@/lib/strategy-lab/import-client";
import css from "./strategy-pro.module.css";
function flatten(group: GroupTrace, label: string): Array<RuleTrace & { group: string }> { return group.children.flatMap(child => child.kind === "rule" ? [{ ...child, group: `${label} (${group.mode})` }] : flatten(child, `${label} / subgroup`)); }
export default function DecisionInspector({ runId, result }: { runId: string; result: BacktestResult }) {
  const [date, setDate] = useState(result.effectiveStart), [symbol, setSymbol] = useState(result.spec.symbols[0]);
  const [audit, setAudit] = useState<ReturnType<typeof explainDecision> | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setDate(result.effectiveStart); setSymbol(result.spec.symbols[0]); setAudit(null); return () => controller.current?.abort(); }, [runId, result]);
  async function inspect() {
    if (busy) return; setBusy(true); setError(""); setAudit(null);
    const active = new AbortController(); controller.current = active;
    try { const data = await researchPost<{ audit: ReturnType<typeof explainDecision> }>("/api/strategy-lab/explain", { runId, date, symbol }, 28000, active.signal); if (!active.signal.aborted) setAudit(data.audit); }
    catch (e) { if (!active.signal.aborted) setError(e instanceof Error ? e.message : "Decision audit failed."); }
    finally { if (!active.signal.aborted) setBusy(false); }
  }
  const rows = audit ? [...flatten(audit.entry, "Entry"), ...flatten(audit.exit, "Exit"), ...flatten(audit.regime, "Regime")] : [];
  return <section className={css.audit}><div className={css.groupHead}><div><p className={css.eyebrow}>Explain this decision</p><h3>See the values the rules actually used.</h3></div></div><div className={css.tools}>
    <label>Execution session<select disabled={busy} value={date} onChange={e => { setDate(e.target.value); setAudit(null); }}>{result.equity.map(p => <option key={p.date}>{p.date}</option>)}</select></label>
    <label>Instrument<select disabled={busy} value={symbol} onChange={e => { setSymbol(e.target.value); setAudit(null); }}>{result.spec.symbols.map(s => <option key={s}>{s}</option>)}</select></label><button disabled={busy} onClick={() => void inspect()}>{busy ? "Checking pinned evidence…" : "Inspect saved decision"}</button></div>
    {error && <p role="alert">{error}</p>}{audit && <><p>Signal date: <b>{audit.signalDate}</b> · execution date: <b>{audit.date}</b> · {audit.engineVersion}</p><div className={css.tableWrap}><table><thead><tr><th>Group</th><th>Source</th><th>Criterion</th><th>Observed</th><th>Previous</th><th>Threshold</th><th>Match</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.group}</td><td>{r.symbol}</td><td>{r.rule.metric} · {r.rule.period}</td><td>{r.observed?.toFixed(4) ?? "Unavailable"}</td><td>{r.previous?.toFixed(4) ?? "Not used"}</td><td>{r.rule.comparator} {r.rule.value}{r.rule.upper === undefined ? "" : ` to ${r.rule.upper}`}</td><td>{r.available ? r.pass ? "Yes" : "No" : "Unavailable"}</td></tr>)}</tbody></table></div><p><b>{audit.trades.length ? audit.trades.map(t => `${t.side} ${t.shares.toFixed(5)} shares: ${t.reason}`).join(" · ") : "No simulated order for this instrument on this session."}</b></p><p className={css.caption}>{audit.note}</p></>}
  </section>;
}
