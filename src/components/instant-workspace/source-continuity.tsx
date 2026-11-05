"use client";
import type { SectionResponse } from "@/lib/market-visuals/contracts";
import css from "./surface.module.css";
export default function SourceContinuity({ rows, symbol, updating, cold }: { rows: SectionResponse[]; symbol: string; updating: boolean; cold: boolean }) {
 const selected = rows.filter(r => r.symbol === symbol);
 return <details className={css.continuity}>
  <summary><span className={css.indicator} data-active={updating}/><b>{cold ? "First observation pending" : "Shared market evidence"}</b><span>{updating ? "Refreshing independently" : "Inspect source versions"}</span></summary>
  <p>{cold ? "This account has no saved observation for this view yet. Provider response time and access still apply." : "Saved observations render before refresh. Provider time is authoritative; a fresh page is not proof of a fresh price. Matching snapshot IDs describe the same source values across Workspace, Market Visuals, and Studio."}</p>
  <div className={css.sources}>{selected.map(r => <div key={`${r.section}:${r.range}`}><strong>{r.symbol} · {r.section}{r.section === "history" ? ` · ${r.range}` : ""}</strong><code>{r.snapshotId?.slice(0, 16) || "Source ID unavailable"}</code>{r.receipts.map((p,i) => <small key={i}>{p.endpoint} · retrieved {p.retrievedAt} · {p.cacheState === "stale" ? "older saved response" : p.cacheState === "retained" ? "last good response; refresh failed" : p.cacheHit ? "reused response" : "new response"}</small>)}</div>)}</div>
 </details>;
}
