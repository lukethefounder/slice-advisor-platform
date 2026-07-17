import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  ensureProvenanceGraphSchema,
  getProvenanceGraphOverview,
  syncForecastGraphBatch,
  syncForecastRunToGraph,
} from "@/lib/intelligence-forecast/provenance-graph";

import {
  getNeo4jConfiguration,
  verifyNeo4jConnectivity,
} from "@/lib/neo4j";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type GraphBody = {
  action?: unknown;
  runId?: unknown;
  limit?: unknown;
};

function cleanString(
  value: unknown,
  maximumLength: number,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maximumLength,
        )
    : "";
}

function readLimit(
  value: unknown,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 25;
  }

  return Math.max(
    1,
    Math.min(
      100,
      Math.round(
        parsed,
      ),
    ),
  );
}

function cleanSymbol(
  value:
    | string
    | null,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9.\-:$]/g,
      "",
    )
    .slice(
      0,
      20,
    );
}

export async function GET(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const url =
    new URL(
      request.url,
    );

  const runId =
    cleanString(
      url.searchParams.get(
        "runId",
      ),
      100,
    );

  const symbol =
    cleanSymbol(
      url.searchParams.get(
        "symbol",
      ),
    );

  const limit =
    readLimit(
      url.searchParams.get(
        "limit",
      ),
    );

  const overview =
    await getProvenanceGraphOverview(
      {
        userId:
          user.id,

        runId,

        symbol,

        limit,
      },
    );

  return NextResponse.json(
    {
      ok: true,

      generatedAt:
        new Date().toISOString(),

      ...overview,

      safeguards: {
        autonomousTradingEnabled:
          false,

        graphCanExecuteTrades:
          false,

        rawCredentialsStored:
          false,

        tenantIdentifierHashed:
          true,
      },
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  let body:
    GraphBody;

  try {
    body =
      (await request.json()) as GraphBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body must contain valid JSON.",
      },
      {
        status: 400,
      },
    );
  }

  const action =
    cleanString(
      body.action,
      50,
    );

  try {
    if (
      action ===
      "initialize"
    ) {
      await ensureProvenanceGraphSchema();

      const connectivity =
        await verifyNeo4jConnectivity();

      return NextResponse.json(
        {
          ok: true,

          action,

          configuration:
            getNeo4jConfiguration(),

          connectivity,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    if (
      action ===
      "sync-run"
    ) {
      const runId =
        cleanString(
          body.runId,
          100,
        );

      if (!runId) {
        return NextResponse.json(
          {
            error:
              "runId is required for sync-run.",
          },
          {
            status: 400,
          },
        );
      }

      const result =
        await syncForecastRunToGraph(
          {
            userId:
              user.id,

            runId,
          },
        );

      return NextResponse.json(
        {
          ok: true,

          action,

          result,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    if (
      action ===
        "sync-batch" ||
      !action
    ) {
      const result =
        await syncForecastGraphBatch(
          {
            userId:
              user.id,

            limit:
              readLimit(
                body.limit,
              ),
          },
        );

      return NextResponse.json(
        {
          ok: true,

          action:
            "sync-batch",

          ...result,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        error:
          "Unsupported graph action.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Knowledge-graph operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown graph error.",
      },
      {
        status: 409,
      },
    );
  }
}