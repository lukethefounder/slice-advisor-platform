"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLIENT_PORTAL_INVITE_CODE,
  ClientPortalEvent,
  ClientPortalEventStatus,
  formatDocumentSize,
  formatPortalDate,
  loadClientPortalEvents,
  updateClientPortalEventStatus,
} from "@/lib/client-portal-demo-store";

type Filter = "All" | "New" | "Advisor Review" | "Requests" | "Documents" | "Risk" | "Messages";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusTone(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("new")) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
  if (lower.includes("review")) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (lower.includes("approved") || lower.includes("scheduled") || lower.includes("completed")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (lower.includes("declined")) return "border-red-500/30 bg-red-500/10 text-red-100";
  return "border-white/10 bg-white/[0.055] text-slate-100";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[1.75rem] border border-white/10 bg-zinc-950/82 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", className || "border-white/10 bg-white/[0.055] text-slate-200")}>
      {children}
    </span>
  );
}

export default function ClientPortalInboxPage() {
  const [events, setEvents] = useState<ClientPortalEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    setEvents(loadClientPortalEvents());
    setInviteLink(`${window.location.origin}/client-login?invite=${CLIENT_PORTAL_INVITE_CODE}&advisor=Ava%20Royal`);
  }, []);

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (filter === "All") return true;
      if (filter === "New") return event.status === "New";
      if (filter === "Advisor Review") return event.status === "Advisor Review";
      if (filter === "Documents") return event.type === "Document Upload";
      if (filter === "Risk") return event.type === "Risk Tolerance Update";
      if (filter === "Messages") return event.type === "Secure Message";
      if (filter === "Requests") return event.type.includes("Request") || event.type.includes("Buy") || event.type.includes("Sell");
      return true;
    });
  }, [events, filter]);

  const newCount = events.filter((event) => event.status === "New").length;
  const riskCount = events.filter((event) => event.type === "Risk Tolerance Update").length;
  const docCount = events.filter((event) => event.type === "Document Upload").length;
  const tradeCount = events.filter((event) => event.type === "Buy Request" || event.type === "Sell Request").length;

  function changeStatus(id: string, status: ClientPortalEventStatus) {
    setEvents(updateClientPortalEventStatus(id, status));
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // ignore clipboard failure
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.36),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-[1700px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill className="border-red-500/30 bg-red-500/10 text-red-200">Advisor View</Pill>
                <Pill className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">Client Portal Inbox</Pill>
                <Pill className="border-amber-500/30 bg-amber-500/10 text-amber-200">Review Required</Pill>
              </div>
              <h1 className="mt-4 text-4xl font-black md:text-6xl">Client portal inbox.</h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Advisor-facing intake center for client portal submissions. This is designed to be linked from Client Profiles so advisors can review requests, risk updates, documents, messages, and permission changes in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace/clients" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white">Client Profiles</a>
              <a href="/client-login" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Client Login</a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">New</div>
            <div className="mt-2 text-4xl font-black">{newCount}</div>
            <p className="mt-1 text-sm text-slate-400">Needs first review</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Buy/Sell Requests</div>
            <div className="mt-2 text-4xl font-black">{tradeCount}</div>
            <p className="mt-1 text-sm text-slate-400">Review only</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Risk Updates</div>
            <div className="mt-2 text-4xl font-black">{riskCount}</div>
            <p className="mt-1 text-sm text-slate-400">Suitability context</p>
          </Card>
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Documents</div>
            <div className="mt-2 text-4xl font-black">{docCount}</div>
            <p className="mt-1 text-sm text-slate-400">Metadata demo</p>
          </Card>
        </section>

        <Card>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">Invite Link</div>
              <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/45 p-4 text-sm font-bold text-white">{inviteLink}</div>
            </div>
            <button onClick={copyInvite} className="rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white">Copy Invite Link</button>
          </div>
        </Card>

        <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit">
            <div className="grid gap-2">
              {(["All", "New", "Advisor Review", "Requests", "Messages", "Documents", "Risk"] as Filter[]).map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={cx("rounded-2xl border p-4 text-left text-sm font-black", filter === item ? "border-white bg-white text-slate-950" : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]")}>
                  {item}
                </button>
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            {filtered.map((event) => (
              <Card key={event.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Pill className={statusTone(event.status)}>{event.status}</Pill>
                      <Pill>{event.type}</Pill>
                      <Pill>{event.urgency}</Pill>
                    </div>

                    <h2 className="mt-4 text-2xl font-black">{event.title}</h2>
                    <div className="mt-1 text-xs text-slate-500">{event.clientName} · {event.clientEmail} · {formatPortalDate(event.createdAt)}</div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{event.message}</p>

                    {event.documents.length ? (
                      <div className="mt-4 grid gap-2">
                        {event.documents.map((document) => (
                          <div key={document.id} className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-3">
                            <div className="font-black text-white">{document.name}</div>
                            <div className="mt-1 text-xs text-purple-100">{document.type} · {formatDocumentSize(document.size)}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {Object.keys(event.payload).length ? (
                      <pre className="mt-4 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/45 p-4 text-xs leading-6 text-slate-300">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>

                  <div className="grid min-w-[220px] gap-2">
                    {(["Advisor Review", "Needs Follow-Up", "Scheduled", "Approved for Discussion", "Completed", "Declined"] as ClientPortalEventStatus[]).map((status) => (
                      <button key={status} onClick={() => changeStatus(event.id, status)} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/[0.09]">
                        Mark {status}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {!filtered.length ? (
              <Card className="p-10 text-center">
                <div className="text-2xl font-black">No client portal items found.</div>
                <p className="mt-2 text-sm text-slate-400">Try changing the filter or submitting a demo item from the client portal.</p>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}