import "server-only";
import { ensureUserSecuritySetting, getDisclosureStatus } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { canUseTemporaryFounderBootstrap } from "@/lib/founder-access";
import { mfaEncryptionConfigured, parseRecoveryHashes } from "./crypto";
import { sessionIsExpired, sessionLifetimeMinutes } from "./policy";
import type { SecurityCheck, SecurityOverview } from "./contracts";

export async function securityOverview(user: { id: string; name: string; email: string }, currentSessionId: string): Promise<SecurityOverview> {
  const [setting, factor, sessions, disclosures, auditLogs] = await Promise.all([
    ensureUserSecuritySetting(user.id),
    prisma.userAuthenticator.findUnique({ where: { userId: user.id }, select: { enabledAt: true, pendingExpiresAt: true, recoveryCodeHashesJson: true } }),
    prisma.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, take: 30, select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true, mfaVerifiedAt: true } }),
    getDisclosureStatus(user),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 150, select: { id: true, eventType: true, severity: true, area: true, title: true, detail: true, createdAt: true } }),
  ]);
  const now = Date.now(), enabled = Boolean(factor?.enabledAt), configured = mfaEncryptionConfigured();
  const recoveryCodesRemaining = factor?.enabledAt ? parseRecoveryHashes(factor.recoveryCodeHashesJson).length : 0;
  const production = process.env.NODE_ENV === "production";
  const failOpen = ["true", "1", "yes", "on"].includes(String(process.env.SECURITY_RATE_LIMIT_FAIL_OPEN ?? "false").toLowerCase());
  const rateKey = Boolean(process.env.SECURITY_PEPPER?.trim() || process.env.SLICE_SECRET_ENCRYPTION_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim());
  const checks: SecurityCheck[] = [
    { id: "mfa", label: "Authenticator verification", state: enabled ? "protected" : "attention", detail: enabled ? "A verified authenticator is required at sign in, including existing-account invitation acceptance. Each code can be used once." : "Your account currently signs in with a password. Enroll an authenticator to add a second factor.", action: enabled ? undefined : "Set up authenticator" },
    { id: "recovery", label: "Account recovery codes", state: enabled && recoveryCodesRemaining > 0 ? "protected" : "attention", detail: enabled ? `${recoveryCodesRemaining} unused recovery codes remain. Codes are stored as hashes and work once.` : "Recovery codes are issued after authenticator confirmation. Save them somewhere you can access if your phone is unavailable." },
    { id: "reauth", label: "Sensitive changes", state: "protected", detail: "Password changes, authenticator changes, and session revocation require your current password and enrolled second factor." },
    { id: "sessions", label: "Session expiration", state: "protected", detail: `Sessions expire after at most ${sessionLifetimeMinutes(setting.sessionTimeoutMinutes, process.env.SESSION_TTL_HOURS)} minutes, or ${setting.idleTimeoutMinutes} minutes without an authenticated request. Revocation is checked by the server.` },
    { id: "encryption", label: "Authenticator encryption key", state: configured ? "protected" : "attention", detail: configured ? "The server has a valid key for encrypting authenticator seeds. This verifies configuration, not the security of the deployment's secret storage." : "A platform owner must set MFA_ENCRYPTION_KEY before authenticator enrollment is available." },
    { id: "cookies", label: "Browser session cookie", state: production ? "protected" : "development", detail: production ? "Production sessions use Secure, HttpOnly, and SameSite=Strict cookies." : "Local development uses HttpOnly and SameSite=Strict cookies. The Secure flag is enabled in production over HTTPS." },
    { id: "rate", label: "Distributed request protection", state: production && rateKey && !failOpen ? "protected" : "development", detail: production && rateKey && !failOpen ? "Sensitive verification uses persistent PostgreSQL rate limits and fails closed when the limiter is unavailable." : "Development or fallback configuration is active. Check the security secret, database limiter, and fail-open setting before deployment." },
    { id: "bootstrap", label: "Temporary founder access", state: canUseTemporaryFounderBootstrap() ? "attention" : "protected", detail: canUseTemporaryFounderBootstrap() ? "Temporary founder bootstrap is enabled and requires review." : "The temporary founder bootstrap is disabled." },
  ];
  return {
    user: { id: user.id, name: user.name, email: user.email },
    securitySetting: { id: setting.id, mfaEnabled: enabled, requireReauthForSensitiveActions: true, alertOnNewLogin: setting.alertOnNewLogin, advisorModeEnabled: setting.advisorModeEnabled, sessionTimeoutMinutes: setting.sessionTimeoutMinutes, idleTimeoutMinutes: setting.idleTimeoutMinutes, lastSecurityReviewAt: setting.lastSecurityReviewAt?.toISOString() ?? null },
    authenticator: { enabled, configured, enabledAt: factor?.enabledAt?.toISOString() ?? null, recoveryCodesRemaining, setupPending: Boolean(factor?.pendingExpiresAt && factor.pendingExpiresAt.getTime() > now && !enabled) },
    effectiveSessionMinutes: sessionLifetimeMinutes(setting.sessionTimeoutMinutes, process.env.SESSION_TTL_HOURS),
    sessions: sessions.filter(value => !sessionIsExpired(value, { ...setting, mfaEnabledAt: factor?.enabledAt }, now, process.env.SESSION_TTL_HOURS)).map(value => ({ id: value.id, current: value.id === currentSessionId, createdAt: value.createdAt.toISOString(), lastSeenAt: value.lastSeenAt.toISOString(), expiresAt: new Date(Math.min(value.expiresAt.getTime(), value.createdAt.getTime() + sessionLifetimeMinutes(setting.sessionTimeoutMinutes, process.env.SESSION_TTL_HOURS) * 60_000)).toISOString(), userAgent: value.userAgent, mfaVerified: Boolean(value.mfaVerifiedAt) })),
    checks,
    disclosures: disclosures.map(value => ({ ...value, acceptedAt: value.acceptedAt?.toISOString() ?? null })),
    auditLogs: auditLogs.map(value => ({ ...value, createdAt: value.createdAt.toISOString() })),
    stats: { totalAuditLogs: auditLogs.length, criticalLogs: auditLogs.filter(value => ["Critical", "High"].includes(value.severity)).length, warningLogs: auditLogs.filter(value => ["Warning", "Medium"].includes(value.severity)).length, acceptedDisclosures: disclosures.filter(value => value.accepted).length, requiredDisclosures: disclosures.length },
    checkedAt: new Date(now).toISOString(),
  };
}
