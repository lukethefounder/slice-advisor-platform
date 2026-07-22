import { getCurrentClientPortalSession } from "@/lib/client-portal-auth";
import {
  cleanEmail,
  cleanText,
  noStoreJson,
} from "@/lib/client-data-security";
import { encryptSensitiveText } from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

const ALLOWED_KINDS = new Set([
  "Message",
  "Request",
  "Document",
  "Risk Update",
  "Holding Update",
  "Meeting",
  "Approval",
  "Profile Update",
]);

function crossSiteBlocked(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function cleanPriority(value: unknown) {
  const priority = cleanText(value, "Medium");

  if (
    ["Critical", "High", "Medium", "Low"].includes(
      priority,
    )
  ) {
    return priority;
  }

  if (priority === "Urgent") return "Critical";
  if (priority === "Normal") return "Medium";

  return "Medium";
}

function cleanKind(value: unknown) {
  const kind = cleanText(value, "Message");

  return ALLOWED_KINDS.has(kind) ? kind : "Message";
}

function safeMetadata(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      value as Record<string, unknown>,
    )
      .slice(0, 40)
      .map(([key, item]) => [
        cleanText(key).slice(0, 100),
        typeof item === "string"
          ? cleanText(item).slice(0, 2000)
          : typeof item === "number" ||
              typeof item === "boolean"
            ? item
            : Array.isArray(item)
              ? item.slice(0, 25)
              : item && typeof item === "object"
                ? item
                : null,
      ]),
  );
}

async function currentRoutingContext() {
  const current = await getCurrentClientPortalSession();

  if (!current) return null;

  const assignment =
    current.client.firmId &&
    current.client.assignedAdvisorMembershipId
      ? await db.firmMembership.findFirst({
          where: {
            id: current.client
              .assignedAdvisorMembershipId,
            firmId: current.client.firmId,
            status: "Active",
          },
          include: {
            user: true,
            firm: true,
          },
        })
      : null;

  if (!assignment) return null;

  return {
    ...current,
    assignment,
  };
}

async function loadRoutingPayload() {
  const current = await currentRoutingContext();

  if (!current) return null;

  const inboxItems =
    await db.advisorClientInboxItem.findMany({
      where: {
        firmId: current.assignment.firmId,
        clientId: current.client.id,
      },
      select: {
        id: true,
        title: true,
        metadataJson: true,
      },
    });

  const replies = inboxItems.length
    ? await db.advisorClientInboxReply.findMany({
        where: {
          inboxItemId: {
            in: inboxItems.map(
              (item: any) => item.id,
            ),
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];

  const authorIds = Array.from(
    new Set(
      replies.map(
        (reply: any) =>
          reply.advisorMembershipId,
      ),
    ),
  );

  const replyAuthors = authorIds.length
    ? await db.firmMembership.findMany({
        where: {
          id: { in: authorIds },
          firmId: current.assignment.firmId,
        },
        include: {
          user: true,
        },
      })
    : [];

  const authorById = new Map(
    replyAuthors.map((member: any) => [
      member.id,
      member.user?.name ||
        member.user?.email ||
        "Advisor",
    ]),
  );

  const itemById = new Map<
    string,
    {
      id: string;
      title: string;
      metadataJson: string;
    }
  >(
    inboxItems.map((item: any) => [
      item.id,
      item,
    ]),
  );

  return {
    ok: true,
    client: {
      id: current.client.id,
      name: current.client.fullName,
    },
    firm: {
      id: current.assignment.firm.id,
      name: current.assignment.firm.name,
    },
    advisor: {
      membershipId: current.assignment.id,
      name:
        current.assignment.user?.name ||
        current.assignment.user?.email ||
        "Advisor",
      email:
        current.assignment.user?.email || "",
      role: current.assignment.role,
      calendlyUrl:
        current.assignment.calendlyEnabled &&
        current.assignment.calendlyUrl
          ? current.assignment.calendlyUrl
          : null,
      calendlyLabel:
        current.assignment.calendlyLabel ||
        "Schedule a meeting",
    },
    outboundMessages: replies.map(
      (reply: any) => {
        const item = itemById.get(
          reply.inboxItemId,
        );

        let metadata: Record<
          string,
          unknown
        > = {};

        try {
          metadata = JSON.parse(
            item?.metadataJson || "{}",
          );
        } catch {
          metadata = {};
        }

        return {
          id: reply.id,
          inboxItemId: reply.inboxItemId,
          threadId:
            typeof metadata.threadId ===
            "string"
              ? metadata.threadId
              : null,
          title:
            item?.title ||
            "Message from your advisor",
          advisorName:
            authorById.get(
              reply.advisorMembershipId,
            ) || "Advisor",
          body: reply.body,
          createdAt: reply.createdAt,
        };
      },
    ),
  };
}

export async function GET() {
  const payload = await loadRoutingPayload();

  if (!payload) {
    return noStoreJson(
      {
        error:
          "An active assigned-advisor portal session is required.",
      },
      { status: 401 },
    );
  }

  return noStoreJson(payload);
}

export async function POST(request: Request) {
  if (crossSiteBlocked(request)) {
    return noStoreJson(
      {
        error:
          "Security policy blocked this portal request.",
      },
      { status: 403 },
    );
  }

  const current = await currentRoutingContext();

  if (!current) {
    return noStoreJson(
      {
        error:
          "An active assigned-advisor portal session is required.",
      },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return noStoreJson(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const sourceEventId = cleanText(
    body.sourceEventId,
  ).slice(0, 300);

  const title = cleanText(body.title).slice(
    0,
    500,
  );

  const itemBody = cleanText(body.body).slice(
    0,
    5000,
  );

  if (!sourceEventId || !title || !itemBody) {
    return noStoreJson(
      {
        error:
          "Source event, title, and message body are required.",
      },
      { status: 400 },
    );
  }

  const existing =
    await db.advisorClientInboxItem.findUnique({
      where: {
        firmId_sourceEventId: {
          firmId: current.assignment.firmId,
          sourceEventId,
        },
      },
    });

  if (existing) {
    const updated =
      await db.advisorClientInboxItem.update({
        where: { id: existing.id },
        data: {
          assignedAdvisorMembershipId:
            current.assignment.id,
          title,
          body: itemBody,
          kind: cleanKind(body.kind),
          priority: cleanPriority(
            body.priority,
          ),
          metadataJson: JSON.stringify(
            safeMetadata(body.metadata),
          ),
        },
      });

    return noStoreJson({
      ok: true,
      created: false,
      item: updated,
    });
  }

  const senderEmail = cleanEmail(
    body.senderEmail,
  );

  const kind = cleanKind(body.kind);
  const priority = cleanPriority(body.priority);
  const now = new Date();

  try {
    const item = await db.$transaction(
      async (tx: any) => {
        const created =
          await tx.advisorClientInboxItem.create({
            data: {
              firmId:
                current.assignment.firmId,
              clientId: current.client.id,
              assignedAdvisorMembershipId:
                current.assignment.id,
              kind,
              title,
              body: itemBody,
              status: "Unread",
              priority,
              sourceEventId,
              senderName: cleanText(
                body.senderName,
                current.client.fullName,
              ).slice(0, 240),
              senderEmail:
                encryptSensitiveText(
                  senderEmail,
                ),
              metadataJson: JSON.stringify(
                safeMetadata(
                  body.metadata,
                ),
              ),
            },
          });

        await tx.notificationDelivery.create({
          data: {
            userId:
              current.assignment.userId,
            alertEventId: null,
            channel: "Dashboard",
            destination:
              current.assignment.user
                ?.email ?? null,
            status: "Delivered",
            urgency:
              priority === "Critical"
                ? "Critical"
                : priority === "High"
                  ? "High"
                  : "Medium",
            score:
              priority === "Critical"
                ? 95
                : priority === "High"
                  ? 85
                  : 72,
            title,
            body: `${current.client.fullName}: ${itemBody}`.slice(
              0,
              5000,
            ),
            reason:
              "Routed exclusively to the advisor currently assigned to this client.",
            simulated: false,
            deliveredAt: now,
          },
        });

        return created;
      },
    );

    return noStoreJson({
      ok: true,
      created: true,
      item,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown })
        .code === "P2002"
    ) {
      const item =
        await db.advisorClientInboxItem.findUnique(
          {
            where: {
              firmId_sourceEventId: {
                firmId:
                  current.assignment.firmId,
                sourceEventId,
              },
            },
          },
        );

      return noStoreJson({
        ok: true,
        created: false,
        item,
      });
    }

    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to route the client portal update.",
      },
      { status: 500 },
    );
  }
}