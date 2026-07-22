"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_CLIENT_ALLOCATION,
  DEFAULT_CLIENT_PROFILE,
  DEFAULT_RISK_SURVEY,
  loadClientPortalProfile,
  saveClientPortalProfile,
  saveClientPortalSession,
} from "@/lib/client-portal-demo-store";

type AccessPayload = {
  ok: boolean;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    householdName: string;
    preferredContactMethod: string;
    onboardingStatus: string;
    onboardingComplete: boolean;
  };
  advisor: {
    membershipId: string;
    name: string;
    email: string;
    role: string;
    calendlyUrl: string | null;
    calendlyLabel: string;
  } | null;
  firm: {
    id: string;
    name: string;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "cyan" | "purple" | "amber" | "green";
}) {
  const tones = {
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function saveLocalPortalContext(data: AccessPayload) {
  if (!data.advisor) return;

  const now = new Date().toISOString();
  saveClientPortalSession({
    clientId: data.client.id,
    clientName: data.client.fullName,
    clientEmail: data.client.email,
    advisorId: data.advisor.membershipId,
    advisorName: data.advisor.name,
    firmId: data.firm.id,
    firmName: data.firm.name,
    inviteCode: "SECURE-SERVER-SESSION",
    signupComplete: data.client.onboardingComplete,
    riskSurveyComplete: false,
    signedInAt: now,
  });

  const existing = loadClientPortalProfile();
  const preserve = existing.clientId === data.client.id;

  saveClientPortalProfile({
    ...(preserve ? existing : DEFAULT_CLIENT_PROFILE),
    clientId: data.client.id,
    clientName: data.client.fullName,
    clientEmail: data.client.email,
    phone: data.client.phone || "",
    preferredContactMethod:
      data.client.preferredContactMethod || "Portal + email",
    advisorId: data.advisor.membershipId,
    advisorName: data.advisor.name,
    firmId: data.firm.id,
    firmName: data.firm.name,
    householdName: data.client.householdName || "",
    onboardingStep: data.client.onboardingComplete ? "Portal Ready" : "Signup",
    riskSurvey: preserve ? existing.riskSurvey : DEFAULT_RISK_SURVEY,
    allocation: preserve ? existing.allocation : DEFAULT_CLIENT_ALLOCATION,
    permissionsAcknowledged: preserve
      ? existing.permissionsAcknowledged
      : false,
    advisorAccessStatus: "Active",
    advisorAccessNote:
      "Portal submissions route only to the advisor currently assigned by the firm.",
    createdAt: preserve ? existing.createdAt : now,
    updatedAt: now,
  });

  const savedProfile = loadClientPortalProfile();
  const syncKey = `slice-client-portal-server-sync-v1:${data.client.id}`;
  let synced: string[] = [];
  try {
    synced = JSON.parse(window.localStorage.getItem(syncKey) || "[]");
  } catch {
    synced = [];
  }
  const profileKey = `profile:${savedProfile.clientId}:${savedProfile.updatedAt}`;
  window.localStorage.setItem(
    syncKey,
    JSON.stringify(Array.from(new Set([...synced, profileKey])).slice(-1000)),
  );
}

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setInviteCode(params.get("code") || params.get("invite") || "");

    if (params.has("code") || params.has("invite") || params.has("email")) {
      window.history.replaceState({}, "", "/client-login");
    }
  }, []);

  async function continueToPortal(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !inviteCode.trim()) {
      setMessage("Enter the client email and secure advisor invite code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/client-portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: email.trim(),
          inviteCode: inviteCode.trim(),
        }),
      });
      const data = (await response.json()) as AccessPayload & { error?: string };

      if (!response.ok) {
        setMessage(data.error || "Unable to open the client portal.");
        return;
      }

      if (!data.advisor) {
        setMessage("This client must be assigned to an advisor before portal access.");
        return;
      }

      saveLocalPortalContext(data);
      window.location.href = data.client.onboardingComplete
        ? "/client-portal"
        : "/client-signup";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open the client portal.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-black/70 p-6 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="absolute right-[-140px] top-[-180px] h-[420px] w-[420px] rounded-full border border-red-500/10">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative">
            <div className="flex flex-wrap gap-2">
              <Pill>Client Portal</Pill>
              <Pill tone="cyan">Secure Invite</Pill>
              <Pill tone="purple">Assigned Advisor</Pill>
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight md:text-7xl">
              A better way for hands-on clients to work with their advisor.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
              Clients enter through the secure link created from their profile. Messages, meeting requests, documents, and profile changes route only to the advisor assigned by firm leadership.
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {[
                ["Secure access", "Email plus a time-limited invite code creates an HTTP-only portal session."],
                ["Advisor isolation", "Only the assigned advisor receives the client’s new portal inbox activity."],
                ["Automatic reassignment", "Changing the advisor updates future routing and unresolved portal items."],
                ["Personal scheduling", "The client sees the Calendly link saved by their assigned advisor."],
                ["Advisor review", "Every request routes to advisor review instead of automatic execution."],
                ["Document intake", "Client document and profile events are recorded for advisor follow-up."],
              ].map(([title, detail]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4"
                >
                  <div className="font-black text-white">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <form
          onSubmit={continueToPortal}
          className="rounded-[2.25rem] border border-white/10 bg-zinc-950/82 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl"
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone="green">Secure Access</Pill>
            <Pill tone="cyan">Advisor Invite</Pill>
          </div>

          <h2 className="mt-4 text-4xl font-black">Client access</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Use the email and secure code from the client portal link created by the lead advisor or account owner.
          </p>

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Client email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@email.com"
                autoComplete="email"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Secure invite code
              </span>
              <input
                type="password"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                autoComplete="one-time-code"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />
            </label>
          </div>

          <button
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
          >
            {loading ? "Opening Secure Portal…" : "Continue to Client Portal"}
          </button>

          <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
            The advisor field is not client-editable. Slice resolves it from the assignment saved in the firm account.
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs leading-6 text-amber-50">
            Client portal submissions are routed for advisor review. Buy and sell requests are not automatic orders or recommendations.
          </div>
        </form>
      </div>
    </main>
  );
}