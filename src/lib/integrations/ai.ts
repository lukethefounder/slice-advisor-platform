import { createHash } from "crypto";
import { getOptionalEnv } from "@/lib/env";

export type AiResponseStatus =
  | "completed"
  | "failed"
  | "missing"
  | "cached"
  | "timeout";

export type AiSource = {
  type: "web" | "file" | "unknown";
  title: string;
  url: string;
};

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiResponseResult = {
  ok: boolean;
  provider: string;
  status: AiResponseStatus;
  text: string;
  raw?: unknown;
  error?: string;
  latencyMs?: number;
  model?: string;
  cacheKey?: string;
  requestId?: string;
  sources?: AiSource[];
  researchUsed?: boolean;
  attemptedModels?: string[];
  usage?: AiUsage;
};

export type AiSpeedMode =
  | "instant"
  | "fast"
  | "balanced"
  | "quality";

export type AiResearchMode =
  | "off"
  | "auto"
  | "required";

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
  riskLevel:
    | "Low"
    | "Medium"
    | "High"
    | "Critical";
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
    approvalDecision:
      | "approve"
      | "reject"
      | null;
    researchDepth:
      | "quick"
      | "standard"
      | "deep"
      | null;
  };
};

export type PlatformBrainContext = {
  routes?: Array<{
    label: string;
    route: string;
    category: string;
    aliases: string[];
    capabilities: string[];
    examples?: string[];
  }>;
  learnedPhrases?: Array<{
    phrase: string;
    targetIntent: string;
    targetRoute: string | null;
    parameters: Record<
      string,
      unknown
    >;
  }>;
  corrections?: Array<{
    originalCommand: string;
    interpretedIntent:
      | string
      | null;
    correctedIntent: string;
    correctedRoute:
      | string
      | null;
    notes: string | null;
    parameters: Record<
      string,
      unknown
    >;
  }>;
};

export type UniversalAssistantMessage = {
  role:
    | "user"
    | "assistant"
    | string;
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
  customInstructions?:
    | string
    | null;
  personality?: Record<
    string,
    unknown
  > | null;
  risk?: Record<
    string,
    unknown
  > | null;
  memory?: string[];
  recentMessages?: UniversalAssistantMessage[];
  platformResult?: string | null;
  commandIntent?: string | null;
  platformSnapshot?: Record<
    string,
    unknown
  >;
  financialContext?: Record<
    string,
    unknown
  >;
  model?: string;
  safetyIdentifier?: string;
  enableWebSearch?: boolean;
  requireResearch?: boolean;
  speedMode?: AiSpeedMode;
};

export type OpenAiHealthResult = {
  ok: boolean;
  configured: boolean;
  status:
    | "ready"
    | "missing"
    | "invalid"
    | "failed"
    | "timeout";
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
  requestId?: string;
  checkedAt: string;
};

type GenerateAiTextInput = {
  instructions?: string;
  prompt: string;
  model?: string;
  safetyIdentifier?: string;
  enableWebSearch?: boolean;
  researchMode?: AiResearchMode;
  speedMode?: AiSpeedMode;
  timeoutMs?: number;
  maxOutputTokens?: number;
  useCache?: boolean;
  cacheTtlMs?: number;
  cacheKey?: string;
  fallbackText?: string;
  appendSources?: boolean;
  metadata?: Record<
    string,
    string | number | boolean
  >;
};

type CacheRecord = {
  expiresAt: number;
  result: AiResponseResult;
};

type OpenAiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
};

const aiCache =
  new Map<
    string,
    CacheRecord
  >();

let healthCache: {
  expiresAt: number;
  result: OpenAiHealthResult;
} | null = null;

const FALLBACK_ROUTES = [
  {
    route: "/workspace",
    label: "workspace",
    aliases: [
      "home",
      "dashboard",
      "main page",
      "advisor workspace",
    ],
  },
  {
    route:
      "/workspace/personal-bot",
    label: "ai studio",
    aliases: [
      "bot",
      "robot",
      "assistant",
      "personal bot",
      "command studio",
    ],
  },
  {
    route:
      "/workspace/personal-bot/reports",
    label: "ai reports",
    aliases: [
      "reports",
      "report library",
      "pdf reports",
    ],
  },
  {
    route:
      "/workspace/clients",
    label: "client profiles",
    aliases: [
      "clients",
      "client records",
      "households",
    ],
  },
  {
    route:
      "/workspace/client-portal-inbox",
    label:
      "client portal inbox",
    aliases: [
      "client messages",
      "portal messages",
      "advisor inbox",
    ],
  },
  {
    route:
      "/workspace/client-emails",
    label:
      "client email center",
    aliases: [
      "email center",
      "client emails",
      "draft email",
    ],
  },
  {
    route:
      "/workspace/client-briefings",
    label: "client briefings",
    aliases: [
      "client reports",
      "client updates",
      "briefings",
    ],
  },
  {
    route:
      "/workspace/team-board",
    label: "team board",
    aliases: [
      "team tasks",
      "tasks",
      "work board",
    ],
  },
  {
    route:
      "/workspace/custom-board",
    label: "custom board",
    aliases: [
      "custom tasks",
      "project board",
    ],
  },
  {
    route:
      "/workspace/settings",
    label: "settings",
    aliases: [
      "account settings",
      "advisor settings",
      "configuration",
    ],
  },
  {
    route:
      "/workspace/firm-command-center",
    label:
      "firm command center",
    aliases: [
      "firm center",
      "firm operations",
      "management center",
    ],
  },
  {
    route:
      "/backend-kernel",
    label: "backend kernel",
    aliases: [
      "backend",
      "kernel",
      "jobs",
    ],
  },
  {
    route:
      "/backend-readiness",
    label:
      "backend readiness",
    aliases: [
      "readiness",
      "backend setup",
      "system health",
    ],
  },
  {
    route:
      "/market-visuals",
    label: "market visuals",
    aliases: [
      "charts",
      "graphs",
      "market charts",
      "visuals",
    ],
  },
  {
    route:
      "/watchlist-alerts",
    label:
      "watchlist alerts",
    aliases: [
      "price alerts",
      "stock alerts",
      "watchlists",
    ],
  },
  {
    route:
      "/advisor-command-center",
    label:
      "advisor command center",
    aliases: [
      "client brain",
      "next best action",
      "advisor center",
    ],
  },
  {
    route: "/triage",
    label: "triage",
    aliases: [
      "news triage",
      "intelligence triage",
      "headline triage",
    ],
  },
  {
    route:
      "/opportunity-radar",
    label:
      "opportunity radar",
    aliases: [
      "radar",
      "opportunities",
      "investment opportunities",
    ],
  },
  {
    route:
      "/portfolio-lab",
    label: "portfolio lab",
    aliases: [
      "portfolio",
      "holdings",
      "portfolio analysis",
    ],
  },
  {
    route:
      "/alternative-investments?view=venture",
    label:
      "venture monitor",
    aliases: [
      "ventures",
      "startups",
      "venture capital",
    ],
  },
  {
    route:
      "/alternative-investments?view=penny-stocks",
    label: "penny stocks",
    aliases: [
      "penny stock",
      "speculative equities",
    ],
  },
  {
    route:
      "/alternative-investments?view=crypto",
    label: "crypto markets",
    aliases: [
      "crypto",
      "bitcoin",
      "digital assets",
    ],
  },
  {
    route: "/security",
    label: "security",
    aliases: [
      "audit",
      "compliance",
      "security center",
    ],
  },
];

const HIGH_RISK_INTENTS =
  new Set<SliceCommandIntent>([
    "draft_email",
    "queue_delivery",
    "create_report",
    "approval_decision",
  ]);

const APPROVAL_REQUIRED_INTENTS =
  new Set<SliceCommandIntent>([
    "draft_email",
    "queue_delivery",
    "create_report",
  ]);

const PLATFORM_COMMAND_PREFIXES =
  [
    "open ",
    "go to ",
    "navigate ",
    "show me ",
    "create a task",
    "create task",
    "add a task",
    "assign ",
    "remember ",
    "change theme",
    "set theme",
    "approve ",
    "reject ",
  ];

function normalizeKey(
  value: string,
) {
  return value
    .trim()
    .replace(
      /^Bearer\s+/i,
      "",
    )
    .replace(
      /^['"]|['"]$/g,
      "",
    );
}

function envBoolean(
  name: string,
  fallback: boolean,
) {
  const value = normalizeKey(
    getOptionalEnv(name),
  );

  if (!value) return fallback;

  if (
    [
      "1",
      "true",
      "yes",
      "on",
    ].includes(
      value.toLowerCase(),
    )
  ) {
    return true;
  }

  if (
    [
      "0",
      "false",
      "no",
      "off",
    ].includes(
      value.toLowerCase(),
    )
  ) {
    return false;
  }

  return fallback;
}

function envNumber(
  name: string,
  fallback: number,
  minimum = 1,
  maximum =
    Number.MAX_SAFE_INTEGER,
) {
  const value = Number(
    normalizeKey(
      getOptionalEnv(name),
    ),
  );

  if (
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.round(value),
    ),
  );
}

function getOpenAiApiKey() {
  return normalizeKey(
    getOptionalEnv(
      "OPENAI_API_KEY",
    ) ||
      getOptionalEnv(
        "OPENAI_KEY",
      ) ||
      getOptionalEnv(
        "OPENAI_SECRET_KEY",
      ),
  );
}

function apiKeyLooksUsable(
  apiKey: string,
) {
  if (
    !apiKey ||
    apiKey.length < 20
  ) {
    return false;
  }

  const lower =
    apiKey.toLowerCase();

  return ![
    "your_api_key",
    "your-openai-key",
    "replace_me",
    "placeholder",
    "undefined",
    "null",
  ].some((value) =>
    lower.includes(value),
  );
}

function uniqueValues(
  values: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          normalizeKey(
            value || "",
          ),
        )
        .filter(Boolean),
    ),
  );
}

export function getOpenAiRuntimeStatus() {
  const apiKey =
    getOpenAiApiKey();

  const configured =
    apiKeyLooksUsable(apiKey);

  const model =
    normalizeKey(
      getOptionalEnv(
        "OPENAI_MODEL",
      ),
    ) || "gpt-5-mini";

  const fastModel =
    normalizeKey(
      getOptionalEnv(
        "OPENAI_FAST_MODEL",
      ),
    ) ||
    model ||
    "gpt-5-mini";

  const qualityModel =
    normalizeKey(
      getOptionalEnv(
        "OPENAI_QUALITY_MODEL",
      ),
    ) || "gpt-5";

  const webSearchEnabled =
    envBoolean(
      "OPENAI_ENABLE_WEB_SEARCH",
      true,
    );

  const requireResearch =
    envBoolean(
      "OPENAI_REQUIRE_RESEARCH",
      true,
    );

  return {
    configured,
    keyFormatValid: configured,
    provider: configured
      ? "OpenAI Responses API"
      : "OpenAI key missing",
    model,
    fastModel,
    qualityModel,
    webSearchEnabled,
    requireResearch,
    requiredEnv:
      "OPENAI_API_KEY",
    maxOutputTokens:
      envNumber(
        "OPENAI_MAX_OUTPUT_TOKENS",
        8000,
        256,
        100000,
      ),
    timeoutPolicy: {
      instantMs:
        timeoutForMode(
          "instant",
        ),
      fastMs:
        timeoutForMode(
          "fast",
        ),
      balancedMs:
        timeoutForMode(
          "balanced",
        ),
      qualityMs:
        timeoutForMode(
          "quality",
        ),
    },
  };
}

function hashText(
  value: string,
) {
  return createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 32);
}

function anonymizeSafetyIdentifier(
  value: string | undefined,
) {
  const clean = String(
    value ?? "slice-user",
  )
    .trim()
    .toLowerCase();

  return `slice_${hashText(
    clean || "slice-user",
  )}`;
}

function cleanupCache() {
  const now = Date.now();

  for (const [
    key,
    record,
  ] of aiCache.entries()) {
    if (
      record.expiresAt <= now
    ) {
      aiCache.delete(key);
    }
  }

  if (aiCache.size > 500) {
    const ordered =
      Array.from(
        aiCache.entries(),
      ).sort(
        (a, b) =>
          a[1].expiresAt -
          b[1].expiresAt,
      );

    for (const [key] of ordered.slice(
      0,
      150,
    )) {
      aiCache.delete(key);
    }
  }
}

function cacheTtlForMode(
  mode: AiSpeedMode,
) {
  if (mode === "instant") {
    return 10 * 60 * 1000;
  }

  if (mode === "fast") {
    return 5 * 60 * 1000;
  }

  if (mode === "balanced") {
    return 3 * 60 * 1000;
  }

  return 60 * 1000;
}

function timeoutForMode(
  mode: AiSpeedMode,
) {
  if (mode === "instant") {
    return envNumber(
      "OPENAI_INSTANT_TIMEOUT_MS",
      45_000,
      5_000,
      900_000,
    );
  }

  if (mode === "fast") {
    return envNumber(
      "OPENAI_FAST_TIMEOUT_MS",
      90_000,
      5_000,
      900_000,
    );
  }

  if (
    mode === "balanced"
  ) {
    return envNumber(
      "OPENAI_BALANCED_TIMEOUT_MS",
      180_000,
      5_000,
      900_000,
    );
  }

  return envNumber(
    "OPENAI_QUALITY_TIMEOUT_MS",
    300_000,
    5_000,
    900_000,
  );
}

function maxOutputTokensForMode(
  mode: AiSpeedMode,
) {
  const configured =
    envNumber(
      "OPENAI_MAX_OUTPUT_TOKENS",
      8000,
      256,
      100000,
    );

  if (mode === "instant") {
    return Math.min(
      configured,
      2500,
    );
  }

  if (mode === "fast") {
    return Math.min(
      configured,
      4500,
    );
  }

  if (
    mode === "balanced"
  ) {
    return Math.min(
      configured,
      8000,
    );
  }

  return configured;
}

function modelCandidatesForMode(
  mode: AiSpeedMode,
  explicitModel?: string,
) {
  const runtime =
    getOpenAiRuntimeStatus();

  if (mode === "quality") {
    return uniqueValues([
      explicitModel,
      runtime.qualityModel,
      runtime.model,
      "gpt-5",
      "gpt-5-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4o-mini",
    ]);
  }

  if (
    mode === "instant" ||
    mode === "fast"
  ) {
    return uniqueValues([
      explicitModel,
      runtime.fastModel,
      runtime.model,
      "gpt-5-mini",
      "gpt-4.1-mini",
      "gpt-4o-mini",
      "gpt-4.1",
    ]);
  }

  return uniqueValues([
    explicitModel,
    runtime.model,
    runtime.qualityModel,
    "gpt-5-mini",
    "gpt-5",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4o-mini",
  ]);
}

function parseUsage(
  payload: any,
): AiUsage | undefined {
  const usage =
    payload?.usage;

  if (
    !usage ||
    typeof usage !== "object"
  ) {
    return undefined;
  }

  const inputTokens =
    Number(
      usage.input_tokens,
    );

  const outputTokens =
    Number(
      usage.output_tokens,
    );

  const totalTokens =
    Number(
      usage.total_tokens,
    );

  return {
    inputTokens:
      Number.isFinite(
        inputTokens,
      )
        ? inputTokens
        : undefined,
    outputTokens:
      Number.isFinite(
        outputTokens,
      )
        ? outputTokens
        : undefined,
    totalTokens:
      Number.isFinite(
        totalTokens,
      )
        ? totalTokens
        : undefined,
  };
}

function extractText(
  payload: any,
) {
  if (
    typeof payload?.output_text ===
      "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  const pieces: string[] = [];

  function visit(
    value: any,
  ) {
    if (!value) return;

    if (
      typeof value === "string"
    ) {
      if (value.trim()) {
        pieces.push(
          value.trim(),
        );
      }

      return;
    }

    if (
      Array.isArray(value)
    ) {
      value.forEach(visit);
      return;
    }

    if (
      typeof value !== "object"
    ) {
      return;
    }

    if (
      value.type ===
        "output_text" &&
      typeof value.text ===
        "string"
    ) {
      pieces.push(value.text);
    }

    if (
      typeof value.output_text ===
      "string"
    ) {
      pieces.push(
        value.output_text,
      );
    }

    if (
      typeof value.text ===
      "string"
    ) {
      pieces.push(value.text);
    }

    if (
      typeof value.text?.value ===
      "string"
    ) {
      pieces.push(
        value.text.value,
      );
    }

    if (value.content) {
      visit(value.content);
    }

    if (value.output) {
      visit(value.output);
    }

    if (value.message) {
      visit(value.message);
    }

    if (value.choices) {
      visit(value.choices);
    }
  }

  visit(payload?.output);
  visit(payload?.choices);

  return Array.from(
    new Set(pieces),
  )
    .join("\n")
    .replace(
      /\n{4,}/g,
      "\n\n",
    )
    .trim();
}

function extractSources(
  payload: any,
): AiSource[] {
  const sources: AiSource[] =
    [];

  function addSource(
    source: AiSource,
  ) {
    const url = String(
      source.url ?? "",
    ).trim();

    if (
      !url ||
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      return;
    }

    let fallbackTitle =
      "Web source";

    try {
      fallbackTitle =
        new URL(url).hostname ||
        fallbackTitle;
    } catch {
      fallbackTitle =
        "Web source";
    }

    sources.push({
      type: source.type,
      title: String(
        source.title ||
          fallbackTitle,
      )
        .trim()
        .slice(0, 300),
      url,
    });
  }

  function visit(
    value: any,
  ) {
    if (!value) return;

    if (
      Array.isArray(value)
    ) {
      value.forEach(visit);
      return;
    }

    if (
      typeof value !== "object"
    ) {
      return;
    }

    if (
      value.type ===
        "url_citation" &&
      typeof value.url ===
        "string"
    ) {
      addSource({
        type: "web",
        title:
          typeof value.title ===
          "string"
            ? value.title
            : "Web source",
        url: value.url,
      });
    }

    if (
      value.type ===
      "web_search_call"
    ) {
      const actionSources =
        value.action?.sources;

      if (
        Array.isArray(
          actionSources,
        )
      ) {
        for (const source of actionSources) {
          if (
            typeof source?.url ===
            "string"
          ) {
            addSource({
              type: "web",
              title:
                source.title ||
                "Web source",
              url: source.url,
            });
          }
        }
      }
    }

    if (value.annotations) {
      visit(
        value.annotations,
      );
    }

    if (value.content) {
      visit(value.content);
    }

    if (value.output) {
      visit(value.output);
    }

    if (value.action) {
      visit(value.action);
    }

    if (value.sources) {
      visit(value.sources);
    }
  }

  visit(payload?.output);

  const unique =
    new Map<
      string,
      AiSource
    >();

  for (const source of sources) {
    if (
      !unique.has(source.url)
    ) {
      unique.set(
        source.url,
        source,
      );
    }
  }

  return Array.from(
    unique.values(),
  ).slice(0, 12);
}

function responseUsedResearch(
  payload: any,
  sources: AiSource[],
) {
  if (sources.length > 0) {
    return true;
  }

  return Boolean(
    payload?.output?.some?.(
      (item: any) =>
        item?.type ===
        "web_search_call",
    ),
  );
}

function appendSourceList(
  text: string,
  sources: AiSource[],
) {
  if (
    !text ||
    !sources.length
  ) {
    return text;
  }

  if (
    /\n#{0,3}\s*Sources\s*:?\s*$/im.test(
      text,
    )
  ) {
    return text;
  }

  const sourceLines =
    sources
      .slice(0, 8)
      .map(
        (
          source,
          index,
        ) =>
          `${index + 1}. ${
            source.title
          } — ${source.url}`,
      )
      .join("\n");

  return `${text.trim()}\n\nSources\n${sourceLines}`;
}

function parseJsonLoose<T>(
  text: string,
  fallback: T,
): T {
  try {
    return JSON.parse(
      text,
    ) as T;
  } catch {
    const first =
      text.indexOf("{");

    const last =
      text.lastIndexOf("}");

    if (
      first >= 0 &&
      last > first
    ) {
      try {
        return JSON.parse(
          text.slice(
            first,
            last + 1,
          ),
        ) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

function normalize(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9#\s$@._/-]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractTicker(
  prompt: string,
) {
  const upper =
    prompt.toUpperCase();

  const explicit =
    upper.match(
      /(?:STOCK|TICKER|SYMBOL|HOLDING|WATCH|RESEARCH|ANALYZE)\s+\$?([A-Z]{1,6})/,
    ) ??
    upper.match(
      /\$([A-Z]{1,6})/,
    ) ??
    upper.match(
      /\b(NVDA|AAPL|MSFT|TSLA|META|GOOGL|GOOG|AMZN|AMD|NFLX|SPY|QQQ|IWM|TLT|AVGO|CRM|PLTR|COIN|MSTR|BRK\.B|JPM|BAC|GS|SCHW|BLK)\b/,
    );

  return (
    explicit?.[1] ??
    explicit?.[0]?.replace(
      /^\$/,
      "",
    ) ??
    null
  );
}

function extractPrice(
  prompt: string,
) {
  const match = prompt.match(
    /(?:\$|at\s+|above\s+|below\s+)(\d+(?:\.\d+)?)/i,
  );

  return match
    ? Number(match[1])
    : null;
}

function extractEmail(
  prompt: string,
) {
  const match = prompt.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  );

  return (
    match?.[0]?.toLowerCase() ??
    null
  );
}

function routeFromPrompt(
  prompt: string,
  platformBrain?: PlatformBrainContext,
) {
  const lower =
    normalize(prompt);

  const routes =
    platformBrain?.routes
      ?.length
      ? platformBrain.routes.map(
          (item) => ({
            route:
              item.route,
            label:
              item.label,
            aliases:
              item.aliases,
          }),
        )
      : FALLBACK_ROUTES;

  for (const item of routes) {
    const labels = [
      item.label,
      ...(item.aliases ?? []),
    ];

    if (
      labels.some((label) =>
        lower.includes(
          normalize(label),
        ),
      )
    ) {
      return item.route;
    }
  }

  return null;
}

function toneGuide(
  preferredTone?:
    | string
    | null,
) {
  const tone = normalize(
    preferredTone ||
      "professional",
  );

  if (
    tone.includes("witty")
  ) {
    return "Use polished, quick wit where it helps. Be clever, not silly, and keep utility first.";
  }

  if (
    tone.includes(
      "brutal",
    ) ||
    tone.includes("honest")
  ) {
    return "Be direct, candid, and tactful. Identify weak assumptions plainly without becoming abrasive.";
  }

  if (
    tone.includes(
      "encourag",
    )
  ) {
    return "Be constructive and confidence-building while remaining honest about risk, uncertainty, and constraints.";
  }

  if (
    tone.includes("calm")
  ) {
    return "Be calm, measured, reassuring, and low-hype.";
  }

  if (
    tone.includes("direct")
  ) {
    return "Be concise and decisive. Lead with the practical answer.";
  }

  return "Be professional, polished, precise, and advisor-grade.";
}

function detailGuide(
  commandStyle?:
    | string
    | null,
) {
  const style = normalize(
    commandStyle ||
      "balanced detail",
  );

  if (
    style.includes(
      "one-line",
    )
  ) {
    return "Answer in one or two crisp sentences unless accuracy requires more context.";
  }

  if (
    style.includes("short")
  ) {
    return "Use a short summary with only the most important supporting details.";
  }

  if (
    style.includes(
      "detailed",
    )
  ) {
    return "Give a structured, detailed breakdown with evidence, implications, risks, and next steps.";
  }

  if (
    style.includes("deep")
  ) {
    return "Give a deep research-style response with sources, assumptions, counterarguments, risks, and implications.";
  }

  return "Use balanced detail: enough to be genuinely useful without becoming a wall of text.";
}

function likelyPlatformOnlyCommand(
  prompt: string,
) {
  const lower =
    normalize(prompt);

  return PLATFORM_COMMAND_PREFIXES.some(
    (prefix) =>
      lower.startsWith(
        prefix,
      ),
  );
}

function shouldResearchPrompt(
  prompt: string,
) {
  const lower =
    normalize(prompt);

  if (!lower) return false;

  if (
    /^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)[.! ]*$/.test(
      lower,
    )
  ) {
    return false;
  }

  if (
    likelyPlatformOnlyCommand(
      prompt,
    )
  ) {
    return false;
  }

  return true;
}

function financialCoreInstructions() {
  const currentDate =
    new Date()
      .toISOString()
      .slice(0, 10);

  return `
You are Slice AI, a financial-industry research and operating assistant embedded inside the Slice advisor platform.

Current date: ${currentDate}.

Research and factuality rules:
- For factual claims that may be current, external, market-sensitive, regulatory, product-specific, company-specific, economic, or news-related, use the web-search tool when it is available.
- Prefer primary and authoritative sources: regulators, exchanges, issuers, official filings, government statistics, central banks, official documentation, and high-quality institutional publications.
- Separate verified facts, internal Slice facts, estimates, assumptions, scenarios, and recommendations.
- Use exact dates for time-sensitive facts and clearly state the freshness of material information.
- Never fabricate prices, performance, filings, client facts, sources, legal conclusions, tax conclusions, compliance approvals, or completed platform actions.
- Do not put private client names, emails, account details, portfolio values, or other confidential identifiers into public web searches. Use public tickers, public entities, and generalized topics instead.

Financial-industry rules:
- Address catalysts, valuation context, downside risks, liquidity, concentration, time horizon, suitability, tax sensitivity, and data limitations when relevant.
- Never guarantee returns or represent an uncertain outcome as certain.
- Distinguish educational analysis from individualized investment advice.
- Client-facing language must be clear, balanced, non-promotional, and suitable for advisor review.
- Tax, legal, regulatory, and compliance-sensitive conclusions must be framed for professional verification.
- When the prompt lacks required client facts, state what must be verified rather than inventing facts.

Platform-operation rules:
- Treat supplied platform context and verified tool results as authoritative internal facts.
- Never say that a task, email, assignment, approval, report, trade, alert, or data change was completed unless a platform tool result proves it.
- Sensitive delivery and external communication remain approval-gated.
- Give concrete next steps when the request involves work or execution.
`.trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  if (
    envBoolean(
      "OPENAI_DISABLE_TIMEOUT",
      false,
    )
  ) {
    return fetch(url, init);
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs,
    );

  try {
    return await fetch(url, {
      ...init,
      signal:
        controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeMetadata(
  metadata:
    | Record<
        string,
        | string
        | number
        | boolean
      >
    | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  const entries =
    Object.entries(metadata)
      .slice(0, 16)
      .map(
        ([key, value]) => [
          key
            .replace(
              /[^a-zA-Z0-9_-]/g,
              "_",
            )
            .slice(0, 64),
          String(value).slice(
            0,
            512,
          ),
        ],
      );

  return Object.fromEntries(
    entries,
  );
}

function errorMessageFromPayload(
  payload: OpenAiErrorPayload,
  status: number,
) {
  return (
    payload?.error
      ?.message ||
    payload?.message ||
    `OpenAI request failed with status ${status}.`
  );
}

function shouldStopModelFallback(
  status: number,
  error: string,
) {
  const lower =
    error.toLowerCase();

  if (status === 401) {
    return true;
  }

  if (
    status === 429 &&
    (lower.includes(
      "quota",
    ) ||
      lower.includes(
        "billing",
      ))
  ) {
    return true;
  }

  return false;
}

function commandSchema() {
  return {
    type: "object",
    additionalProperties:
      false,
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
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      riskLevel: {
        type: "string",
        enum: [
          "Low",
          "Medium",
          "High",
          "Critical",
        ],
      },
      requiresApproval: {
        type: "boolean",
      },
      route: {
        type: [
          "string",
          "null",
        ],
      },
      answer: {
        type: "string",
      },
      userFacingSummary: {
        type: "string",
      },
      parameters: {
        type: "object",
        additionalProperties:
          false,
        properties: {
          route: {
            type: [
              "string",
              "null",
            ],
          },
          ticker: {
            type: [
              "string",
              "null",
            ],
          },
          query: {
            type: [
              "string",
              "null",
            ],
          },
          title: {
            type: [
              "string",
              "null",
            ],
          },
          detail: {
            type: [
              "string",
              "null",
            ],
          },
          dueDate: {
            type: [
              "string",
              "null",
            ],
          },
          priority: {
            type: [
              "string",
              "null",
            ],
          },
          clientName: {
            type: [
              "string",
              "null",
            ],
          },
          email: {
            type: [
              "string",
              "null",
            ],
          },
          projectTitle: {
            type: [
              "string",
              "null",
            ],
          },
          watchlistName: {
            type: [
              "string",
              "null",
            ],
          },
          symbol: {
            type: [
              "string",
              "null",
            ],
          },
          upperTargetPrice: {
            type: [
              "number",
              "null",
            ],
          },
          lowerTargetPrice: {
            type: [
              "number",
              "null",
            ],
          },
          color: {
            type: [
              "string",
              "null",
            ],
          },
          reportTitle: {
            type: [
              "string",
              "null",
            ],
          },
          subject: {
            type: [
              "string",
              "null",
            ],
          },
          body: {
            type: [
              "string",
              "null",
            ],
          },
          recipient: {
            type: [
              "string",
              "null",
            ],
          },
          deliveryChannel: {
            type: [
              "string",
              "null",
            ],
          },
          phone: {
            type: [
              "string",
              "null",
            ],
          },
          jobKey: {
            type: [
              "string",
              "null",
            ],
          },
          memory: {
            type: [
              "string",
              "null",
            ],
          },
          approvalDecision: {
            type: [
              "string",
              "null",
            ],
            enum: [
              "approve",
              "reject",
              null,
            ],
          },
          researchDepth: {
            type: [
              "string",
              "null",
            ],
            enum: [
              "quick",
              "standard",
              "deep",
              null,
            ],
          },
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
    required: [
      "intent",
      "confidence",
      "riskLevel",
      "requiresApproval",
      "route",
      "answer",
      "userFacingSummary",
      "parameters",
    ],
  };
}

function defaultCommandParameters(
  prompt: string,
  route: string | null,
) {
  const lower =
    normalize(prompt);

  const ticker =
    extractTicker(prompt);

  const price =
    extractPrice(prompt);

  const email =
    extractEmail(prompt);

  return {
    route,
    ticker,
    query: prompt,
    title:
      prompt.slice(0, 180),
    detail: prompt,
    dueDate: null,
    priority:
      lower.includes(
        "urgent",
      ) ||
      lower.includes(
        "critical",
      ) ||
      lower.includes(
        "high priority",
      )
        ? "High"
        : "Medium",
    clientName: null,
    email,
    projectTitle:
      prompt.slice(0, 180),
    watchlistName:
      "AI Command Watchlist",
    symbol: ticker,
    upperTargetPrice:
      lower.includes(
        "above",
      ) ||
      lower.includes(
        "higher than",
      )
        ? price
        : null,
    lowerTargetPrice:
      lower.includes(
        "below",
      ) ||
      lower.includes(
        "lower than",
      )
        ? price
        : null,
    color:
      lower.includes("blue")
        ? "blue"
        : lower.includes(
              "green",
            )
          ? "green"
          : lower.includes(
                "purple",
              )
            ? "purple"
            : lower.includes(
                  "gold",
                )
              ? "gold"
              : lower.includes(
                    "mint",
                  )
                ? "mint"
                : null,
    reportTitle:
      "Slice AI Report",
    subject: null,
    body: null,
    recipient: email,
    deliveryChannel:
      lower.includes(
        "text",
      ) ||
      lower.includes("sms")
        ? "Text"
        : lower.includes(
              "email",
            )
          ? "Email"
          : "Dashboard",
    phone: null,
    jobKey:
      lower.includes("price")
        ? "watchlist_price_check"
        : lower.includes(
              "delivery",
            )
          ? "notification_delivery"
          : lower.includes(
                "advisor day",
              )
            ? "advisor_day"
            : "vendor_health",
    memory:
      lower.includes(
        "remember",
      )
        ? prompt
            .replace(
              /remember/i,
              "",
            )
            .trim()
        : null,
    approvalDecision:
      lower.includes(
        "reject",
      ) ||
      lower.includes(
        "decline",
      )
        ? ("reject" as const)
        : lower.includes(
              "approve",
            )
          ? ("approve" as const)
          : null,
    researchDepth:
      lower.includes("deep")
        ? ("deep" as const)
        : lower.includes(
              "quick",
            )
          ? ("quick" as const)
          : ("standard" as const),
  };
}

export function fallbackSliceCommand(
  prompt: string,
  platformBrain?: PlatformBrainContext,
): SliceStructuredCommand {
  const lower =
    normalize(prompt);

  const route =
    routeFromPrompt(
      prompt,
      platformBrain,
    );

  let intent: SliceCommandIntent =
    route
      ? "navigate"
      : "answer";

  if (
    lower.includes(
      "source",
    ) ||
    lower.includes(
      "proof",
    ) ||
    lower.includes("cite")
  ) {
    intent =
      "source_lookup";
  }

  if (
    lower.includes(
      "search",
    ) ||
    lower.includes("find") ||
    lower.includes(
      "ask the firm",
    )
  ) {
    intent =
      "platform_search";
  }

  if (
    lower.includes(
      "research",
    ) ||
    lower.includes(
      "analyze",
    ) ||
    lower.includes(
      "deep dive",
    ) ||
    lower.includes(
      "investment thesis",
    )
  ) {
    intent = "research";
  }

  if (
    lower.includes("sort") ||
    lower.includes("rank") ||
    lower.includes("top ")
  ) {
    intent = "sort_data";
  }

  if (
    lower.includes("task") ||
    lower.includes("to do") ||
    lower.includes("todo") ||
    lower.includes(
      "remind",
    )
  ) {
    intent = "create_task";
  }

  if (
    lower.includes(
      "client",
    ) &&
    (lower.includes(
      "create",
    ) ||
      lower.includes("add") ||
      lower.includes("new"))
  ) {
    intent =
      "create_client";
  }

  if (
    lower.includes(
      "project",
    ) &&
    (lower.includes(
      "create",
    ) ||
      lower.includes("add") ||
      lower.includes("new"))
  ) {
    intent =
      "create_project";
  }

  if (
    lower.includes("watch") ||
    lower.includes(
      "track ticker",
    ) ||
    lower.includes(
      "add ticker",
    )
  ) {
    intent =
      "create_watchlist_item";
  }

  if (
    lower.includes(
      "price alert",
    ) ||
    lower.includes("hits") ||
    lower.includes(
      "above",
    ) ||
    lower.includes("below")
  ) {
    intent =
      "create_price_alert";
  }

  if (
    lower.includes("email") ||
    lower.includes("draft") ||
    lower.includes(
      "message investors",
    ) ||
    lower.includes(
      "message client",
    )
  ) {
    intent = "draft_email";
  }

  if (
    lower.includes("pdf") ||
    lower.includes(
      "report",
    ) ||
    lower.includes(
      "briefing packet",
    )
  ) {
    intent = "create_report";
  }

  if (
    lower.includes(
      "advisor day",
    ) ||
    lower.includes(
      "what should i do",
    ) ||
    lower.includes(
      "prioritize my day",
    )
  ) {
    intent = "advisor_day";
  }

  if (
    lower.includes(
      "backend",
    ) ||
    lower.includes(
      "kernel",
    ) ||
    lower.includes("job") ||
    lower.includes(
      "vendor health",
    )
  ) {
    intent = "backend_job";
  }

  if (
    lower.includes(
      "approve",
    ) ||
    lower.includes(
      "reject",
    ) ||
    lower.includes(
      "decline",
    )
  ) {
    intent =
      "approval_decision";
  }

  if (
    lower.includes(
      "remember",
    )
  ) {
    intent = "remember";
  }

  if (
    lower.includes("theme") ||
    lower.includes("color")
  ) {
    intent = "theme";
  }

  if (
    lower.includes("help") ||
    lower.includes(
      "what can you do",
    )
  ) {
    intent = "help";
  }

  const riskLevel =
    HIGH_RISK_INTENTS.has(
      intent,
    )
      ? "High"
      : "Low";

  const requiresApproval =
    APPROVAL_REQUIRED_INTENTS.has(
      intent,
    );

  return {
    intent,
    confidence: route
      ? 0.82
      : 0.58,
    riskLevel,
    requiresApproval,
    route,
    answer:
      intent === "answer"
        ? "I will answer this through Slice's financial research layer."
        : `I interpreted this as ${intent.replace(
            /_/g,
            " ",
          )}.`,
    userFacingSummary:
      `Interpreted as ${intent.replace(
        /_/g,
        " ",
      )}.`,
    parameters:
      defaultCommandParameters(
        prompt,
        route,
      ),
  };
}

function normalizeStructuredCommand(
  value:
    | Partial<SliceStructuredCommand>
    | null
    | undefined,
  prompt: string,
  platformBrain?: PlatformBrainContext,
): SliceStructuredCommand {
  const fallback =
    fallbackSliceCommand(
      prompt,
      platformBrain,
    );

  const allowedIntents =
    new Set<SliceCommandIntent>(
      [
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
    );

  const intent =
    allowedIntents.has(
      value?.intent as SliceCommandIntent,
    )
      ? (value?.intent as SliceCommandIntent)
      : fallback.intent;

  const parameters = {
    ...fallback.parameters,
    ...(value?.parameters ??
      {}),
  };

  const route =
    typeof value?.route ===
    "string"
      ? value.route
      : typeof parameters.route ===
          "string"
        ? parameters.route
        : fallback.route;

  parameters.route = route;

  const requiresApproval =
    APPROVAL_REQUIRED_INTENTS.has(
      intent,
    ) ||
    Boolean(
      value?.requiresApproval,
    );

  let riskLevel: SliceStructuredCommand["riskLevel"] =
    value?.riskLevel ===
      "Critical" ||
    value?.riskLevel ===
      "High" ||
    value?.riskLevel ===
      "Medium" ||
    value?.riskLevel ===
      "Low"
      ? value.riskLevel
      : HIGH_RISK_INTENTS.has(
            intent,
          )
        ? "High"
        : "Low";

  if (
    requiresApproval &&
    riskLevel === "Low"
  ) {
    riskLevel = "Medium";
  }

  const confidenceCandidate =
    Number(
      value?.confidence,
    );

  const confidence =
    Number.isFinite(
      confidenceCandidate,
    )
      ? Math.max(
          0,
          Math.min(
            1,
            confidenceCandidate,
          ),
        )
      : fallback.confidence;

  return {
    intent,
    confidence,
    riskLevel,
    requiresApproval,
    route,
    answer:
      typeof value?.answer ===
        "string" &&
      value.answer.trim()
        ? value.answer.trim()
        : fallback.answer,
    userFacingSummary:
      typeof value?.userFacingSummary ===
        "string" &&
      value.userFacingSummary.trim()
        ? value.userFacingSummary.trim()
        : fallback.userFacingSummary,
    parameters: {
      route:
        parameters.route ??
        null,
      ticker:
        typeof parameters.ticker ===
        "string"
          ? parameters.ticker.toUpperCase()
          : null,
      query:
        typeof parameters.query ===
        "string"
          ? parameters.query
          : prompt,
      title:
        typeof parameters.title ===
        "string"
          ? parameters.title
          : null,
      detail:
        typeof parameters.detail ===
        "string"
          ? parameters.detail
          : prompt,
      dueDate:
        typeof parameters.dueDate ===
        "string"
          ? parameters.dueDate
          : null,
      priority:
        typeof parameters.priority ===
        "string"
          ? parameters.priority
          : "Medium",
      clientName:
        typeof parameters.clientName ===
        "string"
          ? parameters.clientName
          : null,
      email:
        typeof parameters.email ===
        "string"
          ? parameters.email
          : null,
      projectTitle:
        typeof parameters.projectTitle ===
        "string"
          ? parameters.projectTitle
          : null,
      watchlistName:
        typeof parameters.watchlistName ===
        "string"
          ? parameters.watchlistName
          : "AI Command Watchlist",
      symbol:
        typeof parameters.symbol ===
        "string"
          ? parameters.symbol.toUpperCase()
          : typeof parameters.ticker ===
              "string"
            ? parameters.ticker.toUpperCase()
            : null,
      upperTargetPrice:
        typeof parameters.upperTargetPrice ===
          "number" &&
        Number.isFinite(
          parameters.upperTargetPrice,
        )
          ? parameters.upperTargetPrice
          : null,
      lowerTargetPrice:
        typeof parameters.lowerTargetPrice ===
          "number" &&
        Number.isFinite(
          parameters.lowerTargetPrice,
        )
          ? parameters.lowerTargetPrice
          : null,
      color:
        typeof parameters.color ===
        "string"
          ? parameters.color
          : null,
      reportTitle:
        typeof parameters.reportTitle ===
        "string"
          ? parameters.reportTitle
          : "Slice AI Report",
      subject:
        typeof parameters.subject ===
        "string"
          ? parameters.subject
          : null,
      body:
        typeof parameters.body ===
        "string"
          ? parameters.body
          : null,
      recipient:
        typeof parameters.recipient ===
        "string"
          ? parameters.recipient
          : null,
      deliveryChannel:
        typeof parameters.deliveryChannel ===
        "string"
          ? parameters.deliveryChannel
          : "Dashboard",
      phone:
        typeof parameters.phone ===
        "string"
          ? parameters.phone
          : null,
      jobKey:
        typeof parameters.jobKey ===
        "string"
          ? parameters.jobKey
          : null,
      memory:
        typeof parameters.memory ===
        "string"
          ? parameters.memory
          : null,
      approvalDecision:
        parameters.approvalDecision ===
          "approve" ||
        parameters.approvalDecision ===
          "reject"
          ? parameters.approvalDecision
          : null,
      researchDepth:
        parameters.researchDepth ===
          "quick" ||
        parameters.researchDepth ===
          "standard" ||
        parameters.researchDepth ===
          "deep"
          ? parameters.researchDepth
          : "standard",
    },
  };
}

export async function generateAiText(
  input: GenerateAiTextInput,
): Promise<AiResponseResult> {
  const startedAt =
    Date.now();

  const apiKey =
    getOpenAiApiKey();

  const runtime =
    getOpenAiRuntimeStatus();

  const speedMode =
    input.speedMode ||
    "balanced";

  const timeoutMs =
    input.timeoutMs ??
    timeoutForMode(
      speedMode,
    );

  const maxOutputTokens =
    input.maxOutputTokens ??
    maxOutputTokensForMode(
      speedMode,
    );

  const useCache =
    input.useCache !== false;

  const researchMode =
    input.researchMode ??
    (input.enableWebSearch
      ? "auto"
      : runtime.webSearchEnabled
        ? "auto"
        : "off");

  const useWebSearch =
    researchMode !== "off" &&
    (input.enableWebSearch ??
      runtime.webSearchEnabled);

  const requireResearch =
    researchMode ===
    "required";

  const attemptedModels: string[] =
    [];

  const modelCandidates =
    modelCandidatesForMode(
      speedMode,
      input.model,
    );

  const computedCacheKey =
    input.cacheKey ||
    `ai:${hashText(
      JSON.stringify({
        models:
          modelCandidates,
        speedMode,
        instructions:
          input.instructions,
        prompt: input.prompt,
        web: useWebSearch,
        researchMode,
        maxOutputTokens,
      }),
    )}`;

  cleanupCache();

  if (useCache) {
    const cached =
      aiCache.get(
        computedCacheKey,
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return {
        ...cached.result,
        status: "cached",
        provider:
          `${cached.result.provider} cache`,
        latencyMs:
          Date.now() -
          startedAt,
        cacheKey:
          computedCacheKey,
      };
    }
  }

  if (
    !apiKeyLooksUsable(
      apiKey,
    )
  ) {
    return {
      ok: false,
      provider: "OpenAI",
      status: "missing",
      text:
        input.fallbackText ||
        "",
      error:
        "OPENAI_API_KEY is missing or still contains a placeholder value.",
      latencyMs:
        Date.now() -
        startedAt,
      model:
        modelCandidates[0] ||
        runtime.model,
      cacheKey:
        computedCacheKey,
      attemptedModels,
      sources: [],
      researchUsed: false,
    };
  }

  let lastError = "";
  let lastPayload: unknown =
    null;

  let lastModel =
    modelCandidates[0] ||
    runtime.model;

  let lastStatus: AiResponseStatus =
    "failed";

  let lastRequestId:
    | string
    | undefined;

  const instructions = [
    financialCoreInstructions(),
    input.instructions,
  ]
    .filter(Boolean)
    .join("\n\n");

  for (const model of modelCandidates) {
    attemptedModels.push(
      model,
    );

    lastModel = model;

    try {
      const response =
        await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                model,
                instructions,
                input: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: input.prompt,
                      },
                    ],
                  },
                ],
                tools:
                  useWebSearch
                    ? [
                        {
                          type: "web_search",
                        },
                      ]
                    : undefined,
                max_output_tokens:
                  maxOutputTokens,
                safety_identifier:
                  anonymizeSafetyIdentifier(
                    input.safetyIdentifier,
                  ),
                metadata:
                  sanitizeMetadata(
                    input.metadata,
                  ),
                store: false,
              },
            ),
          },
          timeoutMs,
        );

      const payload =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as any;

      lastPayload = payload;

      lastRequestId =
        response.headers.get(
          "x-request-id",
        ) ||
        payload?.id ||
        undefined;

      if (!response.ok) {
        lastError =
          errorMessageFromPayload(
            payload,
            response.status,
          );

        if (
          shouldStopModelFallback(
            response.status,
            lastError,
          )
        ) {
          break;
        }

        continue;
      }

      const text =
        extractText(payload);

      const sources =
        extractSources(payload);

      const researchUsed =
        responseUsedResearch(
          payload,
          sources,
        );

      if (!text) {
        lastError =
          "OpenAI returned an empty response.";

        continue;
      }

      if (
        requireResearch &&
        (!researchUsed ||
          sources.length === 0)
      ) {
        lastError =
          "OpenAI returned an answer without visible supporting web sources.";

        continue;
      }

      const finalText =
        input.appendSources ===
        false
          ? text
          : appendSourceList(
              text,
              sources,
            );

      const result: AiResponseResult =
        {
          ok: true,
          provider:
            `OpenAI/${model}`,
          status:
            "completed",
          text: finalText,
          raw: payload,
          latencyMs:
            Date.now() -
            startedAt,
          model,
          cacheKey:
            computedCacheKey,
          requestId:
            lastRequestId,
          sources,
          researchUsed,
          attemptedModels,
          usage:
            parseUsage(
              payload,
            ),
        };

      if (
        useCache &&
        result.text
      ) {
        aiCache.set(
          computedCacheKey,
          {
            expiresAt:
              Date.now() +
              (input.cacheTtlMs ??
                cacheTtlForMode(
                  speedMode,
                )),
            result,
          },
        );
      }

      return result;
    } catch (error) {
      const timedOut =
        error instanceof
          Error &&
        (error.name ===
          "AbortError" ||
          error.message
            .toLowerCase()
            .includes(
              "abort",
            ));

      lastStatus =
        timedOut
          ? "timeout"
          : "failed";

      lastError = timedOut
        ? `OpenAI request exceeded ${timeoutMs}ms.`
        : error instanceof
              Error
          ? error.message
          : "OpenAI request failed.";

      if (
        timedOut &&
        speedMode !==
          "quality"
      ) {
        break;
      }
    }
  }

  return {
    ok: false,
    provider:
      `OpenAI/${lastModel}`,
    status: lastStatus,
    text:
      input.fallbackText ||
      "",
    raw: lastPayload,
    error:
      lastError ||
      "No configured OpenAI model returned a usable answer.",
    latencyMs:
      Date.now() -
      startedAt,
    model: lastModel,
    cacheKey:
      computedCacheKey,
    requestId:
      lastRequestId,
    sources: [],
    researchUsed: false,
    attemptedModels,
  };
}

export async function generateUniversalAssistantReply(
  input: UniversalAssistantInput,
): Promise<AiResponseResult> {
  const botName =
    input.botName ||
    "Slice AI";

  const preferredTone =
    input.preferredTone ||
    "Professional";

  const commandStyle =
    input.commandStyle ||
    "Balanced detail";

  const speedMode =
    input.speedMode ||
    "balanced";

  const externalResearchNeeded =
    shouldResearchPrompt(
      input.prompt,
    );

  const requireResearch =
    input.requireResearch ??
    (externalResearchNeeded &&
      getOpenAiRuntimeStatus()
        .requireResearch);

  const enableWebSearch =
    input.enableWebSearch ??
    externalResearchNeeded;

  const fallback =
    input.platformResult
      ? `Here is the verified Slice platform result:\n\n${input.platformResult}`
      : "OpenAI did not return a usable researched response. Check the API-key health, billing, model access, and web-search access before relying on this answer.";

  const instructions = `
You are ${botName}, the universal AI assistant inside Slice, a financial-advisor intelligence and operating platform.

Voice and personality:
- Preferred tone: ${preferredTone}.
- ${toneGuide(preferredTone)}
- ${detailGuide(commandStyle)}
- Autonomy posture: ${input.autonomyLevel || "Advisor approval required"}.
- Custom instructions: ${input.customInstructions || "None"}.

Response rules:
- Answer the user's actual request directly; do not return generic product marketing.
- Use supplied Slice platform facts exactly and distinguish them from external research.
- When external research is needed, use web search and make the supporting sources visible.
- For an investment or market question, include the most relevant facts, catalysts, risks, uncertainty, and practical advisor implications.
- For a report request, produce report-ready content with an executive summary, findings, assumptions, risks, and next steps.
- For a client-facing request, use balanced, plain-English wording suitable for advisor review.
- Do not claim a platform action occurred unless platformResult proves it.
- Preserve confidentiality: never expose or publicly research private client identifiers.
`.trim();

  return generateAiText({
    instructions,
    prompt: JSON.stringify(
      {
        userRequest:
          input.prompt,
        currentSurface: {
          currentPath:
            input.currentPath,
          pageTitle:
            input.pageTitle,
        },
        user: {
          name:
            input.userName,
        },
        style: {
          preferredTone,
          commandStyle,
          autonomyLevel:
            input.autonomyLevel,
        },
        personality:
          input.personality ??
          {},
        riskPreferences:
          input.risk ?? {},
        memory:
          input.memory ?? [],
        recentMessages:
          input.recentMessages ??
          [],
        commandIntent:
          input.commandIntent ??
          null,
        verifiedPlatformResult:
          input.platformResult ??
          null,
        platformSnapshot:
          input.platformSnapshot ??
          {},
        financialContext:
          input.financialContext ??
          {},
      },
      null,
      2,
    ),
    model: input.model,
    enableWebSearch,
    researchMode:
      requireResearch
        ? "required"
        : enableWebSearch
          ? "auto"
          : "off",
    safetyIdentifier:
      input.safetyIdentifier ||
      input.userEmail,
    speedMode,
    fallbackText: fallback,
    appendSources: true,
    useCache: true,
    metadata: {
      surface:
        "slice_ai_studio",
      research_required:
        requireResearch,
      command_intent:
        input.commandIntent ||
        "answer",
    },
  });
}

export async function parseSliceCommandWithAi(
  input: {
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
    voiceTranscript?:
      | string
      | null;
    preferredTone?:
      | string
      | null;
    commandStyle?:
      | string
      | null;
    customInstructions?:
      | string
      | null;
    personality?: Record<
      string,
      unknown
    > | null;
  },
): Promise<{
  ok: boolean;
  command: SliceStructuredCommand;
  provider: string;
  error?: string;
}> {
  const apiKey =
    getOpenAiApiKey();

  const fallback =
    fallbackSliceCommand(
      input.prompt,
      input.platformBrain,
    );

  if (
    !apiKeyLooksUsable(
      apiKey,
    )
  ) {
    return {
      ok: false,
      provider:
        "Local fallback",
      command: fallback,
      error:
        "OPENAI_API_KEY is missing or still contains a placeholder value.",
    };
  }

  const speedMode: AiSpeedMode =
    "fast";

  const models =
    modelCandidatesForMode(
      speedMode,
    );

  const timeoutMs =
    timeoutForMode(
      speedMode,
    );

  const instructions = `
You are Slice's financial-platform command interpreter.

Interpret the user's typed or spoken request as exactly one safe structured command.

Rules:
- Correct rough voice transcription and imperfect wording using the supplied platform map, learned phrases, and corrections.
- Prefer navigate when the user explicitly asks to open or go to a Slice section.
- Use answer for open-ended explanatory questions.
- Use research for public financial, investment, company, market, economic, regulatory, or industry analysis.
- Use source_lookup when the user requests proof, citations, sources, evidence, or supporting documentation.
- Use platform_search only for searching permission-scoped internal Slice or firm records.
- Use create_task, create_client, create_project, create_watchlist_item, or create_price_alert only when creation is explicit.
- Use backend_job for vendor health, data-quality checks, delivery processing, market-data checks, and advisor-day jobs.
- Use approval_decision only when the user explicitly approves or rejects a pending item.
- External communication, delivery, reports, and sensitive changes remain approval-gated.
- Never interpret a research question as an instruction to trade.
- Never guarantee investment returns.
- Return only JSON matching the required schema.
`.trim();

  const platformContext = {
    userName:
      input.userName,
    firmName:
      input.firmName ??
      "No active firm",
    botName:
      input.botName ??
      "Slice AI",
    preferredTone:
      input.preferredTone ??
      "Professional",
    commandStyle:
      input.commandStyle ??
      "Balanced detail",
    customInstructions:
      input.customInstructions ??
      null,
    personality:
      input.personality ??
      {},
    operationalSnapshot: {
      openTasks:
        input.openTasks ?? 0,
      unreadAlerts:
        input.unreadAlerts ??
        0,
      clients:
        input.clients ?? 0,
      portfolioValue:
        input.portfolioValue ??
        0,
    },
    voiceTranscript:
      input.voiceTranscript,
    memory:
      input.memory ?? [],
    platformBrain:
      input.platformBrain ??
      {},
  };

  let lastError = "";
  let lastProvider =
    "OpenAI";

  for (const model of models) {
    lastProvider =
      `OpenAI/${model}`;

    try {
      const response =
        await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                model,
                instructions,
                input: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: `Platform context:\n${JSON.stringify(
                          platformContext,
                          null,
                          2,
                        )}\n\nUser command:\n${input.prompt}`,
                      },
                    ],
                  },
                ],
                text: {
                  format: {
                    type: "json_schema",
                    name: "slice_structured_command",
                    strict: true,
                    schema:
                      commandSchema(),
                  },
                },
                max_output_tokens:
                  2400,
                store: false,
                safety_identifier:
                  anonymizeSafetyIdentifier(
                    input.userEmail,
                  ),
                metadata: {
                  surface:
                    "slice_command_parser",
                },
              },
            ),
          },
          timeoutMs,
        );

      const payload =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as any;

      const text =
        extractText(payload);

      if (!response.ok) {
        lastError =
          errorMessageFromPayload(
            payload,
            response.status,
          );

        if (
          shouldStopModelFallback(
            response.status,
            lastError,
          )
        ) {
          break;
        }

        continue;
      }

      if (!text) {
        lastError =
          "OpenAI returned an empty structured command.";

        continue;
      }

      const parsed =
        parseJsonLoose<
          Partial<SliceStructuredCommand>
        >(
          text,
          fallback,
        );

      return {
        ok: true,
        provider:
          lastProvider,
        command:
          normalizeStructuredCommand(
            parsed,
            input.prompt,
            input.platformBrain,
          ),
      };
    } catch (error) {
      lastError =
        error instanceof
          Error
          ? error.message
          : "AI command parsing failed.";
    }
  }

  return {
    ok: false,
    provider:
      lastProvider,
    command: fallback,
    error:
      lastError ||
      "AI command parsing failed.",
  };
}

export async function verifyOpenAiConnection(
  input?: {
    force?: boolean;
    timeoutMs?: number;
  },
): Promise<OpenAiHealthResult> {
  const now = Date.now();

  if (
    !input?.force &&
    healthCache &&
    healthCache.expiresAt >
      now
  ) {
    return healthCache.result;
  }

  const startedAt =
    Date.now();

  const apiKey =
    getOpenAiApiKey();

  const runtime =
    getOpenAiRuntimeStatus();

  const models =
    modelCandidatesForMode(
      "fast",
    );

  if (
    !apiKeyLooksUsable(
      apiKey,
    )
  ) {
    const result: OpenAiHealthResult =
      {
        ok: false,
        configured: false,
        status: "missing",
        provider: "OpenAI",
        model:
          models[0] ||
          runtime.model,
        latencyMs:
          Date.now() -
          startedAt,
        error:
          "OPENAI_API_KEY is missing or still contains a placeholder value.",
        checkedAt:
          new Date().toISOString(),
      };

    healthCache = {
      expiresAt:
        now + 30_000,
      result,
    };

    return result;
  }

  let lastError = "";
  let lastModel =
    models[0] ||
    runtime.model;

  let lastRequestId:
    | string
    | undefined;

  let timedOut = false;

  for (const model of models) {
    lastModel = model;

    try {
      const response =
        await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              {
                model,
                input:
                  "Reply with exactly: SLICE_OPENAI_READY",
                max_output_tokens:
                  32,
                store: false,
                safety_identifier:
                  anonymizeSafetyIdentifier(
                    "slice-health-check",
                  ),
                metadata: {
                  surface:
                    "slice_openai_health_check",
                },
              },
            ),
          },
          input?.timeoutMs ??
            30_000,
        );

      const payload =
        (await response
          .json()
          .catch(
            () => ({}),
          )) as any;

      lastRequestId =
        response.headers.get(
          "x-request-id",
        ) ||
        payload?.id ||
        undefined;

      if (!response.ok) {
        lastError =
          errorMessageFromPayload(
            payload,
            response.status,
          );

        if (
          response.status ===
          401
        ) {
          const result: OpenAiHealthResult =
            {
              ok: false,
              configured: true,
              status:
                "invalid",
              provider:
                "OpenAI Responses API",
              model,
              latencyMs:
                Date.now() -
                startedAt,
              error:
                lastError,
              requestId:
                lastRequestId,
              checkedAt:
                new Date().toISOString(),
            };

          healthCache = {
            expiresAt:
              now + 60_000,
            result,
          };

          return result;
        }

        continue;
      }

      const text =
        extractText(payload);

      if (!text) {
        lastError =
          "OpenAI health check returned no text.";

        continue;
      }

      const result: OpenAiHealthResult =
        {
          ok: true,
          configured: true,
          status: "ready",
          provider:
            "OpenAI Responses API",
          model,
          latencyMs:
            Date.now() -
            startedAt,
          requestId:
            lastRequestId,
          checkedAt:
            new Date().toISOString(),
        };

      healthCache = {
        expiresAt:
          now +
          5 * 60 * 1000,
        result,
      };

      return result;
    } catch (error) {
      timedOut =
        error instanceof
          Error &&
        (error.name ===
          "AbortError" ||
          error.message
            .toLowerCase()
            .includes(
              "abort",
            ));

      lastError =
        error instanceof
          Error
          ? error.message
          : "OpenAI health check failed.";

      if (timedOut) break;
    }
  }

  const result: OpenAiHealthResult =
    {
      ok: false,
      configured: true,
      status: timedOut
        ? "timeout"
        : "failed",
      provider:
        "OpenAI Responses API",
      model: lastModel,
      latencyMs:
        Date.now() -
        startedAt,
      error:
        lastError ||
        "No configured OpenAI model passed the health check.",
      requestId:
        lastRequestId,
      checkedAt:
        new Date().toISOString(),
    };

  healthCache = {
    expiresAt:
      now + 60_000,
    result,
  };

  return result;
}