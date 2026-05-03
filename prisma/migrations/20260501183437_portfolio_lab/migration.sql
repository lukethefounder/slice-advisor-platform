-- CreateTable
CREATE TABLE "InvestorAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'Taxable Brokerage',
    "custodian" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestorHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL DEFAULT 'Stock',
    "valueNumber" REAL NOT NULL DEFAULT 0,
    "costBasis" REAL,
    "targetRole" TEXT NOT NULL DEFAULT 'Core',
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "thesis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvestorHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestorHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestorAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'Balanced',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllocationTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "targetPct" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationTarget_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AllocationModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RebalanceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "modelId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "currentAllocationsJson" TEXT NOT NULL DEFAULT '[]',
    "targetAllocationsJson" TEXT NOT NULL DEFAULT '[]',
    "driftJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RebalanceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RebalanceReport_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AllocationModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "totalBefore" REAL NOT NULL DEFAULT 0,
    "totalAfter" REAL NOT NULL DEFAULT 0,
    "impactAmount" REAL NOT NULL DEFAULT 0,
    "impactPct" REAL NOT NULL DEFAULT 0,
    "shockJson" TEXT NOT NULL DEFAULT '{}',
    "beforeJson" TEXT NOT NULL DEFAULT '[]',
    "afterJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScenarioReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InvestorAccount_userId_idx" ON "InvestorAccount"("userId");

-- CreateIndex
CREATE INDEX "InvestorHolding_userId_idx" ON "InvestorHolding"("userId");

-- CreateIndex
CREATE INDEX "InvestorHolding_accountId_idx" ON "InvestorHolding"("accountId");

-- CreateIndex
CREATE INDEX "AllocationModel_userId_idx" ON "AllocationModel"("userId");

-- CreateIndex
CREATE INDEX "AllocationTarget_modelId_idx" ON "AllocationTarget"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationTarget_modelId_assetClass_key" ON "AllocationTarget"("modelId", "assetClass");

-- CreateIndex
CREATE INDEX "RebalanceReport_userId_idx" ON "RebalanceReport"("userId");

-- CreateIndex
CREATE INDEX "RebalanceReport_modelId_idx" ON "RebalanceReport"("modelId");

-- CreateIndex
CREATE INDEX "RebalanceReport_createdAt_idx" ON "RebalanceReport"("createdAt");

-- CreateIndex
CREATE INDEX "ScenarioReport_userId_idx" ON "ScenarioReport"("userId");

-- CreateIndex
CREATE INDEX "ScenarioReport_createdAt_idx" ON "ScenarioReport"("createdAt");
