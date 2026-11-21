import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api-route";
import { getCurrentSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashForSecurity, recordSecurityEvent } from "@/lib/security";
import { decryptAuthenticatorSecret, matchingTotpStep, parseRecoveryHashes, recoveryCodeHash } from "./crypto";
import { withSecuritySchema } from "./schema";

export async function accountHasMfa(userId: string): Promise<boolean> {
  return Boolean((await withSecuritySchema(prisma.userAuthenticator.findUnique({ where: { userId }, select: { enabledAt: true } })))?.enabledAt);
}

/** Atomically consumes a single TOTP time step or high-entropy recovery code. */
export async function verifyAccountSecondFactor(userId: string, code: unknown): Promise<boolean> {
  if (typeof code !== "string" || code.length > 80) return false;
  const record = await withSecuritySchema(prisma.userAuthenticator.findUnique({ where: { userId } }));
  if (!record?.enabledAt || !record.secretEncrypted) return false;
  const normalized = code.trim();
  if (/^\d{6}$/.test(normalized)) {
    const secret = decryptAuthenticatorSecret(record.secretEncrypted, userId);
    const step = matchingTotpStep(secret, normalized, Date.now(), record.lastUsedStep);
    if (step === null) return false;
    const used = await prisma.userAuthenticator.updateMany({
      where: { id: record.id, userId, enabledAt: record.enabledAt, secretEncrypted: record.secretEncrypted, lastUsedStep: record.lastUsedStep },
      data: { lastUsedStep: step },
    });
    return used.count === 1;
  }
  if (!/^[A-Fa-f0-9\s-]{24,40}$/.test(normalized) || normalized.replace(/[\s-]/g, "").length !== 24) return false;
  const digest = recoveryCodeHash(normalized, userId), hashes = parseRecoveryHashes(record.recoveryCodeHashesJson);
  const match = hashes.findIndex(hash => timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(digest, "hex")));
  if (match < 0) return false;
  hashes.splice(match, 1);
  const used = await prisma.userAuthenticator.updateMany({
    where: { id: record.id, userId, enabledAt: record.enabledAt, recoveryCodeHashesJson: record.recoveryCodeHashesJson },
    data: { recoveryCodeHashesJson: JSON.stringify(hashes) },
  });
  return used.count === 1;
}

export async function securityRateLimit(userId: string, request: Request, scope = "account.security.change") {
  const limits = await Promise.all([
    consumeRateLimit({ key: userId, scope, limit: 12, windowMs: 15 * 60_000, failOpen: false }),
    consumeRateLimit({ key: hashForSecurity(getClientIp(request)), scope: `${scope}.ip`, limit: 40, windowMs: 15 * 60_000, failOpen: false }),
  ]);
  const blocked = limits.find(limit => !limit.allowed);
  if (blocked) throw new ApiError({ status: 429, code: "SECURITY_RATE_LIMIT", message: "Too many security verification attempts. Try again after the cooldown.", details: { retryAfterSeconds: blocked.retryAfterSeconds } });
}

export async function requireAccountReauthentication(userId: string, currentPassword: unknown, factorCode: unknown, request: Request): Promise<void> {
  await securityRateLimit(userId, request, "account.security.reauthenticate");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, platformStatus: true } });
  const validPassword = user && user.platformStatus === "Active" && typeof currentPassword === "string" && currentPassword.length <= 256 && verifyPassword(currentPassword, user.passwordHash);
  if (!validPassword) {
    await recordSecurityEvent({ userId, eventType: "security.reauthentication.failed", severity: "Medium", title: "Sensitive action verification failed", request });
    throw new ApiError({ status: 401, code: "REAUTHENTICATION_FAILED", message: "The current password could not be verified." });
  }
  if (await accountHasMfa(userId) && !await verifyAccountSecondFactor(userId, factorCode)) {
    await recordSecurityEvent({ userId, eventType: "security.factor.failed", severity: "High", title: "Second-factor verification failed", request });
    throw new ApiError({ status: 401, code: "MFA_REQUIRED", message: "Enter a fresh authenticator code or an unused recovery code." });
  }
}

export async function securityContext(request: Request, mutation = false) {
  if (mutation) requireSecurityOrigin(request);
  const session = await getCurrentSession();
  if (!session) throw new ApiError({ status: 401, code: "AUTHENTICATION_REQUIRED", message: "Sign in to manage account security." });
  return session;
}

export function requireSecurityOrigin(request: Request) {
  const expected = new URL(request.url).origin, origin = request.headers.get("origin"), referrer = request.headers.get("referer"), site = request.headers.get("sec-fetch-site");
  try {
    if (site === "cross-site" || (origin && new URL(origin).origin !== expected) || (!origin && referrer && new URL(referrer).origin !== expected) || (!origin && !referrer && site !== "same-origin")) throw new Error("origin");
  } catch { throw new ApiError({ status: 403, code: "CROSS_SITE_REQUEST", message: "Security check failed. Open Slice directly and try again." }); }
}

export async function securityJson(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) throw new ApiError({ status: 415, code: "JSON_REQUIRED", message: "Send a JSON request." });
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192) throw new ApiError({ status: 413, code: "BODY_TOO_LARGE", message: "The security request is too large." });
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError({ status: 400, code: "BODY_REQUIRED", message: "The security request must include an object." });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ApiError({ status: 413, code: "BODY_TOO_LARGE", message: "The security request is too large." }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new ApiError({ status: 400, code: "INVALID_JSON", message: "The security request was not valid JSON." }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError({ status: 400, code: "INVALID_BODY", message: "The security request must be an object." });
  return body as Record<string, unknown>;
}
