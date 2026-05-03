import { prisma } from "@/lib/prisma";

type AllocationItem = {
  assetClass: string;
  value: number;
  pct: number;
};

type DriftItem = {
  assetClass: string;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  driftDollars: number;
};

type Recommendation = {
  assetClass: string;
  action: string;
  amount: number;
  reason: string;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeAssetClass(assetClass: string) {
  const value = assetClass.toLowerCase();

  if (value.includes("stock") || value.includes("equity")) return "Stocks";
  if (value.includes("etf")) return "ETFs";
  if (value.includes("bond") || value.includes("fixed")) return "Bonds";
  if (value.includes("crypto") || value.includes("digital")) return "Crypto";
  if (value.includes("venture") || value.includes("startup")) return "Private Venture";
  if (value.includes("real estate") || value.includes("reit")) return "Real Estate";
  if (value.includes("cash")) return "Cash";

  return assetClass.trim() || "Other";
}

function getScenarioShock(assetClass: string, scenarioType: string) {
  const cls = normalizeAssetClass(assetClass);
  const scenario = scenarioType.toLowerCase();

  const shocks: Record<string, Record<string, number>> = {
    "market drawdown": {
      Stocks: -0.22,
      ETFs: -0.18,
      Bonds: 0.04,
      Crypto: -0.35,
      "Private Venture": -0.4,
      "Real Estate": -0.12,
      Cash: 0,
      Other: -0.1,
    },
    "inflation shock": {
      Stocks: -0.08,
      ETFs: -0.06,
      Bonds: -0.12,
      Crypto: -0.2,
      "Private Venture": -0.15,
      "Real Estate": -0.06,
      Cash: 0,
      Other: -0.08,
    },
    "rate cut rally": {
      Stocks: 0.1,
      ETFs: 0.08,
      Bonds: 0.07,
      Crypto: 0.18,
      "Private Venture": 0.05,
      "Real Estate": 0.09,
      Cash: 0,
      Other: 0.05,
    },
    "crypto crash": {
      Stocks: -0.04,
      ETFs: -0.04,
      Bonds: 0.01,
      Crypto: -0.55,
      "Private Venture": -0.1,
      "Real Estate": -0.02,
      Cash: 0,
      Other: -0.05,
    },
    "venture write-down": {
      Stocks: -0.03,
      ETFs: -0.03,
      Bonds: 0.01,
      Crypto: -0.1,
      "Private Venture": -0.6,
      "Real Estate": -0.04,
      Cash: 0,
      Other: -0.05,
    },
  };

  const scenarioMap = shocks[scenario] ?? shocks["market drawdown"];
  return scenarioMap[cls] ?? scenarioMap.Other ?? -0.05;
}

export async function ensureDefaultPortfolioLab(userId: string) {
  const accountCount = await prisma.investorAccount.count({
    where: { userId },
  });

  if (accountCount === 0) {
    await prisma.investorAccount.create({
      data: {
        userId,
        name: "Primary Portfolio",
        accountType: "Taxable Brokerage",
        custodian: "Manual Entry",
        notes: "Default Slice portfolio account.",
      },
    });
  }

  const modelCount = await prisma.allocationModel.count({
    where: { userId },
  });

  if (modelCount === 0) {
    const model = await prisma.allocationModel.create({
      data: {
        userId,
        name: "Balanced Wealth Model",
        description:
          "Default diversified model. Adjust these targets before relying on it.",
        riskLevel: "Balanced",
      },
    });

    await prisma.allocationTarget.createMany({
      data: [
        { modelId: model.id, assetClass: "Stocks", targetPct: 50 },
        { modelId: model.id, assetClass: "ETFs", targetPct: 10 },
        { modelId: model.id, assetClass: "Bonds", targetPct: 25 },
        { modelId: model.id, assetClass: "Cash", targetPct: 5 },
        { modelId: model.id, assetClass: "Crypto", targetPct: 5 },
        { modelId: model.id, assetClass: "Private Venture", targetPct: 5 },
      ],
    });
  }
}

export async function getPortfolioSnapshot(userId: string) {
  await ensureDefaultPortfolioLab(userId);

  const holdings = await prisma.investorHolding.findMany({
    where: { userId },
    include: { account: true },
    orderBy: [{ assetClass: "asc" }, { symbol: "asc" }],
  });

  const totalValue = holdings.reduce(
    (sum, holding) => sum + holding.valueNumber,
    0
  );

  const allocationMap = new Map<string, number>();

  for (const holding of holdings) {
    const key = normalizeAssetClass(holding.assetClass);
    allocationMap.set(key, (allocationMap.get(key) ?? 0) + holding.valueNumber);
  }

  const allocations: AllocationItem[] = Array.from(allocationMap.entries())
    .map(([assetClass, value]) => ({
      assetClass,
      value: round(value, 2),
      pct: totalValue > 0 ? round((value / totalValue) * 100, 2) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    holdings,
    totalValue,
    allocations,
  };
}

export async function runRebalanceReport(userId: string, modelId: string) {
  const model = await prisma.allocationModel.findFirst({
    where: {
      id: modelId,
      userId,
    },
    include: {
      targets: true,
    },
  });

  if (!model) {
    throw new Error("Allocation model not found.");
  }

  const snapshot = await getPortfolioSnapshot(userId);
  const totalValue = snapshot.totalValue;

  const currentMap = new Map(
    snapshot.allocations.map((item) => [item.assetClass, item])
  );

  const targetMap = new Map(
    model.targets.map((target) => [
      normalizeAssetClass(target.assetClass),
      target.targetPct,
    ])
  );

  const allClasses = Array.from(
    new Set([...currentMap.keys(), ...targetMap.keys()])
  ).sort();

  const drift: DriftItem[] = allClasses.map((assetClass) => {
    const currentPct = currentMap.get(assetClass)?.pct ?? 0;
    const targetPct = targetMap.get(assetClass) ?? 0;
    const driftPct = round(currentPct - targetPct, 2);
    const driftDollars = round((driftPct / 100) * totalValue, 2);

    return {
      assetClass,
      currentPct,
      targetPct,
      driftPct,
      driftDollars,
    };
  });

  const recommendations: Recommendation[] = drift
    .filter((item) => Math.abs(item.driftPct) >= 5)
    .map((item) => {
      if (item.driftPct > 0) {
        return {
          assetClass: item.assetClass,
          action: "Review / Reduce",
          amount: Math.abs(item.driftDollars),
          reason: `${item.assetClass} is overweight by ${item.driftPct} percentage points versus target.`,
        };
      }

      return {
        assetClass: item.assetClass,
        action: "Review / Increase",
        amount: Math.abs(item.driftDollars),
        reason: `${item.assetClass} is underweight by ${Math.abs(
          item.driftPct
        )} percentage points versus target.`,
      };
    });

  const summary =
    totalValue <= 0
      ? "No portfolio value has been entered yet. Add holdings before using rebalancing."
      : recommendations.length
        ? `Slice found ${recommendations.length} allocation drift item(s) above the 5% review threshold. This is not a trade recommendation; it is a portfolio review prompt.`
        : "Portfolio allocation is within the 5% review threshold against the selected model.";

  const report = await prisma.rebalanceReport.create({
    data: {
      userId,
      modelId,
      title: `${model.name} Rebalance Review`,
      summary,
      totalValue,
      currentAllocationsJson: safeJson(snapshot.allocations),
      targetAllocationsJson: safeJson(
        model.targets.map((target) => ({
          assetClass: normalizeAssetClass(target.assetClass),
          targetPct: target.targetPct,
        }))
      ),
      driftJson: safeJson(drift),
      recommendationsJson: safeJson(recommendations),
    },
  });

  return report;
}

export async function runScenarioReport(userId: string, scenarioType: string) {
  const snapshot = await getPortfolioSnapshot(userId);

  const before = snapshot.holdings.map((holding) => ({
    symbol: holding.symbol,
    assetName: holding.assetName,
    assetClass: normalizeAssetClass(holding.assetClass),
    value: holding.valueNumber,
  }));

  const after = snapshot.holdings.map((holding) => {
    const shock = getScenarioShock(holding.assetClass, scenarioType);
    const afterValue = holding.valueNumber * (1 + shock);

    return {
      symbol: holding.symbol,
      assetName: holding.assetName,
      assetClass: normalizeAssetClass(holding.assetClass),
      beforeValue: round(holding.valueNumber, 2),
      shockPct: round(shock * 100, 2),
      afterValue: round(afterValue, 2),
      impact: round(afterValue - holding.valueNumber, 2),
    };
  });

  const totalBefore = round(snapshot.totalValue, 2);
  const totalAfter = round(
    after.reduce((sum, item) => sum + item.afterValue, 0),
    2
  );

  const impactAmount = round(totalAfter - totalBefore, 2);
  const impactPct =
    totalBefore > 0 ? round((impactAmount / totalBefore) * 100, 2) : 0;

  const largestLoss = after
    .slice()
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3);

  const actions = [
    totalBefore <= 0
      ? "Add holdings and values before using scenario analysis."
      : null,
    impactPct <= -20
      ? "Review drawdown tolerance and liquidity needs before increasing risk exposure."
      : null,
    largestLoss.length
      ? `Largest modeled pressure points: ${largestLoss
          .map((item) => `${item.symbol} (${money(Math.abs(item.impact))})`)
          .join(", ")}.`
      : null,
    "This scenario is a planning estimate, not a prediction.",
  ].filter(Boolean);

  const summary =
    totalBefore <= 0
      ? "No portfolio value has been entered yet."
      : `${scenarioType} scenario changes modeled value from ${money(
          totalBefore
        )} to ${money(totalAfter)}, a modeled impact of ${money(
          impactAmount
        )} (${impactPct}%).`;

  const shock = {
    scenarioType,
    explanation:
      "Scenario shocks are deterministic local assumptions. Replace later with institution-approved assumptions.",
  };

  const report = await prisma.scenarioReport.create({
    data: {
      userId,
      title: `${scenarioType} Scenario`,
      scenarioType,
      totalBefore,
      totalAfter,
      impactAmount,
      impactPct,
      shockJson: safeJson(shock),
      beforeJson: safeJson(before),
      afterJson: safeJson(after),
      summary,
      actionsJson: safeJson(actions),
    },
  });

  return report;
}