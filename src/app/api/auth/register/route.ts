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
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import {
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
  maskEmail,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "qwerty123",
  "letmein123",
  "welcome123",
  "slice1234",
]);

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

function passwordIssue(password: string) {
  if (password.length < 10) return "Use a password containing at least 10 characters.";
  if (password.length > 128) return "Password must contain no more than 128 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Choose a less common password.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export const POST = withApiRoute(
  {
    route: "/api/auth/register",
    timeoutMs: 25_000,
  },
  async ({ request, log }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      return apiJson({ error: "Security check failed." }, { status: 403 });
    }

    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return apiJson({ error: "Invalid request format." }, { status: 415 });
    }

    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return apiJson({ error: "Registration request is too large." }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw || "{}") as Record<string, unknown>;
    } catch {
      return apiJson({ error: "Request body must contain valid JSON." }, { status: 400 });
    }

    const firmName = clean(body.firmName, 200);
    const firmEmail = clean(body.firmEmail, 320).toLowerCase() || null;
    const name = clean(body.name, 160);
    const email = clean(body.email, 320).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const issue = passwordIssue(password);

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
      }),
      consumeRateLimit({
        key: emailKey,
        scope: "auth.register.email",
        limit: 3,
        windowMs: 24 * 60 * 60_000,
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

    const session = await createSession(result.user.id);

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