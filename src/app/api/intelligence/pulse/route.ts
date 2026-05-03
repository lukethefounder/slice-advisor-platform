import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateOpportunitySignals, getOpportunityRadar } from "@/lib/opportunity-engine";
import {
  processQueuedDeliveries,
  queueNotificationDeliveries,
} from "@/lib/notification-engine";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const demo = url.searchParams.get("demo") === "1";
  const origin = url.origin;
  const cookie = request.headers.get("cookie") ?? "";

  const triageResponse = await fetch(
    `${origin}/api/intelligence/triage/run${demo ? "?demo=1" : ""}`,
    {
      method: "POST",
      headers: {
        cookie,
      },
    }
  );

  const triage = await triageResponse.json();

  if (!triageResponse.ok) {
    return NextResponse.json(
      {
        error: "Triage pulse failed.",
        detail: triage,
      },
      { status: 500 }
    );
  }

  const opportunities = await generateOpportunitySignals(user.id);
  const queued = await queueNotificationDeliveries(user.id);
  const processed = await processQueuedDeliveries(user.id);
  const radar = await getOpportunityRadar(user.id);

  return NextResponse.json({
    ok: true,
    mode: demo ? "demo-pulse" : "live-pulse",
    triage,
    opportunities: {
      scanned: opportunities.scanned,
      created: opportunities.created,
      updated: opportunities.updated,
      skipped: opportunities.skipped,
    },
    notifications: {
      queued,
      processed,
    },
    radarStats: radar.stats,
    topSignals: radar.signals.slice(0, 8),
    timestamp: new Date().toISOString(),
  });
}