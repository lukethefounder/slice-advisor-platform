import "server-only";

import { ApiError } from "@/lib/api-route";
import type { BackendContext } from "@/lib/backend/config";
import {
  enqueueBackendJob,
  executeBackendJob,
  isSupportedBackgroundJobKey,
  type SupportedBackgroundJobKey,
} from "@/lib/backend/jobs";
import { emitBackendEvent } from "@/lib/backend/events";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  BackgroundJobCancelledError,
  BackgroundJobTimeoutError,
  claimBackgroundJobById,
  claimNextBackgroundJob,
  completeBackgroundJob,
  createWorkerId,
  failBackgroundJob,
  heartbeatBackgroundJob,
  readBackgroundJobControl,
  recoverStalledBackgroundJobs,
  type BackgroundJobRuntime,
} from "@/lib/background-jobs/queue";

const workerLog = createLogger("background-jobs:worker");
const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_MAX_RUNTIME_MS = 45_000;
const DEFAULT_HEARTBEAT_MS = 8_000;

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function safeErrorCode(error: unknown) {
  if (error instanceof BackgroundJobCancelledError) return "JOB_CANCELLED";
  if (error instanceof BackgroundJobTimeoutError) return "JOB_TIMEOUT";

  if (error && typeof error === "object" && "code" in error) {
    return String(error.code).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  }

  return "JOB_EXECUTION_FAILED";
}

function retryableError(error: unknown) {
  if (error instanceof BackgroundJobCancelledError) return false;
  if (error instanceof BackgroundJobTimeoutError) return true;

  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }

  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean(error.retryable);
  }

  return true;
}

async function contextForJob(input: {
  userId: string;
  firmId: string | null;
}): Promise<BackendContext> {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      platformStatus: {
        notIn: ["Banned", "Suspended"],
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    throw new ApiError({
      status: 409,
      code: "JOB_OWNER_INACTIVE",
      message: "The job owner is no longer active.",
      expose: false,
    });
  }

  if (input.firmId) {
    const membership = await prisma.firmMembership.findFirst({
      where: {
        userId: user.id,
        firmId: input.firmId,
        status: "Active",
        firm: {
          platformStatus: "Active",
        },
      },
      select: {
        firmId: true,
      },
    });

    if (!membership) {
      const founderFirm = await prisma.firm.findFirst({
        where: {
          id: input.firmId,
          createdByUserId: user.id,
          platformStatus: "Active",
        },
        select: {
          id: true,
        },
      });

      if (!founderFirm) {
        throw new ApiError({
          status: 409,
          code: "JOB_FIRM_CONTEXT_INACTIVE",
          message: "The job firm context is no longer active.",
          expose: false,
        });
      }
    }
  }

  return {
    userId: user.id,
    firmId: input.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };
}

async function updateJobDefinition(input: {
  context: BackendContext;
  jobKey: string;
  status: "Ready" | "Failed";
  result?: Record<string, unknown>;
  error?: string;
}) {
  await prisma.backendJobDefinition.updateMany({
    where: {
      userId: input.context.userId,
      firmId: input.context.firmId,
      jobKey: input.jobKey,
    },
    data: {
      lastRunAt: new Date(),
      status: input.status,
      lastResultJson: JSON.stringify(
        input.result ?? {
          error: input.error ?? "Background job failed.",
        },
      ),
    },
  });
}

async function executeClaimedJob(input: {
  workerId: string;
  claimed: NonNullable<Awaited<ReturnType<typeof claimNextBackgroundJob>>>;
}) {
  const { row, envelope } = input.claimed;
  const context = await contextForJob({
    userId: row.userId,
    firmId: row.firmId,
  });
  const controller = new AbortController();
  let lastCancellationCheckAt = 0;
  let cancelled = false;
  let progress = envelope.progress.value;
  let progressMessage = envelope.progress.message ?? undefined;
  let heartbeatRunning = false;

  const checkCancellation = async (force = false) => {
    if (!force && Date.now() - lastCancellationCheckAt < 750) {
      if (cancelled) throw new BackgroundJobCancelledError();
      return;
    }

    lastCancellationCheckAt = Date.now();
    const control = await readBackgroundJobControl({
      jobId: row.id,
      workerId: input.workerId,
    });

    cancelled = control.cancelled || !control.active;

    if (cancelled) {
      controller.abort();
      throw new BackgroundJobCancelledError();
    }
  };

  const runtime: BackgroundJobRuntime = {
    jobId: row.id,
    attempt: envelope.attempt,
    signal: controller.signal,
    payload: envelope.payload,
    async reportProgress(nextProgress, message) {
      progress = clampInteger(nextProgress, progress, 0, 99);
      progressMessage = message?.trim().slice(0, 500) || progressMessage;
      const heartbeat = await heartbeatBackgroundJob({
        jobId: row.id,
        workerId: input.workerId,
        progress,
        message: progressMessage,
      });

      if (!heartbeat.active || heartbeat.cancelled) {
        cancelled = true;
        controller.abort();
        throw new BackgroundJobCancelledError();
      }
    },
    async throwIfCancelled() {
      await checkCancellation();
    },
  };

  const heartbeatTimer = setInterval(() => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;

    void heartbeatBackgroundJob({
      jobId: row.id,
      workerId: input.workerId,
      progress,
      message: progressMessage,
    })
      .then((state) => {
        if (!state.active || state.cancelled) {
          cancelled = true;
          controller.abort();
        }
      })
      .finally(() => {
        heartbeatRunning = false;
      });
  }, DEFAULT_HEARTBEAT_MS);

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        controller.abort();
        reject(new BackgroundJobTimeoutError(envelope.timeoutMs));
      }, envelope.timeoutMs);
    });

    await runtime.reportProgress(Math.max(2, progress), "Worker started");

    const output = await Promise.race([
      executeBackendJob(context, row.jobKey, runtime),
      timeoutPromise,
    ]);

    await checkCancellation(true);

    const completed = await completeBackgroundJob({
      jobId: row.id,
      workerId: input.workerId,
      output,
    });

    await updateJobDefinition({
      context,
      jobKey: row.jobKey,
      status: "Ready",
      result: output,
    });

    await emitBackendEvent(context, {
      eventKey: `background-job-complete:${row.id}`,
      eventType: "background_job.completed",
      area: "Background Jobs",
      title: `Background job completed: ${row.jobName}`,
      detail: "The queued operation completed successfully.",
      sourceType: "BackendJobRun",
      sourceId: row.id,
      metadata: {
        jobKey: row.jobKey,
        attempt: envelope.attempt,
        durationMs: completed?.durationMs ?? null,
      },
    });

    workerLog.info("job.completed", {
      jobId: row.id,
      jobKey: row.jobKey,
      attempt: envelope.attempt,
    });

    return {
      id: row.id,
      jobKey: row.jobKey,
      status: "Complete" as const,
    };
  } catch (error) {
    const code = safeErrorCode(error);
    const retryable = retryableError(error);
    const failed = await failBackgroundJob({
      jobId: row.id,
      workerId: input.workerId,
      code,
      error,
      retryable,
    });

    await updateJobDefinition({
      context,
      jobKey: row.jobKey,
      status: failed?.status === "Retrying" ? "Ready" : "Failed",
      error: error instanceof Error ? error.message : "Background job failed.",
    });

    await emitBackendEvent(context, {
      eventKey: `background-job-result:${row.id}:${envelope.attempt}`,
      eventType:
        failed?.status === "Retrying"
          ? "background_job.retry_scheduled"
          : failed?.status === "Cancelled"
            ? "background_job.cancelled"
            : "background_job.failed",
      area: "Background Jobs",
      title:
        failed?.status === "Retrying"
          ? `Background job retry scheduled: ${row.jobName}`
          : failed?.status === "Cancelled"
            ? `Background job cancelled: ${row.jobName}`
            : `Background job failed: ${row.jobName}`,
      detail:
        failed?.status === "Retrying"
          ? "The operation failed with a retryable error and was rescheduled."
          : failed?.status === "Cancelled"
            ? "The operation stopped after a cancellation request."
            : "The operation failed and requires review.",
      severity: failed?.status === "Retrying" ? "Medium" : "High",
      status: failed?.status ?? "Failed",
      sourceType: "BackendJobRun",
      sourceId: row.id,
      metadata: {
        jobKey: row.jobKey,
        attempt: envelope.attempt,
        code,
        retryable,
      },
    });

    workerLog.error("job.failed", error, {
      jobId: row.id,
      jobKey: row.jobKey,
      attempt: envelope.attempt,
      nextStatus: failed?.status,
      retryable,
    });

    return {
      id: row.id,
      jobKey: row.jobKey,
      status: failed?.status ?? "Failed",
    };
  } finally {
    clearInterval(heartbeatTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

export async function processBackgroundJobBatch(input: {
  batchSize?: number;
  maxRuntimeMs?: number;
  workerId?: string;
}) {
  const batchSize = clampInteger(input.batchSize, DEFAULT_BATCH_SIZE, 1, 25);
  const maxRuntimeMs = clampInteger(
    input.maxRuntimeMs,
    DEFAULT_MAX_RUNTIME_MS,
    5_000,
    55_000,
  );
  const workerId = input.workerId?.trim().slice(0, 180) || createWorkerId();
  const startedAt = Date.now();
  const recovered = await recoverStalledBackgroundJobs({
    staleAfterMs: 90_000,
    limit: 25,
  });
  const results: Array<{
    id: string;
    jobKey: string;
    status: string;
  }> = [];

  while (results.length < batchSize && Date.now() - startedAt < maxRuntimeMs - 2_000) {
    const claimed = await claimNextBackgroundJob({
      workerId,
    });

    if (!claimed) break;

    if (!isSupportedBackgroundJobKey(claimed.row.jobKey)) {
      const failed = await failBackgroundJob({
        jobId: claimed.row.id,
        workerId,
        code: "UNSUPPORTED_JOB_KEY",
        error: new Error(`Unsupported background job key: ${claimed.row.jobKey}`),
        retryable: false,
      });

      results.push({
        id: claimed.row.id,
        jobKey: claimed.row.jobKey,
        status: failed?.status ?? "Failed",
      });
      continue;
    }

    results.push(
      await executeClaimedJob({
        workerId,
        claimed,
      }),
    );
  }

  const summary = {
    workerId,
    attempted: results.length,
    completed: results.filter((item) => item.status === "Complete").length,
    retrying: results.filter((item) => item.status === "Retrying").length,
    failed: results.filter((item) => ["Failed", "DeadLetter"].includes(item.status)).length,
    cancelled: results.filter((item) => item.status === "Cancelled").length,
    recovered,
    durationMs: Date.now() - startedAt,
    results,
  };

  workerLog.info("batch.completed", {
    attempted: summary.attempted,
    completed: summary.completed,
    retrying: summary.retrying,
    failed: summary.failed,
    cancelled: summary.cancelled,
    durationMs: summary.durationMs,
  });

  return summary;
}


/**
 * Processes a known set of durable jobs immediately.
 *
 * The normal cron worker remains the recovery and always-on execution path.
 * This targeted path is used by interactive workflows so newly queued work is
 * not forced to wait for the next cron tick or unrelated older queue items.
 */
export async function processBackgroundJobIds(input: {
  jobIds: string[];
  concurrency?: number;
  maxRuntimeMs?: number;
  workerPrefix?: string;
}) {
  const jobIds = Array.from(
    new Set(
      input.jobIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 50);
  const concurrency = clampInteger(
    input.concurrency,
    Math.min(4, Math.max(1, jobIds.length)),
    1,
    6,
  );
  const maxRuntimeMs = clampInteger(
    input.maxRuntimeMs,
    80_000,
    5_000,
    240_000,
  );
  const workerPrefix =
    String(input.workerPrefix ?? "slice-targeted-worker")
      .replace(/[^A-Za-z0-9._-]/g, "-")
      .slice(0, 80) || "slice-targeted-worker";
  const startedAt = Date.now();
  const recovered = await recoverStalledBackgroundJobs({
    staleAfterMs: 90_000,
    limit: 25,
  });
  const results: Array<{
    id: string;
    jobKey: string;
    status: string;
  }> = [];
  let cursor = 0;

  async function run(workerIndex: number) {
    const workerId = createWorkerId(`${workerPrefix}-${workerIndex + 1}`);

    while (
      cursor < jobIds.length &&
      Date.now() - startedAt < maxRuntimeMs - 1_500
    ) {
      const currentIndex = cursor;
      cursor += 1;
      const jobId = jobIds[currentIndex];

      if (!jobId) {
        continue;
      }

      const claimed = await claimBackgroundJobById({
        jobId,
        workerId,
      });

      if (!claimed) {
        results.push({
          id: jobId,
          jobKey: "unknown",
          status: "Skipped",
        });
        continue;
      }

      if (!isSupportedBackgroundJobKey(claimed.row.jobKey)) {
        const failed = await failBackgroundJob({
          jobId: claimed.row.id,
          workerId,
          code: "UNSUPPORTED_JOB_KEY",
          error: new Error(
            `Unsupported background job key: ${claimed.row.jobKey}`,
          ),
          retryable: false,
        });

        results.push({
          id: claimed.row.id,
          jobKey: claimed.row.jobKey,
          status: failed?.status ?? "Failed",
        });
        continue;
      }

      results.push(
        await executeClaimedJob({
          workerId,
          claimed,
        }),
      );
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, jobIds.length || 1) },
      (_, index) => run(index),
    ),
  );

  const summary = {
    requested: jobIds.length,
    attempted: results.filter((item) => item.status !== "Skipped").length,
    completed: results.filter((item) => item.status === "Complete").length,
    retrying: results.filter((item) => item.status === "Retrying").length,
    failed: results.filter((item) =>
      ["Failed", "DeadLetter"].includes(item.status),
    ).length,
    cancelled: results.filter((item) => item.status === "Cancelled").length,
    skipped: results.filter((item) => item.status === "Skipped").length,
    recovered,
    durationMs: Date.now() - startedAt,
    results,
  };

  workerLog.info("targeted_batch.completed", {
    requested: summary.requested,
    attempted: summary.attempted,
    completed: summary.completed,
    retrying: summary.retrying,
    failed: summary.failed,
    cancelled: summary.cancelled,
    skipped: summary.skipped,
    durationMs: summary.durationMs,
  });

  return summary;
}

function utcHourSetting() {
  return clampInteger(process.env.BACKGROUND_JOB_DAILY_HOUR_UTC, 14, 0, 23);
}

function fiveMinuteBucket(date: Date) {
  const minute = Math.floor(date.getUTCMinutes() / 5) * 5;
  return `${date.toISOString().slice(0, 13)}:${String(minute).padStart(2, "0")}`;
}

function hourBucket(date: Date) {
  return date.toISOString().slice(0, 13);
}

function minuteBucket(date: Date) {
  return date.toISOString().slice(0, 16);
}

function dateBucket(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dueScheduledJobs(date: Date) {
  const jobs: SupportedBackgroundJobKey[] = [];
  const minute = date.getUTCMinutes();
  const hour = date.getUTCHours();
  const weekday = date.getUTCDay();

  jobs.push("notification_delivery");

  if (minute % 5 === 0) jobs.push("watchlist_price_check");

  if (minute < 5) {
    jobs.push("vendor_health", "data_quality_sweep");
  }

  if (weekday >= 1 && weekday <= 5 && hour === utcHourSetting() && minute < 5) {
    jobs.push("advisor_day");
  }

  return jobs;
}

function scheduledIdempotencyKey(jobKey: SupportedBackgroundJobKey, date: Date) {
  if (jobKey === "notification_delivery") {
    return `cron:${jobKey}:${minuteBucket(date)}`;
  }

  if (jobKey === "watchlist_price_check") {
    return `cron:${jobKey}:${fiveMinuteBucket(date)}`;
  }

  if (jobKey === "advisor_day") {
    return `cron:${jobKey}:${dateBucket(date)}`;
  }

  return `cron:${jobKey}:${hourBucket(date)}`;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results: R[] = [];
  let index = 0;

  async function run() {
    while (index < values.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(values[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run()),
  );

  return results;
}

export async function scheduleDueBackgroundJobs(input: {
  now?: Date;
  userLimit?: number;
  onlyJobKey?: string | null;
}) {
  const now = input.now ?? new Date();
  const userLimit = clampInteger(input.userLimit, 50, 1, 100);
  const due = input.onlyJobKey
    ? isSupportedBackgroundJobKey(input.onlyJobKey)
      ? [input.onlyJobKey]
      : []
    : dueScheduledJobs(now);

  if (!due.length) {
    return {
      usersScanned: 0,
      jobsConsidered: 0,
      queued: 0,
      duplicates: 0,
      jobKeys: [],
    };
  }

  const users = await prisma.user.findMany({
    where: {
      platformStatus: {
        notIn: ["Banned", "Suspended"],
      },
      firmMemberships: {
        some: {
          status: "Active",
          firm: {
            platformStatus: "Active",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      firmMemberships: {
        where: {
          status: "Active",
          firm: {
            platformStatus: "Active",
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        select: {
          firmId: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: userLimit,
  });
  const userIds = users.map((user) => user.id);
  const [queuedDeliveryOwners, activeAlertOwners] = await Promise.all([
    due.includes("notification_delivery")
      ? prisma.backendOutboundDelivery.findMany({
          where: {
            userId: { in: userIds },
            status: "Queued",
          },
          select: { userId: true },
          distinct: ["userId"],
        })
      : Promise.resolve([]),
    due.includes("watchlist_price_check")
      ? prisma.watchlistPriceAlert.findMany({
          where: {
            userId: { in: userIds },
            status: "Active",
          },
          select: { userId: true },
          distinct: ["userId"],
        })
      : Promise.resolve([]),
  ]);
  const deliveryOwners = new Set(queuedDeliveryOwners.map((item) => item.userId));
  const alertOwners = new Set(activeAlertOwners.map((item) => item.userId));
  const tasks: Array<{
    context: BackendContext;
    jobKey: SupportedBackgroundJobKey;
  }> = [];

  for (const user of users) {
    const firmId = user.firmMemberships[0]?.firmId;
    if (!firmId) continue;

    const context: BackendContext = {
      userId: user.id,
      firmId,
      actorName: user.name,
      actorEmail: user.email,
    };

    for (const jobKey of due) {
      if (jobKey === "notification_delivery" && !deliveryOwners.has(user.id)) continue;
      if (jobKey === "watchlist_price_check" && !alertOwners.has(user.id)) continue;
      tasks.push({ context, jobKey });
    }
  }

  const scheduled = await mapWithConcurrency(tasks, 5, async (task) => {
    return enqueueBackendJob(task.context, task.jobKey, {
      idempotencyKey: scheduledIdempotencyKey(task.jobKey, now),
    });
  });

  return {
    usersScanned: users.length,
    jobsConsidered: tasks.length,
    queued: scheduled.filter((item) => !item.duplicate).length,
    duplicates: scheduled.filter((item) => item.duplicate).length,
    jobKeys: due,
  };
}