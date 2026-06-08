import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runAutonomousTriageForUser } from "@/lib/autonomous-triage";
import { generateOpportunitySignals } from "@/lib/opportunity-engine";
import {
  runTechnicalOpportunityScanForUser,
  type TechnicalAdvancedFilters,
  type TechnicalUniverseId,
} from "@/lib/technical-opportunity-engine";
import type { ScanMode } from "@/lib/investment-grading-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Slice-Triage-Run", "v8-full-stack-headlines-technicals");
  return response;
}

function readNumber(value: string | null, fallback?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function readInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function readBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

function readScanMode(value: string | null): ScanMode {
  if (value === "fast" || value === "broad" || value === "deep") return value;
  return "fast";
}

function readTechnicalUniverse(value: string | null): TechnicalUniverseId {
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

function cleanSymbol(value: string) {
  return value
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
}

function readCustomSymbols(value: string | null) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/[\s,;|\n\t]+/)
        .map(cleanSymbol)
        .filter(Boolean)
    )
  ).slice(0, 500);
}

function readAdvancedFilters(url: URL, minCompositeScore: number): TechnicalAdvancedFilters {
  const numberOrUndefined = (key: string) => {
    const value = url.searchParams.get(key);
    if (value === null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    minCompositeScore,
    minOpportunityScore: numberOrUndefined("minOpportunityScore"),
    maxRiskScore: numberOrUndefined("maxRiskScore"),
    minConfidenceScore: numberOrUndefined("minConfidenceScore"),
    minActionabilityScore: numberOrUndefined("minActionabilityScore"),
    minAdvisorRelevanceScore: numberOrUndefined("minAdvisorRelevanceScore"),

    minPrice: numberOrUndefined("minPrice"),
    maxPrice: numberOrUndefined("maxPrice"),
    minMarketCap: numberOrUndefined("minMarketCap"),
    minDollarVolume: numberOrUndefined("minDollarVolume"),
    minAverageVolume: numberOrUndefined("minAverageVolume"),

    minRsi14: numberOrUndefined("minRsi14"),
    maxRsi14: numberOrUndefined("maxRsi14"),
    requireRsiRecovery: readBoolean(url.searchParams.get("requireRsiRecovery"), false),
    requireRsiDivergence: readBoolean(url.searchParams.get("requireRsiDivergence"), false),
    requireConstructiveRsiStack: readBoolean(url.searchParams.get("requireConstructiveRsiStack"), false),

    minRangePositionPct: numberOrUndefined("minRangePositionPct"),
    maxRangePositionPct: numberOrUndefined("maxRangePositionPct"),
    minDrawdownFromHighPct: numberOrUndefined("minDrawdownFromHighPct"),
    maxDrawdownFromHighPct: numberOrUndefined("maxDrawdownFromHighPct"),

    minDistanceToSma200Pct: numberOrUndefined("minDistanceToSma200Pct"),
    maxDistanceToSma200Pct: numberOrUndefined("maxDistanceToSma200Pct"),
    requirePriceAboveSma20: readBoolean(url.searchParams.get("requirePriceAboveSma20"), false),
    requirePriceAboveSma50: readBoolean(url.searchParams.get("requirePriceAboveSma50"), false),
    requireMacdImproving: readBoolean(url.searchParams.get("requireMacdImproving"), true),

    minRelative3mVsBenchmarkPct: numberOrUndefined("minRelative3mVsBenchmarkPct"),
    maxVolatility30Pct: numberOrUndefined("maxVolatility30Pct"),
    maxAtr14Pct: numberOrUndefined("maxAtr14Pct"),
    maxBeta: numberOrUndefined("maxBeta"),

    maxForwardPE: numberOrUndefined("maxForwardPE"),
    maxTrailingPE: numberOrUndefined("maxTrailingPE"),
    maxPriceToBook: numberOrUndefined("maxPriceToBook"),
    minDividendYield: numberOrUndefined("minDividendYield"),

    onlyAdvisorRelevant: readBoolean(url.searchParams.get("onlyAdvisorRelevant"), false),
  };
}

function emptyTriageResult() {
  return {
    ok: true,
    mode: "headline-scan-skipped",
    scanMode: "skipped",
    scanned: 0,
    retained: 0,
    alerts: 0,
    discarded: 0,
    noiseFloor: null,
    alertFloor: null,
    sourceHealth: null,
    sourceResults: [],
    alertEventsUpserted: 0,
    aiBackedAlerts: 0,
    deterministicBackedAlerts: 0,
    email: {
      sent: 0,
      simulated: 0,
      failed: 0,
      suppressed: 0,
      skippedDuplicate: 0,
    },
    criteria: {
      watchTickers: 0,
      namedWatchlistTickers: 0,
      clientHoldingTickers: 0,
      portfolioHoldingTickers: 0,
      researchTickers: 0,
      goalThemes: 0,
    },
    decisions: [],
  };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);

  const runHeadlines = readBoolean(url.searchParams.get("headlines"), true);
  const runTechnicals = readBoolean(url.searchParams.get("technicals"), true);
  const generateOpportunities = readBoolean(url.searchParams.get("opportunities"), true);

  if (!runHeadlines && !runTechnicals && !generateOpportunities) {
    return noStoreJson(
      {
        error: "Nothing to run.",
        hint: "Enable at least one of headlines=1, technicals=1, or opportunities=1.",
      },
      { status: 400 }
    );
  }

  const forceDemo = readBoolean(url.searchParams.get("demo"), false);
  const autonomousEmail = readBoolean(url.searchParams.get("email"), true);
  const aiResearch = readBoolean(url.searchParams.get("aiResearch"), true);
  const scanMode = readScanMode(url.searchParams.get("scanMode"));

  const noiseFloor = readNumber(url.searchParams.get("noiseFloor"));
  const alertFloor = readNumber(url.searchParams.get("alertFloor"));

  const technicalUniverse = readTechnicalUniverse(url.searchParams.get("technicalUniverse"));
  const technicalLimit = readInt(url.searchParams.get("technicalLimit"), 80, 1, 125);
  const technicalMinScore = readInt(url.searchParams.get("technicalMinScore"), 70, 50, 95);
  const technicalMaxDurationMs = readInt(
    url.searchParams.get("technicalMaxDurationMs"),
    38_000,
    8_000,
    55_000
  );
  const customSymbols = readCustomSymbols(url.searchParams.get("symbols"));
  const advancedFilters = readAdvancedFilters(url, technicalMinScore);

  const warnings: string[] = [];

  let triage: any = emptyTriageResult();
  let technical: any = null;
  let opportunities: any = null;

  if (runHeadlines) {
    triage = await runAutonomousTriageForUser({
      userId: user.id,
      triggeredBy: "manual",
      forceDemo,
      autonomousEmail,
      aiResearch,
      noiseFloor,
      alertFloor,
      scanMode,
    });
  }

  if (runTechnicals) {
    try {
      technical = await runTechnicalOpportunityScanForUser(user.id, {
        indexUniverse: technicalUniverse,
        customSymbols,
        limit: technicalLimit,
        minCompositeScore: technicalMinScore,
        maxDurationMs: technicalMaxDurationMs,
        includeAdvisorWatchlist: true,
        advancedFilters,
      });
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Technical scan failed: ${error.message}`
          : "Technical scan failed."
      );
      technical = {
        ok: false,
        universe: technicalUniverse,
        scanned: 0,
        qualified: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        alerted: 0,
        timedOut: false,
        providerErrors: {
          unknown: 1,
        },
        topCandidates: [],
        topScreenedCandidates: [],
      };
    }
  }

  if (generateOpportunities) {
    try {
      opportunities = await generateOpportunitySignals(user.id);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Opportunity signal generation failed: ${error.message}`
          : "Opportunity signal generation failed."
      );
      opportunities = {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
      };
    }
  }

  return noStoreJson({
    ok: true,
    route: "/api/intelligence/triage/run",
    version: "triage-run-v8-full-stack-headline-technical-opportunity",
    durationMs: Date.now() - startedAt,
    userId: user.id,
    scanPlan: {
      headlines: runHeadlines,
      technicals: runTechnicals,
      opportunities: generateOpportunities,
      scanMode,
      forceDemo,
      autonomousEmail,
      aiResearch,
      noiseFloor,
      alertFloor,
      technicalUniverse,
      technicalLimit,
      technicalMinScore,
      technicalMaxDurationMs,
      advancedFilters,
    },
    warnings,

    scanned: triage.scanned ?? 0,
    retained: triage.retained ?? 0,
    alerts: triage.alerts ?? 0,
    discarded: triage.discarded ?? 0,
    alertEventsUpserted: triage.alertEventsUpserted ?? 0,
    aiBackedAlerts: triage.aiBackedAlerts ?? 0,
    deterministicBackedAlerts: triage.deterministicBackedAlerts ?? 0,
    email: triage.email ?? null,
    criteria: triage.criteria ?? null,
    decisions: triage.decisions ?? [],

    triage,
    technical,
    opportunities,

    summary: {
      headlineScanned: triage.scanned ?? 0,
      headlineRetained: triage.retained ?? 0,
      headlineAlerts: triage.alerts ?? 0,
      technicalScanned: technical?.scanned ?? 0,
      technicalQualified: technical?.qualified ?? 0,
      technicalCreated: technical?.created ?? 0,
      technicalUpdated: technical?.updated ?? 0,
      technicalAlerts: technical?.alerted ?? 0,
      opportunityCreated: opportunities?.created ?? 0,
      opportunityUpdated: opportunities?.updated ?? 0,
      opportunitySkipped: opportunities?.skipped ?? 0,
      emailSent: triage.email?.sent ?? 0,
      emailSimulated: triage.email?.simulated ?? 0,
      emailFailed: triage.email?.failed ?? 0,
      warningCount: warnings.length,
    },
  });
}

export async function GET(request: Request) {
  return POST(request);
}