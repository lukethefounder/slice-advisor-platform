import "server-only";

import { randomUUID } from "node:crypto";

import { createLogger } from "@/lib/logger";
import { researchBetaEnabled } from "@/lib/research/beta-policy";

export type ApiRouteContext = {
  request: Request;
  requestId: string;
  startedAt: number;
  signal: AbortSignal;
  log: ReturnType<typeof createLogger>;
};

export type ApiRouteOptions = {
  route: string;
  timeoutMs?: number;
  cacheControl?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    expose?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(
      input.message,
      input.cause === undefined ? undefined : { cause: input.cause },
    );
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.expose = input.expose ?? input.status < 500;
    this.details = input.details;
  }
}

function requestIdFrom(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();

  if (incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming)) {
    return incoming;
  }

  return randomUUID();
}

function responseWithOperationalHeaders(
  response: Response,
  input: {
    requestId: string;
    durationMs: number;
    cacheControl: string;
  },
) {
  const headers = new Headers(response.headers);

  headers.set("x-request-id", input.requestId);
  headers.set("x-response-time-ms", String(input.durationMs));
  headers.append("server-timing", `slice;dur=${input.durationMs}`);

  if (!headers.has("cache-control")) {
    headers.set("cache-control", input.cacheControl);
  }

  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function timeoutError(timeoutMs: number) {
  return new ApiError({
    status: 504,
    code: "ROUTE_TIMEOUT",
    message: `The operation exceeded its ${timeoutMs}ms time limit.`,
    expose: true,
  });
}

async function runWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number | undefined,
  controller: AbortController,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(controller.signal.reason instanceof ApiError
          ? controller.signal.reason
          : new ApiError({ status: 499, code: "REQUEST_CANCELLED", message: "The request was cancelled.", expose: true }));
        if (controller.signal.aborted) onAbort();
        else controller.signal.addEventListener("abort", onAbort, { once: true });
        if (timeoutMs && !controller.signal.aborted) {
          timer = setTimeout(() => controller.abort(timeoutError(timeoutMs)), timeoutMs);
        }
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
  }
}

export function apiJson<T>(
  body: T,
  init: {
    status?: number;
    headers?: HeadersInit;
  } = {},
) {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

export function withApiRoute(
  options: ApiRouteOptions,
  handler: (context: ApiRouteContext) => Promise<Response> | Response,
) {
  const routeLogger = createLogger("api-route", {
    route: options.route,
  });

  return async function handleApiRoute(request: Request) {
    const requestId = requestIdFrom(request);
    const startedAt = performance.now();
    const controller = new AbortController();
    const onRequestAbort = () => controller.abort(new ApiError({
      status: 499, code: "REQUEST_CANCELLED", message: "The request was cancelled.", expose: true,
    }));
    if (request.signal.aborted) onRequestAbort();
    else request.signal.addEventListener("abort", onRequestAbort, { once: true });
    const log = routeLogger.child("request", {
      requestId,
      method: request.method,
    });

    log.info("request.started");

    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const timeoutMs = researchBetaEnabled(process.env) ? undefined : options.timeoutMs;
      const response = await runWithTimeout(
        Promise.resolve(
          handler({
            request,
            requestId,
            startedAt,
            signal: controller.signal,
            log,
          }),
        ),
        timeoutMs,
        controller,
      );
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

      log.info("request.completed", {
        status: response.status,
        durationMs,
      });

      return responseWithOperationalHeaders(response, {
        requestId,
        durationMs,
        cacheControl: options.cacheControl ?? "private, no-store, max-age=0",
      });
    } catch (error) {
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
      const apiError =
        error instanceof ApiError
          ? error
          : controller.signal.aborted && controller.signal.reason instanceof ApiError
            ? controller.signal.reason
            : new ApiError({
                status: 500,
                code: "INTERNAL_SERVER_ERROR",
                message: "An unexpected server error occurred.",
                expose: false,
                cause: error,
              });

      log.error("request.failed", error, {
        status: apiError.status,
        code: apiError.code,
        durationMs,
      });

      const response = apiJson(
        {
          ok: false,
          error: {
            code: apiError.code,
            message: apiError.expose
              ? apiError.message
              : "The request could not be completed.",
            requestId,
            ...(apiError.expose && apiError.details
              ? { details: apiError.details }
              : {}),
          },
        },
        { status: apiError.status },
      );

      return responseWithOperationalHeaders(response, {
        requestId,
        durationMs,
        cacheControl: "private, no-store, max-age=0",
      });
    } finally {
      request.signal.removeEventListener("abort", onRequestAbort);
    }
  };
}
