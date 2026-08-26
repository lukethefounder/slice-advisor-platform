import {
  getPublicMarketSummary,
  publicMarketEntitlement,
  PublicMarketSummaryError,
} from "@/lib/public-market-summary";
import type { PublicMarketSummaryFailure } from "@/lib/public-market-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const SUCCESS_CACHE_CONTROL =
  "public, s-maxage=15, stale-while-revalidate=120, max-age=5";

function commonHeaders(cacheControl: string) {
  return {
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Slice-Market-Provider": "Alpha-Vantage",
  };
}

export async function GET() {
  try {
    const summary = await getPublicMarketSummary();

    return Response.json(summary, {
      status: 200,
      headers: {
        ...commonHeaders(SUCCESS_CACHE_CONTROL),
        "X-Slice-Market-Cache": summary.cacheStatus,
        "X-Slice-Market-Entitlement": summary.entitlement,
      },
    });
  } catch (error) {
    const known = error instanceof PublicMarketSummaryError;
    const code = known ? error.code : "MARKET_SUMMARY_FAILED";
    const missing = code === "ALPHA_VANTAGE_NOT_CONFIGURED";
    const payload: PublicMarketSummaryFailure = {
      schemaVersion: "slice-public-market-summary-1.0.0",
      ok: false,
      provider: "Alpha Vantage",
      keyStatus: missing ? "missing" : "unverified",
      entitlement: publicMarketEntitlement(),
      generatedAt: new Date().toISOString(),
      code,
      message:
        error instanceof Error
          ? error.message
          : "The public market summary is temporarily unavailable.",
    };

    return Response.json(payload, {
      status: missing ? 503 : 502,
      headers: commonHeaders("no-store, max-age=0"),
    });
  }
}