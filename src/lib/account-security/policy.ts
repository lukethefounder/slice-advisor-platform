export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
export const DEFAULT_IDLE_MINUTES = 30;

export function passwordProblem(value: unknown): string | null {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) return "Use a password or passphrase with 15–128 characters. Spaces and password managers are supported.";
  if (!value.trim()) return "Use a password that contains more than spaces.";
  return null;
}

export function sessionLifetimeMinutes(policy: number | null | undefined, configuredHours: unknown): number {
  const parsed = Number(configuredHours);
  const serverMinutes = Number.isFinite(parsed) && parsed >= 1 ? Math.max(60, Math.min(43_200, Math.round(parsed) * 60)) : 720;
  const chosen = Number.isInteger(policy) && policy! >= 15 && policy! <= 43_200 ? policy! : 720;
  return Math.min(serverMinutes, chosen);
}

export function idleLifetimeMinutes(value: number | null | undefined): number {
  return Number.isInteger(value) && value! >= 5 && value! <= 1440 ? value! : DEFAULT_IDLE_MINUTES;
}

export function sessionIsExpired(
  session: { createdAt: Date; expiresAt: Date; lastSeenAt?: Date | null; mfaVerifiedAt?: Date | null },
  policy: { sessionTimeoutMinutes?: number | null; idleTimeoutMinutes?: number | null; mfaEnabledAt?: Date | null },
  now: number,
  configuredHours?: unknown,
): boolean {
  const created = session.createdAt.getTime(), lastSeen = (session.lastSeenAt ?? session.createdAt).getTime();
  if (![created, lastSeen, session.expiresAt.getTime(), now].every(Number.isFinite)) return true;
  if (created > now + 60_000 || lastSeen > now + 60_000) return true;
  if (session.expiresAt.getTime() <= now || created + sessionLifetimeMinutes(policy.sessionTimeoutMinutes, configuredHours) * 60_000 <= now) return true;
  if (lastSeen + idleLifetimeMinutes(policy.idleTimeoutMinutes) * 60_000 <= now) return true;
  if (policy.mfaEnabledAt && (!session.mfaVerifiedAt || !Number.isFinite(session.mfaVerifiedAt.getTime()) || !Number.isFinite(policy.mfaEnabledAt.getTime()) || session.mfaVerifiedAt.getTime() < policy.mfaEnabledAt.getTime())) return true;
  return false;
}
