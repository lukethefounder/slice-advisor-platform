import { ApiError, withApiRoute } from "@/lib/api-route";
import { requireCurrentClientPortalSession } from "@/lib/client-portal-auth";
import {
  type ClientPortalEventInput,
  loadClientPortalRoutingPayload,
  routeClientPortalEvent,
  routeClientPortalEvents,
} from "@/lib/client-portal/events";
import { noStoreJson } from "@/lib/client-data-security";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function compatibleError(error: unknown) {
  if (error instanceof ApiError) {
    return noStoreJson(
      {
        ok: false,
        error: error.expose
          ? error.message
          : "The portal routing request could not be completed.",
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
    route: "/api/client-portal/routing",
    timeoutMs: 15_000,
  },
  async ({ request }) => {
    try {
      const current = await requireCurrentClientPortalSession();
      const url = new URL(request.url);

      return noStoreJson(
        await loadClientPortalRoutingPayload({
          current,
          after: url.searchParams.get("after"),
        }),
      );
    } catch (error) {
      return compatibleError(error);
    }
  },
);

export const POST = withApiRoute(
  {
    route: "/api/client-portal/routing",
    timeoutMs: 30_000,
  },
  async ({ request }) => {
    try {
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

      const current = await requireCurrentClientPortalSession();
      const rate = checkRateLimit({
        key: `client-portal-routing:${current.client.id}:${hashForSecurity(
          getClientIp(request),
        )}`,
        limit: 40,
        windowMs: 60 * 1_000,
      });

      if (!rate.allowed) {
        const response = noStoreJson(
          {
            ok: false,
            error: "Too many portal requests. Try again shortly.",
            code: "CLIENT_PORTAL_RATE_LIMITED",
          },
          {
            status: 429,
          },
        );
        response.headers.set("Retry-After", String(rate.retryAfterSeconds));
        return response;
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

      if (Array.isArray(body.events)) {
        const events = body.events
          .filter(
            (value): value is ClientPortalEventInput =>
              Boolean(value && typeof value === "object" && !Array.isArray(value)),
          )
          .slice(0, 51);
        const results = await routeClientPortalEvents({
          current,
          events,
          request,
        });

        return noStoreJson({
          ok: results.every((result) => result.ok),
          batch: true,
          accepted: results.filter((result) => result.ok).length,
          failed: results.filter((result) => !result.ok).length,
          results,
        });
      }

      const result = await routeClientPortalEvent({
        current,
        event: body,
        request,
      });

      return noStoreJson({
        ok: true,
        batch: false,
        created: result.created,
        notificationQueued: result.notificationQueued,
        item: result.item,
      });
    } catch (error) {
      return compatibleError(error);
    }
  },
);