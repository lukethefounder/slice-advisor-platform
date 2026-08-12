"use client";

import type { ReactNode } from "react";

export type SliceTone =
  | "red"
  | "green"
  | "amber"
  | "purple"
  | "slate"
  | "blue"
  | "cyan";

export function cx(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

export function toneFor(
  value: string | number | null | undefined,
): SliceTone {
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
    normalized.includes("failed") ||
    normalized.includes("rejected") ||
    normalized.includes("blocked") ||
    normalized.includes("cancelled") ||
    normalized.includes("error")
  ) {
    return "red";
  }

  if (
    normalized.includes("high") ||
    normalized.includes("queued") ||
    normalized.includes("pending") ||
    normalized.includes("review") ||
    normalized.includes("needs") ||
    normalized.includes("risk")
  ) {
    return "amber";
  }

  if (
    normalized.includes("phase") ||
    normalized.includes("bot") ||
    normalized.includes("adaptive")
  ) {
    return "purple";
  }

  if (
    normalized.includes("ai") ||
    normalized.includes("command") ||
    normalized.includes("intelligence") ||
    normalized.includes("automation") ||
    normalized.includes("system")
  ) {
    return "cyan";
  }

  return "slate";
}

export function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : value;
}

function toneClasses(tone: SliceTone) {
  const values: Record<SliceTone, string> = {
    red:
      "border-[var(--slice-rose-border)] bg-[var(--slice-rose-bg)] text-[var(--slice-rose-text)]",
    green:
      "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]",
    amber:
      "border-[var(--slice-amber-border)] bg-[var(--slice-amber-bg)] text-[var(--slice-amber-text)]",
    purple:
      "border-[var(--slice-violet-border)] bg-[var(--slice-violet-bg)] text-[var(--slice-violet-text)]",
    blue:
      "border-[var(--slice-cyan-border)] bg-[var(--slice-cyan-bg)] text-[var(--slice-cyan-text)]",
    cyan:
      "border-[var(--slice-cyan-border)] bg-[var(--slice-cyan-bg)] text-[var(--slice-cyan-text)]",
    slate:
      "border-[var(--slice-slate-border)] bg-[var(--slice-slate-bg)] text-[var(--slice-slate-text)]",
  };

  return values[tone];
}

export function SliceBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--slice-bg)] text-[var(--slice-text)]">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-52 h-[34rem] w-[34rem] rounded-full bg-[var(--slice-accent-soft)] blur-3xl" />
        <div className="absolute -right-36 top-10 h-[32rem] w-[32rem] rounded-full bg-cyan-400/[0.055] blur-3xl" />
        <div className="absolute bottom-[-19rem] left-[30%] h-[31rem] w-[31rem] rounded-full bg-emerald-300/[0.09] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(color-mix(in_srgb,var(--slice-accent)_3%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--slice-accent)_3%,transparent)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]" />
      </div>
      <div className="relative">{children}</div>
    </div>
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
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--slice-accent-border)] bg-white shadow-[0_12px_30px_var(--slice-shadow)]">
        <div className="absolute inset-1 rounded-[0.95rem] bg-[linear-gradient(145deg,#effcf5,#ffffff_52%,#ddf6e8)]" />
        <div className="relative grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(145deg,#54d49d,#16a36f_58%,#07533c)] text-lg font-black text-white shadow-md">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-lime-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-[-0.045em] text-[var(--slice-heading)]">
          {label}
        </div>
        <div className="truncate text-[9px] font-black uppercase tracking-[0.24em] text-[var(--slice-accent-strong)]">
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
        "relative overflow-hidden rounded-[1.75rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] text-[var(--slice-text)] shadow-[0_22px_70px_var(--slice-shadow)] backdrop-blur-xl",
        className,
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
        "rounded-[1.35rem] border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4 text-[var(--slice-text)]",
        className,
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
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClasses(tone),
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Progress({
  value,
  tone = "green",
}: {
  value: number;
  tone?: Exclude<SliceTone, "slate">;
}) {
  const fills: Record<Exclude<SliceTone, "slate">, string> = {
    red: "from-rose-600 to-rose-300",
    green: "from-emerald-700 via-emerald-500 to-cyan-400",
    amber: "from-amber-700 to-amber-300",
    purple: "from-violet-700 to-violet-300",
    blue: "from-sky-700 to-sky-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--slice-slate-bg)]">
      <div
        className={cx(
          "h-full rounded-full bg-gradient-to-r transition-[width] duration-500",
          fills[tone],
        )}
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
  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent",
          tone === "green"
            ? "from-emerald-400/[0.12]"
            : tone === "cyan" || tone === "blue"
              ? "from-cyan-400/[0.10]"
              : tone === "amber"
                ? "from-amber-400/[0.10]"
                : tone === "purple"
                  ? "from-violet-400/[0.10]"
                  : tone === "red"
                    ? "from-rose-400/[0.10]"
                    : "from-slate-400/[0.07]",
        )}
      />
      <div className="relative">
        <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-subtle)]">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-[var(--slice-heading)]">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-[var(--slice-muted)]">
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
        <div className="text-xs font-black uppercase tracking-[0.22em] text-[var(--slice-accent-strong)]">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)] md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function actionVariant(variant: "primary" | "secondary" | "danger" | "light") {
  if (variant === "primary") {
    return "border-[var(--slice-accent-border)] bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] text-white shadow-[0_12px_30px_var(--slice-accent-glow)] hover:brightness-105";
  }

  if (variant === "danger") {
    return "border-[var(--slice-rose-border)] bg-[var(--slice-rose-bg)] text-[var(--slice-rose-text)] hover:brightness-98";
  }

  if (variant === "light") {
    return "border-[var(--slice-border)] bg-white text-[var(--slice-heading)] shadow-[0_10px_25px_var(--slice-shadow)] hover:bg-emerald-50";
  }

  return "border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-text)] shadow-[0_8px_22px_var(--slice-shadow)] hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]";
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
  return (
    <a
      href={href}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-black transition focus-visible:ring-2 focus-visible:ring-[var(--slice-accent-border)]",
        actionVariant(variant),
        className,
      )}
    >
      {children}
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-black transition focus-visible:ring-2 focus-visible:ring-[var(--slice-accent-border)] disabled:cursor-not-allowed disabled:opacity-50",
        actionVariant(variant),
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TopNav({
  subtitle = "Advisor Intelligence Platform",
}: {
  subtitle?: string;
}) {
  return (
    <header className="sticky top-4 z-40 rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] p-4 shadow-[0_18px_55px_var(--slice-shadow)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <BrandMark subtitle={subtitle} />
        <nav className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <LinkButton href="/" className="w-full sm:w-auto">
            Home
          </LinkButton>
          <LinkButton href="/founder-login" className="w-full sm:w-auto">
            Login
          </LinkButton>
          <LinkButton href="/advisor-signup" variant="primary" className="w-full sm:w-auto">
            Sign Up
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}