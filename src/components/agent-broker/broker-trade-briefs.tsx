"use client";

import Link from "next/link";
import { FileCheck2, LockKeyhole, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BrokerFillObservation } from "@/lib/agent-broker/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import css from "./broker-settings.module.css";

const ENDPOINT = "/api/intelligence/agent-desk/broker";
type BriefState = { fills: BrokerFillObservation[]; connected: boolean; checkedAt: string | null };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown) => typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value));
const text = (value: unknown, max = 160): value is string => typeof value === "string" && value.length > 0 && value.length <= max;

/** Store only the read-only fill projection, never credentials, account balances, or arbitrary response fields. */
export function checkedBrokerBrief(response: unknown): BriefState {
  if (!object(response) || response.ok !== true || !object(response.broker) || response.broker.version !== 1 || response.broker.provider !== "alpaca"
    || typeof response.broker.connected !== "boolean" || !Array.isArray(response.broker.recentFills) || response.broker.recentFills.length > 100
    || !(response.broker.lastCheckedAt === null || timestamp(response.broker.lastCheckedAt))) throw new Error("The broker trade brief returned incomplete records. Refresh to retry.");
  const fills = response.broker.recentFills.map(value => {
    if (!object(value) || !text(value.id) || !text(value.orderId) || !text(value.clientOrderId) || !text(value.entryIntentId)
      || !(value.cycleId === null || text(value.cycleId)) || !text(value.symbol, 15) || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(value.symbol)
      || !["broker-paper", "broker-live"].includes(String(value.classification)) || !["buy", "sell"].includes(String(value.side))
      || typeof value.cumulativeFilledQuantity !== "number" || !Number.isFinite(value.cumulativeFilledQuantity) || value.cumulativeFilledQuantity <= 0
      || typeof value.averageFillPrice !== "number" || !Number.isFinite(value.averageFillPrice) || value.averageFillPrice <= 0
      || !(value.grossRealizedPnl === null || typeof value.grossRealizedPnl === "number" && Number.isFinite(value.grossRealizedPnl))
      || value.netRealizedPnl !== null || value.feesKnown !== false || typeof value.closedPosition !== "boolean" || !text(value.notes, 3000)
      || !timestamp(value.observedAt) || !(value.filledAt === null || timestamp(value.filledAt))) throw new Error("A broker fill record could not be verified. No estimated result will be displayed.");
    return { id: value.id, classification: value.classification as BrokerFillObservation["classification"], symbol: value.symbol, side: value.side as BrokerFillObservation["side"],
      orderId: value.orderId, clientOrderId: value.clientOrderId, entryIntentId: value.entryIntentId, cycleId: value.cycleId as string | null,
      cumulativeFilledQuantity: value.cumulativeFilledQuantity, averageFillPrice: value.averageFillPrice, filledAt: value.filledAt as string | null, observedAt: value.observedAt as string,
      grossRealizedPnl: value.grossRealizedPnl as number | null, netRealizedPnl: null, feesKnown: false, closedPosition: value.closedPosition, notes: value.notes } satisfies BrokerFillObservation;
  });
  return { fills: latestBrokerFillSnapshots(fills), connected: response.broker.connected, checkedAt: response.broker.lastCheckedAt as string | null };
}
/** Partial fills are cumulative: show one latest snapshot per owned broker order, without summing them. */
export function latestBrokerFillSnapshots(fills: BrokerFillObservation[]): BrokerFillObservation[] {
  const latest = new Map<string, BrokerFillObservation>();
  for (const fill of fills) {
    const key = `${fill.classification}:${fill.entryIntentId}:${fill.orderId}`, previous = latest.get(key);
    if (!previous || fill.cumulativeFilledQuantity > previous.cumulativeFilledQuantity || fill.cumulativeFilledQuantity === previous.cumulativeFilledQuantity && Date.parse(fill.observedAt) > Date.parse(previous.observedAt)) latest.set(key, fill);
  }
  return [...latest.values()].sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt));
}
export default function FounderBrokerTradeBriefs() {
  const session = useWorkspaceSession();
  if (session.loading || session.agentDeskFounder !== true || !session.user?.id || !session.firm?.id) return null;
  return <BrokerTradeBriefsWorkspace key={`${session.user.id}:${session.firm.id}`} />;
}
export function BrokerTradeBriefsWorkspace() {
  const [value, setValue] = useState<BriefState | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [accessLost, setAccessLost] = useState(false);
  const alive = useRef(false), revoked = useRef(false), sequence = useRef(0), request = useRef<AbortController | null>(null), plan = useRef<() => void>(() => {});
  const invalidate = useCallback(() => { sequence.current++; request.current?.abort(); request.current = null; }, []);
  const clearPrivate = useCallback(() => {
    revoked.current = true; invalidate(); setValue(null); setAccessLost(true); setLoading(false);
    setError("Founder access ended. Private brokerage results have been cleared; sign in again to view them.");
    plan.current();
  }, [invalidate]);
  const load = useCallback(async () => {
    if (!alive.current || revoked.current || request.current || document.visibilityState !== "visible" || navigator.onLine === false) return;
    const controller = new AbortController(), id = ++sequence.current;
    request.current = controller; setLoading(true);
    try {
      const response = await intelligenceFetch<unknown>(ENDPOINT, { method: "GET", signal: controller.signal }, { retries: 0, timeoutMs: 20_000 });
      if (!alive.current || revoked.current || controller.signal.aborted || id !== sequence.current) return;
      setValue(checkedBrokerBrief(response)); setError("");
    } catch (caught) {
      if (!alive.current || revoked.current || controller.signal.aborted || id !== sequence.current || isAbortError(caught)) return;
      const status = (caught as { status?: number })?.status;
      if (status === 401 || status === 403) { clearPrivate(); return; }
      setError(caught instanceof Error ? caught.message : "The latest broker trade brief could not be refreshed.");
    } finally {
      if (alive.current && id === sequence.current) { request.current = null; setLoading(false); plan.current(); }
    }
  }, [clearPrivate]);
  useEffect(() => {
    alive.current = true; revoked.current = false;
    let disposed = false, timer: number | undefined;
    const cancelTimer = () => { if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; } };
    plan.current = () => {
      cancelTimer();
      if (!disposed && alive.current && !revoked.current && document.visibilityState === "visible" && navigator.onLine !== false)
        timer = window.setTimeout(() => { timer = undefined; void load(); }, 30_000);
    };
    const wake = () => {
      cancelTimer();
      if (document.visibilityState === "visible" && navigator.onLine !== false) void load();
      else { invalidate(); setLoading(false); }
    };
    const endSession = () => { cancelTimer(); clearPrivate(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("online", wake); window.addEventListener("offline", wake); window.addEventListener("slice-session-ended", endSession);
    void Promise.resolve().then(() => { if (!disposed) void load(); });
    return () => {
      disposed = true; alive.current = false; cancelTimer(); invalidate(); plan.current = () => {};
      document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); window.removeEventListener("offline", wake); window.removeEventListener("slice-session-ended", endSession);
    };
  }, [clearPrivate, invalidate, load]);
  return <BrokerTradeBriefsView value={value} loading={loading} error={error} accessLost={accessLost} onReload={() => void load()} />;
}
const usd = (value: number | null) => value === null ? "Not available" : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " ET" : "Not yet recorded";
export function BrokerTradeBriefsView({ value, loading, error, accessLost, onReload }: { value: BriefState | null; loading: boolean; error: string; accessLost: boolean; onReload: () => void }) {
  return <section className={css.panel} id="founder-broker-trade-briefs" aria-label="Private founder broker trade briefs">
    <header className={css.header}><div><p className={css.eyebrow}><LockKeyhole size={13} aria-hidden />Founder access · private in-app delivery</p><h2>Your broker trades. <em>Confirmed.</em></h2><p>Actual Alpaca fill observations arrive here after the worker reconciles them. Paper brokerage and live executions retain their own labels; accepted or blocked orders are not reported as completed trades.</p></div><div className={css.actions}><button className={css.secondary} type="button" disabled={loading || accessLost} onClick={onReload}><RefreshCw size={13} aria-hidden className={loading ? css.spin : undefined} />Refresh trade brief</button><Link className={css.textButton} href="/workspace/settings#founder-broker" prefetch={false}>Broker controls</Link></div></header>
    {error && <p className={css.notice} data-tone="negative" role="alert">{error}</p>}
    {loading && !value && <p className={css.empty} role="status">Loading your private broker fill records…</p>}
    {value && <><div className={css.badges}><span><FileCheck2 size={12} aria-hidden />{value.fills.length} recent execution snapshots</span><span>{value.connected ? "Broker connected" : "Stored history · broker disconnected"}</span><span>Last account check: {date(value.checkedAt)}</span></div>
      {value.fills.length ? <div className={css.tableWrap}><table><caption>Broker-confirmed trades · latest cumulative snapshot for each order</caption><thead><tr><th scope="col">Trade and environment</th><th scope="col">Confirmed fill</th><th scope="col">Gross realized result</th><th scope="col">Net result</th><th scope="col">Broker record</th></tr></thead><tbody>{value.fills.map(fill => <tr key={`${fill.classification}:${fill.orderId}:${fill.entryIntentId}`}><th scope="row">{fill.side.toUpperCase()} {fill.symbol}<small>{fill.classification === "broker-live" ? "Live brokerage · real money" : "Alpaca paper · simulated brokerage"}</small><small>{fill.closedPosition ? "Owned entry quantity closed" : fill.side === "buy" ? "Entry observed; exit outcome pending" : "Exit observed; position may remain open"}</small></th><td>{fill.cumulativeFilledQuantity.toLocaleString("en-US")} shares @ {usd(fill.averageFillPrice)}<small>{fill.filledAt ? "Broker fill time" : "Observed cumulative fill"}: {date(fill.filledAt ?? fill.observedAt)}</small></td><td>{fill.grossRealizedPnl === null ? fill.side === "buy" ? "Awaiting an exit" : "Attribution unavailable" : usd(fill.grossRealizedPnl)}<small>Before unverified fees</small></td><td>Not determined<small>Fees are not reconciled</small></td><td><details className={css.details}><summary>Execution details</summary><p>Order: {fill.orderId}</p><p>Client order: {fill.clientOrderId}</p><p>Chief cycle: {fill.cycleId ?? "Protective exit"}</p><p>Observed: {date(fill.observedAt)}</p><p>{fill.notes}</p></details></td></tr>)}</tbody></table></div> : <p className={css.empty}>No confirmed broker fills yet. Enable and review the broker paper workflow in Settings; completed broker observations will appear here automatically.</p>}
      <p className={css.small}>Quantities are cumulative for each broker order. Only the latest available snapshot per order is shown; snapshots must not be added together. Gross results exclude unverified fees, and no net return or win-rate forecast is inferred. These private records are separate from the local paper simulation and the advisor market brief email.</p></>}
  </section>;
}
