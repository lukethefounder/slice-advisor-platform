import "server-only";

import { performance } from "node:perf_hooks";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { boolEnv, numberEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const UPSERT_MAX_ATTEMPTS = 3;
const databaseLogger = createLogger("database");

function databaseUrl() {
  const value = String(process.env.DATABASE_URL ?? "").trim();

  if (!value) {
    throw new Error(
      "Missing DATABASE_URL. Slice requires a PostgreSQL connection string for runtime access.",
    );
  }

  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error(
      "Invalid DATABASE_URL. Slice requires a PostgreSQL URL beginning with postgresql:// or postgres://.",
    );
  }

  return value;
}

function integerSetting(
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return Math.round(
    numberEnv(key, fallback, {
      minimum,
      maximum,
    }),
  );
}

function defaultPoolMaximum() {
  return process.env.VERCEL ? 5 : 10;
}

function applicationName() {
  const configured = String(process.env.DB_APPLICATION_NAME ?? "")
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 63);

  return configured || "slice-platform";
}

const databaseRuntimeSettings = Object.freeze({
  poolMaximum: integerSetting("DB_POOL_MAX", defaultPoolMaximum(), 1, 50),
  connectionTimeoutMs: integerSetting(
    "DB_CONNECTION_TIMEOUT_MS",
    5_000,
    1_000,
    60_000,
  ),
  idleTimeoutMs: integerSetting(
    "DB_IDLE_TIMEOUT_MS",
    300_000,
    1_000,
    600_000,
  ),
  statementTimeoutMs: integerSetting(
    "DB_STATEMENT_TIMEOUT_MS",
    120_000,
    1_000,
    600_000,
  ),
  transactionMaxWaitMs: integerSetting(
    "DB_TRANSACTION_MAX_WAIT_MS",
    5_000,
    1_000,
    60_000,
  ),
  transactionTimeoutMs: integerSetting(
    "DB_TRANSACTION_TIMEOUT_MS",
    30_000,
    1_000,
    120_000,
  ),
  slowQueryThresholdMs: integerSetting(
    "DB_SLOW_QUERY_MS",
    750,
    50,
    60_000,
  ),
  queryLogging: boolEnv("DB_QUERY_LOGGING", false),
  applicationName: applicationName(),
});

function adapterConfiguration() {
  return {
    connectionString: databaseUrl(),
    max: databaseRuntimeSettings.poolMaximum,
    connectionTimeoutMillis: databaseRuntimeSettings.connectionTimeoutMs,
    idleTimeoutMillis: databaseRuntimeSettings.idleTimeoutMs,
    statement_timeout: databaseRuntimeSettings.statementTimeoutMs,
    application_name: databaseRuntimeSettings.applicationName,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    allowExitOnIdle: false,
  };
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is { code: "P2002" } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002",
  );
}

function retryDelay(attempt: number) {
  const exponentialDelayMs = 20 * 2 ** attempt;
  const jitterMs = Math.floor(Math.random() * 20);

  return new Promise<void>((resolve) => {
    setTimeout(resolve, exponentialDelayMs + jitterMs);
  });
}

function createPrismaClient() {
  // Prisma ORM 7 delegates PostgreSQL pooling to the underlying pg driver.
  // Supplying the pool controls to PrismaPg keeps the runtime on Prisma's
  // documented adapter path while avoiding pg's unbounded connection timeout.
  const adapter = new PrismaPg(adapterConfiguration());
  const baseClient = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
    transactionOptions: {
      maxWait: databaseRuntimeSettings.transactionMaxWaitMs,
      timeout: databaseRuntimeSettings.transactionTimeoutMs,
    },
  });

  const observedClient = baseClient.$extends({
    name: "slice-database-observability",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const startedAt = performance.now();

          try {
            const result = await query(args);
            const durationMs = Math.max(
              0,
              Math.round(performance.now() - startedAt),
            );

            if (durationMs >= databaseRuntimeSettings.slowQueryThresholdMs) {
              databaseLogger.warn("query.slow", {
                model,
                operation,
                durationMs,
                thresholdMs: databaseRuntimeSettings.slowQueryThresholdMs,
              });
            } else if (databaseRuntimeSettings.queryLogging) {
              databaseLogger.debug("query.completed", {
                model,
                operation,
                durationMs,
              });
            }

            return result;
          } catch (error) {
            const durationMs = Math.max(
              0,
              Math.round(performance.now() - startedAt),
            );

            databaseLogger.error("query.failed", error, {
              model,
              operation,
              durationMs,
            });

            throw error;
          }
        },
      },
    },
  });

  const prisma = observedClient.$extends({
    name: "slice-resilient-upserts",
    query: {
      $allModels: {
        async upsert({ model, args, query }) {
          for (let attempt = 0; attempt < UPSERT_MAX_ATTEMPTS; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              const finalAttempt = attempt === UPSERT_MAX_ATTEMPTS - 1;

              if (!isPrismaUniqueConstraintError(error) || finalAttempt) {
                throw error;
              }

              databaseLogger.warn("upsert.unique_retry", {
                model,
                attempt: attempt + 1,
                maxAttempts: UPSERT_MAX_ATTEMPTS,
              });

              await retryDelay(attempt);
            }
          }

          throw new Error("Prisma upsert retry loop ended unexpectedly.");
        },
      },
    },
  });

  databaseLogger.info("pool.configured", {
    maximumConnections: databaseRuntimeSettings.poolMaximum,
    connectionTimeoutMs: databaseRuntimeSettings.connectionTimeoutMs,
    idleTimeoutMs: databaseRuntimeSettings.idleTimeoutMs,
    statementTimeoutMs: databaseRuntimeSettings.statementTimeoutMs,
    transactionMaxWaitMs: databaseRuntimeSettings.transactionMaxWaitMs,
    transactionTimeoutMs: databaseRuntimeSettings.transactionTimeoutMs,
    applicationName: databaseRuntimeSettings.applicationName,
    queryLogging: databaseRuntimeSettings.queryLogging,
    slowQueryThresholdMs: databaseRuntimeSettings.slowQueryThresholdMs,
  });

  return prisma;
}

type SlicePrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  slicePrismaClient?: SlicePrismaClient;
};

export const prisma = globalForPrisma.slicePrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.slicePrismaClient = prisma;
}

export function databasePoolSnapshot() {
  return {
    poolManagedBy: "@prisma/adapter-pg",
    liveUtilizationAvailable: false,
    maximumConnections: databaseRuntimeSettings.poolMaximum,
    connectionTimeoutMs: databaseRuntimeSettings.connectionTimeoutMs,
    idleTimeoutMs: databaseRuntimeSettings.idleTimeoutMs,
    statementTimeoutMs: databaseRuntimeSettings.statementTimeoutMs,
    transactionMaxWaitMs: databaseRuntimeSettings.transactionMaxWaitMs,
    transactionTimeoutMs: databaseRuntimeSettings.transactionTimeoutMs,
    slowQueryThresholdMs: databaseRuntimeSettings.slowQueryThresholdMs,
    applicationName: databaseRuntimeSettings.applicationName,
  };
}