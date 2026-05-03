-- CreateTable
CREATE TABLE "OpportunitySignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "headlineDecisionId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sourceName" TEXT NOT NULL,
    "signalType" TEXT NOT NULL DEFAULT 'Review',
    "priorityTier" TEXT NOT NULL DEFAULT 'Medium',
    "portfolioRelevanceScore" INTEGER NOT NULL DEFAULT 0,
    "opportunityScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "actionabilityScore" INTEGER NOT NULL DEFAULT 0,
    "compositeScore" INTEGER NOT NULL DEFAULT 0,
    "tickersJson" TEXT NOT NULL DEFAULT '[]',
    "categoriesJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "suggestedAction" TEXT NOT NULL,
    "advisorNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpportunitySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunitySignal_headlineDecisionId_fkey" FOREIGN KEY ("headlineDecisionId") REFERENCES "HeadlineDecision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OpportunitySignal_userId_idx" ON "OpportunitySignal"("userId");

-- CreateIndex
CREATE INDEX "OpportunitySignal_status_idx" ON "OpportunitySignal"("status");

-- CreateIndex
CREATE INDEX "OpportunitySignal_priorityTier_idx" ON "OpportunitySignal"("priorityTier");

-- CreateIndex
CREATE INDEX "OpportunitySignal_compositeScore_idx" ON "OpportunitySignal"("compositeScore");

-- CreateIndex
CREATE INDEX "OpportunitySignal_createdAt_idx" ON "OpportunitySignal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySignal_userId_dedupeKey_key" ON "OpportunitySignal"("userId", "dedupeKey");
