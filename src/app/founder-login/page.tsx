"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  useState,
  type FormEvent,
} from "react";

import {
  BrandMark,
  Card,
  Pill,
  SliceBackground,
  SoftCard,
  cx,
} from "@/components/slice-ui";

type LoginResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  isFounder?: boolean;
  betaAccess?: boolean;
  error?: string;
};

export default function FounderLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    "Use a real firm owner or invited advisor account.",
  );
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Sign in failed.");
      }

      setMessage("Access verified. Opening the advisor workspace.");
      window.location.href = "/workspace";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid min-h-screen max-w-7xl gap-5 px-4 py-5 sm:px-6">
        <header className="rounded-[1.75rem] border border-emerald-300/12 bg-black/68 p-4 shadow-xl shadow-emerald-950/25 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark subtitle="Secure Beta Access" />
            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 hover:text-white"
              >
                Public site
              </Link>
              <Link
                href="/advisor-signup"
                className="rounded-xl border border-emerald-400/22 bg-emerald-500/[0.07] px-4 py-2.5 text-xs font-black text-emerald-100 hover:bg-emerald-500/12"
              >
                Create firm account
              </Link>
            </div>
          </div>
        </header>

        <section className="grid items-center gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <Card className="p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.26),transparent_30%),radial-gradient(circle_at_85%_22%,rgba(34,211,238,0.11),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(132,204,22,0.07),transparent_36%)]" />

            <div className="relative">
              <div className="flex flex-wrap gap-2">
                <Pill tone="green">Slice beta</Pill>
                <Pill tone="cyan">Real accounts</Pill>
                <Pill tone="amber">Review first</Pill>
              </div>

              <h1 className="mt-7 max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-white md:text-7xl">
                Enter the advisor operating core.
              </h1>

              <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-slate-400">
                Temporary founder and advisor credentials have been removed. Slice beta
                now uses persistent firm accounts, protected sessions, and database-backed
                invitations.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    icon: LockKeyhole,
                    label: "Protected",
                    helper: "HTTP-only sessions",
                  },
                  {
                    icon: UsersRound,
                    label: "Role-aware",
                    helper: "Firm permissions",
                  },
                  {
                    icon: Sparkles,
                    label: "AI-native",
                    helper: "Advisor workflows",
                  },
                  {
                    icon: ShieldCheck,
                    label: "Beta ready",
                    helper: "No demo access",
                  },
                ].map((item) => (
                  <SoftCard key={item.label} className="bg-black/25">
                    <item.icon className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-lg font-black text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.helper}
                    </p>
                  </SoftCard>
                ))}
              </div>

              <div className="mt-7 rounded-[1.6rem] border border-emerald-300/12 bg-emerald-500/[0.045] p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-sm font-black text-white">
                      Invited advisor?
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">
                      Open the secure link delivered by your firm owner. It creates or
                      connects the account and assigns the correct firm role.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-emerald-500/16 via-cyan-500/[0.03] to-transparent" />

            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-500/[0.08] text-emerald-200">
                <LogIn className="h-6 w-6" />
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Secure sign in
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">
                Open your workspace.
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                Enter the email and password created during firm signup or advisor
                invitation.
              </p>

              <form onSubmit={login} className="mt-6 grid gap-4">
                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Account email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="advisor@firm.com"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                  />
                </label>

                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Your secure password"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative inline-flex min-h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:brightness-110 disabled:opacity-50"
                >
                  <span className="absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/16 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
                  {loading ? (
                    <RefreshCw className="relative h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="relative h-4 w-4" />
                  )}
                  <span className="relative">
                    {loading ? "Verifying access…" : "Open Slice Workspace"}
                  </span>
                </button>
              </form>

              {message ? (
                <div
                  className={cx(
                    "mt-5 rounded-2xl border p-4 text-sm font-bold leading-6",
                    message.includes("failed") ||
                      message.includes("Invalid") ||
                      message.includes("required") ||
                      message.includes("not connected")
                      ? "border-amber-400/25 bg-amber-500/[0.07] text-amber-100"
                      : "border-emerald-300/15 bg-emerald-500/[0.055] text-emerald-100",
                  )}
                >
                  {message}
                </div>
              ) : null}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link
                  href="/advisor-signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/16 bg-emerald-500/[0.055] px-4 py-3 text-xs font-black text-emerald-100 hover:bg-emerald-500/10"
                >
                  Create firm account
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/security"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-black text-slate-400 hover:text-white"
                >
                  Security center
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}