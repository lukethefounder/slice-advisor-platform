import { getCurrentUser } from "@/lib/auth";
import {
  buildProfileForUser,
  DEMO_SLICE_PROFILE,
  getAdvisorSourcesForScan,
  persistIntelligenceResult,
  scanPermittedSources,
} from "@/lib/intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);

    const profile = user ? await buildProfileForUser(user.id) : DEMO_SLICE_PROFILE;
    const advisorSources = user ? await getAdvisorSourcesForScan(user.id) : [];

    const result = await scanPermittedSources(profile, advisorSources);

    if (user) {
      await persistIntelligenceResult(user.id, result).catch(() => {
        // Display should not fail just because persistence failed.
      });
    }

    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Slice intelligence scan failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
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