-- CreateTable
CREATE TABLE "NewsSourceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceTier" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minScoreToRetain" INTEGER NOT NULL DEFAULT 55,
    "minScoreToAlert" INTEGER NOT NULL DEFAULT 88,
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 25,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NewsSourceConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceRetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "minScoreToStore" INTEGER NOT NULL DEFAULT 55,
    "minScoreToAlert" INTEGER NOT NULL DEFAULT 88,
    "maxRetainedPerRun" INTEGER NOT NULL DEFAULT 40,
    "maxRetainedDecisions" INTEGER NOT NULL DEFAULT 600,
    "maxRetainedRuns" INTEGER NOT NULL DEFAULT 50,
    "maxAlertEvents" INTEGER NOT NULL DEFAULT 400,
    "urgentRetentionDays" INTEGER NOT NULL DEFAULT 45,
    "reviewRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "digestRetentionDays" INTEGER NOT NULL DEFAULT 14,
    "watchRetentionDays" INTEGER NOT NULL DEFAULT 5,
    "readAlertRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntelligenceRetentionPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NewsSourceConfig_userId_idx" ON "NewsSourceConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSourceConfig_userId_sourceId_key" ON "NewsSourceConfig"("userId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceRetentionPolicy_userId_key" ON "IntelligenceRetentionPolicy"("userId");
