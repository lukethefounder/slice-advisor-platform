"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SchedulingView = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  url: string | null;
  label: string;
  providerKey: string | null;
  provider: string | null;
  host: string | null;
  fallbackMessage: string;
};

type AdvisorMember = {
  id: string;
  firmId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  calendarColor: string;
  calendlyUrl: string | null;
  calendlyLabel: string;
  calendlyEnabled: boolean;
  scheduling: SchedulingView;
  eligibleForClients: boolean;
  assignedClientCount: number;
  unresolvedInboxCount: number;
};

type RoutingClient = {
  id: string;
  fullName: string;
  email: string | null;
  householdName: string | null;
  clientType: string;
  riskProfile: string;
  status: string;
  portalEnabled: boolean;
  portalInviteExpiresAt: string | null;
  portalOnboardingStatus: string;
  portalLastLoginAt: string | null;
  assignedAdvisorMembershipId: string | null;
  assignedAdvisor: AdvisorMember | null;
};

type AssignmentHistoryItem = {
  id: string;
  previousAdvisorMembershipId: string | null;
  nextAdvisorMembershipId: string;
  reason: string | null;
  createdAt: string;
  changedBy: string;
  previousAdvisor: AdvisorMember | null;
  nextAdvisor: AdvisorMember | null;
};

type RoutingPayload = {
  ok: boolean;
  firm: {
    id: string;
    name: string;
  };
  membership: AdvisorMember;
  permissions: {
    canManageAssignments: boolean;
    canCreatePortalInvites: boolean;
    canRevokePortalAccess: boolean;
    canViewFirmOversight: boolean;
  };
  metrics: {
    totalFirmClients: number;
    visibleClients: number;
    unassignedClients: number;
    eligibleAdvisors: number;
    schedulingIncomplete: number;
    unreadInboxItems: number;
    highPriorityInboxItems: number;
  };
  members: AdvisorMember[];
  schedulingIncompleteMembers: AdvisorMember[];
  clients: RoutingClient[];
  assignmentQueue: RoutingClient[];
  assignmentHistory: AssignmentHistoryItem[];
};

type InviteResult = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  inviteCode: string;
  loginUrl: string;
  expiresAt: string;
};

type ApiErrorPayload = {
  error?: string | { message?: string };
  code?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function errorMessage(value: ApiErrorPayload, fallback: string) {
  if (typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }

  if (
    value.error &&
    typeof value.error === "object" &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }

  return fallback;
}

function readableDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50";

export function AdvisorRoutingDock() {
  const pathname = usePathname();
  const visible =
    pathname === "/workspace/settings" || pathname === "/workspace/clients";
  const [expanded, setExpanded] = useState(true);
  const [payload, setPayload] = useState<RoutingPayload | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState("");
  const [reason, setReason] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [schedulingLabel, setSchedulingLabel] = useState("Schedule a meeting");
  const [schedulingEnabled, setSchedulingEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const loadController = useRef<AbortController | null>(null);

  const availableClients = useMemo(() => {
    const byId = new Map<string, RoutingClient>();

    for (const client of payload?.assignmentQueue ?? []) {
      byId.set(client.id, client);
    }

    for (const client of payload?.clients ?? []) {
      byId.set(client.id, client);
    }

    return [...byId.values()].sort((left, right) => {
      const leftUnassigned = left.assignedAdvisorMembershipId ? 1 : 0;
      const rightUnassigned = right.assignedAdvisorMembershipId ? 1 : 0;

      return (
        leftUnassigned - rightUnassigned ||
        left.fullName.localeCompare(right.fullName)
      );
    });
  }, [payload]);

  const selectedClient = useMemo(
    () =>
      availableClients.find((client) => client.id === selectedClientId) ?? null,
    [availableClients, selectedClientId],
  );

  const eligibleAdvisors = useMemo(
    () => payload?.members.filter((member) => member.eligibleForClients) ?? [],
    [payload],
  );

  function setNotice(
    text: string,
    tone: "info" | "success" | "error" = "info",
  ) {
    setMessage(text);
    setMessageTone(tone);
  }

  function applyPayload(data: RoutingPayload, preferredClientId?: string) {
    setPayload(data);
    setSchedulingUrl(data.membership.scheduling.url || "");
    setSchedulingLabel(data.membership.scheduling.label || "Schedule a meeting");
    setSchedulingEnabled(data.membership.scheduling.enabled);

    const queryClientId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("clientId")
        : null;
    const allClients = [...data.assignmentQueue, ...data.clients];
    const nextClientId =
      preferredClientId ||
      queryClientId ||
      selectedClientId ||
      allClients[0]?.id ||
      "";
    const nextClient = allClients.find((client) => client.id === nextClientId);

    setSelectedClientId(nextClientId);
    setAssignedAdvisorId(
      nextClient?.assignedAdvisorMembershipId || data.membership.id,
    );
  }

  async function load(preferredClientId?: string) {
    if (!visible) return;

    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;

    try {
      const params = new URLSearchParams({
        clientLimit: "300",
        inboxLimit: "100",
      });

      if (preferredClientId) params.set("clientId", preferredClientId);

      const response = await fetch(`/api/advisor-routing?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as RoutingPayload & ApiErrorPayload;

      if (!response.ok) {
        setNotice(
          errorMessage(data, "Unable to load advisor routing."),
          "error",
        );
        return;
      }

      applyPayload(data, preferredClientId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load advisor routing.",
        "error",
      );
    }
  }

  useEffect(() => {
    if (!visible) return;

    void load();

    function handleClientSelection(event: Event) {
      const detail = (event as CustomEvent<{ clientId?: string }>).detail;
      const clientId = detail?.clientId || "";

      if (!clientId) return;
      setInvite(null);
      void load(clientId);
    }

    window.addEventListener("slice-client-selected", handleClientSelection);

    return () => {
      loadController.current?.abort();
      window.removeEventListener("slice-client-selected", handleClientSelection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!selectedClient) return;
    setAssignedAdvisorId(
      selectedClient.assignedAdvisorMembershipId || payload?.membership.id || "",
    );
  }, [payload?.membership.id, selectedClient]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/advisor-routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action || "advisor-routing"),
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as RoutingPayload &
        ApiErrorPayload & {
          invite?: InviteResult;
        };

      if (!response.ok) {
        setNotice(errorMessage(data, "Advisor routing action failed."), "error");
        return null;
      }

      applyPayload(data, selectedClientId || undefined);
      if (data.invite) setInvite(data.invite);
      return data;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Advisor routing action failed.",
        "error",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveScheduling() {
    const data = await postAction({
      action: "saveScheduling",
      schedulingUrl,
      schedulingLabel,
      schedulingEnabled,
    });

    if (data) {
      setNotice(
        schedulingUrl.trim()
          ? "Advisor scheduling is saved and visible only to assigned clients."
          : "Scheduling settings saved. Clients will see the secure meeting-request fallback.",
        "success",
      );
    }
  }

  async function assignClient() {
    if (!selectedClient || !assignedAdvisorId) {
      setNotice("Select a client and advisor first.", "error");
      return;
    }

    const isReassignment = Boolean(
      selectedClient.assignedAdvisorMembershipId &&
        selectedClient.assignedAdvisorMembershipId !== assignedAdvisorId,
    );

    if (
      isReassignment &&
      !window.confirm(
        `Reassign ${selectedClient.fullName}? Unresolved portal work will move to the new advisor, while historical items remain available according to firm permissions.`,
      )
    ) {
      return;
    }

    const data = await postAction({
      action: "assignClient",
      clientId: selectedClient.id,
      assignedAdvisorMembershipId: assignedAdvisorId,
      expectedCurrentAdvisorMembershipId:
        selectedClient.assignedAdvisorMembershipId || "",
      reason,
      confirmReassignment: isReassignment,
    });

    if (data) {
      setReason("");
      setInvite(null);
      setNotice(
        isReassignment
          ? "Client reassigned. Unresolved portal work now routes to the new advisor."
          : "Client assignment saved. New portal work routes only to the assigned advisor.",
        "success",
      );
      await load(selectedClient.id);
    }
  }

  async function createInvite() {
    if (!selectedClient) {
      setNotice("Select a client first.", "error");
      return;
    }

    const data = await postAction({
      action: "createPortalInvite",
      clientId: selectedClient.id,
      expiresInDays: 30,
    });

    if (data?.invite) {
      setNotice(
        "Secure portal access created. Copy the link now; the invite code is shown only in this response.",
        "success",
      );
    }
  }

  async function revokePortalAccess() {
    if (!selectedClient) return;

    if (
      !window.confirm(
        `Revoke portal access for ${selectedClient.fullName}? Active portal sessions will be ended immediately.`,
      )
    ) {
      return;
    }

    const data = await postAction({
      action: "revokePortalAccess",
      clientId: selectedClient.id,
    });

    if (data) {
      setInvite(null);
      setNotice("Client portal access was revoked.", "success");
      await load(selectedClient.id);
    }
  }

  async function copyInvite() {
    if (!invite?.loginUrl) return;

    await navigator.clipboard.writeText(invite.loginUrl);
    setNotice("Secure client portal link copied.", "success");
  }

  if (!visible) return null;

  const noticeClass =
    messageTone === "error"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
      : messageTone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        : "border-cyan-500/25 bg-cyan-500/10 text-cyan-50";

  return (
    <aside className="fixed bottom-4 right-4 z-[90] w-[min(460px,calc(100vw-2rem))] text-white">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_48%),rgba(0,0,0,0.55)] px-5 py-4 text-left"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              Advisor routing
            </div>
            <div className="mt-1 text-base font-black">
              {pathname === "/workspace/settings"
                ? "Scheduling readiness"
                : "Assignment + portal access"}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {expanded ? "Minimize" : "Open"}
          </span>
        </button>

        {expanded ? (
          <div className="max-h-[76vh] overflow-y-auto p-5">
            {message ? (
              <div className={cx("mb-4 rounded-2xl border p-3 text-xs font-bold leading-5", noticeClass)}>
                {message}
              </div>
            ) : null}

            {!payload ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-semibold text-slate-400">
                Loading firm routing settings…
              </div>
            ) : pathname === "/workspace/settings" ? (
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-xl font-black">{payload.membership.assignedClientCount}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Assigned clients
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-xl font-black">{payload.membership.unresolvedInboxCount}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Open portal items
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-xl font-black">{payload.metrics.schedulingIncomplete}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Team gaps
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                    Personal advisor setting
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                    Save a trusted Calendly, Cal.com, Google appointment, or Microsoft Bookings link. Slice shows it only to clients currently assigned to you.
                  </p>
                </div>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Scheduling URL
                  </span>
                  <input
                    value={schedulingUrl}
                    onChange={(event) => setSchedulingUrl(event.target.value)}
                    placeholder="https://calendly.com/your-name/meeting"
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Client-facing button label
                  </span>
                  <input
                    value={schedulingLabel}
                    onChange={(event) => setSchedulingLabel(event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div>
                    <div className="text-sm font-black">Show online scheduling</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      Turning this off hides the link without deleting it.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={schedulingEnabled}
                    onChange={(event) => setSchedulingEnabled(event.target.checked)}
                    className="h-5 w-5 accent-emerald-600"
                  />
                </label>

                {payload.membership.scheduling.provider ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-50">
                    Provider detected: {payload.membership.scheduling.provider} · {payload.membership.scheduling.host}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void saveScheduling()}
                  disabled={busy}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Advisor Scheduling"}
                </button>

                {payload.permissions.canManageAssignments &&
                payload.schedulingIncompleteMembers.length ? (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                      Advisors missing scheduling
                    </div>
                    <div className="mt-3 grid gap-2">
                      {payload.schedulingIncompleteMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                        >
                          <span className="font-bold text-white">{member.name}</span>
                          <span className="text-slate-400">{member.assignedClientCount} clients</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
                    <div className="text-xl font-black">{payload.metrics.unassignedClients}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Unassigned</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
                    <div className="text-xl font-black">{payload.metrics.unreadInboxItems}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Unread</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center">
                    <div className="text-xl font-black">{payload.metrics.eligibleAdvisors}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Advisors</div>
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Client profile
                  </span>
                  <select
                    value={selectedClientId}
                    onChange={(event) => {
                      const clientId = event.target.value;
                      setSelectedClientId(clientId);
                      setInvite(null);
                      void load(clientId);
                    }}
                    className={inputClass}
                  >
                    {availableClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.assignedAdvisorMembershipId ? "" : "[UNASSIGNED] "}
                        {client.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedClient ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">{selectedClient.fullName}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {selectedClient.email || "No client email"} · {selectedClient.portalOnboardingStatus}
                        </div>
                      </div>
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
                          selectedClient.assignedAdvisor
                            ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-100"
                            : "border-amber-500/25 bg-amber-500/10 text-amber-100",
                        )}
                      >
                        {selectedClient.assignedAdvisor ? "Assigned" : "Needs advisor"}
                      </span>
                    </div>
                    <div className="mt-3 text-xs font-bold text-cyan-100">
                      Current advisor: {selectedClient.assignedAdvisor?.name || "Unassigned"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Last portal login: {readableDate(selectedClient.portalLastLoginAt)}
                    </div>
                  </div>
                ) : null}

                {payload.permissions.canManageAssignments ? (
                  <>
                    <label className="grid gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Assigned advisor
                      </span>
                      <select
                        value={assignedAdvisorId}
                        onChange={(event) => setAssignedAdvisorId(event.target.value)}
                        className={inputClass}
                      >
                        {eligibleAdvisors.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name} — {member.assignedClientCount} clients
                            {member.scheduling.configured ? "" : " — no scheduling link"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Assignment note
                      </span>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Reason for assignment or reassignment…"
                        rows={3}
                        className={inputClass}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void assignClient()}
                      disabled={busy || !selectedClient || !assignedAdvisorId}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save Advisor Assignment"}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void createInvite()}
                        disabled={
                          busy ||
                          !selectedClient?.email ||
                          !selectedClient.assignedAdvisorMembershipId
                        }
                        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-100 disabled:opacity-40"
                      >
                        Create Portal Link
                      </button>
                      <button
                        type="button"
                        onClick={() => void revokePortalAccess()}
                        disabled={busy || !selectedClient?.portalEnabled}
                        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-black text-rose-100 disabled:opacity-40"
                      >
                        Revoke Access
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-50">
                    Only the account owner, lead advisor, principal, or authorized firm manager can change client assignments. Your inbox remains limited to your assigned clients.
                  </div>
                )}

                {invite ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                      Secure link ready
                    </div>
                    <div className="mt-2 break-all text-xs font-semibold leading-5 text-emerald-50">
                      {invite.loginUrl}
                    </div>
                    <div className="mt-2 text-[10px] text-emerald-200">
                      Expires {readableDate(invite.expiresAt)}
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyInvite()}
                      className="mt-3 w-full rounded-xl border border-emerald-400/30 bg-black/20 px-4 py-2 text-xs font-black text-emerald-50"
                    >
                      Copy Client Login Link
                    </button>
                  </div>
                ) : null}

                {payload.assignmentHistory.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      Assignment history
                    </div>
                    <div className="mt-3 grid gap-2">
                      {payload.assignmentHistory.slice(0, 6).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs"
                        >
                          <div className="font-bold text-white">
                            {entry.previousAdvisor?.name || "Unassigned"} → {entry.nextAdvisor?.name || "Advisor"}
                          </div>
                          <div className="mt-1 text-slate-500">
                            {readableDate(entry.createdAt)} · {entry.changedBy}
                          </div>
                          {entry.reason ? (
                            <div className="mt-2 leading-5 text-slate-300">{entry.reason}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}