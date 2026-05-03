"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Decision = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceTier: string;
  url: string | null;
  category: string;
  subcategory: string;
  importanceTier: string;
  action: string;
  urgency: string;
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  matchedTickersJson: string;
  matchedAreasJson: string;
  reasonsJson: string;
  channelsJson: string;
  createdAt: string;
};

type Run = {
  id: string;
  mode: string;
  scannedCount: number;
  retainedCount: number;
  alertCount: number;
  digestCount: number;
  discardedCount: number;
  durationMs: number;
  createdAt: string;
};

type SourceCheckpoint = {
  id: string;
  sourceId: string;
  sourceName: string;
  lastFetchedAt: string | null;
  lastSeenHash: string | null;
  lastStatus: string;
  lastItemCount: number;
  updatedAt: string;
  createdAt: string;
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
          Intelligence Triage
        </div>
      </div>
    </div>
  );
}

function urgencyTone(urgency: string): "red" | "green" | "amber" | "slate" {
  if (urgency === "Critical") return "red";
  if (urgency === "High") return "amber";
  if (urgency === "Medium") return "green";
  return "slate";
}

function sourceStatusTone(status: string): "red" | "green" | "amber" | "slate" {
  if (status === "OK") return "green";
  if (status === "Skipped") return "amber";
  if (status === "Error") return "red";
  return "slate";
}

export default function TriagePage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceCheckpoint[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const latestRun = runs[0];

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const decision of decisions) {
      counts.set(decision.category, (counts.get(decision.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [decisions]);

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const decision of decisions) {
      counts.set(
        decision.importanceTier,
        (counts.get(decision.importanceTier) ?? 0) + 1
      );
    }

    return Array.from(counts.entries())
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);
  }, [decisions]);

  async function loadData() {
    const [triageResponse, sourceHealthResponse] = await Promise.all([
      fetch("/api/intelligence/triage", {
        cache: "no-store",
      }),
      fetch("/api/intelligence/source-health", {
        cache: "no-store",
      }),
    ]);

    if (triageResponse.ok) {
      const data = await triageResponse.json();
      setDecisions(data.decisions ?? []);
      setRuns(data.runs ?? []);
    }

    if (sourceHealthResponse.ok) {
      const data = await sourceHealthResponse.json();
      setSourceHealth(data.checkpoints ?? []);
    }
  }

  async function runTriage(mode: "live" | "demo") {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        mode === "demo"
          ? "/api/intelligence/triage/run?demo=1"
          : "/api/intelligence/triage/run",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Triage run failed.");
        return;
      }

      setMessage(
        `Triage complete (${data.mode ?? mode}): ${data.scanned} scanned, ${data.retained} retained, ${data.alerts} alerts, ${data.digest} digest, ${data.discarded} discarded.`
      );

      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Triage run failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runCleanup() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/cleanup", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Cleanup failed.");
        return;
      }

      setMessage(`Cleanup complete: ${JSON.stringify(data.result)}`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cleanup failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Main App
            </a>

            <a
              href="/investor"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Investor
            </a>

            <a
              href="/intelligence-settings"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Settings
            </a>

            <button
              onClick={() => runTriage("live")}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
            >
              {loading ? "Running..." : "Run Live Triage"}
            </button>

            <button
              onClick={() => runTriage("demo")}
              disabled={loading}
              className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30 disabled:opacity-60"
            >
              Demo Run
            </button>

            <button
              onClick={runCleanup}
              disabled={loading}
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10 disabled:opacity-60"
            >
              Cleanup
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-5">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Scanned</div>
            <div className="mt-1 text-4xl font-black">
              {latestRun?.scannedCount ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Retained</div>
            <div className="mt-1 text-4xl font-black">
              {latestRun?.retainedCount ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Alerts</div>
            <div className="mt-1 text-4xl font-black">
              {latestRun?.alertCount ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Digest</div>
            <div className="mt-1 text-4xl font-black">
              {latestRun?.digestCount ?? "—"}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Discarded</div>
            <div className="mt-1 text-4xl font-black">
              {latestRun?.discardedCount ?? "—"}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-black">Latest Run</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The latest scan decides what deserves storage, alerts, digest
                placement, or suppression.
              </p>

              {latestRun ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Mode
                    </div>
                    <div className="mt-1 font-black">{latestRun.mode}</div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Duration
                    </div>
                    <div className="mt-1 font-black">
                      {latestRun.durationMs}ms
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Created
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-300">
                      {new Date(latestRun.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No triage runs yet.
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Importance Categories</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Slice groups retained news by material area so investors are not
                buried under endless headlines.
              </p>

              <div className="mt-5 space-y-3">
                {categoryCounts.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    Run triage to see categories.
                  </div>
                ) : (
                  categoryCounts.map((item) => (
                    <div
                      key={item.category}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{item.category}</div>
                        <Pill tone="red">{item.count}</Pill>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Importance Tiers</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These tiers control whether a story becomes an alert, review
                item, digest item, or short-term retained item.
              </p>

              <div className="mt-5 space-y-3">
                {tierCounts.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    Run triage to see importance tiers.
                  </div>
                ) : (
                  tierCounts.map((item) => (
                    <div
                      key={item.tier}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{item.tier}</div>
                        <Pill tone="amber">{item.count}</Pill>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-black">Source Health</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                This shows which live/free sources were fetched, skipped, or had
                issues.
              </p>

              <div className="mt-5 space-y-3">
                {sourceHealth.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    No source health checkpoints yet.
                  </div>
                ) : (
                  sourceHealth.map((source) => (
                    <div
                      key={source.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-black">{source.sourceName}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">
                            {source.sourceId}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-400">
                            {source.lastFetchedAt
                              ? new Date(source.lastFetchedAt).toLocaleString()
                              : "Never fetched"}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Pill tone={sourceStatusTone(source.lastStatus)}>
                            {source.lastStatus}
                          </Pill>
                          <Pill tone="slate">
                            {source.lastItemCount} items
                          </Pill>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Retained Decisions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              These are the only headline decisions stored. Low-value noise is
              discarded after processing.
            </p>

            <div className="mt-5 space-y-4">
              {decisions.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">
                  No retained decisions yet. Run triage first.
                </div>
              ) : (
                decisions.map((decision) => {
                  const reasons = parseJsonList(decision.reasonsJson);
                  const tickers = parseJsonList(decision.matchedTickersJson);
                  const areas = parseJsonList(decision.matchedAreasJson);
                  const channels = parseJsonList(decision.channelsJson);

                  return (
                    <article
                      key={decision.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={urgencyTone(decision.urgency)}>
                              {decision.urgency}
                            </Pill>
                            <Pill tone="slate">
                              {decision.importanceTier}
                            </Pill>
                            <Pill tone="amber">{decision.category}</Pill>
                          </div>

                          <h3 className="mt-4 text-xl font-black">
                            {decision.title}
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {decision.summary || "No summary stored."}
                          </p>

                          <div className="mt-3 text-xs font-bold text-slate-500">
                            {decision.sourceName} · {decision.sourceTier}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                          <div className="text-xs font-black uppercase text-red-300">
                            Score
                          </div>
                          <div className="text-3xl font-black">
                            {decision.score}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Materiality
                          </div>
                          <div className="mt-1 text-xl font-black">
                            {decision.materialityScore}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Relevance
                          </div>
                          <div className="mt-1 text-xl font-black">
                            {decision.relevanceScore}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Trust
                          </div>
                          <div className="mt-1 text-xl font-black">
                            {decision.trustScore}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Channels
                          </div>
                          <div className="mt-1 text-sm font-black">
                            {channels.length ? channels.join(", ") : "None"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Matched tickers
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-300">
                            {tickers.length ? tickers.join(", ") : "None"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Matched areas
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-300">
                            {areas.length ? areas.join(", ") : "None"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Action
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-300">
                            {decision.action}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase text-slate-500">
                          Why it was retained
                        </div>

                        <ul className="mt-3 space-y-2">
                          {reasons.length ? (
                            reasons.map((reason) => (
                              <li
                                key={String(reason)}
                                className="text-sm font-semibold text-slate-400"
                              >
                                • {String(reason)}
                              </li>
                            ))
                          ) : (
                            <li className="text-sm font-semibold text-slate-400">
                              No reasons stored.
                            </li>
                          )}
                        </ul>
                      </div>

                      {decision.url ? (
                        <a
                          href={decision.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                        >
                          Open Source
                        </a>
                      ) : null}
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