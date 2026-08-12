"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Bot,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleUserRound,
  FileChartColumnIncreasing,
  Gauge,
  Inbox,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquareText,
  SearchX,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

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
      "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]",
    lime:
      "border-lime-500/20 bg-lime-500/[0.09] text-lime-700 dark:text-lime-200",
    teal:
      "border-teal-500/20 bg-teal-500/[0.09] text-teal-700 dark:text-teal-200",
    cyan:
      "border-[var(--slice-cyan-border)] bg-[var(--slice-cyan-bg)] text-[var(--slice-cyan-text)]",
    sky:
      "border-sky-500/20 bg-sky-500/[0.09] text-sky-700 dark:text-sky-200",
    violet:
      "border-[var(--slice-violet-border)] bg-[var(--slice-violet-bg)] text-[var(--slice-violet-text)]",
    amber:
      "border-[var(--slice-amber-border)] bg-[var(--slice-amber-bg)] text-[var(--slice-amber-text)]",
    slate:
      "border-[var(--slice-slate-border)] bg-[var(--slice-slate-bg)] text-[var(--slice-slate-text)]",
  };

  return tones[tone];
}

export function dotClasses(tone: WorkspaceTone) {
  const tones: Record<WorkspaceTone, string> = {
    emerald: "bg-emerald-500 shadow-emerald-400/40",
    lime: "bg-lime-500 shadow-lime-400/40",
    teal: "bg-teal-500 shadow-teal-400/40",
    cyan: "bg-cyan-500 shadow-cyan-400/40",
    sky: "bg-sky-500 shadow-sky-400/40",
    violet: "bg-violet-500 shadow-violet-400/40",
    amber: "bg-amber-500 shadow-amber-400/40",
    slate: "bg-slate-400 shadow-slate-400/30",
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

export function GreenSliceLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cx(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--slice-accent-border)] bg-white shadow-[0_10px_28px_var(--slice-shadow)]",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
        aria-hidden="true"
      >
        <div className="absolute inset-1 rounded-[0.9rem] bg-[linear-gradient(145deg,#effcf5,#ffffff_52%,#ddf6e8)]" />
        <div
          className={cx(
            "relative grid place-items-center rounded-full bg-[linear-gradient(145deg,#5bd9a2,#16a36f_58%,#07533c)] font-black text-white shadow-md",
            compact ? "h-7 w-7 text-sm" : "h-8 w-8 text-lg",
          )}
        >
          S
        </div>
        <div className="absolute right-2 top-2 h-1.5 w-1.5 rotate-45 bg-lime-400" />
        <div className="absolute bottom-2 left-2 h-1.5 w-1.5 rotate-45 bg-emerald-700" />
      </div>

      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Slice
          </p>
          <p className="truncate text-[9px] font-black uppercase tracking-[0.22em] text-[var(--slice-accent-strong)]">
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
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  const Component = as;

  return (
    <Component
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.45rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] text-[var(--slice-text)] shadow-[0_18px_60px_var(--slice-shadow)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </Component>
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

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--slice-accent-strong)]">
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
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-[var(--slice-subtle)]">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-black text-[var(--slice-heading)]">
            {value}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-[var(--slice-muted)]">
            {helper}
          </p>
        </div>
        {icon ? (
          <div
            className={cx(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
              toneClasses(tone),
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MarketStatePill({ state }: { state: string }) {
  const normalized = state.toLowerCase();
  const tone: WorkspaceTone = normalized.includes("live")
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
  type: "market" | "client" | "ai" | "team" | "firm" | "risk";
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

  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  actions,
  badges,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-5xl">
        {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
        <h1 className="mt-2 text-balance text-3xl font-black tracking-[-0.045em] text-[var(--slice-heading)] sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
        {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

type WorkspaceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  tone?: WorkspaceTone;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export function WorkspaceButton({
  href,
  tone = "emerald",
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  type = "button",
  ...buttonProps
}: WorkspaceButtonProps) {
  const sizes = {
    sm: "min-h-9 px-3 py-2 text-[10px]",
    md: "min-h-11 px-4 py-2.5 text-xs",
    lg: "min-h-13 px-5 py-3 text-sm",
  } as const;
  const variants = {
    primary:
      "border-[var(--slice-accent-border)] bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] text-white shadow-[0_10px_26px_var(--slice-accent-glow)] hover:brightness-105",
    secondary: cx(
      "border hover:brightness-98 focus-visible:ring-[var(--slice-accent-border)]",
      toneClasses(tone),
    ),
    quiet:
      "border-transparent bg-transparent text-[var(--slice-muted)] hover:border-[var(--slice-border)] hover:bg-[var(--slice-surface-muted)] hover:text-[var(--slice-heading)]",
    danger:
      "border-[var(--slice-rose-border)] bg-[var(--slice-rose-bg)] text-[var(--slice-rose-text)] hover:brightness-98",
  } as const;
  const classes = cx(
    "inline-flex items-center justify-center gap-2 rounded-xl border font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slice-bg)] disabled:cursor-not-allowed disabled:opacity-45",
    sizes[size],
    variants[variant],
    className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </>
  );

  if (href) {
    const unavailable = disabled || loading;
    const external = /^https?:\/\//i.test(href);

    if (external) {
      return (
        <a
          href={unavailable ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
          aria-disabled={unavailable ? true : undefined}
          tabIndex={unavailable ? -1 : undefined}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={unavailable ? "#" : href}
        prefetch={false}
        className={classes}
        aria-disabled={unavailable ? true : undefined}
        tabIndex={unavailable ? -1 : undefined}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (unavailable) event.preventDefault();
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={disabled || loading}
      className={classes}
    >
      {content}
    </button>
  );
}

export function WorkspaceField({
  label,
  description,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("grid gap-2", className)}>
      <span className="flex items-center gap-2 text-xs font-black text-[var(--slice-heading)]">
        {label}
        {required ? (
          <span className="text-[var(--slice-amber-text)]">Required</span>
        ) : null}
      </span>
      {description ? (
        <span className="text-xs font-semibold leading-5 text-[var(--slice-muted)]">
          {description}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="text-xs font-bold text-[var(--slice-rose-text)]" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-[var(--slice-border)] bg-[var(--slice-input)] px-3.5 py-3 text-sm font-semibold text-[var(--slice-heading)] outline-none placeholder:text-[var(--slice-subtle)] focus:border-[var(--slice-accent-border)] focus:ring-2 focus:ring-[var(--slice-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50";

export const WorkspaceInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function WorkspaceInput({ className, ...props }, ref) {
  return <input ref={ref} className={cx(fieldClass, className)} {...props} />;
});

export const WorkspaceSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function WorkspaceSelect({ className, ...props }, ref) {
  return <select ref={ref} className={cx(fieldClass, className)} {...props} />;
});

export const WorkspaceTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function WorkspaceTextarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(fieldClass, "min-h-28 resize-y", className)}
      {...props}
    />
  );
});

export function WorkspaceAlert({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: "success" | "warning" | "error" | "info";
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = {
    success:
      "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]",
    warning:
      "border-[var(--slice-amber-border)] bg-[var(--slice-amber-bg)] text-[var(--slice-amber-text)]",
    error:
      "border-[var(--slice-rose-border)] bg-[var(--slice-rose-bg)] text-[var(--slice-rose-text)]",
    info:
      "border-[var(--slice-cyan-border)] bg-[var(--slice-cyan-bg)] text-[var(--slice-cyan-text)]",
  } as const;
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-2xl border p-4",
        styles[tone],
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-black">{title}</p> : null}
        <div className={cx("text-sm font-semibold leading-6", title && "mt-1")}>
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function WorkspaceEmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "grid place-items-center rounded-2xl border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] text-center",
        compact ? "p-5" : "min-h-64 p-8",
      )}
    >
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]">
          {icon ?? <SearchX className="h-5 w-5" aria-hidden="true" />}
        </div>
        <h3 className="mt-4 text-lg font-black text-[var(--slice-heading)]">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--slice-muted)]">
          {description}
        </p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton({
  lines = 4,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cx("animate-pulse space-y-3", className)} aria-hidden="true">
      <div className="h-7 w-2/5 rounded-lg bg-[var(--slice-slate-bg)]" />
      {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
        <div
          key={index}
          className="h-4 rounded-lg bg-[var(--slice-slate-bg)]"
          style={{ width: `${92 - (index % 3) * 13}%` }}
        />
      ))}
    </div>
  );
}

export function WorkspaceTabs<T extends string>({
  value,
  options,
  onChange,
  label = "Sections",
  className = "",
}: {
  value: T;
  options: Array<{
    value: T;
    label: string;
    count?: number;
    disabled?: boolean;
  }>;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-1",
        className,
      )}
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                return;
              }

              const container = event.currentTarget.parentElement;
              const tabs = container
                ? Array.from(
                    container.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]:not(:disabled)',
                    ),
                  )
                : [];
              const currentIndex = tabs.indexOf(event.currentTarget);

              if (currentIndex < 0 || !tabs.length) return;
              event.preventDefault();

              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : event.key === "ArrowRight"
                      ? (currentIndex + 1) % tabs.length
                      : (currentIndex - 1 + tabs.length) % tabs.length;
              tabs[nextIndex]?.focus();
              tabs[nextIndex]?.click();
            }}
            className={cx(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slice-accent-border)] disabled:opacity-40",
              active
                ? "bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] text-white shadow-[0_8px_20px_var(--slice-accent-glow)]"
                : "text-[var(--slice-muted)] hover:bg-white hover:text-[var(--slice-heading)]",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cx(
                  "rounded-full px-1.5 py-0.5 text-[9px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--slice-slate-bg)] text-[var(--slice-subtle)]",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceLoadingLine({ label = "Loading" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 text-xs font-bold text-[var(--slice-muted)]"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin text-[var(--slice-accent)]" aria-hidden="true" />
      {label}
    </span>
  );
}

export function WorkspaceInboxIcon() {
  return <Inbox className="h-4 w-4" aria-hidden="true" />;
}