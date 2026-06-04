import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateOpportunitySignals,
  getOpportunityRadar,
} from "@/lib/opportunity-engine";
import {
  runTechnicalOpportunityScanForUser,
  TECHNICAL_UNIVERSES,
  type TechnicalUniverseId,
} from "@/lib/technical-opportunity-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanSymbolList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim().replace(/^\$/, "").toUpperCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\s,;]+/)
      .map((item) => item.trim().replace(/^\$/, "").toUpperCase())
      .filter(Boolean);
  }

  return [];
}

function readTechnicalUniverse(value: unknown): TechnicalUniverseId {
  if (
    value === "sp100" ||
    value === "nasdaq100" ||
    value === "dow30" ||
    value === "advisor-watchlist" ||
    value === "custom"
  ) {
    return value;
  }

  return "sp100";
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const radar = await getOpportunityRadar(user.id);

  const technicalSignals = radar.signals.filter(
    (signal) => signal.signalType === "Technical Opportunity"
  );

  const response = NextResponse.json({
    ...radar,
    technical: {
      universes: TECHNICAL_UNIVERSES,
      total: technicalSignals.length,
      open: technicalSignals.filter((signal) => signal.status === "Open").length,
      highConviction: technicalSignals.filter(
        (signal) =>
          signal.priorityTier === "High" || signal.priorityTier === "Critical"
      ).length,
      averageComposite: technicalSignals.length
        ? Math.round(
            technicalSignals.reduce(
              (sum, signal) => sum + signal.compositeScore,
              0
            ) / technicalSignals.length
          )
        : 0,
    },
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?:
      | "generate"
      | "updateStatus"
      | "technicalScan"
      | "runOpportunityStack";
    signalId?: string;
    status?: string;
    indexUniverse?: TechnicalUniverseId;
    customSymbols?: string[] | string;
    limit?: number;
    minCompositeScore?: number;
    maxDurationMs?: number;
  };

  if (body.action === "generate") {
    const result = await generateOpportunitySignals(user.id);
    return NextResponse.json(result);
  }

  if (body.action === "technicalScan") {
    const result = await runTechnicalOpportunityScanForUser(user.id, {
      indexUniverse: readTechnicalUniverse(body.indexUniverse),
      customSymbols: cleanSymbolList(body.customSymbols),
      limit: readNumber(body.limit, 40, 1, 125),
      minCompositeScore: readNumber(body.minCompositeScore, 70, 50, 95),
      maxDurationMs: readNumber(body.maxDurationMs, 38_000, 8_000, 55_000),
      includeAdvisorWatchlist: true,
    });

    return NextResponse.json(result);
  }

  if (body.action === "runOpportunityStack") {
    const news = await generateOpportunitySignals(user.id);
    const technical = await runTechnicalOpportunityScanForUser(user.id, {
      indexUniverse: readTechnicalUniverse(body.indexUniverse),
      customSymbols: cleanSymbolList(body.customSymbols),
      limit: readNumber(body.limit, 40, 1, 125),
      minCompositeScore: readNumber(body.minCompositeScore, 70, 50, 95),
      maxDurationMs: readNumber(body.maxDurationMs, 38_000, 8_000, 55_000),
      includeAdvisorWatchlist: true,
    });

    return NextResponse.json({
      ok: true,
      news,
      technical,
    });
  }

  if (body.action === "updateStatus") {
    if (!body.signalId || !body.status) {
      return NextResponse.json(
        { error: "Signal ID and status are required." },
        { status: 400 }
      );
    }

    const signal = await prisma.opportunitySignal.updateMany({
      where: {
        id: body.signalId,
        userId: user.id,
      },
      data: {
        status: body.status,
      },
    });

    return NextResponse.json({ signal });
  }

  return NextResponse.json(
    { error: "Unknown opportunity action." },
    { status: 400 }
  );
}