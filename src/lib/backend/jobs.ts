import { prisma } from "@/lib/prisma";
import { BackendContext } from "@/lib/backend/config";
import {
  emitBackendEvent,
  finishBackendJobRun,
  recordDataQuality,
  startBackendJobRun,
} from "@/lib/backend/events";
import { fetchBackendQuote } from "@/lib/backend/market-data";
import { queueBackendDelivery, processQueuedDeliveries } from "@/lib/backend/notifications";
import { ensureBackendVendors } from "@/lib/backend/vendors";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

async function runWatchlistPriceCheck(context: BackendContext) {
  const alerts = await prisma.watchlistPriceAlert.findMany({
    where: {
      userId: context.userId,
      status: "Active",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100,
  });

  let checked = 0;
  let triggered = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const quote = await fetchBackendQuote(alert.symbol);

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
        where: {
          id: alert.id,
        },
        data: {
          lastProvider: quote.provider,
          lastCheckedAt: new Date(),
        },
      });

      continue;
    }

    checked += 1;

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

      updateData.triggeredHighAt = new Date();
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
        payload: {
          alertId: alert.id,
          symbol: alert.symbol,
          target: alert.lowerTargetPrice,
          observed: quote.price,
          triggerType: "Low",
        },
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

async function runDataQualitySweep(context: BackendContext) {
  const records = await prisma.backendDataQualityRecord.findMany({
    where: {
      userId: context.userId,
    },
    take: 100,
  });

  let stale = 0;
  const now = Date.now();

  for (const record of records) {
    const lastChecked = record.lastCheckedAt?.getTime() ?? 0;
    const ageHours = lastChecked ? (now - lastChecked) / (1000 * 60 * 60) : 999;

    if (ageHours > 24) {
      stale += 1;

      await prisma.backendDataQualityRecord.update({
        where: {
          id: record.id,
        },
        data: {
          freshnessStatus: "Stale",
          warning: "Record has not been checked in over 24 hours.",
          warningsJson: asJson(["Record has not been checked in over 24 hours."]),
          qualityScore: Math.min(record.qualityScore, 55),
        },
      });
    }
  }

  return {
    checked: records.length,
    stale,
  };
}

async function runAdvisorDay(context: BackendContext) {
  const [alerts, tasks, clients, drafts] = await Promise.all([
    prisma.alertEvent.findMany({
      where: {
        userId: context.userId,
        status: "Unread",
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.meetingTask.findMany({
      where: {
        userId: context.userId,
        status: {
          not: "Complete",
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.clientProfile.findMany({
      where: {
        userId: context.userId,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.personalUserBotEmailDraft.findMany({
      where: {
        userId: context.userId,
        status: "Draft",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const topActions = [
    ...alerts.map((alert) => ({
      type: "Alert",
      title: alert.title,
      score: alert.score,
      action: `Review source and exposure for ${alert.ticker ?? "alert"}.`,
    })),
    ...tasks.map((task) => ({
      type: "Task",
      title: task.title,
      score: task.priority === "High" ? 85 : 65,
      action: "Complete or reschedule task.",
    })),
    ...drafts.map((draft) => ({
      type: "Draft",
      title: draft.subject,
      score: 80,
      action: "Approve or revise client-facing communication draft.",
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const brief = await prisma.advisorDayBrief.create({
    data: {
      userId: context.userId,
      firmId: context.firmId,
      title: `Advisor Day · ${new Date().toLocaleDateString()}`,
      summary:
        topActions.length > 0
          ? `Generated ${topActions.length} priority action(s). Top action: ${topActions[0].title}.`
          : "No urgent actions found. Run scans or add client data to improve recommendations.",
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

  return {
    advisorDayBriefId: brief.id,
    actions: topActions.length,
  };
}

export async function runBackendJob(context: BackendContext, jobKey: string) {
  const job = await prisma.backendJobDefinition.findFirst({
    where: {
      userId: context.userId,
      jobKey,
    },
  });

  const jobName = job?.jobName ?? jobKey;
  const run = await startBackendJobRun(context, {
    jobKey,
    jobName,
  });

  try {
    let result: Record<string, unknown>;

    if (jobKey === "vendor_health") {
      await ensureBackendVendors(context);
      result = { status: "vendors_refreshed" };
    } else if (jobKey === "watchlist_price_check") {
      result = await runWatchlistPriceCheck(context);
    } else if (jobKey === "notification_delivery") {
      result = await processQueuedDeliveries(context);
    } else if (jobKey === "data_quality_sweep") {
      result = await runDataQualitySweep(context);
    } else if (jobKey === "advisor_day") {
      result = await runAdvisorDay(context);
    } else if (jobKey === "market_scan") {
      result = { status: "planned", detail: "Market scan provider integration is registered and ready for cron wiring." };
    } else if (jobKey === "news_scan") {
      result = { status: "planned", detail: "News scan provider integration is registered and ready for cron wiring." };
    } else {
      result = { status: "skipped", detail: `Unknown job key: ${jobKey}` };
    }

    await finishBackendJobRun(run.id, {
      status: "Complete",
      startedAt: run.startedAt,
      result,
    });

    await prisma.backendJobDefinition.updateMany({
      where: {
        userId: context.userId,
        jobKey,
      },
      data: {
        lastRunAt: new Date(),
        status: "Ready",
        lastResultJson: asJson(result),
      },
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed.";

    await finishBackendJobRun(run.id, {
      status: "Failed",
      startedAt: run.startedAt,
      error: message,
    });

    await prisma.backendJobDefinition.updateMany({
      where: {
        userId: context.userId,
        jobKey,
      },
      data: {
        lastRunAt: new Date(),
        status: "Failed",
        lastResultJson: asJson({ error: message }),
      },
    });

    throw error;
  }
}