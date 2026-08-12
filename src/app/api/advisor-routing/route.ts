import { ApiError, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import {
  assignClientToAdvisor,
  createClientPortalInvite,
  loadAdvisorRoutingPayload,
  replyToAdvisorInboxItem,
  requireAdvisorRoutingContext,
  revokeClientPortalAccess,
  saveAdvisorScheduling,
  updateAdvisorInboxStatus,
} from "@/lib/advisor-routing/service";
import {
  cleanText,
  noStoreJson,
  protectClientDataRoute,
} from "@/lib/client-data-security";
import { isPotentiallyCrossSiteUnsafeRequest } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function currentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
      expose: true,
    });
  }

  return user;
}

function numberQuery(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function compatibleError(error: unknown) {
  if (error instanceof ApiError) {
    return noStoreJson(
      {
        ok: false,
        error: error.expose
          ? error.message
          : "The advisor routing request could not be completed.",
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

export const GET = withApiRoute(
  {
    route: "/api/advisor-routing",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    try {
      const user = await currentUser();
      const protection = await protectClientDataRoute({
        request,
        user,
        area: "Advisor Client Routing",
        eventType: "advisor-routing.read",
        title: "Advisor routing data read",
        limit: 120,
      });

      if (!protection.allowed) return protection.response!;

      const url = new URL(request.url);
      const context = await requireAdvisorRoutingContext(user);

      return noStoreJson(
        await loadAdvisorRoutingPayload(context, {
          scope: url.searchParams.get("scope"),
          clientId: url.searchParams.get("clientId"),
          clientLimit: numberQuery(url.searchParams.get("clientLimit")),
          inboxLimit: numberQuery(url.searchParams.get("inboxLimit")),
        }),
      );
    } catch (error) {
      return compatibleError(error);
    }
  },
);

export const POST = withApiRoute(
  {
    route: "/api/advisor-routing",
    timeoutMs: 25_000,
  },
  async ({ request }) => {
    try {
      const user = await currentUser();
      const protection = await protectClientDataRoute({
        request,
        user,
        area: "Advisor Client Routing",
        eventType: "advisor-routing.write",
        title: "Advisor routing change",
        limit: 60,
      });

      if (!protection.allowed) return protection.response!;

      if (isPotentiallyCrossSiteUnsafeRequest(request)) {
        throw new ApiError({
          status: 403,
          code: "CROSS_SITE_REQUEST_BLOCKED",
          message: "Security policy blocked this advisor routing request.",
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
      const scope = cleanText(body.scope);
      const context = await requireAdvisorRoutingContext(user);
      let clientId = cleanText(body.clientId).slice(0, 160) || null;
      let actionResult: Record<string, unknown> | null = null;
      let invite:
        | Awaited<ReturnType<typeof createClientPortalInvite>>
        | undefined;

      if (action === "saveScheduling" || action === "saveCalendly") {
        actionResult = await saveAdvisorScheduling({
          context,
          request,
          schedulingUrl: body.schedulingUrl ?? body.calendlyUrl,
          label: body.schedulingLabel ?? body.calendlyLabel,
          enabled: body.schedulingEnabled ?? body.calendlyEnabled,
        });
      } else if (action === "assignClient") {
        actionResult = await assignClientToAdvisor({
          context,
          request,
          clientId: body.clientId,
          advisorMembershipId:
            body.advisorMembershipId ?? body.assignedAdvisorMembershipId,
          expectedCurrentAdvisorMembershipId:
            body.expectedCurrentAdvisorMembershipId,
          reason: body.reason,
          confirmReassignment: body.confirmReassignment,
        });
      } else if (action === "createPortalInvite") {
        invite = await createClientPortalInvite({
          context,
          request,
          clientId: body.clientId,
          expiresInDays: body.expiresInDays,
        });
        actionResult = {
          clientId: invite.clientId,
          expiresAt: invite.expiresAt,
        };
      } else if (action === "revokePortalAccess") {
        actionResult = await revokeClientPortalAccess({
          context,
          request,
          clientId: body.clientId,
        });
      } else if (action === "updateInbox") {
        clientId = null;
        actionResult = await updateAdvisorInboxStatus({
          context,
          request,
          itemId: body.itemId,
          status: body.status,
        });
      } else if (action === "reply") {
        clientId = null;
        actionResult = await replyToAdvisorInboxItem({
          context,
          request,
          itemId: body.itemId,
          body: body.body,
        });
      } else {
        throw new ApiError({
          status: 400,
          code: "UNKNOWN_ROUTING_ACTION",
          message: "Unknown advisor routing action.",
          expose: true,
        });
      }

      return noStoreJson({
        ...(await loadAdvisorRoutingPayload(context, {
          scope,
          clientId,
        })),
        actionResult,
        ...(invite
          ? {
              invite,
            }
          : {}),
      });
    } catch (error) {
      return compatibleError(error);
    }
  },
);