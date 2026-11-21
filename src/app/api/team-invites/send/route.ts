import { apiJson, withApiRoute } from "@/lib/api-route";
import { loadTeamOverview, manageTeamInvitation, publicInvitationLookup } from "@/lib/team/invitations";
import { readTeamJson } from "@/lib/team/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = withApiRoute({ route: "/api/team-invites/send", cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
  const query = new URL(request.url).searchParams;
  const payload = query.has("code") ? await publicInvitationLookup(request, query.get("code"))
    : await loadTeamOverview(query.get("firmId") || undefined, query.get("q") || "");
  return apiJson(payload, { headers: { "Referrer-Policy": "no-referrer" } });
});
export const POST = withApiRoute({ route: "/api/team-invites/send", cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
  const input = await readTeamJson(request);
  return apiJson(await manageTeamInvitation(request, { ...input, delivery: input.delivery ?? "email" }));
});
