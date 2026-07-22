import { getCurrentUser } from "@/lib/auth";
import { getAlphaVantageRealtimeSnapshots } from "@/lib/alpha-vantage-realtime";
import {
  getRealtimeMarketSnapshots,
  persistRealtimeSnapshots,
} from "@/lib/realtime-market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanProvider(value: string | null) {
  const provider = String(value ?? "alphavantage")
    .trim()
    .toLowerCase();

  return provider === "auto" ? "auto" : "alphavantage";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbols = url.searchParams.get("symbols");
    const provider = cleanProvider(url.searchParams.get("provider"));
    const strictProvider = url.searchParams.get("strict") !== "false";
    const shouldPersist = url.searchParams.get("persist") !== "false";

    const user = await getCurrentUser().catch(() => null);

    const result =
      provider === "alphavantage"
        ? await getAlphaVantageRealtimeSnapshots(symbols)
        : await getRealtimeMarketSnapshots(symbols);

    if (strictProvider && provider === "alphavantage") {
      const nonAlpha = result.snapshots.filter(
        (snapshot) => snapshot.provider !== "Alpha Vantage"
      );

      if (nonAlpha.length) {
        throw new Error(
          `Strict Alpha Vantage mode rejected non-Alpha snapshots: ${nonAlpha
            .map((snapshot) => snapshot.symbol)
            .join(", ")}.`
        );
      }
    }

    if (user && shouldPersist && result.snapshots.length) {
      await persistRealtimeSnapshots(user.id, result.snapshots).catch(() => {
        // Real-time display should not fail because optional history persistence failed.
      });
    }

    return Response.json(
      {
        ...result,
        providerMode: provider,
        strictProvider,
        authenticated: Boolean(user),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Slice-Market-Provider":
            provider === "alphavantage" ? "Alpha-Vantage" : "Auto",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown market engine error.";

    const missingKey = message.includes("ALPHA_VANTAGE_API_KEY");

    return Response.json(
      {
        error: "Slice real-time market engine failed.",
        detail: message,
        providerMode: "alphavantage",
      },
      {
        status: missingKey ? 503 : 502,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Slice-Market-Provider": "Alpha-Vantage",
        },
      }
    );
  }
}