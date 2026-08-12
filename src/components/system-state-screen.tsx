"use client";

import Link from "next/link";

export type SystemStateScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  reference?: string | null;
  announce?: boolean;
};

function SliceMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-600 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-600 to-emerald-950 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-300" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
          Advisor Intelligence Platform
        </div>
      </div>
    </div>
  );
}

function PrimaryAction({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:-translate-y-0.5 hover:from-emerald-400 hover:via-emerald-600 hover:to-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400";

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

export function SystemStateScreen({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimary,
  secondaryLabel,
  secondaryHref,
  reference,
  announce = false,
}: SystemStateScreenProps) {
  return (
    <main className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#020604] px-5 py-16 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-14rem] h-[30rem] w-[30rem] rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute bottom-[-16rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-cyan-600/8 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <section
        role={announce ? "alert" : undefined}
        aria-live={announce ? "assertive" : undefined}
        className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-emerald-300/12 bg-zinc-950/84 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-400/8 to-transparent" />

        <div className="relative">
          <SliceMark />

          <div className="mt-10 text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
            {eyebrow}
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            {description}
          </p>

          {reference ? (
            <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 font-mono text-xs text-slate-400">
              Reference: {reference}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {primaryLabel ? (
              <PrimaryAction
                label={primaryLabel}
                href={primaryHref}
                onClick={onPrimary}
              />
            ) : null}

            {secondaryLabel && secondaryHref ? (
              <Link
                href={secondaryHref}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}