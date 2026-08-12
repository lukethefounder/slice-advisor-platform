import { timingSafeEqual } from "node:crypto";

import { apiJson, withApiRoute } from "@/lib/api-route";
import { runProductionMaintenance } from "@/lib/production/maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: Request) {
  const expected = String(process.env.CRON_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  const candidate = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  return Boolean(expected && candidate && safeEqual(candidate, expected));
}

export const GET = withApiRoute(
  {
    route: "/api/cron/maintenance",
    timeoutMs: 55_000,
  },
  async ({ request }) => {
    if (!authorized(request)) {
      return apiJson({ error: "Unauthorized." }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsedBatch = Number(url.searchParams.get("batch"));
    const batchSize = Number.isInteger(parsedBatch)
      ? Math.max(100, Math.min(10_000, parsedBatch))
      : undefined;
    const result = await runProductionMaintenance({ batchSize });

    return apiJson({ ok: true, result });
  },
);