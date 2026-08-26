import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  generateEnsembleForRun,
  getEnsembleOverview,
  trainEnsembleSuite,
} from "@/lib/intelligence-forecast/ensemble-optimization";
import {
  getIntelligenceOperatingMemory,
  intelligenceMemoryWindow,
} from "@/lib/intelligence-forecast/operating-memory";
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

type EnsembleBody = {
  action?: unknown;
  runId?: unknown;
};

function cleanString(value: unknown, maximumLength = 120) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function rateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const result = checkRateLimit({
    key: `forecast-ensemble:${input.write ? "write" : "read"}:${
      input.userId
    }:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 8 : 90,
    windowMs: 60_000,
  });

  if (!result.allowed) {
    throw new ApiError({
      status: 429,
      code: "ENSEMBLE_RATE_LIMITED",
      message: "Too many ensemble requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: result.retryAfterSeconds,
      },
    });
  }
}

async function body(request: Request): Promise<EnsembleBody> {
  if (
    !(request.headers.get("content-type") ?? "")
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new ApiError({
      status: 415,
      code: "ENSEMBLE_JSON_REQUIRED",
      message: "Use application/json for ensemble actions.",
      expose: true,
    });
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError({
      status: 413,
      code: "ENSEMBLE_REQUEST_TOO_LARGE",
      message: `Request body may not exceed ${MAX_BODY_BYTES} bytes.`,
      expose: true,
    });
  }

  try {
    return JSON.parse(raw || "{}") as EnsembleBody;
  } catch {
    throw new ApiError({
      status: 400,
      code: "INVALID_ENSEMBLE_JSON",
      message: "Request body must contain valid JSON.",
      expose: true,
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/ensemble",
    timeoutMs: 30_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    rateLimit({
      request,
      userId: access.user.id,
      write: false,
    });

    const days = new URL(request.url).searchParams.get("days");
    const [overview, memory] = await Promise.all([
      getEnsembleOverview(access.user.id),
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
          ? "Calibrated evaluation"
          : "Prior-assisted evaluation",
      terminology: {
        evaluation:
          "The ensemble combines the production forecast, independent horizon model, and agent simulation when those components exist.",
        promotion:
          "Stored ensemble artifacts remain governed until chronological validation and human promotion are complete.",
      },
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/ensemble",
    timeoutMs: 118_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_ENSEMBLE_BLOCKED",
        message: "Cross-site ensemble actions are not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    rateLimit({
      request,
      userId: access.user.id,
      write: true,
    });

    const payload = await body(request);
    const action = cleanString(payload.action, 40).toLowerCase();

    if (action === "train") {
      const result = await trainEnsembleSuite({
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
            ? "Calibrated ensemble artifacts were trained and stored for governed evaluation."
            : "The ensemble suite was stored with prior weights because eligible settled history is below its training threshold.",
      });
    }

    if (action === "generate-run") {
      const runId = cleanString(payload.runId, 120);

      if (!runId) {
        throw new ApiError({
          status: 400,
          code: "ENSEMBLE_RUN_ID_REQUIRED",
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
          generatedAt: true,
          asOfAt: true,
        },
      });

      if (!run) {
        throw new ApiError({
          status: 404,
          code: "ENSEMBLE_RUN_NOT_FOUND",
          message:
            "The forecast run was not found inside the retained operating-memory window.",
          expose: true,
        });
      }

      const result = await generateEnsembleForRun({
        userId: access.user.id,
        runId: run.id,
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
        run: {
          id: run.id,
          symbol: run.symbol,
          generatedAt: run.generatedAt.toISOString(),
          asOfAt: run.asOfAt.toISOString(),
        },
        result,
        memory,
        message:
          "The calibrated ensemble was generated from the selected stored forecast and retained in operating memory.",
      });
    }

    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_ENSEMBLE_ACTION",
      message: "Supported actions are train and generate-run.",
      expose: true,
    });
  },
);