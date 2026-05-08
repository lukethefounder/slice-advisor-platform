import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TEAM_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#06b6d4",
];

function teamColor(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

function permissionPreset(role: string) {
  if (role === "Admin") {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: true,
      canManageFirm: false,
    };
  }

  if (role === "Advisor") {
    return {
      canAccessPortfolios: true,
      canManageProjects: true,
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  if (role === "Viewer") {
    return {
      canAccessPortfolios: false,
      canManageProjects: false,
      canInviteMembers: false,
      canManageFirm: false,
    };
  }

  return {
    canAccessPortfolios: true,
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
        { status: 400 }
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
        { status: 404 }
      );
    }

    if (invite.firm.platformStatus !== "Active") {
      return NextResponse.json(
        {
          error:
            invite.firm.governanceReason ||
            "This firm workspace is not currently active.",
        },
        { status: 403 }
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json(
        {
          error: "Invite has expired. Ask the firm to send a new invite.",
        },
        { status: 410 }
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
        { status: 403 }
      );
    }

    if (!existingUser && (!name || password.length < 8)) {
      return NextResponse.json(
        {
          error:
            "Name and a password of at least 8 characters are required to accept this firm invite.",
        },
        { status: 400 }
      );
    }

    if (existingUser && !verifyPassword(password, existingUser.passwordHash)) {
      return NextResponse.json(
        {
          error:
            "This invite email already has a Slice account. Enter that account password to accept the invite.",
        },
        { status: 401 }
      );
    }

    const memberCount = await prisma.firmMembership.count({
      where: {
        firmId: invite.firmId,
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
    });

    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt)
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invite acceptance failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}