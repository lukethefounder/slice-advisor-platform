import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureDefaultPortfolioLab,
  getPortfolioSnapshot,
  runRebalanceReport,
  runScenarioReport,
} from "@/lib/portfolio-engine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type PortfolioAction =
  | "createAccount"
  | "updateAccount"
  | "deleteAccount"
  | "createHolding"
  | "updateHolding"
  | "deleteHolding"
  | "createModel"
  | "updateModel"
  | "deleteModel"
  | "addTarget"
  | "updateTarget"
  | "deleteTarget"
  | "runRebalance"
  | "runScenario"
  | "seedDefaults"
  | "refresh";

type PortfolioLabBody = {
  action?: PortfolioAction;
  id?: string;
  accountId?: string | null;
  modelId?: string;
  targetId?: string;

  name?: string;
  accountType?: string;
  custodian?: string;
  notes?: string;

  symbol?: string;
  assetName?: string;
  assetClass?: string;
  valueNumber?: string | number;
  costBasis?: string | number | null;
  targetRole?: string;
  riskLevel?: string;
  thesis?: string;

  description?: string;
  targetPct?: string | number;
  scenarioType?: string;

  expectedReturn?: string | number;
  expectedVolatility?: string | number;
  liquidityNeed?: string;
  clientObjective?: string;
};

type AllocationSummary = {
  assetClass: string;
  value: number;
  pct: number;
};

type DriftSummary = {
  assetClass: string;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  driftDollars: number;
  status: "Overweight" | "Underweight" | "On Target";
  severity: "Low" | "Medium" | "High";
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Slice-Portfolio-Lab", "v3-target-safe");
  return response;
}

function cleanString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\u0000/g, "").trim() || fallback;
}

function cleanSymbol(value: unknown) {
  return cleanString(value)
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "")
    .slice(0, 16);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value !== "string") return fallback;

  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = toNumber(value, Number.NaN);

  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function safeParseArray<T = unknown>(value: string | null | undefined): T[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: string | null | undefined
): T {
  if (!value) return {} as T;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}

function normalizeAssetClass(assetClass: string | null | undefined) {
  const value = String(assetClass ?? "").toLowerCase();

  if (value.includes("stock") || value.includes("equity")) return "Stocks";
  if (value.includes("etf")) return "ETFs";
  if (value.includes("bond") || value.includes("fixed")) return "Bonds";
  if (value.includes("crypto") || value.includes("digital")) return "Crypto";
  if (value.includes("venture") || value.includes("startup")) return "Private Venture";
  if (value.includes("real estate") || value.includes("reit")) return "Real Estate";
  if (value.includes("cash") || value.includes("money market")) return "Cash";
  if (value.includes("commodity") || value.includes("gold") || value.includes("oil")) return "Commodities";
  if (value.includes("alternative") || value.includes("alt")) return "Alternatives";

  return cleanString(assetClass, "Other");
}

function riskScoreForHolding(holding: any) {
  const risk = String(holding.riskLevel ?? "").toLowerCase();
  const assetClass = normalizeAssetClass(holding.assetClass);

  let score = 45;

  if (risk.includes("low")) score = 25;
  if (risk.includes("medium")) score = 45;
  if (risk.includes("high")) score = 72;
  if (risk.includes("very high") || risk.includes("extreme")) score = 88;

  if (assetClass === "Crypto") score += 12;
  if (assetClass === "Private Venture") score += 18;
  if (assetClass === "Alternatives") score += 10;
  if (assetClass === "Cash") score -= 18;
  if (assetClass === "Bonds") score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
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
      Commodities: -0.06,
      Alternatives: -0.16,
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
      Commodities: 0.12,
      Alternatives: -0.08,
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
      Commodities: 0.02,
      Alternatives: 0.05,
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
      Commodities: -0.03,
      Alternatives: -0.08,
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
      Commodities: -0.02,
      Alternatives: -0.2,
      Other: -0.05,
    },
    "liquidity crunch": {
      Stocks: -0.14,
      ETFs: -0.12,
      Bonds: -0.05,
      Crypto: -0.32,
      "Private Venture": -0.45,
      "Real Estate": -0.18,
      Cash: 0,
      Commodities: -0.1,
      Alternatives: -0.25,
      Other: -0.12,
    },
  };

  const scenarioMap = shocks[scenario] ?? shocks["market drawdown"];
  return scenarioMap[cls] ?? scenarioMap.Other ?? -0.05;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function targetArray(model: any) {
  return Array.isArray(model?.targets) ? model.targets : [];
}

function buildTargetMap(model: any) {
  return new Map<string, number>(
    targetArray(model).map((target: any) => [
      normalizeAssetClass(target.assetClass),
      Number(target.targetPct) || 0,
    ])
  );
}

function buildAllocationMap(allocations: AllocationSummary[]) {
  return new Map<string, AllocationSummary>(
    allocations.map((item) => [normalizeAssetClass(item.assetClass), item])
  );
}

function buildDriftSummary({
  allocations,
  model,
  totalValue,
}: {
  allocations: AllocationSummary[];
  model: any;
  totalValue: number;
}) {
  const currentMap = buildAllocationMap(allocations);
  const targetMap = buildTargetMap(model);

  const allClasses = Array.from(new Set([...currentMap.keys(), ...targetMap.keys()])).sort();

  const drift: DriftSummary[] = allClasses.map((assetClass) => {
    const currentPct = currentMap.get(assetClass)?.pct ?? 0;
    const targetPct = targetMap.get(assetClass) ?? 0;
    const driftPct = round(currentPct - targetPct, 2);
    const driftDollars = round((driftPct / 100) * totalValue, 2);
    const abs = Math.abs(driftPct);

    return {
      assetClass,
      currentPct,
      targetPct,
      driftPct,
      driftDollars,
      status:
        abs < 3
          ? "On Target"
          : driftPct > 0
            ? "Overweight"
            : "Underweight",
      severity: abs >= 10 ? "High" : abs >= 5 ? "Medium" : "Low",
    };
  });

  return drift;
}

function buildRecommendations(drift: DriftSummary[]) {
  return drift
    .filter((item) => Math.abs(item.driftPct) >= 5)
    .map((item) => {
      if (item.driftPct > 0) {
        return {
          assetClass: item.assetClass,
          action: "Review / Reduce",
          amount: Math.abs(item.driftDollars),
          reason: `${item.assetClass} is overweight by ${item.driftPct} percentage points versus target.`,
          severity: item.severity,
        };
      }

      return {
        assetClass: item.assetClass,
        action: "Review / Increase",
        amount: Math.abs(item.driftDollars),
        reason: `${item.assetClass} is underweight by ${Math.abs(item.driftPct)} percentage points versus target.`,
        severity: item.severity,
      };
    });
}

function buildRiskBreakdown(holdings: any[], totalValue: number) {
  const riskMap = new Map<string, { value: number; count: number; weightedScore: number }>();

  for (const holding of holdings) {
    const riskLevel = cleanString(holding.riskLevel, "Medium");
    const value = Number(holding.valueNumber) || 0;
    const score = riskScoreForHolding(holding);

    const existing = riskMap.get(riskLevel) ?? {
      value: 0,
      count: 0,
      weightedScore: 0,
    };

    existing.value += value;
    existing.count += 1;
    existing.weightedScore += score * value;

    riskMap.set(riskLevel, existing);
  }

  return Array.from(riskMap.entries())
    .map(([riskLevel, item]) => ({
      riskLevel,
      value: round(item.value, 2),
      count: item.count,
      pct: totalValue > 0 ? round((item.value / totalValue) * 100, 2) : 0,
      score: item.value > 0 ? round(item.weightedScore / item.value, 1) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildRoleBreakdown(holdings: any[], totalValue: number) {
  const roleMap = new Map<string, { value: number; count: number }>();

  for (const holding of holdings) {
    const role = cleanString(holding.targetRole, "Core");
    const value = Number(holding.valueNumber) || 0;

    const existing = roleMap.get(role) ?? { value: 0, count: 0 };
    existing.value += value;
    existing.count += 1;
    roleMap.set(role, existing);
  }

  return Array.from(roleMap.entries())
    .map(([targetRole, item]) => ({
      targetRole,
      value: round(item.value, 2),
      count: item.count,
      pct: totalValue > 0 ? round((item.value / totalValue) * 100, 2) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildConcentration(holdings: any[], totalValue: number) {
  const sorted = holdings
    .slice()
    .sort((a, b) => (Number(b.valueNumber) || 0) - (Number(a.valueNumber) || 0));

  const top5Value = sorted
    .slice(0, 5)
    .reduce((sum, holding) => sum + (Number(holding.valueNumber) || 0), 0);

  return {
    topHolding: sorted[0] ?? null,
    top5Value: round(top5Value, 2),
    top5Pct: totalValue > 0 ? round((top5Value / totalValue) * 100, 2) : 0,
    holdings: sorted.slice(0, 10).map((holding) => ({
      id: holding.id,
      symbol: holding.symbol,
      assetName: holding.assetName,
      assetClass: holding.assetClass,
      valueNumber: holding.valueNumber,
      pct: totalValue > 0 ? round(((Number(holding.valueNumber) || 0) / totalValue) * 100, 2) : 0,
      riskLevel: holding.riskLevel,
      targetRole: holding.targetRole,
    })),
  };
}

function buildPortfolioInsights({
  holdings,
  allocations,
  totalValue,
  selectedModel,
  drift,
}: {
  holdings: any[];
  allocations: AllocationSummary[];
  totalValue: number;
  selectedModel: any | null;
  drift: DriftSummary[];
}) {
  const concentration = buildConcentration(holdings, totalValue);
  const riskBreakdown = buildRiskBreakdown(holdings, totalValue);
  const highRiskValue = riskBreakdown
    .filter((item) => ["High", "Very High", "Extreme"].includes(item.riskLevel))
    .reduce((sum, item) => sum + item.value, 0);

  const highRiskPct = totalValue > 0 ? round((highRiskValue / totalValue) * 100, 2) : 0;
  const majorDrift = drift.filter((item) => Math.abs(item.driftPct) >= 10);
  const moderateDrift = drift.filter((item) => Math.abs(item.driftPct) >= 5 && Math.abs(item.driftPct) < 10);

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        25 +
          (holdings.length ? 18 : 0) +
          (allocations.length ? 14 : 0) +
          (selectedModel ? 12 : 0) +
          (targetArray(selectedModel).length ? 12 : 0) +
          (totalValue > 0 ? 12 : 0) -
          Math.min(20, majorDrift.length * 5) -
          Math.min(15, highRiskPct / 3)
      )
    )
  );

  const actions = [
    totalValue <= 0 ? "Add holding values before relying on portfolio analytics." : null,
    !selectedModel ? "Create or select an allocation model before running rebalance analytics." : null,
    selectedModel && !targetArray(selectedModel).length
      ? "Add model targets before using drift analysis."
      : null,
    majorDrift.length
      ? `Review ${majorDrift.length} major allocation drift item(s) above 10 percentage points.`
      : null,
    moderateDrift.length
      ? `Monitor ${moderateDrift.length} moderate allocation drift item(s) above 5 percentage points.`
      : null,
    concentration.top5Pct >= 60
      ? `Top five holdings represent ${concentration.top5Pct}% of the portfolio. Review concentration risk.`
      : null,
    highRiskPct >= 30
      ? `${highRiskPct}% of the portfolio is marked high-risk or above. Confirm suitability and liquidity.`
      : null,
    "Use outputs as review prompts, not automatic trade recommendations.",
  ].filter(Boolean);

  return {
    readinessScore,
    concentration,
    riskBreakdown,
    roleBreakdown: buildRoleBreakdown(holdings, totalValue),
    majorDrift,
    moderateDrift,
    actions,
  };
}

async function loadAllocationModels(userId: string) {
  return db.allocationModel.findMany({
    where: { userId },
    include: {
      targets: {
        orderBy: {
          assetClass: "asc",
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function loadAccounts(userId: string) {
  return db.investorAccount.findMany({
    where: { userId },
    include: {
      holdings: {
        orderBy: [{ assetClass: "asc" }, { symbol: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function loadPortfolioLab(userId: string) {
  await ensureDefaultPortfolioLab(userId);

  const [accounts, models, rebalanceReports, scenarioReports, snapshot] =
    await Promise.all([
      loadAccounts(userId),
      loadAllocationModels(userId),
      db.rebalanceReport.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.scenarioReport.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      getPortfolioSnapshot(userId),
    ]);

  const selectedModel = models[0] ?? null;
  const drift = selectedModel
    ? buildDriftSummary({
        allocations: snapshot.allocations,
        model: selectedModel,
        totalValue: snapshot.totalValue,
      })
    : [];

  const recommendations = buildRecommendations(drift);
  const insights = buildPortfolioInsights({
    holdings: snapshot.holdings,
    allocations: snapshot.allocations,
    totalValue: snapshot.totalValue,
    selectedModel,
    drift,
  });

  const modelSummaries = models.map((model: any) => {
    const modelDrift = buildDriftSummary({
      allocations: snapshot.allocations,
      model,
      totalValue: snapshot.totalValue,
    });

    const modelRecommendations = buildRecommendations(modelDrift);

    return {
      modelId: model.id,
      modelName: model.name,
      riskLevel: model.riskLevel,
      targetCount: targetArray(model).length,
      drift: modelDrift,
      recommendationCount: modelRecommendations.length,
      largestAbsoluteDriftPct: modelDrift.length
        ? Math.max(...modelDrift.map((item) => Math.abs(item.driftPct)))
        : 0,
    };
  });

  return {
    ok: true,
    accounts,
    holdings: snapshot.holdings,
    allocations: snapshot.allocations,
    totalValue: snapshot.totalValue,
    models,
    rebalanceReports,
    scenarioReports,
    analytics: {
      selectedModelId: selectedModel?.id ?? null,
      drift,
      recommendations,
      insights,
      modelSummaries,
      allocationTotalPct: snapshot.allocations.reduce((sum, item) => sum + item.pct, 0),
      holdingCount: snapshot.holdings.length,
      accountCount: accounts.length,
      modelCount: models.length,
      targetCount: models.reduce((sum: number, model: any) => sum + targetArray(model).length, 0),
    },
  };
}

async function writeAuditLog(input: {
  userId: string;
  eventType: string;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        severity: "Info",
        area: "Portfolio Lab",
        title: input.title,
        detail: input.detail ?? null,
        metadataJson: safeJson(input.metadata ?? {}),
      },
    });
  } catch {
    // Audit logging should never break portfolio workflow.
  }
}

async function assertAccount(userId: string, accountId: string) {
  return db.investorAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });
}

async function assertModelWithTargets(userId: string, modelId: string) {
  return db.allocationModel.findFirst({
    where: {
      id: modelId,
      userId,
    },
    include: {
      targets: true,
    },
  });
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  return noStoreJson(await loadPortfolioLab(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureDefaultPortfolioLab(user.id);

  const body = (await request.json().catch(() => ({}))) as PortfolioLabBody;
  const action = body.action;

  if (action === "refresh" || !action) {
    return noStoreJson(await loadPortfolioLab(user.id));
  }

  if (action === "seedDefaults") {
    await ensureDefaultPortfolioLab(user.id);

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioDefaultsSeeded",
      title: "Portfolio Lab defaults verified",
    });

    return noStoreJson(await loadPortfolioLab(user.id));
  }

  if (action === "createAccount") {
    const name = cleanString(body.name);

    if (!name) {
      return noStoreJson({ error: "Account name is required." }, { status: 400 });
    }

    const account = await db.investorAccount.create({
      data: {
        userId: user.id,
        name,
        accountType: cleanString(body.accountType, "Taxable Brokerage"),
        custodian: cleanString(body.custodian) || null,
        notes: cleanString(body.notes) || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioAccountCreated",
      title: `Created portfolio account: ${account.name}`,
      metadata: { accountId: account.id },
    });

    return noStoreJson({
      account,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "updateAccount") {
    const accountId = cleanString(body.id || body.accountId);

    if (!accountId) {
      return noStoreJson({ error: "Account ID is required." }, { status: 400 });
    }

    const account = await assertAccount(user.id, accountId);

    if (!account) {
      return noStoreJson({ error: "Account not found." }, { status: 404 });
    }

    const updated = await db.investorAccount.update({
      where: { id: account.id },
      data: {
        name: typeof body.name === "string" ? cleanString(body.name, account.name) : undefined,
        accountType:
          typeof body.accountType === "string"
            ? cleanString(body.accountType, account.accountType)
            : undefined,
        custodian:
          typeof body.custodian === "string" ? cleanString(body.custodian) || null : undefined,
        notes: typeof body.notes === "string" ? cleanString(body.notes) || null : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioAccountUpdated",
      title: `Updated portfolio account: ${updated.name}`,
      metadata: { accountId: updated.id },
    });

    return noStoreJson({
      account: updated,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "deleteAccount") {
    const accountId = cleanString(body.id || body.accountId);

    if (!accountId) {
      return noStoreJson({ error: "Account ID is required." }, { status: 400 });
    }

    const account = await assertAccount(user.id, accountId);

    if (!account) {
      return noStoreJson({ error: "Account not found." }, { status: 404 });
    }

    await db.investorAccount.delete({
      where: { id: account.id },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioAccountDeleted",
      title: `Deleted portfolio account: ${account.name}`,
      metadata: { accountId: account.id },
    });

    return noStoreJson({
      ok: true,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "createHolding") {
    const symbol = cleanSymbol(body.symbol);
    const assetName = cleanString(body.assetName);
    const accountId = cleanString(body.accountId) || null;

    if (!symbol || !assetName) {
      return noStoreJson(
        { error: "Symbol and asset name are required." },
        { status: 400 }
      );
    }

    if (accountId) {
      const account = await assertAccount(user.id, accountId);

      if (!account) {
        return noStoreJson({ error: "Account not found." }, { status: 404 });
      }
    }

    const holding = await db.investorHolding.create({
      data: {
        userId: user.id,
        accountId,
        symbol,
        assetName,
        assetClass: normalizeAssetClass(body.assetClass || "Stock"),
        valueNumber: toNumber(body.valueNumber),
        costBasis: toOptionalNumber(body.costBasis),
        targetRole: cleanString(body.targetRole, "Core"),
        riskLevel: cleanString(body.riskLevel, "Medium"),
        thesis: cleanString(body.thesis) || null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioHoldingCreated",
      title: `Added holding: ${holding.symbol}`,
      detail: `${holding.assetName} · ${money(holding.valueNumber)}`,
      metadata: { holdingId: holding.id },
    });

    return noStoreJson({
      holding,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "updateHolding") {
    const holdingId = cleanString(body.id);

    if (!holdingId) {
      return noStoreJson({ error: "Holding ID is required." }, { status: 400 });
    }

    const holding = await db.investorHolding.findFirst({
      where: {
        id: holdingId,
        userId: user.id,
      },
    });

    if (!holding) {
      return noStoreJson({ error: "Holding not found." }, { status: 404 });
    }

    const nextAccountId =
      body.accountId === "" || body.accountId === null || body.accountId === undefined
        ? body.accountId === undefined
          ? undefined
          : null
        : cleanString(body.accountId);

    if (nextAccountId) {
      const account = await assertAccount(user.id, nextAccountId);

      if (!account) {
        return noStoreJson({ error: "Account not found." }, { status: 404 });
      }
    }

    const updated = await db.investorHolding.update({
      where: { id: holding.id },
      data: {
        accountId: nextAccountId,
        symbol: typeof body.symbol === "string" ? cleanSymbol(body.symbol) || holding.symbol : undefined,
        assetName:
          typeof body.assetName === "string"
            ? cleanString(body.assetName, holding.assetName)
            : undefined,
        assetClass:
          typeof body.assetClass === "string"
            ? normalizeAssetClass(body.assetClass)
            : undefined,
        valueNumber:
          body.valueNumber === undefined ? undefined : toNumber(body.valueNumber, holding.valueNumber),
        costBasis:
          body.costBasis === undefined ? undefined : toOptionalNumber(body.costBasis),
        targetRole:
          typeof body.targetRole === "string"
            ? cleanString(body.targetRole, holding.targetRole)
            : undefined,
        riskLevel:
          typeof body.riskLevel === "string"
            ? cleanString(body.riskLevel, holding.riskLevel)
            : undefined,
        thesis: typeof body.thesis === "string" ? cleanString(body.thesis) || null : undefined,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioHoldingUpdated",
      title: `Updated holding: ${updated.symbol}`,
      metadata: { holdingId: updated.id },
    });

    return noStoreJson({
      holding: updated,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "deleteHolding") {
    const holdingId = cleanString(body.id);

    if (!holdingId) {
      return noStoreJson({ error: "Holding ID is required." }, { status: 400 });
    }

    await db.investorHolding.deleteMany({
      where: {
        id: holdingId,
        userId: user.id,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioHoldingDeleted",
      title: "Deleted portfolio holding",
      metadata: { holdingId },
    });

    return noStoreJson({
      ok: true,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "createModel") {
    const name = cleanString(body.name);

    if (!name) {
      return noStoreJson({ error: "Model name is required." }, { status: 400 });
    }

    const model = await db.allocationModel.create({
      data: {
        userId: user.id,
        name,
        description: cleanString(body.description) || null,
        riskLevel: cleanString(body.riskLevel, "Balanced"),
      },
      include: {
        targets: true,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioModelCreated",
      title: `Created allocation model: ${model.name}`,
      metadata: { modelId: model.id },
    });

    return noStoreJson({
      model,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "updateModel") {
    const modelId = cleanString(body.id || body.modelId);

    if (!modelId) {
      return noStoreJson({ error: "Model ID is required." }, { status: 400 });
    }

    const model = await assertModelWithTargets(user.id, modelId);

    if (!model) {
      return noStoreJson({ error: "Allocation model not found." }, { status: 404 });
    }

    const updated = await db.allocationModel.update({
      where: { id: model.id },
      data: {
        name: typeof body.name === "string" ? cleanString(body.name, model.name) : undefined,
        description:
          typeof body.description === "string" ? cleanString(body.description) || null : undefined,
        riskLevel:
          typeof body.riskLevel === "string"
            ? cleanString(body.riskLevel, model.riskLevel)
            : undefined,
      },
      include: {
        targets: true,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioModelUpdated",
      title: `Updated allocation model: ${updated.name}`,
      metadata: { modelId: updated.id },
    });

    return noStoreJson({
      model: updated,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "deleteModel") {
    const modelId = cleanString(body.id || body.modelId);

    if (!modelId) {
      return noStoreJson({ error: "Model ID is required." }, { status: 400 });
    }

    const model = await assertModelWithTargets(user.id, modelId);

    if (!model) {
      return noStoreJson({ error: "Allocation model not found." }, { status: 404 });
    }

    await db.allocationModel.delete({
      where: { id: model.id },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioModelDeleted",
      title: `Deleted allocation model: ${model.name}`,
      metadata: { modelId: model.id },
    });

    return noStoreJson({
      ok: true,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "addTarget" || action === "updateTarget") {
    const modelId = cleanString(body.modelId);
    const assetClass = normalizeAssetClass(body.assetClass);
    const targetPct = toNumber(body.targetPct);

    if (!modelId || !assetClass) {
      return noStoreJson(
        { error: "Model ID and asset class are required." },
        { status: 400 }
      );
    }

    const model = await assertModelWithTargets(user.id, modelId);

    if (!model) {
      return noStoreJson({ error: "Allocation model not found." }, { status: 404 });
    }

    const target = await db.allocationTarget.upsert({
      where: {
        modelId_assetClass: {
          modelId,
          assetClass,
        },
      },
      update: {
        targetPct,
      },
      create: {
        modelId,
        assetClass,
        targetPct,
      },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioTargetUpserted",
      title: `Saved model target: ${assetClass}`,
      detail: `${targetPct}%`,
      metadata: { modelId, targetId: target.id },
    });

    return noStoreJson({
      target,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "deleteTarget") {
    const targetId = cleanString(body.id || body.targetId);

    if (!targetId) {
      return noStoreJson({ error: "Target ID is required." }, { status: 400 });
    }

    const target = await db.allocationTarget.findUnique({
      where: { id: targetId },
      include: { model: true },
    });

    if (!target || target.model.userId !== user.id) {
      return noStoreJson({ error: "Target not found." }, { status: 404 });
    }

    await db.allocationTarget.delete({
      where: { id: target.id },
    });

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioTargetDeleted",
      title: `Deleted model target: ${target.assetClass}`,
      metadata: { modelId: target.modelId, targetId: target.id },
    });

    return noStoreJson({
      ok: true,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "runRebalance") {
    const modelId = cleanString(body.modelId);

    if (!modelId) {
      return noStoreJson({ error: "Model ID is required." }, { status: 400 });
    }

    const model = await assertModelWithTargets(user.id, modelId);

    if (!model) {
      return noStoreJson({ error: "Allocation model not found." }, { status: 404 });
    }

    const report = await runRebalanceReport(user.id, modelId);

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioRebalanceGenerated",
      title: `Generated rebalance report: ${model.name}`,
      metadata: { modelId, reportId: report.id },
    });

    return noStoreJson({
      report,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  if (action === "runScenario") {
    const scenarioType = cleanString(body.scenarioType, "Market Drawdown");
    const report = await runScenarioReport(user.id, scenarioType);

    await writeAuditLog({
      userId: user.id,
      eventType: "PortfolioScenarioGenerated",
      title: `Generated scenario report: ${scenarioType}`,
      metadata: { reportId: report.id, scenarioType },
    });

    return noStoreJson({
      report,
      portfolio: await loadPortfolioLab(user.id),
    });
  }

  return noStoreJson(
    { error: "Unknown portfolio lab action." },
    { status: 400 }
  );
}