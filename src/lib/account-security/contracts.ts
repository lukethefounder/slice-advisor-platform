export type SecurityCheck = { id: string; label: string; state: "protected" | "attention" | "development"; detail: string; action?: string };
export type SecurityOverview = {
  user: { id: string; name: string; email: string };
  securitySetting: { id: string; mfaEnabled: boolean; requireReauthForSensitiveActions: boolean; alertOnNewLogin: boolean; advisorModeEnabled: boolean; sessionTimeoutMinutes: number; idleTimeoutMinutes: number; lastSecurityReviewAt: string | null };
  authenticator: { enabled: boolean; configured: boolean; enabledAt: string | null; recoveryCodesRemaining: number; setupPending: boolean };
  sessions: Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string | null; mfaVerified: boolean }>;
  effectiveSessionMinutes: number;
  checks: SecurityCheck[];
  disclosures: Array<{ disclosureKey: string; title: string; version: string; content: string; accepted: boolean; acceptedAt: string | null }>;
  auditLogs: Array<{ id: string; eventType: string; severity: string; area: string; title: string; detail: string | null; createdAt: string }>;
  stats: { totalAuditLogs: number; criticalLogs: number; warningLogs: number; acceptedDisclosures: number; requiredDisclosures: number };
  checkedAt: string;
};
