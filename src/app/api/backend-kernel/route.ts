import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import {
  hasFirmPermission,
  requireCurrentAccessContext,
  type AccessContext,
} from "@/lib/access-control";
import {
  getBackgroundJobMetrics,
  listBackgroundJobs,
  requestBackgroundJobCancellation,
  retryBackgroundJob,
} from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { emitBackendEvent } from "@/lib/backend/events";
import {
  SUPPORTED_BACKGROUND_JOB_KEYS,
  enqueueBackendJob,
  isSupportedBackgroundJobKey,
  requiredPermissionForBackgroundJob,
} from "@/lib/backend/jobs";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import { ensureBackendVendors } from "@/lib/backend/vendors";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function backendContext(access: AccessContext): BackendContext {
  return {
    userId: access.user.id,
    firmId: access.firm?.id ?? null,
    actorName: access.user.name,
    actorEmail: access.user.email,
  };
}

function assertJobPermission(access: AccessContext, jobKey: string) {
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

  return jobKey;
}

async function loadKernel(access: AccessContext) {
  const context = backendContext(access);
  const scope = {
    userId: context.userId,
    firmId: context.firmId,
  };
  const [
    vendors,
    flags,
    jobs,
    jobRuns,
    jobMetrics,
    deliveries,
    dataQuality,
    toolRuns,
    events,
  ] = await Promise.all([
    prisma.backendVendorIntegration.findMany({
      where: scope,
      orderBy: [{ category: "asc" }, { vendorName: "asc" }],
      take: 50,
    }),
    prisma.backendFeatureFlag.findMany({
      where: scope,
      orderBy: [{ category: "asc" }, { flagName: "asc" }],
      take: 50,
    }),
    prisma.backendJobDefinition.findMany({
      where: {
        ...scope,
        jobKey: {
          in: [...SUPPORTED_BACKGROUND_JOB_KEYS],
        },
      },
      orderBy: [{ category: "asc" }, { jobName: "asc" }],
      take: 30,
    }),
    listBackgroundJobs({
      ...scope,
      limit: 30,
      includePayload: hasFirmPermission(access, "security.review"),
    }),
    getBackgroundJobMetrics(scope),
    prisma.backendOutboundDelivery.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.backendDataQualityRecord.findMany({
      where: scope,
      orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.backendAiToolRun.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.backendPlatformEvent.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const configuredVendors = vendors.filter((vendor) => vendor.status === "Configured").length;
  const enabledFeatures = flags.filter((flag) => flag.enabled).length;
  const queuedDeliveries = deliveries.filter((delivery) => delivery.status === "Queued").length;
  const failedRuns = jobMetrics.failed + jobMetrics.deadLetter;
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (configuredVendors / Math.max(1, vendors.length)) * 30 +
          (enabledFeatures / Math.max(1, flags.length)) * 25 +
          (jobs.length ? 20 : 0) +
          (dataQuality.filter((record) => record.qualityScore >= 70).length /
            Math.max(1, dataQuality.length)) *
            15 +
          (failedRuns ? 0 : 10),
      ),
    ),
  );

  return {
    context,
    readinessScore,
    canManageKernel: hasFirmPermission(access, "security.review"),
    metrics: {
      vendors: vendors.length,
      configuredVendors,
      features: flags.length,
      enabledFeatures,
      jobs: jobs.length,
      jobRuns: jobRuns.length,
      queuedJobs: jobMetrics.queued,
      processingJobs: jobMetrics.processing,
      failedRuns,
      deadLetterJobs: jobMetrics.deadLetter,
      queuedDeliveries,
      deliveries: deliveries.length,
      dataQuality: dataQuality.length,
      toolRuns: toolRuns.length,
      events: events.length,
    },
    vendors: vendors.map((vendor) => ({
      ...vendor,
      dataAccess: parseJson<string[]>(vendor.dataAccessJson, []),
    })),
    flags,
    jobs: jobs.map((job) => ({
      ...job,
      lastResult: parseJson<Record<string, unknown>>(job.lastResultJson, {}),
    })),
    jobRuns,
    jobMetrics,
    deliveries: deliveries.map((delivery) => ({
      ...delivery,
      payload: parseJson<Record<string, unknown>>(delivery.payloadJson, {}),
    })),
    dataQuality: dataQuality.map((record) => ({
      ...record,
      warnings: parseJson<string[]>(record.warningsJson, []),
    })),
    toolRuns: toolRuns.map((run) => ({
      ...run,
      input: parseJson<Record<string, unknown>>(run.inputJson, {}),
      output: parseJson<Record<string, unknown>>(run.outputJson, {}),
    })),
    events: events.map((event) => ({
      ...event,
      metadata: parseJson<Record<string, unknown>>(event.metadataJson, {}),
    })),
  };
}

export const GET = withApiRoute(
  {
    route: "/api/backend-kernel",
    timeoutMs: 20_000,
  },
  async () => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });

    return apiJson(await loadKernel(access));
  },
);

export const POST = withApiRoute(
  {
    route: "/api/backend-kernel",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_REQUEST_BLOCKED",
        message: "Cross-site backend-kernel requests are not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `backend-kernel:${access.user.id}:${hashForSecurity(getClientIp(request))}`,
      limit: 40,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "BACKEND_KERNEL_RATE_LIMITED",
        message: "Too many backend-kernel requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const context = backendContext(access);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = readText(body.action);

    if (action === "bootstrap") {
      if (!hasFirmPermission(access, "security.review")) {
        throw new ApiError({
          status: 403,
          code: "PERMISSION_DENIED",
          message: "Security-review permission is required to initialize the backend kernel.",
          expose: true,
        });
      }

      await ensureBackendVendors(context);

      await emitBackendEvent(context, {
        eventType: "backend.kernel.ready",
        area: "Backend Kernel",
        title: "Backend Kernel initialized",
        detail: "Vendor registry, feature flags, and supported job definitions are ready.",
      });

      return apiJson({
        ...(await loadKernel(access)),
        message: "Backend Kernel initialized.",
      });
    }

    if (action === "runJob") {
      const jobKey = assertJobPermission(access, readText(body.jobKey));
      const queued = await enqueueBackendJob(context, jobKey, {
        payload:
          body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
            ? (body.payload as Record<string, unknown>)
            : {},
        idempotencyKey: readText(body.idempotencyKey) || undefined,
      });

      return apiJson(
        {
          ...(await loadKernel(access)),
          message: queued.duplicate
            ? `Equivalent job already exists: ${jobKey}`
            : `Job queued: ${jobKey}`,
          queued,
        },
        {
          status: queued.duplicate ? 200 : 202,
        },
      );
    }

    if (action === "runCoreJobs") {
      if (!hasFirmPermission(access, "security.review")) {
        throw new ApiError({
          status: 403,
          code: "PERMISSION_DENIED",
          message: "Security-review permission is required to queue all core jobs.",
          expose: true,
        });
      }

      const queued = await Promise.all(
        SUPPORTED_BACKGROUND_JOB_KEYS.map((jobKey) =>
          enqueueBackendJob(context, jobKey, {
            idempotencyKey: `kernel-core:${jobKey}:${Math.floor(Date.now() / 60_000)}`,
          }),
        ),
      );

      return apiJson(
        {
          ...(await loadKernel(access)),
          message: "Core backend jobs queued.",
          queued,
        },
        { status: 202 },
      );
    }

    if (action === "cancelJob") {
      const job = await requestBackgroundJobCancellation({
        jobId: readText(body.jobId),
        userId: context.userId,
        firmId: context.firmId,
      });

      return apiJson({
        ...(await loadKernel(access)),
        message: "Job cancellation recorded.",
        job,
      });
    }

    if (action === "retryJob") {
      const job = await retryBackgroundJob({
        jobId: readText(body.jobId),
        userId: context.userId,
        firmId: context.firmId,
      });

      return apiJson(
        {
          ...(await loadKernel(access)),
          message: "Job retry queued.",
          job,
        },
        { status: 202 },
      );
    }

    if (action === "toggleFeature") {
      if (!hasFirmPermission(access, "firm.manage")) {
        throw new ApiError({
          status: 403,
          code: "PERMISSION_DENIED",
          message: "Firm-management permission is required to change feature flags.",
          expose: true,
        });
      }

      const flagKey = readText(body.flagKey);
      const enabled = Boolean(body.enabled);

      if (!flagKey) {
        throw new ApiError({
          status: 400,
          code: "FEATURE_FLAG_REQUIRED",
          message: "Feature flag key is required.",
          expose: true,
        });
      }

      await prisma.backendFeatureFlag.updateMany({
        where: {
          userId: context.userId,
          firmId: context.firmId,
          flagKey,
        },
        data: {
          enabled,
          status: enabled ? "Ready" : "Disabled",
        },
      });

      await emitBackendEvent(context, {
        eventType: "feature.toggled",
        area: "Feature Flags",
        title: `Feature ${enabled ? "enabled" : "disabled"}: ${flagKey}`,
        metadata: {
          flagKey,
          enabled,
        },
      });

      return apiJson({
        ...(await loadKernel(access)),
        message: `Feature ${enabled ? "enabled" : "disabled"}.`,
      });
    }

    if (action === "queueTestDelivery") {
      if (!hasFirmPermission(access, "security.review")) {
        throw new ApiError({
          status: 403,
          code: "PERMISSION_DENIED",
          message: "Security-review permission is required to queue a test delivery.",
          expose: true,
        });
      }

      if (
        request.headers.get("x-slice-sensitive-action") !==
        "queue-test-delivery"
      ) {
        throw new ApiError({
          status: 403,
          code: "SENSITIVE_ACTION_CONFIRMATION_REQUIRED",
          message: "Confirm the test delivery with x-slice-sensitive-action: queue-test-delivery.",
          expose: true,
        });
      }

      const delivery = await queueBackendDelivery(context, {
        channel: "Dashboard",
        destination: "Dashboard",
        title: "Backend Kernel Test Delivery",
        body: "This confirms the durable outbound-delivery worker is operating.",
        urgency: "Medium",
        score: 70,
        idempotencyKey: `kernel-test:${Math.floor(Date.now() / 60_000)}`,
        payload: {
          test: true,
        },
      });
      const queued = await enqueueBackendJob(context, "notification_delivery", {
        idempotencyKey: `kernel-delivery-worker:${delivery.id}`,
      });

      return apiJson(
        {
          ...(await loadKernel(access)),
          message: "Test delivery and delivery worker queued.",
          deliveryId: delivery.id,
          queued,
        },
        { status: 202 },
      );
    }

    throw new ApiError({
      status: 400,
      code: "UNKNOWN_BACKEND_KERNEL_ACTION",
      message: "Unknown Backend Kernel action.",
      expose: true,
    });
  },
);