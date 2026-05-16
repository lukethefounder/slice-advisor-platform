import { NextResponse } from "next/server";
import { runAutonomousTriageBatch } from "@/lib/autonomous-triage";
import { getIntegrationStatuses } from "@/lib/env";
import type { ScanMode } from "@/lib/investment-grading-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecretHeader = request.headers.get("x-cron-secret") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  if (secret) {
    return authorization === `Bearer ${secret}` || cronSecretHeader === secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return userAgent.includes("vercel-cron/1.0");
}

function readBatchSize(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 10;

  return Math.max(1, Math.min(50, Math.round(parsed)));
}

function readBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

function readScanMode(value: string | null): ScanMode {
  if (value === "fast" || value === "broad" || value === "deep") {
    return value;
  }

  return "broad";
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const routeStartedAt = Date.now();

  if (!isAuthorizedCronRequest(request)) {
    return noStoreJson(
      {
        error: "Unauthorized cron request.",
        hint:
          "Set CRON_SECRET and send Authorization: Bearer <secret>, or run through Vercel Cron.",
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const scanMode = readScanMode(url.searchParams.get("scanMode"));
  const autonomousEmail = readBoolean(url.searchParams.get("email"), true);
  const aiResearch = readBoolean(url.searchParams.get("aiResearch"), true);

  const batchResult = await runAutonomousTriageBatch({
    batchSize: readBatchSize(url.searchParams.get("limit")),
    forceDemo: readBoolean(url.searchParams.get("demo"), false),
    autonomousEmail,
    aiResearch,
    triggeredBy: "cron",
    scanMode,
  });

  return noStoreJson({
    ok: true,
    route: "/api/cron/triage",
    purpose: "24/7 institutional U.S. investment opportunity and risk scanning",
    scanMode,
    autonomousEmail,
    aiResearch,
    integrations: getIntegrationStatuses(),
    routeDurationMs: Date.now() - routeStartedAt,
    batchDurationMs: batchResult.durationMs,
    ...batchResult,
  });
}

export async function POST(request: Request) {
  return GET(request);
}