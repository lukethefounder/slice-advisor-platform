import type {
  RealtimeAssetSnapshot,
  RealtimeMarketResponse,
  TechnicalSnapshot,
} from "@/lib/realtime-market";

const ALPHA_URL = "https://www.alphavantage.co/query";
const DEFAULT_POLL_MS = 30_000;
const DEFAULT_HISTORY_CACHE_MS = 15 * 60_000;
const DEFAULT_TECHNICAL_LIMIT = 25;

const CRYPTO_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "LINK",
  "DOT",
  "UNI",
  "MATIC",
  "BNB",
  "LTC",
  "BCH",
  "ATOM",
  "XLM",
  "ETC",
  "FIL",
  "APT",
  "ARB",
  "OP",
  "SUI",
  "NEAR",
]);

type AlphaPayload = Record<string, unknown> & {
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type ProviderResult = {
  snapshots: RealtimeAssetSnapshot[];
  warnings: string[];
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const bulkCache = new Map<string, CacheEntry<ProviderResult>>();
const technicalCache = new Map<string, CacheEntry<TechnicalSnapshot>>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function normalizeSymbol(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 20);
}

export function normalizeAlphaVantageSymbols(input?: string | string[] | null) {
  const raw = Array.isArray(input) ? input.join(",") : input || "";

  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/g)
        .map(normalizeSymbol)
        .filter(Boolean)
    )
  ).slice(0, 100);
}

function getEntitlement() {
  const value = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  return value === "realtime" || value === "delayed" ? value : null;
}

function pollAfterMs() {
  const value = Number(process.env.NEXT_PUBLIC_SLICE_REALTIME_POLL_MS);

  return Number.isFinite(value)
    ? clamp(Math.round(value), 15_000, 120_000)
    : DEFAULT_POLL_MS;
}

function historyCacheMs() {
  const value = Number(process.env.ALPHA_VANTAGE_HISTORY_CACHE_MS);

  return Number.isFinite(value)
    ? clamp(Math.round(value), 60_000, 60 * 60_000)
    : DEFAULT_HISTORY_CACHE_MS;
}

function technicalLimit() {
  const value = Number(process.env.ALPHA_VANTAGE_TECHNICAL_LIMIT);

  return Number.isFinite(value)
    ? clamp(Math.round(value), 0, 100)
    : DEFAULT_TECHNICAL_LIMIT;
}

function providerError(payload: AlphaPayload) {
  return payload["Error Message"] || payload.Information || payload.Note || null;
}

async function alphaRequest(
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = 15_000
): Promise<AlphaPayload> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");
  }

  const url = new URL(ALPHA_URL);
  url.searchParams.set("function", endpoint);
  url.searchParams.set("apikey", apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SliceAlphaVantageRealtime/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Alpha Vantage ${endpoint} returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as AlphaPayload;
    const error = providerError(payload);

    if (error) {
      throw new Error(`Alpha Vantage ${endpoint}: ${String(error)}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function easternParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function equityMarketSession() {
  const { weekday, hour, minute } = easternParts();
  const minutes = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";

  if (weekend) {
    return { state: "Closed" as const, extended: false };
  }

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return { state: "Live" as const, extended: true };
  }

  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return { state: "Live" as const, extended: false };
  }

  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return { state: "Live" as const, extended: true };
  }

  return { state: "Closed" as const, extended: false };
}

function zonedEasternToUtc(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const [datePart, timePart = "16:00:00"] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return null;
  }

  const initial = new Date(
    Date.UTC(year, month - 1, day, hour, minute, Number.isFinite(second) ? second : 0)
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(initial);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const represented = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  return new Date(initial.getTime() - (represented - initial.getTime())).toISOString();
}

function parseProviderTimestamp(value: unknown, timezone?: string | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const direct = Date.parse(raw);

  if (Number.isFinite(direct) && /(?:Z|[+-]\d\d:?\d\d)$/i.test(raw)) {
    return new Date(direct).toISOString();
  }

  if (timezone?.toUpperCase() === "UTC") {
    const utc = Date.parse(`${raw.replace(" ", "T")}Z`);
    return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
  }

  return zonedEasternToUtc(raw) ?? (Number.isFinite(direct) ? new Date(direct).toISOString() : null);
}

function stateFromTimestamp(
  providerTimestamp: string | null,
  options: { crypto?: boolean; realtime: boolean }
): RealtimeAssetSnapshot["marketState"] {
  if (!options.realtime) {
    return "Delayed";
  }

  if (!options.crypto) {
    const session = equityMarketSession();

    if (session.state === "Closed") {
      return "Closed";
    }
  }

  if (!providerTimestamp) {
    return "Delayed";
  }

  const age = Date.now() - Date.parse(providerTimestamp);

  if (!Number.isFinite(age)) {
    return "Delayed";
  }

  if (age <= 5 * 60_000) {
    return "Live";
  }

  if (age <= 20 * 60_000) {
    return "Delayed";
  }

  return "Stale";
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function sma(values: number[], length: number) {
  return values.length >= length ? round(average(values.slice(-length)), 2) : null;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) {
    return null;
  }

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.map((value) => Math.max(value, 0));
  const losses = recent.map((value) => Math.max(-value, 0));
  const averageGain = average(gains) ?? 0;
  const averageLoss = average(losses) ?? 0;

  if (!averageLoss) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return round(100 - 100 / (1 + relativeStrength), 2);
}

function volatility30d(values: number[]) {
  if (values.length < 31) {
    return null;
  }

  const sample = values.slice(-31);
  const returns = sample.slice(1).map((value, index) => {
    const prior = sample[index];
    return prior ? Math.log(value / prior) : 0;
  });

  const mean = average(returns) ?? 0;
  const variance = average(returns.map((value) => (value - mean) ** 2)) ?? 0;

  return round(Math.sqrt(variance) * Math.sqrt(252) * 100, 2);
}

function technicalsFromCloses(closes: number[]): TechnicalSnapshot {
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);
  const volatility = volatility30d(closes);

  let trend: TechnicalSnapshot["trend"] = "Insufficient data";

  if (sma50 !== null && sma200 !== null) {
    trend = sma50 > sma200 ? "Bullish" : sma50 < sma200 ? "Bearish" : "Neutral";
  }

  return {
    sma20,
    sma50,
    sma200,
    rsi14,
    volatility30d: volatility,
    trend,
    technicalSummary: [
      trend === "Insufficient data" ? "Limited Alpha Vantage history" : `${trend} 50D/200D trend`,
      rsi14 === null ? "RSI unavailable" : `RSI ${rsi14}`,
      volatility === null ? "volatility unavailable" : `30D vol ${volatility}%`,
    ].join(" · "),
  };
}

function emptyTechnicals(message = "Alpha Vantage technical history is loading."): TechnicalSnapshot {
  return {
    sma20: null,
    sma50: null,
    sma200: null,
    rsi14: null,
    volatility30d: null,
    trend: "Insufficient data",
    technicalSummary: message,
  };
}

function cryptoBase(symbol: string) {
  const normalized = normalizeSymbol(symbol);

  if (normalized.endsWith("USD") && normalized.length > 3) {
    return normalized.slice(0, -3);
  }

  return normalized;
}

function isCryptoSymbol(symbol: string) {
  return CRYPTO_SYMBOLS.has(cryptoBase(symbol));
}

function qualityScore(snapshot: Omit<RealtimeAssetSnapshot, "qualityScore">) {
  let score = 45;

  if (snapshot.price > 0) score += 20;
  if (snapshot.isRealtime) score += 15;
  if (snapshot.providerTimestamp) score += 5;
  if (snapshot.previousClose) score += 5;
  if (snapshot.technicals.rsi14 !== null && snapshot.technicals.rsi14 !== undefined) score += 5;
  if (snapshot.technicals.sma50 !== null && snapshot.technicals.sma50 !== undefined) score += 5;
  if (snapshot.marketState === "Stale") score -= 25;
  if (snapshot.marketState === "Delayed") score -= 10;

  return clamp(score, 0, 100);
}

function finalizeSnapshot(
  snapshot: Omit<RealtimeAssetSnapshot, "qualityScore">
): RealtimeAssetSnapshot {
  const warnings = [...snapshot.warnings];

  if (snapshot.marketState === "Stale") {
    warnings.push("Alpha Vantage timestamp is stale for the current market session.");
  }

  if (snapshot.marketState === "Delayed") {
    warnings.push("Alpha Vantage returned delayed or insufficiently timestamped data.");
  }

  return {
    ...snapshot,
    warnings: Array.from(new Set(warnings)),
    qualityScore: qualityScore(snapshot),
  };
}

function bulkRows(payload: AlphaPayload) {
  if (Array.isArray(payload.data)) return payload.data as Array<Record<string, unknown>>;
  if (Array.isArray(payload.quotes)) return payload.quotes as Array<Record<string, unknown>>;
  if (Array.isArray(payload.realtime_quotes)) {
    return payload.realtime_quotes as Array<Record<string, unknown>>;
  }

  return [];
}

function buildBulkSnapshot(
  requestedSymbol: string,
  row: Record<string, unknown>,
  entitlement: string | null,
  receivedAt: string,
  latencyMs: number
) {
  const session = equityMarketSession();
  const regularPrice = toNumber(row.close);
  const extendedPrice = toNumber(row.extended_hours_quote);
  const useExtended = session.extended && extendedPrice !== null && extendedPrice > 0;
  const price = useExtended ? extendedPrice : regularPrice;

  if (price === null || price <= 0) {
    return null;
  }

  const previousClose = toNumber(row.previous_close);
  const change =
    (useExtended ? toNumber(row.extended_hours_change) : toNumber(row.change)) ??
    (previousClose && previousClose > 0 ? price - previousClose : null);
  const changePercent =
    (useExtended
      ? toNumber(row.extended_hours_change_percent)
      : toNumber(row.change_percent)) ??
    (previousClose && previousClose > 0 && change !== null
      ? (change / previousClose) * 100
      : null);
  const providerTimestamp =
    parseProviderTimestamp(row.timestamp, "America/New_York") ?? receivedAt;
  const realtime = entitlement === "realtime";

  const base = {
    symbol: requestedSymbol,
    providerSymbol: normalizeSymbol(String(row.symbol ?? requestedSymbol)),
    assetType: "Equity",
    provider: "Alpha Vantage",
    isRealtime: realtime,
    price: round(price, 4) ?? price,
    previousClose: round(previousClose, 4),
    change: round(change, 4),
    changePercent: round(changePercent, 4),
    bid: null,
    ask: null,
    volume: toNumber(row.volume),
    currency: "USD",
    marketState: stateFromTimestamp(providerTimestamp, { realtime }),
    latencyMs,
    providerTimestamp,
    receivedAt,
    technicals: emptyTechnicals(),
    warnings: useExtended ? ["Alpha Vantage extended-hours quote is active."] : [],
    raw: row,
  } satisfies Omit<RealtimeAssetSnapshot, "qualityScore">;

  return finalizeSnapshot(base);
}

async function fetchBulkEquities(symbols: string[], entitlement: string | null) {
  if (!symbols.length) {
    return { snapshots: [] as RealtimeAssetSnapshot[], warnings: [] as string[] };
  }

  const cacheKey = symbols.map(normalizeSymbol).sort().join(",");
  const cached = bulkCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const startedAt = Date.now();
  const payload = await alphaRequest("REALTIME_BULK_QUOTES", {
    symbol: symbols.join(","),
  });
  const latencyMs = Date.now() - startedAt;
  const rows = bulkRows(payload);
  const receivedAt = new Date().toISOString();
  const rowsBySymbol = new Map(
    rows
      .filter((row) => row.symbol)
      .map((row) => [normalizeSymbol(String(row.symbol)), row])
  );

  const snapshots = symbols
    .map((symbol) => {
      const row = rowsBySymbol.get(normalizeSymbol(symbol));
      return row
        ? buildBulkSnapshot(symbol, row, entitlement, receivedAt, latencyMs)
        : null;
    })
    .filter((snapshot): snapshot is RealtimeAssetSnapshot => Boolean(snapshot));

  const missing = symbols.filter(
    (symbol) => !snapshots.some((snapshot) => snapshot.symbol === symbol)
  );

  const result = {
    snapshots,
    warnings: missing.length
      ? [`Alpha Vantage bulk quotes did not return: ${missing.join(", ")}.`]
      : [],
  };

  bulkCache.set(cacheKey, {
    expiresAt: Date.now() + 10_000,
    value: result,
  });

  return result;
}

async function fetchGlobalQuote(symbol: string, entitlement: string | null) {
  const startedAt = Date.now();
  const payload = await alphaRequest("GLOBAL_QUOTE", {
    symbol,
    ...(entitlement ? { entitlement } : {}),
  });
  const latencyMs = Date.now() - startedAt;
  const row = (payload["Global Quote"] ?? {}) as Record<string, string>;
  const price = toNumber(row["05. price"]);

  if (price === null || price <= 0) {
    return null;
  }

  const previousClose = toNumber(row["08. previous close"]);
  const change =
    toNumber(row["09. change"]) ??
    (previousClose && previousClose > 0 ? price - previousClose : null);
  const changePercent =
    toNumber(row["10. change percent"]) ??
    (previousClose && previousClose > 0 && change !== null
      ? (change / previousClose) * 100
      : null);
  const realtime = entitlement === "realtime";
  const providerTimestamp = realtime
    ? new Date().toISOString()
    : row["07. latest trading day"]
      ? zonedEasternToUtc(`${row["07. latest trading day"]} 16:00:00`)
      : null;

  const base = {
    symbol,
    providerSymbol: symbol,
    assetType: "Equity",
    provider: "Alpha Vantage",
    isRealtime: realtime,
    price: round(price, 4) ?? price,
    previousClose: round(previousClose, 4),
    change: round(change, 4),
    changePercent: round(changePercent, 4),
    bid: null,
    ask: null,
    volume: toNumber(row["06. volume"]),
    currency: "USD",
    marketState: stateFromTimestamp(providerTimestamp, { realtime }),
    latencyMs,
    providerTimestamp,
    receivedAt: new Date().toISOString(),
    technicals: emptyTechnicals(),
    warnings: ["Alpha Vantage GLOBAL_QUOTE fallback was used."],
    raw: row,
  } satisfies Omit<RealtimeAssetSnapshot, "qualityScore">;

  return finalizeSnapshot(base);
}

async function fetchCryptoQuote(symbol: string) {
  const baseSymbol = cryptoBase(symbol);
  const startedAt = Date.now();
  const payload = await alphaRequest("CURRENCY_EXCHANGE_RATE", {
    from_currency: baseSymbol,
    to_currency: "USD",
  });
  const latencyMs = Date.now() - startedAt;
  const row = (payload["Realtime Currency Exchange Rate"] ?? {}) as Record<
    string,
    string
  >;
  const price = toNumber(row["5. Exchange Rate"]);

  if (price === null || price <= 0) {
    return null;
  }

  const providerTimestamp = parseProviderTimestamp(
    row["6. Last Refreshed"],
    row["7. Time Zone"]
  );

  const base = {
    symbol,
    providerSymbol: `${baseSymbol}/USD`,
    assetType: "Crypto",
    provider: "Alpha Vantage",
    isRealtime: true,
    price: round(price, 8) ?? price,
    previousClose: null,
    change: null,
    changePercent: null,
    bid: round(toNumber(row["8. Bid Price"]), 8),
    ask: round(toNumber(row["9. Ask Price"]), 8),
    volume: null,
    currency: "USD",
    marketState: stateFromTimestamp(providerTimestamp, {
      realtime: true,
      crypto: true,
    }),
    latencyMs,
    providerTimestamp,
    receivedAt: new Date().toISOString(),
    technicals: emptyTechnicals(),
    warnings: [],
    raw: row,
  } satisfies Omit<RealtimeAssetSnapshot, "qualityScore">;

  return finalizeSnapshot(base);
}

function extractEquityCloses(payload: AlphaPayload) {
  const series =
    (payload["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined) ??
    (payload["Time Series (Daily Adjusted)"] as
      | Record<string, Record<string, string>>
      | undefined);

  if (!series) {
    return [];
  }

  return Object.keys(series)
    .sort((a, b) => a.localeCompare(b))
    .map((date) =>
      toNumber(series[date]?.["5. adjusted close"] ?? series[date]?.["4. close"])
    )
    .filter((value): value is number => value !== null && value > 0);
}

function extractCryptoCloses(payload: AlphaPayload) {
  const series = payload["Time Series (Digital Currency Daily)"] as
    | Record<string, Record<string, string>>
    | undefined;

  if (!series) {
    return [];
  }

  return Object.keys(series)
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const row = series[date] ?? {};
      const closeKey = Object.keys(row).find(
        (key) => key.startsWith("4") && key.toUpperCase().includes("USD")
      );

      return toNumber(closeKey ? row[closeKey] : row["4. close"]);
    })
    .filter((value): value is number => value !== null && value > 0);
}

async function fetchTechnicals(symbol: string, entitlement: string | null) {
  const cached = technicalCache.get(symbol);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const payload = isCryptoSymbol(symbol)
    ? await alphaRequest("DIGITAL_CURRENCY_DAILY", {
        symbol: cryptoBase(symbol),
        market: "USD",
      })
    : await alphaRequest("TIME_SERIES_DAILY_ADJUSTED", {
        symbol,
        outputsize: "full",
        ...(entitlement ? { entitlement } : {}),
      });

  const closes = isCryptoSymbol(symbol)
    ? extractCryptoCloses(payload)
    : extractEquityCloses(payload);
  const technicals = technicalsFromCloses(closes);

  technicalCache.set(symbol, {
    expiresAt: Date.now() + historyCacheMs(),
    value: technicals,
  });

  return technicals;
}

async function runPool<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      results[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => runner())
  );

  return results;
}

export async function getAlphaVantageRealtimeSnapshots(
  requestedSymbols?: string | string[] | null
): Promise<RealtimeMarketResponse> {
  const symbols = normalizeAlphaVantageSymbols(requestedSymbols);
  const entitlement = getEntitlement();
  const warnings: string[] = [];

  if (!process.env.ALPHA_VANTAGE_API_KEY) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");
  }

  if (entitlement !== "realtime") {
    warnings.push(
      "ALPHA_VANTAGE_ENTITLEMENT is not set to realtime. US equity quotes may be delayed or historical."
    );
  }

  const cryptoSymbols = symbols.filter(isCryptoSymbol);
  const equitySymbols = symbols.filter((symbol) => !isCryptoSymbol(symbol));
  const snapshotsBySymbol = new Map<string, RealtimeAssetSnapshot>();

  if (equitySymbols.length) {
    try {
      const bulk = await fetchBulkEquities(equitySymbols, entitlement);
      bulk.warnings.forEach((warning) => warnings.push(warning));
      bulk.snapshots.forEach((snapshot) => snapshotsBySymbol.set(snapshot.symbol, snapshot));
    } catch (error) {
      warnings.push(
        `Alpha Vantage REALTIME_BULK_QUOTES failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    const missingEquities = equitySymbols.filter(
      (symbol) => !snapshotsBySymbol.has(symbol)
    );

    const fallbackQuotes = await runPool(missingEquities, 5, async (symbol) => {
      try {
        return await fetchGlobalQuote(symbol, entitlement);
      } catch (error) {
        warnings.push(
          `${symbol} Alpha Vantage GLOBAL_QUOTE failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        return null;
      }
    });

    fallbackQuotes
      .filter((snapshot): snapshot is RealtimeAssetSnapshot => Boolean(snapshot))
      .forEach((snapshot) => snapshotsBySymbol.set(snapshot.symbol, snapshot));
  }

  const cryptoQuotes = await runPool(cryptoSymbols, 4, async (symbol) => {
    try {
      return await fetchCryptoQuote(symbol);
    } catch (error) {
      warnings.push(
        `${symbol} Alpha Vantage CURRENCY_EXCHANGE_RATE failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  });

  cryptoQuotes
    .filter((snapshot): snapshot is RealtimeAssetSnapshot => Boolean(snapshot))
    .forEach((snapshot) => snapshotsBySymbol.set(snapshot.symbol, snapshot));

  const candidates = symbols.filter((symbol) => snapshotsBySymbol.has(symbol));
  const limitedCandidates = candidates.slice(0, technicalLimit());

  await runPool(limitedCandidates, 4, async (symbol) => {
    try {
      const technicals = await fetchTechnicals(symbol, entitlement);
      const current = snapshotsBySymbol.get(symbol);

      if (current) {
        const { qualityScore: _qualityScore, ...base } = current;

        snapshotsBySymbol.set(
          symbol,
          finalizeSnapshot({
            ...base,
            technicals,
            warnings: current.warnings,
          })
        );
      }
    } catch (error) {
      warnings.push(
        `${symbol} Alpha Vantage history failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  });

  if (candidates.length > limitedCandidates.length) {
    warnings.push(
      `Live Alpha Vantage prices were loaded for all returned symbols; technical history was limited to ${limitedCandidates.length} symbols for rate-control. Set ALPHA_VANTAGE_TECHNICAL_LIMIT to adjust.`
    );
  }

  const missing = symbols.filter((symbol) => !snapshotsBySymbol.has(symbol));

  if (missing.length) {
    warnings.push(`Alpha Vantage returned no current quote for: ${missing.join(", ")}.`);
  }

  const snapshots = symbols
    .map((symbol) => snapshotsBySymbol.get(symbol))
    .filter((snapshot): snapshot is RealtimeAssetSnapshot => Boolean(snapshot));

  return {
    generatedAt: new Date().toISOString(),
    pollAfterMs: pollAfterMs(),
    providerPriority: ["alphavantage"],
    requestedSymbols: symbols,
    realtimeCount: snapshots.filter(
      (snapshot) => snapshot.isRealtime && snapshot.marketState === "Live"
    ).length,
    delayedOrDemoCount: snapshots.filter(
      (snapshot) => !snapshot.isRealtime || snapshot.marketState !== "Live"
    ).length,
    staleCount: snapshots.filter((snapshot) => snapshot.marketState === "Stale").length,
    warnings: Array.from(new Set(warnings)),
    snapshots,
  };
}