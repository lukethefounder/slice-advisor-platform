"use client";

import { FormEvent, useState } from "react";

type Mode = "login" | "bootstrap";

const TEMP_EMAIL = "founder@slice.local";
const TEMP_PASSWORD = "SliceFounder!2026";

export default function FounderLoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(TEMP_EMAIL);
  const [password, setPassword] = useState(TEMP_PASSWORD);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Founder login failed.");
        return;
      }

      window.location.href = "/founder-portal";
    } finally {
      setLoading(false);
    }
  }

  async function bootstrapFounder() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/founder-bootstrap", {
        method: "POST",
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Founder bootstrap failed.");
        return;
      }

      setEmail(TEMP_EMAIL);
      setPassword(TEMP_PASSWORD);
      setMessage(
        "Temporary founder account created/reset and logged in. Opening founder portal..."
      );

      window.location.href = "/founder-portal";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <div className="inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300 ring-1 ring-red-500/30">
            Founder access
          </div>

          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            Founder portal sign in.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
            Use the same temporary founder credentials. This route exists so the
            founder portal is easy to reach without creating another firm
            workspace.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Founder email
              </div>
              <div className="mt-2 text-lg font-black">{TEMP_EMAIL}</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Password
              </div>
              <div className="mt-2 text-lg font-black">{TEMP_PASSWORD}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-2xl px-4 py-3 text-sm font-black ${
                mode === "login"
                  ? "bg-red-600 text-white"
                  : "bg-white/5 text-slate-400"
              }`}
            >
              Founder Login
            </button>

            <button
              type="button"
              onClick={() => setMode("bootstrap")}
              className={`rounded-2xl px-4 py-3 text-sm font-black ${
                mode === "bootstrap"
                  ? "bg-red-600 text-white"
                  : "bg-white/5 text-slate-400"
              }`}
            >
              Reset Local Founder
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={login} className="mt-6 space-y-4">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Founder email"
              />

              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2"
                placeholder="Founder password"
              />

              <button
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                {loading ? "Signing In..." : "Open Founder Portal"}
              </button>
            </form>
          ) : null}

          {mode === "bootstrap" ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                This creates or resets the temporary founder login locally and
                logs you in. It does not create a new firm workspace.
              </div>

              <button
                onClick={bootstrapFounder}
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                {loading ? "Resetting..." : "Create / Reset Founder Login"}
              </button>
            </div>
          ) : null}

          {message ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <a
              href="/founder-portal"
              className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
            >
              Founder Portal
            </a>

            <a
              href="/workspace"
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
            >
              Workspace
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}