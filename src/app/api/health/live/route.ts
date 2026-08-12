import { apiJson, withApiRoute } from "@/lib/api-route";
import { buildLivenessReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiRoute(
  {
    route: "/api/health/live",
    timeoutMs: 2_000,
    cacheControl: "no-store, max-age=0",
  },
  async ({ requestId }) => apiJson(buildLivenessReport(requestId)),
);