/** Public account preferences. Authentication material never belongs in this contract. */
export type AppearanceSettings = {
  mode: "dark" | "light" | "system";
  density: "comfortable" | "compact" | "spacious";
  accent: "market-green" | "emerald" | "teal" | "graphite" | "blue";
  cardStyle: "glass" | "solid" | "minimal";
  navigationStyle: "executive" | "compact" | "command";
  motion: "full" | "reduced";
  textScale: "standard" | "large" | "extra-large";
  compactSidebar: boolean;
  commandBarPinned: boolean;
};
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  mode: "dark", density: "comfortable", accent: "market-green", cardStyle: "glass",
  navigationStyle: "executive", motion: "full", textScale: "standard", compactSidebar: false, commandBarPinned: true,
};
export const NOTIFICATION_CHANNELS = ["Dashboard", "Email", "SMS", "Push", "Digest"] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];
export type NotificationPreference = {
  channel: NotificationChannel; enabled: boolean; minUrgency: "Low" | "Medium" | "High" | "Critical";
  minScore: number; digestOnly: boolean; quietHoursStart: string | null; quietHoursEnd: string | null; cooldownMinutes: number;
};
export const DEFAULT_NOTIFICATIONS: NotificationPreference[] = [
  { channel: "Dashboard", enabled: true, minUrgency: "Low", minScore: 0, digestOnly: false, quietHoursStart: null, quietHoursEnd: null, cooldownMinutes: 0 },
  { channel: "Email", enabled: true, minUrgency: "High", minScore: 75, digestOnly: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", cooldownMinutes: 30 },
  { channel: "SMS", enabled: false, minUrgency: "Critical", minScore: 88, digestOnly: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", cooldownMinutes: 60 },
  { channel: "Push", enabled: false, minUrgency: "High", minScore: 80, digestOnly: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", cooldownMinutes: 30 },
  { channel: "Digest", enabled: true, minUrgency: "Medium", minScore: 55, digestOnly: true, quietHoursStart: null, quietHoursEnd: null, cooldownMinutes: 0 },
];
export type AccountProfile = { id: string; name: string; email: string; phone: string; timezone: string; platformStatus: string; createdAt: string };
export type AccountSettingsResponse = {
  ok: true; account: AccountProfile; appearance: AppearanceSettings;
  privacy: { allowBrowserStorage: boolean; [key: string]: unknown };
  notifications: NotificationPreference[];
  security: { mfaEnabled: boolean; sessionTimeoutMinutes: number; lastSecurityReviewAt: string | null };
  memberships: Array<{ id: string; role: string; firmName: string }>;
  deliveries: Array<{ id: string; channel: string; status: string; simulated: boolean; createdAt: string; deliveredAt: string | null }>;
  revision: string | null;
};
export class SettingsValidationError extends Error {
  constructor(public code: string, message: string, public status = 422) { super(message); this.name = "SettingsValidationError"; }
}
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettingsValidationError("INVALID_SETTINGS", `${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function exactFields(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new SettingsValidationError("UNSUPPORTED_SETTINGS", `${label} contains unsupported fields. Refresh Settings before trying again.`);
}
function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) throw new SettingsValidationError("INVALID_SETTINGS", `${label} is not supported.`);
  return value as T;
}
function boolean(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new SettingsValidationError("INVALID_SETTINGS", `${label} must be enabled or disabled.`);
  return value;
}
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value))
    throw new SettingsValidationError("INVALID_SETTINGS", `${label} must contain ${min}–${max} printable characters.`);
  return value.trim();
}
function integer(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new SettingsValidationError("INVALID_SETTINGS", `${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function validateTimezone(value: unknown): string {
  const zone = text(value, "Time zone", 1, 100);
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); } catch { throw new SettingsValidationError("INVALID_TIMEZONE", "Choose a valid IANA time zone, such as America/Phoenix."); }
  return zone;
}
export function validateProfile(value: unknown, existingEmail: string) {
  const raw = object(value, "Profile"); exactFields(raw, ["name", "email", "phone", "timezone"], "Profile");
  if (raw.email !== undefined && raw.email !== existingEmail) throw new SettingsValidationError("EMAIL_VERIFICATION_REQUIRED", "Sign-in email cannot be changed here. An unverified address cannot replace the account identity.", 409);
  return { name: text(raw.name, "Name", 1, 120), email: existingEmail, phone: text(raw.phone, "Phone", 0, 50), timezone: validateTimezone(raw.timezone) };
}
export function validateAppearance(value: unknown): AppearanceSettings {
  const raw = object(value, "Appearance"); exactFields(raw, Object.keys(DEFAULT_APPEARANCE), "Appearance");
  return {
    mode: choice(raw.mode, ["dark", "light", "system"], "Theme"), density: choice(raw.density, ["comfortable", "compact", "spacious"], "Density"),
    accent: choice(raw.accent, ["market-green", "emerald", "teal", "graphite", "blue"], "Accent"), cardStyle: choice(raw.cardStyle, ["glass", "solid", "minimal"], "Panel style"),
    navigationStyle: choice(raw.navigationStyle, ["executive", "compact", "command"], "Navigation"), motion: choice(raw.motion, ["full", "reduced"], "Motion"),
    textScale: choice(raw.textScale, ["standard", "large", "extra-large"], "Text size"), compactSidebar: boolean(raw.compactSidebar, "Compact navigation"), commandBarPinned: boolean(raw.commandBarPinned, "Command bar"),
  };
}
export function validateNotifications(value: unknown): NotificationPreference[] {
  if (!Array.isArray(value) || value.length !== NOTIFICATION_CHANNELS.length) throw new SettingsValidationError("INVALID_CHANNELS", "Save one preference for each supported notification channel.");
  const seen = new Set<string>();
  return value.map(item => {
    const raw = object(item, "Notification"); exactFields(raw, ["channel", "enabled", "minUrgency", "minScore", "digestOnly", "quietHoursStart", "quietHoursEnd", "cooldownMinutes"], "Notification");
    const channel = choice(raw.channel, NOTIFICATION_CHANNELS, "Channel");
    if (seen.has(channel)) throw new SettingsValidationError("DUPLICATE_CHANNEL", "Each channel can appear only once."); seen.add(channel);
    const clock = (v: unknown) => v === null ? null : typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : (() => { throw new SettingsValidationError("INVALID_QUIET_HOURS", "Quiet hours use 24-hour HH:MM values."); })();
    const start = clock(raw.quietHoursStart), end = clock(raw.quietHoursEnd);
    if ((start === null) !== (end === null) || (start !== null && start === end)) throw new SettingsValidationError("INVALID_QUIET_HOURS", "Set both quiet-hour times, with different start and end times, or leave both off.");
    return { channel, enabled: boolean(raw.enabled, "Channel"), minUrgency: choice(raw.minUrgency, ["Low", "Medium", "High", "Critical"], "Urgency"),
      minScore: integer(raw.minScore, 0, 100, "Score threshold"), digestOnly: boolean(raw.digestOnly, "Digest-only preference"), quietHoursStart: start, quietHoursEnd: end,
      cooldownMinutes: integer(raw.cooldownMinutes, 0, 1440, "Cooldown") };
  });
}

/** Safely reads legacy metadata without letting old booleans impersonate security controls. */
export function readAccountPreferences(value: string | null | undefined) {
  let raw: Record<string, unknown> = {};
  try { const parsed = JSON.parse(value || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed; } catch { /* Defaults remain usable after a malformed preference record. */ }
  let appearance = { ...DEFAULT_APPEARANCE };
  if (raw.appearance && typeof raw.appearance === "object") {
    try { appearance = validateAppearance({ ...appearance, ...raw.appearance }); } catch { /* Validate the complete saved snapshot. */ }
  } else {
    if (["dark", "light", "system"].includes(String(raw.appearanceMode))) appearance.mode = raw.appearanceMode as AppearanceSettings["mode"];
    const density = String(raw.density ?? "").toLowerCase(); if (["comfortable", "compact", "spacious"].includes(density)) appearance.density = density as AppearanceSettings["density"];
    if (raw.accent === "Graphite") appearance.accent = "graphite";
  }
  let timezone = "America/Phoenix"; try { if (raw.timezone) timezone = validateTimezone(raw.timezone); } catch { /* Replace invalid historical time zones only in the public view. */ }
  const privacy = raw.privacy && typeof raw.privacy === "object" && !Array.isArray(raw.privacy) ? raw.privacy as Record<string, unknown> : {};
  const historical: Record<string, unknown> = {};
  for (const key of ["aiMemoryEnabled", "analyticsEnabled", "personalizationEnabled", "marketingEmailsEnabled", "shareUsageForImprovement", "showProfileToTeam", "maskClientNames", "maskBalances", "retainReports", "exportFormat"]) {
    if (typeof privacy[key] === "boolean" || (typeof privacy[key] === "string" && privacy[key].length <= 80)) historical[key] = privacy[key];
  }
  return { raw, phone: typeof raw.phone === "string" ? raw.phone.slice(0, 50) : "", timezone, appearance, privacy: { ...historical, allowBrowserStorage: privacy.allowBrowserStorage !== false } };
}
