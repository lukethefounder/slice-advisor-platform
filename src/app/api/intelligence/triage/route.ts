import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [decisions, runs] = await Promise.all([
    prisma.headlineDecision.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.intelligenceRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ decisions, runs });
}