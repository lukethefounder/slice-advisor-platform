import { NextResponse } from "next/server";
import {
  ensureUserSecuritySetting,
  getDisclosureStatus,
  recordAuditLog,
} from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const securitySetting = await ensureUserSecuritySetting(user.id);
  const disclosures = await getDisclosureStatus(user);

  const incompleteDisclosures = disclosures.filter((item) => !item.accepted);
  const warnings = [];

  if (!securitySetting.requireReauthForSensitiveActions) {
    warnings.push("Sensitive-action reauthentication is disabled.");
  }

  if (!securitySetting.alertOnNewLogin) {
    warnings.push("New-login alerts are disabled.");
  }

  if (!securitySetting.mfaEnabled) {
    warnings.push("MFA is not enabled yet. Current version stores this as a local readiness flag.");
  }

  if (incompleteDisclosures.length > 0) {
    warnings.push(`${incompleteDisclosures.length} required disclosure(s) are not accepted.`);
  }

  await prisma.userSecuritySetting.update({
    where: { userId: user.id },
    data: {
      lastSecurityReviewAt: new Date(),
    },
  });

  const severity = warnings.length > 0 ? "Warning" : "Info";

  const audit = await recordAuditLog({
    userId: user.id,
    eventType: "SECURITY_REVIEW_RUN",
    severity,
    area: "Security",
    title:
      warnings.length > 0
        ? "Security review completed with warnings"
        : "Security review completed successfully",
    detail:
      warnings.length > 0
        ? warnings.join(" ")
        : "No major security warnings were detected.",
    metadata: {
      warnings,
      incompleteDisclosures: incompleteDisclosures.map((item) => item.title),
    },
    request,
  });

  return NextResponse.json({
    ok: true,
    audit,
    warnings,
  });
}