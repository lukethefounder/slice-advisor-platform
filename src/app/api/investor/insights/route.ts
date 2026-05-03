import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [watchAssets, ventures, goals, research, alertEvents] =
    await Promise.all([
      prisma.watchAsset.findMany({ where: { userId: user.id } }),
      prisma.ventureProject.findMany({ where: { userId: user.id } }),
      prisma.investorGoal.findMany({ where: { userId: user.id } }),
      prisma.researchNote.findMany({ where: { userId: user.id } }),
      prisma.alertEvent.findMany({
        where: { userId: user.id, status: "Unread" },
      }),
    ]);

  const cryptoCount = watchAssets.filter((asset) =>
    asset.assetType.toLowerCase().includes("crypto")
  ).length;

  const stockCount = watchAssets.filter((asset) =>
    asset.assetType.toLowerCase().includes("stock")
  ).length;

  const bondCount = watchAssets.filter((asset) =>
    asset.assetType.toLowerCase().includes("bond")
  ).length;

  const insights = [
    {
      title: "Watchlist Coverage",
      category: "Portfolio",
      score: Math.min(100, watchAssets.length * 12),
      summary:
        watchAssets.length >= 8
          ? "Your watchlist has broad coverage across several assets. Slice can begin ranking headlines against your interests."
          : "Your watchlist is still light. Add more holdings or assets you care about so Slice can personalize alerts better.",
    },
    {
      title: "Alternative Investment Exposure",
      category: "Alternatives",
      score: ventures.length > 0 || cryptoCount > 0 ? 78 : 35,
      summary:
        ventures.length > 0 || cryptoCount > 0
          ? "You are tracking higher-risk opportunities. Slice separates these from core portfolio assets to keep risk clear."
          : "No alternative investments are currently being tracked. Add crypto or private venture ideas if they are relevant to your strategy.",
    },
    {
      title: "Research Discipline",
      category: "Research",
      score: Math.min(100, research.length * 18),
      summary:
        research.length >= 5
          ? "You are building a strong research trail. This helps avoid emotional investment decisions."
          : "Add research notes when you evaluate a stock, crypto asset, fund, or private opportunity.",
    },
    {
      title: "Goal Alignment",
      category: "Planning",
      score: Math.min(100, goals.length * 25),
      summary:
        goals.length > 0
          ? "Investor goals are now being tracked. Slice can use them later to connect alerts to actual financial objectives."
          : "No investor goals are saved yet. Add goals like retirement, liquidity, home purchase, or venture allocation limits.",
    },
    {
      title: "Unread Alert Load",
      category: "Alerts",
      score: alertEvents.length > 8 ? 40 : 82,
      summary:
        alertEvents.length > 8
          ? "You have a growing unread alert backlog. Review or clear alerts so critical events are easier to spot."
          : "Unread alert load is manageable.",
    },
    {
      title: "Asset Mix Snapshot",
      category: "Allocation",
      score: 70,
      summary: `Current watchlist mix: ${stockCount} stock items, ${bondCount} bond items, ${cryptoCount} crypto items, and ${ventures.length} private venture projects.`,
    },
  ];

  return NextResponse.json({ insights });
}