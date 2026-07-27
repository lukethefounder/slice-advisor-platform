"use client";

import {
  Clock3,
  Layers3,
  Plus,
  RefreshCw,
  TimerReset,
} from "lucide-react";

import {
  dotClass,
  nextScanTimestamp,
  relativeScanTime,
  scanIntervalLabel,
  type AdvisorWatchlist,
  type ScanState,
} from "@/lib/workspace-watchlists";
import {
  WatchlistCard,
  WatchlistPill,
} from "@/components/workspace/watchlists/watchlist-ui";
import {
  cx,
} from "@/lib/workspace-watchlists";

function ListButton({
  list,
  active,
  derived = false,
  clock,
  scanState,
  onClick,
}: {
  list:
    AdvisorWatchlist;
  active:
    boolean;
  derived?:
    boolean;
  clock:
    number;
  scanState:
    ScanState;
  onClick:
    () => void;
}) {
  const next =
    nextScanTimestamp(
      list,
    );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group w-full min-w-0 rounded-2xl border p-3 text-left transition",
        active
          ? "border-white bg-white text-slate-950 shadow-lg shadow-white/5"
          : derived
            ? "border-purple-500/25 bg-purple-500/[0.08] text-purple-50 hover:bg-purple-500/[0.13]"
            : "border-white/10 bg-white/[0.035] text-white hover:border-white/20 hover:bg-white/[0.065]",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cx(
                "h-2.5 w-2.5 shrink-0 rounded-full shadow-lg",
                dotClass(
                  list.tone,
                ),
              )}
            />
            <span className="truncate text-sm font-black">
              {list.name}
            </span>
          </div>

          <p
            className={cx(
              "mt-1 truncate text-[10px] font-bold uppercase tracking-[0.1em]",
              active
                ? "text-slate-500"
                : derived
                  ? "text-purple-200/70"
                  : "text-slate-500",
            )}
          >
            {list.items.length}/20 securities ·{" "}
            {list.constraints.length}/2 rules
          </p>
        </div>

        {scanState ===
        "checking" ? (
          <RefreshCw
            className={cx(
              "h-4 w-4 shrink-0 animate-spin",
              active
                ? "text-slate-500"
                : "text-amber-300",
            )}
          />
        ) : (
          <span
            className={cx(
              "shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em]",
              active
                ? "border-slate-200 bg-slate-100 text-slate-700"
                : "border-white/10 bg-black/25 text-slate-300",
            )}
          >
            {scanIntervalLabel(
              list.scanIntervalMinutes,
            )}
          </span>
        )}
      </div>

      <div
        className={cx(
          "mt-2 flex min-w-0 items-center justify-between gap-2 text-[10px] font-bold",
          active
            ? "text-slate-500"
            : "text-slate-500",
        )}
      >
        <span className="truncate">
          {list.enabled
            ? list.scanIntervalMinutes ===
              0
              ? "Manual scan"
              : `Next ${relativeScanTime(
                  next,
                  clock,
                )}`
            : "List paused"}
        </span>
        <span className="shrink-0">
          {list.lastScanStatus ===
          "error"
            ? "Needs review"
            : list.lastScannedAt
              ? "Scanned"
              : "New"}
        </span>
      </div>
    </button>
  );
}

export default function WatchlistRail({
  lists,
  customBoardList,
  activeListId,
  clock,
  schedulerEnabled,
  scanStateByList,
  onSelect,
  onOpenCreate,
  onRefreshCustomBoard,
}: {
  lists:
    AdvisorWatchlist[];
  customBoardList:
    AdvisorWatchlist;
  activeListId:
    string;
  clock:
    number;
  schedulerEnabled:
    boolean;
  scanStateByList:
    Record<
      string,
      ScanState
    >;
  onSelect:
    (listId: string) =>
      void;
  onOpenCreate:
    () => void;
  onRefreshCustomBoard:
    () => void;
}) {
  return (
    <WatchlistCard className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/8 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
              <Layers3 className="h-3.5 w-3.5" />
              Lists
            </div>
            <h2 className="mt-1 truncate text-xl font-black text-white">
              Advisor watchlists
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-200 transition hover:bg-emerald-500/20"
            aria-label="Create a watchlist"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <WatchlistPill tone="cyan">
            {lists.length} lists
          </WatchlistPill>
          <WatchlistPill
            tone={
              schedulerEnabled
                ? "green"
                : "slate"
            }
          >
            <Clock3 className="h-3 w-3" />
            {schedulerEnabled
              ? "Scheduler on"
              : "Scheduler off"}
          </WatchlistPill>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
        <div className="grid gap-2">
          {lists.map(
            (list) => (
              <ListButton
                key={list.id}
                list={list}
                active={
                  activeListId ===
                  list.id
                }
                clock={clock}
                scanState={
                  scanStateByList[
                    list.id
                  ] ??
                  "idle"
                }
                onClick={() =>
                  onSelect(
                    list.id,
                  )
                }
              />
            ),
          )}

          <div className="my-1 h-px bg-white/8" />

          <ListButton
            list={
              customBoardList
            }
            active={
              activeListId ===
              customBoardList.id
            }
            derived
            clock={clock}
            scanState={
              scanStateByList[
                customBoardList.id
              ] ??
              "idle"
            }
            onClick={() => {
              onRefreshCustomBoard();
              onSelect(
                customBoardList.id,
              );
            }}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 p-3">
        <div className="rounded-2xl border border-white/8 bg-black/30 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            <TimerReset className="h-3.5 w-3.5" />
            Cadence rules
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-400">
            Each list has its own scan interval. Scheduled scans run only while this page is open and visible.
          </p>
        </div>
      </div>
    </WatchlistCard>
  );
}