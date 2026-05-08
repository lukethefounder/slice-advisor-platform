import { NextResponse } from "next/server";
import { queueNotificationDeliveries } from "@/lib/notification-engine";
import { getCurrentUser } from "@/lib/auth";
import { fetchFreeHeadlineBatch } from "@/lib/free-rss-sources";
import {
  enforceStorageLimits,
  ensureIntelligenceSettings,
  retentionDaysForDecision,
} from "@/lib/intelligence-settings";
import { prisma } from "@/lib/prisma";
import {
  demoHeadlineBatch,
  triageHeadline,
  type TriageProfile,
} from "@/lib/news-triage";

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function parseScoreParam(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function scoreToUrgency(score: number) {
  if (score >= 90) return "Critical";
  if (score >= 80) return "High";
  if (score >= 65) return "Medium";
  return "Low";
}

function rankLabel(index: number) {
  if (index === 0) return "Top-ranked opportunity";
  if (index === 1) return "Second-ranked opportunity";
  if (index === 2) return "Third-ranked opportunity";
  return `Rank #${index + 1}`;
}

function sourceLine(decision: {
  sourceName: string;
  sourceTier: string;
  url: string | null;
}) {
  return decision.url
    ? `${decision.sourceName} (${decision.sourceTier}) — ${decision.url}`
    : `${decision.sourceName} (${decision.sourceTier})`;
}

function firmAlertBriefing({
  decision,
  rank,
  noiseFloor,
  alertFloor,
}: {
  decision: ReturnType<typeof triageHeadline>;
  rank: number;
  noiseFloor: number;
  alertFloor: number;
}) {
  const tickers = decision.matchedTickers.length
    ? decision.matchedTickers.join(", ")
    : "None";
  const areas = decision.matchedAreas.length
    ? decision.matchedAreas.join(", ")
    : "None";
  const reasons = decision.reasons.length
    ? decision.reasons.map((reason) => `- ${reason}`).join("\n")
    : "- No scoring reasons were stored.";

  return [
    `${rankLabel(rank)} from Slice Intelligence Triage`,
    "",
    `Headline: ${decision.title}`,
    `Score: ${decision.score}/100`,
    `Urgency: ${scoreToUrgency(decision.score)}`,
    `Category: ${decision.category} / ${decision.subcategory}`,
    `Materiality: ${decision.materialityScore}/100`,
    `Relevance: ${decision.relevanceScore}/100`,
    `Source trust: ${decision.trustScore}/100`,
    `Noise floor used: ${noiseFloor}`,
    `Firm alert floor used: ${alertFloor}`,
    `Matched tickers: ${tickers}`,
    `Matched areas: ${areas}`,
    `Source: ${sourceLine(decision)}`,
    "",
    "Why it ranked highly:",
    reasons,
    "",
    "Advisor action:",
    decision.score >= 90
      ? "Review immediately. This cleared the highest ranking band."
      : decision.score >= 80
        ? "Review soon. This cleared the high-priority advisor alert band."
        : decision.score >= 70
          ? "Review when possible. This cleared the advisor review band."
          : "Retained for review, but below the highest alert bands.",
  ].join("\n");
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

async function createFirmAlertEvents({
  userId,
  retained,
  noiseFloor,
  alertFloor,
  notifyFirm,
}: {
  userId: string;
  retained: Array<{
    decision: ReturnType<typeof triageHeadline>;
    shouldPersistByPolicy: boolean;
    shouldAlertByPolicy: boolean;
  }>;
  noiseFloor: number;
  alertFloor: number;
  notifyFirm: boolean;
}) {
  const alertCandidates = retained
    .filter((item) => item.decision.score >= alertFloor)
    .sort((a, b) => b.decision.score - a.decision.score);

  if (!alertCandidates.length) {
    return {
      recipients: 0,
      alertCandidates: 0,
      alertEventsUpserted: 0,
      deliveryResults: [],
    };
  }

  const recipients = notifyFirm
    ? await getFirmRecipients(userId)
    : await getFirmRecipients(userId).then((items) =>
        items.filter((item) => item.userId === userId)
      );

  let alertEventsUpserted = 0;

  for (const [index, item] of alertCandidates.entries()) {
    const decision = item.decision;
    const briefing = firmAlertBriefing({
      decision,
      rank: index,
      noiseFloor,
      alertFloor,
    });

    for (const recipient of recipients) {
      const firmPrefix = recipient.firmId
        ? `firm-${recipient.firmId}`
        : "personal";

      await prisma.alertEvent.upsert({
        where: {
          userId_dedupeKey: {
            userId: recipient.userId,
            dedupeKey: `${firmPrefix}-triage-rank-${decision.dedupeKey}`,
          },
        },
        update: {
          title: `[${rankLabel(index)}] ${decision.title}`,
          body:
            decision.summary ||
            "Slice detected a high-ranked intelligence item.",
          source: decision.sourceName,
          ticker: decision.matchedTickers[0] ?? null,
          urgency: scoreToUrgency(decision.score),
          score: decision.score,
          channel:
            decision.score >= 90
              ? "Firm Workspace + Dashboard + Email + SMS"
              : decision.score >= 80
                ? "Firm Workspace + Dashboard + Email"
                : "Firm Workspace + Dashboard",
          status: "Unread",
          readAt: null,
          sourceUrl: decision.url,
          aiBriefing: briefing,
        },
        create: {
          userId: recipient.userId,
          dedupeKey: `${firmPrefix}-triage-rank-${decision.dedupeKey}`,
          title: `[${rankLabel(index)}] ${decision.title}`,
          body:
            decision.summary ||
            "Slice detected a high-ranked intelligence item.",
          source: decision.sourceName,
          ticker: decision.matchedTickers[0] ?? null,
          urgency: scoreToUrgency(decision.score),
          score: decision.score,
          channel:
            decision.score >= 90
              ? "Firm Workspace + Dashboard + Email + SMS"
              : decision.score >= 80
                ? "Firm Workspace + Dashboard + Email"
                : "Firm Workspace + Dashboard",
          status: "Unread",
          sourceUrl: decision.url,
          aiBriefing: briefing,
        },
      });

      alertEventsUpserted += 1;
    }
  }

  const deliveryResults = [];

  for (const recipient of recipients) {
    deliveryResults.push({
      userId: recipient.userId,
      name: recipient.name,
      email: recipient.email,
      result: await queueNotificationDeliveries(recipient.userId),
    });
  }

  return {
    recipients: recipients.length,
    alertCandidates: alertCandidates.length,
    alertEventsUpserted,
    deliveryResults,
  };
}

function uniqueSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().replace(/^\$/, "").toUpperCase())
        .filter(Boolean)
    )
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceDemo = url.searchParams.get("demo") === "1";

  const { policy, sources } = await ensureIntelligenceSettings(user.id);

  const noiseFloor = parseScoreParam(
    url.searchParams.get("noiseFloor"),
    policy.minScoreToStore
  );

  const alertFloor = Math.max(
    noiseFloor,
    parseScoreParam(url.searchParams.get("alertFloor"), policy.minScoreToAlert)
  );

  const notifyFirm = url.searchParams.get("notifyFirm") !== "0";

  const enabledSources = sources.filter((source) => source.enabled);
  const sourceMap = new Map(
    enabledSources.map((source) => [source.sourceId, source])
  );

  const [
    watchAssets,
    namedWatchlistItems,
    namedWatchlists,
    portfolioHoldings,
    ventures,
    goals,
    research,
    clients,
  ] = await Promise.all([
    prisma.watchAsset.findMany({ where: { userId: user.id } }),

    prisma.namedWatchlistItem.findMany({
      where: {
        userId: user.id,
        status: {
          not: "Archived",
        },
      },
      include: {
        watchlist: true,
      },
    }),

    prisma.namedWatchlist.findMany({
      where: {
        userId: user.id,
      },
    }),

    prisma.investorHolding.findMany({
      where: {
        userId: user.id,
      },
    }),

    prisma.ventureProject.findMany({ where: { userId: user.id } }),

    prisma.investorGoal.findMany({ where: { userId: user.id } }),

    prisma.researchNote.findMany({ where: { userId: user.id } }),

    prisma.clientProfile.findMany({
      where: { userId: user.id },
      include: { holdings: true },
    }),
  ]);

  const profile: TriageProfile = {
    watchTickers: uniqueSymbols(watchAssets.map((asset) => asset.ticker)),
    namedWatchlistTickers: uniqueSymbols(
      namedWatchlistItems.map((item) => item.symbol)
    ),
    namedWatchlistNames: namedWatchlists.flatMap((watchlist) => [
      watchlist.name,
      watchlist.focus,
      watchlist.description ?? "",
    ]),
    companyNames: watchAssets.map((asset) => asset.name),
    clientHoldingTickers: uniqueSymbols(
      clients.flatMap((client) =>
        client.holdings.map((holding) => holding.symbol)
      )
    ),
    portfolioHoldingTickers: uniqueSymbols(
      portfolioHoldings.map((holding) => holding.symbol)
    ),
    ventureSectors: ventures.map((venture) => venture.sector),
    researchTickers: uniqueSymbols(
      research
        .map((note) => note.ticker)
        .filter((ticker): ticker is string => Boolean(ticker))
    ),
    goalThemes: goals.flatMap((goal) => [
      goal.goalType,
      goal.title,
      goal.notes ?? "",
    ]),
  };

  const liveFetch = forceDemo
    ? { sourceResults: [], headlines: [] }
    : await fetchFreeHeadlineBatch(enabledSources);

  const liveHeadlines = liveFetch.headlines;

  const demoHeadlines = demoHeadlineBatch().filter((headline) =>
    sourceMap.has(headline.sourceId)
  );

  const rawHeadlines =
    liveHeadlines.length > 0 ? liveHeadlines : demoHeadlines;

  const mode = forceDemo
    ? "demo-ranked-watchlist-emphasis"
    : liveHeadlines.length > 0
      ? "live-free-rss-watchlist-emphasis"
      : "live-fallback-demo-watchlist-emphasis";

  const evaluated = rawHeadlines
    .map((headline) => {
      const source = sourceMap.get(headline.sourceId);
      const decision = triageHeadline(headline, profile);

      const sourceRetainFloor =
        source?.minScoreToRetain ?? policy.minScoreToStore;

      const minScoreToRetain = Math.max(noiseFloor, sourceRetainFloor);

      const shouldPersistByPolicy =
        decision.shouldPersist && decision.score >= minScoreToRetain;

      const shouldAlertByPolicy =
        shouldPersistByPolicy && decision.score >= alertFloor;

      return {
        decision,
        source,
        minScoreToRetain,
        shouldPersistByPolicy,
        shouldAlertByPolicy,
      };
    })
    .sort((a, b) => b.decision.score - a.decision.score);

  const retained = evaluated
    .filter((item) => item.shouldPersistByPolicy)
    .slice(0, policy.maxRetainedPerRun);

  const alertCandidates = retained.filter((item) => item.shouldAlertByPolicy);
  const digestCandidates = retained.filter(
    (item) => item.decision.action === "ADD_TO_DIGEST"
  );

  await prisma.headlineDecision.deleteMany({
    where: {
      userId: user.id,
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  for (const item of retained) {
    const decision = item.decision;
    const retentionDays = retentionDaysForDecision(policy, decision);

    const enhancedReasons = [
      ...decision.reasons,
      `Noise floor applied: ${noiseFloor}.`,
      `Firm alert floor applied: ${alertFloor}.`,
      `Named watchlist symbols considered: ${profile.namedWatchlistTickers.length}.`,
      `Portfolio holding symbols considered: ${profile.portfolioHoldingTickers.length}.`,
      item.shouldAlertByPolicy
        ? "This item cleared the firm alert threshold."
        : "This item was retained but did not clear the firm alert threshold.",
    ];

    await prisma.headlineDecision.upsert({
      where: {
        userId_dedupeKey: {
          userId: user.id,
          dedupeKey: decision.dedupeKey,
        },
      },
      update: {
        score: decision.score,
        materialityScore: decision.materialityScore,
        relevanceScore: decision.relevanceScore,
        trustScore: decision.trustScore,
        importanceTier: decision.importanceTier,
        action: decision.action,
        urgency: scoreToUrgency(decision.score),
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(enhancedReasons),
        channelsJson: safeJson(
          item.shouldAlertByPolicy
            ? decision.score >= 90
              ? ["Dashboard", "Email", "SMS"]
              : ["Dashboard", "Email"]
            : decision.channels
        ),
        expiresAt: addDays(retentionDays),
      },
      create: {
        userId: user.id,
        dedupeKey: decision.dedupeKey,
        title: decision.title,
        summary: decision.summary,
        sourceName: decision.sourceName,
        sourceTier: decision.sourceTier,
        url: decision.url,
        category: decision.category,
        subcategory: decision.subcategory,
        importanceTier: decision.importanceTier,
        action: decision.action,
        urgency: scoreToUrgency(decision.score),
        score: decision.score,
        materialityScore: decision.materialityScore,
        relevanceScore: decision.relevanceScore,
        trustScore: decision.trustScore,
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(enhancedReasons),
        channelsJson: safeJson(
          item.shouldAlertByPolicy
            ? decision.score >= 90
              ? ["Dashboard", "Email", "SMS"]
              : ["Dashboard", "Email"]
            : decision.channels
        ),
        expiresAt: addDays(retentionDays),
      },
    });
  }

  const firmNotificationResult = await createFirmAlertEvents({
    userId: user.id,
    retained,
    noiseFloor,
    alertFloor,
    notifyFirm,
  });

  for (const source of enabledSources) {
    await prisma.newsSourceConfig.update({
      where: {
        userId_sourceId: {
          userId: user.id,
          sourceId: source.sourceId,
        },
      },
      data: {
        lastRunAt: new Date(),
      },
    });
  }

  await enforceStorageLimits(user.id, policy);

  const run = await prisma.intelligenceRun.create({
    data: {
      userId: user.id,
      mode,
      scannedCount: rawHeadlines.length,
      retainedCount: retained.length,
      alertCount: alertCandidates.length,
      digestCount: digestCandidates.length,
      discardedCount: evaluated.length - retained.length,
      durationMs: Date.now() - startedAt,
    },
  });

  return NextResponse.json({
    run,
    mode,
    sourceResults: liveFetch.sourceResults,
    scanned: rawHeadlines.length,
    retained: retained.length,
    alerts: alertCandidates.length,
    digest: digestCandidates.length,
    discarded: evaluated.length - retained.length,
    noiseFloor,
    alertFloor,
    notifyFirm,
    watchlistEmphasis: {
      namedWatchlistTickers: profile.namedWatchlistTickers.length,
      portfolioHoldingTickers: profile.portfolioHoldingTickers.length,
      generalWatchTickers: profile.watchTickers.length,
    },
    firmNotificationResult,
    decisions: retained.map((item, index) => ({
      rank: index + 1,
      ...item.decision,
      urgency: scoreToUrgency(item.decision.score),
      shouldAlertByPolicy: item.shouldAlertByPolicy,
      shouldPersistByPolicy: item.shouldPersistByPolicy,
      minScoreToRetain: item.minScoreToRetain,
    })),
  });
}