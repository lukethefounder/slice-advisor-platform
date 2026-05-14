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

const ACCOUNTS = {
  founder: {
    label: "Founder",
    email: "founder@slice.local",
    password: "SliceFounder!2026",
    destination: "/founder-portal",
    description:
      "Founder access for executive controls, platform governance, and founder-only workflows.",
  },
  advisor: {
    label: "Firm Advisor",
    email: "advisor@slice.local",
    password: "SliceAdvisor!2026",
    destination: "/workspace",
    description:
      "Firm advisor access for Advisor OS, tasks, client drafts, meeting prep, and workflow automation.",
  },
};

export default function FounderLoginPage() {
  const [preset, setPreset] = useState<AccountPreset>("founder");
  const [email, setEmail] = useState(ACCOUNTS.founder.email);
  const [password, setPassword] = useState(ACCOUNTS.founder.password);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
            "Temporary login preparation failed. Check ENABLE_TEMP_LOGINS and restart the dev server."
        );
        return;
      }

      setMessage(payload.message ?? "Temporary logins are ready.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Temporary login preparation failed: ${error.message}`
          : "Temporary login preparation failed."
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

      const destination =
        preset === "founder" && payload.isFounder
          ? "/founder-portal"
          : "/workspace";

      window.location.href = destination;
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
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-5">
        <TopNav subtitle="Secure Access" />

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 xl:grid-cols-[1fr_0.82fr]">
          <div>
            <Pill tone="red">Temporary access</Pill>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Sign in to the Slice command system.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
              Use the temporary founder or firm advisor credentials while the
              platform is in active build mode. The production version should
              replace this with firm onboarding, MFA, invites, and permanent
              user management.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Founder" value="Admin" helper="Governance" tone="red" />
              <Metric label="Advisor" value="Firm" helper="Workspace" tone="green" />
              <Metric label="Advisor OS" value="AI" helper="Adaptive" tone="purple" />
              <Metric label="Delivery" value="Gated" helper="Approval" tone="amber" />
            </div>
          </div>

          <Card className="p-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => applyPreset("founder")}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  preset === "founder"
                    ? "bg-red-600 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                Founder
              </button>

              <button
                type="button"
                onClick={() => applyPreset("advisor")}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  preset === "advisor"
                    ? "bg-red-600 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                Firm Advisor
              </button>
            </div>

            <SoftCard className="mt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Pill tone={preset === "founder" ? "red" : "green"}>
                    {ACCOUNTS[preset].label}
                  </Pill>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {ACCOUNTS[preset].description}
                  </p>
                </div>
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
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
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
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                  placeholder="Password"
                />
              </div>

              <button
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:scale-[1.01] disabled:opacity-60"
              >
                {loading ? "Signing in..." : `Open ${ACCOUNTS[preset].label}`}
              </button>
            </form>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ActionButton
                onClick={prepareTemporaryLogins}
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                Prepare Temp Logins
              </ActionButton>

              <LinkButton href="/portal" variant="secondary" className="w-full">
                Portal
              </LinkButton>
            </div>

            {message ? (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
                {message}
              </div>
            ) : null}
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}