import type {
  MarketRegime,
  MarketSnapshot,
} from "@/lib/intelligence-forecast/types";

const INPUT_SCHEMA_VERSION = "slice-forecast-input-1.0.0" as const;

const MARKET_REGIMES = new Set<MarketRegime>([
  "Trending Bull",
  "Trending Bear",
  "Range Bound",
  "High-Volatility Risk-Off",
  "Low-Volatility Expansion",
  "Liquidity Stress",
  "Recovery",
  "Unknown",
]);

export class ForecastValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("Invalid Slice forecast request.");
    this.name = "ForecastValidationError";
    this.issues = issues;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readRecord(
  parent: Record<string, unknown>,
  key: string,
) {
  const value = parent[key];

  return isRecord(value) ? value : {};
}

function finiteNumber(
  value: unknown,
  fallback: number,
  options: {
    min?: number;
    max?: number;
  } = {},
) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  let next =
    Number.isFinite(parsed)
      ? parsed
      : fallback;

  if (typeof options.min === "number") {
    next = Math.max(options.min, next);
  }

  if (typeof options.max === "number") {
    next = Math.min(options.max, next);
  }

  return next;
}

function boundedScore(
  value: unknown,
  fallback = 50,
) {
  return finiteNumber(value, fallback, {
    min: 0,
    max: 100,
  });
}

function cleanSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 15);
}

function cleanRequestId(value: unknown) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9:_\-]/g, "")
    .slice(0, 100);

  return cleaned || `slice-forecast-${Date.now()}`;
}

function readIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  const parsed = Date.parse(raw);

  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }

  /*
   * A malicious or malformed caller must not be allowed to send
   * observations far into the future. Five minutes permits ordinary
   * clock skew without contaminating point-in-time processing.
   */
  const maximumFutureTime =
    Date.now() + 5 * 60 * 1000;

  return new Date(
    Math.min(parsed, maximumFutureTime),
  ).toISOString();
}

function readRegime(
  value: unknown,
): MarketRegime {
  const candidate =
    String(value ?? "Unknown") as MarketRegime;

  return MARKET_REGIMES.has(candidate)
    ? candidate
    : "Unknown";
}

export function normalizeMarketSnapshot(
  input: unknown,
): MarketSnapshot {
  const issues: string[] = [];

  const root = isRecord(input)
    ? input
    : {};

  const symbol = cleanSymbol(root.symbol);

  if (
    root.schemaVersion &&
    root.schemaVersion !== INPUT_SCHEMA_VERSION
  ) {
    issues.push(
      `schemaVersion must be ${INPUT_SCHEMA_VERSION}.`,
    );
  }

  if (!symbol) {
    issues.push("symbol is required.");
  }

  const price = readRecord(root, "price");
  const slice = readRecord(root, "slice");
  const technicals = readRecord(root, "technicals");
  const fundamentals = readRecord(root, "fundamentals");
  const news = readRecord(root, "news");
  const macro = readRecord(root, "macro");
  const positioning = readRecord(root, "positioning");
  const environment = readRecord(root, "environment");
  const supplyChain = readRecord(root, "supplyChain");
  const simulation = readRecord(root, "simulation");

  const currentPrice = finiteNumber(
    price.current,
    0,
    {
      min: 0,
    },
  );

  const previousClose = finiteNumber(
    price.previousClose,
    currentPrice,
    {
      min: 0,
    },
  );

  if (currentPrice <= 0) {
    issues.push(
      "price.current must be greater than zero.",
    );
  }

  const asOf = readIsoDate(root.asOf);
  const ageMs = Date.now() - Date.parse(asOf);

  const staleFromTimestamp =
    Number.isFinite(ageMs) &&
    ageMs > 36 * 60 * 60 * 1000;

  if (issues.length > 0) {
    throw new ForecastValidationError(issues);
  }

  return {
    schemaVersion: INPUT_SCHEMA_VERSION,
    requestId: cleanRequestId(root.requestId),
    symbol,
    asOf,

    price: {
      current: currentPrice,
      previousClose,
      volume: finiteNumber(
        price.volume,
        0,
        {
          min: 0,
        },
      ),
    },

    slice: {
      sentimentScore: boundedScore(
        slice.sentimentScore,
      ),

      sentimentConfidence: boundedScore(
        slice.sentimentConfidence,
        60,
      ),

      dataQuality: boundedScore(
        slice.dataQuality,
        60,
      ),

      sourceCount: Math.round(
        finiteNumber(
          slice.sourceCount,
          0,
          {
            min: 0,
            max: 100_000,
          },
        ),
      ),

      independentSourceCount: Math.round(
        finiteNumber(
          slice.independentSourceCount,
          0,
          {
            min: 0,
            max: 100_000,
          },
        ),
      ),

      duplicateCount: Math.round(
        finiteNumber(
          slice.duplicateCount,
          0,
          {
            min: 0,
            max: 100_000,
          },
        ),
      ),

      staleData:
        Boolean(slice.staleData) ||
        staleFromTimestamp,
    },

    technicals: {
      trendScore: boundedScore(
        technicals.trendScore,
      ),

      momentumScore: boundedScore(
        technicals.momentumScore,
      ),

      riskScore: boundedScore(
        technicals.riskScore,
      ),

      volumeScore: boundedScore(
        technicals.volumeScore,
      ),

      rsi14: finiteNumber(
        technicals.rsi14,
        50,
        {
          min: 0,
          max: 100,
        },
      ),

      volatility20: finiteNumber(
        technicals.volatility20,
        2.5,
        {
          min: 0,
          max: 100,
        },
      ),

      momentum30: finiteNumber(
        technicals.momentum30,
        0,
        {
          min: -300,
          max: 300,
        },
      ),

      drawdownFromHigh: finiteNumber(
        technicals.drawdownFromHigh,
        0,
        {
          min: -100,
          max: 500,
        },
      ),

      volumeTrend: finiteNumber(
        technicals.volumeTrend,
        0,
        {
          min: -100,
          max: 1000,
        },
      ),
    },

    fundamentals: {
      peRatio: finiteNumber(
        fundamentals.peRatio,
        0,
        {
          min: -1_000,
          max: 10_000,
        },
      ),

      pegRatio: finiteNumber(
        fundamentals.pegRatio,
        0,
        {
          min: -100,
          max: 1_000,
        },
      ),

      profitMargin: finiteNumber(
        fundamentals.profitMargin,
        0,
        {
          min: -10,
          max: 10,
        },
      ),

      operatingMargin: finiteNumber(
        fundamentals.operatingMargin,
        0,
        {
          min: -10,
          max: 10,
        },
      ),

      returnOnEquity: finiteNumber(
        fundamentals.returnOnEquity,
        0,
        {
          min: -50,
          max: 50,
        },
      ),

      quarterlyRevenueGrowthYOY:
        finiteNumber(
          fundamentals.quarterlyRevenueGrowthYOY,
          0,
          {
            min: -10,
            max: 20,
          },
        ),

      quarterlyEarningsGrowthYOY:
        finiteNumber(
          fundamentals.quarterlyEarningsGrowthYOY,
          0,
          {
            min: -50,
            max: 100,
          },
        ),

      analystTargetPrice: finiteNumber(
        fundamentals.analystTargetPrice,
        0,
        {
          min: 0,
          max: 10_000_000,
        },
      ),

      beta: finiteNumber(
        fundamentals.beta,
        1,
        {
          min: -10,
          max: 20,
        },
      ),
    },

    news: {
      relevanceWeightedSentiment:
        finiteNumber(
          news.relevanceWeightedSentiment,
          0,
          {
            min: -1,
            max: 1,
          },
        ),

      articleCount: Math.round(
        finiteNumber(
          news.articleCount,
          0,
          {
            min: 0,
            max: 100_000,
          },
        ),
      ),

      noveltyScore: boundedScore(
        news.noveltyScore,
        50,
      ),

      sourceReliability: boundedScore(
        news.sourceReliability,
        60,
      ),

      contradictionScore: boundedScore(
        news.contradictionScore,
        20,
      ),

      eventMagnitude: boundedScore(
        news.eventMagnitude,
        30,
      ),
    },

    macro: {
      regime: readRegime(
        macro.regime,
      ),

      alignmentScore: boundedScore(
        macro.alignmentScore,
      ),

      stressScore: boundedScore(
        macro.stressScore,
        30,
      ),

      liquidityScore: boundedScore(
        macro.liquidityScore,
      ),

      surpriseScore: finiteNumber(
        macro.surpriseScore,
        0,
        {
          min: -100,
          max: 100,
        },
      ),
    },

    positioning: {
      optionsScore: boundedScore(
        positioning.optionsScore,
      ),

      crowdingScore: boundedScore(
        positioning.crowdingScore,
        40,
      ),

      shortInterestScore: boundedScore(
        positioning.shortInterestScore,
        30,
      ),

      dealerGammaScore: finiteNumber(
        positioning.dealerGammaScore,
        0,
        {
          min: -100,
          max: 100,
        },
      ),

      impliedVolatilityPercent:
        finiteNumber(
          positioning.impliedVolatilityPercent,
          0,
          {
            min: 0,
            max: 500,
          },
        ),

      skewScore: finiteNumber(
        positioning.skewScore,
        0,
        {
          min: -100,
          max: 100,
        },
      ),
    },

    environment: {
      alignmentScore: boundedScore(
        environment.alignmentScore,
      ),

      disruptionRisk: boundedScore(
        environment.disruptionRisk,
        20,
      ),

      geographicExposure: boundedScore(
        environment.geographicExposure,
        30,
      ),
    },

    supplyChain: {
      resilienceScore: boundedScore(
        supplyChain.resilienceScore,
      ),

      propagationRisk: boundedScore(
        supplyChain.propagationRisk,
        30,
      ),

      concentrationRisk: boundedScore(
        supplyChain.concentrationRisk,
        30,
      ),
    },

    simulation: {
      enabled:
        simulation.enabled !== false,

      paths: Math.round(
        finiteNumber(
          simulation.paths,
          400,
          {
            min: 100,
            max: 2_500,
          },
        ),
      ),

      seed: Math.round(
        finiteNumber(
          simulation.seed,
          20260710,
          {
            min: 1,
            max: 2_147_483_647,
          },
        ),
      ),
    },
  };
}