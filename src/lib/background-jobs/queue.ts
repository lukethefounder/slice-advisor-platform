import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-route";
import type { BackendContext } from "@/lib/backend/config";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const BACKGROUND_JOB_STATUSES = [
  "Queued",
  "Retrying",
  "Processing",
  "Complete",
  "Failed",
  "DeadLetter",
  "Cancelled",
] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export type BackgroundJobRuntime = {
  jobId: string;
  attempt: number;
  signal: AbortSignal;
  payload: Record<string, unknown>;
  reportProgress: (progress: number, message?: string) => Promise<void>;
  throwIfCancelled: () => Promise<void>;
};

type BackgroundJobProgress = {
  value: number;
  message: string | null;
  updatedAt: string | null;
};

type BackgroundJobErrorState = {
  code: string;
  message: string;
  retryable: boolean;
  at: string;
};

export type BackgroundJobEnvelope = {
  version: 1;
  payload: Record<string, unknown>;
  idempotencyKeyHash: string;
  idempotencyEventKey: string;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  backoffMs: number;
  availableAt: string;
  workerId: string | null;
  lockedAt: string | null;
  leaseExpiresAt: string | null;
  cancellationRequestedAt: string | null;
  progress: BackgroundJobProgress;
  output: Record<string, unknown> | null;
  lastError: BackgroundJobErrorState | null;
  queuedAt: string;
};

type JobRunRow = {
  id: string;
  userId: string;
  firmId: string | null;
  jobKey: string;
  jobName: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  resultJson: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicBackgroundJob = {
  id: string;
  userId: string;
  firmId: string | null;
  jobKey: string;
  jobName: string;
  status: BackgroundJobStatus | string;
  attempt: number;
  maxAttempts: number;
  progress: BackgroundJobProgress;
  availableAt: string;
  queuedAt: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  cancellationRequestedAt: string | null;
  error: string | null;
  lastError: BackgroundJobErrorState | null;
  output: Record<string, unknown> | null;
  payloadKeys: string[];
  payload?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueBackgroundJobInput = {
  context: BackendContext;
  jobKey: string;
  jobName: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  availableAt?: Date;
  maxAttempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
};

export type EnqueueBackgroundJobResult = {
  job: PublicBackgroundJob;
  duplicate: boolean;
};

const queueLog = createLogger("background-jobs");
const MAX_PAYLOAD_BYTES = 128 * 1024;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_BACKOFF_MS = 5_000;
const DEFAULT_LEASE_MS = 75_000;

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

function normalizedPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  try {
    const serialized = JSON.stringify(value);

    if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
      throw new ApiError({
        status: 413,
        code: "JOB_PAYLOAD_TOO_LARGE",
        message: "The background-job payload exceeds the 128 KB limit.",
        expose: true,
      });
    }

    return JSON.parse(serialized) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError({
      status: 400,
      code: "INVALID_JOB_PAYLOAD",
      message: "The background-job payload must be JSON serializable.",
      expose: true,
      cause: error,
    });
  }
}

function safeMessage(value: unknown, fallback = "Background job failed.") {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|token|secret|password)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000) || fallback;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function defaultIdempotencyKey(input: {
  jobKey: string;
  payload: Record<string, unknown>;
}) {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return `manual:${input.jobKey}:${hash(stableJson(input.payload)).slice(0, 20)}:${minuteBucket}`;
}

function idempotencyIdentity(input: {
  context: BackendContext;
  jobKey: string;
  idempotencyKey: string;
}) {
  const digest = hash(
    [
      input.context.userId,
      input.context.firmId ?? "personal",
      input.jobKey,
      input.idempotencyKey,
    ].join(":"),
  );

  return {
    digest,
    eventKey: `background-job:${digest}`,
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function isKnownStatus(value: string): value is BackgroundJobStatus {
  return BACKGROUND_JOB_STATUSES.includes(value as BackgroundJobStatus);
}

function legacyEnvelope(row: JobRunRow): BackgroundJobEnvelope {
  let parsed: Record<string, unknown> = {};

  try {
    const candidate = JSON.parse(row.resultJson);
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    parsed = {};
  }

  return {
    version: 1,
    payload: {},
    idempotencyKeyHash: "legacy",
    idempotencyEventKey: "",
    attempt: row.status === "Running" ? 1 : 0,
    maxAttempts: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    backoffMs: DEFAULT_BACKOFF_MS,
    availableAt: row.startedAt.toISOString(),
    workerId: null,
    lockedAt: null,
    leaseExpiresAt: null,
    cancellationRequestedAt: null,
    progress: {
      value: row.status === "Complete" ? 100 : 0,
      message: null,
      updatedAt: row.updatedAt.toISOString(),
    },
    output: Object.keys(parsed).length ? parsed : null,
    lastError: row.error
      ? {
          code: "LEGACY_JOB_ERROR",
          message: safeMessage(row.error),
          retryable: false,
          at: row.updatedAt.toISOString(),
        }
      : null,
    queuedAt: row.createdAt.toISOString(),
  };
}

export function parseBackgroundJobEnvelope(row: JobRunRow): BackgroundJobEnvelope {
  try {
    const parsed = JSON.parse(row.resultJson) as Partial<BackgroundJobEnvelope>;

    if (parsed?.version !== 1 || !parsed.payload || !parsed.progress) {
      return legacyEnvelope(row);
    }

    return {
      version: 1,
      payload: normalizedPayload(parsed.payload),
      idempotencyKeyHash: String(parsed.idempotencyKeyHash ?? "legacy"),
      idempotencyEventKey: String(parsed.idempotencyEventKey ?? ""),
      attempt: clampInteger(parsed.attempt, 0, 0, 100),
      maxAttempts: clampInteger(parsed.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 10),
      timeoutMs: clampInteger(parsed.timeoutMs, DEFAULT_TIMEOUT_MS, 5_000, 300_000),
      backoffMs: clampInteger(parsed.backoffMs, DEFAULT_BACKOFF_MS, 1_000, 300_000),
      availableAt: String(parsed.availableAt ?? row.startedAt.toISOString()),
      workerId: parsed.workerId ? String(parsed.workerId) : null,
      lockedAt: parsed.lockedAt ? String(parsed.lockedAt) : null,
      leaseExpiresAt: parsed.leaseExpiresAt ? String(parsed.leaseExpiresAt) : null,
      cancellationRequestedAt: parsed.cancellationRequestedAt
        ? String(parsed.cancellationRequestedAt)
        : null,
      progress: {
        value: clampInteger(parsed.progress.value, 0, 0, 100),
        message: parsed.progress.message ? String(parsed.progress.message).slice(0, 500) : null,
        updatedAt: parsed.progress.updatedAt ? String(parsed.progress.updatedAt) : null,
      },
      output:
        parsed.output && typeof parsed.output === "object" && !Array.isArray(parsed.output)
          ? (parsed.output as Record<string, unknown>)
          : null,
      lastError: parsed.lastError
        ? {
            code: String(parsed.lastError.code ?? "JOB_FAILED").slice(0, 120),
            message: safeMessage(parsed.lastError.message),
            retryable: Boolean(parsed.lastError.retryable),
            at: String(parsed.lastError.at ?? row.updatedAt.toISOString()),
          }
        : null,
      queuedAt: String(parsed.queuedAt ?? row.createdAt.toISOString()),
    };
  } catch {
    return legacyEnvelope(row);
  }
}

function serializeEnvelope(envelope: BackgroundJobEnvelope) {
  return JSON.stringify(envelope);
}

export function publicBackgroundJob(
  row: JobRunRow,
  options: { includePayload?: boolean } = {},
): PublicBackgroundJob {
  const envelope = parseBackgroundJobEnvelope(row);

  return {
    id: row.id,
    userId: row.userId,
    firmId: row.firmId,
    jobKey: row.jobKey,
    jobName: row.jobName,
    status: isKnownStatus(row.status) ? row.status : row.status,
    attempt: envelope.attempt,
    maxAttempts: envelope.maxAttempts,
    progress: envelope.progress,
    availableAt: envelope.availableAt,
    queuedAt: envelope.queuedAt,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    cancellationRequestedAt: envelope.cancellationRequestedAt,
    error: row.error ? safeMessage(row.error) : null,
    lastError: envelope.lastError,
    output: envelope.output,
    payloadKeys: Object.keys(envelope.payload).slice(0, 50),
    ...(options.includePayload ? { payload: envelope.payload } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function updateIdempotencyEvent(
  row: Pick<JobRunRow, "userId">,
  envelope: BackgroundJobEnvelope,
  status: string,
  detail?: string,
) {
  if (!envelope.idempotencyEventKey) return;

  await prisma.backendPlatformEvent
    .update({
      where: {
        userId_eventKey: {
          userId: row.userId,
          eventKey: envelope.idempotencyEventKey,
        },
      },
      data: {
        status,
        detail: detail?.slice(0, 1_000),
      },
    })
    .catch(() => null);
}

export async function enqueueBackgroundJob(
  input: EnqueueBackgroundJobInput,
): Promise<EnqueueBackgroundJobResult> {
  const payload = normalizedPayload(input.payload ?? {});
  const availableAt = input.availableAt ?? new Date();
  const maxAttempts = clampInteger(input.maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 10);
  const timeoutMs = clampInteger(input.timeoutMs, DEFAULT_TIMEOUT_MS, 5_000, 300_000);
  const backoffMs = clampInteger(input.backoffMs, DEFAULT_BACKOFF_MS, 1_000, 300_000);
  const idempotencyKey =
    String(input.idempotencyKey ?? "").trim().slice(0, 500) ||
    defaultIdempotencyKey({ jobKey: input.jobKey, payload });
  const identity = idempotencyIdentity({
    context: input.context,
    jobKey: input.jobKey,
    idempotencyKey,
  });
  const queuedAt = new Date();
  const envelope: BackgroundJobEnvelope = {
    version: 1,
    payload,
    idempotencyKeyHash: identity.digest,
    idempotencyEventKey: identity.eventKey,
    attempt: 0,
    maxAttempts,
    timeoutMs,
    backoffMs,
    availableAt: availableAt.toISOString(),
    workerId: null,
    lockedAt: null,
    leaseExpiresAt: null,
    cancellationRequestedAt: null,
    progress: {
      value: 0,
      message: availableAt.getTime() > Date.now() ? "Scheduled" : "Waiting for a worker",
      updatedAt: queuedAt.toISOString(),
    },
    output: null,
    lastError: null,
    queuedAt: queuedAt.toISOString(),
  };

  try {
    const row = await prisma.$transaction(async (transaction) => {
      const created = await transaction.backendJobRun.create({
        data: {
          userId: input.context.userId,
          firmId: input.context.firmId,
          jobKey: input.jobKey,
          jobName: input.jobName,
          status: "Queued",
          startedAt: availableAt,
          completedAt: null,
          durationMs: null,
          resultJson: serializeEnvelope(envelope),
          error: null,
        },
      });

      await transaction.backendPlatformEvent.create({
        data: {
          userId: input.context.userId,
          firmId: input.context.firmId,
          eventKey: identity.eventKey,
          eventType: "background_job.queued",
          area: "Background Jobs",
          actorName: input.context.actorName,
          title: `Background job queued: ${input.jobName}`,
          detail: "A durable background job was added to the PostgreSQL queue.",
          severity: "Info",
          status: "Queued",
          sourceType: "BackendJobRun",
          sourceId: created.id,
          metadataJson: JSON.stringify({
            jobKey: input.jobKey,
            maxAttempts,
            timeoutMs,
            availableAt: availableAt.toISOString(),
            idempotencyHash: identity.digest.slice(0, 24),
          }),
        },
      });

      return created;
    });

    queueLog.info("job.queued", {
      jobId: row.id,
      jobKey: row.jobKey,
      userId: row.userId,
      firmId: row.firmId,
      availableAt: envelope.availableAt,
    });

    return {
      job: publicBackgroundJob(row),
      duplicate: false,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const event = await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId: input.context.userId,
          eventKey: identity.eventKey,
        },
      },
      select: {
        sourceId: true,
      },
    });

    const existing = event?.sourceId
      ? await prisma.backendJobRun.findFirst({
          where: {
            id: event.sourceId,
            userId: input.context.userId,
          },
        })
      : null;

    if (!existing) {
      throw new ApiError({
        status: 409,
        code: "JOB_IDEMPOTENCY_CONFLICT",
        message: "An equivalent background job is already being registered. Retry shortly.",
        expose: true,
      });
    }

    return {
      job: publicBackgroundJob(existing),
      duplicate: true,
    };
  }
}

export async function listBackgroundJobs(input: {
  userId?: string;
  firmId?: string | null;
  statuses?: string[];
  limit?: number;
  includePayload?: boolean;
}) {
  const limit = clampInteger(input.limit, 30, 1, 100);
  const where: Prisma.BackendJobRunWhereInput = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
    ...(input.statuses?.length ? { status: { in: input.statuses.slice(0, 10) } } : {}),
  };

  const rows = await prisma.backendJobRun.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return rows.map((row) =>
    publicBackgroundJob(row, {
      includePayload: input.includePayload,
    }),
  );
}

export async function getBackgroundJobMetrics(input: {
  userId?: string;
  firmId?: string | null;
}) {
  const where: Prisma.BackendJobRunWhereInput = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
  };
  const groups = await prisma.backendJobRun.groupBy({
    by: ["status"],
    where,
    _count: {
      _all: true,
    },
  });
  const byStatus = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));

  return {
    queued: Number(byStatus.Queued ?? 0) + Number(byStatus.Retrying ?? 0),
    processing: Number(byStatus.Processing ?? 0),
    complete: Number(byStatus.Complete ?? 0),
    failed: Number(byStatus.Failed ?? 0),
    deadLetter: Number(byStatus.DeadLetter ?? 0),
    cancelled: Number(byStatus.Cancelled ?? 0),
    byStatus,
  };
}

export async function getBackgroundJob(input: {
  jobId: string;
  userId?: string;
  firmId?: string | null;
  includePayload?: boolean;
}) {
  const row = await prisma.backendJobRun.findFirst({
    where: {
      id: input.jobId,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
    },
  });

  return row
    ? publicBackgroundJob(row, {
        includePayload: input.includePayload,
      })
    : null;
}

export async function claimNextBackgroundJob(input: {
  workerId: string;
  leaseMs?: number;
}) {
  const leaseMs = clampInteger(input.leaseMs, DEFAULT_LEASE_MS, 20_000, 300_000);

  return prisma.$transaction(async (transaction) => {
    const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "BackendJobRun"
      WHERE "status" IN ('Queued', 'Retrying')
        AND "startedAt" <= NOW()
      ORDER BY "startedAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const candidate = candidates[0];

    if (!candidate) return null;

    const current = await transaction.backendJobRun.findUnique({
      where: { id: candidate.id },
    });

    if (!current) return null;

    const envelope = parseBackgroundJobEnvelope(current);
    const now = new Date();

    if (envelope.cancellationRequestedAt) {
      const cancelledEnvelope: BackgroundJobEnvelope = {
        ...envelope,
        workerId: null,
        lockedAt: null,
        leaseExpiresAt: null,
        progress: {
          value: envelope.progress.value,
          message: "Cancelled before processing",
          updatedAt: now.toISOString(),
        },
      };

      await transaction.backendJobRun.update({
        where: { id: current.id },
        data: {
          status: "Cancelled",
          completedAt: now,
          durationMs: 0,
          resultJson: serializeEnvelope(cancelledEnvelope),
          error: null,
        },
      });

      return null;
    }

    const processingEnvelope: BackgroundJobEnvelope = {
      ...envelope,
      attempt: envelope.attempt + 1,
      workerId: input.workerId,
      lockedAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      progress: {
        value: Math.max(1, envelope.progress.value),
        message: `Processing attempt ${envelope.attempt + 1}`,
        updatedAt: now.toISOString(),
      },
    };

    const updated = await transaction.backendJobRun.update({
      where: { id: current.id },
      data: {
        status: "Processing",
        startedAt: now,
        completedAt: null,
        durationMs: null,
        resultJson: serializeEnvelope(processingEnvelope),
        error: null,
      },
    });

    return {
      row: updated,
      envelope: processingEnvelope,
    };
  });
}

/**
 * Claims one specific queued job.
 *
 * Interactive workflows already know which durable job they created. Claiming
 * that exact row prevents older unrelated queue work from delaying the user.
 * PostgreSQL row locking and SKIP LOCKED preserve the at-most-one-worker rule.
 */
/**
 * Marks a queued or retrying job for an immediate targeted worker wake-up.
 *
 * This does not execute the job. It updates the durable queue timestamp and
 * progress marker so recovery logic can distinguish a first wake request from
 * a worker that remained unavailable after the recovery grace period.
 */
export async function requestBackgroundJobWake(input: {
  jobId: string;
  userId?: string;
  firmId?: string | null;
}) {
  const row = await prisma.backendJobRun.findFirst({
    where: {
      id: String(input.jobId ?? "").trim(),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
      status: {
        in: ["Queued", "Retrying"],
      },
    },
  });

  if (!row) {
    return null;
  }

  const envelope = parseBackgroundJobEnvelope(row);
  const now = new Date();
  const nextEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    availableAt: now.toISOString(),
    progress: {
      value: Math.max(3, envelope.progress.value),
      message: "Immediate worker recovery requested",
      updatedAt: now.toISOString(),
    },
  };

  const updated = await prisma.backendJobRun.update({
    where: {
      id: row.id,
    },
    data: {
      status: "Queued",
      startedAt: now,
      completedAt: null,
      durationMs: null,
      resultJson: serializeEnvelope(nextEnvelope),
      error: null,
    },
  });

  return publicBackgroundJob(updated);
}

export async function claimBackgroundJobById(input: {
  jobId: string;
  workerId: string;
  leaseMs?: number;
}) {
  const jobId = String(input.jobId ?? "").trim();

  if (!jobId) {
    return null;
  }

  const leaseMs = clampInteger(
    input.leaseMs,
    DEFAULT_LEASE_MS,
    20_000,
    300_000,
  );

  return prisma.$transaction(async (transaction) => {
    const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "BackendJobRun"
      WHERE "id" = ${jobId}
        AND "status" IN ('Queued', 'Retrying')
        AND "startedAt" <= NOW()
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const candidate = candidates[0];

    if (!candidate) {
      return null;
    }

    const current = await transaction.backendJobRun.findUnique({
      where: {
        id: candidate.id,
      },
    });

    if (!current) {
      return null;
    }

    const envelope = parseBackgroundJobEnvelope(current);
    const now = new Date();

    if (envelope.cancellationRequestedAt) {
      const cancelledEnvelope: BackgroundJobEnvelope = {
        ...envelope,
        workerId: null,
        lockedAt: null,
        leaseExpiresAt: null,
        progress: {
          value: envelope.progress.value,
          message: "Cancelled before processing",
          updatedAt: now.toISOString(),
        },
      };

      await transaction.backendJobRun.update({
        where: {
          id: current.id,
        },
        data: {
          status: "Cancelled",
          completedAt: now,
          durationMs: 0,
          resultJson: serializeEnvelope(cancelledEnvelope),
          error: null,
        },
      });

      return null;
    }

    const processingEnvelope: BackgroundJobEnvelope = {
      ...envelope,
      attempt: envelope.attempt + 1,
      workerId: input.workerId,
      lockedAt: now.toISOString(),
      leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      progress: {
        value: Math.max(1, envelope.progress.value),
        message: `Processing attempt ${envelope.attempt + 1}`,
        updatedAt: now.toISOString(),
      },
    };

    const updated = await transaction.backendJobRun.update({
      where: {
        id: current.id,
      },
      data: {
        status: "Processing",
        startedAt: now,
        completedAt: null,
        durationMs: null,
        resultJson: serializeEnvelope(processingEnvelope),
        error: null,
      },
    });

    return {
      row: updated,
      envelope: processingEnvelope,
    };
  });
}

export async function heartbeatBackgroundJob(input: {
  jobId: string;
  workerId: string;
  progress?: number;
  message?: string;
  leaseMs?: number;
}) {
  const row = await prisma.backendJobRun.findFirst({
    where: {
      id: input.jobId,
      status: "Processing",
    },
  });

  if (!row) return { active: false, cancelled: false };

  const envelope = parseBackgroundJobEnvelope(row);

  if (envelope.workerId !== input.workerId) {
    return { active: false, cancelled: Boolean(envelope.cancellationRequestedAt) };
  }

  const now = new Date();
  const leaseMs = clampInteger(input.leaseMs, DEFAULT_LEASE_MS, 20_000, 300_000);
  const nextEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
    progress: {
      value:
        input.progress === undefined
          ? envelope.progress.value
          : clampInteger(input.progress, envelope.progress.value, 0, 100),
      message:
        input.message === undefined
          ? envelope.progress.message
          : String(input.message).trim().slice(0, 500) || null,
      updatedAt: now.toISOString(),
    },
  };

  await prisma.backendJobRun.update({
    where: { id: row.id },
    data: {
      resultJson: serializeEnvelope(nextEnvelope),
    },
  });

  return {
    active: true,
    cancelled: Boolean(nextEnvelope.cancellationRequestedAt),
  };
}

export async function readBackgroundJobControl(input: {
  jobId: string;
  workerId?: string;
}) {
  const row = await prisma.backendJobRun.findUnique({
    where: { id: input.jobId },
  });

  if (!row) {
    return {
      active: false,
      cancelled: true,
      status: "Missing",
    };
  }

  const envelope = parseBackgroundJobEnvelope(row);

  return {
    active:
      row.status === "Processing" &&
      (!input.workerId || envelope.workerId === input.workerId),
    cancelled: Boolean(envelope.cancellationRequestedAt) || row.status === "Cancelled",
    status: row.status,
  };
}

export async function completeBackgroundJob(input: {
  jobId: string;
  workerId: string;
  output: Record<string, unknown>;
}) {
  const row = await prisma.backendJobRun.findUnique({
    where: { id: input.jobId },
  });

  if (!row) return null;

  const envelope = parseBackgroundJobEnvelope(row);

  if (row.status !== "Processing" || envelope.workerId !== input.workerId) {
    return null;
  }

  const now = new Date();
  const completedEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    workerId: null,
    lockedAt: null,
    leaseExpiresAt: null,
    output: normalizedPayload(input.output),
    lastError: null,
    progress: {
      value: 100,
      message: "Completed",
      updatedAt: now.toISOString(),
    },
  };
  const updated = await prisma.backendJobRun.update({
    where: { id: row.id },
    data: {
      status: "Complete",
      completedAt: now,
      durationMs: Math.max(0, now.getTime() - row.startedAt.getTime()),
      resultJson: serializeEnvelope(completedEnvelope),
      error: null,
    },
  });

  await updateIdempotencyEvent(row, completedEnvelope, "Complete", "Background job completed.");

  return publicBackgroundJob(updated);
}

function retryDelayMs(envelope: BackgroundJobEnvelope) {
  const exponent = Math.max(0, envelope.attempt - 1);
  const deterministic = Math.min(15 * 60_000, envelope.backoffMs * 2 ** exponent);
  const jitter = Math.floor(Math.random() * Math.min(2_000, envelope.backoffMs));
  return deterministic + jitter;
}

export async function failBackgroundJob(input: {
  jobId: string;
  workerId?: string;
  code: string;
  error: unknown;
  retryable: boolean;
}) {
  const row = await prisma.backendJobRun.findUnique({
    where: { id: input.jobId },
  });

  if (!row) return null;

  const envelope = parseBackgroundJobEnvelope(row);

  if (
    row.status === "Processing" &&
    input.workerId &&
    envelope.workerId &&
    envelope.workerId !== input.workerId
  ) {
    return null;
  }

  const now = new Date();
  const message = safeMessage(input.error);
  const lastError: BackgroundJobErrorState = {
    code: String(input.code || "JOB_FAILED").slice(0, 120),
    message,
    retryable: input.retryable,
    at: now.toISOString(),
  };

  if (envelope.cancellationRequestedAt) {
    const cancelledEnvelope: BackgroundJobEnvelope = {
      ...envelope,
      workerId: null,
      lockedAt: null,
      leaseExpiresAt: null,
      lastError,
      progress: {
        value: envelope.progress.value,
        message: "Cancelled",
        updatedAt: now.toISOString(),
      },
    };
    const cancelled = await prisma.backendJobRun.update({
      where: { id: row.id },
      data: {
        status: "Cancelled",
        completedAt: now,
        durationMs: Math.max(0, now.getTime() - row.startedAt.getTime()),
        resultJson: serializeEnvelope(cancelledEnvelope),
        error: null,
      },
    });

    await updateIdempotencyEvent(row, cancelledEnvelope, "Cancelled", "Background job cancelled.");
    return publicBackgroundJob(cancelled);
  }

  if (input.retryable && envelope.attempt < envelope.maxAttempts) {
    const delayMs = retryDelayMs(envelope);
    const availableAt = new Date(now.getTime() + delayMs);
    const retryEnvelope: BackgroundJobEnvelope = {
      ...envelope,
      workerId: null,
      lockedAt: null,
      leaseExpiresAt: null,
      availableAt: availableAt.toISOString(),
      lastError,
      progress: {
        value: 0,
        message: `Retry scheduled after attempt ${envelope.attempt}`,
        updatedAt: now.toISOString(),
      },
    };
    const retry = await prisma.backendJobRun.update({
      where: { id: row.id },
      data: {
        status: "Retrying",
        startedAt: availableAt,
        completedAt: null,
        durationMs: null,
        resultJson: serializeEnvelope(retryEnvelope),
        error: message,
      },
    });

    await updateIdempotencyEvent(row, retryEnvelope, "Retrying", message);
    return publicBackgroundJob(retry);
  }

  const finalStatus: BackgroundJobStatus =
    envelope.attempt >= envelope.maxAttempts ? "DeadLetter" : "Failed";
  const failedEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    workerId: null,
    lockedAt: null,
    leaseExpiresAt: null,
    lastError,
    progress: {
      value: envelope.progress.value,
      message: finalStatus === "DeadLetter" ? "Moved to dead letter" : "Failed",
      updatedAt: now.toISOString(),
    },
  };
  const failed = await prisma.backendJobRun.update({
    where: { id: row.id },
    data: {
      status: finalStatus,
      completedAt: now,
      durationMs: Math.max(0, now.getTime() - row.startedAt.getTime()),
      resultJson: serializeEnvelope(failedEnvelope),
      error: message,
    },
  });

  await updateIdempotencyEvent(row, failedEnvelope, finalStatus, message);
  return publicBackgroundJob(failed);
}

export async function requestBackgroundJobCancellation(input: {
  jobId: string;
  userId?: string;
  firmId?: string | null;
}) {
  const row = await prisma.backendJobRun.findFirst({
    where: {
      id: input.jobId,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
    },
  });

  if (!row) {
    throw new ApiError({
      status: 404,
      code: "BACKGROUND_JOB_NOT_FOUND",
      message: "Background job not found.",
      expose: true,
    });
  }

  if (["Complete", "Failed", "DeadLetter", "Cancelled"].includes(row.status)) {
    throw new ApiError({
      status: 409,
      code: "BACKGROUND_JOB_TERMINAL",
      message: `The job is already ${row.status.toLowerCase()} and cannot be cancelled.`,
      expose: true,
    });
  }

  const envelope = parseBackgroundJobEnvelope(row);
  const now = new Date();
  const cancellationEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    cancellationRequestedAt: envelope.cancellationRequestedAt ?? now.toISOString(),
    progress: {
      ...envelope.progress,
      message: row.status === "Processing" ? "Cancellation requested" : "Cancelled",
      updatedAt: now.toISOString(),
    },
  };
  const immediate = row.status === "Queued" || row.status === "Retrying";
  const updated = await prisma.backendJobRun.update({
    where: { id: row.id },
    data: {
      status: immediate ? "Cancelled" : row.status,
      completedAt: immediate ? now : null,
      durationMs: immediate ? 0 : null,
      resultJson: serializeEnvelope(cancellationEnvelope),
      error: null,
    },
  });

  if (immediate) {
    await updateIdempotencyEvent(row, cancellationEnvelope, "Cancelled", "Background job cancelled.");
  }

  return publicBackgroundJob(updated);
}

export async function retryBackgroundJob(input: {
  jobId: string;
  userId?: string;
  firmId?: string | null;
  resetAttempts?: boolean;
}) {
  const row = await prisma.backendJobRun.findFirst({
    where: {
      id: input.jobId,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.firmId !== undefined ? { firmId: input.firmId } : {}),
    },
  });

  if (!row) {
    throw new ApiError({
      status: 404,
      code: "BACKGROUND_JOB_NOT_FOUND",
      message: "Background job not found.",
      expose: true,
    });
  }

  if (!["Failed", "DeadLetter", "Cancelled"].includes(row.status)) {
    throw new ApiError({
      status: 409,
      code: "BACKGROUND_JOB_NOT_RETRYABLE",
      message: "Only failed, dead-lettered, or cancelled jobs can be retried manually.",
      expose: true,
    });
  }

  const envelope = parseBackgroundJobEnvelope(row);
  const now = new Date();
  const retryEnvelope: BackgroundJobEnvelope = {
    ...envelope,
    attempt: input.resetAttempts === false ? envelope.attempt : 0,
    availableAt: now.toISOString(),
    workerId: null,
    lockedAt: null,
    leaseExpiresAt: null,
    cancellationRequestedAt: null,
    output: null,
    lastError: envelope.lastError,
    progress: {
      value: 0,
      message: "Manual retry queued",
      updatedAt: now.toISOString(),
    },
  };
  const updated = await prisma.backendJobRun.update({
    where: { id: row.id },
    data: {
      status: "Queued",
      startedAt: now,
      completedAt: null,
      durationMs: null,
      resultJson: serializeEnvelope(retryEnvelope),
      error: null,
    },
  });

  await updateIdempotencyEvent(row, retryEnvelope, "Queued", "Background job manually retried.");
  return publicBackgroundJob(updated);
}

export async function recoverStalledBackgroundJobs(input: {
  staleAfterMs?: number;
  limit?: number;
}) {
  const staleAfterMs = clampInteger(input.staleAfterMs, DEFAULT_LEASE_MS, 20_000, 15 * 60_000);
  const limit = clampInteger(input.limit, 25, 1, 100);
  const cutoff = new Date(Date.now() - staleAfterMs);
  const rows = await prisma.backendJobRun.findMany({
    where: {
      status: "Processing",
      updatedAt: {
        lt: cutoff,
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: limit,
  });

  let recovered = 0;
  let deadLettered = 0;

  for (const row of rows) {
    const envelope = parseBackgroundJobEnvelope(row);
    const leaseUntil = envelope.leaseExpiresAt ? Date.parse(envelope.leaseExpiresAt) : 0;

    if (Number.isFinite(leaseUntil) && leaseUntil > Date.now()) continue;

    const result = await failBackgroundJob({
      jobId: row.id,
      code: "JOB_LEASE_EXPIRED",
      error: new Error("The worker lease expired before the job completed."),
      retryable: true,
    });

    if (result?.status === "Retrying") recovered += 1;
    if (result?.status === "DeadLetter") deadLettered += 1;
  }

  if (rows.length) {
    queueLog.warn("jobs.stalled_recovered", {
      inspected: rows.length,
      recovered,
      deadLettered,
    });
  }

  return {
    inspected: rows.length,
    recovered,
    deadLettered,
  };
}

export class BackgroundJobCancelledError extends Error {
  constructor(message = "Background job cancellation was requested.") {
    super(message);
    this.name = "BackgroundJobCancelledError";
  }
}

export class BackgroundJobTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Background job exceeded its ${timeoutMs}ms execution limit.`);
    this.name = "BackgroundJobTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function createWorkerId(prefix = "slice-worker") {
  const deployment = String(process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL ?? "local")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(0, 80);

  return `${prefix}:${deployment}:${process.pid}:${randomUUID().slice(0, 8)}`;
}