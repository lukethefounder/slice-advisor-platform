"use client";

import { useEffect, useState } from "react";

type SourceConfig = {
  sourceId: string;
  name: string;
  description: string | null;
  sourceTier: string;
  category: string;
  enabled: boolean;
  minScoreToRetain: number;
  minScoreToAlert: number;
  maxItemsPerRun: number;
  cooldownMinutes: number;
  priority: number;
  lastRunAt: string | null;
};

type Policy = {
  minScoreToStore: number;
  minScoreToAlert: number;
  maxRetainedPerRun: number;
  maxRetainedDecisions: number;
  maxRetainedRuns: number;
  maxAlertEvents: number;
  readAlertRetentionDays: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
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
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
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
          Intelligence Settings
        </div>
      </div>
    </div>
  );
}

export default function IntelligenceSettingsPage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");

  async function loadSettings() {
    const response = await fetch("/api/intelligence/settings", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setSources(data.sources ?? []);
    setPolicy(data.policy ?? null);
  }

  async function toggleSource(source: SourceConfig) {
    await fetch("/api/intelligence/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "source",
        sourceId: source.sourceId,
        enabled: !source.enabled,
      }),
    });

    await loadSettings();
  }

  async function updateSourceScore(
    source: SourceConfig,
    field: "minScoreToRetain" | "minScoreToAlert",
    value: number
  ) {
    await fetch("/api/intelligence/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "source",
        sourceId: source.sourceId,
        [field]: value,
      }),
    });

    await loadSettings();
  }

  async function updatePolicy() {
    if (!policy) return;

    await fetch("/api/intelligence/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "policy",
        ...policy,
      }),
    });

    setMessage("Policy saved.");
    await loadSettings();
  }

  async function cleanup() {
    const response = await fetch("/api/intelligence/cleanup", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Cleanup failed.");
      return;
    }

    setMessage(
      `Cleanup complete: ${JSON.stringify(data.result)}`
    );

    await loadSettings();
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap gap-3">
            <a
              href="/triage"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Triage
            </a>
            <a
              href="/investor"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Investor
            </a>
            <button
              onClick={cleanup}
              className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white"
            >
              Run Cleanup
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="p-6">
            <h1 className="text-3xl font-black">Retention Policy</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              These controls prevent Slice from storing too much headline data.
              The system should scan heavily but retain selectively.
            </p>

            {policy ? (
              <div className="mt-5 grid gap-4">
                {[
                  ["minScoreToStore", "Minimum score to store"],
                  ["minScoreToAlert", "Minimum score to alert"],
                  ["maxRetainedPerRun", "Max retained per run"],
                  ["maxRetainedDecisions", "Max retained decisions"],
                  ["maxRetainedRuns", "Max retained runs"],
                  ["maxAlertEvents", "Max alert events"],
                  ["readAlertRetentionDays", "Read alert retention days"],
                ].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-black uppercase text-slate-500">
                      {label}
                    </span>
                    <input
                      type="number"
                      value={policy[key as keyof Policy]}
                      onChange={(event) =>
                        setPolicy((current) =>
                          current
                            ? {
                                ...current,
                                [key]: Number(event.target.value),
                              }
                            : current
                        )
                      }
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                    />
                  </label>
                ))}

                <button
                  onClick={updatePolicy}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 font-black text-white"
                >
                  Save Policy
                </button>
              </div>
            ) : (
              <div className="mt-5 text-sm text-slate-400">Loading policy...</div>
            )}
          </Card>

          <Card className="p-6">
            <h1 className="text-3xl font-black">Source Controls</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Each source can have its own thresholds. Low-trust sources should
              need much higher scores before they are stored or alert-worthy.
            </p>

            <div className="mt-5 space-y-4">
              {sources.map((source) => (
                <div
                  key={source.sourceId}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone={source.enabled ? "green" : "slate"}>
                          {source.enabled ? "Enabled" : "Disabled"}
                        </Pill>
                        <Pill tone="red">{source.category}</Pill>
                        <Pill tone="amber">{source.sourceTier}</Pill>
                      </div>

                      <h2 className="mt-3 text-xl font-black">{source.name}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        {source.description}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleSource(source)}
                      className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                    >
                      {source.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <label>
                      <span className="text-xs font-black uppercase text-slate-500">
                        Store score
                      </span>
                      <input
                        type="number"
                        value={source.minScoreToRetain}
                        onChange={(event) =>
                          updateSourceScore(
                            source,
                            "minScoreToRetain",
                            Number(event.target.value)
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      />
                    </label>

                    <label>
                      <span className="text-xs font-black uppercase text-slate-500">
                        Alert score
                      </span>
                      <input
                        type="number"
                        value={source.minScoreToAlert}
                        onChange={(event) =>
                          updateSourceScore(
                            source,
                            "minScoreToAlert",
                            Number(event.target.value)
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      />
                    </label>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs font-black uppercase text-slate-500">
                        Max per run
                      </div>
                      <div className="mt-1 text-xl font-black">
                        {source.maxItemsPerRun}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="text-xs font-black uppercase text-slate-500">
                        Last run
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        {source.lastRunAt
                          ? new Date(source.lastRunAt).toLocaleString()
                          : "Never"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}