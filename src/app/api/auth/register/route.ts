import "server-only";

import {
  randomBytes,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  createSession,
  hashPassword,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  prisma,
} from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function firmCode(name: string) {
  const prefix = name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix || "FIRM"}-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
        { status: 400 },
      );
    }

    if (!validEmail(email) || (firmEmail && !validEmail(firmEmail))) {
      return NextResponse.json(
        {
          error: "Enter valid advisor and firm email addresses.",
        },
        { status: 400 },
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
            "An account already exists with that email. Sign in or use a secure firm invitation.",
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          platformStatus: "Active",
        },
      });
      const firm = await tx.firm.create({
        data: {
          name: firmName,
          firmEmail,
          firmCode: firmCode(firmName),
          createdByUserId: user.id,
          platformStatus: "Active",
        },
      });
      const membership = await tx.firmMembership.create({
        data: {
          firmId: firm.id,
          userId: user.id,
          role: "Owner",
          status: "Active",
          calendarColor: "#10b981",
          canAccessPortfolios: true,
          canManageProjects: true,
          canInviteMembers: true,
          canManageFirm: true,
        },
      });

      await tx.namedWatchlist.create({
        data: {
          userId: user.id,
          name: "Main Watchlist",
          description:
            "Live securities and ideas selected by the advisor. No demo prices are preloaded.",
          focus: "General",
          riskLevel: "Mixed",
        },
      });

      await tx.userSecuritySetting.create({
        data: {
          userId: user.id,
          mfaEnabled: false,
          requireReauthForSensitiveActions: true,
          alertOnNewLogin: true,
          advisorModeEnabled: true,
          sessionTimeoutMinutes: 720,
          lastSecurityReviewAt: new Date(),
        },
      });

      return {
        user,
        firm,
        membership,
      };
    });

    const session = await createSession(result.user.id);
    const response = NextResponse.json({
      user: publicUser(result.user),
      firm: result.firm,
      membership: result.membership,
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
        error: "Firm registration failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}