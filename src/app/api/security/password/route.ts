import { NextResponse } from "next/server";
import { ApiError, withApiRoute } from "@/lib/api-route";
import { clearSessionCookieOptions, hashPassword, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordProblem } from "@/lib/account-security/policy";
import { requireAccountReauthentication, securityContext, securityJson } from "@/lib/account-security/service";
import { securityAuditData } from "@/lib/account-security/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiRoute({ route: "/api/security/password", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true), body = await securityJson(request);
  const problem = passwordProblem(body.newPassword);
  if (problem) throw new ApiError({ status: 422, code: "PASSWORD_POLICY", message: problem });
  await requireAccountReauthentication(session.userId, body.currentPassword, body.factorCode, request);
  const password = body.newPassword as string;
  if (verifyPassword(password, session.user.passwordHash)) throw new ApiError({ status: 422, code: "PASSWORD_UNCHANGED", message: "Choose a password different from your current password." });
  const passwordHash = hashPassword(password);
  await prisma.$transaction(async tx => {
    const changed = await tx.user.updateMany({ where: { id: session.userId, passwordHash: session.user.passwordHash, platformStatus: "Active" }, data: { passwordHash } });
    if (changed.count !== 1) throw new ApiError({ status: 409, code: "ACCOUNT_CHANGED", message: "Account credentials changed during this request. Sign in again and retry." });
    await tx.session.deleteMany({ where: { userId: session.userId } });
    await tx.auditLog.create({ data: securityAuditData(session.userId, "security.password.changed", "Password changed and sessions revoked", request, "The current password and enrolled second factor were verified. All browser sessions were signed out.") });
  });
  const response = NextResponse.json({ ok: true, signedOut: true, message: "Password changed. All sessions are signed out; sign in with your new password." });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions()); return response;
});
