import { prisma } from "@/lib/prisma";

export async function getActiveFirmMembership(userId: string, firmId?: string | null) {
  if (firmId) {
    return prisma.firmMembership.findFirst({
      where: {
        userId,
        firmId,
        status: "Active",
      },
      include: {
        firm: true,
      },
    });
  }

  return prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
    },
    include: {
      firm: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function requireFirmAccess(userId: string, firmId?: string | null) {
  const membership = await getActiveFirmMembership(userId, firmId);

  if (!membership) {
    throw new Error("Firm access required.");
  }

  return membership;
}

export function hasFirmPermission(
  membership: {
    role: string;
    canAccessPortfolios?: boolean;
    canManageProjects?: boolean;
    canInviteMembers?: boolean;
    canManageFirm?: boolean;
  },
  permission:
    | "view"
    | "portfolio"
    | "project"
    | "invite"
    | "admin"
    | "owner"
) {
  if (membership.role === "Owner") return true;

  if (permission === "view") return true;
  if (permission === "portfolio") return Boolean(membership.canAccessPortfolios);
  if (permission === "project") return Boolean(membership.canManageProjects);
  if (permission === "invite") return Boolean(membership.canInviteMembers);
  if (permission === "admin") return Boolean(membership.canManageFirm);
  if (permission === "owner") return membership.role === "Owner";

  return false;
}

export function scopedUserWhere(userId: string) {
  return {
    userId,
  };
}

export function scopedFirmWhere(userId: string, firmId: string) {
  return {
    userId,
    firmId,
  };
}