import "server-only";

import { ApiError } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import { isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";

export const FIRM_PERMISSIONS = [
  "firm.read",
  "firm.manage",
  "members.read",
  "members.invite",
  "clients.read",
  "clients.manage",
  "clients.assign",
  "clients.supervise",
  "portfolios.read",
  "projects.manage",
  "calendar.manage",
  "inbox.read",
  "inbox.supervise",
  "security.review",
] as const;

export type FirmPermission = (typeof FIRM_PERMISSIONS)[number];

export type AccessUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  platformStatus: string;
};

export type AccessFirm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
  platformStatus: string;
};

export type AccessMembership = {
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
  firm: AccessFirm;
};

export type AccessContext = {
  user: AccessUser;
  isFounder: boolean;
  membership: AccessMembership | null;
  firm: AccessFirm | null;
  permissions: FirmPermission[];
};

const membershipSelect = {
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
  firm: {
    select: {
      id: true,
      name: true,
      firmEmail: true,
      firmCode: true,
      platformStatus: true,
    },
  },
} as const;

const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  platformStatus: true,
} as const;

function normalizedRole(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function roleMatches(role: string, candidates: string[]) {
  return candidates.some(
    (candidate) => role === candidate || role.includes(candidate),
  );
}

export function permissionsForMembership(input: {
  role: string;
  canAccessPortfolios: boolean;
  canManageProjects: boolean;
  canInviteMembers: boolean;
  canManageFirm: boolean;
}) {
  const role = normalizedRole(input.role);
  const permissions = new Set<FirmPermission>([
    "firm.read",
    "members.read",
    "clients.read",
    "calendar.manage",
    "inbox.read",
  ]);

  const managementRole = roleMatches(role, [
    "owner",
    "founder",
    "principal",
    "managing partner",
    "lead advisor",
    "firm admin",
    "administrator",
    "admin",
    "manager",
  ]);

  const advisorRole = roleMatches(role, [
    "advisor",
    "wealth manager",
    "portfolio manager",
    "financial planner",
  ]);

  const supervisoryRole = roleMatches(role, [
    "compliance",
    "supervisor",
    "chief compliance",
  ]);

  if (input.canAccessPortfolios || advisorRole || managementRole) {
    permissions.add("portfolios.read");
  }

  if (advisorRole || managementRole) {
    permissions.add("clients.manage");
  }

  if (input.canManageProjects || managementRole) {
    permissions.add("projects.manage");
  }

  if (input.canInviteMembers || managementRole) {
    permissions.add("members.invite");
  }

  if (input.canManageFirm || managementRole) {
    permissions.add("firm.manage");
    permissions.add("clients.assign");
    permissions.add("clients.supervise");
    permissions.add("inbox.supervise");
    permissions.add("security.review");
  }

  if (supervisoryRole) {
    permissions.add("clients.supervise");
    permissions.add("inbox.supervise");
    permissions.add("security.review");
  }

  return Array.from(permissions);
}

function allPermissions() {
  return [...FIRM_PERMISSIONS];
}

export function hasFirmPermission(
  context: Pick<AccessContext, "isFounder" | "permissions">,
  permission: FirmPermission,
) {
  return context.isFounder || context.permissions.includes(permission);
}

export class AccessControlError extends ApiError {
  constructor(input: {
    status: 401 | 403 | 404 | 409;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    super({
      ...input,
      expose: true,
    });
    this.name = "AccessControlError";
  }
}

async function findMembership(input: {
  userId: string;
  firmId?: string | null;
}) {
  return prisma.firmMembership.findFirst({
    where: {
      userId: input.userId,
      status: "Active",
      ...(input.firmId ? { firmId: input.firmId } : {}),
      firm: {
        platformStatus: "Active",
      },
    },
    select: membershipSelect,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function findFounderFirm(firmId: string) {
  return prisma.firm.findFirst({
    where: {
      id: firmId,
      platformStatus: "Active",
    },
    select: {
      id: true,
      name: true,
      firmEmail: true,
      firmCode: true,
      platformStatus: true,
    },
  });
}

export async function getAccessContextForUser(input: {
  userId: string;
  firmId?: string | null;
}): Promise<AccessContext | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      platformStatus: {
        notIn: ["Banned", "Suspended"],
      },
    },
    select: userSelect,
  });

  if (!user) return null;

  const isFounder = isFounderEmail(user.email);
  const membership = await findMembership({
    userId: user.id,
    firmId: input.firmId,
  });

  if (membership) {
    return {
      user,
      isFounder,
      membership,
      firm: membership.firm,
      permissions: isFounder
        ? allPermissions()
        : permissionsForMembership(membership),
    };
  }

  if (input.firmId && isFounder) {
    const firm = await findFounderFirm(input.firmId);

    if (!firm) {
      throw new AccessControlError({
        status: 404,
        code: "FIRM_NOT_FOUND",
        message: "Firm workspace not found.",
      });
    }

    return {
      user,
      isFounder: true,
      membership: null,
      firm,
      permissions: allPermissions(),
    };
  }

  return {
    user,
    isFounder,
    membership: null,
    firm: null,
    permissions: isFounder ? allPermissions() : [],
  };
}

export async function getCurrentAccessContext(options: {
  firmId?: string | null;
} = {}) {
  const currentUser = await getCurrentUser();

  if (!currentUser) return null;

  return getAccessContextForUser({
    userId: currentUser.id,
    firmId: options.firmId,
  });
}

export async function requireCurrentAccessContext(options: {
  firmId?: string | null;
  permission?: FirmPermission;
  requireFirm?: boolean;
} = {}) {
  const context = await getCurrentAccessContext({
    firmId: options.firmId,
  });

  if (!context) {
    throw new AccessControlError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    });
  }

  if ((options.requireFirm ?? Boolean(options.permission)) && !context.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  if (
    options.permission &&
    !hasFirmPermission(context, options.permission)
  ) {
    throw new AccessControlError({
      status: 403,
      code: "PERMISSION_DENIED",
      message: "You do not have permission to perform this action.",
      details: {
        permission: options.permission,
      },
    });
  }

  return context;
}

export function clientScopeWhere(context: AccessContext) {
  if (!context.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  if (
    context.isFounder ||
    hasFirmPermission(context, "clients.supervise")
  ) {
    return {
      firmId: context.firm.id,
    };
  }

  if (!context.membership) {
    throw new AccessControlError({
      status: 403,
      code: "MEMBERSHIP_REQUIRED",
      message: "An active firm membership is required.",
    });
  }

  return {
    firmId: context.firm.id,
    assignedAdvisorMembershipId: context.membership.id,
  };
}

export function inboxScopeWhere(context: AccessContext) {
  if (!context.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  if (
    context.isFounder ||
    hasFirmPermission(context, "inbox.supervise")
  ) {
    return {
      firmId: context.firm.id,
    };
  }

  if (!context.membership) {
    throw new AccessControlError({
      status: 403,
      code: "MEMBERSHIP_REQUIRED",
      message: "An active firm membership is required.",
    });
  }

  return {
    firmId: context.firm.id,
    assignedAdvisorMembershipId: context.membership.id,
  };
}

export async function requireClientInScope(input: {
  context: AccessContext;
  clientId: string;
}) {
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      ...clientScopeWhere(input.context),
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

export async function requireMembershipInFirm(input: {
  context: AccessContext;
  membershipId: string;
}) {
  if (!input.context.firm) {
    throw new AccessControlError({
      status: 403,
      code: "ACTIVE_FIRM_REQUIRED",
      message: "An active firm workspace is required.",
    });
  }

  const membership = await prisma.firmMembership.findFirst({
    where: {
      id: input.membershipId,
      firmId: input.context.firm.id,
      status: "Active",
      firm: {
        platformStatus: "Active",
      },
    },
    select: membershipSelect,
  });

  if (!membership) {
    throw new AccessControlError({
      status: 404,
      code: "MEMBERSHIP_NOT_FOUND",
      message: "Firm member not found.",
    });
  }

  return membership;
}

export function publicAccessContext(context: AccessContext) {
  return {
    user: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
      createdAt: context.user.createdAt,
    },
    isFounder: context.isFounder,
    firm: context.firm,
    membership: context.membership
      ? {
          id: context.membership.id,
          firmId: context.membership.firmId,
          role: context.membership.role,
          status: context.membership.status,
          canAccessPortfolios: context.membership.canAccessPortfolios,
          canManageProjects: context.membership.canManageProjects,
          canInviteMembers: context.membership.canInviteMembers,
          canManageFirm: context.membership.canManageFirm,
          calendarColor: context.membership.calendarColor,
          calendlyUrl:
            context.membership.calendlyEnabled &&
            context.membership.calendlyUrl
              ? context.membership.calendlyUrl
              : null,
          calendlyLabel: context.membership.calendlyLabel,
          calendlyEnabled: context.membership.calendlyEnabled,
        }
      : null,
    permissions: context.permissions,
  };
}