import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runAutonomousTriageForUser } from "@/lib/autonomous-triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return fallback;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);

  const result = await runAutonomousTriageForUser({
    userId: user.id,
    triggeredBy: "manual",
    forceDemo: readBoolean(url.searchParams.get("demo"), false),
    autonomousEmail: readBoolean(url.searchParams.get("email"), true),
    aiResearch: readBoolean(url.searchParams.get("aiResearch"), true),
    noiseFloor: readNumber(url.searchParams.get("noiseFloor")),
    alertFloor: readNumber(url.searchParams.get("alertFloor")),
  });

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}