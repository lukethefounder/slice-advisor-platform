import { prisma } from "@/lib/prisma";
import { BackendContext } from "@/lib/backend/config";
import { emitBackendEvent } from "@/lib/backend/events";
import { sendEmail } from "@/lib/integrations/email";
import { sendSms } from "@/lib/integrations/sms";

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
  }
) {
  const delivery = await prisma.backendOutboundDelivery.create({
    data: {
      userId: context.userId,
      firmId: context.firmId,
      channel: input.channel,
      destination: input.destination,
      title: input.title,
      body: input.body,
      payloadJson: asJson(input.payload ?? {}),
      provider: input.provider,
      urgency: input.urgency ?? "Medium",
      score: input.score ?? 50,
      approvalRequired: input.approvalRequired ?? false,
      status: input.approvalRequired ? "Needs Approval" : "Queued",
    },
  });

  await emitBackendEvent(context, {
    eventType: "delivery.queued",
    area: "Notifications",
    title: `Delivery queued: ${input.title}`,
    detail: input.body,
    sourceType: "BackendOutboundDelivery",
    sourceId: delivery.id,
    metadata: {
      channel: input.channel,
      urgency: input.urgency,
      score: input.score,
      approvalRequired: input.approvalRequired,
    },
  });

  return delivery;
}

export async function processQueuedDeliveries(context: BackendContext) {
  const deliveries = await prisma.backendOutboundDelivery.findMany({
    where: {
      userId: context.userId,
      status: "Queued",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 50,
  });

  let processed = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const payload = parseJson<Record<string, unknown>>(delivery.payloadJson, {});

    if (delivery.approvalRequired && !delivery.approvedAt) {
      await prisma.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: { status: "Needs Approval" },
      });
      continue;
    }

    if (delivery.channel === "Dashboard") {
      await prisma.notificationDelivery.create({
        data: {
          userId: context.userId,
          channel: "Dashboard",
          destination: delivery.destination ?? "Dashboard",
          status: "Queued",
          urgency: delivery.urgency,
          score: delivery.score,
          title: delivery.title,
          body: delivery.body,
          reason: "Backend outbound delivery",
          simulated: true,
        },
      });

      await prisma.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "Sent",
          sentAt: new Date(),
          provider: "Dashboard",
        },
      });

      processed += 1;
      continue;
    }

    if (delivery.channel === "Email") {
      if (!delivery.destination) {
        await prisma.backendOutboundDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "Failed",
            failureReason: "Email destination is missing.",
          },
        });
        failed += 1;
        continue;
      }

      const result = await sendEmail({
        to: delivery.destination,
        subject: delivery.title,
        text: delivery.body,
        html:
          typeof payload.html === "string"
            ? payload.html
            : `<p>${delivery.body.replace(/\n/g, "<br />")}</p>`,
        idempotencyKey: delivery.id,
      });

      await prisma.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.ok ? "Sent" : "Failed",
          sentAt: result.ok ? new Date() : null,
          provider: result.provider,
          failureReason: result.error,
        },
      });

      if (result.ok) {
        processed += 1;
      } else {
        failed += 1;
      }

      continue;
    }

    if (delivery.channel === "Text" || delivery.channel === "SMS") {
      if (!delivery.destination) {
        await prisma.backendOutboundDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "Failed",
            failureReason: "SMS destination is missing.",
          },
        });
        failed += 1;
        continue;
      }

      const result = await sendSms({
        to: delivery.destination,
        body: delivery.body,
      });

      await prisma.backendOutboundDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.ok ? "Sent" : "Failed",
          sentAt: result.ok ? new Date() : null,
          provider: result.provider,
          failureReason: result.error,
        },
      });

      if (result.ok) {
        processed += 1;
      } else {
        failed += 1;
      }

      continue;
    }

    await prisma.backendOutboundDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "Failed",
        failureReason: `Unsupported delivery channel: ${delivery.channel}`,
      },
    });
    failed += 1;
  }

  await emitBackendEvent(context, {
    eventType: "delivery.processed",
    area: "Notifications",
    title: "Queued deliveries processed",
    detail: `${processed} delivery record(s) processed. ${failed} failed.`,
    metadata: {
      attempted: deliveries.length,
      processed,
      failed,
    },
  });

  return {
    attempted: deliveries.length,
    processed,
    failed,
  };
}