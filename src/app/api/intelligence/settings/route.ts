import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIntelligenceSettings } from "@/lib/intelligence-settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await ensureIntelligenceSettings(user.id);

  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureIntelligenceSettings(user.id);

  const body = await request.json();

  if (body.kind === "source") {
    if (!body.sourceId) {
      return NextResponse.json(
        { error: "Source ID is required." },
        { status: 400 }
      );
    }

    const source = await prisma.newsSourceConfig.update({
      where: {
        userId_sourceId: {
          userId: user.id,
          sourceId: body.sourceId,
        },
      },
      data: {
        enabled:
          typeof body.enabled === "boolean" ? body.enabled : undefined,
        minScoreToRetain:
          typeof body.minScoreToRetain === "number"
            ? body.minScoreToRetain
            : undefined,
        minScoreToAlert:
          typeof body.minScoreToAlert === "number"
            ? body.minScoreToAlert
            : undefined,
        maxItemsPerRun:
          typeof body.maxItemsPerRun === "number"
            ? body.maxItemsPerRun
            : undefined,
        cooldownMinutes:
          typeof body.cooldownMinutes === "number"
            ? body.cooldownMinutes
            : undefined,
      },
    });

    return NextResponse.json({ source });
  }

  if (body.kind === "policy") {
    const policy = await prisma.intelligenceRetentionPolicy.update({
      where: { userId: user.id },
      data: {
        minScoreToStore:
          typeof body.minScoreToStore === "number"
            ? body.minScoreToStore
            : undefined,
        minScoreToAlert:
          typeof body.minScoreToAlert === "number"
            ? body.minScoreToAlert
            : undefined,
        maxRetainedPerRun:
          typeof body.maxRetainedPerRun === "number"
            ? body.maxRetainedPerRun
            : undefined,
        maxRetainedDecisions:
          typeof body.maxRetainedDecisions === "number"
            ? body.maxRetainedDecisions
            : undefined,
        maxRetainedRuns:
          typeof body.maxRetainedRuns === "number"
            ? body.maxRetainedRuns
            : undefined,
        maxAlertEvents:
          typeof body.maxAlertEvents === "number"
            ? body.maxAlertEvents
            : undefined,
        readAlertRetentionDays:
          typeof body.readAlertRetentionDays === "number"
            ? body.readAlertRetentionDays
            : undefined,
      },
    });

    return NextResponse.json({ policy });
  }

  return NextResponse.json(
    { error: "Unknown settings update kind." },
    { status: 400 }
  );
}