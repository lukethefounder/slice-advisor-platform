import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  await prisma.investorGoal.updateMany({
    where: { id, userId: user.id },
    data: {
      title: typeof body.title === "string" ? body.title : undefined,
      goalType: typeof body.goalType === "string" ? body.goalType : undefined,
      targetAmount:
        typeof body.targetAmount === "string" ? body.targetAmount : undefined,
      currentAmount:
        typeof body.currentAmount === "string" ? body.currentAmount : undefined,
      targetDate:
        typeof body.targetDate === "string" ? body.targetDate : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
  });

  const goal = await prisma.investorGoal.findFirst({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ goal });
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

  await prisma.investorGoal.deleteMany({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}