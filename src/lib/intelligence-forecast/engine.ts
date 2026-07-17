import {
  FORECAST_HORIZONS,
  type AgreementLevel,
  type CamelBehavioralFeatures,
  type DataQualityLevel,
  type ForecastDirection,
  type ForecastFactorContribution,
  type ForecastHorizon,
  type ForecastHorizonResult,
  type ForecastResponse,
  type MarketRegime,
  type MarketSnapshot,
  type SimulationPathSummary,
  type SimulationSummary,
} from "@/lib/intelligence-forecast/types";

const ENGINE_VERSION = "slice-scenario-engine-1.0.0";
const MODEL_VERSION = "slice-multihorizon-ensemble-1.0.0";
const CALIBRATION_VERSION = "slice-logistic-shrinkage-1.0.0";
const MAX_SIMULATION_WEIGHT = 0.12;

const FACTOR_NAMES = [
  "Slice Sentiment",
  "Technical",
  "Fundamental",
  "News",
  "Macro",
  "Options & Positioning",
  "Environmental",
  "Supply Chain",
] as const;

type CoreFactorName = (typeof FACTOR_NAMES)[number];

type CoreSignals = Record<CoreFactorName, number> & {
  riskPenalty: number;
  dataQuality: number;
  disagreement: number;
  technicalDrivers: string[];
  fundamentalDrivers: string[];
  newsDrivers: string[];
  macroDrivers: string[];
  positioningDrivers: string[];
  environmentalDrivers: string[];
  supplyChainDrivers: string[];
  contradictions: string[];
};

type HorizonConfig = {
  label: string;
  tradingDays: number;
  annualizationDays: number;
  returnScale: number;
  probabilitySlope: number;
  simulationWeight: number;
  weights: Record<CoreFactorName, number>;
};

const HORIZON_CONFIGS: Record<ForecastHorizon, HorizonConfig> = {
  "5-30m": {
    label: "5–30 minutes",
    tradingDays: 1 / 26,
    annualizationDays: 252,
    returnScale: 0.55,
    probabilitySlope: 1.85,
    simulationWeight: 0.025,
    weights: {
      "Slice Sentiment": 0.08,
      Technical: 0.36,
      Fundamental: 0.02,
      News: 0.2,
      Macro: 0.08,
      "Options & Positioning": 0.2,
      Environmental: 0.02,
      "Supply Chain": 0.04,
    },
  },

  intraday: {
    label: "Intraday",
    tradingDays: 1,
    annualizationDays: 252,
    returnScale: 1.15,
    probabilitySlope: 1.95,
    simulationWeight: 0.04,
    weights: {
      "Slice Sentiment": 0.1,
      Technical: 0.31,
      Fundamental: 0.04,
      News: 0.19,
      Macro: 0.1,
      "Options & Positioning": 0.2,
      Environmental: 0.02,
      "Supply Chain": 0.04,
    },
  },

  "1d": {
    label: "1 trading day",
    tradingDays: 1,
    annualizationDays: 252,
    returnScale: 1.5,
    probabilitySlope: 2.05,
    simulationWeight: 0.06,
    weights: {
      "Slice Sentiment": 0.13,
      Technical: 0.26,
      Fundamental: 0.07,
      News: 0.2,
      Macro: 0.11,
      "Options & Positioning": 0.17,
      Environmental: 0.02,
      "Supply Chain": 0.04,
    },
  },

  "2-5d": {
    label: "2–5 trading days",
    tradingDays: 5,
    annualizationDays: 252,
    returnScale: 3.2,
    probabilitySlope: 2.15,
    simulationWeight: 0.1,
    weights: {
      "Slice Sentiment": 0.15,
      Technical: 0.22,
      Fundamental: 0.1,
      News: 0.17,
      Macro: 0.12,
      "Options & Positioning": 0.16,
      Environmental: 0.03,
      "Supply Chain": 0.05,
    },
  },

  "1-4w": {
    label: "1–4 weeks",
    tradingDays: 20,
    annualizationDays: 252,
    returnScale: 6.2,
    probabilitySlope: 2.25,
    simulationWeight: 0.12,
    weights: {
      "Slice Sentiment": 0.15,
      Technical: 0.18,
      Fundamental: 0.17,
      News: 0.12,
      Macro: 0.15,
      "Options & Positioning": 0.11,
      Environmental: 0.04,
      "Supply Chain": 0.08,
    },
  },

  "1-3m": {
    label: "1–3 months",
    tradingDays: 63,
    annualizationDays: 252,
    returnScale: 11,
    probabilitySlope: 2.3,
    simulationWeight: 0.1,
    weights: {
      "Slice Sentiment": 0.13,
      Technical: 0.12,
      Fundamental: 0.25,
      News: 0.08,
      Macro: 0.18,
      "Options & Positioning": 0.08,
      Environmental: 0.06,
      "Supply Chain": 0.1,
    },
  },

  "3-12m": {
    label: "3–12 months",
    tradingDays: 189,
    annualizationDays: 252,
    returnScale: 19,
    probabilitySlope: 2.2,
    simulationWeight: 0.07,
    weights: {
      "Slice Sentiment": 0.1,
      Technical: 0.07,
      Fundamental: 0.34,
      News: 0.05,
      Macro: 0.22,
      "Options & Positioning": 0.05,
      Environmental: 0.07,
      "Supply Chain": 0.1,
    },
  },

  "1-3y": {
    label: "1–3 years",
    tradingDays: 504,
    annualizationDays: 252,
    returnScale: 34,
    probabilitySlope: 2,
    simulationWeight: 0.04,
    weights: {
      "Slice Sentiment": 0.07,
      Technical: 0.03,
      Fundamental: 0.42,
      News: 0.03,
      Macro: 0.23,
      "Options & Positioning": 0.03,
      Environmental: 0.08,
      "Supply Chain": 0.11,
    },
  },
};

type Participant = {
  name: string;
  capitalWeight: number;
  latency: number;
  noise: number;
  coefficients: Record<CoreFactorName, number>;
  liquiditySensitivity: number;
  volatilitySensitivity: number;
  socialSusceptibility: number;
};

const PARTICIPANTS: Participant[] = [
  {
    name: "Retail Momentum",
    capitalWeight: 0.08,
    latency: 0.15,
    noise: 0.38,
    liquiditySensitivity: 0.55,
    volatilitySensitivity: 0.7,
    socialSusceptibility: 0.9,
    coefficients: {
      "Slice Sentiment": 0.8,
      Technical: 1.25,
      Fundamental: 0.15,
      News: 1.1,
      Macro: 0.25,
      "Options & Positioning": 0.75,
      Environmental: 0.1,
      "Supply Chain": 0.15,
    },
  },

  {
    name: "Institutional Portfolio Managers",
    capitalWeight: 0.2,
    latency: 0.55,
    noise: 0.16,
    liquiditySensitivity: 0.65,
    volatilitySensitivity: 0.5,
    socialSusceptibility: 0.15,
    coefficients: {
      "Slice Sentiment": 0.45,
      Technical: 0.55,
      Fundamental: 1.15,
      News: 0.55,
      Macro: 0.9,
      "Options & Positioning": 0.5,
      Environmental: 0.45,
      "Supply Chain": 0.75,
    },
  },

  {
    name: "Value Investors",
    capitalWeight: 0.1,
    latency: 0.72,
    noise: 0.14,
    liquiditySensitivity: 0.25,
    volatilitySensitivity: -0.2,
    socialSusceptibility: 0.05,
    coefficients: {
      "Slice Sentiment": 0.25,
      Technical: -0.1,
      Fundamental: 1.4,
      News: 0.15,
      Macro: 0.55,
      "Options & Positioning": -0.05,
      Environmental: 0.35,
      "Supply Chain": 0.6,
    },
  },

  {
    name: "Quantitative Funds",
    capitalWeight: 0.15,
    latency: 0.1,
    noise: 0.12,
    liquiditySensitivity: 0.8,
    volatilitySensitivity: 0.65,
    socialSusceptibility: 0.05,
    coefficients: {
      "Slice Sentiment": 0.55,
      Technical: 1.15,
      Fundamental: 0.55,
      News: 0.45,
      Macro: 0.75,
      "Options & Positioning": 0.9,
      Environmental: 0.2,
      "Supply Chain": 0.25,
    },
  },

  {
    name: "Hedge Funds",
    capitalWeight: 0.13,
    latency: 0.25,
    noise: 0.2,
    liquiditySensitivity: 0.75,
    volatilitySensitivity: 0.55,
    socialSusceptibility: 0.12,
    coefficients: {
      "Slice Sentiment": 0.65,
      Technical: 0.85,
      Fundamental: 0.85,
      News: 0.8,
      Macro: 0.8,
      "Options & Positioning": 1.15,
      Environmental: 0.3,
      "Supply Chain": 0.55,
    },
  },

  {
    name: "Market Makers",
    capitalWeight: 0.09,
    latency: 0.03,
    noise: 0.1,
    liquiditySensitivity: 1.35,
    volatilitySensitivity: 1.2,
    socialSusceptibility: 0,
    coefficients: {
      "Slice Sentiment": 0.1,
      Technical: 0.45,
      Fundamental: 0.05,
      News: 0.35,
      Macro: 0.2,
      "Options & Positioning": 1.35,
      Environmental: 0.05,
      "Supply Chain": 0.05,
    },
  },

  {
    name: "Options Dealers",
    capitalWeight: 0.08,
    latency: 0.04,
    noise: 0.13,
    liquiditySensitivity: 1.1,
    volatilitySensitivity: 1.35,
    socialSusceptibility: 0,
    coefficients: {
      "Slice Sentiment": 0.15,
      Technical: 0.5,
      Fundamental: 0.05,
      News: 0.45,
      Macro: 0.25,
      "Options & Positioning": 1.55,
      Environmental: 0.05,
      "Supply Chain": 0.05,
    },
  },

  {
    name: "Short Sellers",
    capitalWeight: 0.07,
    latency: 0.3,
    noise: 0.2,
    liquiditySensitivity: 0.8,
    volatilitySensitivity: 0.75,
    socialSusceptibility: 0.08,
    coefficients: {
      "Slice Sentiment": -0.55,
      Technical: -0.75,
      Fundamental: -1,
      News: -0.8,
      Macro: -0.55,
      "Options & Positioning": -0.75,
      Environmental: -0.35,
      "Supply Chain": -0.6,
    },
  },

  {
    name: "Passive and Risk-Parity Funds",
    capitalWeight: 0.1,
    latency: 0.42,
    noise: 0.09,
    liquiditySensitivity: 0.9,
    volatilitySensitivity: 0.9,
    socialSusceptibility: 0,
    coefficients: {
      "Slice Sentiment": 0.05,
      Technical: 0.35,
      Fundamental: 0.15,
      News: 0.05,
      Macro: 1.05,
      "Options & Positioning": 0.4,
      Environmental: 0.15,
      "Supply Chain": 0.15,
    },
  },
];

function clamp(
  value: number,
  min: number,
  max: number,
) {
  if (!Number.isFinite(value)) return min;

  return Math.max(
    min,
    Math.min(max, value),
  );
}

function round(
  value: number,
  decimals = 2,
) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function scoreSignal(value: number) {
  return clamp(
    (value - 50) / 50,
    -1,
    1,
  );
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
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

function standardDeviation(
  values: number[],
) {
  if (values.length < 2) return 0;

  const mean = average(values);

  return Math.sqrt(
    average(
      values.map(
        (value) => (value - mean) ** 2,
      ),
    ),
  );
}

function quantile(
  sortedValues: number[],
  q: number,
) {
  if (!sortedValues.length) return 0;

  const position =
    clamp(q, 0, 1) *
    (sortedValues.length - 1);

  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;

  return (
    sortedValues[lower] * (1 - weight) +
    sortedValues[upper] * weight
  );
}

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let next = state;

    next = Math.imul(
      next ^ (next >>> 15),
      next | 1,
    );

    next ^=
      next +
      Math.imul(
        next ^ (next >>> 7),
        next | 61,
      );

    return (
      ((next ^ (next >>> 14)) >>> 0) /
      4_294_967_296
    );
  };
}

function gaussian(
  random: () => number,
) {
  const u = Math.max(
    random(),
    Number.EPSILON,
  );

  const v = Math.max(
    random(),
    Number.EPSILON,
  );

  return (
    Math.sqrt(-2 * Math.log(u)) *
    Math.cos(2 * Math.PI * v)
  );
}

function normalizedEntropy(
  counts: Map<string, number>,
  total: number,
) {
  if (
    total <= 1 ||
    counts.size <= 1
  ) {
    return 0;
  }

  let entropy = 0;

  for (const count of counts.values()) {
    const probability = count / total;

    entropy -=
      probability *
      Math.log(probability);
  }

  return clamp(
    entropy / Math.log(counts.size),
    0,
    1,
  );
}

function agreementLevel(
  disagreement: number,
): AgreementLevel {
  if (disagreement <= 12) {
    return "Very High";
  }

  if (disagreement <= 24) {
    return "High";
  }

  if (disagreement <= 42) {
    return "Moderate";
  }

  if (disagreement <= 62) {
    return "Low";
  }

  return "Very Low";
}

function dataQualityLevel(
  score: number,
): DataQualityLevel {
  if (score >= 85) {
    return "Very High";
  }

  if (score >= 70) {
    return "High";
  }

  if (score >= 50) {
    return "Moderate";
  }

  return "Low";
}

function directionFromProbability(
  probability: number,
): ForecastDirection {
  if (probability >= 56) {
    return "Bullish";
  }

  if (probability <= 44) {
    return "Bearish";
  }

  return "Neutral";
}

function regimeModifier(
  regime: MarketRegime,
  factor: CoreFactorName,
) {
  const table: Record<
    MarketRegime,
    Partial<
      Record<CoreFactorName, number>
    >
  > = {
    "Trending Bull": {
      Technical: 1.14,
      Macro: 1.06,
      "Options & Positioning": 1.05,
    },

    "Trending Bear": {
      Technical: 1.15,
      Macro: 1.08,
      "Options & Positioning": 1.08,
    },

    "Range Bound": {
      Technical: 0.82,
      Fundamental: 1.08,
      "Slice Sentiment": 0.92,
    },

    "High-Volatility Risk-Off": {
      Technical: 1.05,
      Macro: 1.25,
      "Options & Positioning": 1.25,
      Fundamental: 0.85,
    },

    "Low-Volatility Expansion": {
      Technical: 1.08,
      Fundamental: 1.05,
      Macro: 1.02,
    },

    "Liquidity Stress": {
      Macro: 1.3,
      "Options & Positioning": 1.25,
      Fundamental: 0.78,
      News: 1.1,
    },

    Recovery: {
      Technical: 1.05,
      Fundamental: 1.1,
      Macro: 1.12,
    },

    Unknown: {},
  };

  return (
    table[regime][factor] ?? 1
  );
}

function computeDataQuality(
  snapshot: MarketSnapshot,
) {
  const independentRatio =
    snapshot.slice.sourceCount
      ? clamp(
          snapshot.slice
            .independentSourceCount /
            snapshot.slice.sourceCount,
          0,
          1,
        )
      : 0;

  const sourceDepth = clamp(
    Math.log1p(
      snapshot.slice.sourceCount,
    ) / Math.log(51),
    0,
    1,
  );

  const duplicateRatio =
    snapshot.slice.sourceCount
      ? clamp(
          snapshot.slice.duplicateCount /
            snapshot.slice.sourceCount,
          0,
          1,
        )
      : 0;

  const coreCompleteness =
    [
      snapshot.price.current > 0,
      snapshot.technicals
        .volatility20 > 0,
      snapshot.technicals
        .trendScore !== 50,
      snapshot.news.articleCount > 0,
      snapshot.fundamentals
        .analystTargetPrice > 0,
      snapshot.positioning
        .impliedVolatilityPercent > 0,
    ].filter(Boolean).length / 6;

  return clamp(
    snapshot.slice.dataQuality *
      0.38 +
      snapshot.slice
        .sentimentConfidence *
        0.14 +
      independentRatio *
        100 *
        0.18 +
      sourceDepth *
        100 *
        0.11 +
      coreCompleteness *
        100 *
        0.14 -
      duplicateRatio *
        100 *
        0.08 -
      (snapshot.slice.staleData
        ? 22
        : 0),
    5,
    100,
  );
}

function computeCoreSignals(
  snapshot: MarketSnapshot,
): CoreSignals {
  const technicalTrend =
    scoreSignal(
      snapshot.technicals.trendScore,
    );

  const technicalMomentum =
    scoreSignal(
      snapshot.technicals
        .momentumScore,
    );

  const technicalVolume =
    scoreSignal(
      snapshot.technicals.volumeScore,
    );

  const riskControl =
    scoreSignal(
      snapshot.technicals.riskScore,
    );

  const rsiTrend = clamp(
    (snapshot.technicals.rsi14 - 50) /
      30,
    -1,
    1,
  );

  const oversoldReversal =
    snapshot.technicals.rsi14 < 35
      ? clamp(
          (35 -
            snapshot.technicals.rsi14) /
            20,
          0,
          1,
        )
      : 0;

  const technicalSignal = clamp(
    technicalTrend * 0.35 +
      technicalMomentum * 0.25 +
      technicalVolume * 0.15 +
      riskControl * 0.15 +
      rsiTrend * 0.07 +
      oversoldReversal * 0.03,
    -1,
    1,
  );

  const targetGap =
    snapshot.fundamentals
      .analystTargetPrice > 0
      ? clamp(
          (snapshot.fundamentals
            .analystTargetPrice -
            snapshot.price.current) /
            snapshot.price.current,
          -1,
          2,
        ) / 1.25
      : 0;

  const peSignal =
    snapshot.fundamentals.peRatio >
    0
      ? clamp(
          (30 -
            snapshot.fundamentals
              .peRatio) /
            30,
          -1,
          1,
        )
      : -0.08;

  const pegSignal =
    snapshot.fundamentals.pegRatio >
    0
      ? clamp(
          (2.25 -
            snapshot.fundamentals
              .pegRatio) /
            2.25,
          -1,
          1,
        )
      : 0;

  const marginSignal = clamp(
    (snapshot.fundamentals
      .profitMargin *
      1.5 +
      snapshot.fundamentals
        .operatingMargin) /
      0.75,
    -1,
    1,
  );

  const roeSignal = clamp(
    snapshot.fundamentals
      .returnOnEquity /
      0.35,
    -1,
    1,
  );

  const revenueSignal = clamp(
    snapshot.fundamentals
      .quarterlyRevenueGrowthYOY /
      0.3,
    -1,
    1,
  );

  const earningsSignal = clamp(
    snapshot.fundamentals
      .quarterlyEarningsGrowthYOY /
      0.4,
    -1,
    1,
  );

  const fundamentalSignal = clamp(
    targetGap * 0.22 +
      peSignal * 0.13 +
      pegSignal * 0.12 +
      marginSignal * 0.17 +
      roeSignal * 0.12 +
      revenueSignal * 0.12 +
      earningsSignal * 0.12,
    -1,
    1,
  );

  const sourceReliability =
    snapshot.news.sourceReliability /
    100;

  const novelty =
    snapshot.news.noveltyScore / 100;

  const eventMagnitude =
    snapshot.news.eventMagnitude / 100;

  const newsSignal = clamp(
    snapshot.news
      .relevanceWeightedSentiment *
      (0.45 +
        sourceReliability * 0.35 +
        novelty * 0.2) *
      (0.75 +
        eventMagnitude * 0.25),
    -1,
    1,
  );

  const macroSignal = clamp(
    scoreSignal(
      snapshot.macro.alignmentScore,
    ) *
      0.42 +
      scoreSignal(
        snapshot.macro.liquidityScore,
      ) *
        0.28 +
      clamp(
        snapshot.macro.surpriseScore /
          100,
        -1,
        1,
      ) *
        0.14 -
      (snapshot.macro.stressScore /
        100) *
        0.36,
    -1,
    1,
  );

  const gammaSignal = clamp(
    snapshot.positioning
      .dealerGammaScore /
      100,
    -1,
    1,
  );

  const skewSignal = clamp(
    snapshot.positioning.skewScore /
      100,
    -1,
    1,
  );

  const shortSqueezeOptionality =
    (snapshot.positioning
      .shortInterestScore /
      100) *
    Math.max(
      technicalMomentum,
      newsSignal,
      0,
    );

  const positioningSignal = clamp(
    scoreSignal(
      snapshot.positioning
        .optionsScore,
    ) *
      0.35 +
      gammaSignal * 0.22 +
      skewSignal * 0.13 +
      shortSqueezeOptionality *
        0.18 -
      (snapshot.positioning
        .crowdingScore /
        100) *
        0.18,
    -1,
    1,
  );

  const environmentalSignal = clamp(
    scoreSignal(
      snapshot.environment
        .alignmentScore,
    ) *
      0.5 -
      (snapshot.environment
        .disruptionRisk /
        100) *
        (0.4 +
          (snapshot.environment
            .geographicExposure /
            100) *
            0.6),
    -1,
    1,
  );

  const supplyChainSignal = clamp(
    scoreSignal(
      snapshot.supplyChain
        .resilienceScore,
    ) *
      0.55 -
      (snapshot.supplyChain
        .propagationRisk /
        100) *
        0.28 -
      (snapshot.supplyChain
        .concentrationRisk /
        100) *
        0.17,
    -1,
    1,
  );

  const sliceSignal = clamp(
    scoreSignal(
      snapshot.slice.sentimentScore,
    ) *
      (0.45 +
        (snapshot.slice
          .sentimentConfidence /
          100) *
          0.55),
    -1,
    1,
  );

  const dataQuality =
    computeDataQuality(snapshot);

  const factorValues = [
    sliceSignal,
    technicalSignal,
    fundamentalSignal,
    newsSignal,
    macroSignal,
    positioningSignal,
    environmentalSignal,
    supplyChainSignal,
  ];

  const disagreement = clamp(
    standardDeviation(factorValues) *
      100,
    0,
    100,
  );

  const riskPenalty = clamp(
    (snapshot.news
      .contradictionScore /
      100) *
      0.28 +
      (snapshot.macro.stressScore /
        100) *
        0.22 +
      (snapshot.positioning
        .crowdingScore /
        100) *
        0.12 +
      (snapshot.environment
        .disruptionRisk /
        100) *
        0.12 +
      (snapshot.supplyChain
        .propagationRisk /
        100) *
        0.12 +
      clamp(
        snapshot.technicals
          .volatility20 / 10,
        0,
        1,
      ) *
        0.08 +
      (snapshot.slice.staleData
        ? 0.25
        : 0) +
      ((100 - dataQuality) / 100) *
        0.18,
    0,
    1,
  );

  const technicalDrivers = [
    `Trend score ${round(
      snapshot.technicals.trendScore,
      0,
    )}/100`,

    `Momentum score ${round(
      snapshot.technicals
        .momentumScore,
      0,
    )}/100`,

    `RSI(14) ${round(
      snapshot.technicals.rsi14,
      1,
    )}`,

    `20-session realized volatility proxy ${round(
      snapshot.technicals
        .volatility20,
      2,
    )}%`,
  ];

  const fundamentalDrivers = [
    `Revenue growth ${round(
      snapshot.fundamentals
        .quarterlyRevenueGrowthYOY *
        100,
      1,
    )}%`,

    `Earnings growth ${round(
      snapshot.fundamentals
        .quarterlyEarningsGrowthYOY *
        100,
      1,
    )}%`,

    `Operating margin ${round(
      snapshot.fundamentals
        .operatingMargin *
        100,
      1,
    )}%`,

    snapshot.fundamentals
      .analystTargetPrice > 0
      ? `Analyst target gap ${round(
          targetGap * 125 * 100,
          1,
        )}%`
      : "No analyst target price supplied",
  ];

  const newsDrivers = [
    `Relevance-weighted news sentiment ${round(
      snapshot.news
        .relevanceWeightedSentiment,
      3,
    )}`,

    `Novelty ${round(
      snapshot.news.noveltyScore,
      0,
    )}/100`,

    `Source reliability ${round(
      snapshot.news.sourceReliability,
      0,
    )}/100`,

    `Event magnitude ${round(
      snapshot.news.eventMagnitude,
      0,
    )}/100`,
  ];

  const macroDrivers = [
    `Regime: ${snapshot.macro.regime}`,

    `Macro alignment ${round(
      snapshot.macro.alignmentScore,
      0,
    )}/100`,

    `Liquidity ${round(
      snapshot.macro.liquidityScore,
      0,
    )}/100`,

    `Macro stress ${round(
      snapshot.macro.stressScore,
      0,
    )}/100`,
  ];

  const positioningDrivers = [
    `Options signal ${round(
      snapshot.positioning
        .optionsScore,
      0,
    )}/100`,

    `Dealer gamma ${round(
      snapshot.positioning
        .dealerGammaScore,
      0,
    )}/100`,

    `Crowding ${round(
      snapshot.positioning
        .crowdingScore,
      0,
    )}/100`,

    `Short-interest pressure ${round(
      snapshot.positioning
        .shortInterestScore,
      0,
    )}/100`,
  ];

  const environmentalDrivers = [
    `Environmental alignment ${round(
      snapshot.environment
        .alignmentScore,
      0,
    )}/100`,

    `Physical disruption risk ${round(
      snapshot.environment
        .disruptionRisk,
      0,
    )}/100`,

    `Geographic exposure ${round(
      snapshot.environment
        .geographicExposure,
      0,
    )}/100`,
  ];

  const supplyChainDrivers = [
    `Supply-chain resilience ${round(
      snapshot.supplyChain
        .resilienceScore,
      0,
    )}/100`,

    `Propagation risk ${round(
      snapshot.supplyChain
        .propagationRisk,
      0,
    )}/100`,

    `Concentration risk ${round(
      snapshot.supplyChain
        .concentrationRisk,
      0,
    )}/100`,
  ];

  const contradictions = [
    ...(snapshot.news
      .contradictionScore >= 55
      ? [
          "Material contradiction exists across news, management, analyst, or market evidence.",
        ]
      : []),

    ...(Math.sign(technicalSignal) !==
      Math.sign(fundamentalSignal) &&
    Math.abs(
      technicalSignal -
        fundamentalSignal,
    ) > 0.65
      ? [
          "Technical and fundamental signals materially disagree.",
        ]
      : []),

    ...(Math.sign(newsSignal) !==
      Math.sign(positioningSignal) &&
    Math.abs(
      newsSignal -
        positioningSignal,
    ) > 0.65
      ? [
          "News direction conflicts with options and positioning evidence.",
        ]
      : []),

    ...(snapshot.slice.staleData
      ? [
          "One or more required observations are stale.",
        ]
      : []),
  ];

  return {
    "Slice Sentiment": sliceSignal,
    Technical: technicalSignal,
    Fundamental: fundamentalSignal,
    News: newsSignal,
    Macro: macroSignal,
    "Options & Positioning":
      positioningSignal,
    Environmental:
      environmentalSignal,
    "Supply Chain":
      supplyChainSignal,
    riskPenalty,
    dataQuality,
    disagreement,
    technicalDrivers,
    fundamentalDrivers,
    newsDrivers,
    macroDrivers,
    positioningDrivers,
    environmentalDrivers,
    supplyChainDrivers,
    contradictions,
  };
}

function dominantNarrativeFromSignals(
  signals: CoreSignals,
) {
  const candidates: Array<
    [CoreFactorName, number]
  > = FACTOR_NAMES.map(
    (factor) => [
      factor,
      signals[factor],
    ],
  );

  candidates.sort(
    (left, right) =>
      Math.abs(right[1]) -
      Math.abs(left[1]),
  );

  const [factor, value] =
    candidates[0];

  const direction =
    value >= 0
      ? "supportive"
      : "adverse";

  return `${factor} is the dominant ${direction.toLowerCase()} narrative`;
}

function simulateMarket(
  snapshot: MarketSnapshot,
  signals: CoreSignals,
  camel: CamelBehavioralFeatures,
): SimulationSummary {
  if (!snapshot.simulation.enabled) {
    return {
      enabled: false,
      engineVersion: ENGINE_VERSION,
      seed: snapshot.simulation.seed,
      paths: 0,
      medianOutcomePercent: 0,
      bullishTailPercent: 0,
      bearishTailPercent: 0,
      probabilityPositive: 50,
      agentDisagreement: 100,
      pathEntropy: 100,
      narrativeConcentration: 0,
      reversalFrequency: 0,
      liquidityStressFrequency: 0,
      contagionBreadth: 0,
      shortCoveringFrequency: 0,
      dominantNarrative:
        "Simulation disabled",
      dominantBuyers: [],
      dominantSellers: [],
      knownLimitations: [
        "Simulation was disabled for this request.",
      ],
      samplePaths: [],
    };
  }

  const random = mulberry32(
    snapshot.simulation.seed,
  );

  const pathReturns: number[] = [];
  const pathDisagreements: number[] =
    [];

  const paths:
    SimulationPathSummary[] = [];

  const narrativeCounts =
    new Map<string, number>();

  const buyerCounts =
    new Map<string, number>();

  const sellerCounts =
    new Map<string, number>();

  let reversals = 0;
  let liquidityStressEvents = 0;
  let contagionTotal = 0;
  let shortCoveringEvents = 0;

  const coreComposite = average(
    FACTOR_NAMES.map(
      (factor) => signals[factor],
    ),
  );

  const baseVolatility = clamp(
    Math.max(
      snapshot.technicals
        .volatility20,

      snapshot.positioning
        .impliedVolatilityPercent > 0
        ? snapshot.positioning
            .impliedVolatilityPercent /
          Math.sqrt(252)
        : 0,

      0.65,
    ),
    0.5,
    18,
  );

  const dominantNarrative =
    camel.status === "completed" &&
    camel.dominantNarrative
      ? camel.dominantNarrative
      : dominantNarrativeFromSignals(
          signals,
        );

  for (
    let pathIndex = 0;
    pathIndex <
    snapshot.simulation.paths;
    pathIndex += 1
  ) {
    const informationAccuracy =
      clamp(
        0.72 +
          gaussian(random) * 0.13,
        0.25,
        1,
      );

    const informationDelay = clamp(
      0.22 +
        Math.abs(gaussian(random)) *
          0.24,
      0,
      1,
    );

    const socialInfluence = clamp(
      0.3 +
        gaussian(random) * 0.2,
      0,
      1,
    );

    const liquidityShock = clamp(
      (snapshot.macro.stressScore /
        100) *
        0.55 +
        (snapshot.positioning
          .crowdingScore /
          100) *
          0.2 +
        Math.abs(gaussian(random)) *
          0.22,
      0,
      1.5,
    );

    const volatilityShock = clamp(
      Math.abs(gaussian(random)) *
        0.45 +
        (snapshot.positioning
          .impliedVolatilityPercent /
          100) *
          0.3,
      0,
      2,
    );

    const participantReactions: Array<{
      participant: Participant;
      reaction: number;
    }> = [];

    for (const participant of PARTICIPANTS) {
      let reaction = 0;

      for (const factor of FACTOR_NAMES) {
        reaction +=
          signals[factor] *
          participant
            .coefficients[factor] *
          regimeModifier(
            snapshot.macro.regime,
            factor,
          );
      }

      reaction /= FACTOR_NAMES.length;

      reaction *=
        informationAccuracy;

      reaction *=
        1 -
        informationDelay *
          participant.latency *
          0.55;

      reaction +=
        socialInfluence *
        participant
          .socialSusceptibility *
        scoreSignal(
          snapshot.slice
            .sentimentScore,
        ) *
        0.35;

      reaction -=
        liquidityShock *
        participant
          .liquiditySensitivity *
        0.16;

      reaction -=
        volatilityShock *
        Math.max(
          participant
            .volatilitySensitivity,
          0,
        ) *
        0.07;

      reaction +=
        gaussian(random) *
        participant.noise;

      reaction = clamp(
        reaction,
        -1.75,
        1.75,
      );

      participantReactions.push({
        participant,
        reaction,
      });
    }

    const weightedDemand =
      participantReactions.reduce(
        (sum, item) =>
          sum +
          item.reaction *
            item.participant
              .capitalWeight,
        0,
      );

    const reactionValues =
      participantReactions.map(
        (item) => item.reaction,
      );

    const pathDisagreement = clamp(
      standardDeviation(
        reactionValues,
      ) / 1.5,
      0,
      1,
    );

    const topBuyer = [
      ...participantReactions,
    ].sort(
      (a, b) =>
        b.reaction - a.reaction,
    )[0];

    const topSeller = [
      ...participantReactions,
    ].sort(
      (a, b) =>
        a.reaction - b.reaction,
    )[0];

    const shortCovering =
      snapshot.positioning
        .shortInterestScore >= 55 &&
      weightedDemand > 0.12 &&
      snapshot.positioning
        .dealerGammaScore < 15;

    const contagion = clamp(
      Math.abs(weightedDemand) *
        0.45 +
        (snapshot.supplyChain
          .propagationRisk /
          100) *
          0.3 +
        (snapshot.environment
          .disruptionRisk /
          100) *
          0.12 +
        socialInfluence * 0.13,
      0,
      1,
    );

    const liquidityStress = clamp(
      liquidityShock * 0.55 +
        pathDisagreement * 0.2 +
        volatilityShock * 0.25,
      0,
      1,
    );

    const eventImpulse =
      signals.News *
      (0.45 +
        (snapshot.news
          .eventMagnitude /
          100) *
          0.55) *
      informationAccuracy;

    const reversalOccurred =
      Math.abs(eventImpulse) >
        0.12 &&
      Math.sign(eventImpulse) !==
        Math.sign(weightedDemand);

    const shortCoveringBoost =
      shortCovering
        ? (snapshot.positioning
            .shortInterestScore /
            100) *
          (0.4 +
            liquidityStress * 0.4)
        : 0;

    const pathReturn =
      coreComposite * 1.55 +
      weightedDemand *
        (1.9 +
          liquidityStress * 1.2) +
      shortCoveringBoost +
      gaussian(random) *
        baseVolatility *
        (0.28 +
          liquidityStress * 0.16) -
      signals.riskPenalty * 0.9;

    const narrative =
      reversalOccurred
        ? `${dominantNarrative}; reaction reversal emerges`
        : shortCovering
          ? `${dominantNarrative}; short-covering feedback loop`
          : dominantNarrative;

    pathReturns.push(pathReturn);

    pathDisagreements.push(
      pathDisagreement,
    );

    narrativeCounts.set(
      narrative,
      (narrativeCounts.get(
        narrative,
      ) ?? 0) + 1,
    );

    buyerCounts.set(
      topBuyer.participant.name,
      (buyerCounts.get(
        topBuyer.participant.name,
      ) ?? 0) + 1,
    );

    sellerCounts.set(
      topSeller.participant.name,
      (sellerCounts.get(
        topSeller.participant.name,
      ) ?? 0) + 1,
    );

    if (reversalOccurred) {
      reversals += 1;
    }

    if (liquidityStress >= 0.62) {
      liquidityStressEvents += 1;
    }

    if (shortCovering) {
      shortCoveringEvents += 1;
    }

    contagionTotal += contagion;

    if (
      paths.length < 20 &&
      (pathIndex < 5 ||
        pathIndex %
          Math.max(
            1,
            Math.floor(
              snapshot.simulation.paths /
                15,
            ),
          ) ===
          0)
    ) {
      paths.push({
        pathId: pathIndex + 1,

        returnPercent: round(
          pathReturn,
          2,
        ),

        netDemand: round(
          weightedDemand,
          3,
        ),

        liquidityStress: round(
          liquidityStress * 100,
          1,
        ),

        contagion: round(
          contagion * 100,
          1,
        ),

        reversalOccurred,

        dominantNarrative:
          narrative,

        dominantBuyer:
          topBuyer.participant.name,

        dominantSeller:
          topSeller.participant.name,
      });
    }
  }

  const sortedReturns = [
    ...pathReturns,
  ].sort((a, b) => a - b);

  const sortedNarratives = [
    ...narrativeCounts.entries(),
  ].sort(
    (a, b) => b[1] - a[1],
  );

  const dominantNarrativeCount =
    sortedNarratives[0]?.[1] ?? 0;

  const topBuyers = [
    ...buyerCounts.entries(),
  ]
    .sort(
      (a, b) => b[1] - a[1],
    )
    .slice(0, 3)
    .map(([name]) => name);

  const topSellers = [
    ...sellerCounts.entries(),
  ]
    .sort(
      (a, b) => b[1] - a[1],
    )
    .slice(0, 3)
    .map(([name]) => name);

  return {
    enabled: true,
    engineVersion: ENGINE_VERSION,
    seed: snapshot.simulation.seed,
    paths: snapshot.simulation.paths,

    medianOutcomePercent: round(
      quantile(
        sortedReturns,
        0.5,
      ),
      2,
    ),

    bullishTailPercent: round(
      quantile(
        sortedReturns,
        0.9,
      ),
      2,
    ),

    bearishTailPercent: round(
      quantile(
        sortedReturns,
        0.1,
      ),
      2,
    ),

    probabilityPositive: round(
      (pathReturns.filter(
        (value) => value > 0,
      ).length /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    agentDisagreement: round(
      average(pathDisagreements) *
        100,
      1,
    ),

    pathEntropy: round(
      normalizedEntropy(
        narrativeCounts,
        pathReturns.length,
      ) * 100,
      1,
    ),

    narrativeConcentration: round(
      (dominantNarrativeCount /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    reversalFrequency: round(
      (reversals /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    liquidityStressFrequency: round(
      (liquidityStressEvents /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    contagionBreadth: round(
      (contagionTotal /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    shortCoveringFrequency: round(
      (shortCoveringEvents /
        Math.max(
          pathReturns.length,
          1,
        )) *
        100,
      1,
    ),

    dominantNarrative:
      sortedNarratives[0]?.[0] ??
      dominantNarrative,

    dominantBuyers: topBuyers,
    dominantSellers: topSellers,

    knownLimitations: [
      "Participant behavior is synthetic and does not reveal actual institutional positions.",
      "Price impact is a controlled scenario proxy, not an exchange matching-engine reconstruction.",
      "Simulation features receive capped forecast weight and must prove out-of-sample value before promotion.",
      ...(camel.limitations ?? []),
    ],

    samplePaths: paths,
  };
}

function simulationSignal(
  simulation: SimulationSummary,
  camel: CamelBehavioralFeatures,
) {
  if (!simulation.enabled) {
    return 0;
  }

  const distributionSignal = clamp(
    (simulation.probabilityPositive -
      50) /
      50,
    -1,
    1,
  );

  const medianSignal = clamp(
    simulation.medianOutcomePercent /
      5,
    -1,
    1,
  );

  const camelSignal =
    camel.status === "completed"
      ? clamp(
          camel.directionalPressure,
          -1,
          1,
        )
      : 0;

  return clamp(
    distributionSignal * 0.5 +
      medianSignal * 0.3 +
      camelSignal * 0.2,
    -1,
    1,
  );
}

function contributionExplanation(
  factor: CoreFactorName,
  value: number,
) {
  const direction =
    value > 0.08
      ? "supports upside"
      : value < -0.08
        ? "supports downside"
        : "is neutral";

  const descriptions: Record<
    CoreFactorName,
    string
  > = {
    "Slice Sentiment":
      "The existing Slice Sentiment Score, confidence, and evidence quality",

    Technical:
      "Regime-aware trend, momentum, volume, RSI, volatility, and risk-control features",

    Fundamental:
      "Valuation, margins, growth, earnings quality, return on equity, and target-price gap",

    News:
      "Reliability-, novelty-, relevance-, and event-magnitude-adjusted news sentiment",

    Macro:
      "Regime, liquidity, economic surprise, alignment, and systemic stress",

    "Options & Positioning":
      "Options tone, gamma, skew, crowding, and short-interest optionality",

    Environmental:
      "Physical disruption risk and geographic exposure",

    "Supply Chain":
      "Resilience, concentration, and propagation risk",
  };

  return `${descriptions[factor]} ${direction}.`;
}

function buildContributions(
  signals: CoreSignals,
  config: HorizonConfig,
  simulationFeature: number,
): ForecastFactorContribution[] {
  const contributions:
    ForecastFactorContribution[] =
    FACTOR_NAMES.map((factor) => {
      const regimeAdjustedWeight =
        config.weights[factor];

      const contribution =
        signals[factor] *
        regimeAdjustedWeight;

      return {
        factor,

        normalizedSignal: round(
          signals[factor],
          4,
        ),

        weight: round(
          regimeAdjustedWeight,
          4,
        ),

        contribution: round(
          contribution,
          4,
        ),

        explanation:
          contributionExplanation(
            factor,
            signals[factor],
          ),
      };
    });

  contributions.push({
    factor: "Simulation",

    normalizedSignal: round(
      simulationFeature,
      4,
    ),

    weight: round(
      config.simulationWeight,
      4,
    ),

    contribution: round(
      simulationFeature *
        config.simulationWeight,
      4,
    ),

    explanation:
      "Structured simulation distribution, disagreement, propagation, and CAMEL behavioral features; influence is capped.",
  });

  contributions.push({
    factor: "Risk Penalty",

    normalizedSignal: round(
      -signals.riskPenalty,
      4,
    ),

    weight: 1,

    contribution: round(
      -signals.riskPenalty * 0.16,
      4,
    ),

    explanation:
      "Contradictions, stale inputs, macro stress, crowding, disruption, volatility, and weak data quality reduce conviction.",
  });

  return contributions.sort(
    (left, right) =>
      Math.abs(right.contribution) -
      Math.abs(left.contribution),
  );
}

function horizonVolatility(
  snapshot: MarketSnapshot,
  config: HorizonConfig,
  riskPenalty: number,
) {
  const dailyRealized = clamp(
    snapshot.technicals
      .volatility20,
    0.35,
    20,
  );

  const dailyImplied =
    snapshot.positioning
      .impliedVolatilityPercent > 0
      ? snapshot.positioning
          .impliedVolatilityPercent /
        Math.sqrt(
          config.annualizationDays,
        )
      : dailyRealized;

  const blendedDaily =
    dailyRealized * 0.58 +
    dailyImplied * 0.42;

  const horizonScale = Math.sqrt(
    Math.max(
      config.tradingDays,
      1 / 26,
    ),
  );

  return clamp(
    blendedDaily *
      horizonScale *
      (1 + riskPenalty * 0.35),
    0.2,
    120,
  );
}

function primaryUncertainty(
  snapshot: MarketSnapshot,
  signals: CoreSignals,
  simulation: SimulationSummary,
  camel: CamelBehavioralFeatures,
) {
  const candidates: Array<
    [number, string]
  > = [
    [
      signals.disagreement,
      "Material disagreement across fundamental, technical, macro, and positioning models.",
    ],

    [
      snapshot.news
        .contradictionScore,
      "Conflicting claims or evidence origins remain unresolved.",
    ],

    [
      simulation.agentDisagreement,
      "Simulated participant classes react differently to the same evidence.",
    ],

    [
      simulation
        .liquidityStressFrequency,
      "Outcome sensitivity to liquidity and volatility is elevated.",
    ],

    [
      snapshot.supplyChain
        .propagationRisk,
      "Second- and third-order supply-chain propagation is uncertain.",
    ],

    [
      snapshot.environment
        .disruptionRisk,
      "Physical-world disruption paths are uncertain.",
    ],

    [
      camel.reversalRisk,
      "The CAMEL red-team workflow identified narrative-reversal risk.",
    ],
  ];

  if (snapshot.slice.staleData) {
    candidates.push([
      100,
      "One or more observations are stale; confidence is deliberately reduced.",
    ]);
  }

  return (
    candidates.sort(
      (left, right) =>
        right[0] - left[0],
    )[0]?.[1] ??
    "Markets remain stochastic and can move outside the modeled distribution."
  );
}

function buildHorizonResult(
  horizon: ForecastHorizon,
  snapshot: MarketSnapshot,
  signals: CoreSignals,
  simulation: SimulationSummary,
  camel: CamelBehavioralFeatures,
): ForecastHorizonResult {
  const config =
    HORIZON_CONFIGS[horizon];

  const simFeature =
    simulationSignal(
      simulation,
      camel,
    );

  const weightedCore =
    FACTOR_NAMES.reduce(
      (sum, factor) => {
        return (
          sum +
          signals[factor] *
            config.weights[factor] *
            regimeModifier(
              snapshot.macro.regime,
              factor,
            )
        );
      },
      0,
    );

  const simulationWeight =
    Math.min(
      config.simulationWeight,
      MAX_SIMULATION_WEIGHT,
    );

  const riskAdjustedSignal =
    clamp(
      weightedCore +
        simFeature *
          simulationWeight -
        signals.riskPenalty *
          0.16,
      -1.5,
      1.5,
    );

  const qualityMultiplier =
    clamp(
      0.45 +
        (signals.dataQuality /
          100) *
          0.55,
      0.45,
      1,
    );

  const disagreementPenalty =
    clamp(
      1 -
        signals.disagreement /
          175,
      0.45,
      1,
    );

  const rawProbability =
    sigmoid(
      riskAdjustedSignal *
        config.probabilitySlope,
    );

  const shrinkage =
    qualityMultiplier *
    disagreementPenalty;

  const calibratedProbability =
    0.5 +
    (rawProbability - 0.5) *
      shrinkage;

  const probabilityPercent =
    clamp(
      calibratedProbability * 100,
      2,
      98,
    );

  const volatilityPercent =
    horizonVolatility(
      snapshot,
      config,
      signals.riskPenalty,
    );

  const expectedReturnPercent =
    clamp(
      Math.tanh(
        riskAdjustedSignal,
      ) * config.returnScale,
      -volatilityPercent * 1.35,
      volatilityPercent * 1.35,
    );

  const intervalMultiplier =
    1.12 +
    signals.riskPenalty * 0.65 +
    signals.disagreement / 200;

  const intervalHalfWidth =
    volatilityPercent *
    intervalMultiplier;

  const rangeLow =
    expectedReturnPercent -
    intervalHalfWidth;

  const rangeHigh =
    expectedReturnPercent +
    intervalHalfWidth;

  const expectedPrice =
    snapshot.price.current *
    (1 +
      expectedReturnPercent / 100);

  const priceLow = Math.max(
    0,
    snapshot.price.current *
      (1 + rangeLow / 100),
  );

  const priceHigh = Math.max(
    priceLow,
    snapshot.price.current *
      (1 + rangeHigh / 100),
  );

  const simulationDisagreement =
    clamp(
      simulation.agentDisagreement *
        0.55 +
        simulation.pathEntropy *
          0.25 +
        Math.abs(
          simulation
            .probabilityPositive -
            probabilityPercent,
        ) *
          0.45,
      0,
      100,
    );

  const confidence = clamp(
    signals.dataQuality * 0.52 +
      (100 -
        signals.disagreement) *
        0.22 +
      (100 -
        simulationDisagreement) *
        0.12 +
      snapshot.slice
        .sentimentConfidence *
        0.14 -
      signals.riskPenalty * 22,
    5,
    95,
  );

  return {
    horizon,
    label: config.label,

    direction:
      directionFromProbability(
        probabilityPercent,
      ),

    positiveReturnProbability:
      round(
        probabilityPercent,
        1,
      ),

    expectedReturnPercent: round(
      expectedReturnPercent,
      2,
    ),

    expectedPrice: round(
      expectedPrice,
      2,
    ),

    expectedRangePercent: {
      low: round(rangeLow, 2),
      high: round(rangeHigh, 2),
    },

    expectedPriceRange: {
      low: round(priceLow, 2),
      high: round(priceHigh, 2),
    },

    volatilityPercent: round(
      volatilityPercent,
      2,
    ),

    confidence: round(
      confidence,
      1,
    ),

    modelAgreement:
      agreementLevel(
        signals.disagreement,
      ),

    simulationAgreement:
      agreementLevel(
        simulationDisagreement,
      ),

    dataQuality:
      dataQualityLevel(
        signals.dataQuality,
      ),

    modelDisagreement: round(
      signals.disagreement,
      1,
    ),

    primaryUncertainty:
      primaryUncertainty(
        snapshot,
        signals,
        simulation,
        camel,
      ),

    contributions:
      buildContributions(
        signals,
        config,
        simFeature,
      ),
  };
}

function topDrivers(
  signals: CoreSignals,
  horizonResult:
    ForecastHorizonResult,
  direction:
    | "positive"
    | "negative",
) {
  return horizonResult.contributions
    .filter((item) =>
      direction === "positive"
        ? item.contribution > 0.015
        : item.contribution < -0.015,
    )
    .slice(0, 5)
    .map(
      (item) =>
        `${item.factor}: ${item.explanation}`,
    );
}

function historicalAnalogies(
  snapshot: MarketSnapshot,
  signals: CoreSignals,
) {
  const analogies: string[] = [];

  if (
    snapshot.technicals.rsi14 <
      35 &&
    snapshot.positioning
      .shortInterestScore >= 55 &&
    signals.News < 0
  ) {
    analogies.push(
      "Oversold, negatively shocked securities with elevated short interest can produce either continuation or violent short-covering reversals; liquidity determines the path.",
    );
  }

  if (
    snapshot.macro.regime ===
    "High-Volatility Risk-Off"
  ) {
    analogies.push(
      "Company-specific signals historically become less reliable when cross-asset deleveraging dominates price formation.",
    );
  }

  if (
    signals.Fundamental > 0.35 &&
    signals.Technical < -0.25
  ) {
    analogies.push(
      "Fundamentally attractive but technically weak securities often require a catalyst or estimate revision before valuation dislocation closes.",
    );
  }

  if (
    signals.News > 0.35 &&
    snapshot.news.noveltyScore < 40
  ) {
    analogies.push(
      "Positive but low-novelty narratives frequently fade because the information was already incorporated into price.",
    );
  }

  return analogies.length
    ? analogies
    : [
        "No high-confidence historical analogy was asserted. A production graph service should retrieve point-in-time comparable states before displaying named precedents.",
      ];
}

export function createDisabledCamelFeatures(
  reason: string,
): CamelBehavioralFeatures {
  return {
    schemaVersion:
      "slice-camel-output-1.0.0",

    status: "disabled",

    generatedAt:
      new Date().toISOString(),

    modelVersion: "disabled",

    confidence: 0,

    directionalPressure: 0,

    agentDisagreement: 100,

    narrativeConcentration: 0,

    reversalRisk: 50,

    contagionRisk: 50,

    liquidityStress: 50,

    institutionalRepricingDelay: 50,

    shortCoveringPotential: 0,

    dominantNarrative:
      "CAMEL-AI service disabled; deterministic Slice simulation used.",

    dominantBuyers: [],

    dominantSellers: [],

    positiveDrivers: [],

    negativeDrivers: [],

    contradictions: [],

    limitations: [reason],

    audit: {
      workforceMode: "DISABLED",
      sharedMemory: false,
      tradingExecutionEnabled: false,
      credentialsExposedToAgents: false,
      toolsUsed: [],
      agentRoles: [],
    },
  };
}

export function buildForecast(
  snapshot: MarketSnapshot,
  camel: CamelBehavioralFeatures =
    createDisabledCamelFeatures(
      "CAMEL-AI is optional and was not invoked for this forecast.",
    ),
): ForecastResponse {
  const signals =
    computeCoreSignals(snapshot);

  const simulation =
    simulateMarket(
      snapshot,
      signals,
      camel,
    );

  const horizons =
    FORECAST_HORIZONS.map(
      (horizon) =>
        buildHorizonResult(
          horizon,
          snapshot,
          signals,
          simulation,
          camel,
        ),
    );

  const referenceHorizon =
    horizons.find(
      (item) =>
        item.horizon === "2-5d",
    ) ?? horizons[0];

  const staleDataWarning =
    snapshot.slice.staleData
      ? "Stale-data warning: one or more inputs exceeded the allowed freshness window. Probabilities and confidence were shrunk toward neutral."
      : null;

  return {
    schemaVersion:
      "slice-forecast-output-1.0.0",

    requestId:
      snapshot.requestId,

    symbol: snapshot.symbol,

    generatedAt:
      new Date().toISOString(),

    asOf: snapshot.asOf,

    engineVersion:
      ENGINE_VERSION,

    modelVersion:
      MODEL_VERSION,

    calibrationVersion:
      CALIBRATION_VERSION,

    sliceSentimentScore: round(
      snapshot.slice.sentimentScore,
      1,
    ),

    marketRegime:
      snapshot.macro.regime,

    dataQualityScore: round(
      signals.dataQuality,
      1,
    ),

    staleDataWarning,

    horizons,

    simulation,

    camel,

    drivers: {
      positive: [
        ...topDrivers(
          signals,
          referenceHorizon,
          "positive",
        ),
        ...camel.positiveDrivers,
      ].slice(0, 8),

      negative: [
        ...topDrivers(
          signals,
          referenceHorizon,
          "negative",
        ),
        ...camel.negativeDrivers,
      ].slice(0, 8),

      technical:
        signals.technicalDrivers,

      macro:
        signals.macroDrivers,

      environmental:
        signals.environmentalDrivers,

      supplyChain:
        signals.supplyChainDrivers,

      optionsAndPositioning:
        signals.positioningDrivers,

      contradictions: [
        ...new Set([
          ...signals.contradictions,
          ...camel.contradictions,
        ]),
      ],

      historicalAnalogies:
        historicalAnalogies(
          snapshot,
          signals,
        ),
    },

    provenance: {
      sourceCount:
        snapshot.slice.sourceCount,

      independentSourceCount:
        snapshot.slice
          .independentSourceCount,

      duplicateCount:
        snapshot.slice
          .duplicateCount,

      pointInTimeField: "asOf",

      inputSchemaVersion:
        snapshot.schemaVersion,

      forecastCodePath:
        "src/lib/intelligence-forecast/engine.ts",
    },

    limitations: [
      "Forecasts are probabilistic decision support, not guarantees or personalized investment advice.",

      "The current mathematical calibration is a conservative engineering baseline until point-in-time historical training and locked out-of-sample calibration are connected.",

      "Synthetic participant behavior cannot reveal actual institutional holdings, hidden liquidity, or future policy decisions.",

      "A production deployment must settle every forecast against realized outcomes and publish Brier score, log loss, and interval coverage by horizon and regime.",

      ...simulation.knownLimitations,
    ],

    safeguards: {
      simulatedConsensusIsTruth:
        false,

      autonomousTradingEnabled:
        false,

      simulationWeightCapped:
        true,

      simulationMaximumWeight:
        MAX_SIMULATION_WEIGHT,

      probabilityCalibratedMathematically:
        true,

      humanReviewRecommended:
        true,
    },
  };
}