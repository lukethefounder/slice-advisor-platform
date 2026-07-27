"use client";

import type {
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
} from "react";

import {
  Activity,
  BellRing,
  Clock3,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  MAX_LIST_CONSTRAINTS,
  MAX_LIST_SECURITIES,
  constraintSentence,
  cx,
  formatScanTime,
  metricOptions,
  nextScanTimestamp,
  priorityTone,
  relativeScanTime,
  scanIntervalOptions,
  toneClass,
  toneOptions,
  type AdvisorWatchlist,
  type ConstraintCondition,
  type ConstraintJoin,
  type Priority,
  type ScanIntervalMinutes,
  type WatchConstraint,
} from "@/lib/workspace-watchlists";
import {
  WatchlistCard,
  WatchlistPill,
} from "@/components/workspace/watchlists/watchlist-ui";

function FieldLabel({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
      {children}
    </span>
  );
}

function ConstraintEditor({
  constraint,
  readOnly,
  onUpdate,
  onRemove,
}: {
  constraint:
    WatchConstraint;
  readOnly:
    boolean;
  onUpdate:
    (
      patch:
        Partial<WatchConstraint>,
    ) => void;
  onRemove:
    () => void;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-2xl border p-3",
        toneClass(
          priorityTone(
            constraint.priority,
          ),
        ),
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <WatchlistPill
          tone={priorityTone(
            constraint.priority,
          )}
        >
          {constraint.priority}
        </WatchlistPill>

        {!readOnly ? (
          <button
            type="button"
            onClick={onRemove}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-200"
            aria-label="Remove constraint"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid min-w-0 gap-2">
        <label className="grid min-w-0 gap-1">
          <FieldLabel>
            Metric
          </FieldLabel>
          <select
            disabled={readOnly}
            value={
              constraint.metricId
            }
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) =>
              onUpdate({
                metricId:
                  event.target
                    .value as WatchConstraint["metricId"],
              })
            }
            className="min-w-0 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 disabled:opacity-100 focus:ring-2"
          >
            {metricOptions.map(
              (metric) => (
                <option
                  key={metric.id}
                  value={metric.id}
                >
                  {metric.label} ·{" "}
                  {metric.group}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1">
            <FieldLabel>
              Condition
            </FieldLabel>
            <select
              disabled={
                readOnly
              }
              value={
                constraint.condition
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>,
              ) =>
                onUpdate({
                  condition:
                    event.target
                      .value as ConstraintCondition,
                })
              }
              className="min-w-0 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 disabled:opacity-100 focus:ring-2"
            >
              <option value="above">
                Above
              </option>
              <option value="below">
                Below
              </option>
              <option value="between">
                Between
              </option>
              <option value="moves-by">
                Moves by
              </option>
              <option value="crosses-above">
                Cross above
              </option>
              <option value="crosses-below">
                Cross below
              </option>
              <option value="news-at-least">
                News at least
              </option>
            </select>
          </label>

          <label className="grid min-w-0 gap-1">
            <FieldLabel>
              Priority
            </FieldLabel>
            <select
              disabled={
                readOnly
              }
              value={
                constraint.priority
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>,
              ) =>
                onUpdate({
                  priority:
                    event.target
                      .value as Priority,
                })
              }
              className="min-w-0 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 disabled:opacity-100 focus:ring-2"
            >
              <option value="Monitor">
                Monitor
              </option>
              <option value="Important">
                Important
              </option>
              <option value="Critical">
                Critical
              </option>
            </select>
          </label>
        </div>

        <div
          className={cx(
            "grid min-w-0 gap-2",
            constraint.condition ===
              "between"
              ? "grid-cols-2"
              : "grid-cols-1",
          )}
        >
          <label className="grid min-w-0 gap-1">
            <FieldLabel>
              Threshold
            </FieldLabel>
            <input
              disabled={
                readOnly
              }
              value={
                constraint.value
              }
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) =>
                onUpdate({
                  value:
                    event.target
                      .value,
                })
              }
              placeholder={
                constraint.condition ===
                "news-at-least"
                  ? "High, Critical, 75..."
                  : "Threshold"
              }
              className="min-w-0 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
            />
          </label>

          {constraint.condition ===
          "between" ? (
            <label className="grid min-w-0 gap-1">
              <FieldLabel>
                Upper
              </FieldLabel>
              <input
                disabled={
                  readOnly
                }
                value={
                  constraint.upperValue
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  onUpdate({
                    upperValue:
                      event.target
                        .value,
                  })
                }
                placeholder="Upper"
                className="min-w-0 rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
              />
            </label>
          ) : null}
        </div>

        {!readOnly ? (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                enabled:
                  !constraint.enabled,
              })
            }
            className={cx(
              "rounded-xl border px-3 py-2.5 text-xs font-black",
              constraint.enabled
                ? toneClass(
                    "green",
                  )
                : toneClass(
                    "slate",
                  ),
            )}
          >
            {constraint.enabled
              ? "Rule enabled"
              : "Rule paused"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function WatchlistDetail({
  list,
  readOnly = false,
  clock,
  schedulerEnabled,
  isScanning,
  newSymbol,
  setNewSymbol,
  onUpdate,
  onDelete,
  onAddSecurity,
  onRemoveSecurity,
  onAddConstraint,
  onUpdateConstraint,
  onRemoveConstraint,
  onRunCheck,
}: {
  list:
    AdvisorWatchlist;
  readOnly?:
    boolean;
  clock:
    number;
  schedulerEnabled:
    boolean;
  isScanning:
    boolean;
  newSymbol:
    string;
  setNewSymbol:
    (value: string) =>
      void;
  onUpdate:
    (
      patch:
        Partial<AdvisorWatchlist>,
    ) => void;
  onDelete:
    () => void;
  onAddSecurity:
    () => void;
  onRemoveSecurity:
    (
      securityId:
        string,
    ) => void;
  onAddConstraint:
    () => void;
  onUpdateConstraint:
    (
      constraintId:
        string,
      patch:
        Partial<WatchConstraint>,
    ) => void;
  onRemoveConstraint:
    (
      constraintId:
        string,
    ) => void;
  onRunCheck:
    () => void;
}) {
  const nextScan =
    nextScanTimestamp(
      list,
    );

  return (
    <WatchlistCard className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/8 bg-zinc-950/95 p-3.5 backdrop-blur-xl">
        <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <WatchlistPill
                tone={
                  list.tone
                }
              >
                {readOnly
                  ? "Derived list"
                  : "Advisor list"}
              </WatchlistPill>
              <WatchlistPill
                tone={
                  list.enabled
                    ? "green"
                    : "slate"
                }
              >
                {list.enabled
                  ? "Enabled"
                  : "Paused"}
              </WatchlistPill>
              <WatchlistPill tone="cyan">
                {list.items.length}/
                {MAX_LIST_SECURITIES}
              </WatchlistPill>
              <WatchlistPill tone="purple">
                {list.constraints.length}/
                {MAX_LIST_CONSTRAINTS} rules
              </WatchlistPill>
            </div>

            <div className="mt-3 grid min-w-0 gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <input
                disabled={
                  readOnly
                }
                value={
                  list.name
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  onUpdate({
                    name:
                      event.target
                        .value,
                  })
                }
                className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xl font-black text-white outline-none ring-emerald-500 disabled:opacity-100 focus:ring-2"
              />

              <input
                disabled={
                  readOnly
                }
                value={
                  list.description
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  onUpdate({
                    description:
                      event.target
                        .value,
                  })
                }
                className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold text-slate-300 outline-none ring-emerald-500 disabled:opacity-100 focus:ring-2"
              />
            </div>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2 2xl:w-[390px]">
            <label className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <FieldLabel>
                Scan interval
              </FieldLabel>
              <select
                value={
                  list.scanIntervalMinutes
                }
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  onUpdate({
                    scanIntervalMinutes:
                      Number(
                        event.target
                          .value,
                      ) as ScanIntervalMinutes,
                  })
                }
                className="mt-1 w-full min-w-0 bg-transparent text-xs font-black text-white outline-none disabled:opacity-100"
              >
                {scanIntervalOptions.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                      className="bg-zinc-950"
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={
                onRunCheck
              }
              disabled={
                isScanning
              }
              className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {isScanning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="truncate">
                {isScanning
                  ? "Scanning"
                  : "Scan now"}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
              <Clock3 className="h-3 w-3" />
              Last scan
            </div>
            <p className="mt-1 truncate text-xs font-black text-white">
              {formatScanTime(
                list.lastScannedAt,
              )}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
              <Activity className="h-3 w-3" />
              Next scan
            </div>
            <p className="mt-1 truncate text-xs font-black text-white">
              {!schedulerEnabled
                ? "Scheduler off"
                : relativeScanTime(
                    nextScan,
                    clock,
                  )}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
              Latest result
            </div>
            <p
              className={cx(
                "mt-1 truncate text-xs font-black",
                list.lastScanStatus ===
                  "error"
                  ? "text-emerald-300"
                  : list.lastScanStatus ===
                      "success"
                    ? "text-emerald-300"
                    : "text-slate-300",
              )}
              title={
                list.lastScanMessage
              }
            >
              {list.lastScanMessage ||
                "Not scanned yet."}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
        <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                    Securities
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                    Add stocks, ETFs, indices, crypto, futures, or other TradingView-style symbols.
                  </p>
                </div>

                {!readOnly ? (
                  <div className="flex min-w-0 gap-2 sm:w-[390px]">
                    <input
                      value={
                        newSymbol
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setNewSymbol(
                          event.target
                            .value,
                        )
                      }
                      onKeyDown={(
                        event: KeyboardEvent<HTMLInputElement>,
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          onAddSecurity();
                        }
                      }}
                      placeholder="NASDAQ:AAPL or AMEX:SPY"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={
                        onAddSecurity
                      }
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {list.items.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="group min-w-0 rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-white">
                            {
                              item.symbol
                            }
                          </div>
                          <div className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
                            {
                              item.tvSymbol
                            }{" "}
                            ·{" "}
                            {
                              item.assetType
                            }
                          </div>
                        </div>

                        {!readOnly ? (
                          <button
                            type="button"
                            onClick={() =>
                              onRemoveSecurity(
                                item.id,
                              )
                            }
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-200"
                            aria-label={`Remove ${item.symbol}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      {item.note ? (
                        <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-400">
                          {
                            item.note
                          }
                        </p>
                      ) : null}
                    </div>
                  ),
                )}

                {!list.items.length ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-xs font-semibold leading-5 text-slate-400">
                    No securities added yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-300">
                    Qualification rules
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                    Up to two criteria per list.
                  </p>
                </div>

                {!readOnly ? (
                  <button
                    type="button"
                    onClick={
                      onAddConstraint
                    }
                    disabled={
                      list.constraints.length >=
                      MAX_LIST_CONSTRAINTS
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-100 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add rule
                  </button>
                ) : null}
              </div>

              {!readOnly ? (
                <div className="mt-3 grid grid-cols-2 rounded-xl border border-white/10 bg-black/25 p-1">
                  {(
                    [
                      "OR",
                      "AND",
                    ] as ConstraintJoin[]
                  ).map(
                    (join) => (
                      <button
                        key={
                          join
                        }
                        type="button"
                        onClick={() =>
                          onUpdate({
                            constraintJoin:
                              join,
                          })
                        }
                        className={cx(
                          "rounded-lg px-3 py-2 text-xs font-black",
                          list.constraintJoin ===
                            join
                            ? "bg-white text-slate-950"
                            : "text-slate-400 hover:bg-white/[0.075] hover:text-white",
                        )}
                      >
                        {join}
                      </button>
                    ),
                  )}
                </div>
              ) : null}

              <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                {list.constraints.map(
                  (
                    constraint,
                  ) => (
                    <ConstraintEditor
                      key={
                        constraint.id
                      }
                      constraint={
                        constraint
                      }
                      readOnly={
                        readOnly
                      }
                      onUpdate={(
                        patch,
                      ) =>
                        onUpdateConstraint(
                          constraint.id,
                          patch,
                        )
                      }
                      onRemove={() =>
                        onRemoveConstraint(
                          constraint.id,
                        )
                      }
                    />
                  ),
                )}

                {!list.constraints.length ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-xs font-semibold leading-5 text-slate-400">
                    No criteria configured.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-3">
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                <BellRing className="h-3.5 w-3.5" />
                Delivery
              </div>

              <label className="mt-3 grid min-w-0 gap-1">
                <FieldLabel>
                  Alert email
                </FieldLabel>
                <div className="relative min-w-0">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    value={
                      list.notificationEmail
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      onUpdate({
                        notificationEmail:
                          event.target
                            .value,
                      })
                    }
                    placeholder="advisor@firm.com"
                    className="w-full min-w-0 rounded-xl border border-white/10 bg-black/45 py-2.5 pl-10 pr-3 text-xs font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
                  />
                </div>
              </label>

              <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-400">
                The existing server check route sends an email when a security qualifies and the event cooldown has expired.
              </p>
            </div>

            {!readOnly ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3.5">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  List controls
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({
                        enabled:
                          !list.enabled,
                      })
                    }
                    className={cx(
                      "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black",
                      list.enabled
                        ? toneClass(
                            "green",
                          )
                        : toneClass(
                            "slate",
                          ),
                    )}
                  >
                    {list.enabled ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {list.enabled
                      ? "Pause list"
                      : "Enable list"}
                  </button>

                  <label className="min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <FieldLabel>
                      Accent
                    </FieldLabel>
                    <select
                      value={
                        list.tone
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        onUpdate({
                          tone:
                            event.target
                              .value as AdvisorWatchlist["tone"],
                        })
                      }
                      className="mt-1 w-full min-w-0 bg-transparent text-xs font-black capitalize text-white outline-none"
                    >
                      {toneOptions.map(
                        (tone) => (
                          <option
                            key={
                              tone
                            }
                            value={
                              tone
                            }
                            className="bg-zinc-950"
                          >
                            {tone}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={
                      onDelete
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-black text-slate-300 transition hover:border-emerald-400/25 hover:text-emerald-200 sm:col-span-2 2xl:col-span-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete list
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-3.5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                Active rules
              </div>

              <div className="mt-3 grid gap-2">
                {list.constraints.map(
                  (
                    constraint,
                  ) => (
                    <div
                      key={
                        constraint.id
                      }
                      className={cx(
                        "min-w-0 rounded-xl border p-3",
                        toneClass(
                          priorityTone(
                            constraint.priority,
                          ),
                        ),
                      )}
                    >
                      <p className="break-words text-xs font-black text-white">
                        {constraintSentence(
                          constraint,
                        )}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.11em] text-slate-400">
                        {
                          constraint.priority
                        }{" "}
                        ·{" "}
                        {constraint.enabled
                          ? "Enabled"
                          : "Paused"}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WatchlistCard>
  );
}