import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import {
  handleDocumentAction,
  listDocumentCenter,
  resolveDocumentActor,
} from "@/lib/document-center/service";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
  recordSecurityEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function assertJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError({
      status: 415,
      code: "DOCUMENT_JSON_REQUIRED",
      message: "Document actions require a JSON request body.",
      expose: true,
    });
  }
}

function assertSensitiveConfirmation(request: Request, action: string) {
  const expectedByAction: Record<string, string> = {
    approve: "document-approve",
    delete: "document-delete",
    reprocess: "document-reprocess",
    requestDelete: "document-request-delete",
  };
  const expected = expectedByAction[action];

  if (!expected) return;

  const actual = request.headers.get("x-slice-sensitive-action") ?? "";

  if (actual !== expected) {
    throw new ApiError({
      status: 409,
      code: "DOCUMENT_CONFIRMATION_REQUIRED",
      message: "Confirm this document action before continuing.",
      expose: true,
      details: {
        requiredConfirmation: expected,
      },
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/documents",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const payload = await listDocumentCenter({
      requestUrl: request.url,
    });

    return apiJson(payload);
  },
);

export const POST = withApiRoute(
  {
    route: "/api/documents",
    timeoutMs: 25_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "DOCUMENT_CROSS_SITE_REQUEST_BLOCKED",
        message: "Security policy blocked this document request.",
        expose: true,
      });
    }

    assertJsonRequest(request);

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!body) {
      throw new ApiError({
        status: 400,
        code: "DOCUMENT_REQUEST_INVALID",
        message: "The document request body is invalid.",
        expose: true,
      });
    }

    const actorHint = body.actorHint === "client" ? "client" : "advisor";
    const actor = await resolveDocumentActor(actorHint);
    const action = String(body.action ?? "").trim();
    const rate = checkRateLimit({
      key: `document-action:${actor.kind}:${actor.actorId}:${hashForSecurity(
        getClientIp(request),
      )}`,
      limit: actor.kind === "client" ? 60 : 120,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      await recordSecurityEvent({
        userId: actor.ownerUserId,
        eventType: "document.action.rate_limited",
        severity: "Medium",
        area: "Document Vault",
        title: "Document action rate limited",
        metadata: {
          actorKind: actor.kind,
          action,
          resetAt: rate.resetAt.toISOString(),
        },
        request,
      });

      throw new ApiError({
        status: 429,
        code: "DOCUMENT_RATE_LIMITED",
        message: "Too many document actions. Try again shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    assertSensitiveConfirmation(request, action);

    const result = await handleDocumentAction({
      request,
      body,
      actor,
    });

    return apiJson(result);
  },
);