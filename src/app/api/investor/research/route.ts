import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const notes = await prisma.researchNote.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    ticker?: string;
    title?: string;
    thesis?: string;
    risks?: string;
    decision?: string;
    conviction?: string;
    sourceLinks?: string;
  };

  if (!body.title?.trim() || !body.thesis?.trim()) {
    return NextResponse.json(
      { error: "Research title and thesis are required." },
      { status: 400 }
    );
  }

  const note = await prisma.researchNote.create({
    data: {
      userId: user.id,
      ticker: body.ticker?.trim().toUpperCase() || null,
      title: body.title.trim(),
      thesis: body.thesis.trim(),
      risks: body.risks?.trim() || null,
      decision: body.decision?.trim() || "Watch",
      conviction: body.conviction?.trim() || "Medium",
      sourceLinks: body.sourceLinks?.trim() || null,
    },
  });

  return NextResponse.json({ note });
}