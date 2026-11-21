import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { acceptAllDisclosures, acceptDisclosure, getDisclosureStatus, REQUIRED_DISCLOSURES } from "@/lib/audit";
import { securityContext, securityJson, securityRateLimit } from "@/lib/account-security/service";
export const GET = withApiRoute({ route: "/api/security/disclosures", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request); return apiJson({ disclosures: await getDisclosureStatus(session.user) });
});
export const POST = withApiRoute({ route: "/api/security/disclosures", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true), body = await securityJson(request);
  await securityRateLimit(session.userId, request, "account.security.disclosures");
  if (body.acceptAll === true) return apiJson({ ok: true, accepted: await acceptAllDisclosures(session.user) });
  if (typeof body.disclosureKey !== "string" || !REQUIRED_DISCLOSURES.some(item => item.disclosureKey === body.disclosureKey)) throw new ApiError({ status: 400, code: "DISCLOSURE_NOT_FOUND", message: "Select a current disclosure to acknowledge." });
  return apiJson({ ok: true, accepted: await acceptDisclosure(session.user, body.disclosureKey) });
});
