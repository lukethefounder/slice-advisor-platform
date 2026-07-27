"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const TeamBoardEmbedded = dynamic(
  () => import("@/components/workspace/team-board-embedded"),
  {
    ssr: false,
    loading: () => <TeamBoardLoading />,
  }
);

function TeamBoardLoading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-white md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_9%_0%,rgba(6,95,70,0.46),transparent_30%),radial-gradient(circle_at_84%_8%,rgba(16,185,129,0.13),transparent_25%),linear-gradient(145deg,#030303,#09090b_48%,#111827)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1900px] place-items-center">
        <div className="rounded-[2rem] border border-white/10 bg-black/70 px-8 py-10 text-center shadow-2xl shadow-emerald-950/25 backdrop-blur-xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>

          <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
            Slice Team Board OS
          </div>

          <h1 className="mt-3 text-2xl font-black text-white">
            Loading your team workspace
          </h1>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Synchronizing assignments, priorities, reminders, and advisor
            documents.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function TeamBoardPage() {
  return <TeamBoardEmbedded />;
}