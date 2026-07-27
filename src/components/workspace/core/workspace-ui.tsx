"use client";

import {
  BarChart3,
  BellRing,
  Bot,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleUserRound,
  FileChartColumnIncreasing,
  Gauge,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  WorkspaceIconName,
  WorkspaceTone,
} from "@/lib/workspace-green-core";

const ICONS: Record<WorkspaceIconName, LucideIcon> = {
  board: LayoutDashboard,
  watch: BellRing,
  visuals: BarChart3,
  intel: ChartNoAxesCombined,
  brief: FileChartColumnIncreasing,
  portal: MessageSquareText,
  client: CircleUserRound,
  mail: Mail,
  spark: Bot,
  settings: Settings2,
  shield: ShieldCheck,
  team: UsersRound,
};

export function cx(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

export function toneClasses(tone: WorkspaceTone) {
  const tones: Record<WorkspaceTone, string> = {
    emerald:
      "border-emerald-400/28 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/15",
    lime:
      "border-lime-400/25 bg-lime-500/10 text-lime-100 shadow-lime-950/15",
    teal:
      "border-teal-400/25 bg-teal-500/10 text-teal-100 shadow-teal-950/15",
    cyan:
      "border-cyan-400/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/15",
    sky:
      "border-sky-400/25 bg-sky-500/10 text-sky-100 shadow-sky-950/15",
    violet:
      "border-violet-400/25 bg-violet-500/10 text-violet-100 shadow-violet-950/15",
    amber:
      "border-amber-400/25 bg-amber-500/10 text-amber-100 shadow-amber-950/15",
    slate:
      "border-white/10 bg-white/[0.05] text-slate-200 shadow-black/15",
  };

  return tones[tone];
}

export function dotClasses(tone: WorkspaceTone) {
  const tones: Record<WorkspaceTone, string> = {
    emerald: "bg-emerald-300 shadow-emerald-300/70",
    lime: "bg-lime-300 shadow-lime-300/70",
    teal: "bg-teal-300 shadow-teal-300/70",
    cyan: "bg-cyan-300 shadow-cyan-300/70",
    sky: "bg-sky-300 shadow-sky-300/70",
    violet: "bg-violet-300 shadow-violet-300/70",
    amber: "bg-amber-300 shadow-amber-300/70",
    slate: "bg-slate-300 shadow-slate-300/60",
  };

  return tones[tone];
}

export function WorkspaceIcon({
  name,
  className = "h-4 w-4",
}: {
  name: WorkspaceIconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}

export function GreenSliceLogo({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cx(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-950 via-black to-emerald-600 shadow-xl shadow-emerald-950/45",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
      >
        <div className="absolute inset-1 rounded-[0.9rem] border border-white/10" />
        <div
          className={cx(
            "relative grid place-items-center rounded-full bg-gradient-to-br from-emerald-300 via-emerald-600 to-emerald-950 font-black text-white shadow-lg shadow-emerald-950/60",
            compact ? "h-7 w-7 text-sm" : "h-8 w-8 text-lg",
          )}
        >
          S
        </div>
        <div className="absolute right-2 top-2 h-1.5 w-1.5 rotate-45 bg-lime-300" />
        <div className="absolute bottom-2 left-2 h-1.5 w-1.5 rotate-45 bg-emerald-700" />
      </div>

      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-xl font-black tracking-[-0.04em] text-white">
            Slice
          </p>
          <p className="truncate text-[9px] font-black uppercase tracking-[0.25em] text-emerald-300">
            Advisor Operating System
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.65rem] border border-emerald-200/10 bg-black/55 shadow-2xl shadow-black/35 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function WorkspacePill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: WorkspaceTone;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em]",
        toneClasses(tone),
      )}
    >
      {children}
    </span>
  );
}

export function SectionEyebrow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
      {children}
    </p>
  );
}

export function WorkspaceMetric({
  label,
  value,
  helper,
  tone = "emerald",
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: WorkspaceTone;
  icon?: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.035] p-3">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent opacity-70",
          tone === "emerald"
            ? "from-emerald-500/18"
            : tone === "lime"
              ? "from-lime-500/16"
              : tone === "cyan"
                ? "from-cyan-500/16"
                : tone === "teal"
                  ? "from-teal-500/16"
                  : tone === "sky"
                    ? "from-sky-500/16"
                    : tone === "violet"
                      ? "from-violet-500/16"
                      : tone === "amber"
                        ? "from-amber-500/16"
                        : "from-slate-500/10",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-black text-white">{value}</p>
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
            {helper}
          </p>
        </div>
        {icon ? (
          <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", toneClasses(tone))}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MarketStatePill({
  state,
}: {
  state: string;
}) {
  const normalized = state.toLowerCase();
  const tone: WorkspaceTone =
    normalized.includes("live")
      ? "emerald"
      : normalized.includes("closed") || normalized.includes("delayed")
        ? "amber"
        : normalized.includes("stale") || normalized.includes("demo")
          ? "slate"
          : "cyan";

  return <WorkspacePill tone={tone}>{state}</WorkspacePill>;
}

export function OperatingIcon({
  type,
}: {
  type:
    | "market"
    | "client"
    | "ai"
    | "team"
    | "firm"
    | "risk";
}) {
  const icons: Record<typeof type, LucideIcon> = {
    market: ChartNoAxesCombined,
    client: CircleUserRound,
    ai: Sparkles,
    team: UsersRound,
    firm: BriefcaseBusiness,
    risk: Gauge,
  };
  const Icon = icons[type];

  return <Icon className="h-4 w-4" />;
}