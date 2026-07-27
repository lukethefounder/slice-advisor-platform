import {
  ALPHA_INTRADAY_INTERVALS,
  type AlphaCacheState,
  type AlphaCompanyOverview,
  type AlphaEntitlement,
  type AlphaFreshnessMode,
  type AlphaFreshnessSnapshot,
  type AlphaIntradayBar,
  type AlphaIntradayInterval,
  type AlphaIntradaySnapshot,
  type AlphaMarketStatus,
  type AlphaNewsItem,
  type AlphaNewsSnapshot,
  type AlphaQuoteSnapshot,
  type AlphaTechnicalSnapshot,
  type AlphaVantageIntelligenceResponse,
} from "@/lib/intelligence/alpha-vantage-types";

const ALPHA_ENDPOINT = "https://www.alphavantage.co/query";
const DEFAULT_TIME_ZONE = "America/New_York";

const CACHE_TTLS = {
  quote: 15_000,
  intraday: 15_000,
  marketStatus: 60_000,
  news: 2 * 60_000,
  daily: 15 * 60_000,
  overview: 6 * 60 * 60_000,
} as const;

const STALE_MULTIPLIER = 12;

type AlphaPayload = Record<string, unknown> & {
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type CacheEntry = {
  payload: AlphaPayload;
  storedAt: number;
};

type AlphaFetchResult = {
  payload: AlphaPayload;
  cacheState: AlphaCacheState;
  fetchedAt: string;
};

type AlphaRequestOptions = {
  ttlMs: number;
  staleTtlMs?: number;
  timeoutMs?: number;
};

type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceAlphaCache: Map<string, CacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __sliceAlphaInFlight: Map<string, Promise<AlphaFetchResult>> | undefined;
}

const responseCache =
  globalThis.__sliceAlphaCache ?? new Map<string, CacheEntry>();
const inFlight =
  globalThis.__sliceAlphaInFlight ??
  new Map<string, Promise<AlphaFetchResult>>();

globalThis.__sliceAlphaCache = responseCache;
globalThis.__sliceAlphaInFlight = inFlight;

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, minimum = 0, maximum = 100) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(maximum, value));
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value ?? "")
    .replace(/[$,%]/g, "")
    .trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(value: unknown, maximumLength = 10_000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function getEntitlement(): AlphaEntitlement {
  const value = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  return value === "realtime" || value === "delayed" ? value : null;
}

export function normalizeAlphaSymbol(value: string) {
  const symbol = value.trim().toUpperCase().slice(0, 32);

  if (!symbol || !/^[A-Z0-9.^:/-]+$/.test(symbol)) {
    throw new Error("Enter a valid Alpha Vantage symbol.");
  }

  return symbol;
}

export function normalizeIntradayInterval(
  value: string | null | undefined,
): AlphaIntradayInterval {
  const requested = String(value ?? "").trim() as AlphaIntradayInterval;

  if (ALPHA_INTRADAY_INTERVALS.includes(requested)) {
    return requested;
  }

  const configured = String(
    process.env.ALPHA_VANTAGE_INTRADAY_INTERVAL ?? "5min",
  ).trim() as AlphaIntradayInterval;

  return ALPHA_INTRADAY_INTERVALS.includes(configured)
    ? configured
    : "5min";
}

function readProviderError(payload: AlphaPayload) {
  return (
    cleanString(payload["Error Message"]) ||
    cleanString(payload.Information) ||
    cleanString(payload.Note) ||
    null
  );
}

function stableQueryKey(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function fetchAlphaPayload(
  parameters: Record<string, string>,
  options: AlphaRequestOptions,
): Promise<AlphaFetchResult> {
  const apiKey = String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim();

  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");
  }

  const query = {
    ...parameters,
    apikey: apiKey,
  };
  const cacheKey = stableQueryKey(query);
  const now = Date.now();
  const cached = responseCache.get(cacheKey);

  if (cached && now - cached.storedAt <= options.ttlMs) {
    return {
      payload: cached.payload,
      cacheState: "fresh-cache",
      fetchedAt: new Date(cached.storedAt).toISOString(),
    };
  }

  const existing = inFlight.get(cacheKey);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 12_000,
    );

    try {
      const url = new URL(ALPHA_ENDPOINT);

      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SliceIntelligence/3.0",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Alpha Vantage ${parameters.function ?? "request"} returned HTTP ${response.status}.`,
        );
      }

      const payload = (await response.json()) as AlphaPayload;
      const providerError = readProviderError(payload);

      if (providerError) {
        throw new Error(providerError);
      }

      const storedAt = Date.now();
      responseCache.set(cacheKey, {
        payload,
        storedAt,
      });

      return {
        payload,
        cacheState: "network" as const,
        fetchedAt: new Date(storedAt).toISOString(),
      };
    } catch (error) {
      const staleTtlMs =
        options.staleTtlMs ?? options.ttlMs * STALE_MULTIPLIER;

      if (cached && now - cached.storedAt <= staleTtlMs) {
        return {
          payload: cached.payload,
          cacheState: "stale-cache" as const,
          fetchedAt: new Date(cached.storedAt).toISOString(),
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);

  return request;
}

function endpointParameters(
  functionName: string,
  extra: Record<string, string> = {},
  includeEntitlement = false,
) {
  const parameters: Record<string, string> = {
    function: functionName,
    ...extra,
  };
  const entitlement = getEntitlement();

  if (includeEntitlement && entitlement) {
    parameters.entitlement = entitlement;
  }

  return parameters;
}

function parseOffsetMinutes(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    });
    const zonePart = formatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
    const match = zonePart?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);

    if (!match) {
      return 0;
    }

    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  } catch {
    return 0;
  }
}

function normalizeProviderTimeZone(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return DEFAULT_TIME_ZONE;
  }

  if (
    normalized === "US/Eastern" ||
    normalized === "Eastern" ||
    normalized === "EST" ||
    normalized === "EDT"
  ) {
    return DEFAULT_TIME_ZONE;
  }

  return normalized;
}

function parseProviderTimestamp(
  value: string | null | undefined,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const dateTimeMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second = "0"] =
      dateTimeMatch;
    const localAsUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const offsetMinutes = parseOffsetMinutes(
      new Date(localAsUtc),
      normalizeProviderTimeZone(timeZone),
    );

    return new Date(localAsUtc - offsetMinutes * 60_000).toISOString();
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localCloseAsUtc = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      16,
      0,
      0,
    );
    const offsetMinutes = parseOffsetMinutes(
      new Date(localCloseAsUtc),
      normalizeProviderTimeZone(timeZone),
    );

    return new Date(
      localCloseAsUtc - offsetMinutes * 60_000,
    ).toISOString();
  }

  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function parseNewsTimestamp(value: unknown) {
  const raw = cleanString(value, 32);
  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  ).toISOString();
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return Math.sqrt(
    average(values.map((value) => (value - mean) ** 2)),
  );
}

function sma(values: number[], length: number) {
  return values.length >= length
    ? average(values.slice(0, length))
    : null;
}

function rsi(values: number[], length = 14) {
  if (values.length < length + 1) {
    return null;
  }

  const chronological = values.slice(0, length + 1).reverse();
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < chronological.length; index += 1) {
    const change = chronological[index] - chronological[index - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return gains === 0 ? 50 : 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function averageTrueRange(bars: DailyBar[], length = 14) {
  if (bars.length < length + 1) {
    return null;
  }

  const ranges: number[] = [];

  for (let index = 0; index < length; index += 1) {
    const current = bars[index];
    const priorClose = bars[index + 1]?.close ?? current.close;
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - priorClose),
      Math.abs(current.low - priorClose),
    );
    ranges.push(trueRange);
  }

  return average(ranges);
}

function higherIsBetter(value: number, low: number, high: number) {
  return clamp(((value - low) / Math.max(high - low, 0.0001)) * 100);
}

function lowerIsBetter(value: number, low: number, high: number) {
  return clamp(100 - higherIsBetter(value, low, high));
}

function parseQuote(payload: AlphaPayload): AlphaQuoteSnapshot | null {
  const quote = (payload["Global Quote"] ?? {}) as Record<string, unknown>;
  const price = toNumber(quote["05. price"]);

  if (price <= 0) {
    return null;
  }

  const previousClose = toNumber(quote["08. previous close"], price);
  const change = toNumber(
    quote["09. change"],
    price - previousClose,
  );
  const changePercent = toNumber(
    String(quote["10. change percent"] ?? "").replace("%", ""),
    previousClose ? (change / previousClose) * 100 : 0,
  );

  return {
    price,
    open: toNumber(quote["02. open"], price),
    high: toNumber(quote["03. high"], price),
    low: toNumber(quote["04. low"], price),
    previousClose,
    change,
    changePercent,
    volume: toNumber(quote["06. volume"]),
    latestTradingDay: cleanString(quote["07. latest trading day"], 20) || null,
  };
}

function parseMarketStatus(payload: AlphaPayload): AlphaMarketStatus | null {
  const markets = Array.isArray(payload.markets)
    ? (payload.markets as Array<Record<string, unknown>>)
    : [];
  const preferred =
    markets.find((market) => {
      const marketType = cleanString(market.market_type).toLowerCase();
      const region = cleanString(market.region).toLowerCase();
      const exchanges = cleanString(market.primary_exchanges).toLowerCase();

      return (
        marketType.includes("equity") &&
        (region.includes("united states") ||
          exchanges.includes("nasdaq") ||
          exchanges.includes("nyse"))
      );
    }) ?? markets[0];

  if (!preferred) {
    return null;
  }

  const currentStatus = cleanString(preferred.current_status, 64) || "unknown";

  return {
    marketType: cleanString(preferred.market_type, 100),
    region: cleanString(preferred.region, 100),
    primaryExchanges: cleanString(preferred.primary_exchanges, 300),
    localOpen: cleanString(preferred.local_open, 32),
    localClose: cleanString(preferred.local_close, 32),
    currentStatus,
    isOpen: currentStatus.toLowerCase() === "open",
    notes: cleanString(preferred.notes, 500),
  };
}

function parseIntraday(
  payload: AlphaPayload,
  interval: AlphaIntradayInterval,
): AlphaIntradaySnapshot | null {
  const meta = (payload["Meta Data"] ?? {}) as Record<string, unknown>;
  const timeZone = normalizeProviderTimeZone(
    cleanString(meta["6. Time Zone"] ?? meta["5. Time Zone"], 100),
  );
  const lastRefreshedRaw = cleanString(
    meta["3. Last Refreshed"] ?? meta["4. Last Refreshed"],
    64,
  );
  const seriesKey = `Time Series (${interval})`;
  const series = (payload[seriesKey] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const keys = Object.keys(series).sort((left, right) =>
    right.localeCompare(left),
  );

  if (!keys.length) {
    return null;
  }

  const bars: AlphaIntradayBar[] = keys.slice(0, 100).map((key) => ({
    timestamp:
      parseProviderTimestamp(key, timeZone) ?? new Date().toISOString(),
    providerTimestamp: key,
    open: toNumber(series[key]?.["1. open"]),
    high: toNumber(series[key]?.["2. high"]),
    low: toNumber(series[key]?.["3. low"]),
    close: toNumber(series[key]?.["4. close"]),
    volume: toNumber(series[key]?.["5. volume"]),
  }));
  const latestProviderDate = keys[0]?.slice(0, 10) ?? null;
  const sessionBars = latestProviderDate
    ? bars.filter((bar) =>
        bar.providerTimestamp.startsWith(latestProviderDate),
      )
    : [];
  const chronological = [...sessionBars].reverse();
  const sessionVolume = sessionBars.reduce(
    (sum, bar) => sum + bar.volume,
    0,
  );
  const vwapNumerator = sessionBars.reduce(
    (sum, bar) =>
      sum + ((bar.high + bar.low + bar.close) / 3) * bar.volume,
    0,
  );
  const sessionOpen = chronological[0]?.open ?? bars.at(-1)?.open ?? 0;
  const latest = bars[0]?.close ?? 0;

  return {
    interval,
    timeZone,
    lastRefreshed:
      parseProviderTimestamp(lastRefreshedRaw || keys[0], timeZone) ??
      bars[0]?.timestamp ??
      null,
    bars,
    session: latestProviderDate
      ? {
          date: latestProviderDate,
          open: sessionOpen,
          high: Math.max(...sessionBars.map((bar) => bar.high)),
          low: Math.min(...sessionBars.map((bar) => bar.low)),
          latest,
          vwap: sessionVolume ? vwapNumerator / sessionVolume : latest,
          volume: sessionVolume,
          changePercent: sessionOpen
            ? ((latest - sessionOpen) / sessionOpen) * 100
            : 0,
        }
      : null,
  };
}

function parseDailyBars(payload: AlphaPayload) {
  const series = (
    payload["Time Series (Daily)"] ??
    payload["Time Series (Daily Adjusted)"] ??
    {}
  ) as Record<string, Record<string, unknown>>;

  return Object.keys(series)
    .sort((left, right) => right.localeCompare(left))
    .map<DailyBar>((date) => ({
      date,
      open: toNumber(series[date]?.["1. open"]),
      high: toNumber(series[date]?.["2. high"]),
      low: toNumber(series[date]?.["3. low"]),
      close: toNumber(
        series[date]?.["5. adjusted close"] ?? series[date]?.["4. close"],
      ),
      volume: toNumber(
        series[date]?.["6. volume"] ?? series[date]?.["5. volume"],
      ),
    }))
    .filter((bar) => bar.close > 0);
}

function buildTechnicals(
  bars: DailyBar[],
  quote: AlphaQuoteSnapshot | null,
): AlphaTechnicalSnapshot | null {
  if (!bars.length && !quote) {
    return null;
  }

  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume).filter((value) => value > 0);
  const latestPrice = quote?.price ?? closes[0] ?? 0;
  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const sma200Value = sma(closes, 200);
  const rsi14Value = rsi(closes, 14);
  const logReturns = closes.slice(0, 21).flatMap((close, index) => {
    const prior = closes[index + 1];
    return prior && close > 0 && prior > 0 ? [Math.log(close / prior)] : [];
  });
  const volatility20Daily = logReturns.length
    ? standardDeviation(logReturns) * 100
    : null;
  const volatility20Annualized =
    volatility20Daily !== null
      ? volatility20Daily * Math.sqrt(252)
      : null;
  const momentum30 = closes[30]
    ? ((latestPrice - closes[30]) / closes[30]) * 100
    : null;
  const sixtyDayHigh = bars.length
    ? Math.max(...bars.slice(0, 60).map((bar) => bar.high))
    : latestPrice;
  const drawdown = sixtyDayHigh
    ? ((latestPrice - sixtyDayHigh) / sixtyDayHigh) * 100
    : null;
  const atr14 = averageTrueRange(bars, 14);
  const recentVolume = average(volumes.slice(0, 5));
  const baselineVolume = average(volumes.slice(5, 20));
  const volumeTrendPercent = baselineVolume
    ? (recentVolume / baselineVolume - 1) * 100
    : null;

  const trendScore = clamp(
    (sma20Value !== null && latestPrice > sma20Value ? 24 : 8) +
      (sma50Value !== null && latestPrice > sma50Value ? 24 : 8) +
      (sma200Value !== null && latestPrice > sma200Value ? 24 : 8) +
      higherIsBetter(momentum30 ?? 0, -20, 30) * 0.28,
  );
  const momentumScore = clamp(
    higherIsBetter(momentum30 ?? 0, -20, 35) * 0.55 +
      higherIsBetter(rsi14Value ?? 50, 30, 70) * 0.3 +
      higherIsBetter(quote?.changePercent ?? 0, -6, 6) * 0.15,
  );
  const riskScore = clamp(
    lowerIsBetter(volatility20Annualized ?? 35, 10, 80) * 0.5 +
      lowerIsBetter(Math.abs(drawdown ?? 0), 0, 45) * 0.35 +
      lowerIsBetter(
        latestPrice && atr14 ? (atr14 / latestPrice) * 100 : 2,
        0.5,
        8,
      ) *
        0.15,
  );
  const volumeScore = clamp(
    higherIsBetter(volumeTrendPercent ?? 0, -50, 100),
  );
  const trendLabel =
    trendScore >= 67
      ? "bullish trend"
      : trendScore <= 33
        ? "bearish trend"
        : "mixed trend";
  const momentumLabel =
    momentumScore >= 67
      ? "strong momentum"
      : momentumScore <= 33
        ? "weak momentum"
        : "balanced momentum";

  return {
    historyPointCount: bars.length,
    sma20: sma20Value,
    sma50: sma50Value,
    sma200: sma200Value,
    rsi14: rsi14Value,
    volatility20Daily,
    volatility20Annualized,
    volatility20: volatility20Daily,
    momentum30,
    drawdownFrom60DayHigh: drawdown,
    drawdownFromHigh: drawdown,
    averageTrueRange14: atr14,
    volumeTrendPercent,
    volumeTrend: volumeTrendPercent,
    trendScore: Math.round(trendScore),
    momentumScore: Math.round(momentumScore),
    riskScore: Math.round(riskScore),
    volumeScore: Math.round(volumeScore),
    technicalSummary: `${trendLabel}; ${momentumLabel}; risk-quality score ${Math.round(
      riskScore,
    )}/100.`,
  };
}

function parseOverview(payload: AlphaPayload): AlphaCompanyOverview | null {
  const name = cleanString(payload.Name, 300);

  if (!name && !payload.Symbol) {
    return null;
  }

  return {
    name,
    description: cleanString(payload.Description, 8_000),
    exchange: cleanString(payload.Exchange, 100),
    currency: cleanString(payload.Currency, 20) || "USD",
    country: cleanString(payload.Country, 100),
    sector: cleanString(payload.Sector, 200),
    industry: cleanString(payload.Industry, 300),
    marketCap: toNumber(payload.MarketCapitalization),
    peRatio: toNumber(payload.PERatio),
    pegRatio: toNumber(payload.PEGRatio),
    bookValue: toNumber(payload.BookValue),
    dividendYield: toNumber(payload.DividendYield),
    eps: toNumber(payload.EPS),
    profitMargin: toNumber(payload.ProfitMargin),
    operatingMargin: toNumber(payload.OperatingMarginTTM),
    returnOnAssets: toNumber(payload.ReturnOnAssetsTTM),
    returnOnEquity: toNumber(payload.ReturnOnEquityTTM),
    quarterlyRevenueGrowthYOY: toNumber(payload.QuarterlyRevenueGrowthYOY),
    quarterlyEarningsGrowthYOY: toNumber(payload.QuarterlyEarningsGrowthYOY),
    analystTargetPrice: toNumber(payload.AnalystTargetPrice),
    beta: toNumber(payload.Beta, 1),
    week52High: toNumber(payload["52WeekHigh"]),
    week52Low: toNumber(payload["52WeekLow"]),
    movingAverage50Day: toNumber(payload["50DayMovingAverage"]),
    movingAverage200Day: toNumber(payload["200DayMovingAverage"]),
    sharesOutstanding: toNumber(payload.SharesOutstanding),
    latestQuarter: cleanString(payload.LatestQuarter, 20) || null,
  };
}

function parseNews(
  payload: AlphaPayload,
  symbol: string,
): AlphaNewsSnapshot | null {
  const feed = Array.isArray(payload.feed)
    ? (payload.feed as Array<Record<string, unknown>>)
    : [];

  if (!feed.length) {
    return null;
  }

  const items: AlphaNewsItem[] = feed.slice(0, 50).map((item, index) => {
    const tickerSentiment = Array.isArray(item.ticker_sentiment)
      ? (item.ticker_sentiment as Array<Record<string, unknown>>)
      : [];
    const matching =
      tickerSentiment.find(
        (entry) => cleanString(entry.ticker, 40).toUpperCase() === symbol,
      ) ?? tickerSentiment[0] ?? {};
    const topics = Array.isArray(item.topics)
      ? (item.topics as Array<Record<string, unknown>>)
          .map((topic) => cleanString(topic.topic, 200))
          .filter(Boolean)
      : [];
    const url = cleanString(item.url, 2_000);
    const title = cleanString(item.title, 1_000);
    const publishedAt = parseNewsTimestamp(item.time_published);

    return {
      id: `${symbol}:${publishedAt ?? "unknown"}:${index}`,
      title,
      summary: cleanString(item.summary, 4_000),
      url,
      source: cleanString(item.source, 200),
      sourceDomain: cleanString(item.source_domain, 300),
      publishedAt,
      overallSentimentScore: toNumber(item.overall_sentiment_score),
      overallSentimentLabel: cleanString(
        item.overall_sentiment_label,
        100,
      ),
      tickerRelevance: toNumber(matching.relevance_score),
      tickerSentimentScore: toNumber(matching.ticker_sentiment_score),
      tickerSentimentLabel: cleanString(
        matching.ticker_sentiment_label,
        100,
      ),
      topics,
    };
  });
  let weightedTotal = 0;
  let relevanceTotal = 0;

  for (const item of items) {
    weightedTotal += item.tickerSentimentScore * item.tickerRelevance;
    relevanceTotal += item.tickerRelevance;
  }

  return {
    articleCount: items.length,
    latestPublishedAt: items[0]?.publishedAt ?? null,
    averageSentiment: average(
      items.map((item) => item.tickerSentimentScore),
    ),
    relevanceWeightedSentiment: relevanceTotal
      ? weightedTotal / relevanceTotal
      : average(items.map((item) => item.tickerSentimentScore)),
    averageRelevance: average(items.map((item) => item.tickerRelevance)),
    latestTitle: items[0]?.title ?? "",
    items,
  };
}

function buildFreshness(input: {
  entitlement: AlphaEntitlement;
  providerAsOf: string | null;
  retrievedAt: string;
  market: AlphaMarketStatus | null;
  interval: AlphaIntradayInterval;
  hasQuote: boolean;
}): AlphaFreshnessSnapshot {
  const ageSeconds = input.providerAsOf
    ? Math.max(
        0,
        Math.round(
          (Date.parse(input.retrievedAt) - Date.parse(input.providerAsOf)) /
            1_000,
        ),
      )
    : null;
  const intervalMinutes = Number.parseInt(input.interval, 10) || 5;
  const realtimeThreshold = Math.max(180, intervalMinutes * 60 * 2.5);
  let mode: AlphaFreshnessMode = "unavailable";
  let label = "Provider timestamp unavailable";
  let explanation =
    "The response did not include enough provider timing evidence to classify freshness.";

  if (!input.hasQuote) {
    mode = "unavailable";
  } else if (
    input.market &&
    !input.market.isOpen &&
    (ageSeconds === null || ageSeconds <= 4 * 24 * 60 * 60)
  ) {
    mode = "market_closed";
    label = "Market closed · latest provider observation";
    explanation =
      "The primary US equity market is currently closed. The displayed observation is the latest provider timestamp, not a fabricated live tick.";
  } else if (
    input.entitlement === "realtime" &&
    ageSeconds !== null &&
    ageSeconds <= realtimeThreshold
  ) {
    mode = "realtime";
    label = "Real-time entitlement and fresh provider timestamp";
    explanation =
      "The request used entitlement=realtime and the latest intraday provider timestamp is within the configured freshness window.";
  } else if (
    input.entitlement === "delayed" &&
    ageSeconds !== null &&
    ageSeconds <= 35 * 60
  ) {
    mode = "delayed";
    label = "15-minute delayed entitlement";
    explanation =
      "The request used entitlement=delayed. The UI labels this as delayed rather than real-time.";
  } else if (
    input.providerAsOf &&
    ageSeconds !== null &&
    ageSeconds <= 4 * 24 * 60 * 60
  ) {
    mode = input.entitlement ? "stale" : "end_of_day";
    label =
      input.entitlement === null
        ? "End-of-day or historical provider mode"
        : "Provider observation outside the live freshness window";
    explanation =
      input.entitlement === null
        ? "No entitlement was configured, so Alpha Vantage may return end-of-day or historical data for regulated US equity feeds."
        : "An entitlement was requested, but the provider timestamp is older than the live threshold.";
  } else {
    mode = "stale";
    label = "Stale provider observation";
    explanation =
      "The provider observation is too old to be treated as current market evidence.";
  }

  return {
    requestedEntitlement: input.entitlement,
    mode,
    isRealtime: mode === "realtime",
    isDelayed: mode === "delayed",
    providerAsOf: input.providerAsOf,
    retrievedAt: input.retrievedAt,
    ageSeconds,
    label,
    explanation,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function getAlphaVantageIntelligence(input: {
  symbol: string;
  interval?: string | null;
}): Promise<AlphaVantageIntelligenceResponse> {
  const symbol = normalizeAlphaSymbol(input.symbol);
  const interval = normalizeIntradayInterval(input.interval);
  const entitlement = getEntitlement();
  const retrievedAt = new Date().toISOString();
  const recommendedPollMs = numberFromEnv(
    "ALPHA_VANTAGE_RECOMMENDED_POLL_MS",
    30_000,
  );
  const cache: Record<string, AlphaCacheState> = {};
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  const quotePromise = fetchAlphaPayload(
    endpointParameters(
      "GLOBAL_QUOTE",
      { symbol },
      true,
    ),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_QUOTE_CACHE_MS",
        CACHE_TTLS.quote,
      ),
    },
  );
  const intradayPromise = fetchAlphaPayload(
    endpointParameters(
      "TIME_SERIES_INTRADAY",
      {
        symbol,
        interval,
        outputsize: "compact",
        adjusted: "false",
        extended_hours: "true",
      },
      true,
    ),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_INTRADAY_CACHE_MS",
        CACHE_TTLS.intraday,
      ),
    },
  );
  const marketStatusPromise = fetchAlphaPayload(
    endpointParameters("MARKET_STATUS"),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_MARKET_STATUS_CACHE_MS",
        CACHE_TTLS.marketStatus,
      ),
    },
  );
  const overviewPromise = fetchAlphaPayload(
    endpointParameters("OVERVIEW", { symbol }),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_OVERVIEW_CACHE_MS",
        CACHE_TTLS.overview,
      ),
    },
  );
  const newsPromise = fetchAlphaPayload(
    endpointParameters("NEWS_SENTIMENT", {
      tickers: symbol,
      sort: "LATEST",
      limit: "50",
    }),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_NEWS_CACHE_MS",
        CACHE_TTLS.news,
      ),
    },
  );
  const dailyPromise = fetchAlphaPayload(
    endpointParameters(
      "TIME_SERIES_DAILY_ADJUSTED",
      {
        symbol,
        outputsize: "full",
      },
      true,
    ),
    {
      ttlMs: numberFromEnv(
        "ALPHA_VANTAGE_DAILY_CACHE_MS",
        CACHE_TTLS.daily,
      ),
      staleTtlMs: 24 * 60 * 60_000,
    },
  ).catch(async (adjustedError) => {
    warnings.push(
      `Daily adjusted history was unavailable; falling back to compact daily history: ${errorMessage(
        adjustedError,
      )}`,
    );

    return fetchAlphaPayload(
      endpointParameters("TIME_SERIES_DAILY", {
        symbol,
        outputsize: "compact",
      }),
      {
        ttlMs: numberFromEnv(
          "ALPHA_VANTAGE_DAILY_CACHE_MS",
          CACHE_TTLS.daily,
        ),
        staleTtlMs: 24 * 60 * 60_000,
      },
    );
  });

  const settled = await Promise.allSettled([
    quotePromise,
    intradayPromise,
    marketStatusPromise,
    overviewPromise,
    newsPromise,
    dailyPromise,
  ]);
  const endpointNames = [
    "quote",
    "intraday",
    "marketStatus",
    "overview",
    "news",
    "daily",
  ] as const;
  const results: Partial<Record<(typeof endpointNames)[number], AlphaFetchResult>> = {};

  settled.forEach((result, index) => {
    const name = endpointNames[index];

    if (result.status === "fulfilled") {
      results[name] = result.value;
      cache[name] = result.value.cacheState;
    } else {
      cache[name] = "unavailable";
      errors[name] = errorMessage(result.reason);
    }
  });

  const quote = results.quote ? parseQuote(results.quote.payload) : null;
  const intraday = results.intraday
    ? parseIntraday(results.intraday.payload, interval)
    : null;
  const market = results.marketStatus
    ? parseMarketStatus(results.marketStatus.payload)
    : null;
  const overview = results.overview
    ? parseOverview(results.overview.payload)
    : null;
  const dailyBars = results.daily
    ? parseDailyBars(results.daily.payload)
    : [];
  const technicals = buildTechnicals(dailyBars, quote);
  const news = results.news
    ? parseNews(results.news.payload, symbol)
    : null;
  const providerAsOf =
    intraday?.lastRefreshed ??
    parseProviderTimestamp(
      quote?.latestTradingDay,
      DEFAULT_TIME_ZONE,
    ) ??
    news?.latestPublishedAt ??
    null;
  const freshness = buildFreshness({
    entitlement,
    providerAsOf,
    retrievedAt,
    market,
    interval,
    hasQuote: Boolean(quote),
  });

  for (const [name, state] of Object.entries(cache)) {
    if (state === "stale-cache") {
      warnings.push(
        `${name} is temporarily using the most recent cached Alpha Vantage response.`,
      );
    }
  }

  if (entitlement === null) {
    warnings.push(
      "ALPHA_VANTAGE_ENTITLEMENT is not set. Regulated US equity quote and intraday data must not be labeled real-time.",
    );
  }

  if (!intraday) {
    warnings.push(
      "Intraday bars were unavailable. Provider timing and session analytics are degraded.",
    );
  }

  if (!market) {
    warnings.push(
      "Alpha Vantage market-status data was unavailable. The UI cannot independently confirm whether the market is open.",
    );
  }

  const successfulEndpointCount = Object.values(cache).filter(
    (state) => state !== "unavailable",
  ).length;
  const endpointCount = endpointNames.length;
  const failedEndpointCount = endpointCount - successfulEndpointCount;
  const configured = Boolean(
    String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim(),
  );
  const ok = Boolean(quote) && configured;

  return {
    schemaVersion: "slice-alpha-intelligence-3.0.0",
    ok,
    symbol,
    provider: "Alpha Vantage",
    retrievedAt,
    updatedAt: retrievedAt,
    providerAsOf,
    providerTimeZone: intraday?.timeZone ?? DEFAULT_TIME_ZONE,
    entitlement,
    market,
    freshness,
    quote,
    intraday,
    overview,
    technicals,
    news,
    health: {
      configured,
      endpointCount,
      successfulEndpointCount,
      failedEndpointCount,
      degraded: failedEndpointCount > 0 || !freshness.isRealtime,
      recommendedPollMs,
      cache,
      errors,
      warnings: Array.from(new Set(warnings)),
    },
    ...(ok
      ? {}
      : {
          error:
            errors.quote ??
            "Alpha Vantage did not return a usable quote for this symbol.",
        }),
  };
}