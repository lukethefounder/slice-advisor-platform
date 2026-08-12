import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
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

function projection(value: string | null): ResearchGraphProjectionMode {
  const mode = clean(value, 20).toLowerCase();
  return mode === "overview" || mode === "full" ? mode : "balanced";
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/research-graph",
    timeoutMs: 30_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({ requireFirm: true });
    const rate = checkRateLimit({
      key: `research-graph:${access.user.id}:${hashForSecurity(getClientIp(request))}`,
      limit: 180,
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
    const requestedSymbol = symbol(url.searchParams.get("symbol")) || "MSFT";
    const view = await loadLatestResearchGraphView({
      userId: access.user.id,
      symbol: requestedSymbol,
      projection: projection(url.searchParams.get("projection")),
      selectedNodeId: clean(url.searchParams.get("nodeId")) || null,
      runId: clean(url.searchParams.get("runId"), 120) || undefined,
    });

    return apiJson({
      ok: true,
      symbol: requestedSymbol,
      view,
      empty: !view,
      message: view
        ? "Latest research graph loaded."
        : "No persisted research graph is available for this symbol yet.",
    });
  },
);