import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  lookupHistoricalOutcomePrice,
} from "@/lib/intelligence-forecast/historical-price";

import type {
  ForecastHorizon,
} from "@/lib/intelligence-forecast/types";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

const VALID_HORIZONS =
  new Set<ForecastHorizon>([
    "5-30m",
    "intraday",
    "1d",
    "2-5d",
    "1-4w",
    "1-3m",
    "3-12m",
    "1-3y",
  ]);

function cleanSymbol(
  value: string | null,
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9.\-:$]/g,
      "",
    )
    .slice(0, 20);
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
    new URL(request.url);

  const symbol =
    cleanSymbol(
      url.searchParams.get(
        "symbol",
      ),
    );

  const targetAt =
    new Date(
      url.searchParams.get(
        "targetAt",
      ) ?? "",
    );

  const horizon =
    url.searchParams.get(
      "horizon",
    ) as ForecastHorizon | null;

  if (!symbol) {
    return NextResponse.json(
      {
        error:
          "symbol is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isFinite(
      targetAt.getTime(),
    )
  ) {
    return NextResponse.json(
      {
        error:
          "targetAt must be a valid ISO date.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !horizon ||
    !VALID_HORIZONS.has(
      horizon,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid horizon is required.",
      },
      {
        status: 400,
      },
    );
  }

  const result =
    await lookupHistoricalOutcomePrice({
      symbol,
      targetAt,
      horizon,
    });

  return NextResponse.json(
    {
      ok:
        Boolean(
          result.resolution,
        ),

      requestedBy:
        user.id,

      symbol,

      targetAt:
        targetAt.toISOString(),

      horizon,

      ...result,

      autonomousTradingEnabled:
        false,
    },
    {
      status:
        result.resolution
          ? 200
          : 404,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}