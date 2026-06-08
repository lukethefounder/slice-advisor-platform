import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateOpportunitySignals,
  getOpportunityRadar,
} from "@/lib/opportunity-engine";
import {
  runTechnicalOpportunityScanForUser,
  TECHNICAL_UNIVERSES,
  type TechnicalAdvancedFilters,
  type TechnicalUniverseId,
} from "@/lib/technical-opportunity-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OpportunityAction =
  | "generate"
  | "updateStatus"
  | "technicalScan"
  | "runOpportunityStack"
  | "scan"
  | "runScan"
  | "runTechnicalScan"
  | "runFullScan";

type OpportunityPostBody = {
  action?: OpportunityAction;
  signalId?: string;
  status?: string;
  indexUniverse?: TechnicalUniverseId;
  universe?: TechnicalUniverseId;
  customSymbols?: string[] | string;
  symbols?: string[] | string;
  limit?: number;
  minCompositeScore?: number;
  maxDurationMs?: number;
  advancedFilters?: TechnicalAdvancedFilters;
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Slice-Opportunities", "v2-schema-safe");
  return response;
}

function cleanSymbolList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim().replace(/^\$/, "").toUpperCase())
          .filter(Boolean)
          .filter((symbol) => /^[A-Z0-9.\-]{1,12}$/.test(symbol))
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(/[\s,;]+/)
          .map((item) => item.trim().replace(/^\$/, "").toUpperCase())
          .filter(Boolean)
          .filter((symbol) => /^[A-Z0-9.\-]{1,12}$/.test(symbol))
      )
    );
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

function readOptionalNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return undefined;
}

function normalizeAction(value: unknown): OpportunityAction {
  if (
    value === "generate" ||
    value === "updateStatus" ||
    value === "technicalScan" ||
    value === "runOpportunityStack" ||
    value === "scan" ||
    value === "runScan" ||
    value === "runTechnicalScan" ||
    value === "runFullScan"
  ) {
    return value;
  }

  return "generate";
}

function normalizeAdvancedFilters(value: unknown): TechnicalAdvancedFilters | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const raw = value as Record<string, unknown>;

  return {
    minCompositeScore: readOptionalNumber(raw.minCompositeScore),
    minOpportunityScore: readOptionalNumber(raw.minOpportunityScore),
    maxRiskScore: readOptionalNumber(raw.maxRiskScore),
    minConfidenceScore: readOptionalNumber(raw.minConfidenceScore),
    minActionabilityScore: readOptionalNumber(raw.minActionabilityScore),
    minAdvisorRelevanceScore: readOptionalNumber(raw.minAdvisorRelevanceScore),

    minPrice: readOptionalNumber(raw.minPrice),
    maxPrice: readOptionalNumber(raw.maxPrice),
    minMarketCap: readOptionalNumber(raw.minMarketCap),
    minDollarVolume: readOptionalNumber(raw.minDollarVolume),
    minAverageVolume: readOptionalNumber(raw.minAverageVolume),

    minRsi14: readOptionalNumber(raw.minRsi14),
    maxRsi14: readOptionalNumber(raw.maxRsi14),
    requireRsiRecovery: readOptionalBoolean(raw.requireRsiRecovery),
    requireRsiDivergence: readOptionalBoolean(raw.requireRsiDivergence),
    requireConstructiveRsiStack: readOptionalBoolean(raw.requireConstructiveRsiStack),

    minRangePositionPct: readOptionalNumber(raw.minRangePositionPct),
    maxRangePositionPct: readOptionalNumber(raw.maxRangePositionPct),
    minDrawdownFromHighPct: readOptionalNumber(raw.minDrawdownFromHighPct),
    maxDrawdownFromHighPct: readOptionalNumber(raw.maxDrawdownFromHighPct),

    minDistanceToSma200Pct: readOptionalNumber(raw.minDistanceToSma200Pct),
    maxDistanceToSma200Pct: readOptionalNumber(raw.maxDistanceToSma200Pct),
    requirePriceAboveSma20: readOptionalBoolean(raw.requirePriceAboveSma20),
    requirePriceAboveSma50: readOptionalBoolean(raw.requirePriceAboveSma50),
    requireMacdImproving: readOptionalBoolean(raw.requireMacdImproving),

    minRelative3mVsBenchmarkPct: readOptionalNumber(raw.minRelative3mVsBenchmarkPct),
    maxVolatility30Pct: readOptionalNumber(raw.maxVolatility30Pct),
    maxAtr14Pct: readOptionalNumber(raw.maxAtr14Pct),
    maxBeta: readOptionalNumber(raw.maxBeta),

    maxForwardPE: readOptionalNumber(raw.maxForwardPE),
    maxTrailingPE: readOptionalNumber(raw.maxTrailingPE),
    maxPriceToBook: readOptionalNumber(raw.maxPriceToBook),
    minDividendYield: readOptionalNumber(raw.minDividendYield),

    onlyAdvisorRelevant: readOptionalBoolean(raw.onlyAdvisorRelevant),
  };
}

function withoutOk<T extends Record<string, unknown>>(value: T) {
  const { ok: _ok, ...rest } = value;
  return rest;
}

async function buildOpportunityResponse(userId: string) {
  const radar = await getOpportunityRadar(userId);

  const technicalSignals = radar.signals.filter(
    (signal) => signal.signalType === "Technical Opportunity"
  );

  return {
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
      critical: technicalSignals.filter((signal) => signal.priorityTier === "Critical").length,
      high: technicalSignals.filter((signal) => signal.priorityTier === "High").length,
      medium: technicalSignals.filter((signal) => signal.priorityTier === "Medium").length,
      low: technicalSignals.filter((signal) => signal.priorityTier === "Low").length,
    },
  };
}

function technicalScanOptions(userId: string, body: OpportunityPostBody) {
  const indexUniverse = readTechnicalUniverse(body.indexUniverse ?? body.universe);
  const customSymbols = cleanSymbolList(body.customSymbols ?? body.symbols);
  const minCompositeScore = readNumber(body.minCompositeScore, 70, 50, 95);
  const advancedFilters = normalizeAdvancedFilters(body.advancedFilters);

  return {
    indexUniverse,
    customSymbols,
    limit: readNumber(body.limit, 40, 1, 125),
    minCompositeScore,
    maxDurationMs: readNumber(body.maxDurationMs, 38_000, 8_000, 55_000),
    includeAdvisorWatchlist: true,
    advancedFilters: {
      ...advancedFilters,
      minCompositeScore: advancedFilters?.minCompositeScore ?? minCompositeScore,
    },
    userId,
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  return noStoreJson(await buildOpportunityResponse(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as OpportunityPostBody;
  const action = normalizeAction(body.action);

  if (action === "generate" || action === "scan" || action === "runScan") {
    const result = await generateOpportunitySignals(user.id);

    return noStoreJson({
      ok: true,
      operation: "generate",
      result,
      radar: await buildOpportunityResponse(user.id),
    });
  }

  if (action === "technicalScan" || action === "runTechnicalScan") {
    const options = technicalScanOptions(user.id, body);
    const { userId: _userId, ...scanOptions } = options;

    const result = await runTechnicalOpportunityScanForUser(user.id, scanOptions);
    const scanResult = withoutOk(result as Record<string, unknown>);

    return noStoreJson({
      ok: Boolean(result.ok),
      operation: "technicalScan",
      ...scanResult,
      radar: await buildOpportunityResponse(user.id),
    });
  }

  if (action === "runOpportunityStack" || action === "runFullScan") {
    const news = await generateOpportunitySignals(user.id);

    const options = technicalScanOptions(user.id, body);
    const { userId: _userId, ...scanOptions } = options;

    const technical = await runTechnicalOpportunityScanForUser(user.id, scanOptions);
    const technicalResult = withoutOk(technical as Record<string, unknown>);

    return noStoreJson({
      ok: Boolean(technical.ok),
      operation: "runOpportunityStack",
      news,
      technical: technicalResult,
      radar: await buildOpportunityResponse(user.id),
    });
  }

  if (action === "updateStatus") {
    if (!body.signalId || !body.status) {
      return noStoreJson(
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

    return noStoreJson({
      ok: true,
      operation: "updateStatus",
      signal,
      radar: await buildOpportunityResponse(user.id),
    });
  }

  return noStoreJson(
    { error: "Unknown opportunity action." },
    { status: 400 }
  );
}