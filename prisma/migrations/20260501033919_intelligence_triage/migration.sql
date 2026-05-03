-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "retainedCount" INTEGER NOT NULL DEFAULT 0,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "digestCount" INTEGER NOT NULL DEFAULT 0,
    "discardedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeadlineDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceTier" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "importanceTier" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "materialityScore" INTEGER NOT NULL,
    "relevanceScore" INTEGER NOT NULL,
    "trustScore" INTEGER NOT NULL,
    "matchedTickersJson" TEXT NOT NULL DEFAULT '[]',
    "matchedAreasJson" TEXT NOT NULL DEFAULT '[]',
    "reasonsJson" TEXT NOT NULL DEFAULT '[]',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeadlineDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "lastFetchedAt" DATETIME,
    "lastSeenHash" TEXT,
    "lastStatus" TEXT NOT NULL DEFAULT 'Pending',
    "lastItemCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IntelligenceRun_userId_idx" ON "IntelligenceRun"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceRun_createdAt_idx" ON "IntelligenceRun"("createdAt");

-- CreateIndex
CREATE INDEX "HeadlineDecision_userId_idx" ON "HeadlineDecision"("userId");

-- CreateIndex
CREATE INDEX "HeadlineDecision_userId_createdAt_idx" ON "HeadlineDecision"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HeadlineDecision_userId_importanceTier_idx" ON "HeadlineDecision"("userId", "importanceTier");

-- CreateIndex
CREATE INDEX "HeadlineDecision_expiresAt_idx" ON "HeadlineDecision"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HeadlineDecision_userId_dedupeKey_key" ON "HeadlineDecision"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCheckpoint_sourceId_key" ON "SourceCheckpoint"("sourceId");
