import Link from "next/link";
import type { ReactNode } from "react";

export default function IntelligenceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <div className="sticky top-0 z-40 border-b border-red-500/15 bg-black/88 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-300">
              Slice Intelligence Architecture
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Existing intelligence remains intact. The Forecast Lab adds calibrated multi-horizon simulation and CAMEL-AI orchestration.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2" aria-label="Intelligence sections">
            <Link
              href="/workspace/intelligence"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black text-slate-200 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-white"
            >
              Core Intelligence
            </Link>
            <Link
              href="/workspace/intelligence/forecast-lab"
              className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 transition hover:bg-red-500/20"
            >
              Multi-Agent Forecast Lab
            </Link>
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}
