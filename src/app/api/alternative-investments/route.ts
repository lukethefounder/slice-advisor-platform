import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAiText } from "@/lib/integrations/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

const ALT_META_MARKER = "[SLICE_ALTERNATIVE_META]";
const BRIEFING_RULE_TYPE = "Alternative Briefing";

const TRACKED_CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "ripple",
  "cardano",
  "dogecoin",
  "chainlink",
  "avalanche-2",
  "polkadot",
  "uniswap",
  "near",
  "internet-computer",
  "aptos",
  "arbitrum",
  "optimism",
  "render-token",
  "the-graph",
  "aave",
  "maker",
  "litecoin",
  "stellar",
  "hedera-hashgraph",
  "filecoin",
  "cosmos",
  "injective-protocol",
  "sui",
  "sei-network",
  "celestia",
  "immutable-x",
  "ondo-finance",
];

const DEFAULT_GLOBAL_EVENT_TOPICS = [
  "U.S. economy",
  "Federal Reserve rates inflation labor market",
  "S&P 500 Nasdaq market breadth earnings guidance",
  "oil prices natural gas energy market",
  "gold silver copper lithium uranium commodity prices",
  "tariffs trade policy supply chain shipping",
  "global war conflict sanctions markets",
  "labor strike union supply chain public company",
  "civil unrest uprising election risk markets",
  "crypto regulation Bitcoin Ethereum ETF flows",
  "venture funding AI startup private markets",
];

type CryptoMarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation?: number | null;
  total_volume: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_24h?: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  market_cap_change_percentage_24h?: number | null;
  sparkline_in_7d?: {
    price: number[];
  };
  last_updated?: string | null;
};

type EnrichedCryptoCoin = CryptoMarketCoin & {
  trendLabel: string;
  riskScore: number;
  riskLevel: string;
  opportunityScore: number;
  liquidityScore: number;
  valuationScore: number;
  momentumScore: number;
  riskAdjustedScore: number;
  volumeToMarketCapPct: number | null;
  fdvToMarketCap: number | null;
  advisorAction: string;
  advisorNotes: string[];
};

type FearGreedPoint = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
};

type PennyQuote = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  provider: string;
  note: string;
};

type BriefingAudience = "Advisor" | "Client/Investor";

type BriefingCoverage = {
  audienceType: BriefingAudience;
  intervalHours: number;
  localFocus: string;
  scope: "Local" | "U.S." | "Global" | "Local → Global";
  includeMarket: boolean;
  includeEconomy: boolean;
  includeCrypto: boolean;
  includeAlternatives: boolean;
  includeCommodities: boolean;
  includeEnergy: boolean;
  includeMinerals: boolean;
  includeGeopolitics: boolean;
  includeTariffs: boolean;
  includeLabor: boolean;
  includeVenture: boolean;
  commodities: string[];
  globalTopics: string[];
  tone: string;
  deliveryChannel: "Email" | "Dashboard" | "Both";
  recipientLabel: string;
  advisorInstructions: string;
};

type BriefingEvent = {
  title: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  topic: string;
  scope: string;
  summary: string;
};

type CommoditySnapshot = {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
  source: string;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Slice-Alternatives", "v6-briefing-schema-compatible");
  return response;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

function cleanTicker(value: unknown) {
  return cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 12);
}

function toFloat(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function optionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toFloat(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function splitNotesAndMeta(notes: string | null | undefined) {
  const raw = notes ?? "";
  const index = raw.indexOf(ALT_META_MARKER);

  if (index === -1) {
    return {
      plainNotes: raw.trim(),
      meta: {} as Record<string, unknown>,
    };
  }

  const plainNotes = raw.slice(0, index).trim();
  const json = raw.slice(index + ALT_META_MARKER.length).trim();

  return {
    plainNotes,
    meta: safeJsonParse<Record<string, unknown>>(json, {}),
  };
}

function buildNotesWithMeta(plainNotes: string, meta: Record<string, unknown>) {
  const cleanPlain = cleanString(plainNotes);

  return [
    cleanPlain,
    ALT_META_MARKER,
    JSON.stringify(
      {
        version: 2,
        createdFrom: "Slice Alternative Investments",
        updatedAt: new Date().toISOString(),
        ...meta,
      },
      null,
      2
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function canManageAlternatives(membership: {
  role: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
}) {
  return (
    membership.role === "Owner" ||
    membership.canManageProjects ||
    membership.canManageFirm
  );
}

function riskTone(score: number) {
  if (score >= 85) return "Extreme";
  if (score >= 70) return "Very High";
  if (score >= 55) return "High";
  if (score >= 40) return "Elevated";
  return "Moderate";
}

function cryptoTrendLabel(coin: CryptoMarketCoin) {
  const oneHour = coin.price_change_percentage_1h_in_currency ?? 0;
  const day = coin.price_change_percentage_24h ?? 0;
  const week = coin.price_change_percentage_7d_in_currency ?? 0;
  const month = coin.price_change_percentage_30d_in_currency ?? 0;

  if (day > 8 && week > 12 && month > 10) return "Strong upside momentum";
  if (day > 3 && week > 5) return "Positive trend";
  if (month < -25 && week > 4 && day > 0) return "Rebound attempt";
  if (day < -8 && week < -12) return "Sharp downside pressure";
  if (day < -3 && week < -5) return "Negative trend";
  if (Math.abs(oneHour) > 3 || Math.abs(day) > 6) return "Volatile setup";
  if (month > 20 && week < -2) return "Cooling after strong month";
  if (month < -15 && week > 0) return "Possible basing attempt";

  return "Mixed / consolidating";
}

function cryptoMomentumScore(coin: CryptoMarketCoin) {
  const oneHour = coin.price_change_percentage_1h_in_currency ?? 0;
  const day = coin.price_change_percentage_24h ?? 0;
  const week = coin.price_change_percentage_7d_in_currency ?? 0;
  const month = coin.price_change_percentage_30d_in_currency ?? 0;

  const trendStack =
    oneHour > 0 && day > 0 && week > 0
      ? 12
      : day > 0 && week > 0
        ? 8
        : day < 0 && week < 0
          ? -12
          : 0;

  return clamp(
    50 + oneHour * 1.2 + day * 1.6 + week * 0.9 + month * 0.25 + trendStack
  );
}

function cryptoVolatilityScore(coin: CryptoMarketCoin) {
  const day = Math.abs(coin.price_change_percentage_24h ?? 0);
  const week = Math.abs(coin.price_change_percentage_7d_in_currency ?? 0);
  const month = Math.abs(coin.price_change_percentage_30d_in_currency ?? 0);
  const intradayRange =
    coin.high_24h && coin.low_24h && coin.current_price
      ? ((coin.high_24h - coin.low_24h) / coin.current_price) * 100
      : 0;

  return clamp(day * 3 + week * 1.25 + month * 0.35 + intradayRange * 1.4);
}

function cryptoLiquidityScore(coin: CryptoMarketCoin) {
  const marketCap = coin.market_cap ?? 0;
  const volume = coin.total_volume ?? 0;

  if (!marketCap || !volume) return 35;

  const volumeToMarketCap = volume / marketCap;

  return clamp(
    marketCap > 100_000_000_000
      ? 92
      : marketCap > 20_000_000_000
        ? 82
        : marketCap > 5_000_000_000
          ? 68
          : marketCap > 1_000_000_000
            ? 52 + volumeToMarketCap * 150
            : 38 + volumeToMarketCap * 120
  );
}

function cryptoValuationScore(coin: CryptoMarketCoin) {
  const marketCap = coin.market_cap ?? 0;
  const fdv = coin.fully_diluted_valuation ?? 0;
  const volume = coin.total_volume ?? 0;
  const rank = coin.market_cap_rank ?? 999;

  const fdvOverhang =
    fdv > 0 && marketCap > 0
      ? Math.max(0, ((fdv - marketCap) / marketCap) * 100)
      : 40;
  const volumeSupport = marketCap > 0 ? Math.min(30, (volume / marketCap) * 300) : 0;
  const rankQuality = rank <= 3 ? 22 : rank <= 10 ? 15 : rank <= 25 ? 8 : 0;

  return clamp(55 + rankQuality + volumeSupport - fdvOverhang * 0.25);
}

function cryptoRiskScore(coin: CryptoMarketCoin) {
  const marketCap = coin.market_cap ?? 0;
  const rank = coin.market_cap_rank ?? 999;
  const volatility = cryptoVolatilityScore(coin);
  const liquidity = cryptoLiquidityScore(coin);
  const valuation = cryptoValuationScore(coin);

  const sizeRisk =
    marketCap > 100_000_000_000
      ? 5
      : marketCap > 20_000_000_000
        ? 12
        : marketCap > 5_000_000_000
          ? 22
          : marketCap > 1_000_000_000
            ? 32
            : 45;

  const rankRisk = rank <= 10 ? 0 : rank <= 30 ? 8 : 18;

  return clamp(28 + volatility * 0.55 + sizeRisk + rankRisk - liquidity * 0.18 - valuation * 0.1);
}

function cryptoOpportunityScore(coin: CryptoMarketCoin) {
  const momentum = cryptoMomentumScore(coin);
  const liquidity = cryptoLiquidityScore(coin);
  const valuation = cryptoValuationScore(coin);
  const risk = cryptoRiskScore(coin);
  const month = coin.price_change_percentage_30d_in_currency ?? 0;
  const week = coin.price_change_percentage_7d_in_currency ?? 0;

  const reboundBonus = month < -20 && week > 3 ? 10 : 0;
  const overheatedPenalty = month > 65 && week > 20 ? 12 : 0;

  return clamp(
    38 +
      momentum * 0.34 +
      liquidity * 0.2 +
      valuation * 0.22 -
      risk * 0.12 +
      reboundBonus -
      overheatedPenalty
  );
}

function cryptoRiskAdjustedScore(coin: CryptoMarketCoin) {
  const opportunity = cryptoOpportunityScore(coin);
  const risk = cryptoRiskScore(coin);
  const liquidity = cryptoLiquidityScore(coin);
  const valuation = cryptoValuationScore(coin);

  return clamp(opportunity * 0.45 + liquidity * 0.22 + valuation * 0.22 - risk * 0.18 + 20);
}

function cryptoAdvisorAction(coin: CryptoMarketCoin) {
  const score = cryptoRiskAdjustedScore(coin);
  const risk = cryptoRiskScore(coin);
  const trend = cryptoTrendLabel(coin);

  if (score >= 82 && risk <= 62) {
    return "Advisor review candidate: liquid enough for research and trend is favorable, but size conservatively.";
  }

  if (trend.includes("Rebound") || trend.includes("basing")) {
    return "Watch for confirmation: possible reversal behavior, but require volume and trend follow-through.";
  }

  if (risk >= 82) {
    return "Do not present as an opportunity without strict risk disclosure and liquidity review.";
  }

  return "Monitor only: keep in alternatives dashboard until trend, valuation, and liquidity improve.";
}

function enrichCryptoCoin(coin: CryptoMarketCoin): EnrichedCryptoCoin {
  const riskScore = cryptoRiskScore(coin);
  const opportunityScore = cryptoOpportunityScore(coin);
  const liquidityScore = cryptoLiquidityScore(coin);
  const valuationScore = cryptoValuationScore(coin);
  const momentumScore = cryptoMomentumScore(coin);
  const riskAdjustedScore = cryptoRiskAdjustedScore(coin);
  const volumeToMarketCapPct =
    coin.market_cap && coin.total_volume ? (coin.total_volume / coin.market_cap) * 100 : null;
  const fdvToMarketCap =
    coin.market_cap && coin.fully_diluted_valuation
      ? coin.fully_diluted_valuation / coin.market_cap
      : null;

  return {
    ...coin,
    trendLabel: cryptoTrendLabel(coin),
    riskScore,
    riskLevel: riskTone(riskScore),
    opportunityScore,
    liquidityScore,
    valuationScore,
    momentumScore,
    riskAdjustedScore,
    volumeToMarketCapPct,
    fdvToMarketCap,
    advisorAction: cryptoAdvisorAction(coin),
    advisorNotes: [
      `${coin.name} is showing ${cryptoTrendLabel(coin).toLowerCase()}.`,
      `Risk-adjusted score is ${riskAdjustedScore}/100, combining momentum, liquidity, valuation discipline, and volatility control.`,
      `Risk score is ${riskScore}/100, driven by recent volatility, size, rank, liquidity, and FDV overhang.`,
      `Valuation score is ${valuationScore}/100, partly based on FDV-to-market-cap pressure and volume support.`,
      `Advisor action: ${cryptoAdvisorAction(coin)}`,
    ],
  };
}

function fallbackCryptoMarkets(): EnrichedCryptoCoin[] {
  const fallbackCoins: CryptoMarketCoin[] = [
    {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      current_price: null,
      market_cap: null,
      market_cap_rank: 1,
      total_volume: null,
      price_change_percentage_24h: null,
      price_change_percentage_1h_in_currency: null,
      price_change_percentage_7d_in_currency: null,
      price_change_percentage_30d_in_currency: null,
      fully_diluted_valuation: null,
      sparkline_in_7d: { price: [] },
      last_updated: null,
    },
    {
      id: "ethereum",
      symbol: "eth",
      name: "Ethereum",
      current_price: null,
      market_cap: null,
      market_cap_rank: 2,
      total_volume: null,
      price_change_percentage_24h: null,
      price_change_percentage_1h_in_currency: null,
      price_change_percentage_7d_in_currency: null,
      price_change_percentage_30d_in_currency: null,
      fully_diluted_valuation: null,
      sparkline_in_7d: { price: [] },
      last_updated: null,
    },
  ];

  return fallbackCoins.map(enrichCryptoCoin);
}

async function fetchCryptoMarkets(): Promise<EnrichedCryptoCoin[]> {
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: TRACKED_CRYPTO_IDS.join(","),
    order: "market_cap_desc",
    per_page: "60",
    page: "1",
    sparkline: "true",
    price_change_percentage: "1h,24h,7d,30d",
  });

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
      }
    );

    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

    const coins = (await response.json()) as CryptoMarketCoin[];
    return coins.map(enrichCryptoCoin);
  } catch {
    return fallbackCryptoMarkets();
  }
}

async function fetchFearGreed() {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=30&format=json", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) throw new Error(`Alternative.me returned ${response.status}`);

    const payload = (await response.json()) as {
      name?: string;
      data?: FearGreedPoint[];
      metadata?: { error: string | null };
    };

    const data = payload.data ?? [];
    const latest = data[0] ?? null;

    return {
      source: "Alternative.me",
      latest,
      history: data,
      value: latest ? Number(latest.value) : null,
      classification: latest?.value_classification ?? "Unavailable",
      updatedAt: latest ? new Date(Number(latest.timestamp) * 1000).toISOString() : null,
    };
  } catch {
    return {
      source: "Alternative.me",
      latest: null,
      history: [],
      value: null,
      classification: "Unavailable",
      updatedAt: null,
    };
  }
}

function marketRegimeFromFearGreed(value: number | null) {
  if (value === null) {
    return {
      regime: "Unavailable",
      riskComment:
        "Sentiment feed is unavailable. Do not rely on market psychology signals until refreshed.",
      riskScoreAdjustment: 8,
    };
  }

  if (value <= 20) {
    return {
      regime: "Extreme Fear",
      riskComment:
        "Potential capitulation environment. Could create opportunity, but catching falling knives is a major risk.",
      riskScoreAdjustment: 12,
    };
  }

  if (value <= 40) {
    return {
      regime: "Fear",
      riskComment:
        "Risk appetite is weak. Better entries may appear, but negative momentum can persist.",
      riskScoreAdjustment: 6,
    };
  }

  if (value <= 60) {
    return {
      regime: "Neutral",
      riskComment:
        "No clear sentiment extreme. Focus more heavily on trend, liquidity, and catalyst quality.",
      riskScoreAdjustment: 0,
    };
  }

  if (value <= 80) {
    return {
      regime: "Greed",
      riskComment:
        "Risk appetite is elevated. Momentum can continue, but position sizing should be disciplined.",
      riskScoreAdjustment: 8,
    };
  }

  return {
    regime: "Extreme Greed",
    riskComment:
      "Euphoria risk is high. Strong upside may remain, but sharp reversals and liquidations become more dangerous.",
    riskScoreAdjustment: 16,
  };
}

async function fetchPennyQuote(ticker: string): Promise<PennyQuote> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return {
      ticker,
      price: null,
      change: null,
      changePct: null,
      volume: null,
      provider: "No live provider",
      note: "Set ALPHA_VANTAGE_API_KEY to enable live quote enrichment.",
    };
  }

  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString(), { cache: "no-store" });
    const payload = await response.json();
    const quote = payload?.["Global Quote"] ?? {};

    const price = Number(quote["05. price"]);
    const change = Number(quote["09. change"]);
    const changePct = Number(String(quote["10. change percent"] ?? "").replace("%", ""));
    const volume = Number(quote["06. volume"]);

    if (!Number.isFinite(price)) {
      return {
        ticker,
        price: null,
        change: null,
        changePct: null,
        volume: null,
        provider: "Alpha Vantage",
        note:
          payload?.Note ||
          payload?.Information ||
          payload?.["Error Message"] ||
          "No valid quote returned.",
      };
    }

    return {
      ticker,
      price: round(price, price < 1 ? 5 : 2),
      change: Number.isFinite(change) ? round(change, 5) : null,
      changePct: Number.isFinite(changePct) ? round(changePct, 2) : null,
      volume: Number.isFinite(volume) ? volume : null,
      provider: "Alpha Vantage",
      note: "Quote loaded.",
    };
  } catch {
    return {
      ticker,
      price: null,
      change: null,
      changePct: null,
      volume: null,
      provider: "Alpha Vantage",
      note: "Quote fetch failed.",
    };
  }
}

function keywordScore(text: string, groups: string[]) {
  const lower = text.toLowerCase();
  return groups.reduce((score, keyword) => (lower.includes(keyword) ? score + 1 : score), 0);
}

function enrichPennyStock(stock: any, quote: PennyQuote | null) {
  const text = [
    stock.thesis,
    stock.catalyst,
    stock.riskNotes,
    stock.notes,
    stock.sector,
    stock.companyName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const positiveCatalysts = keywordScore(text, [
    "contract",
    "fda",
    "approval",
    "revenue",
    "partnership",
    "patent",
    "uplisting",
    "earnings",
    "acquisition",
    "cash flow",
    "backlog",
    "clinical",
    "pilot",
  ]);

  const redFlags = keywordScore(text, [
    "dilution",
    "going concern",
    "reverse split",
    "promotional",
    "pump",
    "lawsuit",
    "delisting",
    "toxic",
    "convertible",
    "warrant",
    "thin",
    "illiquid",
    "bankruptcy",
  ]);

  const maxPositionPct = stock.maxPositionPct ?? 0;
  const hasPositionLimit = maxPositionPct > 0 && maxPositionPct <= 3;
  const liveMomentum = quote?.changePct ?? 0;
  const liveVolume = quote?.volume ?? 0;

  const catalystScore = clamp(35 + positiveCatalysts * 11 + (stock.catalyst ? 12 : 0));
  const promotionRiskScore = clamp(38 + redFlags * 11 + (stock.riskLevel === "Extreme" ? 14 : 0));
  const liquidityProxyScore = quote?.volume ? clamp(30 + Math.log10(Math.max(quote.volume, 1)) * 10) : 35;
  const disciplineScore = clamp(
    30 +
      (hasPositionLimit ? 24 : 0) +
      (stock.targetEntry ? 12 : 0) +
      (stock.riskNotes ? 10 : 0) +
      (stock.status === "Active Review" ? 8 : 0)
  );
  const trendScore = clamp(
    45 +
      liveMomentum * 2 +
      positiveCatalysts * 8 +
      (liveVolume > 500_000 ? 10 : 0) -
      redFlags * 6
  );
  const riskReductionScore = clamp(
    disciplineScore * 0.42 +
      liquidityProxyScore * 0.25 +
      catalystScore * 0.22 -
      promotionRiskScore * 0.22 +
      25
  );
  const speculativeScore = clamp(
    trendScore * 0.32 +
      catalystScore * 0.28 +
      liquidityProxyScore * 0.18 +
      disciplineScore * 0.16 -
      promotionRiskScore * 0.2 +
      12
  );

  const advisorGuardrails = [
    "Use only as a speculative watch item unless liquidity, reporting quality, and dilution risk are verified.",
    hasPositionLimit
      ? `Position limit recorded at ${maxPositionPct}% maximum.`
      : "No conservative max position limit recorded. Add one before advisor presentation.",
    stock.riskNotes
      ? "Risk notes are present and should be reviewed before any client discussion."
      : "Risk notes are missing. Add dilution, liquidity, reporting, and promotional-risk context.",
    quote?.price !== null && quote?.price !== undefined
      ? `Live quote context: ${quote.ticker} at ${quote.price}, ${quote.changePct ?? 0}% change.`
      : "Live quote unavailable; avoid trend claims until verified.",
  ];

  return {
    ...stock,
    quote,
    catalystScore,
    promotionRiskScore,
    liquidityProxyScore,
    disciplineScore,
    trendScore,
    riskReductionScore,
    speculativeScore,
    advisorGuardrails,
    riskAdjustedLabel:
      riskReductionScore >= 76
        ? "Better controlled speculation"
        : riskReductionScore >= 60
          ? "Watch with strict guardrails"
          : "High-risk watch only",
  };
}

function ventureStageRisk(stage: string) {
  const lower = stage.toLowerCase();
  if (lower.includes("pre")) return 88;
  if (lower.includes("seed")) return 78;
  if (lower.includes("series a")) return 68;
  if (lower.includes("series b")) return 58;
  if (lower.includes("growth")) return 48;
  return 72;
}

function enrichVenture(venture: any) {
  const { plainNotes, meta } = splitNotesAndMeta(venture.notes);
  const valuation = venture.tentativeValuation ?? 0;
  const equity = venture.equityOfferedPct ?? 0;
  const amount = venture.amountSought ?? 0;
  const impliedPostMoney = amount > 0 && equity > 0 ? amount / (equity / 100) : null;
  const valuationGapPct =
    impliedPostMoney && valuation > 0 ? ((valuation - impliedPostMoney) / impliedPostMoney) * 100 : null;

  const text = [
    venture.background,
    venture.problemToSolve,
    venture.solution,
    venture.traction,
    venture.thesis,
    venture.keyRisks,
    plainNotes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tractionSignals = keywordScore(text, [
    "revenue",
    "customers",
    "signed",
    "pilot",
    "partnership",
    "retention",
    "profit",
    "waitlist",
    "contract",
    "arr",
    "mrr",
    "patent",
  ]);

  const riskSignals = keywordScore(text, [
    "pre-revenue",
    "regulatory",
    "lawsuit",
    "capital intensive",
    "hardware",
    "unproven",
    "crowded",
    "churn",
    "dependency",
    "concentration",
  ]);

  const stageRiskScore = ventureStageRisk(venture.stage);
  const valuationDisciplineScore = clamp(
    78 -
      Math.max(0, valuationGapPct ?? 0) * 0.2 -
      (valuation > 50_000_000 && venture.stage.toLowerCase().includes("seed") ? 20 : 0) +
      (equity >= 5 && equity <= 20 ? 8 : 0)
  );
  const tractionScore = clamp(35 + tractionSignals * 11 + (venture.traction ? 14 : 0));
  const founderMarketScore = clamp(42 + (venture.solution ? 8 : 0) + (venture.problemToSolve ? 10 : 0) + tractionSignals * 5);
  const ventureRiskScore = clamp(stageRiskScore + riskSignals * 8 - tractionSignals * 3);
  const diligenceScore = clamp(
    tractionScore * 0.28 +
      founderMarketScore * 0.24 +
      valuationDisciplineScore * 0.26 -
      ventureRiskScore * 0.18 +
      30
  );
  const presentationScore = clamp(
    30 +
      (meta.imageUrl ? 12 : 0) +
      (meta.deckUrl ? 16 : 0) +
      (meta.presentationSummary ? 14 : 0) +
      (meta.revenueModel ? 9 : 0) +
      (meta.moat ? 9 : 0) +
      (meta.nextDiligence ? 9 : 0)
  );

  return {
    ...venture,
    notes: plainNotes,
    alternativeMeta: meta,
    imageUrl: typeof meta.imageUrl === "string" ? meta.imageUrl : null,
    deckUrl: typeof meta.deckUrl === "string" ? meta.deckUrl : null,
    presentationSummary:
      typeof meta.presentationSummary === "string" ? meta.presentationSummary : null,
    revenueModel: typeof meta.revenueModel === "string" ? meta.revenueModel : null,
    moat: typeof meta.moat === "string" ? meta.moat : null,
    nextDiligence: typeof meta.nextDiligence === "string" ? meta.nextDiligence : null,
    customerProfile: typeof meta.customerProfile === "string" ? meta.customerProfile : null,
    impliedPostMoney,
    valuationGapPct,
    tractionScore,
    valuationDisciplineScore,
    founderMarketScore,
    ventureRiskScore,
    diligenceScore,
    presentationScore,
    ventureRecommendation:
      diligenceScore >= 78 && presentationScore >= 68
        ? "Diligence-ready candidate"
        : diligenceScore >= 62
          ? "Continue structured diligence"
          : "Watch only until evidence improves",
  };
}

async function getFirmWorkspace(userId: string, requestedFirmId?: string | null) {
  const memberships = await db.firmMembership.findMany({
    where: { userId, status: "Active" },
    include: { firm: true },
    orderBy: { createdAt: "desc" },
  });

  const firmId = requestedFirmId ?? memberships[0]?.firmId ?? null;

  if (!firmId) {
    return {
      firms: memberships.map((membership: any) => ({
        ...membership.firm,
        membership,
      })),
      firm: null,
      membership: null,
    };
  }

  const membership = await db.firmMembership.findFirst({
    where: { userId, firmId, status: "Active" },
    include: { firm: true },
  });

  if (!membership) {
    return {
      firms: memberships.map((item: any) => ({
        ...item.firm,
        membership: item,
      })),
      firm: null,
      membership: null,
    };
  }

  return {
    firms: memberships.map((item: any) => ({
      ...item.firm,
      membership: item,
    })),
    firm: membership.firm,
    membership,
  };
}

async function writeAuditLog({
  userId,
  eventType,
  title,
  detail,
  metadata,
}: {
  userId: string;
  eventType: string;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      userId,
      eventType,
      severity: "Info",
      area: "Alternative Investments",
      title,
      detail: detail ?? null,
      metadataJson: JSON.stringify(metadata ?? {}),
    },
  });
}

async function enrichPennyStocks(stocks: any[]) {
  const quotes = new Map<string, PennyQuote>();

  for (const stock of stocks.slice(0, 25)) {
    quotes.set(stock.ticker, await fetchPennyQuote(stock.ticker));
  }

  return stocks.map((stock) => enrichPennyStock(stock, quotes.get(stock.ticker) ?? null));
}

function normalizeCoverage(input: Record<string, unknown>): BriefingCoverage {
  const audienceType =
    cleanString(input.audienceType) === "Client/Investor" ? "Client/Investor" : "Advisor";

  const intervalHours = clamp(Number(input.intervalHours) || 24, 1, 168);

  const rawScope = cleanString(input.scope);
  const scope =
    rawScope === "Local" || rawScope === "U.S." || rawScope === "Global" || rawScope === "Local → Global"
      ? rawScope
      : "Local → Global";

  const commodities =
    typeof input.commodities === "string"
      ? input.commodities.split(/,|\n/).map((item) => cleanString(item)).filter(Boolean)
      : Array.isArray(input.commodities)
        ? input.commodities.map((item) => cleanString(item)).filter(Boolean)
        : ["Oil", "Natural Gas", "Gold", "Silver", "Copper", "Lithium", "Uranium"];

  const globalTopics =
    typeof input.globalTopics === "string"
      ? input.globalTopics.split(/,|\n/).map((item) => cleanString(item)).filter(Boolean)
      : Array.isArray(input.globalTopics)
        ? input.globalTopics.map((item) => cleanString(item)).filter(Boolean)
        : DEFAULT_GLOBAL_EVENT_TOPICS;

  return {
    audienceType,
    intervalHours,
    localFocus: cleanString(input.localFocus) || "Phoenix, Arizona",
    scope,
    includeMarket: readBoolean(input.includeMarket, true),
    includeEconomy: readBoolean(input.includeEconomy, true),
    includeCrypto: readBoolean(input.includeCrypto, true),
    includeAlternatives: readBoolean(input.includeAlternatives, true),
    includeCommodities: readBoolean(input.includeCommodities, true),
    includeEnergy: readBoolean(input.includeEnergy, true),
    includeMinerals: readBoolean(input.includeMinerals, true),
    includeGeopolitics: readBoolean(input.includeGeopolitics, true),
    includeTariffs: readBoolean(input.includeTariffs, true),
    includeLabor: readBoolean(input.includeLabor, true),
    includeVenture: readBoolean(input.includeVenture, true),
    commodities,
    globalTopics,
    tone: cleanString(input.tone) || "Professional, balanced, advisor-grade",
    deliveryChannel:
      cleanString(input.deliveryChannel) === "Email" ||
      cleanString(input.deliveryChannel) === "Dashboard" ||
      cleanString(input.deliveryChannel) === "Both"
        ? (cleanString(input.deliveryChannel) as "Email" | "Dashboard" | "Both")
        : "Email",
    recipientLabel: cleanString(input.recipientLabel) || audienceType,
    advisorInstructions: cleanString(input.advisorInstructions),
  };
}

function briefingScheduleDescription(coverage: BriefingCoverage) {
  return `Generate ${coverage.audienceType.toLowerCase()} briefing every ${coverage.intervalHours} hour(s), covering ${coverage.scope}.`;
}

function parseBriefingRuleTemplate(rule: any) {
  const parsed = safeJsonParse<Record<string, unknown>>(rule.actionTemplate, {});

  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.coverage &&
    typeof parsed.coverage === "object"
  ) {
    return {
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      coverage: parsed.coverage as Record<string, unknown>,
      version: typeof parsed.version === "number" ? parsed.version : 2,
    };
  }

  return {
    description: null,
    coverage: parsed,
    version: 1,
  };
}

function parseCoverage(rule: any): BriefingCoverage {
  const template = parseBriefingRuleTemplate(rule);
  return normalizeCoverage(template.coverage);
}

function parseBriefingScheduleDescription(rule: any) {
  const template = parseBriefingRuleTemplate(rule);
  const coverage = parseCoverage(rule);

  return template.description || briefingScheduleDescription(coverage);
}

function sourceDomain(url: string | null) {
  if (!url) return "Unknown";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " "));
}

function extractRssTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? stripHtml(match[1]) : "";
}

function extractRssLink(block: string) {
  const direct = extractRssTag(block, "link");
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const href = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeEntities(href) : "";
}

async function fetchRssEvents({
  query,
  topic,
  scope,
  since,
  limit = 8,
}: {
  query: string;
  topic: string;
  scope: string;
  since: Date;
  limit?: number;
}): Promise<BriefingEvent[]> {
  const encoded = encodeURIComponent(`${query} when:7d`);
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const text = await response.text();
    const items = text.match(/<item[\s\S]*?<\/item>/gi) ?? [];

    return items
      .map((block) => {
        const title = extractRssTag(block, "title");
        const link = extractRssLink(block);
        const publishedRaw = extractRssTag(block, "pubDate");
        const description = extractRssTag(block, "description");
        const publishedAt = publishedRaw ? new Date(publishedRaw) : null;

        return {
          title,
          source: sourceDomain(link),
          url: link || null,
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
          topic,
          scope,
          summary: description || title,
        };
      })
      .filter((event) => {
        if (!event.title) return false;
        if (!event.publishedAt) return true;
        return new Date(event.publishedAt).getTime() >= since.getTime();
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function fetchCommoditySnapshots(commodities: string[]): Promise<CommoditySnapshot[]> {
  const symbolMap: Record<string, { symbol: string; label: string }> = {
    oil: { symbol: "cl.f", label: "Crude Oil" },
    "crude oil": { symbol: "cl.f", label: "Crude Oil" },
    "wti oil": { symbol: "cl.f", label: "WTI Crude Oil" },
    natural: { symbol: "ng.f", label: "Natural Gas" },
    "natural gas": { symbol: "ng.f", label: "Natural Gas" },
    gold: { symbol: "gc.f", label: "Gold" },
    silver: { symbol: "si.f", label: "Silver" },
    copper: { symbol: "hg.f", label: "Copper" },
    platinum: { symbol: "pl.f", label: "Platinum" },
  };

  const mapped = commodities
    .map((item) => symbolMap[item.toLowerCase()] ?? null)
    .filter(Boolean) as Array<{ symbol: string; label: string }>;

  if (!mapped.length) return [];

  try {
    const url = `https://stooq.com/q/l/?s=${mapped.map((item) => item.symbol).join(",")}&f=sd2t2ohlcv&h&e=csv`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const csv = await response.text();
    const rows = csv.trim().split(/\r?\n/).slice(1);

    return rows.map((row, index) => {
      const cols = row.split(",");
      const close = Number(cols[6]);
      const open = Number(cols[3]);
      const changePct =
        Number.isFinite(close) && Number.isFinite(open) && open !== 0
          ? ((close - open) / open) * 100
          : null;

      return {
        symbol: mapped[index]?.symbol ?? cols[0],
        label: mapped[index]?.label ?? cols[0],
        price: Number.isFinite(close) ? close : null,
        changePct: changePct === null ? null : round(changePct, 2),
        source: "Stooq",
      };
    });
  } catch {
    return [];
  }
}

function buildBriefingQueries(coverage: BriefingCoverage) {
  const queries: Array<{ query: string; topic: string; scope: string }> = [];

  if (coverage.scope === "Local" || coverage.scope === "Local → Global") {
    queries.push({
      query: `${coverage.localFocus} economy business real estate labor market infrastructure`,
      topic: "Local economy",
      scope: "Local",
    });
  }

  if (coverage.scope === "U.S." || coverage.scope === "Local → Global" || coverage.scope === "Global") {
    if (coverage.includeMarket) {
      queries.push({
        query: "U.S. stock market S&P 500 Nasdaq Dow earnings yields",
        topic: "U.S. markets",
        scope: "U.S.",
      });
    }

    if (coverage.includeEconomy) {
      queries.push({
        query: "U.S. economy inflation jobs GDP Federal Reserve Treasury yields",
        topic: "U.S. economy",
        scope: "U.S.",
      });
    }

    if (coverage.includeCommodities || coverage.includeEnergy || coverage.includeMinerals) {
      queries.push({
        query: `${coverage.commodities.join(" ")} commodity prices oil gas metals supply demand`,
        topic: "Commodities and resources",
        scope: "U.S. / Global",
      });
    }

    if (coverage.includeCrypto) {
      queries.push({
        query: "Bitcoin Ethereum crypto ETF flows regulation stablecoin market",
        topic: "Digital assets",
        scope: "Global",
      });
    }

    if (coverage.includeVenture) {
      queries.push({
        query: "venture capital funding AI startup private markets IPO",
        topic: "Private markets",
        scope: "U.S. / Global",
      });
    }
  }

  if (coverage.scope === "Global" || coverage.scope === "Local → Global") {
    for (const topic of coverage.globalTopics.slice(0, 12)) {
      queries.push({
        query: topic,
        topic,
        scope: "Global",
      });
    }
  }

  if (coverage.includeTariffs) {
    queries.push({
      query: "tariffs trade policy import duties supply chain markets",
      topic: "Tariffs and trade",
      scope: "Global",
    });
  }

  if (coverage.includeLabor) {
    queries.push({
      query: "labor strike union supply chain public company economy",
      topic: "Labor and strikes",
      scope: "U.S. / Global",
    });
  }

  if (coverage.includeGeopolitics) {
    queries.push({
      query: "war sanctions geopolitical risk oil markets shipping",
      topic: "Geopolitical risk",
      scope: "Global",
    });
  }

  return queries;
}

function intervalStart(rule: any, coverage: BriefingCoverage) {
  if (rule?.lastRunAt) return new Date(rule.lastRunAt);

  const now = Date.now();
  return new Date(now - coverage.intervalHours * 60 * 60 * 1000);
}

function fallbackBriefingText(input: {
  coverage: BriefingCoverage;
  events: BriefingEvent[];
  commoditySnapshots: CommoditySnapshot[];
  cryptoMarkets: EnrichedCryptoCoin[];
  fearGreed: Awaited<ReturnType<typeof fetchFearGreed>>;
  since: Date;
  until: Date;
}) {
  const { coverage, events, commoditySnapshots, cryptoMarkets, fearGreed, since, until } = input;
  const topCrypto = cryptoMarkets
    .slice()
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
    .slice(0, 5);

  const eventLines = events.length
    ? events
        .slice(0, 18)
        .map(
          (event) =>
            `- [${event.scope}] ${event.title} (${event.source}${event.publishedAt ? `, ${new Date(event.publishedAt).toLocaleString()}` : ""})`
        )
        .join("\n")
    : "- No qualifying news events were captured inside this interval.";

  const commodityLines = commoditySnapshots.length
    ? commoditySnapshots
        .map(
          (item) =>
            `- ${item.label}: ${item.price ?? "n/a"} (${item.changePct !== null ? `${item.changePct}% intraday` : "change unavailable"})`
        )
        .join("\n")
    : "- Commodity snapshot unavailable or not selected.";

  const cryptoLines = topCrypto.length
    ? topCrypto
        .map(
          (coin) =>
            `- ${coin.name}: risk-adjusted ${coin.riskAdjustedScore}/100, trend ${coin.trendLabel}, 24h ${coin.price_change_percentage_24h ?? 0}%`
        )
        .join("\n")
    : "- Crypto market data unavailable.";

  if (coverage.audienceType === "Client/Investor") {
    return [
      `Subject: ${coverage.recipientLabel} briefing: market and economic update`,
      "",
      `This briefing covers events captured between ${since.toLocaleString()} and ${until.toLocaleString()}.`,
      "",
      "Key takeaways:",
      "- Markets remain sensitive to rates, inflation, earnings expectations, commodities, and geopolitical developments.",
      `- Crypto sentiment: ${fearGreed.classification}${fearGreed.value !== null ? ` (${fearGreed.value})` : ""}.`,
      "- Alternative investments remain speculative and should be considered only within suitability, liquidity, and risk constraints.",
      "",
      "Market and economic events:",
      eventLines,
      "",
      "Commodities and resource indicators:",
      commodityLines,
      "",
      "Digital asset monitor:",
      cryptoLines,
      "",
      "Advisor review note: This briefing is informational only and should not be treated as a recommendation or guarantee.",
    ].join("\n");
  }

  return [
    `Advisor Briefing — ${coverage.scope} Scope`,
    `Interval: ${since.toLocaleString()} → ${until.toLocaleString()}`,
    "",
    "Executive read:",
    `- Briefing audience: ${coverage.audienceType}.`,
    `- Scope path: ${coverage.scope}; local focus: ${coverage.localFocus}.`,
    `- Crypto sentiment: ${fearGreed.classification}${fearGreed.value !== null ? ` (${fearGreed.value})` : ""}.`,
    "- Use this as a review packet before client-facing communication.",
    "",
    "Interval news capture:",
    eventLines,
    "",
    "Commodities, energy, and minerals:",
    commodityLines,
    "",
    "Crypto and alternatives:",
    cryptoLines,
    "",
    "Suggested advisor actions:",
    "- Review whether any event affects client holdings, sector exposure, liquidity needs, or risk tolerance.",
    "- Do not forward raw alternative investment ideas to clients without suitability review.",
    "- For client/investor briefings, remove speculative language and use clear risk framing.",
  ].join("\n");
}

async function collectBriefingInputs(rule: any, coverage: BriefingCoverage) {
  const since = intervalStart(rule, coverage);
  const until = new Date();
  const queries = buildBriefingQueries(coverage);

  const eventGroups = await Promise.all(
    queries.slice(0, 18).map((item) =>
      fetchRssEvents({
        ...item,
        since,
        limit: 6,
      })
    )
  );

  const [commoditySnapshots, cryptoMarkets, fearGreed] = await Promise.all([
    coverage.includeCommodities || coverage.includeEnergy || coverage.includeMinerals
      ? fetchCommoditySnapshots(coverage.commodities)
      : Promise.resolve([] as CommoditySnapshot[]),
    coverage.includeCrypto ? fetchCryptoMarkets() : Promise.resolve([] as EnrichedCryptoCoin[]),
    coverage.includeCrypto
      ? fetchFearGreed()
      : Promise.resolve({
          source: "Alternative.me",
          latest: null,
          history: [],
          value: null,
          classification: "Unavailable",
          updatedAt: null,
        }),
  ]);

  const seen = new Set<string>();
  const events = eventGroups
    .flat()
    .filter((event) => {
      const key = `${event.title}:${event.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return right - left;
    })
    .slice(0, 60);

  return {
    since,
    until,
    events,
    commoditySnapshots,
    cryptoMarkets,
    fearGreed,
    queries,
  };
}

async function generateBriefingText(input: {
  coverage: BriefingCoverage;
  events: BriefingEvent[];
  commoditySnapshots: CommoditySnapshot[];
  cryptoMarkets: EnrichedCryptoCoin[];
  fearGreed: Awaited<ReturnType<typeof fetchFearGreed>>;
  since: Date;
  until: Date;
}) {
  const fallbackText = fallbackBriefingText(input);

  const prompt = [
    "Create a polished wealth-management briefing using only the provided event set.",
    "Do not invent events. Do not imply recommendations. Use advisor-grade risk framing.",
    `Audience: ${input.coverage.audienceType}`,
    `Tone: ${input.coverage.tone}`,
    `Scope: ${input.coverage.scope}`,
    `Local focus: ${input.coverage.localFocus}`,
    `Interval: ${input.since.toISOString()} to ${input.until.toISOString()}`,
    `Advisor instructions: ${input.coverage.advisorInstructions || "None"}`,
    "",
    "Events captured inside interval:",
    JSON.stringify(input.events.slice(0, 50), null, 2),
    "",
    "Commodity snapshots:",
    JSON.stringify(input.commoditySnapshots, null, 2),
    "",
    "Crypto market summary:",
    JSON.stringify(
      input.cryptoMarkets.slice(0, 12).map((coin) => ({
        name: coin.name,
        symbol: coin.symbol,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        change7d: coin.price_change_percentage_7d_in_currency,
        riskAdjustedScore: coin.riskAdjustedScore,
        trend: coin.trendLabel,
      })),
      null,
      2
    ),
    "",
    "Fear/Greed:",
    JSON.stringify(input.fearGreed, null, 2),
    "",
    "Format required:",
    "- Subject line",
    "- Executive summary",
    "- Local/U.S. economy section if relevant",
    "- Global risk section if relevant",
    "- Commodities/minerals/energy section if selected",
    "- Crypto/alternatives section if selected",
    "- Client-safe version must be simpler and avoid speculative phrasing",
    "- Advisor version can include internal action items and suitability reminders",
  ].join("\n");

  const result = await generateAiText({
    instructions:
      "You are Slice's institutional briefing writer for a wealth management advisor. Be precise, careful, concise, and compliance-conscious.",
    prompt,
    speedMode: "quality",
    enableWebSearch: false,
    fallbackText,
    useCache: false,
  });

  return {
    text: result.text || fallbackText,
    aiStatus: result.status,
    aiProvider: result.provider,
    aiModel: result.model ?? null,
    aiError: result.error ?? null,
  };
}

async function createBriefingSchedule({
  userId,
  firmId,
  coverage,
}: {
  userId: string;
  firmId: string;
  coverage: BriefingCoverage;
}) {
  const title = `${coverage.audienceType} ${coverage.intervalHours}h Alternatives Briefing`;
  const description = briefingScheduleDescription(coverage);

  return db.advisorWorkflowRule.create({
    data: {
      userId,
      firmId,
      title,
      ruleType: BRIEFING_RULE_TYPE,
      trigger: `intervalHours:${coverage.intervalHours};audience:${coverage.audienceType};scope:${coverage.scope}`,
      actionTemplate: JSON.stringify(
        {
          version: 2,
          center: "Alternative Investments",
          description,
          coverage,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      minimumCredibilityScore: 70,
      minimumImpactScore: 65,
      approvalRequired: coverage.audienceType === "Client/Investor",
      channelsJson: JSON.stringify([coverage.deliveryChannel]),
      guardrailsJson: JSON.stringify([
        "Only include events captured since the last briefing interval.",
        "Do not invent news events.",
        "Do not present alternative investments as recommendations.",
        "Client/investor briefings require advisor approval.",
      ]),
      status: "Active",
    },
  });
}

async function persistBriefing({
  userId,
  firmId,
  rule,
  coverage,
  briefingText,
  events,
  commoditySnapshots,
  ai,
}: {
  userId: string;
  firmId: string;
  rule: any;
  coverage: BriefingCoverage;
  briefingText: string;
  events: BriefingEvent[];
  commoditySnapshots: CommoditySnapshot[];
  ai: {
    aiStatus: string;
    aiProvider: string;
    aiModel: string | null;
    aiError: string | null;
  };
}) {
  const title = `${coverage.audienceType} Alternatives Briefing · ${new Date().toLocaleString()}`;
  const sourceSummary = events.slice(0, 24).map((event) => ({
    title: event.title,
    source: event.source,
    url: event.url,
    publishedAt: event.publishedAt,
    topic: event.topic,
    scope: event.scope,
  }));

  if (coverage.audienceType === "Client/Investor") {
    const draft = await db.clientCommunicationDraft.create({
      data: {
        userId,
        firmId,
        clientName: coverage.recipientLabel,
        channel: coverage.deliveryChannel === "Dashboard" ? "Dashboard" : "Email",
        audience: "Client/Investor",
        title,
        body: briefingText,
        sourceSummaryJson: JSON.stringify(sourceSummary),
        complianceNotesJson: JSON.stringify([
          "Advisor approval required before delivery.",
          "Only interval-captured events were included.",
          "Alternative investment discussion must be suitability-reviewed.",
          "No recommendation, guarantee, or performance promise should be inferred.",
        ]),
        status: "Draft",
        tone: coverage.tone,
      },
    });

    await db.advisorWorkflowRule.update({
      where: { id: rule.id },
      data: { lastRunAt: new Date() },
    });

    return {
      storedAs: "ClientCommunicationDraft",
      id: draft.id,
    };
  }

  const pulse = await db.firmIntelligencePulse.create({
    data: {
      userId,
      firmId,
      title,
      category: "Alternative Advisor Briefing",
      summary: briefingText,
      confidenceScore: events.length ? 82 : 60,
      affectedClientsJson: JSON.stringify([]),
      sourceItemsJson: JSON.stringify(sourceSummary),
      actionsJson: JSON.stringify([
        "Review client exposure to affected sectors, commodities, alternatives, and crypto assets.",
        "Decide whether a client/investor version should be drafted.",
        "Confirm source credibility before external distribution.",
        `AI status: ${ai.aiStatus} via ${ai.aiProvider}${ai.aiError ? ` (${ai.aiError})` : ""}.`,
        `Commodity snapshots: ${commoditySnapshots.length}`,
      ]),
      status: "Active",
    },
  });

  await db.advisorWorkflowRule.update({
    where: { id: rule.id },
    data: { lastRunAt: new Date() },
  });

  return {
    storedAs: "FirmIntelligencePulse",
    id: pulse.id,
  };
}

async function loadBriefingData(userId: string, firmId: string | null) {
  if (!firmId) {
    return {
      schedules: [],
      advisorBriefings: [],
      clientBriefings: [],
    };
  }

  const [schedules, advisorBriefings, clientBriefings] = await Promise.all([
    db.advisorWorkflowRule.findMany({
      where: {
        userId,
        firmId,
        ruleType: BRIEFING_RULE_TYPE,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 50,
    }),
    db.firmIntelligencePulse.findMany({
      where: {
        userId,
        firmId,
        category: "Alternative Advisor Briefing",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    db.clientCommunicationDraft.findMany({
      where: {
        userId,
        firmId,
        audience: "Client/Investor",
        title: {
          contains: "Alternatives Briefing",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
  ]);

  return {
    schedules: schedules.map((rule: any) => ({
      ...rule,
      description: parseBriefingScheduleDescription(rule),
      coverage: parseCoverage(rule),
      channels: safeJsonParse<string[]>(rule.channelsJson, []),
      guardrails: safeJsonParse<string[]>(rule.guardrailsJson, []),
    })),
    advisorBriefings,
    clientBriefings,
  };
}

async function loadAlternativeInvestments(userId: string, requestedFirmId?: string | null) {
  const [cryptoMarkets, fearGreed, workspace] = await Promise.all([
    fetchCryptoMarkets(),
    fetchFearGreed(),
    getFirmWorkspace(userId, requestedFirmId),
  ]);

  const firmId = workspace.firm?.id ?? null;

  const [rawVentures, rawPennyStocks, briefingData] = await Promise.all([
    firmId
      ? db.alternativeVenture.findMany({
          where: { firmId },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    firmId
      ? db.alternativePennyStock.findMany({
          where: { firmId },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    loadBriefingData(userId, firmId),
  ]);

  const sentiment = marketRegimeFromFearGreed(fearGreed.value);
  const pennyStocks = await enrichPennyStocks(rawPennyStocks);
  const ventures = rawVentures.map(enrichVenture);

  const cryptoLeaders = cryptoMarkets
    .slice()
    .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
    .slice(0, 8);

  const highestRiskCrypto = cryptoMarkets
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  const cryptoValuationLeaders = cryptoMarkets
    .slice()
    .sort((a, b) => b.valuationScore - a.valuationScore)
    .slice(0, 8);

  const ventureStats = {
    count: ventures.length,
    watching: ventures.filter((venture: any) => venture.monitoringStatus === "Watching").length,
    diligence: ventures.filter((venture: any) => venture.monitoringStatus === "Diligence").length,
    passed: ventures.filter((venture: any) => venture.monitoringStatus === "Passed").length,
    averageValuation:
      ventures.length > 0
        ? ventures.reduce((sum: number, venture: any) => sum + venture.tentativeValuation, 0) /
          ventures.length
        : 0,
    averageEquityOffered:
      ventures.length > 0
        ? ventures.reduce((sum: number, venture: any) => sum + venture.equityOfferedPct, 0) /
          ventures.length
        : 0,
    averageDiligenceScore:
      ventures.length > 0
        ? ventures.reduce((sum: number, venture: any) => sum + venture.diligenceScore, 0) /
          ventures.length
        : 0,
    averagePresentationScore:
      ventures.length > 0
        ? ventures.reduce((sum: number, venture: any) => sum + venture.presentationScore, 0) /
          ventures.length
        : 0,
  };

  const pennyStats = {
    count: pennyStocks.length,
    watching: pennyStocks.filter((stock: any) => stock.status === "Watching").length,
    activeReview: pennyStocks.filter((stock: any) => stock.status === "Active Review").length,
    passed: pennyStocks.filter((stock: any) => stock.status === "Passed").length,
    averageRiskReductionScore:
      pennyStocks.length > 0
        ? pennyStocks.reduce((sum: number, stock: any) => sum + stock.riskReductionScore, 0) /
          pennyStocks.length
        : 0,
    averageSpeculativeScore:
      pennyStocks.length > 0
        ? pennyStocks.reduce((sum: number, stock: any) => sum + stock.speculativeScore, 0) /
          pennyStocks.length
        : 0,
  };

  const aggregateCryptoMarketCap = cryptoMarkets.reduce(
    (sum, coin) => sum + (coin.market_cap ?? 0),
    0
  );
  const aggregateCryptoVolume = cryptoMarkets.reduce(
    (sum, coin) => sum + (coin.total_volume ?? 0),
    0
  );
  const cryptoBreadth =
    cryptoMarkets.length > 0
      ? Math.round(
          (cryptoMarkets.filter((coin) => (coin.price_change_percentage_24h ?? 0) > 0)
            .length /
            cryptoMarkets.length) *
            100
        )
      : 0;

  return {
    userId,
    ...workspace,
    crypto: {
      markets: cryptoMarkets,
      leaders: cryptoLeaders,
      highestRisk: highestRiskCrypto,
      valuationLeaders: cryptoValuationLeaders,
      fearGreed,
      sentiment,
      fetchedAt: new Date().toISOString(),
      aggregateMarketCap: aggregateCryptoMarketCap,
      aggregateVolume: aggregateCryptoVolume,
      breadth: cryptoBreadth,
      sources: ["CoinGecko /coins/markets", "Alternative.me /fng/"],
    },
    pennyStocks,
    ventures,
    briefings: briefingData,
    stats: {
      ventureStats,
      pennyStats,
      briefingStats: {
        schedules: briefingData.schedules.length,
        activeSchedules: briefingData.schedules.filter((item: any) => item.status === "Active").length,
        advisorBriefings: briefingData.advisorBriefings.length,
        clientBriefings: briefingData.clientBriefings.length,
      },
    },
    riskFramework: [
      {
        label: "Crypto",
        riskLevel: "Very High",
        primaryRisks:
          "Volatility, exchange risk, protocol risk, regulatory risk, custody risk, liquidity spikes, reflexive sentiment.",
        mitigation:
          "Prioritize liquidity, FDV discipline, custody controls, risk-adjusted trend score, and explicit sizing limits.",
      },
      {
        label: "Penny Stocks",
        riskLevel: "Extreme",
        primaryRisks:
          "Dilution, low liquidity, promotional activity, weak reporting, manipulation risk, wide spreads.",
        mitigation:
          "Require catalyst proof, liquidity proxy, max position limit, dilution check, and written exit discipline.",
      },
      {
        label: "Venture Capital",
        riskLevel: "Extreme",
        primaryRisks:
          "Illiquidity, failure risk, valuation uncertainty, founder execution, financing risk, long holding periods.",
        mitigation:
          "Require presentation model, traction evidence, valuation bridge, customer profile, moat, and next diligence step.",
      },
      {
        label: "Briefings",
        riskLevel: "Controlled",
        primaryRisks:
          "Outdated news, overgeneralization, missing source context, client misinterpretation, and speculative framing.",
        mitigation:
          "Use interval-only events, source lists, advisor approval for external delivery, and separate advisor vs client briefing language.",
      },
    ],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) return noStoreJson({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");

  return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return noStoreJson({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = cleanString(body.action);
  const firmId = cleanString(body.firmId);

  if (!firmId) {
    return noStoreJson({ error: "Firm ID is required." }, { status: 400 });
  }

  const membership = await db.firmMembership.findFirst({
    where: { userId: user.id, firmId, status: "Active" },
  });

  if (!membership) {
    return noStoreJson({ error: "You do not have access to this firm." }, { status: 403 });
  }

  if (!canManageAlternatives(membership)) {
    return noStoreJson(
      {
        error:
          "Only firm owners, admins, or project managers can modify alternative investment records.",
      },
      { status: 403 }
    );
  }

  if (action === "createBriefingSchedule") {
    const coverage = normalizeCoverage(body);
    const rule = await createBriefingSchedule({ userId: user.id, firmId, coverage });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeBriefingScheduleCreated",
      title: `Created ${coverage.audienceType} briefing schedule`,
      detail: `${coverage.intervalHours}h interval · ${coverage.scope}`,
      metadata: { firmId, ruleId: rule.id, coverage },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "updateBriefingScheduleStatus") {
    const ruleId = cleanString(body.ruleId);
    const status = cleanString(body.status) || "Active";

    await db.advisorWorkflowRule.updateMany({
      where: {
        id: ruleId,
        userId: user.id,
        firmId,
        ruleType: BRIEFING_RULE_TYPE,
      },
      data: { status },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "generateBriefing") {
    const ruleId = cleanString(body.ruleId);
    let rule = ruleId
      ? await db.advisorWorkflowRule.findFirst({
          where: {
            id: ruleId,
            userId: user.id,
            firmId,
            ruleType: BRIEFING_RULE_TYPE,
          },
        })
      : null;

    if (!rule) {
      const coverage = normalizeCoverage(body);
      rule = await createBriefingSchedule({ userId: user.id, firmId, coverage });
    }

    const coverage = parseCoverage(rule);
    const briefingInputs = await collectBriefingInputs(rule, coverage);
    const generated = await generateBriefingText({
      coverage,
      events: briefingInputs.events,
      commoditySnapshots: briefingInputs.commoditySnapshots,
      cryptoMarkets: briefingInputs.cryptoMarkets,
      fearGreed: briefingInputs.fearGreed,
      since: briefingInputs.since,
      until: briefingInputs.until,
    });

    const stored = await persistBriefing({
      userId: user.id,
      firmId,
      rule,
      coverage,
      briefingText: generated.text,
      events: briefingInputs.events,
      commoditySnapshots: briefingInputs.commoditySnapshots,
      ai: {
        aiStatus: generated.aiStatus,
        aiProvider: generated.aiProvider,
        aiModel: generated.aiModel,
        aiError: generated.aiError,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeBriefingGenerated",
      title: `Generated ${coverage.audienceType} alternatives briefing`,
      detail: `${briefingInputs.events.length} interval event(s), ${briefingInputs.commoditySnapshots.length} commodity snapshot(s).`,
      metadata: {
        firmId,
        ruleId: rule.id,
        stored,
        eventCount: briefingInputs.events.length,
        since: briefingInputs.since.toISOString(),
        until: briefingInputs.until.toISOString(),
      },
    });

    return noStoreJson({
      ...(await loadAlternativeInvestments(user.id, firmId)),
      generatedBriefing: {
        text: generated.text,
        stored,
        eventCount: briefingInputs.events.length,
        commodityCount: briefingInputs.commoditySnapshots.length,
        aiStatus: generated.aiStatus,
        aiProvider: generated.aiProvider,
        aiModel: generated.aiModel,
        aiError: generated.aiError,
        since: briefingInputs.since,
        until: briefingInputs.until,
      },
    });
  }

  if (action === "createVenture") {
    const startupName = cleanString(body.startupName);
    const background = cleanString(body.background);
    const problemToSolve = cleanString(body.problemToSolve);

    if (!startupName || !background || !problemToSolve) {
      return noStoreJson(
        {
          error:
            "Startup name, short background, and problem to solve are required.",
        },
        { status: 400 }
      );
    }

    const notes = buildNotesWithMeta(cleanString(body.notes), {
      imageUrl: cleanString(body.imageUrl) || null,
      deckUrl: cleanString(body.deckUrl) || null,
      presentationSummary: cleanString(body.presentationSummary) || null,
      customerProfile: cleanString(body.customerProfile) || null,
      revenueModel: cleanString(body.revenueModel) || null,
      moat: cleanString(body.moat) || null,
      nextDiligence: cleanString(body.nextDiligence) || null,
    });

    const venture = await db.alternativeVenture.create({
      data: {
        firmId,
        createdByUserId: user.id,
        startupName,
        founderName: cleanString(body.founderName) || null,
        sector: cleanString(body.sector) || "Technology",
        stage: cleanString(body.stage) || "Seed",
        website: cleanString(body.website) || null,
        background,
        problemToSolve,
        solution: cleanString(body.solution) || null,
        equityOfferedPct: toFloat(body.equityOfferedPct),
        tentativeValuation: toFloat(body.tentativeValuation),
        amountSought: optionalFloat(body.amountSought),
        traction: cleanString(body.traction) || null,
        thesis: cleanString(body.thesis) || null,
        keyRisks: cleanString(body.keyRisks) || null,
        monitoringStatus: cleanString(body.monitoringStatus) || "Watching",
        riskLevel: cleanString(body.riskLevel) || "Very High",
        notes,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeVentureCreated",
      title: `Added venture: ${venture.startupName}`,
      detail: `${venture.equityOfferedPct}% equity offered at tentative valuation ${venture.tentativeValuation}.`,
      metadata: { firmId, ventureId: venture.id },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "updateVentureStatus") {
    const ventureId = cleanString(body.ventureId);
    const monitoringStatus = cleanString(body.monitoringStatus);

    const venture = await db.alternativeVenture.findFirst({
      where: { id: ventureId, firmId },
    });

    if (!venture) return noStoreJson({ error: "Venture not found." }, { status: 404 });

    const existing = splitNotesAndMeta(venture.notes);
    const nextMeta = {
      ...existing.meta,
      ...(typeof body.imageUrl === "string" ? { imageUrl: cleanString(body.imageUrl) || null } : {}),
      ...(typeof body.deckUrl === "string" ? { deckUrl: cleanString(body.deckUrl) || null } : {}),
      ...(typeof body.presentationSummary === "string"
        ? { presentationSummary: cleanString(body.presentationSummary) || null }
        : {}),
      ...(typeof body.customerProfile === "string"
        ? { customerProfile: cleanString(body.customerProfile) || null }
        : {}),
      ...(typeof body.revenueModel === "string"
        ? { revenueModel: cleanString(body.revenueModel) || null }
        : {}),
      ...(typeof body.moat === "string" ? { moat: cleanString(body.moat) || null } : {}),
      ...(typeof body.nextDiligence === "string"
        ? { nextDiligence: cleanString(body.nextDiligence) || null }
        : {}),
    };

    await db.alternativeVenture.update({
      where: { id: venture.id },
      data: {
        monitoringStatus: monitoringStatus || venture.monitoringStatus,
        notes:
          typeof body.notes === "string" || Object.keys(nextMeta).length
            ? buildNotesWithMeta(
                typeof body.notes === "string" ? cleanString(body.notes) : existing.plainNotes,
                nextMeta
              )
            : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeVentureStatusUpdated",
      title: `Updated venture status: ${venture.startupName}`,
      detail: monitoringStatus || venture.monitoringStatus,
      metadata: { firmId, ventureId: venture.id },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "createPennyStock") {
    const ticker = cleanTicker(body.ticker);
    const companyName = cleanString(body.companyName);

    if (!ticker || !companyName) {
      return noStoreJson({ error: "Ticker and company name are required." }, { status: 400 });
    }

    const pennyStock = await db.alternativePennyStock.create({
      data: {
        firmId,
        createdByUserId: user.id,
        ticker,
        companyName,
        sector: cleanString(body.sector) || "Unknown",
        thesis: cleanString(body.thesis) || null,
        catalyst: cleanString(body.catalyst) || null,
        riskNotes: cleanString(body.riskNotes) || null,
        targetEntry: cleanString(body.targetEntry) || null,
        maxPositionPct: optionalFloat(body.maxPositionPct),
        status: cleanString(body.status) || "Watching",
        riskLevel: cleanString(body.riskLevel) || "Extreme",
        notes: cleanString(body.notes) || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativePennyStockCreated",
      title: `Added penny stock watch: ${pennyStock.ticker}`,
      detail: pennyStock.companyName,
      metadata: { firmId, pennyStockId: pennyStock.id },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "updatePennyStockStatus") {
    const pennyStockId = cleanString(body.pennyStockId);
    const status = cleanString(body.status);

    const pennyStock = await db.alternativePennyStock.findFirst({
      where: { id: pennyStockId, firmId },
    });

    if (!pennyStock) {
      return noStoreJson({ error: "Penny stock record not found." }, { status: 404 });
    }

    await db.alternativePennyStock.update({
      where: { id: pennyStock.id },
      data: {
        status: status || pennyStock.status,
        notes: typeof body.notes === "string" ? cleanString(body.notes) || null : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativePennyStockStatusUpdated",
      title: `Updated penny stock watch: ${pennyStock.ticker}`,
      detail: status || pennyStock.status,
      metadata: { firmId, pennyStockId: pennyStock.id },
    });

    return noStoreJson(await loadAlternativeInvestments(user.id, firmId));
  }

  return noStoreJson({ error: "Unknown alternative investment action." }, { status: 400 });
}