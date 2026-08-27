import type { ReactNode } from "react";

export type IntelligenceTone =
  | "emerald"
  | "cyan"
  | "violet"
  | "amber"
  | "rose"
  | "slate";

export function cx(
  ...values: Array<string | false | null | undefined>
) {
  return values.filter(Boolean).join(" ");
}

const TONE_CLASSES: Record<IntelligenceTone, string> = {
  emerald:
    "border-emerald-600/20 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100",
  cyan:
    "border-cyan-600/20 bg-cyan-50 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-500/10 dark:text-cyan-100",
  violet:
    "border-violet-600/20 bg-violet-50 text-violet-800 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-100",
  amber:
    "border-amber-600/20 bg-amber-50 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
  rose:
    "border-rose-600/20 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-100",
  slate:
    "border-[var(--slice-border)] bg-[var(--slice-surface-muted)] text-[var(--slice-muted)]",
};

export function IntelligencePage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cx(
        "relative mx-auto min-h-[calc(100dvh-8rem)] w-full max-w-[1740px] px-4 py-5 sm:px-5 lg:px-6 lg:py-7",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function IntelligenceSurface({
  children,
  className = "",
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "aside" | "div";
}) {
  const Component = as;

  return (
    <Component
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.55rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] text-[var(--slice-text)] shadow-[0_18px_55px_var(--slice-shadow)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function IntelligencePill({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: IntelligenceTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function IntelligenceMetric({
  label,
  value,
  helper,
  icon,
  tone = "emerald",
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon?: ReactNode;
  tone?: IntelligenceTone;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4 shadow-sm">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          tone === "emerald"
            ? "from-emerald-400/[0.09]"
            : tone === "cyan"
              ? "from-cyan-400/[0.08]"
              : tone === "violet"
                ? "from-violet-400/[0.08]"
                : tone === "amber"
                  ? "from-amber-400/[0.08]"
                  : tone === "rose"
                    ? "from-rose-400/[0.08]"
                    : "from-slate-400/[0.06]",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[var(--slice-subtle)]">
            {label}
          </p>
          <div className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            {value}
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-[var(--slice-muted)]">
            {helper}
          </p>
        </div>
        {icon ? (
          <span
            className={cx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
              TONE_CLASSES[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function IntelligenceNotice({
  children,
  tone = "slate",
  icon,
  className = "",
}: {
  children: ReactNode;
  tone?: IntelligenceTone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6",
        TONE_CLASSES[tone],
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function IntelligenceSectionHeading({
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
      <div className="max-w-4xl">
        <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[var(--slice-accent-strong)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)] sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function formatIntelligenceNumber(
  value: number | null | undefined,
  decimals = 1,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatIntelligenceInteger(
  value: number | null | undefined,
) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : Math.round(value).toLocaleString("en-US");
}

export function formatIntelligencePercent(
  value: number | null | undefined,
  decimals = 2,
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${formatIntelligenceNumber(
    value,
    decimals,
  )}%`;
}

export function formatIntelligenceCurrency(
  value: number | null | undefined,
  currency = "USD",
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value);
}

export function formatIntelligenceDate(
  value: string | null | undefined,
) {
  if (!value) return "—";
  const parsed = new Date(value);

  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : value;
}