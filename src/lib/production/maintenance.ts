import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getProductionConfiguration } from "@/lib/production/config";
import { pruneRateLimitBuckets } from "@/lib/rate-limit";

export type MaintenanceResult = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  batchSize: number;
  removed: Record<string, number>;
  preserved: string[];
  warnings: string[];
};

const maintenanceLog = createLogger("production-maintenance");

function dateBefore(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000);
}

async function boundedDelete(input: {
  table: string;
  predicate: Prisma.Sql;
  batchSize: number;
}) {
  const allowedTables = new Set([
    "Session",
    "ClientPortalSession",
    "WebVitalSample",
    "BackendJobRun",
    "RealtimePriceSnapshot",
  ]);

  if (!allowedTables.has(input.table)) {
    throw new Error(`Unsupported maintenance table: ${input.table}`);
  }

  const table = Prisma.raw(`\"${input.table}\"`);
  const result = await prisma.$queryRaw<Array<{ removed: bigint | number }>>(
    Prisma.sql`
      WITH selected AS (
        SELECT "id"
        FROM ${table}
        WHERE ${input.predicate}
        ORDER BY "id"
        LIMIT ${input.batchSize}
      ), deleted AS (
        DELETE FROM ${table}
        WHERE "id" IN (SELECT "id" FROM selected)
        RETURNING "id"
      )
      SELECT COUNT(*) AS "removed" FROM deleted
    `,
  );

  return Number(result[0]?.removed ?? 0);
}

export async function runProductionMaintenance(options?: {
  batchSize?: number;
}) : Promise<MaintenanceResult> {
  const startedAtDate = new Date();
  const configuration = getProductionConfiguration();
  const batchSize = Math.max(
    100,
    Math.min(10_000, options?.batchSize ?? configuration.maintenanceBatchSize),
  );
  const removed: Record<string, number> = {};
  const warnings: string[] = [];

  removed.expiredRateLimitBuckets = (
    await pruneRateLimitBuckets(new Date(Date.now() - 24 * 60 * 60_000))
  ).count;
  removed.expiredAdvisorSessions = await boundedDelete({
    table: "Session",
    predicate: Prisma.sql`"expiresAt" < NOW()`,
    batchSize,
  });
  removed.expiredClientSessions = await boundedDelete({
    table: "ClientPortalSession",
    predicate: Prisma.sql`"expiresAt" < NOW()`,
    batchSize,
  });
  removed.oldWebVitals = await boundedDelete({
    table: "WebVitalSample",
    predicate: Prisma.sql`"createdAt" < ${dateBefore(
      configuration.webVitalsRetentionDays,
    )}`,
    batchSize,
  });
  removed.oldCompletedJobs = await boundedDelete({
    table: "BackendJobRun",
    predicate: Prisma.sql`
      "status" IN ('Complete', 'Cancelled')
      AND "updatedAt" < ${dateBefore(configuration.completedJobRetentionDays)}
    `,
    batchSize,
  });
  removed.oldFailedJobs = await boundedDelete({
    table: "BackendJobRun",
    predicate: Prisma.sql`
      "status" IN ('Failed', 'DeadLetter')
      AND "updatedAt" < ${dateBefore(configuration.failedJobRetentionDays)}
    `,
    batchSize,
  });

  if (configuration.marketSnapshotRetentionDays) {
    removed.oldMarketSnapshots = await boundedDelete({
      table: "RealtimePriceSnapshot",
      predicate: Prisma.sql`"createdAt" < ${dateBefore(
        configuration.marketSnapshotRetentionDays,
      )}`,
      batchSize,
    });
  } else {
    warnings.push(
      "Market snapshot pruning is disabled because MARKET_SNAPSHOT_RETENTION_DAYS is blank.",
    );
  }

  const completedAtDate = new Date();
  const result: MaintenanceResult = {
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    durationMs: Math.max(0, completedAtDate.getTime() - startedAtDate.getTime()),
    batchSize,
    removed,
    preserved: [
      "AuditLog",
      "DocumentAuditEvent",
      "ClientAdvisorAssignmentAudit",
      "DisclosureAcceptance",
      "BackendPlatformEvent",
    ],
    warnings,
  };

  maintenanceLog.info("maintenance.completed", result);
  return result;
}