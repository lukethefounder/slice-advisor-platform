import { prisma } from "@/lib/prisma";

import { DEFAULT_NOTIFICATIONS, readAccountPreferences } from "@/lib/account-settings/contracts";
import { notificationRuleDecision, urgencyRank, type DeliveryPreference } from "@/lib/account-settings/notification-policy";

async function accountTimezone(userId: string) {
  const memory = await prisma.personalUserBotMemory.findUnique({
    where: { userId_memoryKey: { userId, memoryKey: "account.settings" } }, select: { value: true },
  });
  return readAccountPreferences(memory?.value).timezone;
}

/** Actual email delivery and the preview queue use the same saved rules. Simulations never throttle real sends. */
export async function evaluateAccountNotificationDelivery(input: {
  userId: string; score: number; urgency: string; preference: DeliveryPreference;
  timezone?: string; now?: Date; includeSimulated?: boolean;
}) {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? await accountTimezone(input.userId);
  const decision = notificationRuleDecision(input, input.preference, timezone, now);
  if (!decision.allowed || input.preference.channel === "Dashboard" || input.preference.cooldownMinutes <= 0) return decision;
  const recent = await prisma.notificationDelivery.findFirst({
    where: {
      userId: input.userId, channel: input.preference.channel,
      ...(input.includeSimulated ? {} : { simulated: false }),
      status: { in: ["Queued", "Delivered"] },
      createdAt: { gt: new Date(now.getTime() - input.preference.cooldownMinutes * 60_000) },
    }, select: { id: true },
  });
  return recent ? { allowed: false, reason: "Cooldown active for this channel." } : decision;
}

export async function ensureNotificationPreferences(userId: string) {
  for (const preference of DEFAULT_NOTIFICATIONS) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_channel: {
          userId,
          channel: preference.channel,
        },
      },
      update: {},
      create: {
        userId,
        ...preference,
      },
    });
  }

  return prisma.notificationPreference.findMany({
    where: {
      userId,
      channel: { in: DEFAULT_NOTIFICATIONS.map(preference => preference.channel) },
    },
    orderBy: {
      channel: "asc",
    },
  });
}

export async function queueNotificationDeliveries(userId: string) {
  const [preferences, timezone] = await Promise.all([ensureNotificationPreferences(userId), accountTimezone(userId)]);

  const alerts = await prisma.alertEvent.findMany({
    where: {
      userId,
      status: "Unread",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  let queued = 0;
  let suppressed = 0;
  let skippedExisting = 0;

  for (const alert of alerts) {
    for (const preference of preferences) {
      if (preference.channel === "Digest") {
        continue;
      }

      const existing = await prisma.notificationDelivery.findFirst({
        where: {
          userId,
          alertEventId: alert.id,
          channel: preference.channel,
        },
      });

      if (existing) {
        skippedExisting += 1;
        continue;
      }

      const rule = await evaluateAccountNotificationDelivery({ userId, score: alert.score, urgency: alert.urgency, preference, timezone, includeSimulated: true });

      if (!rule.allowed) {
        await prisma.notificationDelivery.create({
          data: {
            userId,
            alertEventId: alert.id,
            channel: preference.channel,
            status: "Suppressed",
            urgency: alert.urgency,
            score: alert.score,
            title: alert.title,
            body: alert.body,
            reason: rule.reason,
          },
        });

        suppressed += 1;
        continue;
      }

      await prisma.notificationDelivery.create({
        data: {
          userId,
          alertEventId: alert.id,
          channel: preference.channel,
          status: preference.channel === "Dashboard" ? "Delivered" : "Queued",
          simulated: preference.channel !== "Dashboard",
          urgency: alert.urgency,
          score: alert.score,
          title: alert.title,
          body: alert.body,
          reason: rule.reason,
          deliveredAt: preference.channel === "Dashboard" ? new Date() : null,
        },
      });

      queued += 1;
    }
  }

  return {
    scannedAlerts: alerts.length,
    queued,
    suppressed,
    skippedExisting,
  };
}

export async function processQueuedDeliveries(userId: string) {
  const queued = await prisma.notificationDelivery.findMany({
    where: {
      userId,
      status: "Queued",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });

  const inApp = queued.filter(item => item.channel === "Dashboard");
  const simulations = queued.filter(item => item.channel !== "Dashboard" && item.simulated);
  if (inApp.length) await prisma.notificationDelivery.updateMany({
    where: { id: { in: inApp.map(item => item.id) }, userId, status: "Queued" },
    data: { status: "Delivered", simulated: false, deliveredAt: new Date() },
  });
  if (simulations.length) await prisma.notificationDelivery.updateMany({
    where: { id: { in: simulations.map(item => item.id) }, userId, status: "Queued", simulated: true },
    data: { status: "Simulated", deliveredAt: null, reason: "Delivery simulation only. No external provider was contacted." },
  });
  // This processor has no external provider handoff. Real pending deliveries must not be falsely marked delivered.
  return { processed: inApp.length + simulations.length, simulated: simulations.length, pendingProvider: queued.length - inApp.length - simulations.length };
}

export async function generateInvestorDigest(userId: string) {
  await ensureNotificationPreferences(userId);

  const digestPreference = await prisma.notificationPreference.findFirst({
    where: {
      userId,
      channel: "Digest",
      enabled: true,
    },
  });

  if (!digestPreference) {
    return {
      digest: null,
      reason: "Digest channel disabled.",
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const alerts = await prisma.alertEvent.findMany({
    where: {
      userId,
      createdAt: {
        gt: since,
      },
      score: {
        gte: digestPreference.minScore,
      },
      urgency: { in: ["Low", "Medium", "High", "Critical"].filter(value => urgencyRank(value) >= urgencyRank(digestPreference.minUrgency)) },
    },
    orderBy: [
      {
        score: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: 25,
  });

  const urgencyMix = alerts.reduce<Record<string, number>>((acc, alert) => {
    acc[alert.urgency] = (acc[alert.urgency] ?? 0) + 1;
    return acc;
  }, {});

  const items = alerts.map((alert) => ({
    title: alert.title,
    source: alert.source,
    ticker: alert.ticker,
    urgency: alert.urgency,
    score: alert.score,
  }));

  const digest = await prisma.digestReport.create({
    data: {
      userId,
      title: "Slice Daily Intelligence Digest",
      summary:
        alerts.length > 0
          ? `Slice found ${alerts.length} notable alert items from the last 24 hours.`
          : "No notable alert items cleared digest thresholds in the last 24 hours.",
      itemCount: alerts.length,
      urgencyMixJson: JSON.stringify(urgencyMix),
      itemsJson: JSON.stringify(items),
      status: "Generated",
    },
  });

  await prisma.notificationDelivery.create({
    data: {
      userId,
      alertEventId: null,
      channel: "Digest",
      status: "Delivered",
      urgency: alerts.some((alert) => alert.urgency === "Critical")
        ? "Critical"
        : alerts.some((alert) => alert.urgency === "High")
          ? "High"
          : "Medium",
      score: alerts[0]?.score ?? 0,
      title: digest.title,
      body: digest.summary,
      simulated: false,
      reason: "Generated in-app from recent alert events. No external delivery was attempted.",
      deliveredAt: new Date(),
    },
  });

  return {
    digest,
    itemCount: alerts.length,
  };
}
