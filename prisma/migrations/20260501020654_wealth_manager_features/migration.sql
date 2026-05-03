-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "householdName" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'Private Client',
    "riskProfile" TEXT NOT NULL DEFAULT 'Balanced',
    "liquidityNeeds" TEXT NOT NULL DEFAULT 'Moderate',
    "timeHorizon" TEXT NOT NULL DEFAULT '5-10 years',
    "objective" TEXT NOT NULL DEFAULT 'Long-term wealth growth',
    "portfolioValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL DEFAULT 'Stock',
    "value" TEXT,
    "allocationPct" TEXT,
    "costBasis" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "thesis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioHolding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvisorNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'General',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisorNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvisorNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "suitabilityStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "flagsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentVaultItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'Needs Review',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentVaultItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentVaultItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClientProfile_userId_idx" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_clientId_idx" ON "PortfolioHolding"("clientId");

-- CreateIndex
CREATE INDEX "AdvisorNote_userId_idx" ON "AdvisorNote"("userId");

-- CreateIndex
CREATE INDEX "AdvisorNote_clientId_idx" ON "AdvisorNote"("clientId");

-- CreateIndex
CREATE INDEX "MeetingTask_userId_idx" ON "MeetingTask"("userId");

-- CreateIndex
CREATE INDEX "MeetingTask_clientId_idx" ON "MeetingTask"("clientId");

-- CreateIndex
CREATE INDEX "RiskReview_clientId_idx" ON "RiskReview"("clientId");

-- CreateIndex
CREATE INDEX "DocumentVaultItem_userId_idx" ON "DocumentVaultItem"("userId");

-- CreateIndex
CREATE INDEX "DocumentVaultItem_clientId_idx" ON "DocumentVaultItem"("clientId");
