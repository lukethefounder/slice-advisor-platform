import "server-only";

import type {
  PublicMarketEntitlement,
  PublicMarketSnapshot,
  PublicMarketState,
  PublicMarketSummarySuccess,
} from "@/lib/public-market-types";

const ALPHA_ENDPOINT = "https://www.alphavantage.co/query";
const SUMMARY_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
] as const;
const FRESH_CACHE_MS = 20_000;
const STALE_CACHE_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

type AlphaPayload = Record<string, unknown> & {
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type SummaryCacheEntry = {
  value: PublicMarketSummarySuccess;
  freshUntil: number;
  staleUntil: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __slicePublicMarketSummaryCache:
    | Map<string, SummaryCacheEntry>
    | undefined;
  // eslint-disable-next-line no-var
  var __slicePublicMarketSummaryInFlight:
    | Map<string, Promise<PublicMarketSummarySuccess>>
    | undefined;
}

const responseCache =
  globalThis.__slicePublicMarketSummaryCache ??
  new Map<string, SummaryCacheEntry>();
const inFlight =
  globalThis.__slicePublicMarketSummaryInFlight ??
  new Map<string, Promise<PublicMarketSummarySuccess>>();

globalThis.__slicePublicMarketSummaryCache = responseCache;
globalThis.__slicePublicMarketSummaryInFlight = inFlight;

export class PublicMarketSummaryError extends Error {
  readonly code:
    | "ALPHA_VANTAGE_NOT_CONFIGURED"
    | "ALPHA_VANTAGE_UNAVAILABLE"
    | "MARKET_SUMMARY_FAILED";

  constructor(
    code: PublicMarketSummaryError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PublicMarketSummaryError";
    this.code = code;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim(),
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number | null, digits = 4) {
  return value === null || !Number.isFinite(value)
    ? null
    : Number(value.toFixed(digits));
}

function currentEntitlement(): PublicMarketEntitlement {
  const value = clean(process.env.ALPHA_VANTAGE_ENTITLEMENT).toLowerCase();

  if (value === "realtime" || value === "delayed") return value;
  return "unconfigured";
}

function recommendedPollMs(entitlement: PublicMarketEntitlement) {
  const configured = Number(process.env.NEXT_PUBLIC_SLICE_REALTIME_POLL_MS);
  const fallback = entitlement === "realtime" ? 30_000 : 60_000;
  const normalized = Number.isFinite(configured)
    ? Math.round(configured)
    : fallback;

  return entitlement === "realtime"
    ? clamp(normalized, 20_000, 120_000)
    : clamp(Math.max(normalized, 60_000), 60_000, 180_000);
}

function readProviderError(payload: AlphaPayload) {
  return (
    clean(payload["Error Message"]) ||
    clean(payload.Information) ||
    clean(payload.Note) ||
    null
  );
}

async function alphaRequest(
  functionName: string,
  parameters: Record<string, string>,
): Promise<AlphaPayload> {
  const apiKey = clean(process.env.ALPHA_VANTAGE_API_KEY);

  if (!apiKey) {
    throw new PublicMarketSummaryError(
      "ALPHA_VANTAGE_NOT_CONFIGURED",
      "Alpha Vantage is not configured. Add ALPHA_VANTAGE_API_KEY to the server environment and redeploy.",
    );
  }

  const url = new URL(ALPHA_ENDPOINT);
  url.searchParams.set("function", functionName);
  url.searchParams.set("apikey", apiKey);

  for (const [key, value] of Object.entries(parameters)) {
    if (value) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SlicePublicMarketSummary/1.0",
      },
    });

    if (!response.ok) {
      throw new PublicMarketSummaryError(
        "ALPHA_VANTAGE_UNAVAILABLE",
        `Alpha Vantage returned HTTP ${response.status}.`,
      );
    }

    const payload = (await response.json()) as AlphaPayload;
    const providerError = readProviderError(payload);

    if (providerError) {
      const rateLimited = /frequency|rate|limit|premium|call volume/i.test(
        providerError,
      );
      throw new PublicMarketSummaryError(
        "ALPHA_VANTAGE_UNAVAILABLE",
        rateLimited
          ? "Alpha Vantage temporarily limited this request. Slice will keep the last confirmed market response visible when available."
          : `Alpha Vantage could not complete the market request: ${providerError.slice(0, 220)}`,
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof PublicMarketSummaryError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicMarketSummaryError(
        "ALPHA_VANTAGE_UNAVAILABLE",
        "Alpha Vantage did not respond before the market summary timeout.",
      );
    }

    throw new PublicMarketSummaryError(
      "ALPHA_VANTAGE_UNAVAILABLE",
      error instanceof Error
        ? `Alpha Vantage market request failed: ${error.message}`
        : "Alpha Vantage market request failed.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: read("weekday"),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function equitySession() {
  const { weekday, hour, minute } = easternParts();
  const minutes = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";

  if (weekend || minutes < 4 * 60 || minutes >= 20 * 60) {
    return { state: "Closed" as const, extended: false };
  }

  if (minutes < 9 * 60 + 30 || minutes >= 16 * 60) {
    return { state: "Live" as const, extended: true };
  }

  return { state: "Live" as const, extended: false };
}

function zonedEasternToUtc(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const [datePart, timePart = "16:00:00"] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  const initial = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      Number.isFinite(second) ? second : 0,
    ),
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(initial);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const represented = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  return new Date(initial.getTime() - (represented - initial.getTime())).toISOString();
}

function providerTimestamp(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;

  if (/(?:Z|[+-]\d\d:?\d\d)$/i.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  return zonedEasternToUtc(raw);
}

function stateFromTimestamp(
  timestamp: string | null,
  entitlement: PublicMarketEntitlement,
): PublicMarketState {
  if (equitySession().state === "Closed") return "Closed";
  if (entitlement !== "realtime") return "Delayed";
  if (!timestamp) return "Delayed";

  const ageMs = Date.now() - Date.parse(timestamp);
  if (!Number.isFinite(ageMs)) return "Delayed";
  if (ageMs <= 5 * 60_000) return "Live";
  if (ageMs <= 20 * 60_000) return "Delayed";
  return "Stale";
}

function qualityScore(snapshot: Omit<PublicMarketSnapshot, "qualityScore">) {
  let score = 50;
  if (snapshot.price > 0) score += 20;
  if (snapshot.providerTimestamp) score += 10;
  if (snapshot.previousClose) score += 8;
  if (snapshot.volume) score += 5;
  if (snapshot.marketState === "Live") score += 7;
  if (snapshot.marketState === "Delayed") score -= 8;
  if (snapshot.marketState === "Stale") score -= 25;

  return clamp(score, 0, 100);
}

function finalize(
  snapshot: Omit<PublicMarketSnapshot, "qualityScore">,
): PublicMarketSnapshot {
  return {
    ...snapshot,
    warnings: Array.from(new Set(snapshot.warnings)),
    qualityScore: qualityScore(snapshot),
  };
}

function bulkRows(payload: AlphaPayload) {
  for (const key of ["data", "quotes", "realtime_quotes"] as const) {
    const value = payload[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }

  return [];
}

function bulkSnapshot(
  requestedSymbol: string,
  row: Record<string, unknown>,
  entitlement: PublicMarketEntitlement,
  receivedAt: string,
): PublicMarketSnapshot | null {
  const session = equitySession();
  const regularPrice = numberValue(row.close);
  const extendedPrice = numberValue(row.extended_hours_quote);
  const useExtended =
    session.extended && extendedPrice !== null && extendedPrice > 0;
  const price = useExtended ? extendedPrice : regularPrice;

  if (price === null || price <= 0) return null;

  const previousClose = numberValue(row.previous_close);
  const change =
    (useExtended
      ? numberValue(row.extended_hours_change)
      : numberValue(row.change)) ??
    (previousClose && previousClose > 0 ? price - previousClose : null);
  const changePercent =
    (useExtended
      ? numberValue(row.extended_hours_change_percent)
      : numberValue(row.change_percent)) ??
    (previousClose && previousClose > 0 && change !== null
      ? (change / previousClose) * 100
      : null);
  const timestamp = providerTimestamp(row.timestamp);
  const marketState = stateFromTimestamp(timestamp, entitlement);
  const warnings: string[] = [];

  if (useExtended) warnings.push("Extended-hours quote is active.");
  if (entitlement === "unconfigured") {
    warnings.push(
      "ALPHA_VANTAGE_ENTITLEMENT is not declared; the quote is not labeled real-time.",
    );
  }
  if (marketState === "Stale") {
    warnings.push("The provider timestamp is stale for the current session.");
  }

  const base: Omit<PublicMarketSnapshot, "qualityScore"> = {
    symbol: requestedSymbol,
    providerSymbol: clean(row.symbol) || requestedSymbol,
    assetType: "Equity",
    provider: "Alpha Vantage",
    price: rounded(price) ?? price,
    previousClose: rounded(previousClose),
    change: rounded(change),
    changePercent: rounded(changePercent),
    volume: numberValue(row.volume),
    currency: "USD",
    marketState,
    isRealtime: entitlement === "realtime" && marketState === "Live",
    providerTimestamp: timestamp,
    receivedAt,
    warnings,
  };

  return finalize(base);
}

async function fetchBulkSummary(entitlement: PublicMarketEntitlement) {
  const payload = await alphaRequest("REALTIME_BULK_QUOTES", {
    symbol: SUMMARY_SYMBOLS.join(","),
  });
  const rows = bulkRows(payload);
  const receivedAt = new Date().toISOString();
  const bySymbol = new Map(
    rows
      .filter((row) => clean(row.symbol))
      .map((row) => [clean(row.symbol).toUpperCase(), row]),
  );

  return SUMMARY_SYMBOLS.map((symbol) => {
    const row = bySymbol.get(symbol);
    return row ? bulkSnapshot(symbol, row, entitlement, receivedAt) : null;
  }).filter((snapshot): snapshot is PublicMarketSnapshot => Boolean(snapshot));
}

async function fetchGlobalQuote(
  symbol: string,
  entitlement: PublicMarketEntitlement,
) {
  const payload = await alphaRequest("GLOBAL_QUOTE", {
    symbol,
    ...(entitlement === "unconfigured" ? {} : { entitlement }),
  });
  const row = (payload["Global Quote"] ?? {}) as Record<string, unknown>;
  const price = numberValue(row["05. price"]);

  if (price === null || price <= 0) return null;

  const previousClose = numberValue(row["08. previous close"]);
  const change =
    numberValue(row["09. change"]) ??
    (previousClose && previousClose > 0 ? price - previousClose : null);
  const changePercent =
    numberValue(row["10. change percent"]) ??
    (previousClose && previousClose > 0 && change !== null
      ? (change / previousClose) * 100
      : null);
  const latestTradingDay = clean(row["07. latest trading day"]);
  const timestamp = latestTradingDay
    ? zonedEasternToUtc(`${latestTradingDay} 16:00:00`)
    : null;
  const marketState: PublicMarketState =
    equitySession().state === "Closed" ? "Closed" : "Delayed";
  const receivedAt = new Date().toISOString();

  return finalize({
    symbol,
    providerSymbol: symbol,
    assetType: "Equity",
    provider: "Alpha Vantage",
    price: rounded(price) ?? price,
    previousClose: rounded(previousClose),
    change: rounded(change),
    changePercent: rounded(changePercent),
    volume: numberValue(row["06. volume"]),
    currency: "USD",
    marketState,
    isRealtime: false,
    providerTimestamp: timestamp,
    receivedAt,
    warnings: [
      "GLOBAL_QUOTE fallback is active; this response is not labeled real-time without a provider time-of-day stamp.",
    ],
  });
}

async function runPool<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => runner(),
    ),
  );
  return results;
}

async function fetchNetworkSummary(): Promise<PublicMarketSummarySuccess> {
  const entitlement = currentEntitlement();
  const warnings: string[] = [];
  let snapshots: PublicMarketSnapshot[] = [];

  try {
    snapshots = await fetchBulkSummary(entitlement);
  } catch (error) {
    if (
      error instanceof PublicMarketSummaryError &&
      error.code === "ALPHA_VANTAGE_NOT_CONFIGURED"
    ) {
      throw error;
    }

    warnings.push(
      error instanceof Error
        ? `Bulk quote path was unavailable: ${error.message}`
        : "Bulk quote path was unavailable.",
    );
  }

  const returned = new Set(snapshots.map((snapshot) => snapshot.symbol));
  const missing = SUMMARY_SYMBOLS.filter((symbol) => !returned.has(symbol));
  const fallbackRequested = missing.length;
  let fallbackLoaded = 0;

  if (missing.length) {
    const fallbacks = await runPool(missing, 3, async (symbol) => {
      try {
        return await fetchGlobalQuote(symbol, entitlement);
      } catch (error) {
        warnings.push(
          `${symbol} fallback failed: ${
            error instanceof Error ? error.message : "Unknown provider error"
          }`,
        );
        return null;
      }
    });

    const usableFallbacks = fallbacks.filter(
      (snapshot): snapshot is PublicMarketSnapshot => Boolean(snapshot),
    );
    fallbackLoaded = usableFallbacks.length;
    snapshots = [...snapshots, ...usableFallbacks];

    if (fallbackLoaded) {
      warnings.push(
        `GLOBAL_QUOTE fallback loaded ${fallbackLoaded} of ${fallbackRequested} missing symbols. Automatic refresh has been slowed to protect provider capacity.`,
      );
    }
  }

  const bySymbol = new Map(
    snapshots.map((snapshot) => [snapshot.symbol, snapshot]),
  );
  const ordered = SUMMARY_SYMBOLS.map((symbol) => bySymbol.get(symbol)).filter(
    (snapshot): snapshot is PublicMarketSnapshot => Boolean(snapshot),
  );

  if (!ordered.length) {
    throw new PublicMarketSummaryError(
      "ALPHA_VANTAGE_UNAVAILABLE",
      "Alpha Vantage returned no usable public market quotes.",
    );
  }

  if (entitlement !== "realtime") {
    warnings.push(
      entitlement === "delayed"
        ? "Alpha Vantage is configured for delayed data."
        : "ALPHA_VANTAGE_ENTITLEMENT is not configured, so US equity quotes are not labeled real-time.",
    );
  }

  const normalPollMs = recommendedPollMs(entitlement);
  const fallbackPollFloorMs =
    fallbackRequested >= 4 ? 180_000 : fallbackRequested > 0 ? 90_000 : 0;

  return {
    schemaVersion: "slice-public-market-summary-1.0.0",
    ok: true,
    provider: "Alpha Vantage",
    keyStatus: "verified",
    entitlement,
    generatedAt: new Date().toISOString(),
    pollAfterMs: Math.max(normalPollMs, fallbackPollFloorMs),
    cacheStatus: "network",
    requestedSymbols: [...SUMMARY_SYMBOLS],
    realtimeCount: ordered.filter(
      (snapshot) => snapshot.isRealtime && snapshot.marketState === "Live",
    ).length,
    delayedCount: ordered.filter(
      (snapshot) => snapshot.marketState === "Delayed",
    ).length,
    staleCount: ordered.filter(
      (snapshot) => snapshot.marketState === "Stale",
    ).length,
    warnings: Array.from(new Set(warnings)),
    snapshots: ordered,
  };
}

function cacheKey() {
  return `alpha-vantage:${SUMMARY_SYMBOLS.join(",")}`;
}

export async function getPublicMarketSummary() {
  const key = cacheKey();
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached && cached.freshUntil > now) {
    return {
      ...cached.value,
      cacheStatus: "fresh-cache" as const,
    };
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const value = await fetchNetworkSummary();
      responseCache.set(key, {
        value,
        freshUntil: Date.now() + FRESH_CACHE_MS,
        staleUntil: Date.now() + STALE_CACHE_MS,
      });
      return value;
    } catch (error) {
      if (
        error instanceof PublicMarketSummaryError &&
        error.code === "ALPHA_VANTAGE_NOT_CONFIGURED"
      ) {
        throw error;
      }

      if (cached && cached.staleUntil > Date.now()) {
        return {
          ...cached.value,
          cacheStatus: "stale-cache" as const,
          warnings: Array.from(
            new Set([
              ...cached.value.warnings,
              error instanceof Error
                ? `Refresh failed; the last confirmed provider response remains visible: ${error.message}`
                : "Refresh failed; the last confirmed provider response remains visible.",
            ]),
          ),
        };
      }

      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

export function publicMarketEntitlement() {
  return currentEntitlement();
}