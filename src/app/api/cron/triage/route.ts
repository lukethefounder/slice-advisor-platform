import { NextResponse } from "next/server";
import { runAutonomousTriageBatch } from "@/lib/autonomous-triage";
import { getIntegrationStatuses } from "@/lib/env";
import type { ScanMode } from "@/lib/investment-grading-engine";
import {
  runTechnicalOpportunityScanBatch,
  type TechnicalUniverseId,
} from "@/lib/technical-opportunity-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Slice-Cron-Route", "triage-v4-resilient-technical");
  return response;
}

function isVercelCronRequest(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  return userAgent.includes("vercel-cron/1.0");
}

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecretHeader = request.headers.get("x-cron-secret") ?? "";

  if (isVercelCronRequest(request)) return true;

  if (secret) {
    return authorization === `Bearer ${secret}` || cronSecretHeader === secret;
  }

  return process.env.NODE_ENV !== "production";
}

function readBatchSize(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(75, Math.round(parsed)));
}

function readBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

function readScanMode(value: string | null): ScanMode {
  if (value === "fast" || value === "broad" || value === "deep") return value;
  return "broad";
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

function readNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function readUserId(value: string | null) {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function readCustomSymbols(value: string | null) {
  return String(value ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.trim().replace(/^\$/, "").toUpperCase())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const routeStartedAt = Date.now();

  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson(
      {
        error: "Unauthorized cron request.",
        hint:
          "Use Vercel Cron, or set CRON_SECRET and call with Authorization: Bearer <secret> or x-cron-secret.",
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const scanMode = readScanMode(url.searchParams.get("scanMode"));
  const autonomousEmail = readBoolean(url.searchParams.get("email"), true);
  const aiResearch = readBoolean(url.searchParams.get("aiResearch"), true);
  const forceDemo = readBoolean(url.searchParams.get("demo"), false);
  const runTechnicals = readBoolean(url.searchParams.get("technicals"), true);
  const targetUserId = readUserId(url.searchParams.get("userId"));
  const batchSize = readBatchSize(url.searchParams.get("limit"));
  const technicalUniverse = readTechnicalUniverse(url.searchParams.get("technicalUniverse"));
  const technicalLimit = readNumber(url.searchParams.get("technicalLimit"), 30, 1, 125);
  const technicalMinScore = readNumber(url.searchParams.get("technicalMinScore"), 70, 50, 95);
  const technicalMaxDurationMs = readNumber(url.searchParams.get("technicalMaxDurationMs"), 28_000, 8_000, 55_000);
  const customSymbols = readCustomSymbols(url.searchParams.get("symbols"));

  const batchResult = await runAutonomousTriageBatch({
    batchSize,
    forceDemo,
    autonomousEmail,
    aiResearch,
    triggeredBy: isVercelCronRequest(request) ? "cron" : "system",
    scanMode,
    targetUserId,
  });

  const technicalResult = runTechnicals
    ? await runTechnicalOpportunityScanBatch({
        batchSize,
        targetUserId,
        indexUniverse: technicalUniverse,
        customSymbols,
        limit: technicalLimit,
        minCompositeScore: technicalMinScore,
        maxDurationMs: technicalMaxDurationMs,
      })
    : null;

  return noStoreJson({
    ok: true,
    route: "/api/cron/triage",
    version: "autonomous-triage-v4-headlines-plus-resilient-technicals",
    purpose:
      "Continuous advisor-specific U.S. investment intelligence scanning with source-backed headline triage and technical opportunity filtering.",
    authorization: {
      vercelCron: isVercelCronRequest(request),
      manualSecretAccepted: !isVercelCronRequest(request),
    },
    scanMode,
    autonomousEmail,
    aiResearch,
    forceDemo,
    targetUserId,
    batchSize,
    technicals: {
      enabled: runTechnicals,
      universe: technicalUniverse,
      limit: technicalLimit,
      minCompositeScore: technicalMinScore,
      maxDurationMs: technicalMaxDurationMs,
      customSymbols,
    },
    integrations: getIntegrationStatuses(),
    routeDurationMs: Date.now() - routeStartedAt,
    headlineBatchDurationMs: batchResult.durationMs,
    headlineBatch: batchResult,
    technicalBatch: technicalResult,
  });
}

export async function POST(request: Request) {
  return GET(request);
}