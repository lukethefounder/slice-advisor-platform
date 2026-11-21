import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security";
import { securityContext, securityRateLimit } from "@/lib/account-security/service";
import { securityOverview } from "@/lib/account-security/overview";
export const POST = withApiRoute({ route: "/api/security/review", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true);
  await securityRateLimit(session.userId, request, "account.security.review");
  const view = await securityOverview(session.user, session.id);
  const warnings = view.checks.filter(check => check.state !== "protected").map(check => `${check.label}: ${check.detail}`);
  await prisma.userSecuritySetting.update({ where: { userId: session.userId }, data: { lastSecurityReviewAt: new Date() } });
  await recordSecurityEvent({ userId: session.userId, eventType: "security.review.completed", severity: warnings.length ? "Medium" : "Info", title: "Account protection review completed", detail: "This review checks configured account controls. It is not a penetration test, certification, or compliance opinion.", metadata: { attentionItems: warnings.length, activeSessions: view.sessions.length }, request });
  return apiJson({ ok: true, warnings, message: warnings.length ? `${warnings.length} configuration item(s) need attention.` : "The checked account controls are configured. Deployment and operational reviews remain separate." });
});
