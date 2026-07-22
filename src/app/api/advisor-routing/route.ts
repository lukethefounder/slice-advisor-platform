import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import {
  canManageClientRouting,
  ensureAdvisorFirmContext,
  isAdvisorMembership,
} from "@/lib/client-access";
import {
  cleanText,
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import { hashPortalInviteCode } from "@/lib/client-portal-auth";
import { decryptSensitiveText } from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

const INBOX_STATUSES = new Set([
  "Unread",
  "Needs Review",
  "In Progress",
  "Waiting on Client",
  "Resolved",
  "Archived",
]);

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanCalendlyUrl(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      throw new Error("Calendly links must use HTTPS.");
    }

    if (host !== "calendly.com" && !host.endsWith(".calendly.com")) {
      throw new Error("Enter a valid calendly.com scheduling link.");
    }

    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Enter a valid Calendly scheduling link.",
    );
  }
}

function clientEmail(client: { email?: string | null }) {
  return client.email ? decryptSensitiveText(client.email) ?? null : null;
}

function publicMember(member: any) {
  return {
    id: member.id,
    firmId: member.firmId,
    userId: member.userId,
    name: member.user?.name || member.user?.email || "Advisor",
    email: member.user?.email || "",
    role: member.role,
    status: member.status,
    calendarColor: member.calendarColor,
    calendlyUrl: member.calendlyEnabled ? member.calendlyUrl : null,
    calendlyLabel: member.calendlyLabel || "Schedule a meeting",
    calendlyEnabled: member.calendlyEnabled,
    eligibleForClients: isAdvisorMembership(member),
  };
}

async function writeAudit(input: {
  userId: string;
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      eventType: "advisor.client.routing",
      severity: "Medium",
      area: "Advisor Client Routing",
      title: input.title,
      detail: input.detail,
      metadataJson: JSON.stringify(input.metadata ?? {}),
      userAgent: input.request?.headers.get("user-agent") ?? null,
      ipAddress:
        input.request?.headers.get("x-forwarded-for") ??
        input.request?.headers.get("x-real-ip") ??
        null,
    },
  });
}

async function loadPayload(input: {
  userId: string;
  scope?: string | null;
  clientId?: string | null;
}) {
  const membership = await ensureAdvisorFirmContext(input.userId);
  const manager = canManageClientRouting(membership);
  const firmWide = manager && input.scope === "all";

  const [members, clients, inbox] = await Promise.all([
    db.firmMembership.findMany({
      where: {
        firmId: membership.firmId,
        status: "Active",
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    db.clientProfile.findMany({
      where: manager
        ? { firmId: membership.firmId }
        : {
            firmId: membership.firmId,
            assignedAdvisorMembershipId: membership.id,
          },
      select: {
        id: true,
        fullName: true,
        email: true,
        householdName: true,
        clientType: true,
        riskProfile: true,
        status: true,
        firmId: true,
        assignedAdvisorMembershipId: true,
        assignedAdvisorAt: true,
        portalEnabled: true,
        portalInviteExpiresAt: true,
        portalOnboardingStatus: true,
        portalLastLoginAt: true,
        updatedAt: true,
      },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    }),
    db.advisorClientInboxItem.findMany({
      where: {
        firmId: membership.firmId,
        ...(firmWide
          ? {}
          : { assignedAdvisorMembershipId: membership.id }),
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
    }),
  ]);

  const replyRows = inbox.length
    ? await db.advisorClientInboxReply.findMany({
        where: {
          inboxItemId: {
            in: inbox.map((item: any) => item.id),
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    : [];

  const memberById = new Map(
    members.map((member: any) => [member.id, publicMember(member)]),
  );

  const clientById = new Map(
    clients.map((client: any) => [client.id, client.fullName]),
  );

  return {
    ok: true,
    firm: {
      id: membership.firm.id,
      name: membership.firm.name,
      firmEmail: membership.firm.firmEmail,
      firmCode: membership.firm.firmCode,
    },
    membership: publicMember(membership),
    permissions: {
      canManageAssignments: manager,
      canCreatePortalInvites: manager,
      canViewFirmOversight: manager,
      inboxScope: firmWide ? "all" : "mine",
    },
    members: members.map(publicMember),
    clients: clients.map((client: any) => ({
      ...client,
      email: clientEmail(client),
      assignedAdvisor:
        memberById.get(client.assignedAdvisorMembershipId) ?? null,
    })),
    inbox: inbox.map((item: any) => ({
      ...item,
      senderEmail: item.senderEmail
        ? decryptSensitiveText(item.senderEmail) ?? null
        : null,
      clientName: clientById.get(item.clientId) ?? "Client",
      assignedAdvisor:
        memberById.get(item.assignedAdvisorMembershipId) ?? null,
      metadata: (() => {
        try {
          return JSON.parse(item.metadataJson || "{}");
        } catch {
          return {};
        }
      })(),
      replies: replyRows.filter(
        (reply: any) => reply.inboxItemId === item.id,
      ),
    })),
  };
}

function unauthorized() {
  return noStoreJson(
    { error: "Authentication required." },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Advisor Client Routing",
    eventType: "advisor-routing.read",
    title: "Advisor routing data read",
    limit: 120,
  });

  if (!protection.allowed) return protection.response!;

  const url = new URL(request.url);

  try {
    return noStoreJson(
      await loadPayload({
        userId: user.id,
        scope: url.searchParams.get("scope"),
        clientId: url.searchParams.get("clientId"),
      }),
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load advisor routing.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Advisor Client Routing",
    eventType: "advisor-routing.write",
    title: "Advisor routing change",
    limit: 60,
  });

  if (!protection.allowed) return protection.response!;

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStoreJson(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const action = cleanText(body.action);

  try {
    const membership = await ensureAdvisorFirmContext(user.id);
    const manager = canManageClientRouting(membership);

    if (action === "saveCalendly") {
      const calendlyUrl = cleanCalendlyUrl(body.calendlyUrl);
      const calendlyLabel = cleanText(
        body.calendlyLabel,
        "Schedule a meeting",
      ).slice(0, 120);
      const calendlyEnabled = bool(body.calendlyEnabled, true);

      await db.firmMembership.update({
        where: { id: membership.id },
        data: {
          calendlyUrl,
          calendlyLabel: calendlyLabel || "Schedule a meeting",
          calendlyEnabled,
        },
      });

      await writeAudit({
        userId: user.id,
        title: "Advisor scheduling settings updated",
        detail:
          "The advisor updated their personal Calendly link and client-facing schedule label.",
        metadata: {
          membershipId: membership.id,
          enabled: calendlyEnabled,
          configured: Boolean(calendlyUrl),
        },
        request,
      });

      return noStoreJson(
        await loadPayload({
          userId: user.id,
          scope: cleanText(body.scope),
        }),
      );
    }

    if (action === "assignClient") {
      if (!manager) {
        return noStoreJson(
          {
            error:
              "Lead-advisor or firm-management access is required.",
          },
          { status: 403 },
        );
      }

      const clientId = cleanText(body.clientId);
      const nextAdvisorMembershipId = cleanText(
        body.assignedAdvisorMembershipId,
      );
      const reason = cleanText(body.reason).slice(0, 1000) || null;

      const [client, target] = await Promise.all([
        db.clientProfile.findFirst({
          where: {
            id: clientId,
            firmId: membership.firmId,
          },
        }),
        db.firmMembership.findFirst({
          where: {
            id: nextAdvisorMembershipId,
            firmId: membership.firmId,
            status: "Active",
          },
          include: {
            user: true,
          },
        }),
      ]);

      if (!client) {
        return noStoreJson(
          { error: "Client not found." },
          { status: 404 },
        );
      }

      if (!target || !isAdvisorMembership(target)) {
        return noStoreJson(
          { error: "Select an active advisor from this firm." },
          { status: 400 },
        );
      }

      const previousAdvisorMembershipId =
        client.assignedAdvisorMembershipId ?? null;
      const now = new Date();

      await db.$transaction([
        db.clientProfile.update({
          where: { id: client.id },
          data: {
            assignedAdvisorMembershipId: target.id,
            assignedAdvisorAt: now,
            assignedByUserId: user.id,
          },
        }),
        db.advisorClientInboxItem.updateMany({
          where: {
            firmId: membership.firmId,
            clientId: client.id,
            status: {
              notIn: ["Resolved", "Archived"],
            },
          },
          data: {
            assignedAdvisorMembershipId: target.id,
          },
        }),
        db.clientAdvisorAssignmentAudit.create({
          data: {
            firmId: membership.firmId,
            clientId: client.id,
            previousAdvisorMembershipId,
            nextAdvisorMembershipId: target.id,
            changedByUserId: user.id,
            reason,
          },
        }),
        db.notificationDelivery.create({
          data: {
            userId: target.userId,
            alertEventId: null,
            channel: "Dashboard",
            destination: target.user?.email ?? null,
            status: "Delivered",
            urgency: "Medium",
            score: 75,
            title: `${client.fullName} was assigned to you`,
            body:
              "Client portal messages and profile updates will now route only to your individual advisor inbox.",
            reason: `Client assignment changed by ${user.name}.`,
            simulated: false,
            deliveredAt: now,
          },
        }),
      ]);

      await writeAudit({
        userId: user.id,
        title: "Client advisor assignment changed",
        detail: `${client.fullName} was assigned to ${
          target.user?.name ||
          target.user?.email ||
          "an advisor"
        }.`,
        metadata: {
          clientId,
          previousAdvisorMembershipId,
          nextAdvisorMembershipId: target.id,
          reason,
        },
        request,
      });

      return noStoreJson(
        await loadPayload({
          userId: user.id,
          scope: cleanText(body.scope),
          clientId,
        }),
      );
    }

    if (action === "createPortalInvite") {
      if (!manager) {
        return noStoreJson(
          {
            error:
              "Lead-advisor or firm-management access is required.",
          },
          { status: 403 },
        );
      }

      const clientId = cleanText(body.clientId);

      const client = await db.clientProfile.findFirst({
        where: {
          id: clientId,
          firmId: membership.firmId,
        },
      });

      if (!client) {
        return noStoreJson(
          { error: "Client not found." },
          { status: 404 },
        );
      }

      if (!client.assignedAdvisorMembershipId) {
        return noStoreJson(
          {
            error:
              "Assign an advisor before creating portal access.",
          },
          { status: 400 },
        );
      }

      const email = clientEmail(client);

      if (!email) {
        return noStoreJson(
          {
            error:
              "Add a valid client email before creating portal access.",
          },
          { status: 400 },
        );
      }

      const inviteCode = randomBytes(24).toString("base64url");
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );

      await db.clientProfile.update({
        where: { id: client.id },
        data: {
          portalEnabled: true,
          portalInviteCodeHash: hashPortalInviteCode(inviteCode),
          portalInviteExpiresAt: expiresAt,
          portalOnboardingStatus: "Invited",
        },
      });

      await writeAudit({
        userId: user.id,
        title: "Secure client portal invite created",
        detail: `A 30-day portal access code was generated for ${client.fullName}.`,
        metadata: {
          clientId: client.id,
          assignedAdvisorMembershipId:
            client.assignedAdvisorMembershipId,
          expiresAt: expiresAt.toISOString(),
        },
        request,
      });

      const loginUrl = new URL("/client-login", request.url);
      loginUrl.searchParams.set("code", inviteCode);
      loginUrl.searchParams.set("email", email);

      return noStoreJson({
        ...(await loadPayload({
          userId: user.id,
          scope: cleanText(body.scope),
          clientId,
        })),
        invite: {
          clientId: client.id,
          clientName: client.fullName,
          clientEmail: email,
          inviteCode,
          loginUrl: loginUrl.toString(),
          expiresAt,
        },
      });
    }

    if (action === "updateInbox") {
      const itemId = cleanText(body.itemId);
      const status = cleanText(body.status);

      if (!INBOX_STATUSES.has(status)) {
        return noStoreJson(
          { error: "Invalid inbox status." },
          { status: 400 },
        );
      }

      const item = await db.advisorClientInboxItem.findFirst({
        where: {
          id: itemId,
          firmId: membership.firmId,
        },
      });

      if (!item) {
        return noStoreJson(
          { error: "Inbox item not found." },
          { status: 404 },
        );
      }

      if (
        !manager &&
        item.assignedAdvisorMembershipId !== membership.id
      ) {
        return noStoreJson(
          { error: "Inbox access denied." },
          { status: 403 },
        );
      }

      const now = new Date();

      await db.advisorClientInboxItem.update({
        where: { id: item.id },
        data: {
          status,
          readAt:
            status === "Unread" ? null : item.readAt ?? now,
          resolvedAt: status === "Resolved" ? now : null,
        },
      });

      return noStoreJson(
        await loadPayload({
          userId: user.id,
          scope: cleanText(body.scope),
        }),
      );
    }

    if (action === "reply") {
      const itemId = cleanText(body.itemId);
      const replyBody = cleanText(body.body).slice(0, 5000);

      if (!replyBody) {
        return noStoreJson(
          { error: "Reply text is required." },
          { status: 400 },
        );
      }

      const item = await db.advisorClientInboxItem.findFirst({
        where: {
          id: itemId,
          firmId: membership.firmId,
        },
      });

      if (!item) {
        return noStoreJson(
          { error: "Inbox item not found." },
          { status: 404 },
        );
      }

      if (
        !manager &&
        item.assignedAdvisorMembershipId !== membership.id
      ) {
        return noStoreJson(
          { error: "Inbox access denied." },
          { status: 403 },
        );
      }

      await db.$transaction([
        db.advisorClientInboxReply.create({
          data: {
            inboxItemId: item.id,
            advisorMembershipId: membership.id,
            authorUserId: user.id,
            body: replyBody,
          },
        }),
        db.advisorClientInboxItem.update({
          where: { id: item.id },
          data: {
            status: "Waiting on Client",
            readAt: item.readAt ?? new Date(),
          },
        }),
      ]);

      await writeAudit({
        userId: user.id,
        title: "Advisor replied to client portal item",
        detail:
          "A reply was added for secure delivery to the client portal.",
        metadata: {
          itemId: item.id,
          clientId: item.clientId,
        },
        request,
      });

      return noStoreJson(
        await loadPayload({
          userId: user.id,
          scope: cleanText(body.scope),
        }),
      );
    }

    return noStoreJson(
      { error: "Unknown routing action." },
      { status: 400 },
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Advisor routing action failed.",
      },
      { status: 500 },
    );
  }
}