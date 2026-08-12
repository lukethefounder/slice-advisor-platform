import "server-only";

import { boolEnv, validateRuntimeEnvironment } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { validateProductionConfiguration } from "@/lib/production/config";
import type {
  InstrumentationRequest,
  RequestErrorContext,
} from "./instrumentation";

declare global {
  // eslint-disable-next-line no-var
  var __sliceProcessInstrumentationInstalled: boolean | undefined;

  // eslint-disable-next-line no-var
  var __sliceShutdownStarted: boolean | undefined;
}

const startupLog = createLogger("startup");

async function closeRuntimeResources() {
  const tasks = [
    import("@/lib/prisma")
      .then(({ prisma }) => prisma.$disconnect())
      .catch(() => undefined),

    import("@/lib/neo4j")
      .then(({ closeNeo4jDriver }) => closeNeo4jDriver())
      .catch(() => undefined),
  ];

  await Promise.allSettled(tasks);
}

function installProcessInstrumentation() {
  if (globalThis.__sliceProcessInstrumentationInstalled) {
    return;
  }

  globalThis.__sliceProcessInstrumentationInstalled = true;

  process.on("unhandledRejection", (reason) => {
    startupLog.error("process.unhandled_rejection", reason);
  });

  /*
   * uncaughtExceptionMonitor records the fatal exception without replacing
   * Node's normal fatal-exception behavior.
   */
  process.on("uncaughtExceptionMonitor", (error, origin) => {
    startupLog.error("process.uncaught_exception", error, {
      origin,
    });
  });

  /*
   * Vercel functions do not use the lifecycle of a conventional,
   * continuously running Node server. Local and self-hosted Node processes
   * retain graceful SIGTERM and SIGINT resource cleanup.
   */
  if (process.env.VERCEL) {
    return;
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      if (globalThis.__sliceShutdownStarted) {
        return;
      }

      globalThis.__sliceShutdownStarted = true;

      startupLog.info("process.shutdown_started", {
        signal,
      });

      const forceTimer = setTimeout(() => {
        startupLog.error(
          "process.shutdown_timeout",
          new Error(
            "Runtime resources did not close before the shutdown limit.",
          ),
          {
            signal,
          },
        );

        process.exit(1);
      }, 8_000);

      forceTimer.unref();

      void closeRuntimeResources().finally(() => {
        clearTimeout(forceTimer);

        startupLog.info("process.shutdown_complete", {
          signal,
        });

        process.exit(0);
      });
    });
  }
}

function safePath(value: string | undefined) {
  return String(value ?? "unknown")
    .split("?")[0]
    .slice(0, 500);
}

export async function registerNodeInstrumentation() {
  const environment = validateRuntimeEnvironment();
  const production = validateProductionConfiguration();

  installProcessInstrumentation();

  if (environment.warnings.length || production.warnings.length) {
    startupLog.warn("environment.warnings", {
      mode: environment.mode,

      warningKeys: [
        ...environment.warnings.map((issue) => issue.key),
        ...production.warnings.map((issue) => issue.key),
      ],
    });
  }

  const errorKeys = [
    ...environment.errors.map((issue) => issue.key),
    ...production.errors.map((issue) => issue.key),
  ];

  if (errorKeys.length) {
    const startupError = new Error(
      `Slice runtime configuration is invalid: ${errorKeys.join(", ")}`,
    );

    startupLog.error("environment.invalid", startupError, {
      mode: environment.mode,
      errorKeys,
    });

    if (boolEnv("SLICE_STRICT_ENV", false)) {
      throw startupError;
    }
  }

  startupLog.info("environment.ready", {
    mode: environment.mode,
    runtime: "nodejs",

    deployment:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "unknown",

    commitSha:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
      null,
  });
}

export async function onNodeRequestError(
  error: unknown,
  request: InstrumentationRequest,
  context: RequestErrorContext,
) {
  const log = createLogger("next-request-error");

  log.error("request.unhandled", error, {
    method: request.method ?? "unknown",
    path: safePath(request.path),
    routerKind: context.routerKind ?? "unknown",
    routePath: safePath(context.routePath),
    routeType: context.routeType ?? "unknown",
    renderSource: context.renderSource ?? "unknown",
    revalidateReason: context.revalidateReason ?? null,
    renderType: context.renderType ?? null,
  });
}