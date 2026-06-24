"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CLIENT_PORTAL_INVITE_CODE,
  DEFAULT_CLIENT_ALLOCATION,
  DEFAULT_CLIENT_PROFILE,
  DEFAULT_RISK_SURVEY,
  DEMO_CLIENT_SESSION,
  addClientPortalEvent,
  createPortalEvent,
  saveClientPortalProfile,
  saveClientPortalSession,
} from "@/lib/client-portal-demo-store";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children, tone = "red" }: { children: React.ReactNode; tone?: "red" | "cyan" | "purple" | "amber" | "green" }) {
  const tones = {
    red: "border-red-500/30 bg-red-500/10 text-red-200",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };

  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]", tones[tone])}>
      {children}
    </span>
  );
}

export default function ClientSignupPage() {
  const [email, setEmail] = useState(DEMO_CLIENT_SESSION.clientEmail);
  const [inviteCode, setInviteCode] = useState(CLIENT_PORTAL_INVITE_CODE);
  const [advisorName, setAdvisorName] = useState(DEMO_CLIENT_SESSION.advisorName);
  const [firstName, setFirstName] = useState("Claire");
  const [lastName, setLastName] = useState("Morgan");
  const [phone, setPhone] = useState("(555) 010-2026");
  const [preferredContactMethod, setPreferredContactMethod] = useState("Portal + email");
  const [householdName, setHouseholdName] = useState("Morgan Household");
  const [accepted, setAccepted] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setEmail(params.get("email") || DEMO_CLIENT_SESSION.clientEmail);
    setInviteCode(params.get("invite") || CLIENT_PORTAL_INVITE_CODE);
    setAdvisorName(params.get("advisor") || DEMO_CLIENT_SESSION.advisorName);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();

    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      setMessage("Enter name and email to create the client portal.");
      return;
    }

    if (!accepted) {
      setMessage("The client must acknowledge advisor-review-only portal requests.");
      return;
    }

    const clientName = `${firstName.trim()} ${lastName.trim()}`;

    const session = {
      ...DEMO_CLIENT_SESSION,
      clientName,
      clientEmail: email.trim(),
      advisorName,
      inviteCode,
      signupComplete: true,
      riskSurveyComplete: false,
      signedInAt: new Date().toISOString(),
    };

    saveClientPortalSession(session);

    saveClientPortalProfile({
      ...DEFAULT_CLIENT_PROFILE,
      clientId: session.clientId,
      clientName,
      clientEmail: session.clientEmail,
      phone,
      preferredContactMethod,
      advisorName,
      householdName,
      onboardingStep: "Risk Survey",
      riskSurvey: DEFAULT_RISK_SURVEY,
      allocation: DEFAULT_CLIENT_ALLOCATION,
      permissionsAcknowledged: accepted,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    addClientPortalEvent(
      createPortalEvent({
        type: "Platform Access",
        title: "Client signup completed",
        message:
          "Client created portal profile through advisor email invite. Risk survey is now ready to complete inside the portal.",
        urgency: "Normal",
        clientId: session.clientId,
        clientName,
        clientEmail: session.clientEmail,
        advisorId: session.advisorId,
        advisorName,
        source: "Advisor Invite",
        payload: {
          inviteCode,
          preferredContactMethod,
          householdName,
          reviewOnlyAcknowledged: accepted,
        },
      }),
    );

    window.location.href = "/client-portal?onboarding=risk";
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-5 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[430px_1fr] lg:items-start">
        <section className="rounded-[2rem] border border-white/10 bg-black/70 p-6 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-wrap gap-2">
            <Pill tone="green">Step 2</Pill>
            <Pill>Signup</Pill>
          </div>

          <h1 className="mt-5 text-4xl font-black md:text-6xl">Create your client portal.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            This creates the advisor-connected client profile. After signup, the client will be prompted
            to complete risk tolerance and investment preferences inside the portal.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              ["1", "Create portal profile"],
              ["2", "Complete risk tolerance"],
              ["3", "Build preferred allocation pie chart"],
              ["4", "Submit advisor-review requests"],
            ].map(([step, title]) => (
              <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-600 text-sm font-black">{step}</div>
                <div className="font-black">{title}</div>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-[2rem] border border-white/10 bg-zinc-950/82 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
            Advisor invite
          </div>
          <h2 className="mt-2 text-3xl font-black">Client profile</h2>

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">First name</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Last name</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Phone</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Preferred contact</span>
              <select value={preferredContactMethod} onChange={(event) => setPreferredContactMethod(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2">
                <option>Portal + email</option>
                <option>Portal only</option>
                <option>Email</option>
                <option>Phone call</option>
                <option>Text message</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Household name</span>
              <input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Advisor</span>
              <input value={advisorName} onChange={(event) => setAdvisorName(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Invite code</span>
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 focus:ring-2" />
            </label>
          </div>

          <label className="mt-5 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
            <span>
              I understand portal requests are submitted for advisor review and are not automatic
              recommendations, trade instructions, or investment actions.
            </span>
          </label>

          <button className="mt-5 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40">
            Create Portal
          </button>
        </form>
      </div>
    </main>
  );
}