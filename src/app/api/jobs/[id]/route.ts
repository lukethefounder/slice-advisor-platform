import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { after } from "next/server";
import { processBackgroundJobIds } from "@/lib/background-jobs/worker";
import { assertAgentJobViewer } from "@/lib/agent-desk/access";
import {
  hasFirmPermission,
  requireCurrentAccessContext,
} from "@/lib/access-control";
import {
  getBackgroundJob,
  requestBackgroundJobCancellation,
  retryBackgroundJob,
  recoverStalledBackgroundJobs,
} from "@/lib/background-jobs/queue";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jobScope(input: {
  access: Awaited<ReturnType<typeof requireCurrentAccessContext>>;
  firmScope: boolean;
}) {
  if (input.firmScope && !hasFirmPermission(input.access, "security.review")) {
    throw new ApiError({
      status: 403,
      code: "PERMISSION_DENIED",
      message: "Security-review permission is required for firm-wide job access.",
      expose: true,
    });
  }

  return {
    firmId: input.access.firm!.id,
    ...(input.firmScope ? {} : { userId: input.access.user.id }),
  };
}

export const GET = withApiRoute(
  {
    route: "/api/jobs/[id]",
    timeoutMs: 15_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const url = new URL(request.url);
    const id = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const firmScope = url.searchParams.get("scope") === "firm";
    const scope = jobScope({ access, firmScope });
    const includePayload =
      url.searchParams.get("includePayload") === "1" &&
      hasFirmPermission(access, "security.review");
    const job = await getBackgroundJob({
      jobId: id,
      ...scope,
      includePayload,
    });

    if (!job) {
      throw new ApiError({
        status: 404,
        code: "BACKGROUND_JOB_NOT_FOUND",
        message: "Background job not found.",
        expose: true,
      });
    }

    assertAgentJobViewer(access, job);

    return apiJson({
      ok: true,
      job,
    });
  },
);

export const PATCH = withApiRoute(
  {
    route: "/api/jobs/[id]",
    timeoutMs: 15_000,
  },
  async ({ request, log }) => {
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
      key: `jobs:control:${access.user.id}:${hashForSecurity(getClientIp(request))}`,
      limit: 40,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "BACKGROUND_JOB_RATE_LIMITED",
        message: "Too many background-job control requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const url = new URL(request.url);
    const id = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = String(body.action ?? "").trim().toLowerCase();
    const firmScope = Boolean(body.firmScope);
    const scope = jobScope({ access, firmScope });

    const controlledJob = await getBackgroundJob({ jobId: id, ...scope });
    if (controlledJob) assertAgentJobViewer(access, controlledJob);

    if (action === "resume") {
      const existing = await getBackgroundJob({ jobId: id, ...scope });
      if (!existing || !["intelligence_graph_refresh", "agent_desk_cycle", "agent_desk_scout"].includes(existing.jobKey)) {
        throw new ApiError({ status: 404, code: "RESEARCH_JOB_NOT_FOUND", message: "Research job not found.", expose: true });
      }
      await recoverStalledBackgroundJobs({ jobId: id, ...scope, staleAfterMs: 90_000, limit: 1 });
      const job = await getBackgroundJob({ jobId: id, ...scope });
      after(async () => {
        try { await processBackgroundJobIds({ jobIds: [id], concurrency: 1, workerPrefix: "research-resume" }); }
        catch { log.warn("research.worker_resume_deferred", { jobId: id }); }
      });
      return apiJson({ ok: true, action, job, message: "Reconnected to the durable research job. Provider retry schedules are retained." });
    }

    if (action === "cancel") {
      const job = await requestBackgroundJobCancellation({
        jobId: id,
        ...scope,
      });

      return apiJson({
        ok: true,
        action,
        job,
      });
    }

    if (action === "retry") {
      const job = await retryBackgroundJob({
        jobId: id,
        ...scope,
        resetAttempts: body.resetAttempts !== false,
      });

      return apiJson({
        ok: true,
        action,
        job,
      });
    }

    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_JOB_ACTION",
      message: "Use action=cancel, action=retry, or action=resume for research jobs.",
      expose: true,
    });
  },
);
