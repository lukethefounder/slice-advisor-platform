import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  generateEnsembleForRun,
  getEnsembleOverview,
  trainEnsembleSuite,
} from "@/lib/intelligence-forecast/ensemble-optimization";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type EnsembleBody = {
  action?:
    unknown;

  runId?:
    unknown;
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

export async function GET() {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status:
          401,
      },
    );
  }

  const overview =
    await getEnsembleOverview(
      user.id,
    );

  return NextResponse.json(
    {
      ok:
        true,

      ...overview,
    },
    {
      status:
        200,

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
        status:
          401,
      },
    );
  }

  let body:
    EnsembleBody;

  try {
    body =
      (await request.json()) as EnsembleBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body must contain valid JSON.",
      },
      {
        status:
          400,
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
      "train"
    ) {
      const result =
        await trainEnsembleSuite({
          userId:
            user.id,

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          ...result,
        },
        {
          status:
            200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    if (
      action ===
      "generate-run"
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
              "runId is required for generate-run.",
          },
          {
            status:
              400,
          },
        );
      }

      const result =
        await generateEnsembleForRun({
          userId:
            user.id,

          runId,

          request,
        });

      return NextResponse.json(
        {
          ok:
            true,

          action,

          result,
        },
        {
          status:
            200,

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
          "Supported actions are train and generate-run.",
      },
      {
        status:
          400,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Ensemble operation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown ensemble error.",
      },
      {
        status:
          409,
      },
    );
  }
}