import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateOpportunitySignals,
  getOpportunityRadar,
} from "@/lib/opportunity-engine";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const radar = await getOpportunityRadar(user.id);

  return NextResponse.json(radar);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: "generate" | "updateStatus";
    signalId?: string;
    status?: string;
  };

  if (body.action === "generate") {
    const result = await generateOpportunitySignals(user.id);
    return NextResponse.json(result);
  }

  if (body.action === "updateStatus") {
    if (!body.signalId || !body.status) {
      return NextResponse.json(
        { error: "Signal ID and status are required." },
        { status: 400 }
      );
    }

    const signal = await prisma.opportunitySignal.updateMany({
      where: {
        id: body.signalId,
        userId: user.id,
      },
      data: {
        status: body.status,
      },
    });

    return NextResponse.json({ signal });
  }

  return NextResponse.json(
    { error: "Unknown opportunity action." },
    { status: 400 }
  );
}