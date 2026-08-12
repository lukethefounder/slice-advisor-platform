import "server-only";

import { randomBytes } from "node:crypto";

import {
  AccessControlError,
  getAccessContextForUser,
  hasFirmPermission,
} from "@/lib/access-control";
import { isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";

export type AdvisorFirmContext = {
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
  firm: {
    id: string;
    name: string;
    firmEmail: string | null;
    firmCode: string;
    platformStatus: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
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
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

function normalizeRole(role: string | null | undefined) {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}

function personalFirmCode(name: string) {
  const prefix =
    name
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 8)
      .toUpperCase() || "SLICE";

  return `${prefix}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

async function findActiveMembership(userId: string) {
  return prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
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

async function createFounderWorkspace(user: {
  id: string;
  name: string;
  email: string;
}) {
  const existingFirm = await prisma.firm.findFirst({
    where: {
      createdByUserId: user.id,
      platformStatus: "Active",
    },
    select: {
      id: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingFirm) {
    return prisma.firmMembership.upsert({
      where: {
        firmId_userId: {
          firmId: existingFirm.id,
          userId: user.id,
        },
      },
      update: {
        role: "Owner",
        status: "Active",
        canAccessPortfolios: true,
        canManageProjects: true,
        canInviteMembers: true,
        canManageFirm: true,
      },
      create: {
        firmId: existingFirm.id,
        userId: user.id,
        role: "Owner",
        status: "Active",
        canAccessPortfolios: true,
        canManageProjects: true,
        canInviteMembers: true,
        canManageFirm: true,
        calendarColor: "#10b981",
        calendlyLabel: "Schedule a meeting",
        calendlyEnabled: true,
      },
      select: membershipSelect,
    });
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const firm = await transaction.firm.create({
          data: {
            name: `${user.name || "Slice"} Advisory Firm`,
            firmEmail: user.email,
            firmCode: personalFirmCode(user.name),
            createdByUserId: user.id,
          },
          select: {
            id: true,
          },
        });

        return transaction.firmMembership.create({
          data: {
            firmId: firm.id,
            userId: user.id,
            role: "Owner",
            status: "Active",
            canAccessPortfolios: true,
            canManageProjects: true,
            canInviteMembers: true,
            canManageFirm: true,
            calendarColor: "#10b981",
            calendlyLabel: "Schedule a meeting",
            calendlyEnabled: true,
          },
          select: membershipSelect,
        });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 3) {
        throw error;
      }
    }
  }

  throw new AccessControlError({
    status: 409,
    code: "FIRM_INITIALIZATION_FAILED",
    message: "Unable to initialize the advisor firm workspace.",
  });
}

async function adoptLegacyPersonalClients(
  userId: string,
  membership: AdvisorFirmContext,
) {
  if (!canManageClientRouting(membership)) return;

  await prisma.clientProfile.updateMany({
    where: {
      userId,
      firmId: null,
    },
    data: {
      firmId: membership.firmId,
      assignedAdvisorMembershipId: membership.id,
      assignedAdvisorAt: new Date(),
      assignedByUserId: userId,
    },
  });
}

export function canManageClientRouting(
  membership: Pick<
    AdvisorFirmContext,
    "role" | "canManageFirm" | "canInviteMembers"
  >,
) {
  const role = normalizeRole(membership.role);

  return (
    membership.canManageFirm ||
    membership.canInviteMembers ||
    [
      "owner",
      "founder",
      "lead advisor",
      "principal",
      "firm admin",
      "administrator",
      "admin",
      "manager",
      "managing partner",
    ].some((candidate) => role === candidate || role.includes(candidate))
  );
}

export function isAdvisorMembership(
  membership: Pick<AdvisorFirmContext, "role" | "canAccessPortfolios">,
) {
  const role = normalizeRole(membership.role);

  if (
    role.includes("compliance") ||
    role.includes("client service") ||
    role.includes("operations") ||
    role.includes("marketing") ||
    role.includes("assistant")
  ) {
    return false;
  }

  return (
    role.includes("advisor") ||
    role.includes("portfolio manager") ||
    role.includes("wealth manager") ||
    role.includes("financial planner") ||
    role === "owner" ||
    role === "founder" ||
    role === "principal" ||
    role === "managing partner" ||
    (role === "member" && membership.canAccessPortfolios)
  );
}

export async function ensureAdvisorFirmContext(
  userId: string,
): Promise<AdvisorFirmContext> {
  let membership = await findActiveMembership(userId);

  if (!membership) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        platformStatus: true,
      },
    });

    if (
      !user ||
      user.platformStatus === "Banned" ||
      user.platformStatus === "Suspended"
    ) {
      throw new AccessControlError({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required.",
      });
    }

    if (!isFounderEmail(user.email)) {
      throw new AccessControlError({
        status: 403,
        code: "ACTIVE_FIRM_REQUIRED",
        message:
          "This account is not connected to an active firm workspace. Ask a firm owner to restore access.",
      });
    }

    membership = await createFounderWorkspace(user);
  }

  if (membership.firm.platformStatus !== "Active") {
    throw new AccessControlError({
      status: 403,
      code: "FIRM_INACTIVE",
      message: "This firm workspace is not active.",
    });
  }

  const typedMembership = membership as AdvisorFirmContext;
  await adoptLegacyPersonalClients(userId, typedMembership);

  return typedMembership;
}

export async function accessibleClientWhere(userId: string) {
  const membership = await ensureAdvisorFirmContext(userId);
  const context = await getAccessContextForUser({
    userId,
    firmId: membership.firmId,
  });

  if (!context) {
    throw new AccessControlError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    });
  }

  if (
    context.isFounder ||
    hasFirmPermission(context, "clients.supervise")
  ) {
    return {
      membership,
      where: {
        firmId: membership.firmId,
      },
    };
  }

  return {
    membership,
    where: {
      firmId: membership.firmId,
      assignedAdvisorMembershipId: membership.id,
    },
  };
}

export async function findAccessibleClient(input: {
  userId: string;
  clientId: string;
}) {
  const { membership, where } = await accessibleClientWhere(input.userId);

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: input.clientId,
      ...where,
    },
  });

  return {
    membership,
    client,
  };
}

export async function requireAccessibleClient(input: {
  userId: string;
  clientId: string;
}) {
  const result = await findAccessibleClient(input);

  if (!result.client) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  return {
    membership: result.membership,
    client: result.client,
  };
}