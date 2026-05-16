import { getOptionalEnv } from "@/lib/env";

export type AiResponseResult = {
  ok: boolean;
  provider: string;
  status: "completed" | "failed" | "missing" | "cached" | "timeout";
  text: string;
  raw?: unknown;
  error?: string;
  latencyMs?: number;
  model?: string;
  cacheKey?: string;
};

export type AiSpeedMode = "instant" | "fast" | "balanced" | "quality";

export type SliceCommandIntent =
  | "navigate"
  | "answer"
  | "source_lookup"
  | "platform_search"
  | "research"
  | "sort_data"
  | "create_task"
  | "create_client"
  | "create_project"
  | "create_watchlist_item"
  | "create_price_alert"
  | "draft_email"
  | "create_report"
  | "advisor_day"
  | "backend_job"
  | "queue_delivery"
  | "approval_decision"
  | "remember"
  | "theme"
  | "help";

export type SliceStructuredCommand = {
  intent: SliceCommandIntent;
  confidence: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  requiresApproval: boolean;
  route: string | null;
  answer: string;
  userFacingSummary: string;
  parameters: {
    route: string | null;
    ticker: string | null;
    query: string | null;
    title: string | null;
    detail: string | null;
    dueDate: string | null;
    priority: string | null;
    clientName: string | null;
    email: string | null;
    projectTitle: string | null;
    watchlistName: string | null;
    symbol: string | null;
    upperTargetPrice: number | null;
    lowerTargetPrice: number | null;
    color: string | null;
    reportTitle: string | null;
    subject: string | null;
    body: string | null;
    recipient: string | null;
    deliveryChannel: string | null;
    phone: string | null;
    jobKey: string | null;
    memory: string | null;
    approvalDecision: "approve" | "reject" | null;
    researchDepth: "quick" | "standard" | "deep" | null;
  };
};

type PlatformBrainContext = {
  routes?: Array<{
    label: string;
    route: string;
    category: string;
    aliases: string[];
    capabilities: string[];
    examples: string[];
  }>;
  learnedPhrases?: Array<{
    phrase: string;
    targetIntent: string;
    targetRoute: string | null;
    parameters: Record<string, unknown>;
  }>;
  corrections?: Array<{
    originalCommand: string;
    interpretedIntent: string | null;
    correctedIntent: string;
    correctedRoute: string | null;
    notes: string | null;
    parameters: Record<string, unknown>;
  }>;
};

export type UniversalAssistantMessage = {
  role: "user" | "assistant" | string;
  content: string;
};

export type UniversalAssistantInput = {
  prompt: string;
  userName: string;
  userEmail: string;
  botName?: string | null;
  currentPath?: string | null;
  pageTitle?: string | null;
  preferredTone?: string | null;
  commandStyle?: string | null;
  autonomyLevel?: string | null;
  customInstructions?: string | null;
  personality?: Record<string, unknown> | null;
  risk?: Record<string, unknown> | null;
  memory?: string[];
  recentMessages?: UniversalAssistantMessage[];
  platformResult?: string | null;
  commandIntent?: string | null;
  platformSnapshot?: Record<string, unknown>;
  model?: string;
  safetyIdentifier?: string;
  enableWebSearch?: boolean;
  speedMode?: AiSpeedMode;
};

type CacheRecord = {
  expiresAt: number;
  result: AiResponseResult;
};

const aiCache = new Map<string, CacheRecord>();

const FALLBACK_ROUTES = [
  { route: "/workspace", label: "workspace", aliases: ["home", "dashboard", "main page"] },
  { route: "/workspace?tab=command", label: "command layer", aliases: ["command", "backend controls"] },
  { route: "/workspace?tab=firm-calendar", label: "calendar", aliases: ["firm calendar", "schedule", "agenda"] },
  { route: "/workspace/personal-bot", label: "personal bot", aliases: ["bot", "robot", "assistant"] },
  { route: "/backend-kernel", label: "backend kernel", aliases: ["backend", "kernel", "jobs"] },
  { route: "/market-visuals", label: "market visuals", aliases: ["charts", "graphs", "visuals"] },
  { route: "/watchlist-alerts", label: "watchlist alerts", aliases: ["price alerts", "stock alerts"] },
  { route: "/advisor-command-center", label: "advisor command center", aliases: ["client brain", "next best action"] },
  { route: "/triage", label: "triage", aliases: ["trage", "news triage"] },
  { route: "/opportunity-radar", label: "opportunity radar", aliases: ["radar", "opportunities"] },
  { route: "/portfolio-lab", label: "portfolio lab", aliases: ["portfolio", "holdings"] },
  { route: "/alternative-investments?view=venture", label: "venture monitor", aliases: ["ventures", "alternative ventures", "startups"] },
  { route: "/alternative-investments?view=penny-stocks", label: "penny stocks", aliases: ["penny stock", "speculative equities"] },
  { route: "/alternative-investments?view=crypto", label: "crypto markets", aliases: ["crypto", "bitcoin"] },
  { route: "/briefings", label: "briefings", aliases: ["reports", "briefing reports"] },
  { route: "/security", label: "security", aliases: ["audit", "compliance"] },
];

function hashText(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function cleanupCache() {
  const now = Date.now();

  for (const [key, record] of aiCache.entries()) {
    if (record.expiresAt <= now) {
      aiCache.delete(key);
    }
  }

  if (aiCache.size > 500) {
    const ordered = Array.from(aiCache.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );

    for (const [key] of ordered.slice(0, 150)) {
      aiCache.delete(key);
    }
  }
}

function cacheTtlForMode(mode: AiSpeedMode) {
  if (mode === "instant") return 10 * 60 * 1000;
  if (mode === "fast") return 5 * 60 * 1000;
  if (mode === "balanced") return 3 * 60 * 1000;
  return 60 * 1000;
}

function timeoutForMode(mode: AiSpeedMode) {
  if (mode === "instant") return Number(getOptionalEnv("OPENAI_INSTANT_TIMEOUT_MS")) || 3500;
  if (mode === "fast") return Number(getOptionalEnv("OPENAI_FAST_TIMEOUT_MS")) || 6500;
  if (mode === "balanced") return Number(getOptionalEnv("OPENAI_BALANCED_TIMEOUT_MS")) || 14000;
  return Number(getOptionalEnv("OPENAI_QUALITY_TIMEOUT_MS")) || 28000;
}

function modelForMode(mode: AiSpeedMode, explicitModel?: string) {
  if (explicitModel) return explicitModel;

  if (mode === "instant" || mode === "fast") {
    return (
      getOptionalEnv("OPENAI_FAST_MODEL") ||
      getOptionalEnv("OPENAI_MODEL") ||
      "gpt-5"
    );
  }

  if (mode === "quality") {
    return (
      getOptionalEnv("OPENAI_QUALITY_MODEL") ||
      getOptionalEnv("OPENAI_MODEL") ||
      "gpt-5"
    );
  }

  return getOptionalEnv("OPENAI_MODEL") || "gpt-5";
}

function extractText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const pieces: string[] = [];

  for (const item of payload?.output ?? []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (typeof content?.text === "string") pieces.push(content.text);
        if (typeof content?.output_text === "string") pieces.push(content.output_text);
      }
    }
  }

  return pieces.join("\n").trim();
}

function parseJsonLoose<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");

    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1)) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#\s$.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTicker(prompt: string) {
  const upper = prompt.toUpperCase();

  const explicit =
    upper.match(/(?:STOCK|TICKER|SYMBOL|HOLDING|WATCH|RESEARCH)\s+([A-Z]{1,6})/) ??
    upper.match(/\$([A-Z]{1,6})/) ??
    upper.match(/\b(NVDA|AAPL|MSFT|TSLA|META|GOOGL|GOOG|AMZN|AMD|NFLX|SPY|QQQ|IWM|TLT)\b/);

  return explicit?.[1] ?? explicit?.[0] ?? null;
}

function extractPrice(prompt: string) {
  const match = prompt.match(/\$?(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function routeFromPrompt(prompt: string, platformBrain?: PlatformBrainContext) {
  const lower = normalize(prompt);
  const routes = platformBrain?.routes?.length
    ? platformBrain.routes.map((item) => ({
        route: item.route,
        label: item.label,
        aliases: item.aliases,
      }))
    : FALLBACK_ROUTES;

  for (const item of routes) {
    const labels = [item.label, ...(item.aliases ?? [])];

    if (labels.some((label) => lower.includes(normalize(label)))) {
      return item.route;
    }
  }

  return null;
}

function toneGuide(preferredTone?: string | null) {
  const tone = normalize(preferredTone || "professional");

  if (tone.includes("witty")) {
    return "Use polished, quick British wit. Be clever, not silly. Keep the answer useful first and charming second.";
  }

  if (tone.includes("brutal") || tone.includes("honest")) {
    return "Be direct, candid, and tactful. Say what matters plainly, without being rude.";
  }

  if (tone.includes("encourag")) {
    return "Be upbeat, steady, and confidence-building while still being honest about risk and uncertainty.";
  }

  if (tone.includes("calm")) {
    return "Be calm, measured, and reassuring. Avoid hype.";
  }

  if (tone.includes("direct")) {
    return "Be concise and decisive. Lead with the answer, then give only the necessary supporting details.";
  }

  return "Be professional, polished, concise, and advisor-grade.";
}

function detailGuide(commandStyle?: string | null) {
  const style = normalize(commandStyle || "balanced detail");

  if (style.includes("one-line")) return "Answer in one or two crisp sentences unless safety or complexity requires more.";
  if (style.includes("short")) return "Use a short summary with only the most important details.";
  if (style.includes("detailed")) return "Give a structured, detailed breakdown with clear next steps.";
  if (style.includes("deep")) return "Give a deeper research-style response with assumptions, caveats, and practical implications.";

  return "Use balanced detail: enough to be genuinely useful, not a wall of text.";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
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

export function fallbackSliceCommand(prompt: string, platformBrain?: PlatformBrainContext): SliceStructuredCommand {
  const lower = normalize(prompt);
  const route = routeFromPrompt(prompt, platformBrain);
  let intent: SliceCommandIntent = route ? "navigate" : "answer";

  if (lower.includes("source") || lower.includes("proof") || lower.includes("cite") || lower.includes("where did")) intent = "source_lookup";
  if (lower.includes("search") || lower.includes("find") || lower.includes("look through") || lower.includes("ask the firm")) intent = "platform_search";
  if (lower.includes("research") || lower.includes("analyze") || lower.includes("deep dive") || lower.includes("thesis")) intent = "research";
  if (lower.includes("sort") || lower.includes("rank") || lower.includes("top ") || lower.includes("highest")) intent = "sort_data";
  if (lower.includes("task") || lower.includes("to do") || lower.includes("todo") || lower.includes("remind")) intent = "create_task";
  if (lower.includes("client") && (lower.includes("create") || lower.includes("add") || lower.includes("new"))) intent = "create_client";
  if (lower.includes("project") && (lower.includes("create") || lower.includes("add") || lower.includes("new"))) intent = "create_project";
  if (lower.includes("watch") || lower.includes("track ticker") || lower.includes("add ticker")) intent = "create_watchlist_item";
  if (lower.includes("price alert") || lower.includes("hits") || lower.includes("above") || lower.includes("below")) intent = "create_price_alert";
  if (lower.includes("email") || lower.includes("draft") || lower.includes("message investors")) intent = "draft_email";
  if (lower.includes("pdf") || lower.includes("report")) intent = "create_report";
  if (lower.includes("advisor day") || lower.includes("what should i do") || lower.includes("prioritize my day")) intent = "advisor_day";
  if (lower.includes("backend") || lower.includes("kernel") || lower.includes("job")) intent = "backend_job";
  if (lower.includes("approve") || lower.includes("reject") || lower.includes("decline")) intent = "approval_decision";
  if (lower.includes("remember")) intent = "remember";
  if (lower.includes("theme") || lower.includes("color")) intent = "theme";
  if (lower.includes("help") || lower.includes("what can you do")) intent = "help";

  const ticker = extractTicker(prompt);
  const price = extractPrice(prompt);

  return {
    intent,
    confidence: route ? 0.72 : 0.5,
    riskLevel: ["draft_email", "queue_delivery", "create_report", "approval_decision"].includes(intent) ? "High" : "Low",
    requiresApproval: ["draft_email", "queue_delivery", "create_report"].includes(intent),
    route,
    answer:
      intent === "answer"
        ? "I can answer open-ended questions through the universal AI layer, navigate Slice, research investments, search firm data, find sources, create tasks, create clients, create projects, add watchlists, create price alerts, draft approval-gated emails, create reports, run backend jobs, decide approvals, remember preferences, and change your theme."
        : `I interpreted this as: ${intent}.`,
    userFacingSummary: `Interpreted as ${intent}.`,
    parameters: {
      route,
      ticker,
      query: prompt,
      title: prompt,
      detail: prompt,
      dueDate: null,
      priority: lower.includes("urgent") || lower.includes("critical") ? "High" : "Medium",
      clientName: null,
      email: null,
      projectTitle: prompt,
      watchlistName: "AI Command Watchlist",
      symbol: ticker,
      upperTargetPrice: lower.includes("above") || lower.includes("high") ? price : null,
      lowerTargetPrice: lower.includes("below") || lower.includes("low") ? price : null,
      color: lower.includes("blue") ? "blue" : lower.includes("green") ? "green" : lower.includes("purple") ? "purple" : lower.includes("gold") ? "gold" : lower.includes("mint") ? "mint" : null,
      reportTitle: "Slice AI Report",
      subject: null,
      body: null,
      recipient: null,
      deliveryChannel: lower.includes("text") || lower.includes("sms") ? "Text" : lower.includes("email") ? "Email" : "Dashboard",
      phone: null,
      jobKey: lower.includes("price") ? "watchlist_price_check" : lower.includes("delivery") ? "notification_delivery" : lower.includes("advisor day") ? "advisor_day" : "vendor_health",
      memory: lower.includes("remember") ? prompt.replace(/remember/i, "").trim() : null,
      approvalDecision: lower.includes("reject") || lower.includes("decline") ? "reject" : lower.includes("approve") ? "approve" : null,
      researchDepth: lower.includes("deep") ? "deep" : lower.includes("quick") ? "quick" : "standard",
    },
  };
}

function commandSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: {
        type: "string",
        enum: [
          "navigate",
          "answer",
          "source_lookup",
          "platform_search",
          "research",
          "sort_data",
          "create_task",
          "create_client",
          "create_project",
          "create_watchlist_item",
          "create_price_alert",
          "draft_email",
          "create_report",
          "advisor_day",
          "backend_job",
          "queue_delivery",
          "approval_decision",
          "remember",
          "theme",
          "help",
        ],
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      riskLevel: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
      requiresApproval: { type: "boolean" },
      route: { type: ["string", "null"] },
      answer: { type: "string" },
      userFacingSummary: { type: "string" },
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          route: { type: ["string", "null"] },
          ticker: { type: ["string", "null"] },
          query: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          detail: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
          priority: { type: ["string", "null"] },
          clientName: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          projectTitle: { type: ["string", "null"] },
          watchlistName: { type: ["string", "null"] },
          symbol: { type: ["string", "null"] },
          upperTargetPrice: { type: ["number", "null"] },
          lowerTargetPrice: { type: ["number", "null"] },
          color: { type: ["string", "null"] },
          reportTitle: { type: ["string", "null"] },
          subject: { type: ["string", "null"] },
          body: { type: ["string", "null"] },
          recipient: { type: ["string", "null"] },
          deliveryChannel: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          jobKey: { type: ["string", "null"] },
          memory: { type: ["string", "null"] },
          approvalDecision: { type: ["string", "null"], enum: ["approve", "reject", null] },
          researchDepth: { type: ["string", "null"], enum: ["quick", "standard", "deep", null] },
        },
        required: [
          "route",
          "ticker",
          "query",
          "title",
          "detail",
          "dueDate",
          "priority",
          "clientName",
          "email",
          "projectTitle",
          "watchlistName",
          "symbol",
          "upperTargetPrice",
          "lowerTargetPrice",
          "color",
          "reportTitle",
          "subject",
          "body",
          "recipient",
          "deliveryChannel",
          "phone",
          "jobKey",
          "memory",
          "approvalDecision",
          "researchDepth",
        ],
      },
    },
    required: ["intent", "confidence", "riskLevel", "requiresApproval", "route", "answer", "userFacingSummary", "parameters"],
  };
}

export async function generateAiText(input: {
  instructions?: string;
  prompt: string;
  model?: string;
  safetyIdentifier?: string;
  enableWebSearch?: boolean;
  speedMode?: AiSpeedMode;
  timeoutMs?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
  cacheKey?: string;
  fallbackText?: string;
}): Promise<AiResponseResult> {
  const startedAt = Date.now();
  const apiKey = getOptionalEnv("OPENAI_API_KEY");
  const speedMode = input.speedMode || "balanced";
  const model = modelForMode(speedMode, input.model);
  const timeoutMs = input.timeoutMs ?? timeoutForMode(speedMode);
  const useCache = input.useCache !== false;
  const computedCacheKey =
    input.cacheKey ||
    `ai:${hashText(
      JSON.stringify({
        model,
        speedMode,
        instructions: input.instructions,
        prompt: input.prompt,
        web: input.enableWebSearch,
      })
    )}`;

  cleanupCache();

  if (useCache) {
    const cached = aiCache.get(computedCacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.result,
        status: "cached",
        provider: `${cached.result.provider} cache`,
        latencyMs: Date.now() - startedAt,
        cacheKey: computedCacheKey,
      };
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      provider: "OpenAI",
      status: "missing",
      text: input.fallbackText || "",
      error: "OPENAI_API_KEY is missing.",
      latencyMs: Date.now() - startedAt,
      model,
      cacheKey: computedCacheKey,
    };
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions:
            input.instructions ||
            "You are Slice, a careful fintech AI assistant. Be accurate, source-aware, compliance-aware, fast, and avoid unsupported claims.",
          input: input.prompt,
          tools: input.enableWebSearch ? [{ type: "web_search_preview" }] : undefined,
          safety_identifier: input.safetyIdentifier,
          store: false,
        }),
      },
      timeoutMs
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "OpenAI",
        status: "failed",
        text: input.fallbackText || "",
        raw: payload,
        error: payload?.error?.message || `OpenAI failed with ${response.status}`,
        latencyMs: Date.now() - startedAt,
        model,
        cacheKey: computedCacheKey,
      };
    }

    const result: AiResponseResult = {
      ok: true,
      provider: "OpenAI",
      status: "completed",
      text: extractText(payload),
      raw: payload,
      latencyMs: Date.now() - startedAt,
      model,
      cacheKey: computedCacheKey,
    };

    if (useCache && result.text) {
      aiCache.set(computedCacheKey, {
        expiresAt: Date.now() + (input.cacheTtlMs ?? cacheTtlForMode(speedMode)),
        result,
      });
    }

    return result;
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));

    return {
      ok: false,
      provider: "OpenAI",
      status: timedOut ? "timeout" : "failed",
      text: input.fallbackText || "",
      error: timedOut
        ? `AI request exceeded ${timeoutMs}ms. Returned fast fallback to preserve responsiveness.`
        : error instanceof Error
          ? error.message
          : "AI request failed.",
      latencyMs: Date.now() - startedAt,
      model,
      cacheKey: computedCacheKey,
    };
  }
}

export async function generateUniversalAssistantReply(input: UniversalAssistantInput): Promise<AiResponseResult> {
  const botName = input.botName || "Slice Bot";
  const preferredTone = input.preferredTone || "Professional";
  const commandStyle = input.commandStyle || "Balanced detail";
  const speedMode = input.speedMode || "fast";

  const fallback = input.platformResult
    ? `Certainly — here is what I found:\n\n${input.platformResult}`
    : "Certainly — I can help with that. I can answer questions, navigate Slice, research investments, search firm data, prepare reports, and draft approval-gated communications.";

  const instructions = `
You are ${botName}, the universal AI assistant inside Slice, an advisor intelligence operating system.

Voice and personality:
- Use polished British English phrasing.
- Preferred tone: ${preferredTone}.
- ${toneGuide(preferredTone)}
- ${detailGuide(commandStyle)}

Rules:
- Be fast and useful.
- If platform context is supplied, preserve its facts exactly.
- For finance, legal, tax, or compliance matters, avoid guarantees and unsupported recommendations.
- Do not claim an action was completed unless platformResult proves it.
`;

  return generateAiText({
    instructions,
    prompt: JSON.stringify(
      {
        prompt: input.prompt,
        currentPath: input.currentPath,
        pageTitle: input.pageTitle,
        user: {
          name: input.userName,
          email: input.userEmail,
        },
        style: {
          preferredTone,
          commandStyle,
          autonomyLevel: input.autonomyLevel,
        },
        personality: input.personality ?? {},
        risk: input.risk ?? {},
        memory: input.memory ?? [],
        recentMessages: input.recentMessages ?? [],
        commandIntent: input.commandIntent ?? null,
        platformResult: input.platformResult ?? null,
        platformSnapshot: input.platformSnapshot ?? {},
      },
      null,
      2
    ),
    model: input.model,
    enableWebSearch: input.enableWebSearch,
    safetyIdentifier: input.safetyIdentifier || input.userEmail,
    speedMode,
    fallbackText: fallback,
    useCache: true,
  });
}

export async function parseSliceCommandWithAi(input: {
  prompt: string;
  userName: string;
  userEmail: string;
  firmName?: string | null;
  botName?: string | null;
  memory?: string[];
  openTasks?: number;
  unreadAlerts?: number;
  clients?: number;
  portfolioValue?: number;
  platformBrain?: PlatformBrainContext;
  voiceTranscript?: string | null;
  preferredTone?: string | null;
  commandStyle?: string | null;
  customInstructions?: string | null;
  personality?: Record<string, unknown> | null;
}): Promise<{
  ok: boolean;
  command: SliceStructuredCommand;
  provider: string;
  error?: string;
}> {
  const apiKey = getOptionalEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return {
      ok: false,
      provider: "Local fallback",
      command: fallbackSliceCommand(input.prompt, input.platformBrain),
      error: "OPENAI_API_KEY is missing.",
    };
  }

  const speedMode: AiSpeedMode = "fast";
  const model = modelForMode(speedMode);

  const instructions = `
You are Slice's fintech AI command interpreter.

Your job:
- Interpret rough voice commands and imperfect wording.
- Convert the user's command into one safe structured command.
- Use learned corrections and training phrases before generic interpretation.
- Prefer direct platform routing when route intent is obvious.
- Use answer for broad, open-ended questions.
- Use platform_search for searching firm data.
- Use research for investment analysis.
- Use source_lookup for proof, citations, source, or evidence.
- Use backend_job for backend, vendor health, watchlist checks, delivery queue, data quality, and advisor day.
- Use approval_decision when user says approve/reject latest.
- Match preferred tone: ${input.preferredTone || "Professional"}.
- Keep client-facing email, SMS, delivery, and reports approval-gated.
- Never guarantee returns.
Return only JSON matching the schema.
`;

  const platformContext = {
    userName: input.userName,
    userEmail: input.userEmail,
    firmName: input.firmName ?? "No active firm",
    botName: input.botName ?? "Slice Bot",
    preferredTone: input.preferredTone ?? "Professional",
    commandStyle: input.commandStyle ?? "Balanced detail",
    customInstructions: input.customInstructions ?? null,
    personality: input.personality ?? {},
    openTasks: input.openTasks ?? 0,
    unreadAlerts: input.unreadAlerts ?? 0,
    clients: input.clients ?? 0,
    portfolioValue: input.portfolioValue ?? 0,
    voiceTranscript: input.voiceTranscript,
    memory: input.memory ?? [],
    platformBrain: input.platformBrain ?? {},
  };

  try {
    const response = await fetchWithTimeout(
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
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Platform context:\n${JSON.stringify(platformContext, null, 2)}\n\nUser command:\n${input.prompt}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "slice_structured_command",
              strict: true,
              schema: commandSchema(),
            },
          },
          store: false,
          safety_identifier: input.userEmail,
        }),
      },
      timeoutForMode(speedMode)
    );

    const payload = await response.json().catch(() => ({}));
    const text = extractText(payload);

    if (!response.ok) {
      return {
        ok: false,
        provider: "OpenAI",
        command: fallbackSliceCommand(input.prompt, input.platformBrain),
        error: payload?.error?.message || `OpenAI failed with ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: `OpenAI/${model}`,
      command: parseJsonLoose<SliceStructuredCommand>(
        text,
        fallbackSliceCommand(input.prompt, input.platformBrain)
      ),
    };
  } catch (error) {
    return {
      ok: false,
      provider: `OpenAI/${model}`,
      command: fallbackSliceCommand(input.prompt, input.platformBrain),
      error:
        error instanceof Error
          ? error.message
          : "AI command parsing failed.",
    };
  }
}