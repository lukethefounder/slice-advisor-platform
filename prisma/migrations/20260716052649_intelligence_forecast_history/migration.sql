-- CreateTable
CREATE TABLE "IntelligenceForecastRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "asOfAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calibrationVersion" TEXT NOT NULL,
    "marketRegime" TEXT NOT NULL,
    "sliceSentimentScore" DOUBLE PRECISION NOT NULL,
    "dataQualityScore" DOUBLE PRECISION NOT NULL,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "independentSourceCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "staleDataWarning" TEXT,
    "simulationPaths" INTEGER NOT NULL DEFAULT 0,
    "simulationSeed" INTEGER NOT NULL DEFAULT 0,
    "camelStatus" TEXT NOT NULL DEFAULT 'disabled',
    "camelWorkforceMode" TEXT NOT NULL DEFAULT 'DISABLED',
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceForecastHorizon" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetAt" TIMESTAMP(3) NOT NULL,
    "initialPrice" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "positiveReturnProbability" DOUBLE PRECISION NOT NULL,
    "expectedReturnPercent" DOUBLE PRECISION NOT NULL,
    "expectedPrice" DOUBLE PRECISION NOT NULL,
    "rangeLowPercent" DOUBLE PRECISION NOT NULL,
    "rangeHighPercent" DOUBLE PRECISION NOT NULL,
    "priceRangeLow" DOUBLE PRECISION NOT NULL,
    "priceRangeHigh" DOUBLE PRECISION NOT NULL,
    "volatilityPercent" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "modelAgreement" TEXT NOT NULL,
    "simulationAgreement" TEXT NOT NULL,
    "dataQuality" TEXT NOT NULL,
    "modelDisagreement" DOUBLE PRECISION NOT NULL,
    "primaryUncertainty" TEXT NOT NULL,
    "contributionsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceForecastHorizon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceForecastOutcome" (
    "id" TEXT NOT NULL,
    "forecastHorizonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "providerTimestamp" TIMESTAMP(3),
    "initialPrice" DOUBLE PRECISION NOT NULL,
    "observedPrice" DOUBLE PRECISION NOT NULL,
    "realizedReturnPercent" DOUBLE PRECISION NOT NULL,
    "positiveOutcome" BOOLEAN NOT NULL,
    "brierScore" DOUBLE PRECISION NOT NULL,
    "logLoss" DOUBLE PRECISION NOT NULL,
    "intervalCovered" BOOLEAN NOT NULL,
    "directionalCorrect" BOOLEAN NOT NULL,
    "absoluteReturnError" DOUBLE PRECISION NOT NULL,
    "priceProvider" TEXT NOT NULL,
    "rawJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceForecastOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_userId_idx" ON "IntelligenceForecastRun"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_symbol_idx" ON "IntelligenceForecastRun"("symbol");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_asOfAt_idx" ON "IntelligenceForecastRun"("asOfAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_generatedAt_idx" ON "IntelligenceForecastRun"("generatedAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_modelVersion_idx" ON "IntelligenceForecastRun"("modelVersion");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_marketRegime_idx" ON "IntelligenceForecastRun"("marketRegime");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_camelStatus_idx" ON "IntelligenceForecastRun"("camelStatus");

-- CreateIndex
CREATE INDEX "IntelligenceForecastRun_status_idx" ON "IntelligenceForecastRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastRun_userId_requestId_key" ON "IntelligenceForecastRun"("userId", "requestId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_forecastRunId_idx" ON "IntelligenceForecastHorizon"("forecastRunId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_userId_idx" ON "IntelligenceForecastHorizon"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_symbol_idx" ON "IntelligenceForecastHorizon"("symbol");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_horizon_idx" ON "IntelligenceForecastHorizon"("horizon");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_targetAt_idx" ON "IntelligenceForecastHorizon"("targetAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastHorizon_status_idx" ON "IntelligenceForecastHorizon"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastHorizon_forecastRunId_horizon_key" ON "IntelligenceForecastHorizon"("forecastRunId", "horizon");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceForecastOutcome_forecastHorizonId_key" ON "IntelligenceForecastOutcome"("forecastHorizonId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_userId_idx" ON "IntelligenceForecastOutcome"("userId");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_symbol_idx" ON "IntelligenceForecastOutcome"("symbol");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_horizon_idx" ON "IntelligenceForecastOutcome"("horizon");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_observedAt_idx" ON "IntelligenceForecastOutcome"("observedAt");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_priceProvider_idx" ON "IntelligenceForecastOutcome"("priceProvider");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_directionalCorrect_idx" ON "IntelligenceForecastOutcome"("directionalCorrect");

-- CreateIndex
CREATE INDEX "IntelligenceForecastOutcome_intervalCovered_idx" ON "IntelligenceForecastOutcome"("intervalCovered");

-- AddForeignKey
ALTER TABLE "IntelligenceForecastRun" ADD CONSTRAINT "IntelligenceForecastRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastHorizon" ADD CONSTRAINT "IntelligenceForecastHorizon_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "IntelligenceForecastRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceForecastOutcome" ADD CONSTRAINT "IntelligenceForecastOutcome_forecastHorizonId_fkey" FOREIGN KEY ("forecastHorizonId") REFERENCES "IntelligenceForecastHorizon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
