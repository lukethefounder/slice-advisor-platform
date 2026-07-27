"use client";

import {
  Activity,
  BellRing,
  BrainCircuit,
  Clock3,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import {
  cx,
  formatScanTime,
  priorityTone,
  toneClass,
  type IntelligenceItem,
  type IntelligenceScan,
  type QualificationEvent,
  type ScanState,
} from "@/lib/workspace-watchlists";
import {
  ScanStatePill,
  WatchlistCard,
  WatchlistPill,
} from "@/components/workspace/watchlists/watchlist-ui";

type ActivityTab =
  | "triggers"
  | "intelligence"
  | "system";

function TriggerItem({
  event,
}: {
  event:
    QualificationEvent;
}) {
  return (
    <article
      className={cx(
        "min-w-0 rounded-2xl border p-3",
        toneClass(
          priorityTone(
            event.priority,
          ),
        ),
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-black text-white">
          {event.symbol}
        </div>
        <WatchlistPill
          tone={priorityTone(
            event.priority,
          )}
        >
          {event.priority}
        </WatchlistPill>
      </div>

      <p className="mt-2 break-words text-[11px] font-semibold leading-5 text-slate-300">
        {event.message}
      </p>

      <p className="mt-2 truncate text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
        {event.emailSent
          ? "Email sent"
          : event.emailSkippedReason ||
            "Email not sent"}{" "}
        ·{" "}
        {formatScanTime(
          event.createdAt,
        )}
      </p>
    </article>
  );
}

function IntelligenceAlert({
  item,
}: {
  item:
    IntelligenceItem;
}) {
  const tone =
    item.urgency ===
    "Critical"
      ? "red"
      : item.urgency ===
          "High"
        ? "amber"
        : "slate";

  return (
    <article
      className={cx(
        "min-w-0 rounded-2xl border p-3",
        toneClass(
          tone,
        ),
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-xs font-black leading-5 text-white">
          {item.title}
        </p>
        <WatchlistPill
          tone={tone}
        >
          {item.urgency}
        </WatchlistPill>
      </div>

      <p className="mt-2 line-clamp-3 text-[11px] font-semibold leading-5 text-slate-300">
        {item.summary}
      </p>

      <p className="mt-2 truncate text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
        {item.matchedTickers.join(
          ", ",
        ) || "Market"}{" "}
        ·{" "}
        {item.sourceName}
      </p>
    </article>
  );
}

export default function WatchlistActivity({
  events,
  activeEvents,
  intelligence,
  intelligenceAlerts,
  scanStatus,
  schedulerEnabled,
  schedulerRunning,
  lastSchedulerTick,
  onToggleScheduler,
  onSyncIntelligence,
  onRunAll,
}: {
  events:
    QualificationEvent[];
  activeEvents:
    QualificationEvent[];
  intelligence:
    IntelligenceScan | null;
  intelligenceAlerts:
    IntelligenceItem[];
  scanStatus:
    ScanState;
  schedulerEnabled:
    boolean;
  schedulerRunning:
    boolean;
  lastSchedulerTick:
    string | null;
  onToggleScheduler:
    () => void;
  onSyncIntelligence:
    () => void;
  onRunAll:
    () => void;
}) {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ActivityTab>(
      "triggers",
    );

  const shownEvents =
    useMemo(
      () =>
        (
          activeEvents.length
            ? activeEvents
            : events
        ).slice(
          0,
          30,
        ),
      [
        activeEvents,
        events,
      ],
    );

  const tabs: Array<{
    id: ActivityTab;
    label: string;
    count?: number;
  }> = [
    {
      id: "triggers",
      label: "Triggers",
      count:
        shownEvents.length,
    },
    {
      id: "intelligence",
      label: "Intel",
      count:
        intelligenceAlerts.length,
    },
    {
      id: "system",
      label: "Status",
    },
  ];

  return (
    <WatchlistCard className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/8 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              <Activity className="h-3.5 w-3.5" />
              Live activity
            </div>
            <h2 className="mt-1 truncate text-xl font-black text-white">
              Scan command
            </h2>
          </div>

          <ScanStatePill
            state={
              scanStatus
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={
              onSyncIntelligence
            }
            disabled={
              scanStatus ===
              "checking"
            }
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-100 disabled:opacity-50"
          >
            <BrainCircuit className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Sync intel
            </span>
          </button>

          <button
            type="button"
            onClick={
              onRunAll
            }
            disabled={
              scanStatus ===
              "checking"
            }
            className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-50"
          >
            {scanStatus ===
            "checking" ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Play className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">
              Check all
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={
            onToggleScheduler
          }
          className={cx(
            "mt-2 inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black",
            schedulerEnabled
              ? toneClass(
                  "green",
                )
              : toneClass(
                  "slate",
                ),
          )}
        >
          {schedulerRunning ? (
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Clock3 className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">
            {schedulerEnabled
              ? "Scheduler active"
              : "Enable scheduler"}
          </span>
        </button>
      </div>

      <div className="shrink-0 border-b border-white/8 p-2">
        <div className="grid grid-cols-3 rounded-xl border border-white/8 bg-black/30 p-1">
          {tabs.map(
            (tab) => (
              <button
                key={
                  tab.id
                }
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id,
                  )
                }
                className={cx(
                  "min-w-0 rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition",
                  activeTab ===
                    tab.id
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <span className="truncate">
                  {tab.label}
                  {typeof tab.count ===
                  "number"
                    ? ` ${tab.count}`
                    : ""}
                </span>
              </button>
            ),
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
        {activeTab ===
        "triggers" ? (
          <div className="grid gap-2">
            {shownEvents.map(
              (event) => (
                <TriggerItem
                  key={
                    event.id
                  }
                  event={
                    event
                  }
                />
              ),
            )}

            {!shownEvents.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-xs font-semibold leading-5 text-slate-400">
                No qualifying securities have triggered yet.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab ===
        "intelligence" ? (
          <div className="grid gap-2">
            {intelligenceAlerts.map(
              (item) => (
                <IntelligenceAlert
                  key={
                    item.id
                  }
                  item={
                    item
                  }
                />
              ),
            )}

            {!intelligenceAlerts.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/25 p-4 text-xs font-semibold leading-5 text-slate-400">
                Sync Intelligence to load the latest alert candidates.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab ===
        "system" ? (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Scheduler behavior
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-400">
                Due lists are processed sequentially, duplicate scans are blocked, and automatic scans pause while this page is hidden or the browser is offline.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                <BrainCircuit className="h-3.5 w-3.5" />
                Intelligence cache
              </div>
              <p className="mt-2 text-xs font-black text-white">
                {intelligence?.scannedAt
                  ? formatScanTime(
                      intelligence.scannedAt,
                    )
                  : "Not synced"}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-400">
                {intelligence?.sources?.filter(
                  (source) =>
                    source.ok,
                ).length ??
                  0} healthy sources ·{" "}
                {intelligence?.alertCandidates?.length ??
                  0} alert candidates
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                <Clock3 className="h-3.5 w-3.5" />
                Last scheduler cycle
              </div>
              <p className="mt-2 text-xs font-black text-white">
                {formatScanTime(
                  lastSchedulerTick,
                )}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-400">
                {schedulerEnabled
                  ? "The page checks for due lists every 15 seconds."
                  : "Automatic cadence checks are paused."}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.05] p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                <BellRing className="h-3.5 w-3.5" />
                Background limitation
              </div>
              <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-100/75">
                These per-list intervals run while the Watchlists page is open. Closed-browser scheduling requires server-persisted list rules and a cron worker.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </WatchlistCard>
  );
}