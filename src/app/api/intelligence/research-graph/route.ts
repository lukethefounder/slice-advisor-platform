import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { timestampFreshness } from "@/lib/intelligence/freshness";
import {
  getResearchGraphPersistenceConfiguration,
} from "@/lib/intelligence/research-graph";
import { loadLatestResearchGraphView } from "@/lib/intelligence/research-swarm-service";
import type { ResearchGraphProjectionMode } from "@/lib/intelligence/research-swarm-types";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clean(value: string | null, maximum = 220) {
  return String(value ?? "").trim().slice(0, maximum);
}

function symbol(value: string | null) {
  return clean(value, 24)
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "");
}

function projection(
  value: string | null,
): ResearchGraphProjectionMode {
  const mode = clean(value, 20).toLowerCase();
  return mode === "balanced" || mode === "full"
    ? mode
    : "overview";
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/research-graph",
    timeoutMs: 18_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `research-graph:${access.user.id}:${hashForSecurity(
        getClientIp(request),
      )}`,
      limit: 120,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "RESEARCH_GRAPH_RATE_LIMITED",
        message: "Too many graph requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const url = new URL(request.url);
    const requestedSymbol =
      symbol(url.searchParams.get("symbol")) || "MSFT";
    const selectedProjection = projection(
      url.searchParams.get("projection"),
    );
    const persistence =
      getResearchGraphPersistenceConfiguration();
    const view = await loadLatestResearchGraphView({
      userId: access.user.id,
      symbol: requestedSymbol,
      projection: selectedProjection,
      selectedNodeId:
        clean(url.searchParams.get("nodeId")) || null,
      runId:
        clean(url.searchParams.get("runId"), 120) ||
        undefined,
    });

    const freshness = view
      ? {
          graph: timestampFreshness(view.generatedAt, {
            currentWithinMs: 15 * 60_000,
            recentWithinMs: 24 * 60 * 60_000,
          }),
          provider: timestampFreshness(view.metadata.providerAsOf, {
            currentWithinMs: 15 * 60_000,
            recentWithinMs: 24 * 60 * 60_000,
          }),
        }
      : null;

    return apiJson({
      ok: true,
      symbol: requestedSymbol,
      projection: selectedProjection,
      view,
      freshness,
      empty: !view,
      persistence: {
        configured: persistence.configured,
        enabled: persistence.enabled,
        database: persistence.database,
        missing: persistence.missing,
      },
      message: view
        ? "Latest research graph loaded."
        : persistence.configured
          ? "No persisted research graph is available for this symbol yet."
          : "No in-memory graph is available. Configure Neo4j for durable graph history or run a graph build in this session.",
    });
  },
);
