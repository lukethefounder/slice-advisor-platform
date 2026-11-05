-- Additive only. No DROP/TRUNCATE and no changes to existing Slice tables.
CREATE TABLE "SliceResearchDataset" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL,
 "symbol" TEXT NOT NULL, "currency" TEXT NOT NULL, "endpoint" TEXT NOT NULL,
 "sourceSha256" TEXT NOT NULL, "identityJson" TEXT NOT NULL, "rawJson" TEXT NOT NULL, "barCount" INTEGER NOT NULL,
 "firstDate" TEXT NOT NULL, "lastDate" TEXT NOT NULL, "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SliceResearchDataset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SliceResearchDataset_userId_symbol_retrievedAt_idx" ON "SliceResearchDataset"("userId", "symbol", "retrievedAt");
CREATE TABLE "SliceStrategyDefinition" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "specJson" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SliceStrategyDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SliceStrategyDefinition_userId_updatedAt_idx" ON "SliceStrategyDefinition"("userId", "updatedAt");
CREATE TABLE "SliceStrategyRun" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "engineVersion" TEXT NOT NULL,
 "inputSha256" TEXT NOT NULL, "outputSha256" TEXT NOT NULL, "datasetIdsJson" TEXT NOT NULL,
 "resultJson" TEXT NOT NULL, "summaryJson" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SliceStrategyRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SliceStrategyRun_userId_createdAt_idx" ON "SliceStrategyRun"("userId", "createdAt");
CREATE TABLE "SliceProviderQuota" (
 "id" TEXT NOT NULL, "day" TEXT NOT NULL, "requests" INTEGER NOT NULL, "nextAllowedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SliceProviderQuota_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SliceForecastBundle" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "symbol" TEXT NOT NULL, "researchRunId" TEXT NOT NULL,
 "forecastRunId" TEXT, "status" TEXT NOT NULL, "provider" TEXT NOT NULL, "inputSha256" TEXT NOT NULL,
 "outputSha256" TEXT, "snapshotJson" TEXT NOT NULL, "forecastJson" TEXT,
 "researchJson" TEXT NOT NULL, "graphJson" TEXT NOT NULL, "operationsJson" TEXT,
 "asOfAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SliceForecastBundle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SliceForecastBundle_userId_researchRunId_key" ON "SliceForecastBundle"("userId", "researchRunId");
CREATE INDEX "SliceForecastBundle_userId_symbol_createdAt_idx" ON "SliceForecastBundle"("userId", "symbol", "createdAt");
-- Block access through a public PostgREST/browser role when hosted on Supabase.
-- Prisma must connect with the appropriate server role, as the existing application does.
ALTER TABLE "SliceResearchDataset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceStrategyDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceStrategyRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceProviderQuota" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceForecastBundle" ENABLE ROW LEVEL SECURITY;
