import { NextResponse } from "next/server";
import {
  ensureUserSecuritySetting,
  getDisclosureStatus,
} from "@/lib/audit";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [securitySetting, disclosures, auditLogs] = await Promise.all([
    ensureUserSecuritySetting(user.id),
    getDisclosureStatus(user),
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
  ]);

  const stats = {
    totalAuditLogs: auditLogs.length,
    criticalLogs: auditLogs.filter((log) => log.severity === "Critical").length,
    warningLogs: auditLogs.filter((log) => log.severity === "Warning").length,
    acceptedDisclosures: disclosures.filter((item) => item.accepted).length,
    requiredDisclosures: disclosures.length,
  };

  return NextResponse.json({
    user: publicUser(user),
    securitySetting,
    disclosures,
    auditLogs,
    stats,
  });
}