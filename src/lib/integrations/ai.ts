import { getOptionalEnv } from "@/lib/env";

export type AiResponseResult = {
  ok: boolean;
  provider: string;
  status: "completed" | "failed" | "missing";
  text: string;
  raw?: unknown;
  error?: string;
};

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
        ? "I can navigate Slice, research investments, search firm data, find sources, create tasks, create clients, create projects, add watchlists, create price alerts, draft approval-gated emails, create reports, run backend jobs, decide approvals, remember preferences, and change your theme."
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
}): Promise<AiResponseResult> {
  const apiKey = getOptionalEnv("OPENAI_API_KEY");

  if (!apiKey) {
    return {
      ok: false,
      provider: "OpenAI",
      status: "missing",
      text: "",
      error: "OPENAI_API_KEY is missing.",
    };
  }

  const model = input.model || getOptionalEnv("OPENAI_MODEL") || "gpt-5";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          input.instructions ||
          "You are Slice, a careful fintech AI assistant. Be accurate, source-aware, compliance-aware, and avoid unsupported claims.",
        input: input.prompt,
        tools: input.enableWebSearch ? [{ type: "web_search_preview" }] : undefined,
        safety_identifier: input.safetyIdentifier,
        store: false,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "OpenAI",
        status: "failed",
        text: "",
        raw: payload,
        error: payload?.error?.message || `OpenAI failed with ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: "OpenAI",
      status: "completed",
      text: extractText(payload),
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "OpenAI",
      status: "failed",
      text: "",
      error: error instanceof Error ? error.message : "AI request failed.",
    };
  }
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

  const model = getOptionalEnv("OPENAI_MODEL") || "gpt-5";

  const instructions = `
You are Slice's fintech AI command interpreter.

Your job:
- Interpret rough voice commands and imperfect wording.
- Convert the user's command into one safe structured command.
- Use learned corrections and training phrases before generic interpretation.
- Prefer direct platform routing when route intent is obvious.
- Use platform_search for firm-wide search across clients, notes, tasks, alerts, reports, approvals, watchlists, and research.
- Use research for investment analysis, ticker analysis, source-backed thesis, client exposure, or diligence questions.
- Use source_lookup when the user asks for exact source, proof, link, citation, or evidence.
- Use backend_job for backend, vendor health, watchlist price checks, delivery queue, data quality, or advisor day jobs.
- Use approval_decision when user says approve/reject latest.
- Client-facing email, SMS, delivery, and reports require approval.
- Never guarantee returns or make unsupported recommendations.
- Always give a helpful command summary.
Return only JSON matching the schema.
`;

  const platformContext = {
    userName: input.userName,
    userEmail: input.userEmail,
    firmName: input.firmName ?? "No active firm",
    botName: input.botName ?? "Slice Bot",
    openTasks: input.openTasks ?? 0,
    unreadAlerts: input.unreadAlerts ?? 0,
    clients: input.clients ?? 0,
    portfolioValue: input.portfolioValue ?? 0,
    voiceTranscript: input.voiceTranscript,
    memory: input.memory ?? [],
    platformBrain: input.platformBrain ?? {},
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
    });

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
      provider: "OpenAI",
      command: parseJsonLoose<SliceStructuredCommand>(text, fallbackSliceCommand(input.prompt, input.platformBrain)),
    };
  } catch (error) {
    return {
      ok: false,
      provider: "OpenAI",
      command: fallbackSliceCommand(input.prompt, input.platformBrain),
      error: error instanceof Error ? error.message : "AI command parsing failed.",
    };
  }
}