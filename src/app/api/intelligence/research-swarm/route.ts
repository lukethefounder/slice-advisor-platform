import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getAlphaVantageIntelligence } from "@/lib/intelligence/alpha-vantage-live";
import { getEconomicResearch } from "@/lib/intelligence/economic-live";
import {
  loadLatestResearchKnowledgeGraph,
  persistResearchKnowledgeGraph,
} from "@/lib/intelligence/research-graph";
import { runResearchSwarm } from "@/lib/intelligence/research-swarm";
import type { IntelligenceScanPayload } from "@/lib/intelligence-forecast/live-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_BODY_BYTES = 32_000;

type RequestBody = {
  symbol?: unknown;
  agentCount?: unknown;
  simulationPaths?: unknown;
  graphMode?: unknown;
  detailMode?: unknown;
  persistGraph?: unknown;
};

function cleanString(value: unknown, maximumLength = 100) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function numberValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.round(Math.max(minimum, Math.min(maximum, parsed)))
    : fallback;
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

async function loadExistingScan(request: Request) {
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") ?? "";

  try {
    const response = await fetch(`${url.origin}/api/intelligence/scan`, {
      cache: "no-store",
      headers: {
        cookie,
      },
    });

    if (!response.ok) {
      return {
        scan: null,
        warning: `Existing media-source scan returned HTTP ${response.status}.`,
      };
    }

    return {
      scan: (await response.json()) as IntelligenceScanPayload,
      warning: null,
    };
  } catch (error) {
    return {
      scan: null,
      warning:
        error instanceof Error
          ? `Existing media-source scan failed: ${error.message}`
          : "Existing media-source scan failed.",
    };
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
        headers: responseHeaders(),
      },
    );
  }

  const url = new URL(request.url);
  const symbol = cleanString(url.searchParams.get("symbol"), 32).toUpperCase();
  const graph = await loadLatestResearchKnowledgeGraph({
    userId: user.id,
    symbol,
  });

  return NextResponse.json(
    {
      ok: true,
      service: "Slice real-time research swarm",
      maximumAgents: 2_000,
      allocation: "One third media, one third technical, one third economy",
      graph,
      safeguards: {
        externalCallsPerAgent: false,
        autonomousTradingEnabled: false,
        equalThirdWeighting: true,
      },
    },
    {
      status: 200,
      headers: responseHeaders(),
    },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
        headers: responseHeaders(),
      },
    );
  }

  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: `Research request exceeds ${MAX_BODY_BYTES} bytes.`,
        },
        {
          status: 413,
          headers: responseHeaders(),
        },
      );
    }

    let body: RequestBody;

    try {
      body = JSON.parse(rawBody || "{}") as RequestBody;
    } catch {
      return NextResponse.json(
        {
          error: "Request body must contain valid JSON.",
        },
        {
          status: 400,
          headers: responseHeaders(),
        },
      );
    }

    const symbol = cleanString(body.symbol, 32).toUpperCase() || "MSFT";
    const requestedAgents = numberValue(body.agentCount, 2_000, 30, 2_000);
    const simulationPaths = numberValue(
      body.simulationPaths,
      500,
      100,
      5_000,
    );
    const detailModeRaw = cleanString(body.detailMode, 20).toLowerCase();
    const detailMode =
      detailModeRaw === "agents" ||
      detailModeRaw === "graph" ||
      detailModeRaw === "full"
        ? detailModeRaw
        : "summary";
    const graphMode =
      detailMode === "graph" ||
      detailMode === "full" ||
      cleanString(body.graphMode, 20).toLowerCase() === "full"
        ? ("full" as const)
        : ("summary" as const);
    const persistGraph = body.persistGraph !== false;
    const alpha = await getAlphaVantageIntelligence({
      symbol,
      interval: "5min",
    });

    if (!alpha.ok) {
      return NextResponse.json(
        {
          error: alpha.error || "Alpha Vantage evidence is unavailable.",
          alpha,
        },
        {
          status: 409,
          headers: responseHeaders(),
        },
      );
    }

    const [scanResult, economy] = await Promise.all([
      loadExistingScan(request),
      getEconomicResearch({
        sector: alpha.overview?.sector || "Unknown",
        industry: alpha.overview?.industry || "Unknown",
      }),
    ]);
    const swarm = runResearchSwarm({
      symbol,
      requestedAgents,
      alpha,
      scan: scanResult.scan,
      economy,
      simulationPaths,
      graphMode,
    });
    const graphPersistence = persistGraph
      ? await persistResearchKnowledgeGraph({
          userId: user.id,
          graph: swarm.graph,
        })
      : {
          status: "skipped" as const,
          detail: "Graph persistence was disabled for this request.",
        };

    const includeAllAgents =
      detailMode === "agents" || detailMode === "full";
    const responseSwarm = {
      ...swarm,
      agents: includeAllAgents
        ? swarm.agents
        : (["media", "technical", "economy"] as const).flatMap(
            (cohort) =>
              swarm.agents
                .filter((agent) => agent.cohort === cohort)
                .slice(0, 40),
          ),
    };

    return NextResponse.json(
      {
        ...responseSwarm,
        graphPersistence,
        warnings: [
          ...swarm.warnings,
          ...(scanResult.warning ? [scanResult.warning] : []),
        ],
      },
      {
        status: 200,
        headers: responseHeaders(),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Research swarm failed.",
        detail:
          error instanceof Error ? error.message : "Unknown research error.",
      },
      {
        status: 409,
        headers: responseHeaders(),
      },
    );
  }
}