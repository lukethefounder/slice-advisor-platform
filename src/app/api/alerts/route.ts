import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const alerts = await prisma.alertRule.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    alerts,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    channel?: string;
    trigger?: string;
  };

  if (!body.title?.trim() || !body.channel?.trim()) {
    return NextResponse.json(
      { error: "Title and channel are required." },
      { status: 400 }
    );
  }

  const alert = await prisma.alertRule.create({
    data: {
      userId: user.id,
      title: body.title.trim(),
      channel: body.channel.trim(),
      trigger: body.trigger?.trim() || null,
    },
  });

  return NextResponse.json({
    alert,
  });
}