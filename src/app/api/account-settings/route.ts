import { NextResponse } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE, getCurrentUser } from "@/lib/auth";
import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { accountHasMfa, requireAccountReauthentication } from "@/lib/account-security/service";
import { checkRateLimit, getClientIp, hashForSecurity, recordSecurityEvent } from "@/lib/security";
import {
  DEFAULT_NOTIFICATIONS, NOTIFICATION_CHANNELS, SettingsValidationError, exactFields,
  object, readAccountPreferences, validateAppearance, validateNotifications, validateProfile,
} from "@/lib/account-settings/contracts";
import type { AccountSettingsResponse, NotificationPreference } from "@/lib/account-settings/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MEMORY_KEY = "account.settings";
const MAX_BODY_BYTES = 24_576;

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

async function loadSettings(user: User): Promise<AccountSettingsResponse> {
  const [memory, security, enrolled, notifications, memberships, deliveries] = await Promise.all([
    prisma.personalUserBotMemory.findUnique({ where: { userId_memoryKey: { userId: user.id, memoryKey: MEMORY_KEY } }, select: { value: true, updatedAt: true } }),
    prisma.userSecuritySetting.findUnique({ where: { userId: user.id }, select: { sessionTimeoutMinutes: true, lastSecurityReviewAt: true } }),
    accountHasMfa(user.id),
    prisma.notificationPreference.findMany({ where: { userId: user.id, channel: { in: [...NOTIFICATION_CHANNELS] } }, orderBy: { channel: "asc" } }),
    prisma.firmMembership.findMany({ where: { userId: user.id, status: "Active" }, select: { id: true, role: true, firm: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 50 }),
    prisma.notificationDelivery.findMany({ where: { userId: user.id }, select: { id: true, channel: true, status: true, simulated: true, createdAt: true, deliveredAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const meta = readAccountPreferences(memory?.value);
  const normalized = DEFAULT_NOTIFICATIONS.map(fallback => {
    const row = notifications.find(item => item.channel === fallback.channel);
    if (!row) return { ...fallback };
    // Saved legacy records are normalized for display; no credentials or destinations are returned.
    return { channel: fallback.channel, enabled: row.enabled, minUrgency: ["Low", "Medium", "High", "Critical"].includes(row.minUrgency) ? row.minUrgency as NotificationPreference["minUrgency"] : fallback.minUrgency,
      minScore: Math.min(100, Math.max(0, row.minScore)), digestOnly: row.digestOnly,
      quietHoursStart: row.quietHoursStart, quietHoursEnd: row.quietHoursEnd, cooldownMinutes: Math.min(1440, Math.max(0, row.cooldownMinutes)) };
  });
  return { ok: true,
    account: { id: user.id, name: user.name, email: user.email, phone: meta.phone, timezone: meta.timezone, platformStatus: user.platformStatus, createdAt: user.createdAt.toISOString() },
    appearance: meta.appearance, privacy: meta.privacy, notifications: normalized,
    security: { mfaEnabled: enrolled, sessionTimeoutMinutes: security?.sessionTimeoutMinutes ?? 720, lastSecurityReviewAt: security?.lastSecurityReviewAt?.toISOString() ?? null },
    memberships: memberships.map(item => ({ id: item.id, role: item.role, firmName: item.firm.name })),
    deliveries: deliveries.map(item => ({ ...item, createdAt: item.createdAt.toISOString(), deliveredAt: item.deliveredAt?.toISOString() ?? null })),
    revision: memory?.updatedAt.toISOString() ?? null,
  };
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || !origin || origin !== new URL(request.url).origin) {
    throw new ApiError({ status: 403, code: "CROSS_SITE_REQUEST_BLOCKED", message: "Open Settings from this Slice site before changing the account." });
  }
}
async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError({ status: 415, code: "JSON_REQUIRED", message: "Settings require a JSON request." });
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new ApiError({ status: 413, code: "BODY_TOO_LARGE", message: "This settings request is too large." });
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError({ status: 400, code: "INVALID_JSON", message: "The settings request is empty." });
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new ApiError({ status: 413, code: "BODY_TOO_LARGE", message: "This settings request is too large." }); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  try { return object(JSON.parse(Buffer.concat(chunks).toString("utf8")), "Settings"); }
  catch (error) { if (error instanceof SettingsValidationError) throw error; throw new ApiError({ status: 400, code: "INVALID_JSON", message: "Settings must contain valid JSON." }); }
}
function rate(request: Request, userId: string) {
  const result = checkRateLimit({ key: `account-settings:${userId}:${hashForSecurity(getClientIp(request))}`, limit: 40, windowMs: 60_000 });
  if (!result.allowed) throw new ApiError({ status: 429, code: "SETTINGS_RATE_LIMIT", message: "Too many settings changes. Try again shortly.", details: { retryAfterSeconds: result.retryAfterSeconds } });
}
function asApiError(error: unknown): never {
  if (error instanceof SettingsValidationError) throw new ApiError({ status: error.status, code: error.code, message: error.message });
  throw error;
}

export const GET = withApiRoute({ route: "/api/account-settings", timeoutMs: 15_000 }, async ({ request }) => {
  const user = await getCurrentUser();
  if (!user) throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Sign in to open your settings." });
  const settings = await loadSettings(user);
  if (new URL(request.url).searchParams.get("export") === "account-preferences") {
    return apiJson({ format: "slice-account-preferences-v1", exportedAt: new Date().toISOString(), account: settings.account, appearance: settings.appearance, notifications: settings.notifications,
      privacy: settings.privacy, memberships: settings.memberships }, { headers: { "content-disposition": "attachment; filename=Slice_Account_Preferences.json" } });
  }
  return apiJson(settings);
});

export const POST = withApiRoute({ route: "/api/account-settings", timeoutMs: 20_000 }, async ({ request }) => {
  requireSameOrigin(request);
  const user = await getCurrentUser();
  if (!user) throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Sign in to change your settings." });
  rate(request, user.id);
  try {
    const body = await readBody(request);
    const action = body.action;
    if (action === "saveAccountSettings" || action === "requestPasswordReset") {
      throw new ApiError({ status: 409, code: "SETTINGS_UPGRADE_REQUIRED", message: "Refresh Settings to save each section. Password and security changes now use the Security Center." });
    }
    if (["saveProfile", "saveAppearance", "saveNotifications"].includes(String(action))) {
      exactFields(body, action === "saveProfile" ? ["action", "account"] : action === "saveAppearance" ? ["action", "appearance", "allowBrowserStorage"] : ["action", "notifications"], "Settings request");
      const profile = action === "saveProfile" ? validateProfile(body.account, user.email) : null;
      const appearance = action === "saveAppearance" ? validateAppearance(body.appearance) : null;
      const notifications = action === "saveNotifications" ? validateNotifications(body.notifications) : null;
      if (appearance && typeof body.allowBrowserStorage !== "boolean") throw new SettingsValidationError("INVALID_SETTINGS", "Browser appearance storage must be enabled or disabled.");
      await prisma.$transaction(async tx => {
        // Serialize metadata merges for the same account so independent section saves do not erase each other.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, platformStatus: true } });
        if (!current || current.platformStatus !== "Active") throw new ApiError({ status: 401, code: "ACCOUNT_UNAVAILABLE", message: "This account is no longer active." });
        if (profile && profile.email !== current.email) throw new ApiError({ status: 409, code: "ACCOUNT_CHANGED", message: "Your account changed. Reload Settings before saving." });
        if (profile || appearance) {
          const memory = await tx.personalUserBotMemory.findUnique({ where: { userId_memoryKey: { userId: user.id, memoryKey: MEMORY_KEY } }, select: { value: true } });
          const meta = readAccountPreferences(memory?.value);
          const next = { ...meta.raw, ...(profile ? { phone: profile.phone, timezone: profile.timezone } : {}),
            ...(appearance ? { appearance, appearanceMode: appearance.mode, density: appearance.density, accent: appearance.accent,
              privacy: { ...(meta.raw.privacy && typeof meta.raw.privacy === "object" && !Array.isArray(meta.raw.privacy) ? meta.raw.privacy : {}), allowBrowserStorage: body.allowBrowserStorage } } : {}) };
          if (profile) await tx.user.update({ where: { id: user.id }, data: { name: profile.name } });
          await tx.personalUserBotMemory.upsert({ where: { userId_memoryKey: { userId: user.id, memoryKey: MEMORY_KEY } },
            update: { value: JSON.stringify(next), title: "Account preferences", status: "Active" },
            create: { userId: user.id, memoryKey: MEMORY_KEY, memoryType: "Account Settings", title: "Account preferences", value: JSON.stringify(next), confidenceScore: 100, status: "Active" } });
        }
        for (const preference of notifications ?? []) {
          const { channel, ...data } = preference;
          await tx.notificationPreference.upsert({ where: { userId_channel: { userId: user.id, channel } }, update: data, create: { userId: user.id, channel, ...data } });
        }
        await tx.auditLog.create({ data: { userId: user.id, eventType: "ACCOUNT_PREFERENCES_UPDATED", severity: "Info", area: "Account Settings", title: "Account preferences updated",
          detail: action === "saveProfile" ? "Profile details updated; sign-in identity unchanged." : action === "saveAppearance" ? "Appearance and browser appearance-storage preference updated." : "Notification filtering preferences updated.",
          metadataJson: JSON.stringify({ section: action, ipHash: hashForSecurity(getClientIp(request)) }) } });
      });
      const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
      if (!refreshed) throw new ApiError({ status: 401, code: "ACCOUNT_UNAVAILABLE", message: "Your account is no longer available." });
      return apiJson(await loadSettings(refreshed));
    }
    if (action === "deactivateAccount" || action === "deleteAccount") {
      exactFields(body, ["action", "confirmation", "currentPassword", "factorCode"], "Account action");
      const required = action === "deactivateAccount" ? "DEACTIVATE" : "DELETE MY ACCOUNT";
      if (body.confirmation !== required) throw new ApiError({ status: 422, code: "CONFIRMATION_REQUIRED", message: `Type ${required} exactly to continue.` });
      await requireAccountReauthentication(user.id, body.currentPassword, body.factorCode, request);
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        // The legacy schema cascades a firm's deletion through its creator. Never let self-service closure erase a shared firm.
        const createdFirms = await tx.firm.count({ where: { createdByUserId: user.id } });
        if (createdFirms > 0) throw new ApiError({ status: 409, code: "FIRM_OWNERSHIP_REQUIRED", message: "This account created a shared firm. Complete an ownership and record-retention review before closing it." });
        const memberships = await tx.firmMembership.findMany({ where: { userId: user.id, status: "Active" }, select: { firmId: true }, orderBy: { firmId: "asc" } });
        for (const { firmId } of memberships) {
          await tx.$queryRaw`SELECT "id" FROM "Firm" WHERE "id" = ${firmId} FOR UPDATE`;
          const remaining = await tx.firmMembership.count({ where: { firmId, userId: { not: user.id }, status: "Active", user: { platformStatus: "Active" },
            OR: [{ canManageFirm: true }, { role: { in: ["Owner", "Founder", "Admin", "Administrator", "Firm Admin", "Lead Advisor", "Principal", "Managing Partner"] } }] } });
          if (remaining === 0) throw new ApiError({ status: 409, code: "FIRM_ADMIN_REQUIRED", message: "An active firm administrator must remain before you close this account." });
        }
        await tx.session.deleteMany({ where: { userId: user.id } });
        if (action === "deactivateAccount") {
          await tx.user.update({ where: { id: user.id }, data: { platformStatus: "Suspended", governanceReason: "User requested account deactivation.", governedAt: new Date() } });
          await tx.auditLog.create({ data: { userId: user.id, eventType: "ACCOUNT_DEACTIVATED", severity: "Warning", area: "Account", title: "Account deactivated after reauthentication", detail: "All account sessions were revoked." } });
        } else {
          await tx.personalUserBotMemory.deleteMany({ where: { userId: user.id } });
          await tx.user.delete({ where: { id: user.id } });
        }
      });
      if (action === "deleteAccount") await recordSecurityEvent({ eventType: "ACCOUNT_DELETED", severity: "High", area: "Account", title: "Account deleted after reauthentication", metadata: { accountIdHash: hashForSecurity(user.id) }, request }).catch(() => undefined);
      const response = NextResponse.json({ ok: true, redirectTo: "/founder-login", message: action === "deactivateAccount" ? "Account deactivated and sessions revoked." : "Account deleted." });
      response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
      return response;
    }
    throw new ApiError({ status: 400, code: "UNKNOWN_SETTINGS_ACTION", message: "Choose a supported account setting action." });
  } catch (error) { asApiError(error); }
});
