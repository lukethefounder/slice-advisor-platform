import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureBotProfile } from "@/lib/bot/command-router";
import { getPlatformBrainContext } from "@/lib/bot/platform-brain";
import { matchFastCommand } from "@/lib/bot/fast-command-router";

export const dynamic = "force-dynamic";

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const prompt = readText(body.prompt);

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  await ensureBotProfile(user);

  const platformBrain = await getPlatformBrainContext(user.id);
  const match = matchFastCommand({
    prompt,
    platformBrain,
  });

  return NextResponse.json({
    prompt,
    matched: Boolean(match),
    fastMatch: match,
  });
}