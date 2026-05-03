import { NextResponse } from "next/server";
import { getDisclosureStatus, ensureUserSecuritySetting } from "@/lib/audit";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { ensureIntelligenceSettings } from "@/lib/intelligence-settings";
import { ensureNotificationPreferences } from "@/lib/notification-engine";
import { getPortfolioSnapshot } from "@/lib/portfolio-engine";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const firmMemberships = await prisma.firmMembership.findMany({
    where: {
      userId: user.id,
      status: "Active",
    },
    include: {
      firm: true,
    },
  });

  const firmIds = firmMemberships.map((membership) => membership.firmId);

  const [
    watchlistCount,
    ventureCount,
    goalCount,
    researchCount,
    unreadAlertCount,
    totalAlertCount,
    clientCount,
    openTaskCount,
    briefingCount,
    retainedDecisionCount,
    triageRunCount,
    deliveryCount,
    digestCount,
    auditLogCount,
    accountCount,
    holdingCount,
    modelCount,
    firmCount,
    ownedFirmCount,
    firmProjectCount,
    firmAgendaCount,
    firmAgendaTaskCount,
    firmPostCount,
    recentAlerts,
    recentBriefings,
    recentDecisions,
    recentDeliveries,
    recentAuditLogs,
    recentFirmPosts,
    recentFirmAgendas,
    sourceHealth,
    intelligenceSettings,
    notificationPreferences,
    securitySetting,
    disclosures,
    portfolioSnapshot,
  ] = await Promise.all([
    prisma.watchAsset.count({ where: { userId: user.id } }),
    prisma.ventureProject.count({ where: { userId: user.id } }),
    prisma.investorGoal.count({ where: { userId: user.id } }),
    prisma.researchNote.count({ where: { userId: user.id } }),
    prisma.alertEvent.count({
      where: { userId: user.id, status: "Unread" },
    }),
    prisma.alertEvent.count({ where: { userId: user.id } }),
    prisma.clientProfile.count({ where: { userId: user.id } }),
    prisma.meetingTask.count({
      where: {
        userId: user.id,
        status: {
          not: "Complete",
        },
      },
    }),
    prisma.briefingReport.count({ where: { userId: user.id } }),
    prisma.headlineDecision.count({ where: { userId: user.id } }),
    prisma.intelligenceRun.count({ where: { userId: user.id } }),
    prisma.notificationDelivery.count({ where: { userId: user.id } }),
    prisma.digestReport.count({ where: { userId: user.id } }),
    prisma.auditLog.count({ where: { userId: user.id } }),
    prisma.investorAccount.count({ where: { userId: user.id } }),
    prisma.investorHolding.count({ where: { userId: user.id } }),
    prisma.allocationModel.count({ where: { userId: user.id } }),

    prisma.firmMembership.count({
      where: {
        userId: user.id,
        status: "Active",
      },
    }),
    prisma.firm.count({
      where: {
        createdByUserId: user.id,
      },
    }),
    firmIds.length
      ? prisma.firmProject.count({
          where: {
            firmId: {
              in: firmIds,
            },
          },
        })
      : Promise.resolve(0),
    firmIds.length
      ? prisma.weeklyAgenda.count({
          where: {
            firmId: {
              in: firmIds,
            },
          },
        })
      : Promise.resolve(0),
    firmIds.length
      ? prisma.firmAgendaTask.count({
          where: {
            firmId: {
              in: firmIds,
            },
          },
        })
      : Promise.resolve(0),
    firmIds.length
      ? prisma.firmPost.count({
          where: {
            firmId: {
              in: firmIds,
            },
          },
        })
      : Promise.resolve(0),

    prisma.alertEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.briefingReport.findMany({
      where: { userId: user.id },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.headlineDecision.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.notificationDelivery.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    firmIds.length
      ? prisma.firmPost.findMany({
          where: {
            firmId: {
              in: firmIds,
            },
          },
          include: {
            firm: true,
            project: true,
            authorMembership: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
        })
      : Promise.resolve([]),
    firmIds.length
      ? prisma.weeklyAgenda.findMany({
          where: {
            firmId: {
              in: firmIds,
            },
          },
          include: {
            firm: true,
            membership: {
              include: {
                user: true,
              },
            },
            tasks: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.sourceCheckpoint.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),

    ensureIntelligenceSettings(user.id),
    ensureNotificationPreferences(user.id),
    ensureUserSecuritySetting(user.id),
    getDisclosureStatus(user),
    getPortfolioSnapshot(user.id),
  ]);

  const acceptedDisclosures = disclosures.filter((item) => item.accepted).length;
  const enabledSources = intelligenceSettings.sources.filter(
    (source) => source.enabled
  ).length;
  const enabledNotifications = notificationPreferences.filter(
    (preference) => preference.enabled
  ).length;

  const readinessItems = [
    {
      area: "Authentication",
      status: "Ready",
      detail: "Local register/login/logout sessions are active.",
      score: 90,
    },
    {
      area: "Unified Workspace",
      status: "Ready",
      detail: "Single login routes users into the unified Slice workspace.",
      score: 90,
    },
    {
      area: "Firm Workspace",
      status: firmCount > 0 ? "Active" : "Ready",
      detail: `${firmCount} firm membership(s), ${firmProjectCount} firm project(s), ${firmAgendaTaskCount} firm task(s).`,
      score: firmCount > 0 ? 88 : 70,
    },
    {
      area: "Investor Workspace",
      status: goalCount + researchCount + totalAlertCount > 0 ? "Active" : "Ready",
      detail: `${goalCount} goals, ${researchCount} research notes, ${totalAlertCount} alerts.`,
      score: goalCount + researchCount + totalAlertCount > 0 ? 85 : 70,
    },
    {
      area: "Wealth Workspace",
      status: clientCount > 0 ? "Active" : "Ready",
      detail: `${clientCount} clients and ${openTaskCount} open tasks.`,
      score: clientCount > 0 ? 85 : 65,
    },
    {
      area: "Intelligence Triage",
      status: triageRunCount > 0 ? "Active" : "Ready",
      detail: `${retainedDecisionCount} retained decisions across ${triageRunCount} runs.`,
      score: triageRunCount > 0 ? 88 : 70,
    },
    {
      area: "Notifications",
      status: deliveryCount > 0 ? "Active" : "Ready",
      detail: `${deliveryCount} delivery records and ${digestCount} digest reports.`,
      score: deliveryCount > 0 ? 82 : 68,
    },
    {
      area: "Portfolio Lab",
      status: holdingCount > 0 ? "Active" : "Ready",
      detail: `${accountCount} accounts, ${holdingCount} holdings, ${modelCount} models.`,
      score: holdingCount > 0 ? 86 : 70,
    },
    {
      area: "Briefings",
      status: briefingCount > 0 ? "Active" : "Ready",
      detail: `${briefingCount} briefing reports generated.`,
      score: briefingCount > 0 ? 84 : 68,
    },
    {
      area: "Security",
      status:
        acceptedDisclosures === disclosures.length && securitySetting.lastSecurityReviewAt
          ? "Ready"
          : "Needs Review",
      detail: `${acceptedDisclosures}/${disclosures.length} disclosures accepted.`,
      score:
        acceptedDisclosures === disclosures.length && securitySetting.lastSecurityReviewAt
          ? 90
          : 60,
    },
  ];

  const readinessScore = Math.round(
    readinessItems.reduce((sum, item) => sum + item.score, 0) /
      readinessItems.length
  );

  const workspaceLinks = [
    {
      title: "Unified Workspace",
      path: "/workspace",
      description:
        "Single authenticated workspace with tabs for the entire Slice platform.",
      status: "Primary",
    },
    {
      title: "Main Platform",
      path: "/",
      description: "Dark landing page and platform overview.",
      status: "Design Layer",
    },
    {
      title: "Portal",
      path: "/portal",
      description: "Unified login and registration entry point.",
      status: "Core",
    },
    {
      title: "Firm Workspace",
      path: "/firm",
      description:
        "Firm login, team invites, weekly agendas, projects, calendar tasks, and collaboration board.",
      status: "Team",
    },
    {
      title: "Investor Workspace",
      path: "/investor",
      description: "Goals, research notes, alert inbox, and investor insights.",
      status: "Investor",
    },
    {
      title: "Wealth Workspace",
      path: "/wealth",
      description: "Clients, holdings, notes, meeting tasks, and risk reviews.",
      status: "Advisor",
    },
    {
      title: "Triage",
      path: "/triage",
      description: "Headline importance scoring and source triage.",
      status: "Intelligence",
    },
    {
      title: "Intelligence Settings",
      path: "/intelligence-settings",
      description: "Source controls, retention policy, and cleanup.",
      status: "Controls",
    },
    {
      title: "Notifications",
      path: "/notifications",
      description: "Delivery rules, queues, suppression, and digests.",
      status: "Delivery",
    },
    {
      title: "Briefings",
      path: "/briefings",
      description: "Advisor/client-ready briefing reports.",
      status: "Reports",
    },
    {
      title: "Portfolio Lab",
      path: "/portfolio-lab",
      description: "Holdings, allocation models, rebalancing, and scenarios.",
      status: "Planning",
    },
    {
      title: "Security",
      path: "/security",
      description: "Disclosures, audit logs, and security review.",
      status: "Governance",
    },
    {
      title: "System Readiness",
      path: "/system",
      description: "Health checks, seed data, reset tools, and readiness score.",
      status: "System",
    },
  ];

  return NextResponse.json({
    user: publicUser(user),
    readinessScore,
    readinessItems,
    workspaceLinks,
    counts: {
      watchlistCount,
      ventureCount,
      goalCount,
      researchCount,
      unreadAlertCount,
      totalAlertCount,
      clientCount,
      openTaskCount,
      briefingCount,
      retainedDecisionCount,
      triageRunCount,
      deliveryCount,
      digestCount,
      auditLogCount,
      accountCount,
      holdingCount,
      modelCount,
      enabledSources,
      totalSources: intelligenceSettings.sources.length,
      enabledNotifications,
      totalNotificationChannels: notificationPreferences.length,
      acceptedDisclosures,
      requiredDisclosures: disclosures.length,
      portfolioTotalValue: portfolioSnapshot.totalValue,
      firmCount,
      ownedFirmCount,
      firmProjectCount,
      firmAgendaCount,
      firmAgendaTaskCount,
      firmPostCount,
    },
    recent: {
      alerts: recentAlerts,
      briefings: recentBriefings,
      decisions: recentDecisions,
      deliveries: recentDeliveries,
      auditLogs: recentAuditLogs,
      sourceHealth,
      firmPosts: recentFirmPosts,
      firmAgendas: recentFirmAgendas,
    },
  });
}