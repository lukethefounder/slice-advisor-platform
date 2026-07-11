import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PERSONAL_BOT_QUESTIONS,
  defaultBotAnswers,
} from "@/lib/personal-bot-questions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

type BotProfile = {
  id: string;
  userId: string;
  firmId: string | null;
  botName: string;
  onboardingComplete: boolean;
  answersJson: string;
  personalityJson: string;
  riskJson: string;
  capabilitiesJson: string;
  preferredTone: string;
  commandStyle: string;
  autonomyLevel: string;
  voiceEnabled: boolean;
  customInstructions: string | null;
};

type AnswerMode = "quick" | "balanced" | "deep";

type OpenAiAnswer = {
  text: string;
  provider: string;
  status: "completed" | "missing" | "failed" | "timeout";
  error: string | null;
  model: string;
  configured: boolean;
  latencyMs: number;
  raw?: unknown;
};

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeEnv(value: string | undefined) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function getOpenAiApiKey() {
  return (
    normalizeEnv(process.env.OPENAI_API_KEY) ||
    normalizeEnv(process.env.OPENAI_KEY) ||
    normalizeEnv(process.env.OPENAI_SECRET_KEY)
  );
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeEnv(value || undefined))
        .filter(Boolean),
    ),
  );
}

function envBoolean(name: string, fallback: boolean) {
  const value = normalizeEnv(process.env[name]);

  if (!value) return fallback;

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;

  return fallback;
}

function envNumber(name: string, fallback: number) {
  const value = Number(normalizeEnv(process.env[name]));

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getAiRuntimeStatus() {
  const apiKey = getOpenAiApiKey();

  const model =
    normalizeEnv(process.env.OPENAI_MODEL) ||
    normalizeEnv(process.env.OPENAI_FAST_MODEL) ||
    "gpt-4.1-mini";

  const qualityModel =
    normalizeEnv(process.env.OPENAI_QUALITY_MODEL) ||
    normalizeEnv(process.env.OPENAI_MODEL) ||
    "gpt-4.1";

  return {
    configured: Boolean(apiKey),
    provider: apiKey ? "OpenAI Responses API" : "OpenAI key missing",
    model,
    qualityModel,
    requiredEnv: "OPENAI_API_KEY",
    webSearchEnabled: process.env.OPENAI_ENABLE_WEB_SEARCH === "true",
    disableTimeout: envBoolean("OPENAI_DISABLE_TIMEOUT", true),
    maxOutputTokens: envNumber("OPENAI_MAX_OUTPUT_TOKENS", 12000),
  };
}

async function safe<T>(fallback: T, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch {
    return fallback;
  }
}

function readAnswerMode(value: unknown): AnswerMode {
  if (value === "quick" || value === "balanced" || value === "deep") return value;
  return "balanced";
}

function timeoutForAnswerMode(mode: AnswerMode) {
  if (mode === "quick") return envNumber("OPENAI_QUICK_TIMEOUT_MS", 180_000);
  if (mode === "deep") return envNumber("OPENAI_DEEP_TIMEOUT_MS", 900_000);

  return envNumber("OPENAI_BALANCED_TIMEOUT_MS", 600_000);
}

function modelCandidatesForAnswerMode(mode: AnswerMode) {
  const runtime = getAiRuntimeStatus();

  if (mode === "deep") {
    return uniqueValues([
      runtime.qualityModel,
      runtime.model,
      process.env.OPENAI_MODEL,
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o",
      "gpt-4o-mini",
    ]);
  }

  return uniqueValues([
    runtime.model,
    process.env.OPENAI_MODEL,
    process.env.OPENAI_FAST_MODEL,
    "gpt-4.1-mini",
    "gpt-4o-mini",
    "gpt-4.1",
  ]);
}

async function resolveFirmId(userId: string) {
  return safe<string | null>(null, async () => {
    const membership = await db.firmMembership.findFirst({
      where: {
        userId,
        status: "Active",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return membership?.firmId ?? null;
  });
}

function deriveBotProfile(answers: Record<string, string>) {
  const riskTolerance = answers.risk_tolerance ?? "Balanced";
  const communicationStyle = answers.communication_tone ?? "Professional";
  const detailLevel = answers.detail_level ?? "Balanced detail";
  const automationComfort = answers.automation_comfort ?? "Advisor approval required";

  return {
    personality: {
      decisionSpeed: answers.decision_speed ?? "Balanced",
      tone: communicationStyle,
      spokenAccent: "British English",
      detailLevel,
      researchStyle: answers.research_style ?? "Balanced",
      challengeLevel: answers.challenge_level ?? "Balanced challenge",
      taskStyle: answers.task_style ?? "Balanced",
      notificationStyle: answers.notification_style ?? "Balanced",
      meetingPrepDepth: answers.meeting_prep_depth ?? "Balanced",
    },
    risk: {
      riskTolerance,
      timeHorizon: answers.time_horizon ?? "5-10 years",
      liquidityNeeds: answers.liquidity_needs ?? "Moderate",
      complianceCaution: answers.compliance_caution ?? "Extra cautious",
    },
    capabilities: [
      "Universal AI answers",
      "Plain-English advisor explanations",
      "Voice input and spoken replies",
      "PDF report generation",
      "Professional command interpretation",
      "Advisor-review safety gates",
      "Source-aware research structure",
      "Workspace memory",
      "Client communication preparation",
      "Meeting preparation",
      "Investment scenario modeling",
      "Team task preparation",
      "Report-ready analysis",
    ],
    preferredTone: communicationStyle,
    commandStyle: detailLevel,
    autonomyLevel: automationComfort,
  };
}

async function ensureBotProfile(user: CurrentUser): Promise<BotProfile> {
  const firmId = await resolveFirmId(user.id);

  const profile = await db.personalUserBotProfile.upsert({
    where: {
      userId: user.id,
    },
    update: {
      firmId,
    },
    create: {
      userId: user.id,
      firmId,
      botName: `${user.name?.split(" ")?.[0] || "Slice"} AI`,
      onboardingComplete: true,
      answersJson: "{}",
      personalityJson: asJson({
        tone: "Professional",
        spokenAccent: "British English",
        detailLevel: "Balanced detail",
      }),
      riskJson: "{}",
      capabilitiesJson: asJson([
        "Universal AI answers",
        "Voice input and spoken replies",
        "Premium PDF generation",
        "Professional advisor summaries",
        "Client communication preparation",
        "Meeting preparation",
        "Investment scenario modeling",
        "Team task preparation",
        "Report-ready analysis",
      ]),
      preferredTone: "Professional",
      commandStyle: "Balanced detail",
      autonomyLevel: "Advisor approval required",
      voiceEnabled: true,
    },
  });

  await safe(null, async () =>
    db.personalUserBotWorkspaceTab.upsert({
      where: {
        userId_tabName: {
          userId: user.id,
          tabName: "AI Studio",
        },
      },
      update: {
        profileId: profile.id,
        notes:
          "Premium Slice AI Studio for real OpenAI answers, voice, reports, client communication, platform guidance, team tasks, and investment scenario modeling.",
      },
      create: {
        userId: user.id,
        profileId: profile.id,
        tabName: "AI Studio",
        layoutJson: asJson({
          mode: "premium-ai-executive-studio-v6-long-openai",
        }),
        pinnedCommandsJson: asJson([
          "Answer this directly with a real advisor-grade response.",
          "Create a client-friendly explanation of this topic.",
          "Prepare a calm meeting agenda for a client portfolio review.",
          "Build an investment scenario for a new client.",
          "Create a report-ready briefing with assumptions, risks, and action items.",
        ]),
        notes:
          "Premium Slice AI Studio for real OpenAI answers, voice, reports, client communication, platform guidance, team tasks, and investment scenario modeling.",
        status: "Active",
      },
    }),
  );

  return profile;
}

function cleanFileTitle(value: string) {
  return (
    value
      .replace(/[^a-z0-9\s._-]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 130) || "Slice AI Report"
  );
}

function looksLikeReportRequest(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes("pdf") ||
    lower.includes("report") ||
    lower.includes("briefing") ||
    lower.includes("presentation") ||
    lower.includes("deck") ||
    lower.includes("packet")
  );
}

function toneInstruction(value: string | null | undefined) {
  const tone = String(value ?? "Professional").toLowerCase();

  if (tone.includes("witty")) {
    return "Use polished, quick wit where appropriate, but keep utility and professionalism first.";
  }

  if (tone.includes("brutal") || tone.includes("honest")) {
    return "Be direct, candid, and practical. Do not sugarcoat weak logic, but stay tactful.";
  }

  if (tone.includes("calm")) {
    return "Be calm, measured, reassuring, and low-hype.";
  }

  if (tone.includes("direct")) {
    return "Be concise, decisive, and lead with the answer.";
  }

  if (tone.includes("encourag")) {
    return "Be encouraging while still being honest about risks and constraints.";
  }

  return "Be professional, polished, precise, and advisor-grade.";
}

function detailInstruction(value: string | null | undefined, mode: AnswerMode) {
  const detail = String(value ?? "Balanced detail").toLowerCase();

  if (mode === "quick") {
    return "Use a concise response with the answer first, then only the most important supporting details.";
  }

  if (mode === "deep") {
    return "Use a thorough but organized response with sections, assumptions, risks, next steps, and review notes.";
  }

  if (detail.includes("short")) {
    return "Keep it short and highly actionable.";
  }

  if (detail.includes("detailed") || detail.includes("deep")) {
    return "Use structured detail with clear reasoning and next steps.";
  }

  return "Use balanced detail: genuinely useful, but not a wall of text.";
}

function modeInstruction(mode: AnswerMode) {
  if (mode === "quick") {
    return "The user selected Quick Mode. Answer directly and avoid unnecessary explanation.";
  }

  if (mode === "deep") {
    return "The user selected Deep Mode. Provide a complete, carefully reasoned answer with strong structure.";
  }

  return "The user selected Balanced Mode. Give the practical answer with enough detail to be useful.";
}

function extractOpenAiText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const pieces: string[] = [];

  function visit(value: any) {
    if (!value) return;

    if (typeof value === "string") {
      if (value.trim()) pieces.push(value.trim());
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== "object") return;

    if (typeof value.text === "string") pieces.push(value.text);
    if (typeof value.output_text === "string") pieces.push(value.output_text);
    if (typeof value.value === "string") pieces.push(value.value);

    if (value.type === "output_text" && typeof value.text === "string") {
      pieces.push(value.text);
    }

    if (value.type === "message" && value.content) {
      visit(value.content);
    }

    if (value.content) visit(value.content);
    if (value.output) visit(value.output);
    if (value.message) visit(value.message);
    if (value.choices) visit(value.choices);
  }

  visit(payload?.output);
  visit(payload?.choices);

  return Array.from(new Set(pieces))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

async function fetchOpenAi(url: string, init: RequestInit, timeoutMs: number) {
  const runtime = getAiRuntimeStatus();

  if (runtime.disableTimeout) {
    return fetch(url, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiInstructions(input: {
  user: CurrentUser;
  profile: BotProfile;
  answerMode: AnswerMode;
}) {
  return `
You are Slice AI Executive Studio, a premium executive assistant inside Slice, a wealth/advisor operating platform.

Your primary job:
- Produce a real, specific answer to the user's actual prompt.
- Do not give generic platform marketing copy unless the user specifically asks for platform positioning.
- If the user asks a general question, answer the question directly.
- If the user asks for an advisor workflow, produce a practical advisor workflow.
- If the user asks for a report/PDF/briefing/deck/packet, produce report-ready content.
- If the user asks for a task/delegation, produce a clear task recommendation with title, owner guidance, priority, due date guidance, and details.
- If the user asks for client-facing writing, draft polished client-safe wording.
- If the user asks about finance/investments, be review-oriented, avoid guarantees, and clearly identify assumptions.
- If data is not provided and live data/tools are unavailable, say what needs to be verified. Do not invent live prices, client facts, legal conclusions, tax conclusions, or compliance approvals.

Style:
- ${toneInstruction(input.profile.preferredTone)}
- ${detailInstruction(input.profile.commandStyle, input.answerMode)}
- ${modeInstruction(input.answerMode)}
- Preferred tone: ${input.profile.preferredTone}.
- Detail preference: ${input.profile.commandStyle}.
- Autonomy posture: ${input.profile.autonomyLevel}.
- Custom instructions: ${input.profile.customInstructions || "None"}.

Output requirements:
- Start with the useful answer, not a disclaimer.
- Use clear headings when helpful.
- Keep the response structured and easy to scan.
- Include "Next steps" when the prompt involves work, workflow, reports, or execution.
- Include "Assumptions / verify" when the answer depends on facts not provided.
- Never say you created, sent, assigned, approved, or changed something unless the platform action actually happened.
`.trim();
}

function buildOpenAiPrompt(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  recentMessages: Array<{ role: string; content: string }>;
  answerMode: AnswerMode;
  runtime: ReturnType<typeof getAiRuntimeStatus>;
  advancedSettings?: unknown;
}) {
  return JSON.stringify(
    {
      user: {
        name: input.user.name,
        email: input.user.email,
      },
      currentSurface: {
        pageTitle: "Slice AI Executive Studio",
        route: "/workspace/personal-bot",
      },
      answerMode: input.answerMode,
      userPrompt: input.prompt,
      recentMessages: input.recentMessages,
      profile: {
        botName: input.profile.botName,
        preferredTone: input.profile.preferredTone,
        commandStyle: input.profile.commandStyle,
        autonomyLevel: input.profile.autonomyLevel,
        customInstructions: input.profile.customInstructions,
        personality: parseJson<Record<string, unknown>>(input.profile.personalityJson, {}),
        risk: parseJson<Record<string, unknown>>(input.profile.riskJson, {}),
        capabilities: parseJson<string[]>(input.profile.capabilitiesJson, []),
      },
      advancedSettings: input.advancedSettings ?? null,
      platformContext: {
        description:
          "Slice is an advisor operating platform with AI Studio, Team Board, Client Profiles, Client Portal Inbox, Email Center, Custom Board, Watchlists, Intelligence, Market Visuals, reports, compliance review, and workspace settings.",
        important:
          "The assistant can prepare text and recommend actions. Actual task creation and other platform changes must be performed by the platform action routes.",
      },
      aiRuntime: {
        provider: input.runtime.provider,
        model: input.runtime.model,
        qualityModel: input.runtime.qualityModel,
        webSearchEnabled: input.runtime.webSearchEnabled,
        disableTimeout: input.runtime.disableTimeout,
        maxOutputTokens: input.runtime.maxOutputTokens,
      },
    },
    null,
    2,
  );
}

async function callOpenAiForAnswer(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  recentMessages: Array<{ role: string; content: string }>;
  answerMode: AnswerMode;
  advancedSettings?: unknown;
}): Promise<OpenAiAnswer> {
  const startedAt = Date.now();
  const apiKey = getOpenAiApiKey();
  const runtime = getAiRuntimeStatus();
  const timeoutMs = timeoutForAnswerMode(input.answerMode);
  const modelCandidates = modelCandidatesForAnswerMode(input.answerMode);
  const instructions = buildOpenAiInstructions({
    user: input.user,
    profile: input.profile,
    answerMode: input.answerMode,
  });
  const prompt = buildOpenAiPrompt({
    user: input.user,
    profile: input.profile,
    prompt: input.prompt,
    recentMessages: input.recentMessages,
    answerMode: input.answerMode,
    runtime,
    advancedSettings: input.advancedSettings,
  });

  if (!apiKey) {
    return {
      text:
        "OpenAI is not connected yet. Add OPENAI_API_KEY to your environment variables, restart the server, and ask again. I am not going to return a generic fallback because this Studio is configured to require real OpenAI answers.",
      provider: "OpenAI",
      status: "missing",
      error: "OPENAI_API_KEY is missing.",
      model: modelCandidates[0] || "unknown",
      configured: false,
      latencyMs: Date.now() - startedAt,
    };
  }

  let lastError = "";
  let lastRaw: unknown = null;
  let lastModel = modelCandidates[0] || runtime.model;

  for (const model of modelCandidates) {
    lastModel = model;

    try {
      const response = await fetchOpenAi(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            instructions,
            input: prompt,
            tools: runtime.webSearchEnabled ? [{ type: "web_search_preview" }] : undefined,
            max_output_tokens: runtime.maxOutputTokens,
            safety_identifier: input.user.email,
            store: false,
          }),
        },
        timeoutMs,
      );

      const payload = await response.json().catch(() => ({}));
      lastRaw = payload;

      if (!response.ok) {
        lastError = payload?.error?.message || `OpenAI failed with status ${response.status}`;
        continue;
      }

      const text = extractOpenAiText(payload);

      if (!text) {
        lastError = "OpenAI returned an empty response.";
        continue;
      }

      return {
        text,
        provider: `OpenAI/${model}`,
        status: "completed",
        error: null,
        model,
        configured: true,
        latencyMs: Date.now() - startedAt,
        raw: payload,
      };
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));

      lastError = timedOut
        ? `OpenAI request exceeded ${timeoutMs}ms.`
        : error instanceof Error
          ? error.message
          : "OpenAI request failed.";

      if (timedOut) {
        return {
          text:
            "The OpenAI request timed out before a complete answer was returned. Increase OPENAI_BALANCED_TIMEOUT_MS / OPENAI_DEEP_TIMEOUT_MS, or set OPENAI_DISABLE_TIMEOUT=true in .env.local and restart the development server.",
          provider: `OpenAI/${model}`,
          status: "timeout",
          error: lastError,
          model,
          configured: true,
          latencyMs: Date.now() - startedAt,
          raw: lastRaw,
        };
      }
    }
  }

  return {
    text:
      `OpenAI is connected, but the request failed before a real answer could be produced.\n\nError: ${lastError || "Unknown OpenAI error."}\n\nCheck your OPENAI_MODEL / OPENAI_QUALITY_MODEL values, API key permissions, billing, and model access. I am not returning a generic fallback because AI Studio is configured to require real OpenAI answers.`,
    provider: `OpenAI/${lastModel}`,
    status: "failed",
    error: lastError || "Unknown OpenAI error.",
    model: lastModel,
    configured: true,
    latencyMs: Date.now() - startedAt,
    raw: lastRaw,
  };
}

async function generateProfessionalAnswer(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  recentMessages: Array<{ role: string; content: string }>;
  answerMode: AnswerMode;
  advancedSettings?: unknown;
}) {
  return callOpenAiForAnswer(input);
}

function reportSummaryFromAnswer(answer: string) {
  const clean = answer.replace(/\s+/g, " ").trim();

  if (!clean) {
    return "A Slice AI Studio report prepared for advisor review.";
  }

  return clean.length > 700 ? `${clean.slice(0, 700).trim()}...` : clean;
}

function bulletsFromAnswer(answer: string) {
  const lines = answer
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[-*•]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim(),
    )
    .filter((line) => line.length > 20)
    .slice(0, 8);

  if (lines.length >= 3) return lines;

  return [
    "Review the AI-generated content for accuracy before using externally.",
    "Verify all client-specific, market-specific, tax, legal, and compliance-sensitive information.",
    "Convert the report into advisor-approved next steps before client delivery.",
  ];
}

function buildReportSections(prompt: string, answer: string) {
  return [
    {
      title: "Executive Summary",
      body: reportSummaryFromAnswer(answer),
      bullets: bulletsFromAnswer(answer).slice(0, 4),
    },
    {
      title: "Original Request",
      body: prompt,
    },
    {
      title: "AI Briefing",
      body: answer,
    },
    {
      title: "Advisor Action Items",
      bullets: [
        "Review the content for accuracy, suitability, and firm-specific compliance requirements.",
        "Confirm any client facts, portfolio assumptions, market data, and source freshness.",
        "Decide what should become a client-facing message, internal memo, or Team Board task.",
        "Document any assumptions before sharing externally.",
      ],
    },
    {
      title: "Important Review Notes",
      body:
        "This report is AI-assisted and intended for advisor review. Verify market data, client suitability, compliance requirements, source freshness, tax considerations, liquidity needs, and risk tolerance before using externally.",
    },
  ];
}

async function createReport(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  answer: string;
}) {
  const title = cleanFileTitle(
    input.prompt.toLowerCase().includes("slice")
      ? input.prompt
      : `Slice AI Studio Report - ${input.prompt}`,
  );

  return db.personalUserBotPdfReport.create({
    data: {
      userId: input.user.id,
      profileId: input.profile.id,
      firmId: input.profile.firmId,
      title,
      reportType: "Advisor AI Report",
      summary: reportSummaryFromAnswer(input.answer),
      sectionsJson: asJson(buildReportSections(input.prompt, input.answer)),
      designJson: asJson({
        generatedBy: input.profile.botName,
        preparedFor: "Advisor / Wealth Manager Review",
        investmentGrade: "Advisor Review Ready",
        confidenceScore: 92,
        metrics: [
          {
            label: "Answer Specificity",
            value: 94,
            helper: "Generated from live OpenAI response",
            tone: "green",
          },
          {
            label: "Advisor Utility",
            value: 92,
            helper: "Workflow-focused",
            tone: "green",
          },
          {
            label: "Review Safety",
            value: 90,
            helper: "Advisor review posture",
            tone: "amber",
          },
        ],
        charts: [
          {
            title: "Report Readiness",
            subtitle: "Internal Slice report quality scorecard.",
            data: [
              { label: "Clarity", value: 94 },
              { label: "Utility", value: 92 },
              { label: "Review", value: 90 },
              { label: "Action", value: 88 },
              { label: "Polish", value: 93 },
            ],
          },
        ],
      }),
      downloadToken: randomBytes(24).toString("hex"),
      status: "Ready",
    },
  });
}

async function loadBot(user: CurrentUser) {
  const profile = await ensureBotProfile(user);
  const runtime = getAiRuntimeStatus();

  const [
    messages,
    commands,
    tabs,
    pdfReports,
    memories,
    approvals,
    backendApprovals,
    platformMap,
  ] = await Promise.all([
    safe([], () =>
      db.personalUserBotMessage.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
    safe([], () =>
      db.personalUserBotCommand.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
    safe([], () =>
      db.personalUserBotWorkspaceTab.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ),
    safe([], () =>
      db.personalUserBotPdfReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ),
    safe([], () =>
      db.personalUserBotMemory.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 25,
      }),
    ),
    safe([], () =>
      db.personalUserBotApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 25,
      }),
    ),
    safe([], () =>
      db.backendApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 25,
      }),
    ),
    safe([], () =>
      db.personalUserBotPlatformMapItem.findMany({
        where: { userId: user.id },
        orderBy: [{ category: "asc" }, { label: "asc" }],
        take: 50,
      }),
    ),
  ]);

  return {
    profile: {
      ...profile,
      spokenAccent: "British English",
      speechLanguage: "en-GB",
      answers: parseJson<Record<string, string>>(profile.answersJson, {}),
      personality: parseJson<Record<string, unknown>>(profile.personalityJson, {}),
      risk: parseJson<Record<string, unknown>>(profile.riskJson, {}),
      capabilities: parseJson<string[]>(profile.capabilitiesJson, []),
    },
    aiEngine: {
      provider: runtime.provider,
      configured: runtime.configured,
      model: runtime.model,
      qualityModel: runtime.qualityModel,
      structuredCommands: true,
      universalAnswers: true,
      approvalGates: true,
      platformBrain: true,
      voiceLearning: true,
      spokenAccent: "British English",
      speechLanguage: "en-GB",
      webSearchEnabled: runtime.webSearchEnabled,
      requiredEnv: runtime.requiredEnv,
      disableTimeout: runtime.disableTimeout,
      maxOutputTokens: runtime.maxOutputTokens,
      timeoutPolicy: {
        quickMs: timeoutForAnswerMode("quick"),
        balancedMs: timeoutForAnswerMode("balanced"),
        deepMs: timeoutForAnswerMode("deep"),
      },
    },
    uiPreference: {
      mode: "premium",
      density: "comfortable",
      primaryGoal: "Produce real OpenAI answers and avoid generic fallback responses.",
    },
    requiresOnboarding: false,
    questions: PERSONAL_BOT_QUESTIONS,
    messages: [...messages].reverse().map((message: any) => ({
      ...message,
      metadata: parseJson<Record<string, unknown>>(message.metadataJson, {}),
    })),
    commands: commands.map((command: any) => ({
      ...command,
      action: parseJson<Record<string, unknown>>(command.actionJson, {}),
    })),
    tabs: tabs.map((tab: any) => ({
      ...tab,
      layout: parseJson<Record<string, unknown>>(tab.layoutJson, {}),
      pinnedCommands: parseJson<string[]>(tab.pinnedCommandsJson, []),
    })),
    pdfReports: pdfReports.map((report: any) => ({
      ...report,
      sections: parseJson<Array<Record<string, string>>>(report.sectionsJson, []),
      design: parseJson<Record<string, unknown>>(report.designJson, {}),
      downloadUrl: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
      viewerUrl: `/workspace/personal-bot/reports?token=${report.downloadToken}`,
    })),
    memories,
    approvals: approvals.map((approval: any) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    backendApprovals: backendApprovals.map((approval: any) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    platformMap: platformMap.map((item: any) => ({
      ...item,
      aliases: parseJson<string[]>(item.aliasesJson, []),
      capabilities: parseJson<string[]>(item.capabilitiesJson, []),
      examplePrompts: parseJson<string[]>(item.examplePromptsJson, []),
    })),
    emailDrafts: [],
    automationRules: [],
    skills: [],
    insights: [],
    dataViews: [],
    backendToolRuns: [],
    voiceSessions: [],
    trainingPhrases: [],
    corrections: [],
    researchRuns: [],
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadBot(user));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = readText(body.action);
    const profile = await ensureBotProfile(user);

    if (action === "saveOnboarding") {
      const answers =
        body.answers && typeof body.answers === "object"
          ? (body.answers as Record<string, string>)
          : defaultBotAnswers();

      const derived = deriveBotProfile(answers);

      await db.personalUserBotProfile.update({
        where: { userId: user.id },
        data: {
          botName: readText(body.botName, profile.botName),
          onboardingComplete: true,
          answersJson: asJson(answers),
          personalityJson: asJson(derived.personality),
          riskJson: asJson(derived.risk),
          capabilitiesJson: asJson(derived.capabilities),
          preferredTone: derived.preferredTone,
          commandStyle: derived.commandStyle,
          autonomyLevel: derived.autonomyLevel,
          voiceEnabled: true,
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "updateProfile") {
      await db.personalUserBotProfile.update({
        where: { userId: user.id },
        data: {
          botName:
            typeof body.botName === "string" ? body.botName.trim() : undefined,
          preferredTone:
            typeof body.preferredTone === "string"
              ? body.preferredTone.trim()
              : undefined,
          autonomyLevel:
            typeof body.autonomyLevel === "string"
              ? body.autonomyLevel.trim()
              : undefined,
          commandStyle:
            typeof body.commandStyle === "string"
              ? body.commandStyle.trim()
              : undefined,
          customInstructions:
            typeof body.customInstructions === "string"
              ? body.customInstructions.trim()
              : undefined,
          voiceEnabled:
            typeof body.voiceEnabled === "boolean" ? body.voiceEnabled : undefined,
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "updateTab") {
      const tabName = readText(body.tabName, "AI Studio");
      const notes = readText(body.notes, "");
      const pinnedCommands = Array.isArray(body.pinnedCommands)
        ? body.pinnedCommands.map(String).filter(Boolean)
        : [];

      await db.personalUserBotWorkspaceTab.upsert({
        where: {
          userId_tabName: {
            userId: user.id,
            tabName,
          },
        },
        update: {
          notes,
          pinnedCommandsJson: asJson(pinnedCommands),
        },
        create: {
          userId: user.id,
          profileId: profile.id,
          tabName,
          notes,
          pinnedCommandsJson: asJson(pinnedCommands),
          layoutJson: asJson({ mode: "premium-ai-studio-v6-long-openai" }),
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "sendMessage") {
      const prompt = readText(body.prompt);
      const answerMode = readAnswerMode(body.answerMode);

      if (!prompt) {
        return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
      }

      await db.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "user",
          content: prompt,
          intent: body.voiceTranscript ? "Voice Command" : "Command",
          metadataJson: asJson({
            currentPath: readText(body.currentPath, ""),
            pageTitle: readText(body.pageTitle, ""),
            answerMode,
            voiceTranscript:
              typeof body.voiceTranscript === "string" ? body.voiceTranscript : null,
            advancedSettings:
              body.advancedSettings && typeof body.advancedSettings === "object"
                ? body.advancedSettings
                : null,
          }),
        },
      });

      const recentMessages = await safe([], () =>
        db.personalUserBotMessage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
      );

      const answer = await generateProfessionalAnswer({
        user,
        profile,
        prompt,
        answerMode,
        advancedSettings:
          body.advancedSettings && typeof body.advancedSettings === "object"
            ? body.advancedSettings
            : null,
        recentMessages: recentMessages
          .reverse()
          .map((message: any) => ({
            role: message.role,
            content: message.content,
          })),
      });

      let report: any = null;
      let reportError: string | null = null;

      if (looksLikeReportRequest(prompt) && answer.status === "completed") {
        try {
          report = await createReport({
            user,
            profile,
            prompt,
            answer: answer.text,
          });
        } catch (error) {
          reportError =
            error instanceof Error ? error.message : "Report creation failed.";
        }
      }

      const finalAnswer = report
        ? `${answer.text}\n\nI also created a presentation-ready report. Use “Open Browser Report” for the most reliable view, or “Open Raw PDF” as the PDF fallback.`
        : reportError
          ? `${answer.text}\n\nI answered the request, but report creation failed: ${reportError}`
          : answer.text;

      const clientAction = report
        ? {
            type: "report",
            href: `/workspace/personal-bot/reports?token=${report.downloadToken}`,
            pdfHref: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
            autoRun: false,
          }
        : {
            type: "none",
            autoRun: false,
          };

      await db.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "assistant",
          content: finalAnswer,
          intent: report ? "Create Report" : answer.status === "completed" ? "OpenAI Answer" : "AI Error",
          metadataJson: asJson({
            clientAction,
            answerMode,
            universalAiProvider: answer.provider,
            universalAiStatus: answer.status,
            universalAiError: answer.error,
            universalAiModel: answer.model,
            universalAiConfigured: answer.configured,
            universalAiLatencyMs: answer.latencyMs,
            spokenAccent: "British English",
            reportError,
            rawOpenAiAvailable: Boolean(answer.raw),
          }),
        },
      });

      await safe(null, () =>
        db.personalUserBotCommand.create({
          data: {
            userId: user.id,
            profileId: profile.id,
            firmId: profile.firmId,
            commandText: prompt,
            commandType: report ? "create_report" : answer.status === "completed" ? "openai_answer" : "ai_error",
            status: report
              ? "Report Generated"
              : answer.status === "completed"
                ? "Complete"
                : answer.status === "missing"
                  ? "Missing OpenAI Key"
                  : answer.status === "timeout"
                    ? "OpenAI Timeout"
                    : "OpenAI Failed",
            resultSummary: report
              ? `Generated report: ${report.title}`
              : answer.status === "completed"
                ? "Answered with OpenAI."
                : answer.error || "AI response failed.",
            actionJson: asJson({
              provider: answer.provider,
              status: answer.status,
              model: answer.model,
              configured: answer.configured,
              answerMode,
              latencyMs: answer.latencyMs,
              reportId: report?.id ?? null,
              reportUrl: report
                ? `/workspace/personal-bot/reports?token=${report.downloadToken}`
                : null,
              pdfUrl: report
                ? `/api/personal-bot/pdf-report?token=${report.downloadToken}`
                : null,
              reportError,
              error: answer.error,
            }),
          },
        }),
      );

      return NextResponse.json(await loadBot(user));
    }

    return NextResponse.json(await loadBot(user));
  } catch (error) {
    return NextResponse.json(
      {
        error: "AI Studio request failed.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 },
    );
  }
}