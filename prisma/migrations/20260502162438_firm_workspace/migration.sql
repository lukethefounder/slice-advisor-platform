-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "firmEmail" TEXT,
    "firmCode" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Firm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "canAccessPortfolios" BOOLEAN NOT NULL DEFAULT true,
    "canManageProjects" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageFirm" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "expiresAt" DATETIME,
    "sentByUserId" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirmInvite_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmInvite_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "dueDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirmProject_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmProjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "projectRole" TEXT NOT NULL DEFAULT 'Contributor',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirmProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmProjectAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FirmMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyAgenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focus" TEXT,
    "blockers" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyAgenda_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyAgenda_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FirmMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmAgendaTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "agendaId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "dueDate" TEXT,
    "delayReason" TEXT,
    "inquiry" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FirmAgendaTask_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmAgendaTask_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "WeeklyAgenda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmAgendaTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgendaComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agendaId" TEXT,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "commentType" TEXT NOT NULL DEFAULT 'Comment',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgendaComment_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "WeeklyAgenda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgendaComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FirmAgendaTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgendaComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FirmPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firmId" TEXT NOT NULL,
    "projectId" TEXT,
    "authorMembershipId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'Update',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FirmPost_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FirmPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FirmPost_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "FirmMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Firm_firmCode_key" ON "Firm"("firmCode");

-- CreateIndex
CREATE INDEX "Firm_createdByUserId_idx" ON "Firm"("createdByUserId");

-- CreateIndex
CREATE INDEX "FirmMembership_userId_idx" ON "FirmMembership"("userId");

-- CreateIndex
CREATE INDEX "FirmMembership_firmId_idx" ON "FirmMembership"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMembership_firmId_userId_key" ON "FirmMembership"("firmId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmInvite_inviteCode_key" ON "FirmInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "FirmInvite_firmId_idx" ON "FirmInvite"("firmId");

-- CreateIndex
CREATE INDEX "FirmInvite_email_idx" ON "FirmInvite"("email");

-- CreateIndex
CREATE INDEX "FirmProject_firmId_idx" ON "FirmProject"("firmId");

-- CreateIndex
CREATE INDEX "FirmProjectAssignment_membershipId_idx" ON "FirmProjectAssignment"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmProjectAssignment_projectId_membershipId_key" ON "FirmProjectAssignment"("projectId", "membershipId");

-- CreateIndex
CREATE INDEX "WeeklyAgenda_firmId_idx" ON "WeeklyAgenda"("firmId");

-- CreateIndex
CREATE INDEX "WeeklyAgenda_membershipId_idx" ON "WeeklyAgenda"("membershipId");

-- CreateIndex
CREATE INDEX "WeeklyAgenda_weekStart_idx" ON "WeeklyAgenda"("weekStart");

-- CreateIndex
CREATE INDEX "FirmAgendaTask_firmId_idx" ON "FirmAgendaTask"("firmId");

-- CreateIndex
CREATE INDEX "FirmAgendaTask_agendaId_idx" ON "FirmAgendaTask"("agendaId");

-- CreateIndex
CREATE INDEX "FirmAgendaTask_projectId_idx" ON "FirmAgendaTask"("projectId");

-- CreateIndex
CREATE INDEX "FirmAgendaTask_dueDate_idx" ON "FirmAgendaTask"("dueDate");

-- CreateIndex
CREATE INDEX "AgendaComment_agendaId_idx" ON "AgendaComment"("agendaId");

-- CreateIndex
CREATE INDEX "AgendaComment_taskId_idx" ON "AgendaComment"("taskId");

-- CreateIndex
CREATE INDEX "AgendaComment_userId_idx" ON "AgendaComment"("userId");

-- CreateIndex
CREATE INDEX "FirmPost_firmId_idx" ON "FirmPost"("firmId");

-- CreateIndex
CREATE INDEX "FirmPost_projectId_idx" ON "FirmPost"("projectId");

-- CreateIndex
CREATE INDEX "FirmPost_authorMembershipId_idx" ON "FirmPost"("authorMembershipId");
