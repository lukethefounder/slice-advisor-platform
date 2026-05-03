import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const alertCount = await prisma.alertEvent.count();
    const decisionCount = await prisma.headlineDecision.count();

    return NextResponse.json({
      ok: true,
      database: "connected",
      timestamp: new Date().toISOString(),
      counts: {
        users: userCount,
        alerts: alertCount,
        retainedDecisions: decisionCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        detail: error instanceof Error ? error.message : "Unknown health error",
      },
      { status: 500 }
    );
  }
}