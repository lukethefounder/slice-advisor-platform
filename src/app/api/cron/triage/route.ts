import { NextResponse } from "next/server";
import { runAutonomousTriageBatch } from "@/lib/autonomous-triage";
import { getIntegrationStatuses } from "@/lib/env";
import type { ScanMode } from "@/lib/investment-grading-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Slice-Cron-Route", "triage-v2");
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

  if (isVercelCronRequest(request)) {
    return true;
  }

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
  if (value === "fast" || value === "broad" || value === "deep") {
    return value;
  }

  return "broad";
}

function readUserId(value: string | null) {
  const clean = String(value ?? "").trim();
  return clean || null;
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
  const targetUserId = readUserId(url.searchParams.get("userId"));
  const batchSize = readBatchSize(url.searchParams.get("limit"));

  const batchResult = await runAutonomousTriageBatch({
    batchSize,
    forceDemo,
    autonomousEmail,
    aiResearch,
    triggeredBy: isVercelCronRequest(request) ? "cron" : "system",
    scanMode,
    targetUserId,
  });

  return noStoreJson({
    ok: true,
    route: "/api/cron/triage",
    version: "autonomous-triage-v2",
    purpose:
      "Continuous advisor-specific U.S. investment intelligence scanning with automatic source-backed email delivery.",
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
    integrations: getIntegrationStatuses(),
    routeDurationMs: Date.now() - routeStartedAt,
    batchDurationMs: batchResult.durationMs,
    ...batchResult,
  });
}

export async function POST(request: Request) {
  return GET(request);
}