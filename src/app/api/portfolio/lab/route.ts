import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureDefaultPortfolioLab,
  getPortfolioSnapshot,
  runRebalanceReport,
  runScenarioReport,
} from "@/lib/portfolio-engine";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return fallback;

  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureDefaultPortfolioLab(user.id);

  const [accounts, models, rebalanceReports, scenarioReports, snapshot] =
    await Promise.all([
      prisma.investorAccount.findMany({
        where: { userId: user.id },
        include: { holdings: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.allocationModel.findMany({
        where: { userId: user.id },
        include: { targets: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.rebalanceReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.scenarioReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      getPortfolioSnapshot(user.id),
    ]);

  return NextResponse.json({
    accounts,
    holdings: snapshot.holdings,
    allocations: snapshot.allocations,
    totalValue: snapshot.totalValue,
    models,
    rebalanceReports,
    scenarioReports,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await ensureDefaultPortfolioLab(user.id);

  const body = await request.json();

  if (body.action === "createAccount") {
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Account name is required." },
        { status: 400 }
      );
    }

    const account = await prisma.investorAccount.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        accountType: body.accountType?.trim() || "Taxable Brokerage",
        custodian: body.custodian?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ account });
  }

  if (body.action === "createHolding") {
    if (!body.symbol?.trim() || !body.assetName?.trim()) {
      return NextResponse.json(
        { error: "Symbol and asset name are required." },
        { status: 400 }
      );
    }

    const accountId = body.accountId || null;

    if (accountId) {
      const account = await prisma.investorAccount.findFirst({
        where: {
          id: accountId,
          userId: user.id,
        },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Account not found." },
          { status: 404 }
        );
      }
    }

    const holding = await prisma.investorHolding.create({
      data: {
        userId: user.id,
        accountId,
        symbol: body.symbol.trim().toUpperCase(),
        assetName: body.assetName.trim(),
        assetClass: body.assetClass?.trim() || "Stock",
        valueNumber: toNumber(body.valueNumber),
        costBasis:
          body.costBasis === undefined || body.costBasis === ""
            ? null
            : toNumber(body.costBasis),
        targetRole: body.targetRole?.trim() || "Core",
        riskLevel: body.riskLevel?.trim() || "Medium",
        thesis: body.thesis?.trim() || null,
      },
    });

    return NextResponse.json({ holding });
  }

  if (body.action === "deleteHolding") {
    if (!body.id) {
      return NextResponse.json(
        { error: "Holding ID is required." },
        { status: 400 }
      );
    }

    await prisma.investorHolding.deleteMany({
      where: {
        id: body.id,
        userId: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "createModel") {
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Model name is required." },
        { status: 400 }
      );
    }

    const model = await prisma.allocationModel.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        riskLevel: body.riskLevel?.trim() || "Balanced",
      },
    });

    return NextResponse.json({ model });
  }

  if (body.action === "addTarget") {
    if (!body.modelId || !body.assetClass?.trim()) {
      return NextResponse.json(
        { error: "Model ID and asset class are required." },
        { status: 400 }
      );
    }

    const model = await prisma.allocationModel.findFirst({
      where: {
        id: body.modelId,
        userId: user.id,
      },
    });

    if (!model) {
      return NextResponse.json(
        { error: "Allocation model not found." },
        { status: 404 }
      );
    }

    const target = await prisma.allocationTarget.upsert({
      where: {
        modelId_assetClass: {
          modelId: body.modelId,
          assetClass: body.assetClass.trim(),
        },
      },
      update: {
        targetPct: toNumber(body.targetPct),
      },
      create: {
        modelId: body.modelId,
        assetClass: body.assetClass.trim(),
        targetPct: toNumber(body.targetPct),
      },
    });

    return NextResponse.json({ target });
  }

  if (body.action === "deleteTarget") {
    if (!body.id) {
      return NextResponse.json(
        { error: "Target ID is required." },
        { status: 400 }
      );
    }

    const target = await prisma.allocationTarget.findUnique({
      where: { id: body.id },
      include: { model: true },
    });

    if (!target || target.model.userId !== user.id) {
      return NextResponse.json({ error: "Target not found." }, { status: 404 });
    }

    await prisma.allocationTarget.delete({
      where: { id: body.id },
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "runRebalance") {
    if (!body.modelId) {
      return NextResponse.json(
        { error: "Model ID is required." },
        { status: 400 }
      );
    }

    const report = await runRebalanceReport(user.id, body.modelId);

    return NextResponse.json({ report });
  }

  if (body.action === "runScenario") {
    const report = await runScenarioReport(
      user.id,
      body.scenarioType || "Market Drawdown"
    );

    return NextResponse.json({ report });
  }

  return NextResponse.json(
    { error: "Unknown portfolio lab action." },
    { status: 400 }
  );
}