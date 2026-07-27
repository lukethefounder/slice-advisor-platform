"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
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

type RegisterResponse = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
  firm?: {
    id: string;
    name: string;
  };
  error?: string;
  detail?: string;
};

export default function AdvisorSignupPage() {
  const [firmName, setFirmName] = useState("");
  const [firmEmail, setFirmEmail] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(
    "Create the firm-owner account that will control beta access.",
  );
  const [loading, setLoading] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!firmName.trim() || !name.trim() || !email.trim()) {
      setMessage("Firm name, advisor name, and advisor email are required.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firmName: firmName.trim(),
          firmEmail: firmEmail.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as RegisterResponse;

      if (!response.ok || !payload.user || !payload.firm) {
        throw new Error(
          payload.detail
            ? `${payload.error || "Registration failed."} ${payload.detail}`
            : payload.error || "Registration failed.",
        );
      }

      setMessage("Firm account created. Opening the beta workspace.");
      window.location.href = "/workspace";
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Registration failed.",
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
            <BrandMark subtitle="Beta Firm Account Creation" />
            <Link
              href="/founder-login"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 hover:border-emerald-400/20 hover:text-white"
            >
              Existing account sign in
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-5 xl:grid-cols-[0.94fr_1.06fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="green">Firm-owner beta</Pill>
              <Pill tone="cyan">Persistent account</Pill>
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.06em] text-white md:text-7xl">
              Create your green-market advisor workspace.
            </h1>

            <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-slate-400">
              This creates a real advisor user, firm, owner membership, protected
              session, security defaults, and an empty live-data watchlist—without
              demo credentials or stale sample prices.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Building2,
                  label: "Real firm workspace",
                  helper: "Persistent database record",
                },
                {
                  icon: UsersRound,
                  label: "Owner permissions",
                  helper: "Invite and manage advisors",
                },
                {
                  icon: Sparkles,
                  label: "AI and briefing",
                  helper: "Advisor-controlled workflows",
                },
                {
                  icon: ShieldCheck,
                  label: "Beta security",
                  helper: "Protected sessions and governance",
                },
              ].map((item) => (
                <SoftCard key={item.label} className="bg-black/25">
                  <item.icon className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-lg font-black text-white">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {item.helper}
                  </p>
                </SoftCard>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-[1.6rem] border border-emerald-300/12 bg-emerald-500/[0.045] p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-sm font-semibold leading-6 text-slate-400">
                Additional advisors should not create separate firms. Invite them from
                the workspace so their account is attached to this firm and assigned the
                correct role.
              </p>
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/16 via-cyan-500/[0.035] to-transparent" />

            <div className="relative">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/18 bg-emerald-500/[0.08] text-emerald-200">
                <UserPlus className="h-6 w-6" />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Firm owner signup
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">
                Establish beta access.
              </h2>

              <form onSubmit={register} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Firm name
                    </span>
                    <input
                      value={firmName}
                      onChange={(event) => setFirmName(event.target.value)}
                      placeholder="Royal Wealth Advisors"
                      autoComplete="organization"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Firm email optional
                    </span>
                    <input
                      type="email"
                      value={firmEmail}
                      onChange={(event) => setFirmEmail(event.target.value)}
                      placeholder="operations@firm.com"
                      autoComplete="email"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Advisor name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Advisor email
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="advisor@firm.com"
                      autoComplete="email"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Password
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      Confirm password
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3.5 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative inline-flex min-h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-5 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  {loading ? "Creating secure workspace…" : "Create Beta Workspace"}
                </button>
              </form>

              {message ? (
                <div
                  className={cx(
                    "mt-5 rounded-2xl border p-4 text-sm font-bold leading-6",
                    message.includes("created")
                      ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100"
                      : message.includes("required") ||
                          message.includes("match") ||
                          message.includes("failed") ||
                          message.includes("exists")
                        ? "border-amber-400/25 bg-amber-500/[0.08] text-amber-100"
                        : "border-emerald-300/14 bg-emerald-500/[0.05] text-emerald-100",
                  )}
                >
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