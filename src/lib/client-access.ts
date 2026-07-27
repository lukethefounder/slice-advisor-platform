import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

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
  firm: {
    id: string;
    name: string;
    firmEmail: string | null;
    firmCode: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
};

function normalizeRole(role: string | null | undefined) {
  return String(role ?? "").trim().toLowerCase();
}

function isUniqueError(error: unknown) {
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

async function createPersonalAdvisorFirm(user: {
  id: string;
  name: string;
  email: string;
}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const firm = await db.firm.create({
        data: {
          name: `${user.name || "Slice"} Advisory Firm`,
          firmEmail: user.email,
          firmCode: personalFirmCode(user.name),
          createdByUserId: user.id,
        },
      });

      return db.firmMembership.create({
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
        include: {
          firm: true,
          user: true,
        },
      });
    } catch (error) {
      if (!isUniqueError(error) || attempt === 3) throw error;
    }
  }

  throw new Error("Unable to initialize the advisor firm workspace.");
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
      "lead advisor",
      "principal",
      "firm admin",
      "admin",
      "manager",
      "managing partner",
    ].includes(role)
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
    role === "owner" ||
    role === "principal" ||
    role === "managing partner" ||
    (role === "member" && membership.canAccessPortfolios)
  );
}

export async function ensureAdvisorFirmContext(
  userId: string,
): Promise<AdvisorFirmContext> {
  let membership = (await db.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
    },
    include: {
      firm: true,
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })) as AdvisorFirmContext | null;

  if (!membership) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) throw new Error("Authenticated user was not found.");

    membership = (await createPersonalAdvisorFirm(user)) as AdvisorFirmContext;
  }

  await db.clientProfile.updateMany({
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

  return membership;
}

export async function accessibleClientWhere(userId: string) {
  const membership = await ensureAdvisorFirmContext(userId);

  if (canManageClientRouting(membership)) {
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

  const client = await db.clientProfile.findFirst({
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