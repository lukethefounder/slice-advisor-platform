-- Additive only; preserves existing Slice data. Requires the prior Unified Strategy migration.
CREATE TABLE "SliceForwardScenario" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "firmId" TEXT NOT NULL,
 "name" TEXT NOT NULL, "sourceRunId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'Draft',
 "specJson" TEXT NOT NULL, "assumptionsJson" TEXT NOT NULL, "baselineWeightsJson" TEXT NOT NULL,
 "sourcesJson" TEXT NOT NULL DEFAULT '[]', "sourcesHash" TEXT, "ignoredAdjustedRevisions" INTEGER NOT NULL DEFAULT 0, "definitionHash" TEXT NOT NULL,
 "frozenAt" TIMESTAMP(3), "earliestStart" TEXT, "journalJson" TEXT, "journalHash" TEXT,
 "resultJson" TEXT, "resultHash" TEXT, "acceptedSessions" INTEGER NOT NULL DEFAULT 0,
 "lastSession" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
 "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastCheckedAt" TIMESTAMP(3), "refreshStartedAt" TIMESTAMP(3), "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SliceForwardScenario_status_check" CHECK ("status" IN ('Draft', 'Watching', 'Complete', 'Archived')),
 CONSTRAINT "SliceForwardScenario_sessions_check" CHECK ("acceptedSessions" >= 0)
);
CREATE INDEX "SliceForwardScenario_firmId_userId_createdAt_idx" ON "SliceForwardScenario"("firmId","userId","createdAt");
CREATE INDEX "SliceForwardScenario_status_nextCheckAt_idx" ON "SliceForwardScenario"("status","nextCheckAt");
CREATE TABLE "SliceScenarioObservation" (
 "id" TEXT NOT NULL PRIMARY KEY, "scenarioId" TEXT NOT NULL, "userId" TEXT NOT NULL, "firmId" TEXT NOT NULL,
 "sessionDate" TEXT NOT NULL, "payloadJson" TEXT NOT NULL, "previousHash" TEXT NOT NULL, "recordHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SliceScenarioObservation_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "SliceForwardScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SliceScenarioObservation_scenarioId_sessionDate_key" ON "SliceScenarioObservation"("scenarioId","sessionDate");
CREATE INDEX "SliceScenarioObservation_owner_sessions_idx" ON "SliceScenarioObservation"("firmId","userId","scenarioId","sessionDate");
CREATE TABLE "SliceResearchRelationship" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "firmId" TEXT NOT NULL,
 "sourceKind" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "targetKind" TEXT NOT NULL, "targetId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SliceResearchRelationship_owner_nodes_key" ON "SliceResearchRelationship"("userId","firmId","sourceKind","sourceId","targetKind","targetId");
CREATE INDEX "SliceResearchRelationship_firmId_userId_createdAt_idx" ON "SliceResearchRelationship"("firmId","userId","createdAt");
-- Browser/PostgREST access denied by default. Use the existing protected server database role.
ALTER TABLE "SliceForwardScenario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceScenarioObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SliceResearchRelationship" ENABLE ROW LEVEL SECURITY;
