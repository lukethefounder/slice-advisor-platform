import type {
  AlphaVantageIntelligenceResponse,
} from "@/lib/intelligence/alpha-vantage-types";
import type {
  MarketRegime,
  MarketSnapshot,
} from "@/lib/intelligence-forecast/types";

export type IntelligenceScanPayload = {
  scannedAt?: string;
  sources?: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
    paid?: boolean;
    error?: string;
  }>;
  items?: Array<{
    id: string;
    sourceName: string;
    title?: string;
    score: number;
    urgency: string;
    matchedTickers: string[];
    reasons: string[];
  }>;
  alertCandidates?: unknown[];
  digestCandidates?: unknown[];
  suppressed?: unknown[];
};

export type SnapshotCoverage = {
  score: number;
  realTime: boolean;
  delayed: boolean;
  marketOpen: boolean | null;
  freshnessMode: string;
  freshnessLabel: string;
  providerAsOf: string | null;
  retrievedAt: string;
  actual: string[];
  derived: string[];
  neutralized: string[];
  warnings: string[];
};

export type LiveSnapshotResult = {
  snapshot: MarketSnapshot;
  coverage: SnapshotCoverage;
};

type BuildLiveSnapshotInput = {
  symbol: string;
  alpha: AlphaVantageIntelligenceResponse;
  scan?: IntelligenceScanPayload | null;
  simulationPaths?: number;
};

function clamp(value: number, minimum = 0, maximum = 100) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(maximum, value));
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreHigherIsBetter(value: number, low: number, high: number) {
  return clamp(((value - low) / Math.max(high - low, 0.0001)) * 100);
}

function scoreLowerIsBetter(value: number, low: number, high: number) {
  return clamp(100 - scoreHigherIsBetter(value, low, high));
}

function hashSeed(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return Math.abs(hash) || 1;
}

function makeRequestId(symbol: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${symbol}:${random}`;
}

function deriveRegime(alpha: AlphaVantageIntelligenceResponse): MarketRegime {
  const trend = alpha.technicals?.trendScore ?? 50;
  const momentum = alpha.technicals?.momentumScore ?? 50;
  const risk = alpha.technicals?.riskScore ?? 50;
  const volatility =
    alpha.technicals?.volatility20Annualized ?? 35;

  if (volatility >= 65 && risk <= 35) {
    return "High-Volatility Risk-Off";
  }

  if (trend >= 67 && momentum >= 55) {
    return "Trending Bull";
  }

  if (trend <= 33 && momentum <= 45) {
    return "Trending Bear";
  }

  if (risk >= 70 && trend >= 55) {
    return "Low-Volatility Expansion";
  }

  if (trend >= 55 && momentum >= 48) {
    return "Recovery";
  }

  return "Range Bound";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildLiveMarketSnapshot({
  symbol,
  alpha,
  scan = null,
  simulationPaths = 500,
}: BuildLiveSnapshotInput): LiveSnapshotResult {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const quote = alpha.quote;

  if (!alpha.ok || !quote?.price || quote.price <= 0) {
    throw new Error(
      alpha.error ||
        `Alpha Vantage did not return a usable quote for ${normalizedSymbol}.`,
    );
  }

  const actual: string[] = [
    "latest quote",
    "previous close",
    "traded volume",
  ];
  const derived: string[] = [];
  const neutralized: string[] = [];
  const warnings = [...alpha.health.warnings];

  if (alpha.intraday?.bars.length) {
    actual.push(
      `${alpha.intraday.interval} intraday OHLCV`,
      "provider timestamp",
      "session high/low",
      "session VWAP",
    );
  }

  if (alpha.technicals) {
    actual.push("daily price history");
    derived.push(
      "moving averages",
      "RSI",
      "annualized realized volatility",
      "momentum",
      "drawdown",
      "ATR",
      "trend and risk scores",
    );
  }

  if (alpha.overview) {
    actual.push("company fundamentals");
  }

  if (alpha.news?.items.length) {
    actual.push("Alpha Vantage news and ticker sentiment");
  }

  if (alpha.market) {
    actual.push("global market open/close status");
  }

  const matchedScanItems =
    scan?.items?.filter((item) =>
      item.matchedTickers?.includes(normalizedSymbol),
    ) ?? [];
  const scanItems = matchedScanItems.length
    ? matchedScanItems
    : scan?.items ?? [];
  const scanSourceCount = new Set(
    scanItems.map((item) => item.sourceName),
  ).size;
  const alphaSourceCount = new Set(
    alpha.news?.items.map((item) => item.source || item.sourceDomain) ?? [],
  ).size;
  const sourceCount =
    scanItems.length + (alpha.news?.articleCount ?? 0);
  const independentSourceCount = Math.max(
    scanSourceCount + alphaSourceCount,
    alphaSourceCount,
    scanSourceCount,
  );
  const duplicateCount = Math.max(
    0,
    sourceCount - independentSourceCount,
  );

  if (scanItems.length) {
    actual.push("advisor intelligence scan results");
  }

  const newsSentiment = clamp(
    50 +
      safeNumber(alpha.news?.relevanceWeightedSentiment, 0) * 50,
  );
  const trendScore = safeNumber(
    alpha.technicals?.trendScore,
    50,
  );
  const momentumScore = safeNumber(
    alpha.technicals?.momentumScore,
    50,
  );
  const riskScore = safeNumber(
    alpha.technicals?.riskScore,
    50,
  );
  const volumeScore = safeNumber(
    alpha.technicals?.volumeScore,
    50,
  );
  const valuationScore = clamp(
    scoreLowerIsBetter(alpha.overview?.peRatio ?? 25, 8, 45) * 0.35 +
      scoreLowerIsBetter(alpha.overview?.pegRatio ?? 2.5, 0.5, 4) * 0.25 +
      scoreHigherIsBetter(
        (((alpha.overview?.analystTargetPrice || quote.price) -
          quote.price) /
          quote.price) *
          100,
        -20,
        40,
      ) *
        0.4,
  );
  const growthScore = clamp(
    scoreHigherIsBetter(
      (alpha.overview?.quarterlyRevenueGrowthYOY ?? 0) * 100,
      -10,
      35,
    ) *
      0.45 +
      scoreHigherIsBetter(
        (alpha.overview?.quarterlyEarningsGrowthYOY ?? 0) * 100,
        -15,
        45,
      ) *
        0.55,
  );
  const qualityScore = clamp(
    scoreHigherIsBetter(
      (alpha.overview?.profitMargin ?? 0) * 100,
      0,
      35,
    ) *
      0.3 +
      scoreHigherIsBetter(
        (alpha.overview?.operatingMargin ?? 0) * 100,
        0,
        40,
      ) *
        0.3 +
      scoreHigherIsBetter(
        (alpha.overview?.returnOnEquity ?? 0) * 100,
        0,
        45,
      ) *
        0.4,
  );
  const contradictionScore = clamp(
    Math.abs(newsSentiment - trendScore) * 0.5 +
      Math.abs(valuationScore - growthScore) * 0.3 +
      Math.max(0, 50 - volumeScore) * 0.2,
  );
  const compositeSentiment = clamp(
    newsSentiment * 0.19 +
      trendScore * 0.19 +
      momentumScore * 0.11 +
      valuationScore * 0.13 +
      growthScore * 0.12 +
      qualityScore * 0.13 +
      riskScore * 0.08 +
      volumeScore * 0.05 -
      contradictionScore * 0.1,
  );

  derived.push(
    "composite Slice sentiment",
    "source contradiction score",
    "source independence estimate",
    "market regime proxy",
  );

  neutralized.push(
    "live options positioning",
    "dealer gamma",
    "reported short-interest changes",
    "broad macro surprise series",
    "environmental exposure",
    "supply-chain concentration",
  );

  const endpointCoverage =
    alpha.health.endpointCount > 0
      ? (alpha.health.successfulEndpointCount /
          alpha.health.endpointCount) *
        100
      : 0;
  const freshnessScore =
    alpha.freshness.mode === "realtime"
      ? 100
      : alpha.freshness.mode === "delayed"
        ? 78
        : alpha.freshness.mode === "market_closed"
          ? 82
          : alpha.freshness.mode === "end_of_day"
            ? 58
            : alpha.freshness.mode === "stale"
              ? 25
              : 0;
  const sourceScore = clamp(
    independentSourceCount * 9 + Math.min(sourceCount, 30) * 1.5,
  );
  const fieldSignals = [
    quote.price,
    quote.volume,
    alpha.intraday?.lastRefreshed,
    alpha.technicals?.rsi14,
    alpha.technicals?.sma50,
    alpha.technicals?.volatility20Annualized,
    alpha.overview?.peRatio,
    alpha.overview?.profitMargin,
    alpha.overview?.quarterlyRevenueGrowthYOY,
    alpha.news?.relevanceWeightedSentiment,
    alpha.market?.currentStatus,
  ];
  const fieldCoverage =
    (fieldSignals.filter(
      (value) => value !== null && value !== undefined && value !== "",
    ).length /
      fieldSignals.length) *
    100;
  const coverageScore = clamp(
    endpointCoverage * 0.27 +
      freshnessScore * 0.27 +
      fieldCoverage * 0.28 +
      sourceScore * 0.18 -
      Math.min(alpha.health.warnings.length * 3, 18),
  );
  const sentimentConfidence = clamp(
    coverageScore * 0.58 +
      Math.max(0, 100 - contradictionScore) * 0.22 +
      sourceScore * 0.2,
  );
  const regime = deriveRegime(alpha);
  const dailyVolatility =
    alpha.technicals?.volatility20Daily ?? 2.5;
  const annualizedVolatility =
    alpha.technicals?.volatility20Annualized ??
    dailyVolatility * Math.sqrt(252);
  const marketStress = clamp(
    annualizedVolatility * 0.8 +
      Math.abs(
        alpha.technicals?.drawdownFrom60DayHigh ?? 0,
      ) *
        1.1,
  );
  const eventMagnitude = clamp(
    Math.abs(quote.changePercent) * 10 +
      Math.min(sourceCount, 20) * 2,
  );
  const asOf = alpha.providerAsOf ?? alpha.retrievedAt;

  if (!alpha.freshness.isRealtime) {
    warnings.push(alpha.freshness.explanation);
  }

  return {
    snapshot: {
      schemaVersion: "slice-forecast-input-1.0.0",
      requestId: makeRequestId(normalizedSymbol),
      symbol: normalizedSymbol,
      asOf,
      price: {
        current: quote.price,
        previousClose: quote.previousClose || quote.price,
        volume: quote.volume || 0,
      },
      slice: {
        sentimentScore: compositeSentiment,
        sentimentConfidence,
        dataQuality: coverageScore,
        sourceCount,
        independentSourceCount,
        duplicateCount,
        staleData:
          alpha.freshness.mode === "stale" ||
          alpha.freshness.mode === "unavailable",
      },
      technicals: {
        trendScore,
        momentumScore,
        riskScore,
        volumeScore,
        rsi14: safeNumber(alpha.technicals?.rsi14, 50),
        volatility20: dailyVolatility,
        momentum30: safeNumber(alpha.technicals?.momentum30, 0),
        drawdownFromHigh: safeNumber(
          alpha.technicals?.drawdownFrom60DayHigh,
          0,
        ),
        volumeTrend: safeNumber(
          alpha.technicals?.volumeTrendPercent,
          0,
        ),
      },
      fundamentals: {
        peRatio: safeNumber(alpha.overview?.peRatio, 0),
        pegRatio: safeNumber(alpha.overview?.pegRatio, 0),
        profitMargin: safeNumber(alpha.overview?.profitMargin, 0),
        operatingMargin: safeNumber(
          alpha.overview?.operatingMargin,
          0,
        ),
        returnOnEquity: safeNumber(
          alpha.overview?.returnOnEquity,
          0,
        ),
        quarterlyRevenueGrowthYOY: safeNumber(
          alpha.overview?.quarterlyRevenueGrowthYOY,
          0,
        ),
        quarterlyEarningsGrowthYOY: safeNumber(
          alpha.overview?.quarterlyEarningsGrowthYOY,
          0,
        ),
        analystTargetPrice: safeNumber(
          alpha.overview?.analystTargetPrice,
          0,
        ),
        beta: safeNumber(alpha.overview?.beta, 1),
      },
      news: {
        relevanceWeightedSentiment: safeNumber(
          alpha.news?.relevanceWeightedSentiment,
          0,
        ),
        articleCount: alpha.news?.articleCount ?? sourceCount,
        noveltyScore: clamp(
          45 + Math.abs(quote.changePercent) * 5 + sourceCount * 1.5,
        ),
        sourceReliability: clamp(
          coverageScore * 0.62 + sourceScore * 0.38,
        ),
        contradictionScore,
        eventMagnitude,
      },
      macro: {
        regime,
        alignmentScore: 50,
        stressScore: marketStress,
        liquidityScore: volumeScore,
        surpriseScore: clamp(50 + quote.changePercent * 6),
      },
      positioning: {
        optionsScore: 50,
        crowdingScore: 50,
        shortInterestScore: 50,
        dealerGammaScore: 0,
        impliedVolatilityPercent: annualizedVolatility,
        skewScore: 0,
      },
      environment: {
        alignmentScore: 50,
        disruptionRisk: 50,
        geographicExposure: 50,
      },
      supplyChain: {
        resilienceScore: 50,
        propagationRisk: 50,
        concentrationRisk: 50,
      },
      simulation: {
        enabled: true,
        paths: Math.round(clamp(simulationPaths, 100, 5_000)),
        seed: hashSeed(`${normalizedSymbol}:${asOf}`),
      },
    },
    coverage: {
      score: Math.round(coverageScore),
      realTime: alpha.freshness.isRealtime,
      delayed: alpha.freshness.isDelayed,
      marketOpen: alpha.market?.isOpen ?? null,
      freshnessMode: alpha.freshness.mode,
      freshnessLabel: alpha.freshness.label,
      providerAsOf: alpha.providerAsOf,
      retrievedAt: alpha.retrievedAt,
      actual: unique(actual),
      derived: unique(derived),
      neutralized: unique(neutralized),
      warnings: unique(warnings),
    },
  };
}