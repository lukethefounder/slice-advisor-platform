import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

import type {
  ForecastHorizon,
  ForecastResponse,
  MarketSnapshot,
} from "@/lib/intelligence-forecast/types";

const HORIZON_OFFSETS_MS: Record<ForecastHorizon, number> = {
  "5-30m": 30 * 60 * 1000,
  intraday: 7 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "2-5d": 5 * 24 * 60 * 60 * 1000,
  "1-4w": 28 * 24 * 60 * 60 * 1000,
  "1-3m": 90 * 24 * 60 * 60 * 1000,
  "3-12m": 365 * 24 * 60 * 60 * 1000,
  "1-3y": 3 * 365 * 24 * 60 * 60 * 1000,
};

function parseDate(value: string, fallback = new Date()) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

function targetDate(asOfAt: Date, horizon: ForecastHorizon) {
  return new Date(asOfAt.getTime() + HORIZON_OFFSETS_MS[horizon]);
}

function safeJson(value: unknown, fallback: string) {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export async function persistForecastRun(input: {
  userId: string;
  snapshot: MarketSnapshot;
  forecast: ForecastResponse;
  request?: Request;
}) {
  const { userId, snapshot, forecast } = input;

  const asOfAt = parseDate(forecast.asOf);
  const generatedAt = parseDate(forecast.generatedAt);

  const runData = {
    symbol: forecast.symbol,
    asOfAt,
    generatedAt,
    engineVersion: forecast.engineVersion,
    modelVersion: forecast.modelVersion,
    calibrationVersion: forecast.calibrationVersion,
    marketRegime: forecast.marketRegime,
    sliceSentimentScore: forecast.sliceSentimentScore,
    dataQualityScore: forecast.dataQualityScore,
    sourceCount: forecast.provenance.sourceCount,
    independentSourceCount: forecast.provenance.independentSourceCount,
    duplicateCount: forecast.provenance.duplicateCount,
    staleDataWarning: forecast.staleDataWarning,
    simulationPaths: forecast.simulation.paths,
    simulationSeed: forecast.simulation.seed,
    camelStatus: forecast.camel.status,
    camelWorkforceMode: forecast.camel.audit.workforceMode,
    inputJson: safeJson(snapshot, "{}"),
    outputJson: safeJson(forecast, "{}"),
    status: "Generated",
  };

  const storedRun = await prisma.$transaction(async (tx) => {
    const run = await tx.intelligenceForecastRun.upsert({
      where: {
        userId_requestId: {
          userId,
          requestId: forecast.requestId,
        },
      },

      update: runData,

      create: {
        userId,
        requestId: forecast.requestId,
        ...runData,
      },
    });

    for (const horizon of forecast.horizons) {
      const horizonData = {
        userId,
        symbol: forecast.symbol,
        label: horizon.label,
        targetAt: targetDate(asOfAt, horizon.horizon),
        initialPrice: snapshot.price.current,
        direction: horizon.direction,
        positiveReturnProbability:
          horizon.positiveReturnProbability,
        expectedReturnPercent: horizon.expectedReturnPercent,
        expectedPrice: horizon.expectedPrice,
        rangeLowPercent: horizon.expectedRangePercent.low,
        rangeHighPercent: horizon.expectedRangePercent.high,
        priceRangeLow: horizon.expectedPriceRange.low,
        priceRangeHigh: horizon.expectedPriceRange.high,
        volatilityPercent: horizon.volatilityPercent,
        confidence: horizon.confidence,
        modelAgreement: horizon.modelAgreement,
        simulationAgreement: horizon.simulationAgreement,
        dataQuality: horizon.dataQuality,
        modelDisagreement: horizon.modelDisagreement,
        primaryUncertainty: horizon.primaryUncertainty,
        contributionsJson: safeJson(horizon.contributions, "[]"),
      };

      await tx.intelligenceForecastHorizon.upsert({
        where: {
          forecastRunId_horizon: {
            forecastRunId: run.id,
            horizon: horizon.horizon,
          },
        },

        update: horizonData,

        create: {
          forecastRunId: run.id,
          horizon: horizon.horizon,
          status: "Pending",
          ...horizonData,
        },
      });
    }

    return run;
  });

  await recordAuditLog({
    userId,

    eventType: "INTELLIGENCE_FORECAST_GENERATED",

    severity: "Info",

    area: "Market Intelligence",

    title: `Generated ${forecast.symbol} multi-horizon forecast`,

    detail:
      `Stored ${forecast.horizons.length} forecast horizons using ` +
      `${forecast.modelVersion}.`,

    metadata: {
      forecastRunId: storedRun.id,
      requestId: forecast.requestId,
      symbol: forecast.symbol,
      engineVersion: forecast.engineVersion,
      modelVersion: forecast.modelVersion,
      calibrationVersion: forecast.calibrationVersion,
      marketRegime: forecast.marketRegime,
      camelStatus: forecast.camel.status,
      camelWorkforceMode: forecast.camel.audit.workforceMode,
      simulationPaths: forecast.simulation.paths,
      autonomousTradingEnabled: false,
    },

    request: input.request,
  }).catch((error) => {
    console.error(
      "Forecast was stored, but the audit-log write failed:",
      error,
    );
  });

  return storedRun;
}