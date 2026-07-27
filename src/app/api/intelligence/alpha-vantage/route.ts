import { NextResponse } from "next/server";

import {
  getAlphaVantageIntelligence,
  normalizeAlphaSymbol,
  normalizeIntradayInterval,
} from "@/lib/intelligence/alpha-vantage-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const symbol = normalizeAlphaSymbol(
      url.searchParams.get("symbol") || "MSFT",
    );
    const interval = normalizeIntradayInterval(
      url.searchParams.get("interval"),
    );
    const result = await getAlphaVantageIntelligence({
      symbol,
      interval,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: responseHeaders(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        schemaVersion: "slice-alpha-intelligence-3.0.0",
        ok: false,
        provider: "Alpha Vantage",
        retrievedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Alpha Vantage intelligence.",
      },
      {
        status: 400,
        headers: responseHeaders(),
      },
    );
  }
}