import "server-only";

import { ApiError } from "@/lib/api-route";
import type { FirmPermission } from "@/lib/access-control";
import {
  enqueueBackgroundJob,
  type BackgroundJobRuntime,
  type EnqueueBackgroundJobResult,
} from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { emitBackendEvent, recordDataQuality } from "@/lib/backend/events";
import { processQueuedDeliveries, queueBackendDelivery } from "@/lib/backend/notifications";
import { ensureBackendVendors } from "@/lib/backend/vendors";
import { accessibleClientWhere } from "@/lib/client-access";
import {
  executeEmailAiGenerationJob,
  executeEmailDeliveryJob,
} from "@/lib/email-center/jobs";
import { executeDocumentProcessingJob } from "@/lib/document-center/jobs";
import { executeAdvisorBriefGenerationJob } from "@/lib/advisor-briefing/jobs";
import { executeWorkspaceWatchlistScanJob } from "@/lib/watchlists/jobs";
import {
  executeIntelligenceGraphRefreshJob,
} from "@/lib/intelligence/research-swarm-service";
import { fetchMarketQuote } from "@/lib/integrations/market";
import { prisma } from "@/lib/prisma";

export const SUPPORTED_BACKGROUND_JOB_KEYS = [
  "vendor_health",
  "watchlist_price_check",
  "notification_delivery",
  "data_quality_sweep",
  "advisor_day",
  "email_ai_generate",
  "email_delivery",
  "document_process",
  "intelligence_graph_refresh",
  "advisor_brief_generate",
  "workspace_watchlist_scan",
] as const;

export type SupportedBackgroundJobKey =
  (typeof SUPPORTED_BACKGROUND_JOB_KEYS)[number];

type JobDefinition = {
  name: string;
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
  permission: FirmPermission | null;
};

const JOB_DEFINITIONS: Record<SupportedBackgroundJobKey, JobDefinition> = {
  vendor_health: {
    name: "Vendor Health Check",
    timeoutMs: 30_000,
    maxAttempts: 3,
    backoffMs: 10_000,
    permission: "security.review",
  },
  watchlist_price_check: {
    name: "Watchlist Price Check",
    timeoutMs: 45_000,
    maxAttempts: 3,
    backoffMs: 15_000,
    permission: null,
  },
  notification_delivery: {
    name: "Notification Delivery",
    timeoutMs: 45_000,
    maxAttempts: 3,
    backoffMs: 10_000,
    permission: "security.review",
  },
  data_quality_sweep: {
    name: "Data Quality Sweep",
    timeoutMs: 30_000,
    maxAttempts: 2,
    backoffMs: 30_000,
    permission: "security.review",
  },
  advisor_day: {
    name: "Advisor Day",
    timeoutMs: 30_000,
    maxAttempts: 2,
    backoffMs: 30_000,
    permission: null,
  },
  email_ai_generate: {
    name: "AI Client Email Draft",
    timeoutMs: 210_000,
    maxAttempts: 3,
    backoffMs: 5_000,
    permission: "clients.manage",
  },
  email_delivery: {
    name: "Client Email Delivery",
    timeoutMs: 35_000,
    maxAttempts: 3,
    backoffMs: 30_000,
    permission: "clients.manage",
  },
  document_process: {
    name: "Secure Document Processing",
    timeoutMs: 40_000,
    maxAttempts: 2,
    backoffMs: 20_000,
    permission: "clients.manage",
  },
  intelligence_graph_refresh: {
    name: "Intelligence Knowledge Graph Refresh",
    timeoutMs: 80_000,
    maxAttempts: 2,
    backoffMs: 30_000,
    permission: null,
  },
  advisor_brief_generate: {
    name: "Advisor Market Brief Generation",
    timeoutMs: 180_000,
    maxAttempts: 2,
    backoffMs: 45_000,
    permission: null,
  },
  workspace_watchlist_scan: {
    name: "Advisor Watchlist Scan",
    timeoutMs: 120_000,
    maxAttempts: 2,
    backoffMs: 30_000,
    permission: null,
  },
};

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function asJson(value: unknown) {
  return JSON.stringify(value);
}

export function isSupportedBackgroundJobKey(
  value: string,
): value is SupportedBackgroundJobKey {
  return SUPPORTED_BACKGROUND_JOB_KEYS.includes(value as SupportedBackgroundJobKey);
}

export function backgroundJobDefinition(jobKey: SupportedBackgroundJobKey) {
  return JOB_DEFINITIONS[jobKey];
}

export function requiredPermissionForBackgroundJob(
  jobKey: SupportedBackgroundJobKey,
) {
  return JOB_DEFINITIONS[jobKey].permission;
}

export async function enqueueBackendJob(
  context: BackendContext,
  jobKey: SupportedBackgroundJobKey,
  options: {
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
    availableAt?: Date;
    maxAttempts?: number;
    timeoutMs?: number;
    backoffMs?: number;
  } = {},
): Promise<EnqueueBackgroundJobResult> {
  const definition = JOB_DEFINITIONS[jobKey];

  return enqueueBackgroundJob({
    context,
    jobKey,
    jobName: definition.name,
    payload: options.payload,
    idempotencyKey: options.idempotencyKey,
    availableAt: options.availableAt,
    maxAttempts: options.maxAttempts ?? definition.maxAttempts,
    timeoutMs: options.timeoutMs ?? definition.timeoutMs,
    backoffMs: options.backoffMs ?? definition.backoffMs,
  });
}

/**
 * Backward-compatible entrypoint used by existing bot and kernel code.
 * The operation now enqueues durable work instead of blocking the request.
 */
export async function runBackendJob(
  context: BackendContext,
  jobKey: string,
  options: {
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {},
) {
  if (!isSupportedBackgroundJobKey(jobKey)) {
    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_BACKGROUND_JOB",
      message: `Unsupported background job: ${jobKey}`,
      expose: true,
    });
  }

  const queued = await enqueueBackendJob(context, jobKey, options);

  return {
    queued: true,
    duplicate: queued.duplicate,
    jobId: queued.job.id,
    status: queued.job.status,
    jobKey: queued.job.jobKey,
    message: queued.duplicate
      ? "An equivalent background job is already queued or recorded."
      : "Background job queued.",
  };
}

async function runWatchlistPriceCheck(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const limit = clampInteger(runtime.payload.limit, 25, 1, 100);
  const alerts = await prisma.watchlistPriceAlert.findMany({
    where: {
      userId: context.userId,
      status: "Active",
    },
    orderBy: [
      {
        lastCheckedAt: {
          sort: "asc",
          nulls: "first",
        },
      },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  let checked = 0;
  let triggered = 0;
  let skipped = 0;

  for (let index = 0; index < alerts.length; index += 1) {
    await runtime.throwIfCancelled();

    const alert = alerts[index];
    const quote = await fetchMarketQuote(alert.symbol, {
      signal: runtime.signal,
    });

    await recordDataQuality(context, {
      entityType: "WatchlistPriceAlert",
      entityId: alert.id,
      sourceName: quote.provider,
      liveStatus: quote.isLive ? "Live" : "Unavailable",
      freshnessStatus: quote.isLive ? "Fresh" : "Missing",
      qualityScore: quote.isLive ? 85 : 35,
      fallbackUsed: !quote.isLive,
      warning: quote.note,
      asOfAt: new Date(),
    });

    if (!quote.isLive || quote.price === null) {
      skipped += 1;

      await prisma.watchlistPriceAlert.update({
        where: { id: alert.id },
        data: {
          lastProvider: quote.provider,
          lastCheckedAt: new Date(),
        },
      });

      await runtime.reportProgress(
        Math.round(((index + 1) / Math.max(1, alerts.length)) * 95),
        `Checked ${index + 1} of ${alerts.length} alerts`,
      );
      continue;
    }

    checked += 1;
    const highTriggered =
      alert.upperTargetPrice !== null &&
      quote.price >= alert.upperTargetPrice &&
      !alert.triggeredHighAt;
    const lowTriggered =
      alert.lowerTargetPrice !== null &&
      quote.price <= alert.lowerTargetPrice &&
      !alert.triggeredLowAt;
    let triggerCountIncrease = 0;
    const now = new Date();
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
      lastCheckedAt: now,
    };

    if (highTriggered && alert.upperTargetPrice !== null) {
      const body = `${alert.symbol} traded at $${quote.price}, above the high target of $${alert.upperTargetPrice}.`;

      await prisma.watchlistPriceAlertEvent.create({
        data: {
          userId: context.userId,
          alertId: alert.id,
          symbol: alert.symbol,
          triggerType: "High",
          targetPrice: alert.upperTargetPrice,
          observedPrice: quote.price,
          provider: quote.provider,
          message: body,
        },
      });

      await queueBackendDelivery(context, {
        channel: alert.notificationChannel,
        destination: context.actorEmail ?? "Dashboard",
        title: `${alert.symbol} High Price Alert`,
        body,
        provider: quote.provider,
        urgency: "High",
        score: 92,
        idempotencyKey: `watchlist-price:${alert.id}:High:${alert.upperTargetPrice}`,
        payload: {
          alertId: alert.id,
          symbol: alert.symbol,
          target: alert.upperTargetPrice,
          observed: quote.price,
          triggerType: "High",
        },
      });

      await prisma.alertEvent.upsert({
        where: {
          userId_dedupeKey: {
            userId: context.userId,
            dedupeKey: `watchlist-price:${alert.id}:High:${alert.upperTargetPrice}`,
          },
        },
        update: {
          title: `${alert.symbol} High Price Alert`,
          body,
          source: "Watchlist Price Alert",
          ticker: alert.symbol,
          urgency: "High",
          score: 92,
          status: "Unread",
          aiBriefing: body,
        },
        create: {
          userId: context.userId,
          dedupeKey: `watchlist-price:${alert.id}:High:${alert.upperTargetPrice}`,
          title: `${alert.symbol} High Price Alert`,
          body,
          source: "Watchlist Price Alert",
          ticker: alert.symbol,
          urgency: "High",
          score: 92,
          status: "Unread",
          channel: alert.notificationChannel,
          aiBriefing: body,
        },
      });

      updateData.triggeredHighAt = now;
      triggerCountIncrease += 1;
      triggered += 1;
    }

    if (lowTriggered && alert.lowerTargetPrice !== null) {
      const body = `${alert.symbol} traded at $${quote.price}, below the low target of $${alert.lowerTargetPrice}.`;

      await prisma.watchlistPriceAlertEvent.create({
        data: {
          userId: context.userId,
          alertId: alert.id,
          symbol: alert.symbol,
          triggerType: "Low",
          targetPrice: alert.lowerTargetPrice,
          observedPrice: quote.price,
          provider: quote.provider,
          message: body,
        },
      });

      await queueBackendDelivery(context, {
        channel: alert.notificationChannel,
        destination: context.actorEmail ?? "Dashboard",
        title: `${alert.symbol} Low Price Alert`,
        body,
        provider: quote.provider,
        urgency: "High",
        score: 92,
        idempotencyKey: `watchlist-price:${alert.id}:Low:${alert.lowerTargetPrice}`,
        payload: {
          alertId: alert.id,
          symbol: alert.symbol,
          target: alert.lowerTargetPrice,
          observed: quote.price,
          triggerType: "Low",
        },
      });

      updateData.triggeredLowAt = now;
      triggerCountIncrease += 1;
      triggered += 1;
    }

    const highComplete =
      alert.upperTargetPrice === null || Boolean(alert.triggeredHighAt || updateData.triggeredHighAt);
    const lowComplete =
      alert.lowerTargetPrice === null || Boolean(alert.triggeredLowAt || updateData.triggeredLowAt);

    if (highComplete && lowComplete && (highTriggered || lowTriggered)) {
      updateData.status = "Triggered";
    }

    if (triggerCountIncrease) {
      updateData.triggerCount = alert.triggerCount + triggerCountIncrease;
    }

    await prisma.watchlistPriceAlert.update({
      where: { id: alert.id },
      data: updateData,
    });

    await runtime.reportProgress(
      Math.round(((index + 1) / Math.max(1, alerts.length)) * 95),
      `Checked ${index + 1} of ${alerts.length} alerts`,
    );
  }

  await emitBackendEvent(context, {
    eventType: "job.watchlist_price_check",
    area: "Market Data",
    title: "Watchlist price check completed",
    detail: `Checked ${checked}, triggered ${triggered}, skipped ${skipped}.`,
    metadata: {
      checked,
      triggered,
      skipped,
      total: alerts.length,
    },
  });

  return {
    total: alerts.length,
    checked,
    triggered,
    skipped,
  };
}

async function runDataQualitySweep(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  const limit = clampInteger(runtime.payload.limit, 100, 1, 500);
  const records = await prisma.backendDataQualityRecord.findMany({
    where: {
      userId: context.userId,
      firmId: context.firmId,
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: limit,
  });
  let stale = 0;
  const now = Date.now();

  for (let index = 0; index < records.length; index += 1) {
    await runtime.throwIfCancelled();

    const record = records[index];
    const lastChecked = record.lastCheckedAt?.getTime() ?? 0;
    const ageHours = lastChecked ? (now - lastChecked) / 3_600_000 : 999;

    if (ageHours > 24) {
      stale += 1;

      await prisma.backendDataQualityRecord.update({
        where: { id: record.id },
        data: {
          freshnessStatus: "Stale",
          warning: "Record has not been checked in over 24 hours.",
          warningsJson: asJson(["Record has not been checked in over 24 hours."]),
          qualityScore: Math.min(record.qualityScore, 55),
        },
      });
    }

    if (index % 10 === 0 || index === records.length - 1) {
      await runtime.reportProgress(
        Math.round(((index + 1) / Math.max(1, records.length)) * 95),
        `Reviewed ${index + 1} of ${records.length} quality records`,
      );
    }
  }

  return {
    checked: records.length,
    stale,
  };
}

async function runAdvisorDay(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
) {
  await runtime.reportProgress(10, "Loading advisor priorities");

  const clientAccess = await accessibleClientWhere(context.userId);
  const [alerts, tasks, clients, drafts] = await Promise.all([
    prisma.alertEvent.findMany({
      where: {
        userId: context.userId,
        status: "Unread",
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        ticker: true,
        score: true,
      },
    }),
    prisma.meetingTask.findMany({
      where: {
        userId: context.userId,
        status: {
          notIn: ["Complete", "Done"],
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        priority: true,
      },
    }),
    prisma.clientProfile.findMany({
      where: clientAccess.where,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        status: true,
      },
    }),
    prisma.personalUserBotEmailDraft.findMany({
      where: {
        userId: context.userId,
        firmId: context.firmId,
        status: "Draft",
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        subject: true,
      },
    }),
  ]);

  await runtime.throwIfCancelled();
  await runtime.reportProgress(65, "Ranking next-best actions");

  type AdvisorDayAlert = {
    id: string;
    title: string;
    score: number;
    ticker: string | null;
  };
  type AdvisorDayTask = {
    id: string;
    title: string;
    priority: string;
  };
  type AdvisorDayDraft = {
    id: string;
    subject: string;
  };

  const topActions = [
    ...alerts.map((alert: AdvisorDayAlert) => ({
      type: "Alert",
      id: alert.id,
      title: alert.title,
      score: alert.score,
      action: `Review source and exposure for ${alert.ticker ?? "alert"}.`,
    })),
    ...tasks.map((task: AdvisorDayTask) => ({
      type: "Task",
      id: task.id,
      title: task.title,
      score: task.priority === "High" ? 85 : 65,
      action: "Complete or reschedule task.",
    })),
    ...drafts.map((draft: AdvisorDayDraft) => ({
      type: "Draft",
      id: draft.id,
      title: draft.subject,
      score: 80,
      action: "Approve or revise the communication draft.",
    })),
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const brief = await prisma.advisorDayBrief.create({
    data: {
      userId: context.userId,
      firmId: context.firmId,
      title: `Advisor Day · ${new Date().toLocaleDateString("en-US")}`,
      summary:
        topActions.length > 0
          ? `Generated ${topActions.length} priority action(s). Top action: ${topActions[0].title}.`
          : "No urgent actions found. Add client data or run intelligence scans to improve recommendations.",
      topActionsJson: asJson(topActions),
      metricsJson: asJson({
        alerts: alerts.length,
        tasks: tasks.length,
        clients: clients.length,
        drafts: drafts.length,
      }),
      status: "Generated",
    },
  });

  await runtime.reportProgress(95, "Advisor Day brief created");

  return {
    advisorDayBriefId: brief.id,
    actions: topActions.length,
    clientSampleCount: clients.length,
  };
}

export async function executeBackendJob(
  context: BackendContext,
  jobKey: string,
  runtime: BackgroundJobRuntime,
): Promise<Record<string, unknown>> {
  if (!isSupportedBackgroundJobKey(jobKey)) {
    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_BACKGROUND_JOB",
      message: `Unsupported background job: ${jobKey}`,
      expose: false,
    });
  }

  await runtime.throwIfCancelled();

  if (jobKey === "vendor_health") {
    await runtime.reportProgress(10, "Checking provider configuration");
    await ensureBackendVendors(context);
    await runtime.reportProgress(95, "Provider registry refreshed");
    return { status: "vendors_refreshed" };
  }

  if (jobKey === "watchlist_price_check") {
    return runWatchlistPriceCheck(context, runtime);
  }

  if (jobKey === "notification_delivery") {
    return processQueuedDeliveries(context, {
      limit: clampInteger(runtime.payload.limit, 50, 1, 100),
      runtime,
    });
  }

  if (jobKey === "email_ai_generate") {
    return executeEmailAiGenerationJob(context, runtime);
  }

  if (jobKey === "email_delivery") {
    return executeEmailDeliveryJob(context, runtime);
  }

  if (jobKey === "document_process") {
    return executeDocumentProcessingJob(context, runtime);
  }

  if (jobKey === "intelligence_graph_refresh") {
    return executeIntelligenceGraphRefreshJob(context, runtime);
  }

  if (jobKey === "advisor_brief_generate") {
    return executeAdvisorBriefGenerationJob(context, runtime);
  }

  if (jobKey === "workspace_watchlist_scan") {
    return executeWorkspaceWatchlistScanJob(context, runtime);
  }

  if (jobKey === "data_quality_sweep") {
    return runDataQualitySweep(context, runtime);
  }

  return runAdvisorDay(context, runtime);
}