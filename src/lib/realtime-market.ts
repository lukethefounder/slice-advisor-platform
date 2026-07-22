import { prisma } from "@/lib/prisma";

export type TechnicalSnapshot = {
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  rsi14?: number | null;
  volatility30d?: number | null;
  trend?:
    | "Bullish"
    | "Bearish"
    | "Neutral"
    | "Insufficient data";
  technicalSummary: string;
};

export type RealtimeAssetSnapshot = {
  symbol: string;
  providerSymbol: string;
  assetType: string;
  provider: string;
  isRealtime: boolean;
  price: number;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  bid?: number | null;
  ask?: number | null;
  volume?: number | null;
  currency: string;
  marketState:
    | "Live"
    | "Delayed"
    | "Closed"
    | "Stale"
    | "Demo";
  qualityScore: number;
  latencyMs: number;
  providerTimestamp?:
    | string
    | null;
  receivedAt: string;
  technicals: TechnicalSnapshot;
  warnings: string[];
  raw?: unknown;
};

export type RealtimeMarketResponse = {
  generatedAt: string;
  pollAfterMs: number;
  providerPriority: string[];
  requestedSymbols: string[];
  realtimeCount: number;
  delayedOrDemoCount: number;
  staleCount: number;
  warnings: string[];
  snapshots: RealtimeAssetSnapshot[];
};

type ProviderResult = {
  snapshots: RealtimeAssetSnapshot[];
  warnings: string[];
};

type AlphaVantageBulkQuote = {
  symbol?: string;
  timestamp?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  change?: string;
  change_percent?: string;
  extended_hours_quote?: string;
  extended_hours_change?: string;
  extended_hours_change_percent?: string;
  [key: string]: unknown;
};

type AlphaVantageBulkResponse = {
  endpoint?: string;
  message?: string;
  Information?: string;
  Note?: string;
  "Error Message"?: string;
  data?: AlphaVantageBulkQuote[];
  quotes?: AlphaVantageBulkQuote[];
  realtime_quotes?:
    AlphaVantageBulkQuote[];
};

type AlphaVantageGlobalQuoteResponse = {
  "Global Quote"?: Record<
    string,
    string
  >;
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type AlphaBulkCacheEntry = {
  expiresAt: number;
  result: ProviderResult;
};

const DEFAULT_SYMBOLS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "TLT",
  "GLD",
  "BTCUSD",
];

const DEFAULT_POLL_MS = 15_000;

const alphaBulkCache = new Map<
  string,
  AlphaBulkCacheEntry
>();

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function toNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function round(
  value: number | null | undefined,
  digits = 2
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function simpleHash(value: string) {
  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(index);

    hash |= 0;
  }

  return Math.abs(hash);
}

function normalizeSymbol(
  symbol: string
) {
  return symbol
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9:.\-$]/g,
      ""
    );
}

export function normalizeSymbolList(
  input?: string | string[] | null
) {
  const raw = Array.isArray(input)
    ? input.join(",")
    : input ||
      DEFAULT_SYMBOLS.join(",");

  const symbols = raw
    .split(/[,\s]+/g)
    .map(normalizeSymbol)
    .filter(Boolean);

  return Array.from(
    new Set(symbols)
  ).slice(0, 40);
}

function getAlphaVantageEntitlement() {
  const entitlement = String(
    process.env
      .ALPHA_VANTAGE_ENTITLEMENT ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    entitlement === "realtime" ||
    entitlement === "delayed"
  ) {
    return entitlement;
  }

  return null;
}

function providerPriority() {
  const raw =
    process.env
      .SLICE_REALTIME_PROVIDER_PRIORITY;

  if (!raw) {
    const alphaRealtimeReady =
      Boolean(
        process.env
          .ALPHA_VANTAGE_API_KEY &&
          getAlphaVantageEntitlement() ===
            "realtime"
      );

    return alphaRealtimeReady
      ? [
          "alphavantage",
          "finnhub",
          "twelvedata",
          "demo",
        ]
      : [
          "finnhub",
          "twelvedata",
          "alphavantage",
          "demo",
        ];
  }

  const normalized = Array.from(
    new Set(
      raw
        .split(",")
        .map((item) =>
          item
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  );

  return normalized.includes("demo")
    ? normalized
    : [...normalized, "demo"];
}

function pollAfterMs() {
  const parsed = Number(
    process.env
      .NEXT_PUBLIC_SLICE_REALTIME_POLL_MS
  );

  if (!Number.isFinite(parsed)) {
    return DEFAULT_POLL_MS;
  }

  return clamp(
    Math.round(parsed),
    5_000,
    120_000
  );
}

function alphaCacheTtlMs() {
  const parsed = Number(
    process.env
      .ALPHA_VANTAGE_CACHE_TTL_MS
  );

  if (!Number.isFinite(parsed)) {
    return 10_000;
  }

  return clamp(
    Math.round(parsed),
    1_000,
    60_000
  );
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10_000
) {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "SliceRealtimeMarket/2.0",
        ...(init?.headers || {}),
      },
    });

    const latencyMs =
      Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return {
      data:
        (await response.json()) as T,
      latencyMs,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function providerSymbol(
  symbol: string,
  provider: string
) {
  const clean =
    normalizeSymbol(symbol);

  if (provider === "finnhub") {
    if (
      clean === "BTC" ||
      clean === "BTCUSD"
    ) {
      return "BINANCE:BTCUSDT";
    }

    if (
      clean === "ETH" ||
      clean === "ETHUSD"
    ) {
      return "BINANCE:ETHUSDT";
    }
  }

  if (provider === "twelvedata") {
    if (
      clean === "BTC" ||
      clean === "BTCUSD"
    ) {
      return "BTC/USD";
    }

    if (
      clean === "ETH" ||
      clean === "ETHUSD"
    ) {
      return "ETH/USD";
    }
  }

  return clean;
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function sma(
  values: number[],
  length: number
) {
  if (values.length < length) {
    return null;
  }

  return round(
    average(
      values.slice(-length)
    ),
    2
  );
}

function rsi(
  values: number[],
  period = 14
) {
  if (values.length <= period) {
    return null;
  }

  const changes = values
    .slice(1)
    .map(
      (value, index) =>
        value - values[index]
    );

  const recent =
    changes.slice(-period);

  const gains = recent.filter(
    (change) => change > 0
  );

  const losses = recent
    .filter(
      (change) => change < 0
    )
    .map(Math.abs);

  const avgGain =
    average(gains) ?? 0;

  const avgLoss =
    average(losses) ?? 0;

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;

  return round(
    100 - 100 / (1 + rs),
    2
  );
}

function volatility30d(
  values: number[]
) {
  if (values.length < 31) {
    return null;
  }

  const closes =
    values.slice(-31);

  const returns = closes
    .slice(1)
    .map((value, index) => {
      const prior =
        closes[index];

      if (!prior) {
        return 0;
      }

      return (
        (value - prior) / prior
      );
    });

  const avg =
    average(returns) ?? 0;

  const variance =
    average(
      returns.map(
        (dailyReturn) =>
          Math.pow(
            dailyReturn - avg,
            2
          )
      )
    ) ?? 0;

  return round(
    Math.sqrt(variance) *
      Math.sqrt(252) *
      100,
    2
  );
}

function computeTechnicals(
  closes: number[]
): TechnicalSnapshot {
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);

  const vol =
    volatility30d(closes);

  let trend: TechnicalSnapshot["trend"] =
    "Insufficient data";

  if (sma50 && sma200) {
    if (sma50 > sma200) {
      trend = "Bullish";
    } else if (sma50 < sma200) {
      trend = "Bearish";
    } else {
      trend = "Neutral";
    }
  }

  const summaryParts = [
    trend !== "Insufficient data"
      ? `${trend} 50D/200D trend`
      : "Limited trend history",
    rsi14
      ? `RSI ${rsi14}`
      : "RSI unavailable",
    vol
      ? `30D vol ${vol}%`
      : "volatility unavailable",
  ];

  return {
    sma20,
    sma50,
    sma200,
    rsi14,
    volatility30d: vol,
    trend,
    technicalSummary:
      summaryParts.join(" · "),
  };
}

function marketStateFromTimestamp(
  providerTimestamp:
    | string
    | null
    | undefined,
  isRealtime: boolean
): RealtimeAssetSnapshot["marketState"] {
  if (!isRealtime) {
    return "Demo";
  }

  if (!providerTimestamp) {
    return "Delayed";
  }

  const ageMs =
    Date.now() -
    Date.parse(providerTimestamp);

  if (!Number.isFinite(ageMs)) {
    return "Delayed";
  }

  if (ageMs <= 2 * 60 * 1000) {
    return "Live";
  }

  if (ageMs <= 20 * 60 * 1000) {
    return "Delayed";
  }

  return "Stale";
}

function qualityScore(
  snapshot: Omit<
    RealtimeAssetSnapshot,
    "qualityScore"
  >
) {
  let score = 0;

  if (snapshot.isRealtime) {
    score += 35;
  }

  if (snapshot.price > 0) {
    score += 20;
  }

  if (
    snapshot.previousClose &&
    snapshot.previousClose > 0
  ) {
    score += 10;
  }

  if (
    typeof snapshot.changePercent ===
    "number"
  ) {
    score += 10;
  }

  if (
    typeof snapshot.volume ===
    "number"
  ) {
    score += 5;
  }

  if (
    snapshot.technicals.sma50 ||
    snapshot.technicals.rsi14
  ) {
    score += 10;
  }

  if (
    snapshot.marketState === "Live"
  ) {
    score += 10;
  }

  if (
    snapshot.marketState === "Stale"
  ) {
    score -= 20;
  }

  if (
    snapshot.marketState === "Demo"
  ) {
    score -= 35;
  }

  return clamp(score, 0, 100);
}

function finalizeSnapshot(
  snapshot: Omit<
    RealtimeAssetSnapshot,
    "qualityScore"
  >
): RealtimeAssetSnapshot {
  const warnings = [
    ...snapshot.warnings,
  ];

  if (!snapshot.isRealtime) {
    warnings.push(
      "Demo or delayed fallback — connect an entitled real-time provider for production."
    );
  }

  if (
    snapshot.marketState === "Stale"
  ) {
    warnings.push(
      "Provider timestamp is stale."
    );
  }

  if (
    !snapshot.technicals.sma50 &&
    snapshot.isRealtime
  ) {
    warnings.push(
      "This quote adapter did not return enough historical data for full technicals."
    );
  }

  const withWarnings = {
    ...snapshot,
    warnings: Array.from(
      new Set(warnings)
    ),
  };

  return {
    ...withWarnings,
    qualityScore:
      qualityScore(withWarnings),
  };
}

async function fetchFinnhubSnapshots(
  symbols: string[]
) {
  const apiKey =
    process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return {
      snapshots:
        [] as RealtimeAssetSnapshot[],
      warnings: [
        "FINNHUB_API_KEY not configured.",
      ],
    };
  }

  const snapshots =
    await Promise.all(
      symbols.map(async (symbol) => {
        const mappedSymbol =
          providerSymbol(
            symbol,
            "finnhub"
          );

        const quoteUrl =
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            mappedSymbol
          )}&token=${encodeURIComponent(
            apiKey
          )}`;

        const quote =
          await fetchJson<{
            c?: number;
            d?: number;
            dp?: number;
            h?: number;
            l?: number;
            o?: number;
            pc?: number;
            t?: number;
          }>(quoteUrl);

        const price = toNumber(
          quote.data.c
        );

        if (!price) {
          return null;
        }

        const to = Math.floor(
          Date.now() / 1000
        );

        const from =
          to -
          60 * 60 * 24 * 370;

        let closes: number[] = [];

        try {
          const candleUrl =
            `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
              mappedSymbol
            )}&resolution=D&from=${from}&to=${to}&token=${encodeURIComponent(
              apiKey
            )}`;

          const candles =
            await fetchJson<{
              s?: string;
              c?: number[];
            }>(
              candleUrl,
              undefined,
              10_000
            );

          if (
            candles.data.s === "ok" &&
            Array.isArray(
              candles.data.c
            )
          ) {
            closes =
              candles.data.c.filter(
                (value) =>
                  Number.isFinite(value)
              );
          }
        } catch {
          closes = [];
        }

        const providerTimestamp =
          quote.data.t
            ? new Date(
                quote.data.t * 1000
              ).toISOString()
            : null;

        const base = {
          symbol,
          providerSymbol:
            mappedSymbol,
          assetType:
            mappedSymbol.includes(
              "BINANCE"
            )
              ? "Crypto"
              : "Equity",
          provider: "Finnhub",
          isRealtime: true,
          price:
            round(price, 4) ??
            price,
          previousClose: round(
            toNumber(quote.data.pc),
            4
          ),
          change: round(
            toNumber(quote.data.d),
            4
          ),
          changePercent: round(
            toNumber(quote.data.dp),
            4
          ),
          bid: null,
          ask: null,
          volume: null,
          currency: "USD",
          marketState:
            marketStateFromTimestamp(
              providerTimestamp,
              true
            ),
          latencyMs:
            quote.latencyMs,
          providerTimestamp,
          receivedAt:
            new Date().toISOString(),
          technicals:
            computeTechnicals(closes),
          warnings: [],
          raw: quote.data,
        } satisfies Omit<
          RealtimeAssetSnapshot,
          "qualityScore"
        >;

        return finalizeSnapshot(base);
      })
    );

  return {
    snapshots:
      snapshots.filter(
        Boolean
      ) as RealtimeAssetSnapshot[],
    warnings: [] as string[],
  };
}

async function fetchTwelveDataSnapshots(
  symbols: string[]
) {
  const apiKey =
    process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return {
      snapshots:
        [] as RealtimeAssetSnapshot[],
      warnings: [
        "TWELVE_DATA_API_KEY not configured.",
      ],
    };
  }

  const snapshots =
    await Promise.all(
      symbols.map(async (symbol) => {
        const mappedSymbol =
          providerSymbol(
            symbol,
            "twelvedata"
          );

        const quoteUrl =
          `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
            mappedSymbol
          )}&apikey=${encodeURIComponent(
            apiKey
          )}`;

        const quote =
          await fetchJson<
            Record<string, unknown>
          >(quoteUrl);

        const price =
          toNumber(
            quote.data.close
          ) ??
          toNumber(
            quote.data.price
          ) ??
          toNumber(
            quote.data["05. price"]
          );

        if (!price) {
          return null;
        }

        let closes: number[] = [];

        try {
          const historyUrl =
            `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
              mappedSymbol
            )}&interval=1day&outputsize=220&apikey=${encodeURIComponent(
              apiKey
            )}`;

          const history =
            await fetchJson<{
              values?: Array<{
                close?:
                  | string
                  | number;
              }>;
            }>(historyUrl);

          closes =
            history.data.values
              ?.map((item) =>
                toNumber(item.close)
              )
              .filter(
                (
                  value
                ): value is number =>
                  typeof value ===
                  "number"
              )
              .reverse() ?? [];
        } catch {
          closes = [];
        }

        const previousClose =
          toNumber(
            quote.data.previous_close
          ) ??
          toNumber(
            quote.data.prev_close
          );

        const change = toNumber(
          quote.data.change
        );

        const changePercent =
          toNumber(
            quote.data.percent_change
          ) ??
          (previousClose
            ? ((price -
                previousClose) /
                previousClose) *
              100
            : null);

        const datetime =
          typeof quote.data.datetime ===
          "string"
            ? quote.data.datetime
            : null;

        const providerTimestamp =
          datetime
            ? new Date(
                datetime
              ).toISOString()
            : null;

        const base = {
          symbol,
          providerSymbol:
            mappedSymbol,
          assetType:
            mappedSymbol.includes("/")
              ? "Crypto"
              : "Equity",
          provider: "Twelve Data",
          isRealtime: true,
          price:
            round(price, 4) ??
            price,
          previousClose: round(
            previousClose,
            4
          ),
          change: round(change, 4),
          changePercent: round(
            changePercent,
            4
          ),
          bid: null,
          ask: null,
          volume: toNumber(
            quote.data.volume
          ),
          currency: "USD",
          marketState:
            marketStateFromTimestamp(
              providerTimestamp,
              true
            ),
          latencyMs:
            quote.latencyMs,
          providerTimestamp,
          receivedAt:
            new Date().toISOString(),
          technicals:
            computeTechnicals(closes),
          warnings: [],
          raw: quote.data,
        } satisfies Omit<
          RealtimeAssetSnapshot,
          "qualityScore"
        >;

        return finalizeSnapshot(base);
      })
    );

  return {
    snapshots:
      snapshots.filter(
        Boolean
      ) as RealtimeAssetSnapshot[],
    warnings: [] as string[],
  };
}

function isAlphaVantageEquitySymbol(
  symbol: string
) {
  const clean =
    normalizeSymbol(symbol);

  if (!clean) {
    return false;
  }

  if (clean.includes(":")) {
    return false;
  }

  if (clean.includes("/")) {
    return false;
  }

  if (
    clean.includes("BTC") ||
    clean.includes("ETH")
  ) {
    return false;
  }

  return true;
}

function alphaProviderError(
  payload: {
    Information?: string;
    Note?: string;
    message?: string;
    "Error Message"?: string;
  }
) {
  return (
    payload["Error Message"] ||
    payload.Information ||
    payload.Note ||
    null
  );
}

function alphaBulkRows(
  payload: AlphaVantageBulkResponse
) {
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (
    Array.isArray(payload.quotes)
  ) {
    return payload.quotes;
  }

  if (
    Array.isArray(
      payload.realtime_quotes
    )
  ) {
    return payload.realtime_quotes;
  }

  return [];
}

function parseAlphaTimestamp(
  value: unknown
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const raw = value.trim();

  const direct = Date.parse(raw);

  if (Number.isFinite(direct)) {
    return new Date(
      direct
    ).toISOString();
  }

  const normalized =
    raw.replace(" ", "T");

  const utcGuess = Date.parse(
    `${normalized}Z`
  );

  return Number.isFinite(utcGuess)
    ? new Date(
        utcGuess
      ).toISOString()
    : null;
}

function buildAlphaBulkSnapshot(
  requestedSymbol: string,
  row: AlphaVantageBulkQuote,
  latencyMs: number,
  receivedAt: string
) {
  const regularPrice = toNumber(
    row.close
  );

  const extendedPrice = toNumber(
    row.extended_hours_quote
  );

  const hasExtendedPrice =
    Boolean(
      extendedPrice &&
        extendedPrice > 0
    );

  const price = hasExtendedPrice
    ? extendedPrice
    : regularPrice;

  if (!price || price <= 0) {
    return null;
  }

  const previousClose = toNumber(
    row.previous_close
  );

  const providerChange =
    hasExtendedPrice
      ? toNumber(
          row.extended_hours_change
        )
      : toNumber(row.change);

  const calculatedChange =
    previousClose &&
    previousClose > 0
      ? price - previousClose
      : null;

  const change =
    providerChange ??
    calculatedChange;

  const providerPercent =
    hasExtendedPrice
      ? toNumber(
          row.extended_hours_change_percent
        )
      : toNumber(
          row.change_percent
        );

  const changePercent =
    providerPercent ??
    (previousClose &&
    previousClose > 0 &&
    change !== null
      ? (change / previousClose) *
        100
      : null);

  const providerTimestamp =
    parseAlphaTimestamp(
      row.timestamp
    );

  const marketState: RealtimeAssetSnapshot["marketState"] =
    hasExtendedPrice
      ? "Live"
      : providerTimestamp
        ? marketStateFromTimestamp(
            providerTimestamp,
            true
          )
        : "Live";

  const base = {
    symbol: requestedSymbol,
    providerSymbol:
      normalizeSymbol(
        String(
          row.symbol ||
            requestedSymbol
        )
      ),
    assetType: "Equity",
    provider: "Alpha Vantage",
    isRealtime: true,
    price:
      round(price, 4) ?? price,
    previousClose: round(
      previousClose,
      4
    ),
    change: round(change, 4),
    changePercent: round(
      changePercent,
      4
    ),
    bid: null,
    ask: null,
    volume: toNumber(row.volume),
    currency: "USD",
    marketState,
    latencyMs,
    providerTimestamp,
    receivedAt,
    technicals:
      computeTechnicals([]),
    warnings: hasExtendedPrice
      ? [
          "Extended-hours quote is active.",
        ]
      : [],
    raw: row,
  } satisfies Omit<
    RealtimeAssetSnapshot,
    "qualityScore"
  >;

  return finalizeSnapshot(base);
}

async function fetchAlphaVantageBulkQuotes(
  symbols: string[],
  apiKey: string
): Promise<ProviderResult> {
  const cacheKey = symbols
    .map(normalizeSymbol)
    .sort()
    .join(",");

  const cached =
    alphaBulkCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.result;
  }

  const params = new URLSearchParams({
    function:
      "REALTIME_BULK_QUOTES",
    symbol: symbols.join(","),
    apikey: apiKey,
  });

  const quote =
    await fetchJson<AlphaVantageBulkResponse>(
      `https://www.alphavantage.co/query?${params.toString()}`,
      undefined,
      12_000
    );

  const rows =
    alphaBulkRows(quote.data);

  const providerError =
    alphaProviderError(quote.data);

  if (!rows.length) {
    throw new Error(
      providerError ||
        quote.data.message ||
        "Alpha Vantage returned no real-time bulk quote rows."
    );
  }

  const rowsBySymbol = new Map(
    rows
      .filter((row) => row.symbol)
      .map((row) => [
        normalizeSymbol(
          String(row.symbol)
        ),
        row,
      ])
  );

  const receivedAt =
    new Date().toISOString();

  const snapshots = symbols
    .map((symbol) => {
      const row =
        rowsBySymbol.get(
          normalizeSymbol(symbol)
        );

      return row
        ? buildAlphaBulkSnapshot(
            symbol,
            row,
            quote.latencyMs,
            receivedAt
          )
        : null;
    })
    .filter(
      (
        snapshot
      ): snapshot is RealtimeAssetSnapshot =>
        Boolean(snapshot)
    );

  const missing = symbols.filter(
    (symbol) =>
      !snapshots.some(
        (snapshot) =>
          snapshot.symbol === symbol
      )
  );

  const result: ProviderResult = {
    snapshots,
    warnings: [
      ...(providerError
        ? [providerError]
        : []),
      ...(missing.length
        ? [
            `Alpha Vantage bulk quotes did not return: ${missing.join(
              ", "
            )}.`,
          ]
        : []),
    ],
  };

  alphaBulkCache.set(cacheKey, {
    expiresAt:
      Date.now() +
      alphaCacheTtlMs(),
    result,
  });

  return result;
}

async function fetchAlphaVantageGlobalQuotes(
  symbols: string[],
  apiKey: string
): Promise<ProviderResult> {
  const entitlement =
    getAlphaVantageEntitlement();

  const warnings: string[] = [];

  const snapshots =
    await Promise.all(
      symbols.map(
        async (symbol) => {
          try {
            const mappedSymbol =
              providerSymbol(
                symbol,
                "alphavantage"
              );

            const params =
              new URLSearchParams({
                function:
                  "GLOBAL_QUOTE",
                symbol:
                  mappedSymbol,
                apikey: apiKey,
              });

            if (entitlement) {
              params.set(
                "entitlement",
                entitlement
              );
            }

            const quote =
              await fetchJson<AlphaVantageGlobalQuoteResponse>(
                `https://www.alphavantage.co/query?${params.toString()}`,
                undefined,
                10_000
              );

            const providerError =
              alphaProviderError(
                quote.data
              );

            if (providerError) {
              throw new Error(
                providerError
              );
            }

            const globalQuote =
              quote.data[
                "Global Quote"
              ] ?? {};

            const price = toNumber(
              globalQuote["05. price"]
            );

            if (!price) {
              return null;
            }

            const previousClose =
              toNumber(
                globalQuote[
                  "08. previous close"
                ]
              );

            const change =
              toNumber(
                globalQuote[
                  "09. change"
                ]
              ) ??
              (previousClose
                ? price -
                  previousClose
                : null);

            const changePercent =
              toNumber(
                globalQuote[
                  "10. change percent"
                ]
              ) ??
              (previousClose &&
              change !== null
                ? (change /
                    previousClose) *
                  100
                : null);

            const receivedAt =
              new Date().toISOString();

            const isRealtime =
              entitlement ===
              "realtime";

            const latestTradingDay =
              globalQuote[
                "07. latest trading day"
              ];

            const providerTimestamp =
              isRealtime
                ? receivedAt
                : latestTradingDay
                  ? new Date(
                      `${latestTradingDay}T21:00:00.000Z`
                    ).toISOString()
                  : null;

            const marketState: RealtimeAssetSnapshot["marketState"] =
              isRealtime
                ? "Live"
                : "Delayed";

            const base = {
              symbol,
              providerSymbol:
                mappedSymbol,
              assetType: "Equity",
              provider:
                "Alpha Vantage",
              isRealtime,
              price:
                round(price, 4) ??
                price,
              previousClose: round(
                previousClose,
                4
              ),
              change: round(
                change,
                4
              ),
              changePercent: round(
                changePercent,
                4
              ),
              bid: null,
              ask: null,
              volume: toNumber(
                globalQuote[
                  "06. volume"
                ]
              ),
              currency: "USD",
              marketState,
              latencyMs:
                quote.latencyMs,
              providerTimestamp,
              receivedAt,
              technicals:
                computeTechnicals([]),
              warnings: isRealtime
                ? [
                    "GLOBAL_QUOTE fallback used because a bulk quote was unavailable.",
                  ]
                : [
                    "Alpha Vantage GLOBAL_QUOTE is not marked real time. Set ALPHA_VANTAGE_ENTITLEMENT=realtime after completing entitlement.",
                  ],
              raw: globalQuote,
            } satisfies Omit<
              RealtimeAssetSnapshot,
              "qualityScore"
            >;

            return finalizeSnapshot(
              base
            );
          } catch (error) {
            warnings.push(
              `${symbol}: ${
                error instanceof Error
                  ? error.message
                  : "Alpha Vantage quote failed"
              }`
            );

            return null;
          }
        }
      )
    );

  return {
    snapshots:
      snapshots.filter(
        Boolean
      ) as RealtimeAssetSnapshot[],
    warnings,
  };
}

async function fetchAlphaVantageSnapshots(
  symbols: string[]
) {
  const apiKey =
    process.env
      .ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return {
      snapshots:
        [] as RealtimeAssetSnapshot[],
      warnings: [
        "ALPHA_VANTAGE_API_KEY not configured.",
      ],
    };
  }

  const eligibleSymbols =
    symbols
      .filter(
        isAlphaVantageEquitySymbol
      )
      .slice(0, 100);

  if (!eligibleSymbols.length) {
    return {
      snapshots:
        [] as RealtimeAssetSnapshot[],
      warnings: [] as string[],
    };
  }

  try {
    const bulk =
      await fetchAlphaVantageBulkQuotes(
        eligibleSymbols,
        apiKey
      );

    const receivedSymbols =
      new Set(
        bulk.snapshots.map(
          (snapshot) =>
            snapshot.symbol
        )
      );

    const missing =
      eligibleSymbols.filter(
        (symbol) =>
          !receivedSymbols.has(symbol)
      );

    if (!missing.length) {
      return bulk;
    }

    const fallback =
      await fetchAlphaVantageGlobalQuotes(
        missing,
        apiKey
      );

    return {
      snapshots: [
        ...bulk.snapshots,
        ...fallback.snapshots,
      ],
      warnings: [
        ...bulk.warnings,
        ...fallback.warnings,
      ],
    };
  } catch (error) {
    const fallback =
      await fetchAlphaVantageGlobalQuotes(
        eligibleSymbols,
        apiKey
      );

    return {
      snapshots:
        fallback.snapshots,
      warnings: [
        `Alpha Vantage bulk quote failed: ${
          error instanceof Error
            ? error.message
            : "Unknown bulk quote error"
        }`,
        ...fallback.warnings,
      ],
    };
  }
}

function demoSnapshot(
  symbol: string
): RealtimeAssetSnapshot {
  const hash = simpleHash(symbol);

  const minuteWave = Math.sin(
    Date.now() / 60_000 + hash
  );

  const basePrice =
    20 + (hash % 900);

  const price =
    round(
      basePrice +
        minuteWave *
          (basePrice * 0.012),
      2
    ) ?? basePrice;

  const previousClose = round(
    basePrice,
    2
  );

  const change = previousClose
    ? round(
        price - previousClose,
        2
      )
    : null;

  const changePercent =
    previousClose &&
    change !== null
      ? round(
          (change /
            previousClose) *
            100,
          2
        )
      : null;

  const closes = Array.from(
    {
      length: 220,
    },
    (_, index) => {
      const drift =
        index * 0.05;

      const wave =
        Math.sin(
          index / 9 + hash
        ) * 4;

      return Math.max(
        1,
        basePrice * 0.82 +
          drift +
          wave
      );
    }
  );

  const base = {
    symbol,
    providerSymbol: symbol,
    assetType:
      symbol.includes("BTC") ||
      symbol.includes("ETH")
        ? "Crypto"
        : "Equity",
    provider: "Demo fallback",
    isRealtime: false,
    price,
    previousClose,
    change,
    changePercent,
    bid: null,
    ask: null,
    volume:
      1_000_000 +
      (hash % 9_000_000),
    currency: "USD",
    marketState: "Demo" as const,
    latencyMs: 0,
    providerTimestamp: null,
    receivedAt:
      new Date().toISOString(),
    technicals:
      computeTechnicals(closes),
    warnings: [
      "Demo fallback value. Do not use for trading or client reporting.",
    ],
    raw: null,
  } satisfies Omit<
    RealtimeAssetSnapshot,
    "qualityScore"
  >;

  return finalizeSnapshot(base);
}

async function fetchProvider(
  provider: string,
  symbols: string[]
) {
  if (provider === "finnhub") {
    return fetchFinnhubSnapshots(
      symbols
    );
  }

  if (provider === "twelvedata") {
    return fetchTwelveDataSnapshots(
      symbols
    );
  }

  if (
    provider === "alphavantage"
  ) {
    return fetchAlphaVantageSnapshots(
      symbols
    );
  }

  return {
    snapshots:
      symbols.map(demoSnapshot),
    warnings: [] as string[],
  };
}

export async function getRealtimeMarketSnapshots(
  requestedSymbols?:
    | string[]
    | string
    | null
): Promise<RealtimeMarketResponse> {
  const symbols =
    normalizeSymbolList(
      requestedSymbols
    );

  const priority =
    providerPriority();

  const bySymbol = new Map<
    string,
    RealtimeAssetSnapshot
  >();

  const warnings: string[] = [];

  for (const provider of priority) {
    const missing = symbols.filter(
      (symbol) =>
        !bySymbol.has(symbol)
    );

    if (!missing.length) {
      break;
    }

    try {
      const result =
        await fetchProvider(
          provider,
          missing
        );

      for (const warning of
        result.warnings) {
        warnings.push(warning);
      }

      for (const snapshot of
        result.snapshots) {
        if (
          !bySymbol.has(
            snapshot.symbol
          )
        ) {
          bySymbol.set(
            snapshot.symbol,
            snapshot
          );
        }
      }
    } catch (error) {
      warnings.push(
        `${provider} failed: ${
          error instanceof Error
            ? error.message
            : "Unknown provider error"
        }`
      );
    }
  }

  for (const symbol of symbols) {
    if (!bySymbol.has(symbol)) {
      bySymbol.set(
        symbol,
        demoSnapshot(symbol)
      );
    }
  }

  const snapshots = symbols
    .map((symbol) =>
      bySymbol.get(symbol)
    )
    .filter(
      Boolean
    ) as RealtimeAssetSnapshot[];

  return {
    generatedAt:
      new Date().toISOString(),
    pollAfterMs: pollAfterMs(),
    providerPriority: priority,
    requestedSymbols: symbols,
    realtimeCount:
      snapshots.filter(
        (snapshot) =>
          snapshot.isRealtime
      ).length,
    delayedOrDemoCount:
      snapshots.filter(
        (snapshot) =>
          !snapshot.isRealtime ||
          snapshot.marketState !==
            "Live"
      ).length,
    staleCount:
      snapshots.filter(
        (snapshot) =>
          snapshot.marketState ===
          "Stale"
      ).length,
    warnings: Array.from(
      new Set(warnings)
    ),
    snapshots,
  };
}

export async function persistRealtimeSnapshots(
  userId:
    | string
    | null
    | undefined,
  snapshots: RealtimeAssetSnapshot[]
) {
  if (
    !userId ||
    !snapshots.length
  ) {
    return;
  }

  await prisma.realtimePriceSnapshot.createMany(
    {
      data: snapshots.map(
        (snapshot) => ({
          userId,
          symbol: snapshot.symbol,
          assetType:
            snapshot.assetType,
          provider:
            snapshot.provider,
          isRealtime:
            snapshot.isRealtime,
          price: snapshot.price,
          previousClose:
            snapshot.previousClose,
          change: snapshot.change,
          changePercent:
            snapshot.changePercent,
          bid: snapshot.bid,
          ask: snapshot.ask,
          volume: snapshot.volume,
          currency:
            snapshot.currency,
          marketState:
            snapshot.marketState,
          qualityScore:
            snapshot.qualityScore,
          latencyMs:
            snapshot.latencyMs,
          providerTimestamp:
            snapshot.providerTimestamp
              ? new Date(
                  snapshot.providerTimestamp
                )
              : null,
          receivedAt: new Date(
            snapshot.receivedAt
          ),
          technicalsJson:
            JSON.stringify(
              snapshot.technicals
            ),
          warningsJson:
            JSON.stringify(
              snapshot.warnings
            ),
          rawJson: JSON.stringify(
            snapshot.raw ?? {}
          ),
        })
      ),
    }
  );
}