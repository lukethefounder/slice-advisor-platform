import { NextResponse } from "next/server";
import {
  createSession,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    if (user.platformStatus === "Banned") {
      return NextResponse.json(
        {
          error:
            user.governanceReason ||
            "This account has been banned by platform governance.",
        },
        { status: 403 }
      );
    }

    if (user.platformStatus === "Suspended") {
      return NextResponse.json(
        {
          error:
            user.governanceReason ||
            "This account has been suspended by platform governance.",
        },
        { status: 403 }
      );
    }

    const isFounder = isFounderEmail(user.email);

    const activeMembership = await prisma.firmMembership.findFirst({
      where: {
        userId: user.id,
        status: "Active",
        firm: {
          platformStatus: "Active",
        },
      },
    });

    if (!isFounder && !activeMembership) {
      return NextResponse.json(
        {
          error:
            "This account is not connected to an active firm workspace. Ask a firm owner to invite or restore access.",
        },
        { status: 403 }
      );
    }

    const session = await createSession(user.id);

    const response = NextResponse.json({
      user: publicUser(user),
      isFounder,
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
        error: "Login failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}