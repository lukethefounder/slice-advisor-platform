import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ApiError, withApiRoute } from "@/lib/api-route";
import {
  clearSessionCookieOptions,
  getCurrentUser,
  hashSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isPotentiallyCrossSiteUnsafeRequest,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiRoute(
  {
    route: "/api/auth/logout",
    timeoutMs: 10_000,
  },
  async ({ request, log }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_REQUEST_BLOCKED",
        message: "Security policy blocked this logout request.",
        expose: true,
      });
    }

    const user = await getCurrentUser();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await prisma.session.deleteMany({
        where: {
          tokenHash: hashSessionToken(token),
        },
      });
    }

    if (user) {
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.logout.success",
        severity: "Info",
        area: "Authentication",
        title: "User signed out",
        detail: "The active browser session was revoked.",
        request,
      }).catch((error) => {
        log.error("security_event.failed", error, {
          eventType: "auth.logout.success",
        });
      });
    }

    const response = NextResponse.json({
      ok: true,
    });

    response.cookies.set(
      SESSION_COOKIE,
      "",
      clearSessionCookieOptions(),
    );

    return response;
  },
);