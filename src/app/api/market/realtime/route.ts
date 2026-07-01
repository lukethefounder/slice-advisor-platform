import { getCurrentUser } from "@/lib/auth";
import {
  getRealtimeMarketSnapshots,
  persistRealtimeSnapshots,
} from "@/lib/realtime-market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbols = url.searchParams.get("symbols");
    const shouldPersist = url.searchParams.get("persist") !== "false";

    const user = await getCurrentUser().catch(() => null);
    const result = await getRealtimeMarketSnapshots(symbols);

    if (user && shouldPersist) {
      await persistRealtimeSnapshots(user.id, result.snapshots).catch(() => {
        // Market display should not fail just because history persistence failed.
      });
    }

    return Response.json(
      {
        ...result,
        authenticated: Boolean(user),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Slice real-time market engine failed.",
        detail: error instanceof Error ? error.message : "Unknown market engine error.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}