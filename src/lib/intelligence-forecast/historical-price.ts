import type {
  ForecastHorizon,
} from "@/lib/intelligence-forecast/types";

type AlphaResponse =
  Record<string, unknown>;

type AlphaBar = {
  observedAt: Date;
  price: number;
  raw: Record<string, unknown>;
};

type CachedResponse = {
  expiresAt: number;
  body: AlphaResponse;
};

export type HistoricalPriceResolution = {
  symbol: string;
  horizon: ForecastHorizon;
  targetAt: Date;
  observedAt: Date;
  price: number;
  provider: string;
  providerTimestamp: Date;
  differenceMs: number;
  granularity: string;
  qualityScore: number;
  raw: unknown;
};

export type HistoricalPriceLookupResult = {
  resolution:
    | HistoricalPriceResolution
    | null;

  reason:
    | string
    | null;
};

const DEFAULT_TIME_ZONE =
  "America/New_York";

const CACHE_TTL_MS =
  10 * 60 * 1000;

const HISTORICAL_TOLERANCE_MS: Record<
  ForecastHorizon,
  number
> = {
  "5-30m":
    90 * 60 * 1000,

  intraday:
    24 * 60 * 60 * 1000,

  "1d":
    4 * 24 * 60 * 60 * 1000,

  "2-5d":
    5 * 24 * 60 * 60 * 1000,

  "1-4w":
    7 * 24 * 60 * 60 * 1000,

  "1-3m":
    10 * 24 * 60 * 60 * 1000,

  "3-12m":
    14 * 24 * 60 * 60 * 1000,

  "1-3y":
    21 * 24 * 60 * 60 * 1000,
};

const globalForHistoricalPrice =
  globalThis as unknown as {
    sliceAlphaHistoryCache?: Map<
      string,
      CachedResponse
    >;
  };

const responseCache =
  globalForHistoricalPrice
    .sliceAlphaHistoryCache ??
  new Map<
    string,
    CachedResponse
  >();

if (
  process.env.NODE_ENV !==
  "production"
) {
  globalForHistoricalPrice
    .sliceAlphaHistoryCache =
    responseCache;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function finiteNumber(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      String(value).replace(
        /,/g,
        "",
      ),
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function timeoutMs() {
  const parsed =
    Number(
      process.env
        .ALPHA_VANTAGE_HISTORICAL_TIMEOUT_MS,
    );

  if (!Number.isFinite(parsed)) {
    return 20_000;
  }

  return Math.max(
    5_000,
    Math.min(
      45_000,
      Math.round(parsed),
    ),
  );
}

function normalizeSymbol(
  symbol: string,
) {
  return symbol
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9.\-:$]/g,
      "",
    )
    .slice(0, 20);
}

function isIntradayHorizon(
  horizon: ForecastHorizon,
) {
  return (
    horizon === "5-30m" ||
    horizon === "intraday"
  );
}

function datePartsInZone(
  date: Date,
  timeZone: string,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
    );

  const parts =
    formatter.formatToParts(
      date,
    );

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ]),
    );

  return {
    year:
      Number(values.year),

    month:
      Number(values.month),

    day:
      Number(values.day),

    hour:
      Number(values.hour),

    minute:
      Number(values.minute),

    second:
      Number(values.second),
  };
}

function zonedLocalToUtc(
  localValue: string,
  timeZone: string,
) {
  const match =
    localValue.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/,
    );

  if (!match) {
    return null;
  }

  const desiredUtc =
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 16),
      Number(match[5] ?? 0),
      Number(match[6] ?? 0),
    );

  let guess =
    desiredUtc;

  /*
   * Convert the provider's wall-clock time
   * into UTC while allowing Intl to handle
   * daylight-saving changes.
   */
  for (
    let iteration = 0;
    iteration < 3;
    iteration += 1
  ) {
    const represented =
      datePartsInZone(
        new Date(guess),
        timeZone,
      );

    const representedUtc =
      Date.UTC(
        represented.year,
        represented.month - 1,
        represented.day,
        represented.hour,
        represented.minute,
        represented.second,
      );

    guess +=
      desiredUtc -
      representedUtc;
  }

  const result =
    new Date(guess);

  return Number.isFinite(
    result.getTime(),
  )
    ? result
    : null;
}

function providerTimeZone(
  body: AlphaResponse,
) {
  const metadata =
    Object.values(body).find(
      (value) =>
        isRecord(value) &&
        Object.keys(value).some(
          (key) =>
            key
              .toLowerCase()
              .includes(
                "time zone",
              ),
        ),
    );

  if (!isRecord(metadata)) {
    return DEFAULT_TIME_ZONE;
  }

  const entry =
    Object.entries(metadata).find(
      ([key]) =>
        key
          .toLowerCase()
          .includes(
            "time zone",
          ),
    );

  return cleanString(
    entry?.[1],
  ) || DEFAULT_TIME_ZONE;
}

function timeSeries(
  body: AlphaResponse,
) {
  const entry =
    Object.entries(body).find(
      ([key, value]) =>
        key.startsWith(
          "Time Series",
        ) &&
        isRecord(value),
    );

  return entry &&
    isRecord(entry[1])
    ? entry[1]
    : null;
}

function responseError(
  body: AlphaResponse,
) {
  const possibleMessages = [
    body["Error Message"],
    body.Information,
    body.Note,
  ];

  for (
    const value of
      possibleMessages
  ) {
    const message =
      cleanString(value);

    if (message) {
      return message.slice(
        0,
        500,
      );
    }
  }

  return null;
}

async function alphaRequest(
  input: {
    cacheKey: string;
    parameters:
      Record<string, string>;
  },
) {
  const cached =
    responseCache.get(
      input.cacheKey,
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.body;
  }

  const apiKey =
    process.env
      .ALPHA_VANTAGE_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "ALPHA_VANTAGE_API_KEY is not configured.",
    );
  }

  const url =
    new URL(
      "https://www.alphavantage.co/query",
    );

  for (
    const [key, value] of
      Object.entries(
        input.parameters,
      )
  ) {
    url.searchParams.set(
      key,
      value,
    );
  }

  url.searchParams.set(
    "apikey",
    apiKey,
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs(),
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "SliceHistoricalSettlement/1.0",
          },
        },
      );

    let body:
      AlphaResponse;

    try {
      body =
        (await response.json()) as AlphaResponse;
    } catch {
      throw new Error(
        "Alpha Vantage returned invalid JSON.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `Alpha Vantage returned HTTP ${response.status}.`,
      );
    }

    const providerError =
      responseError(body);

    if (providerError) {
      throw new Error(
        providerError,
      );
    }

    responseCache.set(
      input.cacheKey,
      {
        expiresAt:
          Date.now() +
          CACHE_TTL_MS,

        body,
      },
    );

    return body;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

function parseBars(
  body: AlphaResponse,
  daily: boolean,
) {
  const series =
    timeSeries(body);

  if (!series) {
    throw new Error(
      "Alpha Vantage did not return a time series.",
    );
  }

  const timeZone =
    providerTimeZone(body);

  const bars:
    AlphaBar[] = [];

  for (
    const [
      timestamp,
      rawValue,
    ] of Object.entries(
      series,
    )
  ) {
    if (!isRecord(rawValue)) {
      continue;
    }

    const price =
      finiteNumber(
        rawValue[
          "5. adjusted close"
        ] ??
          rawValue[
            "4. close"
          ],
      );

    if (
      price === null ||
      price <= 0
    ) {
      continue;
    }

    const localTimestamp =
      daily
        ? `${timestamp} 16:00:00`
        : timestamp;

    const observedAt =
      zonedLocalToUtc(
        localTimestamp,
        timeZone,
      );

    if (!observedAt) {
      continue;
    }

    bars.push({
      observedAt,
      price,
      raw: rawValue,
    });
  }

  bars.sort(
    (left, right) =>
      left.observedAt.getTime() -
      right.observedAt.getTime(),
  );

  return {
    bars,
    timeZone,
  };
}

function monthInZone(
  date: Date,
  timeZone: string,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
      },
    );

  const parts =
    formatter.formatToParts(
      date,
    );

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ]),
    );

  return `${values.year}-${values.month}`;
}

function nextMonth(
  monthValue: string,
) {
  const [
    year,
    month,
  ] =
    monthValue
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
  ].join("-");
}

async function intradayBars(
  symbol: string,
  month: string,
) {
  const body =
    await alphaRequest({
      cacheKey:
        `intraday|${symbol}|${month}|5min`,

      parameters: {
        function:
          "TIME_SERIES_INTRADAY",

        symbol,

        interval:
          "5min",

        month,

        outputsize:
          "full",

        adjusted:
          "true",

        extended_hours:
          "false",

        datatype:
          "json",
      },
    });

  return parseBars(
    body,
    false,
  );
}

async function dailyBars(
  symbol: string,
) {
  try {
    const adjusted =
      await alphaRequest({
        cacheKey:
          `daily-adjusted|${symbol}`,

        parameters: {
          function:
            "TIME_SERIES_DAILY_ADJUSTED",

          symbol,

          outputsize:
            "compact",

          datatype:
            "json",
        },
      });

    return {
      ...parseBars(
        adjusted,
        true,
      ),

      provider:
        "Alpha Vantage Daily Adjusted",
    };
  } catch (
    adjustedError
  ) {
    /*
     * Some Alpha Vantage plans do not
     * include the adjusted endpoint.
     * Use raw daily closes as a safe,
     * clearly labeled fallback.
     */
    const raw =
      await alphaRequest({
        cacheKey:
          `daily-raw|${symbol}`,

        parameters: {
          function:
            "TIME_SERIES_DAILY",

          symbol,

          outputsize:
            "compact",

          datatype:
            "json",
        },
      });

    return {
      ...parseBars(
        raw,
        true,
      ),

      provider:
        "Alpha Vantage Daily",

      adjustedEndpointError:
        adjustedError instanceof Error
          ? adjustedError.message
          : "Adjusted daily endpoint unavailable.",
    };
  }
}

function firstBarAfterTarget(
  bars: AlphaBar[],
  targetAt: Date,
  toleranceMs: number,
) {
  const candidate =
    bars.find(
      (bar) =>
        bar.observedAt.getTime() >=
        targetAt.getTime(),
    );

  if (!candidate) {
    return null;
  }

  const differenceMs =
    candidate.observedAt.getTime() -
    targetAt.getTime();

  if (
    differenceMs >
    toleranceMs
  ) {
    return null;
  }

  return {
    candidate,
    differenceMs,
  };
}

export async function lookupHistoricalOutcomePrice(
  input: {
    symbol: string;
    horizon: ForecastHorizon;
    targetAt: Date;
  },
): Promise<HistoricalPriceLookupResult> {
  const symbol =
    normalizeSymbol(
      input.symbol,
    );

  if (!symbol) {
    return {
      resolution: null,
      reason:
        "A valid symbol is required.",
    };
  }

  if (
    !Number.isFinite(
      input.targetAt.getTime(),
    )
  ) {
    return {
      resolution: null,
      reason:
        "A valid target date is required.",
    };
  }

  if (
    !process.env
      .ALPHA_VANTAGE_API_KEY
      ?.trim()
  ) {
    return {
      resolution: null,
      reason:
        "ALPHA_VANTAGE_API_KEY is not configured.",
    };
  }

  const toleranceMs =
    HISTORICAL_TOLERANCE_MS[
      input.horizon
    ];

  try {
    if (
      isIntradayHorizon(
        input.horizon,
      )
    ) {
      const targetMonth =
        monthInZone(
          input.targetAt,
          DEFAULT_TIME_ZONE,
        );

      const months = [
        targetMonth,
        nextMonth(
          targetMonth,
        ),
      ];

      const combinedBars:
        AlphaBar[] = [];

      let timeZone =
        DEFAULT_TIME_ZONE;

      for (
        const month of months
      ) {
        const result =
          await intradayBars(
            symbol,
            month,
          );

        timeZone =
          result.timeZone;

        combinedBars.push(
          ...result.bars,
        );

        const available =
          firstBarAfterTarget(
            combinedBars.sort(
              (
                left,
                right,
              ) =>
                left.observedAt.getTime() -
                right.observedAt.getTime(),
            ),
            input.targetAt,
            toleranceMs,
          );

        if (available) {
          return {
            resolution: {
              symbol,
              horizon:
                input.horizon,
              targetAt:
                input.targetAt,
              observedAt:
                available
                  .candidate
                  .observedAt,
              price:
                available
                  .candidate
                  .price,
              provider:
                "Alpha Vantage Intraday",
              providerTimestamp:
                available
                  .candidate
                  .observedAt,
              differenceMs:
                available
                  .differenceMs,
              granularity:
                "5min",
              qualityScore:
                90,
              raw: {
                providerTimeZone:
                  timeZone,
                bar:
                  available
                    .candidate
                    .raw,
              },
            },

            reason: null,
          };
        }
      }

      return {
        resolution: null,

        reason:
          "No five-minute market bar was found after the target within the permitted tolerance.",
      };
    }

    const result =
      await dailyBars(
        symbol,
      );

    const available =
      firstBarAfterTarget(
        result.bars,
        input.targetAt,
        toleranceMs,
      );

    if (!available) {
      return {
        resolution: null,

        reason:
          "No daily market bar was found after the target within the permitted tolerance.",
      };
    }

    return {
      resolution: {
        symbol,
        horizon:
          input.horizon,
        targetAt:
          input.targetAt,
        observedAt:
          available
            .candidate
            .observedAt,
        price:
          available
            .candidate
            .price,
        provider:
          result.provider,
        providerTimestamp:
          available
            .candidate
            .observedAt,
        differenceMs:
          available
            .differenceMs,
        granularity:
          "daily-close",
        qualityScore:
          result.provider.includes(
            "Adjusted",
          )
            ? 92
            : 85,
        raw: {
          providerTimeZone:
            result.timeZone,
          bar:
            available
              .candidate
              .raw,
          adjustedEndpointError:
            "adjustedEndpointError" in
              result
              ? result
                  .adjustedEndpointError
              : null,
        },
      },

      reason: null,
    };
  } catch (error) {
    return {
      resolution: null,

      reason:
        error instanceof Error
          ? `Historical price lookup failed: ${error.message}`
          : "Historical price lookup failed for an unknown reason.",
    };
  }
}