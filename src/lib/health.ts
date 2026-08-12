import "server-only";

import { timingSafeEqual } from "node:crypto";

import {
  getIntegrationStatuses,
  numberEnv,
  validateRuntimeEnvironment,
  type EnvironmentValidationMode,
} from "@/lib/env";
import { createLogger } from "@/lib/logger";

export type HealthCheckState = "ok" | "degraded" | "error";

export type HealthCheck = {
  state: HealthCheckState;
  message: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export type ReadinessOptions = {
  includeDiagnostics?: boolean;
};

const healthLogger = createLogger("health");
const DATABASE_TIMEOUT_MS = Math.round(
  numberEnv("DB_CONNECTION_TIMEOUT_MS", 5_000, {
    minimum: 1_000,
    maximum: 60_000,
  }),
);

function deploymentEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
}

function commitSha() {
  const value =
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "";

  return value ? value.slice(0, 12) : null;
}

function validationMode(): EnvironmentValidationMode {
  if (process.env.CI) return "ci";
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "production";
  }
  return "development";
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Health check exceeded ${timeoutMs}ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkDatabase(includeDiagnostics: boolean): Promise<HealthCheck> {
  const startedAt = performance.now();

  try {
    const { prisma, databasePoolSnapshot } = await import("@/lib/prisma");

    await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_TIMEOUT_MS);

    return {
      state: "ok",
      message: "PostgreSQL connection verified.",
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      ...(includeDiagnostics
        ? {
            metadata: {
              pool: databasePoolSnapshot(),
            },
          }
        : {}),
    };
  } catch (error) {
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

    healthLogger.error("database.check_failed", error, { durationMs });

    return {
      state: "error",
      message: "PostgreSQL connection could not be verified.",
      durationMs,
    };
  }
}

function checkEnvironment(includeDiagnostics: boolean): HealthCheck {
  const result = validateRuntimeEnvironment({ mode: validationMode() });

  if (result.errors.length) {
    return {
      state: "error",
      message: "Required runtime configuration is incomplete or invalid.",
      ...(includeDiagnostics
        ? {
            metadata: {
              errorKeys: result.errors.map((issue) => issue.key),
              warningKeys: result.warnings.map((issue) => issue.key),
            },
          }
        : {}),
    };
  }

  if (result.warnings.length) {
    return {
      state: "degraded",
      message: "Required configuration is valid, with recommendations pending.",
      ...(includeDiagnostics
        ? {
            metadata: {
              warningKeys: result.warnings.map((issue) => issue.key),
            },
          }
        : {}),
    };
  }

  return {
    state: "ok",
    message: "Required runtime configuration is valid.",
  };
}

function integrationSummary() {
  return getIntegrationStatuses().map((integration) => ({
    key: integration.key,
    category: integration.category,
    status: integration.safeStatus,
    configured: integration.configured,
    ...(integration.liveEnabled === undefined
      ? {}
      : { liveEnabled: integration.liveEnabled }),
  }));
}

function safeSecretEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function healthDiagnosticsAuthorized(request: Request) {
  const expected =
    String(process.env.HEALTHCHECK_SECRET ?? "").trim() ||
    String(process.env.CRON_SECRET ?? "").trim();

  if (!expected) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const directHeader = request.headers.get("x-health-secret")?.trim() ?? "";
  const candidate = bearer || directHeader;

  return candidate ? safeSecretEqual(candidate, expected) : false;
}

export function buildLivenessReport(requestId: string) {
  return {
    ok: true,
    status: "alive" as const,
    service: "slice-platform",
    requestId,
    checkedAt: new Date().toISOString(),
    environment: deploymentEnvironment(),
    commitSha: commitSha(),
  };
}

export async function buildReadinessReport(
  requestId: string,
  options: ReadinessOptions = {},
) {
  const startedAt = performance.now();
  const includeDiagnostics = options.includeDiagnostics ?? false;
  const [database] = await Promise.all([checkDatabase(includeDiagnostics)]);
  const environment = checkEnvironment(includeDiagnostics);
  const checks = {
    environment,
    database,
  };
  const hasCriticalFailure = Object.values(checks).some(
    (check) => check.state === "error",
  );
  const hasDegradedCheck = Object.values(checks).some(
    (check) => check.state === "degraded",
  );
  const status = hasCriticalFailure
    ? "not_ready"
    : hasDegradedCheck
      ? "degraded"
      : "ready";

  return {
    ok: !hasCriticalFailure,
    status,
    service: "slice-platform",
    requestId,
    checkedAt: new Date().toISOString(),
    environment: deploymentEnvironment(),
    commitSha: commitSha(),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    checks,
    ...(includeDiagnostics ? { integrations: integrationSummary() } : {}),
  };
}