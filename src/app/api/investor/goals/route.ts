import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const goals = await prisma.investorGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    goalType?: string;
    targetAmount?: string;
    currentAmount?: string;
    targetDate?: string;
    priority?: string;
    notes?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "Goal title is required." },
      { status: 400 }
    );
  }

  const goal = await prisma.investorGoal.create({
    data: {
      userId: user.id,
      title: body.title.trim(),
      goalType: body.goalType?.trim() || "Wealth Growth",
      targetAmount: body.targetAmount?.trim() || null,
      currentAmount: body.currentAmount?.trim() || null,
      targetDate: body.targetDate?.trim() || null,
      priority: body.priority?.trim() || "Medium",
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({ goal });
}