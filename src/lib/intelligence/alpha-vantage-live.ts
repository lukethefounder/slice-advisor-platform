import { diversifyResearchNews, newsSnapshot, parseResearchNews, researchNewsTopics } from "./research-news";
import { normalizeResearchSymbol, resolveResearchInstrument, type ResearchInstrumentIdentity } from "./research-instrument";
import { indexBars } from "@/lib/market-evidence/index-data";
import type { ResearchWeights } from "./research-swarm-types";
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
  type AlphaNewsQueryDiagnostic,
  type AlphaNewsSnapshot,
  type AlphaProviderIssueCode,
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
  issue?: { code: AlphaProviderIssueCode; message: string };
};

type AlphaRequestOptions = {
  ttlMs: number;
  staleTtlMs?: number;
  timeoutMs?: number;
  forceRefresh?: boolean;
};

type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  rawClose?: number;
};

declare global {
  var __sliceAlphaCache: Map<string, CacheEntry> | undefined;
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
  if (!normalized) return fallback;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validObservationDay(value: unknown) {
  const day = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day && timestamp <= Date.now() ? day : null;
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
  return normalizeResearchSymbol(value);
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

class AlphaProviderError extends Error {
  constructor(readonly code: AlphaProviderIssueCode, message: string) {
    super(message);
    this.name = "AlphaProviderError";
  }
}

function providerFailure(message: string) {
  if (/rate.?limit|call frequency|requests? per|calls? per|API call volume|request limit/i.test(message)) {
    return new AlphaProviderError("rate_limited", "Alpha Vantage's request allowance was reached. No new evidence was returned by this query.");
  }
  if (/premium|entitlement|subscription|subscribe|access.+(?:denied|required)/i.test(message)) {
    return new AlphaProviderError("entitlement_required", "This Alpha Vantage endpoint requires an enabled data entitlement or subscription.");
  }
  return new AlphaProviderError("provider_error", "Alpha Vantage rejected this query or did not make the requested data available.");
}

function providerIssue(error: unknown): { code: AlphaProviderIssueCode; message: string } {
  if (error instanceof AlphaProviderError) return { code: error.code, message: error.message };
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return { code: "timeout", message: "The provider did not finish this request within its transport safety limit." };
  }
  return { code: "transport_error", message: "The provider request could not be completed. It supplied no new evidence." };
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
    throw new AlphaProviderError("not_configured", "ALPHA_VANTAGE_API_KEY is not configured.");
  }

  const query = {
    ...parameters,
    apikey: apiKey,
  };
  const cacheKey = stableQueryKey(query);
  const now = Date.now();
  const cached = responseCache.get(cacheKey);

  if (!options.forceRefresh && cached && now - cached.storedAt <= options.ttlMs) {
    return {
      payload: cached.payload,
      cacheState: "fresh-cache",
      fetchedAt: new Date(cached.storedAt).toISOString(),
    };
  }

  // The shared flight contains only the network result. Each caller decides whether
  // a failure may fall back to cache, so a forced refresh never inherits stale data.
  let request = inFlight.get(cacheKey);
  if (!request) {
    request = (async () => {
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
        throw new AlphaProviderError(
          response.status === 429 ? "rate_limited" : response.status === 402 || response.status === 403 ? "entitlement_required" : "transport_error",
          `Alpha Vantage ${parameters.function ?? "request"} returned HTTP ${response.status}.`,
        );
      }

      let raw: unknown;
      try { raw = await response.json(); }
      catch { throw new AlphaProviderError("invalid_response", "Alpha Vantage returned an unreadable JSON response."); }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new AlphaProviderError("invalid_response", "Alpha Vantage returned an invalid response structure.");
      }
      const payload = raw as AlphaPayload;
      const providerError = readProviderError(payload);

      if (providerError) {
        throw providerFailure(providerError);
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
    } finally {
      clearTimeout(timeout);
    }
    })();
    inFlight.set(cacheKey, request);
    const flight = request;
    const finish = () => { if (inFlight.get(cacheKey) === flight) inFlight.delete(cacheKey); };
    void request.then(finish, finish);
  }
  try { return await request; }
  catch (error) {
    const staleTtlMs = options.staleTtlMs ?? options.ttlMs * STALE_MULTIPLIER;
    if (!options.forceRefresh && cached && Date.now() - cached.storedAt <= staleTtlMs) {
      return {
        payload: cached.payload,
        cacheState: "stale-cache",
        fetchedAt: new Date(cached.storedAt).toISOString(),
        issue: providerIssue(error),
      };
    }
    throw error;
  }
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

function parseQuote(payload: AlphaPayload, expectedSymbol: string): AlphaQuoteSnapshot | null {
  const quote = (payload["Global Quote"] ?? {}) as Record<string, unknown>;
  const price = toNumber(quote["05. price"]);

  if (price <= 0 || cleanString(quote["01. symbol"]).toUpperCase() !== expectedSymbol) {
    return null;
  }

  const observedPreviousClose = nullableNumber(quote["08. previous close"]);
  const comparisonAvailable = observedPreviousClose !== null && observedPreviousClose > 0;
  const previousClose = comparisonAvailable ? observedPreviousClose : price;
  const change = comparisonAvailable ? toNumber(
    quote["09. change"],
    price - previousClose,
  ) : 0;
  const changePercent = comparisonAvailable ? toNumber(
    String(quote["10. change percent"] ?? "").replace("%", ""),
    previousClose ? (change / previousClose) * 100 : 0,
  ) : 0;
  const volume = nullableNumber(quote["06. volume"]);

  return {
    price,
    open: toNumber(quote["02. open"], price),
    high: toNumber(quote["03. high"], price),
    low: toNumber(quote["04. low"], price),
    previousClose,
    change,
    changePercent,
    volume: volume !== null && volume >= 0 ? volume : null,
    latestTradingDay: validObservationDay(quote["07. latest trading day"]),
    observedAt: validObservationDay(quote["07. latest trading day"]),
    sourceKind: "global-quote",
    interval: null,
    volumeScope: "daily",
    comparisonSource: comparisonAvailable ? "global-quote-previous-close" : null,
    comparisonAsOf: null,
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
  if (!["open", "closed"].includes(currentStatus.toLowerCase())) return null;

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
  expectedSymbol: string,
): AlphaIntradaySnapshot | null {
  const meta = (payload["Meta Data"] ?? {}) as Record<string, unknown>;
  if (cleanString(meta["2. Symbol"]).toUpperCase() !== expectedSymbol) return null;
  const timeZone = normalizeProviderTimeZone(
    cleanString(meta["6. Time Zone"] ?? meta["5. Time Zone"], 100),
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

  const bars: AlphaIntradayBar[] = keys.slice(0, 100).flatMap((key) => {
    const timestamp = parseProviderTimestamp(key, timeZone);
    const open = toNumber(series[key]?.["1. open"]);
    const high = toNumber(series[key]?.["2. high"]);
    const low = toNumber(series[key]?.["3. low"]);
    const close = toNumber(series[key]?.["4. close"]);
    const volume = nullableNumber(series[key]?.["5. volume"]);
    if (!timestamp || Date.parse(timestamp) > Date.now() || [open, high, low, close].some(value => value <= 0) || high < Math.max(open, close, low) || low > Math.min(open, close, high) || volume === null || volume < 0) return [];
    return [{ timestamp, providerTimestamp: key, open, high, low, close, volume }];
  });
  if (!bars.length) return null;
  const latestProviderDate = bars[0]?.providerTimestamp.slice(0, 10) ?? null;
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
    lastRefreshed: bars[0]?.timestamp ?? null,
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

function parseDailyBars(payload: AlphaPayload, expectedSymbol: string) {
  const meta = (payload["Meta Data"] ?? {}) as Record<string, unknown>;
  if (cleanString(meta["2. Symbol"]).toUpperCase() !== expectedSymbol) return [];
  const series = (
    payload["Time Series (Daily)"] ??
    payload["Time Series (Daily Adjusted)"] ??
    {}
  ) as Record<string, Record<string, unknown>>;

  return Object.keys(series)
    .sort((left, right) => right.localeCompare(left))
    .flatMap<DailyBar>((date) => {
      const rawClose = nullableNumber(series[date]?.["4. close"]);
      const open = nullableNumber(series[date]?.["1. open"]), high = nullableNumber(series[date]?.["2. high"]), low = nullableNumber(series[date]?.["3. low"]);
      if (!validObservationDay(date) || rawClose === null || rawClose <= 0 || open === null || high === null || low === null || open <= 0 || low <= 0 || high < Math.max(open, rawClose, low) || low > Math.min(open, rawClose, high)) return [];
      const adjusted = nullableNumber(series[date]?.["5. adjusted close"]), close = adjusted !== null && adjusted > 0 ? adjusted : rawClose;
      const ratio = close / rawClose;
      const volume = nullableNumber(series[date]?.["6. volume"] ?? series[date]?.["5. volume"]);
      // Keep indicator OHLC on one adjusted basis. Prior-session comparisons
      // with as-traded intraday bars use the separately retained raw close.
      return [{ date, open: open * ratio, high: high * ratio, low: low * ratio, close, rawClose, volume: volume !== null && volume >= 0 ? volume : null }];
    });
}

function observedComposite(parts: Array<{ value: number | null; weight: number }>) {
  const observed = parts.filter((part): part is { value: number; weight: number } => part.value !== null && Number.isFinite(part.value));
  const weight = observed.reduce((sum, part) => sum + part.weight, 0);
  return { score: weight ? clamp(observed.reduce((sum, part) => sum + part.value * part.weight, 0) / weight) : null, coverage: weight };
}

/** A bar is a dated research observation, not an executable broker bid/ask. */
function selectIntradayReference(input: {
  quote: AlphaQuoteSnapshot | null; intraday: AlphaIntradaySnapshot | null; daily: DailyBar[];
  market: AlphaMarketStatus | null; entitlement: AlphaEntitlement;
}): AlphaQuoteSnapshot | null {
  const bar = input.intraday?.bars[0];
  if (!bar || !input.intraday) return input.quote;
  const day = bar.providerTimestamp.slice(0, 10), age = Date.now() - Date.parse(bar.timestamp);
  if (!Number.isFinite(age) || age < 0 || (input.quote?.latestTradingDay && input.quote.latestTradingDay > day)) return input.quote;
  // A same-day daily quote can include the close after a partial intraday
  // window. Without its precise time, do not replace it with an earlier bar
  // merely because the market is now closed.
  if (input.market?.isOpen === false && input.quote?.latestTradingDay === day) return input.quote;
  const maximumAge = input.market?.isOpen === false ? 4 * 86_400_000 : input.entitlement === "delayed" ? 35 * 60_000 : 15 * 60_000;
  if (age > maximumAge) return input.quote;
  const prior = input.daily.find(row => row.date < day && Date.parse(day) - Date.parse(row.date) <= 7 * 86_400_000);
  let previousClose = prior?.rawClose ?? prior?.close ?? null;
  let comparisonAsOf: string | null = prior?.date ?? null;
  let comparisonSource: AlphaQuoteSnapshot["comparisonSource"] = prior ? "daily-history-close" : null;
  if (previousClose === null && input.quote?.latestTradingDay && input.quote.latestTradingDay < day && Date.parse(day) - Date.parse(input.quote.latestTradingDay) <= 7 * 86_400_000) {
    previousClose = input.quote.price; comparisonAsOf = input.quote.latestTradingDay; comparisonSource = "global-quote-close";
  } else if (previousClose === null && input.quote?.latestTradingDay === day && input.quote.comparisonSource === "global-quote-previous-close") {
    previousClose = input.quote.previousClose; comparisonSource = "global-quote-previous-close";
  }
  // Keep a verified current bar usable when a comparison is unavailable. The
  // legacy numeric fields are explicit neutral sentinels, never return evidence.
  if (previousClose === null || previousClose <= 0) {
    previousClose = bar.close; comparisonSource = null; comparisonAsOf = null;
  }
  return { price: bar.close, open: bar.open, high: bar.high, low: bar.low, volume: bar.volume,
    previousClose, change: bar.close - previousClose, changePercent: (bar.close / previousClose - 1) * 100,
    latestTradingDay: day, observedAt: bar.timestamp, sourceKind: "intraday-bar", interval: input.intraday.interval,
    volumeScope: "bar", comparisonAsOf, comparisonSource };
}

function buildTechnicals(
  bars: DailyBar[],
  quote: AlphaQuoteSnapshot | null,
): AlphaTechnicalSnapshot | null {
  if (!bars.length && !quote) {
    return null;
  }

  const closes = bars.map((bar) => bar.close);
  const volumeWindow = bars.slice(0, 20);
  const volumes = volumeWindow.map((bar) => bar.volume).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
  const latestPrice = quote?.price ?? closes[0] ?? 0;
  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const sma200Value = sma(closes, 200);
  const rsi14Value = rsi(closes, 14);
  const logReturns = closes.slice(0, 20).flatMap((close, index) => {
    const prior = closes[index + 1];
    return prior && close > 0 && prior > 0 ? [Math.log(close / prior)] : [];
  });
  const volatility20Daily = logReturns.length >= 20
    ? standardDeviation(logReturns) * 100
    : null;
  const volatility20Annualized = volatility20Daily !== null ? volatility20Daily * Math.sqrt(252) : null;
  const momentum30 = closes[30] ? ((latestPrice - closes[30]) / closes[30]) * 100 : null;
  const sixtyDayHigh = bars.length >= 60 ? Math.max(...bars.slice(0, 60).map(bar => bar.high)) : null;
  const drawdown = sixtyDayHigh ? ((latestPrice - sixtyDayHigh) / sixtyDayHigh) * 100 : null;
  const atr14 = averageTrueRange(bars, 14);
  const recentVolume = volumes.length >= 20 ? average(volumes.slice(0, 5)) : null;
  const baselineVolume = volumes.length >= 20 ? average(volumes.slice(5, 20)) : null;
  const volumeTrendPercent = recentVolume !== null && baselineVolume !== null && baselineVolume > 0
    ? (recentVolume / baselineVolume - 1) * 100 : null;

  // Missing lookbacks are omitted, never treated as failed averages, zero
  // volatility, or an observed neutral volume measurement. Full-input formulas
  // retain their prior weights; partial composites use only actual components.
  const trend = observedComposite([
    ...[sma20Value, sma50Value, sma200Value].map(value => ({ value: value === null ? null : latestPrice > value ? 100 : 100 / 3, weight: 0.24 })),
    { value: momentum30 === null ? null : higherIsBetter(momentum30, -20, 30), weight: 0.28 },
  ]);
  const momentum = momentum30 === null && rsi14Value === null ? { score: null, coverage: 0 } : observedComposite([
    { value: momentum30 === null ? null : higherIsBetter(momentum30, -20, 35), weight: 0.55 },
    { value: rsi14Value === null ? null : higherIsBetter(rsi14Value, 30, 70), weight: 0.30 },
    { value: quote === null || quote.comparisonSource === null ? null : higherIsBetter(quote.changePercent, -6, 6), weight: 0.15 },
  ]);
  const risk = observedComposite([
    { value: volatility20Annualized === null ? null : lowerIsBetter(volatility20Annualized, 10, 80), weight: 0.50 },
    { value: drawdown === null ? null : lowerIsBetter(Math.abs(drawdown), 0, 45), weight: 0.35 },
    { value: atr14 === null || !latestPrice ? null : lowerIsBetter((atr14 / latestPrice) * 100, 0.5, 8), weight: 0.15 },
  ]);
  const trendScore = trend.score, momentumScore = momentum.score, riskScore = risk.score;
  const volumeScore = volumeTrendPercent === null ? null : higherIsBetter(volumeTrendPercent, -50, 100);
  const trendLabel = trendScore === null ? "trend unavailable" : trendScore >= 67 ? "bullish trend" : trendScore <= 33 ? "bearish trend" : "mixed trend";
  const momentumLabel = momentumScore === null ? "momentum unavailable" : momentumScore >= 67 ? "strong momentum" : momentumScore <= 33 ? "weak momentum" : "balanced momentum";
  const roundedScore = (value: number | null) => value === null ? null : Math.round(value);

  return {
    historyPointCount: bars.length,
    historyAsOf: bars[0]?.date ?? null,
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
    trendScore: roundedScore(trendScore),
    momentumScore: roundedScore(momentumScore),
    riskScore: roundedScore(riskScore),
    volumeScore: roundedScore(volumeScore),
    componentCoverage: { trend: trend.coverage, momentum: momentum.coverage, risk: risk.coverage, volume: volumeScore === null ? 0 : 1 },
    technicalSummary: `${trendLabel}; ${momentumLabel}; risk-quality ${riskScore === null ? "unavailable" : `${Math.round(riskScore)}/100`}. Missing lookbacks do not supply scored factors.`,
  };
}

function parseOverview(payload: AlphaPayload, expectedSymbol: string): AlphaCompanyOverview | null {
  const name = cleanString(payload.Name, 300);

  if ((!name && !payload.Symbol) || cleanString(payload.Symbol).toUpperCase() !== expectedSymbol) {
    return null;
  }

  return {
    name,
    description: cleanString(payload.Description, 8_000),
    exchange: cleanString(payload.Exchange, 100),
    currency: cleanString(payload.Currency, 20) || "Unknown",
    country: cleanString(payload.Country, 100),
    sector: cleanString(payload.Sector, 200),
    industry: cleanString(payload.Industry, 300),
    marketCap: nullableNumber(payload.MarketCapitalization),
    peRatio: nullableNumber(payload.PERatio),
    pegRatio: nullableNumber(payload.PEGRatio),
    bookValue: nullableNumber(payload.BookValue),
    dividendYield: nullableNumber(payload.DividendYield),
    eps: nullableNumber(payload.EPS),
    profitMargin: nullableNumber(payload.ProfitMargin),
    operatingMargin: nullableNumber(payload.OperatingMarginTTM),
    returnOnAssets: nullableNumber(payload.ReturnOnAssetsTTM),
    returnOnEquity: nullableNumber(payload.ReturnOnEquityTTM),
    quarterlyRevenueGrowthYOY: nullableNumber(payload.QuarterlyRevenueGrowthYOY),
    quarterlyEarningsGrowthYOY: nullableNumber(payload.QuarterlyEarningsGrowthYOY),
    analystTargetPrice: nullableNumber(payload.AnalystTargetPrice),
    beta: nullableNumber(payload.Beta),
    week52High: nullableNumber(payload["52WeekHigh"]),
    week52Low: nullableNumber(payload["52WeekLow"]),
    movingAverage50Day: nullableNumber(payload["50DayMovingAverage"]),
    movingAverage200Day: nullableNumber(payload["200DayMovingAverage"]),
    sharesOutstanding: nullableNumber(payload.SharesOutstanding),
    latestQuarter: cleanString(payload.LatestQuarter, 20) || null,
  };
}

function buildFreshness(input: {
  entitlement: AlphaEntitlement;
  providerAsOf: string | null;
  retrievedAt: string;
  market: AlphaMarketStatus | null;
  interval: AlphaIntradayInterval;
  hasQuote: boolean;
  sourceKind?: AlphaQuoteSnapshot["sourceKind"];
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

  if (!input.hasQuote || ageSeconds === null) {
    mode = "unavailable";
  } else if (input.sourceKind === "native-index-daily" || input.sourceKind === "global-quote") {
    mode = ageSeconds <= 7 * 24 * 60 * 60 ? "end_of_day" : "stale";
    label = mode === "stale" ? "Stale daily observation" : input.sourceKind === "native-index-daily" ? "Native index · completed daily level" : "Daily quote · provider trading date";
    explanation = input.sourceKind === "native-index-daily"
      ? "This price is a completed daily native index level in index points. Its provider date is preserved; it is not an intraday or ETF quote."
      : "GLOBAL_QUOTE provides this price with a trading date. A separate intraday timestamp cannot establish when this particular price was observed.";
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
    label = `Fresh ${input.interval} bar close · real-time entitlement`;
    explanation =
      "The request used entitlement=realtime and this intraday bar close has its own timestamp within the configured freshness window. It is a research reference, not an executable bid/ask quote; its OHLCV describes that bar.";
  } else if (
    input.entitlement === "delayed" &&
    ageSeconds !== null &&
    ageSeconds <= 35 * 60
  ) {
    mode = "delayed";
    label = `${input.interval} bar close · 15-minute delayed entitlement`;
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

function researchNewsWindow(now = Date.now()) {
  const configuredAge = Number(process.env.INTELLIGENCE_NEWS_MAX_AGE_HOURS ?? 168);
  const maxAgeHours = Number.isFinite(configuredAge) ? Math.max(1, Math.min(168, configuredAge)) : 168;
  const timeFrom = new Date(now - maxAgeHours * 3_600_000).toISOString().slice(0, 16).replace(/[-:]/g, "");
  return { maxAgeHours, timeFrom };
}

function newsParameters(instrument: ResearchInstrumentIdentity, timeFrom: string, topic?: string) {
  return endpointParameters("NEWS_SENTIMENT", {
    ...(instrument.kind === "equity" ? { tickers: instrument.providerSymbol ?? instrument.symbol } : {}),
    ...(topic ? { topics: topic } : instrument.kind === "index" ? { topics: "financial_markets" } : {}),
    sort: topic ? "RELEVANCE" : "LATEST",
    limit: "250",
    time_from: timeFrom,
  });
}

function newsRequestOptions(forceRefresh = false): AlphaRequestOptions {
  return { ttlMs: numberFromEnv("ALPHA_VANTAGE_NEWS_CACHE_MS", CACHE_TTLS.news), staleTtlMs: 15 * 60_000, timeoutMs: 10_000, forceRefresh };
}

function parsedNewsResult(response: AlphaFetchResult, instrument: ResearchInstrumentIdentity, query: string, maxAgeHours: number) {
  const parsed = parseResearchNews(response.payload, instrument.symbol, 250, instrument);
  const items = diversifyResearchNews(parsed?.items ?? [], 250, Date.now(), maxAgeHours)
    .map(item => ({ ...item, retrievedAt: response.fetchedAt }));
  const snapshot = newsSnapshot(items);
  const news: AlphaNewsSnapshot | null = snapshot ? { ...snapshot, retrievedAt: response.fetchedAt } : null;
  const validFeed = Array.isArray(response.payload.feed);
  const returnedItems = validFeed ? (response.payload.feed as unknown[]).length : 0;
  const diagnostic: AlphaNewsQueryDiagnostic = {
    query,
    status: response.issue?.code ?? (!validFeed ? "invalid_response" : items.length ? "ready" : "empty"),
    message: response.issue?.message ?? (!validFeed
      ? "Alpha Vantage returned no readable news feed for this query."
      : items.length
        ? `${items.length} matching, dated articles are within the last ${maxAgeHours} hours.`
        : returnedItems
          ? `The provider returned ${returnedItems} items, but none passed instrument, source, and publication-date checks for the last ${maxAgeHours} hours.`
          : `The provider returned no articles for this query within the last ${maxAgeHours} hours.`),
    cacheState: response.cacheState,
    retrievedAt: response.fetchedAt,
    returnedItems,
    acceptedItems: items.length,
  };
  return { news, diagnostic };
}

function failedNewsDiagnostic(query: string, error: unknown): AlphaNewsQueryDiagnostic {
  const issue = providerIssue(error);
  return { query, status: issue.code, message: issue.message, cacheState: "unavailable", retrievedAt: null, returnedItems: 0, acceptedItems: 0 };
}

function latestCollectionTime(times: Array<string | null | undefined>) {
  return times.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!)) && Date.parse(value!) <= Date.now())
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

/** A recent, unrestricted ticker query precedes bounded, ticker-qualified topic expansion. */
export async function getExpandedAlphaResearchNews(input: {
  symbol: string;
  sector: string;
  weights: ResearchWeights;
  existing: AlphaNewsSnapshot | null;
  forceRefresh?: boolean;
  initialDiagnostics?: AlphaNewsQueryDiagnostic[];
}) {
  const instrument = resolveResearchInstrument(input.symbol);
  const configuredLimit = Number(process.env.INTELLIGENCE_RESEARCH_NEWS_QUERY_LIMIT ?? 3);
  const queryLimit = Number.isFinite(configuredLimit) ? Math.max(0, Math.min(6, Math.round(configuredLimit))) : 3;
  const { maxAgeHours, timeFrom } = researchNewsWindow();
  const items: AlphaNewsItem[] = [...(input.existing?.items ?? [])];
  const warnings: string[] = [];
  const diagnostics: AlphaNewsQueryDiagnostic[] = [...(input.initialDiagnostics ?? [])];
  const latestQuery = instrument.kind === "index" ? "index-context-latest" : "ticker-latest";

  if (!diagnostics.some(item => item.query === latestQuery)) {
    try {
      if (!instrument.providerSymbol) throw new AlphaProviderError("unsupported", "This index alias has no verified native provider mapping. Choose an explicit INDEX: identifier; no stock or ETF was substituted.");
      const response = await fetchAlphaPayload(newsParameters(instrument, timeFrom), newsRequestOptions(input.forceRefresh));
      const result = parsedNewsResult(response, instrument, latestQuery, maxAgeHours);
      diagnostics.push(result.diagnostic);
      items.push(...(result.news?.items ?? []));
    } catch (error) { diagnostics.push(failedNewsDiagnostic(latestQuery, error)); }
  }

  const blocked = () => diagnostics.some(item => ["rate_limited", "entitlement_required", "not_configured", "unsupported"].includes(item.status));
  const topics = blocked() ? [] : researchNewsTopics(input.sector, input.weights, queryLimit)
    .filter(topic => instrument.kind !== "index" || topic !== "financial_markets");
  const requestedTopics: string[] = [];
  // Two requests at a time. Shared network flights coalesce across research runs.
  for (let start = 0; start < topics.length && !blocked(); start += 2) {
    const batch = topics.slice(start, start + 2);
    requestedTopics.push(...batch);
    const settled = await Promise.allSettled(batch.map(async topic => {
      const response = await fetchAlphaPayload(newsParameters(instrument, timeFrom, topic), newsRequestOptions(input.forceRefresh));
      return parsedNewsResult(response, instrument, `topic:${topic}`, maxAgeHours);
    }));
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        diagnostics.push(result.value.diagnostic);
        items.push(...(result.value.news?.items ?? []));
      } else diagnostics.push(failedNewsDiagnostic(`topic:${batch[index]}`, result.reason));
    });
  }
  for (const diagnostic of diagnostics) {
    if (diagnostic.status !== "ready") warnings.push(`${diagnostic.query}: ${diagnostic.message}`);
    if (diagnostic.cacheState === "stale-cache") warnings.push(`${diagnostic.query} retained its original cached collection time; it was not counted as newly retrieved evidence.`);
  }
  const distinct = diversifyResearchNews(items, 500, Date.now(), maxAgeHours);
  const snapshot = newsSnapshot(distinct);
  const retrievedAt = latestCollectionTime([input.existing?.retrievedAt, ...diagnostics.map(item => item.retrievedAt)]);
  const news = snapshot ? { ...snapshot, ...(retrievedAt ? { retrievedAt } : {}) } : null;
  return {
    news,
    requestedQueries: diagnostics.length,
    completedQueries: diagnostics.filter(item => item.status === "ready" || item.status === "empty").length,
    topics: requestedTopics,
    diagnostics,
    warnings: [...new Set(warnings)],
  };
}

export async function getAlphaVantageIntelligence(input: {
  symbol: string;
  interval?: string | null;
  forceRefresh?: boolean;
  /** Refresh only bar/session observations; reuse dated currency context. */
  executionOnly?: boolean;
}): Promise<AlphaVantageIntelligenceResponse> {
  const instrument = resolveResearchInstrument(input.symbol);
  const symbol = instrument.symbol;
  const interval = normalizeIntradayInterval(input.interval);
  const entitlement = getEntitlement();
  const recommendedPollMs = numberFromEnv("ALPHA_VANTAGE_RECOMMENDED_POLL_MS", 30_000);
  const cache: Record<string, AlphaCacheState> = {};
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const failures: Record<string, unknown> = {};
  const endpointRetrievedAt: Record<string, string> = {};
  const { maxAgeHours, timeFrom } = researchNewsWindow();
  const options = (ttlMs: number, staleTtlMs?: number): AlphaRequestOptions => ({ ttlMs, ...(staleTtlMs === undefined ? {} : { staleTtlMs }), forceRefresh: input.forceRefresh });
  const tasks: Array<{ name: string; promise: Promise<AlphaFetchResult> }> = [];
  const add = (name: string, parameters: Record<string, string>, requestOptions: AlphaRequestOptions) => tasks.push({ name, promise: fetchAlphaPayload(parameters, requestOptions) });

  if (input.executionOnly) {
    if (instrument.kind !== "equity" || !instrument.providerSymbol) {
      tasks.push({ name: "index", promise: Promise.reject(new AlphaProviderError("unsupported", "Native indices are research-only and have no stock execution reference. No stock or ETF was substituted.")) });
    } else {
      add("intraday", endpointParameters("TIME_SERIES_INTRADAY", { symbol, interval, outputsize: "compact", adjusted: "false", extended_hours: "true" }, true), { ttlMs: CACHE_TTLS.intraday, forceRefresh: true });
      add("marketStatus", endpointParameters("MARKET_STATUS"), { ttlMs: CACHE_TTLS.marketStatus, forceRefresh: true });
      const currencyTtl = numberFromEnv("ALPHA_VANTAGE_OVERVIEW_CACHE_MS", CACHE_TTLS.overview);
      add("overview", endpointParameters("OVERVIEW", { symbol }), { ttlMs: currencyTtl, staleTtlMs: currencyTtl, forceRefresh: false });
    }
  } else if (!instrument.providerSymbol) {
    const error = new AlphaProviderError("unsupported", "This index alias has no verified native provider mapping. Use an explicit INDEX: identifier such as INDEX:SPX. No stock or ETF was substituted.");
    tasks.push({ name: "index", promise: Promise.reject(error) }, { name: "news", promise: Promise.reject(error) });
  } else {
    if (instrument.kind === "index") {
      add("index", endpointParameters("INDEX_DATA", { symbol: instrument.providerSymbol, interval: "daily" }), options(numberFromEnv("ALPHA_VANTAGE_DAILY_CACHE_MS", CACHE_TTLS.daily), 24 * 60 * 60_000));
    } else {
      add("quote", endpointParameters("GLOBAL_QUOTE", { symbol }, true), options(numberFromEnv("ALPHA_VANTAGE_QUOTE_CACHE_MS", CACHE_TTLS.quote)));
      add("intraday", endpointParameters("TIME_SERIES_INTRADAY", { symbol, interval, outputsize: "compact", adjusted: "false", extended_hours: "true" }, true), options(numberFromEnv("ALPHA_VANTAGE_INTRADAY_CACHE_MS", CACHE_TTLS.intraday)));
      add("overview", endpointParameters("OVERVIEW", { symbol }), options(numberFromEnv("ALPHA_VANTAGE_OVERVIEW_CACHE_MS", CACHE_TTLS.overview)));
      const dailyPromise = fetchAlphaPayload(endpointParameters("TIME_SERIES_DAILY_ADJUSTED", { symbol, outputsize: "full" }, true), options(numberFromEnv("ALPHA_VANTAGE_DAILY_CACHE_MS", CACHE_TTLS.daily), 24 * 60 * 60_000))
        .catch(error => {
          const issue = providerIssue(error);
          if (issue.code === "rate_limited" || issue.code === "not_configured") throw error;
          warnings.push(`Adjusted daily history was unavailable; trying compact daily history. ${issue.message}`);
          return fetchAlphaPayload(endpointParameters("TIME_SERIES_DAILY", { symbol, outputsize: "compact" }), options(numberFromEnv("ALPHA_VANTAGE_DAILY_CACHE_MS", CACHE_TTLS.daily), 24 * 60 * 60_000));
        });
      tasks.push({ name: "daily", promise: dailyPromise });
    }
    add("marketStatus", endpointParameters("MARKET_STATUS"), options(numberFromEnv("ALPHA_VANTAGE_MARKET_STATUS_CACHE_MS", CACHE_TTLS.marketStatus)));
    add("news", newsParameters(instrument, timeFrom), newsRequestOptions(input.forceRefresh));
  }

  const settled = await Promise.allSettled(tasks.map(task => task.promise));
  const results: Record<string, AlphaFetchResult | undefined> = {};
  settled.forEach((result, index) => {
    const name = tasks[index].name;
    if (result.status === "fulfilled") {
      results[name] = result.value;
      cache[name] = result.value.cacheState;
      endpointRetrievedAt[name] = result.value.fetchedAt;
      if (result.value.issue) warnings.push(`${name}: ${result.value.issue.message}`);
    } else {
      cache[name] = "unavailable";
      failures[name] = result.reason;
      errors[name] = providerIssue(result.reason).message;
    }
  });

  const dailyQuote = results.quote ? parseQuote(results.quote.payload, symbol) : null;
  let quote = dailyQuote;
  let dailyBars: DailyBar[] = results.daily ? parseDailyBars(results.daily.payload, symbol) : [];
  if (results.index) {
    try {
      const observedBars = indexBars(results.index.payload, symbol);
      dailyBars = observedBars.map(bar => ({ date: bar.at, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: null })).reverse();
      const latest = dailyBars[0], previous = dailyBars[1];
      quote = {
        price: latest.close, open: latest.open, high: latest.high, low: latest.low,
        previousClose: previous.close, change: latest.close - previous.close,
        changePercent: (latest.close / previous.close - 1) * 100, volume: null,
        latestTradingDay: latest.date, observedAt: latest.date, sourceKind: "native-index-daily",
        interval: null, comparisonSource: "native-index-prior-close", comparisonAsOf: previous.date,
      };
    } catch {
      errors.index = "INDEX_DATA did not return verified, valid completed daily observations for this index. No equity or ETF data was substituted.";
      cache.index = "unavailable";
      dailyBars = [];
    }
  }
  const intraday = results.intraday ? parseIntraday(results.intraday.payload, interval, symbol) : null;
  const market = results.marketStatus ? parseMarketStatus(results.marketStatus.payload) : null;
  const overview = results.overview ? parseOverview(results.overview.payload, symbol) : null;
  if (instrument.kind === "equity") quote = selectIntradayReference({ quote: dailyQuote, intraday, daily: dailyBars, market, entitlement });
  if (results.quote && !dailyQuote) errors.quote = "GLOBAL_QUOTE returned no valid price with the requested instrument identity.";
  if (results.intraday && !intraday) errors.intraday = "No matching, valid timestamped intraday bars were returned.";
  if (results.daily && !dailyBars.length) errors.daily = "No usable dated daily history was returned.";
  if (results.overview && !overview) errors.overview = "No company overview was returned for this instrument.";
  if (results.marketStatus && !market) errors.marketStatus = "No market-session status was returned.";
  const technicals = buildTechnicals(dailyBars, quote);
  const latestQuery = instrument.kind === "index" ? "index-context-latest" : "ticker-latest";
  const newsResult = input.executionOnly ? null : results.news ? parsedNewsResult(results.news, instrument, latestQuery, maxAgeHours) : { news: null, diagnostic: failedNewsDiagnostic(latestQuery, failures.news) };
  const news = newsResult?.news ?? null;
  if (newsResult && newsResult.diagnostic.status !== "ready") errors.news = newsResult.diagnostic.message;
  // Freshness belongs to the selected price itself. A selected intraday bar
  // carries its own price/OHLCV and timestamp; daily quote dates remain unchanged.
  const providerAsOf = quote?.observedAt ?? null;
  const retrievedAt = new Date().toISOString();
  const freshness = buildFreshness({ entitlement, providerAsOf, retrievedAt, market, interval, hasQuote: Boolean(quote), sourceKind: quote?.sourceKind });

  for (const [name, state] of Object.entries(cache)) {
    if (state === "stale-cache") warnings.push(`${name} retained an earlier cached provider response and its original collection time.`);
  }
  if (instrument.kind === "index") {
    warnings.push("Native indices use completed daily index points. Intraday prices, company fundamentals, and trading volume are not inferred from an ETF.");
  } else {
    if (entitlement === null) warnings.push("ALPHA_VANTAGE_ENTITLEMENT is not set. Regulated US equity data must not be labeled real-time.");
    if (!intraday) warnings.push("Intraday bars were unavailable. Short-horizon interpretations require fresh intraday observations.");
  }
  if (!market) warnings.push("Market-status data was unavailable, so the current trading-session status could not be independently confirmed.");
  if (quote?.comparisonSource === null) warnings.push("The reference price has no verified prior-session comparison. Neutral change fields are model sentinels and are excluded from return evidence.");
  const endpointCount = tasks.length;
  const successfulEndpointCount = tasks.filter(task => cache[task.name] !== "unavailable" && !errors[task.name]).length;
  const failedEndpointCount = endpointCount - successfulEndpointCount;
  const configured = Boolean(String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim());
  const ok = Boolean(quote) && configured;
  return {
    schemaVersion: "slice-alpha-intelligence-3.0.0", ok, symbol, instrument, provider: "Alpha Vantage",
    retrievedAt, updatedAt: retrievedAt, providerAsOf, providerTimeZone: DEFAULT_TIME_ZONE,
    entitlement, market, freshness, quote, intraday, overview, technicals, news,
    health: {
      configured, endpointCount, successfulEndpointCount, failedEndpointCount,
      degraded: failedEndpointCount > 0 || !freshness.isRealtime, recommendedPollMs,
      cache, errors, warnings: [...new Set(warnings)], newsDiagnostics: newsResult ? [newsResult.diagnostic] : [], retrievedAt: endpointRetrievedAt,
    },
    ...(ok ? {} : { error: errors.index ?? errors.quote ?? "Alpha Vantage did not return a usable observation for this instrument." }),
  };
}
