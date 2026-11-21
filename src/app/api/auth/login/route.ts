import "server-only";

import { NextResponse } from "next/server";

import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import {
  createSession,
  hashPassword,
  needsPasswordRehash,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";
import { accountHasMfa, requireSecurityOrigin, securityJson, verifyAccountSecondFactor } from "@/lib/account-security/service";
import {
  consumeRateLimit,
  rateLimitHeaders,
  resetRateLimit,
} from "@/lib/rate-limit";
import {
  getClientIp,
  hashForSecurity,
  maskEmail,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOGIN_WINDOW_MS = 15 * 60_000;

function invalidLoginResponse(headers?: HeadersInit) {
  return apiJson(
    { error: "Invalid email or password." },
    { status: 401, headers },
  );
}

export const POST = withApiRoute(
  {
    route: "/api/auth/login",
    timeoutMs: 20_000,
    cacheControl: "private, no-store",
  },
  async ({ request, log }) => {
    try { requireSecurityOrigin(request); }
    catch (error) {
      await recordSecurityEvent({ eventType: "auth.login.cross_site_blocked", severity: "High", area: "Authentication", title: "Cross-site login request blocked", request }).catch((caught) => log.error("security_event.failed", caught));
      throw error;
    }
    const body = await securityJson(request);
    const authenticationStartedAt = new Date();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase().slice(0, 320)
        : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length > 256) {
      return apiJson(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const ipKey = hashForSecurity(ip);
    const emailKey = hashForSecurity(email);
    const [ipLimit, emailLimit] = await Promise.all([
      consumeRateLimit({
        key: ipKey,
        scope: "auth.login.ip",
        limit: 25,
        windowMs: LOGIN_WINDOW_MS,
        failOpen: false,
      }),
      consumeRateLimit({
        key: emailKey,
        scope: "auth.login.email",
        limit: 10,
        windowMs: LOGIN_WINDOW_MS,
        failOpen: false,
      }),
    ]);

    const blockingLimit = !ipLimit.allowed ? ipLimit : !emailLimit.allowed ? emailLimit : null;

    if (blockingLimit) {
      await recordSecurityEvent({
        eventType: "auth.login.rate_limited",
        severity: "High",
        area: "Authentication",
        title: "Login rate limit triggered",
        detail: `Login attempts were limited for ${maskEmail(email)}.`,
        metadata: {
          scope: blockingLimit.scope,
          limit: blockingLimit.limit,
          resetAt: blockingLimit.resetAt,
          source: blockingLimit.source,
        },
        request,
      }).catch((error) => log.error("security_event.failed", error));

      return apiJson(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: rateLimitHeaders(blockingLimit) },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        createdAt: true,
        platformStatus: true,
        governanceReason: true,
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      await recordSecurityEvent({
        userId: user?.id ?? null,
        eventType: "auth.login.failed",
        severity: user ? "Medium" : "Low",
        area: "Authentication",
        title: "Failed login attempt",
        detail: `Failed login attempt for ${maskEmail(email)}.`,
        metadata: {
          emailHash: emailKey,
          knownAccount: Boolean(user),
          ipRateSource: ipLimit.source,
          emailRateSource: emailLimit.source,
        },
        request,
      }).catch((error) => log.error("security_event.failed", error));

      return invalidLoginResponse(rateLimitHeaders(emailLimit));
    }

    if (user.platformStatus !== "Active") {
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.governed_account_blocked",
        severity: user.platformStatus === "Banned" ? "Critical" : "High",
        area: "Authentication",
        title: `${user.platformStatus} account login blocked`,
        detail: user.governanceReason || "Governed account attempted login.",
        request,
      }).catch((error) => log.error("security_event.failed", error));

      return apiJson(
        {
          error:
            user.governanceReason ||
            "This account is not currently permitted to sign in.",
        },
        { status: 403 },
      );
    }

    const isFounder = isFounderEmail(user.email);
    const activeMembership = await prisma.firmMembership.findFirst({
      where: {
        userId: user.id,
        status: "Active",
        firm: { platformStatus: "Active" },
      },
      select: {
        id: true,
        firmId: true,
        role: true,
        firm: {
          select: {
            id: true,
            name: true,
            platformStatus: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!isFounder && !activeMembership) {
      await recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.no_active_firm",
        severity: "Medium",
        area: "Authentication",
        title: "Login blocked: no active firm workspace",
        request,
      }).catch((error) => log.error("security_event.failed", error));

      return apiJson(
        {
          error:
            "This account is not connected to an active firm workspace. Ask a firm owner to restore access.",
        },
        { status: 403 },
      );
    }

    const mfaRequired = await accountHasMfa(user.id);
    if (mfaRequired && !await verifyAccountSecondFactor(user.id, body.factorCode)) {
      await recordSecurityEvent({ userId: user.id, eventType: "auth.login.factor_required", severity: body.factorCode ? "Medium" : "Info", area: "Authentication", title: body.factorCode ? "Second-factor sign in failed" : "Sign in awaiting second factor", request }).catch((error) => log.error("security_event.failed", error));
      return apiJson({ error: body.factorCode ? "That code was not accepted. Use a fresh authenticator code or an unused recovery code." : "Enter your authenticator code or a recovery code.", code: "MFA_REQUIRED", mfaRequired: true }, { status: 401, headers: rateLimitHeaders(emailLimit) });
    }

    if (needsPasswordRehash(user.passwordHash)) {
      const upgradedHash = hashPassword(password);
      const upgraded = await prisma.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash, platformStatus: "Active" }, data: { passwordHash: upgradedHash } });
      if (upgraded.count !== 1) throw new ApiError({ status: 401, code: "CREDENTIALS_CHANGED", message: "Account credentials changed during sign in. Try again with your current password." });
      user.passwordHash = upgradedHash;
    }

    await prisma.userSecuritySetting.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        mfaEnabled: false,
        requireReauthForSensitiveActions: true,
        alertOnNewLogin: true,
        advisorModeEnabled: true,
        sessionTimeoutMinutes: 720,
      },
    });

    const session = await createSession(user.id, { mfaVerified: mfaRequired, authenticationStartedAt, expectedPasswordHash: user.passwordHash, request });

    await Promise.all([
      resetRateLimit({ key: emailKey, scope: "auth.login.email" }),
      recordSecurityEvent({
        userId: user.id,
        eventType: "auth.login.success",
        severity: "Info",
        area: "Authentication",
        title: "Successful login",
        detail: `Successful login for ${maskEmail(user.email)}.`,
        metadata: {
          isFounder,
          firmId: activeMembership?.firmId ?? null,
          membershipId: activeMembership?.id ?? null,
          role: activeMembership?.role ?? null,
          sessionExpiresAt: session.expiresAt,
        },
        request,
      }),
    ]).catch((error) => log.error("post_login_audit.failed", error));

    const response = NextResponse.json({
      user: publicUser(user),
      isFounder,
      access: activeMembership
        ? {
            firm: activeMembership.firm,
            membership: {
              id: activeMembership.id,
              firmId: activeMembership.firmId,
              role: activeMembership.role,
            },
          }
        : null,
    });

    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    return response;
  },
);
