import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  callCamelWorkforce,
} from "@/lib/intelligence-forecast/camel-client";

import {
  buildForecast,
} from "@/lib/intelligence-forecast/engine";

import {
  createPriorHorizonModelSuite,
  loadHorizonModelSuite,
  persistShadowHorizonPredictions,
  scoreHorizonModelSuite,
} from "@/lib/intelligence-forecast/horizon-models";

import {
  persistForecastRun,
} from "@/lib/intelligence-forecast/persistence";

import {
  auditForecastEvidenceRun,
} from "@/lib/intelligence-forecast/point-in-time-warehouse";

import {
  completeIntelligenceOperation,
  guardErrorResponse,
  guardIntelligenceOperation,
  IntelligenceGuardError,
  type OperationGuardTicket,
} from "@/lib/intelligence-forecast/production-controls";

import {
  syncForecastRunToGraph,
} from "@/lib/intelligence-forecast/provenance-graph";

import {
  ForecastValidationError,
  normalizeMarketSnapshot,
} from "@/lib/intelligence-forecast/validation";

import {
  isNeo4jConfigured,
} from "@/lib/neo4j";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

const MAX_BODY_BYTES =
  160_000;

function responseHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",

    "Content-Type":
      "application/json; charset=utf-8",

    "X-Content-Type-Options":
      "nosniff",

    "Referrer-Policy":
      "no-referrer",

    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=()",
  };
}

export async function GET() {
  return NextResponse.json(
    {
      ok:
        true,

      service:
        "Slice multi-horizon forecast engine",

      inputSchema:
        "slice-forecast-input-1.0.0",

      outputSchema:
        "slice-forecast-output-1.0.0",

      persistence:
        "PostgreSQL forecast history enabled",

      evidenceWarehouse:
        "Point-in-time evidence auditing enabled",

      knowledgeGraph:
        isNeo4jConfigured()
          ? "Neo4j provenance synchronization enabled"
          : "Neo4j is not configured",

      horizonModels:
        "Independent horizon models enabled in shadow mode",

      productionControls:
        "Database-backed throttling, estimated-cost budgets, and circuit breakers enabled",

      safeguards: {
        autonomousTradingEnabled:
          false,

        simulatedConsensusIsTruth:
          false,

        simulationWeightCapped:
          true,

        futureDatedEvidenceAccepted:
          false,

        graphCanExecuteTrades:
          false,

        horizonModelsReplaceProduction:
          false,

        automaticModelPromotionEnabled:
          false,

        costAccountingIsEstimated:
          true,
      },
    },
    {
      status:
        200,

      headers:
        responseHeaders(),
    },
  );
}

export async function POST(
  request: Request,
) {
  const currentUser =
    await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",

        detail:
          "Sign in to generate and store forecasts.",
      },
      {
        status:
          401,

        headers:
          responseHeaders(),
      },
    );
  }

  const contentType =
    request.headers.get(
      "content-type",
    ) ||
    "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    return NextResponse.json(
      {
        error:
          "Content-Type must be application/json.",
      },
      {
        status:
          415,

        headers:
          responseHeaders(),
      },
    );
  }

  let ticket:
    OperationGuardTicket | null =
    null;

  try {
    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8",
      ) >
      MAX_BODY_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            `Forecast request exceeds ${MAX_BODY_BYTES} bytes.`,
        },
        {
          status:
            413,

          headers:
            responseHeaders(),
        },
      );
    }

    let rawInput:
      unknown;

    try {
      rawInput =
        JSON.parse(
          rawBody,
        );
    } catch {
      return NextResponse.json(
        {
          error:
            "Forecast request contains invalid JSON.",
        },
        {
          status:
            400,

          headers:
            responseHeaders(),
        },
      );
    }

    const snapshot =
      normalizeMarketSnapshot(
        rawInput,
      );

    ticket =
      await guardIntelligenceOperation({
        userId:
          currentUser.id,

        operation:
          "forecast.generate",

        request,
      });

    const camel =
      await callCamelWorkforce(
        snapshot,
      );

    const forecast =
      buildForecast(
        snapshot,
        camel,
      );

    let horizonSuite =
      createPriorHorizonModelSuite();

    try {
      horizonSuite =
        await loadHorizonModelSuite(
          currentUser.id,
        );
    } catch (error) {
      console.error(
        "Unable to load trained horizon suite; prior coefficients will be used:",
        error,
      );
    }

    const horizonModels =
      scoreHorizonModelSuite(
        snapshot,
        horizonSuite,
      );

    const enrichedForecast = {
      ...forecast,

      horizonModels,
    };

    const storedRun =
      await persistForecastRun({
        userId:
          currentUser.id,

        snapshot,

        forecast:
          enrichedForecast,

        request,
      });

    let shadowPersistence:
      | {
          status:
            "stored";

          storedCount:
            number;

          modelVersion:
            string;
        }
      | {
          status:
            "failed";

          detail:
            string;
        };

    try {
      const stored =
        await persistShadowHorizonPredictions({
          userId:
            currentUser.id,

          forecastRunId:
            storedRun.id,

          result:
            horizonModels,
        });

      shadowPersistence = {
        status:
          "stored",

        ...stored,
      };
    } catch (error) {
      console.error(
        "Forecast stored, but shadow horizon predictions were not persisted:",
        error,
      );

      shadowPersistence = {
        status:
          "failed",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown shadow-prediction persistence error.",
      };
    }

    let evidenceWarehouse:
      | {
          status:
            "audited";

          pointInTimeSafe:
            boolean;

          integrityScore:
            number;

          warningCount:
            number;
        }
      | {
          status:
            "failed";

          detail:
            string;
        };

    try {
      const audited =
        await auditForecastEvidenceRun({
          userId:
            currentUser.id,

          runId:
            storedRun.id,

          request,
        });

      evidenceWarehouse = {
        status:
          "audited",

        pointInTimeSafe:
          audited.report
            .pointInTimeSafe,

        integrityScore:
          audited.report
            .integrityScore,

        warningCount:
          audited.report
            .warnings.length,
      };
    } catch (error) {
      console.error(
        "Forecast stored, but evidence warehouse audit failed:",
        error,
      );

      evidenceWarehouse = {
        status:
          "failed",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown evidence warehouse error.",
      };
    }

    let knowledgeGraph:
      | {
          status:
            "synced";

          nodes:
            Record<
              string,
              number
            >;

          syncedAt:
            string;
        }
      | {
          status:
            "skipped";

          detail:
            string;
        }
      | {
          status:
            "failed";

          detail:
            string;
        };

    if (
      !isNeo4jConfigured()
    ) {
      knowledgeGraph = {
        status:
          "skipped",

        detail:
          "Neo4j is not configured.",
      };
    } else {
      try {
        const graph =
          await syncForecastRunToGraph({
            userId:
              currentUser.id,

            runId:
              storedRun.id,
          });

        knowledgeGraph = {
          status:
            "synced",

          nodes:
            graph.nodes,

          syncedAt:
            graph.syncedAt,
        };
      } catch (error) {
        console.error(
          "Forecast stored, but knowledge-graph synchronization failed:",
          error,
        );

        knowledgeGraph = {
          status:
            "failed",

          detail:
            error instanceof Error
              ? error.message
              : "Unknown graph synchronization error.",
        };
      }
    }

    await completeIntelligenceOperation({
      userId:
        currentUser.id,

      ticket,

      success:
        true,

      detail:
        `Stored forecast run ${storedRun.id}.`,

      request,
    }).catch(
      console.error,
    );

    return NextResponse.json(
      {
        ...enrichedForecast,

        persistence: {
          status:
            "stored",

          runId:
            storedRun.id,

          storedAt:
            new Date().toISOString(),
        },

        shadowPersistence,

        evidenceWarehouse,

        knowledgeGraph,

        productionControl: {
          requestId:
            ticket.requestId,

          operation:
            ticket.operation,

          service:
            ticket.service,

          estimatedCostUsd:
            ticket.estimatedCostUsd,

          costIsEstimate:
            true,
        },
      },
      {
        status:
          200,

        headers:
          responseHeaders(),
      },
    );
  } catch (error) {
    if (
      error instanceof
      IntelligenceGuardError
    ) {
      const guarded =
        guardErrorResponse(
          error,
        );

      return NextResponse.json(
        guarded.body,
        {
          status:
            guarded.status,

          headers: {
            ...responseHeaders(),

            ...guarded.headers,
          },
        },
      );
    }

    if (
      ticket
    ) {
      await completeIntelligenceOperation({
        userId:
          currentUser.id,

        ticket,

        success:
          false,

        error,

        request,
      }).catch(
        console.error,
      );
    }

    if (
      error instanceof
      ForecastValidationError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,

          issues:
            error.issues,
        },
        {
          status:
            400,

          headers:
            responseHeaders(),
        },
      );
    }

    console.error(
      "Forecast generation or persistence failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Slice forecast generation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown forecast error.",
      },
      {
        status:
          500,

        headers:
          responseHeaders(),
      },
    );
  }
}