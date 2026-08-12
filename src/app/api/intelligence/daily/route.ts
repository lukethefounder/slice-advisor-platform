import { NextResponse } from "next/server";

import { getPublicIntelligence } from "@/lib/public-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function readLimit(value: string | null) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(160, Math.round(parsed)))
    : 100;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = readLimit(url.searchParams.get("limit"));
    const snapshot = await getPublicIntelligence({
      maxAgeMs: 6 * 60 * 60_000,
    });
    const items = snapshot.items.slice(0, limit);

    return NextResponse.json(
      {
        ...snapshot,
        items,
        alertCandidates: items.filter((item) => item.shouldAlert),
        digestCandidates: items.filter(
          (item) => !item.shouldAlert && item.score >= 55,
        ),
        suppressed: items.filter((item) => item.score < 55),
        servedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=900, max-age=60",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "X-Slice-Intelligence-Storage": snapshot.storage,
          "X-Slice-Intelligence-Feed": "public-daily-v2",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        schemaVersion: "slice-public-intelligence-2.0.0",
        ok: false,
        generatedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Slice daily intelligence is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}