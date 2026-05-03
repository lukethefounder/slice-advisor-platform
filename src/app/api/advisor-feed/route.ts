import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOpportunityRadar } from "@/lib/opportunity-engine";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [radar, alerts, deliveries, latestRun] = await Promise.all([
    getOpportunityRadar(user.id),
    prisma.alertEvent.findMany({
      where: { userId: user.id },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.notificationDelivery.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.intelligenceRun.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const feedItems = radar.signals.slice(0, 20).map((signal) => ({
    id: signal.id,
    kind: "OpportunitySignal",
    title: signal.title,
    summary: signal.summary,
    sourceName: signal.sourceName,
    sourceUrl: signal.sourceUrl,
    aiBriefing: signal.aiBriefing,
    signalType: signal.signalType,
    priorityTier: signal.priorityTier,
    compositeScore: signal.compositeScore,
    portfolioRelevanceScore: signal.portfolioRelevanceScore,
    opportunityScore: signal.opportunityScore,
    riskScore: signal.riskScore,
    confidenceScore: signal.confidenceScore,
    actionabilityScore: signal.actionabilityScore,
    issuerCredibilityScore: signal.issuerCredibilityScore,
    estimatedImpactScore: signal.estimatedImpactScore,
    suggestedAction: signal.suggestedAction,
    status: signal.status,
    createdAt: signal.createdAt,
  }));

  return NextResponse.json({
    radarStats: radar.stats,
    latestRun,
    feedItems,
    alerts,
    deliveries,
  });
}