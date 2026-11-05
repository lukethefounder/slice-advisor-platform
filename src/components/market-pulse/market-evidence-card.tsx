"use client";
import { useState } from "react";
import type { MarketEvidence } from "@/lib/market-evidence/contracts";
import css from "./pulse.module.css";
export function formatObservation(value: string) { return value.length === 10 ? `${value} · trading date only` : new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/New_York" }); }
export function figure(value: number | null | undefined, digits = 2) { return value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value); }
export default function MarketEvidenceCard({ evidence }: { evidence: MarketEvidence }) {
 const [expanded, setExpanded] = useState(false);
 return <aside className={css.evidence} aria-label="Retrieved Alpha Vantage evidence"><div className={css.evidenceHead}><strong>Alpha Vantage · observed evidence</strong><span>{evidence.quotes.length} verified quote{evidence.quotes.length === 1 ? "" : "s"}</span></div>
 <div className={css.evidenceQuotes}>{evidence.quotes.map(q => <div key={q.symbol}><b>{q.symbol}</b><strong>{figure(q.price)}</strong><span className={q.changePct != null && q.changePct < 0 ? css.down : css.up}>{q.changePct != null && q.changePct > 0 ? "+" : ""}{figure(q.changePct)}%</span><small>{q.state} · {q.priceKind}</small><small>{formatObservation(q.observedAt)}</small></div>)}</div>
 {evidence.retrievalNote && <p className={css.finePrint}>{evidence.retrievalNote}</p>}
 {evidence.details?.length ? <details><summary>{evidence.details.length} company, earnings or history sections · inspect exact fields</summary>{evidence.details.map(d => <article key={`${d.section}:${d.symbol}`}><h4>{d.symbol} · {d.section}</h4><small>Source version {d.snapshotId.slice(0,16)}</small><pre style={{ maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 11, overflowWrap: "anywhere" }}>{JSON.stringify(d.data, null, 2)}</pre>{d.receipts.map((r,i) => <p className={css.receipt} key={i}>{r.endpoint} · retrieved {r.retrievedAt}</p>)}</article>)}</details> : null}
 {evidence.issues.map(i => <p className={css.warning} key={i.scope + i.code}>{i.scope}: {i.message}</p>)}
 <button className={css.textButton} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? "Hide" : "Inspect"} source receipts and headlines</button>
 {expanded && <div><p>Captured for this response at {formatObservation(evidence.preparedAt)}. Saved evidence ages; it is not refreshed when you reopen a conversation. Prices use provider units; no currency conversion is applied.</p>{evidence.quotes.map(q => <p key={q.symbol}>{q.symbol}: {q.note}</p>)}
 {evidence.news.length > 0 ? evidence.news.map(n => <p key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a><small>{n.source} · {formatObservation(n.publishedAt)}</small></p>) : <p>{!evidence.newsRequested ? "Headlines were not requested." : !evidence.newsRetrieved ? "The headline lookup was unavailable; this is not evidence of no news." : "No returned headline passed the symbol and seven-day publication filters."}</p>}
 {evidence.receipts.map((r, i) => <p className={css.receipt} key={`${r.endpoint}-${i}`}>{r.endpoint} · retrieved {formatObservation(r.retrievedAt)} · {r.cacheHit ? "reused verified response" : "new request"}<br/>SHA-256 {r.sha256}</p>)}<p className={css.receipt}>Evidence {evidence.evidenceId}</p></div>}
 </aside>;
}
