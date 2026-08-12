"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const INBOX_STATUSES = [
  "Unread",
  "Needs Review",
  "In Progress",
  "Waiting on Client",
  "Resolved",
  "Archived",
] as const;

type InboxStatus = (typeof INBOX_STATUSES)[number];
type Tone = "emerald" | "amber" | "rose" | "cyan" | "violet" | "slate";

type SchedulingView = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  url: string | null;
  label: string;
  provider: string | null;
  fallbackMessage: string;
};

type AdvisorMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  scheduling: SchedulingView;
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

type InboxReply = {
  id: string;
  body: string;
  advisorMembershipId: string;
  authorUserId: string;
  createdAt: string;
};

type InboxItem = {
  id: string;
  firmId: string;
  clientId: string;
  clientName: string;
  assignedAdvisorMembershipId: string;
  assignedAdvisor: AdvisorMember | null;
  kind: string;
  title: string;
  body: string;
  status: InboxStatus;
  priority: "Critical" | "High" | "Medium" | "Low";
  sourceEventId: string;
  senderName: string | null;
  senderEmail: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  historical: boolean;
  readOnly: boolean;
  replies: InboxReply[];
};

type InboxPayload = {
  ok: boolean;
  firm: {
    id: string;
    name: string;
    firmEmail: string | null;
  };
  membership: AdvisorMember;
  permissions: {
    canManageAssignments: boolean;
    canViewFirmOversight: boolean;
    inboxScope: "mine" | "all";
  };
  metrics: {
    totalFirmClients: number;
    unassignedClients: number;
    unreadInboxItems: number;
    highPriorityInboxItems: number;
  };
  clients: RoutingClient[];
  inbox: InboxItem[];
};

type ApiPayload = InboxPayload & {
  error?: string | { message?: string };
  code?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function errorMessage(value: ApiPayload, fallback: string) {
  if (typeof value.error === "string" && value.error.trim()) return value.error;

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
  if (!value) return "Not recorded";
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

function toneForPriority(priority: InboxItem["priority"]): Tone {
  if (priority === "Critical") return "rose";
  if (priority === "High") return "amber";
  if (priority === "Medium") return "cyan";
  return "slate";
}

function toneForStatus(status: InboxStatus): Tone {
  if (status === "Unread") return "rose";
  if (status === "Needs Review") return "amber";
  if (status === "In Progress") return "cyan";
  if (status === "Waiting on Client") return "violet";
  if (status === "Resolved") return "emerald";
  return "slate";
}

function toneClass(tone: Tone) {
  const values: Record<Tone, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-100",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-100",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-200",
  };

  return values[tone];
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClass(tone),
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "min-h-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/88 shadow-2xl shadow-black/25",
        className,
      )}
    >
      {children}
    </section>
  );
}

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50";

export default function ClientPortalInboxPage() {
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [replyBody, setReplyBody] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [loading, setLoading] = useState(true);
  const loadController = useRef<AbortController | null>(null);

  function notice(
    text: string,
    tone: "success" | "error" | "info" = "info",
  ) {
    setMessage(text);
    setMessageTone(tone);
  }

  function requestedItemId() {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("itemId") || "";
  }

  async function load(nextScope = scope, preferredItemId?: string) {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        scope: nextScope,
        inboxLimit: "250",
        clientLimit: "300",
      });
      const response = await fetch(`/api/advisor-routing?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        notice(errorMessage(data, "Unable to load the client portal inbox."), "error");
        return;
      }

      setPayload(data);
      const candidate =
        preferredItemId || selectedItemId || requestedItemId() || data.inbox[0]?.id || "";
      const available = data.inbox.some((item) => item.id === candidate);
      setSelectedItemId(available ? candidate : data.inbox[0]?.id || "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notice(
        error instanceof Error
          ? error.message
          : "Unable to load the client portal inbox.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("mine", requestedItemId());

    return () => loadController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return (payload?.inbox ?? []).filter((item) => {
      if (kindFilter !== "All" && item.kind !== kindFilter) return false;
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (!normalized) return true;

      return [
        item.title,
        item.body,
        item.clientName,
        item.senderName || "",
        item.senderEmail || "",
        item.kind,
        item.priority,
        item.status,
        item.assignedAdvisor?.name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [kindFilter, payload?.inbox, query, statusFilter]);

  const selectedItem =
    payload?.inbox.find((item) => item.id === selectedItemId) ??
    filteredItems[0] ??
    null;
  const selectedClient =
    payload?.clients.find((client) => client.id === selectedItem?.clientId) ?? null;
  const kinds = useMemo(
    () => Array.from(new Set((payload?.inbox ?? []).map((item) => item.kind))).sort(),
    [payload?.inbox],
  );
  const unreadCount = payload?.inbox.filter((item) => item.status === "Unread").length ?? 0;
  const urgentCount =
    payload?.inbox.filter(
      (item) => item.priority === "Critical" || item.priority === "High",
    ).length ?? 0;
  const historicalCount = payload?.inbox.filter((item) => item.historical).length ?? 0;

  async function postAction(body: Record<string, unknown>) {
    setLoading(true);
    notice("");

    try {
      const response = await fetch("/api/advisor-routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action || "inbox-action"),
        },
        body: JSON.stringify({ ...body, scope }),
      });
      const data = (await response.json()) as ApiPayload;

      if (!response.ok) {
        notice(errorMessage(data, "Inbox action failed."), "error");
        return false;
      }

      setPayload(data);
      return true;
    } catch (error) {
      notice(error instanceof Error ? error.message : "Inbox action failed.", "error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function selectItem(item: InboxItem) {
    setSelectedItemId(item.id);
    setReplyBody("");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("itemId", item.id);
      window.history.replaceState({}, "", url.toString());
    }

    if (item.status === "Unread" && !item.readOnly) {
      await postAction({
        action: "updateInbox",
        itemId: item.id,
        status: "Needs Review",
      });
    }
  }

  async function updateStatus(status: InboxStatus) {
    if (!selectedItem || selectedItem.readOnly) return;

    const ok = await postAction({
      action: "updateInbox",
      itemId: selectedItem.id,
      status,
    });

    if (ok) notice(`Inbox item moved to ${status}.`, "success");
  }

  async function sendReply() {
    if (!selectedItem || selectedItem.readOnly) return;

    if (!replyBody.trim()) {
      notice("Write a reply first.", "error");
      return;
    }

    const ok = await postAction({
      action: "reply",
      itemId: selectedItem.id,
      body: replyBody,
    });

    if (ok) {
      setReplyBody("");
      notice("Reply saved for secure delivery to the client portal.", "success");
    }
  }

  async function changeScope(nextScope: "mine" | "all") {
    setScope(nextScope);
    setSelectedItemId("");
    await load(nextScope);
  }

  const noticeClass =
    messageTone === "error"
      ? toneClass("rose")
      : messageTone === "success"
        ? toneClass("emerald")
        : toneClass("cyan");

  return (
    <main className="min-h-screen bg-[#050505] p-3 text-white xl:h-screen xl:overflow-hidden">
      <div className="mx-auto flex h-full max-w-[1880px] flex-col gap-3">
        <header className="rounded-[1.75rem] border border-white/10 bg-zinc-950/90 p-4 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="violet">Assigned advisor inbox</Pill>
                <Pill tone="rose">{unreadCount} unread</Pill>
                <Pill tone="amber">{urgentCount} priority</Pill>
                <Pill tone="slate">{historicalCount} historical</Pill>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                Client portal work, routed to the responsible advisor.
              </h1>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-400">
                New activity routes only to the currently assigned advisor. Historical client records stay visible as read-only context after reassignment, while authorized supervisors retain firm oversight.
              </p>
            </div>

            <nav className="flex flex-wrap gap-2" aria-label="Inbox navigation">
              <Link
                href="/workspace"
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-black text-slate-200"
              >
                Workspace
              </Link>
              <Link
                href="/workspace/clients"
                className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-2.5 text-sm font-black text-violet-100"
              >
                Client Profiles
              </Link>
              <Link
                href="/workspace/settings"
                className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-100"
              >
                Scheduling Settings
              </Link>
            </nav>
          </div>

          {message ? (
            <div
              role={messageTone === "error" ? "alert" : "status"}
              className={cx("mt-3 rounded-xl border px-4 py-3 text-xs font-bold", noticeClass)}
            >
              {message}
            </div>
          ) : null}
        </header>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[360px_minmax(0,1fr)_400px]">
          <Panel className="flex flex-col">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
                    Secure intake
                  </div>
                  <h2 className="mt-1 text-2xl font-black">
                    {scope === "mine" ? "My clients" : "Firm oversight"}
                  </h2>
                </div>
                <Pill tone="violet">{filteredItems.length}</Pill>
              </div>

              {payload?.permissions.canViewFirmOversight ? (
                <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
                  <button
                    type="button"
                    onClick={() => void changeScope("mine")}
                    className={cx(
                      "rounded-lg px-3 py-2 text-xs font-black",
                      scope === "mine" ? "bg-emerald-600 text-white" : "text-slate-400",
                    )}
                  >
                    My Inbox
                  </button>
                  <button
                    type="button"
                    onClick={() => void changeScope("all")}
                    className={cx(
                      "rounded-lg px-3 py-2 text-xs font-black",
                      scope === "all" ? "bg-emerald-600 text-white" : "text-slate-400",
                    )}
                  >
                    Firm View
                  </button>
                </div>
              ) : null}

              <div className="mt-3 grid gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search client, subject, sender…"
                  className={fieldClass}
                  aria-label="Search inbox"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={kindFilter}
                    onChange={(event) => setKindFilter(event.target.value)}
                    className={fieldClass}
                    aria-label="Filter by type"
                  >
                    <option>All</option>
                    {kinds.map((kind) => (
                      <option key={kind}>{kind}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={fieldClass}
                    aria-label="Filter by status"
                  >
                    <option>All</option>
                    {INBOX_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="min-h-[280px] flex-1 overflow-y-auto p-3 xl:min-h-0">
              {loading && !payload ? (
                <div className="grid gap-2" aria-label="Loading inbox">
                  {[0, 1, 2, 3].map((value) => (
                    <div key={value} className="h-28 animate-pulse rounded-2xl bg-white/[0.05]" />
                  ))}
                </div>
              ) : filteredItems.length ? (
                <div className="grid gap-2">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void selectItem(item)}
                      className={cx(
                        "rounded-2xl border p-3 text-left transition",
                        selectedItem?.id === item.id
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{item.clientName}</div>
                          <div className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">
                            {item.title}
                          </div>
                        </div>
                        <Pill tone={toneForPriority(item.priority)}>{item.priority}</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Pill tone={toneForStatus(item.status)}>{item.status}</Pill>
                        <Pill tone="slate">{item.kind}</Pill>
                        {item.historical ? <Pill tone="slate">History</Pill> : null}
                      </div>
                      <div className="mt-2 text-[10px] font-semibold text-slate-600">
                        {readableDate(item.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
                  <div className="font-black">No matching portal work</div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    New assigned-client messages, meeting requests, documents, and profile changes appear here.
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="flex flex-col">
            {selectedItem ? (
              <>
                <div className="border-b border-white/10 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={toneForStatus(selectedItem.status)}>{selectedItem.status}</Pill>
                    <Pill tone={toneForPriority(selectedItem.priority)}>{selectedItem.priority}</Pill>
                    <Pill tone="slate">{selectedItem.kind}</Pill>
                    {selectedItem.readOnly ? <Pill tone="slate">Read-only history</Pill> : null}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight">{selectedItem.title}</h2>
                  <div className="mt-2 text-sm font-semibold text-slate-400">
                    {selectedItem.clientName} · {readableDate(selectedItem.createdAt)}
                  </div>
                </div>

                <div className="min-h-[320px] flex-1 overflow-y-auto p-5 xl:min-h-0">
                  <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Client submission
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-200">
                      {selectedItem.body}
                    </p>
                    <div className="mt-4 text-xs text-slate-500">
                      From {selectedItem.senderName || selectedItem.clientName}
                      {selectedItem.senderEmail ? ` · ${selectedItem.senderEmail}` : ""}
                    </div>
                  </article>

                  <div className="mt-4 grid gap-3">
                    {selectedItem.replies.map((reply) => (
                      <article
                        key={reply.id}
                        className="ml-auto w-[min(90%,760px)] rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4"
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                          Advisor reply
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{reply.body}</p>
                        <div className="mt-2 text-[10px] text-slate-500">{readableDate(reply.createdAt)}</div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                <div>
                  <div className="text-2xl font-black">Select a portal item</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Choose an assigned-client message or profile update to review its history and take action.
                  </p>
                </div>
              </div>
            )}
          </Panel>

          <Panel className="flex flex-col">
            <div className="border-b border-white/10 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                Advisor action
              </div>
              <h2 className="mt-1 text-2xl font-black">Review and respond</h2>
            </div>

            <div className="min-h-[320px] flex-1 overflow-y-auto p-4 xl:min-h-0">
              {selectedItem ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-sm font-black">{selectedItem.clientName}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      Assigned advisor: {selectedItem.assignedAdvisor?.name || "Unassigned"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/workspace/clients?clientId=${encodeURIComponent(selectedItem.clientId)}`}
                        className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-100"
                      >
                        Open Client Profile
                      </Link>
                      {selectedClient?.assignedAdvisor?.scheduling.available &&
                      selectedClient.assignedAdvisor.scheduling.url ? (
                        <a
                          href={selectedClient.assignedAdvisor.scheduling.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100"
                        >
                          Open Scheduling
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {selectedItem.readOnly ? (
                    <div className="rounded-2xl border border-slate-500/20 bg-slate-500/10 p-4 text-xs font-semibold leading-5 text-slate-300">
                      This is preserved historical context from before reassignment. New actions belong to the currently assigned advisor and this record cannot be edited from the historical view.
                    </div>
                  ) : (
                    <>
                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Workflow status
                        </span>
                        <select
                          value={selectedItem.status}
                          onChange={(event) => void updateStatus(event.target.value as InboxStatus)}
                          disabled={loading}
                          className={fieldClass}
                        >
                          {INBOX_STATUSES.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          Secure client reply
                        </span>
                        <textarea
                          value={replyBody}
                          onChange={(event) => setReplyBody(event.target.value)}
                          rows={8}
                          maxLength={5_000}
                          placeholder="Write a clear advisor-reviewed response…"
                          disabled={loading}
                          className={fieldClass}
                        />
                        <span className="text-right text-[10px] text-slate-600">{replyBody.length}/5000</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => void sendReply()}
                        disabled={loading || !replyBody.trim()}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/30 disabled:opacity-50"
                      >
                        {loading ? "Saving…" : "Save Secure Reply"}
                      </button>
                    </>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">
                    Replies are stored in the client’s secure portal history. External email or SMS delivery remains a separate approval-gated workflow.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-500">
                  Select an item to see status, client profile, scheduling, and reply controls.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}