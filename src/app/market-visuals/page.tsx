"use client";

import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ViewMode =
  | "prediction"
  | "trader"
  | "patterns"
  | "technicals"
  | "scenarios"
  | "options"
  | "compare"
  | "tradingview"
  | "pine"
  | "platform"
  | "data";

type ConfidenceLevel = 68 | 80 | 90 | 95 | 99;
type HorizonSteps = 5 | 10 | 20 | 30;

type TraderStyle =
  | "Momentum Continuation"
  | "Breakout"
  | "Pullback"
  | "Mean Reversion"
  | "Gap / Fade"
  | "Risk-Off Defense";

type TraderHorizon = "Scalp" | "Intraday" | "Swing";
type RiskProfile = "Conservative" | "Balanced" | "Aggressive";

type DrawTool =
  | "trendline"
  | "channel"
  | "support"
  | "resistance"
  | "zone"
  | "arrow";

type OptionStrategy =
  | "Long Call"
  | "Long Put"
  | "Bull Call Spread"
  | "Bear Put Spread"
  | "Protective Put"
  | "Covered Call";

type PointPct = {
  x: number;
  y: number;
};

type PatternOverlay = {
  id: string;
  type: DrawTool;
  label: string;
  color: string;
  start: PointPct;
  end: PointPct;
  createdAt: string;
};

type PatternAnalysis = {
  id: string;
  label: string;
  type: DrawTool;
  levelText: string;
  matchScore: number;
  status: string;
  explanation: string;
  tone: Tone;
};

type PineProject = {
  id: string;
  name: string;
  symbol: string;
  notes: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type Candle = {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  vwap: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  atr14: number | null;
  volumeSma20: number | null;
  returnPct: number | null;
  cumulativeReturnPct: number | null;
  rangePct: number | null;
};

type ForecastChartPoint = {
  label: string;
  close: number | null;
  projected: number | null;
  lower: number | null;
  upper: number | null;
  bearish: number | null;
  bullish: number | null;
};

type PredictivePoint = {
  step: number;
  label: string;
  projected: number;
  lower: number;
  upper: number;
  bearish: number;
  bullish: number;
};

type MarketVisualPayload = {
  symbol: string;
  interval: string;
  provider: string;
  isLive: boolean;
  note: string;
  sourcePriority: string[];
  dataPolicy: {
    realTimeRequiresProvider: boolean;
    demoFallbackEnabled: boolean;
    accuracyReminder: string;
  };
  marketSession: {
    session: string;
    description: string;
    isRegularMarket: boolean;
    isExtendedHours: boolean;
    timezone: string;
  };
  freshness: {
    status: string;
    asOf: string | null;
    ageMinutes: number | null;
    warning: string;
  };
  quality: {
    score: number;
    warnings: string[];
  };
  quote: {
    symbol: string;
    price: number | null;
    change: number | null;
    changePct: number | null;
    latestTradingDay: string | null;
    previousClose: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    provider: string;
  } | null;
  levels: {
    support: number;
    resistance: number;
    midpoint: number;
    distanceToSupportPct: number;
    distanceToResistancePct: number;
  };
  signals: {
    directionalBias: string;
    momentum: string;
    riskState: string;
    summary: string;
  };
  modelConfidence: number;
  latest: {
    close: number;
    chartClose: number;
    change: number;
    changePct: number;
    rsi14: number | null;
    vwap: number | null;
    sma20: number | null;
    sma50: number | null;
    sma100: number | null;
    sma200: number | null;
    ema9: number | null;
    ema21: number | null;
    macd: number | null;
    atr14: number | null;
    volumeSma20: number | null;
    cumulativeReturnPct: number | null;
    asOf: string;
  } | null;
  candles: Candle[];
  predictions: Array<{
    date: string;
    label: string;
    projected: number;
    upper: number;
    lower: number;
  }>;
  platform: {
    platformOverview: Array<{ name: string; value: number }>;
    taskStatusCounts: Array<{ name: string; value: number }>;
    alertScores: Array<{
      name: string;
      title: string;
      score: number;
      urgency: string;
      source: string;
    }>;
    opportunityMatrix: Array<{
      name: string;
      title: string;
      opportunity: number;
      risk: number;
      composite: number;
      confidence: number;
      source: string;
    }>;
    sourceCredibility?: Array<{
      name: string;
      sourceName: string;
      domain: string;
      credibility: number;
      transparency: number;
      biasRisk: number;
      status: string;
    }>;
    watchlistHeatmap?: Array<{
      symbol: string;
      priority: string;
      status: string;
      sourceType: string;
      score: number;
    }>;
  };
};

type TraderPrediction = {
  currentPrice: number;
  directionalBias: "Bullish" | "Bearish" | "Neutral" | "Mixed";
  tradeSignal:
    | "Long Watch"
    | "Short Watch"
    | "Breakout Watch"
    | "Pullback Watch"
    | "Mean Reversion Watch"
    | "Wait / No Trade";
  setupGrade: "A+" | "A" | "B+" | "B" | "C" | "Avoid";
  setupQuality: number;
  confidenceLevel: ConfidenceLevel;
  modelQualityScore: number;
  dataScore: number;
  probabilityUp: number;
  probabilityDown: number;
  probabilityContinuation: number;
  expectedMovePct: number;
  downsideMovePct: number;
  upsideMovePct: number;
  driftPerStep: number;
  ewmaVolatility: number;
  realisedVolatility: number;
  atrPct: number;
  atrDollars: number;
  rangePct: number;
  volumeRatio: number;
  volumeScore: number;
  liquidityScore: number;
  trendScore: number;
  momentumScore: number;
  meanReversionScore: number;
  breakoutScore: number;
  pullbackScore: number;
  volatilityScore: number;
  tapeScore: number;
  riskScore: number;
  squeezeScore: number;
  maStackScore: number;
  vwapDistancePct: number;
  bollingerPosition: number | null;
  rsi: number | null;
  macdHistogram: number | null;
  support: number;
  resistance: number;
  pivot: number;
  entryLow: number;
  entryHigh: number;
  stopLoss: number;
  target1: number;
  target2: number;
  invalidation: string;
  riskReward1: number;
  riskReward2: number;
  volatilityRegime: "Low" | "Normal" | "Elevated" | "Extreme";
  scenarioMatrix: Array<{
    name: string;
    probability: number;
    target: number;
    movePct: number;
    trigger: string;
    action: string;
  }>;
  forecast: PredictivePoint[];
  explanation: string[];
  report: string[];
  executionPlan: string[];
  dataChecklist: Array<{
    name: string;
    value: string;
    score: number;
    tone: Tone;
  }>;
};

type OptionScenario = {
  strategy: OptionStrategy;
  contractMultiplier: number;
  contracts: number;
  netPremium: number;
  breakeven: number | null;
  maxLossText: string;
  maxProfitText: string;
  payoffData: Array<{
    price: number;
    profit: number;
    intrinsic: number;
  }>;
  summary: string[];
};

type PinePreview = {
  features: Array<{
    name: string;
    enabled: boolean;
    note: string;
    tone: Tone;
  }>;
  previewData: Array<{
    label: string;
    close: number;
    emaFast: number | null;
    emaSlow: number | null;
    vwap: number | null;
    rsi: number | null;
    bullSignal: number | null;
    bearSignal: number | null;
  }>;
  signalCount: number;
  latestSignal: string;
  previewScore: number;
  warnings: string[];
};

const VIEW_TABS: Array<{ id: ViewMode; label: string; description: string }> = [
  { id: "prediction", label: "Prediction", description: "Trader-grade forecast" },
  { id: "trader", label: "Trader Setup", description: "Entry, stop, target" },
  { id: "patterns", label: "Pattern Lab", description: "Draw overlays" },
  { id: "technicals", label: "Technicals", description: "RSI, MACD, VWAP, MA" },
  { id: "scenarios", label: "Scenarios", description: "Bull, bear, base cases" },
  { id: "options", label: "Options Lab", description: "Calls, puts, payoff" },
  { id: "compare", label: "Compare", description: "Relative strength" },
  { id: "tradingview", label: "TradingView", description: "Chart + Pine side panel" },
  { id: "pine", label: "Pine Lab", description: "Save Pine scripts" },
  { id: "platform", label: "Platform Intel", description: "Alerts and signals" },
  { id: "data", label: "Data", description: "Candle table" },
];

const BAR_COLORS = [
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
];

const PATTERN_COLORS = {
  trendline: "#06b6d4",
  channel: "#a855f7",
  support: "#22c55e",
  resistance: "#ef4444",
  zone: "#f59e0b",
  arrow: "#ffffff",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 10 ? 2 : 4,
  }).format(value);
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function rawPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;

  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);

  return Math.sqrt(Math.max(variance, 0));
}

function exponentialWeightedMean(values: number[], lambda = 0.94) {
  if (!values.length) return 0;

  let weighted = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const age = values.length - 1 - index;
    const weight = (1 - lambda) * lambda ** age;
    weighted += value * weight;
    totalWeight += weight;
  });

  return totalWeight ? weighted / totalWeight : mean(values);
}

function ewmaVolatility(values: number[], lambda = 0.94) {
  if (values.length < 2) return 0;

  const drift = exponentialWeightedMean(values, lambda);
  let variance = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const age = values.length - 1 - index;
    const weight = (1 - lambda) * lambda ** age;
    variance += weight * (value - drift) ** 2;
    totalWeight += weight;
  });

  return Math.sqrt(totalWeight ? variance / totalWeight : variance);
}

function regressionSlope(values: number[]) {
  if (values.length < 2) return 0;

  const xs = values.map((_, index) => index + 1);
  const xMean = mean(xs);
  const yMean = mean(values);

  const numerator = values.reduce(
    (sum, y, index) => sum + (xs[index] - xMean) * (y - yMean),
    0
  );
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

  return denominator ? numerator / denominator : 0;
}

function averageTrueRangePct(candles: Candle[]) {
  const recent = candles.slice(-20);

  if (!recent.length) return 0;

  const ranges = recent.map((candle) => {
    const close = candle.close || 1;
    return Math.abs(candle.high - candle.low) / close;
  });

  return mean(ranges);
}

function erf(value: number) {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-x * x));

  return sign * y;
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function zScoreForConfidence(confidence: ConfidenceLevel) {
  const scores: Record<ConfidenceLevel, number> = {
    68: 1,
    80: 1.2816,
    90: 1.6449,
    95: 1.96,
    99: 2.5758,
  };

  return scores[confidence];
}

function recentHigh(candles: Candle[], lookback = 20) {
  const recent = candles.slice(-lookback);
  if (!recent.length) return 0;
  return Math.max(...recent.map((candle) => candle.high));
}

function recentLow(candles: Candle[], lookback = 20) {
  const recent = candles.slice(-lookback);
  if (!recent.length) return 0;
  return Math.min(...recent.map((candle) => candle.low));
}

function setupGrade(score: number): TraderPrediction["setupGrade"] {
  if (score >= 92) return "A+";
  if (score >= 84) return "A";
  if (score >= 76) return "B+";
  if (score >= 66) return "B";
  if (score >= 54) return "C";
  return "Avoid";
}

function volatilityRegimeFromRatio(ratio: number): TraderPrediction["volatilityRegime"] {
  if (ratio >= 1.8) return "Extreme";
  if (ratio >= 1.25) return "Elevated";
  if (ratio <= 0.7) return "Low";
  return "Normal";
}

function toneFor(value: string | number): Tone {
  const text = String(value).toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    text.includes("fresh") ||
    text.includes("live") ||
    text.includes("bullish") ||
    text.includes("ready") ||
    text.includes("positive") ||
    (!Number.isNaN(numeric) && numeric >= 75)
  ) {
    return "green";
  }

  if (
    text.includes("stale") ||
    text.includes("demo") ||
    text.includes("closed") ||
    text.includes("bearish") ||
    text.includes("missing") ||
    text.includes("negative") ||
    (!Number.isNaN(numeric) && numeric < 45)
  ) {
    return "red";
  }

  if (
    text.includes("mixed") ||
    text.includes("warning") ||
    text.includes("market closed") ||
    text.includes("elevated") ||
    text.includes("overbought") ||
    (!Number.isNaN(numeric) && numeric >= 45 && numeric < 75)
  ) {
    return "amber";
  }

  if (
    text.includes("ai") ||
    text.includes("opportunity") ||
    text.includes("forecast")
  ) {
    return "purple";
  }

  if (
    text.includes("provider") ||
    text.includes("backend") ||
    text.includes("quality")
  ) {
    return "cyan";
  }

  return "slate";
}

function changeTone(value: number | null | undefined): Tone {
  if (value === null || value === undefined) return "slate";
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "slate";
}

function buildTraderPrediction(input: {
  candles: Candle[];
  confidenceLevel: ConfidenceLevel;
  horizonSteps: HorizonSteps;
  providerQualityScore: number;
  backendModelConfidence: number;
  traderStyle: TraderStyle;
  traderHorizon: TraderHorizon;
  riskProfile: RiskProfile;
  catalystText: string;
}): TraderPrediction | null {
  const clean = input.candles.filter(
    (candle) => Number.isFinite(candle.close) && candle.close > 0
  );

  if (clean.length < 25) return null;

  const closes = clean.map((candle) => candle.close);
  const latest = clean[clean.length - 1];
  const currentPrice = latest.close;
  const previous = clean[clean.length - 2] ?? latest;
  const returns = closes
    .slice(1)
    .map((close, index) => Math.log(close / closes[index]));

  const recentReturns = returns.slice(-100);
  const shortReturns = returns.slice(-20);
  const lastFiveReturns = returns.slice(-5);
  const longReturns = returns.slice(-200);

  const realisedVolatility = standardDeviation(recentReturns);
  const shortVolatility = standardDeviation(shortReturns);
  const longVolatility = standardDeviation(
    longReturns.length ? longReturns : recentReturns
  );
  const ewmaVol = ewmaVolatility(recentReturns);
  const atrPctFromRange = averageTrueRangePct(clean);
  const atrDollars = latest.atr14 ?? atrPctFromRange * currentPrice;
  const atrPct = currentPrice > 0 ? (atrDollars / currentPrice) * 100 : 0;
  const zScore = zScoreForConfidence(input.confidenceLevel);

  const logCloses = closes.slice(-100).map((close) => Math.log(close));
  const trendSlope = regressionSlope(logCloses);
  const trendSlopePct = Math.exp(trendSlope) - 1;

  const latestRsi = latest.rsi14 ?? 50;
  const macdHistogram = latest.macdHistogram ?? 0;
  const volumeRatio =
    latest.volumeSma20 && latest.volumeSma20 > 0
      ? latest.volume / latest.volumeSma20
      : 1;
  const vwapDistancePct =
    latest.vwap && latest.vwap > 0
      ? ((currentPrice - latest.vwap) / latest.vwap) * 100
      : 0;

  const resistance = Math.max(recentHigh(clean, 20), currentPrice);
  const support = Math.min(recentLow(clean, 20), currentPrice);
  const pivot = (latest.high + latest.low + latest.close) / 3;
  const dailyRangePct =
    currentPrice > 0 ? ((latest.high - latest.low) / currentPrice) * 100 : 0;
  const gapPct =
    previous.close > 0 ? ((latest.open - previous.close) / previous.close) * 100 : 0;

  const bollingerPosition =
    latest.bollingerUpper !== null &&
    latest.bollingerLower !== null &&
    latest.bollingerUpper > latest.bollingerLower
      ? ((currentPrice - latest.bollingerLower) /
          (latest.bollingerUpper - latest.bollingerLower)) *
        100
      : null;

  const maChecks = [
    latest.ema9 && currentPrice > latest.ema9,
    latest.ema21 && currentPrice > latest.ema21,
    latest.sma20 && currentPrice > latest.sma20,
    latest.sma50 && currentPrice > latest.sma50,
    latest.sma100 && currentPrice > latest.sma100,
    latest.sma200 && currentPrice > latest.sma200,
    latest.sma50 && latest.sma200 && latest.sma50 > latest.sma200,
  ].filter((item) => item !== null && item !== undefined);

  const maStackScore = clamp(
    (maChecks.filter(Boolean).length / Math.max(1, maChecks.length)) * 100,
    0,
    100
  );

  const trendScore = Math.round(
    clamp(
      50 +
        trendSlopePct * 3200 +
        (maStackScore - 50) * 0.55 +
        (latest.sma20 && currentPrice > latest.sma20 ? 8 : -4) +
        (latest.sma50 && currentPrice > latest.sma50 ? 7 : -5),
      0,
      100
    )
  );

  const momentumScore = Math.round(
    clamp(
      50 +
        (latestRsi - 50) * 0.65 +
        clamp(macdHistogram / currentPrice, -0.04, 0.04) * 700 +
        mean(lastFiveReturns) * 2200 +
        (vwapDistancePct > 0 ? 8 : -5),
      0,
      100
    )
  );

  const volumeScore = Math.round(
    clamp(
      50 + (volumeRatio - 1) * 35 + (latest.volume > previous.volume ? 8 : -3),
      0,
      100
    )
  );

  const liquidityScore = Math.round(
    clamp(42 + Math.log10(Math.max(latest.volume, 1)) * 8, 0, 100)
  );

  const rangeExpansion = dailyRangePct / Math.max(atrPct, 0.01);
  const volatilityScore = Math.round(
    clamp(
      50 + (rangeExpansion - 1) * 18 + (shortVolatility - longVolatility) * 650,
      0,
      100
    )
  );

  const resistanceDistancePct =
    currentPrice > 0 ? ((resistance - currentPrice) / currentPrice) * 100 : 0;
  const supportDistancePct =
    currentPrice > 0 ? ((currentPrice - support) / currentPrice) * 100 : 0;

  const breakoutScore = Math.round(
    clamp(
      45 +
        (1.8 - Math.min(Math.abs(resistanceDistancePct), 1.8)) * 16 +
        (volumeScore - 50) * 0.38 +
        (momentumScore - 50) * 0.32 +
        (trendScore - 50) * 0.24,
      0,
      100
    )
  );

  const pullbackScore = Math.round(
    clamp(
      45 +
        (trendScore - 50) * 0.35 +
        (latest.ema21
          ? (1.8 - Math.min(Math.abs(vwapDistancePct), 1.8)) * 8
          : 0) +
        (latestRsi >= 38 && latestRsi <= 58 ? 16 : -7) +
        (supportDistancePct <= atrPct * 1.2 ? 10 : 0),
      0,
      100
    )
  );

  const meanReversionScore = Math.round(
    clamp(
      50 +
        (latestRsi < 35 ? 24 : latestRsi > 68 ? 18 : -4) +
        (bollingerPosition !== null && bollingerPosition <= 12 ? 20 : 0) +
        (bollingerPosition !== null && bollingerPosition >= 88 ? 16 : 0) +
        (Math.abs(vwapDistancePct) > 2 ? 10 : 0) -
        (volumeRatio > 1.8 ? 8 : 0),
      0,
      100
    )
  );

  const squeezeScore = Math.round(
    clamp(
      50 +
        (latest.bollingerUpper && latest.bollingerLower
          ? (1 -
              clamp(
                (latest.bollingerUpper - latest.bollingerLower) / currentPrice,
                0,
                0.18
              ) /
                0.18) *
            38
          : 0) +
        (volumeRatio > 1.1 ? 8 : -4),
      0,
      100
    )
  );

  const tapeScore = Math.round(
    clamp(
      50 +
        (latest.close > latest.open ? 12 : -10) +
        (latest.close > pivot ? 8 : -6) +
        (latest.close > previous.close ? 8 : -7) +
        (vwapDistancePct > 0 ? 10 : -8) +
        (volumeRatio > 1.25 ? 7 : 0),
      0,
      100
    )
  );

  const riskScore = Math.round(
    clamp(
      100 -
        atrPct * 7 -
        Math.abs(gapPct) * 3 -
        (input.providerQualityScore < 65 ? 12 : 0) -
        (input.traderHorizon === "Scalp" && input.providerQualityScore < 85 ? 12 : 0) -
        (volumeRatio < 0.7 ? 7 : 0),
      0,
      100
    )
  );

  const catalystText = input.catalystText.toLowerCase();
  const catalystBoost =
    catalystText.includes("earnings") ||
    catalystText.includes("upgrade") ||
    catalystText.includes("guidance") ||
    catalystText.includes("contract") ||
    catalystText.includes("ai") ||
    catalystText.includes("fed")
      ? 6
      : 0;

  const styleScore =
    input.traderStyle === "Momentum Continuation"
      ? momentumScore * 0.32 +
        trendScore * 0.28 +
        tapeScore * 0.2 +
        volumeScore * 0.2
      : input.traderStyle === "Breakout"
        ? breakoutScore * 0.36 +
          volumeScore * 0.24 +
          momentumScore * 0.22 +
          squeezeScore * 0.18
        : input.traderStyle === "Pullback"
          ? pullbackScore * 0.42 +
            trendScore * 0.28 +
            riskScore * 0.18 +
            tapeScore * 0.12
          : input.traderStyle === "Mean Reversion"
            ? meanReversionScore * 0.45 +
              riskScore * 0.22 +
              volumeScore * 0.16 +
              tapeScore * 0.17
            : input.traderStyle === "Gap / Fade"
              ? meanReversionScore * 0.34 +
                Math.min(Math.abs(gapPct) * 12, 30) +
                riskScore * 0.22 +
                tapeScore * 0.12
              : riskScore * 0.36 +
                trendScore * 0.18 +
                volumeScore * 0.16 +
                tapeScore * 0.16 +
                meanReversionScore * 0.14;

  const riskAdjustment =
    input.riskProfile === "Conservative"
      ? -4
      : input.riskProfile === "Aggressive"
        ? 4
        : 0;

  const setupQuality = Math.round(
    clamp(
      styleScore * 0.55 +
        trendScore * 0.12 +
        momentumScore * 0.1 +
        volumeScore * 0.08 +
        tapeScore * 0.08 +
        riskScore * 0.07 +
        catalystBoost +
        riskAdjustment,
      0,
      100
    )
  );

  const directionalBias: TraderPrediction["directionalBias"] =
    trendScore >= 62 && momentumScore >= 55 && tapeScore >= 53
      ? "Bullish"
      : trendScore <= 42 && momentumScore <= 45 && tapeScore <= 47
        ? "Bearish"
        : Math.abs(momentumScore - 50) < 8 && Math.abs(trendScore - 50) < 12
          ? "Neutral"
          : "Mixed";

  const tradeSignal: TraderPrediction["tradeSignal"] =
    setupQuality < 54 || riskScore < 34
      ? "Wait / No Trade"
      : input.traderStyle === "Breakout"
        ? "Breakout Watch"
        : input.traderStyle === "Pullback"
          ? "Pullback Watch"
          : input.traderStyle === "Mean Reversion" || input.traderStyle === "Gap / Fade"
            ? "Mean Reversion Watch"
            : directionalBias === "Bearish"
              ? "Short Watch"
              : directionalBias === "Bullish"
                ? "Long Watch"
                : "Wait / No Trade";

  const rsiAdjustment = clamp((latestRsi - 50) / 50, -1, 1) * 0.0018;
  const macdAdjustment = clamp(macdHistogram / currentPrice, -0.006, 0.006);
  const vwapAdjustment = clamp(vwapDistancePct / 100, -0.035, 0.035) * 0.12;
  const maAdjustment = (maStackScore - 50) / 10000;
  const styleDrift =
    tradeSignal.includes("Long") ||
    tradeSignal.includes("Breakout") ||
    tradeSignal.includes("Pullback")
      ? setupQuality / 100000
      : tradeSignal.includes("Short")
        ? -setupQuality / 100000
        : 0;

  const driftPerStep = clamp(
    exponentialWeightedMean(recentReturns) * 0.3 +
      mean(shortReturns) * 0.2 +
      trendSlopePct * 0.24 +
      rsiAdjustment +
      macdAdjustment +
      vwapAdjustment +
      maAdjustment +
      styleDrift,
    -0.04,
    0.04
  );

  const longVolatilityRatio =
    longVolatility > 0 ? shortVolatility / longVolatility : 1;
  const volatilityRegime = volatilityRegimeFromRatio(longVolatilityRatio);
  const regimeMultiplier =
    volatilityRegime === "Extreme"
      ? 1.35
      : volatilityRegime === "Elevated"
        ? 1.15
        : volatilityRegime === "Low"
          ? 0.88
          : 1;

  const sigma = Math.max(
    ewmaVol,
    realisedVolatility * 0.85,
    atrPctFromRange * 0.45,
    0.001
  ) * regimeMultiplier;

  const forecast: PredictivePoint[] = Array.from({ length: input.horizonSteps }).map(
    (_, index) => {
      const step = index + 1;
      const expectedLogPrice = Math.log(currentPrice) + driftPerStep * step;
      const sigmaStep = sigma * Math.sqrt(step);
      const projected = Math.exp(expectedLogPrice);
      const lower = Math.exp(expectedLogPrice - zScore * sigmaStep);
      const upper = Math.exp(expectedLogPrice + zScore * sigmaStep);

      return {
        step,
        label: `+${step}`,
        projected,
        lower,
        upper,
        bearish: Math.exp(expectedLogPrice - 0.65 * zScore * sigmaStep),
        bullish: Math.exp(expectedLogPrice + 0.65 * zScore * sigmaStep),
      };
    }
  );

  const finalPoint = forecast[forecast.length - 1];
  const finalSigma = sigma * Math.sqrt(input.horizonSteps);
  const probabilityUp = normalCdf(
    (Math.log(currentPrice) +
      driftPerStep * input.horizonSteps -
      Math.log(currentPrice)) /
      Math.max(finalSigma, 0.0001)
  );

  const longSetup =
    tradeSignal === "Long Watch" ||
    tradeSignal === "Breakout Watch" ||
    tradeSignal === "Pullback Watch";

  const shortSetup = tradeSignal === "Short Watch";

  const entryLow = longSetup
    ? currentPrice - atrDollars * 0.25
    : shortSetup
      ? currentPrice - atrDollars * 0.15
      : currentPrice - atrDollars * 0.35;

  const entryHigh = longSetup
    ? currentPrice + atrDollars * 0.35
    : shortSetup
      ? currentPrice + atrDollars * 0.25
      : currentPrice + atrDollars * 0.35;

  const stopLoss = longSetup
    ? Math.min(support - atrDollars * 0.35, currentPrice - atrDollars * 1.1)
    : shortSetup
      ? Math.max(resistance + atrDollars * 0.35, currentPrice + atrDollars * 1.1)
      : currentPrice - atrDollars;

  const target1 = longSetup
    ? currentPrice + atrDollars * 1.45
    : shortSetup
      ? currentPrice - atrDollars * 1.45
      : currentPrice + atrDollars;

  const target2 = longSetup
    ? currentPrice + atrDollars * 2.5
    : shortSetup
      ? currentPrice - atrDollars * 2.5
      : currentPrice + atrDollars * 1.8;

  const riskPerShare = Math.max(Math.abs(currentPrice - stopLoss), 0.0001);
  const riskReward1 = Math.abs(target1 - currentPrice) / riskPerShare;
  const riskReward2 = Math.abs(target2 - currentPrice) / riskPerShare;

  const modelQualityScore = Math.round(
    clamp(
      input.providerQualityScore * 0.28 +
        input.backendModelConfidence * 0.2 +
        clamp(clean.length / 240, 0, 1) * 18 +
        riskScore * 0.14 +
        liquidityScore * 0.1 +
        (latest.rsi14 !== null ? 4 : 0) +
        (latest.vwap !== null ? 4 : 0) +
        (latest.sma200 !== null ? 5 : 0) +
        (input.traderHorizon === "Scalp" && input.providerQualityScore < 85 ? -8 : 4),
      15,
      98
    )
  );

  const probabilityContinuation = clamp(
    ((trendScore * 0.28 +
      momentumScore * 0.28 +
      tapeScore * 0.22 +
      volumeScore * 0.12 +
      breakoutScore * 0.1) /
      100) *
      100,
    0,
    100
  );

  const scenarioMatrix = [
    {
      name: "Base Case",
      probability: Math.round(probabilityUp * 100),
      target: finalPoint.projected,
      movePct: (finalPoint.projected / currentPrice - 1) * 100,
      trigger: "Price respects VWAP / pivot and volume remains constructive.",
      action:
        setupQuality >= 66
          ? "Plan entry only after confirmation."
          : "Wait for cleaner confirmation.",
    },
    {
      name: "Bull Breakout",
      probability: Math.round(clamp(probabilityContinuation, 5, 95)),
      target: Math.max(target2, finalPoint.bullish),
      movePct: (Math.max(target2, finalPoint.bullish) / currentPrice - 1) * 100,
      trigger: `Break and hold above ${money(resistance)} with volume > 1.25x average.`,
      action: "Watch breakout confirmation and avoid chasing extended candles.",
    },
    {
      name: "Bear Rejection",
      probability: Math.round((1 - probabilityUp) * 100),
      target: Math.min(stopLoss, finalPoint.bearish),
      movePct: (Math.min(stopLoss, finalPoint.bearish) / currentPrice - 1) * 100,
      trigger: `Failure at VWAP/pivot or loss of ${money(support)} support.`,
      action: "Reduce risk, wait, or monitor short-side setup depending on mandate.",
    },
    {
      name: "Range / Chop",
      probability: Math.round(
        clamp(100 - Math.abs(momentumScore - 50) * 1.4, 8, 88)
      ),
      target: pivot,
      movePct: (pivot / currentPrice - 1) * 100,
      trigger: "Low directional follow-through with mixed RSI/MACD and average volume.",
      action: "Prefer smaller size, faster exits, or no trade.",
    },
  ];

  const report = [
    `${input.traderStyle} setup for ${input.traderHorizon.toLowerCase()} trading is graded ${setupGrade(setupQuality)} with a ${setupQuality}/100 setup score.`,
    `Directional bias is ${directionalBias.toLowerCase()} because trend score is ${trendScore}/100, momentum score is ${momentumScore}/100, tape score is ${tapeScore}/100, and volume confirmation is ${volumeScore}/100.`,
    `The model projects ${percent((finalPoint.projected / currentPrice - 1) * 100)} over ${input.horizonSteps} step(s), with a ${input.confidenceLevel}% confidence range from ${money(finalPoint.lower)} to ${money(finalPoint.upper)}.`,
    `Support is estimated near ${money(support)} and resistance near ${money(resistance)}. The tactical entry zone is ${money(entryLow)} to ${money(entryHigh)} with invalidation near ${money(stopLoss)}.`,
    `Risk/reward is approximately ${riskReward1.toFixed(2)}R to target one and ${riskReward2.toFixed(2)}R to target two. A seasoned trader should avoid the setup if confirmation fails or the price violates the invalidation level.`,
    `This is a probabilistic planning tool, not a guarantee or trade instruction. Fresh live data, spread, liquidity, news, and risk controls must be verified before any real trade.`,
  ];

  const executionPlan = [
    "Pre-check: verify the latest tape, news, spread, and volume because stale data ruins short-horizon predictions.",
    "Confirmation: wait for price acceptance near VWAP/pivot and avoid acting while candles are still expanding erratically.",
    "Entry: consider the model entry zone only if the setup still scores above 66 and volume confirms the direction.",
    `Risk: invalidate the setup at ${money(stopLoss)} or if the drawn pattern fails against support/resistance.`,
    `Management: target one is ${money(target1)}. If price reaches target one with strong tape, trail toward ${money(target2)}; if tape weakens, reduce exposure.`,
    "Post-trade: record whether the setup matched trend, pattern, and scenario expectations so future scoring can be improved.",
  ];

  const explanation = [
    "Prediction uses log-return drift, EWMA volatility, ATR, VWAP distance, RSI, MACD histogram, moving-average stack, volume confirmation, tape quality, and support/resistance proximity.",
    "The day-trader score changes depending on selected setup style, so breakout, pullback, mean-reversion, and momentum continuation setups are scored differently.",
    "Volume ratio and VWAP location are weighted more heavily for intraday and scalping decisions because day traders rely on participation and price acceptance.",
    "ATR and recent range expansion drive the stop, target, and scenario bands so tactical levels adjust when volatility expands.",
    "Drawn patterns are compared against recent slope, support/resistance proximity, and price position to show whether the chart sketch aligns with live technical structure.",
  ];

  const dataChecklist: Array<{
  name: string;
  value: string;
  score: number;
  tone: Tone;
}> = [
    {
      name: "Provider Quality",
      value: `${input.providerQualityScore}/100`,
      score: input.providerQualityScore,
      tone: toneFor(input.providerQualityScore),
    },
    {
      name: "Model Confidence",
      value: `${input.backendModelConfidence}/100`,
      score: input.backendModelConfidence,
      tone: toneFor(input.backendModelConfidence),
    },
    {
      name: "Volume Ratio",
      value: `${volumeRatio.toFixed(2)}x`,
      score: volumeScore,
      tone: volumeRatio >= 1.15 ? "green" : volumeRatio < 0.75 ? "red" : "amber",
    },
    {
      name: "VWAP Distance",
      value: rawPercent(vwapDistancePct),
      score: clamp(50 + vwapDistancePct * 8, 0, 100),
      tone: vwapDistancePct >= 0 ? "green" : "red",
    },
    {
      name: "Risk Score",
      value: `${riskScore}/100`,
      score: riskScore,
      tone: riskScore >= 70 ? "green" : riskScore >= 45 ? "amber" : "red",
    },
    {
      name: "Liquidity",
      value: `${liquidityScore}/100`,
      score: liquidityScore,
      tone: liquidityScore >= 70 ? "green" : liquidityScore >= 45 ? "amber" : "red",
    },
  ];

  return {
    currentPrice,
    directionalBias,
    tradeSignal,
    setupGrade: setupGrade(setupQuality),
    setupQuality,
    confidenceLevel: input.confidenceLevel,
    modelQualityScore,
    dataScore: Math.round((input.providerQualityScore + modelQualityScore + liquidityScore) / 3),
    probabilityUp: probabilityUp * 100,
    probabilityDown: (1 - probabilityUp) * 100,
    probabilityContinuation,
    expectedMovePct: (finalPoint.projected / currentPrice - 1) * 100,
    downsideMovePct: (finalPoint.lower / currentPrice - 1) * 100,
    upsideMovePct: (finalPoint.upper / currentPrice - 1) * 100,
    driftPerStep,
    ewmaVolatility: sigma,
    realisedVolatility,
    atrPct,
    atrDollars,
    rangePct: dailyRangePct,
    volumeRatio,
    volumeScore,
    liquidityScore,
    trendScore,
    momentumScore,
    meanReversionScore,
    breakoutScore,
    pullbackScore,
    volatilityScore,
    tapeScore,
    riskScore,
    squeezeScore,
    maStackScore,
    vwapDistancePct,
    bollingerPosition,
    rsi: latest.rsi14,
    macdHistogram,
    support,
    resistance,
    pivot,
    entryLow,
    entryHigh,
    stopLoss,
    target1,
    target2,
    invalidation:
      tradeSignal === "Wait / No Trade"
        ? "No clean tactical setup. Wait for confirmation."
        : longSetup
          ? `Invalidated below ${money(stopLoss)} or if price loses VWAP with weak volume.`
          : shortSetup
            ? `Invalidated above ${money(stopLoss)} or if price reclaims VWAP/resistance.`
            : "Invalidated if price expands against the expected mean-reversion path.",
    riskReward1,
    riskReward2,
    volatilityRegime,
    scenarioMatrix,
    forecast,
    explanation,
    report,
    executionPlan,
    dataChecklist,
  };
}

function defaultPineCode(symbol: string) {
  return `//@version=5
indicator("Slice Trader Overlay - ${symbol.toUpperCase()}", overlay=true, max_lines_count=500, max_labels_count=500)

// Slice-generated Pine project.
// Copy into TradingView Pine Editor.
// Slice Preview can simulate common EMA/VWAP/RSI/MACD/ATR behavior inside this platform.

emaFastLen = input.int(9, "Fast EMA")
emaSlowLen = input.int(21, "Slow EMA")
smaTrendLen = input.int(50, "Trend SMA")
rsiLen = input.int(14, "RSI Length")
atrLen = input.int(14, "ATR Length")
riskAtr = input.float(1.2, "Stop ATR Multiplier")
targetAtr = input.float(2.0, "Target ATR Multiplier")

emaFast = ta.ema(close, emaFastLen)
emaSlow = ta.ema(close, emaSlowLen)
smaTrend = ta.sma(close, smaTrendLen)
rsi = ta.rsi(close, rsiLen)
atr = ta.atr(atrLen)
vwapValue = ta.vwap(hlc3)

trendBull = close > emaFast and emaFast > emaSlow and close > smaTrend
trendBear = close < emaFast and emaFast < emaSlow and close < smaTrend
momentumBull = rsi > 52 and close > vwapValue
momentumBear = rsi < 48 and close < vwapValue

longSetup = trendBull and momentumBull
shortSetup = trendBear and momentumBear

plot(emaFast, "EMA Fast", color=color.new(color.lime, 0), linewidth=2)
plot(emaSlow, "EMA Slow", color=color.new(color.aqua, 0), linewidth=2)
plot(smaTrend, "Trend SMA", color=color.new(color.orange, 0), linewidth=2)
plot(vwapValue, "VWAP", color=color.new(color.purple, 0), linewidth=2)

longStop = close - atr * riskAtr
longTarget = close + atr * targetAtr
shortStop = close + atr * riskAtr
shortTarget = close - atr * targetAtr

plot(longSetup ? longStop : na, "Long Stop", color=color.new(color.red, 0), style=plot.style_linebr)
plot(longSetup ? longTarget : na, "Long Target", color=color.new(color.green, 0), style=plot.style_linebr)
plot(shortSetup ? shortStop : na, "Short Stop", color=color.new(color.red, 0), style=plot.style_linebr)
plot(shortSetup ? shortTarget : na, "Short Target", color=color.new(color.green, 0), style=plot.style_linebr)

plotshape(longSetup, title="Slice Long Watch", style=shape.triangleup, color=color.new(color.green, 0), size=size.small, location=location.belowbar, text="Long")
plotshape(shortSetup, title="Slice Short Watch", style=shape.triangledown, color=color.new(color.red, 0), size=size.small, location=location.abovebar, text="Short")

alertcondition(longSetup, title="Slice Long Watch", message="Slice long watch setup on {{ticker}}")
alertcondition(shortSetup, title="Slice Short Watch", message="Slice short watch setup on {{ticker}}")
`;
}

function generateAiPine(input: {
  symbol: string;
  prompt: string;
  traderStyle: TraderStyle;
  traderHorizon: TraderHorizon;
  prediction: TraderPrediction | null;
}) {
  const prompt = input.prompt.toLowerCase();
  const wantsBreakout =
    prompt.includes("breakout") || input.traderStyle === "Breakout";
  const wantsMeanReversion =
    prompt.includes("mean") ||
    prompt.includes("reversion") ||
    input.traderStyle === "Mean Reversion";
  const wantsPullback =
    prompt.includes("pullback") || input.traderStyle === "Pullback";
  const wantsVWAP =
    prompt.includes("vwap") ||
    input.traderHorizon === "Scalp" ||
    input.traderHorizon === "Intraday";
  const wantsRisk =
    prompt.includes("risk") ||
    prompt.includes("stop") ||
    prompt.includes("target") ||
    Boolean(input.prediction);

  const setupName = wantsBreakout
    ? "Breakout"
    : wantsMeanReversion
      ? "Mean Reversion"
      : wantsPullback
        ? "Pullback"
        : "Momentum";

  const rsiLong = wantsMeanReversion ? 38 : wantsBreakout ? 55 : 52;
  const rsiShort = wantsMeanReversion ? 62 : wantsBreakout ? 45 : 48;

  return `//@version=5
indicator("Slice AI ${setupName} Engine - ${input.symbol.toUpperCase()}", overlay=true, max_lines_count=500, max_labels_count=500)

// Generated inside Slice Market Visuals.
// Purpose: ${input.prompt || `${input.traderStyle} ${input.traderHorizon} setup`}
// Note: Copy into TradingView Pine Editor for native TradingView execution.

emaFastLen = input.int(9, "Fast EMA")
emaSlowLen = input.int(21, "Slow EMA")
trendLen = input.int(50, "Trend SMA")
rsiLen = input.int(14, "RSI Length")
atrLen = input.int(14, "ATR Length")
volLen = input.int(20, "Volume Avg Length")
riskAtr = input.float(${wantsRisk ? "1.2" : "1.0"}, "Stop ATR Multiplier")
targetAtr = input.float(${wantsRisk ? "2.2" : "1.8"}, "Target ATR Multiplier")

emaFast = ta.ema(close, emaFastLen)
emaSlow = ta.ema(close, emaSlowLen)
trendSma = ta.sma(close, trendLen)
rsi = ta.rsi(close, rsiLen)
atr = ta.atr(atrLen)
volAvg = ta.sma(volume, volLen)
volumeConfirm = volume > volAvg * 1.15
${wantsVWAP ? "vwapValue = ta.vwap(hlc3)" : "vwapValue = ta.vwap(hlc3)"}

highestBreak = ta.highest(high, 20)[1]
lowestBreak = ta.lowest(low, 20)[1]

trendBull = close > emaFast and emaFast > emaSlow and close > trendSma
trendBear = close < emaFast and emaFast < emaSlow and close < trendSma
aboveVwap = close > vwapValue
belowVwap = close < vwapValue

breakoutLong = close > highestBreak and volumeConfirm and rsi > ${rsiLong}
breakoutShort = close < lowestBreak and volumeConfirm and rsi < ${rsiShort}

pullbackLong = trendBull and close <= emaFast and close >= emaSlow and rsi > 45 and aboveVwap
pullbackShort = trendBear and close >= emaFast and close <= emaSlow and rsi < 55 and belowVwap

meanRevLong = rsi < 35 and close < emaSlow and close < vwapValue
meanRevShort = rsi > 68 and close > emaSlow and close > vwapValue

longSetup = ${
    wantsBreakout
      ? "breakoutLong"
      : wantsMeanReversion
        ? "meanRevLong"
        : wantsPullback
          ? "pullbackLong"
          : "trendBull and aboveVwap and rsi > 52 and volumeConfirm"
  }
shortSetup = ${
    wantsBreakout
      ? "breakoutShort"
      : wantsMeanReversion
        ? "meanRevShort"
        : wantsPullback
          ? "pullbackShort"
          : "trendBear and belowVwap and rsi < 48 and volumeConfirm"
  }

longStop = close - atr * riskAtr
longTarget = close + atr * targetAtr
shortStop = close + atr * riskAtr
shortTarget = close - atr * targetAtr

plot(emaFast, "EMA Fast", color=color.new(color.lime, 0), linewidth=2)
plot(emaSlow, "EMA Slow", color=color.new(color.aqua, 0), linewidth=2)
plot(trendSma, "Trend SMA", color=color.new(color.orange, 0), linewidth=2)
plot(vwapValue, "VWAP", color=color.new(color.purple, 0), linewidth=2)

plot(longSetup ? longStop : na, "Long Stop", color=color.new(color.red, 0), style=plot.style_linebr)
plot(longSetup ? longTarget : na, "Long Target", color=color.new(color.green, 0), style=plot.style_linebr)
plot(shortSetup ? shortStop : na, "Short Stop", color=color.new(color.red, 0), style=plot.style_linebr)
plot(shortSetup ? shortTarget : na, "Short Target", color=color.new(color.green, 0), style=plot.style_linebr)

plotshape(longSetup, title="Slice AI Long", style=shape.triangleup, color=color.new(color.green, 0), size=size.small, location=location.belowbar, text="AI Long")
plotshape(shortSetup, title="Slice AI Short", style=shape.triangledown, color=color.new(color.red, 0), size=size.small, location=location.abovebar, text="AI Short")

alertcondition(longSetup, title="Slice AI Long", message="Slice AI long setup on {{ticker}}")
alertcondition(shortSetup, title="Slice AI Short", message="Slice AI short setup on {{ticker}}")
`;
}

function evaluatePinePreview(code: string, candles: Candle[]): PinePreview {
  const lower = code.toLowerCase();
  const usesEma = lower.includes("ta.ema") || lower.includes("ema");
  const usesSma = lower.includes("ta.sma") || lower.includes("sma");
  const usesVwap = lower.includes("vwap");
  const usesRsi = lower.includes("ta.rsi") || lower.includes("rsi");
  const usesMacd = lower.includes("ta.macd") || lower.includes("macd");
  const usesAtr = lower.includes("ta.atr") || lower.includes("atr");
  const usesAlerts = lower.includes("alertcondition");
  const usesStrategy = lower.includes("strategy(") || lower.includes("strategy.");

  const previewData = candles.slice(-180).map((candle) => {
    const bull =
      candle.ema9 !== null &&
      candle.ema21 !== null &&
      candle.rsi14 !== null &&
      candle.vwap !== null &&
      candle.close > candle.ema9 &&
      candle.ema9 > candle.ema21 &&
      candle.rsi14 > 52 &&
      candle.close > candle.vwap;

    const bear =
      candle.ema9 !== null &&
      candle.ema21 !== null &&
      candle.rsi14 !== null &&
      candle.vwap !== null &&
      candle.close < candle.ema9 &&
      candle.ema9 < candle.ema21 &&
      candle.rsi14 < 48 &&
      candle.close < candle.vwap;

    return {
      label: candle.label,
      close: candle.close,
      emaFast: usesEma ? candle.ema9 : null,
      emaSlow: usesEma ? candle.ema21 : null,
      vwap: usesVwap ? candle.vwap : null,
      rsi: usesRsi ? candle.rsi14 : null,
      bullSignal: bull ? candle.low : null,
      bearSignal: bear ? candle.high : null,
    };
  });

  const signalCount = previewData.filter(
    (item) => item.bullSignal !== null || item.bearSignal !== null
  ).length;

  const latestPreviewSignal = [...previewData]
    .reverse()
    .find((item) => item.bullSignal || item.bearSignal);

  const latestSignal = latestPreviewSignal
    ? "Recent signal detected"
    : "No recent signal detected";

  const featureScore =
    [usesEma, usesSma, usesVwap, usesRsi, usesMacd, usesAtr, usesAlerts].filter(Boolean)
      .length * 12;

  const previewScore = clamp(
    featureScore +
      (signalCount > 0 ? 12 : 0) +
      (usesStrategy ? -8 : 0),
    0,
    100
  );

  return {
    previewData,
    signalCount,
    latestSignal,
    previewScore,
    warnings: [
      "Slice Preview recognizes common Pine concepts and simulates them using local candle data.",
      "It does not compile arbitrary Pine exactly like TradingView. Copy the script into TradingView for native Pine execution.",
      usesStrategy
        ? "This script appears to use strategy functions. Slice Preview can visualize signals but not a full TradingView broker emulator."
        : "Indicator-style scripts are best for Slice Preview.",
    ],
    features: [
      {
        name: "EMA",
        enabled: usesEma,
        note: usesEma ? "EMA overlay detected." : "No EMA logic detected.",
        tone: usesEma ? "green" : "slate",
      },
      {
        name: "SMA",
        enabled: usesSma,
        note: usesSma ? "SMA logic detected." : "No SMA logic detected.",
        tone: usesSma ? "green" : "slate",
      },
      {
        name: "VWAP",
        enabled: usesVwap,
        note: usesVwap ? "VWAP logic detected." : "No VWAP logic detected.",
        tone: usesVwap ? "green" : "slate",
      },
      {
        name: "RSI",
        enabled: usesRsi,
        note: usesRsi ? "RSI filter detected." : "No RSI filter detected.",
        tone: usesRsi ? "green" : "slate",
      },
      {
        name: "MACD",
        enabled: usesMacd,
        note: usesMacd ? "MACD logic detected." : "No MACD logic detected.",
        tone: usesMacd ? "green" : "slate",
      },
      {
        name: "ATR",
        enabled: usesAtr,
        note: usesAtr ? "ATR risk logic detected." : "No ATR logic detected.",
        tone: usesAtr ? "green" : "slate",
      },
      {
        name: "Alerts",
        enabled: usesAlerts,
        note: usesAlerts ? "Alert conditions detected." : "No alert conditions detected.",
        tone: usesAlerts ? "green" : "amber",
      },
    ],
  };
}

function buildOptionScenario(input: {
  strategy: OptionStrategy;
  currentPrice: number;
  strike: number;
  premium: number;
  strike2: number;
  premium2: number;
  contracts: number;
}): OptionScenario {
  const multiplier = 100;
  const contracts = Math.max(1, input.contracts || 1);
  const start = input.currentPrice * 0.75;
  const end = input.currentPrice * 1.25;
  const step = (end - start) / 40;

  const payoffPerShare = (price: number) => {
    const call = Math.max(price - input.strike, 0);
    const put = Math.max(input.strike - price, 0);
    const call2 = Math.max(price - input.strike2, 0);
    const put2 = Math.max(input.strike2 - price, 0);

    if (input.strategy === "Long Call") return call - input.premium;
    if (input.strategy === "Long Put") return put - input.premium;
    if (input.strategy === "Bull Call Spread") {
      return call - call2 - (input.premium - input.premium2);
    }
    if (input.strategy === "Bear Put Spread") {
      return put - put2 - (input.premium - input.premium2);
    }
    if (input.strategy === "Protective Put") {
      return price - input.currentPrice + put - input.premium;
    }
    if (input.strategy === "Covered Call") {
      return price - input.currentPrice - call + input.premium;
    }

    return 0;
  };

  const payoffData = Array.from({ length: 41 }).map((_, index) => {
    const price = start + step * index;
    const perShare = payoffPerShare(price);
    const profit = perShare * multiplier * contracts;

    return {
      price,
      profit,
      intrinsic: perShare,
    };
  });

  const profits = payoffData.map((point) => point.profit);
  const finiteMax = Math.max(...profits);
  const finiteMin = Math.min(...profits);
  const debit = input.premium - input.premium2;

  const breakeven =
    input.strategy === "Long Call"
      ? input.strike + input.premium
      : input.strategy === "Long Put"
        ? input.strike - input.premium
        : input.strategy === "Bull Call Spread"
          ? input.strike + debit
          : input.strategy === "Bear Put Spread"
            ? input.strike - debit
            : input.strategy === "Protective Put"
              ? input.currentPrice + input.premium
              : input.currentPrice - input.premium;

  const maxLossText =
    input.strategy === "Long Call" || input.strategy === "Long Put"
      ? money(input.premium * multiplier * contracts)
      : input.strategy === "Bull Call Spread" || input.strategy === "Bear Put Spread"
        ? money(Math.max(debit, 0) * multiplier * contracts)
        : input.strategy === "Covered Call"
          ? "Large downside if stock falls materially"
          : "Limited by stock downside offset by put floor";

  const maxProfitText =
    input.strategy === "Long Call"
      ? "Theoretical unlimited"
      : input.strategy === "Long Put"
        ? money(Math.max(input.strike - input.premium, 0) * multiplier * contracts)
        : input.strategy === "Bull Call Spread"
          ? money(Math.max(input.strike2 - input.strike - debit, 0) * multiplier * contracts)
          : input.strategy === "Bear Put Spread"
            ? money(Math.max(input.strike - input.strike2 - debit, 0) * multiplier * contracts)
            : input.strategy === "Covered Call"
              ? money(Math.max(input.strike - input.currentPrice + input.premium, 0) * multiplier * contracts)
              : "Stock upside remains, put protects downside";

  return {
    strategy: input.strategy,
    contractMultiplier: multiplier,
    contracts,
    netPremium: debit,
    breakeven,
    maxLossText,
    maxProfitText,
    payoffData,
    summary: [
      `${input.strategy} scenario uses ${contracts} contract(s), ${multiplier} multiplier, primary strike ${money(input.strike)}, and premium ${money(input.premium)}.`,
      `Estimated breakeven is ${money(breakeven)}. The finite payoff range in this simulator spans approximately ${money(finiteMin)} to ${money(finiteMax)} across the displayed price range.`,
      "This is an educational payoff model. It does not include bid/ask spreads, assignment risk, early exercise, implied volatility changes, slippage, commissions, or tax effects.",
    ],
  };
}

function buildFallbackOpportunityMatrix(
  prediction: TraderPrediction | null,
  patternScore: number,
  symbol: string,
  pinePreviewScore: number
) {
  if (!prediction) return [];

  return [
    {
      name: "Breakout",
      title: `${symbol} breakout setup`,
      opportunity: prediction.breakoutScore,
      risk: 100 - prediction.riskScore,
      composite: Math.round(
        prediction.breakoutScore * 0.4 +
          prediction.volumeScore * 0.22 +
          patternScore * 0.16 +
          prediction.modelQualityScore * 0.12 +
          pinePreviewScore * 0.1
      ),
      confidence: prediction.modelQualityScore,
      source: "Slice Predictive Engine",
    },
    {
      name: "Pullback",
      title: `${symbol} pullback entry`,
      opportunity: prediction.pullbackScore,
      risk: 100 - prediction.riskScore,
      composite: Math.round(
        prediction.pullbackScore * 0.42 +
          prediction.trendScore * 0.18 +
          prediction.riskScore * 0.18 +
          patternScore * 0.12 +
          pinePreviewScore * 0.1
      ),
      confidence: prediction.modelQualityScore,
      source: "Slice Predictive Engine",
    },
    {
      name: "MeanRev",
      title: `${symbol} mean reversion`,
      opportunity: prediction.meanReversionScore,
      risk: prediction.volatilityScore,
      composite: Math.round(
        prediction.meanReversionScore * 0.46 +
          prediction.riskScore * 0.22 +
          prediction.tapeScore * 0.14 +
          patternScore * 0.1 +
          pinePreviewScore * 0.08
      ),
      confidence: prediction.dataScore,
      source: "Slice Predictive Engine",
    },
    {
      name: "Pine",
      title: `${symbol} Pine preview quality`,
      opportunity: pinePreviewScore,
      risk: 100 - prediction.riskScore,
      composite: Math.round(
        pinePreviewScore * 0.45 +
          prediction.setupQuality * 0.25 +
          patternScore * 0.15 +
          prediction.modelQualityScore * 0.15
      ),
      confidence: prediction.modelQualityScore,
      source: "Slice Pine Preview",
    },
    {
      name: "Options",
      title: `${symbol} options scenario`,
      opportunity: prediction.probabilityUp,
      risk: prediction.atrPct * 8,
      composite: Math.round(
        prediction.probabilityContinuation * 0.35 +
          prediction.setupQuality * 0.35 +
          prediction.modelQualityScore * 0.3
      ),
      confidence: prediction.modelQualityScore,
      source: "Slice Options Lab",
    },
  ];
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs text-slate-500">{helper}</div>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-xs text-white shadow-xl shadow-black/40">
      <div className="mb-2 font-black text-slate-200">{label}</div>
      <div className="grid gap-1">
        {payload.map((item: any, index: number) => (
          <div
            key={`${item.dataKey}-${index}`}
            className="flex items-center justify-between gap-5"
          >
            <span className="flex items-center gap-2 text-slate-400">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    item.color || item.fill || BAR_COLORS[index % BAR_COLORS.length],
                }}
              />
              {item.name || item.dataKey}
            </span>
            <span className="font-black text-white">
              {typeof item.value === "number"
                ? item.value.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })
                : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({
  label = "No chart data available yet.",
}: {
  label?: string;
}) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm font-bold text-slate-500">
      {label}
    </div>
  );
}

function TradingViewEmbed({
  symbol,
  interval,
}: {
  symbol: string;
  interval: string;
}) {
  const mappedInterval =
    interval === "daily"
      ? "D"
      : interval === "60min"
        ? "60"
        : interval === "30min"
          ? "30"
          : interval === "15min"
            ? "15"
            : interval === "5min"
              ? "5"
              : "1";

  const tvSymbol = symbol.includes(":") ? symbol : `NASDAQ:${symbol}`;

  const src = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=${mappedInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0F0F0F&studies=%5B%5D&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&utm_source=slice&utm_medium=widget&utm_campaign=chart`;

  return (
    <iframe
      title="TradingView Chart"
      src={src}
      className="h-[720px] w-full rounded-[1.5rem] border border-white/10 bg-black"
      allowFullScreen
    />
  );
}

function drawPattern(pattern: PatternOverlay, isDraft = false) {
  const opacity = isDraft ? 0.68 : 1;
  const strokeDasharray = isDraft ? "8 6" : undefined;
  const color = pattern.color;

  if (pattern.type === "support" || pattern.type === "resistance") {
    return (
      <g key={pattern.id} opacity={opacity}>
        <line
          x1="0%"
          x2="100%"
          y1={`${pattern.start.y}%`}
          y2={`${pattern.start.y}%`}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={strokeDasharray}
        />
        <text
          x="1.5%"
          y={`${Math.max(4, pattern.start.y - 1)}%`}
          fill={color}
          fontSize="11"
          fontWeight="900"
        >
          {pattern.label}
        </text>
      </g>
    );
  }

  if (pattern.type === "zone") {
    const x = Math.min(pattern.start.x, pattern.end.x);
    const y = Math.min(pattern.start.y, pattern.end.y);
    const width = Math.abs(pattern.start.x - pattern.end.x);
    const height = Math.abs(pattern.start.y - pattern.end.y);

    return (
      <g key={pattern.id} opacity={opacity}>
        <rect
          x={`${x}%`}
          y={`${y}%`}
          width={`${Math.max(width, 1)}%`}
          height={`${Math.max(height, 1)}%`}
          fill={color}
          fillOpacity={0.12}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={strokeDasharray}
          rx="10"
        />
        <text
          x={`${x + 1}%`}
          y={`${Math.max(4, y + 4)}%`}
          fill={color}
          fontSize="11"
          fontWeight="900"
        >
          {pattern.label}
        </text>
      </g>
    );
  }

  if (pattern.type === "channel") {
    const offset = 10;
    return (
      <g key={pattern.id} opacity={opacity}>
        <line
          x1={`${pattern.start.x}%`}
          y1={`${pattern.start.y}%`}
          x2={`${pattern.end.x}%`}
          y2={`${pattern.end.y}%`}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={strokeDasharray}
        />
        <line
          x1={`${pattern.start.x}%`}
          y1={`${clamp(pattern.start.y + offset, 0, 100)}%`}
          x2={`${pattern.end.x}%`}
          y2={`${clamp(pattern.end.y + offset, 0, 100)}%`}
          stroke={color}
          strokeWidth={1.6}
          strokeDasharray="8 6"
        />
        <text
          x={`${Math.min(pattern.start.x, pattern.end.x)}%`}
          y={`${Math.max(4, Math.min(pattern.start.y, pattern.end.y) - 1)}%`}
          fill={color}
          fontSize="11"
          fontWeight="900"
        >
          {pattern.label}
        </text>
      </g>
    );
  }

  return (
    <g key={pattern.id} opacity={opacity}>
      <line
        x1={`${pattern.start.x}%`}
        y1={`${pattern.start.y}%`}
        x2={`${pattern.end.x}%`}
        y2={`${pattern.end.y}%`}
        stroke={color}
        strokeWidth={pattern.type === "arrow" ? 2.5 : 2}
        strokeDasharray={strokeDasharray}
      />
      <circle cx={`${pattern.start.x}%`} cy={`${pattern.start.y}%`} r="4" fill={color} />
      <circle
        cx={`${pattern.end.x}%`}
        cy={`${pattern.end.y}%`}
        r={pattern.type === "arrow" ? "6" : "4"}
        fill={color}
      />
      <text
        x={`${Math.min(pattern.start.x, pattern.end.x)}%`}
        y={`${Math.max(4, Math.min(pattern.start.y, pattern.end.y) - 1)}%`}
        fill={color}
        fontSize="11"
        fontWeight="900"
      >
        {pattern.label}
      </text>
    </g>
  );
}

function analyzePatterns(
  patterns: PatternOverlay[],
  candles: Candle[],
  currentPrice: number | null | undefined,
  atrDollars: number | null | undefined
): PatternAnalysis[] {
  if (!candles.length || !currentPrice) return [];

  const prices = candles.flatMap((item) => [
    item.close,
    item.high,
    item.low,
    item.vwap ?? item.close,
    item.sma20 ?? item.close,
    item.sma50 ?? item.close,
  ]);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = Math.max(maxPrice - minPrice, 0.0001);

  const yToPrice = (y: number) => maxPrice - (y / 100) * priceRange;
  const xToIndex = (x: number) => (x / 100) * Math.max(candles.length - 1, 1);

  const closes = candles.map((item) => item.close);
  const recentLogCloses = closes.slice(-24).map((item) => Math.log(item));
  const recentSlopePct = Math.exp(regressionSlope(recentLogCloses)) - 1;
  const atr = atrDollars ?? currentPrice * 0.015;

  return patterns.map((pattern) => {
    if (pattern.type === "support" || pattern.type === "resistance") {
      const level = yToPrice(pattern.start.y);
      const distancePct = ((currentPrice - level) / currentPrice) * 100;
      const touches = candles
        .slice(-80)
        .filter((item) => Math.abs(item.close - level) <= atr * 0.65).length;
      const near = Math.abs(currentPrice - level) <= atr * 1.2;

      const matchScore = Math.round(
        clamp(
          42 + touches * 9 + (near ? 24 : 0) - Math.min(Math.abs(distancePct) * 2, 25),
          0,
          100
        )
      );

      const status =
        pattern.type === "support"
          ? currentPrice >= level
            ? "Support below price"
            : "Support broken"
          : currentPrice <= level
            ? "Resistance above price"
            : "Resistance reclaimed";

      return {
        id: pattern.id,
        label: pattern.label,
        type: pattern.type,
        levelText: `${money(level)} · ${rawPercent(distancePct)} from price`,
        matchScore,
        status,
        explanation: `${touches} recent touch(es) within ATR proximity. ${
          near ? "Price is near this drawn level." : "Price is not currently near the level."
        }`,
        tone: matchScore >= 75 ? "green" : matchScore >= 55 ? "amber" : "red",
      };
    }

    if (pattern.type === "zone") {
      const top = yToPrice(Math.min(pattern.start.y, pattern.end.y));
      const bottom = yToPrice(Math.max(pattern.start.y, pattern.end.y));
      const inZone = currentPrice <= top && currentPrice >= bottom;
      const distanceToZone = inZone
        ? 0
        : Math.min(Math.abs(currentPrice - top), Math.abs(currentPrice - bottom));
      const distancePct = (distanceToZone / currentPrice) * 100;
      const overlapTouches = candles
        .slice(-80)
        .filter((item) => item.close <= top && item.close >= bottom).length;

      const matchScore = Math.round(
        clamp(44 + overlapTouches * 5 + (inZone ? 28 : 0) - Math.min(distancePct * 3, 25), 0, 100)
      );

      return {
        id: pattern.id,
        label: pattern.label,
        type: pattern.type,
        levelText: `${money(bottom)} - ${money(top)}`,
        matchScore,
        status: inZone ? "Price inside zone" : "Price outside zone",
        explanation: `${overlapTouches} recent candle close(s) inside this drawn supply/demand zone.`,
        tone: matchScore >= 75 ? "green" : matchScore >= 55 ? "amber" : "purple",
      };
    }

    const startPrice = yToPrice(pattern.start.y);
    const endPrice = yToPrice(pattern.end.y);
    const startIndex = xToIndex(pattern.start.x);
    const endIndex = xToIndex(pattern.end.x);
    const stepDistance = Math.max(Math.abs(endIndex - startIndex), 1);
    const drawnSlopePct = (endPrice / Math.max(startPrice, 0.0001) - 1) / stepDistance;
    const slopeGap = Math.abs(drawnSlopePct - recentSlopePct);

    const directionMatches =
      Math.sign(drawnSlopePct) === Math.sign(recentSlopePct) ||
      Math.abs(recentSlopePct) < 0.0004;

    const matchScore = Math.round(
      clamp(
        82 -
          slopeGap * 9000 +
          (directionMatches ? 12 : -18) +
          (pattern.type === "channel" ? 6 : 0),
        0,
        100
      )
    );

    return {
      id: pattern.id,
      label: pattern.label,
      type: pattern.type,
      levelText: `${rawPercent(drawnSlopePct * 100, 4)} per step`,
      matchScore,
      status: directionMatches ? "Slope aligns" : "Slope diverges",
      explanation:
        "Drawn slope is compared against recent regression slope. Lower gap means the sketched angle better matches the current price path.",
      tone: matchScore >= 75 ? "green" : matchScore >= 55 ? "amber" : "red",
    };
  });
}

export default function MarketVisualsPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const [compareSymbol, setCompareSymbol] = useState("AAPL");
  const [showCompare, setShowCompare] = useState(false);
  const [interval, setInterval] = useState("daily");
  const [view, setView] = useState<ViewMode>("prediction");
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(95);
  const [horizonSteps, setHorizonSteps] = useState<HorizonSteps>(20);
  const [traderStyle, setTraderStyle] = useState<TraderStyle>("Momentum Continuation");
  const [traderHorizon, setTraderHorizon] = useState<TraderHorizon>("Intraday");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("Balanced");
  const [catalystText, setCatalystText] = useState("");
  const [data, setData] = useState<MarketVisualPayload | null>(null);
  const [compareData, setCompareData] = useState<MarketVisualPayload | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("trendline");
  const [patternLabel, setPatternLabel] = useState("");
  const [patterns, setPatterns] = useState<PatternOverlay[]>([]);
  const [draftPattern, setDraftPattern] = useState<PatternOverlay | null>(null);
  const [patternOpacity, setPatternOpacity] = useState(88);
  const drawBoxRef = useRef<HTMLDivElement | null>(null);

  const [pineProjects, setPineProjects] = useState<PineProject[]>([]);
  const [pineProjectName, setPineProjectName] = useState("Slice Trader Overlay");
  const [pineProjectNotes, setPineProjectNotes] = useState("");
  const [pineCode, setPineCode] = useState(defaultPineCode(symbol));
  const [pinePrompt, setPinePrompt] = useState("");
  const [pineSidePanelOpen, setPineSidePanelOpen] = useState(true);
  const [pinePreviewOpen, setPinePreviewOpen] = useState(true);

  const [optionStrategy, setOptionStrategy] = useState<OptionStrategy>("Long Call");
  const [optionStrike, setOptionStrike] = useState(0);
  const [optionPremium, setOptionPremium] = useState(2.5);
  const [optionStrike2, setOptionStrike2] = useState(0);
  const [optionPremium2, setOptionPremium2] = useState(1);
  const [optionContracts, setOptionContracts] = useState(1);

  async function fetchVisuals(nextSymbol: string, nextInterval: string) {
    const params = new URLSearchParams({
      symbol: nextSymbol,
      interval: nextInterval,
    });

    const response = await fetch(`/api/market-visuals?${params.toString()}`, {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? `Could not load ${nextSymbol}.`);
    }

    return payload as MarketVisualPayload;
  }

  async function loadVisuals(nextSymbol = symbol, nextInterval = interval) {
    setLoading(true);
    setMessage("");

    try {
      const primary = await fetchVisuals(nextSymbol.toUpperCase(), nextInterval);
      setData(primary);

      if (showCompare && compareSymbol.trim()) {
        const comparison = await fetchVisuals(compareSymbol.toUpperCase(), nextInterval);
        setCompareData(comparison);
      } else {
        setCompareData(null);
      }

      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load market visuals."
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void loadVisuals(symbol.toUpperCase(), interval);
  }

  useEffect(() => {
    void loadVisuals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const id = window.setInterval(
      () => {
        void loadVisuals(symbol.toUpperCase(), interval);
      },
      interval === "daily" ? 300000 : 60000
    );

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, interval, symbol, showCompare, compareSymbol]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`slice-market-patterns:${symbol.toUpperCase()}`);
      setPatterns(raw ? JSON.parse(raw) : []);
    } catch {
      setPatterns([]);
    }
  }, [symbol]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `slice-market-patterns:${symbol.toUpperCase()}`,
        JSON.stringify(patterns)
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [patterns, symbol]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("slice-market-pine-projects");
      setPineProjects(raw ? JSON.parse(raw) : []);
    } catch {
      setPineProjects([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("slice-market-pine-projects", JSON.stringify(pineProjects));
    } catch {
      // Ignore local storage failures.
    }
  }, [pineProjects]);

  const latest = data?.latest ?? null;
  const currentPrice = latest?.chartClose ?? data?.quote?.price ?? 100;

  useEffect(() => {
    if (!optionStrike && currentPrice) {
      setOptionStrike(Math.round(currentPrice));
      setOptionStrike2(Math.round(currentPrice * 1.05));
    }
  }, [currentPrice, optionStrike]);

  const chartData = useMemo(() => data?.candles.slice(-260) ?? [], [data]);
  const visibleChartData = useMemo(() => chartData.slice(-220), [chartData]);

  const traderPrediction = useMemo(
    () =>
      data
        ? buildTraderPrediction({
            candles: data.candles,
            confidenceLevel,
            horizonSteps,
            providerQualityScore: data.quality.score,
            backendModelConfidence: data.modelConfidence,
            traderStyle,
            traderHorizon,
            riskProfile,
            catalystText,
          })
        : null,
    [
      data,
      confidenceLevel,
      horizonSteps,
      traderStyle,
      traderHorizon,
      riskProfile,
      catalystText,
    ]
  );

  const predictionChartData = useMemo<ForecastChartPoint[]>(() => {
    const history: ForecastChartPoint[] = visibleChartData.slice(-70).map((item) => ({
      label: item.label,
      close: item.close,
      projected: null,
      lower: null,
      upper: null,
      bearish: null,
      bullish: null,
    }));

    const forecast: ForecastChartPoint[] =
      traderPrediction?.forecast.map((item) => ({
        label: item.label,
        close: null,
        projected: item.projected,
        lower: item.lower,
        upper: item.upper,
        bearish: item.bearish,
        bullish: item.bullish,
      })) ?? [];

    return [...history, ...forecast];
  }, [visibleChartData, traderPrediction]);

  const technicalScoreData = useMemo(() => {
    if (!traderPrediction) return [];

    return [
      { name: "Trend", score: traderPrediction.trendScore },
      { name: "Momentum", score: traderPrediction.momentumScore },
      { name: "Volume", score: traderPrediction.volumeScore },
      { name: "Tape", score: traderPrediction.tapeScore },
      { name: "Breakout", score: traderPrediction.breakoutScore },
      { name: "Pullback", score: traderPrediction.pullbackScore },
      { name: "Mean Rev", score: traderPrediction.meanReversionScore },
      { name: "Risk", score: traderPrediction.riskScore },
    ];
  }, [traderPrediction]);

  const compareOverlayData = useMemo(() => {
    if (!data || !compareData) return [];

    const primary = data.candles.slice(-160);
    const compare = compareData.candles.slice(-160);
    const length = Math.min(primary.length, compare.length);
    const p = primary.slice(primary.length - length);
    const c = compare.slice(compare.length - length);

    const pBase = p[0]?.close || 1;
    const cBase = c[0]?.close || 1;

    return p.map((point, index) => ({
      label: point.label,
      primaryReturnPct: (point.close / pBase - 1) * 100,
      compareReturnPct: ((c[index]?.close ?? cBase) / cBase - 1) * 100,
      spreadPct:
        (point.close / pBase - 1) * 100 -
        (((c[index]?.close ?? cBase) / cBase - 1) * 100),
    }));
  }, [data, compareData]);

  const latestCandleRows = useMemo(() => {
    return [...visibleChartData].reverse().slice(0, 80);
  }, [visibleChartData]);

  const patternAnalysis = useMemo(() => {
    return analyzePatterns(
      patterns,
      visibleChartData,
      latest?.chartClose ?? data?.quote?.price,
      traderPrediction?.atrDollars
    );
  }, [
    patterns,
    visibleChartData,
    latest?.chartClose,
    data?.quote?.price,
    traderPrediction?.atrDollars,
  ]);

  const patternScore = useMemo(() => {
    return patternAnalysis.length
      ? Math.round(mean(patternAnalysis.map((item) => item.matchScore)))
      : 0;
  }, [patternAnalysis]);

  const pinePreview = useMemo(() => {
    return evaluatePinePreview(pineCode, visibleChartData);
  }, [pineCode, visibleChartData]);

  const optionScenario = useMemo(
    () =>
      buildOptionScenario({
        strategy: optionStrategy,
        currentPrice,
        strike: optionStrike || Math.round(currentPrice),
        premium: optionPremium,
        strike2: optionStrike2 || Math.round(currentPrice * 1.05),
        premium2: optionPremium2,
        contracts: optionContracts,
      }),
    [
      optionStrategy,
      currentPrice,
      optionStrike,
      optionPremium,
      optionStrike2,
      optionPremium2,
      optionContracts,
    ]
  );

  const opportunityMatrixData = useMemo(() => {
    if (data?.platform.opportunityMatrix?.length) return data.platform.opportunityMatrix;
    return buildFallbackOpportunityMatrix(
      traderPrediction,
      patternScore,
      data?.symbol ?? symbol,
      pinePreview.previewScore
    );
  }, [data, traderPrediction, patternScore, pinePreview.previewScore, symbol]);

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>): PointPct | null {
    const rect = drawBoxRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawMode) return;

    const point = pointFromEvent(event);
    if (!point) return;

    const label =
      patternLabel.trim() ||
      (drawTool === "support"
        ? "Support"
        : drawTool === "resistance"
          ? "Resistance"
          : drawTool === "zone"
            ? "Supply / Demand Zone"
            : drawTool === "channel"
              ? "Channel"
              : drawTool === "arrow"
                ? "Expected Move"
                : "Trendline");

    const pattern: PatternOverlay = {
      id: `pattern-${Date.now()}`,
      type: drawTool,
      label,
      color: PATTERN_COLORS[drawTool],
      start: point,
      end: point,
      createdAt: new Date().toISOString(),
    };

    setDraftPattern(pattern);
  }

  function moveDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawMode || !draftPattern) return;
    const point = pointFromEvent(event);
    if (!point) return;

    setDraftPattern((current) => (current ? { ...current, end: point } : current));
  }

  function endDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawMode || !draftPattern) return;
    const point = pointFromEvent(event);
    if (!point) return;

    const finalPattern = { ...draftPattern, end: point };
    setPatterns((current) => [finalPattern, ...current].slice(0, 40));
    setDraftPattern(null);
    setMessage(`${finalPattern.label} overlay saved.`);
  }

  function clearPatterns() {
    setPatterns([]);
    setDraftPattern(null);
    setMessage("Pattern overlays cleared.");
  }

  function removePattern(id: string) {
    setPatterns((current) => current.filter((pattern) => pattern.id !== id));
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Copy failed. Select and copy manually.");
    }
  }

  function savePineProject() {
    const now = new Date().toISOString();
    const project: PineProject = {
      id: `pine-${Date.now()}`,
      name: pineProjectName.trim() || `${symbol.toUpperCase()} Pine Project`,
      symbol: symbol.toUpperCase(),
      notes: pineProjectNotes,
      code: pineCode,
      createdAt: now,
      updatedAt: now,
    };

    setPineProjects((current) => [project, ...current].slice(0, 50));
    setMessage("Pine project saved locally.");
  }

  function loadPineProject(project: PineProject) {
    setPineProjectName(project.name);
    setPineProjectNotes(project.notes);
    setPineCode(project.code);
    setMessage(`${project.name} loaded.`);
  }

  function deletePineProject(id: string) {
    setPineProjects((current) => current.filter((project) => project.id !== id));
    setMessage("Pine project deleted.");
  }

  function resetPineTemplate() {
    setPineCode(defaultPineCode(symbol));
    setPineProjectName("Slice Trader Overlay");
    setPineProjectNotes("");
  }

  function generatePineCode() {
    const generated = generateAiPine({
      symbol,
      prompt: pinePrompt,
      traderStyle,
      traderHorizon,
      prediction: traderPrediction,
    });

    setPineCode(generated);
    setPineProjectName(`Slice AI ${traderStyle} - ${symbol.toUpperCase()}`);
    setMessage("AI Pine script generated inside Slice.");
  }

  function renderTradingSafety() {
    return (
      <Card>
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Trading Safety Layer
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This cockpit is for research, visualization, and trader/advisor planning only. Options scenarios are simplified educational payoff models. Pine Preview simulates common Pine concepts locally and does not replace TradingView’s native Pine runtime. Nothing here is a trade instruction, guarantee, or client recommendation.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/workspace"
              className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10"
            >
              Workspace
            </a>
            <a
              href="/opportunity-radar"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20"
            >
              Opportunity Radar
            </a>
            <a
              href="/workspace/client-emails"
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
            >
              Client Emails
            </a>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.46),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.20),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1800px] gap-5">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/72 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                Slice Market Visuals
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                TradingView cockpit with Pine Studio side panel
              </h1>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-400">
                View TradingView, generate Pine scripts, save projects, simulate common Pine logic inside Slice, model options payoff, and keep trader-grade predictive analysis in one professional workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <a
                href="/workspace"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:scale-[1.01]"
              >
                ← Main Workspace
              </a>

              <form onSubmit={submit} className="grid gap-2 md:grid-cols-[120px_120px_145px_auto]">
                <input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                  placeholder="Symbol"
                />

                <select
                  value={interval}
                  onChange={(event) => setInterval(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="60min">60 Min</option>
                  <option value="30min">30 Min</option>
                  <option value="15min">15 Min</option>
                  <option value="5min">5 Min</option>
                  <option value="1min">1 Min</option>
                </select>

                <button
                  type="button"
                  onClick={() => setAutoRefresh((current) => !current)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-sm font-black",
                    autoRefresh
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                      : "border border-white/10 bg-white/[0.055] text-white"
                  )}
                >
                  {autoRefresh ? "Auto Refresh On" : "Auto Refresh Off"}
                </button>

                <button
                  disabled={loading}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Run Analysis"}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cx(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                  view === tab.id
                    ? "bg-gradient-to-r from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-red-600/14 via-cyan-500/5 to-transparent" />

          <div className="relative grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone={toneFor(data?.freshness.status ?? "loading")}>
                  {data?.freshness.status ?? "Loading"}
                </Pill>
                <Pill tone={toneFor(data?.marketSession.session ?? "session")}>
                  {data?.marketSession.session ?? "Market Session"}
                </Pill>
                <Pill tone={data?.isLive ? "green" : "amber"}>
                  {data?.provider ?? "Provider"}
                </Pill>
                <Pill tone={toneFor(traderPrediction?.tradeSignal ?? "forecast")}>
                  {traderPrediction?.tradeSignal ?? "Prediction Engine"}
                </Pill>
                <Pill tone="cyan">{patterns.length} overlay(s)</Pill>
                <Pill tone="purple">{pineProjects.length} Pine project(s)</Pill>
              </div>

              <h2 className="mt-4 text-5xl font-black tracking-tight md:text-7xl">
                {data?.symbol ?? symbol}
              </h2>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                {traderPrediction
                  ? traderPrediction.report[0]
                  : "Load a symbol to generate a predictive day-trader analysis using price, volume, VWAP, RSI, MACD, ATR, moving averages, support/resistance, volatility regime, pattern overlays, Pine Preview, and source quality."}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Current Price"
                  value={money(latest?.chartClose ?? data?.quote?.price ?? null)}
                  helper={percent(data?.quote?.changePct ?? latest?.changePct)}
                  tone={changeTone(data?.quote?.changePct ?? latest?.changePct)}
                />
                <Metric
                  label="Prediction"
                  value={traderPrediction ? percent(traderPrediction.expectedMovePct) : "—"}
                  helper={`${horizonSteps} step expected move`}
                  tone={changeTone(traderPrediction?.expectedMovePct)}
                />
                <Metric
                  label="Pine Preview"
                  value={`${pinePreview.previewScore}/100`}
                  helper={pinePreview.latestSignal}
                  tone={toneFor(pinePreview.previewScore)}
                />
                <Metric
                  label="Setup Grade"
                  value={traderPrediction?.setupGrade ?? "—"}
                  helper={traderPrediction ? `${traderPrediction.setupQuality}/100 setup` : "No setup yet"}
                  tone={toneFor(traderPrediction?.setupQuality ?? 0)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Entry Zone
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {traderPrediction
                    ? `${money(traderPrediction.entryLow)} - ${money(traderPrediction.entryHigh)}`
                    : "—"}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Tactical planning zone. Wait for confirmation before action.
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Stop / Target
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {traderPrediction
                    ? `${money(traderPrediction.stopLoss)} / ${money(traderPrediction.target1)}`
                    : "—"}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  ATR-adjusted levels. Not a trade instruction.
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Pattern Match
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {patternAnalysis.length ? `${patternScore}/100` : "—"}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Average fit between drawings and current structure.
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Options Breakeven
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {money(optionScenario.breakeven)}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {optionStrategy} · {optionContracts} contract(s)
                </p>
              </SoftCard>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            eyebrow="Prediction Controls"
            title="Tune the trading model."
            description="Adjust confidence band, forecast horizon, trading style, risk profile, catalyst context, drawing behavior, Pine Preview, and comparison mode."
            action={<Pill tone="purple">{traderStyle}</Pill>}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select
              value={traderStyle}
              onChange={(event) => setTraderStyle(event.target.value as TraderStyle)}
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
            >
              <option>Momentum Continuation</option>
              <option>Breakout</option>
              <option>Pullback</option>
              <option>Mean Reversion</option>
              <option>Gap / Fade</option>
              <option>Risk-Off Defense</option>
            </select>

            <select
              value={traderHorizon}
              onChange={(event) => setTraderHorizon(event.target.value as TraderHorizon)}
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
            >
              <option>Scalp</option>
              <option>Intraday</option>
              <option>Swing</option>
            </select>

            <select
              value={riskProfile}
              onChange={(event) => setRiskProfile(event.target.value as RiskProfile)}
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
            >
              <option>Conservative</option>
              <option>Balanced</option>
              <option>Aggressive</option>
            </select>

            <select
              value={confidenceLevel}
              onChange={(event) =>
                setConfidenceLevel(Number(event.target.value) as ConfidenceLevel)
              }
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
            >
              <option value={68}>68% Band</option>
              <option value={80}>80% Band</option>
              <option value={90}>90% Band</option>
              <option value={95}>95% Band</option>
              <option value={99}>99% Band</option>
            </select>

            <select
              value={horizonSteps}
              onChange={(event) =>
                setHorizonSteps(Number(event.target.value) as HorizonSteps)
              }
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
            >
              <option value={5}>5 steps</option>
              <option value={10}>10 steps</option>
              <option value={20}>20 steps</option>
              <option value={30}>30 steps</option>
            </select>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white">
              Pine Panel
              <input
                type="checkbox"
                checked={pineSidePanelOpen}
                onChange={(event) => setPineSidePanelOpen(event.target.checked)}
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[170px_170px_1fr]">
            <input
              value={compareSymbol}
              onChange={(event) => setCompareSymbol(event.target.value.toUpperCase())}
              className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
              placeholder="Compare"
            />

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white">
              Compare
              <input
                type="checkbox"
                checked={showCompare}
                onChange={(event) => setShowCompare(event.target.checked)}
              />
            </label>

            <textarea
              value={catalystText}
              onChange={(event) => setCatalystText(event.target.value)}
              className="min-h-12 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              placeholder="Optional catalyst context: earnings, guidance, Fed event, AI demand, upgrade, product launch, litigation, sector news..."
            />
          </div>
        </Card>

        {view === "prediction" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
            <Card>
              <SectionHeader
                eyebrow="Probabilistic Prediction"
                title="Expected path with confidence bands."
                description="History, projected path, bearish/bullish internal scenarios, and confidence envelope."
                action={
                  <Pill tone={toneFor(traderPrediction?.volatilityRegime ?? "forecast")}>
                    {traderPrediction?.volatilityRegime ?? "Volatility"}
                  </Pill>
                }
              />

              <div className="mt-5 h-[520px]">
                {predictionChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={predictionChartData}>
                      <defs>
                        <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} minTickGap={18} />
                      <YAxis stroke="#64748b" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="close"
                        name="Historical Close"
                        stroke="#ef4444"
                        fill="url(#closeFill)"
                        strokeWidth={3}
                        connectNulls
                      />
                      <Area
                        type="monotone"
                        dataKey="upper"
                        name="Upper Band"
                        stroke="#06b6d4"
                        fill="url(#bandFill)"
                        strokeWidth={1.5}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="projected"
                        name="Projected"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="bearish"
                        name="Bearish Path"
                        stroke="#f59e0b"
                        strokeDasharray="6 5"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="bullish"
                        name="Bullish Path"
                        stroke="#a855f7"
                        strokeDasharray="6 5"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="lower"
                        name="Lower Band"
                        stroke="#06b6d4"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Prediction Report"
                title="Why the model says what it says."
                description="Short trader-grade explanation combining technicals, volume, levels, volatility, Pine Preview, pattern overlays, data quality, and risk."
              />

              <div className="mt-5 grid gap-3">
                {traderPrediction?.report.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-7 text-slate-300"
                  >
                    {item}
                  </div>
                )) ?? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                    Run analysis to generate the prediction report.
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Metric
                  label="Target 1"
                  value={money(traderPrediction?.target1)}
                  helper={traderPrediction ? `${traderPrediction.riskReward1.toFixed(2)}R` : "—"}
                  tone="green"
                />
                <Metric
                  label="Target 2"
                  value={money(traderPrediction?.target2)}
                  helper={traderPrediction ? `${traderPrediction.riskReward2.toFixed(2)}R` : "—"}
                  tone="purple"
                />
                <Metric
                  label="Stop Loss"
                  value={money(traderPrediction?.stopLoss)}
                  helper="ATR-adjusted"
                  tone="red"
                />
                <Metric
                  label="Pine Preview"
                  value={`${pinePreview.previewScore}/100`}
                  helper={`${pinePreview.signalCount} simulated signals`}
                  tone={toneFor(pinePreview.previewScore)}
                />
              </div>
            </Card>
          </section>
        ) : null}

        {view === "trader" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card>
              <SectionHeader
                eyebrow="Execution Plan"
                title="Entry, stop, target, and management path."
                description="Built like a trading desk card: pre-checks, confirmation, entry, risk, target management, and post-trade feedback."
                action={
                  <Pill tone={toneFor(traderPrediction?.setupQuality ?? 0)}>
                    {traderPrediction?.setupGrade ?? "—"}
                  </Pill>
                }
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Metric
                  label="Signal"
                  value={traderPrediction?.tradeSignal ?? "—"}
                  helper={traderPrediction?.directionalBias ?? "—"}
                  tone={toneFor(traderPrediction?.tradeSignal ?? "")}
                />
                <Metric
                  label="Setup Quality"
                  value={traderPrediction ? `${traderPrediction.setupQuality}/100` : "—"}
                  helper={`${traderStyle} · ${traderHorizon}`}
                  tone={toneFor(traderPrediction?.setupQuality ?? 0)}
                />
                <Metric
                  label="Probability Up"
                  value={traderPrediction ? rawPercent(traderPrediction.probabilityUp) : "—"}
                  helper="Model-implied"
                  tone={
                    traderPrediction && traderPrediction.probabilityUp >= 55
                      ? "green"
                      : "amber"
                  }
                />
                <Metric
                  label="Continuation"
                  value={traderPrediction ? rawPercent(traderPrediction.probabilityContinuation) : "—"}
                  helper="Trend follow-through"
                  tone={toneFor(traderPrediction?.probabilityContinuation ?? 0)}
                />
              </div>

              <div className="mt-5 grid gap-3">
                {traderPrediction?.executionPlan.map((item, index) => (
                  <SoftCard key={`${item}-${index}`}>
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{item}</p>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Setup Score Stack"
                title="What a trader would check first."
                description="Trend, momentum, volume, tape, breakout, pullback, mean reversion, risk, Pine Preview, and pattern fit."
              />

              <div className="mt-5 h-[430px]">
                {technicalScoreData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        ...technicalScoreData,
                        { name: "Pine", score: pinePreview.previewScore },
                        { name: "Pattern", score: patternScore },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="5 5" />
                      <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}>
                        {[
                          ...technicalScoreData,
                          { name: "Pine", score: pinePreview.previewScore },
                          { name: "Pattern", score: patternScore },
                        ].map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={
                              item.score >= 75
                                ? "#22c55e"
                                : item.score >= 55
                                  ? BAR_COLORS[index % BAR_COLORS.length]
                                  : "#ef4444"
                            }
                            fillOpacity={0.78}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {traderPrediction?.dataChecklist.map((item) => (
                  <SoftCard key={item.name}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.value}</div>
                      </div>
                      <Pill tone={item.tone}>{item.score}/100</Pill>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "patterns" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <Card>
              <SectionHeader
                eyebrow="Compact Pattern Overlay Lab"
                title="Draw expectations without clutter."
                description="Sketch only the pattern you need, score it, and hide it when done."
                action={<Pill tone={drawMode ? "green" : "amber"}>{drawMode ? "Drawing On" : "Drawing Off"}</Pill>}
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_150px_1fr_120px_100px]">
                <select
                  value={drawTool}
                  onChange={(event) => setDrawTool(event.target.value as DrawTool)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                >
                  <option value="trendline">Trendline</option>
                  <option value="channel">Channel</option>
                  <option value="support">Support</option>
                  <option value="resistance">Resistance</option>
                  <option value="zone">Zone</option>
                  <option value="arrow">Arrow</option>
                </select>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white">
                  Draw
                  <input
                    type="checkbox"
                    checked={drawMode}
                    onChange={(event) => setDrawMode(event.target.checked)}
                  />
                </label>

                <input
                  value={patternLabel}
                  onChange={(event) => setPatternLabel(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none"
                  placeholder="Optional label"
                />

                <input
                  type="range"
                  min={25}
                  max={100}
                  value={patternOpacity}
                  onChange={(event) => setPatternOpacity(Number(event.target.value))}
                  className="h-12"
                />

                <button
                  type="button"
                  onClick={clearPatterns}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
                >
                  Clear
                </button>
              </div>

              <div
                ref={drawBoxRef}
                className={cx(
                  "relative mt-5 h-[540px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30",
                  drawMode ? "cursor-crosshair ring-2 ring-cyan-400/30" : ""
                )}
                onPointerDown={startDrawing}
                onPointerMove={moveDrawing}
                onPointerUp={endDrawing}
                onPointerLeave={() => {
                  if (draftPattern) setDraftPattern(null);
                }}
              >
                {visibleChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={visibleChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} minTickGap={18} />
                      <YAxis stroke="#64748b" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="close"
                        name="Close"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.12}
                        strokeWidth={3}
                      />
                      <Line
                        type="monotone"
                        dataKey="vwap"
                        name="VWAP"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="ema9"
                        name="EMA 9"
                        stroke="#22c55e"
                        strokeWidth={1.7}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="ema21"
                        name="EMA 21"
                        stroke="#a855f7"
                        strokeWidth={1.7}
                        dot={false}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        name="SMA 50"
                        stroke="#f59e0b"
                        strokeWidth={1.7}
                        dot={false}
                        connectNulls
                      />
                      <ReferenceLine y={traderPrediction?.support} stroke="#22c55e" strokeDasharray="5 5" />
                      <ReferenceLine y={traderPrediction?.resistance} stroke="#ef4444" strokeDasharray="5 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  style={{ opacity: patternOpacity / 100 }}
                >
                  {patterns.map((pattern) => drawPattern(pattern))}
                  {draftPattern ? drawPattern(draftPattern, true) : null}
                </svg>

                <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-xs font-bold text-slate-300 backdrop-blur">
                  {drawMode
                    ? `Drawing ${drawTool}. Drag over chart.`
                    : "Draw mode is off. Toggle Draw to sketch."}
                </div>
              </div>
            </Card>

            <div className="grid gap-5">
              <Card>
                <SectionHeader
                  eyebrow="Pattern Fit"
                  title="Match score"
                  description="Compares drawings against trend, ATR proximity, support/resistance, and price position."
                />

                <div className="mt-5 grid gap-3">
                  {patternAnalysis.length ? (
                    patternAnalysis.map((item) => (
                      <SoftCard key={item.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Pill tone={item.tone}>{item.status}</Pill>
                            <div className="mt-3 text-lg font-black text-white">{item.label}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.levelText}</div>
                          </div>
                          <div className="text-2xl font-black text-white">{item.matchScore}</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{item.explanation}</p>
                      </SoftCard>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                      Draw an overlay to score pattern fit.
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <SectionHeader
                  eyebrow="Saved Overlays"
                  title="Local patterns"
                  description="Saved locally by symbol."
                />

                <div className="mt-5 grid max-h-[360px] gap-3 overflow-y-auto pr-2">
                  {patterns.map((pattern) => (
                    <SoftCard key={pattern.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Pill tone={pattern.type === "support" ? "green" : pattern.type === "resistance" ? "red" : pattern.type === "zone" ? "amber" : "cyan"}>
                            {pattern.type}
                          </Pill>
                          <div className="mt-3 text-sm font-black text-white">{pattern.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(pattern.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePattern(pattern.id)}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase text-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </SoftCard>
                  ))}

                  {!patterns.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                      No overlays saved yet.
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {view === "technicals" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card>
              <SectionHeader
                eyebrow="Technical Chart"
                title="Price, VWAP, moving averages, and volatility bands."
                description="Use this to confirm whether the predicted setup has technical structure behind it."
              />

              <div className="mt-5 h-[520px]">
                {visibleChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={visibleChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} minTickGap={18} />
                      <YAxis stroke="#64748b" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="close"
                        name="Close"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.12}
                        strokeWidth={3}
                      />
                      <Line yAxisId="price" dataKey="vwap" name="VWAP" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                      <Line yAxisId="price" dataKey="ema9" name="EMA 9" stroke="#22c55e" strokeWidth={1.7} dot={false} connectNulls />
                      <Line yAxisId="price" dataKey="ema21" name="EMA 21" stroke="#a855f7" strokeWidth={1.7} dot={false} connectNulls />
                      <Line yAxisId="price" dataKey="sma50" name="SMA 50" stroke="#f59e0b" strokeWidth={1.7} dot={false} connectNulls />
                      <Line yAxisId="price" dataKey="bollingerUpper" name="Boll Upper" stroke="#64748b" strokeDasharray="5 5" dot={false} connectNulls />
                      <Line yAxisId="price" dataKey="bollingerLower" name="Boll Lower" stroke="#64748b" strokeDasharray="5 5" dot={false} connectNulls />
                      <YAxis yAxisId="price" hide />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>

            <div className="grid gap-5">
              <Card>
                <SectionHeader
                  eyebrow="Indicator Snapshot"
                  title="Current read"
                  description="The latest technical state used in the predictive model."
                />

                <div className="mt-5 grid gap-3">
                  <Metric label="RSI 14" value={traderPrediction?.rsi?.toFixed(2) ?? "—"} helper="Momentum oscillator" tone={toneFor(traderPrediction?.rsi ?? 0)} />
                  <Metric label="MACD Hist" value={traderPrediction?.macdHistogram?.toFixed(4) ?? "—"} helper="Momentum acceleration" tone={changeTone(traderPrediction?.macdHistogram)} />
                  <Metric label="VWAP Dist." value={traderPrediction ? rawPercent(traderPrediction.vwapDistancePct) : "—"} helper="Price acceptance" tone={changeTone(traderPrediction?.vwapDistancePct)} />
                  <Metric label="MA Stack" value={traderPrediction ? `${traderPrediction.maStackScore.toFixed(0)}/100` : "—"} helper="Trend alignment" tone={toneFor(traderPrediction?.maStackScore ?? 0)} />
                  <Metric label="Squeeze" value={traderPrediction ? `${traderPrediction.squeezeScore}/100` : "—"} helper="Compression potential" tone={toneFor(traderPrediction?.squeezeScore ?? 0)} />
                  <Metric label="Volume Ratio" value={traderPrediction ? `${traderPrediction.volumeRatio.toFixed(2)}x` : "—"} helper="Participation" tone={toneFor(traderPrediction?.volumeScore ?? 0)} />
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {view === "scenarios" ? (
          <Card>
            <SectionHeader
              eyebrow="Scenario Matrix"
              title="Bull, bear, base, and chop paths."
              description="A trader needs to know what confirms the thesis, what invalidates it, and what to do if the tape goes sideways."
            />

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {traderPrediction?.scenarioMatrix.map((scenario) => (
                <SoftCard key={scenario.name}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Pill tone={changeTone(scenario.movePct)}>{scenario.name}</Pill>
                      <h3 className="mt-3 text-2xl font-black text-white">
                        {money(scenario.target)}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Probability
                      </div>
                      <div className="mt-1 text-xl font-black text-white">
                        {rawPercent(scenario.probability, 0)}
                      </div>
                    </div>
                  </div>

                  <div className={cx("mt-3 text-2xl font-black", scenario.movePct >= 0 ? "text-emerald-300" : "text-red-300")}>
                    {percent(scenario.movePct)}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Trigger
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.trigger}</p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Action
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.action}</p>
                  </div>
                </SoftCard>
              )) ?? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                  Run a symbol to generate scenario paths.
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              {traderPrediction?.explanation.map((item) => (
                <SoftCard key={item}>
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </SoftCard>
              ))}
            </div>
          </Card>
        ) : null}

        {view === "options" ? (
          <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
            <Card>
              <SectionHeader
                eyebrow="Options Scenario Lab"
                title="Calls, puts, spreads, and payoff planning."
                description="Model how a strategy may pan out across price paths. This is for education and risk visualization only."
                action={<Pill tone="purple">{optionStrategy}</Pill>}
              />

              <div className="mt-5 grid gap-3">
                <select
                  value={optionStrategy}
                  onChange={(event) => setOptionStrategy(event.target.value as OptionStrategy)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                >
                  <option>Long Call</option>
                  <option>Long Put</option>
                  <option>Bull Call Spread</option>
                  <option>Bear Put Spread</option>
                  <option>Protective Put</option>
                  <option>Covered Call</option>
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    value={optionStrike}
                    onChange={(event) => setOptionStrike(Number(event.target.value))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                    placeholder="Strike 1"
                  />
                  <input
                    type="number"
                    value={optionPremium}
                    onChange={(event) => setOptionPremium(Number(event.target.value))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                    placeholder="Premium 1"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    value={optionStrike2}
                    onChange={(event) => setOptionStrike2(Number(event.target.value))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                    placeholder="Strike 2"
                  />
                  <input
                    type="number"
                    value={optionPremium2}
                    onChange={(event) => setOptionPremium2(Number(event.target.value))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                    placeholder="Premium 2"
                  />
                </div>

                <input
                  type="number"
                  value={optionContracts}
                  onChange={(event) => setOptionContracts(Number(event.target.value))}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                  placeholder="Contracts"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Breakeven" value={money(optionScenario.breakeven)} helper="Estimated expiration breakeven" tone="cyan" />
                  <Metric label="Max Loss" value={optionScenario.maxLossText} helper="Simplified estimate" tone="red" />
                  <Metric label="Max Profit" value={optionScenario.maxProfitText} helper="Simplified estimate" tone="green" />
                  <Metric label="Current" value={money(currentPrice)} helper={data?.symbol ?? symbol} tone="purple" />
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Options Payoff"
                title="Expiration payoff curve."
                description="Visualizes simplified profit/loss across possible underlying prices."
              />

              <div className="mt-5 h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={optionScenario.payoffData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="price" stroke="#64748b" fontSize={12} tickFormatter={(value) => money(Number(value))} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => money(Number(value))} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#ffffff" strokeDasharray="5 5" />
                    <ReferenceLine x={currentPrice} stroke="#06b6d4" strokeDasharray="5 5" />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      name="Profit / Loss"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.14}
                      strokeWidth={3}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-5 grid gap-3">
                {optionScenario.summary.map((item) => (
                  <SoftCard key={item}>
                    <p className="text-sm leading-6 text-slate-300">{item}</p>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "compare" ? (
          <Card>
            <SectionHeader
              eyebrow="Relative Strength"
              title={`${data?.symbol ?? symbol} vs ${compareData?.symbol ?? compareSymbol}`}
              description="Compare normalized performance and spread to identify leadership, weakness, or pair divergence."
              action={
                <button
                  type="button"
                  onClick={() => void loadVisuals(symbol.toUpperCase(), interval)}
                  className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                >
                  Refresh Compare
                </button>
              }
            />

            <div className="mt-5 h-[520px]">
              {compareOverlayData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={compareOverlayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} minTickGap={18} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="primaryReturnPct" name={`${data?.symbol ?? symbol} Return %`} stroke="#ef4444" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="compareReturnPct" name={`${compareData?.symbol ?? compareSymbol} Return %`} stroke="#06b6d4" strokeWidth={3} dot={false} />
                    <Bar dataKey="spreadPct" name="Spread %" fill="#a855f7" fillOpacity={0.24} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Turn on Compare and refresh to see relative strength." />
              )}
            </div>
          </Card>
        ) : null}

        {view === "tradingview" ? (
          <section className={cx("grid gap-5", pineSidePanelOpen ? "xl:grid-cols-[minmax(0,1fr)_460px]" : "")}>
            <Card>
              <SectionHeader
                eyebrow="TradingView + Slice Pine Studio"
                title="Live chart with Pine side panel workflow."
                description="The TradingView iframe remains the live chart. Slice Pine Studio sits beside it, generates code, saves projects, and previews common Pine logic on Slice’s own data."
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPineSidePanelOpen((current) => !current)}
                      className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                    >
                      {pineSidePanelOpen ? "Hide Pine Panel" : "Open Pine Panel"}
                    </button>
                    <Pill tone="cyan">{symbol}</Pill>
                  </div>
                }
              />

              <div className="mt-5">
                <TradingViewEmbed symbol={symbol} interval={interval} />
              </div>
            </Card>

            {pineSidePanelOpen ? (
              <Card>
                <SectionHeader
                  eyebrow="Pine Studio"
                  title="Generate, test, save."
                  description="AI-style generator, Pine editor, local preview, and one-click copy."
                  action={<Pill tone={toneFor(pinePreview.previewScore)}>{pinePreview.previewScore}/100</Pill>}
                />

                <div className="mt-5 grid gap-3">
                  <textarea
                    value={pinePrompt}
                    onChange={(event) => setPinePrompt(event.target.value)}
                    className="min-h-24 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                    placeholder="Tell Slice what Pine script to generate. Example: Make me a VWAP breakout script with EMA confirmation, RSI filter, ATR stop, target, and alerts."
                  />

                  <div className="grid gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={generatePineCode}
                      className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white"
                    >
                      AI Generate Pine
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(pineCode, "Pine code")}
                      className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
                    >
                      Copy Code
                    </button>
                  </div>

                  <textarea
                    value={pineCode}
                    onChange={(event) => setPineCode(event.target.value)}
                    spellCheck={false}
                    className="min-h-[300px] rounded-[1.5rem] border border-white/10 bg-black/70 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none"
                  />

                  <div className="grid gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={savePineProject}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                    >
                      Save Project
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("pine")}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
                    >
                      Full Pine Lab
                    </button>
                  </div>

                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100/90">
                    TradingView’s free iframe cannot receive or compile injected Pine from Slice. Slice Preview simulates common Pine logic locally; copy the final code into TradingView Pine Editor for native execution.
                  </div>
                </div>
              </Card>
            ) : null}

            <Card className={pineSidePanelOpen ? "xl:col-span-2" : ""}>
              <SectionHeader
                eyebrow="Slice Pine Preview"
                title="Local signal preview from the Pine project."
                description="Recognizes common EMA, VWAP, RSI, MACD, ATR, and alert patterns and previews signals against Slice candle data."
                action={
                  <button
                    type="button"
                    onClick={() => setPinePreviewOpen((current) => !current)}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white"
                  >
                    {pinePreviewOpen ? "Hide Preview" : "Show Preview"}
                  </button>
                }
              />

              {pinePreviewOpen ? (
                <>
                  <div className="mt-5 h-[420px]">
                    {pinePreview.previewData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={pinePreview.previewData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" stroke="#64748b" fontSize={11} minTickGap={18} />
                          <YAxis stroke="#64748b" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area dataKey="close" name="Close" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={3} />
                          <Line dataKey="emaFast" name="EMA Fast" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                          <Line dataKey="emaSlow" name="EMA Slow" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                          <Line dataKey="vwap" name="VWAP" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
                          <Line dataKey="bullSignal" name="Bull Signal" stroke="#22c55e" strokeWidth={0} dot={{ r: 5 }} connectNulls={false} />
                          <Line dataKey="bearSignal" name="Bear Signal" stroke="#ef4444" strokeWidth={0} dot={{ r: 5 }} connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="No preview data available." />
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {pinePreview.features.map((feature) => (
                      <SoftCard key={feature.name}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Pill tone={feature.tone}>{feature.enabled ? "Detected" : "Missing"}</Pill>
                            <div className="mt-3 text-lg font-black text-white">{feature.name}</div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">{feature.note}</p>
                          </div>
                        </div>
                      </SoftCard>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3">
                    {pinePreview.warnings.map((warning) => (
                      <SoftCard key={warning}>
                        <p className="text-sm leading-6 text-slate-300">{warning}</p>
                      </SoftCard>
                    ))}
                  </div>
                </>
              ) : null}
            </Card>
          </section>
        ) : null}

        {view === "pine" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card>
              <SectionHeader
                eyebrow="Pine Script Project Lab"
                title="Save reusable TradingView Pine projects."
                description="Create, edit, AI-generate, preview, copy, and reuse Pine scripts. Native execution still happens in TradingView Pine Editor, while Slice Preview simulates common logic here."
                action={<Pill tone="purple">{pineProjects.length} saved</Pill>}
              />

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_180px]">
                <input
                  value={pineProjectName}
                  onChange={(event) => setPineProjectName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none"
                  placeholder="Pine project name"
                />
                <button
                  type="button"
                  onClick={generatePineCode}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white"
                >
                  AI Generate
                </button>
                <button
                  type="button"
                  onClick={resetPineTemplate}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
                >
                  Reset
                </button>
              </div>

              <textarea
                value={pinePrompt}
                onChange={(event) => setPinePrompt(event.target.value)}
                className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                placeholder="Prompt: Generate a breakout strategy with VWAP, EMA stack, RSI, ATR stop, target, labels, and alerts..."
              />

              <textarea
                value={pineProjectNotes}
                onChange={(event) => setPineProjectNotes(event.target.value)}
                className="mt-3 min-h-20 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                placeholder="Notes: what this script is for, when to use it, alerts to set..."
              />

              <textarea
                value={pineCode}
                onChange={(event) => setPineCode(event.target.value)}
                spellCheck={false}
                className="mt-3 min-h-[560px] w-full rounded-[1.5rem] border border-white/10 bg-black/70 px-5 py-4 font-mono text-xs leading-6 text-slate-100 outline-none"
              />

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={savePineProject}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void copyText(pineCode, "Pine code")}
                  className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  onClick={() => setView("tradingview")}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white"
                >
                  Chart View
                </button>
                <a
                  href="https://www.tradingview.com/chart/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-black text-red-100"
                >
                  Open TV
                </a>
              </div>
            </Card>

            <div className="grid gap-5">
              <Card>
                <SectionHeader
                  eyebrow="Pine Preview"
                  title="Feature detection"
                  description="Slice recognizes common Pine concepts and previews signals locally."
                  action={<Pill tone={toneFor(pinePreview.previewScore)}>{pinePreview.previewScore}/100</Pill>}
                />

                <div className="mt-5 grid gap-3">
                  {pinePreview.features.map((feature) => (
                    <SoftCard key={feature.name}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Pill tone={feature.tone}>{feature.enabled ? "Detected" : "Missing"}</Pill>
                          <div className="mt-3 text-sm font-black text-white">{feature.name}</div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{feature.note}</p>
                        </div>
                      </div>
                    </SoftCard>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader
                  eyebrow="Saved Pine Projects"
                  title="Reusable scripts"
                  description="Keep scripts for different setups, symbols, and clients."
                />

                <div className="mt-5 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                  {pineProjects.map((project) => (
                    <SoftCard key={project.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Pill tone="purple">{project.symbol}</Pill>
                          <h3 className="mt-3 text-lg font-black text-white">{project.name}</h3>
                          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
                            {project.notes || "No notes yet."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePineProject(project.id)}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase text-red-100"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => loadPineProject(project)}
                          className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyText(project.code, "Pine project")}
                          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100"
                        >
                          Copy
                        </button>
                      </div>
                    </SoftCard>
                  ))}

                  {!pineProjects.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                      No Pine projects saved yet.
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {view === "platform" ? (
          <section className="grid gap-5 xl:grid-cols-2">
            <Card>
              <SectionHeader
                eyebrow="Platform Intelligence"
                title="Alerts and opportunity signals."
                description="Slice platform data sits beside market analysis. If platform opportunity data is thin, Slice generates a trader-oriented fallback matrix from prediction, risk, patterns, Pine Preview, and options context."
              />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {(data?.platform.platformOverview?.length
                  ? data.platform.platformOverview
                  : [
                      { name: "Setup Quality", value: traderPrediction?.setupQuality ?? 0 },
                      { name: "Pattern Fit", value: patternScore },
                      { name: "Pine Preview", value: pinePreview.previewScore },
                      { name: "Model Quality", value: traderPrediction?.modelQualityScore ?? 0 },
                    ]
                ).map((item) => (
                  <Metric key={item.name} label={item.name} value={item.value} tone="purple" />
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {data?.platform.alertScores?.length ? (
                  data.platform.alertScores.map((alert) => (
                    <SoftCard key={alert.name}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Pill tone={toneFor(alert.urgency)}>{alert.urgency}</Pill>
                          <div className="mt-3 text-lg font-black text-white">{alert.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{alert.source}</div>
                        </div>
                        <div className="text-2xl font-black text-red-300">{alert.score}</div>
                      </div>
                    </SoftCard>
                  ))
                ) : (
                  <SoftCard>
                    <Pill tone="cyan">Generated</Pill>
                    <div className="mt-3 text-lg font-black text-white">Trader-generated opportunity alerts</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Live platform alerts were not available, so Slice generated opportunity context from the predictive model, Pine Preview, pattern analysis, and options lab.
                    </p>
                  </SoftCard>
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                eyebrow="Opportunity Matrix"
                title="Opportunity, risk, confidence, and composite score."
                description="This matrix uses platform data when available and falls back to predictive trader intelligence when needed."
              />

              <div className="mt-5 h-[420px]">
                {opportunityMatrixData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={opportunityMatrixData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="opportunity" name="Opportunity" fill="#22c55e" fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                      <Bar dataKey="risk" name="Risk" fill="#ef4444" fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                      <Line type="monotone" dataKey="confidence" name="Confidence" stroke="#06b6d4" strokeWidth={3} />
                      <Line type="monotone" dataKey="composite" name="Composite" stroke="#a855f7" strokeWidth={3} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>

              <div className="mt-5 grid gap-3">
                {opportunityMatrixData.map((item) => (
                  <SoftCard key={`${item.name}-${item.title}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Pill tone={toneFor(item.composite)}>{item.name}</Pill>
                        <div className="mt-3 text-sm font-black text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.source}</div>
                      </div>
                      <div className="text-2xl font-black text-white">{item.composite}</div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "data" ? (
          <Card>
            <SectionHeader
              eyebrow="Raw Candle Data"
              title="Full technical table."
              description="Recent candles, indicators, volume, ranges, returns, and moving averages."
            />

            <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/10">
              <table className="min-w-[1180px] w-full text-left text-sm">
                <thead className="bg-white/[0.045] text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    {[
                      "Date",
                      "Open",
                      "High",
                      "Low",
                      "Close",
                      "Volume",
                      "Return",
                      "RSI",
                      "VWAP",
                      "EMA9",
                      "EMA21",
                      "SMA50",
                      "SMA200",
                      "ATR",
                    ].map((header) => (
                      <th key={header} className="px-4 py-3">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {latestCandleRows.map((candle) => (
                    <tr key={`${candle.date}-${candle.close}`} className="hover:bg-white/[0.035]">
                      <td className="px-4 py-3 font-bold text-white">{candle.label}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.open)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.high)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.low)}</td>
                      <td className="px-4 py-3 font-black text-white">{money(candle.close)}</td>
                      <td className="px-4 py-3 text-slate-300">{compactNumber(candle.volume)}</td>
                      <td className={cx("px-4 py-3 font-black", (candle.returnPct ?? 0) >= 0 ? "text-emerald-300" : "text-red-300")}>
                        {percent(candle.returnPct)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{candle.rsi14?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.vwap)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.ema9)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.ema21)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.sma50)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.sma200)}</td>
                      <td className="px-4 py-3 text-slate-300">{money(candle.atr14)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {renderTradingSafety()}
      </div>
    </main>
  );
}