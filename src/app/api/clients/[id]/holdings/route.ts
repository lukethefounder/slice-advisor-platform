import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const client = await prisma.clientProfile.findFirst({
    where: { id, userId: user.id },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    symbol?: string;
    assetName?: string;
    assetClass?: string;
    value?: string;
    allocationPct?: string;
    costBasis?: string;
    riskLevel?: string;
    thesis?: string;
  };

  if (!body.symbol?.trim() || !body.assetName?.trim()) {
    return NextResponse.json(
      { error: "Symbol and asset name are required." },
      { status: 400 }
    );
  }

  const holding = await prisma.portfolioHolding.create({
    data: {
      clientId: id,
      symbol: body.symbol.trim().toUpperCase(),
      assetName: body.assetName.trim(),
      assetClass: body.assetClass?.trim() || "Stock",
      value: body.value?.trim() || null,
      allocationPct: body.allocationPct?.trim() || null,
      costBasis: body.costBasis?.trim() || null,
      riskLevel: body.riskLevel?.trim() || "Medium",
      thesis: body.thesis?.trim() || null,
    },
  });

  return NextResponse.json({ holding });
}