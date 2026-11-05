import { apiJson, withApiRoute } from "@/lib/api-route";
import { studioAccess } from "@/lib/studio/request";
import { researchBetaSummary } from "@/lib/research/beta-policy";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/research/beta-status", timeoutMs: 10000 }, async ({ request }) => {
  await studioAccess(request);
  return apiJson({ ok: true, policy: researchBetaSummary(process.env) }, { headers: { "Cache-Control": "private, no-store" } });
});
