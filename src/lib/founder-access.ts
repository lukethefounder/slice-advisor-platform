export const TEMP_FOUNDER_EMAIL = "";
export const TEMP_FOUNDER_PASSWORD = "";
export const TEMP_FOUNDER_NAME = "";

export const TEMP_FIRM_ADVISOR_EMAIL = "";
export const TEMP_FIRM_ADVISOR_PASSWORD = "";
export const TEMP_FIRM_ADVISOR_NAME = "";

export const TEMP_FIRM_NAME = "";
export const TEMP_FIRM_EMAIL = "";
export const TEMP_FIRM_CODE = "";

export function temporaryLoginsEnabled() {
  return false;
}

export function founderEmails() {
  return Array.from(
    new Set(
      (process.env.SLICE_FOUNDER_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function isFounderEmail(email: string) {
  return founderEmails().includes(email.trim().toLowerCase());
}

export function canUseTemporaryFounderBootstrap() {
  return false;
}