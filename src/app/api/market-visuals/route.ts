import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALPHA_URL = "https://www.alphavantage.co/query";

const VALID_INTERVALS = new Set([
  "1min",
  "5min",
  "15min",
  "30min",
  "60min",
  "daily",
]);

const CACHE = new Map<
  string,
  {
    expiresAt: number;
    payload: MarketVisualPayload;
  }
>();

type AlphaPayload = Record<string, unknown> & {
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type ProviderCall = {
  endpoint: string;
  status: "live" | "current" | "unavailable";
  asOf: string | null;
  error: string | null;
};

type Candle = {
  date: string;
  providerDate: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number;
  dividendAmount: number | null;
  splitCoefficient: number | null;
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
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  atr14: number | null;
  volumeSma20: number | null;
  returnPct: number | null;
  cumulativeReturnPct: number | null;
  rangePct: number | null;
};

type IndicatorFields = Pick<
  Candle,
  | "sma20"
  | "sma50"
  | "sma100"
  | "sma200"
  | "ema9"
  | "ema21"
  | "vwap"
  | "rsi14"
  | "macd"
  | "macdSignal"
  | "macdHistogram"
  | "bollingerUpper"
  | "bollingerMiddle"
  | "bollingerLower"
  | "atr14"
  | "volumeSma20"
  | "returnPct"
  | "cumulativeReturnPct"
  | "rangePct"
>;

type RawCandle = Omit<Candle, keyof IndicatorFields>;

type RealtimeQuote = {
  symbol: string;
  price: number;
  regularPrice: number | null;
  extendedHoursPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  timestamp: string;
  session: string;
  source:
    | "Alpha Vantage REALTIME_BULK_QUOTES"
    | "Alpha Vantage GLOBAL_QUOTE"
    | "Alpha Vantage time series";
};

type ForecastPoint = {
  step: number;
  date: string;
  label: string;
  projected: number;
  lower: number;
  upper: number;
  bearish: number;
  bullish: number;
};

type MarketVisualPayload = {
  symbol: string;
  interval: string;
  generatedAt: string;
  provider: "Alpha Vantage";
  providerOnly: true;
  entitlement: string | null;
  isRealtime: boolean;
  marketSession: ReturnType<typeof marketSession>;
  freshness: {
    status:
      | "Live"
      | "Delayed"
      | "Closed"
      | "Stale"
      | "Unavailable";
    asOf: string | null;
    ageSeconds: number | null;
    message: string;
  };
  quote: RealtimeQuote | null;
  company: ReturnType<typeof normalizeOverview>;
  earnings: ReturnType<typeof normalizeEarnings>;
  news: ReturnType<typeof normalizeNews>;
  options: ReturnType<typeof normalizeOptions>;
  candles: Candle[];
  latest: Candle | null;
  levels: ReturnType<typeof calculateLevels>;
  signals: ReturnType<typeof calculateSignals>;
  forecast: {
    points: ForecastPoint[];
    horizon: number;
    confidenceLevel: number;
    probabilityUp: number | null;
    probabilityDown: number | null;
    expectedMovePct: number | null;
    lowerMovePct: number | null;
    upperMovePct: number | null;
    annualizedVolatilityPct: number | null;
    driftPerStepPct: number | null;
    directionalBacktestPct: number | null;
    modelConfidence: number;
    methodology: string;
    scenarios: Array<{
      name: "Bear" | "Base" | "Bull";
      target: number | null;
      movePct: number | null;
      description: string;
    }>;
  };
  quality: {
    score: number;
    warnings: string[];
    calls: ProviderCall[];
  };
  pineLab: {
    openAiConfigured: boolean;
    model: string;
    pineVersion: 6;
  };
};

class AlphaVantageError extends Error {
  endpoint: string;

  constructor(endpoint: string, message: string) {
    super(message);
    this.name = "AlphaVantageError";
    this.endpoint = endpoint;
  }
}

function cleanSymbol(value: string | null) {
  return (value || "AAPL")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 16);
}

function cleanInterval(value: string | null) {
  const interval = (value || "5min").trim().toLowerCase();

  return VALID_INTERVALS.has(interval)
    ? interval
    : "5min";
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(min, Math.min(max, value));
}

function round(
  value: number | null | undefined,
  digits = 4
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

function toNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(
    String(value)
      .replace(/[$,%]/g, "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getEntitlement() {
  const value = String(
    process.env.ALPHA_VANTAGE_ENTITLEMENT ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    value === "realtime" ||
    value === "delayed"
  ) {
    return value;
  }

  return null;
}

function providerError(payload: AlphaPayload) {
  return (
    payload["Error Message"] ||
    payload.Information ||
    payload.Note ||
    null
  );
}

async function alphaRequest(
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = 15_000
): Promise<AlphaPayload> {
  const apiKey =
    process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new AlphaVantageError(
      endpoint,
      "ALPHA_VANTAGE_API_KEY is not configured."
    );
  }

  const url = new URL(ALPHA_URL);

  url.searchParams.set(
    "function",
    endpoint
  );

  url.searchParams.set(
    "apikey",
    apiKey
  );

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(
      url.toString(),
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "SliceMarketVisuals/3.0",
        },
      }
    );

    if (!response.ok) {
      throw new AlphaVantageError(
        endpoint,
        `Alpha Vantage returned HTTP ${response.status}.`
      );
    }

    const payload =
      (await response.json()) as AlphaPayload;

    const error =
      providerError(payload);

    if (error) {
      throw new AlphaVantageError(
        endpoint,
        String(error)
      );
    }

    return payload;
  } catch (error) {
    if (
      error instanceof AlphaVantageError
    ) {
      throw error;
    }

    throw new AlphaVantageError(
      endpoint,
      error instanceof Error
        ? error.message
        : "Alpha Vantage request failed."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function callResult(
  endpoint: string,
  result: PromiseSettledResult<AlphaPayload>,
  status: ProviderCall["status"]
): ProviderCall {
  return result.status === "fulfilled"
    ? {
        endpoint,
        status,
        asOf: new Date().toISOString(),
        error: null,
      }
    : {
        endpoint,
        status: "unavailable",
        asOf: null,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(
                result.reason ||
                  "Provider call failed."
              ),
      };
}

function easternParts(date = new Date()) {
  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const parts =
    formatter.formatToParts(date);

  const get = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? "";

  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

function marketSession() {
  const parts = easternParts();

  const minute =
    parts.hour * 60 + parts.minute;

  const weekend =
    parts.weekday === "Sat" ||
    parts.weekday === "Sun";

  if (weekend) {
    return {
      session: "Closed",
      description: "Weekend",
      isOpen: false,
      isExtendedHours: false,
      timezone: "America/New_York",
    };
  }

  if (
    minute >= 4 * 60 &&
    minute < 9 * 60 + 30
  ) {
    return {
      session: "Pre-Market",
      description:
        "4:00 AM–9:30 AM ET",
      isOpen: true,
      isExtendedHours: true,
      timezone: "America/New_York",
    };
  }

  if (
    minute >= 9 * 60 + 30 &&
    minute < 16 * 60
  ) {
    return {
      session: "Regular Market",
      description:
        "9:30 AM–4:00 PM ET",
      isOpen: true,
      isExtendedHours: false,
      timezone: "America/New_York",
    };
  }

  if (
    minute >= 16 * 60 &&
    minute < 20 * 60
  ) {
    return {
      session: "After-Hours",
      description:
        "4:00 PM–8:00 PM ET",
      isOpen: true,
      isExtendedHours: true,
      timezone: "America/New_York",
    };
  }

  return {
    session: "Closed",
    description:
      "Outside US equity trading sessions",
    isOpen: false,
    isExtendedHours: false,
    timezone: "America/New_York",
  };
}

function zonedDateToUtc(
  value: string,
  daily = false
) {
  const normalized = value
    .trim()
    .replace(" ", "T");

  const [
    datePart,
    timePart = daily
      ? "12:00:00"
      : "00:00:00",
  ] = normalized.split("T");

  const [year, month, day] =
    datePart.split("-").map(Number);

  const [hour, minute, second] =
    timePart.split(":").map(Number);

  if (
    ![
      year,
      month,
      day,
      hour,
      minute,
    ].every(Number.isFinite)
  ) {
    return null;
  }

  const initial = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second || 0
    )
  );

  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const parts =
    formatter.formatToParts(initial);

  const get = (type: string) =>
    Number(
      parts.find(
        (part) => part.type === type
      )?.value ?? 0
    );

  const represented = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  const offset =
    represented - initial.getTime();

  return new Date(
    initial.getTime() - offset
  );
}

function labelFor(
  date: Date,
  interval: string
) {
  return interval === "daily"
    ? new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          month: "short",
          day: "numeric",
        }
      ).format(date)
    : new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "America/New_York",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      ).format(date);
}

function parseTimeSeries(
  payload: AlphaPayload,
  interval: string
) {
  const key =
    interval === "daily"
      ? payload["Time Series (Daily)"]
        ? "Time Series (Daily)"
        : "Time Series (Daily Adjusted)"
      : `Time Series (${interval})`;

  const rawSeries = payload[key];

  if (
    !rawSeries ||
    typeof rawSeries !== "object"
  ) {
    return [] as RawCandle[];
  }

  return Object.entries(
    rawSeries as Record<
      string,
      Record<string, string>
    >
  )
    .map(([providerDate, raw]) => {
      const parsedDate =
        zonedDateToUtc(
          providerDate,
          interval === "daily"
        );

      const open =
        toNumber(raw["1. open"]);

      const high =
        toNumber(raw["2. high"]);

      const low =
        toNumber(raw["3. low"]);

      const close =
        toNumber(raw["4. close"]);

      const volume = toNumber(
        raw["6. volume"] ??
          raw["5. volume"]
      );

      if (
        !parsedDate ||
        open === null ||
        high === null ||
        low === null ||
        close === null
      ) {
        return null;
      }

      return {
        date: parsedDate.toISOString(),
        providerDate,
        label: labelFor(
          parsedDate,
          interval
        ),
        open,
        high,
        low,
        close,
        adjustedClose: toNumber(
          raw["5. adjusted close"]
        ),
        volume: volume ?? 0,
        dividendAmount: toNumber(
          raw["7. dividend amount"]
        ),
        splitCoefficient: toNumber(
          raw["8. split coefficient"]
        ),
      };
    })
    .filter(
      (
        row
      ): row is NonNullable<
        typeof row
      > => Boolean(row)
    )
    .sort((a, b) =>
      a.date.localeCompare(b.date)
    );
}

function parseBulkQuote(
  payload: AlphaPayload,
  symbol: string,
  session: ReturnType<
    typeof marketSession
  >
) {
  const rows = Array.isArray(
    payload.data
  )
    ? payload.data
    : Array.isArray(payload.quotes)
      ? payload.quotes
      : Array.isArray(
            payload.realtime_quotes
          )
        ? payload.realtime_quotes
        : [];

  const row = (
    rows as Array<
      Record<string, unknown>
    >
  ).find(
    (item) =>
      String(
        item.symbol ?? ""
      ).toUpperCase() === symbol
  );

  if (!row) {
    return null;
  }

  const regularPrice =
    toNumber(row.close);

  const extendedPrice =
    toNumber(
      row.extended_hours_quote
    );

  const useExtended =
    session.isExtendedHours &&
    extendedPrice !== null &&
    extendedPrice > 0;

  const price = useExtended
    ? extendedPrice
    : regularPrice;

  if (
    price === null ||
    price <= 0
  ) {
    return null;
  }

  const previousClose =
    toNumber(row.previous_close);

  const providerChange =
    useExtended
      ? toNumber(
          row.extended_hours_change
        )
      : toNumber(row.change);

  const change =
    providerChange ??
    (previousClose !== null &&
    previousClose > 0
      ? price - previousClose
      : null);

  const providerChangePct =
    useExtended
      ? toNumber(
          row.extended_hours_change_percent
        )
      : toNumber(
          row.change_percent
        );

  const changePct =
    providerChangePct ??
    (previousClose !== null &&
    previousClose > 0 &&
    change !== null
      ? (change / previousClose) *
        100
      : null);

  const timestampRaw = String(
    row.timestamp ?? ""
  );

  const timestamp =
    zonedDateToUtc(
      timestampRaw
    )?.toISOString() ??
    new Date().toISOString();

  return {
    symbol,
    price,
    regularPrice,
    extendedHoursPrice:
      extendedPrice,
    previousClose,
    change,
    changePct,
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    volume: toNumber(row.volume),
    timestamp,
    session: session.session,
    source:
      "Alpha Vantage REALTIME_BULK_QUOTES" as const,
  };
}

function parseGlobalQuote(
  payload: AlphaPayload,
  symbol: string,
  session: ReturnType<
    typeof marketSession
  >
) {
  const row = (payload[
    "Global Quote"
  ] ?? {}) as Record<
    string,
    string
  >;

  const price =
    toNumber(row["05. price"]);

  if (
    price === null ||
    price <= 0
  ) {
    return null;
  }

  const previousClose =
    toNumber(
      row["08. previous close"]
    );

  const change =
    toNumber(
      row["09. change"]
    ) ??
    (previousClose !== null
      ? price - previousClose
      : null);

  const changePct =
    toNumber(
      row["10. change percent"]
    ) ??
    (previousClose !== null &&
    previousClose > 0 &&
    change !== null
      ? (change / previousClose) *
        100
      : null);

  return {
    symbol,
    price,
    regularPrice: price,
    extendedHoursPrice: null,
    previousClose,
    change,
    changePct,
    open: toNumber(
      row["02. open"]
    ),
    high: toNumber(
      row["03. high"]
    ),
    low: toNumber(
      row["04. low"]
    ),
    volume: toNumber(
      row["06. volume"]
    ),
    timestamp:
      new Date().toISOString(),
    session: session.session,
    source:
      "Alpha Vantage GLOBAL_QUOTE" as const,
  };
}

function quoteFromCandles(
  candles: RawCandle[],
  symbol: string,
  session: ReturnType<
    typeof marketSession
  >
): RealtimeQuote | null {
  const latest =
    candles[candles.length - 1];

  const previous =
    candles[candles.length - 2];

  if (!latest) {
    return null;
  }

  const change = previous
    ? latest.close -
      previous.close
    : null;

  const changePct =
    previous && previous.close
      ? (change! / previous.close) *
        100
      : null;

  return {
    symbol,
    price: latest.close,
    regularPrice: latest.close,
    extendedHoursPrice: null,
    previousClose:
      previous?.close ?? null,
    change,
    changePct,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    volume: latest.volume,
    timestamp: latest.date,
    session: session.session,
    source:
      "Alpha Vantage time series",
  };
}

function mergeRealtimeQuote(
  candles: RawCandle[],
  quote: RealtimeQuote | null,
  interval: string
) {
  if (
    !quote ||
    !candles.length
  ) {
    return candles;
  }

  const next = [...candles];

  const latest =
    next[next.length - 1];

  const quoteDate =
    new Date(quote.timestamp);

  const latestDate =
    new Date(latest.date);

  if (interval === "daily") {
    const dateParts = (
      input: Date
    ) => {
      const parts =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone:
              "America/New_York",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        ).formatToParts(input);

      const get = (type: string) =>
        parts.find(
          (part) =>
            part.type === type
        )?.value ?? "";

      return `${get("year")}-${get(
        "month"
      )}-${get("day")}`;
    };

    const quoteDay =
      dateParts(quoteDate);

    const latestDay =
      dateParts(latestDate);

    const liveRow: RawCandle = {
      date: quote.timestamp,
      providerDate: quoteDay,
      label: labelFor(
        quoteDate,
        interval
      ),
      open:
        quote.open ??
        (quoteDay === latestDay
          ? latest.open
          : quote.previousClose ??
            quote.price),
      high: Math.max(
        quote.high ?? quote.price,
        quote.price
      ),
      low: Math.min(
        quote.low ?? quote.price,
        quote.price
      ),
      close: quote.price,
      adjustedClose: quote.price,
      volume:
        quote.volume ??
        (quoteDay === latestDay
          ? latest.volume
          : 0),
      dividendAmount:
        quoteDay === latestDay
          ? latest.dividendAmount
          : null,
      splitCoefficient:
        quoteDay === latestDay
          ? latest.splitCoefficient
          : null,
    };

    if (quoteDay === latestDay) {
      next[next.length - 1] =
        liveRow;
    } else {
      next.push(liveRow);
    }

    return next;
  }

  if (
    quoteDate.getTime() >=
    latestDate.getTime()
  ) {
    next[next.length - 1] = {
      ...latest,
      date: quote.timestamp,
      label: labelFor(
        quoteDate,
        interval
      ),
      high: Math.max(
        latest.high,
        quote.price
      ),
      low: Math.min(
        latest.low,
        quote.price
      ),
      close: quote.price,
    };
  }

  return next;
}

function average(values: number[]) {
  return values.length
    ? values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    : 0;
}

function standardDeviation(
  values: number[]
) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);

  return Math.sqrt(
    average(
      values.map(
        (value) =>
          (value - mean) ** 2
      )
    )
  );
}

function movingAverage(
  values: number[],
  period: number
) {
  return values.map(
    (_, index) =>
      index < period - 1
        ? null
        : round(
            average(
              values.slice(
                index -
                  period +
                  1,
                index + 1
              )
            )
          )
  );
}

function exponentialMovingAverage(
  values: number[],
  period: number
) {
  if (!values.length) {
    return [] as Array<
      number | null
    >;
  }

  const multiplier =
    2 / (period + 1);

  let current = values[0];

  return values.map(
    (value, index) => {
      if (index === 0) {
        return round(current);
      }

      current =
        value * multiplier +
        current *
          (1 - multiplier);

      return round(current);
    }
  );
}

function calculateRsi(
  values: number[],
  period = 14
) {
  return values.map(
    (_, index) => {
      if (index < period) {
        return null;
      }

      const changes = values
        .slice(
          index - period,
          index + 1
        )
        .slice(1)
        .map(
          (value, offset) =>
            value -
            values[
              index -
                period +
                offset
            ]
        );

      const gains =
        changes.filter(
          (change) => change > 0
        );

      const losses = changes
        .filter(
          (change) => change < 0
        )
        .map(Math.abs);

      const averageGain =
        gains.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / period;

      const averageLoss =
        losses.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / period;

      if (!averageLoss) {
        return 100;
      }

      const rs =
        averageGain /
        averageLoss;

      return round(
        100 - 100 / (1 + rs),
        2
      );
    }
  );
}

function calculateVwap(
  candles: RawCandle[]
) {
  let typicalVolume = 0;
  let volume = 0;
  let currentSession = "";

  return candles.map((candle) => {
    const session =
      candle.providerDate.slice(
        0,
        10
      );

    if (
      session !== currentSession
    ) {
      currentSession = session;
      typicalVolume = 0;
      volume = 0;
    }

    const typical =
      (candle.high +
        candle.low +
        candle.close) /
      3;

    typicalVolume +=
      typical * candle.volume;

    volume += candle.volume;

    return volume
      ? round(
          typicalVolume / volume
        )
      : null;
  });
}

function calculateAtr(
  candles: RawCandle[],
  period = 14
) {
  const ranges = candles.map(
    (candle, index) => {
      const previous =
        candles[index - 1]
          ?.close ??
        candle.close;

      return Math.max(
        candle.high - candle.low,
        Math.abs(
          candle.high - previous
        ),
        Math.abs(
          candle.low - previous
        )
      );
    }
  );

  return movingAverage(
    ranges,
    period
  );
}

function enrichCandles(
  raw: RawCandle[]
) {
  const candles = raw.slice(-600);

  const closes = candles.map(
    (candle) => candle.close
  );

  const volumes = candles.map(
    (candle) => candle.volume
  );

  const sma20 = movingAverage(
    closes,
    20
  );

  const sma50 = movingAverage(
    closes,
    50
  );

  const sma100 = movingAverage(
    closes,
    100
  );

  const sma200 = movingAverage(
    closes,
    200
  );

  const ema9 =
    exponentialMovingAverage(
      closes,
      9
    );

  const ema21 =
    exponentialMovingAverage(
      closes,
      21
    );

  const rsi14 =
    calculateRsi(closes);

  const vwap =
    calculateVwap(candles);

  const atr14 =
    calculateAtr(candles);

  const volumeSma20 =
    movingAverage(volumes, 20);

  const ema12 =
    exponentialMovingAverage(
      closes,
      12
    ).map((value) => value ?? 0);

  const ema26 =
    exponentialMovingAverage(
      closes,
      26
    ).map((value) => value ?? 0);

  const macd = closes.map(
    (_, index) =>
      round(
        ema12[index] -
          ema26[index]
      )
  );

  const macdSignal =
    exponentialMovingAverage(
      macd.map(
        (value) => value ?? 0
      ),
      9
    );

  const macdHistogram =
    macd.map((value, index) =>
      value === null ||
      macdSignal[index] === null
        ? null
        : round(
            value -
              (macdSignal[
                index
              ] ?? 0)
          )
    );

  const bollingerMiddle = sma20;

  const bollingerUpper =
    closes.map((_, index) => {
      if (index < 19) {
        return null;
      }

      const sample =
        closes.slice(
          index - 19,
          index + 1
        );

      return round(
        average(sample) +
          standardDeviation(
            sample
          ) *
            2
      );
    });

  const bollingerLower =
    closes.map((_, index) => {
      if (index < 19) {
        return null;
      }

      const sample =
        closes.slice(
          index - 19,
          index + 1
        );

      return round(
        average(sample) -
          standardDeviation(
            sample
          ) *
            2
      );
    });

  const first =
    closes[0] || 1;

  return candles.map<Candle>(
    (candle, index) => {
      const previous =
        closes[index - 1];

      return {
        ...candle,
        sma20: sma20[index],
        sma50: sma50[index],
        sma100: sma100[index],
        sma200: sma200[index],
        ema9: ema9[index],
        ema21: ema21[index],
        vwap: vwap[index],
        rsi14: rsi14[index],
        macd: macd[index],
        macdSignal:
          macdSignal[index],
        macdHistogram:
          macdHistogram[index],
        bollingerUpper:
          bollingerUpper[index],
        bollingerMiddle:
          bollingerMiddle[index],
        bollingerLower:
          bollingerLower[index],
        atr14: atr14[index],
        volumeSma20:
          volumeSma20[index],
        returnPct: previous
          ? round(
              ((candle.close -
                previous) /
                previous) *
                100
            )
          : null,
        cumulativeReturnPct:
          round(
            ((candle.close -
              first) /
              first) *
              100
          ),
        rangePct: candle.close
          ? round(
              ((candle.high -
                candle.low) /
                candle.close) *
                100
            )
          : null,
      };
    }
  );
}

function calculateLevels(
  candles: Candle[]
) {
  const recent =
    candles.slice(-60);

  const latest =
    recent[recent.length - 1];

  if (!latest) {
    return {
      support: null,
      resistance: null,
      pivot: null,
      distanceToSupportPct:
        null,
      distanceToResistancePct:
        null,
    };
  }

  const support = Math.min(
    ...recent.map(
      (candle) => candle.low
    )
  );

  const resistance = Math.max(
    ...recent.map(
      (candle) => candle.high
    )
  );

  const pivot =
    (latest.high +
      latest.low +
      latest.close) /
    3;

  return {
    support: round(support),
    resistance:
      round(resistance),
    pivot: round(pivot),
    distanceToSupportPct:
      round(
        ((latest.close -
          support) /
          latest.close) *
          100,
        2
      ),
    distanceToResistancePct:
      round(
        ((resistance -
          latest.close) /
          latest.close) *
          100,
        2
      ),
  };
}

function calculateSignals(
  candles: Candle[]
) {
  const latest =
    candles[candles.length - 1];

  if (!latest) {
    return {
      directionalBias:
        "Unavailable",
      trend: "Unavailable",
      momentum: "Unavailable",
      volatility: "Unavailable",
      volume: "Unavailable",
      summary:
        "No Alpha Vantage candle data is available.",
    };
  }

  const trend =
    latest.sma50 !== null &&
    latest.sma200 !== null
      ? latest.sma50 >
        latest.sma200
        ? "Bullish long-term trend"
        : "Bearish long-term trend"
      : latest.sma20 !== null &&
          latest.sma50 !== null
        ? latest.sma20 >
          latest.sma50
          ? "Bullish short-term trend"
          : "Bearish short-term trend"
        : "Insufficient moving-average history";

  const rsiState =
    latest.rsi14 === null
      ? "RSI unavailable"
      : latest.rsi14 >= 70
        ? "Overbought RSI"
        : latest.rsi14 <= 30
          ? "Oversold RSI"
          : "Neutral RSI";

  const macdState =
    latest.macdHistogram === null
      ? "MACD unavailable"
      : latest.macdHistogram > 0
        ? "Positive MACD momentum"
        : "Negative MACD momentum";

  const aboveVwap =
    latest.vwap !== null
      ? latest.close >=
        latest.vwap
      : null;

  const above200 =
    latest.sma200 !== null
      ? latest.close >=
        latest.sma200
      : null;

  const directionalBias =
    aboveVwap === true &&
    above200 === true &&
    (latest.macdHistogram ?? 0) >
      0
      ? "Bullish"
      : aboveVwap === false &&
          above200 === false &&
          (latest.macdHistogram ??
            0) <
            0
        ? "Bearish"
        : "Mixed";

  const recentRanges =
    candles
      .slice(-20)
      .map(
        (candle) =>
          candle.rangePct ?? 0
      );

  const currentRange =
    latest.rangePct ?? 0;

  const averageRange =
    average(recentRanges);

  const volatility =
    currentRange >
    averageRange * 1.4
      ? "Elevated"
      : currentRange <
          averageRange * 0.7
        ? "Compressed"
        : "Normal";

  const volumeRatio =
    latest.volumeSma20
      ? latest.volume /
        latest.volumeSma20
      : null;

  const volume =
    volumeRatio === null
      ? "Volume baseline unavailable"
      : volumeRatio >= 1.25
        ? "Above-average volume"
        : volumeRatio <= 0.75
          ? "Below-average volume"
          : "Normal volume";

  return {
    directionalBias,
    trend,
    momentum:
      `${rsiState} · ${macdState}`,
    volatility,
    volume,
    summary:
      `${directionalBias} bias from Alpha Vantage price history. ` +
      `${trend}; ${rsiState}; ${macdState}; ${volume.toLowerCase()}.`,
  };
}

function erf(value: number) {
  const sign =
    value >= 0 ? 1 : -1;

  const x = Math.abs(value);

  const t =
    1 /
    (1 + 0.3275911 * x);

  const y =
    1 -
    (((((1.061405429 * t -
      1.453152027) *
      t +
      1.421413741) *
      t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x));

  return sign * y;
}

function normalCdf(value: number) {
  return (
    0.5 *
    (1 +
      erf(
        value / Math.sqrt(2)
      ))
  );
}

function zForConfidence(
  confidence: number
) {
  if (confidence >= 99) {
    return 2.5758;
  }

  if (confidence >= 95) {
    return 1.96;
  }

  if (confidence >= 90) {
    return 1.6449;
  }

  if (confidence >= 80) {
    return 1.2816;
  }

  return 1;
}

function weightedMean(
  values: number[],
  lambda = 0.94
) {
  if (!values.length) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  values.forEach(
    (value, index) => {
      const age =
        values.length -
        1 -
        index;

      const weight =
        (1 - lambda) *
        lambda ** age;

      numerator +=
        value * weight;

      denominator += weight;
    }
  );

  return denominator
    ? numerator / denominator
    : average(values);
}

function weightedVolatility(
  values: number[],
  mean: number,
  lambda = 0.94
) {
  if (values.length < 2) {
    return 0;
  }

  let numerator = 0;
  let denominator = 0;

  values.forEach(
    (value, index) => {
      const age =
        values.length -
        1 -
        index;

      const weight =
        (1 - lambda) *
        lambda ** age;

      numerator +=
        weight *
        (value - mean) ** 2;

      denominator += weight;
    }
  );

  return Math.sqrt(
    denominator
      ? numerator / denominator
      : 0
  );
}

function futureDate(
  lastDate: Date,
  interval: string,
  step: number
) {
  const date =
    new Date(lastDate);

  if (interval === "daily") {
    date.setDate(
      date.getDate() + step
    );
  } else {
    date.setMinutes(
      date.getMinutes() +
        Number(
          interval.replace(
            "min",
            ""
          )
        ) *
          step
    );
  }

  return date;
}

function directionalBacktest(
  closes: number[]
) {
  if (closes.length < 90) {
    return null;
  }

  let correct = 0;
  let tested = 0;

  for (
    let index = Math.max(
      61,
      closes.length - 50
    );
    index < closes.length;
    index += 1
  ) {
    const sample =
      closes.slice(
        index - 60,
        index
      );

    const sampleReturns =
      sample
        .slice(1)
        .map(
          (value, offset) =>
            Math.log(
              value /
                sample[offset]
            )
        );

    const drift =
      weightedMean(
        sampleReturns
      );

    const actual = Math.log(
      closes[index] /
        closes[index - 1]
    );

    if (
      (drift >= 0 &&
        actual >= 0) ||
      (drift < 0 &&
        actual < 0)
    ) {
      correct += 1;
    }

    tested += 1;
  }

  return tested
    ? (correct / tested) * 100
    : null;
}

function buildForecast(
  candles: Candle[],
  interval: string,
  horizon: number,
  confidence: number
) {
  const closes = candles
    .map((candle) => candle.close)
    .filter((value) => value > 0);

  const latest =
    candles[candles.length - 1];

  if (
    !latest ||
    closes.length < 30
  ) {
    return {
      points:
        [] as ForecastPoint[],
      horizon,
      confidenceLevel:
        confidence,
      probabilityUp: null,
      probabilityDown: null,
      expectedMovePct: null,
      lowerMovePct: null,
      upperMovePct: null,
      annualizedVolatilityPct:
        null,
      driftPerStepPct: null,
      directionalBacktestPct:
        null,
      modelConfidence: 0,
      methodology:
        "Insufficient Alpha Vantage history for the quantitative forecast.",
      scenarios: [
        {
          name: "Bear" as const,
          target: null,
          movePct: null,
          description:
            "Unavailable",
        },
        {
          name: "Base" as const,
          target: null,
          movePct: null,
          description:
            "Unavailable",
        },
        {
          name: "Bull" as const,
          target: null,
          movePct: null,
          description:
            "Unavailable",
        },
      ],
    };
  }

  const returns = closes
    .slice(1)
    .map(
      (value, index) =>
        Math.log(
          value / closes[index]
        )
    )
    .slice(-200);

  const ewmaDrift =
    weightedMean(returns);

  const sigma =
    weightedVolatility(
      returns,
      ewmaDrift
    );

  const recent =
    closes.slice(-60);

  const trend =
    recent.length > 1
      ? Math.log(
          recent[
            recent.length - 1
          ] / recent[0]
        ) /
        (recent.length - 1)
      : 0;

  const latestSma20 =
    latest.sma20 ??
    latest.close;

  const meanReversion =
    latestSma20
      ? Math.log(
          latestSma20 /
            latest.close
        ) * 0.04
      : 0;

  const drift = clamp(
    ewmaDrift * 0.6 +
      trend * 0.3 +
      meanReversion * 0.1,
    -0.03,
    0.03
  );

  const z =
    zForConfidence(confidence);

  const lastDate =
    new Date(latest.date);

  const current = latest.close;

  const points = Array.from(
    { length: horizon },
    (_, index) => {
      const step = index + 1;
      const root =
        Math.sqrt(step);

      const projected =
        current *
        Math.exp(drift * step);

      const lower =
        current *
        Math.exp(
          drift * step -
            z * sigma * root
        );

      const upper =
        current *
        Math.exp(
          drift * step +
            z * sigma * root
        );

      const bearish =
        current *
        Math.exp(
          (drift -
            sigma * 0.75) *
            step
        );

      const bullish =
        current *
        Math.exp(
          (drift +
            sigma * 0.75) *
            step
        );

      const date = futureDate(
        lastDate,
        interval,
        step
      );

      return {
        step,
        date:
          date.toISOString(),
        label: `F${step}`,
        projected:
          round(projected) ??
          projected,
        lower:
          round(lower) ?? lower,
        upper:
          round(upper) ?? upper,
        bearish:
          round(bearish) ??
          bearish,
        bullish:
          round(bullish) ??
          bullish,
      };
    }
  );

  const final =
    points[points.length - 1];

  const probabilityUp =
    sigma > 0
      ? normalCdf(
          (drift *
            Math.sqrt(horizon)) /
            sigma
        ) * 100
      : drift >= 0
        ? 100
        : 0;

  const backtest =
    directionalBacktest(closes);

  const historyScore = clamp(
    candles.length / 2.5,
    0,
    100
  );

  const backtestScore =
    backtest ?? 50;

  const stabilityScore = clamp(
    100 - sigma * 1800,
    20,
    100
  );

  const modelConfidence =
    Math.round(
      historyScore * 0.35 +
        backtestScore * 0.35 +
        stabilityScore * 0.3
    );

  const intervalNumber =
    interval === "daily"
      ? 1
      : Math.max(
          1,
          Number(
            interval.replace(
              "min",
              ""
            )
          )
        );

  const annualizer =
    interval === "daily"
      ? Math.sqrt(252)
      : Math.sqrt(
          (390 / intervalNumber) *
            252
        );

  const annualizedVolatilityPct =
    sigma * annualizer * 100;

  const move = (target: number) =>
    (target / current - 1) *
    100;

  return {
    points,
    horizon,
    confidenceLevel: confidence,
    probabilityUp:
      round(probabilityUp, 2),
    probabilityDown:
      round(
        100 - probabilityUp,
        2
      ),
    expectedMovePct:
      round(
        move(final.projected),
        2
      ),
    lowerMovePct:
      round(move(final.lower), 2),
    upperMovePct:
      round(move(final.upper), 2),
    annualizedVolatilityPct:
      round(
        annualizedVolatilityPct,
        2
      ),
    driftPerStepPct:
      round(
        (Math.exp(drift) - 1) *
          100,
        4
      ),
    directionalBacktestPct:
      round(backtest, 2),
    modelConfidence,
    methodology:
      "Forecast derived only from Alpha Vantage OHLCV: exponentially weighted log-return drift and volatility, recent trend, a small mean-reversion term, and confidence bands. It is probabilistic research, not a price guarantee.",
    scenarios: [
      {
        name: "Bear" as const,
        target: final.bearish,
        movePct: round(
          move(final.bearish),
          2
        ),
        description:
          "Drift reduced by 0.75 times observed step volatility.",
      },
      {
        name: "Base" as const,
        target: final.projected,
        movePct: round(
          move(final.projected),
          2
        ),
        description:
          "EWMA drift, recent trend, and mean-reversion estimate.",
      },
      {
        name: "Bull" as const,
        target: final.bullish,
        movePct: round(
          move(final.bullish),
          2
        ),
        description:
          "Drift increased by 0.75 times observed step volatility.",
      },
    ],
  };
}

function normalizeOverview(
  payload: AlphaPayload | null
) {
  const row = (payload ??
    {}) as Record<string, unknown>;

  const readNumber = (
    key: string
  ) => toNumber(row[key]);

  const readText = (
    key: string
  ) =>
    typeof row[key] ===
      "string" &&
    row[key]
      ? String(row[key])
      : null;

  return {
    available: Boolean(
      readText("Symbol") ||
        readText("Name")
    ),
    source:
      "Alpha Vantage OVERVIEW",
    symbol: readText("Symbol"),
    name: readText("Name"),
    description:
      readText("Description"),
    exchange: readText("Exchange"),
    currency: readText("Currency"),
    country: readText("Country"),
    sector: readText("Sector"),
    industry: readText("Industry"),
    marketCapitalization:
      readNumber(
        "MarketCapitalization"
      ),
    ebitda: readNumber("EBITDA"),
    peRatio: readNumber("PERatio"),
    pegRatio:
      readNumber("PEGRatio"),
    bookValue:
      readNumber("BookValue"),
    dividendPerShare:
      readNumber(
        "DividendPerShare"
      ),
    dividendYield:
      readNumber("DividendYield"),
    eps: readNumber("EPS"),
    revenuePerShareTTM:
      readNumber(
        "RevenuePerShareTTM"
      ),
    profitMargin:
      readNumber("ProfitMargin"),
    operatingMarginTTM:
      readNumber(
        "OperatingMarginTTM"
      ),
    returnOnAssetsTTM:
      readNumber(
        "ReturnOnAssetsTTM"
      ),
    returnOnEquityTTM:
      readNumber(
        "ReturnOnEquityTTM"
      ),
    revenueTTM:
      readNumber("RevenueTTM"),
    grossProfitTTM:
      readNumber(
        "GrossProfitTTM"
      ),
    dilutedEPSTTM:
      readNumber("DilutedEPSTTM"),
    quarterlyEarningsGrowthYOY:
      readNumber(
        "QuarterlyEarningsGrowthYOY"
      ),
    quarterlyRevenueGrowthYOY:
      readNumber(
        "QuarterlyRevenueGrowthYOY"
      ),
    analystTargetPrice:
      readNumber(
        "AnalystTargetPrice"
      ),
    trailingPE:
      readNumber("TrailingPE"),
    forwardPE:
      readNumber("ForwardPE"),
    priceToSalesRatioTTM:
      readNumber(
        "PriceToSalesRatioTTM"
      ),
    priceToBookRatio:
      readNumber(
        "PriceToBookRatio"
      ),
    evToRevenue:
      readNumber("EVToRevenue"),
    evToEBITDA:
      readNumber("EVToEBITDA"),
    beta: readNumber("Beta"),
    week52High:
      readNumber("52WeekHigh"),
    week52Low:
      readNumber("52WeekLow"),
    day50MovingAverage:
      readNumber(
        "50DayMovingAverage"
      ),
    day200MovingAverage:
      readNumber(
        "200DayMovingAverage"
      ),
    sharesOutstanding:
      readNumber(
        "SharesOutstanding"
      ),
    dividendDate:
      readText("DividendDate"),
    exDividendDate:
      readText("ExDividendDate"),
    latestQuarter:
      readText("LatestQuarter"),
  };
}

function normalizeEarnings(
  payload: AlphaPayload | null
) {
  const quarterly = Array.isArray(
    payload?.quarterlyEarnings
  )
    ? (payload
        ?.quarterlyEarnings as Array<
        Record<string, unknown>
      >)
    : [];

  const annual = Array.isArray(
    payload?.annualEarnings
  )
    ? (payload
        ?.annualEarnings as Array<
        Record<string, unknown>
      >)
    : [];

  return {
    available:
      quarterly.length > 0 ||
      annual.length > 0,
    source:
      "Alpha Vantage EARNINGS",
    quarterly: quarterly
      .slice(0, 12)
      .map((row) => ({
        fiscalDateEnding: String(
          row.fiscalDateEnding ?? ""
        ),
        reportedDate: String(
          row.reportedDate ?? ""
        ),
        reportedEPS:
          toNumber(
            row.reportedEPS
          ),
        estimatedEPS:
          toNumber(
            row.estimatedEPS
          ),
        surprise:
          toNumber(row.surprise),
        surprisePercentage:
          toNumber(
            row.surprisePercentage
          ),
        reportTime: String(
          row.reportTime ?? ""
        ),
      })),
    annual: annual
      .slice(0, 8)
      .map((row) => ({
        fiscalDateEnding: String(
          row.fiscalDateEnding ?? ""
        ),
        reportedEPS:
          toNumber(
            row.reportedEPS
          ),
      })),
  };
}

function alphaTimeToIso(
  value: unknown
) {
  const text = String(
    value ?? ""
  );

  const match = text.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/
  );

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  ).toISOString();
}

function normalizeNews(
  payload: AlphaPayload | null,
  symbol: string
) {
  const feed = Array.isArray(
    payload?.feed
  )
    ? (payload?.feed as Array<
        Record<string, unknown>
      >)
    : [];

  let weighted = 0;
  let relevance = 0;

  const articles = feed
    .slice(0, 40)
    .map((row) => {
      const tickerSentiment =
        Array.isArray(
          row.ticker_sentiment
        )
          ? (row.ticker_sentiment as Array<
              Record<
                string,
                unknown
              >
            >)
          : [];

      const matching =
        tickerSentiment.find(
          (item) =>
            String(
              item.ticker ?? ""
            ).toUpperCase() ===
            symbol
        );

      const itemRelevance =
        toNumber(
          matching?.relevance_score
        ) ?? 0;

      const itemSentiment =
        toNumber(
          matching?.ticker_sentiment_score
        ) ??
        toNumber(
          row.overall_sentiment_score
        ) ??
        0;

      weighted +=
        itemSentiment *
        itemRelevance;

      relevance +=
        itemRelevance;

      return {
        title: String(
          row.title ??
            "Untitled article"
        ),
        url: String(row.url ?? ""),
        source: String(
          row.source ??
            "Unknown source"
        ),
        sourceDomain: String(
          row.source_domain ?? ""
        ),
        publishedAt:
          alphaTimeToIso(
            row.time_published
          ),
        summary: String(
          row.summary ?? ""
        ),
        sentimentScore:
          round(
            itemSentiment,
            4
          ),
        sentimentLabel: String(
          matching?.ticker_sentiment_label ??
            row.overall_sentiment_label ??
            "Neutral"
        ),
        relevanceScore:
          round(
            itemRelevance,
            4
          ),
        topics: Array.isArray(
          row.topics
        )
          ? (
              row.topics as Array<
                Record<
                  string,
                  unknown
                >
              >
            )
              .slice(0, 5)
              .map((topic) =>
                String(
                  topic.topic ?? ""
                )
              )
              .filter(Boolean)
          : [],
      };
    });

  return {
    available:
      articles.length > 0,
    source:
      "Alpha Vantage NEWS_SENTIMENT",
    articleCount:
      articles.length,
    weightedSentiment:
      round(
        relevance
          ? weighted / relevance
          : 0,
        4
      ),
    articles,
  };
}

function normalizeOptions(
  payload: AlphaPayload | null,
  symbol: string,
  error: string | null
) {
  const rows = Array.isArray(
    payload?.data
  )
    ? (payload?.data as Array<
        Record<string, unknown>
      >)
    : Array.isArray(
          payload?.options
        )
      ? (payload
          ?.options as Array<
          Record<string, unknown>
        >)
      : [];

  const contracts = rows
    .map((row) => ({
      contractId: String(
        row.contractID ??
          row.contract_id ??
          row.contract ??
          ""
      ),
      symbol: String(
        row.symbol ?? symbol
      ),
      expiration: String(
        row.expiration ?? ""
      ),
      strike: toNumber(
        row.strike
      ),
      type: String(
        row.type ?? ""
      ).toLowerCase(),
      last: toNumber(row.last),
      mark: toNumber(row.mark),
      bid: toNumber(row.bid),
      ask: toNumber(row.ask),
      volume:
        toNumber(row.volume),
      openInterest:
        toNumber(
          row.open_interest ??
            row.openInterest
        ),
      impliedVolatility:
        toNumber(
          row.implied_volatility ??
            row.impliedVolatility
        ),
      delta: toNumber(row.delta),
      gamma: toNumber(row.gamma),
      theta: toNumber(row.theta),
      vega: toNumber(row.vega),
      rho: toNumber(row.rho),
    }))
    .filter(
      (row) =>
        row.contractId ||
        (row.expiration &&
          row.strike !== null)
    );

  const callVolume = contracts
    .filter(
      (contract) =>
        contract.type === "call"
    )
    .reduce(
      (sum, contract) =>
        sum +
        (contract.volume ?? 0),
      0
    );

  const putVolume = contracts
    .filter(
      (contract) =>
        contract.type === "put"
    )
    .reduce(
      (sum, contract) =>
        sum +
        (contract.volume ?? 0),
      0
    );

  const ivValues = contracts
    .map(
      (contract) =>
        contract.impliedVolatility
    )
    .filter(
      (
        value
      ): value is number =>
        value !== null &&
        value > 0
    );

  const expirations =
    Array.from(
      new Set(
        contracts
          .map(
            (contract) =>
              contract.expiration
          )
          .filter(Boolean)
      )
    ).sort();

  const topContracts = [
    ...contracts,
  ]
    .sort(
      (a, b) =>
        (b.volume ?? 0) -
        (a.volume ?? 0)
    )
    .slice(0, 100);

  return {
    available:
      contracts.length > 0,
    source:
      "Alpha Vantage REALTIME_OPTIONS",
    error,
    contractCount:
      contracts.length,
    expirations,
    callVolume,
    putVolume,
    putCallVolumeRatio:
      callVolume > 0
        ? round(
            putVolume /
              callVolume,
            4
          )
        : null,
    averageImpliedVolatility:
      ivValues.length
        ? round(
            average(ivValues),
            4
          )
        : null,
    contracts: topContracts,
  };
}

function freshness(
  quote: RealtimeQuote | null,
  candles: Candle[],
  session: ReturnType<
    typeof marketSession
  >,
  entitlement: string | null
) {
  const timestamp =
    quote?.timestamp ??
    candles[candles.length - 1]
      ?.date ??
    null;

  if (!timestamp) {
    return {
      status:
        "Unavailable" as const,
      asOf: null,
      ageSeconds: null,
      message:
        "No Alpha Vantage timestamp is available.",
    };
  }

  const ageSeconds = Math.max(
    0,
    Math.round(
      (Date.now() -
        Date.parse(timestamp)) /
        1000
    )
  );

  if (!session.isOpen) {
    return {
      status: "Closed" as const,
      asOf: timestamp,
      ageSeconds,
      message:
        "The US equity market is closed. Values are the latest Alpha Vantage observations from the most recent session.",
    };
  }

  if (
    entitlement !== "realtime"
  ) {
    return {
      status:
        "Delayed" as const,
      asOf: timestamp,
      ageSeconds,
      message:
        "ALPHA_VANTAGE_ENTITLEMENT is not set to realtime; the provider may return delayed or historical values.",
    };
  }

  if (ageSeconds <= 180) {
    return {
      status: "Live" as const,
      asOf: timestamp,
      ageSeconds,
      message:
        "Alpha Vantage real-time entitlement is active and the latest observation is current.",
    };
  }

  if (ageSeconds <= 1_200) {
    return {
      status:
        "Delayed" as const,
      asOf: timestamp,
      ageSeconds,
      message:
        `The latest Alpha Vantage observation is ${Math.round(
          ageSeconds / 60
        )} minute(s) old.`,
    };
  }

  return {
    status: "Stale" as const,
    asOf: timestamp,
    ageSeconds,
    message:
      `The latest Alpha Vantage observation is ${Math.round(
        ageSeconds / 60
      )} minute(s) old and should be treated as stale.`,
  };
}

function qualityScore(input: {
  quote: RealtimeQuote | null;
  candles: Candle[];
  entitlement: string | null;
  freshness: ReturnType<
    typeof freshness
  >;
  calls: ProviderCall[];
}) {
  let score = 100;

  const warnings: string[] = [];

  if (!input.quote) {
    score -= 35;
    warnings.push(
      "No real-time Alpha Vantage quote was returned."
    );
  }

  if (
    input.entitlement !==
    "realtime"
  ) {
    score -= 25;
    warnings.push(
      "Set ALPHA_VANTAGE_ENTITLEMENT=realtime after completing market-data entitlement."
    );
  }

  if (
    input.candles.length < 50
  ) {
    score -= 20;
    warnings.push(
      "Fewer than 50 Alpha Vantage candles are available."
    );
  } else if (
    input.candles.length < 200
  ) {
    score -= 8;
    warnings.push(
      "Fewer than 200 candles are available, so long-horizon indicators are limited."
    );
  }

  if (
    input.freshness.status ===
    "Stale"
  ) {
    score -= 25;
    warnings.push(
      input.freshness.message
    );
  }

  for (const call of input.calls) {
    if (
      call.status ===
        "unavailable" &&
      call.error
    ) {
      warnings.push(
        `${call.endpoint}: ${call.error}`
      );
    }
  }

  return {
    score: clamp(
      Math.round(score),
      0,
      100
    ),
    warnings: Array.from(
      new Set(warnings)
    ),
    calls: input.calls,
  };
}

export async function GET(
  request: Request
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(
    request.url
  );

  const symbol = cleanSymbol(
    url.searchParams.get(
      "symbol"
    )
  );

  const interval = cleanInterval(
    url.searchParams.get(
      "interval"
    )
  );

  const includeOptions =
    url.searchParams.get(
      "includeOptions"
    ) === "1";

  const horizon = clamp(
    Number(
      url.searchParams.get(
        "horizon"
      ) ?? 20
    ),
    5,
    60
  );

  const confidence = clamp(
    Number(
      url.searchParams.get(
        "confidence"
      ) ?? 95
    ),
    68,
    99
  );

  const entitlement =
    getEntitlement();

  const session =
    marketSession();

  const cacheKey =
    `${symbol}:${interval}:${includeOptions}:${horizon}:${confidence}:${entitlement}`;

  const cached =
    CACHE.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return NextResponse.json(
      cached.payload,
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          "X-Slice-Market-Cache":
            "HIT",
        },
      }
    );
  }

  if (
    !process.env
      .ALPHA_VANTAGE_API_KEY
  ) {
    return NextResponse.json(
      {
        error:
          "ALPHA_VANTAGE_API_KEY is not configured.",
        provider: "Alpha Vantage",
        providerOnly: true,
      },
      {
        status: 503,
      }
    );
  }

  const realtimeParams: Record<
    string,
    string
  > = {};

  if (entitlement) {
    realtimeParams.entitlement =
      entitlement;
  }

  const timeSeriesEndpoint =
    interval === "daily"
      ? "TIME_SERIES_DAILY_ADJUSTED"
      : "TIME_SERIES_INTRADAY";

  const timeSeriesParams: Record<
    string,
    string
  > = {
    symbol,
    outputsize: "full",
  };

  if (interval !== "daily") {
    timeSeriesParams.interval =
      interval;

    timeSeriesParams.adjusted =
      "false";

    timeSeriesParams.extended_hours =
      "true";
  }

  if (entitlement) {
    timeSeriesParams.entitlement =
      entitlement;
  }

  const [
    bulkResult,
    globalResult,
    timeSeriesResult,
    overviewResult,
    earningsResult,
    newsResult,
    optionsResult,
  ] = await Promise.allSettled([
    alphaRequest(
      "REALTIME_BULK_QUOTES",
      { symbol }
    ),
    alphaRequest(
      "GLOBAL_QUOTE",
      {
        symbol,
        ...realtimeParams,
      }
    ),
    alphaRequest(
      timeSeriesEndpoint,
      timeSeriesParams
    ),
    alphaRequest(
      "OVERVIEW",
      { symbol }
    ),
    alphaRequest(
      "EARNINGS",
      { symbol }
    ),
    alphaRequest(
      "NEWS_SENTIMENT",
      {
        tickers: symbol,
        sort: "LATEST",
        limit: "50",
      }
    ),
    includeOptions
      ? alphaRequest(
          "REALTIME_OPTIONS",
          {
            symbol,
            require_greeks: "true",
          },
          20_000
        )
      : Promise.resolve(
          {} as AlphaPayload
        ),
  ]);

  const calls: ProviderCall[] = [
    callResult(
      "REALTIME_BULK_QUOTES",
      bulkResult,
      "live"
    ),
    callResult(
      "GLOBAL_QUOTE",
      globalResult,
      entitlement ===
        "realtime"
        ? "live"
        : "current"
    ),
    callResult(
      timeSeriesEndpoint,
      timeSeriesResult,
      interval === "daily"
        ? "current"
        : entitlement ===
            "realtime"
          ? "live"
          : "current"
    ),
    callResult(
      "OVERVIEW",
      overviewResult,
      "current"
    ),
    callResult(
      "EARNINGS",
      earningsResult,
      "current"
    ),
    callResult(
      "NEWS_SENTIMENT",
      newsResult,
      "current"
    ),
    ...(includeOptions
      ? [
          callResult(
            "REALTIME_OPTIONS",
            optionsResult,
            "live"
          ),
        ]
      : []),
  ];

  const rawCandles =
    timeSeriesResult.status ===
    "fulfilled"
      ? parseTimeSeries(
          timeSeriesResult.value,
          interval
        )
      : [];

  let quote:
    | RealtimeQuote
    | null = null;

  if (
    bulkResult.status ===
    "fulfilled"
  ) {
    quote = parseBulkQuote(
      bulkResult.value,
      symbol,
      session
    );
  }

  if (
    !quote &&
    globalResult.status ===
      "fulfilled"
  ) {
    quote = parseGlobalQuote(
      globalResult.value,
      symbol,
      session
    );
  }

  if (!quote) {
    quote = quoteFromCandles(
      rawCandles,
      symbol,
      session
    );
  }

  if (!rawCandles.length) {
    const detail =
      timeSeriesResult.status ===
        "rejected" &&
      timeSeriesResult.reason instanceof
        Error
        ? timeSeriesResult.reason
            .message
        : "Alpha Vantage returned no time-series candles.";

    return NextResponse.json(
      {
        error: detail,
        symbol,
        interval,
        provider: "Alpha Vantage",
        providerOnly: true,
        quality: {
          score: 0,
          warnings: [detail],
          calls,
        },
      },
      {
        status: 502,
      }
    );
  }

  const merged =
    mergeRealtimeQuote(
      rawCandles,
      quote,
      interval
    );

  const candles =
    enrichCandles(merged);

  const latest =
    candles[candles.length - 1] ??
    null;

  const currentFreshness =
    freshness(
      quote,
      candles,
      session,
      entitlement
    );

  const forecast =
    buildForecast(
      candles,
      interval,
      horizon,
      confidence
    );

  const optionsError =
    includeOptions &&
    optionsResult.status ===
      "rejected"
      ? optionsResult.reason instanceof
          Error
        ? optionsResult.reason.message
        : String(
            optionsResult.reason
          )
      : null;

  const payload: MarketVisualPayload =
    {
      symbol,
      interval,
      generatedAt:
        new Date().toISOString(),
      provider: "Alpha Vantage",
      providerOnly: true,
      entitlement,
      isRealtime:
        entitlement ===
          "realtime" &&
        Boolean(quote),
      marketSession: session,
      freshness:
        currentFreshness,
      quote,
      company:
        normalizeOverview(
          overviewResult.status ===
            "fulfilled"
            ? overviewResult.value
            : null
        ),
      earnings:
        normalizeEarnings(
          earningsResult.status ===
            "fulfilled"
            ? earningsResult.value
            : null
        ),
      news: normalizeNews(
        newsResult.status ===
          "fulfilled"
          ? newsResult.value
          : null,
        symbol
      ),
      options: normalizeOptions(
        includeOptions &&
          optionsResult.status ===
            "fulfilled"
          ? optionsResult.value
          : null,
        symbol,
        optionsError
      ),
      candles,
      latest,
      levels:
        calculateLevels(candles),
      signals:
        calculateSignals(candles),
      forecast,
      quality: qualityScore({
        quote,
        candles,
        entitlement,
        freshness:
          currentFreshness,
        calls,
      }),
      pineLab: {
        openAiConfigured:
          Boolean(
            process.env
              .OPENAI_API_KEY
          ),
        model:
          process.env
            .OPENAI_PINE_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        pineVersion: 6,
      },
    };

  CACHE.set(cacheKey, {
    expiresAt:
      Date.now() +
      (interval === "daily"
        ? 60_000
        : 12_000),
    payload,
  });

  return NextResponse.json(
    payload,
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Slice-Market-Cache":
          "MISS",
        "X-Slice-Market-Provider":
          "Alpha-Vantage",
      },
    }
  );
}