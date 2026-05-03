import {
  DEFAULT_NEWS_SOURCES,
  DEFAULT_RETENTION_POLICY,
} from "@/lib/default-intelligence-config";
import { prisma } from "@/lib/prisma";

export async function ensureIntelligenceSettings(userId: string) {
  const policy = await prisma.intelligenceRetentionPolicy.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_RETENTION_POLICY,
    },
  });

  for (const source of DEFAULT_NEWS_SOURCES) {
    await prisma.newsSourceConfig.upsert({
      where: {
        userId_sourceId: {
          userId,
          sourceId: source.sourceId,
        },
      },
      update: {
        name: source.name,
        description: source.description,
        sourceUrl: source.sourceUrl,
        sourceTier: source.sourceTier,
        category: source.category,
        priority: source.priority,
      },
      create: {
        userId,
        ...source,
      },
    });
  }

  const sources = await prisma.newsSourceConfig.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });

  return { policy, sources };
}

export function retentionDaysForDecision(
  policy: {
    urgentRetentionDays: number;
    reviewRetentionDays: number;
    digestRetentionDays: number;
    watchRetentionDays: number;
  },
  decision: {
    importanceTier: string;
  }
) {
  if (decision.importanceTier === "URGENT_PORTFOLIO_ALERT") {
    return policy.urgentRetentionDays;
  }

  if (decision.importanceTier === "ADVISOR_REVIEW") {
    return policy.reviewRetentionDays;
  }

  if (decision.importanceTier === "INVESTOR_DIGEST") {
    return policy.digestRetentionDays;
  }

  return policy.watchRetentionDays;
}

export async function enforceStorageLimits(
  userId: string,
  policy: {
    maxRetainedDecisions: number;
    maxRetainedRuns: number;
    maxAlertEvents: number;
    readAlertRetentionDays: number;
  }
) {
  const now = new Date();

  const expiredDecisions = await prisma.headlineDecision.deleteMany({
    where: {
      userId,
      expiresAt: {
        lt: now,
      },
    },
  });

  const retainedDecisionCount = await prisma.headlineDecision.count({
    where: { userId },
  });

  let trimmedDecisions = 0;

  if (retainedDecisionCount > policy.maxRetainedDecisions) {
    const excess = retainedDecisionCount - policy.maxRetainedDecisions;

    const oldest = await prisma.headlineDecision.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: excess,
      select: { id: true },
    });

    const result = await prisma.headlineDecision.deleteMany({
      where: {
        id: {
          in: oldest.map((item) => item.id),
        },
      },
    });

    trimmedDecisions = result.count;
  }

  const runCount = await prisma.intelligenceRun.count({
    where: { userId },
  });

  let trimmedRuns = 0;

  if (runCount > policy.maxRetainedRuns) {
    const excess = runCount - policy.maxRetainedRuns;

    const oldestRuns = await prisma.intelligenceRun.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: excess,
      select: { id: true },
    });

    const result = await prisma.intelligenceRun.deleteMany({
      where: {
        id: {
          in: oldestRuns.map((run) => run.id),
        },
      },
    });

    trimmedRuns = result.count;
  }

  const readAlertCutoff = new Date(
    Date.now() - policy.readAlertRetentionDays * 24 * 60 * 60 * 1000
  );

  const oldReadAlerts = await prisma.alertEvent.deleteMany({
    where: {
      userId,
      status: "Read",
      readAt: {
        lt: readAlertCutoff,
      },
    },
  });

  const alertCount = await prisma.alertEvent.count({
    where: { userId },
  });

  let trimmedAlerts = 0;

  if (alertCount > policy.maxAlertEvents) {
    const excess = alertCount - policy.maxAlertEvents;

    const oldestAlerts = await prisma.alertEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: excess,
      select: { id: true },
    });

    const result = await prisma.alertEvent.deleteMany({
      where: {
        id: {
          in: oldestAlerts.map((alert) => alert.id),
        },
      },
    });

    trimmedAlerts = result.count;
  }

  return {
    expiredDecisions: expiredDecisions.count,
    trimmedDecisions,
    trimmedRuns,
    oldReadAlerts: oldReadAlerts.count,
    trimmedAlerts,
  };
}