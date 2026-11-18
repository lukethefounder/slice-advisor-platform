"use client";
import { useEffect, useRef, useState } from "react";
import type { BacktestResult, Trade } from "@/lib/strategy-lab/contracts";
import type { explainDecision } from "@/lib/strategy-lab/execution-audit";
import { decisionJson, downloadText, money, pct } from "@/lib/scenario-decision/client";
import { tradesCsv } from "@/lib/scenario-decision/core";
import css from "./decision.module.css";
type Audit=ReturnType<typeof explainDecision>;
export default function DecisionLedger({result,runId}:{result:BacktestResult;runId?:string}){
 const [page,setPage]=useState(0),[audit,setAudit]=useState<Audit|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");const abort=useRef<AbortController|null>(null);
 const [symbol,setSymbol]=useState(result.spec.symbols[0]),[date,setDate]=useState(result.effectiveStart);
 useEffect(()=>{setPage(0);setAudit(null);setSymbol(result.spec.symbols[0]);setDate(result.effectiveStart);return()=>abort.current?.abort();},[result,runId]);
 async function inspect(t?:Trade){if(!runId)return;abort.current?.abort();const c=new AbortController();abort.current=c;setBusy(true);setError("");try{const p=await decisionJson<{audit:Audit}>("/api/strategy-lab/explain",{method:"POST",signal:c.signal,body:JSON.stringify({runId,symbol:t?.symbol??symbol,date:t?.date??date})});if(!c.signal.aborted){setAudit(p.audit);setSymbol(p.audit.symbol);setDate(p.audit.date);}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Inspection failed.");}finally{if(!c.signal.aborted)setBusy(false);}}
 return <section className={css.card}><div className={css.sectionHeading}><div><span className={css.eyebrow}>Explain the decisions</span><h2>Execution ledger</h2></div><button className={css.secondary} onClick={()=>downloadText("slice-simulated-trades.csv",tradesCsv(result),"text/csv;charset=utf-8")}>Export all orders</button></div><p className={css.caption}>Recorded model orders—not broker fills. Costs, eligibility, ranking and scheduled rebalancing can prevent an otherwise passing entry.</p>
 <div className={css.tableWrap}><table><thead><tr><th>Signal → execution</th><th>Instrument</th><th>Side</th><th>Modeled fill</th><th>Reason</th>{runId&&<th>Inspect</th>}</tr></thead><tbody>{result.trades.slice(page*25,(page+1)*25).map((t,i)=><tr key={`${t.date}-${t.symbol}-${i}`}><td>{t.signalDate}<small>{t.date}</small></td><td>{t.symbol}</td><td><span className={css.badge} data-tone={t.side==="BUY"?"positive":"negative"}>{t.side}</span></td><td>{money(t.fillPrice)}<small>{t.shares.toFixed(5)} shares</small></td><td>{t.reason}</td>{runId&&<td><button className={css.secondary} disabled={busy} onClick={()=>void inspect(t)}>Explain</button></td>}</tr>)}</tbody></table></div>
 {!result.trades.length&&<p className={css.empty}>The saved rules produced no orders in this period. No trades have been invented.</p>}
 <div className={css.actions}><button className={css.secondary} disabled={!page} onClick={()=>setPage(v=>v-1)}>Previous</button><span className={css.caption}>Page {page+1} · {result.trades.length} orders</span><button className={css.secondary} disabled={(page+1)*25>=result.trades.length} onClick={()=>setPage(v=>v+1)}>Next</button></div>
 {runId&&<details className={css.receipt}><summary>Check a date with no trade</summary><div className={css.formGrid}><label>Instrument<select value={symbol} onChange={e=>setSymbol(e.target.value)}>{result.spec.symbols.map(s=><option key={s}>{s}</option>)}</select></label><label>Execution date<input type="date" value={date} min={result.effectiveStart} max={result.effectiveEnd} onChange={e=>setDate(e.target.value)}/></label><button className={css.primary} disabled={busy} onClick={()=>void inspect()}>{busy?"Inspecting…":"Inspect pinned data"}</button></div></details>}
 {error&&<p role="alert" className={css.error}>{error}</p>}{audit&&<div className={css.audit}><h3>{audit.symbol} · {audit.date}</h3><p>Signal: {audit.signalDate} · allocation at close {pct(audit.positionAtClose)}</p><p>{audit.note}</p><details open><summary>Measured rule values</summary><pre>{JSON.stringify({entry:audit.entry,exit:audit.exit,benchmarkFilter:audit.regime},null,2)}</pre></details></div>}
 {!runId&&<p className={css.caption}>This is the recorded forward ledger. The historical decision evaluator is not used to reconstruct forward rules from a different dataset.</p>}
 </section>;
}
