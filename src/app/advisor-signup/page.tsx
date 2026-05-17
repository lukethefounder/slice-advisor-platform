"use client";

import { FormEvent, useState } from "react";
import {
  Card,
  LinkButton,
  Metric,
  Pill,
  SliceBackground,
  SoftCard,
  TopNav,
} from "@/components/slice-ui";

export default function AdvisorSignupPage() {
  const [firmName, setFirmName] = useState("");
  const [firmEmail, setFirmEmail] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function register(event: FormEvent) {
    event.preventDefault();
    setMessage("");

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
          firmName,
          firmEmail,
          name,
          email,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(
          payload.detail
            ? `${payload.error ?? "Registration failed."} ${payload.detail}`
            : payload.error ?? "Registration failed."
        );
        return;
      }

      setMessage("Advisor account created. Opening workspace...");
      window.location.href = "/workspace";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Registration failed: ${error.message}`
          : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-5">
        <TopNav subtitle="Advisor Account Creation" />

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 xl:grid-cols-[1fr_0.82fr]">
          <div>
            <Pill tone="green">Advisor onboarding</Pill>

            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Create your Slice advisor workspace.
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
              Create a real firm owner account, generate the firm workspace,
              and access Slice&apos;s advisor intelligence system, client email
              center, triage engine, portfolio tools, and AI command layer.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Account" value="Owner" helper="Firm creator" tone="green" />
              <Metric label="Workspace" value="Live" helper="Advisor portal" tone="purple" />
              <Metric label="AI" value="Enabled" helper="Command system" tone="cyan" />
              <Metric label="Delivery" value="Gated" helper="Approval first" tone="amber" />
            </div>

            <Card className="mt-6 p-5">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Important
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                If account creation fails with a database error, your Vercel
                database configuration is the issue. The app needs a production
                database that can persist users, firms, sessions, and client
                records.
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <Pill tone="red">Create advisor account</Pill>

            <h2 className="mt-4 text-3xl font-black text-white">
              Firm owner signup
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-400">
              This creates the advisor user, firm workspace, firm membership,
              starter watchlist, and session.
            </p>

            <form onSubmit={register} className="mt-6 grid gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Firm name
                </label>
                <input
                  value={firmName}
                  onChange={(event) => setFirmName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Example: Royal Wealth Advisors"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Firm email optional
                </label>
                <input
                  value={firmEmail}
                  onChange={(event) => setFirmEmail(event.target.value)}
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="operations@yourfirm.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Advisor name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Advisor email
                </label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="advisor@yourfirm.com"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Password
                  </label>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Confirm password
                  </label>
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>

              <button
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Advisor Workspace"}
              </button>
            </form>

            {message ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
                {message}
              </div>
            ) : null}

            <SoftCard className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Already have an account?
              </div>
              <div className="mt-3">
                <LinkButton href="/founder-login" variant="secondary">
                  Go to Login
                </LinkButton>
              </div>
            </SoftCard>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}