import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  publicUser,
  seedStarterData,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function firmCode(name: string) {
  const clean = name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

  return `${clean || "FIRM"}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      firmName?: string;
      firmEmail?: string;
      name?: string;
      email?: string;
      password?: string;
    };

    const firmName = body.firmName?.trim();
    const firmEmail = body.firmEmail?.trim().toLowerCase() || null;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!firmName || !name || !email || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Firm name, owner name, owner email, and a password of at least 8 characters are required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An account already exists with that email. Log in instead, or use a different firm owner email.",
        },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
        },
      });

      const firm = await tx.firm.create({
        data: {
          name: firmName,
          firmEmail,
          firmCode: firmCode(firmName),
          createdByUserId: user.id,
        },
      });

      const membership = await tx.firmMembership.create({
        data: {
          firmId: firm.id,
          userId: user.id,
          role: "Owner",
          status: "Active",
          calendarColor: "#ef4444",
          canAccessPortfolios: true,
          canManageProjects: true,
          canInviteMembers: true,
          canManageFirm: true,
        },
      });

      return {
        user,
        firm,
        membership,
      };
    });

    await seedStarterData(result.user.id);

    const session = await createSession(result.user.id);

    const response = NextResponse.json({
      user: publicUser(result.user),
      firm: result.firm,
      membership: result.membership,
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
        error: "Firm registration failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}