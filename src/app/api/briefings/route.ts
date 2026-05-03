import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateBriefingReport } from "@/lib/briefing-engine";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const reports = await prisma.briefingReport.findMany({
    where: { userId: user.id },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    audience?: "Investor" | "Advisor" | "Client";
    briefType?: "Daily" | "Weekly" | "Client Meeting" | "Portfolio Review";
    clientId?: string;
  };

  const report = await generateBriefingReport({
    userId: user.id,
    audience: body.audience ?? "Investor",
    briefType: body.briefType ?? "Daily",
    clientId: body.clientId || undefined,
  });

  return NextResponse.json({ report });
}