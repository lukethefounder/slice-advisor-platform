import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { requireAccountReauthentication, securityContext, securityJson } from "@/lib/account-security/service";
import { securityAuditData } from "@/lib/account-security/audit";
import { sessionLifetimeMinutes } from "@/lib/account-security/policy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const PATCH = withApiRoute({ route: "/api/security/settings", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true), body = await securityJson(request);
  const allowed = ["sessionTimeoutMinutes", "idleTimeoutMinutes", "currentPassword", "factorCode"];
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new ApiError({ status: 400, code: "SECURITY_SETTING_UNSUPPORTED", message: "Use verified authenticator setup for MFA. Sensitive-action verification cannot be disabled." });
  const lifetime = body.sessionTimeoutMinutes, idle = body.idleTimeoutMinutes;
  if (typeof lifetime !== "number" || !Number.isInteger(lifetime) || lifetime < 15 || lifetime > 43_200 || typeof idle !== "number" || !Number.isInteger(idle) || idle < 5 || idle > 1440 || idle > lifetime) throw new ApiError({ status: 422, code: "INVALID_SESSION_POLICY", message: "Choose a session lifetime from 15 to 43,200 minutes and an idle limit from 5 to 1,440 minutes, no longer than the session lifetime." });
  await requireAccountReauthentication(session.userId, body.currentPassword, body.factorCode, request);
  await prisma.$transaction(async tx => {
    await tx.userSecuritySetting.upsert({ where: { userId: session.userId }, create: { userId: session.userId, sessionTimeoutMinutes: lifetime, idleTimeoutMinutes: idle, requireReauthForSensitiveActions: true }, update: { sessionTimeoutMinutes: lifetime, idleTimeoutMinutes: idle, requireReauthForSensitiveActions: true } });
    await tx.auditLog.create({ data: securityAuditData(session.userId, "security.session_policy.updated", "Session expiration policy updated", request, `Maximum lifetime ${lifetime} minutes; idle limit ${idle} minutes. Existing sessions use the policy on their next authenticated request.`) });
  });
  return apiJson({ ok: true, effectiveSessionMinutes: sessionLifetimeMinutes(lifetime, process.env.SESSION_TTL_HOURS), message: "Session policy saved. Existing sessions use the new limits on their next request." });
});
