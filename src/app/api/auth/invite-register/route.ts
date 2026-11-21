import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api-route";
import { createSession, hashPassword, publicUser, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth";
import { accountHasMfa, verifyAccountSecondFactor } from "@/lib/account-security/service";
import { passwordProblem } from "@/lib/account-security/policy";
import { isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";
import { acceptTeamInvitation, invitationToken, lookupInvitation } from "@/lib/team/invitations";
import { guardTeamRate, readTeamJson, teamError, teamRequestIp } from "@/lib/team/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const POST = withApiRoute({ route: "/api/auth/invite-register", cacheControl: "private, no-store, max-age=0" }, async ({ request }) => {
  await guardTeamRate(request, "accept-ip", teamRequestIp(request), 30);
  const body = await readTeamJson(request);
  if (Object.keys(body).some(key => !["inviteCode", "name", "password", "factorCode"].includes(key))) throw teamError(400, "INVALID_INPUT", "The account request contains unsupported fields.");
  const code = invitationToken(body.inviteCode), invite = await lookupInvitation(code);
  await guardTeamRate(request, "accept-account", invite.email.toLowerCase(), 8);
  const authenticationStartedAt = new Date();
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 256) throw teamError(400, "PASSWORD_REQUIRED", "Enter the password for this account.");
  const existing = await prisma.user.findUnique({ where: { email: invite.email.toLowerCase() } });
  let mfaVerified = false;
  if (existing) {
    if (existing.platformStatus !== "Active" || !verifyPassword(password, existing.passwordHash)) throw teamError(401, "ACCOUNT_VERIFICATION_FAILED", "The account credentials could not be verified.");
    if (await accountHasMfa(existing.id)) {
      if (typeof body.factorCode !== "string" || !body.factorCode.trim()) throw teamError(401, "MFA_REQUIRED", "Enter your authenticator code or an unused recovery code.");
      mfaVerified = await verifyAccountSecondFactor(existing.id, body.factorCode);
      if (!mfaVerified) throw teamError(401, "MFA_INVALID", "The authenticator or recovery code could not be verified.");
    }
  } else {
    if (isFounderEmail(invite.email)) throw teamError(403, "RESERVED_ACCOUNT", "Founder accounts cannot be created through a team invitation.");
    const problem = passwordProblem(password);
    if (problem) throw teamError(400, "PASSWORD_REQUIREMENTS", problem);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!existing && (!name || name.length > 120 || /[\u0000-\u001f]/.test(name))) throw teamError(400, "NAME_REQUIRED", "Enter your name using 1 to 120 characters.");
  const joined = await acceptTeamInvitation({ code, request, ...(existing ? { userId: existing.id, expectedPasswordHash: existing.passwordHash } : { newAccount: { name, passwordHash: hashPassword(password) } }) });
  const session = await createSession(joined.user.id, { mfaVerified, request, authenticationStartedAt, expectedPasswordHash: existing?.passwordHash ?? joined.user.passwordHash });
  const response = NextResponse.json({ ok: true, user: publicUser(joined.user), firm: joined.firm, membership: { id: joined.membership.id, role: joined.membership.role }, message: "Your firm membership is ready." });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return response;
});
