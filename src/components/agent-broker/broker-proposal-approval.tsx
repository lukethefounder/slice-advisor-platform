"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";
import type { DeskCycle } from "@/lib/agent-desk/contracts";
import type { BrokerSubmission, BrokerView } from "@/lib/agent-broker/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import css from "./broker-settings.module.css";

const ENDPOINT = "/api/intelligence/agent-desk/broker";
type Response = { ok: true; broker: BrokerView; result?: BrokerSubmission };
function checked(response: Response) {
  const value = response?.broker;
  if (response?.ok !== true || value?.version !== 1 || value.provider !== "alpaca" || !Number.isSafeInteger(value.revision) || !value.controls || !Array.isArray(value.recentIntents)) throw new Error("The broker approval status could not be verified.");
  return value;
}
export function brokerApprovalReason(cycle: DeskCycle, broker: BrokerView | null) {
  if (!broker) return "Load the current broker status before reviewing this proposal.";
  const mode = cycle.executionTarget === "alpaca-live" ? "live" : cycle.executionTarget === "alpaca-paper" ? "paper" : null;
  if (!mode || mode !== broker.mode) return "This research cycle does not match the connected broker environment. Run a new cycle for the intended account.";
  if (!Number.isSafeInteger(cycle.brokerContextRevision) || cycle.brokerContextRevision !== broker.revision) return "The broker connection or policy changed after this research. Run a new cycle before approving an order.";
  if (!broker.connected || !broker.controls.enabled || broker.controls.paused) return "Manual broker execution is not enabled. Review the connection and activation in Settings.";
  if (broker.controls.autonomous) return "Autonomous broker submissions are enabled. Manual submission is unavailable for this cycle; inspect its execution receipt.";
  if (mode === "live" && !broker.liveServerEnabled) return "Live execution is disabled on this server.";
  if (!cycle.proposal || !["buy", "sell"].includes(cycle.proposal.action)) return "Chief recorded a hold or no executable proposal.";
  if (broker.recentIntents.some(intent => intent.cycleId === cycle.id) || broker.pendingIntent?.cycleId === cycle.id) return "A broker submission receipt already exists for this cycle. Inspect or reconcile that receipt before researching another order.";
  return null;
}
export default function FounderBrokerProposal({ cycle }: { cycle: DeskCycle }) {
  const session = useWorkspaceSession();
  if (session.loading || !session.user?.id || !session.firm?.id || session.agentDeskFounder !== true || !["alpaca-paper", "alpaca-live"].includes(cycle.executionTarget || "")) return null;
  return <BrokerProposalWorkspace key={`${session.user.id}:${session.firm.id}:${cycle.id}:${cycle.brokerContextRevision}`} cycle={cycle} />;
}
export function BrokerProposalWorkspace({ cycle }: { cycle: DeskCycle }) {
  const [broker, setBroker] = useState<BrokerView | null>(null), [result, setResult] = useState<BrokerSubmission | null>(null);
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const alive = useRef(false), revoked = useRef(false), writing = useRef(false), sequence = useRef(0), request = useRef<AbortController | null>(null);
  const cancelRequest = useCallback(() => { sequence.current++; request.current?.abort(); request.current = null; }, []);
  const revoke = useCallback(() => { revoked.current = true; cancelRequest(); setBroker(null); setResult(null); setPending(false); setLoading(false); setError("Founder access ended. Sign in again to review broker execution."); }, [cancelRequest]);
  const load = useCallback(async () => {
    if (!alive.current || revoked.current || writing.current || request.current) return;
    const id = ++sequence.current, controller = new AbortController(); request.current = controller;
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "GET", signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || revoked.current || id !== sequence.current) return;
      setBroker(checked(response)); setError("");
    } catch (caught) {
      if (!alive.current || revoked.current || id !== sequence.current || isAbortError(caught)) return;
      if ([401, 403].includes((caught as { status?: number })?.status ?? 0)) { revoke(); return; }
      setError(caught instanceof Error ? caught.message : "Broker approval status could not be loaded.");
    } finally { if (alive.current && id === sequence.current) { request.current = null; setLoading(false); } }
  }, [revoke]);
  useEffect(() => {
    alive.current = true; revoked.current = false;
    const wake = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); };
    window.addEventListener("slice-session-ended", revoke); window.addEventListener("online", wake); document.addEventListener("visibilitychange", wake);
    void Promise.resolve().then(() => { if (alive.current) void load(); });
    return () => { alive.current = false; cancelRequest(); window.removeEventListener("slice-session-ended", revoke); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); };
  }, [cancelRequest, load, revoke]);
  const approve = async () => {
    if (!alive.current || revoked.current || writing.current || !broker || error || brokerApprovalReason(cycle, broker)) return;
    cancelRequest(); const id = ++sequence.current, controller = new AbortController(); request.current = controller; writing.current = true; setPending(true); setError(""); setResult(null);
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "POST", body: JSON.stringify({ action: "approve", revision: broker.revision, cycleId: cycle.id }), signal: controller.signal }, { retries: 0, timeoutMs: 30000 });
      if (!alive.current || revoked.current || id !== sequence.current) return;
      setBroker(checked(response)); setResult(response.result ?? null);
      if (!response.result) setError("The server returned no submission receipt. Reconcile the broker account before submitting another order.");
    } catch (caught) {
      if (!alive.current || revoked.current || id !== sequence.current || isAbortError(caught)) return;
      if ([401, 403].includes((caught as { status?: number })?.status ?? 0)) { revoke(); return; }
      setError(`${caught instanceof Error ? caught.message : "The submission response could not be verified."} An interrupted response is not a rejection. Reconcile the broker receipt before attempting another order.`);
    } finally { if (alive.current && id === sequence.current) { request.current = null; writing.current = false; setPending(false); } }
  };
  return <BrokerProposalView cycle={cycle} broker={broker} result={result} pending={pending} loading={loading} error={error} onReload={() => void load()} onApprove={() => void approve()} />;
}
export function BrokerProposalView({ cycle, broker, result, pending, loading, error, onReload, onApprove }: {
  cycle: DeskCycle; broker: BrokerView | null; result: BrokerSubmission | null; pending: boolean; loading: boolean; error: string; onReload: () => void; onApprove: () => void;
}) {
  const live = cycle.executionTarget === "alpaca-live", reason = brokerApprovalReason(cycle, broker);
  return <section className={css.panel} aria-label="Exact broker proposal approval">
    <div className={css.sectionHead}><div><p className={css.eyebrow}><ShieldCheck size={13} aria-hidden />{live ? "LIVE BROKERAGE" : "ALPACA PAPER"} / EXACT PROPOSAL</p><h3>{cycle.proposal?.action.toUpperCase() || "HOLD"} {cycle.symbol} · broker approval</h3><p>{live ? "This submits a real brokerage order when the proposal passes the current broker checks." : "This submits to Alpaca’s paper account, with broker-reported order and fill status."} The server revalidates the recorded cycle, current quote, evidence, position, and saved limits.</p></div><span className={css.tag}>Cycle {cycle.id}</span></div>
    {loading && <p role="status" className={css.small}>Checking the matching broker connection and policy revision…</p>}
    {reason && <p className={css.notice}>{reason}</p>}
    {error && <p role="alert" className={css.notice} data-tone="negative">{error}</p>}
    {result && <div role="status" className={css.notice} data-tone={result.status === "blocked" || result.status === "uncertain" ? "caution" : "positive"}><strong>{result.status === "accepted" ? "Broker accepted the request · fill not yet confirmed" : `Submission status: ${result.status}`}</strong><p>{result.message}</p>{result.intent && <p className={css.small}>{result.intent.mode === "live" ? "Live brokerage" : "Alpaca paper"} · {result.intent.clientOrderId} · {result.intent.status}</p>}</div>}
    <div className={css.actions}><button type="button" className={live ? css.liveButton : css.primary} disabled={loading || pending || Boolean(error) || Boolean(reason) || Boolean(result)} onClick={onApprove}>{pending ? <RefreshCw size={14} className={css.spin} aria-hidden /> : <ShieldCheck size={14} aria-hidden />}{pending ? "Waiting for broker response…" : live ? "Submit approved live order" : "Submit approved Alpaca paper order"}</button><button type="button" className={css.secondary} disabled={pending} onClick={onReload}>Reload approval status</button><Link href="/workspace/settings#founder-broker" prefetch={false} className={css.textButton}>Broker trade brief &amp; receipts<ArrowUpRight size={12} aria-hidden /></Link></div>
    <p className={css.small}>A broker acceptance is distinct from a fill. Current policy revision must match the one captured for this research; changed settings require a new cycle.</p>
  </section>;
}
