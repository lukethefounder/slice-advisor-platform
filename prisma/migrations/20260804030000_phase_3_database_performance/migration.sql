-- Slice Phase 3: database performance indexes
--
-- Additive only: this migration creates indexes and does not alter, delete,
-- rewrite, or backfill application data.
--
-- CREATE INDEX obtains a SHARE lock that can briefly block writes. Apply this
-- migration during a low-traffic deployment window. The short lock timeout
-- causes the deployment to fail rather than wait indefinitely behind a busy
-- transaction; rerun prisma migrate deploy after the conflicting transaction
-- finishes.

SET lock_timeout = '5s';
SET statement_timeout = '15min';

CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session" ("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session" ("expiresAt");
CREATE INDEX IF NOT EXISTS "FirmMembership_user_status_createdAt_idx" ON "FirmMembership" ("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "FirmMembership_firm_status_createdAt_idx" ON "FirmMembership" ("firmId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ClientProfile_firm_status_fullName_idx" ON "ClientProfile" ("firmId", "status", "fullName");
CREATE INDEX IF NOT EXISTS "ClientProfile_firm_advisor_status_name_idx" ON "ClientProfile" ("firmId", "assignedAdvisorMembershipId", "status", "fullName");
CREATE INDEX IF NOT EXISTS "AdvisorInbox_firm_advisor_createdAt_idx" ON "AdvisorClientInboxItem" ("firmId", "assignedAdvisorMembershipId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorInbox_firm_client_status_createdAt_idx" ON "AdvisorClientInboxItem" ("firmId", "clientId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorInboxReply_item_createdAt_idx" ON "AdvisorClientInboxReply" ("inboxItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClientAssignmentAudit_client_createdAt_idx" ON "ClientAdvisorAssignmentAudit" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationDelivery_user_status_createdAt_idx" ON "NotificationDelivery" ("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AlertEvent_user_status_createdAt_idx" ON "AlertEvent" ("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_user_createdAt_idx" ON "AuditLog" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MeetingTask_user_status_dueDate_idx" ON "MeetingTask" ("userId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "PortfolioHolding_client_createdAt_idx" ON "PortfolioHolding" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdvisorNote_client_createdAt_idx" ON "AdvisorNote" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MeetingTask_client_createdAt_idx" ON "MeetingTask" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RiskReview_client_createdAt_idx" ON "RiskReview" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentVault_user_status_createdAt_idx" ON "DocumentVaultItem" ("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentVault_client_createdAt_idx" ON "DocumentVaultItem" ("clientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RealtimePrice_symbol_provider_createdAt_idx" ON "RealtimePriceSnapshot" ("symbol", "provider", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RealtimePrice_user_symbol_createdAt_idx" ON "RealtimePriceSnapshot" ("userId", "symbol", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RealtimeInvestorNotification_user_status_createdAt_idx" ON "RealtimeInvestorNotification" ("userId", "status", "createdAt" DESC);

RESET statement_timeout;
RESET lock_timeout;