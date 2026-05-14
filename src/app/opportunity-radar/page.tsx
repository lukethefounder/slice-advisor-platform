"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Signal = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  signalType: string;
  priorityTier: string;
  portfolioRelevanceScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  compositeScore: number;
  tickersJson: string;
  categoriesJson: string;
  evidenceJson: string;
  suggestedAction: string;
  advisorNotes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type RadarResponse = {
  signals: Signal[];
  stats: {
    total: number;
    open: number;
    critical: number;
    high: number;
    protect: number;
    opportunity: number;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Opportunity Radar
        </div>
      </div>
    </div>
  );
}

function tierTone(tier: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (tier === "Critical") return "red";
  if (tier === "High") return "amber";
  if (tier === "Medium") return "green";
  return "slate";
}

function signalTone(type: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (type === "Protect") return "red";
  if (type === "Opportunity") return "green";
  if (type === "High-Risk Opportunity") return "amber";
  return "purple";
}

export default function OpportunityRadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const openSignals = useMemo(() => {
    return data?.signals.filter((signal) => signal.status === "Open") ?? [];
  }, [data]);

  async function loadData() {
    const response = await fetch("/api/opportunities", {
      cache: "no-store",
    });

    if (response.ok) {
      setData(await response.json());
    }
  }

  async function generateSignals() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "generate" }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Could not generate opportunity signals.");
        return;
      }

      setMessage(
        `Opportunity radar updated: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not generate opportunity signals."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runFullScan() {
    setLoading(true);
    setMessage("");

    try {
      const triage = await fetch("/api/intelligence/triage/run", {
        method: "POST",
      });

      const triageData = await triage.json();

      if (!triage.ok) {
        setMessage(triageData.error ?? "Triage scan failed.");
        return;
      }

      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "generate" }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Opportunity generation failed.");
        return;
      }

      setMessage(
        `Full scan complete: ${triageData.scanned} headlines scanned, ${triageData.retained} retained, ${result.created} opportunities created, ${result.updated} updated.`
      );

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Full scan failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(signalId: string, status: string) {
    await fetch("/api/opportunities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "updateStatus",
        signalId,
        status,
      }),
    });

    await loadData();
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap gap-3">
            <a
              href="/workspace"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Workspace
            </a>

            <a
              href="/triage"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Triage
            </a>

            <a
              href="/portfolio-lab"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Portfolio
            </a>

            <button
              onClick={generateSignals}
              disabled={loading}
              className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30 disabled:opacity-60"
            >
              Generate From Retained News
            </button>

            <button
              onClick={runFullScan}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
            >
              Run Full Opportunity Scan
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <Pill>Portfolio-first intelligence</Pill>
            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Opportunity Radar
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
              This module re-ranks retained headlines through actual portfolio
              exposure, client holdings, watchlists, research notes, source trust,
              materiality, confidence, actionability, and risk. It is designed to
              help advisors focus on what matters now.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Open Signals</div>
                <div className="mt-1 text-4xl font-black">
                  {data?.stats.open ?? "—"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Critical</div>
                <div className="mt-1 text-4xl font-black">
                  {data?.stats.critical ?? "—"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm text-slate-400">Protect Signals</div>
                <div className="mt-1 text-4xl font-black">
                  {data?.stats.protect ?? "—"}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Ranking Logic</h2>
            <div className="mt-5 space-y-3">
              {[
                "Existing portfolio holdings outrank generic news.",
                "Client holdings outrank watchlist-only matches.",
                "Regulatory, legal, credit, and halt events create protect signals.",
                "Earnings, M&A, AI/product, and macro catalysts can create opportunity signals.",
                "Crypto and private venture items are separated as high-risk opportunity signals.",
                "Every signal includes evidence and an advisor-safe suggested action.",
              ].map((item, index) => (
                <div
                  key={`ranking-logic-${index}-${item}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-6">
          <Card className="p-5">
            <div className="text-sm text-slate-400">Total</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.total ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm text-slate-400">Open</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.open ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm text-slate-400">Critical</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.critical ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm text-slate-400">High</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.high ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm text-slate-400">Protect</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.protect ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm text-slate-400">Opportunity</div>
            <div className="mt-1 text-3xl font-black">
              {data?.stats.opportunity ?? "—"}
            </div>
          </Card>
        </section>

        <section className="mt-6">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Open Opportunity Signals</h2>

            <div className="mt-5 space-y-5">
              {openSignals.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">
                  No open signals yet. Run triage first, then generate
                  opportunities.
                </div>
              ) : (
                openSignals.map((signal) => {
                  const tickers = parseJsonList(signal.tickersJson);
                  const categories = parseJsonList(signal.categoriesJson);
                  const evidence = parseJsonList(signal.evidenceJson);

                  return (
                    <article
                      key={signal.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={signalTone(signal.signalType)}>
                              {signal.signalType}
                            </Pill>
                            <Pill tone={tierTone(signal.priorityTier)}>
                              {signal.priorityTier}
                            </Pill>
                            <Pill tone="slate">{signal.sourceName}</Pill>
                          </div>

                          <h3 className="mt-4 text-2xl font-black">
                            {signal.title}
                          </h3>

                          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                            {signal.summary || "No summary stored."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {tickers.map((ticker, tickerIndex) => (
                              <Pill
                                key={`${signal.id}-ticker-${tickerIndex}-${String(
                                  ticker
                                )}`}
                                tone="red"
                              >
                                {String(ticker)}
                              </Pill>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                          <div className="text-xs font-black uppercase text-red-300">
                            Composite
                          </div>
                          <div className="text-4xl font-black">
                            {signal.compositeScore}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-5">
                        {[
                          ["Portfolio", signal.portfolioRelevanceScore],
                          ["Opportunity", signal.opportunityScore],
                          ["Risk", signal.riskScore],
                          ["Confidence", signal.confidenceScore],
                          ["Actionable", signal.actionabilityScore],
                        ].map(([label, value]) => (
                          <div
                            key={`${signal.id}-score-${String(label)}`}
                            className="rounded-2xl border border-white/10 bg-black/30 p-4"
                          >
                            <div className="text-xs font-black uppercase text-slate-500">
                              {label}
                            </div>
                            <div className="mt-1 text-2xl font-black">
                              {String(value)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase text-slate-500">
                          Suggested advisor action
                        </div>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          {signal.suggestedAction}
                        </p>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Categories
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {categories.slice(0, 6).map((category, categoryIndex) => (
                              <Pill
                                key={`${signal.id}-category-${categoryIndex}-${String(
                                  category
                                )}`}
                                tone="purple"
                              >
                                {String(category)}
                              </Pill>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Evidence
                          </div>
                          <ul className="mt-2 space-y-1">
                            {evidence.slice(0, 7).map((item, evidenceIndex) => (
                              <li
                                key={`${signal.id}-evidence-${evidenceIndex}-${String(
                                  item
                                )}`}
                                className="text-sm text-slate-400"
                              >
                                • {String(item)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => updateStatus(signal.id, "Reviewed")}
                          className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                        >
                          Mark Reviewed
                        </button>

                        <button
                          onClick={() => updateStatus(signal.id, "Action Needed")}
                          className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30"
                        >
                          Mark Action Needed
                        </button>

                        <button
                          onClick={() => updateStatus(signal.id, "Dismissed")}
                          className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}