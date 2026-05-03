import { prisma } from "@/lib/prisma";

type AlertEventLite = {
  id: string;
  userId: string;
  title: string;
  body: string;
  source: string;
  ticker: string | null;
  urgency: string;
  score: number;
  channel: string;
  status: string;
  createdAt: Date;
};

type NotificationPreferenceLite = {
  id: string;
  userId: string;
  channel: string;
  enabled: boolean;
  minUrgency: string;
  minScore: number;
  digestOnly: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  cooldownMinutes: number;
};

const DEFAULT_NOTIFICATION_PREFERENCES = [
  {
    channel: "Dashboard",
    enabled: true,
    minUrgency: "Low",
    minScore: 0,
    digestOnly: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    cooldownMinutes: 0,
  },
  {
    channel: "Email",
    enabled: true,
    minUrgency: "High",
    minScore: 75,
    digestOnly: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 30,
  },
  {
    channel: "SMS",
    enabled: true,
    minUrgency: "Critical",
    minScore: 88,
    digestOnly: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 60,
  },
  {
    channel: "Push",
    enabled: true,
    minUrgency: "High",
    minScore: 80,
    digestOnly: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 30,
  },
  {
    channel: "Digest",
    enabled: true,
    minUrgency: "Medium",
    minScore: 55,
    digestOnly: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    cooldownMinutes: 0,
  },
];

function urgencyRank(urgency: string) {
  const normalized = urgency.toLowerCase();

  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;

  return 0;
}

function isWithinQuietHours(
  quietHoursStart: string | null,
  quietHoursEnd: string | null
) {
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMinute] = quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

async function hasCooldownConflict(
  userId: string,
  channel: string,
  cooldownMinutes: number
) {
  if (cooldownMinutes <= 0) {
    return false;
  }

  const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);

  const recent = await prisma.notificationDelivery.findFirst({
    where: {
      userId,
      channel,
      status: {
        in: ["Queued", "Delivered"],
      },
      createdAt: {
        gt: cutoff,
      },
    },
  });

  return Boolean(recent);
}

function shouldDeliverToChannel(
  alert: AlertEventLite,
  preference: NotificationPreferenceLite
) {
  if (!preference.enabled) {
    return {
      allowed: false,
      reason: "Channel disabled.",
    };
  }

  if (preference.digestOnly) {
    return {
      allowed: false,
      reason: "Digest-only channel.",
    };
  }

  if (alert.score < preference.minScore) {
    return {
      allowed: false,
      reason: `Alert score ${alert.score} is below channel threshold ${preference.minScore}.`,
    };
  }

  if (urgencyRank(alert.urgency) < urgencyRank(preference.minUrgency)) {
    return {
      allowed: false,
      reason: `Urgency ${alert.urgency} is below channel minimum ${preference.minUrgency}.`,
    };
  }

  if (
    preference.channel !== "Dashboard" &&
    isWithinQuietHours(preference.quietHoursStart, preference.quietHoursEnd)
  ) {
    return {
      allowed: false,
      reason: "Quiet hours active.",
    };
  }

  return {
    allowed: true,
    reason: "Passed delivery rules.",
  };
}

export async function ensureNotificationPreferences(userId: string) {
  for (const preference of DEFAULT_NOTIFICATION_PREFERENCES) {
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
    },
    orderBy: {
      channel: "asc",
    },
  });
}

export async function queueNotificationDeliveries(userId: string) {
  const preferences = await ensureNotificationPreferences(userId);

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

      const rule = shouldDeliverToChannel(alert, preference);

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

      const cooldownConflict = await hasCooldownConflict(
        userId,
        preference.channel,
        preference.cooldownMinutes
      );

      if (cooldownConflict && preference.channel !== "Dashboard") {
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
            reason: "Cooldown active for this channel.",
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

  await prisma.notificationDelivery.updateMany({
    where: {
      id: {
        in: queued.map((item) => item.id),
      },
      userId,
    },
    data: {
      status: "Delivered",
      deliveredAt: new Date(),
    },
  });

  return {
    processed: queued.length,
  };
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
      reason: "Generated from recent alert events.",
      deliveredAt: new Date(),
    },
  });

  return {
    digest,
    itemCount: alerts.length,
  };
}