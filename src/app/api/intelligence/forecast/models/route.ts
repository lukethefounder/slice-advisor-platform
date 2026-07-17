import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

import {
  getModelGovernanceOverview,
  promoteForecastModel,
} from "@/lib/intelligence-forecast/model-governance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const overview = await getModelGovernanceOverview(user.id);

  return NextResponse.json({
    ok: true,
    ...overview,
  });
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
    action?: unknown;
    modelId?: unknown;
    reason?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 },
    );
  }

  if (body.action !== "promote") {
    return NextResponse.json(
      {
        error:
          "The only supported action in this phase is promote.",
      },
      { status: 400 },
    );
  }

  const modelId =
    typeof body.modelId === "string"
      ? body.modelId.trim()
      : "";

  const reason =
    typeof body.reason === "string"
      ? body.reason.trim().slice(0, 2_000)
      : "";

  try {
    const model = await promoteForecastModel({
      userId: user.id,
      modelId,
      reason,
      request,
    });

    return NextResponse.json({
      ok: true,
      model,
      autonomousTradingEnabled: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Model promotion was rejected.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown promotion error.",
      },
      { status: 409 },
    );
  }
}