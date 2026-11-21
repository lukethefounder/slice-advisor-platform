import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAccountReauthentication, securityContext, securityJson } from "@/lib/account-security/service";
import { securityAuditData } from "@/lib/account-security/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiRoute({ route: "/api/security/sessions", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true), body = await securityJson(request);
  const action = body.action;
  if (!["revoke", "revoke-others", "revoke-all"].includes(String(action))) throw new ApiError({ status: 400, code: "INVALID_ACTION", message: "Choose which sessions to sign out." });
  if (action === "revoke" && (typeof body.sessionId !== "string" || body.sessionId.length > 120)) throw new ApiError({ status: 400, code: "INVALID_SESSION", message: "Choose a session from this account." });
  await requireAccountReauthentication(session.userId, body.currentPassword, body.factorCode, request);
  const result = await prisma.$transaction(async tx => {
    const revoked = await tx.session.deleteMany({ where: { userId: session.userId, ...(action === "revoke" ? { id: body.sessionId as string } : action === "revoke-others" ? { id: { not: session.id } } : {}) } });
    if (action === "revoke" && revoked.count === 0) throw new ApiError({ status: 404, code: "SESSION_NOT_FOUND", message: "This session is no longer active or does not belong to your account." });
    await tx.auditLog.create({ data: securityAuditData(session.userId, "security.sessions.revoked", "Browser sessions signed out", request, `${revoked.count} account session(s) revoked.`) });
    return revoked;
  });
  const signedOut = action === "revoke-all" || (action === "revoke" && body.sessionId === session.id);
  if (signedOut) {
    const response = NextResponse.json({ ok: true, signedOut: true, revoked: result.count, message: "Sessions signed out. Sign in again to continue." });
    response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions()); return response;
  }
  return apiJson({ ok: true, revoked: result.count, message: `${result.count} other session(s) signed out.` });
});
