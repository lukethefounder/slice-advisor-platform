import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const projects = await prisma.ventureProject.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    projects,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    founder?: string;
    sector?: string;
    stage?: string;
    relationship?: string;
    thesis?: string;
    risk?: string;
  };

  if (!body.name?.trim() || !body.founder?.trim()) {
    return NextResponse.json(
      { error: "Startup name and founder name are required." },
      { status: 400 }
    );
  }

  const project = await prisma.ventureProject.create({
    data: {
      userId: user.id,
      name: body.name.trim(),
      founder: body.founder.trim(),
      sector: body.sector?.trim() || "Uncategorized",
      stage: body.stage?.trim() || "Unknown stage",
      relationship: body.relationship?.trim() || "Known personally",
      thesis: body.thesis?.trim() || "No thesis added yet.",
      risk: body.risk?.trim() || "High-risk private venture opportunity.",
    },
  });

  return NextResponse.json({
    project,
  });
}