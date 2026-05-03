import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureNotificationPreferences,
  generateInvestorDigest,
  processQueuedDeliveries,
  queueNotificationDeliveries,
} from "@/lib/notification-engine";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [preferences, deliveries, digests] = await Promise.all([
    ensureNotificationPreferences(user.id),
    prisma.notificationDelivery.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 120,
    }),
    prisma.digestReport.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    preferences,
    deliveries,
    digests,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: "queue" | "process" | "digest";
  };

  if (body.action === "queue") {
    const result = await queueNotificationDeliveries(user.id);
    return NextResponse.json({ result });
  }

  if (body.action === "process") {
    const result = await processQueuedDeliveries(user.id);
    return NextResponse.json({ result });
  }

  if (body.action === "digest") {
    const result = await generateInvestorDigest(user.id);
    return NextResponse.json({ result });
  }

  return NextResponse.json(
    { error: "Unknown notification action." },
    { status: 400 }
  );
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureNotificationPreferences(user.id);

  const body = (await request.json()) as {
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
    return NextResponse.json(
      { error: "Channel is required." },
      { status: 400 }
    );
  }

  const preference = await prisma.notificationPreference.update({
    where: {
      userId_channel: {
        userId: user.id,
        channel: body.channel,
      },
    },
    data: {
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : undefined,
      minUrgency:
        typeof body.minUrgency === "string" ? body.minUrgency : undefined,
      minScore:
        typeof body.minScore === "number" ? body.minScore : undefined,
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

  return NextResponse.json({ preference });
}