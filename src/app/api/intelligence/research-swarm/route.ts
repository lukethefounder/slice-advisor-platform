import { normalizeResearchSymbol } from "@/lib/intelligence/research-instrument";
import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import type { BackendContext } from "@/lib/backend/config";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { processBackgroundJobIds } from "@/lib/background-jobs/worker";
import { after } from "next/server";
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
import { MAX_RESEARCH_AGENTS, normalizeResearchWeights } from "@/lib/intelligence/research-config";
import { readResearchPreferences, saveResearchPreferences } from "@/lib/intelligence/research-preferences";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


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
  researchWeights?: unknown;
};

function cleanString(value: unknown, maximumLength = 100) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function cleanSymbol(value: unknown) {
  if (!String(value ?? "").trim()) return "";
  try { return normalizeResearchSymbol(String(value)); }
  catch { throw new ApiError({ status: 400, code: "INVALID_RESEARCH_SYMBOL", message: "Use a valid stock symbol or index such as INDEX:SPX.", expose: true }); }
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
    const [latest, persistence, researchPreferences] = await Promise.all([
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
      readResearchPreferences(access.user.id),
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
      maximumAgents: MAX_RESEARCH_AGENTS,
      researchPreferences,
      defaults: {
        interactiveAgents: DEFAULT_INTERACTIVE_AGENTS,
        simulationPaths: DEFAULT_SIMULATION_PATHS,
        projection: "overview" as const,
        automaticRefreshMs: 5 * 60_000,
      },
      allocation: "Personal media, technical, and economy research weights",
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
        equalThirdWeighting: Object.values(researchPreferences.weights).every(weight => Math.abs(weight - 1 / 3) < 0.000001),
        scoreSemanticsPreserved: true,
        automaticResearchOnPageLoad: false,
      },
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/research-swarm",
    timeoutMs: 175_000,
  },
  async ({ request, log }) => {
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
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Object required");
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_RESEARCH_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const preferences = await readResearchPreferences(access.user.id);
    if (body.researchWeights !== undefined) {
      const weights = body.researchWeights;
      const values = weights && typeof weights === "object" && !Array.isArray(weights)
        ? ["media", "technical", "economy"].map(key => (weights as Record<string, unknown>)[key]) : [];
      if (values.length !== 3 || values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) || values.reduce<number>((sum, value) => sum + Number(value), 0) <= 0) {
        throw new ApiError({status:400, code:"INVALID_RESEARCH_WEIGHTS", message:"Provide non-negative media, technical, and economy weights with a positive total.", expose:true});
      }
    }
    const researchWeights = normalizeResearchWeights(body.researchWeights ?? preferences.weights);
    const symbol = cleanSymbol(body.symbol) || "MSFT";
    const requestedAgents = integer(
      body.agentCount,
      preferences.agentCount,
      30,
      MAX_RESEARCH_AGENTS,
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
    const preferredExecution =
      requestedExecution === "background"
        ? "background"
        : "sync";
    // The durable PostgreSQL queue does not require optional Neo4j storage.
    const executionMode = preferredExecution;
    const researchPreferences = await saveResearchPreferences(access.user.id, {weights:researchWeights, agentCount:requestedAgents});

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
            researchWeights,
            persistGraph,
          },
          idempotencyKey: `intelligence-graph:${symbol}:${requestedAgents}:${simulationPaths}:${JSON.stringify(researchWeights)}:${persistGraph}:${bucket}`,
        },
      );

      // Start the exact durable job immediately; the cron/worker path can
      // reclaim its lease if the hosting invocation is interrupted.
      after(async () => {
        try {
          await processBackgroundJobIds({ jobIds: [queued.job.id], concurrency: 1, workerPrefix: "research-interactive" });
        } catch {
          log.warn("research.worker_wake_deferred", { jobId: queued.job.id });
        }
      });

      return apiJson(
        {
          ok: true,
          executionMode: "background" as const,
          duplicate: queued.duplicate,
          job: queued.job,
          symbol,
          requestedAgents,
          researchPreferences,
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
      researchWeights,
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
      researchPreferences,
      executionMode: "sync" as const,
      executionFallback: null,
    });
  },
);
