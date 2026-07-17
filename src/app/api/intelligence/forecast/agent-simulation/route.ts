import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  getAgentSimulationOverview,
  replayAgentSimulation,
  runAgentSimulation,
} from "@/lib/intelligence-forecast/agent-simulation";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

type SimulationBody = {
  action?: unknown;
  runId?: unknown;
  eventId?: unknown;
  scenario?: unknown;
  paths?: unknown;
  seed?: unknown;
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

function optionalNumber(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
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
    await getAgentSimulationOverview({
      userId:
        user.id,
    });

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
    SimulationBody;

  try {
    body =
      (await request.json()) as SimulationBody;
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
    ) ||
    "run";

  try {
    if (
      action ===
      "replay"
    ) {
      const eventId =
        cleanString(
          body.eventId,
          100,
        );

      if (!eventId) {
        return NextResponse.json(
          {
            error:
              "eventId is required for replay.",
          },
          {
            status:
              400,
          },
        );
      }

      const result =
        await replayAgentSimulation({
          userId:
            user.id,
          eventId,
          request,
        });

      return NextResponse.json(
        {
          ok:
            true,
          action:
            "replay",
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

    if (
      action !==
      "run"
    ) {
      return NextResponse.json(
        {
          error:
            "Supported actions are run and replay.",
        },
        {
          status:
            400,
        },
      );
    }

    const runId =
      cleanString(
        body.runId,
        100,
      );

    if (!runId) {
      return NextResponse.json(
        {
          error:
            "runId is required.",
        },
        {
          status:
            400,
        },
      );
    }

    const result =
      await runAgentSimulation({
        userId:
          user.id,
        runId,
        scenario:
          cleanString(
            body.scenario,
            50,
          ),
        paths:
          optionalNumber(
            body.paths,
          ),
        seed:
          optionalNumber(
            body.seed,
          ),
        request,
      });

    return NextResponse.json(
      {
        ok:
          true,
        action:
          "run",
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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Agent simulation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown simulation error.",
      },
      {
        status:
          409,
      },
    );
  }
}