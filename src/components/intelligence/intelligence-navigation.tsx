"use client";

import Link from "next/link";
import {
  Bot,
  BrainCircuit,
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

import { cx } from "@/components/intelligence/intelligence-ui";

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

export default function IntelligenceNavigation() {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 z-30 border-b border-[var(--slice-border)] bg-[color-mix(in_srgb,var(--slice-surface-strong)_93%,transparent)] shadow-[0_8px_28px_var(--slice-shadow)] backdrop-blur-xl">
      <div className="mx-auto max-w-[1740px] px-4 py-3 sm:px-5 lg:px-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-[var(--slice-heading)]">
              Slice Intelligence
            </p>
            <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-accent-strong)]">
              Evidence first · deep work on demand
            </p>
          </div>
          <span className="hidden rounded-full border border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-green-text)] sm:inline-flex">
            Equal thirds preserved
          </span>
        </div>

        <nav
          className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition",
                  active
                    ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)] shadow-sm"
                    : "border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}