import { timingSafeEqual } from "node:crypto";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { runAgentDeskSchedule } from "@/lib/agent-desk/scheduler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/cron/agent-desk" }, async ({ request }) => {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = Buffer.from(request.headers.get("authorization") ?? ""), expected = Buffer.from(secret ? `Bearer ${secret}` : "");
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return apiJson({ ok: false, error: "Unauthorized." }, { status: 401 });
  return apiJson({ ok: true, ...await runAgentDeskSchedule() });
});
