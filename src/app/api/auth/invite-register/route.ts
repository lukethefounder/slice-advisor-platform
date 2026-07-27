import "server-only";

import { NextResponse } from "next/server";

import {
  createSession,
  hashPassword,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import {
  prisma,
} from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEAM_COLORS = [
  "#10b981",
  "#34d399",
  "#059669",
  "#14b8a6",
  "#2dd4bf",
  "#22d3ee",
  "#84cc16",
  "#65a30d",
  "#0ea5e9",
  "#06b6d4",
];

function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function permissionPreset(roleValue: string) {
  const role = roleValue.trim().toLowerCase();

  if (
    role === "admin" ||
    role === "principal advisor" ||
    role === "lead advisor" ||
    role === "chief compliance officer"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: false,
    };
  }

  if (
    role === "senior wealth advisor" ||
    role === "portfolio manager" ||
    role === "compliance officer"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  if (
    role === "associate advisor" ||
    role === "service advisor" ||
    role === "investment analyst" ||
    role === "financial planning analyst" ||
    role === "paraplanner" ||
    role === "client service associate" ||
    role === "relationship manager" ||
    role === "operations associate" ||
    role === "ops"
  ) {
    return {
      canAccessPortfolios: true,
      canManageProjects: role !== "client service associate",
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  return {
    canAccessPortfolios: false,
    canManageProjects: false,
    canInviteMembers: false,
    canManageFirm: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      inviteCode?: string;
      name?: string;
      password?: string;
    };
    const inviteCode = body.inviteCode?.trim().toUpperCase();
    const name = body.name?.trim();
    const password = body.password ?? "";

    if (!inviteCode) {
      return NextResponse.json(
        {
          error: "Invite code is required.",
        },
        { status: 400 },
      );
    }

    const invite = await prisma.firmInvite.findUnique({
      where: {
        inviteCode,
      },
      include: {
        firm: true,
      },
    });

    if (!invite || invite.status !== "Pending") {
      return NextResponse.json(
        {
          error: "Invite not found or no longer pending.",
        },
        { status: 404 },
      );
    }

    if (invite.firm.platformStatus !== "Active") {
      return NextResponse.json(
        {
          error:
            invite.firm.governanceReason ||
            "This firm workspace is not currently active.",
        },
        { status: 403 },
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.firmInvite
        .update({
          where: {
            id: invite.id,
          },
          data: {
            status: "Expired",
          },
        })
        .catch(() => undefined);

      return NextResponse.json(
        {
          error: "Invite has expired. Ask the firm to send a new invitation.",
        },
        { status: 410 },
      );
    }

    const invitedEmail = invite.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: {
        email: invitedEmail,
      },
    });

    if (
      existingUser &&
      (existingUser.platformStatus === "Banned" ||
        existingUser.platformStatus === "Suspended")
    ) {
      return NextResponse.json(
        {
          error:
            existingUser.governanceReason ||
            "This account is blocked by platform governance.",
        },
        { status: 403 },
      );
    }

    if (!existingUser && (!name || password.length < 8)) {
      return NextResponse.json(
        {
          error:
            "Name and a password of at least 8 characters are required to create the invited account.",
        },
        { status: 400 },
      );
    }

    if (
      existingUser &&
      !verifyPassword(password, existingUser.passwordHash)
    ) {
      return NextResponse.json(
        {
          error:
            "This invitation email already has a Slice account. Enter that account password to connect the firm membership.",
        },
        { status: 401 },
      );
    }

    const memberCount = await prisma.firmMembership.count({
      where: {
        firmId: invite.firmId,
        status: "Active",
      },
    });
    const permissions = permissionPreset(invite.role);

    const result = await prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            name: name || invitedEmail,
            email: invitedEmail,
            passwordHash: hashPassword(password),
            platformStatus: "Active",
          },
        }));

      const membership = await tx.firmMembership.upsert({
        where: {
          firmId_userId: {
            firmId: invite.firmId,
            userId: user.id,
          },
        },
        update: {
          status: "Active",
          role: invite.role,
          calendarColor: teamColor(memberCount),
          ...permissions,
        },
        create: {
          firmId: invite.firmId,
          userId: user.id,
          role: invite.role,
          status: "Active",
          calendarColor: teamColor(memberCount),
          ...permissions,
        },
      });

      const acceptedInvite = await tx.firmInvite.update({
        where: {
          id: invite.id,
        },
        data: {
          status: "Accepted",
          acceptedAt: new Date(),
        },
      });

      await tx.userSecuritySetting.upsert({
        where: {
          userId: user.id,
        },
        update: {
          advisorModeEnabled: true,
          lastSecurityReviewAt: new Date(),
        },
        create: {
          userId: user.id,
          mfaEnabled: false,
          requireReauthForSensitiveActions: true,
          alertOnNewLogin: true,
          advisorModeEnabled: true,
          sessionTimeoutMinutes: 720,
          lastSecurityReviewAt: new Date(),
        },
      });

      const existingWatchlist = await tx.namedWatchlist.findFirst({
        where: {
          userId: user.id,
        },
      });

      if (!existingWatchlist) {
        await tx.namedWatchlist.create({
          data: {
            userId: user.id,
            name: "Main Watchlist",
            description:
              "Live securities and ideas selected by the advisor. No demo observations are preloaded.",
            focus: "General",
            riskLevel: "Mixed",
          },
        });
      }

      return {
        user,
        membership,
        acceptedInvite,
      };
    });

    const session = await createSession(result.user.id);
    const response = NextResponse.json({
      user: publicUser(result.user),
      firm: invite.firm,
      membership: result.membership,
      invite: result.acceptedInvite,
      betaAccess: true,
    });

    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invite acceptance failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}