import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const alerts = await prisma.alertEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    source?: string;
    ticker?: string;
    urgency?: string;
    score?: number;
    channel?: string;
  };

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "Alert title and body are required." },
      { status: 400 }
    );
  }

  const dedupeKey = `${body.source ?? "manual"}:${body.ticker ?? "general"}:${body.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 180);

  const alert = await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId: user.id,
        dedupeKey,
      },
    },
    update: {},
    create: {
      userId: user.id,
      dedupeKey,
      title: body.title.trim(),
      body: body.body.trim(),
      source: body.source?.trim() || "Manual",
      ticker: body.ticker?.trim().toUpperCase() || null,
      urgency: body.urgency?.trim() || "Medium",
      score: typeof body.score === "number" ? body.score : 50,
      channel: body.channel?.trim() || "Dashboard",
    },
  });

  return NextResponse.json({ alert });
}