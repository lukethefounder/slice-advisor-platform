import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import {
  hasFirmPermission,
  requireCurrentAccessContext,
} from "@/lib/access-control";
import {
  BACKGROUND_JOB_STATUSES,
  getBackgroundJobMetrics,
  listBackgroundJobs,
} from "@/lib/background-jobs/queue";
import {
  enqueueBackendJob,
  isSupportedBackgroundJobKey,
  requiredPermissionForBackgroundJob,
} from "@/lib/backend/jobs";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseStatuses(value: string | null) {
  if (!value) return [];

  const allowed = new Set<string>(BACKGROUND_JOB_STATUSES);

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => allowed.has(item)),
    ),
  );
}

function parseLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return 30;
  return Math.max(1, Math.min(100, parsed));
}

function jsonPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export const GET = withApiRoute(
  {
    route: "/api/jobs",
    timeoutMs: 15_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const url = new URL(request.url);
    const firmScopeRequested = url.searchParams.get("scope") === "firm";
    const canReviewFirmJobs = hasFirmPermission(access, "security.review");

    if (firmScopeRequested && !canReviewFirmJobs) {
      throw new ApiError({
        status: 403,
        code: "PERMISSION_DENIED",
        message: "Security-review permission is required to view firm-wide jobs.",
        expose: true,
      });
    }

    const includePayload =
      url.searchParams.get("includePayload") === "1" && canReviewFirmJobs;
    const scope = {
      firmId: access.firm!.id,
      ...(firmScopeRequested ? {} : { userId: access.user.id }),
    };
    const [jobs, metrics] = await Promise.all([
      listBackgroundJobs({
        ...scope,
        statuses: parseStatuses(url.searchParams.get("status")),
        limit: parseLimit(url.searchParams.get("limit")),
        includePayload,
      }),
      getBackgroundJobMetrics(scope),
    ]);

    return apiJson({
      ok: true,
      scope: firmScopeRequested ? "firm" : "user",
      metrics,
      jobs,
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/jobs",
    timeoutMs: 15_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_REQUEST_BLOCKED",
        message: "Cross-site background-job requests are not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `jobs:enqueue:${access.user.id}:${hashForSecurity(getClientIp(request))}`,
      limit: 30,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "BACKGROUND_JOB_RATE_LIMITED",
        message: "Too many background-job requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const jobKey = String(body.jobKey ?? "").trim();

    if (!isSupportedBackgroundJobKey(jobKey)) {
      throw new ApiError({
        status: 400,
        code: "UNSUPPORTED_BACKGROUND_JOB",
        message: "Choose a supported background-job type.",
        expose: true,
      });
    }

    const permission = requiredPermissionForBackgroundJob(jobKey);

    if (permission && !hasFirmPermission(access, permission)) {
      throw new ApiError({
        status: 403,
        code: "PERMISSION_DENIED",
        message: "You do not have permission to queue this background job.",
        expose: true,
      });
    }

    const idempotencyKey =
      request.headers.get("idempotency-key")?.trim() ||
      String(body.idempotencyKey ?? "").trim() ||
      undefined;
    const availableAtValue = String(body.availableAt ?? "").trim();
    const availableAt = availableAtValue ? new Date(availableAtValue) : undefined;

    if (availableAt && Number.isNaN(availableAt.getTime())) {
      throw new ApiError({
        status: 400,
        code: "INVALID_JOB_SCHEDULE",
        message: "availableAt must be a valid ISO date and time.",
        expose: true,
      });
    }

    const queued = await enqueueBackendJob(
      {
        userId: access.user.id,
        firmId: access.firm!.id,
        actorName: access.user.name,
        actorEmail: access.user.email,
      },
      jobKey,
      {
        payload: jsonPayload(body.payload),
        idempotencyKey,
        availableAt,
        maxAttempts:
          typeof body.maxAttempts === "number" ? body.maxAttempts : undefined,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        backoffMs: typeof body.backoffMs === "number" ? body.backoffMs : undefined,
      },
    );

    return apiJson(
      {
        ok: true,
        duplicate: queued.duplicate,
        job: queued.job,
      },
      {
        status: queued.duplicate ? 200 : 202,
      },
    );
  },
);