"use client";

import type {
  ReactNode,
} from "react";

import {
  cx,
  toneClass,
  type ScanState,
  type Tone,
} from "@/lib/workspace-watchlists";

export function WatchlistCard({
  children,
  className = "",
}: {
  children:
    ReactNode;
  className?:
    string;
}) {
  return (
    <section
      className={cx(
        "relative min-h-0 min-w-0 overflow-hidden rounded-[1.45rem] border border-white/10 bg-zinc-950/78 shadow-2xl shadow-black/35 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function WatchlistPill({
  children,
  tone = "slate",
  className = "",
}: {
  children:
    ReactNode;
  tone?:
    Tone;
  className?:
    string;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em]",
        toneClass(
          tone,
        ),
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScanStatePill({
  state,
}: {
  state:
    ScanState;
}) {
  const tone: Tone =
    state === "synced"
      ? "green"
      : state === "checking"
        ? "amber"
        : state === "error"
          ? "red"
          : "slate";

  return (
    <WatchlistPill
      tone={tone}
    >
      {state}
    </WatchlistPill>
  );
}