"use client";

import {
  CalendarClock,
  CheckCircle2,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import type {
  AdvisorBriefJobView,
  AdvisorBriefPreference,
  AdvisorBriefScheduleMode,
} from "@/lib/advisor-briefing/types";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspaceField,
  WorkspaceInput,
  WorkspacePill,
  WorkspaceSelect,
  WorkspaceSurface,
  cx,
} from "@/components/workspace/core/workspace-ui";

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

const PRESETS: Array<{
  label: string;
  helper: string;
  patch: Partial<AdvisorBriefPreference>;
}> = [
  {
    label: "Weekday morning",
    helper: "7:00 AM local time",
    patch: {
      enabled: true,
      scheduleMode: "Weekdays",
      localTime: "07:00",
      weekdaysOnly: true,
    },
  },
  {
    label: "Every morning",
    helper: "Daily at 7:00 AM",
    patch: {
      enabled: true,
      scheduleMode: "Daily",
      localTime: "07:00",
      weekdaysOnly: false,
    },
  },
  {
    label: "Monday outlook",
    helper: "Weekly at 7:00 AM",
    patch: {
      enabled: true,
      scheduleMode: "Weekly",
      weeklyDay: 1,
      localTime: "07:00",
      weekdaysOnly: false,
    },
  },
  {
    label: "Four-hour pulse",
    helper: "Continuous monitoring",
    patch: {
      enabled: true,
      scheduleMode: "Interval",
      intervalMinutes: 240,
      weekdaysOnly: false,
    },
  },
];

function dateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function jobTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("complete")) return "emerald" as const;
  if (normalized.includes("failed") || normalized.includes("dead")) {
    return "amber" as const;
  }
  if (normalized.includes("process") || normalized.includes("queue")) {
    return "cyan" as const;
  }
  return "slate" as const;
}

function Toggle({
  checked,
  label,
  helper,
  onChange,
}: {
  checked: boolean;
  label: string;
  helper: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        "flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
        checked
          ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)]"
          : "border-white/8 bg-white/[0.025] hover:border-white/14",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
          {helper}
        </span>
      </span>
      <span
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked
            ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-strong)]"
            : "border-white/10 bg-white/[0.06]",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

export default function BriefSchedulePanel({
  preference,
  setPreference,
  busy,
  action,
  scheduleLabel,
  nextRunAt,
  lastDeliveryStatus,
  jobs,
  onSave,
  onRunNow,
  onRetryJob,
}: {
  preference: AdvisorBriefPreference;
  setPreference: Dispatch<SetStateAction<AdvisorBriefPreference>>;
  busy: boolean;
  action: string | null;
  scheduleLabel: string;
  nextRunAt: string | null;
  lastDeliveryStatus: string | null;
  jobs: AdvisorBriefJobView[];
  onSave: () => void | Promise<void>;
  onRunNow: () => void | Promise<void>;
  onRetryJob: (jobId: string) => void | Promise<void>;
}) {
  const latestJob = jobs[0] ?? null;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    preference.emailAddress.trim(),
  );
  const activeJob = jobs.find((job) =>
    ["Queued", "Retrying", "Processing"].includes(job.status),
  );

  return (
    <WorkspaceSurface className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <WorkspacePill tone={preference.enabled ? "emerald" : "amber"}>
              {preference.enabled ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <PauseCircle className="h-3 w-3" />
              )}
              {preference.enabled ? "Always-on schedule" : "Schedule paused"}
            </WorkspacePill>
            <WorkspacePill tone="cyan">
              <CalendarClock className="h-3 w-3" />
              Checked every 5 minutes
            </WorkspacePill>
            <WorkspacePill tone="slate">
              <ShieldCheck className="h-3 w-3" />
              Advisor email only
            </WorkspacePill>
          </div>

          <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
            Set the briefing once. Slice keeps it running.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            The scheduler queues a durable background job, regenerates the brief,
            enforces the minimum data-quality threshold, and sends only to the
            advisor address below—even when nobody is signed in.
          </p>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:w-[420px]">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
              Next automatic run
            </p>
            <p className="mt-2 text-sm font-black text-white">{dateTime(nextRunAt)}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
              {scheduleLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
              Last delivery
            </p>
            <p className="mt-2 text-sm font-black text-white">
              {lastDeliveryStatus || "No delivery yet"}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              Last emailed {dateTime(preference.lastSentAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
          One-click schedule presets
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                setPreference((current) => ({ ...current, ...preset.patch }))
              }
              className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
            >
              <p className="text-sm font-black text-white">{preset.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {preset.helper}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <Toggle
          checked={preference.enabled}
          label="Automatic briefings"
          helper="Generate on the selected schedule without an open browser."
          onChange={(enabled) =>
            setPreference((current) => ({ ...current, enabled }))
          }
        />
        <Toggle
          checked={preference.emailEnabled}
          label="Email each completed brief"
          helper="Send after the quality threshold is satisfied."
          onChange={(emailEnabled) =>
            setPreference((current) => ({ ...current, emailEnabled }))
          }
        />
        <Toggle
          checked={preference.weekdaysOnly}
          label="Skip weekends"
          helper="Useful for daily and interval schedules."
          onChange={(weekdaysOnly) =>
            setPreference((current) => ({ ...current, weekdaysOnly }))
          }
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceField label="Schedule mode">
          <WorkspaceSelect
            value={preference.scheduleMode}
            onChange={(event) =>
              setPreference((current) => ({
                ...current,
                scheduleMode: event.target.value as AdvisorBriefScheduleMode,
              }))
            }
          >
            <option value="Interval">Custom interval</option>
            <option value="Daily">Daily</option>
            <option value="Weekdays">Weekdays</option>
            <option value="Weekly">Weekly</option>
          </WorkspaceSelect>
        </WorkspaceField>

        {preference.scheduleMode === "Interval" ? (
          <WorkspaceField label="Interval minutes">
            <WorkspaceInput
              type="number"
              min={15}
              max={10_080}
              step={15}
              value={preference.intervalMinutes}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  intervalMinutes: Math.max(
                    15,
                    Math.min(10_080, Number(event.target.value) || 15),
                  ),
                }))
              }
            />
          </WorkspaceField>
        ) : (
          <WorkspaceField label="Local send time">
            <WorkspaceInput
              type="time"
              value={preference.localTime}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  localTime: event.target.value,
                }))
              }
            />
          </WorkspaceField>
        )}

        {preference.scheduleMode === "Weekly" ? (
          <WorkspaceField label="Weekly day">
            <WorkspaceSelect
              value={preference.weeklyDay}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  weeklyDay: Number(event.target.value),
                }))
              }
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>
        ) : (
          <WorkspaceField label="Timezone">
            <WorkspaceSelect
              value={preference.timezone}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            >
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>
        )}

        {preference.scheduleMode === "Weekly" ? (
          <WorkspaceField label="Timezone">
            <WorkspaceSelect
              value={preference.timezone}
              onChange={(event) =>
                setPreference((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            >
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </WorkspaceSelect>
          </WorkspaceField>
        ) : (
          <WorkspaceField label="Minimum data quality">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-3">
              <div className="flex items-center justify-between text-xs font-black text-white">
                <span>Delivery threshold</span>
                <span className="text-[var(--slice-accent)]">
                  {preference.minimumDataQuality}/100
                </span>
              </div>
              <input
                aria-label="Minimum data quality"
                type="range"
                min={40}
                max={95}
                value={preference.minimumDataQuality}
                onChange={(event: { target: { value: string } }) =>
                  setPreference((current) => ({
                    ...current,
                    minimumDataQuality: Number(event.target.value),
                  }))
                }
                className="mt-3 w-full accent-emerald-500"
              />
            </div>
          </WorkspaceField>
        )}
      </div>

      {preference.scheduleMode === "Weekly" ? (
        <div className="mt-4">
          <WorkspaceField label="Minimum data quality">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-3">
              <div className="flex items-center justify-between text-xs font-black text-white">
                <span>Delivery threshold</span>
                <span className="text-[var(--slice-accent)]">
                  {preference.minimumDataQuality}/100
                </span>
              </div>
              <input
                aria-label="Minimum data quality"
                type="range"
                min={40}
                max={95}
                value={preference.minimumDataQuality}
                onChange={(event: { target: { value: string } }) =>
                  setPreference((current) => ({
                    ...current,
                    minimumDataQuality: Number(event.target.value),
                  }))
                }
                className="mt-3 w-full accent-emerald-500"
              />
            </div>
          </WorkspaceField>
        </div>
      ) : null}

      <div className="mt-4">
        <WorkspaceField
          label="Advisor email destination"
          description="Automatic briefs are advisor-only and never sent to clients from this scheduler."
          error={preference.emailEnabled && !emailValid ? "Enter a valid email address." : undefined}
        >
          <WorkspaceInput
            type="email"
            value={preference.emailAddress}
            onChange={(event) =>
              setPreference((current) => ({
                ...current,
                emailAddress: event.target.value,
              }))
            }
            placeholder="advisor@firm.com"
          />
        </WorkspaceField>
      </div>

      {activeJob ? (
        <div className="mt-5 rounded-2xl border border-cyan-400/22 bg-cyan-500/[0.07] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <WorkspacePill tone="cyan">{activeJob.status}</WorkspacePill>
                <span className="text-xs font-black text-white">
                  Attempt {activeJob.attempt}/{activeJob.maxAttempts}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {activeJob.progress.message || "Briefing job is running."}
              </p>
            </div>
            <p className="text-2xl font-black text-cyan-100">
              {Math.max(0, Math.min(100, activeJob.progress.value))}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-300 transition-all"
              style={{ width: `${Math.max(2, activeJob.progress.value)}%` }}
            />
          </div>
        </div>
      ) : latestJob ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <WorkspacePill tone={jobTone(latestJob.status)}>{latestJob.status}</WorkspacePill>
              <span className="text-xs font-black text-white">Latest automation run</span>
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-slate-500">
              {latestJob.error || latestJob.progress.message || dateTime(latestJob.updatedAt)}
            </p>
          </div>
          {["Failed", "DeadLetter", "Cancelled"].includes(latestJob.status) ? (
            <WorkspaceButton
              size="sm"
              tone="amber"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => void onRetryJob(latestJob.id)}
              loading={action === "retry-job"}
            >
              Retry
            </WorkspaceButton>
          ) : null}
        </div>
      ) : null}

      {preference.emailEnabled && !emailValid ? (
        <WorkspaceAlert tone="warning" className="mt-5">
          Automatic email is enabled, but Slice needs a valid advisor destination before the schedule can send.
        </WorkspaceAlert>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <WorkspaceButton
          variant="secondary"
          tone="slate"
          icon={<Save className="h-4 w-4" />}
          onClick={() => void onSave()}
          loading={action === "save"}
          disabled={busy || (preference.emailEnabled && !emailValid)}
        >
          Save schedule
        </WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          icon={action === "run-now" ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          onClick={() => void onRunNow()}
          loading={action === "run-now"}
          disabled={busy || (preference.emailEnabled && !emailValid)}
        >
          Save and run now
        </WorkspaceButton>
      </div>
    </WorkspaceSurface>
  );
}