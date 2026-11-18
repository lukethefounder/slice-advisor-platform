"use client";
import Link from "next/link";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import { useEffect, useState } from "react";
import type { DecisionReport } from "@/lib/scenario-decision/contracts";
import { decisionJson, downloadText, when, pct } from "@/lib/scenario-decision/client";
import { strategySummary } from "@/lib/scenario-decision/core";
import PerformanceCharts from "./performance-charts";
import EvidenceView from "./evidence-view";
import css from "./decision.module.css";
export default function ReportView({id}:{id:string}){const s=useWorkspaceSession();if(s.loading)return <main className={css.root}><p role="status">Verifying workspace access…</p></main>;if(!s.user||!s.firm)return <main className={css.root}><p role="alert">Sign in to an active firm to read private reports.</p></main>;return <ReportContent key={`${s.user.id}:${s.firm.id}:${id}`} id={id}/>;}
function ReportContent({id}:{id:string}){const [report,setReport]=useState<DecisionReport|null>(null),[error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();setReport(null);setError("");void decisionJson<{report:DecisionReport}>(`/api/scenario-decision/reports?id=${encodeURIComponent(id)}`,{signal:c.signal}).then(r=>{if(!c.signal.aborted)setReport(r.report);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"Report unavailable.");});return()=>c.abort();},[id]);
 if(error)return <main className={css.root}><p role="alert" className={css.error}>{error}</p><Link href="/workspace/strategy-lab/scenarios">Return to Scenario Studio</Link></main>;
 if(!report)return <main className={css.root}><p role="status">Reading the saved report snapshot…</p></main>;
 const source=report.source;
 return <main className={css.root}><div className={css.toolbar}><Link href="/workspace/strategy-lab/scenarios" className={css.secondary}>Back to Scenario Studio</Link><div className={css.actions}><a className={css.primary} href={`/api/scenario-decision/reports?id=${encodeURIComponent(report.id)}&format=html`} target="_blank" rel="noopener noreferrer">Print-ready view / Save PDF</a><button className={css.secondary} onClick={()=>downloadText(`slice-decision-report-${report.id}.json`,JSON.stringify(report,null,2))}>Export complete snapshot</button></div></div><header className={css.hero}><div><span className={css.kicker}>SLICE / DECISION REVIEW</span><h1>{report.title}</h1><p>Evidence into action. An immutable research snapshot for advisor review.</p><span className={css.badge}>{when(report.createdAt)}</span></div><div className={css.heroPanel}><small>Historical return / hypothetical</small><strong>{pct(source.result.strategy.totalReturnPct)}</strong><p>{source.result.effectiveStart}–{source.result.effectiveEnd}</p><small>Recorded daily paper sessions</small><strong>{source.scenario?.scenario.acceptedSessions??0}</strong></div></header>
 <section className={css.card}><span className={css.eyebrow}>Executive interpretation</span><h2>What the record supports</h2><ul className={css.notes}>{report.interpretation.map(t=><li key={t}>{t}</li>)}</ul></section>
 <section className={css.card}><h2>Historical strategy and benchmark</h2><PerformanceCharts result={source.result}/></section>
 <section className={css.card}><h2>Frozen strategy definition</h2><ul className={css.notes}>{strategySummary(source.result.spec).map(t=><li key={t}>{t}</li>)}</ul><p className={css.mono}>Source run {source.runId}<br/>Engine {source.result.engineVersion}<br/>Original result SHA-256 {source.sourceHash}</p></section>
 <section className={css.card}><h2>Forward paper tracking</h2>{source.scenario?.result?<><p>Registered {when(source.scenario.scenario.frozenAt)}. Accepted through {source.scenario.result.throughDate}. Current quotes have not been used to mark a new daily result.</p><PerformanceCharts result={source.scenario.result.calculation}/></>:<p>No accepted forward result was attached to this report. Nothing is projected into the future.</p>}</section>
 <section><div className={css.sectionHeading}><div><span className={css.eyebrow}>Context, not a backtest input</span><h2>Attached market evidence</h2></div></div><EvidenceView items={report.evidence}/></section>
 <section className={css.card}><h2>Decision framework</h2><p>Entry and exit decisions are conditional on the saved rules and eligible execution timing. Check data age, model assumptions, contradictory evidence, client suitability and review thresholds before taking any action. This report does not submit orders or identify guaranteed optimal trade times.</p></section>
 <section className={css.card}><h2>Provenance and limitations</h2><ul className={css.notes}>{[...report.limitations,...source.result.warnings].map((t,i)=><li key={i}>{t}</li>)}</ul><p className={css.mono}>Report {report.id}<br/>Snapshot checksum {report.outputHash}</p><p className={css.caption}>The checksum detects inconsistent saved content; it is not a digital signature or tamper-proof archival system. Current evidence retains its own observation and retrieval times. The complete JSON contains the original trade and observation arrays.</p></section>
 </main>;
}
