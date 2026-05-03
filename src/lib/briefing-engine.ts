import { prisma } from "@/lib/prisma";

type GenerateBriefingInput = {
  userId: string;
  audience: "Investor" | "Advisor" | "Client";
  briefType: "Daily" | "Weekly" | "Client Meeting" | "Portfolio Review";
  clientId?: string;
};

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function shortDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sentenceList(items: string[]) {
  if (items.length === 0) return "No major items were found.";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function riskLabel(score: number) {
  if (score >= 85) return "high-risk / aggressive";
  if (score >= 70) return "growth-oriented";
  if (score >= 50) return "balanced";
  return "conservative";
}

export async function generateBriefingReport(input: GenerateBriefingInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const [
    watchAssets,
    ventures,
    goals,
    researchNotes,
    alertEvents,
    headlineDecisions,
    insights,
    clients,
  ] = await Promise.all([
    prisma.watchAsset.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.ventureProject.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.investorGoal.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.researchNote.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.alertEvent.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
    prisma.headlineDecision.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 25,
    }),
    prisma.investorInsight.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.clientProfile.findMany({
      where: { userId: input.userId },
      include: {
        holdings: true,
        notesList: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const selectedClient = input.clientId
    ? clients.find((client) => client.id === input.clientId)
    : null;

  if (input.clientId && !selectedClient) {
    throw new Error("Client not found.");
  }

  const criticalAlerts = alertEvents.filter(
    (alert) => alert.urgency === "Critical"
  );
  const highAlerts = alertEvents.filter((alert) => alert.urgency === "High");
  const unreadAlerts = alertEvents.filter((alert) => alert.status === "Unread");

  const topTickers = Array.from(
    new Set([
      ...watchAssets.map((asset) => asset.ticker),
      ...alertEvents.map((alert) => alert.ticker).filter(Boolean),
      ...headlineDecisions.flatMap((decision) => {
        try {
          return JSON.parse(decision.matchedTickersJson);
        } catch {
          return [];
        }
      }),
    ])
  )
    .filter(Boolean)
    .slice(0, 8);

  const topCategories = Array.from(
    new Set(headlineDecisions.map((decision) => decision.category))
  ).slice(0, 6);

  const activeGoals = goals.filter((goal) => goal.status !== "Complete");
  const highPriorityGoals = activeGoals.filter((goal) => goal.priority === "High");

  const cryptoItems = watchAssets.filter((asset) =>
    asset.assetType.toLowerCase().includes("crypto")
  );

  const alternativeCount = ventures.length + cryptoItems.length;

  const latestRiskReview = selectedClient?.reviews[0] ?? null;

  const executiveSummary = selectedClient
    ? `${selectedClient.fullName} has a ${selectedClient.riskProfile.toLowerCase()} risk profile, ${selectedClient.liquidityNeeds.toLowerCase()} liquidity needs, and a stated objective of "${selectedClient.objective}". Slice detected ${criticalAlerts.length} critical alert(s), ${highAlerts.length} high-priority alert(s), and ${headlineDecisions.length} retained market intelligence decision(s) relevant to the current workspace.`
    : `Slice reviewed ${watchAssets.length} watchlist asset(s), ${goals.length} investor goal(s), ${researchNotes.length} research note(s), ${ventures.length} private venture item(s), and ${alertEvents.length} alert event(s). Current attention should focus on ${criticalAlerts.length} critical alert(s), ${highAlerts.length} high-priority alert(s), and the most material categories: ${sentenceList(topCategories)}.`;

  const marketSummary = headlineDecisions.length
    ? `Top retained market intelligence categories include ${sentenceList(
        topCategories
      )}. The most relevant tickers or symbols currently being surfaced are ${sentenceList(
        topTickers.map(String)
      )}. Slice is retaining only scored decisions that passed storage thresholds, rather than storing every headline.`
    : "No retained headline decisions are currently stored. Run triage to produce market intelligence decisions before generating future briefs.";

  const alertSummary = alertEvents.length
    ? `There are ${alertEvents.length} alert event(s), including ${unreadAlerts.length} unread item(s). Critical alerts: ${criticalAlerts.length}. High alerts: ${highAlerts.length}. The highest-scoring alert is "${
        alertEvents[0]?.title ?? "None"
      }" with a score of ${alertEvents[0]?.score ?? 0}.`
    : "No alert events are currently available. Run triage or the demo scan to populate the alert inbox.";

  const portfolioSummary = selectedClient
    ? `${selectedClient.fullName} currently has ${
        selectedClient.holdings.length
      } holding(s) saved in Slice. Portfolio value is ${
        selectedClient.portfolioValue ?? "not entered"
      }. Holdings include ${sentenceList(
        selectedClient.holdings.slice(0, 8).map((holding) => holding.symbol)
      )}.`
    : `The investor workspace currently tracks ${watchAssets.length} watchlist asset(s). Watchlist exposure includes ${sentenceList(
        watchAssets.slice(0, 8).map((asset) => `${asset.ticker} (${asset.assetType})`)
      )}.`;

  const alternativeSummary =
    alternativeCount > 0
      ? `Alternative exposure is being tracked separately. Slice found ${cryptoItems.length} crypto watch item(s) and ${ventures.length} private venture project(s). Private venture records are user-added only and should be treated as high-risk, illiquid, and not suitable for all investors.`
      : "No alternative investment exposure is currently being tracked. Crypto and private venture items should remain separated from the core portfolio if added later.";

  const riskSummary = selectedClient
    ? latestRiskReview
      ? `Most recent risk review: ${latestRiskReview.suitabilityStatus}, score ${latestRiskReview.score}/100, which maps to a ${riskLabel(
          latestRiskReview.score
        )} posture. Summary: ${latestRiskReview.summary}`
      : `No formal risk review has been run for ${selectedClient.fullName}. Current profile is ${selectedClient.riskProfile}, liquidity needs are ${selectedClient.liquidityNeeds}, and horizon is ${selectedClient.timeHorizon}.`
    : insights.length
      ? `Investor insight checks identified ${insights.length} portfolio-health insight(s). The lowest-scoring item is "${insights[0]?.title}" with a score of ${insights[0]?.score}/100, which should be reviewed first.`
      : "No investor insights are currently stored. Generate insights from the investor workspace after adding goals, watchlist items, research, and alerts.";

  const actionItems = [
    criticalAlerts.length > 0
      ? `Review ${criticalAlerts.length} critical alert(s) before making any portfolio decision.`
      : null,
    highAlerts.length > 0
      ? `Review ${highAlerts.length} high-priority alert(s) for relevance.`
      : null,
    selectedClient && !latestRiskReview
      ? `Run a suitability / risk review for ${selectedClient.fullName}.`
      : null,
    selectedClient && selectedClient.tasks.some((task) => task.status !== "Complete")
      ? `Complete open meeting task(s) for ${selectedClient.fullName}.`
      : null,
    highPriorityGoals.length > 0
      ? `Update progress on ${highPriorityGoals.length} high-priority goal(s).`
      : null,
    ventures.length > 0
      ? "Review private venture exposure separately from core portfolio decisions."
      : null,
    researchNotes.length < 3
      ? "Add more research notes to improve decision discipline."
      : null,
    "Do not treat this brief as a buy/sell recommendation. It is market intelligence and workflow support.",
  ].filter(Boolean) as string[];

  const sourceItems = [
    ...alertEvents.slice(0, 8).map((alert) => ({
      type: "Alert",
      title: alert.title,
      source: alert.source,
      ticker: alert.ticker,
      urgency: alert.urgency,
      score: alert.score,
    })),
    ...headlineDecisions.slice(0, 8).map((decision) => ({
      type: "HeadlineDecision",
      title: decision.title,
      source: decision.sourceName,
      category: decision.category,
      urgency: decision.urgency,
      score: decision.score,
    })),
    ...researchNotes.slice(0, 5).map((note) => ({
      type: "ResearchNote",
      title: note.title,
      ticker: note.ticker,
      decision: note.decision,
      conviction: note.conviction,
    })),
  ];

  const title = selectedClient
    ? `${selectedClient.fullName} ${input.briefType} Brief — ${shortDate()}`
    : `Slice ${input.audience} ${input.briefType} Brief — ${shortDate()}`;

  const report = await prisma.briefingReport.create({
    data: {
      userId: input.userId,
      clientId: selectedClient?.id ?? null,
      title,
      audience: input.audience,
      briefType: input.briefType,
      executiveSummary,
      marketSummary,
      alertSummary,
      portfolioSummary,
      alternativeSummary,
      riskSummary,
      actionItemsJson: safeJson(actionItems),
      sourceItemsJson: safeJson(sourceItems),
    },
    include: {
      client: true,
    },
  });

  return report;
}