import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIntegrationStatuses } from "@/lib/env";
import { generateAiText, parseSliceCommandWithAi } from "@/lib/integrations/ai";
import { sendEmail } from "@/lib/integrations/email";
import { fetchMarketQuote } from "@/lib/integrations/market";
import { sendSms } from "@/lib/integrations/sms";
import { uploadBackendBlob } from "@/lib/integrations/storage";

export const dynamic = "force-dynamic";

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    integrations: getIntegrationStatuses(),
    aiCommandLayer: {
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-5",
      structuredCommandParsing: true,
      approvalGates: true,
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "testMarket") {
    const symbol = readText(body.symbol, "NVDA").toUpperCase();
    const quote = await fetchMarketQuote(symbol);

    return NextResponse.json({
      action,
      quote,
    });
  }

  if (action === "testAi") {
    const result = await generateAiText({
      safetyIdentifier: user.email,
      prompt:
        "Return a concise confirmation that Slice AI integration is connected. Keep it under 20 words.",
    });

    return NextResponse.json({
      action,
      result,
    });
  }

  if (action === "testAiCommand") {
    const prompt = readText(body.prompt, "Open market visuals");

    const result = await parseSliceCommandWithAi({
      prompt,
      userName: user.name,
      userEmail: user.email,
      firmName: "Integration Test Firm",
      botName: "Slice Bot",
      memory: ["User wants precise fintech workflow execution."],
      openTasks: 2,
      unreadAlerts: 3,
      clients: 4,
      portfolioValue: 1000000,
    });

    return NextResponse.json({
      action,
      result,
    });
  }

  if (action === "testEmail") {
    const to = readText(body.to, user.email);
    const result = await sendEmail({
      to,
      subject: "Slice email integration test",
      text: "This is a Slice backend email integration test.",
      idempotencyKey: `test-email-${Date.now()}`,
    });

    return NextResponse.json({
      action,
      result,
    });
  }

  if (action === "testSms") {
    const to = readText(body.to);

    if (!to) {
      return NextResponse.json(
        { error: "Phone number is required for SMS test." },
        { status: 400 }
      );
    }

    const result = await sendSms({
      to,
      body: "Slice backend SMS integration test.",
    });

    return NextResponse.json({
      action,
      result,
    });
  }

  if (action === "testBlob") {
    const result = await uploadBackendBlob({
      pathname: `slice-tests/integration-${Date.now()}.txt`,
      body: `Slice Blob integration test created at ${new Date().toISOString()}`,
      contentType: "text/plain",
      access: "private",
    });

    return NextResponse.json({
      action,
      result,
    });
  }

  if (action === "testAll") {
    const market = await fetchMarketQuote("NVDA");
    const ai = await generateAiText({
      safetyIdentifier: user.email,
      prompt: "Confirm Slice AI is connected in exactly one short sentence.",
    });
    const aiCommand = await parseSliceCommandWithAi({
      prompt: "Create a price alert for NVDA above 1000",
      userName: user.name,
      userEmail: user.email,
      firmName: "Integration Test Firm",
      botName: "Slice Bot",
    });
    const email = await sendEmail({
      to: user.email,
      subject: "Slice full integration test",
      text: "This is a simulated or live Slice email integration test depending on ENABLE_LIVE_EMAIL.",
      idempotencyKey: `test-all-email-${Date.now()}`,
    });
    const blob = await uploadBackendBlob({
      pathname: `slice-tests/full-integration-${Date.now()}.txt`,
      body: `Slice full integration test created at ${new Date().toISOString()}`,
      contentType: "text/plain",
      access: "private",
    });

    return NextResponse.json({
      action,
      results: {
        market,
        ai,
        aiCommand,
        email,
        blob,
      },
    });
  }

  return NextResponse.json({ error: "Unknown integration action." }, { status: 400 });
}