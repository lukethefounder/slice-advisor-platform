import "server-only";

import { NextResponse } from "next/server";

import {
  createSession,
  hashPassword,
  needsPasswordRehash,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import {
  isFounderEmail,
} from "@/lib/founder-access";
import {
  prisma,
} from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
  maskEmail,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function blockedResponse(
  message: string,
  status = 429,
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json(
    {
      error: message,
    },
    { status },
  );

  response.headers.set("Cache-Control", "no-store");

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

function genericInvalidLogin() {
  const response = NextResponse.json(
    {
      error: "Invalid email or password.",
    },
    { status: 401 },
  );

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  try {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      await recordSecurityEvent({
        eventType: "auth.login.cross_site_blocked",
        severity: "High",
        area: "Authentication",
        title: "Cross-site login request blocked",
        detail:
          "A login attempt was blocked because it appeared to come from a cross-site request.",
        request,
      });

      return blockedResponse("Security check failed.", 403);
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return blockedResponse("Invalid request format.", 415);
    }

    const ipLimit = checkRateLimit({
      key: `login:ip:${hashForSecurity(ip)}`,
      limit: 25,
      windowMs: 15 * 60 * 1000,
    });

    if (!ipLimit.allowed) {
      await recordSecurityEvent({
        eventType: "auth.login.ip_rate_limited",
        severity: "High",
        area: "Authentication",
        title: "Login IP rate limit triggered",
        detail:
          "Too many login attempts were made from the same IP fingerprint.",
        metadata: {
          limit: ipLimit.limit,
          resetAt: ipLimit.resetAt,
        },
        request,
      });

      return blockedResponse(
        "Too many login attempts. Try again later.",
        429,
        ipLimit.retryAfterSeconds,
      );
    }

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
        { status: 400 },
      );
    }

    const emailLimit = checkRateLimit({
      key: `login:email:${hashForSecurity(email)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    if (!emailLimit.allowed) {
      await recordSecurityEvent({
        eventType: "auth.login.email_rate_limited",
        severity: "High",
        area: "Authentication",
        title: "Login email rate limit triggered",
        detail: `Too many login attempts were made against ${maskEmail(email)}.`,
        metadata: {
          emailHash: hashForSecurity(email),
          limit: emailLimit.limit,
          resetAt: emailLimit.resetAt,
        },
        request,
      });

      return blockedResponse(
        "Too many login attempts. Try again later.",
        429,
        emailLimit.retryAfterSeconds,
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      await recordSecurityEvent({
        userId: user?.id ?? null,
        eventType: "auth.login.failed",
        severity: user ? "Medium" : "Low",
        area: "Authentication",
        title: "Failed login attempt",
        detail: user
          ? `Failed login attempt for known account ${maskEmail(email)}.`
          : `Failed login attempt for unknown account ${maskEmail(email)}.`,
        metadata: {
          emailHash: hashForSecurity(email),
          knownAccount: Boolean(user),
          betaAccess: true,
          temporaryLogin: false,
        },
        request,
      });

      return genericInvalidLogin();
    }

    if (user.platformStatus === "Banned") {
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.banned_blocked",
        severity: "Critical",
        area: "Authentication",
        title: "Banned account login blocked",
        detail: user.governanceReason || "Banned user attempted login.",
        request,
      });

      return NextResponse.json(
        {
          error:
            user.governanceReason ||
            "This account has been banned by platform governance.",
        },
        { status: 403 },
      );
    }

    if (user.platformStatus === "Suspended") {
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.suspended_blocked",
        severity: "High",
        area: "Authentication",
        title: "Suspended account login blocked",
        detail: user.governanceReason || "Suspended user attempted login.",
        request,
      });

      return NextResponse.json(
        {
          error:
            user.governanceReason ||
            "This account has been suspended by platform governance.",
        },
        { status: 403 },
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
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.no_active_firm",
        severity: "Medium",
        area: "Authentication",
        title: "Login blocked: no active firm workspace",
        detail:
          "A non-founder user attempted login without an active firm workspace.",
        request,
      });

      return NextResponse.json(
        {
          error:
            "This account is not connected to an active firm workspace. Ask a firm owner to invite or restore access.",
        },
        { status: 403 },
      );
    }

    if (needsPasswordRehash(user.passwordHash)) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash: hashPassword(password),
        },
      });
    }

    await prisma.userSecuritySetting.upsert({
      where: {
        userId: user.id,
      },
      update: {
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

    const session = await createSession(user.id);

    await recordSecurityEvent({
      userId: user.id,
      eventType: "auth.login.success",
      severity: "Info",
      area: "Authentication",
      title: "Successful beta login",
      detail: `Successful real-account login for ${maskEmail(user.email)}.`,
      metadata: {
        isFounder,
        firmId: activeMembership?.firmId ?? null,
        sessionExpiresAt: session.expiresAt,
        betaAccess: true,
        temporaryLogin: false,
      },
      request,
    });

    const response = NextResponse.json({
      user: publicUser(user),
      isFounder,
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
    await recordSecurityEvent({
      eventType: "auth.login.exception",
      severity: "High",
      area: "Authentication",
      title: "Login route exception",
      detail: error instanceof Error ? error.message : "Unknown login exception.",
      request,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Login failed: ${error.message}`
            : "Login failed: Unknown error",
      },
      { status: 500 },
    );
  }
}