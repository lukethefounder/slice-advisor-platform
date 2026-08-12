import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import {
  processBackgroundJobBatch,
  scheduleDueBackgroundJobs,
} from "@/lib/background-jobs/worker";
import { constantTimeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function clampInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function authorizedCron(request: Request) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const candidate = authorization.replace(/^Bearer\s+/i, "");

  return Boolean(candidate) && constantTimeEqual(candidate, secret);
}

const handler = withApiRoute(
  {
    route: "/api/cron/backend",
    timeoutMs: 290_000,
  },
  async ({ request }) => {
    if (!authorizedCron(request)) {
      throw new ApiError({
        status: 401,
        code: "UNAUTHORIZED_CRON_REQUEST",
        message: "Unauthorized cron request.",
        expose: true,
      });
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "both";

    if (!["schedule", "work", "both"].includes(mode)) {
      throw new ApiError({
        status: 400,
        code: "INVALID_CRON_MODE",
        message: "mode must be schedule, work, or both.",
        expose: true,
      });
    }

    const schedule =
      mode === "schedule" || mode === "both"
        ? await scheduleDueBackgroundJobs({
            userLimit: clampInteger(url.searchParams.get("users"), 50, 1, 100),
            onlyJobKey: url.searchParams.get("job"),
          })
        : null;
    const work =
      mode === "work" || mode === "both"
        ? await processBackgroundJobBatch({
            batchSize: clampInteger(url.searchParams.get("batch"), 8, 1, 20),
            maxRuntimeMs: 45_000,
          })
        : null;

    return apiJson({
      ok: true,
      mode,
      scheduled: schedule,
      worker: work
        ? {
            attempted: work.attempted,
            completed: work.completed,
            retrying: work.retrying,
            failed: work.failed,
            cancelled: work.cancelled,
            recovered: work.recovered,
            durationMs: work.durationMs,
          }
        : null,
      checkedAt: new Date().toISOString(),
    });
  },
);

export const GET = handler;
export const POST = handler;