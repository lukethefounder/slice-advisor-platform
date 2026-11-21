import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { securityAuditData } from "@/lib/account-security/audit";
import { requireAccountReauthentication, securityContext, securityJson } from "@/lib/account-security/service";
import { createAuthenticatorSecret, createRecoveryCodes, decryptAuthenticatorSecret, encryptAuthenticatorSecret, matchingTotpStep } from "@/lib/account-security/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withApiRoute({ route: "/api/security/mfa", cacheControl: "private, no-store" }, async ({ request }) => {
  const session = await securityContext(request, true), body = await securityJson(request), userId = session.userId;
  if (!["begin", "confirm", "cancel", "disable", "recovery"].includes(String(body.action))) throw new ApiError({ status: 400, code: "INVALID_ACTION", message: "Choose an authenticator action." });
  await requireAccountReauthentication(userId, body.currentPassword, body.factorCode, request);
  const existing = await prisma.userAuthenticator.findUnique({ where: { userId } });

  if (body.action === "begin") {
    if (existing?.enabledAt) throw new ApiError({ status: 409, code: "MFA_ALREADY_ENABLED", message: "Your authenticator is already enabled. Disable it with verification before replacing it." });
    const secret = createAuthenticatorSecret(), encrypted = encryptAuthenticatorSecret(secret, userId), pendingExpiresAt = new Date(Date.now() + 10 * 60_000);
    await prisma.$transaction(async tx => {
      await tx.userAuthenticator.upsert({ where: { userId }, create: { userId, pendingSecretEncrypted: encrypted, pendingExpiresAt }, update: { pendingSecretEncrypted: encrypted, pendingExpiresAt } });
      await tx.auditLog.create({ data: securityAuditData(userId, "security.mfa.setup_started", "Authenticator setup started", request) });
    });
    const issuer = "Slice", label = `${issuer}:${session.user.email}`;
    return apiJson({ ok: true, secret, uri: `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`, expiresAt: pendingExpiresAt.toISOString(), message: "Add this setup key to your authenticator app, then confirm its current code. MFA stays off until confirmation succeeds." });
  }

  if (body.action === "confirm") {
    if (existing?.enabledAt || !existing?.pendingSecretEncrypted || !existing.pendingExpiresAt || existing.pendingExpiresAt.getTime() <= Date.now()) throw new ApiError({ status: 409, code: "MFA_SETUP_EXPIRED", message: "Start a new authenticator setup before confirming." });
    const step = matchingTotpStep(decryptAuthenticatorSecret(existing.pendingSecretEncrypted, userId), body.factorCode);
    if (step === null) throw new ApiError({ status: 422, code: "MFA_CODE_INVALID", message: "The authenticator code was not accepted. Check the app's current code and your device clock." });
    const { codes, hashes } = createRecoveryCodes(userId), enabledAt = new Date();
    await prisma.$transaction(async tx => {
      const activated = await tx.userAuthenticator.updateMany({ where: { id: existing.id, userId, enabledAt: null, pendingSecretEncrypted: existing.pendingSecretEncrypted, pendingExpiresAt: { gt: enabledAt } }, data: { enabledAt, secretEncrypted: existing.pendingSecretEncrypted, pendingSecretEncrypted: null, pendingExpiresAt: null, lastUsedStep: step, recoveryCodeHashesJson: JSON.stringify(hashes) } });
      if (activated.count !== 1) throw new ApiError({ status: 409, code: "MFA_SETUP_CHANGED", message: "Authenticator setup changed. Reload and retry." });
      await tx.userSecuritySetting.upsert({ where: { userId }, create: { userId, mfaEnabled: true }, update: { mfaEnabled: true } });
      const current = await tx.session.updateMany({ where: { id: session.id, userId, expiresAt: { gt: enabledAt } }, data: { mfaVerifiedAt: enabledAt } });
      if (current.count !== 1) throw new ApiError({ status: 401, code: "SESSION_REVOKED", message: "This session ended. Sign in again before enabling MFA." });
      await tx.session.deleteMany({ where: { userId, id: { not: session.id } } });
      await tx.auditLog.create({ data: securityAuditData(userId, "security.mfa.enabled", "Authenticator protection enabled", request, "The authenticator challenge passed. Other browser sessions were revoked and one-use recovery codes were issued.") });
    });
    return apiJson({ ok: true, recoveryCodes: codes, message: "Authenticator enabled. Save these recovery codes now; they are shown only once. Other sessions were signed out." });
  }

  if (body.action === "cancel") {
    await prisma.$transaction(async tx => {
      await tx.userAuthenticator.updateMany({ where: { userId, enabledAt: null }, data: { pendingSecretEncrypted: null, pendingExpiresAt: null } });
      await tx.auditLog.create({ data: securityAuditData(userId, "security.mfa.setup_cancelled", "Pending authenticator setup cancelled", request) });
    });
    return apiJson({ ok: true, message: "Pending setup removed. Authenticator protection is unchanged." });
  }
  if (!existing?.enabledAt) throw new ApiError({ status: 409, code: "MFA_NOT_ENABLED", message: "No authenticator is currently enabled." });
  if (body.action === "recovery") {
    const { codes, hashes } = createRecoveryCodes(userId);
    await prisma.$transaction(async tx => {
      const updated = await tx.userAuthenticator.updateMany({ where: { userId, enabledAt: existing.enabledAt, secretEncrypted: existing.secretEncrypted, recoveryCodeHashesJson: existing.recoveryCodeHashesJson }, data: { recoveryCodeHashesJson: JSON.stringify(hashes) } });
      if (updated.count !== 1) throw new ApiError({ status: 409, code: "MFA_CHANGED", message: "Authenticator settings changed. Reload and retry." });
      await tx.auditLog.create({ data: securityAuditData(userId, "security.mfa.recovery_replaced", "Recovery codes replaced", request, "Previous recovery codes were invalidated.") });
    });
    return apiJson({ ok: true, recoveryCodes: codes, message: "New recovery codes are ready. All previous recovery codes are invalid." });
  }
  await prisma.$transaction(async tx => {
    const removed = await tx.userAuthenticator.updateMany({ where: { userId, enabledAt: existing.enabledAt, secretEncrypted: existing.secretEncrypted }, data: { enabledAt: null, secretEncrypted: null, pendingSecretEncrypted: null, pendingExpiresAt: null, lastUsedStep: null, recoveryCodeHashesJson: "[]" } });
    if (removed.count !== 1) throw new ApiError({ status: 409, code: "MFA_CHANGED", message: "Authenticator settings changed. Reload and retry." });
    await tx.userSecuritySetting.updateMany({ where: { userId }, data: { mfaEnabled: false } });
    await tx.session.deleteMany({ where: { userId, id: { not: session.id } } });
    await tx.auditLog.create({ data: securityAuditData(userId, "security.mfa.disabled", "Authenticator protection disabled", request, "A verified password and existing second factor authorized the change. Other sessions were revoked.", "High") });
  });
  return apiJson({ ok: true, message: "Authenticator disabled. Other sessions were signed out." });
});
