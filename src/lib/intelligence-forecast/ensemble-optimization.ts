import "server-only";

import {
  recordAuditLog,
} from "@/lib/audit";

import {
  FORECAST_HORIZONS,
  type ForecastHorizon,
} from "@/lib/intelligence-forecast/types";

import {
  prisma,
} from "@/lib/prisma";

const ENSEMBLE_ENGINE_VERSION =
  "slice-ensemble-engine-1.0.0";

const ENSEMBLE_FAMILY =
  "slice-calibrated-ensemble";

const ENSEMBLE_CALIBRATION_VERSION =
  "platt-chronological-v1";

const HORIZON_SHADOW_EVENT_TYPE =
  "HORIZON_SHADOW_PREDICTION";

const AGENT_SIMULATION_EVENT_TYPE =
  "INTELLIGENCE_AGENT_SIMULATION";

const ENSEMBLE_PREDICTION_EVENT_TYPE =
  "INTELLIGENCE_ENSEMBLE_PREDICTION";

const MINIMUM_TRAINING_SAMPLES =
  40;

const MAXIMUM_TRAINING_ROWS =
  15_000;

const COMPONENT_NAMES = [
  "production",
  "horizonModel",
  "agentSimulation",
] as const;

type ComponentName =
  (typeof COMPONENT_NAMES)[number];

type JsonRecord =
  Record<string, unknown>;

type EnsembleWeights =
  Record<
    ComponentName,
    number
  >;

type FeatureImpact = {
  probabilityImpact:
    number;

  returnImpactPercent:
    number;
};

type ShadowPrediction = {
  eventId:
    string;

  createdAt:
    Date;

  forecastRunId:
    string;

  modelVersion:
    string;

  horizon:
    ForecastHorizon;

  probability:
    number;

  expectedReturnPercent:
    number;

  confidence:
    number;

  featureImpacts:
    Record<
      string,
      FeatureImpact
    >;
};

type SimulationPrediction = {
  eventId:
    string;

  createdAt:
    Date;

  forecastRunId:
    string;

  horizon:
    ForecastHorizon;

  probability:
    number;

  expectedReturnPercent:
    number;

  crashProbability:
    number;

  rallyProbability:
    number;
};

type EnsembleTrainingRow = {
  forecastRunId:
    string;

  horizonId:
    string;

  horizon:
    ForecastHorizon;

  targetAt:
    Date;

  positiveOutcome:
    boolean;

  realizedReturnPercent:
    number;

  productionProbability:
    number;

  productionExpectedReturn:
    number;

  horizonModelProbability:
    number | null;

  horizonModelExpectedReturn:
    number | null;

  simulationProbability:
    number | null;

  simulationExpectedReturn:
    number | null;

  featureImpacts:
    Record<
      string,
      FeatureImpact
    >;
};

type EnsembleMetrics = {
  sampleCount:
    number;

  brierScore:
    number;

  logLoss:
    number;

  directionalAccuracyPercent:
    number;

  expectedCalibrationError:
    number;

  meanAbsoluteReturnError:
    number;

  returnBias:
    number;

  averageProbability:
    number;

  observedPositivePercent:
    number;
};

type ComponentAblation = {
  component:
    ComponentName;

  sampleCount:
    number;

  brierScore:
    number;

  brierDelta:
    number;

  directionalAccuracyPercent:
    number;

  accuracyDelta:
    number;

  meanAbsoluteReturnError:
    number;

  returnErrorDelta:
    number;

  conclusion:
    "Helpful" | "Neutral" | "Potentially Harmful";
};

type FeatureAblation = {
  feature:
    string;

  affectedSampleCount:
    number;

  brierScore:
    number;

  brierDelta:
    number;

  directionalAccuracyPercent:
    number;

  accuracyDelta:
    number;

  meanAbsoluteReturnError:
    number;

  returnErrorDelta:
    number;

  recommendation:
    "Keep" | "Review" | "Remove Candidate";
};

type CalibrationParameters = {
  slope:
    number;

  intercept:
    number;
};

export type EnsembleHorizonArtifact = {
  horizon:
    ForecastHorizon;

  status:
    "TRAINED" | "PRIOR";

  sampleCount:
    number;

  trainingCount:
    number;

  validationCount:
    number;

  probabilityWeights:
    EnsembleWeights;

  returnWeights:
    EnsembleWeights;

  calibration:
    CalibrationParameters;

  trainingMetrics:
    EnsembleMetrics;

  validationMetrics:
    EnsembleMetrics;

  productionOnlyMetrics:
    EnsembleMetrics;

  componentCoverage: {
    production:
      number;

    horizonModel:
      number;

    agentSimulation:
      number;
  };

  componentAblations:
    ComponentAblation[];

  featureAblations:
    FeatureAblation[];

  recommendedFeatureRemovals:
    string[];

  promotionGates: {
    allPassed:
      boolean;

    items:
      Array<{
        key:
          string;

        passed:
          boolean;

        actual:
          number | boolean;

        threshold:
          number | boolean;

        detail:
          string;
      }>;
  };
};

export type EnsembleSuite = {
  schemaVersion:
    "slice-ensemble-suite-1.0.0";

  family:
    string;

  modelVersion:
    string;

  engineVersion:
    string;

  calibrationVersion:
    string;

  trainedAt:
    string;

  status:
    "TRAINED" | "PRIOR";

  totalEligibleSamples:
    number;

  artifacts:
    Record<
      ForecastHorizon,
      EnsembleHorizonArtifact
    >;

  safeguards: {
    autonomousTradingEnabled:
      false;

    automaticPromotionEnabled:
      false;

    simulationTreatedAsTruth:
      false;

    shadowOnly:
      true;

    featureRemovalAutomatic:
      false;
  };
};

export type EnsemblePredictionComponent = {
  component:
    ComponentName;

  available:
    boolean;

  probability:
    number | null;

  expectedReturnPercent:
    number | null;

  configuredProbabilityWeight:
    number;

  appliedProbabilityWeight:
    number;

  configuredReturnWeight:
    number;

  appliedReturnWeight:
    number;
};

export type EnsemblePrediction = {
  horizon:
    ForecastHorizon;

  modelVersion:
    string;

  trainingStatus:
    "TRAINED" | "PRIOR";

  probabilityBeforeCalibration:
    number;

  positiveReturnProbability:
    number;

  expectedReturnPercent:
    number;

  direction:
    "Bullish" | "Bearish" | "Neutral";

  confidence:
    number;

  componentAgreementPercent:
    number;

  componentCount:
    number;

  components:
    EnsemblePredictionComponent[];

  warnings:
    string[];
};

export type EnsembleRunResult = {
  schemaVersion:
    "slice-ensemble-predictions-1.0.0";

  generatedAt:
    string;

  forecastRunId:
    string;

  symbol:
    string;

  modelVersion:
    string;

  engineVersion:
    string;

  calibrationVersion:
    string;

  mode:
    "SHADOW";

  predictions:
    EnsemblePrediction[];

  safeguards: {
    autonomousTradingEnabled:
      false;

    replacesProductionForecast:
      false;

    simulationTreatedAsTruth:
      false;

    automaticPromotionEnabled:
      false;

    decisionSupportOnly:
      true;
  };
};

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
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

function parseJson(
  value: string,
) {
  try {
    return JSON.parse(
      value,
    ) as unknown;
  } catch {
    return null;
  }
}

function finiteNumber(
  value: unknown,
  fallback = 0,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 6,
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) /
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
    ) /
    values.length
  );
}

function standardDeviation(
  values: number[],
) {
  if (
    values.length <
    2
  ) {
    return 0;
  }

  const mean =
    average(
      values,
    );

  return Math.sqrt(
    average(
      values.map(
        (value) =>
          (
            value -
            mean
          ) **
          2,
      ),
    ),
  );
}

function sigmoid(
  value: number,
) {
  const bounded =
    clamp(
      value,
      -20,
      20,
    );

  return (
    1 /
    (
      1 +
      Math.exp(
        -bounded,
      )
    )
  );
}

function logit(
  probability: number,
) {
  const bounded =
    clamp(
      probability,
      0.0001,
      0.9999,
    );

  return Math.log(
    bounded /
    (
      1 -
      bounded
    ),
  );
}

function asHorizon(
  value: string,
): ForecastHorizon | null {
  return (
    FORECAST_HORIZONS as readonly string[]
  ).includes(
    value,
  )
    ? value as ForecastHorizon
    : null;
}

function zeroMetrics():
  EnsembleMetrics {
  return {
    sampleCount:
      0,

    brierScore:
      0,

    logLoss:
      0,

    directionalAccuracyPercent:
      0,

    expectedCalibrationError:
      0,

    meanAbsoluteReturnError:
      0,

    returnBias:
      0,

    averageProbability:
      0,

    observedPositivePercent:
      0,
  };
}

function priorProbabilityWeights(
  horizon: ForecastHorizon,
): EnsembleWeights {
  if (
    horizon ===
      "5-30m" ||
    horizon ===
      "intraday"
  ) {
    return {
      production:
        0.4,

      horizonModel:
        0.35,

      agentSimulation:
        0.25,
    };
  }

  if (
    horizon ===
      "1d" ||
    horizon ===
      "2-5d"
  ) {
    return {
      production:
        0.45,

      horizonModel:
        0.35,

      agentSimulation:
        0.2,
    };
  }

  if (
    horizon ===
      "1-4w" ||
    horizon ===
      "1-3m"
  ) {
    return {
      production:
        0.5,

      horizonModel:
        0.35,

      agentSimulation:
        0.15,
    };
  }

  return {
    production:
      0.55,

    horizonModel:
      0.35,

    agentSimulation:
      0.1,
  };
}

function priorReturnWeights(
  horizon: ForecastHorizon,
): EnsembleWeights {
  const probability =
    priorProbabilityWeights(
      horizon,
    );

  return {
    production:
      probability.production +
      0.05,

    horizonModel:
      probability.horizonModel,

    agentSimulation:
      Math.max(
        0,
        probability.agentSimulation -
        0.05,
      ),
  };
}

function priorArtifact(
  horizon: ForecastHorizon,
): EnsembleHorizonArtifact {
  return {
    horizon,

    status:
      "PRIOR",

    sampleCount:
      0,

    trainingCount:
      0,

    validationCount:
      0,

    probabilityWeights:
      priorProbabilityWeights(
        horizon,
      ),

    returnWeights:
      priorReturnWeights(
        horizon,
      ),

    calibration: {
      slope:
        1,

      intercept:
        0,
    },

    trainingMetrics:
      zeroMetrics(),

    validationMetrics:
      zeroMetrics(),

    productionOnlyMetrics:
      zeroMetrics(),

    componentCoverage: {
      production:
        1,

      horizonModel:
        0,

      agentSimulation:
        0,
    },

    componentAblations:
      [],

    featureAblations:
      [],

    recommendedFeatureRemovals:
      [],

    promotionGates: {
      allPassed:
        false,

      items:
        [],
    },
  };
}

export function createPriorEnsembleSuite():
  EnsembleSuite {
  const trainedAt =
    new Date().toISOString();

  return {
    schemaVersion:
      "slice-ensemble-suite-1.0.0",

    family:
      ENSEMBLE_FAMILY,

    modelVersion:
      "slice-ensemble-prior-1.0.0",

    engineVersion:
      ENSEMBLE_ENGINE_VERSION,

    calibrationVersion:
      ENSEMBLE_CALIBRATION_VERSION,

    trainedAt,

    status:
      "PRIOR",

    totalEligibleSamples:
      0,

    artifacts:
      Object.fromEntries(
        FORECAST_HORIZONS.map(
          (horizon) => [
            horizon,
            priorArtifact(
              horizon,
            ),
          ],
        ),
      ) as Record<
        ForecastHorizon,
        EnsembleHorizonArtifact
      >,

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticPromotionEnabled:
        false,

      simulationTreatedAsTruth:
        false,

      shadowOnly:
        true,

      featureRemovalAutomatic:
        false,
    },
  };
}

function parseFeatureImpacts(
  value: unknown,
) {
  const impacts:
    Record<
      string,
      FeatureImpact
    > = {};

  if (!Array.isArray(value)) {
    return impacts;
  }

  for (
    const item of
      value
  ) {
    if (!isRecord(item)) {
      continue;
    }

    const feature =
      String(
        item.feature ??
        "",
      )
        .trim()
        .slice(
          0,
          100,
        );

    if (!feature) {
      continue;
    }

    impacts[feature] = {
      probabilityImpact:
        finiteNumber(
          item.probabilityImpact,
          0,
        ),

      returnImpactPercent:
        finiteNumber(
          item.returnImpactPercent,
          0,
        ),
    };
  }

  return impacts;
}

function parseShadowPrediction(
  event: {
    id: string;
    sourceId: string | null;
    createdAt: Date;
    metadataJson: string;
  },
): ShadowPrediction | null {
  if (!event.sourceId) {
    return null;
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return null;
  }

  const horizon =
    asHorizon(
      String(
        parsed.horizon ??
        "",
      ),
    );

  if (!horizon) {
    return null;
  }

  return {
    eventId:
      event.id,

    createdAt:
      event.createdAt,

    forecastRunId:
      event.sourceId,

    modelVersion:
      String(
        parsed.modelVersion ??
        "",
      ),

    horizon,

    probability:
      clamp(
        finiteNumber(
          parsed.probability,
          50,
        ),
        1,
        99,
      ),

    expectedReturnPercent:
      finiteNumber(
        parsed.expectedReturnPercent,
        0,
      ),

    confidence:
      clamp(
        finiteNumber(
          parsed.confidence,
          0,
        ),
        0,
        100,
      ),

    featureImpacts:
      parseFeatureImpacts(
        parsed.contributions,
      ),
  };
}

function parseSimulationPredictions(
  event: {
    id: string;
    sourceId: string | null;
    createdAt: Date;
    metadataJson: string;
  },
) {
  if (!event.sourceId) {
    return [];
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return [];
  }

  const scenario =
    isRecord(
      parsed.scenario,
    )
      ? String(
          parsed.scenario.id ??
          "",
        )
      : "";

  if (
    scenario !==
    "BASELINE"
  ) {
    return [];
  }

  if (
    !Array.isArray(
      parsed.horizons,
    )
  ) {
    return [];
  }

  const output:
    SimulationPrediction[] = [];

  for (
    const item of
      parsed.horizons
  ) {
    if (!isRecord(item)) {
      continue;
    }

    const horizon =
      asHorizon(
        String(
          item.horizon ??
          "",
        ),
      );

    if (!horizon) {
      continue;
    }

    const quantiles =
      isRecord(
        item.quantiles,
      )
        ? item.quantiles
        : {};

    const expectedReturn =
      item.meanReturnPercent !==
      undefined
        ? finiteNumber(
            item.meanReturnPercent,
            0,
          )
        : finiteNumber(
            quantiles.p50,
            0,
          );

    output.push({
      eventId:
        event.id,

      createdAt:
        event.createdAt,

      forecastRunId:
        event.sourceId,

      horizon,

      probability:
        clamp(
          finiteNumber(
            item.positiveReturnProbability,
            50,
          ),
          1,
          99,
        ),

      expectedReturnPercent:
        expectedReturn,

      crashProbability:
        clamp(
          finiteNumber(
            item.crashProbability,
            0,
          ),
          0,
          100,
        ),

      rallyProbability:
        clamp(
          finiteNumber(
            item.rallyProbability,
            0,
          ),
          0,
          100,
        ),
    });
  }

  return output;
}

function latestByKey<
  T extends {
    createdAt:
      Date;
  },
>(
  items: T[],
  keyFunction:
    (
      item: T,
    ) => string,
) {
  const output =
    new Map<
      string,
      T
    >();

  for (
    const item of
      items
  ) {
    const key =
      keyFunction(
        item,
      );

    const existing =
      output.get(
        key,
      );

    if (
      !existing ||
      item.createdAt.getTime() >
      existing.createdAt.getTime()
    ) {
      output.set(
        key,
        item,
      );
    }
  }

  return output;
}

async function loadTrainingRows(
  userId: string,
) {
  const horizons =
    await prisma.intelligenceForecastHorizon.findMany({
      where: {
        userId,

        status:
          "Settled",

        outcome: {
          isNot:
            null,
        },
      },

      orderBy: {
        targetAt:
          "asc",
      },

      take:
        MAXIMUM_TRAINING_ROWS,

      include: {
        outcome:
          true,

        forecastRun: {
          select: {
            id:
              true,

            generatedAt:
              true,

            asOfAt:
              true,
          },
        },
      },
    });

  const runIds =
    Array.from(
      new Set(
        horizons.map(
          (horizon) =>
            horizon.forecastRunId,
        ),
      ),
    );

  const events =
    runIds.length
      ? await prisma.backendPlatformEvent.findMany({
          where: {
            userId,

            eventType: {
              in: [
                HORIZON_SHADOW_EVENT_TYPE,
                AGENT_SIMULATION_EVENT_TYPE,
              ],
            },

            sourceId: {
              in:
                runIds,
            },
          },

          orderBy: {
            createdAt:
              "asc",
          },

          select: {
            id:
              true,

            sourceId:
              true,

            eventType:
              true,

            createdAt:
              true,

            metadataJson:
              true,
          },
        })
      : [];

  const shadows =
    events
      .filter(
        (event) =>
          event.eventType ===
          HORIZON_SHADOW_EVENT_TYPE,
      )
      .map(
        parseShadowPrediction,
      )
      .filter(
        (
          item,
        ): item is ShadowPrediction =>
          Boolean(item),
      );

  const simulations =
    events
      .filter(
        (event) =>
          event.eventType ===
          AGENT_SIMULATION_EVENT_TYPE,
      )
      .flatMap(
        parseSimulationPredictions,
      );

  const shadowByKey =
    latestByKey(
      shadows,
      (item) =>
        `${item.forecastRunId}:${item.horizon}`,
    );

  const simulationByKey =
    latestByKey(
      simulations,
      (item) =>
        `${item.forecastRunId}:${item.horizon}`,
    );

  const rows:
    EnsembleTrainingRow[] = [];

  const exclusions:
    string[] = [];

  for (
    const horizon of
      horizons
  ) {
    const outcome =
      horizon.outcome;

    const normalizedHorizon =
      asHorizon(
        horizon.horizon,
      );

    if (
      !outcome ||
      !normalizedHorizon
    ) {
      continue;
    }

    if (
      horizon.forecastRun
        .generatedAt
        .getTime() >
      horizon.targetAt
        .getTime()
    ) {
      exclusions.push(
        `${horizon.id}: forecast generated after target`,
      );

      continue;
    }

    if (
      horizon.forecastRun
        .asOfAt
        .getTime() >
      horizon.forecastRun
        .generatedAt
        .getTime() +
        5 *
        60 *
        1000
    ) {
      exclusions.push(
        `${horizon.id}: future-dated evidence`,
      );

      continue;
    }

    if (
      outcome.observedAt
        .getTime() <
      horizon.targetAt
        .getTime()
    ) {
      exclusions.push(
        `${horizon.id}: outcome predates target`,
      );

      continue;
    }

    if (
      outcome.priceProvider
        .toLowerCase()
        .includes(
          "demo",
        )
    ) {
      exclusions.push(
        `${horizon.id}: demo outcome excluded`,
      );

      continue;
    }

    const key =
      `${horizon.forecastRunId}:${normalizedHorizon}`;

    const shadow =
      shadowByKey.get(
        key,
      );

    const simulation =
      simulationByKey.get(
        key,
      );

    const safeShadow =
      shadow &&
      shadow.createdAt.getTime() <=
      horizon.targetAt.getTime()
        ? shadow
        : null;

    const safeSimulation =
      simulation &&
      simulation.createdAt.getTime() <=
      horizon.targetAt.getTime()
        ? simulation
        : null;

    rows.push({
      forecastRunId:
        horizon.forecastRunId,

      horizonId:
        horizon.id,

      horizon:
        normalizedHorizon,

      targetAt:
        horizon.targetAt,

      positiveOutcome:
        outcome.positiveOutcome,

      realizedReturnPercent:
        outcome.realizedReturnPercent,

      productionProbability:
        clamp(
          horizon.positiveReturnProbability,
          1,
          99,
        ),

      productionExpectedReturn:
        horizon.expectedReturnPercent,

      horizonModelProbability:
        safeShadow
          ?.probability ??
        null,

      horizonModelExpectedReturn:
        safeShadow
          ?.expectedReturnPercent ??
        null,

      simulationProbability:
        safeSimulation
          ?.probability ??
        null,

      simulationExpectedReturn:
        safeSimulation
          ?.expectedReturnPercent ??
        null,

      featureImpacts:
        safeShadow
          ?.featureImpacts ??
        {},
    });
  }

  return {
    rows,

    exclusions,

    sourceCount:
      horizons.length,
  };
}

function availableProbability(
  row: EnsembleTrainingRow,
  component: ComponentName,
  ablatedFeature?: string,
) {
  if (
    component ===
    "production"
  ) {
    return (
      row.productionProbability /
      100
    );
  }

  if (
    component ===
    "agentSimulation"
  ) {
    return row.simulationProbability ===
      null
      ? null
      : row.simulationProbability /
        100;
  }

  if (
    row.horizonModelProbability ===
    null
  ) {
    return null;
  }

  const original =
    clamp(
      row.horizonModelProbability /
      100,
      0.0001,
      0.9999,
    );

  if (!ablatedFeature) {
    return original;
  }

  const impact =
    row.featureImpacts[
      ablatedFeature
    ];

  if (!impact) {
    return original;
  }

  return sigmoid(
    logit(
      original,
    ) -
    impact.probabilityImpact,
  );
}

function availableReturn(
  row: EnsembleTrainingRow,
  component: ComponentName,
  ablatedFeature?: string,
) {
  if (
    component ===
    "production"
  ) {
    return row.productionExpectedReturn;
  }

  if (
    component ===
    "agentSimulation"
  ) {
    return row.simulationExpectedReturn;
  }

  if (
    row.horizonModelExpectedReturn ===
    null
  ) {
    return null;
  }

  if (!ablatedFeature) {
    return row.horizonModelExpectedReturn;
  }

  const impact =
    row.featureImpacts[
      ablatedFeature
    ];

  return (
    row.horizonModelExpectedReturn -
    (
      impact
        ?.returnImpactPercent ??
      0
    )
  );
}

function normalizedAppliedWeights(
  input: {
    weights:
      EnsembleWeights;

    availability:
      Record<
        ComponentName,
        boolean
      >;

    excludedComponent?:
      ComponentName;
  },
) {
  const applied: EnsembleWeights = {
    production:
      0,

    horizonModel:
      0,

    agentSimulation:
      0,
  };

  let total =
    0;

  for (
    const component of
      COMPONENT_NAMES
  ) {
    if (
      component ===
      input.excludedComponent ||
      !input.availability[
        component
      ]
    ) {
      continue;
    }

    total +=
      input.weights[
        component
      ];
  }

  if (
    total <=
    0
  ) {
    applied.production =
      1;

    return applied;
  }

  for (
    const component of
      COMPONENT_NAMES
  ) {
    if (
      component ===
      input.excludedComponent ||
      !input.availability[
        component
      ]
    ) {
      continue;
    }

    applied[
      component
    ] =
      input.weights[
        component
      ] /
      total;
  }

  return applied;
}

function rawProbabilityForRow(
  input: {
    row:
      EnsembleTrainingRow;

    weights:
      EnsembleWeights;

    excludedComponent?:
      ComponentName;

    ablatedFeature?:
      string;
  },
) {
  const values: Record<
    ComponentName,
    number | null
  > = {
    production:
      availableProbability(
        input.row,
        "production",
        input.ablatedFeature,
      ),

    horizonModel:
      availableProbability(
        input.row,
        "horizonModel",
        input.ablatedFeature,
      ),

    agentSimulation:
      availableProbability(
        input.row,
        "agentSimulation",
        input.ablatedFeature,
      ),
  };

  const availability = {
    production:
      values.production !==
      null,

    horizonModel:
      values.horizonModel !==
      null,

    agentSimulation:
      values.agentSimulation !==
      null,
  };

  const applied =
    normalizedAppliedWeights({
      weights:
        input.weights,

      availability,

      excludedComponent:
        input.excludedComponent,
    });

  let probability =
    0;

  for (
    const component of
      COMPONENT_NAMES
  ) {
    probability +=
      (
        values[
          component
        ] ??
        0
      ) *
      applied[
        component
      ];
  }

  return clamp(
    probability,
    0.0001,
    0.9999,
  );
}

function expectedReturnForRow(
  input: {
    row:
      EnsembleTrainingRow;

    weights:
      EnsembleWeights;

    excludedComponent?:
      ComponentName;

    ablatedFeature?:
      string;
  },
) {
  const values: Record<
    ComponentName,
    number | null
  > = {
    production:
      availableReturn(
        input.row,
        "production",
        input.ablatedFeature,
      ),

    horizonModel:
      availableReturn(
        input.row,
        "horizonModel",
        input.ablatedFeature,
      ),

    agentSimulation:
      availableReturn(
        input.row,
        "agentSimulation",
        input.ablatedFeature,
      ),
  };

  const availability = {
    production:
      values.production !==
      null,

    horizonModel:
      values.horizonModel !==
      null,

    agentSimulation:
      values.agentSimulation !==
      null,
  };

  const applied =
    normalizedAppliedWeights({
      weights:
        input.weights,

      availability,

      excludedComponent:
        input.excludedComponent,
    });

  let expectedReturn =
    0;

  for (
    const component of
      COMPONENT_NAMES
  ) {
    expectedReturn +=
      (
        values[
          component
        ] ??
        0
      ) *
      applied[
        component
      ];
  }

  return expectedReturn;
}

function calibratedProbability(
  rawProbability: number,
  calibration:
    CalibrationParameters,
) {
  return sigmoid(
    calibration.intercept +
    calibration.slope *
    logit(
      rawProbability,
    ),
  );
}

function evaluateRows(
  input: {
    rows:
      EnsembleTrainingRow[];

    probabilityWeights:
      EnsembleWeights;

    returnWeights:
      EnsembleWeights;

    calibration:
      CalibrationParameters;

    excludedComponent?:
      ComponentName;

    ablatedFeature?:
      string;
  },
): EnsembleMetrics {
  if (
    !input.rows.length
  ) {
    return zeroMetrics();
  }

  const probabilities:
    number[] = [];

  const expectedReturns:
    number[] = [];

  for (
    const row of
      input.rows
  ) {
    const raw =
      rawProbabilityForRow({
        row,

        weights:
          input.probabilityWeights,

        excludedComponent:
          input.excludedComponent,

        ablatedFeature:
          input.ablatedFeature,
      });

    probabilities.push(
      calibratedProbability(
        raw,
        input.calibration,
      ),
    );

    expectedReturns.push(
      expectedReturnForRow({
        row,

        weights:
          input.returnWeights,

        excludedComponent:
          input.excludedComponent,

        ablatedFeature:
          input.ablatedFeature,
      }),
    );
  }

  const brierScore =
    average(
      probabilities.map(
        (
          probability,
          index,
        ) =>
          (
            probability -
            (
              input.rows[
                index
              ]
                .positiveOutcome
                ? 1
                : 0
            )
          ) **
          2,
      ),
    );

  const logLoss =
    average(
      probabilities.map(
        (
          probability,
          index,
        ) => {
          const outcome =
            input.rows[
              index
            ]
              .positiveOutcome
              ? 1
              : 0;

          const bounded =
            clamp(
              probability,
              0.0001,
              0.9999,
            );

          return -(
            outcome *
            Math.log(
              bounded,
            ) +
            (
              1 -
              outcome
            ) *
            Math.log(
              1 -
              bounded,
            )
          );
        },
      ),
    );

  const correct =
    probabilities.filter(
      (
        probability,
        index,
      ) =>
        (
          probability >=
          0.5
        ) ===
        input.rows[
          index
        ]
          .positiveOutcome,
    ).length;

  const bins =
    Array.from(
      {
        length:
          10,
      },
      () => [] as number[],
    );

  probabilities.forEach(
    (
      probability,
      index,
    ) => {
      const bin =
        Math.min(
          9,
          Math.floor(
            probability *
            10,
          ),
        );

      bins[
        bin
      ].push(
        index,
      );
    },
  );

  let calibrationError =
    0;

  for (
    const bin of
      bins
  ) {
    if (!bin.length) {
      continue;
    }

    const predicted =
      average(
        bin.map(
          (index) =>
            probabilities[
              index
            ],
        ),
      );

    const observed =
      bin.filter(
        (index) =>
          input.rows[
            index
          ]
            .positiveOutcome,
      ).length /
      bin.length;

    calibrationError +=
      Math.abs(
        predicted -
        observed,
      ) *
      (
        bin.length /
        input.rows.length
      );
  }

  const returnErrors =
    expectedReturns.map(
      (
        expectedReturn,
        index,
      ) =>
        Math.abs(
          expectedReturn -
          input.rows[
            index
          ]
            .realizedReturnPercent,
        ),
    );

  const returnBias =
    average(
      expectedReturns.map(
        (
          expectedReturn,
          index,
        ) =>
          input.rows[
            index
          ]
            .realizedReturnPercent -
          expectedReturn,
      ),
    );

  return {
    sampleCount:
      input.rows.length,

    brierScore:
      round(
        brierScore,
      ),

    logLoss:
      round(
        logLoss,
      ),

    directionalAccuracyPercent:
      round(
        (
          correct /
          input.rows.length
        ) *
        100,
        2,
      ),

    expectedCalibrationError:
      round(
        calibrationError,
      ),

    meanAbsoluteReturnError:
      round(
        average(
          returnErrors,
        ),
        4,
      ),

    returnBias:
      round(
        returnBias,
        4,
      ),

    averageProbability:
      round(
        average(
          probabilities,
        ) *
        100,
        2,
      ),

    observedPositivePercent:
      round(
        (
          input.rows.filter(
            (row) =>
              row.positiveOutcome,
          ).length /
          input.rows.length
        ) *
        100,
        2,
      ),
  };
}

function componentCoverage(
  rows: EnsembleTrainingRow[],
) {
  if (!rows.length) {
    return {
      production:
        1,

      horizonModel:
        0,

      agentSimulation:
        0,
    };
  }

  return {
    production:
      1,

    horizonModel:
      rows.filter(
        (row) =>
          row.horizonModelProbability !==
          null,
      ).length /
      rows.length,

    agentSimulation:
      rows.filter(
        (row) =>
          row.simulationProbability !==
          null,
      ).length /
      rows.length,
  };
}

function weightCandidates() {
  const candidates:
    EnsembleWeights[] = [];

  for (
    let productionUnits = 5;
    productionUnits <= 18;
    productionUnits += 1
  ) {
    for (
      let horizonUnits = 0;
      horizonUnits <= 12;
      horizonUnits += 1
    ) {
      const simulationUnits =
        20 -
        productionUnits -
        horizonUnits;

      if (
        simulationUnits <
          0 ||
        simulationUnits >
          5
      ) {
        continue;
      }

      candidates.push({
        production:
          productionUnits /
          20,

        horizonModel:
          horizonUnits /
          20,

        agentSimulation:
          simulationUnits /
          20,
      });
    }
  }

  return candidates;
}

function coveragePenalty(
  weights: EnsembleWeights,
  coverage: {
    production:
      number;

    horizonModel:
      number;

    agentSimulation:
      number;
  },
) {
  return (
    weights.horizonModel *
      (
        1 -
        coverage.horizonModel
      ) *
      0.02 +
    weights.agentSimulation *
      (
        1 -
        coverage.agentSimulation
      ) *
      0.03
  );
}

function optimizeProbabilityWeights(
  rows: EnsembleTrainingRow[],
  horizon: ForecastHorizon,
) {
  if (!rows.length) {
    return priorProbabilityWeights(
      horizon,
    );
  }

  const coverage =
    componentCoverage(
      rows,
    );

  let best =
    priorProbabilityWeights(
      horizon,
    );

  let bestObjective =
    Number.POSITIVE_INFINITY;

  for (
    const candidate of
      weightCandidates()
  ) {
    const metrics =
      evaluateRows({
        rows,

        probabilityWeights:
          candidate,

        returnWeights:
          priorReturnWeights(
            horizon,
          ),

        calibration: {
          slope:
            1,

          intercept:
            0,
        },
      });

    const objective =
      metrics.brierScore +
      metrics.expectedCalibrationError *
      0.12 +
      coveragePenalty(
        candidate,
        coverage,
      );

    if (
      objective <
      bestObjective
    ) {
      bestObjective =
        objective;

      best =
        candidate;
    }
  }

  return best;
}

function optimizeReturnWeights(
  rows: EnsembleTrainingRow[],
  horizon: ForecastHorizon,
) {
  if (!rows.length) {
    return priorReturnWeights(
      horizon,
    );
  }

  const coverage =
    componentCoverage(
      rows,
    );

  let best =
    priorReturnWeights(
      horizon,
    );

  let bestObjective =
    Number.POSITIVE_INFINITY;

  for (
    const candidate of
      weightCandidates()
  ) {
    const metrics =
      evaluateRows({
        rows,

        probabilityWeights:
          priorProbabilityWeights(
            horizon,
          ),

        returnWeights:
          candidate,

        calibration: {
          slope:
            1,

          intercept:
            0,
        },
      });

    const objective =
      metrics.meanAbsoluteReturnError +
      coveragePenalty(
        candidate,
        coverage,
      ) *
      5;

    if (
      objective <
      bestObjective
    ) {
      bestObjective =
        objective;

      best =
        candidate;
    }
  }

  return best;
}

function trainCalibration(
  rows: EnsembleTrainingRow[],
  probabilityWeights:
    EnsembleWeights,
): CalibrationParameters {
  if (
    rows.length <
    20
  ) {
    return {
      slope:
        1,

      intercept:
        0,
    };
  }

  let slope =
    1;

  let intercept =
    0;

  const learningRate =
    0.025;

  const regularization =
    0.012;

  for (
    let epoch = 0;
    epoch < 280;
    epoch += 1
  ) {
    let slopeGradient =
      0;

    let interceptGradient =
      0;

    for (
      const row of
        rows
    ) {
      const raw =
        rawProbabilityForRow({
          row,

          weights:
            probabilityWeights,
        });

      const feature =
        logit(
          raw,
        );

      const probability =
        sigmoid(
          intercept +
          slope *
          feature,
        );

      const outcome =
        row.positiveOutcome
          ? 1
          : 0;

      const error =
        probability -
        outcome;

      interceptGradient +=
        error;

      slopeGradient +=
        error *
        feature;
    }

    intercept -=
      learningRate *
      (
        interceptGradient /
        rows.length
      );

    slope -=
      learningRate *
      (
        slopeGradient /
        rows.length +
        regularization *
        (
          slope -
          1
        )
      );

    intercept =
      clamp(
        intercept,
        -2.5,
        2.5,
      );

    slope =
      clamp(
        slope,
        0.25,
        3.5,
      );
  }

  return {
    slope:
      round(
        slope,
      ),

    intercept:
      round(
        intercept,
      ),
  };
}

function buildComponentAblations(
  input: {
    rows:
      EnsembleTrainingRow[];

    probabilityWeights:
      EnsembleWeights;

    returnWeights:
      EnsembleWeights;

    calibration:
      CalibrationParameters;

    fullMetrics:
      EnsembleMetrics;
  },
) {
  return COMPONENT_NAMES.map(
    (
      component,
    ): ComponentAblation => {
      const metrics =
        evaluateRows({
          rows:
            input.rows,

          probabilityWeights:
            input.probabilityWeights,

          returnWeights:
            input.returnWeights,

          calibration:
            input.calibration,

          excludedComponent:
            component,
        });

      const brierDelta =
        metrics.brierScore -
        input.fullMetrics
          .brierScore;

      const accuracyDelta =
        metrics.directionalAccuracyPercent -
        input.fullMetrics
          .directionalAccuracyPercent;

      const returnErrorDelta =
        metrics.meanAbsoluteReturnError -
        input.fullMetrics
          .meanAbsoluteReturnError;

      return {
        component,

        sampleCount:
          metrics.sampleCount,

        brierScore:
          metrics.brierScore,

        brierDelta:
          round(
            brierDelta,
          ),

        directionalAccuracyPercent:
          metrics.directionalAccuracyPercent,

        accuracyDelta:
          round(
            accuracyDelta,
            2,
          ),

        meanAbsoluteReturnError:
          metrics.meanAbsoluteReturnError,

        returnErrorDelta:
          round(
            returnErrorDelta,
            4,
          ),

        conclusion:
          brierDelta >
          0.004
            ? "Helpful"
            : brierDelta <
                -0.004
              ? "Potentially Harmful"
              : "Neutral",
      };
    },
  );
}

function buildFeatureAblations(
  input: {
    rows:
      EnsembleTrainingRow[];

    probabilityWeights:
      EnsembleWeights;

    returnWeights:
      EnsembleWeights;

    calibration:
      CalibrationParameters;

    fullMetrics:
      EnsembleMetrics;
  },
) {
  const features =
    Array.from(
      new Set(
        input.rows.flatMap(
          (row) =>
            Object.keys(
              row.featureImpacts,
            ),
        ),
      ),
    ).sort();

  return features.map(
    (
      feature,
    ): FeatureAblation => {
      const affectedSampleCount =
        input.rows.filter(
          (row) =>
            Boolean(
              row.featureImpacts[
                feature
              ],
            ),
        ).length;

      const metrics =
        evaluateRows({
          rows:
            input.rows,

          probabilityWeights:
            input.probabilityWeights,

          returnWeights:
            input.returnWeights,

          calibration:
            input.calibration,

          ablatedFeature:
            feature,
        });

      const brierDelta =
        metrics.brierScore -
        input.fullMetrics
          .brierScore;

      const accuracyDelta =
        metrics.directionalAccuracyPercent -
        input.fullMetrics
          .directionalAccuracyPercent;

      const returnErrorDelta =
        metrics.meanAbsoluteReturnError -
        input.fullMetrics
          .meanAbsoluteReturnError;

      const meaningfulCoverage =
        affectedSampleCount >=
        Math.max(
          10,
          Math.floor(
            input.rows.length *
            0.25,
          ),
        );

      return {
        feature,

        affectedSampleCount,

        brierScore:
          metrics.brierScore,

        brierDelta:
          round(
            brierDelta,
          ),

        directionalAccuracyPercent:
          metrics.directionalAccuracyPercent,

        accuracyDelta:
          round(
            accuracyDelta,
            2,
          ),

        meanAbsoluteReturnError:
          metrics.meanAbsoluteReturnError,

        returnErrorDelta:
          round(
            returnErrorDelta,
            4,
          ),

        recommendation:
          meaningfulCoverage &&
          brierDelta <
          -0.002
            ? "Remove Candidate"
            : meaningfulCoverage &&
                brierDelta <
                0
              ? "Review"
              : "Keep",
      };
    },
  );
}

function productionOnlyMetrics(
  rows: EnsembleTrainingRow[],
) {
  return evaluateRows({
    rows,

    probabilityWeights: {
      production:
        1,

      horizonModel:
        0,

      agentSimulation:
        0,
    },

    returnWeights: {
      production:
        1,

      horizonModel:
        0,

      agentSimulation:
        0,
    },

    calibration: {
      slope:
        1,

      intercept:
        0,
    },
  });
}

function promotionGates(
  input: {
    validation:
      EnsembleMetrics;

    production:
      EnsembleMetrics;

    validationCount:
      number;

    horizonCoverage:
      ReturnType<
        typeof componentCoverage
      >;
  },
) {
  const items = [
    {
      key:
        "validation-sample-count",

      passed:
        input.validationCount >=
        20,

      actual:
        input.validationCount,

      threshold:
        20,

      detail:
        "At least 20 chronological validation outcomes are required.",
    },

    {
      key:
        "brier-score",

      passed:
        input.validation.brierScore <=
        0.25,

      actual:
        input.validation.brierScore,

      threshold:
        0.25,

      detail:
        "Calibrated probability error must remain below the gate.",
    },

    {
      key:
        "production-brier-comparison",

      passed:
        input.validation.brierScore <=
        input.production.brierScore +
        0.005,

      actual:
        input.validation.brierScore -
        input.production.brierScore,

      threshold:
        0.005,

      detail:
        "The ensemble may not materially regress from the production forecast.",
    },

    {
      key:
        "directional-accuracy",

      passed:
        input.validation.directionalAccuracyPercent >=
        50,

      actual:
        input.validation.directionalAccuracyPercent,

      threshold:
        50,

      detail:
        "Validation directional accuracy must be at least 50%.",
    },

    {
      key:
        "calibration-error",

      passed:
        input.validation.expectedCalibrationError <=
        0.12,

      actual:
        input.validation.expectedCalibrationError,

      threshold:
        0.12,

      detail:
        "Expected calibration error must remain controlled.",
    },

    {
      key:
        "horizon-model-coverage",

      passed:
        input.horizonCoverage.horizonModel >=
        0.5,

      actual:
        input.horizonCoverage.horizonModel,

      threshold:
        0.5,

      detail:
        "At least half of validation rows need horizon-model predictions.",
    },
  ];

  return {
    allPassed:
      items.every(
        (item) =>
          item.passed,
      ),

    items,
  };
}

function trainArtifact(
  horizon: ForecastHorizon,
  rows: EnsembleTrainingRow[],
): EnsembleHorizonArtifact {
  const chronological =
    [...rows].sort(
      (
        left,
        right,
      ) =>
        left.targetAt.getTime() -
        right.targetAt.getTime(),
    );

  if (
    chronological.length <
    MINIMUM_TRAINING_SAMPLES
  ) {
    return {
      ...priorArtifact(
        horizon,
      ),

      sampleCount:
        chronological.length,

      validationCount:
        chronological.length,

      validationMetrics:
        productionOnlyMetrics(
          chronological,
        ),

      productionOnlyMetrics:
        productionOnlyMetrics(
          chronological,
        ),

      componentCoverage:
        componentCoverage(
          chronological,
        ),
    };
  }

  const validationCount =
    Math.max(
      10,
      Math.floor(
        chronological.length *
        0.25,
      ),
    );

  const trainingRows =
    chronological.slice(
      0,
      chronological.length -
      validationCount,
    );

  const validationRows =
    chronological.slice(
      -validationCount,
    );

  const probabilityWeights =
    optimizeProbabilityWeights(
      trainingRows,
      horizon,
    );

  const returnWeights =
    optimizeReturnWeights(
      trainingRows,
      horizon,
    );

  const calibration =
    trainCalibration(
      trainingRows,
      probabilityWeights,
    );

  const trainingMetrics =
    evaluateRows({
      rows:
        trainingRows,

      probabilityWeights,

      returnWeights,

      calibration,
    });

  const validationMetrics =
    evaluateRows({
      rows:
        validationRows,

      probabilityWeights,

      returnWeights,

      calibration,
    });

  const baselineMetrics =
    productionOnlyMetrics(
      validationRows,
    );

  const coverage =
    componentCoverage(
      validationRows,
    );

  const componentAblations =
    buildComponentAblations({
      rows:
        validationRows,

      probabilityWeights,

      returnWeights,

      calibration,

      fullMetrics:
        validationMetrics,
    });

  const featureAblations =
    buildFeatureAblations({
      rows:
        validationRows,

      probabilityWeights,

      returnWeights,

      calibration,

      fullMetrics:
        validationMetrics,
    });

  const recommendedFeatureRemovals =
    featureAblations
      .filter(
        (ablation) =>
          ablation.recommendation ===
          "Remove Candidate",
      )
      .map(
        (ablation) =>
          ablation.feature,
      );

  return {
    horizon,

    status:
      "TRAINED",

    sampleCount:
      chronological.length,

    trainingCount:
      trainingRows.length,

    validationCount:
      validationRows.length,

    probabilityWeights,

    returnWeights,

    calibration,

    trainingMetrics,

    validationMetrics,

    productionOnlyMetrics:
      baselineMetrics,

    componentCoverage:
      coverage,

    componentAblations,

    featureAblations,

    recommendedFeatureRemovals,

    promotionGates:
      promotionGates({
        validation:
          validationMetrics,

        production:
          baselineMetrics,

        validationCount:
          validationRows.length,

        horizonCoverage:
          coverage,
      }),
  };
}

function modelVersion() {
  return [
    ENSEMBLE_FAMILY,
    "1.0.0",
    Date.now(),
  ].join("-");
}

export async function trainEnsembleSuite(
  input: {
    userId:
      string;

    request?:
      Request;
  },
) {
  const loaded =
    await loadTrainingRows(
      input.userId,
    );

  const artifacts =
    Object.fromEntries(
      FORECAST_HORIZONS.map(
        (horizon) => [
          horizon,
          trainArtifact(
            horizon,
            loaded.rows.filter(
              (row) =>
                row.horizon ===
                horizon,
            ),
          ),
        ],
      ),
    ) as Record<
      ForecastHorizon,
      EnsembleHorizonArtifact
    >;

  const trainedCount =
    Object.values(
      artifacts,
    ).filter(
      (artifact) =>
        artifact.status ===
        "TRAINED",
    ).length;

  const trainedAt =
    new Date().toISOString();

  const version =
    modelVersion();

  const suite:
    EnsembleSuite = {
    schemaVersion:
      "slice-ensemble-suite-1.0.0",

    family:
      ENSEMBLE_FAMILY,

    modelVersion:
      version,

    engineVersion:
      ENSEMBLE_ENGINE_VERSION,

    calibrationVersion:
      ENSEMBLE_CALIBRATION_VERSION,

    trainedAt,

    status:
      trainedCount >
      0
        ? "TRAINED"
        : "PRIOR",

    totalEligibleSamples:
      loaded.rows.length,

    artifacts,

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticPromotionEnabled:
        false,

      simulationTreatedAsTruth:
        false,

      shadowOnly:
        true,

      featureRemovalAutomatic:
        false,
    },
  };

  const storedModel =
    await prisma.intelligenceForecastModel.create({
      data: {
        userId:
          input.userId,

        modelKey:
          version,

        displayName:
          `Calibrated Ensemble ${trainedAt.slice(
            0,
            10,
          )}`,

        description:
          "Chronologically validated ensemble of production forecasts, horizon models, and baseline agent simulations.",

        engineVersion:
          ENSEMBLE_ENGINE_VERSION,

        modelVersion:
          version,

        calibrationVersion:
          ENSEMBLE_CALIBRATION_VERSION,

        status:
          "Shadow",

        configurationJson:
          safeJson(
            suite,
            "{}",
          ),

        promotionGatesJson:
          safeJson(
            {
              humanApprovalRequired:
                true,

              automaticPromotionEnabled:
                false,

              horizonGates:
                Object.fromEntries(
                  FORECAST_HORIZONS.map(
                    (horizon) => [
                      horizon,
                      artifacts[
                        horizon
                      ].promotionGates,
                    ],
                  ),
                ),
            },
            "{}",
          ),

        metadataJson:
          safeJson(
            {
              trainedAt,

              sourceCount:
                loaded.sourceCount,

              eligibleCount:
                loaded.rows.length,

              exclusionCount:
                loaded.exclusions.length,

              trainedHorizonCount:
                trainedCount,

              exclusions:
                loaded.exclusions.slice(
                  0,
                  500,
                ),

              autonomousTradingEnabled:
                false,
            },
            "{}",
          ),
      },
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_ENSEMBLE_TRAINED",

    severity:
      trainedCount >
      0
        ? "Info"
        : "Warning",

    area:
      "Market Intelligence",

    title:
      `Trained calibrated ensemble ${version}`,

    detail:
      `${loaded.rows.length} eligible outcomes were evaluated. ` +
      `${trainedCount} of ${FORECAST_HORIZONS.length} horizons met the training threshold.`,

    metadata: {
      modelId:
        storedModel.id,

      modelVersion:
        version,

      eligibleSampleCount:
        loaded.rows.length,

      trainedHorizonCount:
        trainedCount,

      exclusionCount:
        loaded.exclusions.length,

      automaticPromotionEnabled:
        false,

      autonomousTradingEnabled:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    model:
      storedModel,

    suite,

    exclusions:
      loaded.exclusions,
  };
}

function parseSuite(
  value: string,
): EnsembleSuite | null {
  const parsed =
    parseJson(
      value,
    );

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !==
      "slice-ensemble-suite-1.0.0" ||
    !isRecord(
      parsed.artifacts,
    )
  ) {
    return null;
  }

  return parsed as unknown as EnsembleSuite;
}

export async function loadEnsembleSuite(
  userId: string,
) {
  const models =
    await prisma.intelligenceForecastModel.findMany({
      where: {
        userId,

        engineVersion:
          ENSEMBLE_ENGINE_VERSION,

        status: {
          not:
            "Disabled",
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        25,
    });

  const selected =
    models.find(
      (model) =>
        model.status ===
        "Production",
    ) ??
    models.find(
      (model) =>
        model.status ===
        "Candidate",
    ) ??
    models.find(
      (model) =>
        model.status ===
        "Shadow",
    ) ??
    models[0];

  if (!selected) {
    return createPriorEnsembleSuite();
  }

  return (
    parseSuite(
      selected.configurationJson,
    ) ??
    createPriorEnsembleSuite()
  );
}

function predictionKey(
  runId: string,
  horizon: ForecastHorizon,
) {
  return `${runId}:${horizon}`;
}

async function loadRunComponents(
  input: {
    userId:
      string;

    runId:
      string;
  },
) {
  const run =
    await prisma.intelligenceForecastRun.findFirst({
      where: {
        id:
          input.runId,

        userId:
          input.userId,
      },

      include: {
        horizons: {
          orderBy: {
            targetAt:
              "asc",
          },
        },
      },
    });

  if (!run) {
    throw new Error(
      "Forecast run was not found.",
    );
  }

  const events =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId:
          input.userId,

        sourceId:
          run.id,

        eventType: {
          in: [
            HORIZON_SHADOW_EVENT_TYPE,
            AGENT_SIMULATION_EVENT_TYPE,
          ],
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id:
          true,

        sourceId:
          true,

        eventType:
          true,

        createdAt:
          true,

        metadataJson:
          true,
      },
    });

  const shadowByKey =
    latestByKey(
      events
        .filter(
          (event) =>
            event.eventType ===
            HORIZON_SHADOW_EVENT_TYPE,
        )
        .map(
          parseShadowPrediction,
        )
        .filter(
          (
            item,
          ): item is ShadowPrediction =>
            Boolean(item),
        ),
      (item) =>
        predictionKey(
          item.forecastRunId,
          item.horizon,
        ),
    );

  const simulationByKey =
    latestByKey(
      events
        .filter(
          (event) =>
            event.eventType ===
            AGENT_SIMULATION_EVENT_TYPE,
        )
        .flatMap(
          parseSimulationPredictions,
        ),
      (item) =>
        predictionKey(
          item.forecastRunId,
          item.horizon,
        ),
    );

  return {
    run,

    shadowByKey,

    simulationByKey,
  };
}

function calculateLivePrediction(
  input: {
    horizon:
      ForecastHorizon;

    productionProbability:
      number;

    productionReturn:
      number;

    horizonModel:
      ShadowPrediction | null;

    simulation:
      SimulationPrediction | null;

    artifact:
      EnsembleHorizonArtifact;

    suite:
      EnsembleSuite;
  },
): EnsemblePrediction {
  const probabilityValues:
    Record<
      ComponentName,
      number | null
    > = {
    production:
      clamp(
        input.productionProbability /
        100,
        0.0001,
        0.9999,
      ),

    horizonModel:
      input.horizonModel
        ? clamp(
            input.horizonModel.probability /
            100,
            0.0001,
            0.9999,
          )
        : null,

    agentSimulation:
      input.simulation
        ? clamp(
            input.simulation.probability /
            100,
            0.0001,
            0.9999,
          )
        : null,
  };

  const returnValues:
    Record<
      ComponentName,
      number | null
    > = {
    production:
      input.productionReturn,

    horizonModel:
      input.horizonModel
        ?.expectedReturnPercent ??
      null,

    agentSimulation:
      input.simulation
        ?.expectedReturnPercent ??
      null,
  };

  const availability = {
    production:
      true,

    horizonModel:
      probabilityValues.horizonModel !==
      null,

    agentSimulation:
      probabilityValues.agentSimulation !==
      null,
  };

  const probabilityApplied =
    normalizedAppliedWeights({
      weights:
        input.artifact
          .probabilityWeights,

      availability,
    });

  const returnApplied =
    normalizedAppliedWeights({
      weights:
        input.artifact
          .returnWeights,

      availability,
    });

  let rawProbability =
    0;

  let expectedReturn =
    0;

  for (
    const component of
      COMPONENT_NAMES
  ) {
    rawProbability +=
      (
        probabilityValues[
          component
        ] ??
        0
      ) *
      probabilityApplied[
        component
      ];

    expectedReturn +=
      (
        returnValues[
          component
        ] ??
        0
      ) *
      returnApplied[
        component
      ];
  }

  const probability =
    calibratedProbability(
      rawProbability,
      input.artifact
        .calibration,
    );

  const componentProbabilities =
    COMPONENT_NAMES
      .map(
        (component) =>
          probabilityValues[
            component
          ],
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
          null,
      );

  const disagreement =
    standardDeviation(
      componentProbabilities,
    );

  const componentCount =
    componentProbabilities.length;

  const sampleStrength =
    clamp(
      Math.log1p(
        input.artifact
          .sampleCount,
      ) /
      Math.log1p(
        500,
      ),
      0,
      1,
    );

  const confidence =
    clamp(
      35 +
      sampleStrength *
      25 +
      componentCount *
      8 -
      disagreement *
      100,
      15,
      95,
    );

  const warnings:
    string[] = [];

  if (
    !availability.horizonModel
  ) {
    warnings.push(
      "The horizon-model component was unavailable.",
    );
  }

  if (
    !availability.agentSimulation
  ) {
    warnings.push(
      "The baseline simulation component was unavailable.",
    );
  }

  if (
    input.artifact.status ===
    "PRIOR"
  ) {
    warnings.push(
      "Prior ensemble weights are being used because training history is insufficient.",
    );
  }

  if (
    disagreement >
    0.15
  ) {
    warnings.push(
      "Forecast components have elevated disagreement.",
    );
  }

  if (
    input.artifact
      .recommendedFeatureRemovals
      .length
  ) {
    warnings.push(
      "One or more feature-removal candidates require human review.",
    );
  }

  return {
    horizon:
      input.horizon,

    modelVersion:
      input.suite
        .modelVersion,

    trainingStatus:
      input.artifact
        .status,

    probabilityBeforeCalibration:
      round(
        rawProbability *
        100,
        2,
      ),

    positiveReturnProbability:
      round(
        probability *
        100,
        2,
      ),

    expectedReturnPercent:
      round(
        expectedReturn,
        4,
      ),

    direction:
      probability >=
      0.55
        ? "Bullish"
        : probability <=
            0.45
          ? "Bearish"
          : "Neutral",

    confidence:
      round(
        confidence,
        2,
      ),

    componentAgreementPercent:
      round(
        clamp(
          1 -
          disagreement /
          0.5,
          0,
          1,
        ) *
        100,
        2,
      ),

    componentCount,

    components:
      COMPONENT_NAMES.map(
        (
          component,
        ): EnsemblePredictionComponent => ({
          component,

          available:
            availability[
              component
            ],

          probability:
            probabilityValues[
              component
            ] ===
            null
              ? null
              : round(
                  (
                    probabilityValues[
                      component
                    ] ??
                    0
                  ) *
                  100,
                  2,
                ),

          expectedReturnPercent:
            returnValues[
              component
            ] ===
            null
              ? null
              : round(
                  returnValues[
                    component
                  ] ??
                  0,
                  4,
                ),

          configuredProbabilityWeight:
            input.artifact
              .probabilityWeights[
                component
              ],

          appliedProbabilityWeight:
            probabilityApplied[
              component
            ],

          configuredReturnWeight:
            input.artifact
              .returnWeights[
                component
              ],

          appliedReturnWeight:
            returnApplied[
              component
            ],
        }),
      ),

    warnings,
  };
}

export async function generateEnsembleForRun(
  input: {
    userId:
      string;

    runId:
      string;

    request?:
      Request;
  },
) {
  const components =
    await loadRunComponents({
      userId:
        input.userId,

      runId:
        input.runId,
    });

  const suite =
    await loadEnsembleSuite(
      input.userId,
    );

  const predictions:
    EnsemblePrediction[] = [];

  for (
    const horizon of
      components.run
        .horizons
  ) {
    const normalized =
      asHorizon(
        horizon.horizon,
      );

    if (!normalized) {
      continue;
    }

    const key =
      predictionKey(
        components.run.id,
        normalized,
      );

    const artifact =
      suite.artifacts[
        normalized
      ] ??
      priorArtifact(
        normalized,
      );

    predictions.push(
      calculateLivePrediction({
        horizon:
          normalized,

        productionProbability:
          horizon.positiveReturnProbability,

        productionReturn:
          horizon.expectedReturnPercent,

        horizonModel:
          components.shadowByKey.get(
            key,
          ) ??
          null,

        simulation:
          components.simulationByKey.get(
            key,
          ) ??
          null,

        artifact,

        suite,
      }),
    );
  }

  const result:
    EnsembleRunResult = {
    schemaVersion:
      "slice-ensemble-predictions-1.0.0",

    generatedAt:
      new Date().toISOString(),

    forecastRunId:
      components.run.id,

    symbol:
      components.run.symbol,

    modelVersion:
      suite.modelVersion,

    engineVersion:
      suite.engineVersion,

    calibrationVersion:
      suite.calibrationVersion,

    mode:
      "SHADOW",

    predictions,

    safeguards: {
      autonomousTradingEnabled:
        false,

      replacesProductionForecast:
        false,

      simulationTreatedAsTruth:
        false,

      automaticPromotionEnabled:
        false,

      decisionSupportOnly:
        true,
    },
  };

  for (
    const prediction of
      predictions
  ) {
    const eventKey = [
      "ensemble-prediction",
      components.run.id,
      suite.modelVersion,
      prediction.horizon,
    ].join(":");

    await prisma.backendPlatformEvent.upsert({
      where: {
        userId_eventKey: {
          userId:
            input.userId,

          eventKey,
        },
      },

      update: {
        eventType:
          ENSEMBLE_PREDICTION_EVENT_TYPE,

        area:
          "Market Intelligence",

        title:
          `${prediction.horizon} calibrated ensemble prediction`,

        detail:
          `${prediction.direction} with ${prediction.positiveReturnProbability}% positive-return probability.`,

        severity:
          "Info",

        status:
          "Recorded",

        sourceType:
          "IntelligenceForecastRun",

        sourceId:
          components.run.id,

        metadataJson:
          safeJson(
            {
              ...prediction,

              forecastRunId:
                components.run.id,

              symbol:
                components.run.symbol,

              generatedAt:
                result.generatedAt,

              engineVersion:
                result.engineVersion,

              calibrationVersion:
                result.calibrationVersion,

              safeguards:
                result.safeguards,
            },
            "{}",
          ),
      },

      create: {
        userId:
          input.userId,

        eventKey,

        eventType:
          ENSEMBLE_PREDICTION_EVENT_TYPE,

        area:
          "Market Intelligence",

        title:
          `${prediction.horizon} calibrated ensemble prediction`,

        detail:
          `${prediction.direction} with ${prediction.positiveReturnProbability}% positive-return probability.`,

        severity:
          "Info",

        status:
          "Recorded",

        sourceType:
          "IntelligenceForecastRun",

        sourceId:
          components.run.id,

        metadataJson:
          safeJson(
            {
              ...prediction,

              forecastRunId:
                components.run.id,

              symbol:
                components.run.symbol,

              generatedAt:
                result.generatedAt,

              engineVersion:
                result.engineVersion,

              calibrationVersion:
                result.calibrationVersion,

              safeguards:
                result.safeguards,
            },
            "{}",
          ),
      },
    });
  }

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_ENSEMBLE_PREDICTIONS_GENERATED",

    severity:
      "Info",

    area:
      "Market Intelligence",

    title:
      `Generated calibrated ensemble for ${components.run.symbol}`,

    detail:
      `${predictions.length} horizon predictions were generated in shadow mode.`,

    metadata: {
      forecastRunId:
        components.run.id,

      symbol:
        components.run.symbol,

      modelVersion:
        suite.modelVersion,

      predictionCount:
        predictions.length,

      automaticPromotionEnabled:
        false,

      autonomousTradingEnabled:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return result;
}

type StoredEnsemblePrediction = {
  eventId:
    string;

  createdAt:
    Date;

  forecastRunId:
    string;

  modelVersion:
    string;

  horizon:
    ForecastHorizon;

  probability:
    number;

  expectedReturnPercent:
    number;

  direction:
    string;

  confidence:
    number;
};

function parseStoredEnsemble(
  event: {
    id:
      string;

    createdAt:
      Date;

    sourceId:
      string | null;

    metadataJson:
      string;
  },
): StoredEnsemblePrediction | null {
  if (!event.sourceId) {
    return null;
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return null;
  }

  const horizon =
    asHorizon(
      String(
        parsed.horizon ??
        "",
      ),
    );

  if (!horizon) {
    return null;
  }

  return {
    eventId:
      event.id,

    createdAt:
      event.createdAt,

    forecastRunId:
      event.sourceId,

    modelVersion:
      String(
        parsed.modelVersion ??
        "",
      ),

    horizon,

    probability:
      clamp(
        finiteNumber(
          parsed.positiveReturnProbability,
          50,
        ),
        1,
        99,
      ),

    expectedReturnPercent:
      finiteNumber(
        parsed.expectedReturnPercent,
        0,
      ),

    direction:
      String(
        parsed.direction ??
        "Neutral",
      ),

    confidence:
      finiteNumber(
        parsed.confidence,
        0,
      ),
  };
}

function evaluateStoredPredictions(
  rows: Array<{
    prediction:
      StoredEnsemblePrediction;

    positiveOutcome:
      boolean;

    realizedReturnPercent:
      number;
  }>,
) {
  if (!rows.length) {
    return zeroMetrics();
  }

  const trainingRows:
    EnsembleTrainingRow[] =
    rows.map(
      (row) => ({
        forecastRunId:
          row.prediction
            .forecastRunId,

        horizonId:
          row.prediction
            .eventId,

        horizon:
          row.prediction
            .horizon,

        targetAt:
          row.prediction
            .createdAt,

        positiveOutcome:
          row.positiveOutcome,

        realizedReturnPercent:
          row.realizedReturnPercent,

        productionProbability:
          row.prediction
            .probability,

        productionExpectedReturn:
          row.prediction
            .expectedReturnPercent,

        horizonModelProbability:
          null,

        horizonModelExpectedReturn:
          null,

        simulationProbability:
          null,

        simulationExpectedReturn:
          null,

        featureImpacts:
          {},
      }),
    );

  return productionOnlyMetrics(
    trainingRows,
  );
}

export async function evaluateEnsemblePredictions(
  input: {
    userId:
      string;

    modelVersion?:
      string;
  },
) {
  const events =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId:
          input.userId,

        eventType:
          ENSEMBLE_PREDICTION_EVENT_TYPE,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        5_000,

      select: {
        id:
          true,

        createdAt:
          true,

        sourceId:
          true,

        metadataJson:
          true,
      },
    });

  const predictions =
    events
      .map(
        parseStoredEnsemble,
      )
      .filter(
        (
          prediction,
        ): prediction is StoredEnsemblePrediction =>
          Boolean(
            prediction,
          ),
      )
      .filter(
        (prediction) =>
          input.modelVersion
            ? prediction.modelVersion ===
              input.modelVersion
            : true,
      );

  const runIds =
    Array.from(
      new Set(
        predictions.map(
          (prediction) =>
            prediction.forecastRunId,
        ),
      ),
    );

  const horizons =
    runIds.length
      ? await prisma.intelligenceForecastHorizon.findMany({
          where: {
            userId:
              input.userId,

            forecastRunId: {
              in:
                runIds,
            },

            status:
              "Settled",

            outcome: {
              isNot:
                null,
            },
          },

          include: {
            outcome:
              true,
          },
        })
      : [];

  const horizonByKey =
    new Map(
      horizons.map(
        (horizon) => [
          `${horizon.forecastRunId}:${horizon.horizon}`,
          horizon,
        ],
      ),
    );

  const matched =
    predictions
      .map(
        (prediction) => {
          const horizon =
            horizonByKey.get(
              `${prediction.forecastRunId}:${prediction.horizon}`,
            );

          if (
            !horizon ||
            !horizon.outcome ||
            prediction.createdAt.getTime() >
            horizon.targetAt.getTime()
          ) {
            return null;
          }

          return {
            prediction,

            positiveOutcome:
              horizon.outcome
                .positiveOutcome,

            realizedReturnPercent:
              horizon.outcome
                .realizedReturnPercent,
          };
        },
      )
      .filter(
        (
          row,
        ): row is NonNullable<
          typeof row
        > =>
          Boolean(row),
      );

  return {
    generatedAt:
      new Date().toISOString(),

    modelVersion:
      input.modelVersion ??
      null,

    predictionCount:
      predictions.length,

    matchedOutcomeCount:
      matched.length,

    overall:
      evaluateStoredPredictions(
        matched,
      ),

    byHorizon:
      FORECAST_HORIZONS.map(
        (horizon) => ({
          horizon,

          ...evaluateStoredPredictions(
            matched.filter(
              (row) =>
                row.prediction
                  .horizon ===
                horizon,
            ),
          ),
        }),
      ),
  };
}

export async function getEnsembleOverview(
  userId: string,
) {
  const models =
    await prisma.intelligenceForecastModel.findMany({
      where: {
        userId,

        engineVersion:
          ENSEMBLE_ENGINE_VERSION,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        20,
    });

  const suite =
    await loadEnsembleSuite(
      userId,
    );

  const evaluation =
    await evaluateEnsemblePredictions({
      userId,

      modelVersion:
        suite.modelVersion,
    });

  const recentEvents =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId,

        eventType:
          ENSEMBLE_PREDICTION_EVENT_TYPE,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        40,

      select: {
        id:
          true,

        createdAt:
          true,

        sourceId:
          true,

        metadataJson:
          true,
      },
    });

  return {
    generatedAt:
      new Date().toISOString(),

    activeSuite:
      suite,

    models:
      models.map(
        (model) => ({
          id:
            model.id,

          displayName:
            model.displayName,

          modelVersion:
            model.modelVersion,

          engineVersion:
            model.engineVersion,

          calibrationVersion:
            model.calibrationVersion,

          status:
            model.status,

          createdAt:
            model.createdAt,

          promotedAt:
            model.promotedAt,
        }),
      ),

    evaluation,

    recentPredictions:
      recentEvents
        .map(
          parseStoredEnsemble,
        )
        .filter(
          (
            item,
          ): item is StoredEnsemblePrediction =>
            Boolean(item),
        ),

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticPromotionEnabled:
        false,

      automaticFeatureRemovalEnabled:
        false,

      simulationTreatedAsTruth:
        false,

      activeMode:
        "SHADOW",
    },
  };
}