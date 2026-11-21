"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceSession } from "@/components/workspace/premium/session";
import type { AgentCollaborationView } from "@/lib/agent-desk/collaboration-types";
import type { AgentRole } from "@/lib/agent-desk/contracts";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import AgentCollaborationDashboard from "./agent-collaboration-view";

const ENDPOINT = "/api/intelligence/agent-desk/collaboration";
type Response = { ok: true; collaboration: AgentCollaborationView };
type Command = { action: "read-brief"; id: string } | { action: "message"; body: string; to: AgentRole | "team" };
export type AgentCollaborationMode = "board" | "briefs" | "desk";

function checked(response: Response) {
  const value = response?.collaboration;
  if (response?.ok !== true || !value || !Array.isArray(value.board) || !Array.isArray(value.briefs) || value.learning?.advisoryOnly !== true || !Array.isArray(value.learning.lessons)) {
    throw new Error("The private agent channel returned an incomplete response. Refresh to retry.");
  }
  return value;
}

/** Nothing mounts or requests founder data until the server-computed permission is true. */
export default function FounderAgentCollaboration({ mode }: { mode: AgentCollaborationMode }) {
  const session = useWorkspaceSession();
  if (session.loading || session.agentDeskFounder !== true || !session.user?.id || !session.firm?.id) return null;
  return <AgentCollaborationWorkspace key={`${session.user.id}:${session.firm.id}:${mode}`} mode={mode} />;
}

export function AgentCollaborationWorkspace({ mode }: { mode: AgentCollaborationMode }) {
  const [value, setValue] = useState<AgentCollaborationView | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null), [body, setBody] = useState(""), [to, setTo] = useState<AgentRole | "team">("team");
  const alive = useRef(true), revoked = useRef(false), busy = useRef(false), sequence = useRef(0), request = useRef<AbortController | null>(null);

  const invalidateRequests = useCallback(() => {
    sequence.current++; request.current?.abort(); request.current = null;
  }, []);

  const clearPrivateState = useCallback(() => {
    revoked.current = true; invalidateRequests(); busy.current = false;
    setValue(null); setBody(""); setTo("team"); setPending(null); setNotice(""); setLoading(false);
    setError("Founder access is no longer available for this session. Private agent data has been cleared.");
  }, [invalidateRequests]);

  const load = useCallback(async () => {
    if (!alive.current || revoked.current || busy.current || request.current) return;
    const controller = new AbortController(), current = ++sequence.current;
    request.current = controller;
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || controller.signal.aborted || current !== sequence.current) return;
      setValue(checked(response)); setError("");
    } catch (reason) {
      if (!alive.current || controller.signal.aborted || current !== sequence.current || isAbortError(reason)) return;
      if (reason && typeof reason === "object" && "status" in reason && [401, 403].includes(Number(reason.status))) clearPrivateState();
      else setError(reason instanceof Error ? reason.message : "The private agent channel could not be refreshed.");
    } finally {
      if (request.current === controller) request.current = null;
      if (alive.current && current === sequence.current) setLoading(false);
    }
  }, [clearPrivateState]);

  useEffect(() => {
    alive.current = true;
    let disposed = false, timer: number | undefined;
    const schedule = () => { if (disposed || !alive.current) return; timer = window.setTimeout(async () => { if (!disposed && document.visibilityState === "visible" && navigator.onLine !== false) await load(); schedule(); }, 20000); };
    const wake = () => { if (!disposed && document.visibilityState === "visible" && navigator.onLine !== false) void load(); };
    void Promise.resolve().then(() => { if (!disposed) void load(); }); schedule();
    window.addEventListener("online", wake); document.addEventListener("visibilitychange", wake); window.addEventListener("slice-session-ended", clearPrivateState);
    return () => { disposed = true; alive.current = false; invalidateRequests(); if (timer) window.clearTimeout(timer); window.removeEventListener("online", wake); document.removeEventListener("visibilitychange", wake); window.removeEventListener("slice-session-ended", clearPrivateState); };
  }, [load, clearPrivateState, invalidateRequests]);

  async function send(command: Command) {
    if (!alive.current || revoked.current || busy.current) return;
    request.current?.abort();
    const controller = new AbortController(), current = ++sequence.current;
    request.current = controller; busy.current = true; setPending(command.action === "read-brief" ? command.id : "message"); setError(""); setNotice("");
    try {
      const response = await intelligenceFetch<Response>(ENDPOINT, { method: "POST", body: JSON.stringify(command), signal: controller.signal }, { retries: 0, timeoutMs: 20000 });
      if (!alive.current || controller.signal.aborted || current !== sequence.current) return;
      setValue(checked(response));
      if (command.action === "message") { setBody(""); setNotice("Your review note was stored in this private agent channel."); }
      else setNotice("The trade brief was marked as read.");
    } catch (reason) {
      if (!alive.current || controller.signal.aborted || current !== sequence.current || isAbortError(reason)) return;
      if (reason && typeof reason === "object" && "status" in reason && [401, 403].includes(Number(reason.status))) clearPrivateState();
      else setError(reason instanceof Error ? reason.message : "The change was not saved. Refresh and retry.");
    } finally {
      if (alive.current && current === sequence.current) { busy.current = false; request.current = null; setPending(null); setLoading(false); }
    }
  }

  return <AgentCollaborationDashboard mode={mode} value={value} loading={loading} error={error} notice={notice} pending={pending} body={body} to={to}
    onBody={setBody} onTo={setTo} onMessage={() => { if (body.trim()) void send({ action: "message", body: body.trim(), to }); }}
    onRead={id => { void send({ action: "read-brief", id }); }} onReload={() => { if (!busy.current) { revoked.current = false; void load(); } }} />;
}
