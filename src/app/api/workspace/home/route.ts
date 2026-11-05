import { studioAccess, failure, PRIVATE_HEADERS } from "@/lib/studio/request";
import { readHomeSummary } from "@/lib/instant-workspace/home-summary";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  try { const scope = await studioAccess(request), body = await readHomeSummary(scope); return Response.json(body, { headers: { ...PRIVATE_HEADERS, "Server-Timing": `summary;dur=${body.elapsedMs}` } }); }
  catch (e) { return failure(e); }
}
