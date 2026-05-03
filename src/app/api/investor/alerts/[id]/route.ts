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
    status?: string;
  };

  const status = body.status || "Read";

  await prisma.alertEvent.updateMany({
    where: { id, userId: user.id },
    data: {
      status,
      readAt: status === "Read" ? new Date() : null,
    },
  });

  const alert = await prisma.alertEvent.findFirst({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ alert });
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

  await prisma.alertEvent.deleteMany({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}