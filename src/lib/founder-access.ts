export const TEMP_FOUNDER_EMAIL = "founder@slice.local";
export const TEMP_FOUNDER_PASSWORD = "SliceFounder!2026";
export const TEMP_FOUNDER_NAME = "Founder Admin";

export function founderEmails() {
  const envEmails = (process.env.SLICE_FOUNDER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const temporaryFounderEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEMP_FOUNDER === "true";

  if (temporaryFounderEnabled) {
    return Array.from(new Set([...envEmails, TEMP_FOUNDER_EMAIL]));
  }

  return envEmails;
}

export function isFounderEmail(email: string) {
  return founderEmails().includes(email.trim().toLowerCase());
}

export function canUseTemporaryFounderBootstrap() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEMP_FOUNDER === "true"
  );
}