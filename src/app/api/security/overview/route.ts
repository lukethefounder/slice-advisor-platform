import { apiJson, withApiRoute } from "@/lib/api-route";
import { securityContext } from "@/lib/account-security/service";
import { securityOverview } from "@/lib/account-security/overview";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = withApiRoute({ route: "/api/security/overview", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request);
  return apiJson(await securityOverview(session.user, session.id));
});
