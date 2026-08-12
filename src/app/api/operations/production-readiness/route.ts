import { apiJson, withApiRoute } from "@/lib/api-route";
import {
  hasFirmPermission,
  requireCurrentAccessContext,
} from "@/lib/access-control";
import { buildProductionReadinessReport } from "@/lib/production/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withApiRoute(
  {
    route: "/api/operations/production-readiness",
    timeoutMs: 28_000,
  },
  async () => {
    const context = await requireCurrentAccessContext({
      requireFirm: true,
    });

    if (!hasFirmPermission(context, "security.review")) {
      return apiJson(
        {
          error:
            "Founder, firm-management, or security-review access is required.",
        },
        { status: 403 },
      );
    }

    const report = await buildProductionReadinessReport({
      firmId: context.firm?.id ?? null,
    });

    return apiJson({
      ...report,
      access: {
        userId: context.user.id,
        firmId: context.firm?.id ?? null,
        firmName: context.firm?.name ?? null,
        role: context.membership?.role ?? "Founder",
      },
    });
  },
);