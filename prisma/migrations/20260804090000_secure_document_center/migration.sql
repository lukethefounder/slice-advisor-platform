-- Phase 9: private document storage metadata and immutable access audit.
-- This migration is additive. Existing metadata-only document records are preserved.

SET lock_timeout = '5s';
SET statement_timeout = '15min';

ALTER TABLE "DocumentVaultItem"
  ADD COLUMN IF NOT EXISTS "firmId" TEXT,
  ADD COLUMN IF NOT EXISTS "fileExtension" TEXT,
  ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'Vercel Blob',
  ADD COLUMN IF NOT EXISTS "storagePath" TEXT,
  ADD COLUMN IF NOT EXISTS "storageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "contentType" TEXT,
  ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "etag" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'AdvisorOnly',
  ADD COLUMN IF NOT EXISTS "uploadedByType" TEXT NOT NULL DEFAULT 'Advisor',
  ADD COLUMN IF NOT EXISTS "uploadedByClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'Not Required',
  ADD COLUMN IF NOT EXISTS "processingError" TEXT,
  ADD COLUMN IF NOT EXISTS "securityStatus" TEXT NOT NULL DEFAULT 'Not Checked',
  ADD COLUMN IF NOT EXISTS "classificationJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "metadataJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "extractedTextEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastViewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DocumentVaultItem" AS document
SET "firmId" = client."firmId"
FROM "ClientProfile" AS client
WHERE document."clientId" = client."id"
  AND document."firmId" IS NULL
  AND client."firmId" IS NOT NULL;

ALTER TABLE "DocumentVaultItem"
  DROP CONSTRAINT IF EXISTS "DocumentVaultItem_clientId_fkey";

ALTER TABLE "DocumentVaultItem"
  ADD CONSTRAINT "DocumentVaultItem_clientId_fkey"
  FOREIGN KEY ("clientId")
  REFERENCES "ClientProfile"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DocumentAuditEvent" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "firmId" TEXT,
  "clientId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorClientId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentAuditEvent_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DocumentAuditEvent_documentId_fkey'
  ) THEN
    ALTER TABLE "DocumentAuditEvent"
      ADD CONSTRAINT "DocumentAuditEvent_documentId_fkey"
      FOREIGN KEY ("documentId")
      REFERENCES "DocumentVaultItem"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentVault_storagePath_key"
  ON "DocumentVaultItem"("storagePath");

CREATE INDEX IF NOT EXISTS "DocumentVault_user_status_createdAt_idx"
  ON "DocumentVaultItem"("userId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentVault_client_createdAt_idx"
  ON "DocumentVaultItem"("clientId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentVault_firm_status_createdAt_idx"
  ON "DocumentVaultItem"("firmId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentVault_firm_client_createdAt_idx"
  ON "DocumentVaultItem"("firmId", "clientId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentVault_sha256_idx"
  ON "DocumentVaultItem"("sha256");

CREATE INDEX IF NOT EXISTS "DocumentVault_processing_createdAt_idx"
  ON "DocumentVaultItem"("processingStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "DocumentAudit_document_createdAt_idx"
  ON "DocumentAuditEvent"("documentId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentAudit_firm_createdAt_idx"
  ON "DocumentAuditEvent"("firmId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentAudit_actorUser_createdAt_idx"
  ON "DocumentAuditEvent"("actorUserId", "createdAt" DESC);