import { apiJson, withApiRoute } from "@/lib/api-route";
import {
  buildReadinessReport,
  healthDiagnosticsAuthorized,
} from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiRoute(
  {
    route: "/api/health/ready",
    timeoutMs: 8_000,
    cacheControl: "no-store, max-age=0",
  },
  async ({ request, requestId }) => {
    const report = await buildReadinessReport(requestId, {
      includeDiagnostics: healthDiagnosticsAuthorized(request),
    });

    return apiJson(report, {
      status: report.ok ? 200 : 503,
    });
  },
);