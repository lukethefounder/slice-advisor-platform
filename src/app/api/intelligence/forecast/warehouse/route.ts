import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  auditForecastEvidenceRun,
  auditForecastWarehouseBatch,
  getForecastWarehouseOverview,
} from "@/lib/intelligence-forecast/point-in-time-warehouse";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type WarehouseBody = {
  action?: unknown;
  runId?: unknown;
  limit?: unknown;
  onlyMissing?: unknown;
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

function readLimit(
  value: unknown,
  fallback = 25,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return fallback;
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
    await getForecastWarehouseOverview(
      {
        userId:
          user.id,

        symbol,

        limit,
      },
    );

  return NextResponse.json(
    {
      ok: true,
      ...overview,
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
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
    WarehouseBody;

  try {
    body =
      (await request.json()) as WarehouseBody;
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
      "audit-run"
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
              "runId is required for audit-run.",
          },
          {
            status: 400,
          },
        );
      }

      const result =
        await auditForecastEvidenceRun(
          {
            userId:
              user.id,

            runId,

            request,
          },
        );

      return NextResponse.json(
        {
          ok: true,

          action,

          ...result,

          autonomousTradingEnabled:
            false,
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
        "audit-batch" ||
      !action
    ) {
      const result =
        await auditForecastWarehouseBatch(
          {
            userId:
              user.id,

            limit:
              readLimit(
                body.limit,
              ),

            onlyMissing:
              body.onlyMissing !==
              false,
          },
        );

      return NextResponse.json(
        {
          ok: true,

          action:
            "audit-batch",

          ...result,

          autonomousTradingEnabled:
            false,
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
          "Unsupported warehouse action.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Point-in-time warehouse operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown warehouse error.",
      },
      {
        status: 409,
      },
    );
  }
}