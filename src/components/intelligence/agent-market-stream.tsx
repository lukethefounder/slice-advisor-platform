"use client";

import { useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import type { MarketStreamView } from "@/lib/agent-desk/market-stream-types";
import css from "./agent-desk.module.css";

export type AgentMarketSnapshot = MarketStreamView;
const ENDPOINT = "/api/intelligence/agent-desk/market-stream";
function checked(value: unknown): AgentMarketSnapshot {
  const result = value as AgentMarketSnapshot;
  if (result?.version !== 1 || !["connecting", "live", "stale", "offline", "error"].includes(result.status)
    || !["iex", "sip", null].includes(result.feed) || typeof result.checkedAt !== "string" || !Array.isArray(result.quotes)
    || !result.quotes.every(quote => typeof quote.symbol === "string" && [quote.bid, quote.ask, quote.mid, quote.spreadBps, quote.ageMs, quote.transportLagMs].every(Number.isFinite)
      && typeof quote.observedAt === "string" && typeof quote.receivedAt === "string")) {
    throw new Error("The quote stream returned an incomplete observation.");
  }
  return result;
}

export default function AgentMarketStream() {
  const [value, setValue] = useState<AgentMarketSnapshot | null>(null);
  const [state, setState] = useState<AgentMarketSnapshot["status"]>("connecting");
  const [message, setMessage] = useState("Connecting to the founder’s configured market-data feed.");
  useEffect(() => {
    let disposed = false, revoked = false, stream: EventSource | null = null;
    let retry: number | undefined, watchdog: number | undefined;
    let attempts = 0;
    const clearTimers = () => { if (retry !== undefined) window.clearTimeout(retry); if (watchdog !== undefined) window.clearTimeout(watchdog); retry = undefined; watchdog = undefined; };
    const stop = () => { clearTimers(); stream?.close(); stream = null; };
    const active = () => !disposed && !revoked && document.visibilityState === "visible" && navigator.onLine;
    const schedule = () => {
      if (!active()) return;
      const delay = Math.min(60000, 5000 * 2 ** Math.min(attempts++, 4));
      retry = window.setTimeout(() => { retry = undefined; connect(); }, delay);
    };
    const interrupted = (detail: string) => {
      if (disposed || revoked) return;
      stop(); setState("stale"); setMessage(detail); schedule();
    };
    const guard = () => {
      if (watchdog !== undefined) window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => interrupted("The stream stopped updating. Saved quotes remain timestamped while the connection retries."), 30000);
    };
    const connect = () => {
      if (!active() || stream) return;
      setState("connecting"); setMessage("Connecting to the configured feed. Existing quotes retain their original timestamps.");
      if (typeof EventSource === "undefined") { setState("offline"); setMessage("Streaming is not available in this browser. Saved research observations remain available below."); return; }
      const next = new EventSource(ENDPOINT); stream = next; guard();
      next.addEventListener("market", event => {
        if (disposed || revoked || stream !== next) return;
        try {
          const snapshot = checked(JSON.parse((event as MessageEvent).data));
          attempts = 0; setValue(snapshot); setState(snapshot.status); setMessage(snapshot.message || ""); guard();
        } catch { interrupted("The feed returned an unverified observation. Reconnecting before displaying new quotes."); }
      });
      next.addEventListener("revoked", () => { if (!disposed && stream === next) endSession(); });
      next.onerror = () => { if (stream === next) interrupted("The stream connection was interrupted. Check the broker connection and feed entitlement if it does not recover."); };
    };
    const visibility = () => { if (active()) connect(); else { stop(); setState("offline"); setMessage(navigator.onLine ? "Streaming is paused while this page is hidden." : "Your browser is offline. Saved quotes are not current."); } };
    const endSession = () => { revoked = true; stop(); setValue(null); setState("offline"); setMessage("Founder access ended. Sign in again to reconnect the private feed."); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("online", visibility); window.addEventListener("offline", visibility); window.addEventListener("slice-session-ended", endSession);
    void Promise.resolve().then(() => { if (!disposed) visibility(); });
    return () => { disposed = true; stop(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("online", visibility); window.removeEventListener("offline", visibility); window.removeEventListener("slice-session-ended", endSession); };
  }, []);
  return <AgentMarketStreamView value={value} state={state} message={message} />;
}

const time = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " ET" : "Not recorded";
const price = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const elapsed = (value: number) => value >= 1000 ? `${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} s` : `${Math.max(0, Math.round(value))} ms`;
export function AgentMarketStreamView({ value, state, message }: { value: AgentMarketSnapshot | null; state: AgentMarketSnapshot["status"]; message: string }) {
  return <div className={css.streamPanel} aria-label="Founder market-data stream">
    <div className={css.streamHead}><div><h3><Radio size={15} aria-hidden />Streaming market observations</h3><p>{value?.feed ? `${value.feed.toUpperCase()} feed · server checked ${time(value.checkedAt)} · last market message ${time(value.lastMessageAt)}` : "A connected broker and an authorized data feed are required."}</p></div><span className={css.pill} data-tone={state === "live" ? "positive" : "caution"}>{state === "connecting" && <RefreshCw size={11} className={css.loading} aria-hidden />}{state === "live" ? "Live feed" : state === "stale" ? "Stale / reconnecting" : state === "offline" ? "Offline" : state === "error" ? "Feed needs attention" : "Connecting"}</span></div>
    {message && <p className={css.fine} role="status">{message}</p>}
    {value?.quotes.length ? <div className={css.tableWrap}><table className={css.table}><caption>Timestamped bid / ask observations · informational only</caption><thead><tr><th scope="col">Instrument</th><th scope="col">Bid / ask</th><th scope="col">Midpoint</th><th scope="col">Spread</th><th scope="col">Observation age</th><th scope="col">Delivery lag</th></tr></thead><tbody>{value.quotes.map(quote => <tr key={quote.symbol}><th scope="row">{quote.symbol}<small>Observed {time(quote.observedAt)}</small></th><td>{price(quote.bid)} / {price(quote.ask)}</td><td>{price(quote.mid)}</td><td>{quote.spreadBps.toFixed(1)} bps</td><td>{elapsed(quote.ageMs)}<small>At server check</small></td><td>{elapsed(quote.transportLagMs)}<small>Received {time(quote.receivedAt)}</small></td></tr>)}</tbody></table></div> : <p className={css.fine}>No quote has been received on this stream.</p>}
    <p className={css.fine}>A live feed label describes the connection, not a guaranteed current quote for every symbol. Each order rechecks freshness, spread, buying power, and your execution limits separately.</p>
  </div>;
}
