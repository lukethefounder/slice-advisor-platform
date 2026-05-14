import { prisma } from "@/lib/prisma";
import { BackendContext } from "@/lib/backend/config";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

export async function emitBackendEvent(
  context: BackendContext,
  input: {
    eventKey?: string;
    eventType: string;
    area: string;
    title: string;
    detail?: string | null;
    severity?: string;
    status?: string;
    sourceType?: string | null;
    sourceId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const eventKey =
    input.eventKey ??
    `${input.eventType}:${input.sourceType ?? "manual"}:${input.sourceId ?? Date.now()}`;

  return prisma.backendPlatformEvent.upsert({
    where: {
      userId_eventKey: {
        userId: context.userId,
        eventKey,
      },
    },
    update: {
      firmId: context.firmId,
      eventType: input.eventType,
      area: input.area,
      actorName: context.actorName,
      title: input.title,
      detail: input.detail,
      severity: input.severity ?? "Info",
      status: input.status ?? "Recorded",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: asJson(input.metadata ?? {}),
    },
    create: {
      userId: context.userId,
      firmId: context.firmId,
      eventKey,
      eventType: input.eventType,
      area: input.area,
      actorName: context.actorName,
      title: input.title,
      detail: input.detail,
      severity: input.severity ?? "Info",
      status: input.status ?? "Recorded",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: asJson(input.metadata ?? {}),
    },
  });
}

export async function recordDataQuality(
  context: BackendContext,
  input: {
    entityType: string;
    entityId: string;
    sourceName: string;
    liveStatus: string;
    freshnessStatus: string;
    qualityScore: number;
    fallbackUsed?: boolean;
    warning?: string | null;
    warnings?: string[];
    asOfAt?: Date | null;
  }
) {
  return prisma.backendDataQualityRecord.upsert({
    where: {
      userId_entityType_entityId_sourceName: {
        userId: context.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        sourceName: input.sourceName,
      },
    },
    update: {
      firmId: context.firmId,
      liveStatus: input.liveStatus,
      freshnessStatus: input.freshnessStatus,
      qualityScore: input.qualityScore,
      fallbackUsed: input.fallbackUsed ?? false,
      warning: input.warning,
      warningsJson: asJson(input.warnings ?? (input.warning ? [input.warning] : [])),
      asOfAt: input.asOfAt ?? undefined,
      lastCheckedAt: new Date(),
    },
    create: {
      userId: context.userId,
      firmId: context.firmId,
      entityType: input.entityType,
      entityId: input.entityId,
      sourceName: input.sourceName,
      liveStatus: input.liveStatus,
      freshnessStatus: input.freshnessStatus,
      qualityScore: input.qualityScore,
      fallbackUsed: input.fallbackUsed ?? false,
      warning: input.warning,
      warningsJson: asJson(input.warnings ?? (input.warning ? [input.warning] : [])),
      asOfAt: input.asOfAt,
      lastCheckedAt: new Date(),
    },
  });
}

export async function startBackendJobRun(
  context: BackendContext,
  input: {
    jobKey: string;
    jobName: string;
  }
) {
  return prisma.backendJobRun.create({
    data: {
      userId: context.userId,
      firmId: context.firmId,
      jobKey: input.jobKey,
      jobName: input.jobName,
      status: "Running",
      startedAt: new Date(),
    },
  });
}

export async function finishBackendJobRun(
  runId: string,
  input: {
    status: "Complete" | "Failed" | "Skipped";
    startedAt: Date;
    result?: Record<string, unknown>;
    error?: string | null;
  }
) {
  const completedAt = new Date();

  return prisma.backendJobRun.update({
    where: {
      id: runId,
    },
    data: {
      status: input.status,
      completedAt,
      durationMs: completedAt.getTime() - input.startedAt.getTime(),
      resultJson: asJson(input.result ?? {}),
      error: input.error ?? null,
    },
  });
}

export async function recordAiToolRun(
  context: BackendContext,
  input: {
    toolKey: string;
    toolName: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    status?: string;
    approvalId?: string | null;
    durationMs?: number | null;
  }
) {
  return prisma.backendAiToolRun.create({
    data: {
      userId: context.userId,
      firmId: context.firmId,
      toolKey: input.toolKey,
      toolName: input.toolName,
      inputJson: asJson(input.input),
      outputJson: asJson(input.output ?? {}),
      status: input.status ?? "Complete",
      approvalId: input.approvalId,
      durationMs: input.durationMs,
    },
  });
}