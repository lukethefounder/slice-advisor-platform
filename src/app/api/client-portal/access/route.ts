import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ApiError, withApiRoute } from "@/lib/api-route";
import {
  CLIENT_PORTAL_SESSION_COOKIE,
  type ClientPortalSessionContext,
  clearClientPortalCookieOptions,
  clientPortalCookieOptions,
  createClientPortalSession,
  getCurrentClientPortalSession,
  hashPortalInviteCode,
  revokeClientPortalSession,
} from "@/lib/client-portal-auth";
import { routeClientPortalEvent } from "@/lib/client-portal/events";
import {
  cleanEmail,
  cleanText,
  noStoreJson,
} from "@/lib/client-data-security";
import { decryptSensitiveText } from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function portalContext(current: ClientPortalSessionContext) {
  const clientEmail = current.client.email
    ? decryptSensitiveText(current.client.email) ?? ""
    : "";

  return {
    ok: true,
    client: {
      id: current.client.id,
      fullName: current.client.fullName,
      email: clientEmail,
      phone: current.client.phone ?? "",
      householdName: current.client.householdName ?? "",
      preferredContactMethod:
        current.client.preferredContactMethod || "Portal + email",
      riskProfile: current.client.riskProfile,
      liquidityNeeds: current.client.liquidityNeeds,
      timeHorizon: current.client.timeHorizon,
      objective: current.client.objective,
      onboardingStatus: current.client.portalOnboardingStatus,
      onboardingComplete:
        current.client.portalOnboardingStatus === "Portal Ready",
    },
    advisor: {
      membershipId: current.assignment.id,
      userId: current.assignment.userId,
      name:
        current.assignment.user.name ||
        current.assignment.user.email ||
        "Advisor",
      email: current.assignment.user.email,
      role: current.assignment.role,
      calendlyUrl: current.scheduling.url,
      calendlyLabel: current.scheduling.label,
      calendlyEnabled: current.scheduling.enabled,
      scheduling: current.scheduling,
    },
    firm: {
      id: current.assignment.firm.id,
      name: current.assignment.firm.name,
    },
    session: {
      expiresAt: current.session.expiresAt,
    },
  };
}

function compatibleError(error: unknown) {
  if (error instanceof ApiError) {
    return noStoreJson(
      {
        ok: false,
        error: error.expose
          ? error.message
          : "The client portal request could not be completed.",
        code: error.code,
        ...(error.expose && error.details
          ? {
              details: error.details,
            }
          : {}),
      },
      {
        status: error.status,
      },
    );
  }

  throw error;
}

function assertSafeJsonRequest(request: Request) {
  if (isPotentiallyCrossSiteUnsafeRequest(request)) {
    throw new ApiError({
      status: 403,
      code: "CROSS_SITE_REQUEST_BLOCKED",
      message: "Security policy blocked this portal request.",
      expose: true,
    });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError({
      status: 415,
      code: "INVALID_CONTENT_TYPE",
      message: "Invalid request format.",
      expose: true,
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/client-portal/access",
    timeoutMs: 12_000,
  },
  async () => {
    try {
      const current = await getCurrentClientPortalSession();

      if (!current) {
        throw new ApiError({
          status: 401,
          code: "CLIENT_PORTAL_SESSION_REQUIRED",
          message: "Client portal session required.",
          expose: true,
        });
      }

      return noStoreJson(portalContext(current));
    } catch (error) {
      return compatibleError(error);
    }
  },
);

export const POST = withApiRoute(
  {
    route: "/api/client-portal/access",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    try {
      assertSafeJsonRequest(request);

      let body: Record<string, unknown>;

      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        throw new ApiError({
          status: 400,
          code: "INVALID_JSON",
          message: "Invalid JSON request body.",
          expose: true,
        });
      }

      const action = cleanText(body.action);

      if (action === "login") {
        const email = cleanEmail(body.email);
        const inviteCode = cleanText(body.inviteCode).slice(0, 300);

        if (!email || !inviteCode) {
          throw new ApiError({
            status: 400,
            code: "CLIENT_PORTAL_CREDENTIALS_REQUIRED",
            message: "Client email and secure invite code are required.",
            expose: true,
          });
        }

        const rate = checkRateLimit({
          key: `client-portal-login:${hashForSecurity(
            getClientIp(request),
          )}:${hashForSecurity(email)}`,
          limit: 10,
          windowMs: 15 * 60 * 1_000,
        });

        if (!rate.allowed) {
          const response = noStoreJson(
            {
              ok: false,
              error: "Too many portal login attempts. Try again later.",
              code: "CLIENT_PORTAL_RATE_LIMITED",
            },
            {
              status: 429,
            },
          );
          response.headers.set("Retry-After", String(rate.retryAfterSeconds));
          return response;
        }

        const client = await prisma.clientProfile.findFirst({
          where: {
            portalInviteCodeHash: hashPortalInviteCode(inviteCode),
            portalEnabled: true,
            portalInviteExpiresAt: {
              gt: new Date(),
            },
            firmId: {
              not: null,
            },
            assignedAdvisorMembershipId: {
              not: null,
            },
          },
          select: {
            id: true,
            email: true,
          },
        });
        const storedEmail = client?.email
          ? String(decryptSensitiveText(client.email) ?? "").toLowerCase()
          : "";

        if (!client || !storedEmail || !sameText(storedEmail, email)) {
          throw new ApiError({
            status: 401,
            code: "INVALID_CLIENT_PORTAL_LOGIN",
            message: "The email or portal invite code is invalid or expired.",
            expose: true,
          });
        }

        const portalSession = await createClientPortalSession(client.id);

        await prisma.clientProfile.updateMany({
          where: {
            id: client.id,
            firmId: portalSession.assignment.firmId,
            assignedAdvisorMembershipId: portalSession.assignment.id,
          },
          data: {
            portalLastLoginAt: new Date(),
            portalOnboardingStatus:
              portalSession.client.portalOnboardingStatus === "Invited"
                ? "Accessed"
                : portalSession.client.portalOnboardingStatus,
          },
        });

        const response = NextResponse.json(
          portalContext({
            session: {
              id: "new-session",
              clientId: portalSession.client.id,
              tokenHash: "",
              expiresAt: portalSession.expiresAt,
              createdAt: new Date(),
            },
            client: {
              ...portalSession.client,
              portalOnboardingStatus:
                portalSession.client.portalOnboardingStatus === "Invited"
                  ? "Accessed"
                  : portalSession.client.portalOnboardingStatus,
            },
            assignment: portalSession.assignment,
            scheduling: portalSession.scheduling,
          }),
        );

        response.cookies.set(
          CLIENT_PORTAL_SESSION_COOKIE,
          portalSession.token,
          clientPortalCookieOptions(portalSession.expiresAt),
        );

        return response;
      }

      if (action === "logout") {
        const cookieStore = await cookies();
        const token = cookieStore.get(CLIENT_PORTAL_SESSION_COOKIE)?.value;

        if (token) {
          await revokeClientPortalSession(token);
        }

        const response = NextResponse.json({ ok: true });
        response.cookies.set(
          CLIENT_PORTAL_SESSION_COOKIE,
          "",
          clearClientPortalCookieOptions(),
        );

        return response;
      }

      if (action === "completeProfile") {
        const current = await getCurrentClientPortalSession();

        if (!current) {
          throw new ApiError({
            status: 401,
            code: "CLIENT_PORTAL_SESSION_REQUIRED",
            message: "Client portal session required.",
            expose: true,
          });
        }

        const fullName = cleanText(
          body.fullName,
          current.client.fullName,
        ).slice(0, 240);
        const phone = cleanText(body.phone).slice(0, 80) || null;
        const householdName =
          cleanText(body.householdName).slice(0, 240) || null;
        const preferredContactMethod = cleanText(
          body.preferredContactMethod,
          "Portal + email",
        ).slice(0, 120);

        const updated = await prisma.clientProfile.updateMany({
          where: {
            id: current.client.id,
            firmId: current.assignment.firmId,
            assignedAdvisorMembershipId: current.assignment.id,
            portalEnabled: true,
          },
          data: {
            fullName: fullName || current.client.fullName,
            phone,
            householdName,
            preferredContactMethod,
            portalOnboardingStatus: "Portal Ready",
            portalLastLoginAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new ApiError({
            status: 409,
            code: "CLIENT_PROFILE_CONFLICT",
            message:
              "The advisor assignment changed before the profile update completed. Sign in again and retry.",
            expose: true,
          });
        }

        await routeClientPortalEvent({
          current,
          request,
          event: {
            sourceEventId: `profile-onboarding:${current.client.id}`,
            kind: "Profile Update",
            title: "Client portal profile completed",
            body:
              "The client completed their portal profile and confirmed contact preferences.",
            priority: "Medium",
            senderName: fullName || current.client.fullName,
            senderEmail: current.client.email
              ? decryptSensitiveText(current.client.email)
              : null,
            metadata: {
              householdName,
              preferredContactMethod,
              phoneProvided: Boolean(phone),
            },
          },
        });

        const refreshed = await getCurrentClientPortalSession();

        if (!refreshed) {
          throw new ApiError({
            status: 401,
            code: "CLIENT_PORTAL_SESSION_REQUIRED",
            message: "Client portal session required.",
            expose: true,
          });
        }

        return noStoreJson(portalContext(refreshed));
      }

      throw new ApiError({
        status: 400,
        code: "UNKNOWN_CLIENT_PORTAL_ACTION",
        message: "Unknown client portal action.",
        expose: true,
      });
    } catch (error) {
      return compatibleError(error);
    }
  },
);