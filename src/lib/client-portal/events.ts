import "server-only";

import { createHash } from "node:crypto";

import { ApiError } from "@/lib/api-route";
import type { ClientPortalSessionContext } from "@/lib/client-portal-auth";
import { cleanEmail, cleanText } from "@/lib/client-data-security";
import { decryptSensitiveText, encryptSensitiveText } from "@/lib/data-vault";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security";

const ALLOWED_KINDS = new Set([
  "Message",
  "Meeting",
  "Risk Update",
  "Document",
  "Profile Update",
  "Holding Update",
  "Request",
  "Approval",
]);

const ALLOWED_PRIORITIES = new Set(["Critical", "High", "Medium", "Low"]);

type PortalInboxLookupRow = {
  id: string;
  title: string;
  metadataJson: string;
};

type PortalReplyAuthorRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
};

export type ClientPortalEventInput = {
  sourceEventId?: unknown;
  kind?: unknown;
  title?: unknown;
  body?: unknown;
  priority?: unknown;
  senderName?: unknown;
  senderEmail?: unknown;
  metadata?: unknown;
};

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string | number | boolean | null | string[]> = {};

  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>,
  ).slice(0, 30)) {
    const key = cleanText(rawKey).slice(0, 100);

    if (!key) continue;

    if (typeof rawValue === "string") {
      result[key] = cleanText(rawValue).slice(0, 1_000);
      continue;
    }

    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      result[key] = rawValue;
      continue;
    }

    if (Array.isArray(rawValue)) {
      result[key] = rawValue
        .filter((item): item is string => typeof item === "string")
        .slice(0, 20)
        .map((item) => cleanText(item).slice(0, 300));
      continue;
    }

    result[key] = null;
  }

  return result;
}

function eventKey(clientId: string, requestedKey: unknown) {
  const normalized = cleanText(requestedKey)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, "-")
    .slice(0, 180);
  const stable = normalized || "message";
  const digest = createHash("sha256")
    .update(`${clientId}:${stable}`)
    .digest("hex")
    .slice(0, 24);

  return `portal:${clientId}:${digest}`;
}

function notificationKey(input: {
  sourceEventId: string;
  title: string;
  body: string;
  priority: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.sourceEventId,
        input.title,
        input.body,
        input.priority,
      ].join("\n"),
    )
    .digest("hex")
    .slice(0, 32);
}

function cleanKind(value: unknown) {
  const kind = cleanText(value, "Message");
  return ALLOWED_KINDS.has(kind) ? kind : "Message";
}

function cleanPriority(value: unknown) {
  const priority = cleanText(value, "Medium");

  if (ALLOWED_PRIORITIES.has(priority)) return priority;
  if (priority === "Urgent") return "Critical";
  if (priority === "Normal") return "Medium";
  return "Medium";
}

function scoreForPriority(priority: string) {
  if (priority === "Critical") return 95;
  if (priority === "High") return 85;
  if (priority === "Low") return 45;
  return 70;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}

export async function routeClientPortalEvent(input: {
  current: ClientPortalSessionContext;
  event: ClientPortalEventInput;
  request?: Request;
}) {
  const sourceEventId = eventKey(
    input.current.client.id,
    input.event.sourceEventId,
  );
  const title = cleanText(input.event.title).slice(0, 500);
  const body = cleanText(input.event.body).slice(0, 5_000);

  if (!title || !body) {
    throw new ApiError({
      status: 400,
      code: "CLIENT_MESSAGE_REQUIRED",
      message: "Title and message body are required.",
      expose: true,
    });
  }

  const kind = cleanKind(input.event.kind);
  const priority = cleanPriority(input.event.priority);
  const metadata = safeMetadata(input.event.metadata);
  const storedEmail = input.current.client.email
    ? cleanEmail(decryptSensitiveText(input.current.client.email))
    : null;
  const senderEmail = cleanEmail(input.event.senderEmail) || storedEmail;
  const senderName = cleanText(
    input.event.senderName,
    input.current.client.fullName,
  ).slice(0, 240);

  let created = false;
  let item: {
    id: string;
    clientId: string;
    assignedAdvisorMembershipId: string;
    title: string;
    body: string;
    kind: string;
    priority: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };

  const existing = await prisma.advisorClientInboxItem.findUnique({
    where: {
      firmId_sourceEventId: {
        firmId: input.current.assignment.firmId,
        sourceEventId,
      },
    },
    select: {
      id: true,
      clientId: true,
      assignedAdvisorMembershipId: true,
      title: true,
      body: true,
      kind: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (existing) {
    if (existing.clientId !== input.current.client.id) {
      throw new ApiError({
        status: 409,
        code: "PORTAL_EVENT_CONFLICT",
        message: "This portal event could not be synchronized.",
        expose: true,
      });
    }

    item = existing;
  } else {
    try {
      item = await prisma.advisorClientInboxItem.create({
        data: {
          firmId: input.current.assignment.firmId,
          clientId: input.current.client.id,
          assignedAdvisorMembershipId: input.current.assignment.id,
          kind,
          title,
          body,
          status: "Unread",
          priority,
          sourceEventId,
          senderName,
          senderEmail: encryptSensitiveText(senderEmail),
          metadataJson: JSON.stringify(metadata),
        },
        select: {
          id: true,
          clientId: true,
          assignedAdvisorMembershipId: true,
          title: true,
          body: true,
          kind: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      created = true;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const concurrent = await prisma.advisorClientInboxItem.findUnique({
        where: {
          firmId_sourceEventId: {
            firmId: input.current.assignment.firmId,
            sourceEventId,
          },
        },
        select: {
          id: true,
          clientId: true,
          assignedAdvisorMembershipId: true,
          title: true,
          body: true,
          kind: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!concurrent || concurrent.clientId !== input.current.client.id) {
        throw new ApiError({
          status: 409,
          code: "PORTAL_EVENT_CONFLICT",
          message: "This portal event could not be created.",
          expose: true,
        });
      }

      item = concurrent;
    }
  }

  const actionUrl = `/workspace/client-portal-inbox?itemId=${encodeURIComponent(
    item.id,
  )}`;
  const dedupe = notificationKey({
    sourceEventId,
    title,
    body,
    priority,
  });

  let notificationQueued = false;

  try {
    await queueBackendDelivery(
      {
        userId: input.current.assignment.userId,
        firmId: input.current.assignment.firmId,
        actorName: input.current.client.fullName,
        actorEmail: senderEmail,
      },
      {
        channel: "Dashboard",
        destination: actionUrl,
        title,
        body: `${input.current.client.fullName}: ${body}`.slice(0, 5_000),
        urgency: priority,
        score: scoreForPriority(priority),
        payload: {
          clientId: input.current.client.id,
          inboxItemId: item.id,
          actionUrl,
          kind,
        },
        idempotencyKey: `client-portal-event:${dedupe}`,
      },
    );
    notificationQueued = true;
  } catch {
    notificationQueued = false;
  }

  if (created) {
    await recordSecurityEvent({
      userId: input.current.assignment.userId,
      eventType: "client.portal.event.created",
      severity: priority === "Critical" ? "High" : "Medium",
      area: "Client Portal",
      title: "Client portal item created",
      detail: "A client portal item was routed to the currently assigned advisor.",
      metadata: {
        clientId: input.current.client.id,
        inboxItemId: item.id,
        assignedAdvisorMembershipId: input.current.assignment.id,
        kind,
        priority,
        notificationQueued,
      },
      request: input.request,
    });
  }

  return {
    created,
    notificationQueued,
    item,
  };
}

export async function routeClientPortalEvents(input: {
  current: ClientPortalSessionContext;
  events: ClientPortalEventInput[];
  request?: Request;
}) {
  if (input.events.length > 50) {
    throw new ApiError({
      status: 413,
      code: "PORTAL_EVENT_BATCH_TOO_LARGE",
      message: "A maximum of 50 portal events may be synchronized at once.",
      expose: true,
    });
  }

  const results: Array<{
    sourceEventId: string;
    ok: boolean;
    created?: boolean;
    itemId?: string;
    error?: string;
  }> = [];

  for (const event of input.events) {
    const requestedKey = cleanText(event.sourceEventId).slice(0, 300);

    try {
      const result = await routeClientPortalEvent({
        current: input.current,
        event,
        request: input.request,
      });

      results.push({
        sourceEventId: requestedKey,
        ok: true,
        created: result.created,
        itemId: result.item.id,
      });
    } catch (error) {
      results.push({
        sourceEventId: requestedKey,
        ok: false,
        error:
          error instanceof ApiError && error.expose
            ? error.message
            : "Portal event synchronization failed.",
      });
    }
  }

  return results;
}

export async function loadClientPortalRoutingPayload(input: {
  current: ClientPortalSessionContext;
  after?: string | null;
}) {
  const parsedAfter = input.after ? Date.parse(input.after) : Number.NaN;
  const after = Number.isFinite(parsedAfter) ? new Date(parsedAfter) : null;
  const inboxItems = await prisma.advisorClientInboxItem.findMany({
    where: {
      firmId: input.current.assignment.firmId,
      clientId: input.current.client.id,
    },
    select: {
      id: true,
      title: true,
      metadataJson: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 250,
  });

  const replies = inboxItems.length
    ? await prisma.advisorClientInboxReply.findMany({
        where: {
          inboxItemId: {
            in: inboxItems.map((item) => item.id),
          },
          ...(after
            ? {
                createdAt: {
                  gt: after,
                },
              }
            : {}),
        },
        select: {
          id: true,
          inboxItemId: true,
          advisorMembershipId: true,
          authorUserId: true,
          body: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 500,
      })
    : [];

  const authorIds = Array.from(
    new Set(replies.map((reply) => reply.advisorMembershipId)),
  );
  const replyAuthors = authorIds.length
    ? await prisma.firmMembership.findMany({
        where: {
          id: {
            in: authorIds,
          },
          firmId: input.current.assignment.firmId,
        },
        select: {
          id: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })
    : [];
  const authorById = new Map<string, string>(
    (replyAuthors as PortalReplyAuthorRow[]).map((member) => [
      member.id,
      member.user.name || member.user.email || "Advisor",
    ]),
  );
  const itemById = new Map<string, PortalInboxLookupRow>(
    (inboxItems as PortalInboxLookupRow[]).map((item) => [item.id, item]),
  );
  const latestReply = replies.at(-1)?.createdAt ?? after ?? null;

  return {
    ok: true,
    client: {
      id: input.current.client.id,
      name: input.current.client.fullName,
    },
    firm: {
      id: input.current.assignment.firm.id,
      name: input.current.assignment.firm.name,
    },
    advisor: {
      membershipId: input.current.assignment.id,
      userId: input.current.assignment.userId,
      name:
        input.current.assignment.user.name ||
        input.current.assignment.user.email ||
        "Advisor",
      email: input.current.assignment.user.email,
      role: input.current.assignment.role,
      calendlyUrl: input.current.scheduling.url,
      calendlyLabel: input.current.scheduling.label,
      calendlyEnabled: input.current.scheduling.enabled,
      scheduling: input.current.scheduling,
    },
    syncCursor: latestReply?.toISOString() ?? null,
    outboundMessages: replies.map((reply) => {
      const inboxItem = itemById.get(reply.inboxItemId);
      const metadata = (() => {
        try {
          const parsed = JSON.parse(inboxItem?.metadataJson || "{}") as unknown;
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
        } catch {
          return {};
        }
      })();

      return {
        id: reply.id,
        inboxItemId: reply.inboxItemId,
        threadId:
          typeof metadata.threadId === "string" ? metadata.threadId : null,
        title: inboxItem?.title || "Message from your advisor",
        advisorName: authorById.get(reply.advisorMembershipId) || "Advisor",
        body: reply.body,
        createdAt: reply.createdAt,
      };
    }),
  };
}