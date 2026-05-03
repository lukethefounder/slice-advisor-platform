import { NextResponse } from "next/server";
import {
  ensureUserSecuritySetting,
  recordAuditLog,
} from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureUserSecuritySetting(user.id);

  const body = (await request.json()) as {
    mfaEnabled?: boolean;
    requireReauthForSensitiveActions?: boolean;
    alertOnNewLogin?: boolean;
    advisorModeEnabled?: boolean;
    sessionTimeoutMinutes?: number;
  };

  const securitySetting = await prisma.userSecuritySetting.update({
    where: { userId: user.id },
    data: {
      mfaEnabled:
        typeof body.mfaEnabled === "boolean" ? body.mfaEnabled : undefined,
      requireReauthForSensitiveActions:
        typeof body.requireReauthForSensitiveActions === "boolean"
          ? body.requireReauthForSensitiveActions
          : undefined,
      alertOnNewLogin:
        typeof body.alertOnNewLogin === "boolean"
          ? body.alertOnNewLogin
          : undefined,
      advisorModeEnabled:
        typeof body.advisorModeEnabled === "boolean"
          ? body.advisorModeEnabled
          : undefined,
      sessionTimeoutMinutes:
        typeof body.sessionTimeoutMinutes === "number"
          ? body.sessionTimeoutMinutes
          : undefined,
    },
  });

  await recordAuditLog({
    userId: user.id,
    eventType: "SECURITY_SETTINGS_UPDATED",
    severity: "Info",
    area: "Security",
    title: "Security settings updated",
    detail: "The user's local Slice security settings were updated.",
    metadata: body,
    request,
  });

  return NextResponse.json({ securitySetting });
}