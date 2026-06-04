import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type TechnicalUniverseId =
  | "sp100"
  | "nasdaq100"
  | "dow30"
  | "advisor-watchlist"
  | "custom";

export type TechnicalAdvancedFilters = {
  minCompositeScore?: number;
  minOpportunityScore?: number;
  maxRiskScore?: number;
  minConfidenceScore?: number;
  minActionabilityScore?: number;
  minAdvisorRelevanceScore?: number;

  minPrice?: number;
  maxPrice?: number;
  minMarketCap?: number;
  minDollarVolume?: number;
  minAverageVolume?: number;

  minRsi14?: number;
  maxRsi14?: number;
  requireRsiRecovery?: boolean;
  requireRsiDivergence?: boolean;
  requireConstructiveRsiStack?: boolean;

  minRangePositionPct?: number;
  maxRangePositionPct?: number;
  minDrawdownFromHighPct?: number;
  maxDrawdownFromHighPct?: number;

  minDistanceToSma200Pct?: number;
  maxDistanceToSma200Pct?: number;
  requirePriceAboveSma20?: boolean;
  requirePriceAboveSma50?: boolean;
  requireMacdImproving?: boolean;

  minRelative3mVsBenchmarkPct?: number;
  maxVolatility30Pct?: number;
  maxAtr14Pct?: number;
  maxBeta?: number;

  maxForwardPE?: number;
  maxTrailingPE?: number;
  maxPriceToBook?: number;
  minDividendYield?: number;

  onlyAdvisorRelevant?: boolean;
};

export type TechnicalScanOptions = {
  indexUniverse?: TechnicalUniverseId;
  customSymbols?: string[];
  limit?: number;
  minCompositeScore?: number;
  includeAdvisorWatchlist?: boolean;
  maxDurationMs?: number;
  advancedFilters?: TechnicalAdvancedFilters;
};

type PricePoint = {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
};

type QuoteSnapshot = {
  symbol: string;
  shortName: string | null;
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  beta: number | null;
  dividendYield: number | null;
  averageDailyVolume3Month: number | null;
  regularMarketVolume: number | null;
};

type MiniChartPoint = {
  d: string;
  c: number;
  s20: number | null;
  s50: number | null;
  r: number | null;
};

type TechnicalSnapshot = {
  symbol: string;
  companyName: string | null;
  price: number;
  previousClose: number | null;
  changePct: number | null;

  sma20: number | null;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;

  ema10: number | null;
  ema21: number | null;
  ema50: number | null;
  ema12: number | null;
  ema26: number | null;

  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdHistogramPrevious: number | null;
  macdHistogramImproving: boolean;

  rsi7: number | null;
  rsi14: number | null;
  rsi21: number | null;
  rsi14Previous5: number | null;
  rsi14Previous20: number | null;
  rsi14Min20: number | null;
  rsi14RecoveryFromOversold: boolean;
  rsiBullishDivergence: boolean;
  constructiveRsiStack: boolean;
  rsiRegime: string;

  high52: number | null;
  low52: number | null;
  rangePositionPct: number | null;
  drawdownFromHighPct: number | null;

  bollingerUpper20: number | null;
  bollingerMiddle20: number | null;
  bollingerLower20: number | null;
  bollingerPositionPct: number | null;

  distanceToSma20Pct: number | null;
  distanceToSma50Pct: number | null;
  distanceToSma150Pct: number | null;
  distanceToSma200Pct: number | null;

  volume20Avg: number | null;
  volumeRatio: number | null;
  dollarVolume: number | null;

  atr14: number | null;
  atr14Pct: number | null;
  volatility30Pct: number | null;

  return1mPct: number | null;
  return3mPct: number | null;
  return6mPct: number | null;
  return12mPct: number | null;
  benchmark3mReturnPct: number | null;
  relative3mVsBenchmarkPct: number | null;

  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  beta: number | null;
  dividendYield: number | null;
  averageDailyVolume3Month: number | null;

  dataPoints: number;
  miniChart: MiniChartPoint[];
};

type AdvisorContext = {
  universeSymbols: string[];
  exposureMap: Map<
    string,
    {
      firmHoldingValue: number;
      clientHoldingValue: number;
      watchlist: boolean;
      research: boolean;
    }
  >;
};

type ScoreResult = {
  worthy: boolean;
  baseQualified: boolean;
  compositeScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  evidence: string[];
  failedReasons: string[];
};

type AdvancedFilterResult = {
  passed: boolean;
  failedFilters: string[];
};

type TechnicalOpportunity = {
  symbol: string;
  snapshot: TechnicalSnapshot;
  compositeScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  portfolioRelevanceScore: number;
  priorityTier: string;
  signalType: string;
  evidence: string[];
  categories: string[];
  suggestedAction: string;
  advisorNotes: string;
};

type ScreenedCandidate = {
  symbol: string;
  companyName: string | null;
  price: number;
  compositeScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  portfolioRelevanceScore: number;
  priorityTier: string;
  rsi14: number | null;
  rsiRegime: string;
  rangePositionPct: number | null;
  drawdownFromHighPct: number | null;
  distanceToSma200Pct: number | null;
  relative3mVsBenchmarkPct: number | null;
  dollarVolume: number | null;
  marketCap: number | null;
  qualified: boolean;
  failedReasons: string[];
  failedFilters: string[];
};

type YahooChartResult = {
  points: PricePoint[];
  error: string | null;
};

type FetchJsonResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

const SP_100 = [
  "AAPL",
  "ABBV",
  "ABT",
  "ACN",
  "ADBE",
  "AIG",
  "AMD",
  "AMGN",
  "AMT",
  "AMZN",
  "AVGO",
  "AXP",
  "BA",
  "BAC",
  "BK",
  "BKNG",
  "BLK",
  "BMY",
  "BRK-B",
  "C",
  "CAT",
  "CHTR",
  "CL",
  "CMCSA",
  "COF",
  "COP",
  "COST",
  "CRM",
  "CSCO",
  "CVS",
  "CVX",
  "DE",
  "DHR",
  "DIS",
  "DUK",
  "EMR",
  "EXC",
  "F",
  "FDX",
  "GD",
  "GE",
  "GILD",
  "GM",
  "GOOG",
  "GOOGL",
  "GS",
  "HD",
  "HON",
  "IBM",
  "INTC",
  "INTU",
  "JNJ",
  "JPM",
  "KO",
  "LIN",
  "LLY",
  "LMT",
  "LOW",
  "MA",
  "MCD",
  "MDLZ",
  "MDT",
  "MET",
  "META",
  "MMM",
  "MO",
  "MRK",
  "MS",
  "MSFT",
  "NEE",
  "NFLX",
  "NKE",
  "NVDA",
  "ORCL",
  "PEP",
  "PFE",
  "PG",
  "PM",
  "PYPL",
  "QCOM",
  "RTX",
  "SBUX",
  "SCHW",
  "SO",
  "SPG",
  "T",
  "TGT",
  "TMO",
  "TSLA",
  "TXN",
  "UNH",
  "UNP",
  "UPS",
  "USB",
  "V",
  "VZ",
  "WBA",
  "WFC",
  "WMT",
  "XOM",
];

const NASDAQ_100 = [
  "AAPL",
  "ABNB",
  "ADBE",
  "ADI",
  "ADP",
  "ADSK",
  "AEP",
  "AMAT",
  "AMD",
  "AMGN",
  "AMZN",
  "ANSS",
  "APP",
  "ARM",
  "ASML",
  "AVGO",
  "AXON",
  "AZN",
  "BIIB",
  "BKNG",
  "BKR",
  "CCEP",
  "CDNS",
  "CDW",
  "CEG",
  "CHTR",
  "CMCSA",
  "COST",
  "CPRT",
  "CRWD",
  "CSCO",
  "CSGP",
  "CSX",
  "CTAS",
  "CTSH",
  "DASH",
  "DDOG",
  "DXCM",
  "EA",
  "EXC",
  "FANG",
  "FAST",
  "FTNT",
  "GEHC",
  "GFS",
  "GILD",
  "GOOG",
  "GOOGL",
  "HON",
  "IDXX",
  "INTC",
  "INTU",
  "ISRG",
  "KDP",
  "KHC",
  "KLAC",
  "LIN",
  "LRCX",
  "LULU",
  "MAR",
  "MCHP",
  "MDLZ",
  "MELI",
  "META",
  "MNST",
  "MRVL",
  "MSFT",
  "MSTR",
  "MU",
  "NFLX",
  "NVDA",
  "NXPI",
  "ODFL",
  "ON",
  "ORLY",
  "PANW",
  "PAYX",
  "PCAR",
  "PDD",
  "PEP",
  "PYPL",
  "QCOM",
  "REGN",
  "ROP",
  "ROST",
  "SBUX",
  "SNPS",
  "TEAM",
  "TMUS",
  "TSLA",
  "TTD",
  "TTWO",
  "TXN",
  "VRSK",
  "VRTX",
  "WBD",
  "WDAY",
  "XEL",
  "ZS",
];

const DOW_30 = [
  "AAPL",
  "AMGN",
  "AMZN",
  "AXP",
  "BA",
  "CAT",
  "CRM",
  "CSCO",
  "CVX",
  "DIS",
  "GS",
  "HD",
  "HON",
  "IBM",
  "JNJ",
  "JPM",
  "KO",
  "MCD",
  "MMM",
  "MRK",
  "MSFT",
  "NKE",
  "NVDA",
  "PG",
  "SHW",
  "TRV",
  "UNH",
  "V",
  "VZ",
  "WMT",
];

export const TECHNICAL_UNIVERSES: Array<{
  id: TechnicalUniverseId;
  label: string;
  description: string;
}> = [
  {
    id: "sp100",
    label: "S&P 100",
    description: "Large-cap U.S. quality/liquidity universe.",
  },
  {
    id: "nasdaq100",
    label: "Nasdaq 100",
    description: "Growth and innovation-heavy universe.",
  },
  {
    id: "dow30",
    label: "Dow 30",
    description: "Large, liquid blue-chip operating companies.",
  },
  {
    id: "advisor-watchlist",
    label: "Advisor Watchlist",
    description: "Symbols already tracked by the advisor.",
  },
  {
    id: "custom",
    label: "Custom Symbols",
    description: "Operator-defined comma-separated symbols.",
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round(value: number | null | undefined, places = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;

  const mean = average(values);
  if (mean === null) return null;

  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function rollingSma(values: number[], period: number) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    return average(values.slice(index + 1 - period, index + 1));
  });
}

function ema(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let current = average(values.slice(0, period));

  if (current === null) return null;

  for (const value of values.slice(period)) {
    current = (value - current) * multiplier + current;
  }

  return current;
}

function emaSeries(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);

  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let current = average(values.slice(0, period));

  if (current === null) return result;

  result[period - 1] = current;

  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = current;
  }

  return result;
}

function rsiSeries(values: number[], period = 14) {
  const result: Array<number | null> = Array(values.length).fill(null);

  if (values.length < period + 1) return result;

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  result[period] =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;

    result[index] =
      averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return result;
}

function returnPct(values: number[], days: number) {
  if (values.length < days + 1) return null;

  const current = values.at(-1);
  const past = values.at(-1 - days);

  if (!current || !past || past <= 0) return null;

  return ((current - past) / past) * 100;
}

function trueRanges(points: PricePoint[]) {
  const ranges: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];

    ranges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  return ranges;
}

function atr(points: PricePoint[], period = 14) {
  const ranges = trueRanges(points);
  if (ranges.length < period) return null;
  return average(ranges.slice(-period));
}

function calculateMacd(values: number[]) {
  if (values.length < 35) {
    return {
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      macdHistogramPrevious: null,
      macdHistogramImproving: false,
    };
  }

  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);

  const macdSeries = values.map((_, index) => {
    const fast = ema12[index];
    const slow = ema26[index];

    if (fast === null || slow === null) return null;

    return fast - slow;
  });

  const validMacd = macdSeries.filter((value): value is number => value !== null);
  const signalSeriesRaw = emaSeries(validMacd, 9);
  const latestMacd = macdSeries.at(-1) ?? null;
  const latestSignal = signalSeriesRaw.at(-1) ?? null;
  const previousSignal = signalSeriesRaw.at(-2) ?? null;
  const previousMacd = macdSeries.at(-2) ?? null;

  const macdHistogram =
    latestMacd !== null && latestSignal !== null ? latestMacd - latestSignal : null;

  const macdHistogramPrevious =
    previousMacd !== null && previousSignal !== null
      ? previousMacd - previousSignal
      : null;

  return {
    macd: latestMacd,
    macdSignal: latestSignal,
    macdHistogram,
    macdHistogramPrevious,
    macdHistogramImproving:
      macdHistogram !== null &&
      macdHistogramPrevious !== null &&
      macdHistogram > macdHistogramPrevious,
  };
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function dollars(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(2)}`;
}

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function cleanSymbol(symbol: string) {
  return symbol.trim().replace(/^\$/, "").toUpperCase();
}

function normalizeYahooSymbol(symbol: string) {
  return cleanSymbol(symbol).replace(".", "-");
}

function dedupeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map(cleanSymbol)
        .filter(Boolean)
        .filter((symbol) => /^[A-Z0-9.\-]{1,12}$/.test(symbol))
    )
  );
}

function scorePriority(score: number) {
  if (score >= 88) return "Critical";
  if (score >= 78) return "High";
  if (score >= 68) return "Medium";
  return "Low";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

function universeLabel(universe: TechnicalUniverseId) {
  const found = TECHNICAL_UNIVERSES.find((item) => item.id === universe);
  return found?.label ?? universe;
}

function benchmarkForUniverse(universe: TechnicalUniverseId) {
  if (universe === "nasdaq100") return "QQQ";
  if (universe === "dow30") return "DIA";
  return "SPY";
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerUrls(path: string) {
  return [
    `https://query1.finance.yahoo.com${path}`,
    `https://query2.finance.yahoo.com${path}`,
  ];
}

async function fetchJsonWithRetry<T>(
  paths: string[],
  timeoutMs = 6500
): Promise<FetchJsonResult<T>> {
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const url of paths) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 SliceAdvisorPlatform/1.0 InvestmentResearch",
            Accept: "application/json,text/plain,*/*",
          },
        });

        if (!response.ok) {
          lastError = `${response.status} ${response.statusText}`;
          continue;
        }

        return { ok: true, data: (await response.json()) as T };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Fetch failed";
      } finally {
        clearTimeout(timeout);
      }
    }

    await sleep(250 + attempt * 250);
  }

  return { ok: false, error: lastError || "Provider unavailable" };
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, QuoteSnapshot>> {
  const result = new Map<string, QuoteSnapshot>();

  for (const group of chunk(symbols, 25)) {
    const path = `/v7/finance/quote?symbols=${group
      .map(normalizeYahooSymbol)
      .map(encodeURIComponent)
      .join(",")}`;

    const fetched = await fetchJsonWithRetry<any>(providerUrls(path), 5500);

    if (!fetched.ok) continue;

    const quotes = fetched.data?.quoteResponse?.result;
    if (!Array.isArray(quotes)) continue;

    for (const quote of quotes) {
      const symbol = cleanSymbol(String(quote.symbol ?? ""));
      if (!symbol) continue;

      result.set(symbol, {
        symbol,
        shortName: quote.shortName ?? quote.longName ?? null,
        marketCap: Number.isFinite(Number(quote.marketCap)) ? Number(quote.marketCap) : null,
        trailingPE: Number.isFinite(Number(quote.trailingPE)) ? Number(quote.trailingPE) : null,
        forwardPE: Number.isFinite(Number(quote.forwardPE)) ? Number(quote.forwardPE) : null,
        priceToBook: Number.isFinite(Number(quote.priceToBook)) ? Number(quote.priceToBook) : null,
        beta: Number.isFinite(Number(quote.beta)) ? Number(quote.beta) : null,
        dividendYield: Number.isFinite(Number(quote.trailingAnnualDividendYield))
          ? Number(quote.trailingAnnualDividendYield) * 100
          : Number.isFinite(Number(quote.dividendYield))
            ? Number(quote.dividendYield) * 100
            : null,
        averageDailyVolume3Month: Number.isFinite(Number(quote.averageDailyVolume3Month))
          ? Number(quote.averageDailyVolume3Month)
          : null,
        regularMarketVolume: Number.isFinite(Number(quote.regularMarketVolume))
          ? Number(quote.regularMarketVolume)
          : null,
      });
    }
  }

  return result;
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResult> {
  const yahooSymbol = normalizeYahooSymbol(symbol);
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d`;
  const fetched = await fetchJsonWithRetry<any>(providerUrls(path), 7000);

  if (!fetched.ok) {
    return { points: [], error: fetched.error };
  }

  const result = fetched.data?.chart?.result?.[0];

  if (!result) {
    return { points: [], error: "No chart result" };
  }

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const volumes = quote.volume ?? [];

  const points: PricePoint[] = timestamps
    .map((timestamp: number, index: number): PricePoint => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: Number(closes[index] ?? 0),
      high: Number(highs[index] ?? closes[index] ?? 0),
      low: Number(lows[index] ?? closes[index] ?? 0),
      volume: Number(volumes[index] ?? 0),
    }))
    .filter((point: PricePoint) => point.close > 0);

  return {
    points,
    error: points.length ? null : "No valid chart points",
  };
}

function buildMiniChart(
  points: PricePoint[],
  sma20Series: Array<number | null>,
  sma50Series: Array<number | null>,
  rsi14Series: Array<number | null>
): MiniChartPoint[] {
  const start = Math.max(0, points.length - 72);

  return points.slice(start).map((point, localIndex) => {
    const index = start + localIndex;

    return {
      d: point.date.slice(5),
      c: round(point.close, 2) ?? point.close,
      s20: round(sma20Series[index], 2),
      s50: round(sma50Series[index], 2),
      r: round(rsi14Series[index], 1),
    };
  });
}

function rsiRegime(input: {
  rsi7: number | null;
  rsi14: number | null;
  rsi21: number | null;
  rsi14Previous5: number | null;
  rsi14Min20: number | null;
}) {
  if (input.rsi14 === null) return "Insufficient RSI data";
  if (input.rsi14 >= 70) return "Extended / overbought";
  if (input.rsi14 <= 25) return "Deep oversold";

  if (
    input.rsi14Min20 !== null &&
    input.rsi14Min20 <= 32 &&
    input.rsi14 >= input.rsi14Min20 + 6 &&
    input.rsi14 >= 34 &&
    input.rsi14 <= 58
  ) {
    return "Oversold recovery";
  }

  if (
    input.rsi7 !== null &&
    input.rsi21 !== null &&
    input.rsi7 > input.rsi14 &&
    input.rsi14 > input.rsi21 &&
    input.rsi14 >= 38 &&
    input.rsi14 <= 60
  ) {
    return "Constructive RSI stack";
  }

  if (
    input.rsi14Previous5 !== null &&
    input.rsi14 > input.rsi14Previous5 &&
    input.rsi14 >= 35 &&
    input.rsi14 <= 58
  ) {
    return "RSI improving";
  }

  if (input.rsi14 >= 45 && input.rsi14 <= 62) return "Neutral constructive";
  return "Neutral / watch";
}

function buildSnapshot(
  symbol: string,
  points: PricePoint[],
  quote: QuoteSnapshot | null,
  benchmark3mReturnPct: number | null
): TechnicalSnapshot | null {
  const cleanPoints = points.filter(
    (point) =>
      Number.isFinite(point.close) &&
      point.close > 0 &&
      Number.isFinite(point.volume) &&
      point.volume >= 0
  );

  if (cleanPoints.length < 90) return null;

  const closes = cleanPoints.map((point) => point.close);
  const highs = cleanPoints.map((point) => point.high || point.close);
  const lows = cleanPoints.map((point) => point.low || point.close);
  const volumes = cleanPoints.map((point) => point.volume);
  const price = closes.at(-1);

  if (!price) return null;

  const previousClose = closes.length > 1 ? closes.at(-2) ?? null : null;
  const high52 = Math.max(...highs.slice(-252));
  const low52 = Math.min(...lows.slice(-252));

  const sma20Series = rollingSma(closes, 20);
  const sma50Series = rollingSma(closes, 50);
  const sma150Series = rollingSma(closes, 150);
  const sma200Series = rollingSma(closes, 200);

  const sma20 = sma20Series.at(-1) ?? null;
  const sma50 = sma50Series.at(-1) ?? null;
  const sma150 = sma150Series.at(-1) ?? null;
  const sma200 = sma200Series.at(-1) ?? null;

  const rsi7Series = rsiSeries(closes, 7);
  const rsi14Series = rsiSeries(closes, 14);
  const rsi21Series = rsiSeries(closes, 21);

  const rsi7 = rsi7Series.at(-1) ?? null;
  const rsi14 = rsi14Series.at(-1) ?? null;
  const rsi21 = rsi21Series.at(-1) ?? null;
  const rsi14Previous5 = rsi14Series.at(-6) ?? null;
  const rsi14Previous20 = rsi14Series.at(-21) ?? null;
  const rsi14Recent = rsi14Series
    .slice(-20)
    .filter((value): value is number => value !== null);
  const rsi14Min20 = rsi14Recent.length ? Math.min(...rsi14Recent) : null;

  const constructiveRsiStack =
    rsi7 !== null &&
    rsi14 !== null &&
    rsi21 !== null &&
    rsi7 > rsi14 &&
    rsi14 > rsi21 &&
    rsi14 >= 36 &&
    rsi14 <= 62;

  const macd = calculateMacd(closes);
  const volume20Avg = average(volumes.slice(-20));
  const atr14 = atr(cleanPoints, 14);
  const returns = closes
    .slice(-31)
    .map((value, index, array) =>
      index === 0 ? 0 : ((value - array[index - 1]) / array[index - 1]) * 100
    )
    .slice(1);
  const vol = standardDeviation(returns);
  const volatility30Pct = vol === null ? null : vol * Math.sqrt(252);
  const rangePositionPct =
    high52 > low52 ? ((price - low52) / (high52 - low52)) * 100 : null;
  const drawdownFromHighPct = high52 > 0 ? ((price - high52) / high52) * 100 : null;
  const return3m = returnPct(closes, 63);

  const sma20Std = standardDeviation(closes.slice(-20));
  const bollingerMiddle20 = sma20;
  const bollingerUpper20 =
    sma20 !== null && sma20Std !== null ? sma20 + sma20Std * 2 : null;
  const bollingerLower20 =
    sma20 !== null && sma20Std !== null ? sma20 - sma20Std * 2 : null;
  const bollingerPositionPct =
    bollingerUpper20 !== null &&
    bollingerLower20 !== null &&
    bollingerUpper20 > bollingerLower20
      ? ((price - bollingerLower20) / (bollingerUpper20 - bollingerLower20)) * 100
      : null;

  const price20DaysAgo = closes.at(-21);
  const bullishDivergence =
    price20DaysAgo !== undefined &&
    rsi14 !== null &&
    rsi14Previous20 !== null &&
    price < price20DaysAgo &&
    rsi14 > rsi14Previous20 + 3;

  const rsiRecovery =
    rsi14 !== null &&
    rsi14Min20 !== null &&
    rsi14Min20 <= 32 &&
    rsi14 >= rsi14Min20 + 6 &&
    rsi14 >= 34 &&
    rsi14 <= 58;

  return {
    symbol,
    companyName: quote?.shortName ?? null,
    price,
    previousClose,
    changePct:
      previousClose && previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : null,
    sma20,
    sma50,
    sma150,
    sma200,
    ema10: ema(closes, 10),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    macd: macd.macd,
    macdSignal: macd.macdSignal,
    macdHistogram: macd.macdHistogram,
    macdHistogramPrevious: macd.macdHistogramPrevious,
    macdHistogramImproving: macd.macdHistogramImproving,
    rsi7,
    rsi14,
    rsi21,
    rsi14Previous5,
    rsi14Previous20,
    rsi14Min20,
    rsi14RecoveryFromOversold: rsiRecovery,
    rsiBullishDivergence: bullishDivergence,
    constructiveRsiStack,
    rsiRegime: rsiRegime({ rsi7, rsi14, rsi21, rsi14Previous5, rsi14Min20 }),
    high52,
    low52,
    rangePositionPct,
    drawdownFromHighPct,
    bollingerUpper20,
    bollingerMiddle20,
    bollingerLower20,
    bollingerPositionPct,
    distanceToSma20Pct: sma20 ? ((price - sma20) / sma20) * 100 : null,
    distanceToSma50Pct: sma50 ? ((price - sma50) / sma50) * 100 : null,
    distanceToSma150Pct: sma150 ? ((price - sma150) / sma150) * 100 : null,
    distanceToSma200Pct: sma200 ? ((price - sma200) / sma200) * 100 : null,
    volume20Avg,
    volumeRatio: volume20Avg && volume20Avg > 0 ? volumes.at(-1)! / volume20Avg : null,
    dollarVolume: price * (volumes.at(-1) ?? 0),
    atr14,
    atr14Pct: atr14 ? (atr14 / price) * 100 : null,
    volatility30Pct,
    return1mPct: returnPct(closes, 21),
    return3mPct: return3m,
    return6mPct: returnPct(closes, 126),
    return12mPct: returnPct(closes, 252),
    benchmark3mReturnPct,
    relative3mVsBenchmarkPct:
      return3m !== null && benchmark3mReturnPct !== null
        ? return3m - benchmark3mReturnPct
        : null,
    marketCap: quote?.marketCap ?? null,
    trailingPE: quote?.trailingPE ?? null,
    forwardPE: quote?.forwardPE ?? null,
    priceToBook: quote?.priceToBook ?? null,
    beta: quote?.beta ?? null,
    dividendYield: quote?.dividendYield ?? null,
    averageDailyVolume3Month:
      quote?.averageDailyVolume3Month ?? quote?.regularMarketVolume ?? null,
    dataPoints: cleanPoints.length,
    miniChart: buildMiniChart(cleanPoints, sma20Series, sma50Series, rsi14Series),
  };
}

async function loadAdvisorContext(userId: string): Promise<AdvisorContext> {
  const [watchAssets, namedWatchlistItems, holdings, clients, research] =
    await Promise.all([
      prisma.watchAsset.findMany({ where: { userId } }),
      prisma.namedWatchlistItem.findMany({
        where: { userId, status: { not: "Archived" } },
      }),
      prisma.investorHolding.findMany({ where: { userId } }),
      prisma.clientProfile.findMany({
        where: { userId },
        include: { holdings: true },
      }),
      prisma.researchNote.findMany({ where: { userId } }),
    ]);

  const exposureMap: AdvisorContext["exposureMap"] = new Map();

  function ensure(symbol: string) {
    const clean = cleanSymbol(symbol);
    if (!clean) return null;

    if (!exposureMap.has(clean)) {
      exposureMap.set(clean, {
        firmHoldingValue: 0,
        clientHoldingValue: 0,
        watchlist: false,
        research: false,
      });
    }

    return exposureMap.get(clean)!;
  }

  for (const item of watchAssets) {
    const exposure = ensure(item.ticker);
    if (exposure) exposure.watchlist = true;
  }

  for (const item of namedWatchlistItems) {
    const exposure = ensure(item.symbol);
    if (exposure) exposure.watchlist = true;
  }

  for (const item of holdings) {
    const exposure = ensure(item.symbol);
    if (exposure) exposure.firmHoldingValue += item.valueNumber;
  }

  for (const client of clients) {
    for (const holding of client.holdings) {
      const exposure = ensure(holding.symbol);
      if (!exposure) continue;

      const value = Number(String(holding.value ?? "").replace(/[$,%\s,]/g, ""));
      exposure.clientHoldingValue += Number.isFinite(value) ? value : 0;
    }
  }

  for (const item of research) {
    const exposure = ensure(item.ticker ?? "");
    if (exposure) exposure.research = true;
  }

  return {
    universeSymbols: dedupeSymbols([
      ...watchAssets.map((item) => item.ticker),
      ...namedWatchlistItems.map((item) => item.symbol),
      ...holdings.map((item) => item.symbol),
      ...clients.flatMap((client) => client.holdings.map((holding) => holding.symbol)),
      ...research.map((item) => item.ticker ?? ""),
    ]),
    exposureMap,
  };
}

function advisorRelevanceScore(symbol: string, context: AdvisorContext) {
  const exposure = context.exposureMap.get(cleanSymbol(symbol));
  if (!exposure) return 0;

  let score = 0;

  if (exposure.firmHoldingValue > 0) score += 30;
  if (exposure.clientHoldingValue > 0) score += 32;
  if (exposure.watchlist) score += 22;
  if (exposure.research) score += 16;

  const total = exposure.firmHoldingValue + exposure.clientHoldingValue;

  if (total >= 1_000_000) score += 18;
  else if (total >= 250_000) score += 12;
  else if (total >= 50_000) score += 7;

  return clamp(score);
}

function scoreTechnicalOpportunity(
  snapshot: TechnicalSnapshot,
  advisorScore: number
): ScoreResult {
  let rsiScore = 0;
  let trendScore = 0;
  let resetScore = 0;
  let momentumScore = 0;
  let qualityScore = 0;
  let liquidityScore = 0;
  let relativeScore = 0;
  let risk = 18;
  let confidence = 35;
  let actionability = 42;

  const evidence: string[] = [];
  const positives: string[] = [];
  const risks: string[] = [];
  const failedReasons: string[] = [];

  evidence.push(`Data observations: ${snapshot.dataPoints}.`);
  evidence.push(`Current price: ${dollars(snapshot.price)}.`);
  evidence.push(`RSI regime: ${snapshot.rsiRegime}.`);

  if (snapshot.rsi14 !== null) {
    evidence.push(`RSI 14: ${snapshot.rsi14.toFixed(1)}.`);

    if (snapshot.rsi14 >= 32 && snapshot.rsi14 <= 48) {
      rsiScore += 26;
      confidence += 8;
      positives.push("RSI 14 is in the preferred reset zone.");
    } else if (snapshot.rsi14 > 48 && snapshot.rsi14 <= 58) {
      rsiScore += 17;
      positives.push("RSI 14 is constructive without being extended.");
    } else if (snapshot.rsi14 < 25) {
      rsiScore += 5;
      risk += 17;
      risks.push("RSI 14 is deeply oversold; falling-knife risk is elevated.");
    } else if (snapshot.rsi14 >= 70) {
      rsiScore -= 12;
      risk += 18;
      risks.push("RSI 14 is extended.");
    }
  }

  if (snapshot.constructiveRsiStack) {
    rsiScore += 18;
    actionability += 8;
    positives.push("RSI 7/14/21 stack indicates improving momentum.");
  }

  if (snapshot.rsi7 !== null && snapshot.rsi14 !== null && snapshot.rsi21 !== null) {
    evidence.push(
      `RSI stack: 7=${snapshot.rsi7.toFixed(1)}, 14=${snapshot.rsi14.toFixed(
        1
      )}, 21=${snapshot.rsi21.toFixed(1)}.`
    );
  }

  if (snapshot.rsi14RecoveryFromOversold) {
    rsiScore += 22;
    confidence += 8;
    actionability += 8;
    positives.push("RSI recovered from a recent oversold reading.");
  }

  if (snapshot.rsiBullishDivergence) {
    rsiScore += 18;
    confidence += 6;
    positives.push("Potential bullish RSI divergence detected.");
  }

  if (snapshot.rangePositionPct !== null) {
    evidence.push(`52-week range position: ${snapshot.rangePositionPct.toFixed(1)}%.`);

    if (snapshot.rangePositionPct >= 12 && snapshot.rangePositionPct <= 58) {
      resetScore += 24;
      positives.push("Price is in the lower-to-middle portion of the 52-week range.");
    } else if (snapshot.rangePositionPct < 12) {
      resetScore += 9;
      risk += 14;
      risks.push("Price is very near the 52-week low.");
    } else if (snapshot.rangePositionPct > 84) {
      resetScore -= 8;
      risk += 7;
      risks.push("Price is close to the 52-week high.");
    }
  }

  if (snapshot.drawdownFromHighPct !== null) {
    evidence.push(`Drawdown from 52-week high: ${snapshot.drawdownFromHighPct.toFixed(1)}%.`);

    const drawdown = Math.abs(snapshot.drawdownFromHighPct);

    if (drawdown >= 8 && drawdown <= 42) {
      resetScore += 22;
      positives.push("Drawdown offers a meaningful valuation-reset setup.");
    } else if (drawdown > 50) {
      resetScore += 5;
      risk += 18;
      risks.push("Drawdown is severe and requires extra diligence.");
    }
  }

  if (snapshot.distanceToSma200Pct !== null) {
    evidence.push(`Distance to 200-day SMA: ${snapshot.distanceToSma200Pct.toFixed(1)}%.`);

    if (snapshot.distanceToSma200Pct >= -16 && snapshot.distanceToSma200Pct <= 12) {
      trendScore += 20;
      confidence += 8;
      positives.push("Price is near the 200-day moving average.");
    } else if (snapshot.distanceToSma200Pct < -28) {
      risk += 16;
      risks.push("Price remains materially below the 200-day moving average.");
    } else if (snapshot.distanceToSma200Pct > 28) {
      risk += 8;
      risks.push("Price is far above the 200-day moving average.");
    }
  }

  if (snapshot.distanceToSma50Pct !== null) {
    evidence.push(`Distance to 50-day SMA: ${snapshot.distanceToSma50Pct.toFixed(1)}%.`);

    if (snapshot.distanceToSma50Pct >= -8 && snapshot.distanceToSma50Pct <= 8) {
      trendScore += 12;
      positives.push("Price is close to the 50-day moving average.");
    }
  }

  if (snapshot.price && snapshot.sma20 && snapshot.sma50 && snapshot.sma200) {
    if (
      snapshot.price > snapshot.sma20 &&
      snapshot.sma20 >= snapshot.sma50 * 0.95 &&
      snapshot.sma50 >= snapshot.sma200 * 0.86
    ) {
      trendScore += 18;
      actionability += 10;
      positives.push("Trend stack shows stabilization rather than a pure falling setup.");
    }

    if (snapshot.price < snapshot.sma20 && snapshot.price < snapshot.sma50) {
      risk += 8;
      risks.push("Price remains below short and intermediate moving averages.");
    }
  }

  if (snapshot.macd !== null && snapshot.macdSignal !== null) {
    evidence.push(`MACD: ${snapshot.macd.toFixed(2)} vs signal ${snapshot.macdSignal.toFixed(2)}.`);

    if (snapshot.macd > snapshot.macdSignal) {
      momentumScore += 18;
      actionability += 10;
      positives.push("MACD is above signal line.");
    } else if (snapshot.macdHistogramImproving) {
      momentumScore += 11;
      positives.push("MACD histogram is improving.");
    } else {
      risk += 5;
    }
  }

  if (snapshot.bollingerPositionPct !== null) {
    evidence.push(`Bollinger position: ${snapshot.bollingerPositionPct.toFixed(1)}%.`);

    if (snapshot.bollingerPositionPct >= 18 && snapshot.bollingerPositionPct <= 68) {
      momentumScore += 10;
      positives.push("Bollinger position supports a reset/recovery setup.");
    } else if (snapshot.bollingerPositionPct < 5) {
      risk += 9;
      risks.push("Price is pinned near the lower Bollinger band.");
    } else if (snapshot.bollingerPositionPct > 95) {
      risk += 9;
      risks.push("Price is extended near the upper Bollinger band.");
    }
  }

  if (snapshot.volumeRatio !== null) {
    evidence.push(`Volume vs 20-day average: ${snapshot.volumeRatio.toFixed(2)}x.`);

    if (snapshot.volumeRatio >= 0.85 && snapshot.volumeRatio <= 3.2) {
      momentumScore += 8;
      confidence += 5;
      positives.push("Volume is adequate for confirmation.");
    } else if (snapshot.volumeRatio > 4) {
      risk += 8;
      risks.push("Volume spike may reflect event risk.");
    }
  }

  if (snapshot.relative3mVsBenchmarkPct !== null) {
    evidence.push(
      `3-month relative performance vs benchmark: ${snapshot.relative3mVsBenchmarkPct.toFixed(
        1
      )}%.`
    );

    if (snapshot.relative3mVsBenchmarkPct >= -8 && snapshot.relative3mVsBenchmarkPct <= 10) {
      relativeScore += 10;
      positives.push("Relative performance is not materially broken.");
    } else if (snapshot.relative3mVsBenchmarkPct > 10) {
      relativeScore += 16;
      momentumScore += 6;
      positives.push("Relative performance is outperforming the benchmark.");
    } else if (snapshot.relative3mVsBenchmarkPct < -22) {
      risk += 12;
      risks.push("Relative performance is materially weak.");
    }
  }

  if (snapshot.marketCap !== null) {
    evidence.push(`Market cap: ${dollars(snapshot.marketCap)}.`);

    if (snapshot.marketCap >= 10_000_000_000) {
      qualityScore += 14;
      confidence += 8;
    } else if (snapshot.marketCap >= 2_000_000_000) {
      qualityScore += 8;
      confidence += 4;
    } else {
      risk += 12;
      risks.push("Market cap is below preferred institutional liquidity threshold.");
    }
  }

  if (snapshot.forwardPE !== null && snapshot.forwardPE > 0) {
    evidence.push(`Forward P/E: ${snapshot.forwardPE.toFixed(1)}.`);

    if (snapshot.forwardPE <= 18) qualityScore += 14;
    else if (snapshot.forwardPE <= 28) qualityScore += 9;
    else if (snapshot.forwardPE <= 45) qualityScore += 3;
    else risk += 9;
  } else if (snapshot.trailingPE !== null && snapshot.trailingPE > 0) {
    evidence.push(`Trailing P/E: ${snapshot.trailingPE.toFixed(1)}.`);

    if (snapshot.trailingPE <= 20) qualityScore += 10;
    else if (snapshot.trailingPE <= 32) qualityScore += 5;
    else risk += 7;
  }

  if (snapshot.priceToBook !== null && snapshot.priceToBook > 0) {
    evidence.push(`Price/book: ${snapshot.priceToBook.toFixed(1)}.`);

    if (snapshot.priceToBook <= 4) qualityScore += 8;
    else if (snapshot.priceToBook > 12) risk += 5;
  }

  if (snapshot.beta !== null) {
    evidence.push(`Beta: ${snapshot.beta.toFixed(2)}.`);

    if (snapshot.beta <= 1.35) confidence += 5;
    if (snapshot.beta > 2) {
      risk += 12;
      risks.push("Beta is elevated.");
    }
  }

  if (snapshot.dividendYield !== null && snapshot.dividendYield > 0) {
    evidence.push(`Dividend yield: ${snapshot.dividendYield.toFixed(2)}%.`);
    qualityScore += Math.min(8, snapshot.dividendYield * 1.5);
  }

  if (snapshot.dollarVolume !== null) {
    evidence.push(`Latest dollar volume: ${dollars(snapshot.dollarVolume)}.`);

    if (snapshot.dollarVolume >= 50_000_000) {
      liquidityScore += 18;
      confidence += 8;
    } else if (snapshot.dollarVolume >= 10_000_000) {
      liquidityScore += 12;
      confidence += 5;
    } else if (snapshot.dollarVolume < 3_000_000) {
      risk += 14;
      risks.push("Dollar volume is below preferred liquidity threshold.");
    }
  }

  if (snapshot.atr14Pct !== null) {
    evidence.push(`ATR 14 as % of price: ${snapshot.atr14Pct.toFixed(1)}%.`);

    if (snapshot.atr14Pct <= 3.2) confidence += 7;
    else if (snapshot.atr14Pct > 7) {
      risk += 12;
      risks.push("ATR percentage is elevated.");
    }
  }

  if (snapshot.volatility30Pct !== null) {
    evidence.push(`Annualized 30-day volatility estimate: ${snapshot.volatility30Pct.toFixed(1)}%.`);

    if (snapshot.volatility30Pct <= 35) {
      risk -= 5;
      confidence += 5;
    } else if (snapshot.volatility30Pct > 65) {
      risk += 18;
      risks.push("Realized volatility is elevated.");
    }
  }

  if (snapshot.price < 5) {
    risk += 25;
    risks.push("Share price is below $5.");
  }

  if ((snapshot.averageDailyVolume3Month ?? 0) < 250_000) {
    risk += 10;
    risks.push("Average daily volume is below preferred threshold.");
  }

  const valuationResetPresent =
    (snapshot.drawdownFromHighPct !== null &&
      Math.abs(snapshot.drawdownFromHighPct) >= 8 &&
      Math.abs(snapshot.drawdownFromHighPct) <= 42) ||
    (snapshot.rangePositionPct !== null &&
      snapshot.rangePositionPct >= 12 &&
      snapshot.rangePositionPct <= 58) ||
    (snapshot.distanceToSma200Pct !== null &&
      snapshot.distanceToSma200Pct >= -16 &&
      snapshot.distanceToSma200Pct <= 12);

  const stabilizationPresent =
    snapshot.rsi14RecoveryFromOversold ||
    snapshot.rsiBullishDivergence ||
    snapshot.macdHistogramImproving ||
    Boolean(snapshot.sma20 && snapshot.price > snapshot.sma20) ||
    Boolean(snapshot.rsi14 !== null && snapshot.rsi14 >= 40 && snapshot.rsi14 <= 58);

  if (!valuationResetPresent) {
    failedReasons.push("No valuation/reset condition detected.");
  }

  if (!stabilizationPresent) {
    failedReasons.push("No stabilization condition detected.");
  }

  const opportunityScore = clamp(
    rsiScore * 0.24 +
      resetScore * 0.24 +
      trendScore * 0.18 +
      momentumScore * 0.16 +
      qualityScore * 0.1 +
      relativeScore * 0.08
  );

  const actionabilityScore = clamp(
    actionability + trendScore * 0.12 + momentumScore * 0.1 + liquidityScore * 0.08
  );

  const confidenceScore = clamp(confidence + liquidityScore * 0.22 + qualityScore * 0.18);
  const riskScore = clamp(risk);

  const composite = clamp(
    opportunityScore * 0.34 +
      confidenceScore * 0.22 +
      actionabilityScore * 0.18 +
      advisorScore * 0.1 +
      liquidityScore * 0.08 +
      (100 - riskScore) * 0.08
  );

  if (confidenceScore < 50) failedReasons.push("Confidence score below threshold.");
  if (actionabilityScore < 46) failedReasons.push("Actionability score below threshold.");
  if (riskScore > 78) failedReasons.push("Risk score above threshold.");
  if (snapshot.price < 5) failedReasons.push("Price below $5.");
  if ((snapshot.dollarVolume ?? 0) < 3_000_000) failedReasons.push("Dollar volume below threshold.");

  const baseQualified =
    composite >= 60 &&
    confidenceScore >= 45 &&
    actionabilityScore >= 42 &&
    riskScore <= 82;

  const worthy =
    composite >= 70 &&
    confidenceScore >= 50 &&
    actionabilityScore >= 46 &&
    riskScore <= 78 &&
    snapshot.price >= 5 &&
    (snapshot.dollarVolume ?? 0) >= 3_000_000 &&
    valuationResetPresent &&
    stabilizationPresent;

  return {
    worthy,
    baseQualified,
    compositeScore: composite,
    opportunityScore,
    riskScore,
    confidenceScore,
    actionabilityScore,
    evidence: [...positives, ...risks, ...evidence],
    failedReasons,
  };
}

function numberPasses(
  label: string,
  value: number | null,
  failed: string[],
  min?: number,
  max?: number
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    if (min !== undefined || max !== undefined) failed.push(`${label} unavailable.`);
    return;
  }

  if (min !== undefined && value < min) failed.push(`${label} below ${min}.`);
  if (max !== undefined && value > max) failed.push(`${label} above ${max}.`);
}

function applyAdvancedFilters(input: {
  snapshot: TechnicalSnapshot;
  advisorScore: number;
  scored: ScoreResult;
  filters?: TechnicalAdvancedFilters;
}): AdvancedFilterResult {
  const filters = input.filters ?? {};
  const failedFilters: string[] = [];
  const s = input.snapshot;

  numberPasses("Composite score", input.scored.compositeScore, failedFilters, filters.minCompositeScore);
  numberPasses("Opportunity score", input.scored.opportunityScore, failedFilters, filters.minOpportunityScore);
  numberPasses("Risk score", input.scored.riskScore, failedFilters, undefined, filters.maxRiskScore);
  numberPasses("Confidence score", input.scored.confidenceScore, failedFilters, filters.minConfidenceScore);
  numberPasses("Actionability score", input.scored.actionabilityScore, failedFilters, filters.minActionabilityScore);
  numberPasses("Advisor relevance score", input.advisorScore, failedFilters, filters.minAdvisorRelevanceScore);

  numberPasses("Price", s.price, failedFilters, filters.minPrice, filters.maxPrice);
  numberPasses("Market cap", s.marketCap, failedFilters, filters.minMarketCap);
  numberPasses("Dollar volume", s.dollarVolume, failedFilters, filters.minDollarVolume);
  numberPasses("Average volume", s.averageDailyVolume3Month, failedFilters, filters.minAverageVolume);

  numberPasses("RSI 14", s.rsi14, failedFilters, filters.minRsi14, filters.maxRsi14);

  if (filters.requireRsiRecovery && !s.rsi14RecoveryFromOversold) {
    failedFilters.push("RSI recovery required.");
  }

  if (filters.requireRsiDivergence && !s.rsiBullishDivergence) {
    failedFilters.push("RSI bullish divergence required.");
  }

  if (filters.requireConstructiveRsiStack && !s.constructiveRsiStack) {
    failedFilters.push("Constructive RSI stack required.");
  }

  numberPasses(
    "52-week range position",
    s.rangePositionPct,
    failedFilters,
    filters.minRangePositionPct,
    filters.maxRangePositionPct
  );

  const absoluteDrawdown =
    s.drawdownFromHighPct === null ? null : Math.abs(s.drawdownFromHighPct);

  numberPasses(
    "Drawdown from high",
    absoluteDrawdown,
    failedFilters,
    filters.minDrawdownFromHighPct,
    filters.maxDrawdownFromHighPct
  );

  numberPasses(
    "Distance to SMA 200",
    s.distanceToSma200Pct,
    failedFilters,
    filters.minDistanceToSma200Pct,
    filters.maxDistanceToSma200Pct
  );

  if (filters.requirePriceAboveSma20 && !(s.sma20 !== null && s.price > s.sma20)) {
    failedFilters.push("Price above SMA20 required.");
  }

  if (filters.requirePriceAboveSma50 && !(s.sma50 !== null && s.price > s.sma50)) {
    failedFilters.push("Price above SMA50 required.");
  }

  if (filters.requireMacdImproving && !s.macdHistogramImproving) {
    failedFilters.push("MACD histogram improvement required.");
  }

  numberPasses(
    "Relative 3M vs benchmark",
    s.relative3mVsBenchmarkPct,
    failedFilters,
    filters.minRelative3mVsBenchmarkPct
  );
  numberPasses("Volatility 30D", s.volatility30Pct, failedFilters, undefined, filters.maxVolatility30Pct);
  numberPasses("ATR 14%", s.atr14Pct, failedFilters, undefined, filters.maxAtr14Pct);
  numberPasses("Beta", s.beta, failedFilters, undefined, filters.maxBeta);
  numberPasses("Forward P/E", s.forwardPE, failedFilters, undefined, filters.maxForwardPE);
  numberPasses("Trailing P/E", s.trailingPE, failedFilters, undefined, filters.maxTrailingPE);
  numberPasses("Price/book", s.priceToBook, failedFilters, undefined, filters.maxPriceToBook);
  numberPasses("Dividend yield", s.dividendYield, failedFilters, filters.minDividendYield);

  if (filters.onlyAdvisorRelevant && input.advisorScore <= 0) {
    failedFilters.push("Advisor relevance required.");
  }

  return {
    passed: failedFilters.length === 0,
    failedFilters,
  };
}

function buildAdvisorNotes(input: TechnicalOpportunity) {
  const s = input.snapshot;

  return [
    `Technical opportunity review for ${input.symbol}${s.companyName ? ` (${s.companyName})` : ""}.`,
    "",
    `Composite score: ${input.compositeScore}/100.`,
    `Opportunity score: ${input.opportunityScore}/100.`,
    `Risk score: ${input.riskScore}/100.`,
    `Confidence score: ${input.confidenceScore}/100.`,
    `Advisor relevance score: ${input.portfolioRelevanceScore}/100.`,
    "",
    `Current price: ${dollars(s.price)}.`,
    `RSI 7/14/21: ${s.rsi7 === null ? "n/a" : s.rsi7.toFixed(1)} / ${
      s.rsi14 === null ? "n/a" : s.rsi14.toFixed(1)
    } / ${s.rsi21 === null ? "n/a" : s.rsi21.toFixed(1)}.`,
    `RSI regime: ${s.rsiRegime}.`,
    `52-week range: ${dollars(s.low52)} to ${dollars(s.high52)}.`,
    `52-week range position: ${pct(s.rangePositionPct)}.`,
    `Drawdown from 52-week high: ${pct(s.drawdownFromHighPct)}.`,
    `Distance to SMA 200: ${pct(s.distanceToSma200Pct)}.`,
    `MACD histogram improving: ${s.macdHistogramImproving ? "yes" : "no"}.`,
    `Bollinger position: ${pct(s.bollingerPositionPct)}.`,
    `3-month relative performance vs benchmark: ${pct(s.relative3mVsBenchmarkPct)}.`,
    `Dollar volume: ${dollars(s.dollarVolume)}.`,
    "",
    "Advisor use: review the technical setup, compare against valuation/fundamentals, check client suitability, confirm liquidity, review tax impact, and verify there is no adverse headline, regulatory, balance-sheet, or earnings risk before taking action.",
  ].join("\n");
}

function buildSuggestedAction(opportunity: TechnicalOpportunity) {
  const s = opportunity.snapshot;

  return [
    `Review ${opportunity.symbol} as a technical valuation-reset candidate.`,
    `The setup cleared Slice technical criteria with composite ${opportunity.compositeScore}/100, RSI regime "${s.rsiRegime}", RSI 14 ${
      s.rsi14 === null ? "n/a" : s.rsi14.toFixed(1)
    }, 52-week position ${pct(s.rangePositionPct)}, and distance to 200-day SMA ${pct(s.distanceToSma200Pct)}.`,
    "Confirm fundamentals, earnings timing, balance-sheet risk, sector exposure, client suitability, and headline context before treating this as actionable.",
  ].join(" ");
}

function createTechnicalOpportunity(input: {
  symbol: string;
  snapshot: TechnicalSnapshot;
  advisorScore: number;
  scored: ScoreResult;
}) {
  const priorityTier = scorePriority(input.scored.compositeScore);

  const opportunity: TechnicalOpportunity = {
    symbol: input.symbol,
    snapshot: input.snapshot,
    compositeScore: input.scored.compositeScore,
    opportunityScore: input.scored.opportunityScore,
    riskScore: input.scored.riskScore,
    confidenceScore: input.scored.confidenceScore,
    actionabilityScore: input.scored.actionabilityScore,
    portfolioRelevanceScore: input.advisorScore,
    priorityTier,
    signalType: "Technical Opportunity",
    evidence: input.scored.evidence,
    categories: [
      "Technical Opportunity",
      "Index Scan",
      "Technical Valuation Reset",
      "Advanced Advisor Filters",
      "Enhanced RSI",
      `RSI: ${input.snapshot.rsiRegime}`,
      `Priority: ${priorityTier}`,
    ],
    suggestedAction: "",
    advisorNotes: "",
  };

  opportunity.suggestedAction = buildSuggestedAction(opportunity);
  opportunity.advisorNotes = buildAdvisorNotes(opportunity);

  return opportunity;
}

function screenedCandidate(input: {
  symbol: string;
  snapshot: TechnicalSnapshot;
  advisorScore: number;
  scored: ScoreResult;
  filters: AdvancedFilterResult;
  qualified: boolean;
}): ScreenedCandidate {
  return {
    symbol: input.symbol,
    companyName: input.snapshot.companyName,
    price: input.snapshot.price,
    compositeScore: input.scored.compositeScore,
    opportunityScore: input.scored.opportunityScore,
    riskScore: input.scored.riskScore,
    confidenceScore: input.scored.confidenceScore,
    actionabilityScore: input.scored.actionabilityScore,
    portfolioRelevanceScore: input.advisorScore,
    priorityTier: scorePriority(input.scored.compositeScore),
    rsi14: input.snapshot.rsi14,
    rsiRegime: input.snapshot.rsiRegime,
    rangePositionPct: input.snapshot.rangePositionPct,
    drawdownFromHighPct: input.snapshot.drawdownFromHighPct,
    distanceToSma200Pct: input.snapshot.distanceToSma200Pct,
    relative3mVsBenchmarkPct: input.snapshot.relative3mVsBenchmarkPct,
    dollarVolume: input.snapshot.dollarVolume,
    marketCap: input.snapshot.marketCap,
    qualified: input.qualified,
    failedReasons: input.scored.failedReasons,
    failedFilters: input.filters.failedFilters,
  };
}

function universeSymbols(universe: TechnicalUniverseId, customSymbols: string[]) {
  if (universe === "nasdaq100") return NASDAQ_100;
  if (universe === "dow30") return DOW_30;
  if (universe === "custom") return customSymbols;
  if (universe === "advisor-watchlist") return [];
  return SP_100;
}

function rotateSymbols(symbols: string[], limit: number, userId: string, universe: TechnicalUniverseId) {
  if (symbols.length <= limit) return symbols;

  const rotationWindow = Math.floor(Date.now() / (5 * 60 * 1000));
  const seed = hash(`${userId}:${universe}:${rotationWindow}`);
  const seedNumber = parseInt(seed.slice(0, 8), 16);
  const start = seedNumber % symbols.length;
  const rotated = [...symbols.slice(start), ...symbols.slice(0, start)];

  return rotated.slice(0, limit);
}

async function upsertTechnicalSignal(input: {
  userId: string;
  opportunity: TechnicalOpportunity;
  universe: TechnicalUniverseId;
}) {
  const symbol = input.opportunity.symbol;
  const title = `Technical opportunity: ${symbol}`;
  const sourceName = `Slice Technical Engine · ${universeLabel(input.universe)}`;

  const existing = await prisma.opportunitySignal.findFirst({
    where: {
      userId: input.userId,
      title,
      signalType: input.opportunity.signalType,
    },
  });

  const evidencePayload = {
    type: "TECHNICAL_PAYLOAD",
    version: 5,
    symbol,
    snapshot: input.opportunity.snapshot,
    miniChart: input.opportunity.snapshot.miniChart,
  };

  const evidence = [
    evidencePayload,
    ...input.opportunity.evidence,
    `Universe: ${universeLabel(input.universe)}.`,
    `Price: ${dollars(input.opportunity.snapshot.price)}.`,
    `SMA20: ${dollars(input.opportunity.snapshot.sma20)}.`,
    `SMA50: ${dollars(input.opportunity.snapshot.sma50)}.`,
    `SMA200: ${dollars(input.opportunity.snapshot.sma200)}.`,
  ];

  const data = {
    title,
    summary: `${symbol} cleared Slice's technical opportunity filter with composite score ${input.opportunity.compositeScore}/100. The scan evaluates RSI 7/14/21 structure, RSI recovery, RSI divergence, moving averages, MACD, Bollinger bands, 52-week range, drawdown, relative strength, liquidity, volatility, advisor relevance, and operator-defined filters.`,
    sourceName,
    signalType: input.opportunity.signalType,
    priorityTier: input.opportunity.priorityTier,
    portfolioRelevanceScore: input.opportunity.portfolioRelevanceScore,
    opportunityScore: input.opportunity.opportunityScore,
    riskScore: input.opportunity.riskScore,
    confidenceScore: input.opportunity.confidenceScore,
    actionabilityScore: input.opportunity.actionabilityScore,
    compositeScore: input.opportunity.compositeScore,
    tickersJson: safeJson([symbol]),
    categoriesJson: safeJson(input.opportunity.categories),
    evidenceJson: safeJson(evidence),
    suggestedAction: input.opportunity.suggestedAction,
    advisorNotes: input.opportunity.advisorNotes,
    status: "Open",
  };

  if (existing) {
    await prisma.opportunitySignal.update({
      where: { id: existing.id },
      data,
    });

    return { type: "updated" as const, signalId: existing.id };
  }

  const created = await prisma.opportunitySignal.create({
    data: {
      userId: input.userId,
      ...data,
    },
  });

  return { type: "created" as const, signalId: created.id };
}

async function markTechnicalSignalNoLongerQualifies(input: {
  userId: string;
  symbol: string;
}) {
  await prisma.opportunitySignal.updateMany({
    where: {
      userId: input.userId,
      title: `Technical opportunity: ${input.symbol}`,
      signalType: "Technical Opportunity",
      status: "Open",
    },
    data: {
      status: "No Longer Qualifies",
    },
  });
}

async function upsertTechnicalAlert(input: {
  userId: string;
  opportunity: TechnicalOpportunity;
  universe: TechnicalUniverseId;
}) {
  if (input.opportunity.compositeScore < 78) return false;

  const symbol = input.opportunity.symbol;
  const dedupeKey = `technical-opportunity:${hash(`${input.userId}:${symbol}:${input.universe}`)}`;

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId: input.userId,
        dedupeKey,
      },
    },
    update: {
      title: `Technical opportunity: ${symbol}`,
      body: input.opportunity.suggestedAction,
      source: "Slice Technical Engine",
      ticker: symbol,
      urgency: input.opportunity.priorityTier === "Critical" ? "Critical" : "High",
      score: input.opportunity.compositeScore,
      channel: "Dashboard + Technical Radar",
      aiBriefing: input.opportunity.advisorNotes,
    },
    create: {
      userId: input.userId,
      dedupeKey,
      title: `Technical opportunity: ${symbol}`,
      body: input.opportunity.suggestedAction,
      source: "Slice Technical Engine",
      ticker: symbol,
      urgency: input.opportunity.priorityTier === "Critical" ? "Critical" : "High",
      score: input.opportunity.compositeScore,
      channel: "Dashboard + Technical Radar",
      aiBriefing: input.opportunity.advisorNotes,
    },
  });

  return true;
}

async function scanSymbol(input: {
  userId: string;
  symbol: string;
  quote: QuoteSnapshot | null;
  universe: TechnicalUniverseId;
  benchmark3mReturnPct: number | null;
  minCompositeScore: number;
  advisorContext: AdvisorContext;
  advancedFilters?: TechnicalAdvancedFilters;
}) {
  const chart = await fetchYahooChart(input.symbol);

  if (!chart.points.length) {
    return {
      scanned: 1,
      qualified: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      alerted: 0,
      providerError: chart.error ?? "No chart data",
      candidate: null as ScreenedCandidate | null,
      opportunity: null as TechnicalOpportunity | null,
    };
  }

  const snapshot = buildSnapshot(
    input.symbol,
    chart.points,
    input.quote,
    input.benchmark3mReturnPct
  );

  if (!snapshot) {
    return {
      scanned: 1,
      qualified: 0,
      created: 0,
      updated: 0,
      skipped: 1,
      failed: 0,
      alerted: 0,
      providerError: null as string | null,
      candidate: null as ScreenedCandidate | null,
      opportunity: null as TechnicalOpportunity | null,
    };
  }

  const advisorScore = advisorRelevanceScore(input.symbol, input.advisorContext);
  const scored = scoreTechnicalOpportunity(snapshot, advisorScore);
  const filters = applyAdvancedFilters({
    snapshot,
    advisorScore,
    scored,
    filters: {
      ...input.advancedFilters,
      minCompositeScore: input.advancedFilters?.minCompositeScore ?? input.minCompositeScore,
    },
  });

  const qualified = scored.worthy && scored.compositeScore >= input.minCompositeScore && filters.passed;
  const candidate = screenedCandidate({
    symbol: input.symbol,
    snapshot,
    advisorScore,
    scored,
    filters,
    qualified,
  });

  if (!qualified) {
    await markTechnicalSignalNoLongerQualifies({
      userId: input.userId,
      symbol: input.symbol,
    });

    return {
      scanned: 1,
      qualified: 0,
      created: 0,
      updated: 0,
      skipped: 1,
      failed: 0,
      alerted: 0,
      providerError: null as string | null,
      candidate,
      opportunity: null as TechnicalOpportunity | null,
    };
  }

  const opportunity = createTechnicalOpportunity({
    symbol: input.symbol,
    snapshot,
    advisorScore,
    scored,
  });

  const result = await upsertTechnicalSignal({
    userId: input.userId,
    opportunity,
    universe: input.universe,
  });

  const alertCreated = await upsertTechnicalAlert({
    userId: input.userId,
    opportunity,
    universe: input.universe,
  });

  return {
    scanned: 1,
    qualified: 1,
    created: result.type === "created" ? 1 : 0,
    updated: result.type === "updated" ? 1 : 0,
    skipped: 0,
    failed: 0,
    alerted: alertCreated ? 1 : 0,
    providerError: null as string | null,
    candidate,
    opportunity,
  };
}

export async function runTechnicalOpportunityScanForUser(
  userId: string,
  options: TechnicalScanOptions = {}
) {
  const startedAt = Date.now();
  const universe = options.indexUniverse ?? "sp100";
  const minCompositeScore = clamp(options.minCompositeScore ?? 70, 50, 95);
  const requestedLimit = Math.max(1, Math.min(125, options.limit ?? 40));
  const maxDurationMs = Math.max(8_000, Math.min(55_000, options.maxDurationMs ?? 38_000));
  const advisorContext = await loadAdvisorContext(userId);

  const advisorSymbols =
    universe === "advisor-watchlist" || options.includeAdvisorWatchlist
      ? advisorContext.universeSymbols
      : [];

  const baseSymbols = universeSymbols(universe, options.customSymbols ?? []);
  const fullUniverse = dedupeSymbols([...baseSymbols, ...advisorSymbols]);
  const symbols = rotateSymbols(fullUniverse, requestedLimit, userId, universe);

  const benchmarkChart = await fetchYahooChart(benchmarkForUniverse(universe));
  const benchmarkCloses = benchmarkChart.points.map((point: PricePoint) => point.close);
  const benchmark3mReturnPct = returnPct(benchmarkCloses, 63);
  const quoteMap = await fetchYahooQuotes(symbols);

  let scanned = 0;
  let qualified = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let alerted = 0;
  let timedOut = false;

  const providerErrors: Record<string, number> = {};
  const opportunities: TechnicalOpportunity[] = [];
  const candidates: ScreenedCandidate[] = [];

  for (const group of chunk(symbols, 3)) {
    if (Date.now() - startedAt > maxDurationMs) {
      timedOut = true;
      break;
    }

    const results = await Promise.all(
      group.map((symbol) =>
        scanSymbol({
          userId,
          symbol,
          quote: quoteMap.get(cleanSymbol(symbol)) ?? null,
          universe,
          benchmark3mReturnPct,
          minCompositeScore,
          advisorContext,
          advancedFilters: options.advancedFilters,
        })
      )
    );

    for (const result of results) {
      scanned += result.scanned;
      qualified += result.qualified;
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      failed += result.failed;
      alerted += result.alerted;

      if (result.providerError) {
        providerErrors[result.providerError] = (providerErrors[result.providerError] ?? 0) + 1;
      }

      if (result.candidate) candidates.push(result.candidate);
      if (result.opportunity) opportunities.push(result.opportunity);
    }

    await sleep(150);
  }

  await prisma.intelligenceRun.create({
    data: {
      userId,
      mode: `technical-${universe}-opportunity-scan-v5-typed-market-data`,
      scannedCount: scanned,
      retainedCount: qualified,
      alertCount: alerted,
      digestCount: 0,
      discardedCount: skipped + failed,
      durationMs: Date.now() - startedAt,
    },
  });

  const sortedCandidates = candidates.sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    ok: true,
    universe,
    universeSize: fullUniverse.length,
    selectedForThisRun: symbols.length,
    scanned,
    qualified,
    created,
    updated,
    skipped,
    failed,
    alerted,
    timedOut,
    providerErrors,
    minCompositeScore,
    advancedFilters: options.advancedFilters ?? null,
    maxDurationMs,
    durationMs: Date.now() - startedAt,
    topCandidates: opportunities
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 12)
      .map((item) => ({
        symbol: item.symbol,
        companyName: item.snapshot.companyName,
        compositeScore: item.compositeScore,
        opportunityScore: item.opportunityScore,
        riskScore: item.riskScore,
        confidenceScore: item.confidenceScore,
        actionabilityScore: item.actionabilityScore,
        priorityTier: item.priorityTier,
        price: item.snapshot.price,
        rsi7: item.snapshot.rsi7,
        rsi14: item.snapshot.rsi14,
        rsi21: item.snapshot.rsi21,
        rsiRegime: item.snapshot.rsiRegime,
        rangePositionPct: item.snapshot.rangePositionPct,
        distanceToSma200Pct: item.snapshot.distanceToSma200Pct,
        relative3mVsBenchmarkPct: item.snapshot.relative3mVsBenchmarkPct,
      })),
    topScreenedCandidates: sortedCandidates.slice(0, 15),
  };
}

export async function runTechnicalOpportunityScanBatch(options: {
  batchSize?: number;
  targetUserId?: string | null;
  indexUniverse?: TechnicalUniverseId;
  customSymbols?: string[];
  limit?: number;
  minCompositeScore?: number;
  maxDurationMs?: number;
  advancedFilters?: TechnicalAdvancedFilters;
}) {
  const startedAt = Date.now();

  const users = options.targetUserId
    ? await prisma.user.findMany({
        where: {
          id: options.targetUserId,
          platformStatus: "Active",
        },
        take: 1,
      })
    : await prisma.user.findMany({
        where: {
          platformStatus: "Active",
        },
        orderBy: {
          createdAt: "asc",
        },
        take: Math.max(1, Math.min(25, options.batchSize ?? 10)),
      });

  const results = [];

  for (const user of users) {
    const result = await runTechnicalOpportunityScanForUser(user.id, {
      indexUniverse: options.indexUniverse,
      customSymbols: options.customSymbols,
      limit: options.limit,
      minCompositeScore: options.minCompositeScore,
      maxDurationMs: options.maxDurationMs,
      advancedFilters: options.advancedFilters,
      includeAdvisorWatchlist: true,
    });

    results.push({
      userId: user.id,
      email: user.email,
      ...result,
    });
  }

  return {
    ok: true,
    scannedUsers: users.length,
    durationMs: Date.now() - startedAt,
    totals: {
      scanned: results.reduce((sum, item) => sum + item.scanned, 0),
      qualified: results.reduce((sum, item) => sum + item.qualified, 0),
      created: results.reduce((sum, item) => sum + item.created, 0),
      updated: results.reduce((sum, item) => sum + item.updated, 0),
      skipped: results.reduce((sum, item) => sum + item.skipped, 0),
      failed: results.reduce((sum, item) => sum + item.failed, 0),
      alerted: results.reduce((sum, item) => sum + item.alerted, 0),
      timedOutRuns: results.filter((item) => item.timedOut).length,
    },
    results,
  };
}