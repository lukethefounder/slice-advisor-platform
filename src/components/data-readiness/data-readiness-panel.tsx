"use client";
import { useEffect, useRef, useState } from "react";
import type { Readiness } from "@/lib/data-readiness/core";
import css from "./readiness.module.css";
export default function DataReadinessPanel() {
 const [data, setData] = useState<Readiness | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
 const abort = useRef<AbortController | null>(null);
 async function check() {
  abort.current?.abort(); const c = new AbortController(); abort.current = c;
  const timer = setTimeout(() => c.abort(), 13000); setBusy(true); setError("");
  try {
   const r = await globalThis.fetch("/api/data-readiness", { signal: c.signal, cache: "no-store", credentials: "same-origin" });
   const p = await r.json() as { readiness?: Readiness };
   if (!r.ok || !p.readiness) throw new Error(r.status === 401 || r.status === 403 ? "Sign in to an active firm to check data readiness." : "Readiness could not be checked. Review the server log; this does not prove that a provider key is invalid.");
   if (abort.current === c) setData(p.readiness);
  } catch (e) { if (abort.current === c) setError(c.signal.aborted ? "Readiness check timed out. Existing observations are unchanged." : e instanceof Error ? e.message : "Readiness check failed."); }
  finally { clearTimeout(timer); if (abort.current === c) setBusy(false); }
 }
 useEffect(() => { void check(); return () => { abort.current?.abort(); abort.current = null; }; }, []);
 const blocked = data?.database.state !== "ready", alpha = data?.providers.alpha;
 return <section className={css.panel} aria-label="Data readiness" data-state={data ? blocked ? "blocked" : "ready" : "checking"}>
  <div className={css.top}><span className={css.dot} aria-hidden="true"/><div><strong>{busy ? "Checking the data foundation" : error ? "Data readiness needs review" : blocked ? "Storage setup needs attention" : "Research storage is reachable"}</strong><p>{error || data?.database.message || "Inspecting database tables and private provider configuration. No paid provider request is made."}</p></div><button type="button" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Check again"}</button></div>
  {data && <><div className={css.modules}>{data.modules.map(m => <span key={m.name} data-ready={m.ready}>{m.ready ? "✓" : "!"} {m.name}</span>)}</div>
  <details open={blocked}><summary>Storage and provider details</summary><div className={css.details}>
   {data.database.missing.length > 0 && <p><b>Missing tables:</b> {data.database.missing.join(", ")}. API keys cannot create database tables. Use the reviewed database repair command supplied with this update.</p>}
   {data.database.restricted.length > 0 && <p><b>Server access needs review:</b> {data.database.restricted.join(", ")}. Do not turn off row-level security.</p>}
   <p><b>Alpha Vantage:</b> {alpha === "missing" ? "Server credential missing or placeholder." : "Credential is configured; endpoint access is not verified by this check."} Requested mode: {data.providers.entitlement}.</p>
   <p><b>Market gateway policy:</b> {data.providers.gatewayBudget.configurationError || (data.providers.gatewayBudget.betaEnabled ? "Beta access: Slice market-data usage allowances are disabled. Provider entitlements, security protections, and audit logging remain." : `${data.providers.gatewayBudget.perMinute ?? "No local cap"} requests/minute and ${data.providers.gatewayBudget.perDay ?? "no local cap"}/day. These are local settings, not proof of provider entitlement.`)} Other legacy collectors may retain separate counters.</p>
   <p><b>OpenAI:</b> {data.providers.openai === "missing" ? "Server credential missing or placeholder." : "Credential is configured; use AI Studio’s Connection test to verify a real response."}</p>
   <p>Once storage is ready: verify a quote and history, publish research, import historical datasets, then save a backtest before launching a paper scenario. A setup check does not invent missing observations, forecasts, or future outcomes.</p>
   <small>Checked {new Date(data.checkedAt).toLocaleString()}. Refresh after a database repair. This check does not inspect every column or test a model.</small>
  </div></details></>}
 </section>;
}
