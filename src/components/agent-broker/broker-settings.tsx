"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_BROKER_POLICY, type BrokerCommand, type BrokerMode, type BrokerPolicy, type BrokerSubmission, type BrokerView } from "@/lib/agent-broker/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import BrokerSettingsView from "./broker-settings-view";

const ENDPOINT = "/api/intelligence/agent-desk/broker";
const clonePolicy = (policy: BrokerPolicy): BrokerPolicy => ({ ...policy, allowedSymbols: [...policy.allowedSymbols] });
type Response = { ok: true; broker: BrokerView; result?: BrokerSubmission };
function checked(response: Response) {
  const value = response?.broker;
  if (response?.ok !== true || value?.version !== 1 || value.provider !== "alpaca" || !Number.isSafeInteger(value.revision)
    || !["paper", "live"].includes(value.mode) || !value.policy || !value.controls || !value.readiness
    || !Array.isArray(value.positions) || !Array.isArray(value.orders) || !Array.isArray(value.recentIntents)) {
    throw new Error("The broker connection returned an incomplete status. Reload before making a change.");
  }
  return value;
}

export default function FounderBrokerSettings() {
  const session = useWorkspaceSession();
  if (session.loading || !session.user?.id || !session.firm?.id || session.agentDeskFounder !== true) return null;
  return <BrokerSettingsWorkspace key={`${session.user.id}:${session.firm.id}`} />;
}

export function BrokerSettingsWorkspace() {
  const [value, setValue] = useState<BrokerView | null>(null);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState<BrokerCommand["action"] | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [mode, setMode] = useState<BrokerMode>("paper"), [apiKey, setApiKey] = useState(""), [apiSecret, setApiSecret] = useState("");
  const [policy, setPolicy] = useState<BrokerPolicy>(() => clonePolicy(DEFAULT_BROKER_POLICY));
  const [symbols, setSymbols] = useState(DEFAULT_BROKER_POLICY.allowedSymbols.join(", "));
  const [dirty, setDirty] = useState(false), [conflict, setConflict] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState(""), [autonomous, setAutonomous] = useState(false);
  const alive = useRef(false), accessLost = useRef(false), current = useRef<BrokerView | null>(null);
  const busy = useRef<BrokerCommand["action"] | null>(null), sequence = useRef(0), request = useRef<AbortController | null>(null);
  const dirtyRef = useRef(false), basePolicy = useRef(""), schedule = useRef<() => void>(() => {});
  const cancelRequest = useCallback(() => { sequence.current++; request.current?.abort(); request.current = null; }, []);

  const clearPrivate = useCallback(() => {
    accessLost.current = true; sequence.current++; request.current?.abort(); request.current = null;
    current.current = null; busy.current = null; dirtyRef.current = false; basePolicy.current = "";
    setValue(null); setLoading(false); setPending(null); setApiKey(""); setApiSecret("");
    setPolicy(clonePolicy(DEFAULT_BROKER_POLICY)); setSymbols(""); setDirty(false); setConflict(false);
    setMode("paper"); setAcknowledgement(""); setAutonomous(false); setNotice("");
    setError("Founder access is no longer available. Sign in again to load your connection.");
  }, []);

  const apply = useCallback((next: BrokerView, reset = false) => {
    if (current.current && next.revision < current.current.revision) return;
    const initial = current.current === null;
    current.current = next; setValue(next);
    if (initial || reset) setMode(next.mode);
    if (!dirtyRef.current || reset) {
      setPolicy(clonePolicy(next.policy)); setSymbols(next.policy.allowedSymbols.join(", "));
      basePolicy.current = JSON.stringify(next.policy); dirtyRef.current = false; setDirty(false); setConflict(false);
    } else if (JSON.stringify(next.policy) !== basePolicy.current) setConflict(true);
  }, []);

  const load = useCallback(async () => {
    if (!alive.current || accessLost.current || busy.current || request.current) return;
    const controller = new AbortController(), id = ++sequence.current;
    request.current = controller;
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "GET", signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || accessLost.current || id !== sequence.current) return;
      apply(checked(response)); setError("");
    } catch (caught) {
      if (!alive.current || accessLost.current || id !== sequence.current || isAbortError(caught)) return;
      const status = (caught as { status?: number })?.status;
      if (status === 401 || status === 403) { clearPrivate(); return; }
      setError(caught instanceof Error ? caught.message : "The broker status could not be loaded.");
    } finally {
      if (alive.current && id === sequence.current) { request.current = null; setLoading(false); schedule.current(); }
    }
  }, [apply, clearPrivate]);

  useEffect(() => {
    alive.current = true; accessLost.current = false;
    let timer: number | undefined;
    const plan = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (alive.current && !accessLost.current && document.visibilityState === "visible" && navigator.onLine) {
        timer = window.setTimeout(() => { timer = undefined; void load(); }, 20000);
      }
    };
    schedule.current = plan;
    const wake = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); else if (timer !== undefined) window.clearTimeout(timer); };
    const revoked = () => { if (timer !== undefined) window.clearTimeout(timer); clearPrivate(); };
    document.addEventListener("visibilitychange", wake); window.addEventListener("online", wake); window.addEventListener("slice-session-ended", revoked);
    void Promise.resolve().then(() => { if (alive.current) void load(); });
    return () => {
      alive.current = false; cancelRequest();
      if (timer !== undefined) window.clearTimeout(timer); schedule.current = () => {};
      document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); window.removeEventListener("slice-session-ended", revoked);
    };
  }, [cancelRequest, clearPrivate, load]);

  const send = useCallback(async (command: BrokerCommand) => {
    if (!alive.current || accessLost.current || busy.current) return;
    request.current?.abort(); const controller = new AbortController(), id = ++sequence.current;
    request.current = controller; busy.current = command.action; setPending(command.action); setError(""); setNotice("");
    // A submitted credential is never retained in a populated form or browser storage.
    setApiKey(""); setApiSecret(""); setAcknowledgement("");
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "POST", body: JSON.stringify(command), signal: controller.signal }, { retries: 0, timeoutMs: 30000 });
      if (!alive.current || accessLost.current || id !== sequence.current) return;
      apply(checked(response), command.action === "connect" || command.action === "settings" || command.action === "disconnect");
      const messages: Partial<Record<BrokerCommand["action"], string>> = {
        connect: "Connection verified. Broker execution remains disabled until you explicitly enable it below.",
        settings: "Broker limits saved. Execution is paused; review the settings before enabling it again.",
        "enable-paper": "Broker paper execution enabled within your saved limits.",
        "enable-live": "Live broker execution enabled within your saved limits.",
        pause: "New broker submissions are paused. Review existing broker orders and positions below.",
        disconnect: "Stored broker credentials disconnected. Review any existing orders directly with the broker.",
        refresh: "The broker account snapshot has been refreshed.",
        reconcile: "Recorded order intents were checked against broker acknowledgments.",
      };
      setNotice(response.result?.message || messages[command.action] || "The broker action was recorded.");
    } catch (caught) {
      if (!alive.current || accessLost.current || id !== sequence.current || isAbortError(caught)) return;
      const status = (caught as { status?: number })?.status;
      if (status === 401 || status === 403) { clearPrivate(); return; }
      let detail = caught instanceof Error ? caught.message : "The request did not return a verified result.";
      if (command.action === "connect") {
        for (const secret of [command.apiKey, command.apiSecret]) if (secret) detail = detail.split(secret).join("[redacted]");
      }
      setError(`${detail} Reload status before retrying an action. An interrupted response does not prove that the server rejected it.`);
    } finally {
      if (alive.current && id === sequence.current) {
        request.current = null; busy.current = null; setPending(null); schedule.current();
      }
    }
  }, [apply, clearPrivate]);

  const editPolicy = (update: Partial<BrokerPolicy>) => {
    if (busy.current || accessLost.current) return;
    setPolicy(previous => ({ ...previous, ...update })); dirtyRef.current = true; setDirty(true);
  };
  const discard = () => { if (current.current && !busy.current) apply(current.current, true); };
  const connect = () => {
    if (!current.current || !apiKey.trim() || !apiSecret.trim()) return;
    void send({ action: "connect", revision: current.current.revision, mode, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
  };
  const save = () => {
    if (!current.current || !dirtyRef.current || conflict) return;
    const allowedSymbols = [...new Set(symbols.split(/[\s,]+/).map(symbol => symbol.trim().toUpperCase()).filter(Boolean))];
    void send({ action: "settings", revision: current.current.revision, policy: { ...policy, allowedSymbols } });
  };
  const enable = () => {
    const saved = current.current;
    if (!saved || dirtyRef.current || !saved.readiness.canEnable) return;
    if (saved.mode === "live" && saved.liveServerEnabled && acknowledgement === "ENABLE LIVE TRADING") {
      void send({ action: "enable-live", revision: saved.revision, autonomous, acknowledgement: "ENABLE LIVE TRADING" });
    } else if (saved.mode === "paper" && acknowledgement === "ENABLE PAPER TRADING") {
      void send({ action: "enable-paper", revision: saved.revision, autonomous, acknowledgement: "ENABLE PAPER TRADING" });
    }
  };
  const action = (action: "refresh" | "reconcile" | "pause" | "disconnect") => {
    if (current.current) void send({ action, revision: current.current.revision });
  };
  return <BrokerSettingsView value={value} loading={loading} pending={pending} error={error} notice={notice}
    mode={mode} apiKey={apiKey} apiSecret={apiSecret} policy={policy} symbols={symbols} dirty={dirty} conflict={conflict}
    acknowledgement={acknowledgement} autonomous={autonomous} onReload={() => void load()} onMode={setMode}
    onApiKey={setApiKey} onApiSecret={setApiSecret} onConnect={connect} onPolicy={editPolicy}
    onSymbols={next => { if (!busy.current && !accessLost.current) { setSymbols(next); dirtyRef.current = true; setDirty(true); } }}
    onSave={save} onDiscard={discard} onAcknowledgement={setAcknowledgement} onAutonomous={setAutonomous}
    onEnable={enable} onAction={action} />;
}
