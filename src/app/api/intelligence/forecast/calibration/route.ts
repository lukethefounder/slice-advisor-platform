import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import {
  getCalibrationSummary,
} from "@/lib/intelligence-forecast/settlement";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export async function GET() {
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

  const calibration =
    await getCalibrationSummary(
      user.id,
    );

  return NextResponse.json(
    {
      ok: true,
      ...calibration,

      definitions: {
        brierScore:
          "Probability accuracy score. Lower is better and zero is perfect.",

        logLoss:
          "Penalizes highly confident incorrect probabilities. Lower is better.",

        intervalCoveragePercent:
          "Percent of observed prices that landed inside the forecast interval.",

        directionalAccuracyPercent:
          "Percent of bullish, bearish, or neutral classifications that were correct.",

        meanAbsoluteReturnError:
          "Average absolute difference between expected return and realized return.",

        reliability:
          "Compares forecast probability with the actual frequency of positive outcomes.",
      },
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