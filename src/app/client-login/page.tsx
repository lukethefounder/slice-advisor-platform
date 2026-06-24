"use client";

import { FormEvent, useEffect, useState } from "react";
import { CLIENT_PORTAL_INVITE_CODE, DEMO_CLIENT_SESSION } from "@/lib/client-portal-demo-store";

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

export default function ClientLoginPage() {
  const [email, setEmail] = useState(DEMO_CLIENT_SESSION.clientEmail);
  const [inviteCode, setInviteCode] = useState(CLIENT_PORTAL_INVITE_CODE);
  const [advisorName, setAdvisorName] = useState(DEMO_CLIENT_SESSION.advisorName);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const advisor = params.get("advisor");
    const emailParam = params.get("email");

    if (invite) setInviteCode(invite);
    if (advisor) setAdvisorName(advisor);
    if (emailParam) setEmail(emailParam);
  }, []);

  function continueToSignup(event: FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      setMessage("Enter the client email first.");
      return;
    }

    const params = new URLSearchParams({
      email: email.trim(),
      invite: inviteCode.trim() || CLIENT_PORTAL_INVITE_CODE,
      advisor: advisorName.trim() || DEMO_CLIENT_SESSION.advisorName,
    });

    window.location.href = `/client-signup?${params.toString()}`;
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
              <Pill tone="cyan">Email Invite</Pill>
              <Pill tone="purple">Advisor Connected</Pill>
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight md:text-7xl">
              A better way for hands-on clients to work with their advisor.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
              Clients start with their email invite, create their portal profile, then complete
              risk tolerance and preference questions inside the portal. They can request meetings,
              send messages, submit documents, update permissions, and build a preferred allocation
              pie chart for advisor review.
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {[
                ["Simple login", "Email invite first. No confusing password-heavy demo flow."],
                ["Separate signup", "Signup creates the advisor-linked client portal relationship."],
                ["Risk after signup", "Risk questions happen after account creation and can change anytime."],
                ["Portfolio pie chart", "Clients can express desired allocation by investment type."],
                ["Advisor review", "Every request routes to advisor review instead of automatic execution."],
                ["Document intake", "Clients can submit document metadata for advisor follow-up."],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <form
          onSubmit={continueToSignup}
          className="rounded-[2.25rem] border border-white/10 bg-zinc-950/82 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl"
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone="green">Step 1</Pill>
            <Pill tone="cyan">Email Access</Pill>
          </div>

          <h2 className="mt-4 text-4xl font-black">Client access</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Enter the email connected to the advisor invite. In production, this sends a secure
            email link. In this demo, it takes the client directly to signup.
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@email.com"
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Advisor invite code
              </span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Advisor
              </span>
              <input
                value={advisorName}
                onChange={(event) => setAdvisorName(event.target.value)}
                className="rounded-2xl border border-white/10 bg-black/45 px-4 py-4 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />
            </label>
          </div>

          <button className="mt-6 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40">
            Continue to Signup
          </button>

          <div className="mt-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
            Demo email: <span className="font-black">claire@demo-client.com</span>
            <br />
            Demo invite: <span className="font-black">{CLIENT_PORTAL_INVITE_CODE}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs leading-6 text-amber-50">
            Client portal submissions are routed for advisor review. Buy/sell requests are not
            automatic orders or recommendations.
          </div>
        </form>
      </div>
    </main>
  );
}