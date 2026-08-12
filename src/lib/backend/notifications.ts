import "server-only";

import { createHash } from "node:crypto";

import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { emitBackendEvent } from "@/lib/backend/events";
import { sendEmail } from "@/lib/integrations/email";
import { sendSms } from "@/lib/integrations/sms";
import { prisma } from "@/lib/prisma";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

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

function safeFailure(value: unknown) {
  return String(value ?? "Delivery failed.")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000) || "Delivery failed.";
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function deliveryEventKey(context: BackendContext, idempotencyKey: string) {
  const digest = createHash("sha256")
    .update(
      [
        context.userId,
        context.firmId ?? "personal",
        idempotencyKey.trim(),
      ].join(":"),
    )
    .digest("hex");

  return `outbound-delivery:${digest}`;
}

export async function queueBackendDelivery(
  context: BackendContext,
  input: {
    channel: string;
    destination?: string | null;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    provider?: string | null;
    urgency?: string;
    score?: number;
    approvalRequired?: boolean;
    idempotencyKey?: string;
  },
) {
  const idempotencyKey = String(input.idempotencyKey ?? "").trim().slice(0, 500);
  const eventKey = idempotencyKey ? deliveryEventKey(context, idempotencyKey) : null;

  try {
    const delivery = await prisma.$transaction(async (transaction) => {
      const created = await transaction.backendOutboundDelivery.create({
        data: {
          userId: context.userId,
          firmId: context.firmId,
          channel: input.channel,
          destination: input.destination,
          title: input.title.trim().slice(0, 240),
          body: input.body.replace(/\u0000/g, "").trim().slice(0, 120_000),
          payloadJson: asJson(input.payload ?? {}),
          provider: input.provider,
          urgency: input.urgency ?? "Medium",
          score: clampInteger(input.score, 50, 0, 100),
          approvalRequired: input.approvalRequired ?? false,
          status: input.approvalRequired ? "Needs Approval" : "Queued",
        },
      });

      if (eventKey) {
        await transaction.backendPlatformEvent.create({
          data: {
            userId: context.userId,
            firmId: context.firmId,
            eventKey,
            eventType: "delivery.idempotency",
            area: "Notifications",
            actorName: context.actorName,
            title: `Delivery registered: ${created.title}`,
            detail: "An outbound delivery was registered with duplicate protection.",
            severity: "Info",
            status: created.status,
            sourceType: "BackendOutboundDelivery",
            sourceId: created.id,
            metadataJson: JSON.stringify({
              channel: created.channel,
              urgency: created.urgency,
              approvalRequired: created.approvalRequired,
            }),
          },
        });
      }

      return created;
    });

    await emitBackendEvent(context, {
      eventKey: `delivery-queued:${delivery.id}`,
      eventType: "delivery.queued",
      area: "Notifications",
      title: `Delivery queued: ${delivery.title}`,
      detail: "An outbound delivery record was added to the queue.",
      sourceType: "BackendOutboundDelivery",
      sourceId: delivery.id,
      metadata: {
        channel: delivery.channel,
        urgency: delivery.urgency,
        score: delivery.score,
        approvalRequired: delivery.approvalRequired,
      },
    });

    return delivery;
  } catch (error) {
    if (!eventKey || !isUniqueConstraintError(error)) throw error;

    const event = await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId: context.userId,
          eventKey,
        },
      },
      select: {
        sourceId: true,
      },
    });

    const existing = event?.sourceId
      ? await prisma.backendOutboundDelivery.findFirst({
          where: {
            id: event.sourceId,
            userId: context.userId,
            firmId: context.firmId,
          },
        })
      : null;

    if (existing) return existing;
    throw error;
  }
}

async function claimNextDelivery(context: BackendContext) {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "BackendOutboundDelivery"
      WHERE "userId" = ${context.userId}
        AND "firmId" IS NOT DISTINCT FROM ${context.firmId}
        AND "status" = 'Queued'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const candidate = rows[0];

    if (!candidate) return null;

    const delivery = await transaction.backendOutboundDelivery.findUnique({
      where: { id: candidate.id },
    });

    if (!delivery) return null;

    if (delivery.approvalRequired && !delivery.approvedAt) {
      await transaction.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: { status: "Needs Approval" },
      });
      return null;
    }

    return transaction.backendOutboundDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "Processing",
        failureReason: null,
      },
    });
  });
}

async function finishDelivery(input: {
  id: string;
  status: "Sent" | "Failed";
  provider: string;
  failureReason?: string | null;
}) {
  return prisma.backendOutboundDelivery.update({
    where: { id: input.id },
    data: {
      status: input.status,
      sentAt: input.status === "Sent" ? new Date() : null,
      provider: input.provider,
      failureReason: input.failureReason ? safeFailure(input.failureReason) : null,
    },
  });
}

async function processDelivery(
  context: BackendContext,
  delivery: NonNullable<Awaited<ReturnType<typeof claimNextDelivery>>>,
) {
  const payload = parseJson<Record<string, unknown>>(delivery.payloadJson, {});

  if (delivery.channel === "Dashboard") {
    await prisma.$transaction([
      prisma.notificationDelivery.create({
        data: {
          userId: context.userId,
          channel: "Dashboard",
          destination: delivery.destination ?? "Dashboard",
          status: "Queued",
          urgency: delivery.urgency,
          score: delivery.score,
          title: delivery.title,
          body: delivery.body,
          reason: `Backend outbound delivery:${delivery.id}`,
          simulated: true,
        },
      }),
      prisma.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "Sent",
          sentAt: new Date(),
          provider: "Dashboard",
          failureReason: null,
        },
      }),
    ]);

    return { ok: true, provider: "Dashboard" };
  }

  if (delivery.channel === "Email") {
    if (!delivery.destination) {
      await finishDelivery({
        id: delivery.id,
        status: "Failed",
        provider: "Resend",
        failureReason: "Email destination is missing.",
      });
      return { ok: false, provider: "Resend" };
    }

    const result = await sendEmail({
      to: delivery.destination,
      subject: delivery.title,
      text: delivery.body,
      html: typeof payload.html === "string" ? payload.html : undefined,
      idempotencyKey: delivery.id,
    });

    await finishDelivery({
      id: delivery.id,
      status: result.ok ? "Sent" : "Failed",
      provider: result.provider,
      failureReason: result.error,
    });

    return { ok: result.ok, provider: result.provider };
  }

  if (delivery.channel === "Text" || delivery.channel === "SMS") {
    if (!delivery.destination) {
      await finishDelivery({
        id: delivery.id,
        status: "Failed",
        provider: "Twilio",
        failureReason: "SMS destination is missing.",
      });
      return { ok: false, provider: "Twilio" };
    }

    const result = await sendSms({
      to: delivery.destination,
      body: delivery.body,
      idempotencyKey: delivery.id,
    });

    await finishDelivery({
      id: delivery.id,
      status: result.ok ? "Sent" : "Failed",
      provider: result.provider,
      failureReason: result.error,
    });

    return { ok: result.ok, provider: result.provider };
  }

  await finishDelivery({
    id: delivery.id,
    status: "Failed",
    provider: "Unsupported",
    failureReason: `Unsupported delivery channel: ${delivery.channel}`,
  });

  return { ok: false, provider: "Unsupported" };
}

export async function processQueuedDeliveries(
  context: BackendContext,
  options: {
    limit?: number;
    runtime?: BackgroundJobRuntime;
  } = {},
) {
  const limit = clampInteger(options.limit, 50, 1, 100);
  let attempted = 0;
  let processed = 0;
  let failed = 0;

  while (attempted < limit) {
    await options.runtime?.throwIfCancelled();

    const delivery = await claimNextDelivery(context);
    if (!delivery) break;

    attempted += 1;

    try {
      const result = await processDelivery(context, delivery);

      if (result.ok) processed += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;

      await finishDelivery({
        id: delivery.id,
        status: "Failed",
        provider: delivery.provider ?? "Unknown",
        failureReason: safeFailure(error),
      }).catch(() => null);
    }

    await options.runtime?.reportProgress(
      Math.round((attempted / Math.max(1, limit)) * 95),
      `Processed ${attempted} outbound deliver${attempted === 1 ? "y" : "ies"}`,
    );
  }

  await emitBackendEvent(context, {
    eventType: "delivery.processed",
    area: "Notifications",
    title: "Queued deliveries processed",
    detail: `${processed} delivery record(s) sent or simulated. ${failed} failed.`,
    metadata: {
      attempted,
      processed,
      failed,
    },
  });

  return {
    attempted,
    processed,
    failed,
  };
}