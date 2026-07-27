"use client";

import {
  CalendarClock,
  RefreshCw,
  Save,
} from "lucide-react";
import type {
  Dispatch,
  SetStateAction,
} from "react";

import type {
  AdvisorBriefPreference,
  AdvisorBriefScheduleMode,
} from "@/lib/advisor-briefing/types";
import {
  Badge,
  Toggle,
  cx,
  panelClass,
} from "@/components/advisor-brief/ui";

const TIMEZONES = [
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export default function BriefSchedulePanel({
  preference,
  setPreference,
  busy,
  action,
  onSave,
}: {
  preference: AdvisorBriefPreference;
  setPreference: Dispatch<
    SetStateAction<AdvisorBriefPreference>
  >;
  busy: boolean;
  action: string | null;
  onSave: () => void | Promise<void>;
}) {
  return (
            <section
              className={cx(
                panelClass,
                "p-5 sm:p-6",
              )}
            >
              <Badge tone="purple">
                <CalendarClock className="h-3.5 w-3.5" />
                Autonomous delivery
              </Badge>
              <h2 className="mt-3 text-2xl font-black text-white">
                Advisor email schedule
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Slice checks the protected cron route, generates the brief at the selected interval, and emails only the configured advisor when measured data quality meets the threshold.
              </p>

              <div className="mt-5 space-y-3">
                <Toggle
                  checked={
                    preference.enabled
                  }
                  onChange={(enabled) =>
                    setPreference(
                      (current) => ({
                        ...current,
                        enabled,
                      }),
                    )
                  }
                  label="Enable autonomous briefings"
                />
                <Toggle
                  checked={
                    preference.emailEnabled
                  }
                  onChange={(
                    emailEnabled,
                  ) =>
                    setPreference(
                      (current) => ({
                        ...current,
                        emailEnabled,
                      }),
                    )
                  }
                  label="Send advisor email notification"
                />
                <Toggle
                  checked={
                    preference.weekdaysOnly
                  }
                  onChange={(
                    weekdaysOnly,
                  ) =>
                    setPreference(
                      (current) => ({
                        ...current,
                        weekdaysOnly,
                      }),
                    )
                  }
                  label="Skip Saturdays and Sundays"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Schedule mode
                  </span>
                  <select
                    value={
                      preference.scheduleMode
                    }
                    onChange={(
                      event,
                    ) =>
                      setPreference(
                        (current) => ({
                          ...current,
                          scheduleMode:
                            event
                              .target
                              .value as AdvisorBriefScheduleMode,
                        }),
                      )
                    }
                    className="mt-2 w-full bg-zinc-950 py-2 text-sm font-black text-white outline-none"
                  >
                    <option value="Interval">
                      Custom interval
                    </option>
                    <option value="Daily">
                      Daily
                    </option>
                    <option value="Weekdays">
                      Weekdays
                    </option>
                    <option value="Weekly">
                      Weekly
                    </option>
                  </select>
                </label>

                {preference.scheduleMode ===
                "Interval" ? (
                  <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                      Interval minutes
                    </span>
                    <input
                      type="number"
                      min={15}
                      max={10080}
                      step={15}
                      value={
                        preference.intervalMinutes
                      }
                      onChange={(
                        event,
                      ) =>
                        setPreference(
                          (
                            current,
                          ) => ({
                            ...current,
                            intervalMinutes:
                              Math.max(
                                15,
                                Math.min(
                                  10080,
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ) ||
                                    15,
                                ),
                              ),
                          }),
                        )
                      }
                      className="mt-2 w-full bg-transparent py-2 text-sm font-black text-white outline-none"
                    />
                  </label>
                ) : (
                  <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                      Local send time
                    </span>
                    <input
                      type="time"
                      value={
                        preference.localTime
                      }
                      onChange={(
                        event,
                      ) =>
                        setPreference(
                          (
                            current,
                          ) => ({
                            ...current,
                            localTime:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="mt-2 w-full bg-transparent py-2 text-sm font-black text-white outline-none"
                    />
                  </label>
                )}

                {preference.scheduleMode ===
                "Weekly" ? (
                  <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                      Weekly day
                    </span>
                    <select
                      value={
                        preference.weeklyDay
                      }
                      onChange={(
                        event,
                      ) =>
                        setPreference(
                          (
                            current,
                          ) => ({
                            ...current,
                            weeklyDay:
                              Number(
                                event
                                  .target
                                  .value,
                              ),
                          }),
                        )
                      }
                      className="mt-2 w-full bg-zinc-950 py-2 text-sm font-black text-white outline-none"
                    >
                      {WEEKDAYS.map(
                        (
                          day,
                          index,
                        ) => (
                          <option
                            key={
                              day
                            }
                            value={
                              index
                            }
                          >
                            {day}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ) : null}

                <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Timezone
                  </span>
                  <select
                    value={
                      preference.timezone
                    }
                    onChange={(
                      event,
                    ) =>
                      setPreference(
                        (
                          current,
                        ) => ({
                          ...current,
                          timezone:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="mt-2 w-full bg-zinc-950 py-2 text-sm font-black text-white outline-none"
                  >
                    {TIMEZONES.map(
                      (timezone) => (
                        <option
                          key={
                            timezone
                          }
                          value={
                            timezone
                          }
                        >
                          {timezone}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Advisor email
                  </span>
                  <input
                    type="email"
                    value={
                      preference.emailAddress
                    }
                    onChange={(
                      event,
                    ) =>
                      setPreference(
                        (
                          current,
                        ) => ({
                          ...current,
                          emailAddress:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="mt-2 w-full bg-transparent py-2 text-sm font-black text-white outline-none placeholder:text-slate-700"
                    placeholder="advisor@firm.com"
                  />
                </label>

                <label className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:col-span-2">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Minimum data quality
                    <span className="text-emerald-300">
                      {
                        preference.minimumDataQuality
                      }
                      /100
                    </span>
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={95}
                    step={1}
                    value={
                      preference.minimumDataQuality
                    }
                    onChange={(
                      event,
                    ) =>
                      setPreference(
                        (
                          current,
                        ) => ({
                          ...current,
                          minimumDataQuality:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        }),
                      )
                    }
                    className="mt-3 w-full accent-emerald-600"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() =>
                  void onSave()
                }
                disabled={busy}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-5 py-3.5 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {action ===
                "save" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save autonomous schedule
              </button>
            </section>
  );
}