import { apiJson, withApiRoute } from "@/lib/api-route";
import { loadTeamOverview, manageTeamInvitation } from "@/lib/team/invitations";
import { readTeamJson } from "@/lib/team/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = withApiRoute({ route: "/api/team-invites", cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
  const query = new URL(request.url).searchParams;
  return apiJson(await loadTeamOverview(query.get("firmId") || undefined, query.get("q") || ""));
});
export const POST = withApiRoute({ route: "/api/team-invites", cacheControl: "private, no-store, max-age=0" }, async ({ request }) =>
  apiJson(await manageTeamInvitation(request, await readTeamJson(request))));
