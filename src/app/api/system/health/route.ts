import { apiJson, withApiRoute } from "@/lib/api-route";
import { buildReadinessReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiRoute(
  {
    route: "/api/system/health",
    timeoutMs: 8_000,
    cacheControl: "no-store, max-age=0",
  },
  async ({ requestId }) => {
    const report = await buildReadinessReport(requestId);

    return apiJson(
      {
        ...report,
        // Compatibility fields used by the existing /system page.
        database:
          report.checks.database.state === "ok" ? "connected" : "error",
        timestamp: report.checkedAt,
      },
      {
        status: report.ok ? 200 : 503,
      },
    );
  },
);