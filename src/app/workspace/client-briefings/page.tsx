"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Draft = {
  id: string;
  clientName: string | null;
  channel: string;
  audience: string;
  title: string;
  body: string;
  status: string;
  tone: string;
  createdAt: string;
  updatedAt: string;
  sourceSummary?: {
    symbols?: string[];
    sourceEvidence?: Array<{
      type: string;
      title: string;
      sourceName: string;
      sourceUrl: string | null;
      score: number;
      summary: string;
    }>;
    investmentGrade?: {
      grade: string;
      label: string;
      explanation: string;
    };
    ai?: {
      polished?: boolean;
      provider?: string;
      status?: string;
      error?: string | null;
    };
  };
  complianceNotes?: string[];
};

type Approval = {
  id: string;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  status: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
  payload?: {
    draftIds?: string[];
    symbols?: string[];
    sourceTitle?: string;
    sourceUrl?: string | null;
  };
};

type ConsoleData = {
  drafts: Draft[];
  approvals: Approval[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const lower = value.toLowerCase();

  if (lower.includes("failed") || lower.includes("high")) return "red";
  if (lower.includes("sent") || lower.includes("approved") || lower.includes("delivered")) return "green";
  if (lower.includes("pending") || lower.includes("draft") || lower.includes("approval") || lower.includes("simulated")) return "amber";
  if (lower.includes("client") || lower.includes("briefing")) return "purple";
  if (lower.includes("ai") || lower.includes("email")) return "cyan";

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[1.8rem] border border-white/10 bg-zinc-950/82 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ClientBriefingsPage() {
  const [data, setData] = useState<ConsoleData>({ drafts: [], approvals: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    symbols: "NVDA",
    holdingQuery: "",
    briefingTitle: "",
    sourceTitle: "",
    sourceUrl: "",
    sourceName: "",
    researchSummary: "",
    advisorMessage: "",
    tone: "Calm, polished, professional, and reassuring",
  });

  const pendingApprovals = useMemo(
    () => data.approvals.filter((approval) => approval.status === "Pending"),
    [data.approvals]
  );

  const recentDrafts = useMemo(
    () => data.drafts.slice(0, 30),
    [data.drafts]
  );

  async function loadConsole() {
    const response = await fetch("/api/client-briefings", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load client briefing console.");
      return;
    }

    setData(payload);
  }

  async function createDrafts(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-briefings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "createDrafts",
          ...form,
          symbols: form.symbols.split(/[,;\s]+/).filter(Boolean),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to create client briefing drafts.");
        return;
      }

      setMessage(payload.message ?? "Client briefing drafts created.");
      await loadConsole();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create client briefing drafts.");
    } finally {
      setLoading(false);
    }
  }

  async function approveAndSend(approvalId: string) {
    const notes = window.prompt(
      "Approval note for compliance trail:",
      "Reviewed and approved by advisor for client delivery."
    );

    if (notes === null) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/client-briefings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "approve-client-briefing-email",
        },
        body: JSON.stringify({
          action: "approveAndSend",
          approvalId,
          approvalNotes: notes,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to approve and send briefing.");
        return;
      }

      setMessage(
        `Approval processed. Delivered: ${payload.delivered}. Simulated: ${payload.simulated}. Failed: ${payload.failed}.`
      );

      await loadConsole();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve and send briefing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConsole();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.38),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.13),_transparent_30%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Client Briefing Emails
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Advisor-approved client reassurance at scale.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Select a stock or fund, let Slice identify clients who hold it, generate polished and professional
                briefing emails, and send only after advisor approval.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/workspace/personal-bot" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                Bot
              </a>
              <a href="/security" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
                Security
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              Generate Drafts
            </div>
            <h2 className="mt-2 text-2xl font-black">Create a briefing pack</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Slice will match clients by holdings, draft emails, attach source context, and queue everything for approval.
            </p>

            <form onSubmit={createDrafts} className="mt-5 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Stock or fund symbols
                </span>
                <input
                  value={form.symbols}
                  onChange={(event) => setForm((current) => ({ ...current, symbols: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="NVDA, AAPL, SPY"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Optional holding search
                </span>
                <input
                  value={form.holdingQuery}
                  onChange={(event) => setForm((current) => ({ ...current, holdingQuery: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="technology fund, growth ETF, semiconductor"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Source title
                </span>
                <input
                  value={form.sourceTitle}
                  onChange={(event) => setForm((current) => ({ ...current, sourceTitle: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Example: Company guidance update, earnings report, SEC filing..."
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Source URL
                </span>
                <input
                  value={form.sourceUrl}
                  onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="https://..."
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Research backing / advisor context
                </span>
                <textarea
                  value={form.researchSummary}
                  onChange={(event) => setForm((current) => ({ ...current, researchSummary: event.target.value }))}
                  className="min-h-[130px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Summarize what happened, why it matters, and how clients should think about it..."
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Optional advisor message
                </span>
                <textarea
                  value={form.advisorMessage}
                  onChange={(event) => setForm((current) => ({ ...current, advisorMessage: event.target.value }))}
                  className="min-h-[100px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Optional personal note from the advisor..."
                />
              </label>

              <button
                disabled={loading}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                {loading ? "Working..." : "Generate Advisor-Approval Drafts"}
              </button>
            </form>
          </Card>

          <div className="grid gap-6">
            <Card>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                    Advisor Approval Queue
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Approve and send</h2>
                </div>
                <Pill tone="amber">{pendingApprovals.length} pending</Pill>
              </div>

              <div className="grid gap-3">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-lg font-black text-white">{approval.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{approval.summary}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                          <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                          {approval.payload?.symbols?.length ? (
                            <Pill tone="purple">{approval.payload.symbols.join(", ")}</Pill>
                          ) : null}
                          <Pill tone="cyan">{formatDate(approval.createdAt)}</Pill>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => approveAndSend(approval.id)}
                        disabled={loading}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        Approve & Send
                      </button>
                    </div>
                  </div>
                ))}

                {!pendingApprovals.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No pending briefing approvals.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="mb-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Recent Drafts
                </div>
                <h2 className="mt-2 text-2xl font-black">Client-ready email drafts</h2>
              </div>

              <div className="grid max-h-[720px] gap-3 overflow-y-auto pr-2">
                {recentDrafts.map((draft) => (
                  <article key={draft.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-lg font-black text-white">{draft.title}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">
                          {draft.clientName || "Client"} · {formatDate(draft.createdAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Pill tone={toneFor(draft.status)}>{draft.status}</Pill>
                        {draft.sourceSummary?.investmentGrade?.grade ? (
                          <Pill tone="purple">Grade {draft.sourceSummary.investmentGrade.grade}</Pill>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-slate-300">
                      {draft.body}
                    </div>

                    {draft.complianceNotes?.length ? (
                      <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                          Compliance Notes
                        </div>
                        <ul className="mt-2 grid gap-1 text-xs leading-5 text-amber-100/80">
                          {draft.complianceNotes.map((note) => (
                            <li key={note}>• {note}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}

                {!recentDrafts.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    No drafts generated yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}