"use client";

import type { ReactNode } from "react";

export type SliceTone = "red" | "green" | "amber" | "purple" | "slate" | "blue";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function toneFor(value: string | number | null | undefined): SliceTone {
  const normalized = String(value ?? "").toLowerCase();

  if (
    normalized.includes("active") ||
    normalized.includes("approved") ||
    normalized.includes("ready") ||
    normalized.includes("complete") ||
    normalized.includes("stored") ||
    normalized.includes("generated") ||
    normalized.includes("delivered") ||
    normalized.includes("sent") ||
    normalized.includes("live") ||
    normalized.includes("learning")
  ) {
    return "green";
  }

  if (
    normalized.includes("high") ||
    normalized.includes("queued") ||
    normalized.includes("pending") ||
    normalized.includes("review") ||
    normalized.includes("needs") ||
    normalized.includes("routed")
  ) {
    return "amber";
  }

  if (
    normalized.includes("restricted") ||
    normalized.includes("blocked") ||
    normalized.includes("risk") ||
    normalized.includes("paused") ||
    normalized.includes("dismissed") ||
    normalized.includes("correction")
  ) {
    return "red";
  }

  if (
    normalized.includes("phase") ||
    normalized.includes("bot") ||
    normalized.includes("adaptive")
  ) {
    return "purple";
  }

  return "slate";
}

export function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SliceBackground({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-14%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/24 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-purple-700/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[24%] h-[30rem] w-[30rem] rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative">{children}</div>
    </main>
  );
}

export function BrandMark({
  label = "Slice",
  subtitle = "Advisor Intelligence Platform",
}: {
  label?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-600 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          {label}
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-2xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: SliceTone;
}) {
  const tones: Record<SliceTone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    blue: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Progress({
  value,
  tone = "red",
}: {
  value: number;
  tone?: Exclude<SliceTone, "slate">;
}) {
  const fills: Record<Exclude<SliceTone, "slate">, string> = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    blue: "from-sky-700 to-sky-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: percent(value) }}
      />
    </div>
  );
}

export function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: SliceTone;
}) {
  const glow: Record<SliceTone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    blue: "from-sky-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glow[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
          {description}
        </p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "light";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "border border-red-400/30 bg-gradient-to-r from-red-600 via-red-700 to-red-950 text-white shadow-lg shadow-red-950/40 hover:from-red-500 hover:via-red-700 hover:to-red-900"
      : variant === "danger"
        ? "border border-red-500/35 bg-red-500/12 text-red-100 shadow-lg shadow-red-950/20 hover:bg-red-500/20 hover:text-white"
        : variant === "light"
          ? "border border-white/20 bg-white text-slate-950 shadow-lg shadow-red-950/20 hover:bg-red-100 hover:text-slate-950"
          : "border border-white/10 bg-white/[0.055] text-white shadow-lg shadow-black/20 hover:border-red-400/40 hover:bg-red-500/10 hover:text-white";

  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-black leading-none transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500",
        variantClass,
        className
      )}
    >
      <span className="relative z-10 whitespace-nowrap">{children}</span>
    </a>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "light";
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "border border-red-400/30 bg-gradient-to-r from-red-600 via-red-700 to-red-950 text-white shadow-red-950/40 hover:from-red-500 hover:via-red-700 hover:to-red-900"
      : variant === "danger"
        ? "border border-red-500/35 bg-red-500/12 text-red-100 shadow-red-950/20 hover:bg-red-500/20 hover:text-white"
        : variant === "light"
          ? "border border-white/20 bg-white text-slate-950 shadow-red-950/20 hover:bg-red-100 hover:text-slate-950"
          : "border border-white/10 bg-white/[0.055] text-white shadow-black/20 hover:border-red-400/40 hover:bg-red-500/10 hover:text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-black leading-none shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500",
        variantClass,
        className
      )}
    >
      <span className="relative z-10 whitespace-nowrap">{children}</span>
    </button>
  );
}

export function TopNav({
  subtitle = "Advisor Intelligence Platform",
}: {
  subtitle?: string;
}) {
  return (
    <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/72 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <BrandMark subtitle={subtitle} />

        <nav className="flex flex-wrap items-center gap-2">
          <LinkButton href="/" variant="secondary">
            Home
          </LinkButton>
          <LinkButton href="/portal" variant="secondary">
            Portal
          </LinkButton>
          <LinkButton href="/workspace" variant="primary">
            Workspace
          </LinkButton>
          <LinkButton href="/advisor-os" variant="danger">
            Advisor OS
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}