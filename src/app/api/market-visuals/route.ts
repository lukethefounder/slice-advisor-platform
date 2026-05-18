import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Candle = {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type VisualPoint = Candle & {
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
  bollingerLower: number | null;
  atr14: number | null;
  volumeSma20: number | null;
  returnPct: number | null;
  cumulativeReturnPct: number | null;
  rangePct: number | null;
};

type QuoteSnapshot = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  latestTradingDay: string | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  provider: string;
};

function readSearchParam(url: URL, key: string, fallback: string) {
  const value = url.searchParams.get(key);
  return value?.trim() || fallback;
}

function cleanSymbol(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
}

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function intervalMinutes(interval: string) {
  if (interval === "1min") return 1;
  if (interval === "5min") return 5;
  if (interval === "15min") return 15;
  if (interval === "30min") return 30;
  if (interval === "60min") return 60;
  return 1440;
}

function labelFor(dateString: string, interval: string) {
  const date = new Date(dateString);

  if (interval === "daily") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function easternNowParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function marketSession() {
  const { weekday, hour, minute } = easternNowParts();
  const minutes = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return {
      session: "Closed",
      description: "Weekend",
      isRegularMarket: false,
      isExtendedHours: false,
      timezone: "America/New_York",
    };
  }

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return {
      session: "Pre-Market",
      description: "4:00 AM to 9:30 AM ET",
      isRegularMarket: false,
      isExtendedHours: true,
      timezone: "America/New_York",
    };
  }

  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return {
      session: "Regular Market",
      description: "9:30 AM to 4:00 PM ET",
      isRegularMarket: true,
      isExtendedHours: false,
      timezone: "America/New_York",
    };
  }

  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return {
      session: "After-Hours",
      description: "4:00 PM to 8:00 PM ET",
      isRegularMarket: false,
      isExtendedHours: true,
      timezone: "America/New_York",
    };
  }

  return {
    session: "Closed",
    description: "Outside pre-market, regular, and after-hours sessions",
    isRegularMarket: false,
    isExtendedHours: false,
    timezone: "America/New_York",
  };
}

function movingAverage(values: number[], period: number) {
  return values.map((_, index) => {
    if (index < period - 1) return null;

    const slice = values.slice(index - period + 1, index + 1);
    return round(slice.reduce((sum, value) => sum + value, 0) / period, 4);
  });
}

function exponentialMovingAverage(values: number[], period: number) {
  if (!values.length) return [];

  const k = 2 / (period + 1);
  let ema = values[0] ?? 0;

  return values.map((value, index) => {
    if (index === 0) {
      ema = value;
      return round(ema, 4);
    }

    ema = value * k + ema * (1 - k);
    return round(ema, 4);
  });
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function bollingerBands(values: number[], period = 20) {
  return values.map((_, index) => {
    if (index < period - 1) {
      return {
        upper: null,
        lower: null,
      };
    }

    const slice = values.slice(index - period + 1, index + 1);
    const mean = slice.reduce((sum, value) => sum + value, 0) / period;
    const sd = standardDeviation(slice);

    return {
      upper: round(mean + sd * 2, 4),
      lower: round(mean - sd * 2, 4),
    };
  });
}

function rsi(values: number[], period = 14) {
  return values.map((_, index) => {
    if (index < period) return null;

    const changes = values
      .slice(index - period, index + 1)
      .map((value, changeIndex, slice) => {
        if (changeIndex === 0) return 0;
        return value - slice[changeIndex - 1];
      })
      .slice(1);

    const gains = changes.filter((change) => change > 0);
    const losses = changes.filter((change) => change < 0).map(Math.abs);

    const averageGain =
      gains.reduce((sum, value) => sum + value, 0) / period || 0;
    const averageLoss =
      losses.reduce((sum, value) => sum + value, 0) / period || 0;

    if (averageLoss === 0) return 100;

    const rs = averageGain / averageLoss;
    return round(100 - 100 / (1 + rs), 2);
  });
}

function vwap(candles: Candle[]) {
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;

  return candles.map((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    cumulativeTypicalPriceVolume += typical * candle.volume;
    cumulativeVolume += candle.volume;

    if (!cumulativeVolume) return null;

    return round(cumulativeTypicalPriceVolume / cumulativeVolume, 4);
  });
}

function macd(values: number[]) {
  const ema12 = exponentialMovingAverage(values, 12);
  const ema26 = exponentialMovingAverage(values, 26);
  const macdLine = values.map((_, index) =>
    round((ema12[index] ?? 0) - (ema26[index] ?? 0), 4)
  );
  const signalLine = exponentialMovingAverage(macdLine, 9);
  const histogram = macdLine.map((value, index) =>
    round(value - signalLine[index], 4)
  );

  return {
    macdLine,
    signalLine,
    histogram,
  };
}

function averageTrueRange(candles: Candle[], period = 14) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;

    const previousClose = candles[index - 1].close;

    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  return trueRanges.map((_, index) => {
    if (index < period - 1) return null;

    const slice = trueRanges.slice(index - period + 1, index + 1);
    return round(slice.reduce((sum, value) => sum + value, 0) / period, 4);
  });
}

function returns(values: number[]) {
  const first = values[0] || 1;

  return values.map((value, index) => {
    if (index === 0) {
      return {
        returnPct: null,
        cumulativeReturnPct: 0,
      };
    }

    const previous = values[index - 1];

    return {
      returnPct: previous ? round(((value - previous) / previous) * 100, 4) : null,
      cumulativeReturnPct: first ? round(((value - first) / first) * 100, 4) : null,
    };
  });
}

function enrichCandles(candles: Candle[]) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const sma20 = movingAverage(closes, 20);
  const sma50 = movingAverage(closes, 50);
  const sma100 = movingAverage(closes, 100);
  const sma200 = movingAverage(closes, 200);
  const ema9 = exponentialMovingAverage(closes, 9);
  const ema21 = exponentialMovingAverage(closes, 21);
  const vwapValues = vwap(candles);
  const rsiValues = rsi(closes, 14);
  const macdValues = macd(closes);
  const bands = bollingerBands(closes, 20);
  const atr14 = averageTrueRange(candles, 14);
  const volumeSma20 = movingAverage(volumes, 20);
  const returnValues = returns(closes);

  return candles.map<VisualPoint>((candle, index) => ({
    ...candle,
    sma20: sma20[index],
    sma50: sma50[index],
    sma100: sma100[index],
    sma200: sma200[index],
    ema9: ema9[index],
    ema21: ema21[index],
    vwap: vwapValues[index],
    rsi14: rsiValues[index],
    macd: macdValues.macdLine[index],
    macdSignal: macdValues.signalLine[index],
    macdHistogram: macdValues.histogram[index],
    bollingerUpper: bands[index].upper,
    bollingerLower: bands[index].lower,
    atr14: atr14[index],
    volumeSma20: volumeSma20[index],
    returnPct: returnValues[index].returnPct,
    cumulativeReturnPct: returnValues[index].cumulativeReturnPct,
    rangePct: candle.close ? round(((candle.high - candle.low) / candle.close) * 100, 4) : null,
  }));
}

function predictionFromCandles(candles: Candle[]) {
  const closes = candles.map((candle) => candle.close);
  const recent = closes.slice(-80);

  if (recent.length < 20) return [];

  const xValues = recent.map((_, index) => index);
  const yValues = recent;
  const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;

  const numerator = xValues.reduce(
    (sum, x, index) => sum + (x - xMean) * (yValues[index] - yMean),
    0
  );

  const denominator = xValues.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  const volatility = standardDeviation(
    recent.map((value, index) => {
      if (index === 0) return 0;
      return value - recent[index - 1];
    })
  );

  const lastCandle = candles[candles.length - 1];
  const lastDate = new Date(lastCandle.date);
  const stepMinutes = Math.max(5, Math.round((Date.now() - new Date(candles[candles.length - 2]?.date ?? lastCandle.date).getTime()) / 60000));

  return Array.from({ length: 30 }).map((_, forecastIndex) => {
    const futureX = recent.length + forecastIndex;
    const projected = intercept + slope * futureX;
    const upper = projected + volatility * Math.sqrt(forecastIndex + 1);
    const lower = projected - volatility * Math.sqrt(forecastIndex + 1);

    const futureDate = new Date(lastDate);
    futureDate.setMinutes(lastDate.getMinutes() + (forecastIndex + 1) * stepMinutes);

    return {
      date: futureDate.toISOString(),
      label: `F${forecastIndex + 1}`,
      projected: round(projected, 4),
      upper: round(upper, 4),
      lower: round(lower, 4),
    };
  });
}

function calculateModelConfidence(candles: Candle[], isLive: boolean) {
  if (candles.length < 50) return isLive ? 40 : 30;

  const closes = candles.map((candle) => candle.close);
  const recent = closes.slice(-80);

  const volatility = standardDeviation(
    recent.map((value, index) => {
      if (index === 0) return 0;
      return (value - recent[index - 1]) / recent[index - 1];
    })
  );

  const latest = closes[closes.length - 1];
  const oldest = closes[Math.max(0, closes.length - 80)];
  const trendStrength = oldest ? Math.abs((latest - oldest) / oldest) : 0;
  const historyBonus = Math.min(18, candles.length / 16);
  const liveBonus = isLive ? 8 : -12;

  const confidence = 68 + historyBonus + liveBonus - volatility * 600 + Math.min(12, trendStrength * 80);

  return Math.max(25, Math.min(94, Math.round(confidence)));
}

function symbolBase(symbol: string) {
  const bases: Record<string, number> = {
    NVDA: 920,
    AAPL: 190,
    MSFT: 420,
    TSLA: 250,
    META: 520,
    GOOGL: 175,
    GOOG: 175,
    AMZN: 185,
    AMD: 160,
    NFLX: 650,
    SPY: 520,
    QQQ: 450,
    IWM: 210,
    TLT: 92,
    AVGO: 1400,
    CRM: 280,
    PLTR: 25,
    COIN: 230,
    MSTR: 1350,
  };

  return bases[symbol] ?? 150 + (symbol.charCodeAt(0) % 40) * 3;
}

function symbolSeed(symbol: string) {
  return symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function generateDemoCandles(symbol: string, interval: string) {
  const count = interval === "daily" ? 320 : 280;
  const base = symbolBase(symbol);
  const seed = symbolSeed(symbol);
  const now = new Date();
  let lastClose = base * (0.94 + (seed % 12) / 100);

  return Array.from({ length: count }).map((_, index) => {
    const date = new Date(now);

    if (interval === "daily") {
      date.setDate(now.getDate() - (count - index));
    } else {
      date.setMinutes(now.getMinutes() - (count - index) * intervalMinutes(interval));
    }

    const macroTrend = index * base * (0.00008 + (seed % 7) * 0.000006);
    const cycleOne = Math.sin((index + seed) / 9) * (base * 0.016);
    const cycleTwo = Math.cos((index + seed) / 31) * (base * 0.026);
    const micro = Math.sin(index * 2.37 + seed) * (base * 0.0045);
    const eventPulse =
      index > count * 0.72
        ? Math.sin((index - count * 0.72) / 5) * base * 0.012
        : 0;

    const close = Math.max(1, base + macroTrend + cycleOne + cycleTwo + micro + eventPulse);
    const open = lastClose;
    const spread = base * (0.004 + Math.abs(Math.sin(index / 6 + seed)) * 0.007);
    const high = Math.max(open, close) + spread;
    const low = Math.max(0.5, Math.min(open, close) - spread);
    const volumeBase = interval === "daily" ? 25_000_000 : 1_400_000;
    const volume =
      Math.round(
        volumeBase *
          (0.65 + Math.abs(Math.sin(index / 5 + seed)) * 1.35) *
          (index > count * 0.85 ? 1.12 : 1)
      );

    lastClose = close;

    return {
      date: date.toISOString(),
      label: labelFor(date.toISOString(), interval),
      open: round(open, 4),
      high: round(high, 4),
      low: round(low, 4),
      close: round(close, 4),
      volume,
    };
  });
}

function parseAlphaVantageCandles(payload: any, interval: string) {
  const key =
    interval === "daily"
      ? "Time Series (Daily)"
      : `Time Series (${interval})`;

  const series = payload?.[key];

  if (!series || typeof series !== "object") return [];

  return Object.entries(series)
    .map(([date, raw]: [string, any]) => ({
      date: new Date(date).toISOString(),
      label: labelFor(new Date(date).toISOString(), interval),
      open: Number(raw["1. open"]),
      high: Number(raw["2. high"]),
      low: Number(raw["3. low"]),
      close: Number(raw["4. close"]),
      volume: Number(raw["5. volume"] ?? 0),
    }))
    .filter((item) =>
      [item.open, item.high, item.low, item.close].every((value) =>
        Number.isFinite(value)
      )
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseAlphaQuote(payload: any, symbol: string): QuoteSnapshot {
  const raw = payload?.["Global Quote"] ?? {};

  const price = Number(raw["05. price"]);
  const change = Number(raw["09. change"]);
  const changePct = Number(String(raw["10. change percent"] ?? "").replace("%", ""));
  const previousClose = Number(raw["08. previous close"]);
  const open = Number(raw["02. open"]);
  const high = Number(raw["03. high"]);
  const low = Number(raw["04. low"]);
  const volume = Number(raw["06. volume"]);

  return {
    symbol,
    price: Number.isFinite(price) ? price : null,
    change: Number.isFinite(change) ? change : null,
    changePct: Number.isFinite(changePct) ? changePct : null,
    latestTradingDay: raw["07. latest trading day"] ?? null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    open: Number.isFinite(open) ? open : null,
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    volume: Number.isFinite(volume) ? volume : null,
    provider: "Alpha Vantage",
  };
}

async function fetchAlphaQuote(symbol: string) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) return null;

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      next: {
        revalidate: 30,
      },
    });

    const payload = await response.json();
    const quote = parseAlphaQuote(payload, symbol);

    return quote.price ? quote : null;
  } catch {
    return null;
  }
}

async function fetchAlphaCandles(symbol: string, interval: string) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) return null;

  const functionName =
    interval === "daily" ? "TIME_SERIES_DAILY" : "TIME_SERIES_INTRADAY";

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", functionName);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("outputsize", "full");

  if (interval !== "daily") {
    url.searchParams.set("interval", interval);
    url.searchParams.set("adjusted", "false");
    url.searchParams.set("extended_hours", "true");
  }

  try {
    const response = await fetch(url.toString(), {
      next: {
        revalidate: interval === "daily" ? 300 : 60,
      },
    });

    const payload = await response.json();
    const candles = parseAlphaVantageCandles(payload, interval);

    if (!candles.length) {
      return {
        provider: "Alpha Vantage",
        candles: [],
        note:
          payload?.Note ||
          payload?.Information ||
          payload?.["Error Message"] ||
          "Provider returned no candle data.",
      };
    }

    return {
      provider: "Alpha Vantage",
      candles,
      note: "Provider candle data loaded.",
    };
  } catch {
    return {
      provider: "Alpha Vantage",
      candles: [],
      note: "Provider fetch failed.",
    };
  }
}

async function fetchMarketCandles(symbol: string, interval: string) {
  const quote = await fetchAlphaQuote(symbol);
  const alpha = await fetchAlphaCandles(symbol, interval);

  if (alpha?.candles.length) {
    return {
      provider: "Alpha Vantage",
      candles: alpha.candles,
      quote,
      isLive: true,
      note: alpha.note,
      sourcePriority: ["Alpha Vantage full history", "Demo fallback"],
    };
  }

  return {
    provider: "Demo fallback",
    candles: generateDemoCandles(symbol, interval),
    quote,
    isLive: false,
    note:
      alpha?.note ||
      "Set ALPHA_VANTAGE_API_KEY to use provider market data.",
    sourcePriority: ["Demo fallback"],
  };
}

function freshnessReport(candles: Candle[], interval: string, isLive: boolean) {
  const session = marketSession();
  const latest = candles[candles.length - 1];

  if (!latest) {
    return {
      status: "No Data",
      asOf: null,
      ageMinutes: null,
      warning: "No candle data was returned.",
      session,
    };
  }

  const ageMinutes = Math.round(
    (Date.now() - new Date(latest.date).getTime()) / 60000
  );

  const maxExpectedAge =
    interval === "daily"
      ? 60 * 42
      : intervalMinutes(interval) * 4 + (session.isRegularMarket ? 20 : 120);

  let status = "Fresh";
  let warning = "Data appears fresh for the selected interval.";

  if (!isLive) {
    status = "Demo";
    warning = "This is demo fallback data and should not be used for trading decisions.";
  } else if (ageMinutes > maxExpectedAge) {
    status = "Stale";
    warning = `Latest candle is ${ageMinutes} minute(s) old, which may be stale for ${interval}.`;
  } else if (!session.isRegularMarket && !session.isExtendedHours) {
    status = "Market Closed";
    warning = "Market is currently closed; latest data may be from the last available session.";
  }

  return {
    status,
    asOf: latest.date,
    ageMinutes,
    warning,
    session,
  };
}

function supportResistance(candles: Candle[]) {
  const recent = candles.slice(-80);

  if (!recent.length) {
    return {
      support: 0,
      resistance: 0,
      midpoint: 0,
      distanceToSupportPct: 0,
      distanceToResistancePct: 0,
    };
  }

  const highs = recent.map((item) => item.high);
  const lows = recent.map((item) => item.low);
  const closes = recent.map((item) => item.close);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  const midpoint = closes.reduce((sum, value) => sum + value, 0) / closes.length;
  const latest = closes[closes.length - 1] || 1;

  return {
    support: round(support, 4),
    resistance: round(resistance, 4),
    midpoint: round(midpoint, 4),
    distanceToSupportPct: round(((latest - support) / latest) * 100, 4),
    distanceToResistancePct: round(((resistance - latest) / latest) * 100, 4),
  };
}

function signalSummary(points: VisualPoint[]) {
  const latest = points[points.length - 1];

  if (!latest) {
    return {
      directionalBias: "Unknown",
      momentum: "Unknown",
      riskState: "Unknown",
      summary: "No signal data available.",
    };
  }

  const aboveVwap = latest.vwap ? latest.close > latest.vwap : false;

  const smaTrend =
    latest.sma50 && latest.sma200
      ? latest.sma50 > latest.sma200
        ? "Bullish Long-Term"
        : "Bearish Long-Term"
      : latest.sma20 && latest.sma50
        ? latest.sma20 > latest.sma50
          ? "Bullish Short-Term"
          : "Bearish Short-Term"
        : "Neutral";

  const rsiState =
    latest.rsi14 === null
      ? "Unknown"
      : latest.rsi14 >= 70
        ? "Overbought"
        : latest.rsi14 <= 30
          ? "Oversold"
          : "Neutral";

  const macdState =
    latest.macd !== null && latest.macdSignal !== null
      ? latest.macd > latest.macdSignal
        ? "Positive MACD"
        : "Negative MACD"
      : "Unknown";

  const above200 = latest.sma200 ? latest.close > latest.sma200 : false;

  const directionalBias =
    above200 && aboveVwap && macdState === "Positive MACD"
      ? "Bullish"
      : !above200 && !aboveVwap && macdState === "Negative MACD"
        ? "Bearish"
        : "Mixed";

  return {
    directionalBias,
    momentum: `${rsiState} · ${macdState}`,
    riskState: rsiState,
    summary: `Bias is ${directionalBias}. Price is ${aboveVwap ? "above" : "below"} VWAP and ${
      latest.sma200 ? above200 ? "above" : "below" : "without enough history for"
    } the 200-period moving average. Moving-average trend is ${smaTrend}. RSI state is ${rsiState}.`,
  };
}

function qualityScore(input: {
  isLive: boolean;
  candles: Candle[];
  freshness: ReturnType<typeof freshnessReport>;
  quote: QuoteSnapshot | null;
}) {
  let score = 100;
  const warnings: string[] = [];

  if (!input.isLive) {
    score -= 45;
    warnings.push("Demo fallback data is active.");
  }

  if (input.candles.length < 60) {
    score -= 15;
    warnings.push("Fewer than 60 candles are available.");
  }

  if (input.candles.length < 200) {
    score -= 8;
    warnings.push("Fewer than 200 candles are available, so the 200-period moving average may be unavailable.");
  }

  if (input.freshness.status === "Stale") {
    score -= 25;
    warnings.push(input.freshness.warning);
  }

  if (!input.quote?.price) {
    score -= 6;
    warnings.push("No independent quote snapshot was available.");
  }

  if (input.freshness.session.session === "Closed") {
    warnings.push("Market is closed; latest available data may be from the prior session.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    warnings,
  };
}

async function platformVisuals(userId: string) {
  const [
    alerts,
    opportunities,
    tasks,
    clients,
    emailDrafts,
    sourceProfiles,
    watchlistItems,
  ] = await Promise.all([
    prisma.alertEvent.findMany({
      where: { userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.opportunitySignal.findMany({
      where: { userId },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 18,
    }),
    prisma.meetingTask.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.clientProfile.findMany({
      where: { userId },
      take: 50,
    }),
    prisma.personalUserBotEmailDraft.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    prisma.sourceCredibilityProfile.findMany({
      where: { userId },
      orderBy: [{ credibilityScore: "desc" }],
      take: 12,
    }),
    prisma.namedWatchlistItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const taskStatusCounts = ["Open", "Complete", "Pending", "Blocked"].map((status) => ({
    name: status,
    value: tasks.filter((task) => task.status === status).length,
  }));

  const platformOverview = [
    { name: "Alerts", value: alerts.length },
    { name: "Opportunities", value: opportunities.length },
    { name: "Tasks", value: tasks.length },
    { name: "Clients", value: clients.length },
    { name: "Email Drafts", value: emailDrafts.length },
  ];

  return {
    platformOverview,
    taskStatusCounts,
    alertScores: alerts.map((alert) => ({
      name: alert.ticker ?? alert.title.slice(0, 12),
      title: alert.title,
      score: alert.score,
      urgency: alert.urgency,
      source: alert.source,
    })),
    opportunityMatrix: opportunities.map((signal) => ({
      name: signal.title.slice(0, 18),
      title: signal.title,
      opportunity: signal.opportunityScore,
      risk: signal.riskScore,
      composite: signal.compositeScore,
      confidence: signal.confidenceScore,
      source: signal.sourceName,
    })),
    sourceCredibility: sourceProfiles.map((source) => ({
      name: source.sourceName.slice(0, 14),
      sourceName: source.sourceName,
      domain: source.domain,
      credibility: source.credibilityScore,
      transparency: source.transparencyScore,
      biasRisk: source.biasRisk,
      status: source.status,
    })),
    watchlistHeatmap: watchlistItems.map((item) => ({
      symbol: item.symbol,
      priority: item.priority,
      status: item.status,
      sourceType: item.sourceType,
      score:
        item.originalScore ??
        (item.priority === "High" ? 85 : item.priority === "Medium" ? 65 : 45),
    })),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const symbol = cleanSymbol(readSearchParam(url, "symbol", "NVDA")) || "NVDA";
  const rawInterval = readSearchParam(url, "interval", "5min");
  const interval = ["1min", "5min", "15min", "30min", "60min", "daily"].includes(rawInterval)
    ? rawInterval
    : "5min";

  const market = await fetchMarketCandles(symbol, interval);
  const visualPoints = enrichCandles(market.candles);
  const predictions = predictionFromCandles(market.candles);
  const platform = await platformVisuals(user.id);
  const freshness = freshnessReport(market.candles, interval, market.isLive);
  const quality = qualityScore({
    isLive: market.isLive,
    candles: market.candles,
    freshness,
    quote: market.quote,
  });
  const levels = supportResistance(market.candles);
  const signals = signalSummary(visualPoints);
  const modelConfidence = calculateModelConfidence(market.candles, market.isLive);

  const latest = visualPoints[visualPoints.length - 1];
  const previous = visualPoints[visualPoints.length - 2];
  const chartChange = latest && previous ? latest.close - previous.close : 0;
  const chartChangePct = previous ? (chartChange / previous.close) * 100 : 0;
  const quoteChange = market.quote?.change ?? null;
  const quoteChangePct = market.quote?.changePct ?? null;

  return NextResponse.json({
    symbol,
    interval,
    provider: market.provider,
    isLive: market.isLive,
    note: market.note,
    sourcePriority: market.sourcePriority,
    dataPolicy: {
      realTimeRequiresProvider: true,
      demoFallbackEnabled: true,
      accuracyReminder:
        "Use provider timestamps, freshness status, quote validation, liquidity, news, and client suitability before making any trading decision.",
    },
    marketSession: freshness.session,
    freshness,
    quality,
    quote: market.quote,
    levels,
    signals,
    modelConfidence,
    latest: latest
      ? {
          close: market.quote?.price ?? latest.close,
          chartClose: latest.close,
          change: quoteChange ?? round(chartChange, 4),
          changePct: quoteChangePct ?? round(chartChangePct, 4),
          rsi14: latest.rsi14,
          vwap: latest.vwap,
          sma20: latest.sma20,
          sma50: latest.sma50,
          sma100: latest.sma100,
          sma200: latest.sma200,
          ema9: latest.ema9,
          ema21: latest.ema21,
          macd: latest.macd,
          atr14: latest.atr14,
          volumeSma20: latest.volumeSma20,
          cumulativeReturnPct: latest.cumulativeReturnPct,
          asOf: latest.date,
        }
      : null,
    candles: visualPoints,
    predictions,
    platform,
  });
}