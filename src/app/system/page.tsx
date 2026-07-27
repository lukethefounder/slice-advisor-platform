"use client";

import { useEffect, useState, type ReactNode } from "react";

type Check = {
  name: string;
  ready: boolean;
  detail: string;
};

type Readiness = {
  readinessScore: number;
  readyCount: number;
  totalChecks: number;
  checks: Check[];
  counts: Record<string, number>;
};

type Health = {
  ok: boolean;
  database: string;
  timestamp: string;
  counts?: {
    users: number;
    alerts: number;
    retainedDecisions: number;
  };
  detail?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
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
  tone?: "red" | "green" | "amber" | "slate";
}) {
  const tones = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
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
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          System Readiness
        </div>
      </div>
    </div>
  );
}

function readinessTone(score: number): "red" | "green" | "amber" | "slate" {
  if (score >= 85) return "green";
  if (score >= 65) return "amber";
  if (score > 0) return "red";
  return "slate";
}

export default function SystemPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    const [healthResponse, readinessResponse] = await Promise.all([
      fetch("/api/system/health", { cache: "no-store" }),
      fetch("/api/system/readiness", { cache: "no-store" }),
    ]);

    if (healthResponse.ok) {
      setHealth(await healthResponse.json());
    } else {
      setHealth(await healthResponse.json());
    }

    if (readinessResponse.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (readinessResponse.ok) {
      setReadiness(await readinessResponse.json());
    }
  }

  async function runSeed() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/system/seed", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Seed failed.");
        return;
      }

      setMessage("Demo workspace seeded.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seed failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runReset() {
    const confirmed = window.confirm(
      "Reset workspace data? This keeps your user account, sessions, security settings, disclosures, and audit logs, but removes workspace records."
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/system/reset", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Reset failed.");
        return;
      }

      setMessage("Workspace reset complete.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open System Readiness.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Register or log in through the portal first.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-6 py-4 font-black text-white shadow-lg shadow-emerald-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-emerald-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap gap-3">
            <a
              href="/command"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Command
            </a>

            <a
              href="/portal"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Portal
            </a>

            <button
              onClick={loadData}
              disabled={loading}
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10 disabled:opacity-60"
            >
              Refresh
            </button>

            <button
              onClick={runSeed}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-4 py-3 font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-60"
            >
              Seed Demo Data
            </button>

            <button
              onClick={runReset}
              disabled={loading}
              className="rounded-2xl bg-emerald-500/10 px-4 py-3 font-black text-emerald-300 ring-1 ring-emerald-500/30 disabled:opacity-60"
            >
              Reset Workspace
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card className="p-6">
            <Pill tone={readinessTone(readiness?.readinessScore ?? 0)}>
              Pre-variable readiness
            </Pill>

            <h1 className="mt-4 text-5xl font-black tracking-tight">
              Final Internal Readiness Check
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
              This page verifies that the internal Slice platform is ready before
              external variables are added for market data, AI, email, SMS,
              production database hosting, and deployment secrets.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-bold text-slate-400">
                  Readiness Score
                </div>
                <div className="mt-2 text-5xl font-black">
                  {readiness?.readinessScore ?? "—"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-bold text-slate-400">
                  Checks Ready
                </div>
                <div className="mt-2 text-5xl font-black">
                  {readiness ? `${readiness.readyCount}/${readiness.totalChecks}` : "—"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-bold text-slate-400">
                  Database
                </div>
                <div className="mt-2 text-3xl font-black">
                  {health?.database ?? "—"}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Health Check</h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase text-slate-500">
                  API
                </div>
                <div className="mt-1 font-black">
                  {health?.ok ? "Healthy" : "Issue"}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase text-slate-500">
                  Timestamp
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-300">
                  {health?.timestamp
                    ? new Date(health.timestamp).toLocaleString()
                    : "—"}
                </div>
              </div>

              {health?.detail ? (
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {health.detail}
                </div>
              ) : null}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Readiness Checks</h2>

            <div className="mt-5 space-y-4">
              {readiness?.checks.map((check) => (
                <div
                  key={check.name}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-black">{check.name}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {check.detail}
                      </p>
                    </div>

                    <Pill tone={check.ready ? "green" : "amber"}>
                      {check.ready ? "Ready" : "Needs Data"}
                    </Pill>
                  </div>
                </div>
              )) ?? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                  Loading readiness checks...
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">System Counts</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {readiness
                ? Object.entries(readiness.counts).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-3xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="text-xs font-black uppercase text-slate-500">
                        {key}
                      </div>
                      <div className="mt-1 text-2xl font-black">{value}</div>
                    </div>
                  ))
                : null}
            </div>
          </Card>
        </section>

        <section className="mt-6">
          <Card className="p-6">
            <h2 className="text-2xl font-black">
              Final Pre-Variable Checklist
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                "Register and log in through /portal",
                "Seed demo data through /system",
                "Open /command and confirm readiness",
                "Run triage from /triage",
                "Confirm alerts in /investor",
                "Queue and process notifications in /notifications",
                "Generate a briefing from /briefings",
                "Create or review holdings in /portfolio-lab",
                "Accept disclosures in /security",
                "Run cleanup in /intelligence-settings",
                "Confirm no terminal errors",
                "Only then add external variables",
              ].map((item, index) => (
                <div
                  key={item}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-black text-emerald-300 ring-1 ring-emerald-500/30">
                      {index + 1}
                    </div>
                    <div className="text-sm font-semibold leading-6 text-slate-300">
                      {item}
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