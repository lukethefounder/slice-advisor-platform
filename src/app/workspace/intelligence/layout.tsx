"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import type {
  ReactNode,
} from "react";

type IntelligenceLayoutProps = {
  children:
    ReactNode;
};

const NAVIGATION_ITEMS = [
  {
    href:
      "/workspace/intelligence",

    label:
      "Core Intelligence",

    exact:
      true,
  },
  {
    href:
      "/workspace/intelligence/advisor-bot",

    label:
      "Slice Advisor",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/forecast-lab",

    label:
      "Forecast Lab",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/horizon-models",

    label:
      "Horizon Models",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/agent-simulation",

    label:
      "Agent Simulation",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/ensemble-lab",

    label:
      "Ensemble Lab",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/forecast-history",

    label:
      "History & Accuracy",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/model-governance",

    label:
      "Model Governance",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/data-warehouse",

    label:
      "Evidence Warehouse",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/knowledge-graph",

    label:
      "Knowledge Graph",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/production-controls",

    label:
      "Production Controls",

    exact:
      false,
  },
  {
    href:
      "/workspace/intelligence/launch-readiness",

    label:
      "Launch Readiness",

    exact:
      false,
  },
] as const;

function isActiveRoute(
  pathname: string,
  href: string,
  exact: boolean,
) {
  if (exact) {
    return (
      pathname ===
      href
    );
  }

  return (
    pathname ===
      href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}

function navigationClass(
  active: boolean,
) {
  if (active) {
    return [
      "rounded-xl",
      "border",
      "border-red-400/30",
      "bg-red-500/15",
      "px-4",
      "py-2",
      "text-xs",
      "font-black",
      "text-red-100",
      "shadow-lg",
      "shadow-red-950/20",
      "transition",
      "hover:border-red-300/40",
      "hover:bg-red-500/25",
    ].join(
      " ",
    );
  }

  return [
    "rounded-xl",
    "border",
    "border-white/10",
    "bg-white/[0.04]",
    "px-4",
    "py-2",
    "text-xs",
    "font-black",
    "text-slate-300",
    "transition",
    "hover:border-red-400/35",
    "hover:bg-red-500/10",
    "hover:text-white",
  ].join(
    " ",
  );
}

export default function IntelligenceLayout(
  {
    children,
  }: IntelligenceLayoutProps,
) {
  const pathname =
    usePathname();

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <header className="sticky top-0 z-40 border-b border-red-500/15 bg-black/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-300">
              Slice Intelligence Architecture
            </p>

            <p className="mt-1 max-w-5xl text-xs leading-5 text-slate-400">
              Personalized decision support, calibrated ensembles,
              simulations, outcomes, evidence, provenance, security,
              recovery, and human-controlled launch governance.
            </p>
          </div>

          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Slice intelligence sections"
          >
            {NAVIGATION_ITEMS.map(
              (item) => {
                const active =
                  isActiveRoute(
                    pathname,
                    item.href,
                    item.exact,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={navigationClass(
                      active,
                    )}
                  >
                    {item.label}
                  </Link>
                );
              },
            )}
          </nav>
        </div>
      </header>

      <div className="min-h-[calc(100vh-73px)]">
        {children}
      </div>
    </div>
  );
}