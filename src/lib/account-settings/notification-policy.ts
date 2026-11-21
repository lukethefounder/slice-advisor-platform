/** Delivery filtering shared by the simulated queue and the real advisor email path. */
export type DeliveryPreference = {
  channel: string; enabled: boolean; minScore: number; minUrgency: string; digestOnly: boolean;
  quietHoursStart: string | null; quietHoursEnd: string | null; cooldownMinutes: number;
};
export function urgencyRank(urgency: string) {
  return ["low", "medium", "high", "critical"].indexOf(urgency.toLowerCase()) + 1;
}
export function isWithinQuietHours(start: string | null, end: string | null, timezone: string, now: Date) {
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!start || !end || !clock.test(start) || !clock.test(end) || start === end) return false;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    // Corrupt historical time zones cannot crash an alert job; account writes validate IANA zones.
    parts = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  }
  const current = Number(parts.find(part => part.type === "hour")?.value) * 60 + Number(parts.find(part => part.type === "minute")?.value);
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const from = minutes(start), to = minutes(end);
  // Start inclusive, end exclusive, including intervals that cross midnight and DST transitions.
  return from < to ? current >= from && current < to : current >= from || current < to;
}
export function notificationRuleDecision(
  alert: { score: number; urgency: string }, preference: DeliveryPreference, timezone: string, now: Date,
) {
  if (!preference.enabled) return { allowed: false, reason: "Channel disabled." };
  if (preference.digestOnly) return { allowed: false, reason: "Digest-only channel." };
  if (!Number.isFinite(alert.score) || alert.score < preference.minScore) return { allowed: false, reason: `Alert score ${alert.score} is below channel threshold ${preference.minScore}.` };
  if (urgencyRank(alert.urgency) < urgencyRank(preference.minUrgency)) return { allowed: false, reason: `Urgency ${alert.urgency} is below channel minimum ${preference.minUrgency}.` };
  if (preference.channel !== "Dashboard" && isWithinQuietHours(preference.quietHoursStart, preference.quietHoursEnd, timezone, now)) return { allowed: false, reason: `Quiet hours active in ${timezone}.` };
  return { allowed: true, reason: "Passed delivery rules." };
}
