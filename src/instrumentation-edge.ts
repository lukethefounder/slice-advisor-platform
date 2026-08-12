import type {
  InstrumentationRequest,
  RequestErrorContext,
} from "./instrumentation";

function safePath(value: string | undefined) {
  return String(value ?? "unknown")
    .split("?")[0]
    .slice(0, 500);
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name.slice(0, 120),
      message: error.message.slice(0, 1_000),

      digest:
        "digest" in error &&
        typeof error.digest === "string"
          ? error.digest.slice(0, 200)
          : null,
    };
  }

  return {
    name: "UnknownError",

    message: String(
      error ?? "Unknown Edge runtime error.",
    ).slice(0, 1_000),

    digest: null,
  };
}

export function registerEdgeInstrumentation() {
  console.info(
    JSON.stringify({
      level: "info",
      scope: "startup",
      event: "environment.ready",
      runtime: "edge",

      deployment:
        process.env.VERCEL_ENV ||
        process.env.NODE_ENV ||
        "unknown",

      timestamp: new Date().toISOString(),
    }),
  );
}

export function onEdgeRequestError(
  error: unknown,
  request: InstrumentationRequest,
  context: RequestErrorContext,
) {
  console.error(
    JSON.stringify({
      level: "error",
      scope: "next-request-error",
      event: "request.unhandled",
      runtime: "edge",
      error: safeError(error),

      context: {
        method: request.method ?? "unknown",
        path: safePath(request.path),
        routerKind: context.routerKind ?? "unknown",
        routePath: safePath(context.routePath),
        routeType: context.routeType ?? "unknown",
        renderSource: context.renderSource ?? "unknown",
        revalidateReason: context.revalidateReason ?? null,
        renderType: context.renderType ?? null,
      },

      timestamp: new Date().toISOString(),
    }),
  );
}