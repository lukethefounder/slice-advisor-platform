import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  enforceStorageLimits,
  ensureIntelligenceSettings,
} from "@/lib/intelligence-settings";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { policy } = await ensureIntelligenceSettings(user.id);
  const result = await enforceStorageLimits(user.id, policy);

  return NextResponse.json({
    ok: true,
    result,
  });
}