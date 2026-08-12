import "server-only";

import { randomBytes } from "node:crypto";

import {
  AccessControlError,
  type AccessContext,
  getAccessContextForUser,
  hasFirmPermission,
} from "@/lib/access-control";
import { ApiError } from "@/lib/api-route";
import {
  type AdvisorFirmContext,
  canManageClientRouting,
  ensureAdvisorFirmContext,
  isAdvisorMembership,
} from "@/lib/client-access";
import { cleanEmail, cleanText } from "@/lib/client-data-security";
import { hashPortalInviteCode } from "@/lib/client-portal-auth";
import { decryptSensitiveText } from "@/lib/data-vault";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security";
import {
  normalizeSchedulingLabel,
  normalizeSchedulingUrl,
  schedulingView,
} from "@/lib/scheduling";

export const ADVISOR_INBOX_STATUSES = [
  "Unread",
  "Needs Review",
  "In Progress",
  "Waiting on Client",
  "Resolved",
  "Archived",
] as const;

export type AdvisorInboxStatus = (typeof ADVISOR_INBOX_STATUSES)[number];

const UNRESOLVED_INBOX_STATUSES: AdvisorInboxStatus[] = [
  "Unread",
  "Needs Review",
  "In Progress",
  "Waiting on Client",
];

const memberSelect = {
  id: true,
  firmId: true,
  userId: true,
  role: true,
  status: true,
  canAccessPortfolios: true,
  canManageProjects: true,
  canInviteMembers: true,
  canManageFirm: true,
  calendarColor: true,
  calendlyUrl: true,
  calendlyLabel: true,
  calendlyEnabled: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      platformStatus: true,
    },
  },
} as const;

const clientListSelect = {
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
  assignedByUserId: true,
  portalEnabled: true,
  portalInviteExpiresAt: true,
  portalOnboardingStatus: true,
  portalLastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const inboxSelect = {
  id: true,
  firmId: true,
  clientId: true,
  assignedAdvisorMembershipId: true,
  kind: true,
  title: true,
  body: true,
  status: true,
  priority: true,
  sourceEventId: true,
  senderName: true,
  senderEmail: true,
  metadataJson: true,
  readAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type MemberRow = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  canAccessPortfolios: boolean;
  canManageProjects: boolean;
  canInviteMembers: boolean;
  canManageFirm: boolean;
  calendarColor: string;
  calendlyUrl: string | null;
  calendlyLabel: string;
  calendlyEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    platformStatus: string;
  };
};

type RoutingUser = {
  id: string;
  name: string;
  email: string;
};

export type AdvisorRoutingContext = {
  user: RoutingUser;
  membership: AdvisorFirmContext;
  access: AccessContext;
  firmId: string;
  canManageAssignments: boolean;
  canSuperviseClients: boolean;
  canSuperviseInbox: boolean;
};

function parseObject(value: string | null | undefined) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function decryptedEmail(value: string | null | undefined) {
  if (!value) return null;

  const decrypted = decryptSensitiveText(value);
  return decrypted ? cleanEmail(decrypted) : null;
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

function publicMember(
  member: MemberRow,
  counts: {
    assignedClients: number;
    unresolvedInboxItems: number;
  } = {
    assignedClients: 0,
    unresolvedInboxItems: 0,
  },
) {
  const scheduling = schedulingView({
    url: member.calendlyUrl,
    label: member.calendlyLabel,
    enabled: member.calendlyEnabled,
  });

  return {
    id: member.id,
    firmId: member.firmId,
    userId: member.userId,
    name: member.user.name || member.user.email || "Advisor",
    email: member.user.email,
    role: member.role,
    status: member.status,
    calendarColor: member.calendarColor,
    calendlyUrl: scheduling.url,
    calendlyLabel: scheduling.label,
    calendlyEnabled: scheduling.enabled,
    scheduling,
    eligibleForClients: isAdvisorMembership(member),
    assignedClientCount: counts.assignedClients,
    unresolvedInboxCount: counts.unresolvedInboxItems,
  };
}

function backendContextForRecipient(input: {
  userId: string;
  firmId: string;
  actorName: string;
  actorEmail: string;
}) {
  return {
    userId: input.userId,
    firmId: input.firmId,
    actorName: input.actorName,
    actorEmail: input.actorEmail,
  };
}

async function auditRouting(input: {
  context: AdvisorRoutingContext;
  request: Request;
  title: string;
  detail: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  severity?: "Info" | "Low" | "Medium" | "High" | "Critical";
}) {
  await recordSecurityEvent({
    userId: input.context.user.id,
    eventType: input.eventType,
    severity: input.severity ?? "Medium",
    area: "Advisor Client Routing",
    title: input.title,
    detail: input.detail,
    metadata: {
      firmId: input.context.firmId,
      ...input.metadata,
    },
    request: input.request,
  });
}

function requireAssignmentManager(context: AdvisorRoutingContext) {
  if (!context.canManageAssignments) {
    throw new AccessControlError({
      status: 403,
      code: "CLIENT_ASSIGNMENT_DENIED",
      message: "Lead-advisor or firm-management access is required.",
    });
  }
}

export async function requireAdvisorRoutingContext(
  user: RoutingUser,
): Promise<AdvisorRoutingContext> {
  const membership = await ensureAdvisorFirmContext(user.id);
  const access = await getAccessContextForUser({
    userId: user.id,
    firmId: membership.firmId,
  });

  if (!access || !access.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  return {
    user,
    membership,
    access,
    firmId: membership.firmId,
    canManageAssignments:
      access.isFounder ||
      canManageClientRouting(membership) ||
      hasFirmPermission(access, "clients.assign"),
    canSuperviseClients:
      access.isFounder || hasFirmPermission(access, "clients.supervise"),
    canSuperviseInbox:
      access.isFounder || hasFirmPermission(access, "inbox.supervise"),
  };
}

async function validateClientVisibility(input: {
  context: AdvisorRoutingContext;
  clientId: string;
}) {
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      firmId: input.context.firmId,
      ...(input.context.canSuperviseClients
        ? {}
        : {
            assignedAdvisorMembershipId: input.context.membership.id,
          }),
    },
    select: {
      id: true,
      assignedAdvisorMembershipId: true,
    },
  });

  if (!client) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  return client;
}

export async function loadAdvisorRoutingPayload(
  context: AdvisorRoutingContext,
  options: {
    scope?: string | null;
    clientId?: string | null;
    clientLimit?: number;
    inboxLimit?: number;
  } = {},
) {
  const firmWideInbox = context.canSuperviseInbox && options.scope === "all";
  const clientLimit = clampInteger(options.clientLimit, 300, 1, 500);
  const inboxLimit = clampInteger(options.inboxLimit, 250, 1, 500);
  const selectedClientId = cleanText(options.clientId).slice(0, 160) || null;

  if (selectedClientId) {
    await validateClientVisibility({
      context,
      clientId: selectedClientId,
    });
  }

  const clientsWhere = context.canSuperviseClients
    ? {
        firmId: context.firmId,
      }
    : {
        firmId: context.firmId,
        assignedAdvisorMembershipId: context.membership.id,
      };

  const [
    members,
    clients,
    assignedClientRows,
    clientGroups,
    inboxGroups,
    unassignedCount,
    totalFirmClients,
  ] = await Promise.all([
    prisma.firmMembership.findMany({
      where: {
        firmId: context.firmId,
        status: "Active",
        user: {
          platformStatus: {
            notIn: ["Banned", "Suspended"],
          },
        },
      },
      select: memberSelect,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      take: 250,
    }),
    prisma.clientProfile.findMany({
      where: clientsWhere,
      select: clientListSelect,
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
      take: clientLimit,
    }),
    prisma.clientProfile.findMany({
      where: {
        firmId: context.firmId,
        assignedAdvisorMembershipId: context.membership.id,
      },
      select: {
        id: true,
      },
      orderBy: {
        fullName: "asc",
      },
      take: 500,
    }),
    prisma.clientProfile.groupBy({
      by: ["assignedAdvisorMembershipId"],
      where: {
        firmId: context.firmId,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.advisorClientInboxItem.groupBy({
      by: ["assignedAdvisorMembershipId"],
      where: {
        firmId: context.firmId,
        status: {
          in: UNRESOLVED_INBOX_STATUSES,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.clientProfile.count({
      where: {
        firmId: context.firmId,
        assignedAdvisorMembershipId: null,
      },
    }),
    prisma.clientProfile.count({
      where: {
        firmId: context.firmId,
      },
    }),
  ]);

  const assignedClientIds = assignedClientRows.map((client) => client.id);
  const inboxWhere = {
    firmId: context.firmId,
    ...(selectedClientId
      ? {
          clientId: selectedClientId,
        }
      : firmWideInbox
        ? {}
        : {
            clientId: {
              in: assignedClientIds,
            },
          }),
  };
  const inbox =
    !selectedClientId && !firmWideInbox && assignedClientIds.length === 0
      ? []
      : await prisma.advisorClientInboxItem.findMany({
          where: inboxWhere,
          select: inboxSelect,
          orderBy: {
            createdAt: "desc",
          },
          take: inboxLimit,
        });

  const assignedCountByMember = new Map<string, number>();
  const unresolvedCountByMember = new Map<string, number>();

  for (const group of clientGroups) {
    if (group.assignedAdvisorMembershipId) {
      assignedCountByMember.set(
        group.assignedAdvisorMembershipId,
        group._count._all,
      );
    }
  }

  for (const group of inboxGroups) {
    unresolvedCountByMember.set(
      group.assignedAdvisorMembershipId,
      group._count._all,
    );
  }

  const publicMembers = members.map((member) =>
    publicMember(member as MemberRow, {
      assignedClients: assignedCountByMember.get(member.id) ?? 0,
      unresolvedInboxItems: unresolvedCountByMember.get(member.id) ?? 0,
    }),
  );
  const memberById = new Map(publicMembers.map((member) => [member.id, member]));
  const clientById = new Map(clients.map((client) => [client.id, client.fullName]));
  const currentAdvisorByClientId = new Map(
    clients.map((client) => [client.id, client.assignedAdvisorMembershipId]),
  );

  const replies = inbox.length
    ? await prisma.advisorClientInboxReply.findMany({
        where: {
          inboxItemId: {
            in: inbox.map((item) => item.id),
          },
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
        take: 1_000,
      })
    : [];

  const repliesByItem = new Map<string, Array<(typeof replies)[number]>>();

  for (const reply of replies) {
    const values = repliesByItem.get(reply.inboxItemId) ?? [];
    values.push(reply);
    repliesByItem.set(reply.inboxItemId, values);
  }

  const assignmentHistory = selectedClientId
    ? await prisma.clientAdvisorAssignmentAudit.findMany({
        where: {
          firmId: context.firmId,
          clientId: selectedClientId,
        },
        select: {
          id: true,
          clientId: true,
          previousAdvisorMembershipId: true,
          nextAdvisorMembershipId: true,
          changedByUserId: true,
          reason: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      })
    : [];

  const changedByIds = Array.from(
    new Set(assignmentHistory.map((entry) => entry.changedByUserId)),
  );
  const changedByUsers = changedByIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: changedByIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : [];
  const changedByMap = new Map(
    changedByUsers.map((user) => [user.id, user.name || user.email]),
  );

  const assignmentQueue = context.canManageAssignments
    ? await prisma.clientProfile.findMany({
        where: {
          firmId: context.firmId,
          assignedAdvisorMembershipId: null,
        },
        select: clientListSelect,
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: 100,
      })
    : [];

  const schedulingIncompleteMembers = publicMembers.filter(
    (member) => member.eligibleForClients && !member.scheduling.configured,
  );

  return {
    ok: true,
    firm: context.membership.firm,
    membership: publicMember(
      {
        ...context.membership,
        user: {
          ...context.membership.user,
          platformStatus: "Active",
        },
      } as MemberRow,
      {
        assignedClients:
          assignedCountByMember.get(context.membership.id) ?? 0,
        unresolvedInboxItems:
          unresolvedCountByMember.get(context.membership.id) ?? 0,
      },
    ),
    permissions: {
      canManageAssignments: context.canManageAssignments,
      canCreatePortalInvites: context.canManageAssignments,
      canRevokePortalAccess: context.canManageAssignments,
      canViewFirmOversight: context.canSuperviseInbox,
      canViewAssignmentHistory:
        context.canSuperviseClients || Boolean(selectedClientId),
      inboxScope: firmWideInbox ? "all" : "mine",
    },
    metrics: {
      totalFirmClients,
      visibleClients: clients.length,
      unassignedClients: unassignedCount,
      eligibleAdvisors: publicMembers.filter(
        (member) => member.eligibleForClients,
      ).length,
      schedulingIncomplete: schedulingIncompleteMembers.length,
      unreadInboxItems: inbox.filter((item) => item.status === "Unread").length,
      highPriorityInboxItems: inbox.filter(
        (item) => item.priority === "Critical" || item.priority === "High",
      ).length,
    },
    members: publicMembers,
    schedulingIncompleteMembers,
    clients: clients.map((client) => ({
      ...client,
      email: decryptedEmail(client.email),
      assignedAdvisor: client.assignedAdvisorMembershipId
        ? memberById.get(client.assignedAdvisorMembershipId) ?? null
        : null,
    })),
    assignmentQueue: assignmentQueue.map((client) => ({
      ...client,
      email: decryptedEmail(client.email),
      assignedAdvisor: null,
    })),
    assignmentHistory: assignmentHistory.map((entry) => ({
      ...entry,
      previousAdvisor: entry.previousAdvisorMembershipId
        ? memberById.get(entry.previousAdvisorMembershipId) ?? null
        : null,
      nextAdvisor:
        memberById.get(entry.nextAdvisorMembershipId) ?? null,
      changedBy: changedByMap.get(entry.changedByUserId) ?? "Firm administrator",
    })),
    inbox: inbox.map((item) => ({
      ...item,
      senderEmail: decryptedEmail(item.senderEmail),
      clientName: clientById.get(item.clientId) ?? "Client",
      assignedAdvisor:
        memberById.get(item.assignedAdvisorMembershipId) ?? null,
      historical:
        item.assignedAdvisorMembershipId !==
        currentAdvisorByClientId.get(item.clientId),
      readOnly:
        !context.canSuperviseInbox &&
        item.assignedAdvisorMembershipId !== context.membership.id,
      metadata: parseObject(item.metadataJson),
      replies: repliesByItem.get(item.id) ?? [],
    })),
  };
}

export async function saveAdvisorScheduling(input: {
  context: AdvisorRoutingContext;
  request: Request;
  schedulingUrl: unknown;
  label: unknown;
  enabled: unknown;
}) {
  const normalizedUrl = normalizeSchedulingUrl(input.schedulingUrl);
  const normalizedLabel = normalizeSchedulingLabel(input.label);
  const enabled =
    typeof input.enabled === "boolean" ? input.enabled : true;
  const before = schedulingView({
    url: input.context.membership.calendlyUrl,
    label: input.context.membership.calendlyLabel,
    enabled: input.context.membership.calendlyEnabled,
  });

  const updated = await prisma.firmMembership.updateMany({
    where: {
      id: input.context.membership.id,
      userId: input.context.user.id,
      firmId: input.context.firmId,
      status: "Active",
    },
    data: {
      calendlyUrl: normalizedUrl,
      calendlyLabel: normalizedLabel,
      calendlyEnabled: enabled,
    },
  });

  if (updated.count !== 1) {
    throw new AccessControlError({
      status: 409,
      code: "SCHEDULING_SETTINGS_CONFLICT",
      message: "Scheduling settings changed before the update completed. Refresh and retry.",
    });
  }

  const after = schedulingView({
    url: normalizedUrl,
    label: normalizedLabel,
    enabled,
  });

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "advisor.scheduling.updated",
    title: "Advisor scheduling settings updated",
    detail: "The advisor updated their client-facing scheduling settings.",
    metadata: {
      membershipId: input.context.membership.id,
      previousProvider: before.provider,
      nextProvider: after.provider,
      previousEnabled: before.enabled,
      nextEnabled: after.enabled,
      configured: after.configured,
    },
  });

  return after;
}

async function queueAssignmentNotifications(input: {
  context: AdvisorRoutingContext;
  client: {
    id: string;
    fullName: string;
  };
  assignmentAuditId: string;
  target: MemberRow;
  previous: MemberRow | null;
}) {
  const destination = `/workspace/client-portal-inbox?clientId=${encodeURIComponent(
    input.client.id,
  )}`;

  const operations: Array<Promise<unknown>> = [
    queueBackendDelivery(
      backendContextForRecipient({
        userId: input.target.userId,
        firmId: input.context.firmId,
        actorName: input.context.user.name,
        actorEmail: input.context.user.email,
      }),
      {
        channel: "Dashboard",
        destination,
        title: `${input.client.fullName} was assigned to you`,
        body:
          "Future client portal messages and profile updates will route to your advisor inbox.",
        urgency: "Medium",
        score: 78,
        payload: {
          clientId: input.client.id,
          actionUrl: destination,
          assignmentAuditId: input.assignmentAuditId,
        },
        idempotencyKey: `client-assignment:${input.assignmentAuditId}:next`,
      },
    ),
  ];

  if (input.previous && input.previous.id !== input.target.id) {
    operations.push(
      queueBackendDelivery(
        backendContextForRecipient({
          userId: input.previous.userId,
          firmId: input.context.firmId,
          actorName: input.context.user.name,
          actorEmail: input.context.user.email,
        }),
        {
          channel: "Dashboard",
          destination: `/workspace/clients?clientId=${encodeURIComponent(
            input.client.id,
          )}`,
          title: `${input.client.fullName} was reassigned`,
          body:
            "Unresolved client portal work moved to the newly assigned advisor. Historical items remain available according to firm permissions.",
          urgency: "Low",
          score: 55,
          payload: {
            clientId: input.client.id,
            assignmentAuditId: input.assignmentAuditId,
          },
          idempotencyKey: `client-assignment:${input.assignmentAuditId}:previous`,
        },
      ),
    );
  }

  const results = await Promise.allSettled(operations);
  return results.filter((result) => result.status === "fulfilled").length;
}

export async function assignClientToAdvisor(input: {
  context: AdvisorRoutingContext;
  request: Request;
  clientId: unknown;
  advisorMembershipId: unknown;
  expectedCurrentAdvisorMembershipId?: unknown;
  reason?: unknown;
  confirmReassignment?: unknown;
}) {
  requireAssignmentManager(input.context);

  const clientId = cleanText(input.clientId).slice(0, 160);
  const advisorMembershipId = cleanText(input.advisorMembershipId).slice(0, 160);
  const expectedCurrent = cleanText(
    input.expectedCurrentAdvisorMembershipId,
  ).slice(0, 160);
  const reason = cleanText(input.reason).slice(0, 1_000) || null;

  if (!clientId || !advisorMembershipId) {
    throw new ApiError({
      status: 400,
      code: "ASSIGNMENT_INPUT_REQUIRED",
      message: "Client and advisor are required.",
      expose: true,
    });
  }

  const [client, target] = await Promise.all([
    prisma.clientProfile.findFirst({
      where: {
        id: clientId,
        firmId: input.context.firmId,
      },
      select: {
        id: true,
        fullName: true,
        assignedAdvisorMembershipId: true,
        portalOnboardingStatus: true,
      },
    }),
    prisma.firmMembership.findFirst({
      where: {
        id: advisorMembershipId,
        firmId: input.context.firmId,
        status: "Active",
        user: {
          platformStatus: {
            notIn: ["Banned", "Suspended"],
          },
        },
      },
      select: memberSelect,
    }),
  ]);

  if (!client) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  if (!target || !isAdvisorMembership(target)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_ADVISOR_ASSIGNMENT",
      message: "Select an active advisor from this firm.",
      expose: true,
    });
  }

  const previousAdvisorMembershipId =
    client.assignedAdvisorMembershipId ?? null;

  if (expectedCurrent && expectedCurrent !== (previousAdvisorMembershipId ?? "")) {
    throw new AccessControlError({
      status: 409,
      code: "CLIENT_ASSIGNMENT_STALE",
      message: "The client assignment changed. Refresh before assigning again.",
    });
  }

  if (previousAdvisorMembershipId === target.id) {
    return {
      changed: false,
      clientId: client.id,
      assignedAdvisorMembershipId: target.id,
      notificationsQueued: 0,
    };
  }

  if (
    previousAdvisorMembershipId &&
    input.confirmReassignment !== true
  ) {
    throw new ApiError({
      status: 409,
      code: "REASSIGNMENT_CONFIRMATION_REQUIRED",
      message: "Confirm the advisor reassignment before continuing.",
      expose: true,
      details: {
        clientId: client.id,
        currentAdvisorMembershipId: previousAdvisorMembershipId,
        nextAdvisorMembershipId: target.id,
      },
    });
  }

  const previous = previousAdvisorMembershipId
    ? await prisma.firmMembership.findFirst({
        where: {
          id: previousAdvisorMembershipId,
          firmId: input.context.firmId,
        },
        select: memberSelect,
      })
    : null;
  const now = new Date();

  const audit = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.clientProfile.updateMany({
      where: {
        id: client.id,
        firmId: input.context.firmId,
        assignedAdvisorMembershipId: previousAdvisorMembershipId,
      },
      data: {
        assignedAdvisorMembershipId: target.id,
        assignedAdvisorAt: now,
        assignedByUserId: input.context.user.id,
        ...(client.portalOnboardingStatus === "Assignment Required"
          ? {
              portalOnboardingStatus: "Not Invited",
            }
          : {}),
      },
    });

    if (updated.count !== 1) {
      throw new AccessControlError({
        status: 409,
        code: "CLIENT_ASSIGNMENT_CONFLICT",
        message:
          "The client assignment changed before this request completed. Refresh and try again.",
      });
    }

    await transaction.advisorClientInboxItem.updateMany({
      where: {
        firmId: input.context.firmId,
        clientId: client.id,
        status: {
          in: UNRESOLVED_INBOX_STATUSES,
        },
      },
      data: {
        assignedAdvisorMembershipId: target.id,
      },
    });

    return transaction.clientAdvisorAssignmentAudit.create({
      data: {
        firmId: input.context.firmId,
        clientId: client.id,
        previousAdvisorMembershipId,
        nextAdvisorMembershipId: target.id,
        changedByUserId: input.context.user.id,
        reason,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });
  });

  const notificationsQueued = await queueAssignmentNotifications({
    context: input.context,
    client,
    assignmentAuditId: audit.id,
    target: target as MemberRow,
    previous: previous as MemberRow | null,
  });

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "client.assignment.changed",
    title: "Client advisor assignment changed",
    detail: `${client.fullName} was assigned to ${
      target.user.name || target.user.email || "an advisor"
    }.`,
    metadata: {
      clientId: client.id,
      previousAdvisorMembershipId,
      nextAdvisorMembershipId: target.id,
      reason,
      assignmentAuditId: audit.id,
      notificationsQueued,
    },
  });

  return {
    changed: true,
    clientId: client.id,
    assignedAdvisorMembershipId: target.id,
    assignmentAuditId: audit.id,
    assignedAt: audit.createdAt,
    notificationsQueued,
  };
}

export async function createClientPortalInvite(input: {
  context: AdvisorRoutingContext;
  request: Request;
  clientId: unknown;
  expiresInDays?: unknown;
}) {
  requireAssignmentManager(input.context);

  const clientId = cleanText(input.clientId).slice(0, 160);
  const expiresInDays = clampInteger(input.expiresInDays, 30, 1, 30);
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      firmId: input.context.firmId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      assignedAdvisorMembershipId: true,
      portalOnboardingStatus: true,
    },
  });

  if (!client) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  if (!client.assignedAdvisorMembershipId) {
    throw new ApiError({
      status: 400,
      code: "ADVISOR_ASSIGNMENT_REQUIRED",
      message: "Assign an advisor before creating portal access.",
      expose: true,
    });
  }

  const assignment = await prisma.firmMembership.findFirst({
    where: {
      id: client.assignedAdvisorMembershipId,
      firmId: input.context.firmId,
      status: "Active",
      user: {
        platformStatus: {
          notIn: ["Banned", "Suspended"],
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new ApiError({
      status: 409,
      code: "ACTIVE_ADVISOR_REQUIRED",
      message: "Assign an active advisor before creating portal access.",
      expose: true,
    });
  }

  const email = decryptedEmail(client.email);

  if (!email) {
    throw new ApiError({
      status: 400,
      code: "CLIENT_EMAIL_REQUIRED",
      message: "Add a valid client email before creating portal access.",
      expose: true,
    });
  }

  const inviteCode = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1_000,
  );
  const updated = await prisma.$transaction(async (transaction) => {
    const profile = await transaction.clientProfile.updateMany({
      where: {
        id: client.id,
        firmId: input.context.firmId,
        assignedAdvisorMembershipId: assignment.id,
      },
      data: {
        portalEnabled: true,
        portalInviteCodeHash: hashPortalInviteCode(inviteCode),
        portalInviteExpiresAt: expiresAt,
        portalOnboardingStatus:
          client.portalOnboardingStatus === "Portal Ready"
            ? "Portal Ready"
            : "Invited",
      },
    });

    if (profile.count === 1) {
      await transaction.clientPortalSession.deleteMany({
        where: {
          clientId: client.id,
        },
      });
    }

    return profile;
  });

  if (updated.count !== 1) {
    throw new AccessControlError({
      status: 409,
      code: "PORTAL_INVITE_CONFLICT",
      message:
        "The client assignment changed before the invite was created. Refresh and try again.",
    });
  }

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "client.portal.invite.created",
    title: "Secure client portal invite created",
    detail: `A time-limited portal access code was generated for ${client.fullName}.`,
    metadata: {
      clientId: client.id,
      assignedAdvisorMembershipId: assignment.id,
      expiresAt: expiresAt.toISOString(),
      expiresInDays,
    },
  });

  const loginUrl = new URL("/client-login", input.request.url);
  loginUrl.searchParams.set("code", inviteCode);
  loginUrl.searchParams.set("email", email);

  return {
    clientId: client.id,
    clientName: client.fullName,
    clientEmail: email,
    inviteCode,
    loginUrl: loginUrl.toString(),
    expiresAt,
  };
}

export async function revokeClientPortalAccess(input: {
  context: AdvisorRoutingContext;
  request: Request;
  clientId: unknown;
}) {
  requireAssignmentManager(input.context);

  const clientId = cleanText(input.clientId).slice(0, 160);
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      firmId: input.context.firmId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });

  if (!client) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  await prisma.$transaction([
    prisma.clientProfile.updateMany({
      where: {
        id: client.id,
        firmId: input.context.firmId,
      },
      data: {
        portalEnabled: false,
        portalInviteCodeHash: null,
        portalInviteExpiresAt: null,
        portalOnboardingStatus: "Access Revoked",
      },
    }),
    prisma.clientPortalSession.deleteMany({
      where: {
        clientId: client.id,
      },
    }),
  ]);

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "client.portal.access.revoked",
    title: "Client portal access revoked",
    detail: `Secure portal access was revoked for ${client.fullName}.`,
    metadata: {
      clientId: client.id,
    },
    severity: "High",
  });

  return {
    clientId: client.id,
    revoked: true,
  };
}

function requireInboxStatus(value: unknown): AdvisorInboxStatus {
  const status = cleanText(value) as AdvisorInboxStatus;

  if (!ADVISOR_INBOX_STATUSES.includes(status)) {
    throw new ApiError({
      status: 400,
      code: "INVALID_INBOX_STATUS",
      message: "Invalid inbox status.",
      expose: true,
    });
  }

  return status;
}

async function requireWritableInboxItem(input: {
  context: AdvisorRoutingContext;
  itemId: unknown;
}) {
  const itemId = cleanText(input.itemId).slice(0, 160);
  const item = await prisma.advisorClientInboxItem.findFirst({
    where: {
      id: itemId,
      firmId: input.context.firmId,
      ...(input.context.canSuperviseInbox
        ? {}
        : {
            assignedAdvisorMembershipId: input.context.membership.id,
          }),
    },
    select: {
      id: true,
      clientId: true,
      assignedAdvisorMembershipId: true,
      readAt: true,
    },
  });

  if (!item) {
    throw new AccessControlError({
      status: 404,
      code: "INBOX_ITEM_NOT_FOUND",
      message: "Inbox item not found or is read-only for this advisor.",
    });
  }

  return item;
}

export async function updateAdvisorInboxStatus(input: {
  context: AdvisorRoutingContext;
  request: Request;
  itemId: unknown;
  status: unknown;
}) {
  const status = requireInboxStatus(input.status);
  const item = await requireWritableInboxItem({
    context: input.context,
    itemId: input.itemId,
  });
  const now = new Date();

  await prisma.advisorClientInboxItem.updateMany({
    where: {
      id: item.id,
      firmId: input.context.firmId,
      assignedAdvisorMembershipId: item.assignedAdvisorMembershipId,
    },
    data: {
      status,
      readAt: status === "Unread" ? null : item.readAt ?? now,
      resolvedAt: status === "Resolved" ? now : null,
    },
  });

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "advisor.inbox.status.changed",
    title: "Advisor inbox status changed",
    detail: `A client portal inbox item moved to ${status}.`,
    metadata: {
      itemId: item.id,
      clientId: item.clientId,
      status,
    },
    severity: "Low",
  });

  return {
    itemId: item.id,
    status,
  };
}

export async function replyToAdvisorInboxItem(input: {
  context: AdvisorRoutingContext;
  request: Request;
  itemId: unknown;
  body: unknown;
}) {
  const item = await requireWritableInboxItem({
    context: input.context,
    itemId: input.itemId,
  });
  const replyBody = cleanText(input.body).slice(0, 5_000);

  if (!replyBody) {
    throw new ApiError({
      status: 400,
      code: "REPLY_REQUIRED",
      message: "Reply text is required.",
      expose: true,
    });
  }

  const reply = await prisma.$transaction(async (transaction) => {
    const created = await transaction.advisorClientInboxReply.create({
      data: {
        inboxItemId: item.id,
        advisorMembershipId: input.context.membership.id,
        authorUserId: input.context.user.id,
        body: replyBody,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    await transaction.advisorClientInboxItem.updateMany({
      where: {
        id: item.id,
        firmId: input.context.firmId,
      },
      data: {
        status: "Waiting on Client",
        readAt: item.readAt ?? new Date(),
      },
    });

    return created;
  });

  await auditRouting({
    context: input.context,
    request: input.request,
    eventType: "advisor.inbox.reply.created",
    title: "Advisor replied to client portal item",
    detail: "A reply was saved for secure delivery to the client portal.",
    metadata: {
      itemId: item.id,
      clientId: item.clientId,
      replyId: reply.id,
    },
  });

  return {
    itemId: item.id,
    replyId: reply.id,
    createdAt: reply.createdAt,
  };
}