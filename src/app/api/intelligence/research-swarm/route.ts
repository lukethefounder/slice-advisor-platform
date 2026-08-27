import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import type { BackendContext } from "@/lib/backend/config";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { getIntegrationStatuses } from "@/lib/env";
import { timestampFreshness } from "@/lib/intelligence/freshness";
import {
  buildResearchSwarmForUser,
  loadLatestResearchGraphView,
  type ResearchSwarmDetailMode,
  type ResearchSwarmGraphMode,
} from "@/lib/intelligence/research-swarm-service";
import {
  getResearchGraphPersistenceConfiguration,
} from "@/lib/intelligence/research-graph";
import type { ResearchGraphProjectionMode } from "@/lib/intelligence/research-swarm-types";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_BODY_BYTES = 32_000;
const DEFAULT_INTERACTIVE_AGENTS = 600;
const DEFAULT_SIMULATION_PATHS = 300;

type RequestBody = {
  symbol?: unknown;
  agentCount?: unknown;
  simulationPaths?: unknown;
  graphMode?: unknown;
  detailMode?: unknown;
  projection?: unknown;
  selectedNodeId?: unknown;
  persistGraph?: unknown;
  forceRefresh?: unknown;
  executionMode?: unknown;
};

function cleanString(value: unknown, maximumLength = 100) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function cleanSymbol(value: unknown) {
  return cleanString(value, 24)
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "");
}

function integer(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

function projectionMode(
  value: unknown,
  fallback: ResearchGraphProjectionMode = "overview",
): ResearchGraphProjectionMode {
  const clean = cleanString(value, 20).toLowerCase();

  return clean === "overview" ||
    clean === "balanced" ||
    clean === "full"
    ? clean
    : fallback;
}

function detailMode(value: unknown): ResearchSwarmDetailMode {
  const clean = cleanString(value, 20).toLowerCase();

  return clean === "agents" ||
    clean === "graph" ||
    clean === "full"
    ? clean
    : "summary";
}

function graphMode(
  value: unknown,
  detail: ResearchSwarmDetailMode,
): ResearchSwarmGraphMode {
  return cleanString(value, 20).toLowerCase() === "full" ||
    detail === "graph" ||
    detail === "full"
    ? "full"
    : "summary";
}

function backendContext(
  access: Awaited<ReturnType<typeof requireCurrentAccessContext>>,
): BackendContext {
  return {
    userId: access.user.id,
    firmId: access.firm?.id ?? null,
    actorName: access.user.name,
    actorEmail: access.user.email,
  };
}

function enforceRateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const rate = checkRateLimit({
    key: `research-swarm:${input.write ? "write" : "read"}:${
      input.userId
    }:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 12 : 120,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "RESEARCH_SWARM_RATE_LIMITED",
      message: "Too many intelligence requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    });
  }
}

function safeIntegrationStatuses() {
  return getIntegrationStatuses()
    .filter((integration) =>
      [
        "postgresql",
        "openai",
        "alpha_vantage",
        "neo4j",
      ].includes(integration.key),
    )
    .map((integration) => ({
      key: integration.key,
      label: integration.label,
      category: integration.category,
      configured: integration.configured,
      liveEnabled: integration.liveEnabled,
      safeStatus: integration.safeStatus,
      note: integration.note,
    }));
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/research-swarm",
    timeoutMs: 18_000,
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
    const symbol =
      cleanSymbol(url.searchParams.get("symbol")) || "MSFT";
    const projection = projectionMode(
      url.searchParams.get("projection"),
      "overview",
    );
    const selectedNodeId =
      cleanString(url.searchParams.get("nodeId"), 220) || null;
    const runId =
      cleanString(url.searchParams.get("runId"), 120) || undefined;
    const [latest, persistence] = await Promise.all([
      loadLatestResearchGraphView({
        userId: access.user.id,
        symbol,
        projection,
        selectedNodeId,
        runId,
      }),
      Promise.resolve(
        getResearchGraphPersistenceConfiguration(),
      ),
    ]);

    const latestFreshness = latest
      ? {
          graph: timestampFreshness(latest.generatedAt, {
            currentWithinMs: 15 * 60_000,
            recentWithinMs: 24 * 60 * 60_000,
          }),
          provider: timestampFreshness(latest.metadata.providerAsOf, {
            currentWithinMs: 15 * 60_000,
            recentWithinMs: 24 * 60 * 60_000,
          }),
        }
      : null;

    return apiJson({
      ok: true,
      service: "Slice research swarm",
      maximumAgents: 2_000,
      defaults: {
        interactiveAgents: DEFAULT_INTERACTIVE_AGENTS,
        simulationPaths: DEFAULT_SIMULATION_PATHS,
        projection: "overview" as const,
        automaticRefreshMs: 5 * 60_000,
      },
      allocation:
        "One third media, one third technical, one third economy",
      latest,
      latestFreshness,
      graph: latest?.graph ?? null,
      graphAnalytics: latest?.analytics ?? null,
      integrations: safeIntegrationStatuses(),
      persistence: {
        configured: persistence.configured,
        enabled: persistence.enabled,
        database: persistence.database,
        missing: persistence.missing,
      },
      safeguards: {
        externalCallsPerAgent: false,
        autonomousTradingEnabled: false,
        equalThirdWeighting: true,
        scoreSemanticsPreserved: true,
        automaticResearchOnPageLoad: false,
      },
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/research-swarm",
    timeoutMs: 85_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_RESEARCH_REQUEST_BLOCKED",
        message:
          "Cross-site intelligence requests are not allowed.",
        expose: true,
      });
    }

    const contentType =
      request.headers.get("content-type") ?? "";
    if (
      !contentType.toLowerCase().includes("application/json")
    ) {
      throw new ApiError({
        status: 415,
        code: "RESEARCH_JSON_REQUIRED",
        message: "Use application/json for research requests.",
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

    const rawBody = await request.text();
    if (
      Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES
    ) {
      throw new ApiError({
        status: 413,
        code: "RESEARCH_REQUEST_TOO_LARGE",
        message: `Research requests may not exceed ${MAX_BODY_BYTES} bytes.`,
        expose: true,
      });
    }

    let body: RequestBody;
    try {
      body = JSON.parse(rawBody || "{}") as RequestBody;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_RESEARCH_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const symbol = cleanSymbol(body.symbol) || "MSFT";
    const requestedAgents = integer(
      body.agentCount,
      DEFAULT_INTERACTIVE_AGENTS,
      30,
      2_000,
    );
    const simulationPaths = integer(
      body.simulationPaths,
      DEFAULT_SIMULATION_PATHS,
      100,
      5_000,
    );
    const detail = detailMode(body.detailMode);
    const graph = graphMode(body.graphMode, detail);
    const hasProjection =
      cleanString(body.projection, 20).length > 0;
    const projection = projectionMode(
      body.projection,
      hasProjection
        ? "overview"
        : graph === "full"
          ? "balanced"
          : "overview",
    );
    const selectedNodeId =
      cleanString(body.selectedNodeId, 220) || null;

    /*
     * Persistence is intentionally opt-in. Interactive score refreshes should
     * not write thousands of graph records unless the graph workspace asks
     * for a durable run.
     */
    const persistGraph = body.persistGraph === true;
    const forceRefresh = body.forceRefresh === true;
    const requestedExecution = cleanString(
      body.executionMode,
      20,
    ).toLowerCase();
    const persistence =
      getResearchGraphPersistenceConfiguration();
    const backgroundAvailable = persistence.configured;
    const preferredExecution =
      requestedExecution === "background"
        ? "background"
        : "sync";
    const executionMode =
      preferredExecution === "background" &&
      backgroundAvailable &&
      persistGraph
        ? "background"
        : "sync";

    if (executionMode === "background") {
      const bucket = forceRefresh
        ? Date.now()
        : Math.floor(Date.now() / 120_000);
      const queued = await enqueueBackendJob(
        backendContext(access),
        "intelligence_graph_refresh",
        {
          payload: {
            symbol,
            agentCount: requestedAgents,
            simulationPaths,
          },
          idempotencyKey: `intelligence-graph:${symbol}:${requestedAgents}:${simulationPaths}:${bucket}`,
        },
      );

      return apiJson(
        {
          ok: true,
          executionMode: "background" as const,
          duplicate: queued.duplicate,
          job: queued.job,
          symbol,
          requestedAgents,
          projection,
          message: queued.duplicate
            ? "An equivalent full graph is already queued or running."
            : "Full graph build queued. The page remains interactive while the research pathways complete.",
        },
        { status: 202 },
      );
    }

    const result = await buildResearchSwarmForUser({
      userId: access.user.id,
      symbol,
      requestedAgents,
      simulationPaths,
      graphMode: graph,
      detailMode: detail,
      projection,
      selectedNodeId,
      persistGraph,
      forceRefresh,
    });

    return apiJson({
      ...result,
      executionMode: "sync" as const,
      executionFallback:
        preferredExecution === "background" &&
        (!backgroundAvailable || !persistGraph)
          ? "Durable background graph execution was unavailable, so Slice completed this request synchronously."
          : null,
    });
  },
);