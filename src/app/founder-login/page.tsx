"use client";

import { FormEvent, useState } from "react";
import {
  ActionButton,
  Card,
  LinkButton,
  Metric,
  Pill,
  SliceBackground,
  SoftCard,
  TopNav,
} from "@/components/slice-ui";

type AccountPreset = "founder" | "advisor";

const WORKSPACE_DESTINATION = "/workspace";

const ACCOUNTS = {
  founder: {
    label: "Founder",
    eyebrow: "Executive access",
    email: "founder@slice.local",
    password: "SliceFounder!2026",
    destination: WORKSPACE_DESTINATION,
    tone: "red" as const,
    description:
      "Founder access opens directly into the unified workspace for operating control, AI Studio, team board, client workflows, market visuals, and firm intelligence.",
    bullets: [
      "Workspace-first routing",
      "Full platform visibility",
      "Owner-level operations",
    ],
  },
  advisor: {
    label: "Firm Advisor",
    eyebrow: "Advisor access",
    email: "advisor@slice.local",
    password: "SliceAdvisor!2026",
    destination: WORKSPACE_DESTINATION,
    tone: "green" as const,
    description:
      "Advisor access opens directly into the workspace for tasks, client communication, meeting prep, personal docs, research, and collaborative execution.",
    bullets: [
      "Advisor OS tools",
      "Client workflow access",
      "Team collaboration",
    ],
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AccessStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/10">
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-red-500/14 to-transparent" />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 text-2xl font-black text-white">{value}</div>
        <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
      </div>
    </div>
  );
}

function SecurityRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
      <div className="text-xs font-bold text-slate-400">{label}</div>
      <Pill tone={tone}>{value}</Pill>
    </div>
  );
}

export default function FounderLoginPage() {
  const [preset, setPreset] = useState<AccountPreset>("founder");
  const [email, setEmail] = useState(ACCOUNTS.founder.email);
  const [password, setPassword] = useState(ACCOUNTS.founder.password);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const activeAccount = ACCOUNTS[preset];

  function applyPreset(nextPreset: AccountPreset) {
    setPreset(nextPreset);
    setEmail(ACCOUNTS[nextPreset].email);
    setPassword(ACCOUNTS[nextPreset].password);
    setMessage("");
  }

  async function prepareTemporaryLogins() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/temporary-logins", {
        method: "POST",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(
          payload.error ??
            "Access profile preparation failed. Check ENABLE_TEMP_LOGINS and restart the dev server."
        );
        return;
      }

      setMessage(payload.message ?? "Access profiles are ready.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Access profile preparation failed: ${error.message}`
          : "Access profile preparation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error ?? "Login failed.");
        return;
      }

      window.location.href = activeAccount.destination;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Login failed: ${error.message}`
          : "Login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-5 py-5">
        <TopNav subtitle="Secure Workspace Access" />

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 xl:grid-cols-[1.06fr_0.94fr]">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(239,68,68,0.30),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(6,182,212,0.18),transparent_28%),radial-gradient(circle_at_50%_95%,rgba(168,85,247,0.18),transparent_34%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.07] to-transparent" />

            <div className="relative">
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Slice access layer</Pill>
                <Pill tone="green">Workspace first</Pill>
                <Pill tone="cyan">AI operating system</Pill>
              </div>

              <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl">
                Enter the command center built for modern advisors.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
                Slice routes every successful login directly into the main
                workspace, where firm operations, market intelligence, client
                workflows, AI Studio, docs, team board, and execution tools live
                in one consolidated operating portal.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AccessStat
                  label="Default Route"
                  value="Workspace"
                  helper="No detours"
                />
                <AccessStat
                  label="Access Layer"
                  value="Role-Based"
                  helper="Founder + advisor"
                />
                <AccessStat
                  label="AI Studio"
                  value="Central"
                  helper="Platform assistant"
                />
                <AccessStat
                  label="Workflow"
                  value="Unified"
                  helper="Clients + team"
                />
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <SoftCard className="bg-black/30">
                  <Pill tone="purple">Operate</Pill>
                  <h3 className="mt-3 text-lg font-black text-white">
                    One workspace
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Login lands where the work happens: AI, clients, market
                    visuals, docs, and team execution.
                  </p>
                </SoftCard>

                <SoftCard className="bg-black/30">
                  <Pill tone="cyan">Review</Pill>
                  <h3 className="mt-3 text-lg font-black text-white">
                    Advisor-grade flow
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Client communication, task delegation, and research are
                    designed to stay approval-oriented.
                  </p>
                </SoftCard>

                <SoftCard className="bg-black/30">
                  <Pill tone="green">Execute</Pill>
                  <h3 className="mt-3 text-lg font-black text-white">
                    Fast entry
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Founder and advisor profiles both open directly into the
                    operating portal.
                  </p>
                </SoftCard>
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden p-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_32%)]" />
            <div className="relative p-5 md:p-6">
              <div className="rounded-[2rem] border border-white/10 bg-black/40 p-4">
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(ACCOUNTS) as AccountPreset[]).map((accountKey) => {
                    const account = ACCOUNTS[accountKey];
                    const active = preset === accountKey;

                    return (
                      <button
                        key={accountKey}
                        type="button"
                        onClick={() => applyPreset(accountKey)}
                        className={cx(
                          "relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition hover:scale-[1.01]",
                          active
                            ? "border-red-400/40 bg-gradient-to-br from-red-600 via-red-800 to-zinc-950 text-white shadow-lg shadow-red-950/40"
                            : "border-white/10 bg-white/[0.045] text-slate-400 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <div className="relative">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">
                            {account.eyebrow}
                          </div>
                          <div className="mt-2 text-lg font-black">
                            {account.label}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <SoftCard className="mt-5 bg-black/35">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Pill tone={activeAccount.tone}>{activeAccount.label}</Pill>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
                      Workspace-first sign in.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {activeAccount.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {activeAccount.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-white">
                        ✓
                      </span>
                      <span className="text-sm font-bold text-slate-300">
                        {bullet}
                      </span>
                    </div>
                  ))}
                </div>
              </SoftCard>

              <form onSubmit={login} className="mt-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Email
                  </label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Email"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Password"
                  />
                </div>

                <button
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:scale-[1.01] disabled:opacity-60"
                >
                  <span className="absolute inset-0 translate-x-[-110%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-700 group-hover:translate-x-[110%]" />
                  <span className="relative">
                    {loading
                      ? "Signing in..."
                      : `Open Workspace as ${activeAccount.label}`}
                  </span>
                </button>
              </form>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ActionButton
                  onClick={prepareTemporaryLogins}
                  disabled={loading}
                  variant="secondary"
                  className="w-full"
                >
                  Initialize Access Profiles
                </ActionButton>

                <LinkButton href="/workspace" variant="secondary" className="w-full">
                  Main Workspace
                </LinkButton>
              </div>

              <div className="mt-5 grid gap-2">
                <SecurityRow label="Destination" value="Workspace" tone="green" />
                <SecurityRow label="Session" value="Protected" tone="cyan" />
                <SecurityRow label="Access" value={activeAccount.label} tone={activeAccount.tone} />
              </div>

              {message ? (
                <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
                  {message}
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}