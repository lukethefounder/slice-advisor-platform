import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AlphaOverview = Record<string, string>;
type AlphaQuote = Record<string, string>;
type AlphaTimeSeries = Record<
  string,
  Record<string, string>
>;

type AlphaNewsFeedItem = {
  title?: string;
  ticker_sentiment?: Array<{
    ticker?: string;
    relevance_score?: string;
    ticker_sentiment_score?: string;
  }>;
};

type AlphaPayload = Record<string, unknown> & {
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

const ALPHA_REALTIME_FUNCTIONS = new Set([
  "GLOBAL_QUOTE",
  "TIME_SERIES_INTRADAY",
  "TIME_SERIES_DAILY_ADJUSTED",
  "TOP_GAINERS_LOSERS",
  "VWAP",
  "MACD",
  "RSI",
  "STOCH",
  "STOCHRSI",
  "ATR",
]);

function toNumber(
  value: unknown,
  fallback = 0
) {
  const next = Number(value);

  return Number.isFinite(next)
    ? next
    : fallback;
}

function clamp(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(value))
  );
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
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
    return undefined;
  }

  return average(values.slice(0, length));
}

function rsi(
  values: number[],
  length = 14
) {
  if (values.length < length + 1) {
    return undefined;
  }

  let gains = 0;
  let losses = 0;

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const change =
      values[index] - values[index + 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;

  return (
    100 -
    100 / (1 + relativeStrength)
  );
}

function standardDeviation(
  values: number[]
) {
  if (!values.length) {
    return 0;
  }

  const avg = average(values);

  const variance = average(
    values.map(
      (value) => (value - avg) ** 2
    )
  );

  return Math.sqrt(variance);
}

function scoreHigherIsBetter(
  value: number,
  low: number,
  high: number
) {
  return clamp(
    ((value - low) / (high - low)) * 100
  );
}

function scoreLowerIsBetter(
  value: number,
  low: number,
  high: number
) {
  return clamp(
    100 -
      ((value - low) / (high - low)) *
        100
  );
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

function readAlphaProviderError(
  payload: AlphaPayload
) {
  return (
    payload["Error Message"] ||
    payload.Information ||
    payload.Note ||
    null
  );
}

async function fetchAlpha(
  functionName: string,
  symbol: string,
  apiKey: string,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams({
    function: functionName,
    symbol,
    apikey: apiKey,
    ...extra,
  });

  const entitlement =
    getAlphaVantageEntitlement();

  if (
    entitlement &&
    ALPHA_REALTIME_FUNCTIONS.has(
      functionName
    )
  ) {
    params.set(
      "entitlement",
      entitlement
    );
  }

  const response = await fetch(
    `https://www.alphavantage.co/query?${params.toString()}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "SliceAlphaVantageIntelligence/2.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Alpha Vantage ${functionName} failed with ${response.status}.`
    );
  }

  const payload =
    (await response.json()) as AlphaPayload;

  const providerError =
    readAlphaProviderError(payload);

  if (providerError) {
    throw new Error(
      `Alpha Vantage ${functionName}: ${providerError}`
    );
  }

  return payload;
}

function settledWarning(
  label: string,
  result: PromiseSettledResult<unknown>
) {
  if (result.status === "fulfilled") {
    return null;
  }

  return `${label}: ${
    result.reason instanceof Error
      ? result.reason.message
      : String(result.reason)
  }`;
}

export async function GET(
  request: Request
) {
  const apiKey =
    process.env.ALPHA_VANTAGE_API_KEY;

  const entitlement =
    getAlphaVantageEntitlement();

  const { searchParams } = new URL(
    request.url
  );

  const symbol = (
    searchParams.get("symbol") || "MSFT"
  )
    .trim()
    .toUpperCase();

  if (!apiKey) {
    return NextResponse.json(
      {
        symbol,
        updatedAt:
          new Date().toISOString(),
        provider: "Alpha Vantage",
        entitlement,
        realtimeRequested:
          entitlement === "realtime",
        error:
          "ALPHA_VANTAGE_API_KEY is not configured.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }

  try {
    const [
      quoteResult,
      overviewResult,
      dailyResult,
      newsResult,
    ] = await Promise.allSettled([
      fetchAlpha(
        "GLOBAL_QUOTE",
        symbol,
        apiKey
      ),
      fetchAlpha(
        "OVERVIEW",
        symbol,
        apiKey
      ),
      fetchAlpha(
        "TIME_SERIES_DAILY_ADJUSTED",
        symbol,
        apiKey,
        {
          outputsize: "full",
        }
      ),
      fetchAlpha(
        "NEWS_SENTIMENT",
        symbol,
        apiKey,
        {
          tickers: symbol,
          limit: "50",
        }
      ),
    ]);

    const warnings = [
      settledWarning(
        "Quote",
        quoteResult
      ),
      settledWarning(
        "Overview",
        overviewResult
      ),
      settledWarning(
        "Daily history",
        dailyResult
      ),
      settledWarning(
        "News sentiment",
        newsResult
      ),
    ].filter(
      (value): value is string =>
        Boolean(value)
    );

    const quotePayload =
      quoteResult.status === "fulfilled"
        ? quoteResult.value
        : {};

    const overviewPayload =
      overviewResult.status === "fulfilled"
        ? (overviewResult.value as AlphaOverview)
        : {};

    const dailyPayload =
      dailyResult.status === "fulfilled"
        ? dailyResult.value
        : {};

    const newsPayload =
      newsResult.status === "fulfilled"
        ? newsResult.value
        : {};

    const globalQuote = ((
      quotePayload as Record<
        string,
        unknown
      >
    )["Global Quote"] ||
      {}) as AlphaQuote;

    const rawSeries = ((
      (dailyPayload as Record<
        string,
        unknown
      >)["Time Series (Daily)"] ||
      (dailyPayload as Record<
        string,
        unknown
      >)[
        "Time Series (Daily Adjusted)"
      ] ||
      {}
    ) as AlphaTimeSeries);

    const dates = Object.keys(
      rawSeries
    ).sort((a, b) =>
      b.localeCompare(a)
    );

    const closes = dates
      .map((date) =>
        toNumber(
          rawSeries[date]?.[
            "5. adjusted close"
          ] ||
            rawSeries[date]?.[
              "4. close"
            ]
        )
      )
      .filter((value) => value > 0);

    const volumes = dates
      .map((date) =>
        toNumber(
          rawSeries[date]?.[
            "6. volume"
          ]
        )
      )
      .filter((value) => value > 0);

    const quotePrice = toNumber(
      globalQuote["05. price"]
    );

    const latestClose =
      closes[0] || quotePrice;

    const price =
      quotePrice || latestClose;

    const previousClose =
      toNumber(
        globalQuote[
          "08. previous close"
        ]
      ) ||
      closes[1] ||
      0;

    const change =
      toNumber(
        globalQuote["09. change"]
      ) ||
      (price && previousClose
        ? price - previousClose
        : 0);

    const changePercent =
      toNumber(
        String(
          globalQuote[
            "10. change percent"
          ] || ""
        ).replace("%", "")
      ) ||
      (previousClose
        ? (change / previousClose) *
          100
        : 0);

    const volume =
      toNumber(
        globalQuote["06. volume"]
      ) ||
      volumes[0] ||
      0;

    const highClose = Math.max(
      ...closes.slice(0, 60),
      latestClose || 0
    );

    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    const rsi14 = rsi(closes, 14);

    const momentum30 =
      closes.length > 30 &&
      closes[30]
        ? ((latestClose -
            closes[30]) /
            closes[30]) *
          100
        : 0;

    const drawdownFromHigh =
      highClose
        ? ((latestClose -
            highClose) /
            highClose) *
          100
        : 0;

    const volatility20 =
      closes.length > 21
        ? standardDeviation(
            closes
              .slice(0, 20)
              .map(
                (
                  close,
                  index
                ) => {
                  const prior =
                    closes[
                      index + 1
                    ];

                  return prior
                    ? ((close -
                        prior) /
                        prior) *
                        100
                    : 0;
                }
              )
          )
        : 0;

    const volumeTrend =
      volumes.length > 20
        ? (average(
            volumes.slice(0, 5)
          ) /
            Math.max(
              average(
                volumes.slice(5, 20)
              ),
              1
            ) -
            1) *
          100
        : 0;

    const trendScore = clamp(
      (latestClose >
      (sma20 || latestClose)
        ? 20
        : 8) +
        (latestClose >
        (sma50 || latestClose)
          ? 24
          : 8) +
        (latestClose >
        (sma200 || latestClose)
          ? 24
          : 8) +
        scoreHigherIsBetter(
          momentum30,
          -15,
          25
        ) *
          0.32
    );

    const momentumScore = clamp(
      scoreHigherIsBetter(
        momentum30,
        -15,
        35
      ) *
        0.55 +
        scoreHigherIsBetter(
          rsi14 || 50,
          35,
          70
        ) *
          0.25 +
        scoreHigherIsBetter(
          changePercent,
          -5,
          5
        ) *
          0.2
    );

    const riskScore = clamp(
      scoreLowerIsBetter(
        Math.abs(
          drawdownFromHigh
        ),
        0,
        35
      ) *
        0.45 +
        scoreLowerIsBetter(
          volatility20,
          1,
          8
        ) *
          0.35 +
        scoreLowerIsBetter(
          toNumber(
            overviewPayload.Beta,
            1
          ),
          0.6,
          2.2
        ) *
          0.2
    );

    const volumeScore = clamp(
      scoreHigherIsBetter(
        volumeTrend,
        -40,
        80
      )
    );

    const feed = Array.isArray(
      (
        newsPayload as Record<
          string,
          unknown
        >
      ).feed
    )
      ? ((
          newsPayload as Record<
            string,
            unknown
          >
        ).feed as AlphaNewsFeedItem[])
      : [];

    let weightedSentimentTotal = 0;
    let relevanceTotal = 0;
    let plainSentimentTotal = 0;
    let plainSentimentCount = 0;

    for (const item of feed) {
      for (const tickerSentiment of
        item.ticker_sentiment ||
        []) {
        if (
          tickerSentiment.ticker?.toUpperCase() !==
          symbol
        ) {
          continue;
        }

        const relevance = toNumber(
          tickerSentiment.relevance_score
        );

        const sentiment = toNumber(
          tickerSentiment.ticker_sentiment_score
        );

        weightedSentimentTotal +=
          sentiment * relevance;

        relevanceTotal += relevance;

        plainSentimentTotal +=
          sentiment;

        plainSentimentCount += 1;
      }
    }

    const averageSentiment =
      plainSentimentCount
        ? plainSentimentTotal /
          plainSentimentCount
        : 0;

    const relevanceWeightedSentiment =
      relevanceTotal
        ? weightedSentimentTotal /
          relevanceTotal
        : averageSentiment;

    return NextResponse.json(
      {
        symbol,
        updatedAt:
          new Date().toISOString(),
        provider: "Alpha Vantage",
        entitlement,
        realtimeRequested:
          entitlement === "realtime",
        warnings,
        quote: {
          price,
          previousClose,
          change,
          changePercent,
          volume,
          latestTradingDay:
            globalQuote[
              "07. latest trading day"
            ] || null,
        },
        overview: {
          name:
            overviewPayload.Name,
          sector:
            overviewPayload.Sector,
          marketCap: toNumber(
            overviewPayload.MarketCapitalization
          ),
          peRatio: toNumber(
            overviewPayload.PERatio
          ),
          pegRatio: toNumber(
            overviewPayload.PEGRatio
          ),
          profitMargin: toNumber(
            overviewPayload.ProfitMargin
          ),
          operatingMargin: toNumber(
            overviewPayload.OperatingMarginTTM
          ),
          returnOnEquity: toNumber(
            overviewPayload.ReturnOnEquityTTM
          ),
          quarterlyRevenueGrowthYOY:
            toNumber(
              overviewPayload.QuarterlyRevenueGrowthYOY
            ),
          quarterlyEarningsGrowthYOY:
            toNumber(
              overviewPayload.QuarterlyEarningsGrowthYOY
            ),
          analystTargetPrice:
            toNumber(
              overviewPayload.AnalystTargetPrice
            ),
          beta: toNumber(
            overviewPayload.Beta
          ),
        },
        technicals: {
          sma20,
          sma50,
          sma200,
          rsi14: rsi14
            ? Number(
                rsi14.toFixed(2)
              )
            : undefined,
          volatility20: Number(
            volatility20.toFixed(2)
          ),
          momentum30: Number(
            momentum30.toFixed(2)
          ),
          drawdownFromHigh: Number(
            drawdownFromHigh.toFixed(
              2
            )
          ),
          volumeTrend: Number(
            volumeTrend.toFixed(2)
          ),
          trendScore,
          momentumScore,
          riskScore,
          volumeScore,
          historyPointCount:
            closes.length,
        },
        news: {
          averageSentiment: Number(
            averageSentiment.toFixed(
              4
            )
          ),
          relevanceWeightedSentiment:
            Number(
              relevanceWeightedSentiment.toFixed(
                4
              )
            ),
          articleCount: feed.length,
          latestTitle:
            feed[0]?.title || "",
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        symbol,
        updatedAt:
          new Date().toISOString(),
        provider: "Alpha Vantage",
        entitlement,
        realtimeRequested:
          entitlement === "realtime",
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch Alpha Vantage data.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}