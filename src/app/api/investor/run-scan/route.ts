import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const demoStories = [
  {
    source: "Demo SEC Filing",
    ticker: "NVDA",
    title: "Material AI infrastructure filing matched to watchlist",
    body:
      "A high-materiality filing was matched to a watched AI infrastructure company. This may warrant review, but is not a buy or sell recommendation.",
    baseScore: 94,
    urgency: "Critical",
  },
  {
    source: "Demo Market News",
    ticker: "AAPL",
    title: "Supplier demand report supports positive Apple momentum",
    body:
      "Supplier commentary appears supportive and aligns with a positive short-term technical picture.",
    baseScore: 78,
    urgency: "High",
  },
  {
    source: "Demo Macro Feed",
    ticker: "TLT",
    title: "Yield movement may affect bond duration exposure",
    body:
      "Bond-sensitive portfolios may need review because rate movement can affect duration-heavy assets.",
    baseScore: 82,
    urgency: "High",
  },
  {
    source: "Demo Risk Feed",
    ticker: "TSLA",
    title: "Volatility warning triggered for watched growth asset",
    body:
      "The asset is showing mixed signals and may require risk review before any additional exposure is considered.",
    baseScore: 69,
    urgency: "Medium",
  },
];

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const watchlist = await prisma.watchAsset.findMany({
    where: { userId: user.id },
  });

  const watchedTickers = new Set(watchlist.map((asset) => asset.ticker));

  const matchedStories = demoStories.filter((story) =>
    watchedTickers.has(story.ticker)
  );

  const created = [];

  for (const story of matchedStories) {
    const dedupeKey = `${story.source}:${story.ticker}:${story.title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 180);

    const alert = await prisma.alertEvent.upsert({
      where: {
        userId_dedupeKey: {
          userId: user.id,
          dedupeKey,
        },
      },
      update: {},
      create: {
        userId: user.id,
        dedupeKey,
        title: story.title,
        body: story.body,
        source: story.source,
        ticker: story.ticker,
        urgency: story.urgency,
        score: story.baseScore,
        channel:
          story.urgency === "Critical" ? "SMS + Email + Dashboard" : "Dashboard",
      },
    });

    await prisma.newsDecision.create({
      data: {
        title: story.title,
        sourceName: story.source,
        link: null,
        score: story.baseScore,
        urgency: story.urgency,
        shouldAlert: story.baseScore >= 75,
        reasonsJson: JSON.stringify([
          "Matched user watchlist.",
          "High source priority.",
          "Materiality threshold passed.",
          "Compliance-safe alert copy generated.",
        ]),
      },
    });

    created.push(alert);
  }

  return NextResponse.json({
    created,
    scanned: demoStories.length,
    matched: created.length,
  });
}