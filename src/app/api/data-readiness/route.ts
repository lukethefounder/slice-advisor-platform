import { apiJson, withApiRoute } from "@/lib/api-route";
import { strategyAccess } from "@/lib/strategy-lab/http";
import { readDataReadiness } from "@/lib/data-readiness/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = withApiRoute({ route: "/api/data-readiness", timeoutMs: 12000, cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
 await strategyAccess(request, false);
 return apiJson({ ok: true, readiness: await readDataReadiness() });
});
