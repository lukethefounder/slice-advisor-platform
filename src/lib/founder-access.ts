export const TEMP_FOUNDER_EMAIL = "founder@slice.local";
export const TEMP_FOUNDER_PASSWORD = "SliceFounder!2026";
export const TEMP_FOUNDER_NAME = "Founder Admin";

export const TEMP_FIRM_ADVISOR_EMAIL = "advisor@slice.local";
export const TEMP_FIRM_ADVISOR_PASSWORD = "SliceAdvisor!2026";
export const TEMP_FIRM_ADVISOR_NAME = "Demo Firm Advisor";

export const TEMP_FIRM_NAME = "Slice Demo Advisory";
export const TEMP_FIRM_EMAIL = "demo@slice.local";
export const TEMP_FIRM_CODE = "SLICE-DEMO-FIRM";

export function temporaryLoginsEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEMP_LOGINS === "true" ||
    process.env.ENABLE_TEMP_FOUNDER === "true"
  );
}

export function founderEmails() {
  const envEmails = (process.env.SLICE_FOUNDER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (temporaryLoginsEnabled()) {
    return Array.from(new Set([...envEmails, TEMP_FOUNDER_EMAIL]));
  }

  return envEmails;
}

export function isFounderEmail(email: string) {
  return founderEmails().includes(email.trim().toLowerCase());
}

export function canUseTemporaryFounderBootstrap() {
  return temporaryLoginsEnabled();
}