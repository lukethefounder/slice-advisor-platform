import { recordAuditLog } from "@/lib/audit";
import { ensureIntelligenceSettings } from "@/lib/intelligence-settings";
import { ensureNotificationPreferences } from "@/lib/notification-engine";
import { ensureDefaultPortfolioLab } from "@/lib/portfolio-engine";
import { prisma } from "@/lib/prisma";

export async function getSystemReadiness(userId: string) {
  const [
    user,
    watchlist,
    ventures,
    goals,
    research,
    alerts,
    clients,
    accounts,
    holdings,
    models,
    retainedDecisions,
    runs,
    deliveries,
    briefings,
    auditLogs,
    sourceSettings,
    notificationPreferences,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.watchAsset.count({ where: { userId } }),
    prisma.ventureProject.count({ where: { userId } }),
    prisma.investorGoal.count({ where: { userId } }),
    prisma.researchNote.count({ where: { userId } }),
    prisma.alertEvent.count({ where: { userId } }),
    prisma.clientProfile.count({ where: { userId } }),
    prisma.investorAccount.count({ where: { userId } }),
    prisma.investorHolding.count({ where: { userId } }),
    prisma.allocationModel.count({ where: { userId } }),
    prisma.headlineDecision.count({ where: { userId } }),
    prisma.intelligenceRun.count({ where: { userId } }),
    prisma.notificationDelivery.count({ where: { userId } }),
    prisma.briefingReport.count({ where: { userId } }),
    prisma.auditLog.count({ where: { userId } }),
    ensureIntelligenceSettings(userId),
    ensureNotificationPreferences(userId),
  ]);

  const checks = [
    {
      name: "Database",
      ready: Boolean(user),
      detail: user ? "Database connection and user lookup work." : "User lookup failed.",
    },
    {
      name: "Authentication",
      ready: Boolean(user),
      detail: "Register/login/session system is available.",
    },
    {
      name: "Watchlist",
      ready: watchlist > 0,
      detail: `${watchlist} watchlist asset(s) saved.`,
    },
    {
      name: "Investor Workspace",
      ready: goals + research + alerts > 0,
      detail: `${goals} goal(s), ${research} research note(s), ${alerts} alert(s).`,
    },
    {
      name: "Wealth Manager Workspace",
      ready: clients > 0,
      detail: `${clients} client profile(s) saved.`,
    },
    {
      name: "Portfolio Lab",
      ready: accounts > 0 && models > 0,
      detail: `${accounts} account(s), ${holdings} holding(s), ${models} allocation model(s).`,
    },
    {
      name: "Triage Engine",
      ready: runs > 0 || retainedDecisions > 0,
      detail: `${runs} run(s), ${retainedDecisions} retained decision(s).`,
    },
    {
      name: "Notifications",
      ready: notificationPreferences.length > 0,
      detail: `${notificationPreferences.length} notification channel(s) configured, ${deliveries} delivery record(s).`,
    },
    {
      name: "Briefings",
      ready: true,
      detail: `${briefings} briefing report(s) generated.`,
    },
    {
      name: "Security / Audit",
      ready: auditLogs > 0,
      detail: `${auditLogs} audit log(s).`,
    },
    {
      name: "Source Controls",
      ready: sourceSettings.sources.length > 0,
      detail: `${sourceSettings.sources.length} source(s), ${sourceSettings.sources.filter((source) => source.enabled).length} enabled.`,
    },
  ];

  const readyCount = checks.filter((check) => check.ready).length;
  const readinessScore = Math.round((readyCount / checks.length) * 100);

  return {
    readinessScore,
    readyCount,
    totalChecks: checks.length,
    checks,
    counts: {
      watchlist,
      ventures,
      goals,
      research,
      alerts,
      clients,
      accounts,
      holdings,
      models,
      retainedDecisions,
      runs,
      deliveries,
      briefings,
      auditLogs,
    },
  };
}

export async function seedDemoWorkspace(userId: string, request?: Request) {
  await ensureIntelligenceSettings(userId);
  await ensureNotificationPreferences(userId);
  await ensureDefaultPortfolioLab(userId);

  const watchAssets = [
    {
      ticker: "AAPL",
      name: "Apple Inc.",
      assetType: "Stock",
      price: "$194.12",
      move: "+1.8%",
      ma50: "$187.44",
      ma200: "$176.22",
      volume: "61.2M",
      rsi: "63",
      signal: "Momentum above 50D and 200D",
      notes: "Demo blue-chip technology watch item.",
    },
    {
      ticker: "NVDA",
      name: "NVIDIA Corporation",
      assetType: "Stock",
      price: "$121.88",
      move: "+3.4%",
      ma50: "$114.62",
      ma200: "$98.11",
      volume: "214.8M",
      rsi: "71",
      signal: "Strong AI demand headline cluster",
      notes: "Demo AI infrastructure watch item.",
    },
    {
      ticker: "TLT",
      name: "20+ Year Treasury Bond ETF",
      assetType: "Bond",
      price: "$91.42",
      move: "-0.9%",
      ma50: "$92.05",
      ma200: "$94.81",
      volume: "38.1M",
      rsi: "39",
      signal: "Yield pressure affecting long-duration bonds",
      notes: "Demo macro and duration exposure item.",
    },
    {
      ticker: "BTC",
      name: "Bitcoin",
      assetType: "Crypto",
      price: "$67,840",
      move: "+2.4%",
      signal: "High-risk digital asset exposure",
      notes: "Demo alternative investment watch item.",
    },
  ];

  for (const asset of watchAssets) {
    await prisma.watchAsset.upsert({
      where: {
        userId_ticker: {
          userId,
          ticker: asset.ticker,
        },
      },
      update: asset,
      create: {
        userId,
        ...asset,
      },
    });
  }

  const ventureCount = await prisma.ventureProject.count({ where: { userId } });

  if (ventureCount === 0) {
    await prisma.ventureProject.create({
      data: {
        userId,
        name: "Founder Network AI Startup",
        founder: "Known Founder",
        sector: "AI workflow automation",
        stage: "Pre-seed",
        relationship: "Founder known personally by user.",
        thesis:
          "Potential upside from automating high-value professional workflows.",
        risk:
          "Very high risk: early stage, illiquid, uncertain product-market fit.",
      },
    });
  }

  const goalCount = await prisma.investorGoal.count({ where: { userId } });

  if (goalCount === 0) {
    await prisma.investorGoal.createMany({
      data: [
        {
          userId,
          title: "Build long-term wealth portfolio",
          goalType: "Wealth Growth",
          targetAmount: "$1,000,000",
          currentAmount: "$250,000",
          priority: "High",
          notes: "Demo primary wealth-building goal.",
        },
        {
          userId,
          title: "Limit alternative investment exposure",
          goalType: "Alternative Allocation",
          targetAmount: "10% max",
          currentAmount: "Review needed",
          priority: "Medium",
          notes: "Keep crypto and venture exposure separate from core wealth.",
        },
      ],
    });
  }

  const researchCount = await prisma.researchNote.count({ where: { userId } });

  if (researchCount === 0) {
    await prisma.researchNote.create({
      data: {
        userId,
        ticker: "NVDA",
        title: "AI infrastructure thesis",
        thesis:
          "NVIDIA remains a critical AI infrastructure company, but valuation and volatility require disciplined review.",
        risks:
          "High expectations, export restrictions, supply constraints, and margin compression.",
        decision: "Research More",
        conviction: "Medium",
      },
    });
  }

  const account = await prisma.investorAccount.findFirst({
    where: { userId },
  });

  if (account) {
    const holdingCount = await prisma.investorHolding.count({ where: { userId } });

    if (holdingCount === 0) {
      await prisma.investorHolding.createMany({
        data: [
          {
            userId,
            accountId: account.id,
            symbol: "AAPL",
            assetName: "Apple Inc.",
            assetClass: "Stock",
            valueNumber: 25000,
            targetRole: "Core",
            riskLevel: "Medium",
            thesis: "Core technology exposure.",
          },
          {
            userId,
            accountId: account.id,
            symbol: "NVDA",
            assetName: "NVIDIA Corporation",
            assetClass: "Stock",
            valueNumber: 30000,
            targetRole: "Growth",
            riskLevel: "High",
            thesis: "AI infrastructure growth exposure.",
          },
          {
            userId,
            accountId: account.id,
            symbol: "TLT",
            assetName: "20+ Year Treasury Bond ETF",
            assetClass: "Bond",
            valueNumber: 15000,
            targetRole: "Diversifier",
            riskLevel: "Medium",
            thesis: "Duration exposure and potential rate-cut sensitivity.",
          },
          {
            userId,
            accountId: account.id,
            symbol: "CASH",
            assetName: "Cash Reserve",
            assetClass: "Cash",
            valueNumber: 10000,
            targetRole: "Liquidity",
            riskLevel: "Low",
            thesis: "Liquidity reserve.",
          },
          {
            userId,
            accountId: account.id,
            symbol: "BTC",
            assetName: "Bitcoin",
            assetClass: "Crypto",
            valueNumber: 5000,
            targetRole: "Alternative",
            riskLevel: "High",
            thesis: "High-risk alternative exposure.",
          },
        ],
      });
    }
  }

  const clientCount = await prisma.clientProfile.count({ where: { userId } });

  if (clientCount === 0) {
    const client = await prisma.clientProfile.create({
      data: {
        userId,
        fullName: "Harper Family Trust",
        email: "client@example.com",
        householdName: "Harper Household",
        clientType: "Private Client",
        riskProfile: "Balanced",
        liquidityNeeds: "Moderate",
        timeHorizon: "5-10 years",
        objective: "Preserve and grow family wealth.",
        portfolioValue: "$4.8M",
        notes: "Demo client household.",
      },
    });

    await prisma.portfolioHolding.createMany({
      data: [
        {
          clientId: client.id,
          symbol: "AAPL",
          assetName: "Apple Inc.",
          assetClass: "Stock",
          value: "$650,000",
          allocationPct: "13.5%",
          riskLevel: "Medium",
          thesis: "Core technology exposure.",
        },
        {
          clientId: client.id,
          symbol: "TLT",
          assetName: "20+ Year Treasury Bond ETF",
          assetClass: "Bond",
          value: "$400,000",
          allocationPct: "8.3%",
          riskLevel: "Medium",
          thesis: "Duration exposure.",
        },
      ],
    });
  }

  const alertCount = await prisma.alertEvent.count({ where: { userId } });

  if (alertCount === 0) {
    await prisma.alertEvent.create({
      data: {
        userId,
        dedupeKey: "seed-demo-critical-nvda-alert",
        title: "Demo NVDA material AI infrastructure alert",
        body:
          "Slice detected a high-scoring demo intelligence item tied to a watched AI infrastructure holding.",
        source: "Seed Demo",
        ticker: "NVDA",
        urgency: "Critical",
        score: 94,
        channel: "Dashboard",
      },
    });
  }

  await recordAuditLog({
    userId,
    eventType: "SYSTEM_SEEDED",
    severity: "Info",
    area: "System",
    title: "Demo workspace seeded",
    detail:
      "Seed data was added for watchlist, goals, research, portfolio lab, client workspace, and alerts.",
    request,
  });

  return getSystemReadiness(userId);
}

export async function resetUserWorkspace(userId: string, request?: Request) {
  const clients = await prisma.clientProfile.findMany({
    where: { userId },
    select: { id: true },
  });

  const clientIds = clients.map((client) => client.id);

  await prisma.notificationDelivery.deleteMany({ where: { userId } });
  await prisma.digestReport.deleteMany({ where: { userId } });
  await prisma.briefingReport.deleteMany({ where: { userId } });
  await prisma.headlineDecision.deleteMany({ where: { userId } });
  await prisma.intelligenceRun.deleteMany({ where: { userId } });
  await prisma.alertEvent.deleteMany({ where: { userId } });
  await prisma.investorInsight.deleteMany({ where: { userId } });
  await prisma.researchNote.deleteMany({ where: { userId } });
  await prisma.investorGoal.deleteMany({ where: { userId } });
  await prisma.ventureProject.deleteMany({ where: { userId } });
  await prisma.watchAsset.deleteMany({ where: { userId } });
  await prisma.alertRule.deleteMany({ where: { userId } });

  if (clientIds.length > 0) {
    await prisma.riskReview.deleteMany({
      where: { clientId: { in: clientIds } },
    });
    await prisma.portfolioHolding.deleteMany({
      where: { clientId: { in: clientIds } },
    });
  }

  await prisma.advisorNote.deleteMany({ where: { userId } });
  await prisma.meetingTask.deleteMany({ where: { userId } });
  await prisma.documentVaultItem.deleteMany({ where: { userId } });
  await prisma.clientProfile.deleteMany({ where: { userId } });

  await prisma.rebalanceReport.deleteMany({ where: { userId } });
  await prisma.scenarioReport.deleteMany({ where: { userId } });
  await prisma.investorHolding.deleteMany({ where: { userId } });
  await prisma.investorAccount.deleteMany({ where: { userId } });
  await prisma.allocationModel.deleteMany({ where: { userId } });

  await prisma.newsSourceConfig.deleteMany({ where: { userId } });
  await prisma.intelligenceRetentionPolicy.deleteMany({ where: { userId } });
  await prisma.notificationPreference.deleteMany({ where: { userId } });

  await recordAuditLog({
    userId,
    eventType: "WORKSPACE_RESET",
    severity: "Warning",
    area: "System",
    title: "Workspace data reset",
    detail:
      "User workspace data was reset. Security settings, disclosure acceptances, sessions, user account, and audit logs were preserved.",
    request,
  });

  await ensureIntelligenceSettings(userId);
  await ensureNotificationPreferences(userId);
  await ensureDefaultPortfolioLab(userId);

  return getSystemReadiness(userId);
}