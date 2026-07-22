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

export default function ClientSignupPage() {
  const [context, setContext] = useState<AccessPayload | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState("Portal + email");
  const [householdName, setHouseholdName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/client-portal/access", {
          cache: "no-store",
        });
        const data = (await response.json()) as AccessPayload & { error?: string };

        if (!response.ok) {
          window.location.href = "/client-login";
          return;
        }

        if (!data.advisor) {
          setMessage("An advisor assignment is required before signup.");
          return;
        }

        if (data.client.onboardingComplete) {
          window.location.href = "/client-portal";
          return;
        }

        const parts = data.client.fullName.trim().split(/\s+/);
        setFirstName(parts.shift() || "");
        setLastName(parts.join(" "));
        setPhone(data.client.phone || "");
        setHouseholdName(data.client.householdName || "");
        setPreferredContactMethod(
          data.client.preferredContactMethod || "Portal + email",
        );
        setContext(data);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load secure signup.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!context?.advisor) {
      setMessage("Secure client portal session is required.");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setMessage("Enter the client’s first and last name.");
      return;
    }

    if (!accepted) {
      setMessage("Acknowledge advisor-review-only portal requests.");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const response = await fetch("/api/client-portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "completeProfile",
          fullName,
          phone,
          householdName,
          preferredContactMethod,
        }),
      });
      const data = (await response.json()) as AccessPayload & { error?: string };

      if (!response.ok || !data.advisor) {
        setMessage(data.error || "Unable to complete client signup.");
        return;
      }

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
        signupComplete: true,
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
        onboardingStep: "Risk Survey",
        riskSurvey: preserve ? existing.riskSurvey : DEFAULT_RISK_SURVEY,
        allocation: preserve
          ? existing.allocation
          : DEFAULT_CLIENT_ALLOCATION,
        permissionsAcknowledged: true,
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

      window.location.href = "/client-portal?onboarding=risk";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete client signup.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[430px_1fr] lg:items-start">
        <section className="rounded-[2rem] border border-white/10 bg-black/70 p-6 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            <Pill tone="green">Step 2</Pill>
            <Pill>Secure Signup</Pill>
          </div>

          <h1 className="mt-5 text-4xl font-black md:text-6xl">
            Create your client portal.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Confirm the client profile connected to the firm’s assignment. The advisor is resolved from the account and cannot be replaced from this form.
          </p>

          {context?.advisor ? (
            <div className="mt-6 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
                Assigned advisor
              </div>
              <div className="mt-2 text-lg font-black text-white">
                {context.advisor.name}
              </div>
              <div className="mt-1 text-xs font-semibold text-cyan-100">
                {context.advisor.role} · {context.firm.name}
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            {[
              ["1", "Confirm portal profile"],
              ["2", "Complete risk tolerance"],
              ["3", "Build preferred allocation pie chart"],
              ["4", "Submit assigned-advisor review requests"],
            ].map(([step, title]) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4"
              >
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-600 text-sm font-black">
                  {step}
                </div>
                <div className="font-black">{title}</div>
              </div>
            ))}
          </div>
        </section>

        <form
          onSubmit={submit}
          className="rounded-[2rem] border border-white/10 bg-zinc-950/82 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl"
        >
          <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
            Advisor-linked client profile
          </div>
          <h2 className="mt-2 text-3xl font-black">Client profile</h2>

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}

          {loading && !context ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm font-semibold text-slate-400">
              Loading secure client profile…
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  First name
                </span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Last name
                </span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Email
                </span>
                <input
                  value={context?.client.email || ""}
                  readOnly
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-400 outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Phone
                </span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Preferred contact
                </span>
                <select
                  value={preferredContactMethod}
                  onChange={(event) =>
                    setPreferredContactMethod(event.target.value)
                  }
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option>Portal + email</option>
                  <option>Portal only</option>
                  <option>Email</option>
                  <option>Phone call</option>
                  <option>Text message</option>
                </select>
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Household name
                </span>
                <input
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2"
                />
              </label>
            </div>
          )}

          <label className="mt-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 accent-red-600"
            />
            <span>
              I understand portal requests are submitted to my assigned advisor for review and are not automatic recommendations, trade instructions, or investment actions.
            </span>
          </label>

          <button
            disabled={loading || !context}
            className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
          >
            {loading ? "Saving Secure Profile…" : "Create Portal"}
          </button>
        </form>
      </div>
    </main>
  );
}