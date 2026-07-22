-- Slice advisor-to-client routing
-- Adds:
-- 1. Firm-scoped client ownership
-- 2. Assigned-advisor routing
-- 3. Advisor-specific Calendly settings
-- 4. Secure client portal invitations and sessions
-- 5. Individual advisor inbox routing
-- 6. Client assignment audit history
--
-- Every statement is intentionally idempotent so this migration can safely
-- repair a database even when Prisma migration history and the live database
-- have temporarily drifted apart.

ALTER TABLE "ClientProfile"
  ADD COLUMN IF NOT EXISTS "firmId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAdvisorMembershipId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAdvisorAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredContactMethod" TEXT NOT NULL DEFAULT 'Portal + email',
  ADD COLUMN IF NOT EXISTS "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "portalInviteCodeHash" TEXT,
  ADD COLUMN IF NOT EXISTS "portalInviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "portalOnboardingStatus" TEXT NOT NULL DEFAULT 'Not Invited',
  ADD COLUMN IF NOT EXISTS "portalLastLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "FirmMembership"
  ADD COLUMN IF NOT EXISTS "calendlyUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "calendlyLabel" TEXT NOT NULL DEFAULT 'Schedule a meeting',
  ADD COLUMN IF NOT EXISTS "calendlyEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AdvisorClientInboxItem" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "assignedAdvisorMembershipId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'Message',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Unread',
  "priority" TEXT NOT NULL DEFAULT 'Medium',
  "sourceEventId" TEXT NOT NULL,
  "senderName" TEXT,
  "senderEmail" TEXT,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "readAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdvisorClientInboxItem_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorClientInboxReply" (
  "id" TEXT NOT NULL,
  "inboxItemId" TEXT NOT NULL,
  "advisorMembershipId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdvisorClientInboxReply_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientAdvisorAssignmentAudit" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "previousAdvisorMembershipId" TEXT,
  "nextAdvisorMembershipId" TEXT NOT NULL,
  "changedByUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientAdvisorAssignmentAudit_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientPortalSession" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientPortalSession_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientProfile_firmId_idx"
  ON "ClientProfile"("firmId");

CREATE INDEX IF NOT EXISTS "ClientProfile_assignedAdvisorMembershipId_idx"
  ON "ClientProfile"("assignedAdvisorMembershipId");

CREATE INDEX IF NOT EXISTS "ClientProfile_portalInviteCodeHash_idx"
  ON "ClientProfile"("portalInviteCodeHash");

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorClientInboxItem_firmId_sourceEventId_key"
  ON "AdvisorClientInboxItem"("firmId", "sourceEventId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxItem_firmId_idx"
  ON "AdvisorClientInboxItem"("firmId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxItem_clientId_idx"
  ON "AdvisorClientInboxItem"("clientId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxItem_assignedAdvisorMembershipId_idx"
  ON "AdvisorClientInboxItem"("assignedAdvisorMembershipId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxItem_status_idx"
  ON "AdvisorClientInboxItem"("status");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxItem_createdAt_idx"
  ON "AdvisorClientInboxItem"("createdAt");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxReply_inboxItemId_idx"
  ON "AdvisorClientInboxReply"("inboxItemId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxReply_advisorMembershipId_idx"
  ON "AdvisorClientInboxReply"("advisorMembershipId");

CREATE INDEX IF NOT EXISTS "AdvisorClientInboxReply_createdAt_idx"
  ON "AdvisorClientInboxReply"("createdAt");

CREATE INDEX IF NOT EXISTS "ClientAdvisorAssignmentAudit_firmId_idx"
  ON "ClientAdvisorAssignmentAudit"("firmId");

CREATE INDEX IF NOT EXISTS "ClientAdvisorAssignmentAudit_clientId_idx"
  ON "ClientAdvisorAssignmentAudit"("clientId");

CREATE INDEX IF NOT EXISTS "ClientAdvisorAssignmentAudit_nextAdvisorMembershipId_idx"
  ON "ClientAdvisorAssignmentAudit"("nextAdvisorMembershipId");

CREATE INDEX IF NOT EXISTS "ClientAdvisorAssignmentAudit_createdAt_idx"
  ON "ClientAdvisorAssignmentAudit"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalSession_tokenHash_key"
  ON "ClientPortalSession"("tokenHash");

CREATE INDEX IF NOT EXISTS "ClientPortalSession_clientId_idx"
  ON "ClientPortalSession"("clientId");

CREATE INDEX IF NOT EXISTS "ClientPortalSession_expiresAt_idx"
  ON "ClientPortalSession"("expiresAt");