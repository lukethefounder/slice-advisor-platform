import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const client = await prisma.clientProfile.findFirst({
    where: {
      id,
      userId: user.id,
    },
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
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ client });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  await prisma.clientProfile.updateMany({
    where: {
      id,
      userId: user.id,
    },
    data: {
      fullName: typeof body.fullName === "string" ? body.fullName : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      householdName:
        typeof body.householdName === "string" ? body.householdName : undefined,
      clientType:
        typeof body.clientType === "string" ? body.clientType : undefined,
      riskProfile:
        typeof body.riskProfile === "string" ? body.riskProfile : undefined,
      liquidityNeeds:
        typeof body.liquidityNeeds === "string"
          ? body.liquidityNeeds
          : undefined,
      timeHorizon:
        typeof body.timeHorizon === "string" ? body.timeHorizon : undefined,
      objective: typeof body.objective === "string" ? body.objective : undefined,
      portfolioValue:
        typeof body.portfolioValue === "string"
          ? body.portfolioValue
          : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
  });

  const client = await prisma.clientProfile.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({ client });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  await prisma.clientProfile.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}