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

export async function POST(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceDemo = url.searchParams.get("demo") === "1";

  const { policy, sources } = await ensureIntelligenceSettings(user.id);

  const enabledSources = sources.filter((source) => source.enabled);
  const sourceMap = new Map(enabledSources.map((source) => [source.sourceId, source]));

  const [watchAssets, ventures, goals, research, clients] = await Promise.all([
    prisma.watchAsset.findMany({ where: { userId: user.id } }),
    prisma.ventureProject.findMany({ where: { userId: user.id } }),
    prisma.investorGoal.findMany({ where: { userId: user.id } }),
    prisma.researchNote.findMany({ where: { userId: user.id } }),
    prisma.clientProfile.findMany({
      where: { userId: user.id },
      include: { holdings: true },
    }),
  ]);

  const profile: TriageProfile = {
    watchTickers: watchAssets.map((asset) => asset.ticker),
    companyNames: watchAssets.map((asset) => asset.name),
    clientHoldingTickers: clients.flatMap((client) =>
      client.holdings.map((holding) => holding.symbol)
    ),
    ventureSectors: ventures.map((venture) => venture.sector),
    researchTickers: research
      .map((note) => note.ticker)
      .filter((ticker): ticker is string => Boolean(ticker)),
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
    liveHeadlines.length > 0
      ? liveHeadlines
      : demoHeadlines;

  const mode =
    forceDemo
      ? "demo-policy-governed"
      : liveHeadlines.length > 0
        ? "live-free-rss"
        : "live-fallback-demo";

  const evaluated = rawHeadlines
    .map((headline) => {
      const source = sourceMap.get(headline.sourceId);
      const decision = triageHeadline(headline, profile);

      const minScoreToRetain = Math.max(
        policy.minScoreToStore,
        source?.minScoreToRetain ?? policy.minScoreToStore
      );

      const minScoreToAlert = Math.max(
        policy.minScoreToAlert,
        source?.minScoreToAlert ?? policy.minScoreToAlert
      );

      const shouldPersistByPolicy =
        decision.shouldPersist && decision.score >= minScoreToRetain;

      const shouldAlertByPolicy =
        decision.shouldAlert && decision.score >= minScoreToAlert;

      return {
        decision,
        source,
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
        urgency: decision.urgency,
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(decision.reasons),
        channelsJson: safeJson(decision.channels),
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
        urgency: decision.urgency,
        score: decision.score,
        materialityScore: decision.materialityScore,
        relevanceScore: decision.relevanceScore,
        trustScore: decision.trustScore,
        matchedTickersJson: safeJson(decision.matchedTickers),
        matchedAreasJson: safeJson(decision.matchedAreas),
        reasonsJson: safeJson(decision.reasons),
        channelsJson: safeJson(decision.channels),
        expiresAt: addDays(retentionDays),
      },
    });

    if (item.shouldAlertByPolicy) {
      await prisma.alertEvent.upsert({
        where: {
          userId_dedupeKey: {
            userId: user.id,
            dedupeKey: `headline-alert-${decision.dedupeKey}`,
          },
        },
        update: {},
        create: {
          userId: user.id,
          dedupeKey: `headline-alert-${decision.dedupeKey}`,
          title: decision.title,
          body:
            decision.summary ||
            "Slice detected a high-priority market intelligence item.",
          source: decision.sourceName,
          ticker: decision.matchedTickers[0] ?? null,
          urgency: decision.urgency,
          score: decision.score,
          channel: decision.channels.join(" + "),
        },
      });
    }
  }

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

  const notificationResult = await queueNotificationDeliveries(user.id);

  return NextResponse.json({
    run,
    mode,
    notificationResult,
    sourceResults: liveFetch.sourceResults,
    scanned: rawHeadlines.length,
    retained: retained.length,
    alerts: alertCandidates.length,
    digest: digestCandidates.length,
    discarded: evaluated.length - retained.length,
    decisions: retained.map((item) => ({
      ...item.decision,
      shouldAlertByPolicy: item.shouldAlertByPolicy,
      shouldPersistByPolicy: item.shouldPersistByPolicy,
    })),
  });
}