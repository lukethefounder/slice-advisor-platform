import "server-only";

import { NextResponse } from "next/server";

import { scoutAndPersistPublicIntelligence } from "@/lib/public-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "X-Slice-Cron-Route",
    "public-daily-intelligence-v2",
  );
  return response;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "Unauthorized cron request.",
        detail:
          "Configure CRON_SECRET and send it as Authorization: Bearer <secret>.",
      },
      { status: 401 },
    );
  }

  try {
    const { snapshot, persistence } =
      await scoutAndPersistPublicIntelligence();
    const onlineSources = snapshot.sources.filter((source) => source.ok).length;

    return json({
      ok: true,
      route: "/api/cron/intelligence-daily",
      purpose:
        "Scout, rank, deduplicate, connect, and persist the public Slice intelligence edition.",
      generatedAt: snapshot.generatedAt,
      dateKey: snapshot.dateKey,
      articleCount: snapshot.items.length,
      alertCount: snapshot.alertCandidates.length,
      digestCount: snapshot.digestCandidates.length,
      onlineSourceCount: onlineSources,
      sourceCount: snapshot.sources.length,
      topTopics: snapshot.topicCounts.slice(0, 12),
      warnings: snapshot.warnings,
      persistence,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        route: "/api/cron/intelligence-daily",
        error:
          error instanceof Error
            ? error.message
            : "The daily public intelligence scan failed.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}