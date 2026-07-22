"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AdvisorMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  calendlyUrl: string | null;
  calendlyLabel: string;
  calendlyEnabled: boolean;
  eligibleForClients: boolean;
};

type RoutingClient = {
  id: string;
  fullName: string;
  email: string | null;
  householdName: string | null;
  status: string;
  portalEnabled: boolean;
  portalOnboardingStatus: string;
  assignedAdvisorMembershipId: string | null;
  assignedAdvisor: AdvisorMember | null;
};

type RoutingPayload = {
  ok: boolean;
  firm: { id: string; name: string };
  membership: AdvisorMember;
  permissions: {
    canManageAssignments: boolean;
    canCreatePortalInvites: boolean;
  };
  members: AdvisorMember[];
  clients: RoutingClient[];
};

type InviteResult = {
  clientName: string;
  clientEmail: string;
  inviteCode: string;
  loginUrl: string;
  expiresAt: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/20";

export function AdvisorRoutingDock() {
  const pathname = usePathname();
  const visible =
    pathname === "/workspace/settings" || pathname === "/workspace/clients";
  const [expanded, setExpanded] = useState(true);
  const [payload, setPayload] = useState<RoutingPayload | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [assignedAdvisorId, setAssignedAdvisorId] = useState("");
  const [reason, setReason] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [calendlyLabel, setCalendlyLabel] = useState("Schedule a meeting");
  const [calendlyEnabled, setCalendlyEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const selectedClient = useMemo(
    () => payload?.clients.find((client) => client.id === selectedClientId) ?? null,
    [payload, selectedClientId],
  );

  const eligibleAdvisors = useMemo(
    () => payload?.members.filter((member) => member.eligibleForClients) ?? [],
    [payload],
  );

  async function load(preferredClientId?: string) {
    if (!visible) return;

    try {
      const params = new URLSearchParams();
      if (preferredClientId) params.set("clientId", preferredClientId);

      const response = await fetch(
        `/api/advisor-routing${params.size ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as RoutingPayload & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Unable to load advisor routing.");
        return;
      }

      setPayload(data);
      setCalendlyUrl(data.membership.calendlyUrl || "");
      setCalendlyLabel(
        data.membership.calendlyLabel || "Schedule a meeting",
      );
      setCalendlyEnabled(data.membership.calendlyEnabled !== false);

      const queryClientId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("clientId")
          : null;
      const nextClientId =
        preferredClientId ||
        queryClientId ||
        selectedClientId ||
        data.clients[0]?.id ||
        "";
      setSelectedClientId(nextClientId);

      const nextClient = data.clients.find(
        (client) => client.id === nextClientId,
      );
      setAssignedAdvisorId(
        nextClient?.assignedAdvisorMembershipId || data.membership.id,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load advisor routing.",
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
      setSelectedClientId(clientId);
      setInvite(null);
      void load(clientId);
    }

    window.addEventListener("slice-client-selected", handleClientSelection);
    return () => {
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
    setMessage("");

    try {
      const response = await fetch("/api/advisor-routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action || "advisor-routing"),
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as RoutingPayload & {
        error?: string;
        invite?: InviteResult;
      };

      if (!response.ok) {
        setMessage(data.error || "Advisor routing action failed.");
        return null;
      }

      setPayload(data);
      if (data.invite) setInvite(data.invite);
      return data;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Advisor routing action failed.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveCalendly() {
    const data = await postAction({
      action: "saveCalendly",
      calendlyUrl,
      calendlyLabel,
      calendlyEnabled,
    });

    if (data) {
      setMessage(
        calendlyUrl.trim()
          ? "Your Calendly link is saved and visible only to assigned clients."
          : "Scheduling settings saved. Add a Calendly link when ready.",
      );
    }
  }

  async function assignClient() {
    if (!selectedClientId || !assignedAdvisorId) {
      setMessage("Select a client and advisor first.");
      return;
    }

    const data = await postAction({
      action: "assignClient",
      clientId: selectedClientId,
      assignedAdvisorMembershipId: assignedAdvisorId,
      reason,
    });

    if (data) {
      setReason("");
      setInvite(null);
      setMessage(
        "Client assignment saved. Open portal items now route only to the selected advisor.",
      );
    }
  }

  async function createInvite() {
    if (!selectedClientId) {
      setMessage("Select a client first.");
      return;
    }

    const data = await postAction({
      action: "createPortalInvite",
      clientId: selectedClientId,
    });

    if (data?.invite) {
      setMessage(
        "Secure portal access created. Copy the link now; the code is shown only in this response.",
      );
    }
  }

  async function copyInvite() {
    if (!invite?.loginUrl) return;
    await navigator.clipboard.writeText(invite.loginUrl);
    setMessage("Secure client portal link copied.");
  }

  if (!visible) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[90] w-[min(430px,calc(100vw-2rem))] text-white">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.22),transparent_48%),rgba(0,0,0,0.55)] px-5 py-4 text-left"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
              Advisor routing
            </div>
            <div className="mt-1 text-base font-black">
              {pathname === "/workspace/settings"
                ? "Calendly + client scheduling"
                : "Assign this client"}
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
            {expanded ? "Minimize" : "Open"}
          </span>
        </button>

        {expanded ? (
          <div className="max-h-[72vh] overflow-y-auto p-5">
            {message ? (
              <div className="mb-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-xs font-bold leading-5 text-cyan-50">
                {message}
              </div>
            ) : null}

            {!payload ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-semibold text-slate-400">
                Loading firm routing settings…
              </div>
            ) : pathname === "/workspace/settings" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                    Personal advisor setting
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                    Each advisor saves their own Calendly link. Slice displays it only to clients currently assigned to that advisor.
                  </p>
                </div>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Calendly URL
                  </span>
                  <input
                    value={calendlyUrl}
                    onChange={(event) => setCalendlyUrl(event.target.value)}
                    placeholder="https://calendly.com/your-name/meeting"
                    className={inputClass}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Client-facing button label
                  </span>
                  <input
                    value={calendlyLabel}
                    onChange={(event) => setCalendlyLabel(event.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div>
                    <div className="text-sm font-black">Show scheduling to assigned clients</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      Turning this off hides your link without deleting it.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={calendlyEnabled}
                    onChange={(event) => setCalendlyEnabled(event.target.checked)}
                    className="h-5 w-5 accent-red-600"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void saveCalendly()}
                  disabled={busy}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save Advisor Scheduling"}
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Client profile
                  </span>
                  <select
                    value={selectedClientId}
                    onChange={(event) => {
                      setSelectedClientId(event.target.value);
                      setInvite(null);
                    }}
                    className={inputClass}
                  >
                    {payload.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedClient ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="text-sm font-black">{selectedClient.fullName}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      {selectedClient.email || "No client email"} · {selectedClient.portalOnboardingStatus}
                    </div>
                    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">
                      Current advisor: {selectedClient.assignedAdvisor?.name || "Unassigned"}
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
                            {member.name} — {member.role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Assignment note (optional)
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
                      disabled={busy}
                      className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Assign Advisor to Client"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void createInvite()}
                      disabled={busy || !selectedClient?.email}
                      className={cx(
                        "rounded-2xl border px-5 py-3 text-sm font-black disabled:opacity-40",
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
                      )}
                    >
                      Create Secure Client Portal Link
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs font-semibold leading-5 text-amber-50">
                    Only the account owner, lead advisor, principal, or authorized firm manager can change client assignments. Your individual inbox remains limited to your assigned clients.
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
                    <button
                      type="button"
                      onClick={() => void copyInvite()}
                      className="mt-3 w-full rounded-xl border border-emerald-400/30 bg-black/20 px-4 py-2 text-xs font-black text-emerald-50"
                    >
                      Copy Client Login Link
                    </button>
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