import { NextResponse } from "next/server";
import {
  createSession,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import {
  TEMP_FIRM_ADVISOR_EMAIL,
  TEMP_FOUNDER_EMAIL,
  isFounderEmail,
  temporaryLoginsEnabled,
} from "@/lib/founder-access";
import { ensureTemporaryLogins } from "@/lib/temporary-logins";
import { prisma } from "@/lib/prisma";

function isTemporaryLoginEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return (
    normalizedEmail === TEMP_FOUNDER_EMAIL ||
    normalizedEmail === TEMP_FIRM_ADVISOR_EMAIL
  );
}

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

    const temporarySeedResult = isTemporaryLoginEmail(email)
      ? await ensureTemporaryLogins()
      : null;

    if (
      isTemporaryLoginEmail(email) &&
      !temporaryLoginsEnabled()
    ) {
      return NextResponse.json(
        {
          error:
            "Temporary logins are disabled. Add ENABLE_TEMP_LOGINS=true to .env.local, restart the dev server, and try again.",
        },
        { status: 403 }
      );
    }

    let user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user && isTemporaryLoginEmail(email)) {
      await ensureTemporaryLogins();

      user = await prisma.user.findUnique({
        where: {
          email,
        },
      });
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        {
          error:
            isTemporaryLoginEmail(email)
              ? "Temporary login was found, but the password does not match. Use SliceFounder!2026 for founder or SliceAdvisor!2026 for firm advisor."
              : "Invalid email or password.",
          seedError: temporarySeedResult?.seedError ?? null,
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
          seedError: temporarySeedResult?.seedError ?? null,
        },
        { status: 403 }
      );
    }

    const session = await createSession(user.id);

    const response = NextResponse.json({
      user: publicUser(user),
      isFounder,
      temporarySeedError: temporarySeedResult?.seedError ?? null,
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
        error:
          error instanceof Error
            ? `Login failed: ${error.message}`
            : "Login failed: Unknown error",
      },
      { status: 500 }
    );
  }
}