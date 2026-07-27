import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  hashSessionToken,
  SESSION_COOKIE,
  getCurrentUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

const SETTINGS_MEMORY_KEY = "account.settings";

type NotificationInput = {
  channel: string;
  enabled: boolean;
  minUrgency: string;
  minScore: number;
  digestOnly: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  cooldownMinutes: number;
};

type SecurityInput = {
  mfaEnabled: boolean;
  requireReauthForSensitiveActions: boolean;
  alertOnNewLogin: boolean;
  advisorModeEnabled: boolean;
  sessionTimeoutMinutes: number;
};

type AccountMeta = {
  phone: string;
  timezone: string;
  appearanceMode: "dark" | "light" | "system";
  density: "Comfortable" | "Compact" | "Spacious";
  accent: "Market Green" | "Crimson" | "Ruby" | "Graphite";
  privacy: {
    aiMemoryEnabled: boolean;
    analyticsEnabled: boolean;
    personalizationEnabled: boolean;
    marketingEmailsEnabled: boolean;
    shareUsageForImprovement: boolean;
    showProfileToTeam: boolean;
    retainReports: "30 days" | "90 days" | "1 year" | "Forever";
    exportFormat: "PDF" | "CSV" | "JSON";
  };
};

const defaultAccountMeta: AccountMeta = {
  phone: "",
  timezone: "America/Phoenix",
  appearanceMode: "dark",
  density: "Comfortable",
  accent: "Market Green",
  privacy: {
    aiMemoryEnabled: true,
    analyticsEnabled: true,
    personalizationEnabled: true,
    marketingEmailsEnabled: false,
    shareUsageForImprovement: false,
    showProfileToTeam: true,
    retainReports: "1 year",
    exportFormat: "PDF",
  },
};

const defaultNotificationPreferences: NotificationInput[] = [
  {
    channel: "Dashboard",
    enabled: true,
    minUrgency: "Medium",
    minScore: 70,
    digestOnly: false,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 20,
  },
  {
    channel: "Email",
    enabled: true,
    minUrgency: "High",
    minScore: 80,
    digestOnly: false,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 30,
  },
  {
    channel: "Security",
    enabled: true,
    minUrgency: "Low",
    minScore: 50,
    digestOnly: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    cooldownMinutes: 0,
  },
  {
    channel: "Reports",
    enabled: true,
    minUrgency: "Medium",
    minScore: 70,
    digestOnly: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 60,
  },
  {
    channel: "SMS",
    enabled: false,
    minUrgency: "Critical",
    minScore: 90,
    digestOnly: false,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 60,
  },
  {
    channel: "Push",
    enabled: false,
    minUrgency: "High",
    minScore: 80,
    digestOnly: false,
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    cooldownMinutes: 30,
  },
];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeAccountMeta(value: Partial<AccountMeta> | null | undefined): AccountMeta {
  const merged = {
    ...defaultAccountMeta,
    ...(value || {}),
    privacy: {
      ...defaultAccountMeta.privacy,
      ...(value?.privacy || {}),
    },
  };

  return {
    phone: cleanString(merged.phone),
    timezone: cleanString(merged.timezone, "America/Phoenix"),
    appearanceMode:
      merged.appearanceMode === "light" ||
      merged.appearanceMode === "system" ||
      merged.appearanceMode === "dark"
        ? merged.appearanceMode
        : "dark",
    density:
      merged.density === "Compact" || merged.density === "Spacious"
        ? merged.density
        : "Comfortable",
    accent:
      merged.accent === "Crimson" ||
      merged.accent === "Ruby" ||
      merged.accent === "Graphite"
        ? merged.accent
        : "Market Green",
    privacy: {
      aiMemoryEnabled: Boolean(merged.privacy.aiMemoryEnabled),
      analyticsEnabled: Boolean(merged.privacy.analyticsEnabled),
      personalizationEnabled: Boolean(merged.privacy.personalizationEnabled),
      marketingEmailsEnabled: Boolean(merged.privacy.marketingEmailsEnabled),
      shareUsageForImprovement: Boolean(merged.privacy.shareUsageForImprovement),
      showProfileToTeam: Boolean(merged.privacy.showProfileToTeam),
      retainReports:
        merged.privacy.retainReports === "30 days" ||
        merged.privacy.retainReports === "90 days" ||
        merged.privacy.retainReports === "Forever"
          ? merged.privacy.retainReports
          : "1 year",
      exportFormat:
        merged.privacy.exportFormat === "CSV" || merged.privacy.exportFormat === "JSON"
          ? merged.privacy.exportFormat
          : "PDF",
    },
  };
}

function normalizeSecurity(input: Partial<SecurityInput> | null | undefined): SecurityInput {
  return {
    mfaEnabled: readBoolean(input?.mfaEnabled, false),
    requireReauthForSensitiveActions: readBoolean(
      input?.requireReauthForSensitiveActions,
      true,
    ),
    alertOnNewLogin: readBoolean(input?.alertOnNewLogin, true),
    advisorModeEnabled: readBoolean(input?.advisorModeEnabled, false),
    sessionTimeoutMinutes: Math.max(
      15,
      Math.min(43200, Math.round(readNumber(input?.sessionTimeoutMinutes, 43200))),
    ),
  };
}

function normalizeNotification(input: Partial<NotificationInput>): NotificationInput {
  return {
    channel: cleanString(input.channel, "Dashboard"),
    enabled: readBoolean(input.enabled, true),
    minUrgency: cleanString(input.minUrgency, "High"),
    minScore: Math.max(0, Math.min(100, Math.round(readNumber(input.minScore, 75)))),
    digestOnly: readBoolean(input.digestOnly, false),
    quietHoursStart: input.quietHoursStart ? cleanString(input.quietHoursStart) : null,
    quietHoursEnd: input.quietHoursEnd ? cleanString(input.quietHoursEnd) : null,
    cooldownMinutes: Math.max(
      0,
      Math.min(1440, Math.round(readNumber(input.cooldownMinutes, 30))),
    ),
  };
}

async function readAccountMeta(userId: string) {
  const memory = await db.personalUserBotMemory.findUnique({
    where: {
      userId_memoryKey: {
        userId,
        memoryKey: SETTINGS_MEMORY_KEY,
      },
    },
  });

  return normalizeAccountMeta(parseJson<Partial<AccountMeta>>(memory?.value, defaultAccountMeta));
}

async function saveAccountMeta(input: {
  userId: string;
  profileId?: string | null;
  firmId?: string | null;
  meta: AccountMeta;
}) {
  return db.personalUserBotMemory.upsert({
    where: {
      userId_memoryKey: {
        userId: input.userId,
        memoryKey: SETTINGS_MEMORY_KEY,
      },
    },
    update: {
      profileId: input.profileId || undefined,
      firmId: input.firmId || undefined,
      title: "Account, Privacy, Appearance, and Contact Settings",
      value: JSON.stringify(input.meta),
      confidenceScore: 100,
      status: "Active",
    },
    create: {
      userId: input.userId,
      profileId: input.profileId || null,
      firmId: input.firmId || null,
      memoryKey: SETTINGS_MEMORY_KEY,
      memoryType: "Account Settings",
      title: "Account, Privacy, Appearance, and Contact Settings",
      value: JSON.stringify(input.meta),
      confidenceScore: 100,
      sourcePrompt: "Saved from AI Studio settings.",
      status: "Active",
    },
  });
}

async function ensureSecurity(userId: string) {
  return db.userSecuritySetting.upsert({
    where: {
      userId,
    },
    update: {},
    create: {
      userId,
      mfaEnabled: false,
      requireReauthForSensitiveActions: true,
      alertOnNewLogin: true,
      advisorModeEnabled: false,
      sessionTimeoutMinutes: 43200,
    },
  });
}

async function ensureNotifications(userId: string) {
  for (const preference of defaultNotificationPreferences) {
    await db.notificationPreference.upsert({
      where: {
        userId_channel: {
          userId,
          channel: preference.channel,
        },
      },
      update: {},
      create: {
        userId,
        channel: preference.channel,
        enabled: preference.enabled,
        minUrgency: preference.minUrgency,
        minScore: preference.minScore,
        digestOnly: preference.digestOnly,
        quietHoursStart: preference.quietHoursStart,
        quietHoursEnd: preference.quietHoursEnd,
        cooldownMinutes: preference.cooldownMinutes,
      },
    });
  }

  return db.notificationPreference.findMany({
    where: {
      userId,
    },
    orderBy: {
      channel: "asc",
    },
  });
}

async function writeAudit(input: {
  userId: string;
  eventType: string;
  severity?: string;
  area?: string;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  return db.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      severity: input.severity || "Info",
      area: input.area || "Account Settings",
      title: input.title,
      detail: input.detail || null,
      metadataJson: JSON.stringify(input.metadata || {}),
      userAgent: input.request?.headers.get("user-agent") || null,
      ipAddress:
        input.request?.headers.get("x-forwarded-for") ||
        input.request?.headers.get("x-real-ip") ||
        null,
    },
  });
}

async function loadSettings(user: any) {
  const profile = await db.personalUserBotProfile.findUnique({
    where: {
      userId: user.id,
    },
  });

  const [accountMeta, security, notifications] = await Promise.all([
    readAccountMeta(user.id),
    ensureSecurity(user.id),
    ensureNotifications(user.id),
  ]);

  return {
    ok: true,
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: accountMeta.phone,
      timezone: accountMeta.timezone,
      platformStatus: user.platformStatus,
      createdAt: user.createdAt,
    },
    appearance: {
      mode: accountMeta.appearanceMode,
      density: accountMeta.density,
      accent: accountMeta.accent,
    },
    privacy: accountMeta.privacy,
    security: {
      mfaEnabled: security.mfaEnabled,
      requireReauthForSensitiveActions: security.requireReauthForSensitiveActions,
      alertOnNewLogin: security.alertOnNewLogin,
      advisorModeEnabled: security.advisorModeEnabled,
      sessionTimeoutMinutes: security.sessionTimeoutMinutes,
      lastSecurityReviewAt: security.lastSecurityReviewAt,
    },
    notifications: notifications.map((item: any) => ({
      id: item.id,
      channel: item.channel,
      enabled: item.enabled,
      minUrgency: item.minUrgency,
      minScore: item.minScore,
      digestOnly: item.digestOnly,
      quietHoursStart: item.quietHoursStart,
      quietHoursEnd: item.quietHoursEnd,
      cooldownMinutes: item.cooldownMinutes,
    })),
    contact: {
      name: "Luke Royal Price",
      phone: "(985) 290-3067",
      phoneHref: "tel:+19852903067",
      email: "price.luke.royal@gmail.com",
      emailHref: "mailto:price.luke.royal@gmail.com",
    },
    profileContext: {
      profileId: profile?.id || null,
      firmId: profile?.firmId || null,
    },
  };
}

function clearAuthResponse(payload: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadSettings(user));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = cleanString(body.action);

  if (action === "saveAccountSettings") {
    const account = body.account && typeof body.account === "object" ? body.account : {};
    const appearance =
      body.appearance && typeof body.appearance === "object" ? body.appearance : {};
    const privacy = body.privacy && typeof body.privacy === "object" ? body.privacy : {};
    const security = normalizeSecurity(
      body.security && typeof body.security === "object" ? body.security : {},
    );
    const notifications = Array.isArray(body.notifications)
      ? body.notifications.map(normalizeNotification)
      : defaultNotificationPreferences;

    const name = cleanString(account.name, user.name);
    const email = cleanEmail(account.email || user.email);
    const phone = cleanString(account.phone);
    const timezone = cleanString(account.timezone, "America/Phoenix");

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    if (!validEmail(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const duplicate = await db.user.findFirst({
      where: {
        email,
        NOT: {
          id: user.id,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "That email is already in use by another Slice account." },
        { status: 409 },
      );
    }

    const profile = await db.personalUserBotProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

    const nextMeta = normalizeAccountMeta({
      phone,
      timezone,
      appearanceMode: appearance.mode,
      density: appearance.density,
      accent: appearance.accent,
      privacy,
    });

    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        name,
        email,
      },
    });

    await saveAccountMeta({
      userId: user.id,
      profileId: profile?.id || null,
      firmId: profile?.firmId || null,
      meta: nextMeta,
    });

    await db.userSecuritySetting.upsert({
      where: {
        userId: user.id,
      },
      update: security,
      create: {
        userId: user.id,
        ...security,
      },
    });

    for (const preference of notifications) {
      await db.notificationPreference.upsert({
        where: {
          userId_channel: {
            userId: user.id,
            channel: preference.channel,
          },
        },
        update: {
          enabled: preference.enabled,
          minUrgency: preference.minUrgency,
          minScore: preference.minScore,
          digestOnly: preference.digestOnly,
          quietHoursStart: preference.quietHoursStart,
          quietHoursEnd: preference.quietHoursEnd,
          cooldownMinutes: preference.cooldownMinutes,
        },
        create: {
          userId: user.id,
          channel: preference.channel,
          enabled: preference.enabled,
          minUrgency: preference.minUrgency,
          minScore: preference.minScore,
          digestOnly: preference.digestOnly,
          quietHoursStart: preference.quietHoursStart,
          quietHoursEnd: preference.quietHoursEnd,
          cooldownMinutes: preference.cooldownMinutes,
        },
      });
    }

    await writeAudit({
      userId: user.id,
      eventType: "account_settings_updated",
      area: "Account Settings",
      title: "Account settings updated",
      detail: "The user updated profile, security, privacy, appearance, or notification settings.",
      metadata: {
        emailChanged: email !== user.email,
        appearanceMode: nextMeta.appearanceMode,
      },
      request,
    });

    const refreshedUser = await db.user.findUnique({
      where: {
        id: user.id,
      },
    });

    return NextResponse.json(await loadSettings(refreshedUser));
  }

  if (action === "requestPasswordReset") {
    await db.notificationDelivery.create({
      data: {
        userId: user.id,
        channel: "Email",
        destination: user.email,
        status: "Queued",
        urgency: "High",
        score: 95,
        title: "Slice password reset requested",
        body:
          "A password reset request was created from AI Studio settings. Connect your production email provider to deliver the reset link.",
        reason: "User requested password reset email.",
        simulated: true,
      },
    });

    await writeAudit({
      userId: user.id,
      eventType: "password_reset_requested",
      severity: "High",
      area: "Security",
      title: "Password reset requested",
      detail:
        "A password reset email request was queued. Production email delivery depends on the configured email provider.",
      request,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Password reset request queued. Connect your production email provider to deliver the email automatically.",
    });
  }

  if (action === "deactivateAccount") {
    const confirmation = cleanString(body.confirmation);

    if (confirmation !== "DEACTIVATE") {
      return NextResponse.json(
        { error: 'Type "DEACTIVATE" to confirm account deactivation.' },
        { status: 400 },
      );
    }

    await writeAudit({
      userId: user.id,
      eventType: "account_deactivation_requested",
      severity: "High",
      area: "Account",
      title: "Account deactivated by user",
      detail: "The user requested account deactivation from AI Studio settings.",
      request,
    });

    await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        platformStatus: "Suspended",
        governanceReason: "User requested account deactivation.",
        governedAt: new Date(),
      },
    });

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await db.session.deleteMany({
        where: {
          tokenHash: hashSessionToken(token),
        },
      });
    }

    return clearAuthResponse({
      ok: true,
      message: "Account deactivated.",
      redirectTo: "/login",
    });
  }

  if (action === "deleteAccount") {
    const confirmation = cleanString(body.confirmation);

    if (confirmation !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: 'Type "DELETE MY ACCOUNT" to confirm permanent account deletion.' },
        { status: 400 },
      );
    }

    await writeAudit({
      userId: user.id,
      eventType: "account_deletion_requested",
      severity: "Critical",
      area: "Account",
      title: "Account deletion requested by user",
      detail: "The user requested permanent account deletion from AI Studio settings.",
      request,
    });

    await db.user.delete({
      where: {
        id: user.id,
      },
    });

    return clearAuthResponse({
      ok: true,
      message: "Account deleted.",
      redirectTo: "/login",
    });
  }

  return NextResponse.json(await loadSettings(user));
}