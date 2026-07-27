"use client";

import Link from "next/link";
import {
  Activity,
  Bot,
  BrainCircuit,
  ChevronLeft,
  Database,
  FlaskConical,
  Gauge,
  History,
  Network,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAVIGATION = [
  {
    href: "/workspace/intelligence",
    label: "Control Plane",
    icon: BrainCircuit,
    exact: true,
  },
  {
    href: "/workspace/intelligence/agent-simulation",
    label: "Research Swarm",
    icon: Bot,
  },
  {
    href: "/workspace/intelligence/knowledge-graph",
    label: "Knowledge Graph",
    icon: Network,
  },
  {
    href: "/workspace/intelligence/forecast-lab",
    label: "Forecast Lab",
    icon: Target,
  },
  {
    href: "/workspace/intelligence/advisor-bot",
    label: "Slice Advisor",
    icon: Sparkles,
  },
  {
    href: "/workspace/intelligence/horizon-models",
    label: "Horizon Models",
    icon: Radar,
  },
  {
    href: "/workspace/intelligence/ensemble-lab",
    label: "Ensemble Lab",
    icon: FlaskConical,
  },
  {
    href: "/workspace/intelligence/forecast-history",
    label: "History & Accuracy",
    icon: History,
  },
  {
    href: "/workspace/intelligence/model-governance",
    label: "Governance",
    icon: SlidersHorizontal,
  },
  {
    href: "/workspace/intelligence/data-warehouse",
    label: "Evidence Warehouse",
    icon: Database,
  },
  {
    href: "/workspace/intelligence/production-controls",
    label: "Production Controls",
    icon: Gauge,
  },
  {
    href: "/workspace/intelligence/launch-readiness",
    label: "Launch Readiness",
    icon: ShieldCheck,
  },
] as const;

function isActive(pathname: string, href: string, exact = false) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function IntelligenceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <header className="sticky top-0 z-50 border-b border-emerald-500/15 bg-black/92 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1950px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/workspace"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-black text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Workspace</span>
          </Link>

          <div className="hidden min-w-0 shrink-0 items-center gap-2 lg:flex">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black leading-none text-white">
                Slice Intelligence
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Real-Time Research Swarm
              </p>
            </div>
          </div>

          <nav
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Intelligence sections"
          >
            {NAVIGATION.map((item) => {
              const active = isActive(
                pathname,
                item.href,
                "exact" in item ? item.exact : false,
              );
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5 text-xs font-black text-emerald-100 shadow-lg shadow-emerald-950/20"
                      : "inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-xs font-black text-slate-400 transition hover:border-emerald-400/25 hover:bg-emerald-500/[0.07] hover:text-white"
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/[0.04] bg-black/40 px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1950px] items-center justify-between gap-4 text-[10px] font-bold text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-300" />
              Equal thirds: media research · technical research · industry economy research
            </span>
            <span className="hidden md:inline">
              Up to 2,000 independent pathways · shared evidence pool · no autonomous trading
            </span>
          </div>
        </div>
      </header>

      <div className="min-h-[calc(100vh-104px)]">{children}</div>
    </div>
  );
}