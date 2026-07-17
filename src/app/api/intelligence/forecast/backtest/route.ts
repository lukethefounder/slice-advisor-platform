import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import {
  getModelGovernanceOverview,
  runStoredPointInTimeBacktest,
} from "@/lib/intelligence-forecast/model-governance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const overview = await getModelGovernanceOverview(user.id);

  return NextResponse.json(
    {
      ok: true,
      ...overview,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: {
    modelVersion?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 },
    );
  }

  const modelVersion =
    typeof body.modelVersion === "string"
      ? body.modelVersion.trim().slice(0, 200)
      : "";

  if (!modelVersion) {
    return NextResponse.json(
      { error: "modelVersion is required." },
      { status: 400 },
    );
  }

  try {
    const result = await runStoredPointInTimeBacktest({
      userId: user.id,
      modelVersion,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Model validation failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown validation error.",
      },
      {
        status: 409,
      },
    );
  }
}