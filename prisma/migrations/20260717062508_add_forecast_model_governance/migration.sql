-- CreateTable
CREATE TABLE "IntelligenceForecastModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "engineVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calibrationVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Shadow',
    "configurationJson" TEXT NOT NULL DEFAULT '{}',
    "promotionGatesJson" TEXT NOT NULL DEFAULT '{}',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "promotedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceForecastModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceForecastBacktestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "comparisonModelVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Running',
    "evaluationMode" TEXT NOT NULL DEFAULT 'Prospective point-in-time',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "evaluationStartAt" TIMESTAMP(3),
    "evaluationEndAt" TIMESTAMP(3),
    "totalSampleCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleSampleCount" INTEGER NOT NULL DEFAULT 0,
    "holdoutSampleCount" INTEGER NOT NULL DEFAULT 0,
    "excludedSampleCount" INTEGER NOT NULL DEFAULT 0,
    "holdoutFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "pointInTimeSafe" BOOLEAN NOT NULL DEFAULT false,
    "lookaheadDetected" BOOLEAN NOT NULL DEFAULT false,
    "overallMetricsJson" TEXT NOT NULL DEFAULT '{}',
    "horizonMetricsJson" TEXT NOT NULL DEFAULT '[]',
    "regimeMetricsJson" TEXT NOT NULL DEFAULT '[]',
    "comparisonJson" TEXT NOT NULL DEFAULT '{}',
    "exclusionsJson" TEXT NOT NULL DEFAULT '[]',
    "gatesJson" TEXT NOT NULL DEFAULT '{}',
    "recommendation" TEXT NOT NULL DEFAULT 'Keep in shadow',
    "failureDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceForecastBacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceForecastDriftAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'All',
    "severity" TEXT NOT NULL DEFAULT 'Warning',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "reason" TEXT NOT NULL,
    "baselineWindowStartAt" TIMESTAMP(3),
    "baselineWindowEndAt" TIMESTAMP(3),
    "currentWindowStartAt" TIMESTAMP(3),
    "currentWindowEndAt" TIMESTAMP(3),
    "baselineSampleCount" INTEGER NOT NULL DEFAULT 0,
    "currentSampleCount" INTEGER NOT NULL DEFAULT 0,
    "brierScoreChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "directionalAccuracyChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intervalCoverageChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meanAbsoluteErrorChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IntelligenceForecastDriftAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntelligenceForecastModel_userId_idx" ON "IntelligenceForecastModel"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastModel_status_idx" ON "IntelligenceForecastModel"("status");

-- CreateIndex
CREATE INDEX "IntelligenceForecastModel_modelVersion_idx" ON "IntelligenceForecastModel"("modelVersion");

-- CreateIndex
CREATE INDEX "IntelligenceForecastModel_createdAt_idx" ON "IntelligenceForecastModel"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastModel_userId_modelKey_key" ON "IntelligenceForecastModel"("userId", "modelKey");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastModel_userId_modelVersion_key" ON "IntelligenceForecastModel"("userId", "modelVersion");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_userId_idx" ON "IntelligenceForecastBacktestRun"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_modelId_idx" ON "IntelligenceForecastBacktestRun"("modelId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_modelVersion_idx" ON "IntelligenceForecastBacktestRun"("modelVersion");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_status_idx" ON "IntelligenceForecastBacktestRun"("status");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_completedAt_idx" ON "IntelligenceForecastBacktestRun"("completedAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastBacktestRun_createdAt_idx" ON "IntelligenceForecastBacktestRun"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_userId_idx" ON "IntelligenceForecastDriftAlert"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_modelId_idx" ON "IntelligenceForecastDriftAlert"("modelId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_modelVersion_idx" ON "IntelligenceForecastDriftAlert"("modelVersion");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_horizon_idx" ON "IntelligenceForecastDriftAlert"("horizon");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_severity_idx" ON "IntelligenceForecastDriftAlert"("severity");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_status_idx" ON "IntelligenceForecastDriftAlert"("status");

-- CreateIndex
CREATE INDEX "IntelligenceForecastDriftAlert_createdAt_idx" ON "IntelligenceForecastDriftAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastDriftAlert_userId_dedupeKey_key" ON "IntelligenceForecastDriftAlert"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "IntelligenceForecastModel" ADD CONSTRAINT "IntelligenceForecastModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastBacktestRun" ADD CONSTRAINT "IntelligenceForecastBacktestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastBacktestRun" ADD CONSTRAINT "IntelligenceForecastBacktestRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IntelligenceForecastModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastDriftAlert" ADD CONSTRAINT "IntelligenceForecastDriftAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastDriftAlert" ADD CONSTRAINT "IntelligenceForecastDriftAlert_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "IntelligenceForecastModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
