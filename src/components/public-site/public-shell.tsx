import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Menu,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type PublicRouteKey =
  | "home"
  | "platform"
  | "markets"
  | "knowledge-graph"
  | "capabilities"
  | "intelligence";

const PUBLIC_NAVIGATION: Array<{
  key: PublicRouteKey;
  label: string;
  href: string;
}> = [
  { key: "platform", label: "Platform", href: "/platform" },
  { key: "markets", label: "Markets", href: "/markets" },
  {
    key: "knowledge-graph",
    label: "Knowledge graph",
    href: "/knowledge-graph",
  },
  { key: "capabilities", label: "Capabilities", href: "/capabilities" },
  { key: "intelligence", label: "Daily intelligence", href: "/daily-intelligence" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PublicBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cx(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-700/20 bg-white shadow-[0_12px_34px_rgba(6,78,55,0.14)]",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
        aria-hidden="true"
      >
        <div className="absolute inset-1 rounded-[0.95rem] bg-[linear-gradient(145deg,#effcf5,#ffffff_52%,#ddf6e8)]" />
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
          <div className="truncate text-xl font-black tracking-[-0.045em] text-[var(--slice-heading)] sm:text-2xl">
            Slice
          </div>
          <div className="truncate text-[9px] font-black uppercase tracking-[0.22em] text-emerald-800">
            Advisor Operating System
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavigationLink({
  href,
  label,
  active,
  mobile = false,
}: {
  href: string;
  label: string;
  active: boolean;
  mobile?: boolean;
}) {
  return (
    <Link prefetch={false}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-xl font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
        mobile ? "block px-4 py-3 text-sm" : "px-3 py-2 text-xs",
        active
          ? "bg-emerald-700 text-white shadow-[0_10px_24px_rgba(5,120,83,0.18)]"
          : "text-[var(--slice-muted)] hover:bg-emerald-50 hover:text-emerald-900",
      )}
    >
      {label}
    </Link>
  );
}

export function PublicHeader({ active }: { active: PublicRouteKey }) {
  return (
    <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-white/88 shadow-[0_10px_35px_rgba(7,83,60,0.07)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link prefetch={false}
          href="/"
          aria-label="Slice home"
          className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
        >
          <PublicBrandMark />
        </Link>

        <nav
          aria-label="Public navigation"
          className="hidden items-center gap-1 xl:flex"
        >
          {PUBLIC_NAVIGATION.map((item) => (
            <NavigationLink
              key={item.key}
              href={item.href}
              label={item.label}
              active={active === item.key}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link prefetch={false}
            href="/client-login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-950/15 bg-white px-4 py-2.5 text-xs font-black text-emerald-950 shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            Client login
          </Link>
          <Link prefetch={false}
            href="/founder-login"
            className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-[linear-gradient(110deg,#16a36f,#07533c)] px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_28px_rgba(5,120,83,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            Founder login
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <details className="group relative sm:hidden">
          <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-emerald-950/15 bg-white text-emerald-950 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 [&::-webkit-details-marker]:hidden">
            <Menu className="h-5 w-5 group-open:hidden" aria-hidden="true" />
            <ChevronDown
              className="hidden h-5 w-5 group-open:block"
              aria-hidden="true"
            />
            <span className="sr-only">Open navigation</span>
          </summary>

          <div className="absolute right-0 top-[calc(100%+0.7rem)] w-[min(88vw,22rem)] overflow-hidden rounded-2xl border border-emerald-950/15 bg-white p-3 shadow-[0_24px_70px_rgba(6,78,55,0.18)]">
            <nav aria-label="Mobile public navigation" className="grid gap-1">
              <NavigationLink
                href="/"
                label="Home"
                active={active === "home"}
                mobile
              />
              {PUBLIC_NAVIGATION.map((item) => (
                <NavigationLink
                  key={item.key}
                  href={item.href}
                  label={item.label}
                  active={active === item.key}
                  mobile
                />
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-950/10 pt-3">
              <Link prefetch={false}
                href="/client-login"
                className="rounded-xl border border-emerald-950/15 bg-white px-3 py-3 text-center text-xs font-black text-emerald-950"
              >
                Client login
              </Link>
              <Link prefetch={false}
                href="/founder-login"
                className="rounded-xl bg-emerald-700 px-3 py-3 text-center text-xs font-black text-white"
              >
                Founder login
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-emerald-950/10 bg-white/80">
      <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
        <Link prefetch={false} href="/" className="w-fit">
          <PublicBrandMark />
        </Link>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--slice-muted)] lg:justify-center"
        >
          {PUBLIC_NAVIGATION.map((item) => (
            <Link prefetch={false} key={item.key} href={item.href} className="hover:text-emerald-800">
              {item.label}
            </Link>
          ))}
          <Link prefetch={false} href="/security" className="hover:text-emerald-800">
            Security
          </Link>
        </nav>

        <p className="max-w-md text-[10px] font-bold uppercase leading-5 tracking-[0.1em] text-[var(--slice-subtle)] lg:justify-self-end lg:text-right">
          Market intelligence and advisor workflow support. Provider state,
          source evidence, and review status should be confirmed before
          client-specific use.
        </p>
      </div>
    </footer>
  );
}

export function PublicPage({
  active,
  children,
}: {
  active: PublicRouteKey;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--slice-bg)] text-[var(--slice-text)] selection:bg-emerald-300/35 selection:text-emerald-950">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -left-48 -top-56 h-[36rem] w-[36rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -right-48 top-10 h-[34rem] w-[34rem] rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute bottom-[-22rem] left-[28%] h-[36rem] w-[36rem] rounded-full bg-lime-300/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(5,120,83,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(5,120,83,0.025)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      </div>
      <div className="relative">
        <PublicHeader active={active} />
        <main>{children}</main>
        <PublicFooter />
      </div>
    </div>
  );
}

export function PublicHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-white/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800 shadow-sm backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="mt-6 max-w-5xl text-balance text-4xl font-black tracking-[-0.055em] text-[var(--slice-heading)] sm:text-5xl lg:text-7xl lg:leading-[0.98]">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-[var(--slice-muted)] sm:text-lg sm:leading-9">
            {description}
          </p>
          {actions ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {actions}
            </div>
          ) : null}
        </div>

        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link prefetch={false}
      href={href}
      className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-800/20 bg-[linear-gradient(110deg,#16a36f,#07533c)] px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(5,120,83,0.23)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link prefetch={false}
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-950/15 bg-white/90 px-5 py-3 text-sm font-black text-emerald-950 shadow-[0_12px_28px_rgba(6,78,55,0.08)] transition hover:border-emerald-700/30 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
    >
      {children}
    </Link>
  );
}

export function SectionHeading({
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
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-4xl">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-800">
          {eyebrow}
        </div>
        <h2 className="mt-3 text-balance text-3xl font-black tracking-[-0.045em] text-[var(--slice-heading)] sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base sm:leading-8">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PublicSurface({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  const Component = as;

  return (
    <Component
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.8rem] border border-emerald-950/10 bg-white/88 text-[var(--slice-text)] shadow-[0_22px_70px_rgba(6,78,55,0.10)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function TrustLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm font-bold leading-6 text-[var(--slice-muted)]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
      <span>{children}</span>
    </div>
  );
}

export function GovernanceBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-900">
      <ShieldCheck className="h-3.5 w-3.5" />
      Review-first governance
    </span>
  );
}