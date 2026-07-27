import type {
  AdvisorBriefPreference,
} from "@/lib/advisor-briefing/types";

function normalizeTime(
  value: string,
) {
  const match =
    value.match(
      /^(\d{1,2}):(\d{2})$/,
    );

  if (!match) {
    return "07:00";
  }

  const hour =
    Math.max(
      0,
      Math.min(
        23,
        Number(match[1]),
      ),
    );
  const minute =
    Math.max(
      0,
      Math.min(
        59,
        Number(match[2]),
      ),
    );

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
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

function scheduledMinutes(localTime: string) {
  const [hour, minute] = normalizeTime(localTime)
    .split(":")
    .map(Number);
  return hour * 60 + minute;
}

export function isAdvisorBriefDue(
  preference: AdvisorBriefPreference,
  now = new Date(),
) {
  if (!preference.enabled) {
    return false;
  }

  const current = localDateParts(now, preference.timezone);

  if (
    preference.weekdaysOnly &&
    (current.weekday === 0 || current.weekday === 6)
  ) {
    return false;
  }

  if (preference.scheduleMode === "Interval") {
    const lastRun =
      preference.lastScheduledRunAt ??
      preference.lastGeneratedAt;

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
    preference.lastScheduledRunAt ??
    preference.lastGeneratedAt;

  if (!lastRun) {
    return true;
  }

  const last = localDateParts(
    new Date(lastRun),
    preference.timezone,
  );

  if (preference.scheduleMode === "Weekly") {
    return (
      current.dateKey !== last.dateKey &&
      now.getTime() - Date.parse(lastRun) >= 6 * 86_400_000
    );
  }

  return current.dateKey !== last.dateKey;
}

export function advisorBriefScheduleLabel(
  preference: AdvisorBriefPreference,
) {
  if (!preference.enabled) {
    return "Autonomous briefing paused";
  }

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
    return `${days[preference.weeklyDay]} at ${
      preference.localTime
    } ${preference.timezone}`;
  }

  return `${preference.scheduleMode} at ${preference.localTime} ${preference.timezone}`;
}