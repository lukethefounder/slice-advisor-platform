"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ForecastFactorContribution,
  ForecastHorizon,
  ForecastHorizonResult,
  ForecastResponse,
  MarketRegime,
  MarketSnapshot,
} from "@/lib/intelligence-forecast/types";

type AlphaVantageData = {
  symbol: string;
  updatedAt: string;
  error?: string;

  quote?: {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
  };

  overview?: {
    name?: string;
    sector?: string;
    marketCap?: number;
    peRatio?: number;
    pegRatio?: number;
    profitMargin?: number;
    operatingMargin?: number;
    returnOnEquity?: number;
    quarterlyRevenueGrowthYOY?: number;
    quarterlyEarningsGrowthYOY?: number;
    analystTargetPrice?: number;
    beta?: number;
  };

  technicals?: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    volatility20?: number;
    momentum30?: number;
    drawdownFromHigh?: number;
    volumeTrend?: number;
    trendScore?: number;
    momentumScore?: number;
    riskScore?: number;
    volumeScore?: number;
  };

  news?: {
    averageSentiment?: number;
    relevanceWeightedSentiment?: number;
    articleCount?: number;
    latestTitle?: string;
  };
};

type ScanItem = {
  id: string;
  sourceName: string;
  score: number;
  urgency: string;
  matchedTickers: string[];
  reasons: string[];
};

type ScanResult = {
  scannedAt: string;

  sources: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
  }>;

  items: ScanItem[];
  alertCandidates: ScanItem[];
  digestCandidates: ScanItem[];
  suppressed: ScanItem[];
};

type Assumptions = {
  regime: MarketRegime;

  macroAlignment: number;
  macroStress: number;
  macroLiquidity: number;
  macroSurprise: number;

  optionsScore: number;
  crowding: number;
  shortInterest: number;
  dealerGamma: number;
  impliedVolatility: number;
  skew: number;

  environmentalAlignment: number;
  disruptionRisk: number;
  geographicExposure: number;

  supplyResilience: number;
  propagationRisk: number;
  concentrationRisk: number;

  novelty: number;
  sourceReliability: number;
  contradiction: number;
  eventMagnitude: number;

  simulationPaths: number;
};

const REGIMES: MarketRegime[] = [
  "Trending Bull",
  "Trending Bear",
  "Range Bound",
  "High-Volatility Risk-Off",
  "Low-Volatility Expansion",
  "Liquidity Stress",
  "Recovery",
  "Unknown",
];

const DEFAULT_ASSUMPTIONS: Assumptions = {
  regime: "Unknown",

  macroAlignment: 50,
  macroStress: 30,
  macroLiquidity: 50,
  macroSurprise: 0,

  optionsScore: 50,
  crowding: 40,
  shortInterest: 30,
  dealerGamma: 0,
  impliedVolatility: 0,
  skew: 0,

  environmentalAlignment: 50,
  disruptionRisk: 20,
  geographicExposure: 30,

  supplyResilience: 50,
  propagationRisk: 30,
  concentrationRisk: 30,

  novelty: 55,
  sourceReliability: 65,
  contradiction: 20,
  eventMagnitude: 35,

  simulationPaths: 400,
};

const panelClass =
  "rounded-[1.75rem] border border-red-400/10 bg-black/45 p-5 shadow-2xl shadow-red-950/10 backdrop-blur-xl";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/10";

const buttonClass =
  "rounded-xl bg-gradient-to-r from-red-500 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

function clamp(
  value: number,
  min = 0,
  max = 100,
) {
  return Math.max(
    min,
    Math.min(
      max,
      Number.isFinite(value)
        ? value
        : min,
    ),
  );
}

function safeNumber(
  value: unknown,
  fallback = 0,
) {
  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? numeric
    : fallback;
}

function hashSeed(value: string) {
  let hash = 2_166_136_261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(
      hash,
      16_777_619,
    );
  }

  return Math.abs(hash) || 1;
}

function requestId(symbol: string) {
  const uuid =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `${symbol}:${uuid}`;
}

function scoreHigherIsBetter(
  value: number,
  low: number,
  high: number,
) {
  if (high === low) {
    return 50;
  }

  return clamp(
    ((value - low) /
      (high - low)) *
      100,
  );
}

function scoreLowerIsBetter(
  value: number,
  low: number,
  high: number,
) {
  return clamp(
    100 -
      scoreHigherIsBetter(
        value,
        low,
        high,
      ),
  );
}

function deriveExistingSliceScore(
  alpha: AlphaVantageData,
  scan: ScanResult | null,
) {
  const newsScore = clamp(
    50 +
      safeNumber(
        alpha.news
          ?.relevanceWeightedSentiment,
      ) *
        50,
  );

  const sourceCount =
    scan?.items.length ??
    safeNumber(
      alpha.news?.articleCount,
    );

  const sourceCredibility = clamp(
    58 +
      Math.min(
        sourceCount,
        30,
      ) *
        1.2,
  );

  const narrativeVelocity = clamp(
    50 +
      safeNumber(
        alpha.quote
          ?.changePercent,
      ) *
        2.7,
  );

  const technicalTrend =
    safeNumber(
      alpha.technicals
        ?.trendScore,
      50,
    );

  const technicalBreadth = 50;

  const valuation = clamp(
    scoreLowerIsBetter(
      safeNumber(
        alpha.overview
          ?.peRatio,
        25,
      ),
      8,
      45,
    ) *
      0.32 +
      scoreLowerIsBetter(
        safeNumber(
          alpha.overview
            ?.pegRatio,
          2.5,
        ),
        0.5,
        4,
      ) *
        0.28 +
      scoreHigherIsBetter(
        ((safeNumber(
          alpha.overview
            ?.analystTargetPrice,
          alpha.quote?.price,
        ) -
          safeNumber(
            alpha.quote?.price,
            1,
          )) /
          Math.max(
            safeNumber(
              alpha.quote?.price,
              1,
            ),
            1,
          )) *
          100,
        -15,
        35,
      ) *
        0.4,
  );

  const growth = clamp(
    scoreHigherIsBetter(
      safeNumber(
        alpha.overview
          ?.quarterlyRevenueGrowthYOY,
      ) * 100,
      -10,
      35,
    ) *
      0.45 +
      scoreHigherIsBetter(
        safeNumber(
          alpha.overview
            ?.quarterlyEarningsGrowthYOY,
        ) * 100,
        -15,
        45,
      ) *
        0.55,
  );

  const quality = clamp(
    scoreHigherIsBetter(
      safeNumber(
        alpha.overview
          ?.profitMargin,
      ) * 100,
      0,
      35,
    ) *
      0.35 +
      scoreHigherIsBetter(
        safeNumber(
          alpha.overview
            ?.operatingMargin,
        ) * 100,
        0,
        40,
      ) *
        0.3 +
      scoreHigherIsBetter(
        safeNumber(
          alpha.overview
            ?.returnOnEquity,
        ) * 100,
        0,
        45,
      ) *
        0.35,
  );

  const marginOfSafety = clamp(
    valuation * 0.55 +
      growth * 0.15 +
      quality * 0.3,
  );

  const volatilityControl =
    safeNumber(
      alpha.technicals
        ?.riskScore,
      50,
    );

  const liquidity =
    alpha.quote?.volume
      ? scoreHigherIsBetter(
          Math.log10(
            Math.max(
              alpha.quote.volume,
              1,
            ),
          ),
          4.5,
          8.5,
        )
      : 50;

  const contradiction = clamp(
    Math.abs(
      newsScore -
        technicalTrend,
    ) *
      0.36 +
      Math.abs(
        valuation -
          growth,
      ) *
        0.28 +
      Math.max(
        0,
        55 - liquidity,
      ) *
        0.2,
  );

  const composite = clamp(
    newsScore * 0.09 +
      sourceCredibility * 0.09 +
      narrativeVelocity * 0.05 +
      technicalTrend * 0.13 +
      technicalBreadth * 0.05 +
      valuation * 0.12 +
      growth * 0.12 +
      quality * 0.12 +
      marginOfSafety * 0.08 +
      volatilityControl * 0.08 +
      liquidity * 0.07 -
      contradiction * 0.1,
  );

  const confidence = clamp(
    sourceCredibility * 0.2 +
      quality * 0.15 +
      volatilityControl * 0.15 +
      liquidity * 0.15 +
      Math.max(
        0,
        100 - contradiction,
      ) *
        0.2 +
      Math.min(
        sourceCount * 2,
        100,
      ) *
        0.15,
  );

  return {
    composite,
    confidence,
    contradiction,
    sourceCredibility,
  };
}

function buildSnapshot(
  symbol: string,
  alpha: AlphaVantageData,
  scan: ScanResult | null,
  assumptions: Assumptions,
): MarketSnapshot {
  const quote = alpha.quote;

  if (!quote?.price) {
    throw new Error(
      "No live price was returned for this symbol.",
    );
  }

  const score =
    deriveExistingSliceScore(
      alpha,
      scan,
    );

  const tickerItems =
    scan?.items.filter(
      (item) =>
        item.matchedTickers.includes(
          symbol,
        ),
    ) ?? [];

  const relevantItems =
    tickerItems.length
      ? tickerItems
      : scan?.items ?? [];

  const independentSourceCount =
    new Set(
      relevantItems.map(
        (item) =>
          item.sourceName,
      ),
    ).size;

  const sourceCount =
    relevantItems.length ||
    safeNumber(
      alpha.news?.articleCount,
    );

  const availableFields = [
    alpha.quote?.price,
    alpha.technicals
      ?.trendScore,
    alpha.technicals
      ?.momentumScore,
    alpha.overview
      ?.quarterlyRevenueGrowthYOY,
    alpha.news
      ?.relevanceWeightedSentiment,
  ].filter(
    (value) =>
      value !== undefined &&
      value !== null,
  ).length;

  const dataQuality = clamp(
    score.sourceCredibility *
      0.35 +
      (availableFields / 5) *
        100 *
        0.35 +
      Math.min(
        independentSourceCount * 10,
        100,
      ) *
        0.3,
  );

  const asOf =
    alpha.updatedAt ||
    new Date().toISOString();

  const staleData =
    Date.now() -
      Date.parse(asOf) >
    36 * 60 * 60 * 1000;

  return {
    schemaVersion:
      "slice-forecast-input-1.0.0",

    requestId:
      requestId(symbol),

    symbol,
    asOf,

    price: {
      current:
        quote.price,

      previousClose:
        quote.previousClose ||
        quote.price,

      volume:
        quote.volume || 0,
    },

    slice: {
      sentimentScore:
        score.composite,

      sentimentConfidence:
        score.confidence,

      dataQuality,
      sourceCount,

      independentSourceCount,

      duplicateCount: 0,
      staleData,
    },

    technicals: {
      trendScore:
        safeNumber(
          alpha.technicals
            ?.trendScore,
          50,
        ),

      momentumScore:
        safeNumber(
          alpha.technicals
            ?.momentumScore,
          50,
        ),

      riskScore:
        safeNumber(
          alpha.technicals
            ?.riskScore,
          50,
        ),

      volumeScore:
        safeNumber(
          alpha.technicals
            ?.volumeScore,
          50,
        ),

      rsi14:
        safeNumber(
          alpha.technicals
            ?.rsi14,
          50,
        ),

      volatility20:
        safeNumber(
          alpha.technicals
            ?.volatility20,
          2.5,
        ),

      momentum30:
        safeNumber(
          alpha.technicals
            ?.momentum30,
          0,
        ),

      drawdownFromHigh:
        safeNumber(
          alpha.technicals
            ?.drawdownFromHigh,
          0,
        ),

      volumeTrend:
        safeNumber(
          alpha.technicals
            ?.volumeTrend,
          0,
        ),
    },

    fundamentals: {
      peRatio:
        safeNumber(
          alpha.overview
            ?.peRatio,
          0,
        ),

      pegRatio:
        safeNumber(
          alpha.overview
            ?.pegRatio,
          0,
        ),

      profitMargin:
        safeNumber(
          alpha.overview
            ?.profitMargin,
          0,
        ),

      operatingMargin:
        safeNumber(
          alpha.overview
            ?.operatingMargin,
          0,
        ),

      returnOnEquity:
        safeNumber(
          alpha.overview
            ?.returnOnEquity,
          0,
        ),

      quarterlyRevenueGrowthYOY:
        safeNumber(
          alpha.overview
            ?.quarterlyRevenueGrowthYOY,
          0,
        ),

      quarterlyEarningsGrowthYOY:
        safeNumber(
          alpha.overview
            ?.quarterlyEarningsGrowthYOY,
          0,
        ),

      analystTargetPrice:
        safeNumber(
          alpha.overview
            ?.analystTargetPrice,
          0,
        ),

      beta:
        safeNumber(
          alpha.overview
            ?.beta,
          1,
        ),
    },

    news: {
      relevanceWeightedSentiment:
        safeNumber(
          alpha.news
            ?.relevanceWeightedSentiment,
          0,
        ),

      articleCount:
        safeNumber(
          alpha.news
            ?.articleCount,
          sourceCount,
        ),

      noveltyScore:
        assumptions.novelty,

      sourceReliability:
        assumptions.sourceReliability,

      contradictionScore:
        Math.max(
          assumptions.contradiction,
          score.contradiction,
        ),

      eventMagnitude:
        assumptions.eventMagnitude,
    },

    macro: {
      regime:
        assumptions.regime,

      alignmentScore:
        assumptions.macroAlignment,

      stressScore:
        assumptions.macroStress,

      liquidityScore:
        assumptions.macroLiquidity,

      surpriseScore:
        assumptions.macroSurprise,
    },

    positioning: {
      optionsScore:
        assumptions.optionsScore,

      crowdingScore:
        assumptions.crowding,

      shortInterestScore:
        assumptions.shortInterest,

      dealerGammaScore:
        assumptions.dealerGamma,

      impliedVolatilityPercent:
        assumptions.impliedVolatility,

      skewScore:
        assumptions.skew,
    },

    environment: {
      alignmentScore:
        assumptions.environmentalAlignment,

      disruptionRisk:
        assumptions.disruptionRisk,

      geographicExposure:
        assumptions.geographicExposure,
    },

    supplyChain: {
      resilienceScore:
        assumptions.supplyResilience,

      propagationRisk:
        assumptions.propagationRisk,

      concentrationRisk:
        assumptions.concentrationRisk,
    },

    simulation: {
      enabled: true,

      paths:
        assumptions.simulationPaths,

      seed: hashSeed(
        `${symbol}:${asOf.slice(
          0,
          10,
        )}`,
      ),
    },
  };
}

function toneForDirection(
  direction:
    ForecastHorizonResult["direction"],
) {
  if (
    direction === "Bullish"
  ) {
    return "text-emerald-300 border-emerald-400/20 bg-emerald-500/10";
  }

  if (
    direction === "Bearish"
  ) {
    return "text-red-200 border-red-400/20 bg-red-500/10";
  }

  return "text-amber-200 border-amber-400/20 bg-amber-500/10";
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">
        {value}
      </div>

      {helper ? (
        <div className="mt-1 text-xs text-slate-500">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
      <span className="flex items-center justify-between text-xs font-black text-slate-300">
        {label}

        <span className="text-red-300">
          {value}
        </span>
      </span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
        className="accent-red-600"
      />
    </label>
  );
}

function ContributionRow({
  contribution,
}: {
  contribution:
    ForecastFactorContribution;
}) {
  const width = Math.min(
    100,
    Math.abs(
      contribution.contribution,
    ) * 350,
  );

  const positive =
    contribution.contribution >= 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-black text-white">
          {contribution.factor}
        </span>

        <span
          className={
            positive
              ? "text-emerald-300"
              : "text-red-300"
          }
        >
          {positive ? "+" : ""}
          {contribution.contribution.toFixed(
            3,
          )}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={
            positive
              ? "h-full rounded-full bg-emerald-500"
              : "h-full rounded-full bg-red-500"
          }
          style={{
            width: `${width}%`,
          }}
        />
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {contribution.explanation}
      </p>
    </div>
  );
}

export default function ForecastLabPage() {
  const [symbol, setSymbol] =
    useState("MSFT");

  const [
    assumptions,
    setAssumptions,
  ] = useState<Assumptions>(
    DEFAULT_ASSUMPTIONS,
  );

  const [
    forecast,
    setForecast,
  ] =
    useState<ForecastResponse | null>(
      null,
    );

  const [
    selectedHorizon,
    setSelectedHorizon,
  ] =
    useState<ForecastHorizon>(
      "2-5d",
    );

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState(
      "Run the model to load current Slice data, execute controlled scenario paths, and calculate all eight horizons.",
    );

  const selected = useMemo(
    () =>
      forecast?.horizons.find(
        (item) =>
          item.horizon ===
          selectedHorizon,
      ) ?? null,
    [
      forecast,
      selectedHorizon,
    ],
  );

  function setAssumption<
    K extends keyof Assumptions,
  >(
    key: K,
    value: Assumptions[K],
  ) {
    setAssumptions(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  async function runForecast() {
    const cleanSymbol = symbol
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9.\-]/g,
        "",
      );

    if (!cleanSymbol) {
      setMessage(
        "Enter a valid ticker symbol.",
      );

      return;
    }

    setLoading(true);

    setMessage(
      "Loading current Slice intelligence and building the point-in-time evidence snapshot...",
    );

    try {
      const [
        alphaResponse,
        scanResponse,
      ] = await Promise.all([
        fetch(
          `/api/intelligence/alpha-vantage?symbol=${encodeURIComponent(
            cleanSymbol,
          )}`,
          {
            cache: "no-store",
          },
        ),

        fetch(
          "/api/intelligence/scan",
          {
            cache: "no-store",
          },
        ),
      ]);

      const alpha =
        (await alphaResponse.json()) as AlphaVantageData;

      const scan =
        scanResponse.ok
          ? ((await scanResponse.json()) as ScanResult)
          : null;

      if (
        !alphaResponse.ok ||
        alpha.error
      ) {
        throw new Error(
          alpha.error ||
            "Alpha Vantage market data request failed.",
        );
      }

      const snapshot =
        buildSnapshot(
          cleanSymbol,
          alpha,
          scan,
          assumptions,
        );

      setMessage(
        `Running ${snapshot.simulation.paths.toLocaleString()} deterministic market-population paths and the restricted CAMEL workforce when authenticated...`,
      );

      const response = await fetch(
        "/api/intelligence/forecast",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            snapshot,
          ),
        },
      );

      const payload =
        (await response.json()) as ForecastResponse & {
          error?: string;
          detail?: string;
          issues?: string[];
        };

      if (!response.ok) {
        throw new Error(
          payload.issues?.join(
            " ",
          ) ||
            payload.detail ||
            payload.error ||
            "Forecast request failed.",
        );
      }

      setForecast(payload);

      setSelectedHorizon(
        "2-5d",
      );

      setMessage(
        `Completed at ${new Date(
          payload.generatedAt,
        ).toLocaleTimeString()}. Simulation consensus remains scenario evidence—not market truth.`,
      );
    } catch (error) {
      setForecast(null);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the forecast.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.30),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_30%),linear-gradient(135deg,_#020202,_#09090b,_#160606)] p-4 text-white sm:p-6 lg:p-8">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:44px_44px]" />

      <div className="relative mx-auto grid max-w-[1800px] gap-5">
        <header
          className={`${panelClass} relative overflow-hidden p-6 lg:p-8`}
        >
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-red-600/10 to-transparent" />

          <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Eight Horizons",
                  "Regime Aware",
                  "Capped Simulation Weight",
                  "CAMEL-AI Restricted",
                  "No Live Trading",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Slice Multi-Agent
                Forecast Lab
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                This extension
                preserves the current
                Slice Sentiment Score,
                adds regime-aware
                mathematical forecasts,
                simulates heterogeneous
                market participants, and
                uses CAMEL-AI only for
                structured behavioral
                features,
                contradictions, and
                stress testing.
                Simulated agreement is
                never treated as
                guaranteed market truth.
              </p>
            </div>

            <Link
              href="/workspace/intelligence"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:border-red-400/30 hover:bg-red-500/10"
            >
              ← Core Intelligence
            </Link>
          </div>
        </header>

        <section
          className={panelClass}
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.7fr_auto] xl:items-end">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Security
              </span>

              <input
                value={symbol}
                onChange={(event) =>
                  setSymbol(
                    event.target.value.toUpperCase(),
                  )
                }
                className={
                  inputClass
                }
                placeholder="MSFT"
                maxLength={15}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Market regime
              </span>

              <select
                value={
                  assumptions.regime
                }
                onChange={(event) =>
                  setAssumption(
                    "regime",
                    event.target
                      .value as MarketRegime,
                  )
                }
                className={
                  inputClass
                }
              >
                {REGIMES.map(
                  (regime) => (
                    <option
                      key={regime}
                      value={regime}
                    >
                      {regime}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Scenario paths
              </span>

              <select
                value={
                  assumptions.simulationPaths
                }
                onChange={(event) =>
                  setAssumption(
                    "simulationPaths",
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
                className={
                  inputClass
                }
              >
                {[
                  200,
                  400,
                  800,
                  1200,
                  2000,
                ].map(
                  (paths) => (
                    <option
                      key={paths}
                      value={paths}
                    >
                      {paths.toLocaleString()}
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={() =>
                void runForecast()
              }
              disabled={loading}
              className={
                buttonClass
              }
            >
              {loading
                ? "Running Intelligence..."
                : "Run Full Forecast"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-500/[0.05] px-4 py-3 text-sm leading-6 text-amber-100">
            {message}
          </div>
        </section>

        <details
          className={panelClass}
        >
          <summary className="cursor-pointer text-lg font-black text-white">
            Advanced point-in-time
            assumptions

            <span className="ml-3 text-xs font-semibold text-slate-500">
              Use licensed connectors
              later; values below are
              explicit—not hidden AI
              guesses.
            </span>
          </summary>

          <div className="mt-5 grid gap-5 xl:grid-cols-4">
            <div className="grid gap-3">
              <h3 className="font-black text-red-200">
                Macro and liquidity
              </h3>

              <ScoreInput
                label="Macro alignment"
                value={
                  assumptions.macroAlignment
                }
                onChange={(value) =>
                  setAssumption(
                    "macroAlignment",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Macro stress"
                value={
                  assumptions.macroStress
                }
                onChange={(value) =>
                  setAssumption(
                    "macroStress",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Liquidity"
                value={
                  assumptions.macroLiquidity
                }
                onChange={(value) =>
                  setAssumption(
                    "macroLiquidity",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Surprise"
                value={
                  assumptions.macroSurprise
                }
                min={-100}
                max={100}
                onChange={(value) =>
                  setAssumption(
                    "macroSurprise",
                    value,
                  )
                }
              />
            </div>

            <div className="grid gap-3">
              <h3 className="font-black text-red-200">
                Options and
                positioning
              </h3>

              <ScoreInput
                label="Options signal"
                value={
                  assumptions.optionsScore
                }
                onChange={(value) =>
                  setAssumption(
                    "optionsScore",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Crowding"
                value={
                  assumptions.crowding
                }
                onChange={(value) =>
                  setAssumption(
                    "crowding",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Short-interest pressure"
                value={
                  assumptions.shortInterest
                }
                onChange={(value) =>
                  setAssumption(
                    "shortInterest",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Dealer gamma"
                value={
                  assumptions.dealerGamma
                }
                min={-100}
                max={100}
                onChange={(value) =>
                  setAssumption(
                    "dealerGamma",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Implied volatility %"
                value={
                  assumptions.impliedVolatility
                }
                max={200}
                onChange={(value) =>
                  setAssumption(
                    "impliedVolatility",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Skew"
                value={
                  assumptions.skew
                }
                min={-100}
                max={100}
                onChange={(value) =>
                  setAssumption(
                    "skew",
                    value,
                  )
                }
              />
            </div>

            <div className="grid gap-3">
              <h3 className="font-black text-red-200">
                Environment and
                supply chain
              </h3>

              <ScoreInput
                label="Environmental alignment"
                value={
                  assumptions.environmentalAlignment
                }
                onChange={(value) =>
                  setAssumption(
                    "environmentalAlignment",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Physical disruption risk"
                value={
                  assumptions.disruptionRisk
                }
                onChange={(value) =>
                  setAssumption(
                    "disruptionRisk",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Geographic exposure"
                value={
                  assumptions.geographicExposure
                }
                onChange={(value) =>
                  setAssumption(
                    "geographicExposure",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Supply-chain resilience"
                value={
                  assumptions.supplyResilience
                }
                onChange={(value) =>
                  setAssumption(
                    "supplyResilience",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Propagation risk"
                value={
                  assumptions.propagationRisk
                }
                onChange={(value) =>
                  setAssumption(
                    "propagationRisk",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Concentration risk"
                value={
                  assumptions.concentrationRisk
                }
                onChange={(value) =>
                  setAssumption(
                    "concentrationRisk",
                    value,
                  )
                }
              />
            </div>

            <div className="grid gap-3">
              <h3 className="font-black text-red-200">
                Evidence quality
              </h3>

              <ScoreInput
                label="Novelty"
                value={
                  assumptions.novelty
                }
                onChange={(value) =>
                  setAssumption(
                    "novelty",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Source reliability"
                value={
                  assumptions.sourceReliability
                }
                onChange={(value) =>
                  setAssumption(
                    "sourceReliability",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Contradiction"
                value={
                  assumptions.contradiction
                }
                onChange={(value) =>
                  setAssumption(
                    "contradiction",
                    value,
                  )
                }
              />

              <ScoreInput
                label="Event magnitude"
                value={
                  assumptions.eventMagnitude
                }
                onChange={(value) =>
                  setAssumption(
                    "eventMagnitude",
                    value,
                  )
                }
              />
            </div>
          </div>
        </details>

        {forecast ? (
          <>
            {forecast.staleDataWarning ? (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {
                  forecast.staleDataWarning
                }
              </div>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Metric
                label="Slice Sentiment"
                value={`${forecast.sliceSentimentScore}/100`}
                helper="Not a probability"
              />

              <Metric
                label="Data Quality"
                value={`${forecast.dataQualityScore}/100`}
                helper={`${forecast.provenance.independentSourceCount} independent sources`}
              />

              <Metric
                label="Regime"
                value={
                  forecast.marketRegime
                }
                helper="Regime-aware weights"
              />

              <Metric
                label="Simulation"
                value={`${forecast.simulation.paths.toLocaleString()} paths`}
                helper={`${forecast.simulation.probabilityPositive}% positive`}
              />

              <Metric
                label="CAMEL-AI"
                value={
                  forecast.camel.status
                }
                helper={
                  forecast.camel.audit
                    .workforceMode
                }
              />

              <Metric
                label="Trading"
                value="Disabled"
                helper="Decision support only"
              />
            </section>

            <section
              className={panelClass}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                    Multi-horizon
                    ensemble
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    Independent conclusions
                    by time interval
                  </h2>
                </div>

                <div className="text-xs text-slate-500">
                  As of{" "}
                  {new Date(
                    forecast.asOf,
                  ).toLocaleString()}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {forecast.horizons.map(
                  (item) => (
                    <button
                      key={
                        item.horizon
                      }
                      type="button"
                      onClick={() =>
                        setSelectedHorizon(
                          item.horizon,
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedHorizon ===
                        item.horizon
                          ? "border-red-400/45 bg-red-500/10"
                          : "border-white/8 bg-white/[0.025] hover:border-red-400/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white">
                          {
                            item.label
                          }
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-black ${toneForDirection(
                            item.direction,
                          )}`}
                        >
                          {
                            item.direction
                          }
                        </span>
                      </div>

                      <div className="mt-4 text-3xl font-black">
                        {
                          item.positiveReturnProbability
                        }
                        %
                      </div>

                      <div className="text-xs text-slate-500">
                        positive-return
                        probability
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-700 via-amber-400 to-emerald-500"
                          style={{
                            width: `${item.positiveReturnProbability}%`,
                          }}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">
                          Expected
                        </span>

                        <span className="text-right font-black text-white">
                          {item.expectedReturnPercent >
                          0
                            ? "+"
                            : ""}
                          {
                            item.expectedReturnPercent
                          }
                          %
                        </span>

                        <span className="text-slate-500">
                          Confidence
                        </span>

                        <span className="text-right font-black text-white">
                          {
                            item.confidence
                          }
                          %
                        </span>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </section>

            {selected ? (
              <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div
                  className={
                    panelClass
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                        Selected horizon
                      </div>

                      <h2 className="mt-1 text-2xl font-black">
                        {
                          selected.label
                        }
                      </h2>
                    </div>

                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-black ${toneForDirection(
                        selected.direction,
                      )}`}
                    >
                      {
                        selected.direction
                      }
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Metric
                      label="Positive probability"
                      value={`${selected.positiveReturnProbability}%`}
                      helper="Calibrated and quality-shrunk"
                    />

                    <Metric
                      label="Expected return"
                      value={`${selected.expectedReturnPercent > 0 ? "+" : ""}${selected.expectedReturnPercent}%`}
                      helper={`Expected price $${selected.expectedPrice}`}
                    />

                    <Metric
                      label="Expected range"
                      value={`${selected.expectedRangePercent.low}% to ${selected.expectedRangePercent.high}%`}
                      helper={`$${selected.expectedPriceRange.low} to $${selected.expectedPriceRange.high}`}
                    />

                    <Metric
                      label="Volatility"
                      value={`${selected.volatilityPercent}%`}
                      helper="Horizon-scaled blend"
                    />

                    <Metric
                      label="Model agreement"
                      value={
                        selected.modelAgreement
                      }
                      helper={`${selected.modelDisagreement}% disagreement`}
                    />

                    <Metric
                      label="Simulation agreement"
                      value={
                        selected.simulationAgreement
                      }
                      helper={`${forecast.simulation.agentDisagreement}% agent disagreement`}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                      Primary uncertainty
                    </div>

                    <p className="mt-2 text-sm leading-6 text-amber-100">
                      {
                        selected.primaryUncertainty
                      }
                    </p>
                  </div>
                </div>

                <div
                  className={
                    panelClass
                  }
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                    Transparent factor path
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    Weighted
                    contributions
                  </h2>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {selected.contributions.map(
                      (
                        contribution,
                      ) => (
                        <ContributionRow
                          key={
                            contribution.factor
                          }
                          contribution={
                            contribution
                          }
                        />
                      ),
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-2">
              <div
                className={panelClass}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                  MiroFish-like
                  controlled simulation
                </div>

                <h2 className="mt-1 text-2xl font-black">
                  Scenario distribution
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="Bearish tail"
                    value={`${forecast.simulation.bearishTailPercent}%`}
                    helper="10th percentile"
                  />

                  <Metric
                    label="Median"
                    value={`${forecast.simulation.medianOutcomePercent}%`}
                    helper="Scenario evidence"
                  />

                  <Metric
                    label="Bullish tail"
                    value={`${forecast.simulation.bullishTailPercent}%`}
                    helper="90th percentile"
                  />

                  <Metric
                    label="Reversal frequency"
                    value={`${forecast.simulation.reversalFrequency}%`}
                  />

                  <Metric
                    label="Liquidity stress"
                    value={`${forecast.simulation.liquidityStressFrequency}%`}
                  />

                  <Metric
                    label="Contagion breadth"
                    value={`${forecast.simulation.contagionBreadth}%`}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="text-xs font-black text-slate-300">
                    Dominant narrative
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {
                      forecast.simulation
                        .dominantNarrative
                    }
                  </p>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-slate-500">
                        Dominant buyers:
                      </span>{" "}
                      {forecast.simulation.dominantBuyers.join(
                        ", ",
                      ) ||
                        "Unresolved"}
                    </div>

                    <div>
                      <span className="text-slate-500">
                        Dominant sellers:
                      </span>{" "}
                      {forecast.simulation.dominantSellers.join(
                        ", ",
                      ) ||
                        "Unresolved"}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={panelClass}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                  CAMEL-AI
                  orchestration
                </div>

                <h2 className="mt-1 text-2xl font-black">
                  Restricted behavioral
                  workforce
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Status"
                    value={
                      forecast.camel
                        .status
                    }
                    helper={
                      forecast.camel
                        .modelVersion
                    }
                  />

                  <Metric
                    label="Confidence"
                    value={`${forecast.camel.confidence}%`}
                    helper="Behavioral feature confidence"
                  />

                  <Metric
                    label="Reversal risk"
                    value={`${forecast.camel.reversalRisk}%`}
                  />

                  <Metric
                    label="Contagion risk"
                    value={`${forecast.camel.contagionRisk}%`}
                  />

                  <Metric
                    label="Liquidity stress"
                    value={`${forecast.camel.liquidityStress}%`}
                  />

                  <Metric
                    label="Short-covering potential"
                    value={`${forecast.camel.shortCoveringPotential}%`}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4 text-sm leading-6 text-emerald-100">
                  Shared memory: off ·
                  trading execution: off ·
                  credentials exposed: no ·
                  workforce mode:{" "}
                  {
                    forecast.camel.audit
                      .workforceMode
                  }
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {
                    forecast.camel
                      .dominantNarrative
                  }
                </p>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-3">
              {[
                [
                  "Primary positive drivers",
                  forecast.drivers
                    .positive,
                ],
                [
                  "Primary negative drivers",
                  forecast.drivers
                    .negative,
                ],
                [
                  "Contradictions",
                  forecast.drivers
                    .contradictions,
                ],
              ].map(
                ([title, items]) => (
                  <div
                    key={
                      title as string
                    }
                    className={
                      panelClass
                    }
                  >
                    <h2 className="text-lg font-black">
                      {title as string}
                    </h2>

                    <div className="mt-4 grid gap-2">
                      {(items as string[])
                        .length ? (
                        (
                          items as string[]
                        ).map(
                          (item) => (
                            <div
                              key={
                                item
                              }
                              className="rounded-xl border border-white/8 bg-white/[0.025] p-3 text-sm leading-6 text-slate-400"
                            >
                              {
                                item
                              }
                            </div>
                          ),
                        )
                      ) : (
                        <div className="text-sm text-slate-500">
                          No material
                          item was
                          identified.
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </section>

            <section
              className={panelClass}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                Governance and
                limitations
              </div>

              <h2 className="mt-1 text-2xl font-black">
                What this forecast does
                not claim
              </h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {forecast.limitations
                  .slice(0, 9)
                  .map(
                    (limitation) => (
                      <div
                        key={
                          limitation
                        }
                        className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400"
                      >
                        {
                          limitation
                        }
                      </div>
                    ),
                  )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}