import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AlertCriteria = {
  alertStyle: string;
  requireAllCriteria: boolean;
  repeatCooldownMinutes: number;
  changePctAbove: number | null;
  changePctBelow: number | null;
  rsiAbove: number | null;
  rsiBelow: number | null;
  priceAboveSma20: boolean;
  priceBelowSma20: boolean;
  priceAboveSma50: boolean;
  priceBelowSma50: boolean;
  sma20AboveSma50: boolean;
  sma20BelowSma50: boolean;
  macdBullish: boolean;
  macdBearish: boolean;
  volumeSpikePctAbove: number | null;
  technicalScoreAbove: number | null;
  technicalScoreBelow: number | null;
  notes: string;
};

type ParsedAlertNotes = {
  plainNotes: string;
  criteria: AlertCriteria;
  meta: {
    lastTechnicalTriggeredAt?: string | null;
    createdFrom?: string;
    version?: number;
  };
};

type QuoteResult = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  provider: string;
  isLive: boolean;
  note: string;
};

type DailyPoint = {
  date: string;
  close: number;
  volume: number;
};

type MarketSnapshot = QuoteResult & {
  checkedAt: string;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  volumeAvg20: number | null;
  volumeSpikePct: number | null;
  technicalScore: number;
  technicalReasons: string[];
};

const META_MARKER = "[SLICE_WATCHLIST_ALERT_META]";
const MAX_SYMBOLS_PER_CHECK = 250;
const FETCH_CONCURRENCY = 5;

const DEFAULT_CRITERIA: AlertCriteria = {
  alertStyle: "Hybrid",
  requireAllCriteria: false,
  repeatCooldownMinutes: 240,
  changePctAbove: null,
  changePctBelow: null,
  rsiAbove: null,
  rsiBelow: null,
  priceAboveSma20: false,
  priceBelowSma20: false,
  priceAboveSma50: false,
  priceBelowSma50: false,
  sma20AboveSma50: false,
  sma20BelowSma50: false,
  macdBullish: false,
  macdBearish: false,
  volumeSpikePctAbove: null,
  technicalScoreAbove: null,
  technicalScoreBelow: null,
  notes: "",
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.replace(/\u0000/g, "").trim().slice(0, 12000)
    : fallback;
}

function readNullableText(value: unknown) {
  const text = readText(value);
  return text.length ? text : null;
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function cleanSymbol(value: unknown) {
  return readText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
}

function cleanSymbols(value: unknown) {
  const text = readText(value);

  return Array.from(
    new Set(
      text
        .split(/,|\n|\s|\t/)
        .map((item) => cleanSymbol(item))
        .filter(Boolean)
    )
  ).slice(0, 500);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeCriteria(value: unknown): AlertCriteria {
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    alertStyle: readText(input.alertStyle, DEFAULT_CRITERIA.alertStyle),
    requireAllCriteria:
      typeof input.requireAllCriteria === "boolean"
        ? input.requireAllCriteria
        : DEFAULT_CRITERIA.requireAllCriteria,
    repeatCooldownMinutes:
      readNumber(input.repeatCooldownMinutes) ??
      DEFAULT_CRITERIA.repeatCooldownMinutes,
    changePctAbove: readNumber(input.changePctAbove),
    changePctBelow: readNumber(input.changePctBelow),
    rsiAbove: readNumber(input.rsiAbove),
    rsiBelow: readNumber(input.rsiBelow),
    priceAboveSma20: readBoolean(input.priceAboveSma20),
    priceBelowSma20: readBoolean(input.priceBelowSma20),
    priceAboveSma50: readBoolean(input.priceAboveSma50),
    priceBelowSma50: readBoolean(input.priceBelowSma50),
    sma20AboveSma50: readBoolean(input.sma20AboveSma50),
    sma20BelowSma50: readBoolean(input.sma20BelowSma50),
    macdBullish: readBoolean(input.macdBullish),
    macdBearish: readBoolean(input.macdBearish),
    volumeSpikePctAbove: readNumber(input.volumeSpikePctAbove),
    technicalScoreAbove: readNumber(input.technicalScoreAbove),
    technicalScoreBelow: readNumber(input.technicalScoreBelow),
    notes: readText(input.notes),
  };
}

function parseAlertNotes(notes: string | null | undefined): ParsedAlertNotes {
  const raw = notes ?? "";
  const markerIndex = raw.indexOf(META_MARKER);

  if (markerIndex === -1) {
    return {
      plainNotes: raw.trim(),
      criteria: DEFAULT_CRITERIA,
      meta: {},
    };
  }

  const plainNotes = raw.slice(0, markerIndex).trim();
  const jsonPart = raw.slice(markerIndex + META_MARKER.length).trim();
  const parsed = parseJson<Partial<ParsedAlertNotes>>(jsonPart, {});

  return {
    plainNotes,
    criteria: normalizeCriteria(parsed.criteria),
    meta: parsed.meta ?? {},
  };
}

function buildAlertNotes(input: {
  plainNotes: string;
  criteria: AlertCriteria;
  meta?: ParsedAlertNotes["meta"];
}) {
  return [
    input.plainNotes.trim(),
    META_MARKER,
    JSON.stringify(
      {
        criteria: normalizeCriteria(input.criteria),
        meta: {
          version: 2,
          createdFrom: "Slice Watchlist Alerts",
          ...(input.meta ?? {}),
        },
      },
      null,
      2
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function hasAdvancedCriteria(criteria: AlertCriteria) {
  return Boolean(
    criteria.changePctAbove !== null ||
      criteria.changePctBelow !== null ||
      criteria.rsiAbove !== null ||
      criteria.rsiBelow !== null ||
      criteria.priceAboveSma20 ||
      criteria.priceBelowSma20 ||
      criteria.priceAboveSma50 ||
      criteria.priceBelowSma50 ||
      criteria.sma20AboveSma50 ||
      criteria.sma20BelowSma50 ||
      criteria.macdBullish ||
      criteria.macdBearish ||
      criteria.volumeSpikePctAbove !== null ||
      criteria.technicalScoreAbove !== null ||
      criteria.technicalScoreBelow !== null
  );
}

function wantsTechnicalSnapshot(criteria: AlertCriteria) {
  return Boolean(
    criteria.rsiAbove !== null ||
      criteria.rsiBelow !== null ||
      criteria.priceAboveSma20 ||
      criteria.priceBelowSma20 ||
      criteria.priceAboveSma50 ||
      criteria.priceBelowSma50 ||
      criteria.sma20AboveSma50 ||
      criteria.sma20BelowSma50 ||
      criteria.macdBullish ||
      criteria.macdBearish ||
      criteria.volumeSpikePctAbove !== null ||
      criteria.technicalScoreAbove !== null ||
      criteria.technicalScoreBelow !== null
  );
}

async function ensureDefaultWatchlist(userId: string) {
  const existing = await prisma.namedWatchlist.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.namedWatchlist.create({
    data: {
      userId,
      name: "Core Watchlist",
      description:
        "Private advisor watchlist for securities that should be monitored closely.",
      focus: "General",
      riskLevel: "Mixed",
    },
  });
}

async function fetchAlphaJson(params: Record<string, string>) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) return null;

  const url = new URL("https://www.alphavantage.co/query");

  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, value)
  );
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), { cache: "no-store" });
  return response.json();
}

async function fetchLiveQuote(symbol: string): Promise<QuoteResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return {
      symbol,
      price: null,
      change: null,
      changePct: null,
      volume: null,
      provider: "No live provider",
      isLive: false,
      note: "Set ALPHA_VANTAGE_API_KEY to enable live quote and technical checks.",
    };
  }

  try {
    const payload = await fetchAlphaJson({
      function: "GLOBAL_QUOTE",
      symbol,
    });

    const raw = payload?.["Global Quote"] ?? {};
    const price = Number(raw["05. price"]);
    const change = Number(raw["09. change"]);
    const changePct = Number(
      String(raw["10. change percent"] ?? "").replace("%", "")
    );
    const volume = Number(raw["06. volume"]);

    if (!Number.isFinite(price)) {
      return {
        symbol,
        price: null,
        change: null,
        changePct: null,
        volume: null,
        provider: "Alpha Vantage",
        isLive: false,
        note:
          payload?.Note ||
          payload?.Information ||
          payload?.["Error Message"] ||
          "Provider did not return a valid quote.",
      };
    }

    return {
      symbol,
      price: round(price),
      change: Number.isFinite(change) ? round(change) : null,
      changePct: Number.isFinite(changePct) ? round(changePct) : null,
      volume: Number.isFinite(volume) ? volume : null,
      provider: "Alpha Vantage",
      isLive: true,
      note: "Live quote loaded.",
    };
  } catch {
    return {
      symbol,
      price: null,
      change: null,
      changePct: null,
      volume: null,
      provider: "Alpha Vantage",
      isLive: false,
      note: "Quote fetch failed.",
    };
  }
}

async function fetchDailySeries(symbol: string): Promise<DailyPoint[]> {
  try {
    const payload = await fetchAlphaJson({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "compact",
    });

    const raw = payload?.["Time Series (Daily)"] ?? {};

    return Object.entries(raw)
      .map(([date, value]) => {
        const row = value as Record<string, string>;

        return {
          date,
          close: Number(row["4. close"]),
          volume: Number(row["5. volume"]),
        };
      })
      .filter((item) => Number.isFinite(item.close))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values: number[], period: number) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function ema(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let current = average(values.slice(0, period));

  if (current === null) return null;

  for (const value of values.slice(period)) {
    current = value * multiplier + current * (1 - multiplier);
  }

  return current;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.map((value) => Math.max(value, 0));
  const losses = recent.map((value) => Math.abs(Math.min(value, 0)));
  const avgGain = average(gains) ?? 0;
  const avgLoss = average(losses) ?? 0;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]) {
  if (values.length < 35) {
    return {
      macd: null,
      signal: null,
      histogram: null,
    };
  }

  const macdSeries: number[] = [];

  for (let index = 26; index <= values.length; index += 1) {
    const subset = values.slice(0, index);
    const ema12 = ema(subset, 12);
    const ema26 = ema(subset, 26);

    if (ema12 !== null && ema26 !== null) {
      macdSeries.push(ema12 - ema26);
    }
  }

  const latestMacd = macdSeries[macdSeries.length - 1] ?? null;
  const signal = ema(macdSeries, 9);
  const histogram =
    latestMacd !== null && signal !== null ? latestMacd - signal : null;

  return {
    macd: latestMacd,
    signal,
    histogram,
  };
}

function technicalScore(input: {
  price: number | null;
  changePct: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macdHistogram: number | null;
  volumeSpikePct: number | null;
}) {
  let score = 50;
  const reasons: string[] = [];

  if (input.changePct !== null) {
    score += Math.max(-14, Math.min(14, input.changePct * 2));
    reasons.push(`Daily move: ${round(input.changePct)}%.`);
  }

  if (input.price !== null && input.sma20 !== null) {
    if (input.price > input.sma20) {
      score += 8;
      reasons.push("Price is above the 20-day moving average.");
    } else {
      score -= 5;
      reasons.push("Price is below the 20-day moving average.");
    }
  }

  if (input.price !== null && input.sma50 !== null) {
    if (input.price > input.sma50) {
      score += 10;
      reasons.push("Price is above the 50-day moving average.");
    } else {
      score -= 8;
      reasons.push("Price is below the 50-day moving average.");
    }
  }

  if (input.sma20 !== null && input.sma50 !== null) {
    if (input.sma20 > input.sma50) {
      score += 8;
      reasons.push("20-day moving average is above the 50-day moving average.");
    } else {
      score -= 5;
      reasons.push("20-day moving average is below the 50-day moving average.");
    }
  }

  if (input.rsi14 !== null) {
    if (input.rsi14 >= 45 && input.rsi14 <= 65) {
      score += 8;
      reasons.push("RSI is in a constructive mid-range.");
    } else if (input.rsi14 < 30) {
      score += 4;
      reasons.push("RSI is oversold and may be mean-reversion sensitive.");
    } else if (input.rsi14 > 72) {
      score -= 7;
      reasons.push("RSI is extended.");
    }
  }

  if (input.macdHistogram !== null) {
    if (input.macdHistogram > 0) {
      score += 8;
      reasons.push("MACD histogram is positive.");
    } else {
      score -= 5;
      reasons.push("MACD histogram is negative.");
    }
  }

  if (input.volumeSpikePct !== null && input.volumeSpikePct > 50) {
    score += 7;
    reasons.push(
      `Volume is ${round(input.volumeSpikePct)}% above 20-day average.`
    );
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

async function fetchMarketSnapshot(
  symbol: string,
  wantsTechnicals: boolean
): Promise<MarketSnapshot> {
  const quote = await fetchLiveQuote(symbol);
  let daily: DailyPoint[] = [];

  if (wantsTechnicals || quote.price === null) {
    daily = await fetchDailySeries(symbol);
  }

  const closes = daily.map((item) => item.close);
  const volumes = daily.map((item) => item.volume).filter(Number.isFinite);
  const latestDaily = daily[daily.length - 1];

  const price = quote.price ?? latestDaily?.close ?? null;
  const currentVolume = quote.volume ?? latestDaily?.volume ?? null;
  const volumeAvg20 = average(volumes.slice(-20));
  const volumeSpikePct =
    currentVolume !== null && volumeAvg20
      ? round(((currentVolume - volumeAvg20) / volumeAvg20) * 100)
      : null;

  const macdValue = macd(closes);
  const snapshotBase = {
    price,
    changePct: quote.changePct,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes, 14),
    macdHistogram: macdValue.histogram,
    volumeSpikePct,
  };

  const scored = technicalScore(snapshotBase);

  return {
    ...quote,
    price,
    checkedAt: new Date().toISOString(),
    sma20: snapshotBase.sma20 !== null ? round(snapshotBase.sma20) : null,
    sma50: snapshotBase.sma50 !== null ? round(snapshotBase.sma50) : null,
    sma200: snapshotBase.sma200 !== null ? round(snapshotBase.sma200) : null,
    rsi14: snapshotBase.rsi14 !== null ? round(snapshotBase.rsi14) : null,
    macd: macdValue.macd !== null ? round(macdValue.macd, 4) : null,
    macdSignal: macdValue.signal !== null ? round(macdValue.signal, 4) : null,
    macdHistogram:
      macdValue.histogram !== null ? round(macdValue.histogram, 4) : null,
    volumeAvg20: volumeAvg20 !== null ? Math.round(volumeAvg20) : null,
    volumeSpikePct,
    technicalScore: scored.score,
    technicalReasons: scored.reasons,
    provider: quote.isLive
      ? "Alpha Vantage"
      : latestDaily
        ? "Alpha Vantage Daily Series"
        : quote.provider,
    isLive: quote.isLive || Boolean(latestDaily),
    note: quote.note,
  };
}

function criteriaRules(criteria: AlertCriteria, snapshot: MarketSnapshot) {
  const rules: Array<{ label: string; active: boolean; passed: boolean }> = [
    {
      label: `Daily move above ${criteria.changePctAbove}%`,
      active: criteria.changePctAbove !== null,
      passed:
        snapshot.changePct !== null &&
        criteria.changePctAbove !== null &&
        snapshot.changePct >= criteria.changePctAbove,
    },
    {
      label: `Daily move below ${criteria.changePctBelow}%`,
      active: criteria.changePctBelow !== null,
      passed:
        snapshot.changePct !== null &&
        criteria.changePctBelow !== null &&
        snapshot.changePct <= criteria.changePctBelow,
    },
    {
      label: `RSI above ${criteria.rsiAbove}`,
      active: criteria.rsiAbove !== null,
      passed:
        snapshot.rsi14 !== null &&
        criteria.rsiAbove !== null &&
        snapshot.rsi14 >= criteria.rsiAbove,
    },
    {
      label: `RSI below ${criteria.rsiBelow}`,
      active: criteria.rsiBelow !== null,
      passed:
        snapshot.rsi14 !== null &&
        criteria.rsiBelow !== null &&
        snapshot.rsi14 <= criteria.rsiBelow,
    },
    {
      label: "Price above 20-day SMA",
      active: criteria.priceAboveSma20,
      passed:
        snapshot.price !== null &&
        snapshot.sma20 !== null &&
        snapshot.price > snapshot.sma20,
    },
    {
      label: "Price below 20-day SMA",
      active: criteria.priceBelowSma20,
      passed:
        snapshot.price !== null &&
        snapshot.sma20 !== null &&
        snapshot.price < snapshot.sma20,
    },
    {
      label: "Price above 50-day SMA",
      active: criteria.priceAboveSma50,
      passed:
        snapshot.price !== null &&
        snapshot.sma50 !== null &&
        snapshot.price > snapshot.sma50,
    },
    {
      label: "Price below 50-day SMA",
      active: criteria.priceBelowSma50,
      passed:
        snapshot.price !== null &&
        snapshot.sma50 !== null &&
        snapshot.price < snapshot.sma50,
    },
    {
      label: "20-day SMA above 50-day SMA",
      active: criteria.sma20AboveSma50,
      passed:
        snapshot.sma20 !== null &&
        snapshot.sma50 !== null &&
        snapshot.sma20 > snapshot.sma50,
    },
    {
      label: "20-day SMA below 50-day SMA",
      active: criteria.sma20BelowSma50,
      passed:
        snapshot.sma20 !== null &&
        snapshot.sma50 !== null &&
        snapshot.sma20 < snapshot.sma50,
    },
    {
      label: "MACD bullish",
      active: criteria.macdBullish,
      passed: snapshot.macdHistogram !== null && snapshot.macdHistogram > 0,
    },
    {
      label: "MACD bearish",
      active: criteria.macdBearish,
      passed: snapshot.macdHistogram !== null && snapshot.macdHistogram < 0,
    },
    {
      label: `Volume spike above ${criteria.volumeSpikePctAbove}%`,
      active: criteria.volumeSpikePctAbove !== null,
      passed:
        snapshot.volumeSpikePct !== null &&
        criteria.volumeSpikePctAbove !== null &&
        snapshot.volumeSpikePct >= criteria.volumeSpikePctAbove,
    },
    {
      label: `Technical score above ${criteria.technicalScoreAbove}`,
      active: criteria.technicalScoreAbove !== null,
      passed:
        criteria.technicalScoreAbove !== null &&
        snapshot.technicalScore >= criteria.technicalScoreAbove,
    },
    {
      label: `Technical score below ${criteria.technicalScoreBelow}`,
      active: criteria.technicalScoreBelow !== null,
      passed:
        criteria.technicalScoreBelow !== null &&
        snapshot.technicalScore <= criteria.technicalScoreBelow,
    },
  ];

  return rules.filter((rule) => rule.active);
}

function technicalCooldownActive(parsed: ParsedAlertNotes) {
  if (!parsed.meta.lastTechnicalTriggeredAt) return false;

  const last = new Date(parsed.meta.lastTechnicalTriggeredAt).getTime();
  if (Number.isNaN(last)) return false;

  const cooldownMs =
    Math.max(0, parsed.criteria.repeatCooldownMinutes || 240) * 60 * 1000;

  return Date.now() - last < cooldownMs;
}

function evaluateAlert(input: {
  alert: {
    id: string;
    symbol: string;
    upperTargetPrice: number | null;
    lowerTargetPrice: number | null;
    triggeredHighAt: Date | null;
    triggeredLowAt: Date | null;
    notes: string | null;
  };
  snapshot: MarketSnapshot;
}) {
  const parsed = parseAlertNotes(input.alert.notes);
  const criteria = parsed.criteria;
  const price = input.snapshot.price;
  const triggers: Array<{
    triggerType: string;
    targetValue: number;
    message: string;
    score: number;
    urgency: string;
  }> = [];

  if (
    price !== null &&
    input.alert.upperTargetPrice !== null &&
    price >= input.alert.upperTargetPrice &&
    !input.alert.triggeredHighAt
  ) {
    triggers.push({
      triggerType: "High",
      targetValue: input.alert.upperTargetPrice,
      message: `${input.alert.symbol} traded at $${price}, above the high target of $${input.alert.upperTargetPrice}.`,
      score: 92,
      urgency: "High",
    });
  }

  if (
    price !== null &&
    input.alert.lowerTargetPrice !== null &&
    price <= input.alert.lowerTargetPrice &&
    !input.alert.triggeredLowAt
  ) {
    triggers.push({
      triggerType: "Low",
      targetValue: input.alert.lowerTargetPrice,
      message: `${input.alert.symbol} traded at $${price}, below the low target of $${input.alert.lowerTargetPrice}.`,
      score: 92,
      urgency: "High",
    });
  }

  const rules = criteriaRules(criteria, input.snapshot);
  const technicalPass =
    rules.length > 0 &&
    !technicalCooldownActive(parsed) &&
    (criteria.requireAllCriteria
      ? rules.every((rule) => rule.passed)
      : rules.some((rule) => rule.passed));

  if (technicalPass) {
    const passed = rules.filter((rule) => rule.passed);

    triggers.push({
      triggerType: "Technical",
      targetValue:
        criteria.technicalScoreAbove ??
        criteria.technicalScoreBelow ??
        input.snapshot.technicalScore,
      message: `${input.alert.symbol} cleared technical alert criteria. Passed: ${passed
        .map((rule) => rule.label)
        .join(", ")}. Technical score: ${input.snapshot.technicalScore}/100.`,
      score: input.snapshot.technicalScore >= 82 ? 90 : 78,
      urgency: input.snapshot.technicalScore >= 82 ? "High" : "Medium",
    });
  }

  return {
    parsed,
    rules,
    triggers,
  };
}

async function createTriggerRecords({
  userId,
  userEmail,
  alert,
  triggerType,
  targetValue,
  observedPrice,
  provider,
  message,
  score,
  urgency,
}: {
  userId: string;
  userEmail: string;
  alert: {
    id: string;
    symbol: string;
    assetName: string | null;
    notificationChannel: string;
  };
  triggerType: string;
  targetValue: number;
  observedPrice: number;
  provider: string;
  message: string;
  score: number;
  urgency: string;
}) {
  const title = `${alert.symbol} ${triggerType} Watchlist Alert`;

  await prisma.watchlistPriceAlertEvent.create({
    data: {
      userId,
      alertId: alert.id,
      symbol: alert.symbol,
      triggerType,
      targetPrice: round(targetValue),
      observedPrice: round(observedPrice),
      provider,
      message,
    },
  });

  const alertEvent = await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId,
        dedupeKey: `watchlist-alert:${alert.id}:${triggerType}:${new Date()
          .toISOString()
          .slice(0, 10)}`,
      },
    },
    update: {
      title,
      body: message,
      source: "Watchlist Alert",
      ticker: alert.symbol,
      urgency,
      score,
      channel: alert.notificationChannel,
      status: "Unread",
      readAt: null,
      aiBriefing: `Watchlist alert triggered for ${alert.symbol}. Trigger: ${triggerType}. Observed price: $${round(
        observedPrice
      )}. Provider: ${provider}.`,
    },
    create: {
      userId,
      dedupeKey: `watchlist-alert:${alert.id}:${triggerType}:${new Date()
        .toISOString()
        .slice(0, 10)}`,
      title,
      body: message,
      source: "Watchlist Alert",
      ticker: alert.symbol,
      urgency,
      score,
      channel: alert.notificationChannel,
      status: "Unread",
      aiBriefing: `Watchlist alert triggered for ${alert.symbol}. Trigger: ${triggerType}. Observed price: $${round(
        observedPrice
      )}. Provider: ${provider}.`,
    },
  });

  await prisma.notificationDelivery.create({
    data: {
      userId,
      alertEventId: alertEvent.id,
      channel: alert.notificationChannel,
      destination: alert.notificationChannel === "Email" ? userEmail : "Dashboard",
      status: "Queued",
      urgency,
      score,
      title,
      body: message,
      reason: `Watchlist ${triggerType.toLowerCase()} alert triggered for ${alert.symbol}.`,
      simulated: true,
    },
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await worker(current));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );

  return results;
}

async function checkAlerts(userId: string, userEmail: string) {
  const alerts = await prisma.watchlistPriceAlert.findMany({
    where: {
      userId,
      status: "Active",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 800,
  });

  const symbols = Array.from(new Set(alerts.map((alert) => alert.symbol))).slice(
    0,
    MAX_SYMBOLS_PER_CHECK
  );

  const alertsBySymbol = new Map(
    symbols.map((symbol) => [
      symbol,
      alerts.filter((alert) => alert.symbol === symbol),
    ])
  );

  const snapshots = await mapWithConcurrency(
    symbols,
    FETCH_CONCURRENCY,
    async (symbol) => {
      const symbolAlerts = alertsBySymbol.get(symbol) ?? [];
      const wantsTechnicals = symbolAlerts.some((alert) =>
        wantsTechnicalSnapshot(parseAlertNotes(alert.notes).criteria)
      );
      const snapshot = await fetchMarketSnapshot(symbol, wantsTechnicals);
      return [symbol, snapshot] as const;
    }
  );

  const snapshotMap = new Map(snapshots);
  const results = [];
  let triggered = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const snapshot = snapshotMap.get(alert.symbol);

    if (!snapshot || !snapshot.isLive || snapshot.price === null) {
      await prisma.watchlistPriceAlert.update({
        where: {
          id: alert.id,
        },
        data: {
          lastProvider: snapshot?.provider ?? "No live provider",
          lastCheckedAt: new Date(),
        },
      });

      skipped += 1;
      results.push({
        alertId: alert.id,
        symbol: alert.symbol,
        status: "Skipped",
        note: snapshot?.note ?? "No snapshot available.",
        snapshot,
      });

      continue;
    }

    const evaluation = evaluateAlert({ alert, snapshot });
    let triggerCountIncrease = 0;
    const parsed = evaluation.parsed;

    const updateData: {
      lastPrice: number;
      lastProvider: string;
      lastCheckedAt: Date;
      triggeredHighAt?: Date;
      triggeredLowAt?: Date;
      triggerCount?: number;
      status?: string;
      notes?: string;
    } = {
      lastPrice: snapshot.price,
      lastProvider: snapshot.provider,
      lastCheckedAt: new Date(),
    };

    for (const trigger of evaluation.triggers) {
      await createTriggerRecords({
        userId,
        userEmail,
        alert,
        triggerType: trigger.triggerType,
        targetValue: trigger.targetValue,
        observedPrice: snapshot.price,
        provider: snapshot.provider,
        message: trigger.message,
        score: trigger.score,
        urgency: trigger.urgency,
      });

      triggerCountIncrease += 1;
      triggered += 1;

      if (trigger.triggerType === "High") {
        updateData.triggeredHighAt = new Date();
      }

      if (trigger.triggerType === "Low") {
        updateData.triggeredLowAt = new Date();
      }

      if (trigger.triggerType === "Technical") {
        updateData.notes = buildAlertNotes({
          plainNotes: parsed.plainNotes,
          criteria: parsed.criteria,
          meta: {
            ...parsed.meta,
            lastTechnicalTriggeredAt: new Date().toISOString(),
          },
        });
      }
    }

    const highComplete =
      !alert.upperTargetPrice ||
      Boolean(alert.triggeredHighAt || updateData.triggeredHighAt);

    const lowComplete =
      !alert.lowerTargetPrice ||
      Boolean(alert.triggeredLowAt || updateData.triggeredLowAt);

    if (triggerCountIncrease > 0) {
      updateData.triggerCount = alert.triggerCount + triggerCountIncrease;

      if (highComplete && lowComplete && !hasAdvancedCriteria(parsed.criteria)) {
        updateData.status = "Triggered";
      }
    }

    await prisma.watchlistPriceAlert.update({
      where: {
        id: alert.id,
      },
      data: updateData,
    });

    results.push({
      alertId: alert.id,
      symbol: alert.symbol,
      status: triggerCountIncrease ? "Triggered" : "Checked",
      triggers: evaluation.triggers.map((item) => item.triggerType),
      rules: evaluation.rules,
      snapshot,
    });
  }

  return {
    checked: alerts.length,
    symbolsChecked: symbols.length,
    triggered,
    skipped,
    results,
  };
}

async function loadData(userId: string) {
  await ensureDefaultWatchlist(userId);

  const [alerts, events, watchlists, watchAssets, clients] = await Promise.all([
    prisma.watchlistPriceAlert.findMany({
      where: {
        userId,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 800,
    }),
    prisma.watchlistPriceAlertEvent.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 150,
    }),
    prisma.namedWatchlist.findMany({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.watchAsset.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.clientProfile.findMany({
      where: {
        userId,
      },
      include: {
        holdings: true,
      },
    }),
  ]);

  const clientExposureBySymbol = new Map<string, number>();

  clients.forEach((client) => {
    client.holdings.forEach((holding) => {
      clientExposureBySymbol.set(
        holding.symbol,
        (clientExposureBySymbol.get(holding.symbol) ?? 0) + 1
      );
    });
  });

  const parsedAlerts = alerts.map((alert) => {
    const parsed = parseAlertNotes(alert.notes);

    return {
      ...alert,
      notes: parsed.plainNotes,
      criteria: parsed.criteria,
      alertMeta: parsed.meta,
      advancedCriteriaCount: criteriaRules(parsed.criteria, {
        symbol: alert.symbol,
        price: alert.lastPrice,
        change: null,
        changePct: null,
        volume: null,
        provider: alert.lastProvider ?? "Stored",
        isLive: false,
        note: "Stored alert metadata.",
        checkedAt: alert.lastCheckedAt?.toISOString() ?? "",
        sma20: null,
        sma50: null,
        sma200: null,
        rsi14: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        volumeAvg20: null,
        volumeSpikePct: null,
        technicalScore: 50,
        technicalReasons: [],
      }).length,
    };
  });

  const enrichedWatchlists = watchlists.map((watchlist) => ({
    ...watchlist,
    items: watchlist.items.map((item) => ({
      ...item,
      alertCount: parsedAlerts.filter((alert) => alert.symbol === item.symbol)
        .length,
      activeAlertCount: parsedAlerts.filter(
        (alert) => alert.symbol === item.symbol && alert.status === "Active"
      ).length,
      clientExposureCount: clientExposureBySymbol.get(item.symbol) ?? 0,
      watchAsset: watchAssets.find((asset) => asset.ticker === item.symbol) ?? null,
    })),
  }));

  const active = parsedAlerts.filter((alert) => alert.status === "Active").length;
  const triggeredCount = parsedAlerts.filter(
    (alert) => alert.status === "Triggered"
  ).length;
  const paused = parsedAlerts.filter((alert) => alert.status === "Paused").length;
  const technical = parsedAlerts.filter(
    (alert) => alert.advancedCriteriaCount > 0
  ).length;

  const uniqueSymbols = new Set([
    ...enrichedWatchlists.flatMap((watchlist) =>
      watchlist.items.map((item) => item.symbol)
    ),
    ...parsedAlerts.map((alert) => alert.symbol),
  ]);

  return {
    alerts: parsedAlerts,
    events,
    watchlists: enrichedWatchlists,
    provider: {
      alphaVantageConfigured: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      quoteProvider: process.env.ALPHA_VANTAGE_API_KEY
        ? "Alpha Vantage"
        : "Not configured",
      tradingViewMode: "Free embedded charts",
      maxSymbolsPerCheck: MAX_SYMBOLS_PER_CHECK,
    },
    stats: {
      total: parsedAlerts.length,
      active,
      triggered: triggeredCount,
      paused,
      technical,
      recentEvents: events.length,
      watchlists: enrichedWatchlists.length,
      symbols: uniqueSymbols.size,
      clientExposedSymbols: Array.from(clientExposureBySymbol.keys()).length,
    },
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  return noStoreJson(await loadData(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "createWatchlist") {
    const name = readText(body.name);

    if (!name) {
      return noStoreJson({ error: "Watchlist name is required." }, { status: 400 });
    }

    await prisma.namedWatchlist.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name,
        },
      },
      update: {
        description: readNullableText(body.description),
        focus: readText(body.focus, "General"),
        riskLevel: readText(body.riskLevel, "Mixed"),
      },
      create: {
        userId: user.id,
        name,
        description: readNullableText(body.description),
        focus: readText(body.focus, "General"),
        riskLevel: readText(body.riskLevel, "Mixed"),
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: `${name} watchlist saved.`,
    });
  }

  if (action === "deleteWatchlist") {
    const watchlistId = readText(body.watchlistId);

    if (!watchlistId) {
      return noStoreJson({ error: "Watchlist ID is required." }, { status: 400 });
    }

    await prisma.namedWatchlist.deleteMany({
      where: {
        id: watchlistId,
        userId: user.id,
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: "Watchlist deleted.",
    });
  }

  if (action === "addSymbols") {
    const watchlistId = readText(body.watchlistId);
    const symbols = cleanSymbols(body.symbols);
    const priority = readText(body.priority, "Medium");
    const thesis = readNullableText(body.thesis);
    const riskNotes = readNullableText(body.riskNotes);

    if (!watchlistId) {
      return noStoreJson({ error: "Choose a watchlist first." }, { status: 400 });
    }

    if (!symbols.length) {
      return noStoreJson({ error: "Enter at least one ticker." }, { status: 400 });
    }

    const watchlist = await prisma.namedWatchlist.findFirst({
      where: {
        id: watchlistId,
        userId: user.id,
      },
    });

    if (!watchlist) {
      return noStoreJson({ error: "Watchlist not found." }, { status: 404 });
    }

    for (const symbol of symbols) {
      await prisma.namedWatchlistItem.upsert({
        where: {
          watchlistId_symbol: {
            watchlistId,
            symbol,
          },
        },
        update: {
          priority,
          thesis,
          riskNotes,
          status: "Watching",
        },
        create: {
          userId: user.id,
          watchlistId,
          symbol,
          assetName: symbol,
          assetType: "Stock",
          sourceType: "Manual",
          priority,
          thesis,
          riskNotes,
          status: "Watching",
        },
      });

      await prisma.watchAsset.upsert({
        where: {
          userId_ticker: {
            userId: user.id,
            ticker: symbol,
          },
        },
        update: {
          name: symbol,
          notes: thesis,
        },
        create: {
          userId: user.id,
          ticker: symbol,
          name: symbol,
          assetType: "Stock",
          notes: thesis,
        },
      });
    }

    return noStoreJson({
      ...(await loadData(user.id)),
      message: `${symbols.length} ticker(s) added to ${watchlist.name}.`,
    });
  }

  if (action === "deleteWatchlistItem") {
    const itemId = readText(body.itemId);

    if (!itemId) {
      return noStoreJson({ error: "Item ID is required." }, { status: 400 });
    }

    await prisma.namedWatchlistItem.deleteMany({
      where: {
        id: itemId,
        userId: user.id,
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: "Watchlist item removed.",
    });
  }

  if (action === "createAlert") {
    const symbol = cleanSymbol(body.symbol);
    const upperTargetPrice = readNumber(body.upperTargetPrice);
    const lowerTargetPrice = readNumber(body.lowerTargetPrice);
    const watchlistItemId = readText(body.watchlistItemId, "");
    const incomingWatchlistId = readText(body.watchlistId, "");
    const notificationChannel = readText(body.notificationChannel, "Dashboard");
    const notes = readText(body.notes, "");
    const criteria = normalizeCriteria(body.criteria);

    if (!symbol) {
      return noStoreJson({ error: "Symbol is required." }, { status: 400 });
    }

    if (
      upperTargetPrice === null &&
      lowerTargetPrice === null &&
      !hasAdvancedCriteria(criteria)
    ) {
      return noStoreJson(
        { error: "Enter a price target or at least one technical criterion." },
        { status: 400 }
      );
    }

    let watchlistItem: {
      id: string;
      watchlistId: string;
      symbol: string;
      assetName: string;
    } | null = null;

    if (watchlistItemId) {
      watchlistItem = await prisma.namedWatchlistItem.findFirst({
        where: {
          id: watchlistItemId,
          userId: user.id,
        },
      });
    }

    if (!watchlistItem && incomingWatchlistId) {
      const watchlist = await prisma.namedWatchlist.findFirst({
        where: {
          id: incomingWatchlistId,
          userId: user.id,
        },
      });

      if (watchlist) {
        watchlistItem = await prisma.namedWatchlistItem.upsert({
          where: {
            watchlistId_symbol: {
              watchlistId: incomingWatchlistId,
              symbol,
            },
          },
          update: {
            status: "Watching",
          },
          create: {
            userId: user.id,
            watchlistId: incomingWatchlistId,
            symbol,
            assetName: readText(body.assetName, symbol),
            assetType: "Stock",
            sourceType: "Manual",
            priority: readText(body.priority, "Medium"),
            thesis: readNullableText(body.thesis),
            riskNotes: readNullableText(body.riskNotes),
            status: "Watching",
          },
        });
      }
    }

    let resolvedWatchlistId: string | null = null;

    if (watchlistItem && watchlistItem.watchlistId) {
      resolvedWatchlistId = watchlistItem.watchlistId;
    } else if (incomingWatchlistId) {
      resolvedWatchlistId = incomingWatchlistId;
    }

    await prisma.watchlistPriceAlert.create({
      data: {
        userId: user.id,
        watchlistId: resolvedWatchlistId,
        watchlistItemId: watchlistItem?.id ?? null,
        symbol: watchlistItem?.symbol ?? symbol,
        assetName: watchlistItem?.assetName ?? readText(body.assetName, symbol),
        upperTargetPrice,
        lowerTargetPrice,
        notificationChannel,
        status: "Active",
        notes: buildAlertNotes({
          plainNotes: notes,
          criteria,
        }),
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: `${symbol} alert created.`,
    });
  }

  if (action === "updateAlert") {
    const alertId = readText(body.alertId);
    const upperTargetPrice = readNumber(body.upperTargetPrice);
    const lowerTargetPrice = readNumber(body.lowerTargetPrice);
    const notificationChannel = readText(body.notificationChannel, "Dashboard");
    const notes = readText(body.notes, "");
    const status = readText(body.status, "Active");
    const criteria = normalizeCriteria(body.criteria);

    if (!alertId) {
      return noStoreJson({ error: "Alert ID is required." }, { status: 400 });
    }

    await prisma.watchlistPriceAlert.updateMany({
      where: {
        id: alertId,
        userId: user.id,
      },
      data: {
        upperTargetPrice,
        lowerTargetPrice,
        notificationChannel,
        notes: buildAlertNotes({
          plainNotes: notes,
          criteria,
        }),
        status,
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: "Alert updated.",
    });
  }

  if (action === "pauseAlert" || action === "activateAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return noStoreJson({ error: "Alert ID is required." }, { status: 400 });
    }

    await prisma.watchlistPriceAlert.updateMany({
      where: {
        id: alertId,
        userId: user.id,
      },
      data: {
        status: action === "pauseAlert" ? "Paused" : "Active",
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: action === "pauseAlert" ? "Alert paused." : "Alert activated.",
    });
  }

  if (action === "resetAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return noStoreJson({ error: "Alert ID is required." }, { status: 400 });
    }

    const alert = await prisma.watchlistPriceAlert.findFirst({
      where: {
        id: alertId,
        userId: user.id,
      },
    });

    if (alert) {
      const parsed = parseAlertNotes(alert.notes);

      await prisma.watchlistPriceAlert.updateMany({
        where: {
          id: alertId,
          userId: user.id,
        },
        data: {
          status: "Active",
          triggeredHighAt: null,
          triggeredLowAt: null,
          notes: buildAlertNotes({
            plainNotes: parsed.plainNotes,
            criteria: parsed.criteria,
            meta: {
              ...parsed.meta,
              lastTechnicalTriggeredAt: null,
            },
          }),
        },
      });
    }

    return noStoreJson({
      ...(await loadData(user.id)),
      message: "Alert reset.",
    });
  }

  if (action === "deleteAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return noStoreJson({ error: "Alert ID is required." }, { status: 400 });
    }

    await prisma.watchlistPriceAlert.deleteMany({
      where: {
        id: alertId,
        userId: user.id,
      },
    });

    return noStoreJson({
      ...(await loadData(user.id)),
      message: "Alert deleted.",
    });
  }

  if (action === "checkAlerts") {
    const check = await checkAlerts(user.id, user.email);

    return noStoreJson({
      ...(await loadData(user.id)),
      check,
      message: `Checked ${check.checked} active alert(s) across ${check.symbolsChecked} symbol(s). Triggered ${check.triggered}. Skipped ${check.skipped}.`,
    });
  }

  return noStoreJson(await loadData(user.id));
}