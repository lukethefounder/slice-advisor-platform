-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformStatus" TEXT NOT NULL DEFAULT 'Active',
    "governanceReason" TEXT,
    "governedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Stock',
    "price" TEXT,
    "move" TEXT,
    "ma50" TEXT,
    "ma200" TEXT,
    "volume" TEXT,
    "rsi" TEXT,
    "signal" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamedWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "focus" TEXT NOT NULL DEFAULT 'General',
    "riskLevel" TEXT NOT NULL DEFAULT 'Mixed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NamedWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NamedWatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Stock',
    "sourceType" TEXT NOT NULL DEFAULT 'Manual',
    "sourceId" TEXT,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "originalScore" INTEGER,
    "thesis" TEXT,
    "riskNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Watching',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NamedWatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentureProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "founder" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentureProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "trigger" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioHolding" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL DEFAULT 'Stock',
    "value" TEXT,
    "allocationPct" TEXT,
    "costBasis" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "thesis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "noteType" TEXT NOT NULL DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskReview" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "suitabilityStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "flagsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'Needs Review',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalType" TEXT NOT NULL DEFAULT 'Wealth Growth',
    "targetAmount" TEXT,
    "currentAmount" TEXT,
    "targetDate" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT,
    "title" TEXT NOT NULL,
    "thesis" TEXT NOT NULL,
    "risks" TEXT,
    "decision" TEXT NOT NULL DEFAULT 'Watch',
    "conviction" TEXT NOT NULL DEFAULT 'Medium',
    "sourceLinks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "aiBriefing" TEXT,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "summary" TEXT NOT NULL,
    "actionStatus" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsDecision" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "link" TEXT,
    "score" INTEGER NOT NULL,
    "urgency" TEXT NOT NULL,
    "shouldAlert" BOOLEAN NOT NULL,
    "reasonsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "retainedCount" INTEGER NOT NULL DEFAULT 0,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "digestCount" INTEGER NOT NULL DEFAULT 0,
    "discardedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeadlineDecision" (
    "id" TEXT NOT NULL,
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
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeadlineDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCheckpoint" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSeenHash" TEXT,
    "lastStatus" TEXT NOT NULL DEFAULT 'Pending',
    "lastItemCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSourceConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceTier" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minScoreToRetain" INTEGER NOT NULL DEFAULT 55,
    "minScoreToAlert" INTEGER NOT NULL DEFAULT 88,
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 25,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceRetentionPolicy" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minUrgency" TEXT NOT NULL DEFAULT 'High',
    "minScore" INTEGER NOT NULL DEFAULT 75,
    "digestOnly" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertEventId" TEXT,
    "channel" TEXT NOT NULL,
    "destination" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "urgency" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "urgencyMixJson" TEXT NOT NULL DEFAULT '{}',
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingReport" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'Taxable Brokerage',
    "custodian" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL DEFAULT 'Stock',
    "valueNumber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBasis" DOUBLE PRECISION,
    "targetRole" TEXT NOT NULL DEFAULT 'Core',
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "thesis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'Balanced',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationTarget" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "targetPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentAllocationsJson" TEXT NOT NULL DEFAULT '[]',
    "targetAllocationsJson" TEXT NOT NULL DEFAULT '[]',
    "driftJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RebalanceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "totalBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shockJson" TEXT NOT NULL DEFAULT '{}',
    "beforeJson" TEXT NOT NULL DEFAULT '[]',
    "afterJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Info',
    "area" TEXT NOT NULL DEFAULT 'General',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisclosureAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disclosureKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedByName" TEXT NOT NULL,
    "acceptedByEmail" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,

    CONSTRAINT "DisclosureAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSecuritySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requireReauthForSensitiveActions" BOOLEAN NOT NULL DEFAULT true,
    "alertOnNewLogin" BOOLEAN NOT NULL DEFAULT true,
    "advisorModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 43200,
    "lastSecurityReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSecuritySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firmEmail" TEXT,
    "firmCode" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "platformStatus" TEXT NOT NULL DEFAULT 'Active',
    "governanceReason" TEXT,
    "governedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternativeVenture" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "startupName" TEXT NOT NULL,
    "founderName" TEXT,
    "sector" TEXT NOT NULL DEFAULT 'Technology',
    "stage" TEXT NOT NULL DEFAULT 'Seed',
    "website" TEXT,
    "background" TEXT NOT NULL,
    "problemToSolve" TEXT NOT NULL,
    "solution" TEXT,
    "equityOfferedPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tentativeValuation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountSought" DOUBLE PRECISION,
    "traction" TEXT,
    "thesis" TEXT,
    "keyRisks" TEXT,
    "monitoringStatus" TEXT NOT NULL DEFAULT 'Watching',
    "riskLevel" TEXT NOT NULL DEFAULT 'Very High',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlternativeVenture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternativePennyStock" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT 'Unknown',
    "thesis" TEXT,
    "catalyst" TEXT,
    "riskNotes" TEXT,
    "targetEntry" TEXT,
    "maxPositionPct" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Watching',
    "riskLevel" TEXT NOT NULL DEFAULT 'Extreme',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlternativePennyStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "canAccessPortfolios" BOOLEAN NOT NULL DEFAULT true,
    "canManageProjects" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canManageFirm" BOOLEAN NOT NULL DEFAULT false,
    "calendarColor" TEXT NOT NULL DEFAULT '#ef4444',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmInvite" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "inviteCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "expiresAt" TIMESTAMP(3),
    "sentByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmProject" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "dueDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmProjectAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "projectRole" TEXT NOT NULL DEFAULT 'Contributor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAgenda" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focus" TEXT,
    "blockers" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmAgendaTask" (
    "id" TEXT NOT NULL,
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
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmAgendaTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaComment" (
    "id" TEXT NOT NULL,
    "agendaId" TEXT,
    "taskId" TEXT,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "commentType" TEXT NOT NULL DEFAULT 'Comment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmPost" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "projectId" TEXT,
    "authorMembershipId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'Update',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headlineDecisionId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sourceName" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "priorityTier" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorOperatingNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "confidenceScore" INTEGER NOT NULL DEFAULT 75,
    "riskScore" INTEGER NOT NULL DEFAULT 25,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorOperatingNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioImpactTwin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientName" TEXT,
    "title" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL DEFAULT 'Market Shock',
    "shockPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affectedAssetsJson" TEXT NOT NULL DEFAULT '[]',
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioImpactTwin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalAdvisorBot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "botName" TEXT NOT NULL,
    "ownerName" TEXT,
    "persona" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'Professional',
    "coverageJson" TEXT NOT NULL DEFAULT '[]',
    "tasksJson" TEXT NOT NULL DEFAULT '[]',
    "permissionsJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastRunSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalAdvisorBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCredibilityProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "sourceName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'News',
    "credibilityScore" INTEGER NOT NULL DEFAULT 70,
    "biasRisk" INTEGER NOT NULL DEFAULT 30,
    "transparencyScore" INTEGER NOT NULL DEFAULT 70,
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "flagsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Approved',
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCredibilityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventActionAutopilot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "eventTitle" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceCredibilityScore" INTEGER NOT NULL DEFAULT 70,
    "impactScore" INTEGER NOT NULL DEFAULT 50,
    "urgency" TEXT NOT NULL DEFAULT 'Medium',
    "actionType" TEXT NOT NULL DEFAULT 'Review',
    "recommendedAction" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "rationaleJson" TEXT NOT NULL DEFAULT '[]',
    "guardrailsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventActionAutopilot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceMemoryVaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientName" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Communication',
    "retentionTag" TEXT NOT NULL DEFAULT 'Advisor Review',
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "summary" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Stored',
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceMemoryVaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommunicationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientName" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'Email',
    "audience" TEXT NOT NULL DEFAULT 'Client',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceSummaryJson" TEXT NOT NULL DEFAULT '[]',
    "complianceNotesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "tone" TEXT NOT NULL DEFAULT 'Clear and reassuring',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCommunicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingPrepPacket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientName" TEXT,
    "meetingTitle" TEXT NOT NULL,
    "meetingDate" TEXT,
    "objective" TEXT NOT NULL,
    "briefingJson" TEXT NOT NULL DEFAULT '[]',
    "questionsJson" TEXT NOT NULL DEFAULT '[]',
    "openItemsJson" TEXT NOT NULL DEFAULT '[]',
    "followUpJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingPrepPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorPlaybook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "playbookType" TEXT NOT NULL DEFAULT 'Opportunity Response',
    "trigger" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "escalationRulesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmIntelligencePulse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Market Intelligence',
    "summary" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 75,
    "affectedClientsJson" TEXT NOT NULL DEFAULT '[]',
    "sourceItemsJson" TEXT NOT NULL DEFAULT '[]',
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmIntelligencePulse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorWorkflowRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL DEFAULT 'Autopilot',
    "trigger" TEXT NOT NULL,
    "minimumCredibilityScore" INTEGER NOT NULL DEFAULT 75,
    "minimumImpactScore" INTEGER NOT NULL DEFAULT 70,
    "actionTemplate" TEXT NOT NULL,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "guardrailsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorWorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorWorkflowAutomationRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "runType" TEXT NOT NULL DEFAULT 'Phase 2 Workflow Automation',
    "status" TEXT NOT NULL DEFAULT 'Complete',
    "summary" TEXT NOT NULL,
    "sourceActionId" TEXT,
    "createdFirmTaskId" TEXT,
    "createdMeetingTaskId" TEXT,
    "createdBriefingId" TEXT,
    "createdDraftId" TEXT,
    "createdVaultItemId" TEXT,
    "createdNotificationId" TEXT,
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorWorkflowAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorAdaptiveMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "subjectType" TEXT NOT NULL DEFAULT 'Advisor',
    "subjectName" TEXT NOT NULL,
    "memoryKey" TEXT NOT NULL,
    "memoryValue" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 70,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "lastAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorAdaptiveMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPreferenceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientName" TEXT NOT NULL,
    "communicationStyle" TEXT NOT NULL DEFAULT 'Clear and reassuring',
    "detailLevel" TEXT NOT NULL DEFAULT 'Balanced',
    "preferredChannel" TEXT NOT NULL DEFAULT 'Email',
    "meetingCadence" TEXT NOT NULL DEFAULT 'Quarterly',
    "volatilitySensitivity" INTEGER NOT NULL DEFAULT 60,
    "behavioralNotesJson" TEXT NOT NULL DEFAULT '[]',
    "doJson" TEXT NOT NULL DEFAULT '[]',
    "dontJson" TEXT NOT NULL DEFAULT '[]',
    "confidenceScore" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPreferenceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotLearningProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "botName" TEXT NOT NULL,
    "styleInstructions" TEXT NOT NULL,
    "decisionRulesJson" TEXT NOT NULL DEFAULT '[]',
    "escalationRulesJson" TEXT NOT NULL DEFAULT '[]',
    "memoryWeight" INTEGER NOT NULL DEFAULT 70,
    "autonomyLevel" TEXT NOT NULL DEFAULT 'Advisor Approval Required',
    "successScore" INTEGER NOT NULL DEFAULT 72,
    "status" TEXT NOT NULL DEFAULT 'Learning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotLearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceReliabilitySignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "sourceName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "signalType" TEXT NOT NULL DEFAULT 'Outcome',
    "outcome" TEXT NOT NULL,
    "reliabilityDelta" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceReliabilitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorFeedbackSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL DEFAULT 'Learn',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorFeedbackSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Adaptive Intelligence',
    "recommendation" TEXT NOT NULL,
    "reasonJson" TEXT NOT NULL DEFAULT '[]',
    "confidenceScore" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmLearningSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 70,
    "memoryJson" TEXT NOT NULL DEFAULT '[]',
    "sourceReliabilityJson" TEXT NOT NULL DEFAULT '[]',
    "botUpdatesJson" TEXT NOT NULL DEFAULT '[]',
    "clientStyleJson" TEXT NOT NULL DEFAULT '[]',
    "recommendationsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmLearningSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "botName" TEXT NOT NULL DEFAULT 'Slice Bot',
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "personalityJson" TEXT NOT NULL DEFAULT '{}',
    "riskJson" TEXT NOT NULL DEFAULT '{}',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "preferredTone" TEXT NOT NULL DEFAULT 'Professional',
    "commandStyle" TEXT NOT NULL DEFAULT 'Concise',
    "autonomyLevel" TEXT NOT NULL DEFAULT 'Advisor approval required',
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'Stored',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalUserBotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotCommand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "commandText" TEXT NOT NULL,
    "commandType" TEXT NOT NULL DEFAULT 'General',
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "resultSummary" TEXT,
    "actionJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotWorkspaceTab" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "tabName" TEXT NOT NULL DEFAULT 'My Bot',
    "layoutJson" TEXT NOT NULL DEFAULT '{}',
    "pinnedCommandsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotWorkspaceTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserUiPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accentName" TEXT NOT NULL DEFAULT 'Slice Red',
    "accentHex" TEXT NOT NULL DEFAULT '#dc2626',
    "accentDarkHex" TEXT NOT NULL DEFAULT '#7f1d1d',
    "accentSoftHex" TEXT NOT NULL DEFAULT '#fee2e2',
    "backgroundStyle" TEXT NOT NULL DEFAULT 'Premium Dark',
    "preferenceSource" TEXT NOT NULL DEFAULT 'Personal Bot',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserUiPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotEmailDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "targetTicker" TEXT,
    "recipientJson" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "deliveryMode" TEXT NOT NULL DEFAULT 'Approval Required',
    "complianceJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotEmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotPdfReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "reportType" TEXT NOT NULL DEFAULT 'Advisor Intelligence',
    "status" TEXT NOT NULL DEFAULT 'Ready',
    "summary" TEXT NOT NULL,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "designJson" TEXT NOT NULL DEFAULT '{}',
    "downloadToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotPdfReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotAutomationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "ruleName" TEXT NOT NULL,
    "triggerPrompt" TEXT NOT NULL,
    "targetTicker" TEXT,
    "minScore" INTEGER NOT NULL DEFAULT 80,
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "audience" TEXT NOT NULL DEFAULT 'Investors',
    "autoDraftEmail" BOOLEAN NOT NULL DEFAULT true,
    "autoDraftText" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "processedKeysJson" TEXT NOT NULL DEFAULT '[]',
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "memoryKey" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL DEFAULT 'Preference',
    "title" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL DEFAULT 75,
    "sourcePrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "skillKey" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Platform',
    "description" TEXT NOT NULL,
    "examplePromptsJson" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotProactiveInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "insightType" TEXT NOT NULL DEFAULT 'Opportunity',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "sourceJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "score" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotProactiveInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotApprovalItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "summary" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "approvalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotDataView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "viewName" TEXT NOT NULL,
    "viewType" TEXT NOT NULL DEFAULT 'General',
    "filterJson" TEXT NOT NULL DEFAULT '{}',
    "sortJson" TEXT NOT NULL DEFAULT '{}',
    "resultJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotDataView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrainProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "householdName" TEXT,
    "riskProfile" TEXT NOT NULL DEFAULT 'Balanced',
    "communicationStyle" TEXT NOT NULL DEFAULT 'Clear and professional',
    "preferredTone" TEXT NOT NULL DEFAULT 'Plain English',
    "portfolioSummary" TEXT NOT NULL,
    "riskPulse" TEXT NOT NULL,
    "opportunityPulse" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "keyFactsJson" TEXT NOT NULL DEFAULT '[]',
    "holdingsJson" TEXT NOT NULL DEFAULT '[]',
    "notesJson" TEXT NOT NULL DEFAULT '[]',
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "score" INTEGER NOT NULL DEFAULT 70,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrainProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextBestAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'Review',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "score" INTEGER NOT NULL DEFAULT 70,
    "clientId" TEXT,
    "clientName" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "reason" TEXT NOT NULL,
    "recommendedCommand" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "dueDate" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextBestAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceProofTrail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "aiReasoning" TEXT NOT NULL,
    "humanStatus" TEXT NOT NULL DEFAULT 'Needs Review',
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "approvalJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceProofTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmKnowledgeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "entryKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "body" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "score" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmKnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorDayBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topActionsJson" TEXT NOT NULL DEFAULT '[]',
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorDayBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistPriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "watchlistId" TEXT,
    "watchlistItemId" TEXT,
    "symbol" TEXT NOT NULL,
    "assetName" TEXT,
    "upperTargetPrice" DOUBLE PRECISION,
    "lowerTargetPrice" DOUBLE PRECISION,
    "lastPrice" DOUBLE PRECISION,
    "lastProvider" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "triggeredHighAt" TIMESTAMP(3),
    "triggeredLowAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "notificationChannel" TEXT NOT NULL DEFAULT 'Dashboard',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchlistPriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistPriceAlertEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "observedPrice" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistPriceAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendPlatformEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'General',
    "actorName" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'Info',
    "status" TEXT NOT NULL DEFAULT 'Recorded',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendPlatformEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendRolePolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "policyKey" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "permissionsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendRolePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendApprovalItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "title" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "summary" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "approvalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendNotificationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "ownerRuleKey" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'Global',
    "scopeValue" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'Dashboard',
    "minScore" INTEGER NOT NULL DEFAULT 80,
    "minUrgency" TEXT NOT NULL DEFAULT 'High',
    "digestOnly" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "maxPerDay" INTEGER NOT NULL DEFAULT 25,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendDataQualityRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "liveStatus" TEXT NOT NULL DEFAULT 'Unknown',
    "freshnessStatus" TEXT NOT NULL DEFAULT 'Unknown',
    "asOfAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "qualityScore" INTEGER NOT NULL DEFAULT 50,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "warning" TEXT,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Tracked',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendDataQualityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendAiTool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "ownerToolKey" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Platform',
    "description" TEXT NOT NULL,
    "inputSchemaJson" TEXT NOT NULL DEFAULT '{}',
    "outputSchemaJson" TEXT NOT NULL DEFAULT '{}',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendAiTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendJobDefinition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "ownerJobKey" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Automation',
    "description" TEXT NOT NULL,
    "scheduleLabel" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'Manual',
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastResultJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendJobDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendSystemHealthCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "ownerCheckKey" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'System',
    "status" TEXT NOT NULL DEFAULT 'Unknown',
    "score" INTEGER NOT NULL DEFAULT 50,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendSystemHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendTenantAccessCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "checkName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Unknown',
    "detail" TEXT NOT NULL,
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendTenantAccessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendDemoSeedRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Complete',
    "summary" TEXT NOT NULL,
    "countsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackendDemoSeedRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendVendorIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "vendorKey" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "purpose" TEXT NOT NULL,
    "envKeyName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Missing',
    "riskLevel" TEXT NOT NULL DEFAULT 'Medium',
    "dataAccessJson" TEXT NOT NULL DEFAULT '[]',
    "fallbackBehavior" TEXT,
    "lastHealthStatus" TEXT,
    "lastHealthCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendVendorIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendFeatureFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "flagKey" TEXT NOT NULL,
    "flagName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Platform',
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "requiresProvider" BOOLEAN NOT NULL DEFAULT false,
    "requiredVendorKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendJobRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "jobKey" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "resultJson" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendOutboundDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "channel" TEXT NOT NULL,
    "destination" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Queued',
    "urgency" TEXT NOT NULL DEFAULT 'Medium',
    "score" INTEGER NOT NULL DEFAULT 50,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendOutboundDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendDataSyncCheckpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastCursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendDataSyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendAiToolRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "toolKey" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL DEFAULT '{}',
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Complete',
    "approvalId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackendAiToolRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotVoiceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "sessionKey" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "transcript" TEXT NOT NULL DEFAULT '',
    "finalTranscript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Listening',
    "confidenceScore" INTEGER NOT NULL DEFAULT 50,
    "commandId" TEXT,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotVoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotCommandCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "originalCommand" TEXT NOT NULL,
    "interpretedIntent" TEXT,
    "correctedIntent" TEXT NOT NULL,
    "correctedRoute" TEXT,
    "correctionNotes" TEXT,
    "correctedParametersJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotCommandCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotTrainingPhrase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "phraseKey" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "normalizedPhrase" TEXT NOT NULL,
    "targetIntent" TEXT NOT NULL,
    "targetRoute" TEXT,
    "parametersJson" TEXT NOT NULL DEFAULT '{}',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotTrainingPhrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotPlatformMapItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firmId" TEXT,
    "itemKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Platform',
    "aliasesJson" TEXT NOT NULL DEFAULT '[]',
    "capabilitiesJson" TEXT NOT NULL DEFAULT '[]',
    "examplePromptsJson" TEXT NOT NULL DEFAULT '[]',
    "confidenceScore" INTEGER NOT NULL DEFAULT 90,
    "lastVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotPlatformMapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalUserBotResearchRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "firmId" TEXT,
    "query" TEXT NOT NULL,
    "ticker" TEXT,
    "depth" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'Complete',
    "answerJson" TEXT NOT NULL DEFAULT '{}',
    "sourceSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "confidenceScore" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalUserBotResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorRealtimeSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformType" TEXT NOT NULL DEFAULT 'Research',
    "sourceKind" TEXT NOT NULL DEFAULT 'RSS',
    "sourceUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "termsAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "accessMode" TEXT NOT NULL DEFAULT 'Licensed API/RSS/Export',
    "headersJson" TEXT NOT NULL DEFAULT '{}',
    "encryptedSecretJson" TEXT,
    "minScoreToRetain" INTEGER NOT NULL DEFAULT 55,
    "minScoreToAlert" INTEGER NOT NULL DEFAULT 88,
    "maxItemsPerRun" INTEGER NOT NULL DEFAULT 40,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'Pending',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorRealtimeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimePriceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Equity',
    "provider" TEXT NOT NULL,
    "isRealtime" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL,
    "previousClose" DOUBLE PRECISION,
    "change" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "marketState" TEXT NOT NULL DEFAULT 'Unknown',
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "providerTimestamp" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicalsJson" TEXT NOT NULL DEFAULT '{}',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "rawJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimePriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeInvestorNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "score" INTEGER NOT NULL DEFAULT 50,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "investorScope" TEXT NOT NULL DEFAULT 'Advisor Review',
    "channelsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Unread',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "RealtimeInvestorNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "WatchAsset_userId_idx" ON "WatchAsset"("userId");

-- CreateIndex
CREATE INDEX "WatchAsset_ticker_idx" ON "WatchAsset"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "WatchAsset_userId_ticker_key" ON "WatchAsset"("userId", "ticker");

-- CreateIndex
CREATE INDEX "NamedWatchlist_userId_idx" ON "NamedWatchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NamedWatchlist_userId_name_key" ON "NamedWatchlist"("userId", "name");

-- CreateIndex
CREATE INDEX "NamedWatchlistItem_userId_idx" ON "NamedWatchlistItem"("userId");

-- CreateIndex
CREATE INDEX "NamedWatchlistItem_watchlistId_idx" ON "NamedWatchlistItem"("watchlistId");

-- CreateIndex
CREATE INDEX "NamedWatchlistItem_symbol_idx" ON "NamedWatchlistItem"("symbol");

-- CreateIndex
CREATE INDEX "NamedWatchlistItem_assetType_idx" ON "NamedWatchlistItem"("assetType");

-- CreateIndex
CREATE UNIQUE INDEX "NamedWatchlistItem_watchlistId_symbol_key" ON "NamedWatchlistItem"("watchlistId", "symbol");

-- CreateIndex
CREATE INDEX "VentureProject_userId_idx" ON "VentureProject"("userId");

-- CreateIndex
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_idx" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_fullName_idx" ON "ClientProfile"("fullName");

-- CreateIndex
CREATE INDEX "PortfolioHolding_clientId_idx" ON "PortfolioHolding"("clientId");

-- CreateIndex
CREATE INDEX "PortfolioHolding_symbol_idx" ON "PortfolioHolding"("symbol");

-- CreateIndex
CREATE INDEX "AdvisorNote_userId_idx" ON "AdvisorNote"("userId");

-- CreateIndex
CREATE INDEX "AdvisorNote_clientId_idx" ON "AdvisorNote"("clientId");

-- CreateIndex
CREATE INDEX "MeetingTask_userId_idx" ON "MeetingTask"("userId");

-- CreateIndex
CREATE INDEX "MeetingTask_clientId_idx" ON "MeetingTask"("clientId");

-- CreateIndex
CREATE INDEX "MeetingTask_status_idx" ON "MeetingTask"("status");

-- CreateIndex
CREATE INDEX "RiskReview_clientId_idx" ON "RiskReview"("clientId");

-- CreateIndex
CREATE INDEX "DocumentVaultItem_userId_idx" ON "DocumentVaultItem"("userId");

-- CreateIndex
CREATE INDEX "DocumentVaultItem_clientId_idx" ON "DocumentVaultItem"("clientId");

-- CreateIndex
CREATE INDEX "InvestorGoal_userId_idx" ON "InvestorGoal"("userId");

-- CreateIndex
CREATE INDEX "ResearchNote_userId_idx" ON "ResearchNote"("userId");

-- CreateIndex
CREATE INDEX "ResearchNote_ticker_idx" ON "ResearchNote"("ticker");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_idx" ON "AlertEvent"("userId");

-- CreateIndex
CREATE INDEX "AlertEvent_ticker_idx" ON "AlertEvent"("ticker");

-- CreateIndex
CREATE INDEX "AlertEvent_status_idx" ON "AlertEvent"("status");

-- CreateIndex
CREATE INDEX "AlertEvent_score_idx" ON "AlertEvent"("score");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_userId_dedupeKey_key" ON "AlertEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "InvestorInsight_userId_idx" ON "InvestorInsight"("userId");

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

-- CreateIndex
CREATE INDEX "NewsSourceConfig_userId_idx" ON "NewsSourceConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSourceConfig_userId_sourceId_key" ON "NewsSourceConfig"("userId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceRetentionPolicy_userId_key" ON "IntelligenceRetentionPolicy"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_channel_key" ON "NotificationPreference"("userId", "channel");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_idx" ON "NotificationDelivery"("userId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_alertEventId_idx" ON "NotificationDelivery"("alertEventId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "DigestReport_userId_idx" ON "DigestReport"("userId");

-- CreateIndex
CREATE INDEX "DigestReport_createdAt_idx" ON "DigestReport"("createdAt");

-- CreateIndex
CREATE INDEX "BriefingReport_userId_idx" ON "BriefingReport"("userId");

-- CreateIndex
CREATE INDEX "BriefingReport_clientId_idx" ON "BriefingReport"("clientId");

-- CreateIndex
CREATE INDEX "BriefingReport_createdAt_idx" ON "BriefingReport"("createdAt");

-- CreateIndex
CREATE INDEX "InvestorAccount_userId_idx" ON "InvestorAccount"("userId");

-- CreateIndex
CREATE INDEX "InvestorHolding_userId_idx" ON "InvestorHolding"("userId");

-- CreateIndex
CREATE INDEX "InvestorHolding_accountId_idx" ON "InvestorHolding"("accountId");

-- CreateIndex
CREATE INDEX "InvestorHolding_symbol_idx" ON "InvestorHolding"("symbol");

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

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DisclosureAcceptance_userId_idx" ON "DisclosureAcceptance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DisclosureAcceptance_userId_disclosureKey_version_key" ON "DisclosureAcceptance"("userId", "disclosureKey", "version");

-- CreateIndex
CREATE UNIQUE INDEX "UserSecuritySetting_userId_key" ON "UserSecuritySetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Firm_firmCode_key" ON "Firm"("firmCode");

-- CreateIndex
CREATE INDEX "Firm_createdByUserId_idx" ON "Firm"("createdByUserId");

-- CreateIndex
CREATE INDEX "AlternativeVenture_firmId_idx" ON "AlternativeVenture"("firmId");

-- CreateIndex
CREATE INDEX "AlternativeVenture_createdByUserId_idx" ON "AlternativeVenture"("createdByUserId");

-- CreateIndex
CREATE INDEX "AlternativeVenture_monitoringStatus_idx" ON "AlternativeVenture"("monitoringStatus");

-- CreateIndex
CREATE INDEX "AlternativeVenture_sector_idx" ON "AlternativeVenture"("sector");

-- CreateIndex
CREATE INDEX "AlternativePennyStock_firmId_idx" ON "AlternativePennyStock"("firmId");

-- CreateIndex
CREATE INDEX "AlternativePennyStock_createdByUserId_idx" ON "AlternativePennyStock"("createdByUserId");

-- CreateIndex
CREATE INDEX "AlternativePennyStock_ticker_idx" ON "AlternativePennyStock"("ticker");

-- CreateIndex
CREATE INDEX "AlternativePennyStock_status_idx" ON "AlternativePennyStock"("status");

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

-- CreateIndex
CREATE INDEX "FirmPost_createdAt_idx" ON "FirmPost"("createdAt");

-- CreateIndex
CREATE INDEX "OpportunitySignal_userId_idx" ON "OpportunitySignal"("userId");

-- CreateIndex
CREATE INDEX "OpportunitySignal_headlineDecisionId_idx" ON "OpportunitySignal"("headlineDecisionId");

-- CreateIndex
CREATE INDEX "OpportunitySignal_signalType_idx" ON "OpportunitySignal"("signalType");

-- CreateIndex
CREATE INDEX "OpportunitySignal_priorityTier_idx" ON "OpportunitySignal"("priorityTier");

-- CreateIndex
CREATE INDEX "OpportunitySignal_status_idx" ON "OpportunitySignal"("status");

-- CreateIndex
CREATE INDEX "OpportunitySignal_compositeScore_idx" ON "OpportunitySignal"("compositeScore");

-- CreateIndex
CREATE INDEX "OpportunitySignal_createdAt_idx" ON "OpportunitySignal"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorOperatingNode_userId_idx" ON "AdvisorOperatingNode"("userId");

-- CreateIndex
CREATE INDEX "AdvisorOperatingNode_firmId_idx" ON "AdvisorOperatingNode"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorOperatingNode_category_idx" ON "AdvisorOperatingNode"("category");

-- CreateIndex
CREATE INDEX "AdvisorOperatingNode_status_idx" ON "AdvisorOperatingNode"("status");

-- CreateIndex
CREATE INDEX "PortfolioImpactTwin_userId_idx" ON "PortfolioImpactTwin"("userId");

-- CreateIndex
CREATE INDEX "PortfolioImpactTwin_firmId_idx" ON "PortfolioImpactTwin"("firmId");

-- CreateIndex
CREATE INDEX "PortfolioImpactTwin_clientName_idx" ON "PortfolioImpactTwin"("clientName");

-- CreateIndex
CREATE INDEX "PortfolioImpactTwin_createdAt_idx" ON "PortfolioImpactTwin"("createdAt");

-- CreateIndex
CREATE INDEX "PersonalAdvisorBot_userId_idx" ON "PersonalAdvisorBot"("userId");

-- CreateIndex
CREATE INDEX "PersonalAdvisorBot_firmId_idx" ON "PersonalAdvisorBot"("firmId");

-- CreateIndex
CREATE INDEX "PersonalAdvisorBot_status_idx" ON "PersonalAdvisorBot"("status");

-- CreateIndex
CREATE INDEX "SourceCredibilityProfile_userId_idx" ON "SourceCredibilityProfile"("userId");

-- CreateIndex
CREATE INDEX "SourceCredibilityProfile_firmId_idx" ON "SourceCredibilityProfile"("firmId");

-- CreateIndex
CREATE INDEX "SourceCredibilityProfile_credibilityScore_idx" ON "SourceCredibilityProfile"("credibilityScore");

-- CreateIndex
CREATE INDEX "SourceCredibilityProfile_status_idx" ON "SourceCredibilityProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCredibilityProfile_userId_domain_key" ON "SourceCredibilityProfile"("userId", "domain");

-- CreateIndex
CREATE INDEX "EventActionAutopilot_userId_idx" ON "EventActionAutopilot"("userId");

-- CreateIndex
CREATE INDEX "EventActionAutopilot_firmId_idx" ON "EventActionAutopilot"("firmId");

-- CreateIndex
CREATE INDEX "EventActionAutopilot_urgency_idx" ON "EventActionAutopilot"("urgency");

-- CreateIndex
CREATE INDEX "EventActionAutopilot_status_idx" ON "EventActionAutopilot"("status");

-- CreateIndex
CREATE INDEX "EventActionAutopilot_createdAt_idx" ON "EventActionAutopilot"("createdAt");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_userId_idx" ON "ComplianceMemoryVaultItem"("userId");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_firmId_idx" ON "ComplianceMemoryVaultItem"("firmId");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_clientName_idx" ON "ComplianceMemoryVaultItem"("clientName");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_category_idx" ON "ComplianceMemoryVaultItem"("category");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_status_idx" ON "ComplianceMemoryVaultItem"("status");

-- CreateIndex
CREATE INDEX "ComplianceMemoryVaultItem_createdAt_idx" ON "ComplianceMemoryVaultItem"("createdAt");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_userId_idx" ON "ClientCommunicationDraft"("userId");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_firmId_idx" ON "ClientCommunicationDraft"("firmId");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_clientName_idx" ON "ClientCommunicationDraft"("clientName");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_channel_idx" ON "ClientCommunicationDraft"("channel");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_status_idx" ON "ClientCommunicationDraft"("status");

-- CreateIndex
CREATE INDEX "ClientCommunicationDraft_createdAt_idx" ON "ClientCommunicationDraft"("createdAt");

-- CreateIndex
CREATE INDEX "MeetingPrepPacket_userId_idx" ON "MeetingPrepPacket"("userId");

-- CreateIndex
CREATE INDEX "MeetingPrepPacket_firmId_idx" ON "MeetingPrepPacket"("firmId");

-- CreateIndex
CREATE INDEX "MeetingPrepPacket_clientName_idx" ON "MeetingPrepPacket"("clientName");

-- CreateIndex
CREATE INDEX "MeetingPrepPacket_status_idx" ON "MeetingPrepPacket"("status");

-- CreateIndex
CREATE INDEX "MeetingPrepPacket_createdAt_idx" ON "MeetingPrepPacket"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorPlaybook_userId_idx" ON "AdvisorPlaybook"("userId");

-- CreateIndex
CREATE INDEX "AdvisorPlaybook_firmId_idx" ON "AdvisorPlaybook"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorPlaybook_playbookType_idx" ON "AdvisorPlaybook"("playbookType");

-- CreateIndex
CREATE INDEX "AdvisorPlaybook_status_idx" ON "AdvisorPlaybook"("status");

-- CreateIndex
CREATE INDEX "FirmIntelligencePulse_userId_idx" ON "FirmIntelligencePulse"("userId");

-- CreateIndex
CREATE INDEX "FirmIntelligencePulse_firmId_idx" ON "FirmIntelligencePulse"("firmId");

-- CreateIndex
CREATE INDEX "FirmIntelligencePulse_category_idx" ON "FirmIntelligencePulse"("category");

-- CreateIndex
CREATE INDEX "FirmIntelligencePulse_status_idx" ON "FirmIntelligencePulse"("status");

-- CreateIndex
CREATE INDEX "FirmIntelligencePulse_createdAt_idx" ON "FirmIntelligencePulse"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowRule_userId_idx" ON "AdvisorWorkflowRule"("userId");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowRule_firmId_idx" ON "AdvisorWorkflowRule"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowRule_ruleType_idx" ON "AdvisorWorkflowRule"("ruleType");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowRule_status_idx" ON "AdvisorWorkflowRule"("status");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowAutomationRun_userId_idx" ON "AdvisorWorkflowAutomationRun"("userId");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowAutomationRun_firmId_idx" ON "AdvisorWorkflowAutomationRun"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowAutomationRun_status_idx" ON "AdvisorWorkflowAutomationRun"("status");

-- CreateIndex
CREATE INDEX "AdvisorWorkflowAutomationRun_createdAt_idx" ON "AdvisorWorkflowAutomationRun"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorAdaptiveMemory_userId_idx" ON "AdvisorAdaptiveMemory"("userId");

-- CreateIndex
CREATE INDEX "AdvisorAdaptiveMemory_firmId_idx" ON "AdvisorAdaptiveMemory"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorAdaptiveMemory_subjectType_idx" ON "AdvisorAdaptiveMemory"("subjectType");

-- CreateIndex
CREATE INDEX "AdvisorAdaptiveMemory_confidenceScore_idx" ON "AdvisorAdaptiveMemory"("confidenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorAdaptiveMemory_userId_subjectType_subjectName_memory_key" ON "AdvisorAdaptiveMemory"("userId", "subjectType", "subjectName", "memoryKey");

-- CreateIndex
CREATE INDEX "ClientPreferenceProfile_userId_idx" ON "ClientPreferenceProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientPreferenceProfile_firmId_idx" ON "ClientPreferenceProfile"("firmId");

-- CreateIndex
CREATE INDEX "ClientPreferenceProfile_status_idx" ON "ClientPreferenceProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPreferenceProfile_userId_clientName_key" ON "ClientPreferenceProfile"("userId", "clientName");

-- CreateIndex
CREATE INDEX "BotLearningProfile_userId_idx" ON "BotLearningProfile"("userId");

-- CreateIndex
CREATE INDEX "BotLearningProfile_firmId_idx" ON "BotLearningProfile"("firmId");

-- CreateIndex
CREATE INDEX "BotLearningProfile_status_idx" ON "BotLearningProfile"("status");

-- CreateIndex
CREATE INDEX "BotLearningProfile_successScore_idx" ON "BotLearningProfile"("successScore");

-- CreateIndex
CREATE UNIQUE INDEX "BotLearningProfile_userId_botName_key" ON "BotLearningProfile"("userId", "botName");

-- CreateIndex
CREATE INDEX "SourceReliabilitySignal_userId_idx" ON "SourceReliabilitySignal"("userId");

-- CreateIndex
CREATE INDEX "SourceReliabilitySignal_firmId_idx" ON "SourceReliabilitySignal"("firmId");

-- CreateIndex
CREATE INDEX "SourceReliabilitySignal_domain_idx" ON "SourceReliabilitySignal"("domain");

-- CreateIndex
CREATE INDEX "SourceReliabilitySignal_sourceName_idx" ON "SourceReliabilitySignal"("sourceName");

-- CreateIndex
CREATE INDEX "SourceReliabilitySignal_createdAt_idx" ON "SourceReliabilitySignal"("createdAt");

-- CreateIndex
CREATE INDEX "AdvisorFeedbackSignal_userId_idx" ON "AdvisorFeedbackSignal"("userId");

-- CreateIndex
CREATE INDEX "AdvisorFeedbackSignal_firmId_idx" ON "AdvisorFeedbackSignal"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorFeedbackSignal_targetType_idx" ON "AdvisorFeedbackSignal"("targetType");

-- CreateIndex
CREATE INDEX "AdvisorFeedbackSignal_processedAt_idx" ON "AdvisorFeedbackSignal"("processedAt");

-- CreateIndex
CREATE INDEX "AdvisorFeedbackSignal_createdAt_idx" ON "AdvisorFeedbackSignal"("createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_userId_idx" ON "AdaptiveRecommendation"("userId");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_firmId_idx" ON "AdaptiveRecommendation"("firmId");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_category_idx" ON "AdaptiveRecommendation"("category");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_status_idx" ON "AdaptiveRecommendation"("status");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_confidenceScore_idx" ON "AdaptiveRecommendation"("confidenceScore");

-- CreateIndex
CREATE INDEX "FirmLearningSnapshot_userId_idx" ON "FirmLearningSnapshot"("userId");

-- CreateIndex
CREATE INDEX "FirmLearningSnapshot_firmId_idx" ON "FirmLearningSnapshot"("firmId");

-- CreateIndex
CREATE INDEX "FirmLearningSnapshot_score_idx" ON "FirmLearningSnapshot"("score");

-- CreateIndex
CREATE INDEX "FirmLearningSnapshot_createdAt_idx" ON "FirmLearningSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotProfile_userId_key" ON "PersonalUserBotProfile"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProfile_userId_idx" ON "PersonalUserBotProfile"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProfile_firmId_idx" ON "PersonalUserBotProfile"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProfile_onboardingComplete_idx" ON "PersonalUserBotProfile"("onboardingComplete");

-- CreateIndex
CREATE INDEX "PersonalUserBotMessage_userId_idx" ON "PersonalUserBotMessage"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotMessage_profileId_idx" ON "PersonalUserBotMessage"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotMessage_role_idx" ON "PersonalUserBotMessage"("role");

-- CreateIndex
CREATE INDEX "PersonalUserBotMessage_createdAt_idx" ON "PersonalUserBotMessage"("createdAt");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_userId_idx" ON "PersonalUserBotCommand"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_profileId_idx" ON "PersonalUserBotCommand"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_firmId_idx" ON "PersonalUserBotCommand"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_commandType_idx" ON "PersonalUserBotCommand"("commandType");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_status_idx" ON "PersonalUserBotCommand"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommand_createdAt_idx" ON "PersonalUserBotCommand"("createdAt");

-- CreateIndex
CREATE INDEX "PersonalUserBotWorkspaceTab_userId_idx" ON "PersonalUserBotWorkspaceTab"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotWorkspaceTab_profileId_idx" ON "PersonalUserBotWorkspaceTab"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotWorkspaceTab_status_idx" ON "PersonalUserBotWorkspaceTab"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotWorkspaceTab_userId_tabName_key" ON "PersonalUserBotWorkspaceTab"("userId", "tabName");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserUiPreference_userId_key" ON "PersonalUserUiPreference"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserUiPreference_accentName_idx" ON "PersonalUserUiPreference"("accentName");

-- CreateIndex
CREATE INDEX "PersonalUserBotEmailDraft_userId_idx" ON "PersonalUserBotEmailDraft"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotEmailDraft_profileId_idx" ON "PersonalUserBotEmailDraft"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotEmailDraft_firmId_idx" ON "PersonalUserBotEmailDraft"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotEmailDraft_targetTicker_idx" ON "PersonalUserBotEmailDraft"("targetTicker");

-- CreateIndex
CREATE INDEX "PersonalUserBotEmailDraft_status_idx" ON "PersonalUserBotEmailDraft"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotPdfReport_downloadToken_key" ON "PersonalUserBotPdfReport"("downloadToken");

-- CreateIndex
CREATE INDEX "PersonalUserBotPdfReport_userId_idx" ON "PersonalUserBotPdfReport"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotPdfReport_profileId_idx" ON "PersonalUserBotPdfReport"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotPdfReport_firmId_idx" ON "PersonalUserBotPdfReport"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotPdfReport_reportType_idx" ON "PersonalUserBotPdfReport"("reportType");

-- CreateIndex
CREATE INDEX "PersonalUserBotPdfReport_status_idx" ON "PersonalUserBotPdfReport"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotAutomationRule_userId_idx" ON "PersonalUserBotAutomationRule"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotAutomationRule_profileId_idx" ON "PersonalUserBotAutomationRule"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotAutomationRule_firmId_idx" ON "PersonalUserBotAutomationRule"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotAutomationRule_targetTicker_idx" ON "PersonalUserBotAutomationRule"("targetTicker");

-- CreateIndex
CREATE INDEX "PersonalUserBotAutomationRule_status_idx" ON "PersonalUserBotAutomationRule"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotMemory_userId_idx" ON "PersonalUserBotMemory"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotMemory_profileId_idx" ON "PersonalUserBotMemory"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotMemory_firmId_idx" ON "PersonalUserBotMemory"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotMemory_memoryType_idx" ON "PersonalUserBotMemory"("memoryType");

-- CreateIndex
CREATE INDEX "PersonalUserBotMemory_status_idx" ON "PersonalUserBotMemory"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotMemory_userId_memoryKey_key" ON "PersonalUserBotMemory"("userId", "memoryKey");

-- CreateIndex
CREATE INDEX "PersonalUserBotSkill_userId_idx" ON "PersonalUserBotSkill"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotSkill_profileId_idx" ON "PersonalUserBotSkill"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotSkill_category_idx" ON "PersonalUserBotSkill"("category");

-- CreateIndex
CREATE INDEX "PersonalUserBotSkill_enabled_idx" ON "PersonalUserBotSkill"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotSkill_userId_skillKey_key" ON "PersonalUserBotSkill"("userId", "skillKey");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_userId_idx" ON "PersonalUserBotProactiveInsight"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_profileId_idx" ON "PersonalUserBotProactiveInsight"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_firmId_idx" ON "PersonalUserBotProactiveInsight"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_insightType_idx" ON "PersonalUserBotProactiveInsight"("insightType");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_priority_idx" ON "PersonalUserBotProactiveInsight"("priority");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_status_idx" ON "PersonalUserBotProactiveInsight"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotProactiveInsight_score_idx" ON "PersonalUserBotProactiveInsight"("score");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_userId_idx" ON "PersonalUserBotApprovalItem"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_profileId_idx" ON "PersonalUserBotApprovalItem"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_firmId_idx" ON "PersonalUserBotApprovalItem"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_actionType_idx" ON "PersonalUserBotApprovalItem"("actionType");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_riskLevel_idx" ON "PersonalUserBotApprovalItem"("riskLevel");

-- CreateIndex
CREATE INDEX "PersonalUserBotApprovalItem_status_idx" ON "PersonalUserBotApprovalItem"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotDataView_userId_idx" ON "PersonalUserBotDataView"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotDataView_profileId_idx" ON "PersonalUserBotDataView"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotDataView_viewType_idx" ON "PersonalUserBotDataView"("viewType");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotDataView_userId_viewName_key" ON "PersonalUserBotDataView"("userId", "viewName");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_userId_idx" ON "ClientBrainProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_firmId_idx" ON "ClientBrainProfile"("firmId");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_clientId_idx" ON "ClientBrainProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_clientName_idx" ON "ClientBrainProfile"("clientName");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_score_idx" ON "ClientBrainProfile"("score");

-- CreateIndex
CREATE INDEX "ClientBrainProfile_status_idx" ON "ClientBrainProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrainProfile_userId_clientId_key" ON "ClientBrainProfile"("userId", "clientId");

-- CreateIndex
CREATE INDEX "NextBestAction_userId_idx" ON "NextBestAction"("userId");

-- CreateIndex
CREATE INDEX "NextBestAction_firmId_idx" ON "NextBestAction"("firmId");

-- CreateIndex
CREATE INDEX "NextBestAction_priority_idx" ON "NextBestAction"("priority");

-- CreateIndex
CREATE INDEX "NextBestAction_status_idx" ON "NextBestAction"("status");

-- CreateIndex
CREATE INDEX "NextBestAction_score_idx" ON "NextBestAction"("score");

-- CreateIndex
CREATE INDEX "NextBestAction_clientId_idx" ON "NextBestAction"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "NextBestAction_userId_dedupeKey_key" ON "NextBestAction"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_userId_idx" ON "ComplianceProofTrail"("userId");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_firmId_idx" ON "ComplianceProofTrail"("firmId");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_actionType_idx" ON "ComplianceProofTrail"("actionType");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_humanStatus_idx" ON "ComplianceProofTrail"("humanStatus");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_riskLevel_idx" ON "ComplianceProofTrail"("riskLevel");

-- CreateIndex
CREATE INDEX "ComplianceProofTrail_clientId_idx" ON "ComplianceProofTrail"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceProofTrail_userId_dedupeKey_key" ON "ComplianceProofTrail"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "FirmKnowledgeEntry_userId_idx" ON "FirmKnowledgeEntry"("userId");

-- CreateIndex
CREATE INDEX "FirmKnowledgeEntry_firmId_idx" ON "FirmKnowledgeEntry"("firmId");

-- CreateIndex
CREATE INDEX "FirmKnowledgeEntry_category_idx" ON "FirmKnowledgeEntry"("category");

-- CreateIndex
CREATE INDEX "FirmKnowledgeEntry_score_idx" ON "FirmKnowledgeEntry"("score");

-- CreateIndex
CREATE UNIQUE INDEX "FirmKnowledgeEntry_userId_entryKey_key" ON "FirmKnowledgeEntry"("userId", "entryKey");

-- CreateIndex
CREATE INDEX "AdvisorDayBrief_userId_idx" ON "AdvisorDayBrief"("userId");

-- CreateIndex
CREATE INDEX "AdvisorDayBrief_firmId_idx" ON "AdvisorDayBrief"("firmId");

-- CreateIndex
CREATE INDEX "AdvisorDayBrief_status_idx" ON "AdvisorDayBrief"("status");

-- CreateIndex
CREATE INDEX "AdvisorDayBrief_createdAt_idx" ON "AdvisorDayBrief"("createdAt");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_userId_idx" ON "WatchlistPriceAlert"("userId");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_watchlistId_idx" ON "WatchlistPriceAlert"("watchlistId");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_watchlistItemId_idx" ON "WatchlistPriceAlert"("watchlistItemId");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_symbol_idx" ON "WatchlistPriceAlert"("symbol");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_status_idx" ON "WatchlistPriceAlert"("status");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlert_lastCheckedAt_idx" ON "WatchlistPriceAlert"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlertEvent_userId_idx" ON "WatchlistPriceAlertEvent"("userId");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlertEvent_alertId_idx" ON "WatchlistPriceAlertEvent"("alertId");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlertEvent_symbol_idx" ON "WatchlistPriceAlertEvent"("symbol");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlertEvent_triggerType_idx" ON "WatchlistPriceAlertEvent"("triggerType");

-- CreateIndex
CREATE INDEX "WatchlistPriceAlertEvent_createdAt_idx" ON "WatchlistPriceAlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_userId_idx" ON "BackendPlatformEvent"("userId");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_firmId_idx" ON "BackendPlatformEvent"("firmId");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_eventType_idx" ON "BackendPlatformEvent"("eventType");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_area_idx" ON "BackendPlatformEvent"("area");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_severity_idx" ON "BackendPlatformEvent"("severity");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_status_idx" ON "BackendPlatformEvent"("status");

-- CreateIndex
CREATE INDEX "BackendPlatformEvent_createdAt_idx" ON "BackendPlatformEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackendPlatformEvent_userId_eventKey_key" ON "BackendPlatformEvent"("userId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "BackendRolePolicy_policyKey_key" ON "BackendRolePolicy"("policyKey");

-- CreateIndex
CREATE INDEX "BackendRolePolicy_userId_idx" ON "BackendRolePolicy"("userId");

-- CreateIndex
CREATE INDEX "BackendRolePolicy_firmId_idx" ON "BackendRolePolicy"("firmId");

-- CreateIndex
CREATE INDEX "BackendRolePolicy_roleKey_idx" ON "BackendRolePolicy"("roleKey");

-- CreateIndex
CREATE INDEX "BackendRolePolicy_status_idx" ON "BackendRolePolicy"("status");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_userId_idx" ON "BackendApprovalItem"("userId");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_firmId_idx" ON "BackendApprovalItem"("firmId");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_actionType_idx" ON "BackendApprovalItem"("actionType");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_riskLevel_idx" ON "BackendApprovalItem"("riskLevel");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_status_idx" ON "BackendApprovalItem"("status");

-- CreateIndex
CREATE INDEX "BackendApprovalItem_createdAt_idx" ON "BackendApprovalItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackendNotificationRule_ownerRuleKey_key" ON "BackendNotificationRule"("ownerRuleKey");

-- CreateIndex
CREATE INDEX "BackendNotificationRule_userId_idx" ON "BackendNotificationRule"("userId");

-- CreateIndex
CREATE INDEX "BackendNotificationRule_firmId_idx" ON "BackendNotificationRule"("firmId");

-- CreateIndex
CREATE INDEX "BackendNotificationRule_scopeType_idx" ON "BackendNotificationRule"("scopeType");

-- CreateIndex
CREATE INDEX "BackendNotificationRule_channel_idx" ON "BackendNotificationRule"("channel");

-- CreateIndex
CREATE INDEX "BackendNotificationRule_status_idx" ON "BackendNotificationRule"("status");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_userId_idx" ON "BackendDataQualityRecord"("userId");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_firmId_idx" ON "BackendDataQualityRecord"("firmId");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_entityType_idx" ON "BackendDataQualityRecord"("entityType");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_sourceName_idx" ON "BackendDataQualityRecord"("sourceName");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_freshnessStatus_idx" ON "BackendDataQualityRecord"("freshnessStatus");

-- CreateIndex
CREATE INDEX "BackendDataQualityRecord_qualityScore_idx" ON "BackendDataQualityRecord"("qualityScore");

-- CreateIndex
CREATE UNIQUE INDEX "BackendDataQualityRecord_userId_entityType_entityId_sourceN_key" ON "BackendDataQualityRecord"("userId", "entityType", "entityId", "sourceName");

-- CreateIndex
CREATE UNIQUE INDEX "BackendAiTool_ownerToolKey_key" ON "BackendAiTool"("ownerToolKey");

-- CreateIndex
CREATE INDEX "BackendAiTool_userId_idx" ON "BackendAiTool"("userId");

-- CreateIndex
CREATE INDEX "BackendAiTool_firmId_idx" ON "BackendAiTool"("firmId");

-- CreateIndex
CREATE INDEX "BackendAiTool_toolKey_idx" ON "BackendAiTool"("toolKey");

-- CreateIndex
CREATE INDEX "BackendAiTool_category_idx" ON "BackendAiTool"("category");

-- CreateIndex
CREATE INDEX "BackendAiTool_enabled_idx" ON "BackendAiTool"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BackendJobDefinition_ownerJobKey_key" ON "BackendJobDefinition"("ownerJobKey");

-- CreateIndex
CREATE INDEX "BackendJobDefinition_userId_idx" ON "BackendJobDefinition"("userId");

-- CreateIndex
CREATE INDEX "BackendJobDefinition_firmId_idx" ON "BackendJobDefinition"("firmId");

-- CreateIndex
CREATE INDEX "BackendJobDefinition_jobKey_idx" ON "BackendJobDefinition"("jobKey");

-- CreateIndex
CREATE INDEX "BackendJobDefinition_category_idx" ON "BackendJobDefinition"("category");

-- CreateIndex
CREATE INDEX "BackendJobDefinition_status_idx" ON "BackendJobDefinition"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BackendSystemHealthCheck_ownerCheckKey_key" ON "BackendSystemHealthCheck"("ownerCheckKey");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_userId_idx" ON "BackendSystemHealthCheck"("userId");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_firmId_idx" ON "BackendSystemHealthCheck"("firmId");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_checkKey_idx" ON "BackendSystemHealthCheck"("checkKey");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_category_idx" ON "BackendSystemHealthCheck"("category");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_status_idx" ON "BackendSystemHealthCheck"("status");

-- CreateIndex
CREATE INDEX "BackendSystemHealthCheck_score_idx" ON "BackendSystemHealthCheck"("score");

-- CreateIndex
CREATE INDEX "BackendTenantAccessCheck_userId_idx" ON "BackendTenantAccessCheck"("userId");

-- CreateIndex
CREATE INDEX "BackendTenantAccessCheck_firmId_idx" ON "BackendTenantAccessCheck"("firmId");

-- CreateIndex
CREATE INDEX "BackendTenantAccessCheck_checkName_idx" ON "BackendTenantAccessCheck"("checkName");

-- CreateIndex
CREATE INDEX "BackendTenantAccessCheck_status_idx" ON "BackendTenantAccessCheck"("status");

-- CreateIndex
CREATE INDEX "BackendDemoSeedRun_userId_idx" ON "BackendDemoSeedRun"("userId");

-- CreateIndex
CREATE INDEX "BackendDemoSeedRun_firmId_idx" ON "BackendDemoSeedRun"("firmId");

-- CreateIndex
CREATE INDEX "BackendDemoSeedRun_status_idx" ON "BackendDemoSeedRun"("status");

-- CreateIndex
CREATE INDEX "BackendDemoSeedRun_createdAt_idx" ON "BackendDemoSeedRun"("createdAt");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_userId_idx" ON "BackendVendorIntegration"("userId");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_firmId_idx" ON "BackendVendorIntegration"("firmId");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_vendorKey_idx" ON "BackendVendorIntegration"("vendorKey");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_category_idx" ON "BackendVendorIntegration"("category");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_status_idx" ON "BackendVendorIntegration"("status");

-- CreateIndex
CREATE INDEX "BackendVendorIntegration_enabled_idx" ON "BackendVendorIntegration"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BackendVendorIntegration_userId_vendorKey_key" ON "BackendVendorIntegration"("userId", "vendorKey");

-- CreateIndex
CREATE INDEX "BackendFeatureFlag_userId_idx" ON "BackendFeatureFlag"("userId");

-- CreateIndex
CREATE INDEX "BackendFeatureFlag_firmId_idx" ON "BackendFeatureFlag"("firmId");

-- CreateIndex
CREATE INDEX "BackendFeatureFlag_flagKey_idx" ON "BackendFeatureFlag"("flagKey");

-- CreateIndex
CREATE INDEX "BackendFeatureFlag_category_idx" ON "BackendFeatureFlag"("category");

-- CreateIndex
CREATE INDEX "BackendFeatureFlag_enabled_idx" ON "BackendFeatureFlag"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BackendFeatureFlag_userId_flagKey_key" ON "BackendFeatureFlag"("userId", "flagKey");

-- CreateIndex
CREATE INDEX "BackendJobRun_userId_idx" ON "BackendJobRun"("userId");

-- CreateIndex
CREATE INDEX "BackendJobRun_firmId_idx" ON "BackendJobRun"("firmId");

-- CreateIndex
CREATE INDEX "BackendJobRun_jobKey_idx" ON "BackendJobRun"("jobKey");

-- CreateIndex
CREATE INDEX "BackendJobRun_status_idx" ON "BackendJobRun"("status");

-- CreateIndex
CREATE INDEX "BackendJobRun_startedAt_idx" ON "BackendJobRun"("startedAt");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_userId_idx" ON "BackendOutboundDelivery"("userId");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_firmId_idx" ON "BackendOutboundDelivery"("firmId");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_channel_idx" ON "BackendOutboundDelivery"("channel");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_status_idx" ON "BackendOutboundDelivery"("status");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_urgency_idx" ON "BackendOutboundDelivery"("urgency");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_score_idx" ON "BackendOutboundDelivery"("score");

-- CreateIndex
CREATE INDEX "BackendOutboundDelivery_createdAt_idx" ON "BackendOutboundDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "BackendDataSyncCheckpoint_userId_idx" ON "BackendDataSyncCheckpoint"("userId");

-- CreateIndex
CREATE INDEX "BackendDataSyncCheckpoint_firmId_idx" ON "BackendDataSyncCheckpoint"("firmId");

-- CreateIndex
CREATE INDEX "BackendDataSyncCheckpoint_sourceKey_idx" ON "BackendDataSyncCheckpoint"("sourceKey");

-- CreateIndex
CREATE INDEX "BackendDataSyncCheckpoint_status_idx" ON "BackendDataSyncCheckpoint"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BackendDataSyncCheckpoint_userId_sourceKey_scopeKey_key" ON "BackendDataSyncCheckpoint"("userId", "sourceKey", "scopeKey");

-- CreateIndex
CREATE INDEX "BackendAiToolRun_userId_idx" ON "BackendAiToolRun"("userId");

-- CreateIndex
CREATE INDEX "BackendAiToolRun_firmId_idx" ON "BackendAiToolRun"("firmId");

-- CreateIndex
CREATE INDEX "BackendAiToolRun_toolKey_idx" ON "BackendAiToolRun"("toolKey");

-- CreateIndex
CREATE INDEX "BackendAiToolRun_status_idx" ON "BackendAiToolRun"("status");

-- CreateIndex
CREATE INDEX "BackendAiToolRun_createdAt_idx" ON "BackendAiToolRun"("createdAt");

-- CreateIndex
CREATE INDEX "PersonalUserBotVoiceSession_userId_idx" ON "PersonalUserBotVoiceSession"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotVoiceSession_profileId_idx" ON "PersonalUserBotVoiceSession"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotVoiceSession_firmId_idx" ON "PersonalUserBotVoiceSession"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotVoiceSession_status_idx" ON "PersonalUserBotVoiceSession"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotVoiceSession_createdAt_idx" ON "PersonalUserBotVoiceSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotVoiceSession_userId_sessionKey_key" ON "PersonalUserBotVoiceSession"("userId", "sessionKey");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommandCorrection_userId_idx" ON "PersonalUserBotCommandCorrection"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommandCorrection_profileId_idx" ON "PersonalUserBotCommandCorrection"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommandCorrection_firmId_idx" ON "PersonalUserBotCommandCorrection"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommandCorrection_correctedIntent_idx" ON "PersonalUserBotCommandCorrection"("correctedIntent");

-- CreateIndex
CREATE INDEX "PersonalUserBotCommandCorrection_status_idx" ON "PersonalUserBotCommandCorrection"("status");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_userId_idx" ON "PersonalUserBotTrainingPhrase"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_profileId_idx" ON "PersonalUserBotTrainingPhrase"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_firmId_idx" ON "PersonalUserBotTrainingPhrase"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_targetIntent_idx" ON "PersonalUserBotTrainingPhrase"("targetIntent");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_targetRoute_idx" ON "PersonalUserBotTrainingPhrase"("targetRoute");

-- CreateIndex
CREATE INDEX "PersonalUserBotTrainingPhrase_status_idx" ON "PersonalUserBotTrainingPhrase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotTrainingPhrase_userId_phraseKey_key" ON "PersonalUserBotTrainingPhrase"("userId", "phraseKey");

-- CreateIndex
CREATE INDEX "PersonalUserBotPlatformMapItem_userId_idx" ON "PersonalUserBotPlatformMapItem"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotPlatformMapItem_firmId_idx" ON "PersonalUserBotPlatformMapItem"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotPlatformMapItem_category_idx" ON "PersonalUserBotPlatformMapItem"("category");

-- CreateIndex
CREATE INDEX "PersonalUserBotPlatformMapItem_route_idx" ON "PersonalUserBotPlatformMapItem"("route");

-- CreateIndex
CREATE INDEX "PersonalUserBotPlatformMapItem_status_idx" ON "PersonalUserBotPlatformMapItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalUserBotPlatformMapItem_userId_itemKey_key" ON "PersonalUserBotPlatformMapItem"("userId", "itemKey");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_userId_idx" ON "PersonalUserBotResearchRun"("userId");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_profileId_idx" ON "PersonalUserBotResearchRun"("profileId");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_firmId_idx" ON "PersonalUserBotResearchRun"("firmId");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_ticker_idx" ON "PersonalUserBotResearchRun"("ticker");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_depth_idx" ON "PersonalUserBotResearchRun"("depth");

-- CreateIndex
CREATE INDEX "PersonalUserBotResearchRun_status_idx" ON "PersonalUserBotResearchRun"("status");

-- CreateIndex
CREATE INDEX "AdvisorRealtimeSource_userId_idx" ON "AdvisorRealtimeSource"("userId");

-- CreateIndex
CREATE INDEX "AdvisorRealtimeSource_enabled_idx" ON "AdvisorRealtimeSource"("enabled");

-- CreateIndex
CREATE INDEX "AdvisorRealtimeSource_sourceKind_idx" ON "AdvisorRealtimeSource"("sourceKind");

-- CreateIndex
CREATE INDEX "AdvisorRealtimeSource_platformType_idx" ON "AdvisorRealtimeSource"("platformType");

-- CreateIndex
CREATE INDEX "AdvisorRealtimeSource_lastRunAt_idx" ON "AdvisorRealtimeSource"("lastRunAt");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_userId_idx" ON "RealtimePriceSnapshot"("userId");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_symbol_idx" ON "RealtimePriceSnapshot"("symbol");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_provider_idx" ON "RealtimePriceSnapshot"("provider");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_isRealtime_idx" ON "RealtimePriceSnapshot"("isRealtime");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_qualityScore_idx" ON "RealtimePriceSnapshot"("qualityScore");

-- CreateIndex
CREATE INDEX "RealtimePriceSnapshot_createdAt_idx" ON "RealtimePriceSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_userId_idx" ON "RealtimeInvestorNotification"("userId");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_symbol_idx" ON "RealtimeInvestorNotification"("symbol");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_severity_idx" ON "RealtimeInvestorNotification"("severity");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_score_idx" ON "RealtimeInvestorNotification"("score");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_status_idx" ON "RealtimeInvestorNotification"("status");

-- CreateIndex
CREATE INDEX "RealtimeInvestorNotification_createdAt_idx" ON "RealtimeInvestorNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchAsset" ADD CONSTRAINT "WatchAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamedWatchlist" ADD CONSTRAINT "NamedWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamedWatchlistItem" ADD CONSTRAINT "NamedWatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamedWatchlistItem" ADD CONSTRAINT "NamedWatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "NamedWatchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentureProject" ADD CONSTRAINT "VentureProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioHolding" ADD CONSTRAINT "PortfolioHolding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorNote" ADD CONSTRAINT "AdvisorNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorNote" ADD CONSTRAINT "AdvisorNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTask" ADD CONSTRAINT "MeetingTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTask" ADD CONSTRAINT "MeetingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskReview" ADD CONSTRAINT "RiskReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVaultItem" ADD CONSTRAINT "DocumentVaultItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVaultItem" ADD CONSTRAINT "DocumentVaultItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorGoal" ADD CONSTRAINT "InvestorGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorInsight" ADD CONSTRAINT "InvestorInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRun" ADD CONSTRAINT "IntelligenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeadlineDecision" ADD CONSTRAINT "HeadlineDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSourceConfig" ADD CONSTRAINT "NewsSourceConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceRetentionPolicy" ADD CONSTRAINT "IntelligenceRetentionPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestReport" ADD CONSTRAINT "DigestReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingReport" ADD CONSTRAINT "BriefingReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingReport" ADD CONSTRAINT "BriefingReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorAccount" ADD CONSTRAINT "InvestorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorHolding" ADD CONSTRAINT "InvestorHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InvestorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorHolding" ADD CONSTRAINT "InvestorHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationModel" ADD CONSTRAINT "AllocationModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationTarget" ADD CONSTRAINT "AllocationTarget_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AllocationModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceReport" ADD CONSTRAINT "RebalanceReport_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AllocationModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceReport" ADD CONSTRAINT "RebalanceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioReport" ADD CONSTRAINT "ScenarioReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisclosureAcceptance" ADD CONSTRAINT "DisclosureAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSecuritySetting" ADD CONSTRAINT "UserSecuritySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firm" ADD CONSTRAINT "Firm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativeVenture" ADD CONSTRAINT "AlternativeVenture_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativeVenture" ADD CONSTRAINT "AlternativeVenture_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativePennyStock" ADD CONSTRAINT "AlternativePennyStock_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternativePennyStock" ADD CONSTRAINT "AlternativePennyStock_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvite" ADD CONSTRAINT "FirmInvite_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmInvite" ADD CONSTRAINT "FirmInvite_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmProject" ADD CONSTRAINT "FirmProject_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmProjectAssignment" ADD CONSTRAINT "FirmProjectAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FirmMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmProjectAssignment" ADD CONSTRAINT "FirmProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAgenda" ADD CONSTRAINT "WeeklyAgenda_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAgenda" ADD CONSTRAINT "WeeklyAgenda_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FirmMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmAgendaTask" ADD CONSTRAINT "FirmAgendaTask_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "WeeklyAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmAgendaTask" ADD CONSTRAINT "FirmAgendaTask_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmAgendaTask" ADD CONSTRAINT "FirmAgendaTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaComment" ADD CONSTRAINT "AgendaComment_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "WeeklyAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaComment" ADD CONSTRAINT "AgendaComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FirmAgendaTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaComment" ADD CONSTRAINT "AgendaComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmPost" ADD CONSTRAINT "FirmPost_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "FirmMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmPost" ADD CONSTRAINT "FirmPost_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmPost" ADD CONSTRAINT "FirmPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FirmProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_headlineDecisionId_fkey" FOREIGN KEY ("headlineDecisionId") REFERENCES "HeadlineDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
