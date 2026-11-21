"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DESK_SCOUTING, type AgentDeskCommand, type AgentDeskView, type DeskSettings } from "@/lib/agent-desk/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import { IntelligencePage } from "./intelligence-ui";
import AgentDeskDashboard from "./agent-desk-view";
import css from "./agent-desk.module.css";

type Response = { ok: true; desk: AgentDeskView };
const ENDPOINT = "/api/intelligence/agent-desk";
const clone = (settings: DeskSettings): DeskSettings => ({ ...settings, policy: { ...settings.policy, allowedSymbols: [...settings.policy.allowedSymbols] }, ...(settings.scouting ? { scouting: { ...settings.scouting, universe: [...settings.scouting.universe] } } : {}), ...(settings.operations ? { operations: { ...settings.operations } } : {}) });
const signature = (settings: DeskSettings) => JSON.stringify(settings);
function checked(response: Response) {
  const value = response?.desk;
  if (response?.ok !== true || !value || value.executionMode !== "paper" || value.liveExecutionAvailable !== false || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.settings || !value.controls || value.account?.classification !== "paper-simulation" || !Array.isArray(value.history))
    throw new Error("The trading desk returned an incomplete or unsupported account. Reload before changing controls.");
  return value;
}

/** A changed signed-in owner remounts every request, draft, and account value. */
export default function AgentDesk() {
  const session = useWorkspaceSession();
  if (session.loading) return <IntelligencePage><div className={css.empty} role="status">Verifying your private trading desk…</div></IntelligencePage>;
  if (!session.user?.id || !session.firm?.id) return <IntelligencePage><div className={css.notice} role="alert">An active signed-in firm account is required to open the trading desk.</div></IntelligencePage>;
  if (session.agentDeskFounder !== true) return <IntelligencePage><div className={css.notice} role="alert">This private agent workspace is available to configured founders.</div></IntelligencePage>;
  return <AgentDeskWorkspace key={`${session.user.id}:${session.firm.id}`} />;
}

export function AgentDeskWorkspace() {
  const [desk, setDesk] = useState<AgentDeskView | null>(null);
  const [draft, setDraft] = useState<DeskSettings | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [symbolsText, setSymbolsText] = useState("");
  const [scoutUniverseText, setScoutUniverseText] = useState("");
  const [dirty, setDirty] = useState(false), [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState<AgentDeskCommand["action"] | null>(null);
  const [loadError, setLoadError] = useState(""), [actionError, setActionError] = useState(""), [message, setMessage] = useState("");
  const [incomingSymbol, setIncomingSymbol] = useState<string | null>(null);
  const alive = useRef(true), current = useRef<AgentDeskView | null>(null), dirtyRef = useRef(false), baseSettings = useRef("");
  const readSequence = useRef(0), writeSequence = useRef(0), readRequest = useRef<AbortController | null>(null), writeRequest = useRef<AbortController | null>(null);
  const pendingRef = useRef<AgentDeskCommand["action"] | null>(null), accessLost = useRef(false);
  const schedulePoll = useRef<() => void>(() => {});

  const invalidateRequests = useCallback(() => {
    readSequence.current++; writeSequence.current++;
    readRequest.current?.abort(); writeRequest.current?.abort(); readRequest.current = null; writeRequest.current = null; pendingRef.current = null;
  }, []);

  const loseAccess = useCallback((reason: string) => {
    accessLost.current = true; invalidateRequests();
    current.current = null; pendingRef.current = null; dirtyRef.current = false; baseSettings.current = "";
    setDesk(null); setDraft(null); setSymbolsText(""); setScoutUniverseText(""); setPending(null); setLoading(false); setDirty(false); setConflict(false);
    setActionError(""); setMessage(""); setLoadError(reason);
  }, [invalidateRequests]);

  const apply = useCallback((next: AgentDeskView, replaceDraft = false) => {
    if (current.current && next.revision < current.current.revision) return;
    current.current = next; setDesk(next); schedulePoll.current();
    if (replaceDraft || !dirtyRef.current) {
      const settings = clone(next.settings);
      baseSettings.current = signature(settings); dirtyRef.current = false;
      setDraft(settings); setDraftRevision(next.revision); setSymbolsText(settings.policy.allowedSymbols.join(", ")); setScoutUniverseText(settings.scouting?.universe.join(", ") ?? ""); setDirty(false); setConflict(false);
    } else if (signature(next.settings) === baseSettings.current) {
      setDraftRevision(next.revision); setConflict(false);
    } else setConflict(true);
  }, []);

  const load = useCallback(async () => {
    if (!alive.current || readRequest.current || pendingRef.current || accessLost.current) return;
    const request = new AbortController(), sequence = ++readSequence.current;
    readRequest.current = request;
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { signal: request.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || request.signal.aborted || sequence !== readSequence.current) return;
      apply(checked(response)); setLoadError("");
    } catch (error) {
      if (!alive.current || request.signal.aborted || sequence !== readSequence.current || isAbortError(error)) return;
      if (error && typeof error === "object" && "status" in error && [401, 403].includes(Number(error.status))) {
        loseAccess("Access to this private desk has changed. Sign in to an active firm account before continuing.");
      } else setLoadError(error instanceof Error ? error.message : "The desk could not be refreshed. Values shown remain the last recorded account state.");
    } finally {
      if (readRequest.current === request) readRequest.current = null;
      if (alive.current && sequence === readSequence.current) setLoading(false);
    }
  }, [apply, loseAccess]);

  useEffect(() => {
    alive.current = true;
    const symbol = new URLSearchParams(window.location.search).get("symbol")?.trim().toUpperCase();
    // The browser URL is an external input and is read only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (symbol && /^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/.test(symbol)) setIncomingSymbol(symbol);
    let timer: number | undefined, running = false, disposed = false;
    const schedule = () => {
      window.clearTimeout(timer);
      if (alive.current && !disposed && !accessLost.current) timer = window.setTimeout(poll, current.current?.busy || current.current?.scouting?.busy ? 5000 : 20000);
    };
    const poll = async () => {
      if (!alive.current || disposed || running) return;
      running = true;
      if (document.visibilityState === "visible" && navigator.onLine) await load();
      running = false;
      schedule();
    };
    const wake = () => { if (document.visibilityState === "visible" && navigator.onLine) { window.clearTimeout(timer); void poll(); } };
    const ended = () => {
      window.clearTimeout(timer);
      loseAccess("Your session ended. Sign in again to open this private account.");
    };
    schedulePoll.current = schedule;
    void poll(); document.addEventListener("visibilitychange", wake); window.addEventListener("online", wake); window.addEventListener("slice-session-ended", ended);
    return () => { disposed = true; alive.current = false; invalidateRequests(); window.clearTimeout(timer); if (schedulePoll.current === schedule) schedulePoll.current = () => {}; document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); window.removeEventListener("slice-session-ended", ended); };
  }, [load, loseAccess, invalidateRequests]);

  const updateDraft = (update: (value: DeskSettings) => DeskSettings) => {
    dirtyRef.current = true; setDirty(true); setActionError(""); setMessage("");
    setDraft(value => value ? update(value) : value);
  };
  const discard = () => { if (current.current) apply(current.current, true); setActionError(""); setMessage("Unsaved safeguards were discarded. The stored policy remains in effect."); };

  async function send(command: AgentDeskCommand) {
    const safetyAction = command.action === "kill" || command.action === "pause";
    if (!current.current || accessLost.current || (pendingRef.current && !safetyAction)) return;
    writeRequest.current?.abort(); readRequest.current?.abort(); readRequest.current = null; readSequence.current++;
    const request = new AbortController(), sequence = ++writeSequence.current;
    writeRequest.current = request; pendingRef.current = command.action; setPending(command.action); setActionError(""); setMessage("");
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "POST", body: JSON.stringify(command), signal: request.signal }, { retries: 0, timeoutMs: 25000 });
      if (!alive.current || request.signal.aborted || sequence !== writeSequence.current) return;
      apply(checked(response), command.action === "settings"); setLoadError("");
      const messages: Record<AgentDeskCommand["action"], string> = {
        settings: "Your safeguards were saved. Future entries use this policy; existing positions retain their recorded exit rules.",
        cycle: "A research cycle was queued. The desk will show the actual agent findings and safeguard decision when it completes.",
        scout: "A Scout scan was queued. Observed candidates and their source trail will appear when the scan completes; your allowed trading symbols are unchanged.",
        enable: "Autonomous paper trading is enabled. The running worker can execute eligible simulated orders within your saved safeguards.",
        arm: "Manual paper approvals are enabled. A proposed entry still requires your approval and a new safeguard check.",
        pause: "New paper entries are paused. Protective exits remain available to the running worker while the account is armed.",
        kill: "The kill switch is engaged. All paper fills are stopped, including protective exits, until you resume the desk.",
        resume: "The kill switch and pause were cleared. Autonomous trading remains off; choose manual approvals or enable paper autonomy explicitly.",
        approve: "The proposal was submitted for a fresh safeguard check. Inspect the recorded execution result below.",
      };
      setMessage(messages[command.action]);
    } catch (error) {
      if (!alive.current || request.signal.aborted || sequence !== writeSequence.current || isAbortError(error)) return;
      if (error && typeof error === "object" && "status" in error && [401, 403].includes(Number(error.status))) loseAccess("Access to this private desk has changed. Sign in to an active firm account before continuing.");
      else setActionError(error instanceof Error ? error.message : "The requested desk change did not complete. Reload the current state before retrying.");
    } finally {
      if (alive.current && sequence === writeSequence.current) { pendingRef.current = null; setPending(null); writeRequest.current = null; void load(); }
    }
  }

  function action(value: Exclude<AgentDeskCommand["action"], "settings">) {
    const stored = current.current; if (!stored) return;
    if (value !== "kill" && value !== "pause" && (dirtyRef.current || stored.busy || stored.scouting?.busy)) return;
    if (value === "approve") {
      if (stored.latestCycle?.executionStatus !== "awaiting-approval" || stored.latestCycle.settingsRevision !== stored.revision || !stored.controls.armed || stored.controls.paused || stored.controls.killSwitch) return;
      void send({ action: value, revision: stored.revision, cycleId: stored.latestCycle.id, paperOnly: true });
    } else if (value === "enable" || value === "arm") void send({ action: value, revision: stored.revision, paperOnly: true });
    else void send({ action: value, revision: stored.revision });
  }

  function save() {
    if (!draft || conflict || !dirtyRef.current || current.current?.busy || current.current?.scouting?.busy) return;
    const allowedSymbols = symbolsText.split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean);
    const scouting = draft.scouting ? { ...draft.scouting, universe: scoutUniverseText.split(/[\s,]+/).map(value => value.trim().toUpperCase()).filter(Boolean) } : undefined;
    void send({ action: "settings", revision: draftRevision, settings: { ...clone(draft), symbol: draft.symbol.trim().toUpperCase(), policy: { ...draft.policy, allowedSymbols }, ...(scouting ? { scouting } : {}) } });
  }

  return <AgentDeskDashboard desk={desk} draft={draft} symbolsText={symbolsText} scoutUniverseText={scoutUniverseText} dirty={dirty} conflict={conflict} loading={loading} pending={pending}
    error={actionError || loadError} message={message} incomingSymbol={incomingSymbol}
    onAction={action} onReload={() => { if (pendingRef.current) return; accessLost.current = false; readRequest.current?.abort(); readRequest.current = null; readSequence.current++; setActionError(""); setMessage(""); setLoading(true); void load(); }} onDiscard={discard} onSave={save}
    onDraft={updateDraft} onSymbols={value => { setSymbolsText(value); dirtyRef.current = true; setDirty(true); setActionError(""); }}
    onScoutUniverse={value => { setScoutUniverseText(value); updateDraft(settings => ({ ...settings, scouting: settings.scouting ?? { ...DEFAULT_DESK_SCOUTING, universe: [] } })); }}
    onUseIncoming={() => { if (incomingSymbol) { updateDraft(value => ({ ...value, symbol: incomingSymbol })); setIncomingSymbol(null); } }} />;
}
