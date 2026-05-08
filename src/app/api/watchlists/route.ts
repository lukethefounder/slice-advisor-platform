import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSymbol(value: unknown) {
  return cleanString(value).replace(/^\$/, "").toUpperCase();
}

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guessAssetType(symbol: string, title = "") {
  const lower = `${symbol} ${title}`.toLowerCase();

  const cryptoSymbols = new Set([
    "BTC",
    "ETH",
    "SOL",
    "XRP",
    "ADA",
    "DOGE",
    "AVAX",
    "LINK",
    "DOT",
    "UNI",
    "MATIC",
    "BNB",
    "LTC",
    "BCH",
  ]);

  if (
    cryptoSymbols.has(symbol.toUpperCase()) ||
    lower.includes("bitcoin") ||
    lower.includes("ethereum") ||
    lower.includes("crypto") ||
    lower.includes("token") ||
    lower.includes("stablecoin")
  ) {
    return "Crypto";
  }

  return "Stock";
}

async function ensureDefaultWatchlist(userId: string) {
  const existing = await prisma.namedWatchlist.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existing) return existing;

  return prisma.namedWatchlist.create({
    data: {
      userId,
      name: "Main Watchlist",
      description:
        "Default named watchlist for saved alerts, scan results, stocks, and crypto ideas.",
      focus: "General",
      riskLevel: "Mixed",
    },
  });
}

async function loadWatchlists(userId: string) {
  await ensureDefaultWatchlist(userId);

  const [watchlists, alerts, decisions, holdings] = await Promise.all([
    prisma.namedWatchlist.findMany({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),

    prisma.alertEvent.findMany({
      where: {
        userId,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),

    prisma.headlineDecision.findMany({
      where: {
        userId,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),

    prisma.investorHolding.findMany({
      where: {
        userId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
  ]);

  const watchlistSymbols = new Set(
    watchlists.flatMap((watchlist) =>
      watchlist.items.map((item) => item.symbol.toUpperCase())
    )
  );

  const holdingSymbols = new Set(
    holdings.map((holding) => holding.symbol.toUpperCase())
  );

  const enrichedAlerts = alerts.map((alert) => {
    const symbol = alert.ticker?.toUpperCase() ?? "";
    return {
      ...alert,
      suggestedSymbol: symbol,
      suggestedAssetType: symbol
        ? guessAssetType(symbol, `${alert.title} ${alert.body}`)
        : "",
      alreadySaved: symbol ? watchlistSymbols.has(symbol) : false,
      inPortfolio: symbol ? holdingSymbols.has(symbol) : false,
    };
  });

  const enrichedDecisions = decisions.map((decision) => {
    const tickers = parseJsonList(decision.matchedTickersJson).map((item) =>
      String(item).toUpperCase()
    );

    const suggestedSymbol = tickers[0] ?? "";

    return {
      ...decision,
      matchedTickers: tickers,
      matchedAreas: parseJsonList(decision.matchedAreasJson),
      reasons: parseJsonList(decision.reasonsJson),
      channels: parseJsonList(decision.channelsJson),
      suggestedSymbol,
      suggestedAssetType: suggestedSymbol
        ? guessAssetType(suggestedSymbol, `${decision.title} ${decision.summary ?? ""}`)
        : "",
      alreadySaved: suggestedSymbol ? watchlistSymbols.has(suggestedSymbol) : false,
      inPortfolio: suggestedSymbol ? holdingSymbols.has(suggestedSymbol) : false,
    };
  });

  const aggregate = {
    watchlistCount: watchlists.length,
    itemCount: watchlists.reduce((sum, watchlist) => sum + watchlist.items.length, 0),
    stockCount: watchlists.reduce(
      (sum, watchlist) =>
        sum + watchlist.items.filter((item) => item.assetType === "Stock").length,
      0
    ),
    cryptoCount: watchlists.reduce(
      (sum, watchlist) =>
        sum + watchlist.items.filter((item) => item.assetType === "Crypto").length,
      0
    ),
    savedFromAlerts: watchlists.reduce(
      (sum, watchlist) =>
        sum + watchlist.items.filter((item) => item.sourceType === "Alert").length,
      0
    ),
    savedFromScans: watchlists.reduce(
      (sum, watchlist) =>
        sum + watchlist.items.filter((item) => item.sourceType === "Scan").length,
      0
    ),
    portfolioOverlapCount: watchlists.reduce(
      (sum, watchlist) =>
        sum +
        watchlist.items.filter((item) =>
          holdingSymbols.has(item.symbol.toUpperCase())
        ).length,
      0
    ),
  };

  return {
    watchlists,
    alerts: enrichedAlerts,
    decisions: enrichedDecisions,
    holdings,
    aggregate,
  };
}

async function saveItem({
  userId,
  watchlistId,
  symbol,
  assetName,
  assetType,
  sourceType,
  sourceId,
  sourceTitle,
  sourceUrl,
  originalScore,
  thesis,
  riskNotes,
  priority,
}: {
  userId: string;
  watchlistId: string;
  symbol: string;
  assetName: string;
  assetType: string;
  sourceType: string;
  sourceId?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  originalScore?: number | null;
  thesis?: string | null;
  riskNotes?: string | null;
  priority?: string | null;
}) {
  const watchlist = await prisma.namedWatchlist.findFirst({
    where: {
      id: watchlistId,
      userId,
    },
  });

  if (!watchlist) {
    throw new Error("Watchlist not found.");
  }

  return prisma.namedWatchlistItem.upsert({
    where: {
      watchlistId_symbol: {
        watchlistId,
        symbol,
      },
    },
    update: {
      assetName,
      assetType,
      sourceType,
      sourceId: sourceId ?? undefined,
      sourceTitle: sourceTitle ?? undefined,
      sourceUrl: sourceUrl ?? undefined,
      originalScore: originalScore ?? undefined,
      thesis: thesis ?? undefined,
      riskNotes: riskNotes ?? undefined,
      priority: priority ?? undefined,
      status: "Watching",
    },
    create: {
      userId,
      watchlistId,
      symbol,
      assetName,
      assetType,
      sourceType,
      sourceId: sourceId ?? null,
      sourceTitle: sourceTitle ?? null,
      sourceUrl: sourceUrl ?? null,
      originalScore: originalScore ?? null,
      thesis: thesis ?? null,
      riskNotes: riskNotes ?? null,
      priority: priority ?? "Medium",
      status: "Watching",
    },
  });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadWatchlists(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = cleanString(body.action);

    if (action === "createWatchlist") {
      const name = cleanString(body.name);
      const description = cleanString(body.description);
      const focus = cleanString(body.focus) || "General";
      const riskLevel = cleanString(body.riskLevel) || "Mixed";

      if (!name) {
        return NextResponse.json(
          { error: "Watchlist name is required." },
          { status: 400 }
        );
      }

      await prisma.namedWatchlist.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name,
          },
        },
        update: {
          description: description || null,
          focus,
          riskLevel,
        },
        create: {
          userId: user.id,
          name,
          description: description || null,
          focus,
          riskLevel,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    if (action === "saveManualItem") {
      const defaultWatchlist = await ensureDefaultWatchlist(user.id);
      const watchlistId = cleanString(body.watchlistId) || defaultWatchlist.id;
      const symbol = cleanSymbol(body.symbol);
      const assetName = cleanString(body.assetName) || symbol;
      const assetType = cleanString(body.assetType) || guessAssetType(symbol);
      const thesis = cleanString(body.thesis);
      const riskNotes = cleanString(body.riskNotes);
      const priority = cleanString(body.priority) || "Medium";

      if (!symbol) {
        return NextResponse.json(
          { error: "Symbol is required." },
          { status: 400 }
        );
      }

      await saveItem({
        userId: user.id,
        watchlistId,
        symbol,
        assetName,
        assetType,
        sourceType: "Manual",
        thesis: thesis || null,
        riskNotes: riskNotes || null,
        priority,
      });

      await prisma.watchAsset.upsert({
        where: {
          userId_ticker: {
            userId: user.id,
            ticker: symbol,
          },
        },
        update: {
          name: assetName,
          assetType,
          notes: thesis || null,
        },
        create: {
          userId: user.id,
          ticker: symbol,
          name: assetName,
          assetType,
          signal: `Added to named watchlist: ${new Date().toLocaleDateString()}`,
          notes: thesis || null,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    if (action === "saveFromAlert") {
      const defaultWatchlist = await ensureDefaultWatchlist(user.id);
      const watchlistId = cleanString(body.watchlistId) || defaultWatchlist.id;
      const alertId = cleanString(body.alertId);
      const overrideSymbol = cleanSymbol(body.symbol);

      const alert = await prisma.alertEvent.findFirst({
        where: {
          id: alertId,
          userId: user.id,
        },
      });

      if (!alert) {
        return NextResponse.json(
          { error: "Alert not found." },
          { status: 404 }
        );
      }

      const symbol = overrideSymbol || cleanSymbol(alert.ticker);

      if (!symbol) {
        return NextResponse.json(
          {
            error:
              "This alert does not contain a ticker. Enter a symbol manually before saving.",
          },
          { status: 400 }
        );
      }

      const assetType = guessAssetType(symbol, `${alert.title} ${alert.body}`);

      await saveItem({
        userId: user.id,
        watchlistId,
        symbol,
        assetName: symbol,
        assetType,
        sourceType: "Alert",
        sourceId: alert.id,
        sourceTitle: alert.title,
        sourceUrl: alert.sourceUrl,
        originalScore: alert.score,
        thesis: alert.aiBriefing || alert.body,
        riskNotes: `Saved from alert. Urgency: ${alert.urgency}. Source: ${alert.source}.`,
        priority:
          alert.score >= 90 ? "Critical" : alert.score >= 80 ? "High" : "Medium",
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
          assetType,
          signal: alert.title,
          notes: alert.aiBriefing || alert.body,
        },
        create: {
          userId: user.id,
          ticker: symbol,
          name: symbol,
          assetType,
          signal: alert.title,
          notes: alert.aiBriefing || alert.body,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    if (action === "saveFromDecision") {
      const defaultWatchlist = await ensureDefaultWatchlist(user.id);
      const watchlistId = cleanString(body.watchlistId) || defaultWatchlist.id;
      const decisionId = cleanString(body.decisionId);
      const overrideSymbol = cleanSymbol(body.symbol);

      const decision = await prisma.headlineDecision.findFirst({
        where: {
          id: decisionId,
          userId: user.id,
        },
      });

      if (!decision) {
        return NextResponse.json(
          { error: "Scan decision not found." },
          { status: 404 }
        );
      }

      const tickers = parseJsonList(decision.matchedTickersJson).map((ticker) =>
        String(ticker).toUpperCase()
      );

      const symbol = overrideSymbol || tickers[0];

      if (!symbol) {
        return NextResponse.json(
          {
            error:
              "This scan result does not contain a ticker. Enter a symbol manually before saving.",
          },
          { status: 400 }
        );
      }

      const assetType = guessAssetType(
        symbol,
        `${decision.title} ${decision.summary ?? ""}`
      );

      await saveItem({
        userId: user.id,
        watchlistId,
        symbol,
        assetName: symbol,
        assetType,
        sourceType: "Scan",
        sourceId: decision.id,
        sourceTitle: decision.title,
        sourceUrl: decision.url,
        originalScore: decision.score,
        thesis:
          decision.summary ||
          `Saved from ranked scan result. Category: ${decision.category}.`,
        riskNotes: `Saved from scan. Materiality ${decision.materialityScore}, relevance ${decision.relevanceScore}, trust ${decision.trustScore}.`,
        priority:
          decision.score >= 90
            ? "Critical"
            : decision.score >= 80
              ? "High"
              : decision.score >= 70
                ? "Medium"
                : "Low",
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
          assetType,
          signal: decision.title,
          notes: decision.summary || null,
        },
        create: {
          userId: user.id,
          ticker: symbol,
          name: symbol,
          assetType,
          signal: decision.title,
          notes: decision.summary || null,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    if (action === "updateItemStatus") {
      const itemId = cleanString(body.itemId);
      const status = cleanString(body.status) || "Watching";

      await prisma.namedWatchlistItem.updateMany({
        where: {
          id: itemId,
          userId: user.id,
        },
        data: {
          status,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    if (action === "deleteItem") {
      const itemId = cleanString(body.itemId);

      await prisma.namedWatchlistItem.deleteMany({
        where: {
          id: itemId,
          userId: user.id,
        },
      });

      return NextResponse.json(await loadWatchlists(user.id));
    }

    return NextResponse.json(
      { error: "Unknown watchlist action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Watchlist action failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}