import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import {
  settleForecastHorizon,
} from "@/lib/intelligence-forecast/settlement";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

type Body = {
  forecastHorizonId?: unknown;
  observedPrice?: unknown;
  observedAt?: unknown;
  provider?: unknown;
  force?: unknown;
};

function cleanString(
  value: unknown,
  maxLength: number,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maxLength,
        )
    : "";
}

export async function POST(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  let body: Body;

  try {
    body =
      (await request.json()) as Body;
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

  const forecastHorizonId =
    cleanString(
      body.forecastHorizonId,
      100,
    );

  const observedPrice =
    Number(
      body.observedPrice,
    );

  if (!forecastHorizonId) {
    return NextResponse.json(
      {
        error:
          "forecastHorizonId is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isFinite(
      observedPrice,
    ) ||
    observedPrice <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "observedPrice must be greater than zero.",
      },
      {
        status: 400,
      },
    );
  }

  const forceBeforeTarget =
    process.env.NODE_ENV !==
      "production" &&
    body.force === true;

  try {
    const result =
      await settleForecastHorizon({
        userId:
          user.id,
        forecastHorizonId,
        observedPrice,
        observedAt:
          cleanString(
            body.observedAt,
            50,
          ) || undefined,
        provider:
          cleanString(
            body.provider,
            100,
          ) || "Manual",
        forceBeforeTarget,
        request,
        raw: {
          source:
            "Authenticated manual settlement",
          forceBeforeTarget,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        alreadySettled:
          result.alreadySettled,
        horizon:
          result.horizon,
        outcome:
          result.outcome,
      },
      {
        status: 200,
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
          "Unable to settle forecast.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown settlement error.",
      },
      {
        status: 409,
      },
    );
  }
}