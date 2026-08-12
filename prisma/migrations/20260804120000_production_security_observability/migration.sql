-- Phase 12: durable security rate limiting and privacy-bounded Web Vitals.
-- Additive migration. Existing business records are not rewritten.

SET lock_timeout = '5s';
SET statement_timeout = '15min';

CREATE TABLE IF NOT EXISTS "SecurityRateLimitBucket" (
  "keyHash" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "limit" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityRateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX IF NOT EXISTS "SecurityRateLimit_scope_resetAt_idx"
  ON "SecurityRateLimitBucket"("scope", "resetAt");
CREATE INDEX IF NOT EXISTS "SecurityRateLimit_resetAt_idx"
  ON "SecurityRateLimitBucket"("resetAt");

CREATE TABLE IF NOT EXISTS "WebVitalSample" (
  "id" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "rating" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "navigationType" TEXT,
  "sessionHash" TEXT,
  "deviceClass" TEXT,
  "connectionType" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'unknown',
  "deploymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebVitalSample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebVitalSample_metricId_name_key"
  ON "WebVitalSample"("metricId", "name");
CREATE INDEX IF NOT EXISTS "WebVitalSample_name_createdAt_idx"
  ON "WebVitalSample"("name", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WebVitalSample_route_name_createdAt_idx"
  ON "WebVitalSample"("route", "name", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WebVitalSample_createdAt_idx"
  ON "WebVitalSample"("createdAt");