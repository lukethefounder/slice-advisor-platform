import "server-only";

import {
  intelligenceMemoryWindow,
  type IntelligenceMemoryWindow,
} from "@/lib/intelligence-forecast/memory-window";

export {
  DEFAULT_INTELLIGENCE_MEMORY_DAYS,
  intelligenceMemoryWindow,
  MAXIMUM_INTELLIGENCE_MEMORY_DAYS,
  MINIMUM_INTELLIGENCE_MEMORY_DAYS,
} from "@/lib/intelligence-forecast/memory-window";

import {
  auditForecastEvidenceRun,
  buildPointInTimeEvidenceReport,
} from "@/lib/intelligence-forecast/point-in-time-warehouse";
import { prisma } from "@/lib/prisma";

const OVERALL_EVIDENCE_SOURCE = "Overall Snapshot";
const EVIDENCE_ENTITY_TYPE = "IntelligenceForecastEvidence";
const HORIZON_EVENT_TYPE = "HORIZON_SHADOW_PREDICTION";
const ENSEMBLE_EVENT_TYPE = "INTELLIGENCE_ENSEMBLE_PREDICTION";
const SIMULATION_EVENT_TYPE = "INTELLIGENCE_AGENT_SIMULATION";

type JsonRecord = Record<string, unknown>;

export type OperatingForecastRun = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: string;
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  sourceCount: number;
  independentSourceCount: number;
  simulationPaths: number;
  status: string;
  horizonCount: number;
  pendingHorizonCount: number;
  settledHorizonCount: number;
  nextPendingTargetAt: string | null;
};

export type OperatingPrediction = {
  id: string;
  createdAt: string;
  forecastRunId: string | null;
  symbol: string | null;
  modelVersion: string | null;
  horizon: string | null;
  direction: string | null;
  probability: number | null;
  expectedReturnPercent: number | null;
  confidence: number | null;
  status: string;
};

export type OperatingModelRecord = {
  id: string;
  displayName: string;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  disabledAt: string | null;
};

export type OperatingBacktestRecord = {
  id: string;
  modelId: string;
  modelVersion: string;
  status: string;
  recommendation: string | null;
  createdAt: string;
  completedAt: string | null;
  holdoutSampleCount: number;
  eligibleSampleCount: number;
  excludedSampleCount: number;
  pointInTimeSafe: boolean;
  lookaheadDetected: boolean;
};

export type OperatingDriftAlert = {
  id: string;
  modelId: string;
  modelVersion: string;
  horizon: string;
  severity: string;
  status: string;
  reason: string;
  createdAt: string;
  currentWindowEndAt: string | null;
};

export type OperatingWarehouseRun = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: string;
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  forecastStatus: string;
  warehouseStatus: string;
  warehouseCheckedAt: string | null;
  pointInTimeSafe: boolean;
  integrityScore: number;
  timestampCount: number;
  futureEvidenceCount: number;
  futureEvidencePaths: string[];
  missingRequiredCategories: string[];
  fallbackCategories: string[];
  staleCategories: string[];
  earliestEvidenceAt: string | null;
  latestEvidenceAt: string | null;
  warnings: string[];
  categories: Array<{
    sourceName: string;
    present: boolean;
    required: boolean;
    qualityScore: number;
    liveStatus: string;
    freshnessStatus: string;
    fallbackUsed: boolean;
    stale: boolean;
    futureTimestampCount: number;
    asOfAt: string | null;
    warnings: string[];
    status: "Validated" | "Needs Review";
    materialized: boolean;
    materializedStatus: string | null;
    lastCheckedAt: string | null;
  }>;
};

export type IntelligenceOperatingMemory = {
  generatedAt: string;
  window: IntelligenceMemoryWindow;
  summary: {
    forecastRuns: number;
    returnedRuns: number;
    pendingHorizons: number;
    settledHorizons: number;
    settledOutcomes: number;
    modelArtifacts: number;
    horizonPredictions: number;
    ensemblePredictions: number;
    simulationRecords: number;
    completedBacktests: number;
    openDriftAlerts: number;
    evidenceAudits: number;
    validatedEvidenceAudits: number;
    needsReviewEvidenceAudits: number;
  };
  latest: {
    forecastGeneratedAt: string | null;
    providerAsOfAt: string | null;
    settledOutcomeAt: string | null;
    modelCreatedAt: string | null;
    horizonPredictionAt: string | null;
    ensemblePredictionAt: string | null;
    backtestCompletedAt: string | null;
    evidenceAuditAt: string | null;
  };
  recentRuns: OperatingForecastRun[];
  models: OperatingModelRecord[];
  horizonPredictions: OperatingPrediction[];
  ensemblePredictions: OperatingPrediction[];
  backtests: OperatingBacktestRecord[];
  driftAlerts: OperatingDriftAlert[];
  safeguards: {
    autonomousTradingEnabled: false;
    automaticPromotionEnabled: false;
    futureDatedEvidenceAccepted: false;
    demoOutcomesAcceptedForValidation: false;
    monthMemoryMinimumEnforced: true;
  };
};

type ForecastRunMemoryRow = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: Date;
  generatedAt: Date;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  sourceCount: number;
  independentSourceCount: number;
  simulationPaths: number;
  status: string;
  horizons: Array<{
    status: string;
    targetAt: Date;
  }>;
};

type ModelMemoryRow = {
  id: string;
  displayName: string;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  promotedAt: Date | null;
  disabledAt: Date | null;
};

type PredictionEventRow = {
  id: string;
  createdAt: Date;
  sourceId: string | null;
  status: string;
  metadataJson: string;
};

type BacktestMemoryRow = {
  id: string;
  modelId: string;
  modelVersion: string;
  status: string;
  recommendation: string | null;
  createdAt: Date;
  completedAt: Date | null;
  holdoutSampleCount: number;
  eligibleSampleCount: number;
  excludedSampleCount: number;
  pointInTimeSafe: boolean;
  lookaheadDetected: boolean;
};

type DriftAlertMemoryRow = {
  id: string;
  modelId: string;
  modelVersion: string;
  horizon: string;
  severity: string;
  status: string;
  reason: string;
  createdAt: Date;
  currentWindowEndAt: Date | null;
};

type LatestEvidenceAuditRow = {
  lastCheckedAt: Date | null;
};

type WarehouseForecastRunRow = {
  id: string;
  userId: string;
  requestId: string;
  symbol: string;
  asOfAt: Date;
  generatedAt: Date;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  dataQualityScore: number;
  staleDataWarning: string | null;
  inputJson: string;
  outputJson: string;
  status: string;
};

type WarehouseScopeRunRow = {
  id: string;
};

type WarehouseQualityRecord = {
  entityId: string;
  sourceName: string;
  status: string;
  lastCheckedAt: Date | null;
};

type AuditCandidateRow = {
  id: string;
  symbol: string;
};

type AuditExistingRow = {
  entityId: string;
};

type CalibrationOutcomeRow = {
  horizon: string;
  observedAt: Date;
  brierScore: number;
  logLoss: number;
  intervalCovered: boolean;
  directionalCorrect: boolean;
  absoluteReturnError: number;
  positiveOutcome: boolean;
  forecastHorizon: {
    positiveReturnProbability: number;
  };
};

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function predictionFromEvent(event: {
  id: string;
  createdAt: Date;
  sourceId: string | null;
  status: string;
  metadataJson: string;
}): OperatingPrediction {
  const metadata = parseJsonRecord(event.metadataJson);

  return {
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    forecastRunId:
      stringValue(metadata.forecastRunId) ?? event.sourceId,
    symbol: stringValue(metadata.symbol),
    modelVersion: stringValue(metadata.modelVersion),
    horizon: stringValue(metadata.horizon),
    direction: stringValue(metadata.direction),
    probability:
      numberValue(metadata.positiveReturnProbability) ??
      numberValue(metadata.probability),
    expectedReturnPercent: numberValue(
      metadata.expectedReturnPercent,
    ),
    confidence: numberValue(metadata.confidence),
    status: event.status,
  };
}

function latestDate(
  values: Array<Date | string | null | undefined>,
) {
  const timestamps = values
    .flatMap((value) => {
      if (!value) return [];
      const parsed =
        value instanceof Date ? value.getTime() : Date.parse(value);
      return Number.isFinite(parsed) ? [parsed] : [];
    })
    .sort((left, right) => right - left);

  return timestamps.length
    ? new Date(timestamps[0]).toISOString()
    : null;
}

function modelRecord(model: {
  id: string;
  displayName: string;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  promotedAt: Date | null;
  disabledAt: Date | null;
}): OperatingModelRecord {
  return {
    id: model.id,
    displayName: model.displayName,
    modelVersion: model.modelVersion,
    engineVersion: model.engineVersion,
    calibrationVersion: model.calibrationVersion,
    status: model.status,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    promotedAt: model.promotedAt?.toISOString() ?? null,
    disabledAt: model.disabledAt?.toISOString() ?? null,
  };
}

export async function getIntelligenceOperatingMemory(input: {
  userId: string;
  symbol?: string | null;
  days?: unknown;
  limit?: unknown;
}): Promise<IntelligenceOperatingMemory> {
  const window = intelligenceMemoryWindow({
    days: input.days,
  });
  const startAt = new Date(window.startAt);
  const endAt = new Date(window.endAt);
  const symbol = String(input.symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
  const limit = clampInteger(input.limit, 50, 1, 100);
  const runWhere = {
    userId: input.userId,
    generatedAt: {
      gte: startAt,
      lte: endAt,
    },
    ...(symbol ? { symbol } : {}),
  };

  const [
    forecastRunCount,
    recentRunsRaw,
    pendingHorizons,
    settledHorizons,
    settledOutcomes,
    latestOutcomeRaw,
    modelArtifactCount,
    modelsRaw,
    horizonPredictionCount,
    horizonEventsRaw,
    ensemblePredictionCount,
    ensembleEventsRaw,
    simulationCount,
    completedBacktestCount,
    backtestsRaw,
    openDriftAlertCount,
    driftAlertsRaw,
    evidenceAuditCount,
    validatedEvidenceAuditCount,
    needsReviewEvidenceAuditCount,
    latestEvidenceAuditRaw,
  ] = await Promise.all([
    prisma.intelligenceForecastRun.count({
      where: runWhere,
    }),
    prisma.intelligenceForecastRun.findMany({
      where: runWhere,
      orderBy: {
        generatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        requestId: true,
        symbol: true,
        asOfAt: true,
        generatedAt: true,
        engineVersion: true,
        modelVersion: true,
        calibrationVersion: true,
        marketRegime: true,
        sliceSentimentScore: true,
        dataQualityScore: true,
        sourceCount: true,
        independentSourceCount: true,
        simulationPaths: true,
        status: true,
        horizons: {
          orderBy: {
            targetAt: "asc",
          },
          select: {
            status: true,
            targetAt: true,
          },
        },
      },
    }),
    prisma.intelligenceForecastHorizon.count({
      where: {
        userId: input.userId,
        status: "Pending",
        forecastRun: {
          generatedAt: {
            gte: startAt,
            lte: endAt,
          },
          ...(symbol ? { symbol } : {}),
        },
      },
    }),
    prisma.intelligenceForecastHorizon.count({
      where: {
        userId: input.userId,
        status: "Settled",
        forecastRun: {
          generatedAt: {
            gte: startAt,
            lte: endAt,
          },
          ...(symbol ? { symbol } : {}),
        },
      },
    }),
    prisma.intelligenceForecastOutcome.count({
      where: {
        userId: input.userId,
        observedAt: {
          gte: startAt,
          lte: endAt,
        },
        ...(symbol ? { symbol } : {}),
      },
    }),
    prisma.intelligenceForecastOutcome.findFirst({
      where: {
        userId: input.userId,
        observedAt: {
          gte: startAt,
          lte: endAt,
        },
        ...(symbol ? { symbol } : {}),
      },
      orderBy: {
        observedAt: "desc",
      },
      select: {
        observedAt: true,
      },
    }),
    prisma.intelligenceForecastModel.count({
      where: {
        userId: input.userId,
        OR: [
          {
            createdAt: {
              gte: startAt,
              lte: endAt,
            },
          },
          {
            updatedAt: {
              gte: startAt,
              lte: endAt,
            },
          },
          {
            status: {
              in: ["Production", "Candidate", "Shadow"],
            },
          },
        ],
      },
    }),
    prisma.intelligenceForecastModel.findMany({
      where: {
        userId: input.userId,
        OR: [
          {
            createdAt: {
              gte: startAt,
              lte: endAt,
            },
          },
          {
            updatedAt: {
              gte: startAt,
              lte: endAt,
            },
          },
          {
            status: {
              in: ["Production", "Candidate", "Shadow"],
            },
          },
        ],
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 60,
      select: {
        id: true,
        displayName: true,
        modelVersion: true,
        engineVersion: true,
        calibrationVersion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        promotedAt: true,
        disabledAt: true,
      },
    }),
    prisma.backendPlatformEvent.count({
      where: {
        userId: input.userId,
        eventType: HORIZON_EVENT_TYPE,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.backendPlatformEvent.findMany({
      where: {
        userId: input.userId,
        eventType: HORIZON_EVENT_TYPE,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 160,
      select: {
        id: true,
        createdAt: true,
        sourceId: true,
        status: true,
        metadataJson: true,
      },
    }),
    prisma.backendPlatformEvent.count({
      where: {
        userId: input.userId,
        eventType: ENSEMBLE_EVENT_TYPE,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.backendPlatformEvent.findMany({
      where: {
        userId: input.userId,
        eventType: ENSEMBLE_EVENT_TYPE,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 160,
      select: {
        id: true,
        createdAt: true,
        sourceId: true,
        status: true,
        metadataJson: true,
      },
    }),
    prisma.backendPlatformEvent.count({
      where: {
        userId: input.userId,
        eventType: SIMULATION_EVENT_TYPE,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.intelligenceForecastBacktestRun.count({
      where: {
        userId: input.userId,
        status: "Completed",
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.intelligenceForecastBacktestRun.findMany({
      where: {
        userId: input.userId,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
      select: {
        id: true,
        modelId: true,
        modelVersion: true,
        status: true,
        recommendation: true,
        createdAt: true,
        completedAt: true,
        holdoutSampleCount: true,
        eligibleSampleCount: true,
        excludedSampleCount: true,
        pointInTimeSafe: true,
        lookaheadDetected: true,
      },
    }),
    prisma.intelligenceForecastDriftAlert.count({
      where: {
        userId: input.userId,
        status: "Open",
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.intelligenceForecastDriftAlert.findMany({
      where: {
        userId: input.userId,
        createdAt: {
          gte: startAt,
          lte: endAt,
        },
        status: "Open",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 80,
      select: {
        id: true,
        modelId: true,
        modelVersion: true,
        horizon: true,
        severity: true,
        status: true,
        reason: true,
        createdAt: true,
        currentWindowEndAt: true,
      },
    }),
    prisma.backendDataQualityRecord.count({
      where: {
        userId: input.userId,
        entityType: EVIDENCE_ENTITY_TYPE,
        sourceName: OVERALL_EVIDENCE_SOURCE,
        lastCheckedAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.backendDataQualityRecord.count({
      where: {
        userId: input.userId,
        entityType: EVIDENCE_ENTITY_TYPE,
        sourceName: OVERALL_EVIDENCE_SOURCE,
        status: "Validated",
        lastCheckedAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.backendDataQualityRecord.count({
      where: {
        userId: input.userId,
        entityType: EVIDENCE_ENTITY_TYPE,
        sourceName: OVERALL_EVIDENCE_SOURCE,
        status: "Needs Review",
        lastCheckedAt: {
          gte: startAt,
          lte: endAt,
        },
      },
    }),
    prisma.backendDataQualityRecord.findFirst({
      where: {
        userId: input.userId,
        entityType: EVIDENCE_ENTITY_TYPE,
        sourceName: OVERALL_EVIDENCE_SOURCE,
        lastCheckedAt: {
          gte: startAt,
          lte: endAt,
        },
      },
      orderBy: {
        lastCheckedAt: "desc",
      },
      select: {
        lastCheckedAt: true,
      },
    }),
  ]);

  const typedRecentRuns = recentRunsRaw as ForecastRunMemoryRow[];
  const latestOutcome = latestOutcomeRaw as { observedAt: Date } | null;
  const typedModels = modelsRaw as ModelMemoryRow[];
  const typedHorizonEvents = horizonEventsRaw as PredictionEventRow[];
  const typedEnsembleEvents = ensembleEventsRaw as PredictionEventRow[];
  const typedBacktests = backtestsRaw as BacktestMemoryRow[];
  const typedDriftAlerts = driftAlertsRaw as DriftAlertMemoryRow[];
  const latestEvidenceAudit =
    latestEvidenceAuditRaw as LatestEvidenceAuditRow | null;

  const recentRuns: OperatingForecastRun[] = typedRecentRuns.map(
    (run) => {
      const pending = run.horizons.filter(
        (horizon) => horizon.status === "Pending",
      );

      return {
        id: run.id,
        requestId: run.requestId,
        symbol: run.symbol,
        asOfAt: run.asOfAt.toISOString(),
        generatedAt: run.generatedAt.toISOString(),
        engineVersion: run.engineVersion,
        modelVersion: run.modelVersion,
        calibrationVersion: run.calibrationVersion,
        marketRegime: run.marketRegime,
        sliceSentimentScore: run.sliceSentimentScore,
        dataQualityScore: run.dataQualityScore,
        sourceCount: run.sourceCount,
        independentSourceCount: run.independentSourceCount,
        simulationPaths: run.simulationPaths,
        status: run.status,
        horizonCount: run.horizons.length,
        pendingHorizonCount: pending.length,
        settledHorizonCount: run.horizons.filter(
          (horizon) => horizon.status === "Settled",
        ).length,
        nextPendingTargetAt:
          pending[0]?.targetAt.toISOString() ?? null,
      };
    },
  );
  const horizonPredictions = typedHorizonEvents.map(
    predictionFromEvent,
  );
  const ensemblePredictions = typedEnsembleEvents.map(
    predictionFromEvent,
  );
  const backtests: OperatingBacktestRecord[] = typedBacktests.map(
    (backtest) => ({
      id: backtest.id,
      modelId: backtest.modelId,
      modelVersion: backtest.modelVersion,
      status: backtest.status,
      recommendation: backtest.recommendation,
      createdAt: backtest.createdAt.toISOString(),
      completedAt: backtest.completedAt?.toISOString() ?? null,
      holdoutSampleCount: backtest.holdoutSampleCount,
      eligibleSampleCount: backtest.eligibleSampleCount,
      excludedSampleCount: backtest.excludedSampleCount,
      pointInTimeSafe: backtest.pointInTimeSafe,
      lookaheadDetected: backtest.lookaheadDetected,
    }),
  );
  const driftAlerts: OperatingDriftAlert[] = typedDriftAlerts.map(
    (alert) => ({
      id: alert.id,
      modelId: alert.modelId,
      modelVersion: alert.modelVersion,
      horizon: alert.horizon,
      severity: alert.severity,
      status: alert.status,
      reason: alert.reason,
      createdAt: alert.createdAt.toISOString(),
      currentWindowEndAt:
        alert.currentWindowEndAt?.toISOString() ?? null,
    }),
  );
  return {
    generatedAt: endAt.toISOString(),
    window,
    summary: {
      forecastRuns: forecastRunCount,
      returnedRuns: recentRuns.length,
      pendingHorizons,
      settledHorizons,
      settledOutcomes,
      modelArtifacts: modelArtifactCount,
      horizonPredictions: horizonPredictionCount,
      ensemblePredictions: ensemblePredictionCount,
      simulationRecords: simulationCount,
      completedBacktests: completedBacktestCount,
      openDriftAlerts: openDriftAlertCount,
      evidenceAudits: evidenceAuditCount,
      validatedEvidenceAudits: validatedEvidenceAuditCount,
      needsReviewEvidenceAudits: needsReviewEvidenceAuditCount,
    },
    latest: {
      forecastGeneratedAt:
        recentRuns[0]?.generatedAt ?? null,
      providerAsOfAt: recentRuns[0]?.asOfAt ?? null,
      settledOutcomeAt:
        latestOutcome?.observedAt.toISOString() ?? null,
      modelCreatedAt: latestDate(
        typedModels.map((model) => model.updatedAt),
      ),
      horizonPredictionAt:
        horizonPredictions[0]?.createdAt ?? null,
      ensemblePredictionAt:
        ensemblePredictions[0]?.createdAt ?? null,
      backtestCompletedAt: latestDate(
        typedBacktests.map((backtest) => backtest.completedAt),
      ),
      evidenceAuditAt:
        latestEvidenceAudit?.lastCheckedAt?.toISOString() ?? null,
    },
    recentRuns,
    models: typedModels.map(modelRecord),
    horizonPredictions,
    ensemblePredictions,
    backtests,
    driftAlerts,
    safeguards: {
      autonomousTradingEnabled: false,
      automaticPromotionEnabled: false,
      futureDatedEvidenceAccepted: false,
      demoOutcomesAcceptedForValidation: false,
      monthMemoryMinimumEnforced: true,
    },
  };
}

export async function getOperationalWarehouseOverview(input: {
  userId: string;
  symbol?: string | null;
  days?: unknown;
  limit?: unknown;
}) {
  const window = intelligenceMemoryWindow({
    days: input.days,
  });
  const startAt = new Date(window.startAt);
  const endAt = new Date(window.endAt);
  const symbol = String(input.symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
  const limit = clampInteger(input.limit, 50, 1, 100);
  const runWhere = {
    userId: input.userId,
    generatedAt: {
      gte: startAt,
      lte: endAt,
    },
    ...(symbol ? { symbol } : {}),
  };
  const [totalRuns, recentRuns, scopeRuns] = await Promise.all([
    prisma.intelligenceForecastRun.count({
      where: runWhere,
    }),
    prisma.intelligenceForecastRun.findMany({
      where: runWhere,
      orderBy: {
        generatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        userId: true,
        requestId: true,
        symbol: true,
        asOfAt: true,
        generatedAt: true,
        engineVersion: true,
        modelVersion: true,
        calibrationVersion: true,
        marketRegime: true,
        dataQualityScore: true,
        staleDataWarning: true,
        inputJson: true,
        outputJson: true,
        status: true,
      },
    }),
    prisma.intelligenceForecastRun.findMany({
      where: runWhere,
      orderBy: {
        generatedAt: "desc",
      },
      take: 5_000,
      select: {
        id: true,
      },
    }),
  ]);
  const typedRecentRuns = recentRuns as WarehouseForecastRunRow[];
  const typedScopeRuns = scopeRuns as WarehouseScopeRunRow[];
  const scopeIds = typedScopeRuns.map((run) => run.id);
  const recentIds = typedRecentRuns.map((run) => run.id);
  const [scopeRecords, recentRecords] = await Promise.all([
    scopeIds.length
      ? prisma.backendDataQualityRecord.findMany({
          where: {
            userId: input.userId,
            entityType: EVIDENCE_ENTITY_TYPE,
            sourceName: OVERALL_EVIDENCE_SOURCE,
            entityId: {
              in: scopeIds,
            },
          },
        })
      : Promise.resolve([]),
    recentIds.length
      ? prisma.backendDataQualityRecord.findMany({
          where: {
            userId: input.userId,
            entityType: EVIDENCE_ENTITY_TYPE,
            entityId: {
              in: recentIds,
            },
          },
          orderBy: {
            sourceName: "asc",
          },
        })
      : Promise.resolve([]),
  ]);
  const typedScopeRecords = scopeRecords as WarehouseQualityRecord[];
  const typedRecentRecords = recentRecords as WarehouseQualityRecord[];
  const recordsByRun = new Map<
    string,
    WarehouseQualityRecord[]
  >();

  for (const record of typedRecentRecords) {
    const group = recordsByRun.get(record.entityId) ?? [];
    group.push(record);
    recordsByRun.set(record.entityId, group);
  }

  const runs: OperatingWarehouseRun[] = typedRecentRuns.map((run) => {
    const report = buildPointInTimeEvidenceReport(run);
    const materialized = recordsByRun.get(run.id) ?? [];
    const overall = materialized.find(
      (record) => record.sourceName === OVERALL_EVIDENCE_SOURCE,
    );

    return {
      id: run.id,
      requestId: run.requestId,
      symbol: run.symbol,
      asOfAt: run.asOfAt.toISOString(),
      generatedAt: run.generatedAt.toISOString(),
      engineVersion: run.engineVersion,
      modelVersion: run.modelVersion,
      calibrationVersion: run.calibrationVersion,
      marketRegime: run.marketRegime,
      forecastStatus: run.status,
      warehouseStatus: overall?.status ?? "Not Audited",
      warehouseCheckedAt:
        overall?.lastCheckedAt?.toISOString() ?? null,
      pointInTimeSafe: report.pointInTimeSafe,
      integrityScore: report.integrityScore,
      timestampCount: report.timestampCount,
      futureEvidenceCount: report.futureEvidenceCount,
      futureEvidencePaths: report.futureEvidencePaths,
      missingRequiredCategories:
        report.missingRequiredCategories,
      fallbackCategories: report.fallbackCategories,
      staleCategories: report.staleCategories,
      earliestEvidenceAt:
        report.earliestEvidenceAt?.toISOString() ?? null,
      latestEvidenceAt:
        report.latestEvidenceAt?.toISOString() ?? null,
      warnings: report.warnings,
      categories: report.categories.map((category) => {
        const stored = materialized.find(
          (record) => record.sourceName === category.sourceName,
        );

        return {
          ...category,
          asOfAt: category.asOfAt?.toISOString() ?? null,
          materialized: Boolean(stored),
          materializedStatus: stored?.status ?? null,
          lastCheckedAt:
            stored?.lastCheckedAt?.toISOString() ?? null,
        };
      }),
    };
  });
  const auditedRuns = typedScopeRecords.length;
  const validatedRuns = typedScopeRecords.filter(
    (record) => record.status === "Validated",
  ).length;
  const needsReviewRuns = typedScopeRecords.filter(
    (record) => record.status === "Needs Review",
  ).length;
  const averageIntegrity = runs.length
    ? runs.reduce(
        (sum, run) => sum + run.integrityScore,
        0,
      ) / runs.length
    : 0;

  return {
    generatedAt: endAt.toISOString(),
    window,
    filters: {
      symbol: symbol || null,
      limit,
    },
    summary: {
      totalRuns,
      coverageScopeCount: scopeIds.length,
      coverageCapped: totalRuns > scopeIds.length,
      auditedRuns,
      notAuditedRuns: Math.max(
        0,
        Math.min(totalRuns, scopeIds.length) - auditedRuns,
      ),
      validatedRuns,
      needsReviewRuns,
      coveragePercent: scopeIds.length
        ? Math.round(
            (auditedRuns / scopeIds.length) * 10_000,
          ) / 100
        : 0,
      recentPointInTimeSafe: runs.filter(
        (run) => run.pointInTimeSafe,
      ).length,
      recentNeedsReview: runs.filter(
        (run) =>
          !run.pointInTimeSafe || run.integrityScore < 70,
      ).length,
      recentAverageIntegrityScore:
        Math.round(averageIntegrity * 100) / 100,
    },
    safeguards: {
      autonomousTradingEnabled: false,
      futureDatedEvidenceAccepted: false,
      demoEvidencePromotedToTruth: false,
      humanReviewRequiredForViolations: true,
      monthMemoryMinimumEnforced: true,
    },
    runs,
  };
}

export async function auditOperationalWarehouseBatch(input: {
  userId: string;
  days?: unknown;
  limit?: unknown;
  onlyMissing?: boolean;
}) {
  const window = intelligenceMemoryWindow({
    days: input.days,
  });
  const limit = clampInteger(input.limit, 50, 1, 100);
  const candidates = await prisma.intelligenceForecastRun.findMany({
    where: {
      userId: input.userId,
      generatedAt: {
        gte: new Date(window.startAt),
        lte: new Date(window.endAt),
      },
    },
    orderBy: {
      generatedAt: "desc",
    },
    take: Math.min(300, limit * 3),
    select: {
      id: true,
      symbol: true,
    },
  });
  const typedCandidates = candidates as AuditCandidateRow[];
  let selected = typedCandidates;

  if (input.onlyMissing !== false && typedCandidates.length) {
    const existing = await prisma.backendDataQualityRecord.findMany({
      where: {
        userId: input.userId,
        entityType: EVIDENCE_ENTITY_TYPE,
        sourceName: OVERALL_EVIDENCE_SOURCE,
        entityId: {
          in: typedCandidates.map((run) => run.id),
        },
      },
      select: {
        entityId: true,
      },
    });
    const typedExisting = existing as AuditExistingRow[];
    const existingIds = new Set(
      typedExisting.map((record) => record.entityId),
    );
    selected = typedCandidates.filter(
      (run) => !existingIds.has(run.id),
    );
  }

  selected = selected.slice(0, limit);
  const audited: Array<{
    runId: string;
    symbol: string;
    pointInTimeSafe: boolean;
    integrityScore: number;
  }> = [];
  const failed: Array<{
    runId: string;
    symbol: string;
    error: string;
  }> = [];

  for (const run of selected) {
    try {
      const result = await auditForecastEvidenceRun({
        userId: input.userId,
        runId: run.id,
      });

      audited.push({
        runId: run.id,
        symbol: run.symbol,
        pointInTimeSafe: result.report.pointInTimeSafe,
        integrityScore: result.report.integrityScore,
      });
    } catch (error) {
      failed.push({
        runId: run.id,
        symbol: run.symbol,
        error:
          error instanceof Error
            ? error.message
            : "Unknown warehouse audit error.",
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    window,
    candidateCount: typedCandidates.length,
    selectedCount: selected.length,
    auditedCount: audited.length,
    failedCount: failed.length,
    audited,
    failed,
  };
}

export async function getOperationalCalibration(input: {
  userId: string;
  days?: unknown;
  symbol?: string | null;
}) {
  const window = intelligenceMemoryWindow({
    days: input.days,
  });
  const symbol = String(input.symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
  const outcomes = await prisma.intelligenceForecastOutcome.findMany({
    where: {
      userId: input.userId,
      observedAt: {
        gte: new Date(window.startAt),
        lte: new Date(window.endAt),
      },
      ...(symbol ? { symbol } : {}),
    },
    include: {
      forecastHorizon: {
        select: {
          positiveReturnProbability: true,
        },
      },
    },
    orderBy: {
      observedAt: "desc",
    },
    take: 5_000,
  });
  const typedOutcomes = outcomes as CalibrationOutcomeRow[];

  function average(values: number[]) {
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) /
          values.length
      : 0;
  }

  function percentage(matches: number, total: number) {
    return total
      ? Math.round((matches / total) * 10_000) / 100
      : 0;
  }

  function summarize(items: CalibrationOutcomeRow[]) {
    return {
      sampleCount: items.length,
      brierScore:
        Math.round(
          average(items.map((item) => item.brierScore)) *
            1_000_000,
        ) / 1_000_000,
      logLoss:
        Math.round(
          average(items.map((item) => item.logLoss)) *
            1_000_000,
        ) / 1_000_000,
      intervalCoveragePercent: percentage(
        items.filter((item) => item.intervalCovered).length,
        items.length,
      ),
      directionalAccuracyPercent: percentage(
        items.filter((item) => item.directionalCorrect).length,
        items.length,
      ),
      meanAbsoluteReturnError:
        Math.round(
          average(
            items.map((item) => item.absoluteReturnError),
          ) * 10_000,
        ) / 10_000,
    };
  }

  const groups = new Map<string, CalibrationOutcomeRow[]>();

  for (const outcome of typedOutcomes) {
    const group = groups.get(outcome.horizon) ?? [];
    group.push(outcome);
    groups.set(outcome.horizon, group);
  }

  const byHorizon = [...groups.entries()]
    .map(([horizon, items]) => ({
      horizon,
      ...summarize(items),
    }))
    .sort((left, right) =>
      left.horizon.localeCompare(right.horizon),
    );
  const bins = Array.from({ length: 10 }, (_, index) => ({
    minimumProbability: index * 10,
    maximumProbability: index === 9 ? 100 : index * 10 + 9.999,
    items: [] as CalibrationOutcomeRow[],
  }));

  for (const outcome of typedOutcomes) {
    const probability = Math.max(
      0,
      Math.min(
        100,
        outcome.forecastHorizon.positiveReturnProbability,
      ),
    );
    const index = Math.min(
      9,
      Math.floor(probability / 10),
    );
    bins[index].items.push(outcome);
  }

  return {
    generatedAt: new Date().toISOString(),
    window,
    filters: {
      symbol: symbol || null,
    },
    overall: summarize(typedOutcomes),
    byHorizon,
    reliability: bins.map((bin) => ({
      minimumProbability: bin.minimumProbability,
      maximumProbability: bin.maximumProbability,
      sampleCount: bin.items.length,
      averageForecastProbability:
        Math.round(
          average(
            bin.items.map(
              (item) =>
                item.forecastHorizon
                  .positiveReturnProbability,
            ),
          ) * 100,
        ) / 100,
      observedPositivePercent: percentage(
        bin.items.filter((item) => item.positiveOutcome).length,
        bin.items.length,
      ),
    })),
    latestObservedAt:
      typedOutcomes[0]?.observedAt.toISOString() ?? null,
    safeguards: {
      demoOutcomesIncluded: false,
      futureOutcomesAccepted: false,
      monthMemoryMinimumEnforced: true,
    },
  };
}