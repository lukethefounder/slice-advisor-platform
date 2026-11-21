import "server-only";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { apiJson, withApiRoute } from "@/lib/api-route";
import {
  createSession,
  hashPassword,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/account-security/policy";
import { requireSecurityOrigin, securityJson } from "@/lib/account-security/service";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  getClientIp,
  hashForSecurity,
  maskEmail,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function validEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firmCode(name: string) {
  const prefix = name.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `${prefix || "FIRM"}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export const POST = withApiRoute(
  {
    route: "/api/auth/register",
    timeoutMs: 25_000,
    cacheControl: "private, no-store",
  },
  async ({ request, log }) => {
    requireSecurityOrigin(request);
    const body = await securityJson(request);

    const firmName = clean(body.firmName, 200);
    const firmEmail = clean(body.firmEmail, 320).toLowerCase() || null;
    const name = clean(body.name, 160);
    const email = clean(body.email, 320).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const issue = passwordProblem(password);

    if (!firmName || !name || !email || issue) {
      return apiJson(
        {
          error:
            issue || "Firm name, owner name, owner email, and password are required.",
        },
        { status: 400 },
      );
    }

    if (!validEmail(email) || (firmEmail && !validEmail(firmEmail))) {
      return apiJson(
        { error: "Enter valid advisor and firm email addresses." },
        { status: 400 },
      );
    }

    const ipKey = hashForSecurity(getClientIp(request));
    const emailKey = hashForSecurity(email);
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit({
        key: ipKey,
        scope: "auth.register.ip",
        limit: 8,
        windowMs: 60 * 60_000,
        failOpen: false,
      }),
      consumeRateLimit({
        key: emailKey,
        scope: "auth.register.email",
        limit: 3,
        windowMs: 24 * 60 * 60_000,
        failOpen: false,
      }),
    ]);
    const blockingLimit = !ipLimit.allowed ? ipLimit : !emailLimit.allowed ? emailLimit : null;

    if (blockingLimit) {
      await recordSecurityEvent({
        eventType: "auth.register.rate_limited",
        severity: "High",
        area: "Authentication",
        title: "Registration rate limit triggered",
        detail: `Registration attempts were limited for ${maskEmail(email)}.`,
        metadata: {
          scope: blockingLimit.scope,
          resetAt: blockingLimit.resetAt,
        },
        request,
      }).catch((error) => log.error("registration.audit_failed", error));

      return apiJson(
        { error: "Too many registration attempts. Try again later." },
        { status: 429, headers: rateLimitHeaders(blockingLimit) },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return apiJson(
        {
          error:
            "This email cannot be registered. Sign in or use a secure firm invitation.",
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          platformStatus: "Active",
        },
      });
      const firm = await transaction.firm.create({
        data: {
          name: firmName,
          firmEmail,
          firmCode: firmCode(firmName),
          createdByUserId: user.id,
          platformStatus: "Active",
        },
      });
      const membership = await transaction.firmMembership.create({
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

      await Promise.all([
        transaction.namedWatchlist.create({
          data: {
            userId: user.id,
            name: "Main Watchlist",
            description:
              "Live securities and ideas selected by the advisor. No demo prices are preloaded.",
            focus: "General",
            riskLevel: "Mixed",
          },
        }),
        transaction.userSecuritySetting.create({
          data: {
            userId: user.id,
            mfaEnabled: false,
            requireReauthForSensitiveActions: true,
            alertOnNewLogin: true,
            advisorModeEnabled: true,
            sessionTimeoutMinutes: 720,
            lastSecurityReviewAt: new Date(),
          },
        }),
      ]);

      return { user, firm, membership };
    });

    const session = await createSession(result.user.id, { expectedPasswordHash: result.user.passwordHash, request });

    await recordSecurityEvent({
      userId: result.user.id,
      eventType: "auth.register.success",
      severity: "Info",
      area: "Authentication",
      title: "Firm owner account registered",
      detail: `A firm owner account was registered for ${maskEmail(email)}.`,
      metadata: {
        firmId: result.firm.id,
        membershipId: result.membership.id,
      },
      request,
    }).catch((error) => log.error("registration.audit_failed", error));

    const response = NextResponse.json(
      {
        user: publicUser(result.user),
        firm: result.firm,
        membership: result.membership,
        betaAccess: true,
      },
      { status: 201 },
    );
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    return response;
  },
);
