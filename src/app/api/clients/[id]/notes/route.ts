import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;

  const client = await prisma.clientProfile.findFirst({
    where: { id, userId: user.id },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    noteType?: string;
  };

  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "Note title and body are required." },
      { status: 400 }
    );
  }

  const note = await prisma.advisorNote.create({
    data: {
      userId: user.id,
      clientId: id,
      title: body.title.trim(),
      body: body.body.trim(),
      noteType: body.noteType?.trim() || "General",
    },
  });

  return NextResponse.json({ note });
}