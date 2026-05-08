import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  canUseTemporaryFounderBootstrap,
  TEMP_FOUNDER_EMAIL,
  TEMP_FOUNDER_NAME,
  TEMP_FOUNDER_PASSWORD,
} from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (!canUseTemporaryFounderBootstrap()) {
    return NextResponse.json(
      {
        error:
          "Temporary founder bootstrap is disabled in production. Set ENABLE_TEMP_FOUNDER=true only if you intentionally want it enabled.",
      },
      { status: 403 }
    );
  }

  try {
    const user = await prisma.user.upsert({
      where: {
        email: TEMP_FOUNDER_EMAIL,
      },
      update: {
        name: TEMP_FOUNDER_NAME,
        passwordHash: hashPassword(TEMP_FOUNDER_PASSWORD),
        platformStatus: "Active",
        governanceReason: null,
        governedAt: null,
      },
      create: {
        name: TEMP_FOUNDER_NAME,
        email: TEMP_FOUNDER_EMAIL,
        passwordHash: hashPassword(TEMP_FOUNDER_PASSWORD),
        platformStatus: "Active",
        governanceReason: null,
        governedAt: null,
      },
    });

    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });

    const session = await createSession(user.id);

    const response = NextResponse.json({
      user: publicUser(user),
      credentials: {
        email: TEMP_FOUNDER_EMAIL,
        password: TEMP_FOUNDER_PASSWORD,
      },
      message:
        "Temporary founder account created/reset and logged in. No new firm workspace was created.",
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
        error: "Founder bootstrap failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}