import { requireResearchStorage } from "@/lib/data-readiness/server";
import "server-only";

import { createHash } from "node:crypto";

import { guardIntelligenceOperation, completeIntelligenceOperation, IntelligenceGuardError, guardErrorResponse, type OperationGuardTicket } from "@/lib/intelligence-forecast/production-controls";
import { ApiError } from "@/lib/api-route";
import { StrategyError } from "@/lib/strategy-lab/contracts";
import type { BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import type { BackendContext } from "@/lib/backend/config";
import { getAlphaVantageIntelligence } from "@/lib/intelligence/alpha-vantage-live";
import { getEconomicResearch } from "@/lib/intelligence/economic-live";
import {
  timestampFreshness,
} from "@/lib/intelligence/freshness";
import {
  analyzeResearchGraph,
  getResearchGraphNodeDetail,
  projectResearchGraph,
} from "@/lib/intelligence/graph-engine";
import {
  getResearchGraphPersistenceConfiguration,
  loadResearchKnowledgeGraphRecord,
  persistResearchKnowledgeGraph,
} from "@/lib/intelligence/research-graph";
import { runResearchSwarm } from "@/lib/intelligence/research-swarm";
import type {
  ResearchGraphProjectionMode,
  ResearchGraphViewResponse,
  ResearchSwarmAlgorithmDiagnostics,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";
import { publishAlphaResearch, attachForecastNodes, readCanonicalGraph, retainCanonicalNodes } from "@/lib/intelligence-unified/service";

export type ResearchSwarmDetailMode =
  | "summary"
  | "agents"
  | "graph"
  | "full";

export type ResearchSwarmGraphMode =
  | "summary"
  | "full";

export type BuildResearchSwarmInput = {
  userId: string;
  symbol: string;
  requestedAgents?: number;
  simulationPaths?: number;
  graphMode?: ResearchSwarmGraphMode;
  detailMode?: ResearchSwarmDetailMode;
  projection?: ResearchGraphProjectionMode;
  selectedNodeId?: string | null;
  persistGraph?: boolean;
  forceRefresh?: boolean;
  progress?: (
    value: number,
    message: string,
  ) => Promise<void> | void;
};

type CacheRecord = {
  value: ResearchSwarmResponse;
  expiresAt: number;
};

type GlobalResearchState = typeof globalThis & {
  __sliceResearchSwarmCache?: Map<
    string,
    CacheRecord
  >;
  __sliceResearchSwarmInflight?: Map<
    string,
    Promise<ResearchSwarmResponse>
  >;
  __sliceResearchSwarmLatest?: Map<
    string,
    ResearchSwarmResponse
  >;
};

const globalResearch =
  globalThis as GlobalResearchState;
const cache =
  globalResearch.__sliceResearchSwarmCache ??
  new Map<string, CacheRecord>();
const inflight =
  globalResearch.__sliceResearchSwarmInflight ??
  new Map<
    string,
    Promise<ResearchSwarmResponse>
  >();
const latestByUserSymbol =
  globalResearch.__sliceResearchSwarmLatest ??
  new Map<string, ResearchSwarmResponse>();

globalResearch.__sliceResearchSwarmCache =
  cache;
globalResearch.__sliceResearchSwarmInflight =
  inflight;
globalResearch.__sliceResearchSwarmLatest =
  latestByUserSymbol;



function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(
        minimum,
        Math.min(maximum, Math.round(parsed)),
      )
    : fallback;
}

function cleanSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

function hash(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function configuredNewsAgeMs() {
  const hours = Number(
    process.env.INTELLIGENCE_NEWS_MAX_AGE_HOURS,
  );

  return Number.isFinite(hours)
    ? Math.max(
        1,
        Math.min(168, hours),
      ) *
        60 *
        60_000
    : 7 * 24 * 60 * 60_000;
}

function cacheIdentity(input: {
  userId: string;
  symbol: string;
  requestedAgents: number;
  simulationPaths: number;
  graphMode: ResearchSwarmGraphMode;
  persistGraph: boolean;
}) {
  const digest = hash(
    [
      input.userId,
      input.symbol,
      input.requestedAgents,
      input.simulationPaths,
      input.graphMode,
      input.persistGraph ? "persist" : "ephemeral",
    ].join(":"),
  );

  return {
    internal: digest,
    public: digest.slice(0, 18),
  };
}

function cleanupCache() {
  const now = Date.now();

  for (const [key, record] of cache) {
    if (record.expiresAt <= now) {
      cache.delete(key);
    }
  }

  if (cache.size > 20) {
    const ordered = [...cache.entries()].sort(
      (left, right) =>
        left[1].expiresAt -
        right[1].expiresAt,
    );

    for (const [key] of ordered.slice(
      0,
      cache.size - 16,
    )) {
      cache.delete(key);
    }
  }
}

function storeLatest(
  userId: string,
  symbol: string,
  response: ResearchSwarmResponse,
) {
  const key = `${userId}:${symbol}`;
  latestByUserSymbol.delete(key);
  latestByUserSymbol.set(key, response);

  while (latestByUserSymbol.size > 24) {
    const oldestKey =
      latestByUserSymbol.keys().next()
        .value as string | undefined;

    if (!oldestKey) break;
    latestByUserSymbol.delete(oldestKey);
  }
}

function cacheTtlMs(
  response: ResearchSwarmResponse,
) {
  const configured = Number(
    process.env.INTELLIGENCE_SWARM_CACHE_MS,
  );

  if (Number.isInteger(configured)) {
    return Math.max(
      30_000,
      Math.min(10 * 60_000, configured),
    );
  }

  const provider = timestampFreshness(
    response.providerAsOf,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 24 * 60 * 60_000,
    },
  );

  if (
    response.market.realTimeConfirmed &&
    provider.state === "current"
  ) {
    return 60_000;
  }

  if (
    provider.state === "future" ||
    provider.state === "invalid" ||
    provider.state === "missing"
  ) {
    return 30_000;
  }

  return 5 * 60_000;
}

function percentile(
  sorted: number[],
  value: number,
) {
  if (!sorted.length) return 50;

  const index =
    (sorted.length - 1) * value;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower] ?? 50;
  }

  const ratio = index - lower;

  return (
    (sorted[lower] ?? 50) *
      (1 - ratio) +
    (sorted[upper] ?? 50) * ratio
  );
}

function cohortRobustness(
  response: ResearchSwarmResponse,
) {
  return (
    [
      "media",
      "technical",
      "economy",
    ] as const
  ).reduce(
    (output, cohort) => {
      const agents = response.agents.filter(
        (agent) => agent.cohort === cohort,
      );
      const sorted = agents
        .map((agent) => agent.score)
        .sort((left, right) => left - right);
      const trim = Math.floor(
        sorted.length * 0.1,
      );
      const trimmed = sorted.slice(
        trim,
        Math.max(
          trim + 1,
          sorted.length - trim,
        ),
      );
      const evidenceIds = new Set(
        agents.flatMap(
          (agent) => agent.evidenceIds,
        ),
      );

      output[cohort] = {
        median:
          Math.round(
            percentile(sorted, 0.5) * 100,
          ) / 100,
        trimmedMean:
          Math.round(
            (trimmed.length
              ? trimmed.reduce(
                  (sum, score) =>
                    sum + score,
                  0,
                ) / trimmed.length
              : 50) * 100,
          ) / 100,
        interquartileRange:
          Math.round(
            (percentile(sorted, 0.75) -
              percentile(sorted, 0.25)) *
              100,
          ) / 100,
        effectiveEvidence:
          evidenceIds.size,
      };

      return output;
    },
    {} as ResearchSwarmAlgorithmDiagnostics["cohortRobustness"],
  );
}

function diagnostics(input: {
  response: ResearchSwarmResponse;
  cacheStatus: ResearchSwarmAlgorithmDiagnostics["cache"]["status"];
  cacheKey: string;
  expiresAt: string | null;
}): ResearchSwarmAlgorithmDiagnostics {
  const robustness = cohortRobustness(
    input.response,
  );
  const analytics =
    input.response.graphAnalytics;
  const averageAgreement =
    (
      [
        "media",
        "technical",
        "economy",
      ] as const
    ).reduce(
      (sum, cohort) =>
        sum +
        input.response.cohorts[cohort]
          .agreement,
      0,
    ) / 3;
  const resilience =
    analytics.networkResilience ??
    analytics.connectednessScore;
  const contradictionRatio =
    analytics.contradictionRatio ?? 0;
  const sourceConcentration =
    analytics.sourceConcentration ?? 0;
  const stabilityScore = Math.max(
    0,
    Math.min(
      100,
      averageAgreement * 0.35 +
        input.response.score.confidence *
          0.3 +
        resilience * 0.2 +
        (100 - contradictionRatio) *
          0.1 +
        (100 - sourceConcentration) *
          0.05,
    ),
  );
  const uncertaintyWidth = Math.max(
    2,
    Math.min(
      18,
      (100 - stabilityScore) * 0.1 +
        input.response.score.quality
          .contradictionPenalty *
          0.16 +
        input.response.score.quality
          .freshnessPenalty *
          0.22,
    ),
  );

  return {
    version:
      "slice-swarm-diagnostics-3.0.0",
    scoreSemanticsPreserved: true,
    equalThirdWeightingPreserved: true,
    stabilityScore:
      Math.round(stabilityScore * 100) /
      100,
    sourceConcentration:
      Math.round(
        sourceConcentration * 100,
      ) / 100,
    uncertaintyBand: {
      low:
        Math.round(
          Math.max(
            0,
            input.response.score.overall -
              uncertaintyWidth,
          ) * 100,
        ) / 100,
      high:
        Math.round(
          Math.min(
            100,
            input.response.score.overall +
              uncertaintyWidth,
          ) * 100,
        ) / 100,
    },
    cohortRobustness: robustness,
    cache: {
      status: input.cacheStatus,
      key: input.cacheKey,
      expiresAt: input.expiresAt,
    },
  };
}

function responseForView(
  full: ResearchSwarmResponse,
  input: BuildResearchSwarmInput,
  cacheState: {
    status: ResearchSwarmAlgorithmDiagnostics["cache"]["status"];
    key: string;
    expiresAt: string | null;
  },
) {
  const detailMode =
    input.detailMode ?? "graph";
  const projection =
    input.projection ?? "overview";
  const agents =
    detailMode === "agents" ||
    detailMode === "full"
      ? full.agents
      : (
          [
            "media",
            "technical",
            "economy",
          ] as const
        ).flatMap((cohort) =>
          full.agents
            .filter(
              (agent) =>
                agent.cohort === cohort,
            )
            .slice(0, 36),
        );
  const graph = projectResearchGraph(
    full.graph,
    {
      mode: projection,
      selectedNodeId:
        input.selectedNodeId,
      analytics: full.graphAnalytics,
    },
  );
  const algorithm = diagnostics({
    response: full,
    cacheStatus: cacheState.status,
    cacheKey: cacheState.key,
    expiresAt: cacheState.expiresAt,
  });

  return {
    ...full,
    agents,
    graph: retainCanonicalNodes(full.graph, graph),
    algorithm,
    score: {
      ...full.score,
      quality: {
        ...full.score.quality,
        stabilityScore:
          algorithm.stabilityScore,
        sourceConcentration:
          algorithm.sourceConcentration,
        uncertaintyLow:
          algorithm.uncertaintyBand.low,
        uncertaintyHigh:
          algorithm.uncertaintyBand.high,
      },
    },
  } satisfies ResearchSwarmResponse;
}

function validateMarketFreshness(
  alpha: Awaited<
    ReturnType<
      typeof getAlphaVantageIntelligence
    >
  >,
) {
  if (!alpha.ok) {
    throw new ApiError({
      status: 409,
      code:
        "INTELLIGENCE_MARKET_DATA_UNAVAILABLE",
      message:
        alpha.error ||
        "Alpha Vantage evidence is unavailable.",
      expose: true,
    });
  }

  const marketOpen =
    alpha.market?.isOpen === true;
  const unacceptableDuringOpen =
    marketOpen &&
    (alpha.freshness.mode === "stale" ||
      alpha.freshness.mode ===
        "unavailable" || alpha.freshness.mode === "end_of_day");

  if (unacceptableDuringOpen) {
    throw new ApiError({
      status: 409,
      code:
        "INTELLIGENCE_MARKET_DATA_STALE",
      message:
        "The market is open, but the provider did not return a sufficiently current quote. Slice did not generate a new current-state score.",
      expose: true,
      details: {
        providerAsOf:
          alpha.providerAsOf,
        freshnessMode:
          alpha.freshness.mode,
      },
    });
  }
}

async function performBuild(
  input: Required<Pick<BuildResearchSwarmInput, "userId" | "symbol" | "requestedAgents" | "simulationPaths" | "graphMode" | "persistGraph">> & Pick<BuildResearchSwarmInput, "progress">,
): Promise<ResearchSwarmResponse> {
  // Fail before spending provider capacity when publication storage is absent.
  await requireResearchStorage(["SliceForecastBundle", "BackendPlatformEvent"]);
  const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!key || /^(demo|your[_ -]|changeme|replace)/i.test(key)) throw new ApiError({status:503, code:"ALPHA_KEY_REQUIRED", message:"Configure a private Alpha Vantage key. No demo data will be used.", expose:true});
  let ticket: OperationGuardTicket;
  try { ticket = await guardIntelligenceOperation({ userId: input.userId, operation: "forecast.generate" }); }
  catch (error) {
    if (error instanceof IntelligenceGuardError) { const guarded = guardErrorResponse(error); throw new ApiError({ status: guarded.status, code: "INTELLIGENCE_OPERATION_BLOCKED", message: error.message, expose: true }); }
    throw error;
  }
  try {
  await input.progress?.(5, "Collecting Alpha Vantage observations");
  const alpha = await getAlphaVantageIntelligence({symbol:input.symbol, interval:"5min"});
  validateMarketFreshness(alpha);
  if (!alpha.providerAsOf || !Number.isFinite(Date.parse(alpha.providerAsOf)) || Date.parse(alpha.providerAsOf) > Date.now() + 300000) {
    throw new ApiError({status:409, code:"INVALID_PROVIDER_TIME", message:"A valid non-future provider timestamp is required.", expose:true});
  }
  if (Date.now() - Date.parse(alpha.providerAsOf) > 120 * 3600000) {
    throw new ApiError({status:409, code:"STALE_PROVIDER_TIME", message:"The latest observed market data is too old to create a current forecast.", expose:true});
  }
  // A media item must have a valid publication time. Never replace it with retrieval time.
  if (alpha.news) {
    alpha.news = {...alpha.news, items: alpha.news.items.filter(item => {
      if (!item.publishedAt) return false;
      const age = Date.now() - Date.parse(item.publishedAt);
      return Number.isFinite(age) && age >= -300000 && age <= configuredNewsAgeMs();
    })};
  }
  await input.progress?.(25, "Collecting Alpha Vantage economic releases");
  const economy = await getEconomicResearch({sector:alpha.overview?.sector || "Unknown", industry:alpha.overview?.industry || "Unknown"});
  await input.progress?.(48, "Computing equal-third research over verified provider evidence");
  const base = runResearchSwarm({symbol:input.symbol, requestedAgents:input.requestedAgents, alpha, scan:null, economy,
    simulationPaths:input.simulationPaths, graphMode:input.graphMode});
  const enhanced: ResearchSwarmResponse = {...base, graphAnalytics:analyzeResearchGraph(base.graph, base.score),
    graphPersistence:{status:"skipped", detail:"Neo4j persistence not requested; canonical forecast remains stored in PostgreSQL."},
    warnings:[...base.warnings, "External RSS and advisor-source scans were excluded from this Alpha Vantage-only run."]};
  await input.progress?.(70, "Publishing one immutable forecast for all linked views");
  const canonical = await publishAlphaResearch(input.userId, enhanced);
  enhanced.graph = attachForecastNodes(base.graph, canonical.forecast, canonical.id, canonical.forecastRunId, canonical.targets);
  enhanced.graphAnalytics = canonical.graphAnalytics;
  if (input.persistGraph) {
    enhanced.graphPersistence = await persistResearchKnowledgeGraph({userId:input.userId, graph:enhanced.graph,
      metadata:{symbol:enhanced.symbol, companyName:enhanced.companyName, sector:enhanced.sector, industry:enhanced.industry,
        requestedAgents:enhanced.requestedAgents, activeAgents:enhanced.activeAgents, score:enhanced.score.overall,
        confidence:enhanced.score.confidence, providerAsOf:enhanced.providerAsOf, durationMs:enhanced.durationMs}});
  }
  await input.progress?.(95, "Canonical forecast and research graph ready");
  await completeIntelligenceOperation({ userId: input.userId, ticket, success: true, detail: `Canonical forecast published for ${enhanced.runId}` }).catch(() => { enhanced.warnings.push("Forecast stored, but production-control completion logging needs review."); });
  return enhanced;
  } catch (error) {
    await completeIntelligenceOperation({ userId: input.userId, ticket, success: false, error }).catch(() => undefined);
    if (error instanceof StrategyError) throw new ApiError({ status: error.status, code: error.code, message: error.message, expose: true });
    throw error;
  }
}

export async function buildResearchSwarmForUser(
  input: BuildResearchSwarmInput,
): Promise<ResearchSwarmResponse> {
  cleanupCache();

  const symbol =
    cleanSymbol(input.symbol) || "MSFT";
  const requestedAgents = clampInteger(
    input.requestedAgents,
    600,
    30,
    2_000,
  );
  const simulationPaths = clampInteger(
    input.simulationPaths,
    300,
    100,
    5_000,
  );
  const graphMode =
    input.graphMode ?? "summary";
  const persistGraph =
    input.persistGraph === true;
  const identity = cacheIdentity({
    userId: input.userId,
    symbol,
    requestedAgents,
    simulationPaths,
    graphMode,
    persistGraph,
  });
  const current = cache.get(
    identity.internal,
  );

  if (
    !input.forceRefresh &&
    current &&
    current.expiresAt > Date.now()
  ) {
    return responseForView(
      current.value,
      input,
      {
        status: "hit",
        key: identity.public,
        expiresAt: new Date(
          current.expiresAt,
        ).toISOString(),
      },
    );
  }

  const active = inflight.get(
    identity.internal,
  );

  if (!input.forceRefresh && active) {
    const value = await active;
    const record = cache.get(
      identity.internal,
    );

    return responseForView(value, input, {
      status: "coalesced",
      key: identity.public,
      expiresAt: record
        ? new Date(
            record.expiresAt,
          ).toISOString()
        : null,
    });
  }

  const operation = performBuild({
    userId: input.userId,
    symbol,
    requestedAgents,
    simulationPaths,
    graphMode,
    persistGraph,
    progress: input.progress,
  });

  inflight.set(
    identity.internal,
    operation,
  );

  try {
    const full = await operation;
    const expiresAt =
      Date.now() + cacheTtlMs(full);

    cache.set(identity.internal, {
      value: full,
      expiresAt,
    });
    storeLatest(
      input.userId,
      symbol,
      full,
    );

    return responseForView(full, input, {
      status: "miss",
      key: identity.public,
      expiresAt: new Date(
        expiresAt,
      ).toISOString(),
    });
  } finally {
    inflight.delete(identity.internal);
  }
}

export async function loadLatestResearchGraphView(
  input: {
    userId: string;
    symbol: string;
    projection?: ResearchGraphProjectionMode;
    selectedNodeId?: string | null;
    runId?: string;
  },
): Promise<ResearchGraphViewResponse | null> {
  const canonical = await readCanonicalGraph(input);
  if (canonical) return canonical;
  const symbol = cleanSymbol(input.symbol);
  const memory = latestByUserSymbol.get(
    `${input.userId}:${symbol}`,
  );
  const persistence =
    getResearchGraphPersistenceConfiguration();

  if (
    memory &&
    (!input.runId ||
      memory.runId === input.runId)
  ) {
    const graph = projectResearchGraph(
      memory.graph,
      {
        mode:
          input.projection ??
          "overview",
        selectedNodeId:
          input.selectedNodeId,
        analytics:
          memory.graphAnalytics,
      },
    );

    return {
      ok: true,
      source: "memory",
      symbol: memory.symbol,
      runId: memory.runId,
      generatedAt:
        memory.graph.generatedAt,
      graph,
      analytics:
        memory.graphAnalytics,
      selectedNode:
        getResearchGraphNodeDetail(
          memory.graph,
          input.selectedNodeId,
        ),
      metadata: {
        companyName:
          memory.companyName,
        sector: memory.sector,
        industry: memory.industry,
        requestedAgents:
          memory.requestedAgents,
        activeAgents:
          memory.activeAgents,
        score:
          memory.score.overall,
        confidence:
          memory.score.confidence,
        providerAsOf:
          memory.providerAsOf,
        durationMs:
          memory.durationMs,
      },
      persistence: {
        configured:
          persistence.configured,
        status:
          persistence.configured
            ? "available"
            : "unavailable",
      },
    };
  }

  const record =
    await loadResearchKnowledgeGraphRecord({
      userId: input.userId,
      symbol,
      runId: input.runId,
    });

  if (!record) return null;

  const analytics = analyzeResearchGraph(
    record.graph,
  );

  return {
    ok: true,
    source: "neo4j",
    symbol: cleanSymbol(
      record.metadata.symbol || symbol,
    ),
    runId: record.graph.runId,
    generatedAt:
      record.graph.generatedAt,
    graph: projectResearchGraph(
      record.graph,
      {
        mode:
          input.projection ??
          "overview",
        selectedNodeId:
          input.selectedNodeId,
        analytics,
      },
    ),
    analytics,
    selectedNode:
      getResearchGraphNodeDetail(
        record.graph,
        input.selectedNodeId,
      ),
    metadata: {
      companyName:
        record.metadata.companyName,
      sector: record.metadata.sector,
      industry:
        record.metadata.industry,
      requestedAgents:
        record.metadata.requestedAgents,
      activeAgents:
        record.metadata.activeAgents,
      score: record.metadata.score,
      confidence:
        record.metadata.confidence,
      providerAsOf:
        record.metadata.providerAsOf,
      durationMs:
        record.metadata.durationMs,
    },
    persistence: {
      configured:
        persistence.configured,
      status:
        persistence.configured
          ? "available"
          : "unavailable",
    },
  };
}

export async function executeIntelligenceGraphRefreshJob(
  context: BackendContext,
  runtime: BackgroundJobRuntime,
): Promise<Record<string, unknown>> {
  const symbol =
    cleanSymbol(runtime.payload.symbol) ||
    "MSFT";
  const requestedAgents = clampInteger(
    runtime.payload.agentCount,
    2_000,
    30,
    2_000,
  );
  const simulationPaths = clampInteger(
    runtime.payload.simulationPaths,
    750,
    100,
    5_000,
  );

  const result =
    await buildResearchSwarmForUser({
      userId: context.userId,
      symbol,
      requestedAgents,
      simulationPaths,
      graphMode: "full",
      detailMode: "summary",
      projection: "overview",
      persistGraph: true,
      forceRefresh: true,
      progress: async (
        value,
        message,
      ) => {
        await runtime.throwIfCancelled();
        await runtime.reportProgress(
          value,
          message,
        );
      },
    });

  await runtime.reportProgress(
    98,
    "Current research graph is ready",
  );

  return {
    runId: result.runId,
    symbol: result.symbol,
    generatedAt:
      result.graph.generatedAt,
    providerAsOf:
      result.providerAsOf,
    score: result.score.overall,
    confidence:
      result.score.confidence,
    activeAgents:
      result.activeAgents,
    nodeCount:
      result.graph.projection
        ?.originalNodeCount ??
      result.graph.nodeCount,
    edgeCount:
      result.graph.projection
        ?.originalEdgeCount ??
      result.graph.edgeCount,
    persistenceStatus:
      result.graphPersistence.status,
    graphUrl: `/workspace/intelligence/knowledge-graph?symbol=${encodeURIComponent(
      result.symbol,
    )}&runId=${encodeURIComponent(
      result.runId,
    )}`,
  };
}
