import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  getModelGovernanceOverview,
  promoteForecastModel,
} from "@/lib/intelligence-forecast/model-governance";
import { getIntelligenceOperatingMemory } from "@/lib/intelligence-forecast/operating-memory";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 24_000;

type Body = {
  action?: unknown;
  modelId?: unknown;
  reason?: unknown;
};

function cleanString(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function enforceRateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const rate = checkRateLimit({
    key: `forecast-models:${input.write ? "write" : "read"}:${
      input.userId
    }:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 5 : 90,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "FORECAST_MODELS_RATE_LIMITED",
      message: "Too many model-governance requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/models",
    timeoutMs: 35_000,
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

    const [overview, memory] = await Promise.all([
      getModelGovernanceOverview(access.user.id),
      getIntelligenceOperatingMemory({
        userId: access.user.id,
        days: new URL(request.url).searchParams.get("days"),
        limit: 50,
      }),
    ]);

    return apiJson({
      ok: true,
      ...overview,
      memory,
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/models",
    timeoutMs: 35_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_MODEL_GOVERNANCE_BLOCKED",
        message: "Cross-site model-governance actions are not allowed.",
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

    if (
      !(request.headers.get("content-type") ?? "")
        .toLowerCase()
        .includes("application/json")
    ) {
      throw new ApiError({
        status: 415,
        code: "MODEL_GOVERNANCE_JSON_REQUIRED",
        message: "Use application/json for model-governance actions.",
        expose: true,
      });
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new ApiError({
        status: 413,
        code: "MODEL_GOVERNANCE_REQUEST_TOO_LARGE",
        message: `Request body may not exceed ${MAX_BODY_BYTES} bytes.`,
        expose: true,
      });
    }

    let body: Body;

    try {
      body = JSON.parse(raw || "{}") as Body;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_MODEL_GOVERNANCE_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    if (body.action !== "promote") {
      throw new ApiError({
        status: 400,
        code: "UNSUPPORTED_MODEL_GOVERNANCE_ACTION",
        message: "The supported action is promote.",
        expose: true,
      });
    }

    const modelId = cleanString(body.modelId, 120);
    const reason = cleanString(body.reason, 2_000);

    if (!modelId) {
      throw new ApiError({
        status: 400,
        code: "MODEL_ID_REQUIRED",
        message: "modelId is required.",
        expose: true,
      });
    }

    if (reason.length < 10) {
      throw new ApiError({
        status: 400,
        code: "PROMOTION_REASON_REQUIRED",
        message:
          "A documented promotion reason of at least 10 characters is required.",
        expose: true,
      });
    }

    const model = await promoteForecastModel({
      userId: access.user.id,
      modelId,
      reason,
      request,
    });
    const memory = await getIntelligenceOperatingMemory({
      userId: access.user.id,
      days: 30,
      limit: 50,
    });

    return apiJson({
      ok: true,
      model,
      memory,
      autonomousTradingEnabled: false,
      humanApprovalRecorded: true,
    });
  },
);