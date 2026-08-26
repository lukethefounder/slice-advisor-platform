import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  getIntelligenceOperatingMemory,
  intelligenceMemoryWindow,
} from "@/lib/intelligence-forecast/operating-memory";
import {
  getHorizonModelOverview,
  loadHorizonModelSuite,
  persistShadowHorizonPredictions,
  scoreHorizonModelSuite,
  trainHorizonModelSuite,
} from "@/lib/intelligence-forecast/horizon-models";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 24_000;

type HorizonBody = {
  action?: unknown;
  runId?: unknown;
};

function cleanString(value: unknown, maximumLength = 120) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function marketSnapshot(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new ApiError({
      status: 409,
      code: "HORIZON_MODELS_INPUT_INVALID",
      message:
        "The selected forecast run does not contain an object-shaped immutable input snapshot.",
      expose: true,
    });
  }

  const candidate = value as Record<string, unknown>;
  const schemaVersion = cleanString(candidate.schemaVersion, 80);
  const requestId = cleanString(candidate.requestId, 160);
  const symbol = cleanString(candidate.symbol, 24);
  const asOf = cleanString(candidate.asOf, 80);

  if (
    schemaVersion !== "slice-forecast-input-1.0.0" ||
    !requestId ||
    !symbol ||
    !Number.isFinite(Date.parse(asOf))
  ) {
    throw new ApiError({
      status: 409,
      code: "HORIZON_MODELS_INPUT_INVALID",
      message:
        "The selected forecast run does not contain a valid immutable forecast input snapshot.",
      expose: true,
    });
  }

  return candidate;
}

function enforceRateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const rate = checkRateLimit({
    key: `forecast-horizon-models:${
      input.write ? "write" : "read"
    }:${input.userId}:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 8 : 90,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "HORIZON_MODELS_RATE_LIMITED",
      message: "Too many horizon-model requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    });
  }
}

async function readBody(request: Request): Promise<HorizonBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError({
      status: 415,
      code: "HORIZON_MODELS_JSON_REQUIRED",
      message: "Use application/json for horizon-model actions.",
      expose: true,
    });
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError({
      status: 413,
      code: "HORIZON_MODELS_REQUEST_TOO_LARGE",
      message: `Request body may not exceed ${MAX_BODY_BYTES} bytes.`,
      expose: true,
    });
  }

  try {
    return JSON.parse(raw || "{}") as HorizonBody;
  } catch {
    throw new ApiError({
      status: 400,
      code: "INVALID_HORIZON_MODELS_JSON",
      message: "Request body must contain valid JSON.",
      expose: true,
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/horizon-models",
    timeoutMs: 30_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    enforceRateLimit({
      request,
      userId: access.user.id,
      write: false,
    });

    const url = new URL(request.url);
    const days = url.searchParams.get("days");
    const [overview, memory] = await Promise.all([
      getHorizonModelOverview(access.user.id),
      getIntelligenceOperatingMemory({
        userId: access.user.id,
        days,
        limit: 50,
      }),
    ]);

    return apiJson({
      ok: true,
      ...overview,
      memory,
      operatingMode:
        overview.activeSuite.status === "TRAINED"
          ? "Trained evaluation"
          : "Prior-assisted evaluation",
      terminology: {
        shadow:
          "A governed evaluation layer. It is stored, scored against settled outcomes, and does not replace a production model without human promotion.",
        prior:
          "A deterministic starting artifact used until enough settled, non-demo outcomes exist for training.",
      },
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/horizon-models",
    timeoutMs: 118_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_HORIZON_MODELS_BLOCKED",
        message: "Cross-site horizon-model actions are not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    enforceRateLimit({
      request,
      userId: access.user.id,
      write: true,
    });

    const body = await readBody(request);
    const action = cleanString(body.action, 40).toLowerCase();

    if (action === "train") {
      const result = await trainHorizonModelSuite({
        userId: access.user.id,
        request,
      });
      const memory = await getIntelligenceOperatingMemory({
        userId: access.user.id,
        days: 30,
        limit: 50,
      });

      return apiJson({
        ok: true,
        action,
        ...result,
        memory,
        message:
          result.suite.status === "TRAINED"
            ? "Independent horizon models were trained and stored for governed evaluation."
            : "The model artifact was stored with prior coefficients because settled-outcome history is still below the training threshold.",
      });
    }

    if (action === "generate-run") {
      const runId = cleanString(body.runId, 120);

      if (!runId) {
        throw new ApiError({
          status: 400,
          code: "HORIZON_MODELS_RUN_ID_REQUIRED",
          message: "runId is required for generate-run.",
          expose: true,
        });
      }

      const window = intelligenceMemoryWindow({
        days: 30,
      });
      const run = await prisma.intelligenceForecastRun.findFirst({
        where: {
          id: runId,
          userId: access.user.id,
          generatedAt: {
            gte: new Date(window.startAt),
            lte: new Date(window.endAt),
          },
        },
        select: {
          id: true,
          symbol: true,
          inputJson: true,
          generatedAt: true,
          asOfAt: true,
        },
      });

      if (!run) {
        throw new ApiError({
          status: 404,
          code: "HORIZON_MODELS_RUN_NOT_FOUND",
          message:
            "The forecast run was not found inside the retained operating-memory window.",
          expose: true,
        });
      }

      let parsedSnapshot: unknown;

      try {
        parsedSnapshot = JSON.parse(run.inputJson) as unknown;
      } catch {
        throw new ApiError({
          status: 409,
          code: "HORIZON_MODELS_INPUT_INVALID",
          message:
            "The selected forecast run does not contain a readable immutable input snapshot.",
          expose: true,
        });
      }

      const snapshot = marketSnapshot(parsedSnapshot);
      const suite = await loadHorizonModelSuite(access.user.id);
      const result = scoreHorizonModelSuite(snapshot, suite);
      const persistence = await persistShadowHorizonPredictions({
        userId: access.user.id,
        forecastRunId: run.id,
        result,
      });
      const memory = await getIntelligenceOperatingMemory({
        userId: access.user.id,
        days: 30,
        limit: 50,
      });

      return apiJson({
        ok: true,
        action,
        run: {
          id: run.id,
          symbol: run.symbol,
          generatedAt: run.generatedAt.toISOString(),
          asOfAt: run.asOfAt.toISOString(),
        },
        result,
        persistence,
        memory,
        message:
          "Eight independent horizon predictions were generated from the selected immutable forecast snapshot and retained in operating memory.",
      });
    }

    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_HORIZON_MODELS_ACTION",
      message: "Supported actions are train and generate-run.",
      expose: true,
    });
  },
);