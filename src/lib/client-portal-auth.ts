import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { schedulingView } from "@/lib/scheduling";

export const CLIENT_PORTAL_SESSION_COOKIE = "slice_client_portal_session";

const clientSelect = {
  id: true,
  userId: true,
  firmId: true,
  assignedAdvisorMembershipId: true,
  assignedAdvisorAt: true,
  assignedByUserId: true,
  fullName: true,
  email: true,
  phone: true,
  householdName: true,
  preferredContactMethod: true,
  clientType: true,
  riskProfile: true,
  liquidityNeeds: true,
  timeHorizon: true,
  objective: true,
  portfolioValue: true,
  status: true,
  notes: true,
  portalEnabled: true,
  portalInviteCodeHash: true,
  portalInviteExpiresAt: true,
  portalOnboardingStatus: true,
  portalLastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const assignmentSelect = {
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

function portalSessionHours() {
  const parsed = Number(process.env.CLIENT_PORTAL_SESSION_HOURS);

  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(24 * 30, Math.round(parsed)));
}

export function hashClientPortalToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPortalInviteCode(value: string) {
  return hashClientPortalToken(value.trim());
}

async function resolvePortalClient(clientId: string) {
  const client = await prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      portalEnabled: true,
      firmId: {
        not: null,
      },
      assignedAdvisorMembershipId: {
        not: null,
      },
    },
    select: clientSelect,
  });

  if (!client?.firmId || !client.assignedAdvisorMembershipId) {
    return null;
  }

  const assignment = await prisma.firmMembership.findFirst({
    where: {
      id: client.assignedAdvisorMembershipId,
      firmId: client.firmId,
      status: "Active",
      firm: {
        platformStatus: "Active",
      },
      user: {
        platformStatus: {
          notIn: ["Banned", "Suspended"],
        },
      },
    },
    select: assignmentSelect,
  });

  if (!assignment) return null;

  return {
    client,
    assignment,
    scheduling: schedulingView({
      url: assignment.calendlyUrl,
      label: assignment.calendlyLabel,
      enabled: assignment.calendlyEnabled,
    }),
  };
}

export async function createClientPortalSession(clientId: string) {
  const portalClient = await resolvePortalClient(clientId);

  if (!portalClient) {
    throw new ApiError({
      status: 409,
      code: "CLIENT_PORTAL_ACCESS_UNAVAILABLE",
      message:
        "Client portal access requires an active firm and assigned advisor.",
      expose: true,
    });
  }

  const token = randomBytes(48).toString("base64url");
  const tokenHash = hashClientPortalToken(token);
  const expiresAt = new Date(
    Date.now() + portalSessionHours() * 60 * 60 * 1_000,
  );
  const now = new Date();

  await prisma.$transaction([
    prisma.clientPortalSession.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: now,
            },
          },
          {
            clientId,
          },
        ],
      },
    }),
    prisma.clientPortalSession.create({
      data: {
        clientId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    token,
    expiresAt,
    client: portalClient.client,
    assignment: portalClient.assignment,
    scheduling: portalClient.scheduling,
  };
}

export function clientPortalCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
    priority: "high" as const,
  };
}

export function clearClientPortalCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    maxAge: 0,
    path: "/",
    priority: "high" as const,
  };
}

export async function revokeClientPortalSession(token: string) {
  await prisma.clientPortalSession.deleteMany({
    where: {
      tokenHash: hashClientPortalToken(token),
    },
  });
}

export async function getCurrentClientPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_PORTAL_SESSION_COOKIE)?.value;

  if (!token) return null;

  const tokenHash = hashClientPortalToken(token);
  const session = await prisma.clientPortalSession.findFirst({
    where: {
      tokenHash,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      clientId: true,
      tokenHash: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!session) return null;

  const portalClient = await resolvePortalClient(session.clientId);

  if (!portalClient) {
    await prisma.clientPortalSession.deleteMany({
      where: {
        tokenHash,
      },
    });

    return null;
  }

  return {
    session,
    client: portalClient.client,
    assignment: portalClient.assignment,
    scheduling: portalClient.scheduling,
  };
}

export type ClientPortalSessionContext = NonNullable<
  Awaited<ReturnType<typeof getCurrentClientPortalSession>>
>;

export async function requireCurrentClientPortalSession() {
  const current = await getCurrentClientPortalSession();

  if (!current) {
    throw new ApiError({
      status: 401,
      code: "CLIENT_PORTAL_SESSION_REQUIRED",
      message: "Client portal session required.",
      expose: true,
    });
  }

  return current;
}