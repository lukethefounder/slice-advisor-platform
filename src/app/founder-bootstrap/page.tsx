"use client";

import { useState } from "react";

type BootstrapResult = {
  message?: string;
  credentials?: {
    email: string;
    password: string;
  };
  error?: string;
  detail?: string;
};

export default function FounderBootstrapPage() {
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function bootstrapFounder() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/founder-bootstrap", {
        method: "POST",
      });

      const payload = await response.json();
      setResult(payload);
    } catch {
      setResult({
        error: "Unable to bootstrap founder account.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-black text-red-300 ring-1 ring-red-500/30">
            Local founder bootstrap
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-tight">
            Create/reset the temporary founder login.
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            This is for local development only. It creates or resets the founder
            account and logs you in without creating another normal firm
            workspace.
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Temporary credentials
            </div>

            <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
              <div>Email: founder@slice.local</div>
              <div>Password: SliceFounder!2026</div>
            </div>
          </div>

          <button
            onClick={bootstrapFounder}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
          >
            {loading ? "Creating Founder Login..." : "Create / Reset Founder Login"}
          </button>

          {result ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/35 p-4">
              {result.error ? (
                <>
                  <div className="font-black text-red-300">{result.error}</div>
                  {result.detail ? (
                    <div className="mt-2 text-sm text-slate-400">
                      {result.detail}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="font-black text-emerald-300">
                    {result.message}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <a
                      href="/founder-portal"
                      className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950"
                    >
                      Open Founder Portal
                    </a>

                    <a
                      href="/workspace"
                      className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
                    >
                      Open Workspace
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}