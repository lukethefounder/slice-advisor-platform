import type {
  AdvisorBriefPreference,
} from "@/lib/advisor-briefing/types";

function normalizeTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return "07:00";

  const hour = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dateKey: `${read("year")}-${read("month")}-${read("day")}`,
    weekday: weekdays[read("weekday")] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

function scheduledMinutes(localTime: string) {
  const [hour, minute] = normalizeTime(localTime).split(":").map(Number);
  return hour * 60 + minute;
}

function validDate(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

export function isAdvisorBriefDue(
  preference: AdvisorBriefPreference,
  now = new Date(),
) {
  if (!preference.enabled) return false;

  const current = localDateParts(now, preference.timezone);

  if (
    preference.weekdaysOnly &&
    (current.weekday === 0 || current.weekday === 6)
  ) {
    return false;
  }

  if (preference.scheduleMode === "Interval") {
    const lastRun =
      preference.lastScheduledRunAt ?? preference.lastGeneratedAt;

    return !lastRun
      ? true
      : now.getTime() - Date.parse(lastRun) >=
          preference.intervalMinutes * 60_000;
  }

  if (current.minutes < scheduledMinutes(preference.localTime)) {
    return false;
  }

  if (
    preference.scheduleMode === "Weekdays" &&
    (current.weekday === 0 || current.weekday === 6)
  ) {
    return false;
  }

  if (
    preference.scheduleMode === "Weekly" &&
    current.weekday !== preference.weeklyDay
  ) {
    return false;
  }

  const lastRun =
    preference.lastScheduledRunAt ?? preference.lastGeneratedAt;

  if (!lastRun) return true;

  const last = localDateParts(new Date(lastRun), preference.timezone);

  if (preference.scheduleMode === "Weekly") {
    return (
      current.dateKey !== last.dateKey &&
      now.getTime() - Date.parse(lastRun) >= 6 * 86_400_000
    );
  }

  return current.dateKey !== last.dateKey;
}

export function advisorBriefOccurrenceKey(
  preference: AdvisorBriefPreference,
  now = new Date(),
) {
  if (preference.scheduleMode === "Interval") {
    const intervalMs = Math.max(preference.intervalMinutes, 15) * 60_000;
    return `interval:${Math.floor(now.getTime() / intervalMs)}`;
  }

  const local = localDateParts(now, preference.timezone);
  return `${preference.scheduleMode.toLowerCase()}:${local.dateKey}`;
}

export function nextAdvisorBriefRunAt(
  preference: AdvisorBriefPreference,
  from = new Date(),
): string | null {
  if (!preference.enabled) return null;

  if (preference.scheduleMode === "Interval") {
    const last = validDate(
      preference.lastScheduledRunAt ?? preference.lastGeneratedAt,
    );
    const next = last
      ? new Date(last.getTime() + preference.intervalMinutes * 60_000)
      : from;

    return new Date(Math.max(next.getTime(), from.getTime())).toISOString();
  }

  const targetMinutes = scheduledMinutes(preference.localTime);
  const searchStart = new Date(Math.floor(from.getTime() / 60_000) * 60_000);
  const maximumMinutes = 8 * 24 * 60;

  for (let offset = 0; offset <= maximumMinutes; offset += 1) {
    const candidate = new Date(searchStart.getTime() + offset * 60_000);
    const local = localDateParts(candidate, preference.timezone);
    const weekend = local.weekday === 0 || local.weekday === 6;

    if (local.minutes !== targetMinutes) continue;
    if (preference.weekdaysOnly && weekend) continue;
    if (preference.scheduleMode === "Weekdays" && weekend) continue;
    if (
      preference.scheduleMode === "Weekly" &&
      local.weekday !== preference.weeklyDay
    ) {
      continue;
    }

    const lastRun = validDate(
      preference.lastScheduledRunAt ?? preference.lastGeneratedAt,
    );

    if (lastRun) {
      const lastLocal = localDateParts(lastRun, preference.timezone);
      if (lastLocal.dateKey === local.dateKey) continue;
    }

    return candidate.toISOString();
  }

  return null;
}

export function advisorBriefScheduleLabel(
  preference: AdvisorBriefPreference,
) {
  if (!preference.enabled) return "Automatic briefing paused";

  if (preference.scheduleMode === "Interval") {
    return preference.intervalMinutes < 60
      ? `Every ${preference.intervalMinutes} minutes`
      : `Every ${Number(
          (preference.intervalMinutes / 60).toFixed(2),
        )} hours`;
  }

  if (preference.scheduleMode === "Weekly") {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `${days[preference.weeklyDay]} at ${preference.localTime} ${preference.timezone}`;
  }

  return `${preference.scheduleMode} at ${preference.localTime} ${preference.timezone}`;
}