import "server-only";

import { performance } from "node:perf_hooks";

import { Prisma } from "@/generated/prisma/client";
import { getBackgroundJobMetrics } from "@/lib/background-jobs/queue";
import { documentStorageConfigured } from "@/lib/document-center/storage";
import { getIntegrationRuntimeSnapshot } from "@/lib/integrations/core";
import { getAlphaVantageIntegrationStatus } from "@/lib/integrations/alpha-vantage";
import { getEmailIntegrationStatus } from "@/lib/integrations/email";
import { getSmsIntegrationStatus } from "@/lib/integrations/sms";
import { getStorageIntegrationStatus } from "@/lib/integrations/storage";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { validateProductionConfiguration } from "@/lib/production/config";
import { validateRuntimeEnvironment } from "@/lib/env";

export type ProductionCheckState = "ready" | "degraded" | "blocked";

export type ProductionCheck = {
  id: string;
  label: string;
  state: ProductionCheckState;
  summary: string;
  durationMs: number;
  details: Record<string, unknown>;
  recommendations: string[];
};

export type WebVitalSummary = {
  name: string;
  p75: number;
  sampleCount: number;
  rating: "good" | "needs-improvement" | "poor" | "insufficient-data";
  target: number;
  unit: string;
};

const operationsLog = createLogger("production-readiness");

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function decimal(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function measured<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();

  try {
    const value = await operation();
    return {
      ok: true as const,
      value,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  } catch (error) {
    return {
      ok: false as const,
      error,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  }
}

async function environmentCheck(): Promise<ProductionCheck> {
  const startedAt = performance.now();
  const runtime = validateRuntimeEnvironment({ mode: "production" });
  const production = validateProductionConfiguration({ production: true });
  const errorKeys = [
    ...runtime.errors.map((issue) => issue.key),
    ...production.errors.map((issue) => issue.key),
  ];
  const warningKeys = [
    ...runtime.warnings.map((issue) => issue.key),
    ...production.warnings.map((issue) => issue.key),
  ];

  return {
    id: "environment",
    label: "Production configuration",
    state: errorKeys.length ? "blocked" : warningKeys.length ? "degraded" : "ready",
    summary: errorKeys.length
      ? "Required production configuration is incomplete or invalid."
      : warningKeys.length
        ? "Production configuration is valid with recommendations pending."
        : "Required production configuration is valid.",
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    details: {
      errorKeys,
      warningKeys,
      cspMode: production.configuration.cspReportOnly
        ? "report-only"
        : "enforced",
      distributedRateLimitFailOpen:
        production.configuration.rateLimitFailOpen,
      webVitalsSampleRate: production.configuration.webVitalsSampleRate,
    },
    recommendations: [
      ...(errorKeys.length
        ? ["Configure every missing production variable before deployment."]
        : []),
      ...(production.configuration.cspReportOnly
        ? ["Move Content Security Policy from report-only to enforcement."]
        : []),
      ...(production.configuration.rateLimitFailOpen
        ? ["Disable production rate-limit fail-open mode after the incident ends."]
        : []),
    ],
  };
}

async function databaseCheck(): Promise<ProductionCheck> {
  const result = await measured(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const failedMigrations = await prisma.$queryRaw<
      Array<{
        migration_name: string;
        started_at: Date;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >(Prisma.sql`
      SELECT "migration_name", "started_at", "finished_at", "rolled_back_at"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NULL
        AND "rolled_back_at" IS NULL
      ORDER BY "started_at" DESC
      LIMIT 20
    `);

    const latestMigration = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >(Prisma.sql`
      SELECT "migration_name", "finished_at"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL
      ORDER BY "finished_at" DESC
      LIMIT 1
    `);

    return {
      failedMigrations,
      latestMigration: latestMigration[0] ?? null,
    };
  });

  if (!result.ok) {
    operationsLog.error("database.check_failed", result.error);
    return {
      id: "database",
      label: "PostgreSQL and migrations",
      state: "blocked",
      summary: "PostgreSQL readiness could not be verified.",
      durationMs: result.durationMs,
      details: {},
      recommendations: [
        "Verify DATABASE_URL, connection pooling, and migration deployment.",
      ],
    };
  }

  const pending = result.value.failedMigrations;
  return {
    id: "database",
    label: "PostgreSQL and migrations",
    state: pending.length ? "blocked" : "ready",
    summary: pending.length
      ? `${pending.length} database migration(s) are incomplete.`
      : "PostgreSQL connectivity and migration state are healthy.",
    durationMs: result.durationMs,
    details: {
      incompleteMigrationNames: pending.map((item) => item.migration_name),
      latestMigration: result.value.latestMigration?.migration_name ?? null,
      latestMigrationFinishedAt:
        result.value.latestMigration?.finished_at?.toISOString() ?? null,
    },
    recommendations: pending.length
      ? ["Resolve incomplete migrations before directing production traffic."]
      : [],
  };
}

async function queueCheck(firmId: string | null): Promise<ProductionCheck> {
  const result = await measured(async () => {
    const metrics = await getBackgroundJobMetrics({
      ...(firmId ? { firmId } : {}),
    });
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [staleProcessing, recentDeadLetters, recentFailures, latest] =
      await Promise.all([
        prisma.backendJobRun.count({
          where: {
            ...(firmId ? { firmId } : {}),
            status: "Processing",
            updatedAt: { lt: staleBefore },
          },
        }),
        prisma.backendJobRun.count({
          where: {
            ...(firmId ? { firmId } : {}),
            status: "DeadLetter",
            updatedAt: { gte: since },
          },
        }),
        prisma.backendJobRun.count({
          where: {
            ...(firmId ? { firmId } : {}),
            status: { in: ["Failed", "DeadLetter"] },
            updatedAt: { gte: since },
          },
        }),
        prisma.backendJobRun.findFirst({
          where: firmId ? { firmId } : undefined,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            jobKey: true,
            status: true,
            updatedAt: true,
          },
        }),
      ]);

    return {
      metrics,
      staleProcessing,
      recentDeadLetters,
      recentFailures,
      latest,
    };
  });

  if (!result.ok) {
    operationsLog.error("queue.check_failed", result.error);
    return {
      id: "background-jobs",
      label: "Background jobs",
      state: "blocked",
      summary: "The durable job queue could not be inspected.",
      durationMs: result.durationMs,
      details: {},
      recommendations: ["Verify the worker schema and PostgreSQL connectivity."],
    };
  }

  const value = result.value;
  const state: ProductionCheckState = value.staleProcessing
    ? "blocked"
    : value.recentDeadLetters || value.recentFailures > 5
      ? "degraded"
      : "ready";

  return {
    id: "background-jobs",
    label: "Background jobs",
    state,
    summary: value.staleProcessing
      ? `${value.staleProcessing} processing job(s) have stale leases.`
      : value.recentDeadLetters
        ? `${value.recentDeadLetters} dead-letter job(s) require review.`
        : "Queue states and worker leases are within operational thresholds.",
    durationMs: result.durationMs,
    details: {
      ...value.metrics,
      staleProcessing: value.staleProcessing,
      failuresLast24Hours: value.recentFailures,
      deadLettersLast24Hours: value.recentDeadLetters,
      latestJob: value.latest
        ? {
            id: value.latest.id,
            jobKey: value.latest.jobKey,
            status: value.latest.status,
            updatedAt: value.latest.updatedAt.toISOString(),
          }
        : null,
    },
    recommendations: [
      ...(value.staleProcessing
        ? ["Run stalled-job recovery and inspect the responsible worker."]
        : []),
      ...(value.recentDeadLetters
        ? ["Inspect and retry or resolve dead-letter jobs from Backend Kernel."]
        : []),
    ],
  };
}

async function integrationsCheck(): Promise<ProductionCheck> {
  const startedAt = performance.now();
  const alpha = getAlphaVantageIntegrationStatus();
  const email = getEmailIntegrationStatus();
  const sms = getSmsIntegrationStatus();
  const storage = getStorageIntegrationStatus();
  const runtime = getIntegrationRuntimeSnapshot();
  const circuits = runtime.circuits;
  const openCircuits = circuits.filter(
    (circuit) => String(circuit.state).toLowerCase() === "open",
  );
  const emailReady = email.ready;
  const smsReady = sms.ready;
  const storageReady = storage.ready;
  const blocked = !alpha.configured;
  const degraded =
    openCircuits.length > 0 ||
    !emailReady ||
    !smsReady ||
    !storageReady;

  return {
    id: "integrations",
    label: "External providers",
    state: blocked ? "blocked" : degraded ? "degraded" : "ready",
    summary: blocked
      ? "Alpha Vantage is not configured for the production intelligence surface."
      : openCircuits.length
        ? `${openCircuits.length} provider circuit(s) are open.`
        : "Configured provider adapters are available and circuit-protected.",
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    details: {
      alphaVantage: {
        configured: alpha.configured,
        entitlement: alpha.entitlement,
        circuits: alpha.circuits,
      },
      email: {
        enabled: email.enabled,
        configured: email.configured,
        mode: email.mode,
        ready: emailReady,
        circuits: email.circuits,
      },
      sms: {
        enabled: sms.enabled,
        configured: sms.configured,
        mode: sms.mode,
        ready: smsReady,
        circuits: sms.circuits,
      },
      storage: {
        configured: storage.configured,
        ready: storageReady,
        defaultAccess: storage.defaultAccess,
        circuits: storage.circuits,
      },
      policy: runtime.policy,
      openCircuitKeys: openCircuits.map((item) => item.key),
    },
    recommendations: [
      ...(!alpha.configured ? ["Configure ALPHA_VANTAGE_API_KEY."] : []),
      ...(openCircuits.length
        ? ["Inspect provider failures and allow circuit cooldown or fix credentials."]
        : []),
      ...(!emailReady ? ["Correct the live email provider configuration."] : []),
      ...(!smsReady ? ["Correct the live SMS provider configuration."] : []),
      ...(!storageReady ? ["Correct the object-storage configuration."] : []),
    ],
  };
}

async function documentsCheck(firmId: string | null): Promise<ProductionCheck> {
  const result = await measured(async () => {
    const staleBefore = new Date(Date.now() - 20 * 60_000);
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const where = firmId ? { firmId } : {};
    const [stale, failed, rejected, deletionRequested] = await Promise.all([
      prisma.documentVaultItem.count({
        where: {
          ...where,
          processingStatus: { in: ["Queued", "Processing"] },
          updatedAt: { lt: staleBefore },
          deletedAt: null,
        },
      }),
      prisma.documentVaultItem.count({
        where: {
          ...where,
          processingStatus: "Failed",
          updatedAt: { gte: since },
          deletedAt: null,
        },
      }),
      prisma.documentVaultItem.count({
        where: {
          ...where,
          securityStatus: "Rejected",
          updatedAt: { gte: since },
        },
      }),
      prisma.documentVaultItem.count({
        where: {
          ...where,
          status: { in: ["Deletion Requested", "Deleting"] },
        },
      }),
    ]);

    return { stale, failed, rejected, deletionRequested };
  });

  if (!result.ok) {
    operationsLog.error("documents.check_failed", result.error);
    return {
      id: "documents",
      label: "Secure documents",
      state: "blocked",
      summary: "Document processing readiness could not be verified.",
      durationMs: result.durationMs,
      details: { storageConfigured: documentStorageConfigured() },
      recommendations: ["Verify the Phase 9 migration and Blob configuration."],
    };
  }

  const storageConfigured = documentStorageConfigured();
  const value = result.value;
  const state: ProductionCheckState = !storageConfigured
    ? "degraded"
    : value.stale
      ? "blocked"
      : value.failed || value.rejected || value.deletionRequested
        ? "degraded"
        : "ready";

  return {
    id: "documents",
    label: "Secure documents",
    state,
    summary: !storageConfigured
      ? "Private document storage is not configured."
      : value.stale
        ? `${value.stale} document-processing item(s) are stale.`
        : "Document storage and processing are operational.",
    durationMs: result.durationMs,
    details: {
      storageConfigured,
      staleProcessing: value.stale,
      failuresLast24Hours: value.failed,
      securityRejectionsLast24Hours: value.rejected,
      deletionRequests: value.deletionRequested,
    },
    recommendations: [
      ...(!storageConfigured
        ? ["Connect a private Vercel Blob store before enabling uploads."]
        : []),
      ...(value.stale ? ["Reprocess or inspect stale document jobs."] : []),
      ...(value.rejected
        ? ["Review rejected uploads and confirm the user-facing guidance."]
        : []),
    ],
  };
}

async function communicationsCheck(firmId: string | null): Promise<ProductionCheck> {
  const result = await measured(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const overdueBefore = new Date(Date.now() - 10 * 60_000);
    const where = firmId ? { firmId } : {};
    const [failed, processingStale, needsApproval, queued] = await Promise.all([
      prisma.backendOutboundDelivery.count({
        where: {
          ...where,
          status: "Failed",
          updatedAt: { gte: since },
        },
      }),
      prisma.backendOutboundDelivery.count({
        where: {
          ...where,
          status: "Processing",
          updatedAt: { lt: overdueBefore },
        },
      }),
      prisma.backendOutboundDelivery.count({
        where: { ...where, status: "Needs Approval" },
      }),
      prisma.backendOutboundDelivery.count({
        where: { ...where, status: "Queued" },
      }),
    ]);

    return { failed, processingStale, needsApproval, queued };
  });

  if (!result.ok) {
    operationsLog.error("communications.check_failed", result.error);
    return {
      id: "communications",
      label: "Email and notifications",
      state: "blocked",
      summary: "Communication delivery state could not be inspected.",
      durationMs: result.durationMs,
      details: {},
      recommendations: ["Verify the Phase 6 and Phase 8 queue schema."],
    };
  }

  const value = result.value;
  const state: ProductionCheckState = value.processingStale
    ? "blocked"
    : value.failed
      ? "degraded"
      : "ready";

  return {
    id: "communications",
    label: "Email and notifications",
    state,
    summary: value.processingStale
      ? `${value.processingStale} delivery item(s) appear stuck in Processing.`
      : value.failed
        ? `${value.failed} delivery failure(s) occurred in the last 24 hours.`
        : "Delivery states are within operational thresholds.",
    durationMs: result.durationMs,
    details: value,
    recommendations: [
      ...(value.processingStale
        ? ["Inspect the notification worker and release stale delivery claims."]
        : []),
      ...(value.failed ? ["Review failed sends and retry after correcting providers."] : []),
    ],
  };
}

function vitalRating(name: string, p75: number, count: number) {
  const targets: Record<string, { good: number; poor: number; unit: string }> = {
    CLS: { good: 0.1, poor: 0.25, unit: "score" },
    FCP: { good: 1_800, poor: 3_000, unit: "ms" },
    INP: { good: 200, poor: 500, unit: "ms" },
    LCP: { good: 2_500, poor: 4_000, unit: "ms" },
    TTFB: { good: 800, poor: 1_800, unit: "ms" },
  };
  const target = targets[name] ?? { good: 0, poor: 0, unit: "value" };
  const rating: WebVitalSummary["rating"] =
    count < 20
      ? "insufficient-data"
      : p75 <= target.good
        ? "good"
        : p75 <= target.poor
          ? "needs-improvement"
          : "poor";

  return { rating, target: target.good, unit: target.unit };
}

async function webVitalsCheck(): Promise<{
  check: ProductionCheck;
  summaries: WebVitalSummary[];
}> {
  const result = await measured(async () => {
    return prisma.$queryRaw<
      Array<{ name: string; p75: number | string; sample_count: bigint | number }>
    >(Prisma.sql`
      SELECT
        "name",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY "value") AS "p75",
        COUNT(*) AS "sample_count"
      FROM "WebVitalSample"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY "name"
      ORDER BY "name"
    `);
  });

  if (!result.ok) {
    operationsLog.error("web_vitals.check_failed", result.error);
    return {
      summaries: [],
      check: {
        id: "web-vitals",
        label: "Web Vitals",
        state: "blocked",
        summary: "Web Vitals could not be queried.",
        durationMs: result.durationMs,
        details: {},
        recommendations: ["Apply the Phase 12 observability migration."],
      },
    };
  }

  const summaries = result.value.map((row) => {
    const p75 = decimal(row.p75);
    const sampleCount = integer(row.sample_count);
    const evaluation = vitalRating(row.name, p75, sampleCount);

    return {
      name: row.name,
      p75: Math.round(p75 * 100) / 100,
      sampleCount,
      ...evaluation,
    };
  });
  const poor = summaries.filter((item) => item.rating === "poor");
  const needsWork = summaries.filter(
    (item) => item.rating === "needs-improvement",
  );
  const sufficient = summaries.filter(
    (item) => item.rating !== "insufficient-data",
  );
  const state: ProductionCheckState = poor.length
    ? "blocked"
    : needsWork.length
      ? "degraded"
      : sufficient.length
        ? "ready"
        : "degraded";

  return {
    summaries,
    check: {
      id: "web-vitals",
      label: "Web Vitals",
      state,
      summary: poor.length
        ? `${poor.length} p75 Web Vital metric(s) exceed the poor threshold.`
        : needsWork.length
          ? `${needsWork.length} p75 Web Vital metric(s) need improvement.`
          : sufficient.length
            ? "Measured p75 Web Vitals meet current thresholds."
            : "Web Vitals collection is active but sample volume is still limited.",
      durationMs: result.durationMs,
      details: {
        windowDays: 7,
        summaries,
      },
      recommendations: [
        ...poor.map(
          (item) =>
            `Improve ${item.name}: p75 ${item.p75}${item.unit} exceeds the target ${item.target}${item.unit}.`,
        ),
        ...(!sufficient.length
          ? ["Collect at least 20 samples per metric before enforcing performance gates."]
          : []),
      ],
    },
  };
}

async function securityCheck(firmId: string | null): Promise<ProductionCheck> {
  const result = await measured(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [highSeverityEvents, activeBuckets, blockedBuckets] = await Promise.all([
      prisma.auditLog.count({
        where: {
          ...(firmId
            ? {
                user: {
                  firmMemberships: { some: { firmId, status: "Active" } },
                },
              }
            : {}),
          severity: { in: ["High", "Critical"] },
          createdAt: { gte: since },
        },
      }),
      prisma.securityRateLimitBucket.count({
        where: { resetAt: { gt: new Date() } },
      }),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS "count"
        FROM "SecurityRateLimitBucket"
        WHERE "resetAt" > NOW()
          AND "count" > "limit"
      `).then((rows) => integer(rows[0]?.count)).catch(() => 0),
    ]);

    return { highSeverityEvents, activeBuckets, blockedBuckets };
  });

  if (!result.ok) {
    operationsLog.error("security.check_failed", result.error);
    return {
      id: "security",
      label: "Security monitoring",
      state: "blocked",
      summary: "Security monitoring could not be queried.",
      durationMs: result.durationMs,
      details: {},
      recommendations: ["Apply the Phase 12 security migration."],
    };
  }

  const value = result.value;
  return {
    id: "security",
    label: "Security monitoring",
    state: value.highSeverityEvents > 10 ? "degraded" : "ready",
    summary: value.highSeverityEvents
      ? `${value.highSeverityEvents} high-severity security event(s) were recorded in the last 24 hours.`
      : "No high-severity authenticated security events were recorded in the last 24 hours.",
    durationMs: result.durationMs,
    details: value,
    recommendations:
      value.highSeverityEvents > 10
        ? ["Review high-severity audit events and investigate repeated patterns."]
        : [],
  };
}

function deploymentCheck(): ProductionCheck {
  const startedAt = performance.now();
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
    null;
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID || null;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || null;
  const production = environment === "production";
  const missingMetadata = production && (!commitSha || !appUrl);

  return {
    id: "deployment",
    label: "Deployment metadata",
    state: missingMetadata ? "degraded" : "ready",
    summary: missingMetadata
      ? "Production deployment metadata is incomplete."
      : "Deployment identity and application URL are available.",
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    details: {
      environment,
      commitSha,
      deploymentId,
      applicationOrigin: appUrl
        ? (() => {
            try {
              return new URL(appUrl).origin;
            } catch {
              return "invalid";
            }
          })()
        : null,
    },
    recommendations: missingMetadata
      ? ["Confirm APP_URL and deployment commit metadata are available."]
      : [],
  };
}

function readinessScore(checks: ProductionCheck[]) {
  if (!checks.length) return 0;
  const weights: Record<ProductionCheckState, number> = {
    ready: 1,
    degraded: 0.55,
    blocked: 0,
  };

  return Math.round(
    (checks.reduce((sum, check) => sum + weights[check.state], 0) /
      checks.length) *
      100,
  );
}

export async function buildProductionReadinessReport(input: {
  firmId: string | null;
}) {
  const startedAt = performance.now();
  const [environment, database, queue, integrations, documents, communications, vitals, security] =
    await Promise.all([
      environmentCheck(),
      databaseCheck(),
      queueCheck(input.firmId),
      integrationsCheck(),
      documentsCheck(input.firmId),
      communicationsCheck(input.firmId),
      webVitalsCheck(),
      securityCheck(input.firmId),
    ]);
  const checks = [
    environment,
    database,
    queue,
    integrations,
    documents,
    communications,
    vitals.check,
    security,
    deploymentCheck(),
  ];
  const blocked = checks.filter((check) => check.state === "blocked");
  const degraded = checks.filter((check) => check.state === "degraded");
  const score = readinessScore(checks);
  const status = blocked.length
    ? "blocked"
    : degraded.length
      ? "degraded"
      : "ready";
  const recommendations = Array.from(
    new Set(checks.flatMap((check) => check.recommendations)),
  ).slice(0, 30);

  return {
    ok: !blocked.length,
    status,
    readinessScore: score,
    generatedAt: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    deployment: checks.find((check) => check.id === "deployment")?.details ?? {},
    summary: {
      ready: checks.filter((check) => check.state === "ready").length,
      degraded: degraded.length,
      blocked: blocked.length,
      total: checks.length,
    },
    checks,
    webVitals: vitals.summaries,
    recommendations,
    acceptance: {
      productionTrafficRecommended: !blocked.length && score >= 85,
      reason: blocked.length
        ? `${blocked.length} blocking production check(s) remain.`
        : score < 85
          ? "No hard blockers remain, but readiness is below the 85-point release target."
          : "No blocking checks remain and the release score meets the target.",
    },
  };
}