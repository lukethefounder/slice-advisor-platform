"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type InboxStatus =
  | "Unread"
  | "Needs Review"
  | "In Progress"
  | "Waiting on Client"
  | "Resolved"
  | "Archived";

type AdvisorMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  calendlyUrl: string | null;
  calendlyLabel: string;
  calendlyEnabled: boolean;
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
  createdAt: string;
  updatedAt: string;
  replies: InboxReply[];
};

type InboxPayload = {
  ok: boolean;
  firm: { id: string; name: string; firmEmail: string | null };
  membership: AdvisorMember;
  permissions: {
    canManageAssignments: boolean;
    canCreatePortalInvites: boolean;
    canViewFirmOversight: boolean;
    inboxScope: "mine" | "all";
  };
  members: AdvisorMember[];
  clients: RoutingClient[];
  inbox: InboxItem[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  red: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
};

function kindTone(kind: string): Tone {
  if (kind === "Risk Update") return "red";
  if (kind === "Holding Update") return "cyan";
  if (kind === "Document") return "amber";
  if (kind === "Meeting") return "purple";
  if (kind === "Approval") return "green";
  if (kind === "Request") return "blue";
  if (kind === "Profile Update") return "purple";
  return "slate";
}

function priorityTone(priority: InboxItem["priority"]): Tone {
  if (priority === "Critical") return "red";
  if (priority === "High") return "amber";
  if (priority === "Medium") return "cyan";
  return "slate";
}

function statusTone(status: InboxStatus): Tone {
  if (status === "Unread") return "red";
  if (status === "Needs Review") return "amber";
  if (status === "In Progress") return "cyan";
  if (status === "Waiting on Client") return "purple";
  if (status === "Resolved") return "green";
  return "slate";
}

function readableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClasses[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function LinkButton({
  href,
  children,
  tone = "red",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses[tone],
      )}
    >
      {children}
    </Link>
  );
}

export default function ClientPortalInboxPage() {
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [replyBody, setReplyBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(nextScope = scope, preferredItemId?: string) {
    setLoading(true);

    try {
      const params = new URLSearchParams({ scope: nextScope });
      const response = await fetch(`/api/advisor-routing?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as InboxPayload & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Unable to load the client portal inbox.");
        return;
      }

      setPayload(data);
      const nextId =
        preferredItemId ||
        selectedItemId ||
        data.inbox[0]?.id ||
        "";
      setSelectedItemId(nextId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the client portal inbox.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("mine");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function postAction(body: Record<string, unknown>) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/advisor-routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action || "inbox-action"),
        },
        body: JSON.stringify({ ...body, scope }),
      });
      const data = (await response.json()) as InboxPayload & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Inbox action failed.");
        return false;
      }

      setPayload(data);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inbox action failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = payload?.inbox ?? [];

    return items.filter((item) => {
      const matchesKind = kindFilter === "All" || item.kind === kindFilter;
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const haystack = [
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
        .toLowerCase();

      return matchesKind && matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [kindFilter, payload?.inbox, query, statusFilter]);

  const selectedItem =
    payload?.inbox.find((item) => item.id === selectedItemId) ??
    filteredItems[0] ??
    null;
  const selectedClient =
    payload?.clients.find((client) => client.id === selectedItem?.clientId) ?? null;
  const unreadCount = payload?.inbox.filter((item) => item.status === "Unread").length ?? 0;
  const highPriorityCount =
    payload?.inbox.filter(
      (item) => item.priority === "Critical" || item.priority === "High",
    ).length ?? 0;
  const waitingCount =
    payload?.inbox.filter((item) => item.status === "Waiting on Client").length ?? 0;

  async function selectItem(item: InboxItem) {
    setSelectedItemId(item.id);
    setReplyBody("");

    if (item.status === "Unread") {
      await postAction({
        action: "updateInbox",
        itemId: item.id,
        status: "Needs Review",
      });
    }
  }

  async function updateStatus(status: InboxStatus) {
    if (!selectedItem) return;
    const ok = await postAction({
      action: "updateInbox",
      itemId: selectedItem.id,
      status,
    });
    if (ok) setMessage(`Inbox item moved to ${status}.`);
  }

  async function sendReply() {
    if (!selectedItem || !replyBody.trim()) {
      setMessage("Write a reply first.");
      return;
    }

    const ok = await postAction({
      action: "reply",
      itemId: selectedItem.id,
      body: replyBody,
    });

    if (ok) {
      setReplyBody("");
      setMessage("Reply saved for secure delivery to the client portal.");
    }
  }

  async function changeScope(nextScope: "mine" | "all") {
    setScope(nextScope);
    setSelectedItemId("");
    await load(nextScope);
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-emerald-700/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-[32rem] w-[32rem] rounded-full bg-purple-700/14 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid h-screen max-w-[1900px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
        <header className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="purple">Individual Advisor Inbox</Pill>
                <Pill tone="green">Assigned clients only</Pill>
                <Pill tone="amber">{unreadCount} unread</Pill>
                <Pill tone="red">{highPriorityCount} high priority</Pill>
              </div>

              <h1 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
                Client portal work routed to the right advisor.
              </h1>

              <p className="mt-2 max-w-5xl text-sm font-semibold leading-7 text-slate-400">
                Messages and profile updates appear in the assigned advisor’s personal inbox. Firm oversight is available to authorized lead advisors without duplicating delivery to the entire team.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LinkButton href="/workspace" tone="slate">Workspace</LinkButton>
              {selectedClient ? (
                <LinkButton
                  href={`/workspace/clients?clientId=${encodeURIComponent(selectedClient.id)}`}
                  tone="purple"
                >
                  Open Profile
                </LinkButton>
              ) : null}
              <LinkButton href="/workspace/settings" tone="cyan">Advisor Settings</LinkButton>
              <LinkButton href="/workspace/client-emails" tone="green">Email Center</LinkButton>
            </div>
          </div>

          {message ? (
            <div className="mt-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-50">
              {message}
            </div>
          ) : null}
        </header>

        <section className="grid min-h-0 gap-3 xl:grid-cols-[370px_minmax(0,1fr)_410px]">
          <Card className="min-h-0 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Secure Intake
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {scope === "mine" ? "My client feed" : "Firm oversight"}
                </h2>
              </div>
              <Pill tone="purple">{filteredItems.length} items</Pill>
            </div>

            {payload?.permissions.canViewFirmOversight ? (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
                <button
                  type="button"
                  onClick={() => void changeScope("mine")}
                  className={cx(
                    "rounded-xl px-3 py-2 text-xs font-black",
                    scope === "mine"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:bg-white/[0.06]",
                  )}
                >
                  My Inbox
                </button>
                <button
                  type="button"
                  onClick={() => void changeScope("all")}
                  className={cx(
                    "rounded-xl px-3 py-2 text-xs font-black",
                    scope === "all"
                      ? "bg-purple-600 text-white"
                      : "text-slate-400 hover:bg-white/[0.06]",
                  )}
                >
                  Firm Oversight
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients and messages…"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-purple-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option>All</option>
                  <option>Message</option>
                  <option>Request</option>
                  <option>Document</option>
                  <option>Risk Update</option>
                  <option>Holding Update</option>
                  <option>Meeting</option>
                  <option>Approval</option>
                  <option>Profile Update</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  <option>All</option>
                  <option>Unread</option>
                  <option>Needs Review</option>
                  <option>In Progress</option>
                  <option>Waiting on Client</option>
                  <option>Resolved</option>
                  <option>Archived</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid max-h-[calc(100vh-360px)] gap-2 overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const active = selectedItem?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void selectItem(item)}
                    className={cx(
                      "rounded-3xl border p-4 text-left transition hover:-translate-y-0.5",
                      active
                        ? toneClasses[kindTone(item.kind)]
                        : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">
                          {item.title}
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {item.clientName}
                        </div>
                      </div>
                      <Pill tone={priorityTone(item.priority)}>{item.priority}</Pill>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">
                      {item.body}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Pill tone={kindTone(item.kind)}>{item.kind}</Pill>
                      <Pill tone={statusTone(item.status)}>{item.status}</Pill>
                    </div>
                  </button>
                );
              })}

              {!filteredItems.length ? (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm font-semibold leading-6 text-emerald-50">
                  {loading
                    ? "Loading assigned client activity…"
                    : "No client portal items match this view."}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="min-h-0 p-5">
            {selectedItem ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={kindTone(selectedItem.kind)}>{selectedItem.kind}</Pill>
                    <Pill tone={priorityTone(selectedItem.priority)}>{selectedItem.priority}</Pill>
                    <Pill tone={statusTone(selectedItem.status)}>{selectedItem.status}</Pill>
                    <Pill tone="slate">Secure Client Portal</Pill>
                  </div>

                  <h2 className="mt-3 text-3xl font-black leading-tight text-white">
                    {selectedItem.title}
                  </h2>

                  <p className="mt-3 text-sm font-semibold leading-7 text-slate-400">
                    {selectedItem.body}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Client</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedItem.clientName}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Assigned Advisor</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedItem.assignedAdvisor?.name || "Unassigned"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Sender</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{selectedItem.senderName || selectedItem.clientName}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Received</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{readableDate(selectedItem.createdAt)}</div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto pr-1">
                  <div className="grid gap-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                            Advisor Workflow
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-400">
                            Update the assigned advisor’s personal work status.
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(["Needs Review", "In Progress", "Resolved", "Archived"] as InboxStatus[]).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => void updateStatus(status)}
                              disabled={loading}
                              className={cx(
                                "rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50",
                                toneClasses[statusTone(status)],
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                        Secure Reply Stream
                      </div>

                      <div className="mt-4 grid max-h-[240px] gap-2 overflow-y-auto pr-1">
                        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3">
                          <div className="text-xs font-black text-purple-100">{selectedItem.senderName || selectedItem.clientName}</div>
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{selectedItem.body}</p>
                          <div className="mt-2 text-[10px] font-bold text-slate-500">{readableDate(selectedItem.createdAt)}</div>
                        </div>

                        {selectedItem.replies.map((reply) => (
                          <div key={reply.id} className="ml-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                            <div className="text-xs font-black text-emerald-100">Advisor reply</div>
                            <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">{reply.body}</p>
                            <div className="mt-2 text-[10px] font-bold text-slate-500">{readableDate(reply.createdAt)}</div>
                          </div>
                        ))}
                      </div>

                      <textarea
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="Write a secure reply for this client…"
                        rows={4}
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <button
                        type="button"
                        onClick={() => void sendReply()}
                        disabled={loading || !replyBody.trim()}
                        className="mt-3 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
                      >
                        Send to Client Portal
                      </button>
                    </div>

                    {Object.keys(selectedItem.metadata || {}).length ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                          Submitted Details
                        </div>
                        <pre className="mt-3 max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] font-semibold leading-5 text-slate-400">
                          {JSON.stringify(selectedItem.metadata, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Pill tone="green">Inbox Clear</Pill>
                  <h2 className="mt-4 text-3xl font-black">No selected client item.</h2>
                  <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-400">
                    New client portal activity will appear only for the advisor currently assigned to that client.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="min-h-0 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
                  Advisor + Client
                </div>
                <h2 className="mt-1 text-2xl font-black text-white">Routing details</h2>
              </div>
              <Pill tone="green">{waitingCount} waiting</Pill>
            </div>

            <div className="mt-4 grid max-h-[calc(100vh-245px)] gap-4 overflow-y-auto pr-1">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Signed-in advisor
                </div>
                <div className="mt-2 text-lg font-black text-white">
                  {payload?.membership.name || "Advisor"}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {payload?.membership.role} · {payload?.firm.name}
                </div>
                <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold leading-5 text-emerald-50">
                  Personal delivery scope: {scope === "mine" ? "assigned clients only" : "authorized firm oversight"}.
                </div>
              </div>

              {selectedClient ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Client snapshot
                  </div>
                  <div className="mt-2 text-lg font-black text-white">{selectedClient.fullName}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedClient.householdName || "No household"} · {selectedClient.clientType}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Risk</div>
                      <div className="mt-1 text-sm font-black text-white">{selectedClient.riskProfile}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Portal</div>
                      <div className="mt-1 text-sm font-black text-white">{selectedClient.portalOnboardingStatus}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-300">Assigned advisor</div>
                    <div className="mt-1 text-sm font-black text-white">{selectedClient.assignedAdvisor?.name || "Unassigned"}</div>
                    <div className="mt-1 text-xs font-semibold text-cyan-100">{selectedClient.assignedAdvisor?.role || "Assign from client profile"}</div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <LinkButton
                      href={`/workspace/clients?clientId=${encodeURIComponent(selectedClient.id)}`}
                      tone="purple"
                    >
                      Open Client Profile + Assignment
                    </LinkButton>
                    {selectedClient.assignedAdvisor?.calendlyUrl ? (
                      <a
                        href={selectedClient.assignedAdvisor.calendlyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cx(
                          "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black",
                          toneClasses.cyan,
                        )}
                      >
                        Preview Client Scheduling Link
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                  Routing Rules
                </div>
                <div className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-slate-400">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">New messages and profile updates are written with the client’s current assigned advisor membership.</div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">Reassignment moves unresolved items to the new advisor and changes the client’s visible Calendly link.</div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">Firm oversight is a management view; normal delivery is not broadcast to every advisor.</div>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}