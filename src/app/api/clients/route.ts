import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const clients = await prisma.clientProfile.findMany({
    where: { userId: user.id },
    include: {
      holdings: true,
      notesList: {
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    fullName?: string;
    email?: string;
    householdName?: string;
    clientType?: string;
    riskProfile?: string;
    liquidityNeeds?: string;
    timeHorizon?: string;
    objective?: string;
    portfolioValue?: string;
    status?: string;
    notes?: string;
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json(
      { error: "Client full name is required." },
      { status: 400 }
    );
  }

  const client = await prisma.clientProfile.create({
    data: {
      userId: user.id,
      fullName: body.fullName.trim(),
      email: body.email?.trim() || null,
      householdName: body.householdName?.trim() || null,
      clientType: body.clientType?.trim() || "Private Client",
      riskProfile: body.riskProfile?.trim() || "Balanced",
      liquidityNeeds: body.liquidityNeeds?.trim() || "Moderate",
      timeHorizon: body.timeHorizon?.trim() || "5-10 years",
      objective: body.objective?.trim() || "Long-term wealth growth",
      portfolioValue: body.portfolioValue?.trim() || null,
      status: body.status?.trim() || "Active",
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({ client });
}