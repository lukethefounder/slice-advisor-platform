import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

type FearGreedPoint = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFloat(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,%]/g, "").trim());

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
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

  if (day > 8 && week > 12) return "Strong upside momentum";
  if (day > 3 && week > 5) return "Positive trend";
  if (day < -8 && week < -12) return "Sharp downside pressure";
  if (day < -3 && week < -5) return "Negative trend";
  if (Math.abs(oneHour) > 3 || Math.abs(day) > 6) return "Volatile setup";

  if (month > 15 && week < 0) return "Cooling after strong month";
  if (month < -15 && week > 0) return "Possible rebound attempt";

  return "Mixed / consolidating";
}

function cryptoRiskScore(coin: CryptoMarketCoin) {
  const marketCap = coin.market_cap ?? 0;
  const volume = coin.total_volume ?? 0;
  const day = Math.abs(coin.price_change_percentage_24h ?? 0);
  const week = Math.abs(coin.price_change_percentage_7d_in_currency ?? 0);
  const month = Math.abs(coin.price_change_percentage_30d_in_currency ?? 0);

  const volatilityComponent = day * 3 + week * 1.4 + month * 0.45;
  const liquidityRisk =
    marketCap > 100_000_000_000
      ? 5
      : marketCap > 20_000_000_000
        ? 12
        : marketCap > 5_000_000_000
          ? 22
          : 35;

  const volumeSupport =
    marketCap > 0 ? Math.min(20, (volume / marketCap) * 100) : 0;

  return clamp(35 + volatilityComponent + liquidityRisk - volumeSupport);
}

function cryptoOpportunityScore(coin: CryptoMarketCoin) {
  const day = coin.price_change_percentage_24h ?? 0;
  const week = coin.price_change_percentage_7d_in_currency ?? 0;
  const month = coin.price_change_percentage_30d_in_currency ?? 0;
  const marketCapRank = coin.market_cap_rank ?? 999;

  const momentum = day * 2 + week * 1.2 + month * 0.35;
  const quality = marketCapRank <= 2 ? 18 : marketCapRank <= 10 ? 12 : 6;
  const reversal = month < -20 && week > 3 ? 12 : 0;

  return clamp(45 + momentum + quality + reversal);
}

function cryptoLiquidityScore(coin: CryptoMarketCoin) {
  const marketCap = coin.market_cap ?? 0;
  const volume = coin.total_volume ?? 0;

  if (!marketCap || !volume) return 35;

  const volumeToMarketCap = volume / marketCap;

  return clamp(
    marketCap > 100_000_000_000
      ? 90
      : marketCap > 20_000_000_000
        ? 78
        : marketCap > 5_000_000_000
          ? 62
          : 45 + volumeToMarketCap * 100
  );
}

function enrichCryptoCoin(coin: CryptoMarketCoin) {
  const riskScore = cryptoRiskScore(coin);
  const opportunityScore = cryptoOpportunityScore(coin);
  const liquidityScore = cryptoLiquidityScore(coin);

  return {
    ...coin,
    trendLabel: cryptoTrendLabel(coin),
    riskScore,
    riskLevel: riskTone(riskScore),
    opportunityScore,
    liquidityScore,
    advisorNotes: [
      `${coin.name} is showing ${cryptoTrendLabel(coin).toLowerCase()}.`,
      `Risk score is ${riskScore}/100, driven by volatility, liquidity, and recent price movement.`,
      `Opportunity score is ${opportunityScore}/100, driven by momentum, market position, and possible reversal behavior.`,
      `Liquidity score is ${liquidityScore}/100 based on market cap and volume support.`,
    ],
  };
}

function fallbackCryptoMarkets() {
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
      sparkline_in_7d: { price: [] },
      last_updated: null,
    },
  ];

  return fallbackCoins.map(enrichCryptoCoin);
}

async function fetchCryptoMarkets() {
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: TRACKED_CRYPTO_IDS.join(","),
    order: "market_cap_desc",
    per_page: "20",
    page: "1",
    sparkline: "true",
    price_change_percentage: "1h,24h,7d,30d",
  });

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`,
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko returned ${response.status}`);
    }

    const coins = (await response.json()) as CryptoMarketCoin[];

    return coins.map(enrichCryptoCoin);
  } catch {
    return fallbackCryptoMarkets();
  }
}

async function fetchFearGreed() {
  try {
    const response = await fetch(
      "https://api.alternative.me/fng/?limit=30&format=json",
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Alternative.me returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      name?: string;
      data?: FearGreedPoint[];
      metadata?: {
        error: string | null;
      };
    };

    const data = payload.data ?? [];
    const latest = data[0] ?? null;

    return {
      source: "Alternative.me",
      latest,
      history: data,
      value: latest ? Number(latest.value) : null,
      classification: latest?.value_classification ?? "Unavailable",
      updatedAt: latest
        ? new Date(Number(latest.timestamp) * 1000).toISOString()
        : null,
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
    };
  }

  if (value <= 20) {
    return {
      regime: "Extreme Fear",
      riskComment:
        "Potential capitulation environment. Could create opportunity, but catching falling knives is a major risk.",
    };
  }

  if (value <= 40) {
    return {
      regime: "Fear",
      riskComment:
        "Risk appetite is weak. Better entries may appear, but negative momentum can persist.",
    };
  }

  if (value <= 60) {
    return {
      regime: "Neutral",
      riskComment:
        "No clear sentiment extreme. Focus more heavily on trend, liquidity, and catalyst quality.",
    };
  }

  if (value <= 80) {
    return {
      regime: "Greed",
      riskComment:
        "Risk appetite is elevated. Momentum can continue, but position sizing should be disciplined.",
    };
  }

  return {
    regime: "Extreme Greed",
    riskComment:
      "Euphoria risk is high. Strong upside may remain, but sharp reversals and liquidations become more dangerous.",
  };
}

async function getFirmWorkspace(userId: string, requestedFirmId?: string | null) {
  const memberships = await prisma.firmMembership.findMany({
    where: {
      userId,
      status: "Active",
    },
    include: {
      firm: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const firmId = requestedFirmId ?? memberships[0]?.firmId ?? null;

  if (!firmId) {
    return {
      firms: memberships.map((membership) => ({
        ...membership.firm,
        membership,
      })),
      firm: null,
      membership: null,
    };
  }

  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId,
      firmId,
      status: "Active",
    },
    include: {
      firm: true,
    },
  });

  if (!membership) {
    return {
      firms: memberships.map((item) => ({
        ...item.firm,
        membership: item,
      })),
      firm: null,
      membership: null,
    };
  }

  return {
    firms: memberships.map((item) => ({
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
  await prisma.auditLog.create({
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

async function loadAlternativeInvestments(userId: string, requestedFirmId?: string | null) {
  const [cryptoMarkets, fearGreed, workspace] = await Promise.all([
    fetchCryptoMarkets(),
    fetchFearGreed(),
    getFirmWorkspace(userId, requestedFirmId),
  ]);

  const firmId = workspace.firm?.id ?? null;

  const [ventures, pennyStocks] = firmId
    ? await Promise.all([
        prisma.alternativeVenture.findMany({
          where: {
            firmId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
        prisma.alternativePennyStock.findMany({
          where: {
            firmId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
      ])
    : [[], []];

  const sentiment = marketRegimeFromFearGreed(fearGreed.value);

  const cryptoLeaders = cryptoMarkets
    .slice()
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const highestRiskCrypto = cryptoMarkets
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const ventureStats = {
    count: ventures.length,
    watching: ventures.filter((venture) => venture.monitoringStatus === "Watching").length,
    diligence: ventures.filter((venture) => venture.monitoringStatus === "Diligence").length,
    passed: ventures.filter((venture) => venture.monitoringStatus === "Passed").length,
    averageValuation:
      ventures.length > 0
        ? ventures.reduce((sum, venture) => sum + venture.tentativeValuation, 0) /
          ventures.length
        : 0,
    averageEquityOffered:
      ventures.length > 0
        ? ventures.reduce((sum, venture) => sum + venture.equityOfferedPct, 0) /
          ventures.length
        : 0,
  };

  const pennyStats = {
    count: pennyStocks.length,
    watching: pennyStocks.filter((stock) => stock.status === "Watching").length,
    activeReview: pennyStocks.filter((stock) => stock.status === "Active Review").length,
    passed: pennyStocks.filter((stock) => stock.status === "Passed").length,
  };

  return {
    userId,
    ...workspace,
    crypto: {
      markets: cryptoMarkets,
      leaders: cryptoLeaders,
      highestRisk: highestRiskCrypto,
      fearGreed,
      sentiment,
      fetchedAt: new Date().toISOString(),
      sources: [
        "CoinGecko /coins/markets",
        "Alternative.me /fng/",
      ],
    },
    pennyStocks,
    ventures,
    stats: {
      ventureStats,
      pennyStats,
    },
    riskFramework: [
      {
        label: "Crypto",
        riskLevel: "Very High",
        primaryRisks:
          "Volatility, exchange risk, protocol risk, regulatory risk, custody risk, liquidity spikes, reflexive sentiment.",
      },
      {
        label: "Penny Stocks",
        riskLevel: "Extreme",
        primaryRisks:
          "Dilution, low liquidity, promotional activity, weak reporting, manipulation risk, wide spreads.",
      },
      {
        label: "Venture Capital",
        riskLevel: "Extreme",
        primaryRisks:
          "Illiquidity, failure risk, valuation uncertainty, founder execution, financing risk, long holding periods.",
      },
    ],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const firmId = url.searchParams.get("firmId");

  return NextResponse.json(
    await loadAlternativeInvestments(user.id, firmId)
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const action = cleanString(body.action);
  const firmId = cleanString(body.firmId);

  if (!firmId) {
    return NextResponse.json(
      { error: "Firm ID is required." },
      { status: 400 }
    );
  }

  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId: user.id,
      firmId,
      status: "Active",
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this firm." },
      { status: 403 }
    );
  }

  if (!canManageAlternatives(membership)) {
    return NextResponse.json(
      {
        error:
          "Only firm owners, admins, or project managers can modify alternative investment records.",
      },
      { status: 403 }
    );
  }

  if (action === "createVenture") {
    const startupName = cleanString(body.startupName);
    const background = cleanString(body.background);
    const problemToSolve = cleanString(body.problemToSolve);

    if (!startupName || !background || !problemToSolve) {
      return NextResponse.json(
        {
          error:
            "Startup name, short background, and problem to solve are required.",
        },
        { status: 400 }
      );
    }

    const venture = await prisma.alternativeVenture.create({
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
        amountSought:
          cleanString(body.amountSought) || typeof body.amountSought === "number"
            ? toFloat(body.amountSought)
            : null,
        traction: cleanString(body.traction) || null,
        thesis: cleanString(body.thesis) || null,
        keyRisks: cleanString(body.keyRisks) || null,
        monitoringStatus: cleanString(body.monitoringStatus) || "Watching",
        riskLevel: cleanString(body.riskLevel) || "Very High",
        notes: cleanString(body.notes) || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeVentureCreated",
      title: `Added venture: ${venture.startupName}`,
      detail: `${venture.equityOfferedPct}% equity offered at tentative valuation ${venture.tentativeValuation}.`,
      metadata: {
        firmId,
        ventureId: venture.id,
      },
    });

    return NextResponse.json(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "updateVentureStatus") {
    const ventureId = cleanString(body.ventureId);
    const monitoringStatus = cleanString(body.monitoringStatus);

    const venture = await prisma.alternativeVenture.findFirst({
      where: {
        id: ventureId,
        firmId,
      },
    });

    if (!venture) {
      return NextResponse.json(
        { error: "Venture not found." },
        { status: 404 }
      );
    }

    await prisma.alternativeVenture.update({
      where: {
        id: venture.id,
      },
      data: {
        monitoringStatus: monitoringStatus || venture.monitoringStatus,
        notes:
          typeof body.notes === "string" ? cleanString(body.notes) || null : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativeVentureStatusUpdated",
      title: `Updated venture status: ${venture.startupName}`,
      detail: monitoringStatus || venture.monitoringStatus,
      metadata: {
        firmId,
        ventureId: venture.id,
      },
    });

    return NextResponse.json(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "createPennyStock") {
    const ticker = cleanString(body.ticker).toUpperCase();
    const companyName = cleanString(body.companyName);

    if (!ticker || !companyName) {
      return NextResponse.json(
        { error: "Ticker and company name are required." },
        { status: 400 }
      );
    }

    const pennyStock = await prisma.alternativePennyStock.create({
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
        maxPositionPct:
          cleanString(body.maxPositionPct) || typeof body.maxPositionPct === "number"
            ? toFloat(body.maxPositionPct)
            : null,
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
      metadata: {
        firmId,
        pennyStockId: pennyStock.id,
      },
    });

    return NextResponse.json(await loadAlternativeInvestments(user.id, firmId));
  }

  if (action === "updatePennyStockStatus") {
    const pennyStockId = cleanString(body.pennyStockId);
    const status = cleanString(body.status);

    const pennyStock = await prisma.alternativePennyStock.findFirst({
      where: {
        id: pennyStockId,
        firmId,
      },
    });

    if (!pennyStock) {
      return NextResponse.json(
        { error: "Penny stock record not found." },
        { status: 404 }
      );
    }

    await prisma.alternativePennyStock.update({
      where: {
        id: pennyStock.id,
      },
      data: {
        status: status || pennyStock.status,
        notes:
          typeof body.notes === "string" ? cleanString(body.notes) || null : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "AlternativePennyStockStatusUpdated",
      title: `Updated penny stock watch: ${pennyStock.ticker}`,
      detail: status || pennyStock.status,
      metadata: {
        firmId,
        pennyStockId: pennyStock.id,
      },
    });

    return NextResponse.json(await loadAlternativeInvestments(user.id, firmId));
  }

  return NextResponse.json(
    { error: "Unknown alternative investment action." },
    { status: 400 }
  );
}