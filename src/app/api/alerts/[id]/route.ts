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
    channel?: string;
    trigger?: string;
    isActive?: boolean;
  };

  const data: {
    title?: string;
    channel?: string;
    trigger?: string | null;
    isActive?: boolean;
  } = {};

  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.channel === "string") data.channel = body.channel;
  if (typeof body.trigger === "string") data.trigger = body.trigger;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  await prisma.alertRule.updateMany({
    where: {
      id,
      userId: user.id,
    },
    data,
  });

  const alert = await prisma.alertRule.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({
    alert,
  });
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

  await prisma.alertRule.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({
    ok: true,
  });
}