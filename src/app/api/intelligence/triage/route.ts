import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIntelligenceSettings } from "@/lib/intelligence-settings";
import { prisma } from "@/lib/prisma";

function parseScore(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
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

function rankingScore(decision: {
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
}) {
  return Math.round(
    decision.score * 0.48 +
      decision.materialityScore * 0.24 +
      decision.relevanceScore * 0.2 +
      decision.trustScore * 0.08
  );
}

function fruitPotentialScore(decision: {
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  urgency: string;
  importanceTier: string;
}) {
  const urgencyBoost =
    decision.urgency === "Critical"
      ? 10
      : decision.urgency === "High"
        ? 7
        : decision.urgency === "Medium"
          ? 3
          : 0;

  const tierBoost =
    decision.importanceTier === "URGENT_PORTFOLIO_ALERT"
      ? 10
      : decision.importanceTier === "ADVISOR_REVIEW"
        ? 7
        : decision.importanceTier === "INVESTOR_DIGEST"
          ? 3
          : 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        decision.score * 0.36 +
          decision.materialityScore * 0.28 +
          decision.relevanceScore * 0.24 +
          decision.trustScore * 0.12 +
          urgencyBoost +
          tierBoost
      )
    )
  );
}

function scoreExplanation(decision: {
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  urgency: string;
  sourceName: string;
  sourceTier: string;
  matchedTickersJson: string;
  matchedAreasJson: string;
  reasonsJson: string;
}) {
  const tickers = parseJsonList(decision.matchedTickersJson).map(String);
  const areas = parseJsonList(decision.matchedAreasJson).map(String);
  const reasons = parseJsonList(decision.reasonsJson).map(String);

  const explanation = [
    `Overall score is ${decision.score}/100.`,
    `Materiality contributed ${decision.materialityScore}/100 based on market-moving, regulatory, earnings, macro, credit, or corporate-action language.`,
    `Relevance contributed ${decision.relevanceScore}/100 based on watchlist, client holdings, research tickers, firm themes, or investment areas.`,
    `Trust contributed ${decision.trustScore}/100 from source tier: ${decision.sourceTier}.`,
    `Urgency is ${decision.urgency}.`,
  ];

  if (tickers.length) {
    explanation.push(`Matched ticker(s): ${tickers.join(", ")}.`);
  }

  if (areas.length) {
    explanation.push(`Matched area(s): ${areas.join(", ")}.`);
  }

  if (reasons.length) {
    explanation.push(...reasons.slice(0, 6));
  }

  return Array.from(new Set(explanation)).slice(0, 10);
}

function deliveryRecommendation(score: number) {
  if (score >= 90) {
    return "Immediate advisor alert: dashboard + email + SMS queue.";
  }

  if (score >= 80) {
    return "High-priority advisor review: dashboard + email queue.";
  }

  if (score >= 70) {
    return "Review queue: visible in ranking and digest-ready.";
  }

  if (score >= 60) {
    return "Retain for advisor scan, but avoid aggressive notifications.";
  }

  return "Discard as noise unless manually reviewed.";
}

async function getFirmRecipients(userId: string) {
  const userMemberships = await prisma.firmMembership.findMany({
    where: {
      userId,
      status: "Active",
    },
    include: {
      firm: true,
    },
  });

  const firmIds = Array.from(
    new Set(userMemberships.map((membership) => membership.firmId))
  );

  if (!firmIds.length) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return user
      ? [
          {
            firmId: null,
            firmName: "Personal Workspace",
            userId: user.id,
            name: user.name,
            email: user.email,
            role: "Advisor",
          },
        ]
      : [];
  }

  const members = await prisma.firmMembership.findMany({
    where: {
      firmId: {
        in: firmIds,
      },
      status: "Active",
    },
    include: {
      user: true,
      firm: true,
    },
    orderBy: [{ firmId: "asc" }, { role: "asc" }, { createdAt: "asc" }],
  });

  const recipientMap = new Map<
    string,
    {
      firmId: string | null;
      firmName: string;
      userId: string;
      name: string;
      email: string;
      role: string;
    }
  >();

  for (const member of members) {
    if (!recipientMap.has(member.userId)) {
      recipientMap.set(member.userId, {
        firmId: member.firmId,
        firmName: member.firm.name,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      });
    }
  }

  return Array.from(recipientMap.values());
}

async function loadTriageState(userId: string, requestUrl: string) {
  const url = new URL(requestUrl);
  const requestedMinScore = parseScore(url.searchParams.get("minScore"), 0);
  const sortBy = url.searchParams.get("sortBy") || "score";

  const { policy } = await ensureIntelligenceSettings(userId);
  const visibleFloor =
    requestedMinScore > 0 ? requestedMinScore : policy.minScoreToStore;

  const [decisionsRaw, runs, totalDecisionCount, hiddenBelowFloorCount, firmRecipients] =
    await Promise.all([
      prisma.headlineDecision.findMany({
        where: {
          userId,
          score: {
            gte: visibleFloor,
          },
        },
        orderBy:
          sortBy === "fruit"
            ? [{ score: "desc" }, { materialityScore: "desc" }]
            : [{ score: "desc" }, { createdAt: "desc" }],
        take: 150,
      }),

      prisma.intelligenceRun.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

      prisma.headlineDecision.count({
        where: {
          userId,
        },
      }),

      prisma.headlineDecision.count({
        where: {
          userId,
          score: {
            lt: visibleFloor,
          },
        },
      }),

      getFirmRecipients(userId),
    ]);

  const rankedDecisions = decisionsRaw
    .map((decision) => ({
      ...decision,
      rankingScore: rankingScore(decision),
      fruitPotentialScore: fruitPotentialScore(decision),
      scoreExplanation: scoreExplanation(decision),
      deliveryRecommendation: deliveryRecommendation(decision.score),
      matchedTickers: parseJsonList(decision.matchedTickersJson),
      matchedAreas: parseJsonList(decision.matchedAreasJson),
      reasons: parseJsonList(decision.reasonsJson),
      channels: parseJsonList(decision.channelsJson),
    }))
    .sort((a, b) => {
      if (sortBy === "fruit") {
        return (
          b.fruitPotentialScore - a.fruitPotentialScore ||
          b.score - a.score ||
          b.materialityScore - a.materialityScore
        );
      }

      if (sortBy === "materiality") {
        return (
          b.materialityScore - a.materialityScore ||
          b.score - a.score ||
          b.relevanceScore - a.relevanceScore
        );
      }

      if (sortBy === "relevance") {
        return (
          b.relevanceScore - a.relevanceScore ||
          b.score - a.score ||
          b.materialityScore - a.materialityScore
        );
      }

      return (
        b.score - a.score ||
        b.fruitPotentialScore - a.fruitPotentialScore ||
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    })
    .map((decision, index) => ({
      ...decision,
      rank: index + 1,
    }));

  const scoreBands = {
    ninetyPlus: rankedDecisions.filter((decision) => decision.score >= 90).length,
    eightyPlus: rankedDecisions.filter((decision) => decision.score >= 80).length,
    seventyPlus: rankedDecisions.filter((decision) => decision.score >= 70).length,
    sixtyPlus: rankedDecisions.filter((decision) => decision.score >= 60).length,
  };

  const categoryCounts = rankedDecisions.reduce<Record<string, number>>(
    (acc, decision) => {
      acc[decision.category] = (acc[decision.category] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const tierCounts = rankedDecisions.reduce<Record<string, number>>(
    (acc, decision) => {
      acc[decision.importanceTier] =
        (acc[decision.importanceTier] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return {
    decisions: rankedDecisions,
    runs,
    policy,
    firmRecipients,
    ranking: {
      sortBy,
      visibleFloor,
      totalDecisionCount,
      hiddenBelowFloorCount,
      scoreBands,
      categoryCounts,
      tierCounts,
      topCandidate: rankedDecisions[0] ?? null,
    },
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadTriageState(user.id, request.url));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "";

  const { policy } = await ensureIntelligenceSettings(user.id);

  if (action === "updateNoisePolicy") {
    const minScoreToStore = parseScore(body.minScoreToStore, policy.minScoreToStore);
    const minScoreToAlert = Math.max(
      minScoreToStore,
      parseScore(body.minScoreToAlert, policy.minScoreToAlert)
    );

    const applyToSources = Boolean(body.applyToSources);

    await prisma.intelligenceRetentionPolicy.update({
      where: {
        userId: user.id,
      },
      data: {
        minScoreToStore,
        minScoreToAlert,
      },
    });

    if (applyToSources) {
      await prisma.newsSourceConfig.updateMany({
        where: {
          userId: user.id,
        },
        data: {
          minScoreToRetain: minScoreToStore,
          minScoreToAlert,
        },
      });
    }

    return NextResponse.json(
      await loadTriageState(user.id, `${request.url}?minScore=${minScoreToStore}`)
    );
  }

  if (action === "purgeNoise") {
    const floor = parseScore(body.floor, policy.minScoreToStore);

    const removedDecisions = await prisma.headlineDecision.deleteMany({
      where: {
        userId: user.id,
        score: {
          lt: floor,
        },
      },
    });

    const removedAlerts = await prisma.alertEvent.deleteMany({
      where: {
        userId: user.id,
        score: {
          lt: floor,
        },
      },
    });

    return NextResponse.json({
      ...(await loadTriageState(user.id, `${request.url}?minScore=${floor}`)),
      purge: {
        floor,
        removedDecisions: removedDecisions.count,
        removedAlerts: removedAlerts.count,
      },
    });
  }

  return NextResponse.json(
    { error: "Unknown triage action." },
    { status: 400 }
  );
}