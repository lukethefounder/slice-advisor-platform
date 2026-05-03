import { DEMO_SLICE_PROFILE, scanFreeSources } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await scanFreeSources(DEMO_SLICE_PROFILE);

    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "Slice intelligence scan failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}