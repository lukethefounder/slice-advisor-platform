"use client";

import { FormEvent, useEffect, useState } from "react";

type CommandCenterPayload = {
  message?: string;
  searchQuery?: string;
  searchResults?: Array<KnowledgeEntry>;
  metrics: {
    clientCount: number;
    unreadAlerts: number;
    openSignals: number;
    openTasks: number;
    draftEmails: number;
    clientBrains: number;
    nextBestActions: number;
    proofTrails: number;
    knowledgeEntries: number;
    advisorDayBriefs: number;
  };
  clientBrains: Array<ClientBrain>;
  nextBestActions: Array<NextBestAction>;
  proofTrails: Array<ProofTrail>;
  knowledgeEntries: Array<KnowledgeEntry>;
  advisorDayBriefs: Array<AdvisorDayBrief>;
};

type ClientBrain = {
  id: string;
  clientName: string;
  householdName: string | null;
  riskProfile: string;
  communicationStyle: string;
  portfolioSummary: string;
  riskPulse: string;
  opportunityPulse: string;
  nextAction: string;
  score: number;
  tags: string[];
};

type NextBestAction = {
  id: string;
  title: string;
  actionType: string;
  priority: string;
  score: number;
  clientName: string | null;
  sourceType: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  reason: string;
  recommendedCommand: string | null;
  status: string;
};

type ProofTrail = {
  id: string;
  actionType: string;
  subject: string;
  summary: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  clientName: string | null;
  aiReasoning: string;
  humanStatus: string;
  riskLevel: string;
};

type KnowledgeEntry = {
  id: string;
  title: string;
  category: string;
  body: string;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  score: number;
};

type AdvisorDayBrief = {
  id: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  topActions: Array<Record<string, unknown>>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | number) {
  const text = String(value).toLowerCase();

  if (text.includes("critical") || text.includes("high") || text.includes("needs")) return "red";
  if (text.includes("complete") || text.includes("active") || text.includes("ready")) return "green";
  if (text.includes("medium") || text.includes("open") || text.includes("pending")) return "amber";
  if (text.includes("client") || text.includes("opportunity")) return "purple";

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20", className)}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

export default function AdvisorCommandCenterPage() {
  const [data, setData] = useState<CommandCenterPayload | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState("");

  async function load() {
    const response = await fetch("/api/slice-ai-command-center", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load command center.");
      return;
    }

    setData(payload);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setRunning(action);
    setMessage("");

    try {
      const response = await fetch("/api/slice-ai-command-center", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Command center action failed.");
        return;
      }

      setData(payload);
      setMessage(payload.message ?? "Command center updated.");
    } finally {
      setRunning("");
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();

    if (!query.trim()) return;

    await runAction("searchFirm", { query });
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl text-center">
          <Pill tone="red">Slice AI</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading command center...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(88,28,135,0.24),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice AI Command Center
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                The operating brain for the advisory firm.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                Client Brain, Next Best Action, Ask-the-Firm Search, Compliance
                Proof Trail, and One-Click Advisor Day are now connected into a
                single advisor command layer.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/workspace/personal-bot"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
              >
                Personal Bot
              </a>
              <a
                href="/advisor-os"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
              >
                Advisor OS
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Client Brains" value={data.metrics.clientBrains} helper={`${data.metrics.clientCount} clients`} tone="purple" />
          <Metric label="Next Actions" value={data.metrics.nextBestActions} helper="Open recommendations" tone="red" />
          <Metric label="Unread Alerts" value={data.metrics.unreadAlerts} helper="Needs review" tone="amber" />
          <Metric label="Proof Trails" value={data.metrics.proofTrails} helper="Evidence records" tone="green" />
          <Metric label="Knowledge" value={data.metrics.knowledgeEntries} helper="Indexed records" tone="slate" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => runAction("advisorDay")}
            disabled={running === "advisorDay"}
            className="rounded-[1.5rem] bg-white p-5 text-left text-slate-950 shadow-xl shadow-red-950/20 transition hover:scale-[1.01] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-700">One-Click</div>
            <div className="mt-2 text-2xl font-black">Advisor Day</div>
            <div className="mt-2 text-sm font-semibold text-slate-600">Generate the firm’s daily action brief.</div>
          </button>

          <button
            onClick={() => runAction("buildClientBrains")}
            disabled={running === "buildClientBrains"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left shadow-xl shadow-red-950/10 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">Client Brain</div>
            <div className="mt-2 text-2xl font-black">Refresh Profiles</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Build living intelligence profiles.</div>
          </button>

          <button
            onClick={() => runAction("generateNextBestActions")}
            disabled={running === "generateNextBestActions"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left shadow-xl shadow-red-950/10 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-300">Action Engine</div>
            <div className="mt-2 text-2xl font-black">Prioritize Work</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Rank what matters now.</div>
          </button>

          <button
            onClick={() => runAction("rebuildKnowledge")}
            disabled={running === "rebuildKnowledge"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left shadow-xl shadow-red-950/10 transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Ask the Firm</div>
            <div className="mt-2 text-2xl font-black">Index Data</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Search across firm knowledge.</div>
          </button>
        </section>

        <Card>
          <form onSubmit={search} className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              placeholder="Ask the firm: client owns NVDA, Apple source, overdue task, tax notes..."
            />
            <button
              disabled={running === "searchFirm" || !query.trim()}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
            >
              Search Firm
            </button>
          </form>

          {data.searchResults?.length ? (
            <div className="mt-5 grid gap-3">
              {data.searchResults.map((result) => (
                <div key={result.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{result.title}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{result.category} · Score {result.score}</div>
                    </div>
                    <Pill tone={toneFor(result.category)}>{result.category}</Pill>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{result.body}</p>
                  {result.sourceUrl ? (
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                    >
                      Open Source
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Next Best Action</div>
                <h2 className="mt-2 text-2xl font-black">Advisor priority queue</h2>
              </div>
              <Pill tone="red">{data.nextBestActions.filter((action) => action.status === "Open").length} open</Pill>
            </div>

            <div className="mt-5 grid gap-3">
              {data.nextBestActions.slice(0, 12).map((action) => (
                <div key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{action.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{action.actionType} · Score {action.score}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneFor(action.priority)}>{action.priority}</Pill>
                      <Pill tone={toneFor(action.status)}>{action.status}</Pill>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{action.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {action.sourceUrl ? (
                      <a
                        href={action.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        Open Source
                      </a>
                    ) : null}
                    {action.status === "Open" ? (
                      <button
                        onClick={() => runAction("completeAction", { actionId: action.id })}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white"
                      >
                        Mark Complete
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">Client Brain</div>
                <h2 className="mt-2 text-2xl font-black">Living client intelligence</h2>
              </div>
              <Pill tone="purple">{data.clientBrains.length}</Pill>
            </div>

            <div className="mt-5 grid gap-3">
              {data.clientBrains.slice(0, 10).map((brain) => (
                <div key={brain.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{brain.clientName}</div>
                      <div className="mt-1 text-xs text-slate-500">{brain.riskProfile} · Score {brain.score}</div>
                    </div>
                    <Pill tone={toneFor(brain.score)}>{brain.score}</Pill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{brain.portfolioSummary}</p>
                  <p className="mt-2 text-sm leading-6 text-amber-100">{brain.nextAction}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {brain.tags.slice(0, 5).map((tag) => (
                      <Pill key={`${brain.id}-${tag}`} tone="slate">{tag}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Compliance Proof Trail</div>
            <h2 className="mt-2 text-2xl font-black">Evidence and review trail</h2>

            <div className="mt-5 grid gap-3">
              {data.proofTrails.slice(0, 10).map((proof) => (
                <div key={proof.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{proof.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">{proof.actionType} · {proof.riskLevel}</div>
                    </div>
                    <Pill tone={toneFor(proof.humanStatus)}>{proof.humanStatus}</Pill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{proof.summary}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{proof.aiReasoning}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">Advisor Day</div>
            <h2 className="mt-2 text-2xl font-black">Daily AI operating brief</h2>

            <div className="mt-5 grid gap-3">
              {data.advisorDayBriefs.slice(0, 8).map((brief) => (
                <div key={brief.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{brief.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{new Date(brief.createdAt).toLocaleString()} · {brief.status}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{brief.summary}</p>
                  <div className="mt-3 text-xs text-slate-500">{brief.topActions.length} top action(s)</div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}