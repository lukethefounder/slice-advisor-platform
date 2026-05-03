-- CreateTable
CREATE TABLE "InvestorGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalType" TEXT NOT NULL DEFAULT 'Wealth Growth',
    "targetAmount" TEXT,
    "currentAmount" TEXT,
    "targetDate" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvestorGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ticker" TEXT,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risks" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'Watch',
    "conviction" TEXT NOT NULL DEFAULT 'Medium',
    "sourceLinks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ticker" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'Medium',
    "score" INTEGER NOT NULL DEFAULT 50,
    "channel" TEXT NOT NULL DEFAULT 'Dashboard',
    "status" TEXT NOT NULL DEFAULT 'Unread',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestorInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "summary" TEXT NOT NULL,
    "actionStatus" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestorInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InvestorGoal_userId_idx" ON "InvestorGoal"("userId");

-- CreateIndex
CREATE INDEX "ResearchNote_userId_idx" ON "ResearchNote"("userId");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_idx" ON "AlertEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_userId_dedupeKey_key" ON "AlertEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "InvestorInsight_userId_idx" ON "InvestorInsight"("userId");
