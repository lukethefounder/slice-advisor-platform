import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tasks = await prisma.meetingTask.findMany({
    where: { userId: user.id },
    include: {
      client: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    priority?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: "Task title is required." },
      { status: 400 }
    );
  }

  if (body.clientId) {
    const client = await prisma.clientProfile.findFirst({
      where: {
        id: body.clientId,
        userId: user.id,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
  }

  const task = await prisma.meetingTask.create({
    data: {
      userId: user.id,
      clientId: body.clientId || null,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      priority: body.priority?.trim() || "Medium",
    },
  });

  return NextResponse.json({ task });
}