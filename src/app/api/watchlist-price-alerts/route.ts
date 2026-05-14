import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type QuoteResult = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  provider: string;
  isLive: boolean;
  note: string;
};

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function fetchLiveQuote(symbol: string): Promise<QuoteResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return {
      symbol,
      price: null,
      change: null,
      changePct: null,
      provider: "No live provider",
      isLive: false,
      note: "Set ALPHA_VANTAGE_API_KEY to enable live price-alert checks.",
    };
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const payload = await response.json();
    const raw = payload?.["Global Quote"] ?? {};

    const price = Number(raw["05. price"]);
    const change = Number(raw["09. change"]);
    const changePct = Number(String(raw["10. change percent"] ?? "").replace("%", ""));

    if (!Number.isFinite(price)) {
      return {
        symbol,
        price: null,
        change: null,
        changePct: null,
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
      provider: "Alpha Vantage",
      isLive: false,
      note: "Quote fetch failed.",
    };
  }
}

async function createTriggerRecords({
  userId,
  userEmail,
  alert,
  triggerType,
  targetPrice,
  observedPrice,
  provider,
}: {
  userId: string;
  userEmail: string;
  alert: {
    id: string;
    symbol: string;
    assetName: string | null;
    notificationChannel: string;
  };
  triggerType: "High" | "Low";
  targetPrice: number;
  observedPrice: number;
  provider: string;
}) {
  const directionText = triggerType === "High" ? "above" : "below";
  const title = `${alert.symbol} ${triggerType} Price Alert`;
  const body = `${alert.symbol} traded at $${observedPrice}, which is ${directionText} your ${triggerType.toLowerCase()} target of $${targetPrice}.`;

  await prisma.watchlistPriceAlertEvent.create({
    data: {
      userId,
      alertId: alert.id,
      symbol: alert.symbol,
      triggerType,
      targetPrice,
      observedPrice,
      provider,
      message: body,
    },
  });

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId,
        dedupeKey: `watchlist-price:${alert.id}:${triggerType}:${targetPrice}`,
      },
    },
    update: {
      title,
      body,
      source: "Watchlist Price Alert",
      ticker: alert.symbol,
      urgency: "High",
      score: 92,
      channel: alert.notificationChannel,
      status: "Unread",
      aiBriefing: `Price-alert trigger for ${alert.symbol}. Observed price: $${observedPrice}. Target: $${targetPrice}. Provider: ${provider}.`,
    },
    create: {
      userId,
      dedupeKey: `watchlist-price:${alert.id}:${triggerType}:${targetPrice}`,
      title,
      body,
      source: "Watchlist Price Alert",
      ticker: alert.symbol,
      urgency: "High",
      score: 92,
      channel: alert.notificationChannel,
      status: "Unread",
      aiBriefing: `Price-alert trigger for ${alert.symbol}. Observed price: $${observedPrice}. Target: $${targetPrice}. Provider: ${provider}.`,
    },
  });

  await prisma.notificationDelivery.create({
    data: {
      userId,
      channel: alert.notificationChannel,
      destination: alert.notificationChannel === "Email" ? userEmail : "Dashboard",
      status: "Queued",
      urgency: "High",
      score: 92,
      title,
      body,
      reason: `Watchlist price alert triggered for ${alert.symbol}`,
      simulated: true,
    },
  });
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
  });

  const results = [];
  let triggered = 0;

  for (const alert of alerts) {
    const quote = await fetchLiveQuote(alert.symbol);

    if (!quote.isLive || quote.price === null) {
      await prisma.watchlistPriceAlert.update({
        where: {
          id: alert.id,
        },
        data: {
          lastProvider: quote.provider,
          lastCheckedAt: new Date(),
        },
      });

      results.push({
        alertId: alert.id,
        symbol: alert.symbol,
        status: "Skipped",
        note: quote.note,
        quote,
      });

      continue;
    }

    const highTriggered =
      alert.upperTargetPrice !== null &&
      alert.upperTargetPrice !== undefined &&
      quote.price >= alert.upperTargetPrice &&
      !alert.triggeredHighAt;

    const lowTriggered =
      alert.lowerTargetPrice !== null &&
      alert.lowerTargetPrice !== undefined &&
      quote.price <= alert.lowerTargetPrice &&
      !alert.triggeredLowAt;

    let triggerCountIncrease = 0;
    const updateData: {
      lastPrice: number;
      lastProvider: string;
      lastCheckedAt: Date;
      triggeredHighAt?: Date;
      triggeredLowAt?: Date;
      triggerCount?: number;
      status?: string;
    } = {
      lastPrice: quote.price,
      lastProvider: quote.provider,
      lastCheckedAt: new Date(),
    };

    if (highTriggered && alert.upperTargetPrice !== null) {
      await createTriggerRecords({
        userId,
        userEmail,
        alert,
        triggerType: "High",
        targetPrice: alert.upperTargetPrice,
        observedPrice: quote.price,
        provider: quote.provider,
      });

      updateData.triggeredHighAt = new Date();
      triggerCountIncrease += 1;
      triggered += 1;
    }

    if (lowTriggered && alert.lowerTargetPrice !== null) {
      await createTriggerRecords({
        userId,
        userEmail,
        alert,
        triggerType: "Low",
        targetPrice: alert.lowerTargetPrice,
        observedPrice: quote.price,
        provider: quote.provider,
      });

      updateData.triggeredLowAt = new Date();
      triggerCountIncrease += 1;
      triggered += 1;
    }

    const highComplete =
      !alert.upperTargetPrice || Boolean(alert.triggeredHighAt || updateData.triggeredHighAt);

    const lowComplete =
      !alert.lowerTargetPrice || Boolean(alert.triggeredLowAt || updateData.triggeredLowAt);

    if (highComplete && lowComplete && (highTriggered || lowTriggered)) {
      updateData.status = "Triggered";
    }

    if (triggerCountIncrease) {
      updateData.triggerCount = alert.triggerCount + triggerCountIncrease;
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
      status: highTriggered || lowTriggered ? "Triggered" : "Checked",
      highTriggered,
      lowTriggered,
      quote,
    });
  }

  return {
    checked: alerts.length,
    triggered,
    results,
  };
}

async function loadData(userId: string) {
  const [alerts, events, watchlists] = await Promise.all([
    prisma.watchlistPriceAlert.findMany({
      where: {
        userId,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.watchlistPriceAlertEvent.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    }),
    prisma.namedWatchlist.findMany({
      where: {
        userId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
  ]);

  const active = alerts.filter((alert) => alert.status === "Active").length;
  const triggered = alerts.filter((alert) => alert.status === "Triggered").length;
  const paused = alerts.filter((alert) => alert.status === "Paused").length;

  return {
    alerts,
    events,
    watchlists,
    stats: {
      total: alerts.length,
      active,
      triggered,
      paused,
      recentEvents: events.length,
    },
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadData(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "createAlert") {
    const symbol = readText(body.symbol).toUpperCase();
    const upperTargetPrice = readNumber(body.upperTargetPrice);
    const lowerTargetPrice = readNumber(body.lowerTargetPrice);
    const watchlistItemId = readText(body.watchlistItemId, "");
    const notificationChannel = readText(body.notificationChannel, "Dashboard");
    const notes = readText(body.notes, "");

    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
    }

    if (upperTargetPrice === null && lowerTargetPrice === null) {
      return NextResponse.json(
        { error: "Enter a high target, low target, or both." },
        { status: 400 }
      );
    }

    let watchlistItem:
      | {
          id: string;
          watchlistId: string;
          symbol: string;
          assetName: string;
        }
      | null = null;

    if (watchlistItemId) {
      watchlistItem = await prisma.namedWatchlistItem.findFirst({
        where: {
          id: watchlistItemId,
          userId: user.id,
        },
      });
    }

    await prisma.watchlistPriceAlert.create({
      data: {
        userId: user.id,
        watchlistId: watchlistItem?.watchlistId,
        watchlistItemId: watchlistItem?.id,
        symbol: watchlistItem?.symbol ?? symbol,
        assetName: watchlistItem?.assetName ?? symbol,
        upperTargetPrice,
        lowerTargetPrice,
        notificationChannel,
        status: "Active",
        notes,
      },
    });
  }

  if (action === "updateAlert") {
    const alertId = readText(body.alertId);
    const upperTargetPrice = readNumber(body.upperTargetPrice);
    const lowerTargetPrice = readNumber(body.lowerTargetPrice);
    const notificationChannel = readText(body.notificationChannel, "Dashboard");
    const notes = readText(body.notes, "");
    const status = readText(body.status, "Active");

    if (!alertId) {
      return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });
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
        notes,
        status,
      },
    });
  }

  if (action === "pauseAlert" || action === "activateAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });
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
  }

  if (action === "resetAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });
    }

    await prisma.watchlistPriceAlert.updateMany({
      where: {
        id: alertId,
        userId: user.id,
      },
      data: {
        status: "Active",
        triggeredHighAt: null,
        triggeredLowAt: null,
      },
    });
  }

  if (action === "deleteAlert") {
    const alertId = readText(body.alertId);

    if (!alertId) {
      return NextResponse.json({ error: "Alert ID is required." }, { status: 400 });
    }

    await prisma.watchlistPriceAlert.deleteMany({
      where: {
        id: alertId,
        userId: user.id,
      },
    });
  }

  if (action === "checkAlerts") {
    const check = await checkAlerts(user.id, user.email);
    return NextResponse.json({
      ...(await loadData(user.id)),
      check,
      message: `Checked ${check.checked} active alert(s). Triggered ${check.triggered}.`,
    });
  }

  return NextResponse.json(await loadData(user.id));
}