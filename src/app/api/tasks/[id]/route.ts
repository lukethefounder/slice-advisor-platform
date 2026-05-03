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
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
  };

  await prisma.meetingTask.updateMany({
    where: {
      id,
      userId: user.id,
    },
    data: {
      title: typeof body.title === "string" ? body.title : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      dueDate:
        typeof body.dueDate === "string" && body.dueDate
          ? new Date(body.dueDate)
          : undefined,
    },
  });

  const task = await prisma.meetingTask.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({ task });
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

  await prisma.meetingTask.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}