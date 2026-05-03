-- CreateTable
CREATE TABLE "BriefingReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'Investor',
    "briefType" TEXT NOT NULL DEFAULT 'Daily',
    "executiveSummary" TEXT NOT NULL,
    "marketSummary" TEXT NOT NULL,
    "alertSummary" TEXT NOT NULL,
    "portfolioSummary" TEXT NOT NULL,
    "alternativeSummary" TEXT NOT NULL,
    "riskSummary" TEXT NOT NULL,
    "actionItemsJson" TEXT NOT NULL DEFAULT '[]',
    "sourceItemsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BriefingReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BriefingReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BriefingReport_userId_idx" ON "BriefingReport"("userId");

-- CreateIndex
CREATE INDEX "BriefingReport_clientId_idx" ON "BriefingReport"("clientId");

-- CreateIndex
CREATE INDEX "BriefingReport_createdAt_idx" ON "BriefingReport"("createdAt");
