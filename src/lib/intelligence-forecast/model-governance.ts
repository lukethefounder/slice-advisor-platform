import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

import {
  FORECAST_HORIZONS,
  type ForecastHorizon,
} from "@/lib/intelligence-forecast/types";

const HOLDOUT_FRACTION = 0.3;
const MAX_ROWS = 20_000;

const DEFAULT_PROMOTION_GATES = {
  minimumHoldoutSamples: 100,
  minimumCoreHorizonSamples: 20,
  maximumBrierScore: 0.245,
  maximumLogLoss: 0.72,
  minimumDirectionalAccuracyPercent: 52,
  minimumIntervalCoveragePercent: 65,
  maximumIntervalCoveragePercent: 95,
  maximumExpectedCalibrationError: 0.12,
  maximumBrierRegression: 0.01,
  maximumAccuracyRegressionPercent: 2,
};

type EligibleRow = {
  horizonId: string;
  symbol: string;
  horizon: string;
  regime: string;
  targetAt: Date;
  generatedAt: Date;
  asOfAt: Date;
  observedAt: Date;
  modelVersion: string;
  probability: number;
  expectedReturnPercent: number;
  confidence: number;
  realizedReturnPercent: number;
  positiveOutcome: boolean;
  brierScore: number;
  logLoss: number;
  intervalCovered: boolean;
  directionalCorrect: boolean;
  absoluteReturnError: number;
  priceProvider: string;
};

type Exclusion = {
  horizonId: string;
  reason: string;
};

type Metrics = {
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  directionalAccuracyPercent: number;
  intervalCoveragePercent: number;
  meanAbsoluteReturnError: number;
  expectedReturnBias: number;
  expectedCalibrationError: number;
  averageForecastProbability: number;
  observedPositivePercent: number;
};

type GroupedMetrics = Record<string, unknown> & Metrics;

function round(
  value: number,
  decimals = 6,
) {
  const factor = 10 ** decimals;

  return (
    Math.round(value * factor) /
    factor
  );
}

function average(
  values: number[],
) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length
  );
}

function percent(
  matches: number,
  total: number,
) {
  if (!total) {
    return 0;
  }

  return round(
    (matches / total) * 100,
    2,
  );
}

function safeJson(
  value: unknown,
  fallback: string,
) {
  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return fallback;
  }
}

function readJson<T>(
  value: string,
  fallback: T,
): T {
  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

function modelKey(
  modelVersion: string,
) {
  return modelVersion
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9._-]/g,
      "-",
    )
    .slice(
      0,
      150,
    );
}

function isDemoProvider(
  provider: string,
) {
  return provider
    .toLowerCase()
    .includes(
      "demo",
    );
}

function evaluateMetrics(
  rows: EligibleRow[],
): Metrics {
  if (!rows.length) {
    return {
      sampleCount: 0,
      brierScore: 0,
      logLoss: 0,
      directionalAccuracyPercent: 0,
      intervalCoveragePercent: 0,
      meanAbsoluteReturnError: 0,
      expectedReturnBias: 0,
      expectedCalibrationError: 0,
      averageForecastProbability: 0,
      observedPositivePercent: 0,
    };
  }

  const bins =
    Array.from(
      {
        length: 10,
      },
      () =>
        [] as EligibleRow[],
    );

  for (const row of rows) {
    const probability =
      Math.max(
        0,
        Math.min(
          100,
          row.probability,
        ),
      );

    const index =
      Math.min(
        9,
        Math.floor(
          probability / 10,
        ),
      );

    bins[index].push(
      row,
    );
  }

  let calibrationError =
    0;

  for (const bin of bins) {
    if (!bin.length) {
      continue;
    }

    const predicted =
      average(
        bin.map(
          (row) =>
            row.probability,
        ),
      ) / 100;

    const observed =
      bin.filter(
        (row) =>
          row.positiveOutcome,
      ).length /
      bin.length;

    calibrationError +=
      Math.abs(
        predicted -
          observed,
      ) *
      (bin.length /
        rows.length);
  }

  return {
    sampleCount:
      rows.length,

    brierScore:
      round(
        average(
          rows.map(
            (row) =>
              row.brierScore,
          ),
        ),
      ),

    logLoss:
      round(
        average(
          rows.map(
            (row) =>
              row.logLoss,
          ),
        ),
      ),

    directionalAccuracyPercent:
      percent(
        rows.filter(
          (row) =>
            row.directionalCorrect,
        ).length,
        rows.length,
      ),

    intervalCoveragePercent:
      percent(
        rows.filter(
          (row) =>
            row.intervalCovered,
        ).length,
        rows.length,
      ),

    meanAbsoluteReturnError:
      round(
        average(
          rows.map(
            (row) =>
              row.absoluteReturnError,
          ),
        ),
        4,
      ),

    expectedReturnBias:
      round(
        average(
          rows.map(
            (row) =>
              row.realizedReturnPercent -
              row.expectedReturnPercent,
          ),
        ),
        4,
      ),

    expectedCalibrationError:
      round(
        calibrationError,
        6,
      ),

    averageForecastProbability:
      round(
        average(
          rows.map(
            (row) =>
              row.probability,
          ),
        ),
        2,
      ),

    observedPositivePercent:
      percent(
        rows.filter(
          (row) =>
            row.positiveOutcome,
        ).length,
        rows.length,
      ),
  };
}

function groupMetrics(
  rows: EligibleRow[],
  field:
    | "horizon"
    | "regime",
): GroupedMetrics[] {
  const groups =
    new Map<
      string,
      EligibleRow[]
    >();

  for (const row of rows) {
    const key =
      row[field];

    const group =
      groups.get(
        key,
      ) ?? [];

    group.push(
      row,
    );

    groups.set(
      key,
      group,
    );
  }

  return [
    ...groups.entries(),
  ]
    .sort(
      (
        [leftKey],
        [rightKey],
      ) =>
        leftKey.localeCompare(
          rightKey,
        ),
    )
    .map(
      ([key, group]) => {
        const metrics =
          evaluateMetrics(
            group,
          );

        if (
          field ===
          "horizon"
        ) {
          return {
            horizon:
              key,
            ...metrics,
          };
        }

        return {
          regime:
            key,
          ...metrics,
        };
      },
    );
}

async function loadSettledRows(
  input: {
    userId: string;
    modelVersion: string;
    startAt?: Date;
    endAt?: Date;
  },
) {
  const horizons =
    await prisma.intelligenceForecastHorizon.findMany(
      {
        where: {
          userId:
            input.userId,

          status:
            "Settled",

          forecastRun: {
            modelVersion:
              input.modelVersion,
          },

          outcome: {
            isNot:
              null,
          },

          ...(input.startAt ||
          input.endAt
            ? {
                targetAt: {
                  ...(input.startAt
                    ? {
                        gte:
                          input.startAt,
                      }
                    : {}),

                  ...(input.endAt
                    ? {
                        lte:
                          input.endAt,
                      }
                    : {}),
                },
              }
            : {}),
        },

        orderBy: {
          targetAt:
            "asc",
        },

        take:
          MAX_ROWS,

        include: {
          outcome:
            true,

          forecastRun: {
            select: {
              modelVersion:
                true,

              generatedAt:
                true,

              asOfAt:
                true,

              marketRegime:
                true,
            },
          },
        },
      },
    );

  const eligible:
    EligibleRow[] = [];

  const exclusions:
    Exclusion[] = [];

  for (
    const horizon of
      horizons
  ) {
    const outcome =
      horizon.outcome;

    if (!outcome) {
      exclusions.push({
        horizonId:
          horizon.id,

        reason:
          "Outcome relation was missing.",
      });

      continue;
    }

    if (
      horizon.forecastRun.generatedAt.getTime() >
      horizon.targetAt.getTime()
    ) {
      exclusions.push({
        horizonId:
          horizon.id,

        reason:
          "Forecast was generated after its target timestamp.",
      });

      continue;
    }

    if (
      horizon.forecastRun.asOfAt.getTime() >
      horizon.forecastRun.generatedAt.getTime() +
        5 *
          60 *
          1000
    ) {
      exclusions.push({
        horizonId:
          horizon.id,

        reason:
          "Evidence as-of timestamp was later than forecast generation.",
      });

      continue;
    }

    if (
      outcome.observedAt.getTime() <
      horizon.targetAt.getTime()
    ) {
      exclusions.push({
        horizonId:
          horizon.id,

        reason:
          "Outcome price was observed before the target timestamp.",
      });

      continue;
    }

    if (
      isDemoProvider(
        outcome.priceProvider,
      )
    ) {
      exclusions.push({
        horizonId:
          horizon.id,

        reason:
          "Demo-provider outcomes cannot be used for validation.",
      });

      continue;
    }

    eligible.push({
      horizonId:
        horizon.id,

      symbol:
        horizon.symbol,

      horizon:
        horizon.horizon,

      regime:
        horizon.forecastRun.marketRegime,

      targetAt:
        horizon.targetAt,

      generatedAt:
        horizon.forecastRun.generatedAt,

      asOfAt:
        horizon.forecastRun.asOfAt,

      observedAt:
        outcome.observedAt,

      modelVersion:
        horizon.forecastRun.modelVersion,

      probability:
        horizon.positiveReturnProbability,

      expectedReturnPercent:
        horizon.expectedReturnPercent,

      confidence:
        horizon.confidence,

      realizedReturnPercent:
        outcome.realizedReturnPercent,

      positiveOutcome:
        outcome.positiveOutcome,

      brierScore:
        outcome.brierScore,

      logLoss:
        outcome.logLoss,

      intervalCovered:
        outcome.intervalCovered,

      directionalCorrect:
        outcome.directionalCorrect,

      absoluteReturnError:
        outcome.absoluteReturnError,

      priceProvider:
        outcome.priceProvider,
    });
  }

  return {
    totalRows:
      horizons.length,

    eligible,

    exclusions,
  };
}

export async function syncForecastModelRegistry(
  userId: string,
) {
  const recentVersions =
    await prisma.intelligenceForecastRun.findMany(
      {
        where: {
          userId,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        distinct: [
          "modelVersion",
        ],

        select: {
          engineVersion:
            true,

          modelVersion:
            true,

          calibrationVersion:
            true,

          generatedAt:
            true,
        },
      },
    );

  const existingCount =
    await prisma.intelligenceForecastModel.count(
      {
        where: {
          userId,
        },
      },
    );

  const bootstrapProductionVersion =
    existingCount === 0
      ? recentVersions[0]
          ?.modelVersion ??
        null
      : null;

  for (
    const version of
      recentVersions
  ) {
    await prisma.intelligenceForecastModel.upsert(
      {
        where: {
          userId_modelVersion: {
            userId,

            modelVersion:
              version.modelVersion,
          },
        },

        update: {
          engineVersion:
            version.engineVersion,

          calibrationVersion:
            version.calibrationVersion,
        },

        create: {
          userId,

          modelKey:
            modelKey(
              version.modelVersion,
            ),

          displayName:
            version.modelVersion,

          description:
            "Forecast version discovered from immutable stored Slice forecast records.",

          engineVersion:
            version.engineVersion,

          modelVersion:
            version.modelVersion,

          calibrationVersion:
            version.calibrationVersion,

          status:
            version.modelVersion ===
            bootstrapProductionVersion
              ? "Production"
              : "Shadow",

          configurationJson:
            "{}",

          promotionGatesJson:
            safeJson(
              DEFAULT_PROMOTION_GATES,
              "{}",
            ),

          metadataJson:
            safeJson(
              {
                discoveredAt:
                  new Date().toISOString(),

                firstObservedRunAt:
                  version.generatedAt.toISOString(),

                autonomousTradingEnabled:
                  false,
              },
              "{}",
            ),

          promotedAt:
            version.modelVersion ===
            bootstrapProductionVersion
              ? new Date()
              : null,
        },
      },
    );
  }

  return prisma.intelligenceForecastModel.findMany(
    {
      where: {
        userId,
      },

      orderBy: [
        {
          status:
            "asc",
        },
        {
          createdAt:
            "desc",
        },
      ],
    },
  );
}

function buildPromotionGates(
  input: {
    metrics: Metrics;
    byHorizon:
      GroupedMetrics[];
    exclusions:
      Exclusion[];
    comparisonMetrics:
      Metrics | null;
  },
) {
  const coreHorizons =
    new Set([
      "1d",
      "2-5d",
      "1-4w",
    ]);

  const coreHorizonMetrics =
    input.byHorizon.filter(
      (item) =>
        coreHorizons.has(
          String(
            item.horizon,
          ),
        ),
    );

  const items = [
    {
      key:
        "point-in-time-integrity",

      passed:
        !input.exclusions.some(
          (item) =>
            item.reason.includes(
              "after its target",
            ) ||
            item.reason.includes(
              "later than forecast",
            ),
        ),

      required:
        true,

      detail:
        "No forecast or evidence timestamp may occur after the information would have been available.",
    },

    {
      key:
        "holdout-sample-count",

      passed:
        input.metrics.sampleCount >=
        DEFAULT_PROMOTION_GATES.minimumHoldoutSamples,

      required:
        true,

      actual:
        input.metrics.sampleCount,

      threshold:
        DEFAULT_PROMOTION_GATES.minimumHoldoutSamples,
    },

    {
      key:
        "core-horizon-samples",

      passed:
        coreHorizonMetrics.length >=
          3 &&
        coreHorizonMetrics.every(
          (item) =>
            item.sampleCount >=
            DEFAULT_PROMOTION_GATES.minimumCoreHorizonSamples,
        ),

      required:
        true,

      actual:
        coreHorizonMetrics.map(
          (item) => ({
            horizon:
              item.horizon,

            sampleCount:
              item.sampleCount,
          }),
        ),

      threshold:
        DEFAULT_PROMOTION_GATES.minimumCoreHorizonSamples,
    },

    {
      key:
        "brier-score",

      passed:
        input.metrics.brierScore <=
        DEFAULT_PROMOTION_GATES.maximumBrierScore,

      required:
        true,

      actual:
        input.metrics.brierScore,

      threshold:
        DEFAULT_PROMOTION_GATES.maximumBrierScore,
    },

    {
      key:
        "log-loss",

      passed:
        input.metrics.logLoss <=
        DEFAULT_PROMOTION_GATES.maximumLogLoss,

      required:
        true,

      actual:
        input.metrics.logLoss,

      threshold:
        DEFAULT_PROMOTION_GATES.maximumLogLoss,
    },

    {
      key:
        "directional-accuracy",

      passed:
        input.metrics.directionalAccuracyPercent >=
        DEFAULT_PROMOTION_GATES.minimumDirectionalAccuracyPercent,

      required:
        true,

      actual:
        input.metrics.directionalAccuracyPercent,

      threshold:
        DEFAULT_PROMOTION_GATES.minimumDirectionalAccuracyPercent,
    },

    {
      key:
        "interval-coverage-lower",

      passed:
        input.metrics.intervalCoveragePercent >=
        DEFAULT_PROMOTION_GATES.minimumIntervalCoveragePercent,

      required:
        true,

      actual:
        input.metrics.intervalCoveragePercent,

      threshold:
        DEFAULT_PROMOTION_GATES.minimumIntervalCoveragePercent,
    },

    {
      key:
        "interval-coverage-upper",

      passed:
        input.metrics.intervalCoveragePercent <=
        DEFAULT_PROMOTION_GATES.maximumIntervalCoveragePercent,

      required:
        true,

      actual:
        input.metrics.intervalCoveragePercent,

      threshold:
        DEFAULT_PROMOTION_GATES.maximumIntervalCoveragePercent,
    },

    {
      key:
        "calibration-error",

      passed:
        input.metrics.expectedCalibrationError <=
        DEFAULT_PROMOTION_GATES.maximumExpectedCalibrationError,

      required:
        true,

      actual:
        input.metrics.expectedCalibrationError,

      threshold:
        DEFAULT_PROMOTION_GATES.maximumExpectedCalibrationError,
    },

    {
      key:
        "production-brier-comparison",

      passed:
        !input.comparisonMetrics ||
        input.metrics.brierScore <=
          input.comparisonMetrics.brierScore +
            DEFAULT_PROMOTION_GATES.maximumBrierRegression,

      required:
        Boolean(
          input.comparisonMetrics,
        ),

      actual:
        input.metrics.brierScore,

      comparison:
        input.comparisonMetrics
          ?.brierScore ??
        null,
    },

    {
      key:
        "production-accuracy-comparison",

      passed:
        !input.comparisonMetrics ||
        input.metrics.directionalAccuracyPercent >=
          input.comparisonMetrics.directionalAccuracyPercent -
            DEFAULT_PROMOTION_GATES.maximumAccuracyRegressionPercent,

      required:
        Boolean(
          input.comparisonMetrics,
        ),

      actual:
        input.metrics.directionalAccuracyPercent,

      comparison:
        input.comparisonMetrics
          ?.directionalAccuracyPercent ??
        null,
    },
  ];

  const allPassed =
    items
      .filter(
        (item) =>
          item.required,
      )
      .every(
        (item) =>
          item.passed,
      );

  return {
    allPassed,

    evaluatedAt:
      new Date().toISOString(),

    thresholds:
      DEFAULT_PROMOTION_GATES,

    items,
  };
}

export async function runStoredPointInTimeBacktest(
  input: {
    userId: string;
    modelVersion: string;
    request?: Request;
  },
) {
  await syncForecastModelRegistry(
    input.userId,
  );

  const model =
    await prisma.intelligenceForecastModel.findUnique(
      {
        where: {
          userId_modelVersion: {
            userId:
              input.userId,

            modelVersion:
              input.modelVersion,
          },
        },
      },
    );

  if (!model) {
    throw new Error(
      "Forecast model was not found.",
    );
  }

  const backtest =
    await prisma.intelligenceForecastBacktestRun.create(
      {
        data: {
          userId:
            input.userId,

          modelId:
            model.id,

          modelVersion:
            model.modelVersion,

          status:
            "Running",

          evaluationMode:
            "Chronological prospective point-in-time holdout",

          holdoutFraction:
            HOLDOUT_FRACTION,
        },
      },
    );

  try {
    const dataset =
      await loadSettledRows(
        {
          userId:
            input.userId,

          modelVersion:
            model.modelVersion,
        },
      );

    const eligible = [
      ...dataset.eligible,
    ].sort(
      (
        left,
        right,
      ) =>
        left.targetAt.getTime() -
        right.targetAt.getTime(),
    );

    const holdoutCount =
      eligible.length
        ? Math.max(
            1,
            Math.floor(
              eligible.length *
                HOLDOUT_FRACTION,
            ),
          )
        : 0;

    const holdoutRows =
      holdoutCount
        ? eligible.slice(
            -holdoutCount,
          )
        : [];

    const evaluationStartAt =
      holdoutRows[0]
        ?.targetAt ??
      null;

    const evaluationEndAt =
      holdoutRows.at(
        -1,
      )?.targetAt ??
      null;

    const overallMetrics =
      evaluateMetrics(
        holdoutRows,
      );

    const horizonMetrics =
      groupMetrics(
        holdoutRows,
        "horizon",
      );

    const regimeMetrics =
      groupMetrics(
        holdoutRows,
        "regime",
      );

    const productionModel =
      await prisma.intelligenceForecastModel.findFirst(
        {
          where: {
            userId:
              input.userId,

            status:
              "Production",

            id: {
              not:
                model.id,
            },
          },
        },
      );

    let comparisonMetrics:
      Metrics | null =
      null;

    if (
      productionModel &&
      evaluationStartAt &&
      evaluationEndAt
    ) {
      const comparisonDataset =
        await loadSettledRows(
          {
            userId:
              input.userId,

            modelVersion:
              productionModel.modelVersion,

            startAt:
              evaluationStartAt,

            endAt:
              evaluationEndAt,
          },
        );

      comparisonMetrics =
        evaluateMetrics(
          comparisonDataset.eligible,
        );
    }

    const gates =
      buildPromotionGates(
        {
          metrics:
            overallMetrics,

          byHorizon:
            horizonMetrics,

          exclusions:
            dataset.exclusions,

          comparisonMetrics,
        },
      );

    const recommendation =
      gates.allPassed
        ? "Eligible for human promotion review"
        : overallMetrics.sampleCount ===
            0
          ? "Insufficient settled outcomes"
          : "Keep in shadow";

    const completed =
      await prisma.intelligenceForecastBacktestRun.update(
        {
          where: {
            id:
              backtest.id,
          },

          data: {
            comparisonModelVersion:
              productionModel
                ?.modelVersion ??
              null,

            status:
              "Completed",

            completedAt:
              new Date(),

            evaluationStartAt,

            evaluationEndAt,

            totalSampleCount:
              dataset.totalRows,

            eligibleSampleCount:
              eligible.length,

            holdoutSampleCount:
              holdoutRows.length,

            excludedSampleCount:
              dataset.exclusions.length,

            pointInTimeSafe:
              !dataset.exclusions.some(
                (item) =>
                  item.reason.includes(
                    "after its target",
                  ) ||
                  item.reason.includes(
                    "later than forecast",
                  ),
              ),

            lookaheadDetected:
              dataset.exclusions.some(
                (item) =>
                  item.reason.includes(
                    "after its target",
                  ) ||
                  item.reason.includes(
                    "later than forecast",
                  ),
              ),

            overallMetricsJson:
              safeJson(
                overallMetrics,
                "{}",
              ),

            horizonMetricsJson:
              safeJson(
                horizonMetrics,
                "[]",
              ),

            regimeMetricsJson:
              safeJson(
                regimeMetrics,
                "[]",
              ),

            comparisonJson:
              safeJson(
                {
                  productionModelVersion:
                    productionModel
                      ?.modelVersion ??
                    null,

                  metrics:
                    comparisonMetrics,
                },
                "{}",
              ),

            exclusionsJson:
              safeJson(
                dataset.exclusions,
                "[]",
              ),

            gatesJson:
              safeJson(
                gates,
                "{}",
              ),

            recommendation,
          },
        },
      );

    await recordAuditLog({
      userId:
        input.userId,

      eventType:
        "INTELLIGENCE_MODEL_BACKTEST_COMPLETED",

      severity:
        gates.allPassed
          ? "Info"
          : "Warning",

      area:
        "Market Intelligence",

      title:
        `Validated forecast model ${model.modelVersion}`,

      detail:
        `${holdoutRows.length} chronological holdout outcomes evaluated. ` +
        `Recommendation: ${recommendation}.`,

      metadata: {
        modelId:
          model.id,

        modelVersion:
          model.modelVersion,

        backtestRunId:
          completed.id,

        overallMetrics,

        gates,

        pointInTimeSafe:
          completed.pointInTimeSafe,

        autonomousTradingEnabled:
          false,
      },

      request:
        input.request,
    }).catch(
      console.error,
    );

    return {
      backtest:
        completed,

      overallMetrics,

      horizonMetrics,

      regimeMetrics,

      comparisonMetrics,

      gates,

      recommendation,
    };
  } catch (error) {
    await prisma.intelligenceForecastBacktestRun.update(
      {
        where: {
          id:
            backtest.id,
        },

        data: {
          status:
            "Failed",

          completedAt:
            new Date(),

          failureDetail:
            error instanceof Error
              ? error.message
              : "Unknown backtest error.",
        },
      },
    );

    throw error;
  }
}

export async function promoteForecastModel(
  input: {
    userId: string;
    modelId: string;
    reason: string;
    request?: Request;
  },
) {
  const model =
    await prisma.intelligenceForecastModel.findFirst(
      {
        where: {
          id:
            input.modelId,

          userId:
            input.userId,
        },
      },
    );

  if (!model) {
    throw new Error(
      "Forecast model was not found.",
    );
  }

  const latestBacktest =
    await prisma.intelligenceForecastBacktestRun.findFirst(
      {
        where: {
          userId:
            input.userId,

          modelId:
            model.id,

          status:
            "Completed",
        },

        orderBy: {
          completedAt:
            "desc",
        },
      },
    );

  if (!latestBacktest) {
    throw new Error(
      "Run a completed point-in-time validation before promotion.",
    );
  }

  const gates =
    readJson<{
      allPassed?: boolean;
    }>(
      latestBacktest.gatesJson,
      {},
    );

  if (
    gates.allPassed !==
    true
  ) {
    throw new Error(
      "This model has not passed every required promotion gate.",
    );
  }

  if (
    input.reason
      .trim()
      .length < 10
  ) {
    throw new Error(
      "A documented promotion reason of at least 10 characters is required.",
    );
  }

  await prisma.$transaction(
    [
      prisma.intelligenceForecastModel.updateMany(
        {
          where: {
            userId:
              input.userId,

            status:
              "Production",

            id: {
              not:
                model.id,
            },
          },

          data: {
            status:
              "Shadow",
          },
        },
      ),

      prisma.intelligenceForecastModel.update(
        {
          where: {
            id:
              model.id,
          },

          data: {
            status:
              "Production",

            promotedAt:
              new Date(),

            disabledAt:
              null,

            metadataJson:
              safeJson(
                {
                  promotedByUserId:
                    input.userId,

                  promotedAt:
                    new Date().toISOString(),

                  promotionReason:
                    input.reason.trim(),

                  backtestRunId:
                    latestBacktest.id,

                  autonomousTradingEnabled:
                    false,
                },
                "{}",
              ),
          },
        },
      ),
    ],
  );

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_MODEL_PROMOTED",

    severity:
      "Warning",

    area:
      "Market Intelligence",

    title:
      `Promoted forecast model ${model.modelVersion}`,

    detail:
      input.reason.trim(),

    metadata: {
      modelId:
        model.id,

      modelVersion:
        model.modelVersion,

      backtestRunId:
        latestBacktest.id,

      gates,

      autonomousTradingEnabled:
        false,

      humanApprovalRequired:
        true,
    },

    request:
      input.request,
  });

  return prisma.intelligenceForecastModel.findUnique(
    {
      where: {
        id:
          model.id,
      },
    },
  );
}

export async function runForecastDriftMonitor(
  input: {
    userId: string;
    windowSize?: number;
  },
) {
  await syncForecastModelRegistry(
    input.userId,
  );

  const productionModel =
    await prisma.intelligenceForecastModel.findFirst(
      {
        where: {
          userId:
            input.userId,

          status:
            "Production",
        },
      },
    );

  if (!productionModel) {
    return {
      model:
        null,

      evaluatedHorizons:
        0,

      alertsCreated:
        0,

      alerts:
        [],

      reason:
        "No production model is registered.",
    };
  }

  const dataset =
    await loadSettledRows(
      {
        userId:
          input.userId,

        modelVersion:
          productionModel.modelVersion,
      },
    );

  const windowSize =
    Math.max(
      20,
      Math.min(
        200,
        Math.round(
          input.windowSize ??
            40,
        ),
      ),
    );

  const alerts = [];

  for (
    const horizon of
      FORECAST_HORIZONS
  ) {
    const rows =
      dataset.eligible
        .filter(
          (row) =>
            row.horizon ===
            horizon,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.observedAt.getTime() -
            right.observedAt.getTime(),
        );

    if (
      rows.length <
      windowSize * 2
    ) {
      continue;
    }

    const currentRows =
      rows.slice(
        -windowSize,
      );

    const baselineRows =
      rows.slice(
        -(windowSize * 2),
        -windowSize,
      );

    const current =
      evaluateMetrics(
        currentRows,
      );

    const baseline =
      evaluateMetrics(
        baselineRows,
      );

    const brierChange =
      current.brierScore -
      baseline.brierScore;

    const accuracyChange =
      current.directionalAccuracyPercent -
      baseline.directionalAccuracyPercent;

    const coverageChange =
      current.intervalCoveragePercent -
      baseline.intervalCoveragePercent;

    const maeChange =
      baseline.meanAbsoluteReturnError >
      0
        ? (current.meanAbsoluteReturnError -
            baseline.meanAbsoluteReturnError) /
          baseline.meanAbsoluteReturnError
        : 0;

    const critical =
      brierChange >=
        0.08 ||
      accuracyChange <=
        -15 ||
      maeChange >=
        0.5;

    const warning =
      critical ||
      brierChange >=
        0.04 ||
      accuracyChange <=
        -8 ||
      Math.abs(
        coverageChange,
      ) >= 12 ||
      maeChange >=
        0.25;

    if (!warning) {
      continue;
    }

    const severity =
      critical
        ? "Critical"
        : "Warning";

    const currentEnd =
      currentRows.at(
        -1,
      )?.observedAt ??
      new Date();

    const dedupeKey = [
      productionModel.id,
      horizon,
      currentEnd
        .toISOString()
        .slice(
          0,
          10,
        ),
      severity,
    ].join(
      ":",
    );

    const alert =
      await prisma.intelligenceForecastDriftAlert.upsert(
        {
          where: {
            userId_dedupeKey: {
              userId:
                input.userId,

              dedupeKey,
            },
          },

          update: {
            severity,

            status:
              "Open",

            brierScoreChange:
              round(
                brierChange,
              ),

            directionalAccuracyChange:
              round(
                accuracyChange,
                2,
              ),

            intervalCoverageChange:
              round(
                coverageChange,
                2,
              ),

            meanAbsoluteErrorChange:
              round(
                maeChange,
                4,
              ),

            evidenceJson:
              safeJson(
                {
                  baseline,

                  current,

                  thresholds: {
                    warningBrierIncrease:
                      0.04,

                    criticalBrierIncrease:
                      0.08,

                    warningAccuracyDecrease:
                      -8,

                    criticalAccuracyDecrease:
                      -15,

                    warningMaeIncreaseRatio:
                      0.25,

                    criticalMaeIncreaseRatio:
                      0.5,
                  },
                },
                "{}",
              ),
          },

          create: {
            userId:
              input.userId,

            modelId:
              productionModel.id,

            dedupeKey,

            modelVersion:
              productionModel.modelVersion,

            horizon:
              String(
                horizon,
              ),

            regime:
              "All",

            severity,

            status:
              "Open",

            reason:
              `${severity} performance drift detected for ${horizon}.`,

            baselineWindowStartAt:
              baselineRows[0]
                ?.observedAt ??
              null,

            baselineWindowEndAt:
              baselineRows.at(
                -1,
              )?.observedAt ??
              null,

            currentWindowStartAt:
              currentRows[0]
                ?.observedAt ??
              null,

            currentWindowEndAt:
              currentRows.at(
                -1,
              )?.observedAt ??
              null,

            baselineSampleCount:
              baselineRows.length,

            currentSampleCount:
              currentRows.length,

            brierScoreChange:
              round(
                brierChange,
              ),

            directionalAccuracyChange:
              round(
                accuracyChange,
                2,
              ),

            intervalCoverageChange:
              round(
                coverageChange,
                2,
              ),

            meanAbsoluteErrorChange:
              round(
                maeChange,
                4,
              ),

            evidenceJson:
              safeJson(
                {
                  baseline,

                  current,
                },
                "{}",
              ),
          },
        },
      );

    alerts.push(
      alert,
    );
  }

  return {
    model:
      productionModel,

    evaluatedHorizons:
      FORECAST_HORIZONS.length,

    alertsCreated:
      alerts.length,

    alerts,

    windowSize,
  };
}

export async function getModelGovernanceOverview(
  userId: string,
) {
  await syncForecastModelRegistry(
    userId,
  );

  const models =
    await prisma.intelligenceForecastModel.findMany(
      {
        where: {
          userId,
        },

        orderBy: [
          {
            status:
              "asc",
          },
          {
            createdAt:
              "desc",
          },
        ],

        include: {
          backtestRuns: {
            orderBy: {
              createdAt:
                "desc",
            },

            take:
              5,
          },

          driftAlerts: {
            where: {
              status:
                "Open",
            },

            orderBy: {
              createdAt:
                "desc",
            },

            take:
              20,
          },
        },
      },
    );

  return {
    generatedAt:
      new Date().toISOString(),

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticModelPromotionEnabled:
        false,

      humanApprovalRequired:
        true,

      pointInTimeValidationRequired:
        true,
    },

    models:
      models.map(
        (model) => ({
          ...model,

          promotionGates:
            readJson(
              model.promotionGatesJson,
              DEFAULT_PROMOTION_GATES,
            ),

          backtestRuns:
            model.backtestRuns.map(
              (run) => ({
                ...run,

                overallMetrics:
                  readJson(
                    run.overallMetricsJson,
                    {},
                  ),

                horizonMetrics:
                  readJson(
                    run.horizonMetricsJson,
                    [],
                  ),

                regimeMetrics:
                  readJson(
                    run.regimeMetricsJson,
                    [],
                  ),

                comparison:
                  readJson(
                    run.comparisonJson,
                    {},
                  ),

                gates:
                  readJson(
                    run.gatesJson,
                    {},
                  ),
              }),
            ),

          driftAlerts:
            model.driftAlerts.map(
              (alert) => ({
                ...alert,

                evidence:
                  readJson(
                    alert.evidenceJson,
                    {},
                  ),
              }),
            ),
        }),
      ),
  };
}