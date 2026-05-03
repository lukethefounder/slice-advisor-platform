import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function riskBaseScore(riskProfile: string) {
  const normalized = riskProfile.toLowerCase();

  if (normalized.includes("conservative")) return 30;
  if (normalized.includes("balanced")) return 55;
  if (normalized.includes("growth")) return 72;
  if (normalized.includes("aggressive")) return 86;

  return 55;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    riskProfile?: string;
    liquidityNeeds?: string;
    timeHorizon?: string;
    concentrationLevel?: string;
    altExposure?: string;
    debtConcern?: string;
    notes?: string;
  };

  if (!body.clientId) {
    return NextResponse.json(
      { error: "Client ID is required." },
      { status: 400 }
    );
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id: body.clientId,
      userId: user.id,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const flags: string[] = [];
  let score = riskBaseScore(body.riskProfile || client.riskProfile);

  const liquidity = (body.liquidityNeeds || client.liquidityNeeds).toLowerCase();
  const horizon = (body.timeHorizon || client.timeHorizon).toLowerCase();
  const concentration = (body.concentrationLevel || "").toLowerCase();
  const altExposure = (body.altExposure || "").toLowerCase();
  const debtConcern = (body.debtConcern || "").toLowerCase();

  if (liquidity.includes("high")) {
    score -= 18;
    flags.push("High liquidity need may conflict with illiquid or volatile assets.");
  }

  if (horizon.includes("10") || horizon.includes("long")) {
    score += 8;
  }

  if (concentration.includes("high")) {
    score += 8;
    flags.push("High concentration risk should be reviewed.");
  }

  if (altExposure.includes("high")) {
    score += 10;
    flags.push("High alternative investment exposure requires added review.");
  }

  if (debtConcern.includes("yes") || debtConcern.includes("high")) {
    score -= 10;
    flags.push("Debt or liability concern may reduce risk capacity.");
  }

  score = Math.max(0, Math.min(100, score));

  let suitabilityStatus = "Balanced / Review";
  if (score < 40) suitabilityStatus = "Conservative";
  if (score >= 70) suitabilityStatus = "Growth-Oriented";
  if (score >= 85) suitabilityStatus = "Aggressive / High Review";

  const summary = [
    `${client.fullName} currently maps to a ${suitabilityStatus} profile with a score of ${score}/100.`,
    flags.length
      ? `Review flags: ${flags.join(" ")}`
      : "No major risk flags were generated from this review.",
    body.notes ? `Advisor note: ${body.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const review = await prisma.riskReview.create({
    data: {
      clientId: client.id,
      score,
      suitabilityStatus,
      summary,
      flagsJson: JSON.stringify(flags),
    },
  });

  return NextResponse.json({ review });
}