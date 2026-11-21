import { timingSafeEqual } from "node:crypto";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { scenarioTrackingEnabled } from "@/lib/research/beta-policy";
import { runScenarioSchedule } from "@/lib/connected-research/scenario-scheduler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withApiRoute({ route: "/api/cron/strategy-scenarios" }, async ({ request }) => {
  const secret = process.env.CRON_SECRET?.trim();
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(secret ? `Bearer ${secret}` : "");
  if (!secret || got.length !== expected.length || !timingSafeEqual(got, expected)) return apiJson({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (!scenarioTrackingEnabled(process.env)) return apiJson({ ok: true, skipped: true, reason: "Scheduled tracking is explicitly disabled. Saved observations remain available." });
  return apiJson({ ok: true, ...await runScenarioSchedule() });
});
