"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type InviteProfile = {
  id: string;
  inviteCode: string;
  firmName: string;
  email: string;
  role: string;
  fullName: string;
  title: string;
  phone: string;
  bio: string;
  createdAt: string;
  status: "Created";
};

const PROFILE_KEY = "slice-team-member-profiles-v1";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function loadProfiles() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InviteProfile[]) : [];
  } catch {
    return [];
  }
}

export default function TeamInvitePage() {
  const [inviteCode, setInviteCode] = useState("");
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Lead Advisor");

  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setInviteCode(params.get("code") ?? "");
    setFirmName(params.get("firm") ?? "");
    setEmail(params.get("email") ?? "");
    setRole(params.get("role") ?? "Lead Advisor");
  }, []);

  const isReady = useMemo(() => {
    return Boolean(inviteCode && firmName && email && fullName.trim() && title.trim() && password.length >= 8);
  }, [email, firmName, fullName, inviteCode, password, title]);

  function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteCode || !firmName || !email) {
      setError("This invite link is missing required firm information.");
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter your title.");
      return;
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }

    const profile: InviteProfile = {
      id: `team-profile-${Date.now()}`,
      inviteCode,
      firmName,
      email,
      role,
      fullName: fullName.trim(),
      title: title.trim(),
      phone: phone.trim(),
      bio: bio.trim(),
      createdAt: nowLabel(),
      status: "Created",
    };

    const next = [
      profile,
      ...loadProfiles().filter((item) => item.inviteCode !== inviteCode && item.email !== email),
    ];

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));

    setError("");
    setPassword("");
    setCreated(true);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050202] px-4 py-6 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-18%] top-[-18%] h-[38rem] w-[38rem] rounded-full bg-red-700/30 blur-3xl" />
        <div className="absolute right-[-16%] top-[10%] h-[34rem] w-[34rem] rounded-full bg-orange-600/12 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-red-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl place-items-center">
        <div className="grid w-full gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/84 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="inline-flex rounded-full border border-red-500/35 bg-red-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100">
              Slice Team Invite
            </div>

            <h1 className="mt-4 text-4xl font-black leading-tight">
              Create your advisor account.
            </h1>

            <p className="mt-3 text-sm font-semibold leading-7 text-slate-400">
              This invite is linked directly to your firm. Create your profile to join the workspace.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Firm
                </div>
                <div className="mt-1 text-lg font-black">{firmName || "Missing firm"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Invited Email
                </div>
                <div className="mt-1 truncate text-lg font-black">{email || "Missing email"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Role
                </div>
                <div className="mt-1 text-lg font-black">{role}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Invite Code
                </div>
                <div className="mt-1 text-lg font-black">{inviteCode || "Missing code"}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-zinc-950/84 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
            {created ? (
              <div className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-3xl font-black text-emerald-100">
                    ✓
                  </div>

                  <h2 className="mt-6 text-3xl font-black">Profile created.</h2>

                  <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-400">
                    Your advisor profile has been created for {firmName}. You can continue into the team workspace.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link
                      href={`/workspace/team-board?firm=${encodeURIComponent(firmName)}&profile=created`}
                      className="rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-5 py-3 text-sm font-black text-emerald-100"
                    >
                      Continue to Team Board
                    </Link>

                    <Link
                      href="/workspace"
                      className="rounded-2xl border border-red-500/35 bg-red-500/12 px-5 py-3 text-sm font-black text-red-100"
                    >
                      Open Workspace
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={createProfile} className="grid gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                    Advisor Profile
                  </div>
                  <h2 className="mt-2 text-3xl font-black">Finish account setup</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                    Your password is validated here for setup flow only and is not stored in browser storage.
                  </p>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-500/35 bg-red-500/12 p-4 text-sm font-bold text-red-100">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Full name"
                    className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500"
                  />

                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Title, e.g. Lead Advisor"
                    className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500"
                  />

                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500"
                  />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone"
                    className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create password"
                    className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500 md:col-span-2"
                  />

                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Short advisor bio or specialties"
                    rows={5}
                    className="resize-none rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-red-500 md:col-span-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isReady}
                  className={cx(
                    "rounded-2xl border px-5 py-4 text-sm font-black transition",
                    isReady
                      ? "border-red-400/40 bg-gradient-to-r from-red-500 via-red-700 to-red-950 text-white shadow-xl shadow-red-950/40 hover:-translate-y-0.5"
                      : "border-white/10 bg-white/[0.045] text-slate-500",
                  )}
                >
                  Create Account + Profile
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}