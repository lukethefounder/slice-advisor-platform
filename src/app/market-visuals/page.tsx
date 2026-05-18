"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ViewMode =
  | "dashboard"
  | "forecast"
  | "technicals"
  | "compare"
  | "platform"
  | "data";

type ConfidenceLevel = 68 | 80 | 90 | 95 | 99;
type HorizonSteps = 5 | 10 | 20 | 30;

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

type CompareOverlayPoint = Candle & {
  compareClose: number | null;
  primaryReturnPct: number | null;
  compareReturnPct: number | null;
  spreadPct: number | null;
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

type PredictivePoint = {
  step: number;
  label: string;
  projected: number;
  lower: number;
  upper: number;
  bearish: number;
  bullish: number;
};

type PredictiveAnalysis = {
  currentPrice: number;
  confidenceLevel: ConfidenceLevel;
  zScore: number;
  horizonSteps: HorizonSteps;
  projectedFinal: number;
  lowerFinal: number;
  upperFinal: number;
  probabilityUp: number;
  probabilityDown: number;
  expectedMovePct: number;
  downsideMovePct: number;
  upsideMovePct: number;
  driftPerStep: number;
  ewmaVolatility: number;
  realisedVolatility: number;
  atrPct: number;
  trendSlopePct: number;
  momentumScore: number;
  volatilityRegime: "Low" | "Normal" | "Elevated" | "Extreme";
  modelQualityScore: number;
  forecast: PredictivePoint[];
  explanation: string[];
};

const VIEW_TABS: Array<{ id: ViewMode; label: string; description: string }> = [
  { id: "dashboard", label: "Dashboard", description: "Realistic price view" },
  { id: "forecast", label: "Forecast", description: "Confidence engine" },
  { id: "technicals", label: "Technicals", description: "RSI, MACD, MA stack" },
  { id: "compare", label: "Compare", description: "Relative performance" },
  { id: "platform", label: "Platform Intel", description: "Alerts and signals" },
  { id: "data", label: "Data", description: "Full candle table" },
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

function buildPredictiveAnalysis(
  candles: Candle[],
  confidenceLevel: ConfidenceLevel,
  horizonSteps: HorizonSteps,
  providerQualityScore: number,
  backendModelConfidence: number
): PredictiveAnalysis | null {
  const clean = candles.filter(
    (candle) => Number.isFinite(candle.close) && candle.close > 0
  );

  if (clean.length < 20) return null;

  const closes = clean.map((candle) => candle.close);
  const latest = clean[clean.length - 1];
  const currentPrice = latest.close;
  const returns = closes
    .slice(1)
    .map((close, index) => Math.log(close / closes[index]));
  const recentReturns = returns.slice(-100);
  const shortReturns = returns.slice(-20);
  const longReturns = returns.slice(-200);

  const realisedVolatility = standardDeviation(recentReturns);
  const shortVolatility = standardDeviation(shortReturns);
  const longVolatility = standardDeviation(
    longReturns.length ? longReturns : recentReturns
  );
  const ewmaVol = ewmaVolatility(recentReturns);
  const atrPct = averageTrueRangePct(clean);
  const zScore = zScoreForConfidence(confidenceLevel);

  const logCloses = closes.slice(-100).map((close) => Math.log(close));
  const trendSlope = regressionSlope(logCloses);
  const trendSlopePct = Math.exp(trendSlope) - 1;

  const latestRsi = latest.rsi14 ?? 50;
  const rsiAdjustment = clamp((latestRsi - 50) / 50, -1, 1) * 0.0015;
  const macdAdjustment = latest.macdHistogram
    ? clamp(latest.macdHistogram / currentPrice, -0.006, 0.006)
    : 0;
  const vwapAdjustment =
    latest.vwap && latest.vwap > 0
      ? clamp((currentPrice - latest.vwap) / latest.vwap, -0.035, 0.035) *
        0.08
      : 0;
  const longMaAdjustment =
    latest.sma200 && latest.sma200 > 0
      ? clamp((currentPrice - latest.sma200) / latest.sma200, -0.08, 0.08) *
        0.035
      : 0;
  const meanReversionAdjustment =
    latest.sma20 && latest.sma20 > 0
      ? clamp((latest.sma20 - currentPrice) / currentPrice, -0.05, 0.05) *
        0.05
      : 0;

  const weightedDrift =
    exponentialWeightedMean(recentReturns) * 0.32 +
    mean(shortReturns) * 0.18 +
    trendSlopePct * 0.22 +
    rsiAdjustment +
    macdAdjustment +
    vwapAdjustment +
    longMaAdjustment +
    meanReversionAdjustment;

  const driftPerStep = clamp(weightedDrift, -0.035, 0.035);
  const baseSigma = Math.max(
    ewmaVol,
    realisedVolatility * 0.85,
    atrPct * 0.45,
    0.001
  );

  const regimeRatio = longVolatility > 0 ? shortVolatility / longVolatility : 1;
  const volatilityRegime: PredictiveAnalysis["volatilityRegime"] =
    regimeRatio >= 1.8
      ? "Extreme"
      : regimeRatio >= 1.25
        ? "Elevated"
        : regimeRatio <= 0.7
          ? "Low"
          : "Normal";

  const regimeMultiplier =
    volatilityRegime === "Extreme"
      ? 1.35
      : volatilityRegime === "Elevated"
        ? 1.15
        : volatilityRegime === "Low"
          ? 0.9
          : 1;

  const sigma = baseSigma * regimeMultiplier;

  const modelQualityScore = Math.round(
    clamp(
      providerQualityScore * 0.34 +
        backendModelConfidence * 0.24 +
        clamp(clean.length / 220, 0, 1) * 22 +
        clamp(1 - Math.min(regimeRatio, 2.5) / 2.5, 0, 1) * 10 +
        (latest.rsi14 !== null ? 4 : 0) +
        (latest.vwap !== null ? 3 : 0) +
        (latest.sma200 !== null ? 5 : 0),
      15,
      98
    )
  );

  const forecast: PredictivePoint[] = Array.from({ length: horizonSteps }).map(
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
  const finalSigma = sigma * Math.sqrt(horizonSteps);
  const probabilityUp = normalCdf(
    (Math.log(currentPrice) +
      driftPerStep * horizonSteps -
      Math.log(currentPrice)) /
      Math.max(finalSigma, 0.0001)
  );

  const momentumScore = Math.round(
    clamp(
      50 +
        (latestRsi - 50) * 0.42 +
        (latest.macdHistogram
          ? clamp(latest.macdHistogram / currentPrice, -0.03, 0.03) * 500
          : 0) +
        (latest.vwap && currentPrice > latest.vwap
          ? 7
          : latest.vwap && currentPrice < latest.vwap
            ? -7
            : 0) +
        (latest.sma50 && latest.sma200 && latest.sma50 > latest.sma200
          ? 10
          : latest.sma50 && latest.sma200 && latest.sma50 < latest.sma200
            ? -10
            : 0),
      0,
      100
    )
  );

  return {
    currentPrice,
    confidenceLevel,
    zScore,
    horizonSteps,
    projectedFinal: finalPoint.projected,
    lowerFinal: finalPoint.lower,
    upperFinal: finalPoint.upper,
    probabilityUp: probabilityUp * 100,
    probabilityDown: (1 - probabilityUp) * 100,
    expectedMovePct: (finalPoint.projected / currentPrice - 1) * 100,
    downsideMovePct: (finalPoint.lower / currentPrice - 1) * 100,
    upsideMovePct: (finalPoint.upper / currentPrice - 1) * 100,
    driftPerStep,
    ewmaVolatility: sigma,
    realisedVolatility,
    atrPct,
    trendSlopePct,
    momentumScore,
    volatilityRegime,
    modelQualityScore,
    forecast,
    explanation: [
      "EWMA volatility weights recent candles more heavily so the range adapts faster to current volatility.",
      "Expected path blends weighted return drift, regression trend slope, RSI, MACD, VWAP distance, 200-period trend pressure, and mean reversion.",
      "The 200-period moving average is used as a long-term trend anchor when enough history exists.",
      "The confidence range is log-normal, so lower and upper bands scale with volatility and selected confidence interval.",
      "Model quality falls when data volume is thin, provider quality is weak, or volatility regime is unstable.",
    ],
  };
}

function toneFor(
  value: string | number
): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const text = String(value).toLowerCase();

  if (
    text.includes("fresh") ||
    text.includes("live") ||
    text.includes("bullish") ||
    text.includes("ready") ||
    text.includes("positive")
  ) {
    return "green";
  }

  if (
    text.includes("stale") ||
    text.includes("demo") ||
    text.includes("closed") ||
    text.includes("bearish") ||
    text.includes("missing") ||
    text.includes("negative")
  ) {
    return "red";
  }

  if (
    text.includes("mixed") ||
    text.includes("warning") ||
    text.includes("market closed") ||
    text.includes("elevated") ||
    text.includes("overbought")
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

function changeTone(value: number | null | undefined): "red" | "green" | "slate" {
  if (value === null || value === undefined) return "slate";
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const tones = {
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
        "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
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

export default function MarketVisualsPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const [compareSymbol, setCompareSymbol] = useState("AAPL");
  const [showCompare, setShowCompare] = useState(false);
  const [interval, setInterval] = useState("daily");
  const [view, setView] = useState<ViewMode>("dashboard");
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(95);
  const [horizonSteps, setHorizonSteps] = useState<HorizonSteps>(20);
  const [data, setData] = useState<MarketVisualPayload | null>(null);
  const [compareData, setCompareData] = useState<MarketVisualPayload | null>(
    null
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

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
        const comparison = await fetchVisuals(
          compareSymbol.toUpperCase(),
          nextInterval
        );
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

  const latest = data?.latest ?? null;
  const chartData = useMemo(() => data?.candles.slice(-260) ?? [], [data]);
  const visibleChartData = useMemo(() => chartData.slice(-220), [chartData]);

  const predictiveAnalysis = useMemo(
    () =>
      data
        ? buildPredictiveAnalysis(
            data.candles,
            confidenceLevel,
            horizonSteps,
            data.quality.score,
            data.modelConfidence
          )
        : null,
    [data, confidenceLevel, horizonSteps]
  );

  const predictionChartData = useMemo<ForecastChartPoint[]>(() => {
    const history: ForecastChartPoint[] = visibleChartData.slice(-65).map((item) => ({
      label: item.label,
      close: item.close,
      projected: null,
      lower: null,
      upper: null,
      bearish: null,
      bullish: null,
    }));

    const forecast: ForecastChartPoint[] =
      predictiveAnalysis?.forecast.map((item) => ({
        label: item.label,
        close: null,
        projected: item.projected,
        lower: item.lower,
        upper: item.upper,
        bearish: item.bearish,
        bullish: item.bullish,
      })) ?? [];

    return [...history, ...forecast];
  }, [visibleChartData, predictiveAnalysis]);

  const compareOverlayData = useMemo<CompareOverlayPoint[]>(() => {
    if (!showCompare || !compareData?.candles.length || !visibleChartData.length) {
      return visibleChartData.map((point) => ({
        ...point,
        compareClose: null,
        primaryReturnPct: point.cumulativeReturnPct,
        compareReturnPct: null,
        spreadPct: null,
      }));
    }

    const compareCandles = compareData.candles.slice(-visibleChartData.length);
    const primaryStart = visibleChartData[0]?.close || 1;
    const compareStart = compareCandles[0]?.close || 1;

    return visibleChartData.map((point, index) => {
      const comparisonPoint = compareCandles[index];
      const primaryReturnPct = primaryStart
        ? ((point.close - primaryStart) / primaryStart) * 100
        : 0;
      const compareReturnPct =
        comparisonPoint && compareStart
          ? ((comparisonPoint.close - compareStart) / compareStart) * 100
          : null;

      return {
        ...point,
        compareClose:
          comparisonPoint && compareStart
            ? (comparisonPoint.close / compareStart) * primaryStart
            : null,
        primaryReturnPct,
        compareReturnPct,
        spreadPct:
          compareReturnPct !== null ? primaryReturnPct - compareReturnPct : null,
      };
    });
  }, [visibleChartData, compareData, showCompare]);

  const compareStats = useMemo(() => {
    if (!showCompare || !compareData || !compareOverlayData.length) return null;

    const latestPoint = compareOverlayData[compareOverlayData.length - 1];
    const primaryReturn = latestPoint?.primaryReturnPct ?? 0;
    const compareReturn = latestPoint?.compareReturnPct ?? 0;
    const spread = primaryReturn - compareReturn;
    const primaryLatest = data?.latest?.close ?? null;
    const compareLatest = compareData.latest?.close ?? null;

    return {
      primaryReturn,
      compareReturn,
      spread,
      primaryLatest,
      compareLatest,
      leader:
        spread > 0
          ? data?.symbol ?? "Primary"
          : spread < 0
            ? compareData.symbol
            : "Tie",
    };
  }, [showCompare, compareData, compareOverlayData, data]);

  const technicalScore = useMemo(() => {
    if (!latest) return 50;

    let score = 50;

    if (latest.close && latest.vwap && latest.close > latest.vwap) score += 8;
    if (latest.close && latest.vwap && latest.close < latest.vwap) score -= 8;
    if (latest.sma20 && latest.sma50 && latest.sma20 > latest.sma50) score += 8;
    if (latest.sma20 && latest.sma50 && latest.sma20 < latest.sma50) score -= 8;
    if (latest.sma50 && latest.sma200 && latest.sma50 > latest.sma200) score += 12;
    if (latest.sma50 && latest.sma200 && latest.sma50 < latest.sma200) score -= 12;
    if (latest.close && latest.sma200 && latest.close > latest.sma200) score += 10;
    if (latest.close && latest.sma200 && latest.close < latest.sma200) score -= 10;
    if (latest.rsi14 !== null && latest.rsi14 >= 70) score -= 8;
    if (latest.rsi14 !== null && latest.rsi14 <= 30) score += 7;
    if (latest.macd !== null && latest.macd > 0) score += 5;
    if (latest.macd !== null && latest.macd < 0) score -= 5;

    return clamp(Math.round(score), 0, 100);
  }, [latest]);

  const alertScores = data?.platform.alertScores ?? [];
  const opportunityMatrix = data?.platform.opportunityMatrix ?? [];
  const sourceCredibility = data?.platform.sourceCredibility ?? [];
  const watchlistHeatmap = data?.platform.watchlistHeatmap ?? [];
  const taskStatusCounts = data?.platform.taskStatusCounts ?? [];
  const platformOverview = data?.platform.platformOverview ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.20),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1800px] gap-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-red-600/20 to-transparent" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Market Visuals
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Advisor-grade market intelligence with realistic technical depth.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                Enhanced live-aware visuals with SMA20, SMA50, SMA100, SMA200, EMA9,
                EMA21, VWAP, Bollinger Bands, ATR, RSI, MACD, volume analytics,
                relative comparison, and predictive ranges.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/watchlist-alerts"
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100"
              >
                Price Alerts
              </a>
              <a
                href="/advisor-command-center"
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100"
              >
                AI Command
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card>
          <form
            onSubmit={submit}
            className="grid gap-3 xl:grid-cols-[1fr_1fr_170px_170px_170px_auto]"
          >
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              placeholder="Primary ticker, e.g. NVDA"
            />

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={compareSymbol}
                onChange={(event) =>
                  setCompareSymbol(event.target.value.toUpperCase())
                }
                disabled={!showCompare}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-40"
                placeholder="Compare ticker"
              />
              <button
                type="button"
                onClick={() => setShowCompare((current) => !current)}
                className={cx(
                  "rounded-2xl border px-4 py-3 text-xs font-black",
                  showCompare
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-slate-400"
                )}
              >
                Compare {showCompare ? "On" : "Off"}
              </button>
            </div>

            <select
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
            >
              <option value="1min">1 minute</option>
              <option value="5min">5 minutes</option>
              <option value="15min">15 minutes</option>
              <option value="30min">30 minutes</option>
              <option value="60min">60 minutes</option>
              <option value="daily">Daily</option>
            </select>

            <select
              value={confidenceLevel}
              onChange={(event) =>
                setConfidenceLevel(Number(event.target.value) as ConfidenceLevel)
              }
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-purple-500 focus:ring-2"
            >
              <option value={68}>68% confidence</option>
              <option value={80}>80% confidence</option>
              <option value={90}>90% confidence</option>
              <option value={95}>95% confidence</option>
              <option value={99}>99% confidence</option>
            </select>

            <select
              value={horizonSteps}
              onChange={(event) =>
                setHorizonSteps(Number(event.target.value) as HorizonSteps)
              }
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 focus:ring-2"
            >
              <option value={5}>5-candle horizon</option>
              <option value={10}>10-candle horizon</option>
              <option value={20}>20-candle horizon</option>
              <option value={30}>30-candle horizon</option>
            </select>

            <button
              disabled={loading}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Visuals"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((current) => !current)}
              className={cx(
                "rounded-2xl border px-4 py-2 text-xs font-black",
                autoRefresh
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/5 text-white"
              )}
            >
              Auto-refresh {autoRefresh ? "On" : "Off"}
            </button>

            {data ? (
              <>
                <Pill tone={data.isLive ? "green" : "amber"}>{data.provider}</Pill>
                <Pill tone="purple">{data.symbol}</Pill>
                {showCompare && compareData ? (
                  <Pill tone="cyan">vs {compareData.symbol}</Pill>
                ) : null}
                <Pill tone={toneFor(data.freshness.status)}>
                  {data.freshness.status}
                </Pill>
                <Pill tone={toneFor(data.marketSession.session)}>
                  {data.marketSession.session}
                </Pill>
                <Pill tone={data.latest?.sma200 ? "green" : "amber"}>
                  SMA200 {data.latest?.sma200 ? "Ready" : "Pending"}
                </Pill>
                <span className="text-xs font-semibold leading-6 text-slate-500">
                  Loaded{" "}
                  {lastLoadedAt ? new Date(lastLoadedAt).toLocaleTimeString() : "—"}
                </span>
              </>
            ) : null}
          </div>
        </Card>

        {data ? (
          <>
            <nav className="grid gap-2 rounded-[2rem] border border-white/10 bg-black/40 p-2 backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-6">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-left transition",
                    view === tab.id
                      ? "bg-white text-slate-950 shadow-lg shadow-red-950/20"
                      : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.07] hover:text-white"
                  )}
                >
                  <div className="text-sm font-black">{tab.label}</div>
                  <div
                    className={cx(
                      "mt-1 text-[11px] font-semibold",
                      view === tab.id ? "text-slate-600" : "text-slate-500"
                    )}
                  >
                    {tab.description}
                  </div>
                </button>
              ))}
            </nav>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Metric
                label="Last Price"
                value={money(latest?.close)}
                helper={data.symbol}
                tone={changeTone(latest?.change)}
              />
              <Metric
                label="Move"
                value={percent(latest?.changePct)}
                helper={money(latest?.change)}
                tone={changeTone(latest?.change)}
              />
              <Metric
                label="Technical Score"
                value={`${technicalScore}/100`}
                helper={data.signals.directionalBias}
                tone={
                  technicalScore >= 65
                    ? "green"
                    : technicalScore >= 45
                      ? "amber"
                      : "red"
                }
              />
              <Metric
                label="SMA 200"
                value={money(latest?.sma200)}
                helper={
                  latest?.sma200
                    ? latest.close > latest.sma200
                      ? "Price above 200 MA"
                      : "Price below 200 MA"
                    : "Need 200 candles"
                }
                tone={
                  latest?.sma200
                    ? latest.close > latest.sma200
                      ? "green"
                      : "red"
                    : "amber"
                }
              />
              <Metric
                label="ATR 14"
                value={money(latest?.atr14)}
                helper={
                  latest?.atr14 && latest.close
                    ? rawPercent((latest.atr14 / latest.close) * 100)
                    : "Volatility range"
                }
                tone="cyan"
              />
              <Metric
                label={`${confidenceLevel}% Range`}
                value={
                  predictiveAnalysis
                    ? `${money(predictiveAnalysis.lowerFinal)} – ${money(
                        predictiveAnalysis.upperFinal
                      )}`
                    : "—"
                }
                helper={`${horizonSteps} candles`}
                tone="purple"
              />
            </section>

            {view === "dashboard" || view === "technicals" ? (
              <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                      Live-Aware Technical Chart
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {data.symbol} close, VWAP, Bollinger Bands, and moving averages
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Includes SMA20, SMA50, SMA100, and SMA200. The 200-period
                      moving average requires at least 200 candles.
                    </p>
                  </div>

                  <div className="h-[520px]">
                    {visibleChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={compareOverlayData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                          <YAxis
                            stroke="#64748b"
                            domain={["auto", "auto"]}
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="bollingerUpper"
                            name="Bollinger Upper"
                            stroke="#475569"
                            fill="rgba(148,163,184,0.08)"
                            dot={false}
                            connectNulls
                          />
                          <Area
                            type="monotone"
                            dataKey="bollingerLower"
                            name="Bollinger Lower"
                            stroke="#475569"
                            fill="rgba(148,163,184,0.03)"
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="close"
                            name={`${data.symbol} Close`}
                            stroke="#ef4444"
                            strokeWidth={2.7}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="vwap"
                            name="VWAP"
                            stroke="#06b6d4"
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="sma20"
                            name="SMA 20"
                            stroke="#a855f7"
                            strokeWidth={1.35}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="sma50"
                            name="SMA 50"
                            stroke="#f59e0b"
                            strokeWidth={1.55}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="sma100"
                            name="SMA 100"
                            stroke="#3b82f6"
                            strokeWidth={1.35}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="sma200"
                            name="SMA 200"
                            stroke="#22c55e"
                            strokeWidth={2.15}
                            dot={false}
                            connectNulls
                          />
                          {showCompare && compareData ? (
                            <Line
                              type="monotone"
                              dataKey="compareClose"
                              name={`${compareData.symbol} Normalised`}
                              stroke="#f8fafc"
                              strokeWidth={1.7}
                              strokeDasharray="5 5"
                              dot={false}
                              connectNulls
                            />
                          ) : null}
                          <ReferenceLine
                            y={data.levels.support}
                            stroke="#22c55e"
                            strokeDasharray="4 4"
                          />
                          <ReferenceLine
                            y={data.levels.resistance}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Card>

                <div className="grid gap-6">
                  <Card>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      Signal Summary
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {data.signals.directionalBias}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {data.signals.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill tone={toneFor(data.signals.momentum)}>
                        {data.signals.momentum}
                      </Pill>
                      <Pill tone={toneFor(data.signals.riskState)}>
                        {data.signals.riskState}
                      </Pill>
                      <Pill tone="cyan">
                        RSI {latest?.rsi14?.toFixed(1) ?? "—"}
                      </Pill>
                      <Pill tone="purple">
                        MACD {latest?.macd?.toFixed(3) ?? "—"}
                      </Pill>
                      <Pill tone="green">SMA200 {money(latest?.sma200)}</Pill>
                    </div>
                  </Card>

                  <Card>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      Volume Confirmation
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Volume bars are shown against the 20-period volume average.
                    </p>
                    <div className="mt-4 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={visibleChartData.slice(-60)}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                          <YAxis stroke="#64748b" tickFormatter={compactNumber} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="volume"
                            name="Volume"
                            fill="#f59e0b"
                            radius={[8, 8, 0, 0]}
                          />
                          <Line
                            type="monotone"
                            dataKey="volumeSma20"
                            name="Volume SMA20"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </section>
            ) : null}

            {view === "dashboard" || view === "forecast" ? (
              <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      Predictive Analysis Engine
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {confidenceLevel}% confidence range over {horizonSteps} candles
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Deterministic range model using EWMA volatility, realised
                      returns, ATR, trend regression, RSI, MACD, VWAP distance,
                      200-period trend pressure, and mean reversion.
                    </p>
                  </div>

                  <div className="h-[430px]">
                    {predictiveAnalysis ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={predictionChartData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" stroke="#64748b" minTickGap={18} />
                          <YAxis
                            stroke="#64748b"
                            domain={["auto", "auto"]}
                            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="upper"
                            name="Upper Confidence Band"
                            stroke="#a855f7"
                            fill="rgba(168,85,247,0.14)"
                            dot={false}
                            connectNulls
                          />
                          <Area
                            type="monotone"
                            dataKey="lower"
                            name="Lower Confidence Band"
                            stroke="#ef4444"
                            fill="rgba(239,68,68,0.08)"
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="close"
                            name="Historical Close"
                            stroke="#f8fafc"
                            strokeWidth={2.25}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="projected"
                            name="Projected Path"
                            stroke="#06b6d4"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="bearish"
                            name="Bearish Scenario"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="bullish"
                            name="Bullish Scenario"
                            stroke="#22c55e"
                            strokeDasharray="4 4"
                            dot={false}
                            connectNulls
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="At least 20 candles are needed to generate a forecast range." />
                    )}
                  </div>
                </Card>

                <div className="grid gap-6">
                  <Card>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      Calculated Range
                    </div>
                    {predictiveAnalysis ? (
                      <div className="mt-4 grid gap-3">
                        <Metric
                          label="Projected Final"
                          value={money(predictiveAnalysis.projectedFinal)}
                          helper={percent(predictiveAnalysis.expectedMovePct)}
                          tone={
                            predictiveAnalysis.expectedMovePct >= 0
                              ? "green"
                              : "red"
                          }
                        />
                        <Metric
                          label="Lower Bound"
                          value={money(predictiveAnalysis.lowerFinal)}
                          helper={percent(predictiveAnalysis.downsideMovePct)}
                          tone="red"
                        />
                        <Metric
                          label="Upper Bound"
                          value={money(predictiveAnalysis.upperFinal)}
                          helper={percent(predictiveAnalysis.upsideMovePct)}
                          tone="green"
                        />
                        <Metric
                          label="Probability Up"
                          value={rawPercent(predictiveAnalysis.probabilityUp)}
                          helper={`Down: ${rawPercent(
                            predictiveAnalysis.probabilityDown
                          )}`}
                          tone={
                            predictiveAnalysis.probabilityUp >= 55
                              ? "green"
                              : predictiveAnalysis.probabilityUp <= 45
                                ? "red"
                                : "amber"
                          }
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        Not enough data yet.
                      </p>
                    )}
                  </Card>

                  {predictiveAnalysis ? (
                    <Card>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                        Algorithm Inputs
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300">
                        <div className="flex justify-between gap-4">
                          <span>EWMA volatility</span>
                          <strong>
                            {rawPercent(predictiveAnalysis.ewmaVolatility * 100, 3)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Realised volatility</span>
                          <strong>
                            {rawPercent(
                              predictiveAnalysis.realisedVolatility * 100,
                              3
                            )}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>ATR range</span>
                          <strong>
                            {rawPercent(predictiveAnalysis.atrPct * 100, 3)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Regression drift</span>
                          <strong>
                            {rawPercent(predictiveAnalysis.trendSlopePct * 100, 3)}
                          </strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Momentum score</span>
                          <strong>{predictiveAnalysis.momentumScore}/100</strong>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Volatility regime</span>
                          <strong>{predictiveAnalysis.volatilityRegime}</strong>
                        </div>
                      </div>
                    </Card>
                  ) : null}
                </div>
              </section>
            ) : null}

            {view === "forecast" && predictiveAnalysis ? (
              <Card>
                <div className="mb-5">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                    Confidence Interval Detail
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Forecast path table
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Step</th>
                        <th className="px-3 py-3">Projected</th>
                        <th className="px-3 py-3">Lower</th>
                        <th className="px-3 py-3">Upper</th>
                        <th className="px-3 py-3">Bearish Scenario</th>
                        <th className="px-3 py-3">Bullish Scenario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictiveAnalysis.forecast.map((point) => (
                        <tr key={point.step} className="border-t border-white/10">
                          <td className="px-3 py-3 font-black text-white">
                            +{point.step}
                          </td>
                          <td className="px-3 py-3 text-cyan-200">
                            {money(point.projected)}
                          </td>
                          <td className="px-3 py-3 text-red-200">
                            {money(point.lower)}
                          </td>
                          <td className="px-3 py-3 text-emerald-200">
                            {money(point.upper)}
                          </td>
                          <td className="px-3 py-3 text-amber-200">
                            {money(point.bearish)}
                          </td>
                          <td className="px-3 py-3 text-emerald-200">
                            {money(point.bullish)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {predictiveAnalysis.explanation.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {view === "technicals" ? (
              <section className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      RSI
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Relative strength with thresholds
                    </h2>
                  </div>
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleChartData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                        <YAxis stroke="#64748b" domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="rsi14"
                          name="RSI 14"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
                        <ReferenceLine y={50} stroke="#64748b" strokeDasharray="4 4" />
                        <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 4" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      MACD
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Momentum convergence
                    </h2>
                  </div>
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleChartData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                        <YAxis stroke="#64748b" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="macdHistogram"
                          name="MACD Histogram"
                          fill="#a855f7"
                          radius={[8, 8, 0, 0]}
                        />
                        <Line
                          type="monotone"
                          dataKey="macd"
                          name="MACD"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="macdSignal"
                          name="Signal"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                        <ReferenceLine y={0} stroke="#64748b" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="xl:col-span-2">
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                      Moving Average Stack
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      SMA20 / SMA50 / SMA100 / SMA200
                    </h2>
                  </div>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={visibleChartData}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                        <YAxis stroke="#64748b" domain={["auto", "auto"]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="close"
                          name="Close"
                          stroke="#f8fafc"
                          strokeWidth={2.5}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="sma20"
                          name="SMA 20"
                          stroke="#a855f7"
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="sma50"
                          name="SMA 50"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="sma100"
                          name="SMA 100"
                          stroke="#3b82f6"
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="sma200"
                          name="SMA 200"
                          stroke="#22c55e"
                          strokeWidth={2.4}
                          dot={false}
                          connectNulls
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>
            ) : null}

            {view === "compare" ? (
              <section className="grid gap-6">
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Metric
                    label="Primary Return"
                    value={compareStats ? percent(compareStats.primaryReturn) : "—"}
                    helper={data.symbol}
                    tone={
                      (compareStats?.primaryReturn ?? 0) >= 0 ? "green" : "red"
                    }
                  />
                  <Metric
                    label="Compare Return"
                    value={compareStats ? percent(compareStats.compareReturn) : "—"}
                    helper={compareData?.symbol ?? "Comparison"}
                    tone={
                      (compareStats?.compareReturn ?? 0) >= 0 ? "green" : "red"
                    }
                  />
                  <Metric
                    label="Spread"
                    value={compareStats ? percent(compareStats.spread) : "—"}
                    helper="Primary minus comparison"
                    tone={(compareStats?.spread ?? 0) >= 0 ? "green" : "red"}
                  />
                  <Metric
                    label="Leader"
                    value={compareStats?.leader ?? "—"}
                    helper="Normalised period"
                    tone="cyan"
                  />
                  <Metric
                    label="Primary / Compare"
                    value={`${money(compareStats?.primaryLatest)} / ${money(
                      compareStats?.compareLatest
                    )}`}
                    helper="Latest price"
                    tone="purple"
                  />
                </section>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      Relative Performance
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {data.symbol} vs {compareData?.symbol ?? compareSymbol}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      This chart compares percentage return from the first visible
                      candle, not absolute price.
                    </p>
                  </div>

                  <div className="h-[460px]">
                    {showCompare && compareData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={compareOverlayData}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" stroke="#64748b" minTickGap={24} />
                          <YAxis
                            stroke="#64748b"
                            tickFormatter={(value) =>
                              `${Number(value).toFixed(0)}%`
                            }
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="primaryReturnPct"
                            name={`${data.symbol} Return %`}
                            stroke="#ef4444"
                            strokeWidth={2.5}
                            dot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="compareReturnPct"
                            name={`${compareData.symbol} Return %`}
                            stroke="#06b6d4"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="spreadPct"
                            name="Spread %"
                            stroke="#22c55e"
                            strokeWidth={1.8}
                            strokeDasharray="5 5"
                            dot={false}
                            connectNulls
                          />
                          <ReferenceLine y={0} stroke="#64748b" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="Turn Compare On and load visuals to compare assets." />
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {view === "platform" ? (
              <section className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                      Platform Overview
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Advisor workspace data
                    </h2>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformOverview}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Count" radius={[8, 8, 0, 0]}>
                          {platformOverview.map((_, index) => (
                            <Cell
                              key={index}
                              fill={BAR_COLORS[index % BAR_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      Task Status
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Task status mix
                    </h2>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskStatusCounts}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          dataKey="value"
                          name="Tasks"
                          fill="#f59e0b"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                      Alert Scores
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Highest-priority alerts
                    </h2>
                  </div>
                  <div className="h-[330px]">
                    {alertScores.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alertScores.slice(0, 8)}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="name" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="score"
                            name="Alert Score"
                            radius={[8, 8, 0, 0]}
                          >
                            {alertScores.slice(0, 8).map((_, index) => (
                              <Cell
                                key={index}
                                fill={BAR_COLORS[index % BAR_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="No stored alert scores yet." />
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                      Opportunities
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Opportunity vs risk
                    </h2>
                  </div>
                  <div className="h-[330px]">
                    {opportunityMatrix.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={opportunityMatrix.slice(0, 10)}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="name" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar
                            dataKey="opportunity"
                            name="Opportunity"
                            fill="#22c55e"
                            radius={[8, 8, 0, 0]}
                          />
                          <Bar
                            dataKey="risk"
                            name="Risk"
                            fill="#ef4444"
                            radius={[8, 8, 0, 0]}
                          />
                          <Line
                            dataKey="composite"
                            name="Composite"
                            stroke="#06b6d4"
                            strokeWidth={2}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="No opportunity signals yet." />
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                      Source Credibility
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Credibility and transparency
                    </h2>
                  </div>
                  <div className="grid gap-3">
                    {sourceCredibility.slice(0, 8).map((source) => (
                      <div
                        key={`${source.sourceName}-${source.domain}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-black text-white">
                              {source.sourceName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {source.domain}
                            </div>
                          </div>
                          <Pill tone={toneFor(source.status)}>
                            {source.status}
                          </Pill>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-300">
                          <div>Credibility: {source.credibility}</div>
                          <div>Transparency: {source.transparency}</div>
                          <div>Bias Risk: {source.biasRisk}</div>
                        </div>
                      </div>
                    ))}
                    {!sourceCredibility.length ? (
                      <div className="text-sm text-slate-500">
                        No source credibility records yet.
                      </div>
                    ) : null}
                  </div>
                </Card>

                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                      Watchlist Heat
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Tracked asset heatmap
                    </h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {watchlistHeatmap.slice(0, 10).map((item) => (
                      <div
                        key={`${item.symbol}-${item.sourceType}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xl font-black text-white">
                            {item.symbol}
                          </div>
                          <Pill
                            tone={
                              item.score >= 75
                                ? "green"
                                : item.score >= 50
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {item.score}
                          </Pill>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {item.priority} · {item.status} · {item.sourceType}
                        </div>
                      </div>
                    ))}
                    {!watchlistHeatmap.length ? (
                      <div className="text-sm text-slate-500">
                        No watchlist heatmap records yet.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </section>
            ) : null}

            {view === "data" ? (
              <section className="grid gap-6">
                <Card>
                  <div className="mb-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      Data Table
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Recent candles with technical columns
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1320px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="px-3 py-3">Time</th>
                          <th className="px-3 py-3">Open</th>
                          <th className="px-3 py-3">High</th>
                          <th className="px-3 py-3">Low</th>
                          <th className="px-3 py-3">Close</th>
                          <th className="px-3 py-3">Return</th>
                          <th className="px-3 py-3">Cum. Return</th>
                          <th className="px-3 py-3">Volume</th>
                          <th className="px-3 py-3">VWAP</th>
                          <th className="px-3 py-3">SMA 50</th>
                          <th className="px-3 py-3">SMA 100</th>
                          <th className="px-3 py-3">SMA 200</th>
                          <th className="px-3 py-3">ATR 14</th>
                          <th className="px-3 py-3">RSI</th>
                          <th className="px-3 py-3">MACD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleChartData
                          .slice()
                          .reverse()
                          .map((candle) => (
                            <tr
                              key={`${candle.date}-${candle.close}`}
                              className="border-t border-white/10"
                            >
                              <td className="px-3 py-3 font-bold text-white">
                                {candle.label}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {money(candle.open)}
                              </td>
                              <td className="px-3 py-3 text-emerald-200">
                                {money(candle.high)}
                              </td>
                              <td className="px-3 py-3 text-red-200">
                                {money(candle.low)}
                              </td>
                              <td className="px-3 py-3 text-cyan-200">
                                {money(candle.close)}
                              </td>
                              <td
                                className={cx(
                                  "px-3 py-3",
                                  (candle.returnPct ?? 0) >= 0
                                    ? "text-emerald-200"
                                    : "text-red-200"
                                )}
                              >
                                {percent(candle.returnPct, 3)}
                              </td>
                              <td
                                className={cx(
                                  "px-3 py-3",
                                  (candle.cumulativeReturnPct ?? 0) >= 0
                                    ? "text-emerald-200"
                                    : "text-red-200"
                                )}
                              >
                                {percent(candle.cumulativeReturnPct, 2)}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {compactNumber(candle.volume)}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {money(candle.vwap)}
                              </td>
                              <td className="px-3 py-3 text-amber-200">
                                {money(candle.sma50)}
                              </td>
                              <td className="px-3 py-3 text-blue-200">
                                {money(candle.sma100)}
                              </td>
                              <td className="px-3 py-3 text-emerald-200">
                                {money(candle.sma200)}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {money(candle.atr14)}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {candle.rsi14?.toFixed(1) ?? "—"}
                              </td>
                              <td className="px-3 py-3 text-slate-300">
                                {candle.macd?.toFixed(4) ?? "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>
            ) : null}

            <Card className="border-amber-500/20 bg-amber-500/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                    Model Disclaimer
                  </div>
                  <p className="mt-2 text-sm leading-6 text-amber-100/80">
                    Predictive ranges are statistical estimates only. They are not
                    investment advice, guarantees, or trade instructions. Verify live
                    data, liquidity, news, client suitability, and risk tolerance
                    before making decisions.
                  </p>
                  {data.quality.warnings.length ? (
                    <div className="mt-3 text-xs leading-5 text-amber-200">
                      {data.quality.warnings.join(" ")}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill
                    tone={
                      data.quality.score >= 80
                        ? "green"
                        : data.quality.score >= 60
                          ? "amber"
                          : "red"
                    }
                  >
                    Quality {data.quality.score}
                  </Pill>
                  <Pill tone="cyan">Provider {data.provider}</Pill>
                  <Pill tone="purple">Forecast {confidenceLevel}%</Pill>
                  <Pill tone="green">{data.candles.length} candles</Pill>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <EmptyChart label="Load a ticker to begin market visualization." />
          </Card>
        )}
      </div>
    </main>
  );
}