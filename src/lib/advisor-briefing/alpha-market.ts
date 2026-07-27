import "server-only";

import type {
  AdvisorBriefQuote,
} from "@/lib/advisor-briefing/types";
import {
  ALPHA_ENDPOINT,
  type AlphaCacheEntry,
  type AlphaResult,
  type JsonRecord,
  type MarketStatus,
  type QuoteBatch,
  cleanText,
  isRecord,
  numberValue,
  nullableNumber,
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";

declare global {
  // eslint-disable-next-line no-var
  var __sliceAdvisorBriefAlphaCache:
    | Map<string, AlphaCacheEntry>
    | undefined;
  // eslint-disable-next-line no-var
  var __sliceAdvisorBriefAlphaInFlight:
    | Map<
        string,
        Promise<AlphaResult>
      >
    | undefined;
}

const alphaCache =
  globalThis
    .__sliceAdvisorBriefAlphaCache ??
  new Map<
    string,
    AlphaCacheEntry
  >();

const alphaInFlight =
  globalThis
    .__sliceAdvisorBriefAlphaInFlight ??
  new Map<
    string,
    Promise<AlphaResult>
  >();

globalThis
  .__sliceAdvisorBriefAlphaCache =
  alphaCache;

globalThis
  .__sliceAdvisorBriefAlphaInFlight =
  alphaInFlight;

export function alphaEntitlement() {
  const value = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  return value === "realtime" || value === "delayed" ? value : null;
}

function stableKey(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function providerError(payload: JsonRecord) {
  return (
    cleanText(payload["Error Message"]) ||
    cleanText(payload.Information) ||
    cleanText(payload.Note) ||
    null
  );
}

export async function alphaRequest(
  parameters: Record<string, string>,
  options: {
    ttlMs: number;
    staleTtlMs?: number;
    timeoutMs?: number;
  },
): Promise<AlphaResult> {
  const apiKey = String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim();

  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY is not configured.");
  }

  const query = { ...parameters, apikey: apiKey };
  const key = stableKey(query);
  const now = Date.now();
  const cached = alphaCache.get(key);

  if (cached && now - cached.storedAt <= options.ttlMs) {
    return {
      payload: cached.payload,
      retrievedAt: new Date(cached.storedAt).toISOString(),
      stale: false,
    };
  }

  const existing = alphaInFlight.get(key);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15_000,
    );

    try {
      const url = new URL(ALPHA_ENDPOINT);

      for (const [name, value] of Object.entries(query)) {
        url.searchParams.set(name, value);
      }

      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SliceAdvisorBrief/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Alpha Vantage ${parameters.function ?? "request"} returned HTTP ${response.status}.`,
        );
      }

      const payload = (await response.json()) as JsonRecord;
      const error = providerError(payload);

      if (error) {
        throw new Error(error);
      }

      const storedAt = Date.now();
      alphaCache.set(key, { payload, storedAt });

      return {
        payload,
        retrievedAt: new Date(storedAt).toISOString(),
        stale: false,
      };
    } catch (error) {
      const staleTtlMs = options.staleTtlMs ?? options.ttlMs * 12;

      if (cached && now - cached.storedAt <= staleTtlMs) {
        return {
          payload: cached.payload,
          retrievedAt: new Date(cached.storedAt).toISOString(),
          stale: true,
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      alphaInFlight.delete(key);
    }
  })();

  alphaInFlight.set(key, request);
  return request;
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      output[index] = await worker(values[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(concurrency, values.length || 1)) },
      () => runWorker(),
    ),
  );

  return output;
}

function parseAlphaTimestamp(value: unknown) {
  const raw = cleanText(value, 64);

  if (!raw) {
    return null;
  }

  const compact = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
  );

  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
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

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);

  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function latestTimestamp(values: Array<string | null>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);

  return timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
}

function quoteFromRecord(
  record: JsonRecord,
  symbolFallback = "",
): AdvisorBriefQuote | null {
  const symbol = cleanText(
    record.symbol ??
      record.ticker ??
      record["01. symbol"] ??
      record["1. symbol"] ??
      symbolFallback,
    32,
  ).toUpperCase();
  const price = numberValue(
    record.price ??
      record.close ??
      record["05. price"] ??
      record["4. close"],
  );

  if (!symbol || price <= 0) {
    return null;
  }

  const previousClose = numberValue(
    record.previous_close ??
      record.previousClose ??
      record["08. previous close"],
    price,
  );
  const change = numberValue(
    record.change ?? record["09. change"],
    price - previousClose,
  );
  const changePercent = numberValue(
    record.change_percent ??
      record.changePercent ??
      record["10. change percent"],
    previousClose ? (change / previousClose) * 100 : 0,
  );

  return {
    symbol,
    price,
    open: numberValue(record.open ?? record["02. open"], price),
    high: numberValue(record.high ?? record["03. high"], price),
    low: numberValue(record.low ?? record["04. low"], price),
    previousClose,
    change,
    changePercent,
    volume: numberValue(record.volume ?? record["06. volume"]),
    timestamp:
      parseAlphaTimestamp(
        record.timestamp ??
          record.latest_trading_day ??
          record["07. latest trading day"],
      ) ?? null,
    extendedHoursPrice:
      nullableNumber(
        record.extended_hours_price ??
          record.extendedHoursPrice ??
          record["extended hours price"],
      ),
    extendedHoursChangePercent:
      nullableNumber(
        record.extended_hours_change_percent ??
          record.extendedHoursChangePercent,
      ),
  };
}

function bulkQuoteRows(payload: JsonRecord) {
  for (const key of [
    "data",
    "quotes",
    "Realtime Bulk Quotes",
    "realtime_bulk_quotes",
  ]) {
    if (Array.isArray(payload[key])) {
      return (payload[key] as unknown[]).filter(isRecord);
    }
  }

  return [];
}

async function globalQuote(symbol: string) {
  const entitlement = alphaEntitlement();
  const result = await alphaRequest(
    {
      function: "GLOBAL_QUOTE",
      symbol,
      ...(entitlement ? { entitlement } : {}),
    },
    {
      ttlMs: 15_000,
      staleTtlMs: 30 * 60_000,
    },
  );
  const quoteRecord = isRecord(result.payload["Global Quote"])
    ? (result.payload["Global Quote"] as JsonRecord)
    : result.payload;

  return quoteFromRecord(quoteRecord, symbol);
}

export async function loadQuotes(symbolsInput: string[]): Promise<QuoteBatch> {
  const symbols = uniqueStrings(
    symbolsInput.map((symbol) => symbol.toUpperCase()),
    100,
  );
  const quotes: Record<string, AdvisorBriefQuote> = {};
  const warnings: string[] = [];
  let sourceFunction: QuoteBatch["sourceFunction"] = "REALTIME_BULK_QUOTES";
  let retrievedAt = new Date().toISOString();

  try {
    const result = await alphaRequest(
      {
        function: "REALTIME_BULK_QUOTES",
        symbol: symbols.join(","),
      },
      {
        ttlMs: 15_000,
        staleTtlMs: 30 * 60_000,
      },
    );
    retrievedAt = result.retrievedAt;

    for (const row of bulkQuoteRows(result.payload)) {
      const quote = quoteFromRecord(row);

      if (quote) {
        quotes[quote.symbol] = quote;
      }
    }

    if (result.stale) {
      warnings.push(
        "Realtime bulk quotes are temporarily using the most recent cached provider response.",
      );
    }
  } catch (error) {
    warnings.push(
      `Realtime bulk quotes were unavailable; GLOBAL_QUOTE fallback was used: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const missing = symbols.filter((symbol) => !quotes[symbol]);

  if (missing.length) {
    sourceFunction = "GLOBAL_QUOTE_FALLBACK";
    const concurrency = Math.max(
      1,
      Math.min(
        10,
        Number(process.env.ADVISOR_BRIEF_ALPHA_CONCURRENCY) || 6,
      ),
    );
    const fallback = await mapWithConcurrency(
      missing,
      concurrency,
      async (symbol) => {
        try {
          return await globalQuote(symbol);
        } catch (error) {
          warnings.push(
            `${symbol} quote unavailable: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        }
      },
    );

    for (const quote of fallback) {
      if (quote) {
        quotes[quote.symbol] = quote;
      }
    }
  }

  const values = Object.values(quotes);

  return {
    quotes,
    requestedSymbols: symbols.length,
    returnedSymbols: values.length,
    coveragePercent: symbols.length
      ? (values.length / symbols.length) * 100
      : 0,
    providerAsOf: latestTimestamp(values.map((quote) => quote.timestamp)),
    retrievedAt,
    sourceFunction,
    warnings,
  };
}

export async function loadMarketStatus(): Promise<MarketStatus> {
  const result = await alphaRequest(
    {
      function: "MARKET_STATUS",
    },
    {
      ttlMs: 60_000,
      staleTtlMs: 30 * 60_000,
    },
  );
  const markets = Array.isArray(result.payload.markets)
    ? (result.payload.markets as unknown[]).filter(isRecord)
    : [];
  const market =
    markets.find((item) => {
      const type = cleanText(item.market_type).toLowerCase();
      const region = cleanText(item.region).toLowerCase();
      return type.includes("equity") && region.includes("united states");
    }) ?? markets[0] ?? {};
  const status = cleanText(market.current_status, 40) || "unknown";

  return {
    currentStatus: status,
    isOpen: status.toLowerCase() === "open",
    region: cleanText(market.region, 100) || "United States",
    exchanges: cleanText(market.primary_exchanges, 300),
    localOpen: cleanText(market.local_open, 20),
    localClose: cleanText(market.local_close, 20),
    notes: cleanText(market.notes, 500),
    retrievedAt: result.retrievedAt,
  };
}