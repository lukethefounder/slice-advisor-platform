import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureNotificationPreferences,
  generateInvestorDigest,
  processQueuedDeliveries,
  queueNotificationDeliveries,
} from "@/lib/notification-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NotificationPostBody = {
  action?:
    | "queue"
    | "process"
    | "digest"
    | "archiveDelivery"
    | "archiveDeliveries"
    | "markReviewed"
    | "retryDelivery"
    | "retryDeliveries";
  deliveryId?: string;
  deliveryIds?: string[];
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function cleanId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => cleanId(item))
        .filter(Boolean)
    )
  ).slice(0, 100);
}

async function loadNotificationCenter(userId: string) {
  const [preferences, deliveries, digests] = await Promise.all([
    ensureNotificationPreferences(userId),
    prisma.notificationDelivery.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 160,
    }),
    prisma.digestReport.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 40,
    }),
  ]);

  const metrics = {
    totalDeliveries: deliveries.length,
    delivered: deliveries.filter((item) => item.status === "Delivered").length,
    queued: deliveries.filter((item) => item.status === "Queued").length,
    failed: deliveries.filter((item) => item.status === "Failed").length,
    suppressed: deliveries.filter((item) => item.status === "Suppressed").length,
    reviewed: deliveries.filter((item) => item.status === "Reviewed").length,
    archived: deliveries.filter((item) => item.status === "Archived").length,
    critical: deliveries.filter((item) => item.urgency === "Critical").length,
    high: deliveries.filter((item) => item.urgency === "High").length,
    email: deliveries.filter((item) => item.channel === "Email").length,
    dashboard: deliveries.filter((item) => item.channel === "Dashboard").length,
    digests: digests.length,
    activeChannels: preferences.filter((item) => item.enabled).length,
  };

  return {
    preferences,
    deliveries,
    digests,
    metrics,
  };
}

async function requireOwnedDelivery(input: {
  userId: string;
  deliveryId: string;
}) {
  if (!input.deliveryId) return null;

  return prisma.notificationDelivery.findFirst({
    where: {
      id: input.deliveryId,
      userId: input.userId,
    },
  });
}

async function updateDeliveries(input: {
  userId: string;
  deliveryIds: string[];
  status: string;
  deliveredAt?: Date | null;
}) {
  if (!input.deliveryIds.length) {
    return {
      count: 0,
      message: "No deliveries selected.",
    };
  }

  const result = await prisma.notificationDelivery.updateMany({
    where: {
      userId: input.userId,
      id: {
        in: input.deliveryIds,
      },
    },
    data: {
      status: input.status,
      deliveredAt: input.deliveredAt,
    },
  });

  return result;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  return noStoreJson(await loadNotificationCenter(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as NotificationPostBody;
  const action = body.action;

  if (action === "queue") {
    const result = await queueNotificationDeliveries(user.id);
    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "process") {
    const result = await processQueuedDeliveries(user.id);
    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "digest") {
    const result = await generateInvestorDigest(user.id);
    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "archiveDelivery") {
    const deliveryId = cleanId(body.deliveryId);
    const delivery = await requireOwnedDelivery({
      userId: user.id,
      deliveryId,
    });

    if (!delivery) {
      return noStoreJson({ error: "Delivery not found." }, { status: 404 });
    }

    await prisma.notificationDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "Archived",
      },
    });

    return noStoreJson({
      result: {
        status: "Archived",
        deliveryId,
      },
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "archiveDeliveries") {
    const deliveryIds = cleanIds(body.deliveryIds);

    const result = await updateDeliveries({
      userId: user.id,
      deliveryIds,
      status: "Archived",
    });

    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "markReviewed") {
    const deliveryIds = cleanIds(body.deliveryIds).length
      ? cleanIds(body.deliveryIds)
      : [cleanId(body.deliveryId)].filter(Boolean);

    const result = await updateDeliveries({
      userId: user.id,
      deliveryIds,
      status: "Reviewed",
    });

    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "retryDelivery") {
    const deliveryId = cleanId(body.deliveryId);
    const delivery = await requireOwnedDelivery({
      userId: user.id,
      deliveryId,
    });

    if (!delivery) {
      return noStoreJson({ error: "Delivery not found." }, { status: 404 });
    }

    await prisma.notificationDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "Queued",
        deliveredAt: null,
      },
    });

    return noStoreJson({
      result: {
        status: "Queued",
        deliveryId,
      },
      center: await loadNotificationCenter(user.id),
    });
  }

  if (action === "retryDeliveries") {
    const deliveryIds = cleanIds(body.deliveryIds);

    const result = await updateDeliveries({
      userId: user.id,
      deliveryIds,
      status: "Queued",
      deliveredAt: null,
    });

    return noStoreJson({
      result,
      center: await loadNotificationCenter(user.id),
    });
  }

  return noStoreJson(
    {
      error: "Unknown notification action.",
      supportedActions: [
        "queue",
        "process",
        "digest",
        "archiveDelivery",
        "archiveDeliveries",
        "markReviewed",
        "retryDelivery",
        "retryDeliveries",
      ],
    },
    { status: 400 }
  );
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureNotificationPreferences(user.id);

  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
    enabled?: boolean;
    minUrgency?: string;
    minScore?: number;
    digestOnly?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes?: number;
  };

  if (!body.channel) {
    return noStoreJson({ error: "Channel is required." }, { status: 400 });
  }

  const preference = await prisma.notificationPreference.update({
    where: {
      userId_channel: {
        userId: user.id,
        channel: body.channel,
      },
    },
    data: {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      minUrgency:
        typeof body.minUrgency === "string" ? body.minUrgency : undefined,
      minScore: typeof body.minScore === "number" ? body.minScore : undefined,
      digestOnly:
        typeof body.digestOnly === "boolean" ? body.digestOnly : undefined,
      quietHoursStart:
        typeof body.quietHoursStart === "string" || body.quietHoursStart === null
          ? body.quietHoursStart
          : undefined,
      quietHoursEnd:
        typeof body.quietHoursEnd === "string" || body.quietHoursEnd === null
          ? body.quietHoursEnd
          : undefined,
      cooldownMinutes:
        typeof body.cooldownMinutes === "number"
          ? body.cooldownMinutes
          : undefined,
    },
  });

  return noStoreJson({
    preference,
    center: await loadNotificationCenter(user.id),
  });
}