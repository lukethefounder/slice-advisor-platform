import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

import {
  lookupHistoricalOutcomePrice,
} from "@/lib/intelligence-forecast/historical-price";

import {
  getRealtimeMarketSnapshots,
  persistRealtimeSnapshots,
  type RealtimeAssetSnapshot,
} from "@/lib/realtime-market";

const HORIZON_TOLERANCE_MS: Record<string, number> = {
  "5-30m": 45 * 60 * 1000,
  intraday: 2 * 60 * 60 * 1000,
  "1d": 2 * 24 * 60 * 60 * 1000,
  "2-5d": 3 * 24 * 60 * 60 * 1000,
  "1-4w": 4 * 24 * 60 * 60 * 1000,
  "1-3m": 7 * 24 * 60 * 60 * 1000,
  "3-12m": 14 * 24 * 60 * 60 * 1000,
  "1-3y": 30 * 24 * 60 * 60 * 1000,
};

function round(value: number, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clampProbability(value: number) {
  return Math.max(0.0001, Math.min(0.9999, value));
}

function safeJson(value: unknown, fallback = "{}") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function parseDate(value: string | Date | undefined, fallback = new Date()) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function toleranceForHorizon(horizon: string) {
  return (
    HORIZON_TOLERANCE_MS[horizon] ??
    2 * 24 * 60 * 60 * 1000
  );
}

function percentage(
  matchingCount: number,
  totalCount: number,
) {
  if (!totalCount) return 0;

  return round(
    (matchingCount / totalCount) * 100,
    2,
  );
}

function average(values: number[]) {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

export async function settleForecastHorizon(input: {
  userId: string;
  forecastHorizonId: string;
  observedPrice: number;
  observedAt?: string | Date;
  provider?: string;
  providerTimestamp?: string | Date;
  forceBeforeTarget?: boolean;
  overwrite?: boolean;
  raw?: unknown;
  request?: Request;
}) {
  if (
    !Number.isFinite(input.observedPrice) ||
    input.observedPrice <= 0
  ) {
    throw new Error(
      "Observed price must be greater than zero.",
    );
  }

  const horizon =
    await prisma.intelligenceForecastHorizon.findFirst({
      where: {
        id: input.forecastHorizonId,
        userId: input.userId,
      },

      include: {
        outcome: true,
        forecastRun: true,
      },
    });

  if (!horizon) {
    throw new Error(
      "Forecast horizon was not found.",
    );
  }

  if (horizon.outcome && !input.overwrite) {
    return {
      horizon,
      outcome: horizon.outcome,
      alreadySettled: true,
    };
  }

  if (
    !Number.isFinite(horizon.initialPrice) ||
    horizon.initialPrice <= 0
  ) {
    throw new Error(
      "The forecast does not have a valid initial price.",
    );
  }

  const observedAt = parseDate(
    input.observedAt,
  );

  if (
    observedAt.getTime() <
      horizon.targetAt.getTime() &&
    !input.forceBeforeTarget
  ) {
    throw new Error(
      `This forecast is not due until ${horizon.targetAt.toISOString()}.`,
    );
  }

  const realizedReturnPercent =
    ((input.observedPrice -
      horizon.initialPrice) /
      horizon.initialPrice) *
    100;

  const positiveOutcome =
    realizedReturnPercent > 0;

  const forecastProbability =
    clampProbability(
      horizon.positiveReturnProbability /
        100,
    );

  const binaryOutcome =
    positiveOutcome ? 1 : 0;

  const brierScore =
    (forecastProbability -
      binaryOutcome) **
    2;

  const logLoss =
    -(
      binaryOutcome *
        Math.log(forecastProbability) +
      (1 - binaryOutcome) *
        Math.log(
          1 - forecastProbability,
        )
    );

  const intervalCovered =
    input.observedPrice >=
      horizon.priceRangeLow &&
    input.observedPrice <=
      horizon.priceRangeHigh;

  const normalizedDirection =
    horizon.direction
      .trim()
      .toLowerCase();

  const neutralTolerance =
    Math.max(
      0.25,
      horizon.volatilityPercent *
        0.35,
    );

  const directionalCorrect =
    normalizedDirection === "bullish"
      ? realizedReturnPercent > 0
      : normalizedDirection === "bearish"
        ? realizedReturnPercent < 0
        : Math.abs(
              realizedReturnPercent,
            ) <= neutralTolerance;

  const absoluteReturnError =
    Math.abs(
      realizedReturnPercent -
        horizon.expectedReturnPercent,
    );

  const providerTimestamp =
    input.providerTimestamp
      ? parseDate(
          input.providerTimestamp,
          observedAt,
        )
      : null;

  const result =
    await prisma.$transaction(
      async (tx) => {
        const outcome =
          await tx.intelligenceForecastOutcome.upsert({
            where: {
              forecastHorizonId:
                horizon.id,
            },

            update: {
              userId: input.userId,
              symbol: horizon.symbol,
              horizon: horizon.horizon,
              observedAt,
              providerTimestamp,
              initialPrice:
                horizon.initialPrice,
              observedPrice:
                input.observedPrice,
              realizedReturnPercent:
                round(
                  realizedReturnPercent,
                ),
              positiveOutcome,
              brierScore:
                round(brierScore),
              logLoss:
                round(logLoss),
              intervalCovered,
              directionalCorrect,
              absoluteReturnError:
                round(
                  absoluteReturnError,
                ),
              priceProvider:
                input.provider ??
                "Manual",
              rawJson: safeJson(
                input.raw ?? {},
              ),
            },

            create: {
              forecastHorizonId:
                horizon.id,
              userId: input.userId,
              symbol: horizon.symbol,
              horizon: horizon.horizon,
              observedAt,
              providerTimestamp,
              initialPrice:
                horizon.initialPrice,
              observedPrice:
                input.observedPrice,
              realizedReturnPercent:
                round(
                  realizedReturnPercent,
                ),
              positiveOutcome,
              brierScore:
                round(brierScore),
              logLoss:
                round(logLoss),
              intervalCovered,
              directionalCorrect,
              absoluteReturnError:
                round(
                  absoluteReturnError,
                ),
              priceProvider:
                input.provider ??
                "Manual",
              rawJson: safeJson(
                input.raw ?? {},
              ),
            },
          });

        await tx.intelligenceForecastHorizon.update({
          where: {
            id: horizon.id,
          },

          data: {
            status: "Settled",
          },
        });

        const unsettledCount =
          await tx.intelligenceForecastHorizon.count({
            where: {
              forecastRunId:
                horizon.forecastRunId,

              status: {
                not: "Settled",
              },
            },
          });

        await tx.intelligenceForecastRun.update({
          where: {
            id:
              horizon.forecastRunId,
          },

          data: {
            status:
              unsettledCount === 0
                ? "Settled"
                : "Partially Settled",
          },
        });

        return outcome;
      },
    );

  await recordAuditLog({
    userId: input.userId,
    eventType:
      "INTELLIGENCE_FORECAST_SETTLED",
    severity: "Info",
    area: "Market Intelligence",

    title:
      `Settled ${horizon.symbol} ${horizon.label} forecast`,

    detail:
      `Observed ${input.observedPrice}; realized return ` +
      `${round(realizedReturnPercent, 2)}%.`,

    metadata: {
      forecastRunId:
        horizon.forecastRunId,
      forecastHorizonId:
        horizon.id,
      requestId:
        horizon.forecastRun.requestId,
      symbol:
        horizon.symbol,
      horizon:
        horizon.horizon,
      targetAt:
        horizon.targetAt.toISOString(),
      observedAt:
        observedAt.toISOString(),
      initialPrice:
        horizon.initialPrice,
      observedPrice:
        input.observedPrice,
      expectedReturnPercent:
        horizon.expectedReturnPercent,
      realizedReturnPercent:
        round(
          realizedReturnPercent,
          4,
        ),
      positiveReturnProbability:
        horizon.positiveReturnProbability,
      brierScore:
        round(brierScore),
      logLoss:
        round(logLoss),
      intervalCovered,
      directionalCorrect,
      absoluteReturnError:
        round(
          absoluteReturnError,
          4,
        ),
      priceProvider:
        input.provider ??
        "Manual",
      autonomousTradingEnabled:
        false,
    },

    request: input.request,
  }).catch((error) => {
    console.error(
      "Forecast outcome stored, but audit logging failed:",
      error,
    );
  });

  return {
    horizon,
    outcome: result,
    alreadySettled: false,
  };
}

export async function getCalibrationSummary(
  userId: string,
) {
  const outcomes =
    await prisma.intelligenceForecastOutcome.findMany({
      where: {
        userId,
      },

      include: {
        forecastHorizon: {
          select: {
            positiveReturnProbability:
              true,
          },
        },
      },

      orderBy: {
        observedAt: "desc",
      },

      take: 5_000,
    });

  function summarize(
    items: typeof outcomes,
  ) {
    return {
      sampleCount:
        items.length,

      brierScore:
        round(
          average(
            items.map(
              (item) =>
                item.brierScore,
            ),
          ),
        ),

      logLoss:
        round(
          average(
            items.map(
              (item) =>
                item.logLoss,
            ),
          ),
        ),

      intervalCoveragePercent:
        percentage(
          items.filter(
            (item) =>
              item.intervalCovered,
          ).length,
          items.length,
        ),

      directionalAccuracyPercent:
        percentage(
          items.filter(
            (item) =>
              item.directionalCorrect,
          ).length,
          items.length,
        ),

      meanAbsoluteReturnError:
        round(
          average(
            items.map(
              (item) =>
                item.absoluteReturnError,
            ),
          ),
          4,
        ),
    };
  }

  const horizonGroups =
    new Map<
      string,
      typeof outcomes
    >();

  for (const outcome of outcomes) {
    const existing =
      horizonGroups.get(
        outcome.horizon,
      ) ?? [];

    existing.push(outcome);

    horizonGroups.set(
      outcome.horizon,
      existing,
    );
  }

  const byHorizon =
    [...horizonGroups.entries()]
      .map(
        ([horizon, items]) => ({
          horizon,
          ...summarize(items),
        }),
      )
      .sort(
        (left, right) =>
          left.horizon.localeCompare(
            right.horizon,
          ),
      );

  const reliabilityBins =
    Array.from(
      { length: 10 },
      (_, index) => ({
        minimumProbability:
          index * 10,
        maximumProbability:
          index === 9
            ? 100
            : index * 10 + 9.999,
        items: [] as typeof outcomes,
      }),
    );

  for (const outcome of outcomes) {
    const probability =
      Math.max(
        0,
        Math.min(
          100,
          outcome
            .forecastHorizon
            .positiveReturnProbability,
        ),
      );

    const index =
      Math.min(
        9,
        Math.floor(
          probability / 10,
        ),
      );

    reliabilityBins[
      index
    ].items.push(outcome);
  }

  const reliability =
    reliabilityBins.map(
      (bin) => ({
        minimumProbability:
          bin.minimumProbability,

        maximumProbability:
          bin.maximumProbability,

        sampleCount:
          bin.items.length,

        averageForecastProbability:
          round(
            average(
              bin.items.map(
                (item) =>
                  item
                    .forecastHorizon
                    .positiveReturnProbability,
              ),
            ),
            2,
          ),

        observedPositivePercent:
          percentage(
            bin.items.filter(
              (item) =>
                item.positiveOutcome,
            ).length,
            bin.items.length,
          ),
      }),
    );

  return {
    generatedAt:
      new Date().toISOString(),

    overall:
      summarize(outcomes),

    byHorizon,

    reliability,
  };
}

function recordTimestamp(
  record: {
    providerTimestamp: Date | null;
    receivedAt: Date;
  },
) {
  return (
    record.providerTimestamp ??
    record.receivedAt
  );
}

async function findNearestStoredPrice(input: {
  userId: string;
  symbol: string;
  horizon: string;
  targetAt: Date;
}) {
  const tolerance =
    toleranceForHorizon(
      input.horizon,
    );

  const minimumDate =
    new Date(
      input.targetAt.getTime() -
        tolerance,
    );

  const maximumDate =
    new Date(
      input.targetAt.getTime() +
        tolerance,
    );

  const candidates =
    await prisma.realtimePriceSnapshot.findMany({
      where: {
        symbol:
          input.symbol,

        price: {
          gt: 0,
        },

        isRealtime:
          true,

        qualityScore: {
          gte: 40,
        },

        receivedAt: {
          gte: minimumDate,
          lte: maximumDate,
        },

        OR: [
          {
            userId:
              input.userId,
          },
          {
            userId: null,
          },
        ],
      },

      orderBy: {
        receivedAt: "asc",
      },

      take: 100,
    });

  const valid =
    candidates.filter(
      (candidate) =>
        !candidate.provider
          .toLowerCase()
          .includes("demo") &&
        candidate.marketState !==
          "Demo",
    );

  valid.sort(
    (left, right) =>
      Math.abs(
        recordTimestamp(
          left,
        ).getTime() -
          input.targetAt.getTime(),
      ) -
      Math.abs(
        recordTimestamp(
          right,
        ).getTime() -
          input.targetAt.getTime(),
      ),
  );

  return valid[0] ?? null;
}

function validLiveSnapshot(
  snapshot:
    RealtimeAssetSnapshot,
) {
  return (
    snapshot.isRealtime &&
    snapshot.price > 0 &&
    snapshot.qualityScore >= 40 &&
    snapshot.marketState !==
      "Demo" &&
    snapshot.marketState !==
      "Stale" &&
    !snapshot.provider
      .toLowerCase()
      .includes("demo")
  );
}

function liveSnapshotTimestamp(
  snapshot:
    RealtimeAssetSnapshot,
) {
  return parseDate(
    snapshot.providerTimestamp ??
      snapshot.receivedAt,
  );
}

export async function runAutomaticForecastSettlement(input?: {
  limit?: number;
}) {
  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input?.limit ?? 25,
        ),
      ),
    );

  const now =
    new Date();

  const pending =
    await prisma.intelligenceForecastHorizon.findMany({
      where: {
        status: "Pending",

        targetAt: {
          lte: now,
        },
      },

      orderBy: {
        targetAt: "asc",
      },

      take: limit,
    });

  const settled: Array<{
    horizonId: string;
    symbol: string;
    horizon: string;
    provider: string;
    source: string;
  }> = [];

  const skipped: Array<{
    horizonId: string;
    symbol: string;
    reason: string;
  }> = [];

  const failed: Array<{
    horizonId: string;
    symbol: string;
    error: string;
  }> = [];

  const historicalLookupMisses: Array<{
    horizonId: string;
    symbol: string;
    reason: string;
  }> = [];

  /*
   * First choice:
   * a market snapshot already stored near
   * the target timestamp.
   */
  const unresolvedAfterStored:
    typeof pending = [];

  for (
    const horizon of
      pending
  ) {
    try {
      const stored =
        await findNearestStoredPrice({
          userId:
            horizon.userId,

          symbol:
            horizon.symbol,

          horizon:
            horizon.horizon,

          targetAt:
            horizon.targetAt,
        });

      if (!stored) {
        unresolvedAfterStored.push(
          horizon,
        );

        continue;
      }

      const timestamp =
        recordTimestamp(
          stored,
        );

      await settleForecastHorizon({
        userId:
          horizon.userId,

        forecastHorizonId:
          horizon.id,

        observedPrice:
          stored.price,

        observedAt:
          timestamp,

        provider:
          stored.provider,

        providerTimestamp:
          stored.providerTimestamp ??
          undefined,

        raw: {
          source:
            "Stored RealtimePriceSnapshot",

          snapshotId:
            stored.id,

          qualityScore:
            stored.qualityScore,

          marketState:
            stored.marketState,
        },
      });

      settled.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        horizon:
          horizon.horizon,

        provider:
          stored.provider,

        source:
          "stored-snapshot",
      });
    } catch (error) {
      failed.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        error:
          error instanceof Error
            ? error.message
            : "Unknown stored-price settlement error.",
      });
    }
  }

  /*
   * Second choice:
   * query an exact historical bar at or
   * immediately after the target time.
   */
  const unresolvedAfterHistorical:
    typeof pending = [];

  for (
    const horizon of
      unresolvedAfterStored
  ) {
    const lookup =
      await lookupHistoricalOutcomePrice({
        symbol:
          horizon.symbol,

        horizon:
          horizon.horizon as
            | "5-30m"
            | "intraday"
            | "1d"
            | "2-5d"
            | "1-4w"
            | "1-3m"
            | "3-12m"
            | "1-3y",

        targetAt:
          horizon.targetAt,
      });

    if (
      !lookup.resolution
    ) {
      unresolvedAfterHistorical.push(
        horizon,
      );

      historicalLookupMisses.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        reason:
          lookup.reason ??
          "Historical provider returned no acceptable result.",
      });

      continue;
    }

    try {
      const resolution =
        lookup.resolution;

      await settleForecastHorizon({
        userId:
          horizon.userId,

        forecastHorizonId:
          horizon.id,

        observedPrice:
          resolution.price,

        observedAt:
          resolution.observedAt,

        provider:
          resolution.provider,

        providerTimestamp:
          resolution.providerTimestamp,

        raw: {
          source:
            "Historical market-price resolver",

          targetAt:
            resolution.targetAt,

          observedAt:
            resolution.observedAt,

          differenceMs:
            resolution.differenceMs,

          granularity:
            resolution.granularity,

          qualityScore:
            resolution.qualityScore,

          evidence:
            resolution.raw,
        },
      });

      settled.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        horizon:
          horizon.horizon,

        provider:
          resolution.provider,

        source:
          "historical-provider",
      });
    } catch (error) {
      failed.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        error:
          error instanceof Error
            ? error.message
            : "Unknown historical settlement error.",
      });
    }
  }

  /*
   * Final fallback:
   * only use the current normalized quote
   * when its provider timestamp is still
   * close enough to the target time.
   */
  const unresolvedSymbols =
    Array.from(
      new Set(
        unresolvedAfterHistorical.map(
          (item) =>
            item.symbol,
        ),
      ),
    );

  let liveSnapshots:
    RealtimeAssetSnapshot[] = [];

  if (
    unresolvedSymbols.length
  ) {
    const response =
      await getRealtimeMarketSnapshots(
        unresolvedSymbols,
      );

    liveSnapshots =
      response.snapshots.filter(
        validLiveSnapshot,
      );

    const affectedUserIds =
      Array.from(
        new Set(
          unresolvedAfterHistorical.map(
            (item) =>
              item.userId,
          ),
        ),
      );

    for (
      const userId of
        affectedUserIds
    ) {
      await persistRealtimeSnapshots(
        userId,
        liveSnapshots,
      ).catch((error) => {
        console.error(
          "Unable to persist settlement price snapshots:",
          error,
        );
      });
    }
  }

  const liveBySymbol =
    new Map(
      liveSnapshots.map(
        (snapshot) => [
          snapshot.symbol,
          snapshot,
        ],
      ),
    );

  for (
    const horizon of
      unresolvedAfterHistorical
  ) {
    const snapshot =
      liveBySymbol.get(
        horizon.symbol,
      );

    if (!snapshot) {
      skipped.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        reason:
          "No acceptable stored, historical, or live non-demo market price was available.",
      });

      continue;
    }

    const timestamp =
      liveSnapshotTimestamp(
        snapshot,
      );

    const tolerance =
      toleranceForHorizon(
        horizon.horizon,
      );

    const difference =
      Math.abs(
        timestamp.getTime() -
          horizon.targetAt.getTime(),
      );

    if (
      difference >
      tolerance
    ) {
      skipped.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        reason:
          "Available live market price was too far from the target time.",
      });

      continue;
    }

    try {
      await settleForecastHorizon({
        userId:
          horizon.userId,

        forecastHorizonId:
          horizon.id,

        observedPrice:
          snapshot.price,

        observedAt:
          timestamp,

        provider:
          snapshot.provider,

        providerTimestamp:
          snapshot.providerTimestamp ??
          undefined,

        raw:
          snapshot.raw ?? {
            source:
              "Live normalized market snapshot",

            qualityScore:
              snapshot.qualityScore,

            marketState:
              snapshot.marketState,
          },
      });

      settled.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        horizon:
          horizon.horizon,

        provider:
          snapshot.provider,

        source:
          "live-fallback",
      });
    } catch (error) {
      failed.push({
        horizonId:
          horizon.id,

        symbol:
          horizon.symbol,

        error:
          error instanceof Error
            ? error.message
            : "Unknown live-price settlement error.",
      });
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    examined:
      pending.length,

    settledCount:
      settled.length,

    skippedCount:
      skipped.length,

    failedCount:
      failed.length,

    historicalLookupMissCount:
      historicalLookupMisses.length,

    settled,

    skipped,

    failed,

    historicalLookupMisses,

    safeguards: {
      autonomousTradingEnabled:
        false,

      demoPricesAccepted:
        false,

      preTargetPricesAccepted:
        false,

      providerTimestampPreserved:
        true,
    },
  };
}