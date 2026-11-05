"use client";
import { useEffect, useRef, useState } from "react";
import { studioJson } from "@/lib/studio/client";
import type { MarketConnection } from "@/lib/market-evidence/contracts";
import { formatObservation } from "./market-evidence-card";
import css from "./pulse.module.css";
export default function MarketConnectionPanel({ symbol = "SPY", disabled = false }: { symbol?: string; disabled?: boolean }) {
 const [health, setHealth] = useState<MarketConnection | null>(null), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
 const abort = useRef<AbortController | null>(null);
 useEffect(() => { const c = new AbortController(); void studioJson<{ market: MarketConnection }>("/api/market-evidence", { signal: c.signal }).then(r => setHealth(r.market)).catch(() => undefined); return () => { c.abort(); abort.current?.abort(); }; }, []);
 async function test() { if (!confirmed || busy || disabled) return; setBusy(true); setError(""); const c = new AbortController(); abort.current = c;
  try { const r = await studioJson<{ health: MarketConnection }>("/api/market-evidence", { method: "POST", signal: c.signal, body: JSON.stringify({ symbols: [symbol], test: true, confirm: true }) }, 55000); setHealth(r.health); setConfirmed(false); }
  catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Market connection failed."); }
  finally { if (!c.signal.aborted) setBusy(false); }
 }
 return <section className={css.evidence}><div className={css.evidenceHead}><strong>Market connection</strong><span>Alpha Vantage · {health?.state || "checking"}</span></div><p>{health?.message || "Loading safe connection status…"}</p><p>Requested entitlement: <b>{health?.entitlement || "unknown"}</b>. Setting an entitlement does not purchase access. Text-model verification and market-data verification are separate.</p>{health?.checkedAt && <p>Tested {formatObservation(health.checkedAt)}{health.observationAt ? ` · Observation ${formatObservation(health.observationAt)} (${health.observationState})` : ""}</p>}<label className={css.check}><input type="checkbox" checked={confirmed} disabled={disabled || busy} onChange={e => setConfirmed(e.target.checked)}/>Allow a real {symbol} quote request against the server account allowance.</label><button className={css.button} disabled={disabled || busy || !confirmed} onClick={() => void test()}>{busy ? "Checking provider…" : "Test market connection"}</button>{error && <p className={css.warning} role="alert">{error}</p>}<p>Credentials remain on the server. No trading or order submission is available through this connection.</p></section>;
}
