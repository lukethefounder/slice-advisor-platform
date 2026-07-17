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

const ENGINE_VERSION =
  "slice-horizon-engine-2.0.0";

const MODEL_FAMILY =
  "slice-horizon-suite";

const CALIBRATION_VERSION =
  "chronological-logistic-linear-v1";

const MINIMUM_TRAINING_SAMPLES =
  25;

const MAXIMUM_TRAINING_ROWS =
  10_000;

const SHADOW_EVENT_TYPE =
  "HORIZON_SHADOW_PREDICTION";

const FEATURE_NAMES = [
  "sentiment",
  "sentimentConfidence",
  "dataQuality",
  "trend",
  "momentum",
  "volume",
  "volatility",
  "revenueGrowth",
  "earningsGrowth",
  "operatingMargin",
  "newsSentiment",
  "contradiction",
  "macroAlignment",
  "liquidity",
  "stress",
  "options",
  "dealerGamma",
  "crowding",
  "shortInterest",
  "environmentAlignment",
  "disruption",
  "supplyResilience",
  "propagation",
  "concentration",
] as const;

type FeatureName =
  (typeof FEATURE_NAMES)[number];

type FeatureVector =
  Record<
    FeatureName,
    number
  >;

type JsonRecord =
  Record<
    string,
    unknown
  >;

type TrainingRow = {
  horizon:
    ForecastHorizon;

  targetAt:
    Date;

  features:
    FeatureVector;

  positiveOutcome:
    boolean;

  realizedReturnPercent:
    number;
};

type TrainingMetrics = {
  sampleCount:
    number;

  brierScore:
    number;

  directionalAccuracyPercent:
    number;

  meanAbsoluteReturnError:
    number;

  averageForecastProbability:
    number;

  observedPositivePercent:
    number;
};

export type HorizonModelArtifact = {
  horizon:
    ForecastHorizon;

  label:
    string;

  status:
    "TRAINED" | "PRIOR";

  sampleCount:
    number;

  trainingCount:
    number;

  validationCount:
    number;

  trainedAt:
    string;

  returnScale:
    number;

  probabilityIntercept:
    number;

  probabilityCoefficients:
    FeatureVector;

  returnIntercept:
    number;

  returnCoefficients:
    FeatureVector;

  validationMetrics:
    TrainingMetrics;
};

export type HorizonModelSuite = {
  schemaVersion:
    "slice-horizon-suite-2.0.0";

  modelFamily:
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
    "PRIOR" | "TRAINED";

  totalEligibleSamples:
    number;

  artifacts:
    Record<
      ForecastHorizon,
      HorizonModelArtifact
    >;

  safeguards: {
    autonomousTradingEnabled:
      false;

    automaticPromotionEnabled:
      false;

    shadowOnly:
      true;
  };
};

export type HorizonFeatureContribution = {
  feature:
    FeatureName;

  value:
    number;

  probabilityImpact:
    number;

  returnImpactPercent:
    number;
};

export type HorizonSubmodel = {
  name:
    string;

  support:
    number;

  probability:
    number;
};

export type HorizonModelPrediction = {
  horizon:
    ForecastHorizon;

  label:
    string;

  modelVersion:
    string;

  trainingStatus:
    "TRAINED" | "PRIOR";

  sampleCount:
    number;

  positiveReturnProbability:
    number;

  expectedReturnPercent:
    number;

  direction:
    "Bullish" | "Bearish" | "Neutral";

  confidence:
    number;

  agreement:
    number;

  returnScale:
    number;

  submodels:
    HorizonSubmodel[];

  contributions:
    HorizonFeatureContribution[];
};

export type HorizonModelSuiteResult = {
  schemaVersion:
    "slice-horizon-predictions-2.0.0";

  generatedAt:
    string;

  modelVersion:
    string;

  engineVersion:
    string;

  calibrationVersion:
    string;

  mode:
    "SHADOW";

  features:
    FeatureVector;

  featureWarnings:
    string[];

  predictions:
    HorizonModelPrediction[];

  safeguards: {
    autonomousTradingEnabled:
      false;

    replacesProductionForecast:
      false;

    automaticPromotionEnabled:
      false;

    decisionSupportOnly:
      true;
  };
};

type HorizonSpec = {
  label:
    string;

  returnScale:
    number;

  probabilityIntercept:
    number;

  weights:
    Partial<
      FeatureVector
    >;

  categoryWeights: {
    technical:
      number;

    fundamental:
      number;

    event:
      number;

    macro:
      number;

    positioning:
      number;

    structural:
      number;
  };
};

const HORIZON_SPECS:
  Record<
    ForecastHorizon,
    HorizonSpec
  > = {
    "5-30m": {
      label:
        "5–30 minutes",

      returnScale:
        0.55,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.12,

        trend:
          0.3,

        momentum:
          0.58,

        volume:
          0.34,

        volatility:
          -0.18,

        newsSentiment:
          0.16,

        contradiction:
          -0.2,

        options:
          0.28,

        dealerGamma:
          0.24,

        crowding:
          -0.12,

        shortInterest:
          0.08,

        liquidity:
          0.12,

        stress:
          -0.16,
      },

      categoryWeights: {
        technical:
          0.38,

        fundamental:
          0.02,

        event:
          0.18,

        macro:
          0.08,

        positioning:
          0.29,

        structural:
          0.05,
      },
    },

    intraday: {
      label:
        "Intraday",

      returnScale:
        1.1,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.16,

        trend:
          0.4,

        momentum:
          0.5,

        volume:
          0.3,

        volatility:
          -0.16,

        newsSentiment:
          0.22,

        contradiction:
          -0.2,

        macroAlignment:
          0.1,

        liquidity:
          0.14,

        stress:
          -0.18,

        options:
          0.24,

        dealerGamma:
          0.18,

        crowding:
          -0.12,
      },

      categoryWeights: {
        technical:
          0.36,

        fundamental:
          0.03,

        event:
          0.21,

        macro:
          0.12,

        positioning:
          0.23,

        structural:
          0.05,
      },
    },

    "1d": {
      label:
        "1 trading day",

      returnScale:
        2.2,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.22,

        sentimentConfidence:
          0.08,

        dataQuality:
          0.08,

        trend:
          0.42,

        momentum:
          0.4,

        volume:
          0.2,

        volatility:
          -0.14,

        newsSentiment:
          0.3,

        contradiction:
          -0.24,

        macroAlignment:
          0.14,

        liquidity:
          0.12,

        stress:
          -0.2,

        options:
          0.18,

        dealerGamma:
          0.12,
      },

      categoryWeights: {
        technical:
          0.31,

        fundamental:
          0.08,

        event:
          0.27,

        macro:
          0.16,

        positioning:
          0.13,

        structural:
          0.05,
      },
    },

    "2-5d": {
      label:
        "2–5 trading days",

      returnScale:
        4.2,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.24,

        sentimentConfidence:
          0.08,

        dataQuality:
          0.1,

        trend:
          0.46,

        momentum:
          0.32,

        volume:
          0.14,

        volatility:
          -0.12,

        revenueGrowth:
          0.1,

        earningsGrowth:
          0.12,

        newsSentiment:
          0.3,

        contradiction:
          -0.26,

        macroAlignment:
          0.2,

        liquidity:
          0.14,

        stress:
          -0.22,

        options:
          0.14,

        crowding:
          -0.1,
      },

      categoryWeights: {
        technical:
          0.28,

        fundamental:
          0.12,

        event:
          0.25,

        macro:
          0.2,

        positioning:
          0.1,

        structural:
          0.05,
      },
    },

    "1-4w": {
      label:
        "1–4 weeks",

      returnScale:
        8.5,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.24,

        sentimentConfidence:
          0.1,

        dataQuality:
          0.12,

        trend:
          0.48,

        momentum:
          0.22,

        volatility:
          -0.12,

        revenueGrowth:
          0.2,

        earningsGrowth:
          0.22,

        operatingMargin:
          0.14,

        newsSentiment:
          0.22,

        contradiction:
          -0.24,

        macroAlignment:
          0.28,

        liquidity:
          0.16,

        stress:
          -0.24,

        crowding:
          -0.1,

        supplyResilience:
          0.08,

        propagation:
          -0.08,
      },

      categoryWeights: {
        technical:
          0.24,

        fundamental:
          0.22,

        event:
          0.18,

        macro:
          0.23,

        positioning:
          0.06,

        structural:
          0.07,
      },
    },

    "1-3m": {
      label:
        "1–3 months",

      returnScale:
        15,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.18,

        sentimentConfidence:
          0.1,

        dataQuality:
          0.14,

        trend:
          0.38,

        momentum:
          0.12,

        volatility:
          -0.1,

        revenueGrowth:
          0.34,

        earningsGrowth:
          0.36,

        operatingMargin:
          0.24,

        newsSentiment:
          0.14,

        contradiction:
          -0.2,

        macroAlignment:
          0.36,

        liquidity:
          0.2,

        stress:
          -0.28,

        crowding:
          -0.08,

        environmentAlignment:
          0.08,

        supplyResilience:
          0.12,

        propagation:
          -0.1,
      },

      categoryWeights: {
        technical:
          0.16,

        fundamental:
          0.32,

        event:
          0.1,

        macro:
          0.29,

        positioning:
          0.04,

        structural:
          0.09,
      },
    },

    "3-12m": {
      label:
        "3–12 months",

      returnScale:
        35,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.12,

        sentimentConfidence:
          0.08,

        dataQuality:
          0.16,

        trend:
          0.24,

        volatility:
          -0.08,

        revenueGrowth:
          0.46,

        earningsGrowth:
          0.5,

        operatingMargin:
          0.38,

        contradiction:
          -0.14,

        macroAlignment:
          0.42,

        liquidity:
          0.22,

        stress:
          -0.3,

        crowding:
          -0.06,

        environmentAlignment:
          0.16,

        disruption:
          -0.14,

        supplyResilience:
          0.2,

        propagation:
          -0.16,

        concentration:
          -0.12,
      },

      categoryWeights: {
        technical:
          0.09,

        fundamental:
          0.39,

        event:
          0.05,

        macro:
          0.3,

        positioning:
          0.02,

        structural:
          0.15,
      },
    },

    "1-3y": {
      label:
        "1–3 years",

      returnScale:
        80,

      probabilityIntercept:
        0,

      weights: {
        sentiment:
          0.06,

        dataQuality:
          0.18,

        trend:
          0.12,

        revenueGrowth:
          0.54,

        earningsGrowth:
          0.56,

        operatingMargin:
          0.48,

        macroAlignment:
          0.34,

        liquidity:
          0.14,

        stress:
          -0.22,

        environmentAlignment:
          0.3,

        disruption:
          -0.24,

        supplyResilience:
          0.34,

        propagation:
          -0.26,

        concentration:
          -0.22,
      },

      categoryWeights: {
        technical:
          0.04,

        fundamental:
          0.44,

        event:
          0.02,

        macro:
          0.24,

        positioning:
          0.01,

        structural:
          0.25,
      },
    },
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

function normalizeKey(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    );
}

function findValue(
  value: unknown,
  aliases: string[],
  depth = 0,
): unknown {
  if (
    depth > 8 ||
    !isRecord(value)
  ) {
    return undefined;
  }

  const normalizedAliases =
    new Set(
      aliases.map(
        normalizeKey,
      ),
    );

  for (
    const [
      key,
      child,
    ] of Object.entries(
      value,
    )
  ) {
    if (
      normalizedAliases.has(
        normalizeKey(key),
      )
    ) {
      return child;
    }
  }

  for (
    const child of
      Object.values(value)
  ) {
    if (isRecord(child)) {
      const result =
        findValue(
          child,
          aliases,
          depth + 1,
        );

      if (
        result !==
        undefined
      ) {
        return result;
      }
    }
  }

  return undefined;
}

function finiteNumber(
  value: unknown,
  fallback: number,
) {
  const parsed =
    Number(
      typeof value ===
        "string"
        ? value.replace(
            /[%,$]/g,
            "",
          )
        : value,
    );

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
    ) / factor
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

function scoreCentered(
  value: unknown,
  fallback = 50,
) {
  let numeric =
    finiteNumber(
      value,
      fallback,
    );

  if (
    numeric >= 0 &&
    numeric <= 1
  ) {
    numeric *= 100;
  }

  return clamp(
    (numeric - 50) /
      50,
    -1.5,
    1.5,
  );
}

function signedUnit(
  value: unknown,
  fallback = 0,
) {
  let numeric =
    finiteNumber(
      value,
      fallback,
    );

  if (
    Math.abs(
      numeric,
    ) > 2
  ) {
    numeric /=
      100;
  }

  return clamp(
    numeric,
    -1.5,
    1.5,
  );
}

function riskUnit(
  value: unknown,
  fallback = 0,
) {
  let numeric =
    finiteNumber(
      value,
      fallback,
    );

  if (
    Math.abs(
      numeric,
    ) > 2
  ) {
    numeric /=
      100;
  }

  return clamp(
    numeric,
    0,
    1.5,
  );
}

function ratioUnit(
  value: unknown,
  scale: number,
  fallback = 0,
) {
  let numeric =
    finiteNumber(
      value,
      fallback,
    );

  if (
    Math.abs(
      numeric,
    ) > 2
  ) {
    numeric /=
      100;
  }

  return clamp(
    numeric / scale,
    -1.5,
    1.5,
  );
}

function volatilityUnit(
  value: unknown,
) {
  const numeric =
    Math.abs(
      finiteNumber(
        value,
        0,
      ),
    );

  if (
    numeric <= 1
  ) {
    return clamp(
      numeric / 0.12,
      0,
      1.5,
    );
  }

  return clamp(
    numeric / 12,
    0,
    1.5,
  );
}

function emptyFeatures():
  FeatureVector {
  return Object.fromEntries(
    FEATURE_NAMES.map(
      (feature) => [
        feature,
        0,
      ],
    ),
  ) as FeatureVector;
}

function completeFeatures(
  partial:
    Partial<
      FeatureVector
    >,
) {
  const features =
    emptyFeatures();

  for (
    const feature of
      FEATURE_NAMES
  ) {
    features[feature] =
      finiteNumber(
        partial[
          feature
        ],
        0,
      );
  }

  return features;
}

export function extractHorizonFeatures(
  snapshot: unknown,
) {
  const warnings:
    string[] = [];

  const features =
    completeFeatures({
      sentiment:
        scoreCentered(
          findValue(
            snapshot,
            [
              "sliceSentimentScore",
              "sentimentScore",
              "overallSentimentScore",
            ],
          ),
        ),

      sentimentConfidence:
        scoreCentered(
          findValue(
            snapshot,
            [
              "sentimentConfidence",
              "confidenceScore",
            ],
          ),
        ),

      dataQuality:
        scoreCentered(
          findValue(
            snapshot,
            [
              "dataQuality",
              "dataQualityScore",
              "qualityScore",
            ],
          ),
        ),

      trend:
        scoreCentered(
          findValue(
            snapshot,
            [
              "trendScore",
              "technicalTrendScore",
            ],
          ),
        ),

      momentum:
        scoreCentered(
          findValue(
            snapshot,
            [
              "momentumScore",
              "technicalMomentumScore",
            ],
          ),
        ),

      volume:
        scoreCentered(
          findValue(
            snapshot,
            [
              "volumeScore",
              "volumeConfirmationScore",
            ],
          ),
        ),

      volatility:
        volatilityUnit(
          findValue(
            snapshot,
            [
              "volatility20",
              "volatilityPercent",
              "volatility30d",
            ],
          ),
        ),

      revenueGrowth:
        ratioUnit(
          findValue(
            snapshot,
            [
              "quarterlyRevenueGrowthYOY",
              "revenueGrowth",
              "revenueGrowthYoy",
            ],
          ),
          0.3,
        ),

      earningsGrowth:
        ratioUnit(
          findValue(
            snapshot,
            [
              "quarterlyEarningsGrowthYOY",
              "earningsGrowth",
              "earningsGrowthYoy",
            ],
          ),
          0.35,
        ),

      operatingMargin:
        ratioUnit(
          findValue(
            snapshot,
            [
              "operatingMargin",
              "operatingMarginPercent",
            ],
          ),
          0.4,
        ),

      newsSentiment:
        signedUnit(
          findValue(
            snapshot,
            [
              "relevanceWeightedSentiment",
              "newsSentiment",
              "headlineSentiment",
            ],
          ),
        ),

      contradiction:
        riskUnit(
          findValue(
            snapshot,
            [
              "contradictionScore",
              "newsContradictionScore",
            ],
          ),
        ),

      macroAlignment:
        scoreCentered(
          findValue(
            snapshot,
            [
              "macroAlignmentScore",
              "alignmentScore",
            ],
          ),
        ),

      liquidity:
        scoreCentered(
          findValue(
            snapshot,
            [
              "liquidityScore",
              "macroLiquidityScore",
            ],
          ),
        ),

      stress:
        riskUnit(
          findValue(
            snapshot,
            [
              "stressScore",
              "macroStressScore",
            ],
          ),
        ),

      options:
        scoreCentered(
          findValue(
            snapshot,
            [
              "optionsScore",
              "optionsPositioningScore",
            ],
          ),
        ),

      dealerGamma:
        signedUnit(
          findValue(
            snapshot,
            [
              "dealerGammaScore",
              "dealerGamma",
            ],
          ),
        ),

      crowding:
        riskUnit(
          findValue(
            snapshot,
            [
              "crowdingScore",
              "crowdingRisk",
            ],
          ),
        ),

      shortInterest:
        riskUnit(
          findValue(
            snapshot,
            [
              "shortInterestScore",
              "shortInterest",
            ],
          ),
        ),

      environmentAlignment:
        scoreCentered(
          findValue(
            snapshot,
            [
              "environmentAlignmentScore",
              "environmentalAlignmentScore",
            ],
          ),
        ),

      disruption:
        riskUnit(
          findValue(
            snapshot,
            [
              "disruptionRisk",
              "environmentDisruptionRisk",
            ],
          ),
        ),

      supplyResilience:
        scoreCentered(
          findValue(
            snapshot,
            [
              "resilienceScore",
              "supplyChainResilienceScore",
            ],
          ),
        ),

      propagation:
        riskUnit(
          findValue(
            snapshot,
            [
              "propagationRisk",
              "supplyChainPropagationRisk",
            ],
          ),
        ),

      concentration:
        riskUnit(
          findValue(
            snapshot,
            [
              "concentrationRisk",
              "supplyChainConcentrationRisk",
            ],
          ),
        ),
    });

  if (
    features.dataQuality <
    -0.4
  ) {
    warnings.push(
      "Input data quality is below the preferred level.",
    );
  }

  if (
    features.volatility >
    1
  ) {
    warnings.push(
      "Elevated volatility reduces forecast confidence.",
    );
  }

  if (
    features.contradiction >
    0.5
  ) {
    warnings.push(
      "Elevated evidence contradiction was detected.",
    );
  }

  if (
    features.stress >
    0.6
  ) {
    warnings.push(
      "Macro stress is elevated.",
    );
  }

  return {
    features,
    warnings,
  };
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
  probability:
    number,
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

function dot(
  coefficients:
    FeatureVector,
  features:
    FeatureVector,
) {
  return FEATURE_NAMES.reduce(
    (
      total,
      feature,
    ) =>
      total +
      coefficients[
        feature
      ] *
        features[
          feature
        ],
    0,
  );
}

function priorArtifact(
  horizon:
    ForecastHorizon,
  trainedAt:
    string,
): HorizonModelArtifact {
  const specification =
    HORIZON_SPECS[
      horizon
    ];

  const probabilityCoefficients =
    completeFeatures(
      specification.weights,
    );

  const returnCoefficients =
    completeFeatures(
      Object.fromEntries(
        FEATURE_NAMES.map(
          (feature) => [
            feature,
            probabilityCoefficients[
              feature
            ] *
              0.36,
          ],
        ),
      ) as Partial<
        FeatureVector
      >,
    );

  return {
    horizon,

    label:
      specification.label,

    status:
      "PRIOR",

    sampleCount:
      0,

    trainingCount:
      0,

    validationCount:
      0,

    trainedAt,

    returnScale:
      specification.returnScale,

    probabilityIntercept:
      specification.probabilityIntercept,

    probabilityCoefficients,

    returnIntercept:
      0,

    returnCoefficients,

    validationMetrics: {
      sampleCount:
        0,

      brierScore:
        0,

      directionalAccuracyPercent:
        0,

      meanAbsoluteReturnError:
        0,

      averageForecastProbability:
        0,

      observedPositivePercent:
        0,
    },
  };
}

export function createPriorHorizonModelSuite():
  HorizonModelSuite {
  const trainedAt =
    new Date().toISOString();

  const artifacts =
    Object.fromEntries(
      FORECAST_HORIZONS.map(
        (horizon) => [
          horizon,
          priorArtifact(
            horizon,
            trainedAt,
          ),
        ],
      ),
    ) as Record<
      ForecastHorizon,
      HorizonModelArtifact
    >;

  return {
    schemaVersion:
      "slice-horizon-suite-2.0.0",

    modelFamily:
      MODEL_FAMILY,

    modelVersion:
      "slice-horizon-suite-prior-2.0.0",

    engineVersion:
      ENGINE_VERSION,

    calibrationVersion:
      CALIBRATION_VERSION,

    trainedAt,

    status:
      "PRIOR",

    totalEligibleSamples:
      0,

    artifacts,

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticPromotionEnabled:
        false,

      shadowOnly:
        true,
    },
  };
}

function metricSummary(
  rows:
    TrainingRow[],
  artifact:
    HorizonModelArtifact,
): TrainingMetrics {
  if (!rows.length) {
    return {
      sampleCount:
        0,

      brierScore:
        0,

      directionalAccuracyPercent:
        0,

      meanAbsoluteReturnError:
        0,

      averageForecastProbability:
        0,

      observedPositivePercent:
        0,
    };
  }

  const probabilities:
    number[] = [];

  const predictedReturns:
    number[] = [];

  for (
    const row of
      rows
  ) {
    probabilities.push(
      sigmoid(
        artifact.probabilityIntercept +
          dot(
            artifact.probabilityCoefficients,
            row.features,
          ),
      ),
    );

    predictedReturns.push(
      artifact.returnScale *
        (
          artifact.returnIntercept +
          dot(
            artifact.returnCoefficients,
            row.features,
          )
        ),
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
              rows[
                index
              ].positiveOutcome
                ? 1
                : 0
            )
          ) **
          2,
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
        rows[
          index
        ].positiveOutcome,
    ).length;

  const returnError =
    average(
      predictedReturns.map(
        (
          predicted,
          index,
        ) =>
          Math.abs(
            predicted -
              rows[
                index
              ]
                .realizedReturnPercent,
          ),
      ),
    );

  return {
    sampleCount:
      rows.length,

    brierScore:
      round(
        brierScore,
      ),

    directionalAccuracyPercent:
      round(
        (
          correct /
          rows.length
        ) *
          100,
        2,
      ),

    meanAbsoluteReturnError:
      round(
        returnError,
        4,
      ),

    averageForecastProbability:
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
          rows.filter(
            (row) =>
              row.positiveOutcome,
          ).length /
          rows.length
        ) *
          100,
        2,
      ),
  };
}

function trainArtifact(
  horizon:
    ForecastHorizon,
  rows:
    TrainingRow[],
  trainedAt:
    string,
): HorizonModelArtifact {
  const prior =
    priorArtifact(
      horizon,
      trainedAt,
    );

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
      ...prior,

      sampleCount:
        chronological.length,

      validationCount:
        chronological.length,

      validationMetrics:
        metricSummary(
          chronological,
          prior,
        ),
    };
  }

  const validationCount =
    Math.max(
      5,
      Math.floor(
        chronological.length *
          0.2,
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

  let probabilityIntercept =
    prior.probabilityIntercept;

  const probabilityCoefficients = {
    ...prior.probabilityCoefficients,
  };

  const logisticEpochs =
    140;

  const logisticRate =
    0.055;

  const logisticRegularization =
    0.015;

  for (
    let epoch = 0;
    epoch <
    logisticEpochs;
    epoch += 1
  ) {
    let interceptGradient =
      0;

    const gradients =
      emptyFeatures();

    for (
      const row of
        trainingRows
    ) {
      const probability =
        sigmoid(
          probabilityIntercept +
            dot(
              probabilityCoefficients,
              row.features,
            ),
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

      for (
        const feature of
          FEATURE_NAMES
      ) {
        gradients[
          feature
        ] +=
          error *
          row.features[
            feature
          ];
      }
    }

    probabilityIntercept -=
      logisticRate *
      (
        interceptGradient /
        trainingRows.length
      );

    for (
      const feature of
        FEATURE_NAMES
    ) {
      probabilityCoefficients[
        feature
      ] -=
        logisticRate *
        (
          gradients[
            feature
          ] /
            trainingRows.length +
          logisticRegularization *
            probabilityCoefficients[
              feature
            ]
        );
    }
  }

  let returnIntercept =
    prior.returnIntercept;

  const returnCoefficients = {
    ...prior.returnCoefficients,
  };

  const returnEpochs =
    140;

  const returnRate =
    0.035;

  const returnRegularization =
    0.02;

  for (
    let epoch = 0;
    epoch <
    returnEpochs;
    epoch += 1
  ) {
    let interceptGradient =
      0;

    const gradients =
      emptyFeatures();

    for (
      const row of
        trainingRows
    ) {
      const normalizedTarget =
        clamp(
          row.realizedReturnPercent /
            prior.returnScale,
          -3,
          3,
        );

      const prediction =
        returnIntercept +
        dot(
          returnCoefficients,
          row.features,
        );

      const error =
        prediction -
        normalizedTarget;

      interceptGradient +=
        error;

      for (
        const feature of
          FEATURE_NAMES
      ) {
        gradients[
          feature
        ] +=
          error *
          row.features[
            feature
          ];
      }
    }

    returnIntercept -=
      returnRate *
      (
        interceptGradient /
        trainingRows.length
      );

    for (
      const feature of
        FEATURE_NAMES
    ) {
      returnCoefficients[
        feature
      ] -=
        returnRate *
        (
          gradients[
            feature
          ] /
            trainingRows.length +
          returnRegularization *
            returnCoefficients[
              feature
            ]
        );
    }
  }

  const trained:
    HorizonModelArtifact = {
    ...prior,

    status:
      "TRAINED",

    sampleCount:
      chronological.length,

    trainingCount:
      trainingRows.length,

    validationCount:
      validationRows.length,

    probabilityIntercept:
      round(
        probabilityIntercept,
      ),

    probabilityCoefficients:
      completeFeatures(
        probabilityCoefficients,
      ),

    returnIntercept:
      round(
        returnIntercept,
      ),

    returnCoefficients:
      completeFeatures(
        returnCoefficients,
      ),
  };

  trained.validationMetrics =
    metricSummary(
      validationRows,
      trained,
    );

  return trained;
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

async function loadTrainingRows(
  userId: string,
) {
  const records =
    await prisma.intelligenceForecastHorizon.findMany(
      {
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
              inputJson:
                true,

              generatedAt:
                true,

              asOfAt:
                true,
            },
          },
        },
      },
    );

  const rows:
    TrainingRow[] = [];

  const exclusions:
    string[] = [];

  for (
    const record of
      records
  ) {
    const outcome =
      record.outcome;

    const horizon =
      asHorizon(
        record.horizon,
      );

    if (
      !outcome ||
      !horizon
    ) {
      continue;
    }

    if (
      record.forecastRun
        .generatedAt
        .getTime() >
      record.targetAt
        .getTime()
    ) {
      exclusions.push(
        `${record.id}: forecast generated after target`,
      );

      continue;
    }

    if (
      record.forecastRun
        .asOfAt
        .getTime() >
      record.forecastRun
        .generatedAt
        .getTime() +
        5 *
          60 *
          1000
    ) {
      exclusions.push(
        `${record.id}: evidence as-of timestamp was future-dated`,
      );

      continue;
    }

    if (
      outcome.observedAt
        .getTime() <
      record.targetAt
        .getTime()
    ) {
      exclusions.push(
        `${record.id}: observed outcome predates target`,
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
        `${record.id}: demo outcome excluded`,
      );

      continue;
    }

    const input =
      parseJson(
        record.forecastRun
          .inputJson,
      );

    const extracted =
      extractHorizonFeatures(
        input,
      );

    rows.push({
      horizon,

      targetAt:
        record.targetAt,

      features:
        extracted.features,

      positiveOutcome:
        outcome.positiveOutcome,

      realizedReturnPercent:
        outcome.realizedReturnPercent,
    });
  }

  return {
    rows,
    exclusions,
    sourceCount:
      records.length,
  };
}

function modelVersionForDate(
  date: Date,
) {
  return [
    MODEL_FAMILY,
    "2.0.0",
    date
      .toISOString()
      .replace(
        /[-:.TZ]/g,
        "",
      ),
  ].join(
    "-",
  );
}

export async function trainHorizonModelSuite(
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

  const trainedAt =
    new Date().toISOString();

  const grouped =
    new Map<
      ForecastHorizon,
      TrainingRow[]
    >();

  for (
    const horizon of
      FORECAST_HORIZONS
  ) {
    grouped.set(
      horizon,
      [],
    );
  }

  for (
    const row of
      loaded.rows
  ) {
    grouped.get(
      row.horizon,
    )?.push(
      row,
    );
  }

  const artifacts =
    Object.fromEntries(
      FORECAST_HORIZONS.map(
        (horizon) => [
          horizon,
          trainArtifact(
            horizon,
            grouped.get(
              horizon,
            ) ?? [],
            trainedAt,
          ),
        ],
      ),
    ) as Record<
      ForecastHorizon,
      HorizonModelArtifact
    >;

  const trainedCount =
    Object.values(
      artifacts,
    ).filter(
      (artifact) =>
        artifact.status ===
        "TRAINED",
    ).length;

  const modelVersion =
    modelVersionForDate(
      new Date(),
    );

  const suite:
    HorizonModelSuite = {
    schemaVersion:
      "slice-horizon-suite-2.0.0",

    modelFamily:
      MODEL_FAMILY,

    modelVersion,

    engineVersion:
      ENGINE_VERSION,

    calibrationVersion:
      CALIBRATION_VERSION,

    trainedAt,

    status:
      trainedCount > 0
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

      shadowOnly:
        true,
    },
  };

  const model =
    await prisma.intelligenceForecastModel.create(
      {
        data: {
          userId:
            input.userId,

          modelKey:
            modelVersion,

          displayName:
            `Independent Horizon Suite ${trainedAt.slice(
              0,
              10,
            )}`,

          description:
            "Eight horizon-specific probability and expected-return models trained from point-in-time settled Slice forecasts.",

          engineVersion:
            ENGINE_VERSION,

          modelVersion,

          calibrationVersion:
            CALIBRATION_VERSION,

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
                minimumSamplesPerHorizon:
                  MINIMUM_TRAINING_SAMPLES,

                requiresShadowEvaluation:
                  true,

                requiresHumanPromotion:
                  true,

                autonomousTradingEnabled:
                  false,
              },
              "{}",
            ),

          metadataJson:
            safeJson(
              {
                trainedAt,

                sourceRowCount:
                  loaded.sourceCount,

                eligibleRowCount:
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
              },
              "{}",
            ),
        },
      },
    );

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_HORIZON_MODELS_TRAINED",

    severity:
      trainedCount > 0
        ? "Info"
        : "Warning",

    area:
      "Market Intelligence",

    title:
      `Trained independent horizon model suite ${modelVersion}`,

    detail:
      `${loaded.rows.length} eligible settled outcomes were used. ` +
      `${trainedCount} of ${FORECAST_HORIZONS.length} horizons met the training threshold.`,

    metadata: {
      modelId:
        model.id,

      modelVersion,

      trainedHorizonCount:
        trainedCount,

      eligibleSampleCount:
        loaded.rows.length,

      exclusionCount:
        loaded.exclusions.length,

      shadowOnly:
        true,

      autonomousTradingEnabled:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    model,
    suite,
    exclusions:
      loaded.exclusions,
  };
}

function parseSuite(
  value: string,
): HorizonModelSuite | null {
  const parsed =
    parseJson(
      value,
    );

  if (
    !isRecord(
      parsed,
    ) ||
    parsed.schemaVersion !==
      "slice-horizon-suite-2.0.0" ||
    !isRecord(
      parsed.artifacts,
    )
  ) {
    return null;
  }

  try {
    return parsed as unknown as HorizonModelSuite;
  } catch {
    return null;
  }
}

export async function loadHorizonModelSuite(
  userId: string,
) {
  const candidates =
    await prisma.intelligenceForecastModel.findMany(
      {
        where: {
          userId,

          engineVersion:
            ENGINE_VERSION,

          status: {
            not:
              "Disabled",
          },
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

        take:
          25,
      },
    );

  const production =
    candidates.find(
      (candidate) =>
        candidate.status ===
        "Production",
    );

  const shadow =
    candidates.find(
      (candidate) =>
        candidate.status ===
          "Shadow" ||
        candidate.status ===
          "Candidate",
    );

  const selected =
    production ??
    shadow ??
    candidates[0];

  if (!selected) {
    return createPriorHorizonModelSuite();
  }

  return (
    parseSuite(
      selected.configurationJson,
    ) ??
    createPriorHorizonModelSuite()
  );
}

function categorySupports(
  features:
    FeatureVector,
) {
  return {
    technical:
      clamp(
        average([
          features.trend,
          features.momentum,
          features.volume,
          -0.35 *
            features.volatility,
        ]),
        -1.5,
        1.5,
      ),

    fundamental:
      clamp(
        average([
          features.revenueGrowth,
          features.earningsGrowth,
          features.operatingMargin,
        ]),
        -1.5,
        1.5,
      ),

    event:
      clamp(
        0.45 *
          features.sentiment +
          0.75 *
          features.newsSentiment -
          0.65 *
          features.contradiction,
        -1.5,
        1.5,
      ),

    macro:
      clamp(
        0.65 *
          features.macroAlignment +
          0.35 *
          features.liquidity -
          0.65 *
          features.stress,
        -1.5,
        1.5,
      ),

    positioning:
      clamp(
        0.5 *
          features.options +
          0.35 *
          features.dealerGamma -
          0.35 *
          features.crowding -
          0.2 *
          features.shortInterest,
        -1.5,
        1.5,
      ),

    structural:
      clamp(
        0.35 *
          features.environmentAlignment -
          0.3 *
          features.disruption +
          0.55 *
          features.supplyResilience -
          0.35 *
          features.propagation -
          0.25 *
          features.concentration,
        -1.5,
        1.5,
      ),
  };
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

export function scoreHorizonModelSuite(
  snapshot:
    unknown,
  suite:
    HorizonModelSuite,
): HorizonModelSuiteResult {
  const extracted =
    extractHorizonFeatures(
      snapshot,
    );

  const categorySupport =
    categorySupports(
      extracted.features,
    );

  const predictions =
    FORECAST_HORIZONS.map(
      (
        horizon,
      ): HorizonModelPrediction => {
        const artifact =
          suite.artifacts[
            horizon
          ] ??
          priorArtifact(
            horizon,
            suite.trainedAt,
          );

        const specification =
          HORIZON_SPECS[
            horizon
          ];

        const rawProbability =
          sigmoid(
            artifact.probabilityIntercept +
              dot(
                artifact.probabilityCoefficients,
                extracted.features,
              ),
          );

        const submodels:
          HorizonSubmodel[] =
          Object.entries(
            categorySupport,
          ).map(
            ([
              name,
              support,
            ]) => ({
              name,

              support:
                round(
                  support,
                  4,
                ),

              probability:
                round(
                  sigmoid(
                    support *
                      1.25,
                  ) *
                    100,
                  2,
                ),
            }),
          );

        const weightedSupport =
          (
            categorySupport.technical *
              specification.categoryWeights.technical +
            categorySupport.fundamental *
              specification.categoryWeights.fundamental +
            categorySupport.event *
              specification.categoryWeights.event +
            categorySupport.macro *
              specification.categoryWeights.macro +
            categorySupport.positioning *
              specification.categoryWeights.positioning +
            categorySupport.structural *
              specification.categoryWeights.structural
          );

        const ensembleProbability =
          sigmoid(
            weightedSupport *
              1.3,
          );

        const probability =
          clamp(
            rawProbability *
              0.8 +
              ensembleProbability *
                0.2,
            0.01,
            0.99,
          );

        const rawExpectedReturn =
          artifact.returnScale *
          (
            artifact.returnIntercept +
            dot(
              artifact.returnCoefficients,
              extracted.features,
            )
          );

        const expectedReturn =
          clamp(
            rawExpectedReturn *
              0.82 +
              weightedSupport *
                artifact.returnScale *
                0.18,
            -artifact.returnScale *
              3,
            artifact.returnScale *
              3,
          );

        const supports =
          submodels.map(
            (submodel) =>
              submodel.support,
          );

        const agreement =
          clamp(
            1 -
              standardDeviation(
                supports,
              ) /
                1.2,
            0,
            1,
          );

        const dataQuality =
          clamp(
            (
              extracted.features.dataQuality +
              1
            ) /
              2,
            0,
            1,
          );

        const sampleStrength =
          clamp(
            Math.log1p(
              artifact.sampleCount,
            ) /
              Math.log1p(
                500,
              ),
            0,
            1,
          );

        const riskPenalty =
          clamp(
            extracted.features.contradiction *
              0.25 +
              extracted.features.stress *
                0.2 +
              extracted.features.volatility *
                0.1,
            0,
            0.45,
          );

        const confidence =
          clamp(
            30 +
              dataQuality *
                30 +
              sampleStrength *
                22 +
              agreement *
                18 -
              riskPenalty *
                100,
            15,
            95,
          );

        const contributions =
          FEATURE_NAMES.map(
            (
              feature,
            ): HorizonFeatureContribution => ({
              feature,

              value:
                round(
                  extracted.features[
                    feature
                  ],
                  4,
                ),

              probabilityImpact:
                round(
                  artifact.probabilityCoefficients[
                    feature
                  ] *
                    extracted.features[
                      feature
                    ],
                  6,
                ),

              returnImpactPercent:
                round(
                  artifact.returnCoefficients[
                    feature
                  ] *
                    extracted.features[
                      feature
                    ] *
                    artifact.returnScale,
                  4,
                ),
            }),
          )
            .sort(
              (
                left,
                right,
              ) =>
                Math.abs(
                  right.probabilityImpact,
                ) -
                Math.abs(
                  left.probabilityImpact,
                ),
            )
            .slice(
              0,
              12,
            );

        return {
          horizon,

          label:
            artifact.label,

          modelVersion:
            suite.modelVersion,

          trainingStatus:
            artifact.status,

          sampleCount:
            artifact.sampleCount,

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

          agreement:
            round(
              agreement *
                100,
              2,
            ),

          returnScale:
            artifact.returnScale,

          submodels,

          contributions,
        };
      },
    );

  return {
    schemaVersion:
      "slice-horizon-predictions-2.0.0",

    generatedAt:
      new Date().toISOString(),

    modelVersion:
      suite.modelVersion,

    engineVersion:
      suite.engineVersion,

    calibrationVersion:
      suite.calibrationVersion,

    mode:
      "SHADOW",

    features:
      extracted.features,

    featureWarnings:
      extracted.warnings,

    predictions,

    safeguards: {
      autonomousTradingEnabled:
        false,

      replacesProductionForecast:
        false,

      automaticPromotionEnabled:
        false,

      decisionSupportOnly:
        true,
    },
  };
}

export async function persistShadowHorizonPredictions(
  input: {
    userId:
      string;

    forecastRunId:
      string;

    result:
      HorizonModelSuiteResult;
  },
) {
  for (
    const prediction of
      input.result
        .predictions
  ) {
    const eventKey = [
      "horizon-shadow-prediction",
      input.forecastRunId,
      input.result.modelVersion,
      prediction.horizon,
    ].join(
      ":",
    );

    const metadata = {
      forecastRunId:
        input.forecastRunId,

      modelVersion:
        input.result.modelVersion,

      engineVersion:
        input.result.engineVersion,

      calibrationVersion:
        input.result.calibrationVersion,

      horizon:
        prediction.horizon,

      label:
        prediction.label,

      probability:
        prediction.positiveReturnProbability,

      expectedReturnPercent:
        prediction.expectedReturnPercent,

      direction:
        prediction.direction,

      confidence:
        prediction.confidence,

      agreement:
        prediction.agreement,

      trainingStatus:
        prediction.trainingStatus,

      sampleCount:
        prediction.sampleCount,

      features:
        input.result.features,

      featureWarnings:
        input.result.featureWarnings,

      submodels:
        prediction.submodels,

      contributions:
        prediction.contributions,

      safeguards:
        input.result.safeguards,
    };

    await prisma.backendPlatformEvent.upsert(
      {
        where: {
          userId_eventKey: {
            userId:
              input.userId,

            eventKey,
          },
        },

        update: {
          eventType:
            SHADOW_EVENT_TYPE,

          area:
            "Market Intelligence",

          title:
            `${prediction.label} shadow-model prediction`,

          detail:
            `${prediction.direction} with ${prediction.positiveReturnProbability}% positive-return probability.`,

          severity:
            "Info",

          status:
            "Recorded",

          sourceType:
            "IntelligenceForecastRun",

          sourceId:
            input.forecastRunId,

          metadataJson:
            safeJson(
              metadata,
              "{}",
            ),
        },

        create: {
          userId:
            input.userId,

          eventKey,

          eventType:
            SHADOW_EVENT_TYPE,

          area:
            "Market Intelligence",

          title:
            `${prediction.label} shadow-model prediction`,

          detail:
            `${prediction.direction} with ${prediction.positiveReturnProbability}% positive-return probability.`,

          severity:
            "Info",

          status:
            "Recorded",

          sourceType:
            "IntelligenceForecastRun",

          sourceId:
            input.forecastRunId,

          metadataJson:
            safeJson(
              metadata,
              "{}",
            ),
        },
      },
    );
  }

  return {
    storedCount:
      input.result
        .predictions
        .length,

    modelVersion:
      input.result
        .modelVersion,
  };
}

type ParsedShadowPrediction = {
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

function parseShadowPrediction(
  event: {
    id:
      string;

    createdAt:
      Date;

    metadataJson:
      string;
  },
): ParsedShadowPrediction | null {
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

  const forecastRunId =
    String(
      parsed.forecastRunId ??
        "",
    ).trim();

  const modelVersion =
    String(
      parsed.modelVersion ??
        "",
    ).trim();

  if (
    !horizon ||
    !forecastRunId ||
    !modelVersion
  ) {
    return null;
  }

  return {
    eventId:
      event.id,

    createdAt:
      event.createdAt,

    forecastRunId,

    modelVersion,

    horizon,

    probability:
      finiteNumber(
        parsed.probability,
        50,
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

function evaluationMetrics(
  rows: Array<{
    prediction:
      ParsedShadowPrediction;

    positiveOutcome:
      boolean;

    realizedReturnPercent:
      number;
  }>,
) {
  if (!rows.length) {
    return {
      sampleCount:
        0,

      brierScore:
        0,

      directionalAccuracyPercent:
        0,

      meanAbsoluteReturnError:
        0,

      averageConfidence:
        0,
    };
  }

  const brierScore =
    average(
      rows.map(
        (row) => {
          const probability =
            clamp(
              row.prediction
                .probability /
                100,
              0.0001,
              0.9999,
            );

          const outcome =
            row.positiveOutcome
              ? 1
              : 0;

          return (
            probability -
            outcome
          ) **
            2;
        },
      ),
    );

  const correct =
    rows.filter(
      (row) => {
        const normalized =
          row.prediction
            .direction
            .toLowerCase();

        if (
          normalized ===
          "bullish"
        ) {
          return (
            row.realizedReturnPercent >
            0
          );
        }

        if (
          normalized ===
          "bearish"
        ) {
          return (
            row.realizedReturnPercent <
            0
          );
        }

        return (
          Math.abs(
            row.realizedReturnPercent,
          ) <= 0.5
        );
      },
    ).length;

  return {
    sampleCount:
      rows.length,

    brierScore:
      round(
        brierScore,
      ),

    directionalAccuracyPercent:
      round(
        (
          correct /
          rows.length
        ) *
          100,
        2,
      ),

    meanAbsoluteReturnError:
      round(
        average(
          rows.map(
            (row) =>
              Math.abs(
                row.prediction
                  .expectedReturnPercent -
                  row.realizedReturnPercent,
              ),
          ),
        ),
        4,
      ),

    averageConfidence:
      round(
        average(
          rows.map(
            (row) =>
              row.prediction
                .confidence,
          ),
        ),
        2,
      ),
  };
}

export async function evaluateShadowHorizonModels(
  input: {
    userId:
      string;

    modelVersion?:
      string;
  },
) {
  const events =
    await prisma.backendPlatformEvent.findMany(
      {
        where: {
          userId:
            input.userId,

          eventType:
            SHADOW_EVENT_TYPE,
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

          metadataJson:
            true,
        },
      },
    );

  const parsed =
    events
      .map(
        parseShadowPrediction,
      )
      .filter(
        (
          prediction,
        ): prediction is
          ParsedShadowPrediction =>
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
        parsed.map(
          (prediction) =>
            prediction.forecastRunId,
        ),
      ),
    );

  const horizons =
    runIds.length
      ? await prisma.intelligenceForecastHorizon.findMany(
          {
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
          },
        )
      : [];

  const outcomes =
    new Map<
      string,
      {
        positiveOutcome:
          boolean;

        realizedReturnPercent:
          number;
      }
    >();

  for (
    const horizon of
      horizons
  ) {
    if (
      !horizon.outcome
    ) {
      continue;
    }

    outcomes.set(
      `${horizon.forecastRunId}:${horizon.horizon}`,
      {
        positiveOutcome:
          horizon.outcome
            .positiveOutcome,

        realizedReturnPercent:
          horizon.outcome
            .realizedReturnPercent,
      },
    );
  }

  const matched =
    parsed
      .map(
        (prediction) => {
          const outcome =
            outcomes.get(
              `${prediction.forecastRunId}:${prediction.horizon}`,
            );

          return outcome
            ? {
                prediction,
                ...outcome,
              }
            : null;
        },
      )
      .filter(
        (
          row,
        ): row is
          NonNullable<
            typeof row
          > =>
          Boolean(
            row,
          ),
      );

  const byHorizon =
    FORECAST_HORIZONS.map(
      (horizon) => {
        const rows =
          matched.filter(
            (row) =>
              row.prediction
                .horizon ===
              horizon,
          );

        return {
          horizon,

          ...evaluationMetrics(
            rows,
          ),
        };
      },
    );

  return {
    generatedAt:
      new Date().toISOString(),

    modelVersion:
      input.modelVersion ??
      null,

    predictionCount:
      parsed.length,

    matchedOutcomeCount:
      matched.length,

    overall:
      evaluationMetrics(
        matched,
      ),

    byHorizon,
  };
}

export async function getHorizonModelOverview(
  userId: string,
) {
  const models =
    await prisma.intelligenceForecastModel.findMany(
      {
        where: {
          userId,

          engineVersion:
            ENGINE_VERSION,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          20,
      },
    );

  const activeSuite =
    await loadHorizonModelSuite(
      userId,
    );

  const evaluation =
    await evaluateShadowHorizonModels(
      {
        userId,

        modelVersion:
          activeSuite.modelVersion,
      },
    );

  return {
    generatedAt:
      new Date().toISOString(),

    activeSuite,

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

          metadata:
            parseJson(
              model.metadataJson,
            ),
        }),
      ),

    evaluation,

    safeguards: {
      autonomousTradingEnabled:
        false,

      automaticPromotionEnabled:
        false,

      activeMode:
        "SHADOW",

      replacesProductionForecast:
        false,
    },
  };
}