import type { SliceStructuredCommand } from "@/lib/integrations/ai";

type SliceCommandIntent = SliceStructuredCommand["intent"];

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

export type FastCommandMatch = {
  matched: true;
  confidence: number;
  reason: string;
  command: SliceStructuredCommand;
};

const VALID_INTENTS: SliceCommandIntent[] = [
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
];

const FALLBACK_ROUTES = [
  {
    label: "Workspace",
    route: "/workspace",
    aliases: ["home", "dashboard", "main workspace", "main page", "slice home", "start screen"],
  },
  {
    label: "Command Layer",
    route: "/workspace?tab=command",
    aliases: ["command", "backend controls", "live systems", "integration controls", "control layer"],
  },
  {
    label: "Firm Calendar",
    route: "/workspace?tab=firm-calendar",
    aliases: ["calendar", "calender", "schedule", "agenda", "firm calendar", "my day"],
  },
  {
    label: "Team Board",
    route: "/workspace?tab=team-board",
    aliases: ["team", "projects", "task board", "team board", "project board"],
  },
  {
    label: "Watchlists",
    route: "/workspace?tab=watchlists",
    aliases: ["watchlist", "watch list", "tracked assets", "tracked stocks", "my stocks"],
  },
  {
    label: "Clients",
    route: "/workspace?tab=clients",
    aliases: ["client", "clients", "wealth", "households", "investors"],
  },
  {
    label: "Portfolio",
    route: "/workspace?tab=portfolio",
    aliases: ["portfolio", "holdings", "allocation", "models", "portfolio tab"],
  },
  {
    label: "Intelligence",
    route: "/workspace?tab=intelligence",
    aliases: ["intelligence", "signals", "news", "scanner", "scan"],
  },
  {
    label: "Notifications",
    route: "/workspace?tab=notifications",
    aliases: ["notifications", "delivery", "messages", "alerts delivery"],
  },
  {
    label: "Personal Bot",
    route: "/workspace/personal-bot",
    aliases: ["bot", "robot", "assistant", "voice bot", "my bot", "slice bot"],
  },
  {
    label: "Backend Kernel",
    route: "/backend-kernel",
    aliases: ["backend", "kernel", "jobs", "vendor health", "integrations", "backend kernel"],
  },
  {
    label: "Backend Readiness",
    route: "/backend-readiness",
    aliases: ["readiness", "system health", "approval center", "tenant checks"],
  },
  {
    label: "Market Visuals",
    route: "/market-visuals",
    aliases: [
      "visuals",
      "viusals",
      "charts",
      "graphs",
      "market charts",
      "technical charts",
      "visual chart thing",
      "trading charts",
      "stock charts",
      "market visual",
    ],
  },
  {
    label: "Watchlist Alerts",
    route: "/watchlist-alerts",
    aliases: ["price alerts", "stock alerts", "high low alerts", "alert page", "ticker alerts"],
  },
  {
    label: "Advisor Command Center",
    route: "/advisor-command-center",
    aliases: ["advisor command", "client brain", "next best action", "ai command", "advisor ai"],
  },
  {
    label: "Triage",
    route: "/triage",
    aliases: ["trage", "triage", "news triage", "headline triage", "news sorter"],
  },
  {
    label: "Opportunity Radar",
    route: "/opportunity-radar",
    aliases: ["radar", "opportunities", "opportunity signals", "investment radar", "opportunity page"],
  },
  {
    label: "Portfolio Lab",
    route: "/portfolio-lab",
    aliases: ["portfolio lab", "portfolio analysis", "allocation lab", "holding lab"],
  },
  {
    label: "Venture Monitor",
    route: "/alternative-investments?view=venture",
    aliases: [
      "ventures",
      "venture",
      "alternative ventures",
      "startup monitor",
      "startups",
      "startup deals",
      "venture tab",
      "private deals",
    ],
  },
  {
    label: "Penny Stocks",
    route: "/alternative-investments?view=penny-stocks",
    aliases: ["penny stocks", "penny stock", "speculative equities", "microcap", "microcaps"],
  },
  {
    label: "Crypto Markets",
    route: "/alternative-investments?view=crypto",
    aliases: ["crypto", "bitcoin", "digital assets", "crypto market"],
  },
  {
    label: "Alternative Risk",
    route: "/alternative-investments?view=risk",
    aliases: ["alternative risk", "alts risk", "risk framework", "alternative risk framework"],
  },
  {
    label: "Briefings",
    route: "/briefings",
    aliases: ["briefings", "reports", "advisor reports", "client reports", "report page"],
  },
  {
    label: "Security",
    route: "/security",
    aliases: ["security", "audit", "compliance", "governance"],
  },
  {
    label: "System",
    route: "/system",
    aliases: ["system", "setup", "settings"],
  },
];

const TICKER_STOPWORDS = new Set([
  "OPEN",
  "SHOW",
  "TAKE",
  "GO",
  "RUN",
  "CREATE",
  "PRICE",
  "ALERT",
  "ABOVE",
  "BELOW",
  "TASK",
  "CLIENT",
  "PROJECT",
  "EMAIL",
  "TEXT",
  "HELP",
  "SORT",
  "FIND",
  "SOURCE",
  "SEARCH",
  "FIRM",
  "MARKET",
  "VISUALS",
  "BACKEND",
  "KERNEL",
  "VENDOR",
  "HEALTH",
  "CHECK",
  "APPROVE",
  "LATEST",
  "REJECT",
  "REPORT",
  "PDF",
  "VENTURE",
  "TRIAGE",
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#\s$.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIntent(value: string): value is SliceCommandIntent {
  return VALID_INTENTS.includes(value as SliceCommandIntent);
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);

  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const distance = levenshtein(left, right);
  const longest = Math.max(left.length, right.length);

  return Math.max(0, 1 - distance / longest);
}

function tokenOverlap(a: string, b: string) {
  const left = new Set(normalize(a).split(" ").filter(Boolean));
  const right = new Set(normalize(b).split(" ").filter(Boolean));

  if (!left.size || !right.size) return 0;

  let matches = 0;

  for (const token of left) {
    if (right.has(token)) matches += 1;
  }

  return matches / Math.max(left.size, right.size);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function extractDate(prompt: string) {
  const lower = normalize(prompt);

  if (lower.includes("tomorrow")) return addDays(1);
  if (lower.includes("today")) return addDays(0);
  if (lower.includes("next week")) return addDays(7);

  const iso = prompt.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];

  const slash = prompt.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    const month = slash[1].padStart(2, "0");
    const day = slash[2].padStart(2, "0");
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function extractTicker(prompt: string) {
  const upper = prompt.toUpperCase();

  const explicit =
    upper.match(/(?:TICKER|SYMBOL|STOCK|WATCH|RESEARCH|ALERT FOR|PRICE ALERT FOR)\s+([A-Z]{1,6})/) ||
    upper.match(/\$([A-Z]{1,6})/) ||
    upper.match(/\b(NVDA|AAPL|MSFT|TSLA|META|GOOGL|GOOG|AMZN|AMD|NFLX|SPY|QQQ|IWM|TLT|AVGO|CRM|PLTR|COIN|MSTR)\b/);

  const candidate = explicit?.[1] || explicit?.[0]?.replace("$", "");

  if (candidate && !TICKER_STOPWORDS.has(candidate)) return candidate;

  const generic = upper.match(/\b[A-Z]{2,5}\b/g) ?? [];

  return generic.find((item) => !TICKER_STOPWORDS.has(item)) ?? null;
}

function extractPrice(prompt: string) {
  const match = prompt.match(/\$?(\d+(?:\.\d+)?)/);
  const value = match ? Number(match[1]) : null;

  return value && Number.isFinite(value) ? value : null;
}

function extractEmail(prompt: string) {
  const match = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function extractClientName(prompt: string) {
  const match =
    prompt.match(/client named ([a-zA-Z ,.'-]+)/i) ||
    prompt.match(/new client ([a-zA-Z ,.'-]+)/i) ||
    prompt.match(/create client ([a-zA-Z ,.'-]+)/i) ||
    prompt.match(/add client ([a-zA-Z ,.'-]+)/i);

  return match?.[1]?.trim().replace(/\s+(with|and|for)\s+.*/i, "") ?? null;
}

function extractProjectTitle(prompt: string) {
  const match =
    prompt.match(/project called ([a-zA-Z0-9 ,.'-]+)/i) ||
    prompt.match(/project named ([a-zA-Z0-9 ,.'-]+)/i) ||
    prompt.match(/create project ([a-zA-Z0-9 ,.'-]+)/i) ||
    prompt.match(/add project ([a-zA-Z0-9 ,.'-]+)/i);

  return match?.[1]?.trim() ?? null;
}

function cleanTaskTitle(prompt: string) {
  return prompt
    .replace(/^(create|add|make)\s+(a\s+)?(task|to do|todo)\s+(to\s+)?/i, "")
    .replace(/^remind me to\s+/i, "")
    .trim();
}

function routeCandidates(platformBrain?: PlatformBrainContext) {
  const brainRoutes =
    platformBrain?.routes?.map((item) => ({
      label: item.label,
      route: item.route,
      aliases: item.aliases ?? [],
    })) ?? [];

  const combined = [...brainRoutes, ...FALLBACK_ROUTES];
  const seen = new Set<string>();

  return combined.filter((item) => {
    const key = `${item.label}-${item.route}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchRoute(prompt: string, platformBrain?: PlatformBrainContext) {
  const lower = normalize(prompt);
  const navIntent =
    /^(open|go to|take me to|show|pull up|bring up|launch|navigate to|get me to|send me to)\b/.test(lower) ||
    lower.includes("where is") ||
    lower.includes("i need the");

  let best: { route: string; label: string; score: number; phrase: string } | null = null;

  for (const item of routeCandidates(platformBrain)) {
    const phrases = [item.label, ...(item.aliases ?? [])].map(normalize);

    for (const phrase of phrases) {
      if (!phrase) continue;

      let score = 0;

      if (lower === phrase) score = 0.98;
      else if (navIntent && lower.includes(phrase)) score = 0.96;
      else if (phrase.length >= 5 && lower.includes(phrase)) score = 0.88;
      else {
        const overlap = tokenOverlap(lower, phrase);
        const fuzzy = similarity(lower, phrase);
        const phraseWords = phrase.split(" ").length;

        if (phraseWords === 1) {
          score = fuzzy >= 0.78 ? 0.84 : overlap >= 0.5 ? 0.78 : 0;
        } else {
          score = Math.max(overlap >= 0.5 ? 0.84 : 0, fuzzy >= 0.72 ? 0.82 : 0);
        }
      }

      if (navIntent && score >= 0.78) score += 0.06;

      if (score > (best?.score ?? 0)) {
        best = { route: item.route, label: item.label, score: Math.min(score, 0.99), phrase };
      }
    }
  }

  return best;
}

function baseCommand(input: {
  intent: SliceCommandIntent;
  prompt: string;
  confidence: number;
  route?: string | null;
  answer?: string;
  summary?: string;
  riskLevel?: "Low" | "Medium" | "High" | "Critical";
  requiresApproval?: boolean;
  parameters?: Partial<SliceStructuredCommand["parameters"]>;
}): SliceStructuredCommand {
  const lower = normalize(input.prompt);
  const ticker = input.parameters?.ticker ?? input.parameters?.symbol ?? extractTicker(input.prompt);
  const price = extractPrice(input.prompt);
  const date = extractDate(input.prompt);
  const email = extractEmail(input.prompt);

  const requiresApproval =
    input.requiresApproval ??
    ["draft_email", "queue_delivery", "create_report"].includes(input.intent);

  const riskLevel =
    input.riskLevel ??
    (requiresApproval || ["approval_decision"].includes(input.intent) ? "High" : "Low");

  return {
    intent: input.intent,
    confidence: input.confidence,
    riskLevel,
    requiresApproval,
    route: input.route ?? input.parameters?.route ?? null,
    answer: input.answer ?? `I recognized this command as ${input.intent}.`,
    userFacingSummary: input.summary ?? `Fast command recognized: ${input.intent}.`,
    parameters: {
      route: input.route ?? input.parameters?.route ?? null,
      ticker: ticker ?? null,
      query: input.parameters?.query ?? input.prompt,
      title: input.parameters?.title ?? input.prompt,
      detail: input.parameters?.detail ?? input.prompt,
      dueDate: input.parameters?.dueDate ?? date,
      priority:
        input.parameters?.priority ??
        (lower.includes("urgent") || lower.includes("critical") ? "High" : "Medium"),
      clientName: input.parameters?.clientName ?? extractClientName(input.prompt),
      email: input.parameters?.email ?? email,
      projectTitle: input.parameters?.projectTitle ?? extractProjectTitle(input.prompt),
      watchlistName: input.parameters?.watchlistName ?? "AI Command Watchlist",
      symbol: input.parameters?.symbol ?? ticker ?? null,
      upperTargetPrice:
        input.parameters?.upperTargetPrice ??
        (lower.includes("above") || lower.includes("over") || lower.includes("high") ? price : null),
      lowerTargetPrice:
        input.parameters?.lowerTargetPrice ??
        (lower.includes("below") || lower.includes("under") || lower.includes("low") ? price : null),
      color:
        input.parameters?.color ??
        (lower.includes("blue")
          ? "blue"
          : lower.includes("green")
            ? "green"
            : lower.includes("purple")
              ? "purple"
              : lower.includes("gold")
                ? "gold"
                : lower.includes("mint")
                  ? "mint"
                  : null),
      reportTitle:
        input.parameters?.reportTitle ??
        (lower.includes("report") || lower.includes("pdf") ? input.prompt : null),
      subject: input.parameters?.subject ?? null,
      body: input.parameters?.body ?? null,
      recipient: input.parameters?.recipient ?? email,
      deliveryChannel:
        input.parameters?.deliveryChannel ??
        (lower.includes("sms") || lower.includes("text")
          ? "SMS"
          : lower.includes("email")
            ? "Email"
            : "Dashboard"),
      phone: input.parameters?.phone ?? null,
      jobKey:
        input.parameters?.jobKey ??
        (lower.includes("price") || lower.includes("watchlist")
          ? "watchlist_price_check"
          : lower.includes("delivery") || lower.includes("queue")
            ? "notification_delivery"
            : lower.includes("advisor day")
              ? "advisor_day"
              : lower.includes("data quality")
                ? "data_quality_sweep"
                : "vendor_health"),
      memory:
        input.parameters?.memory ??
        (lower.includes("remember") ? input.prompt.replace(/remember/i, "").trim() : null),
      approvalDecision:
        input.parameters?.approvalDecision ??
        (lower.includes("reject") || lower.includes("decline")
          ? "reject"
          : lower.includes("approve")
            ? "approve"
            : null),
      researchDepth:
        input.parameters?.researchDepth ??
        (lower.includes("deep") || lower.includes("deeply")
          ? "deep"
          : lower.includes("quick")
            ? "quick"
            : "standard"),
    },
  };
}

function matchLearnedPhrase(prompt: string, platformBrain?: PlatformBrainContext): FastCommandMatch | null {
  const lower = normalize(prompt);

  for (const item of platformBrain?.learnedPhrases ?? []) {
    const phrase = normalize(item.phrase);

    if (!phrase || phrase.length < 3) continue;

    const exact = lower === phrase;
    const contained = phrase.length >= 7 && lower.includes(phrase);
    const fuzzy = similarity(lower, phrase) >= 0.82;

    if ((exact || contained || fuzzy) && isIntent(item.targetIntent)) {
      return {
        matched: true,
        confidence: exact ? 0.99 : contained ? 0.94 : 0.9,
        reason: "learned_phrase",
        command: baseCommand({
          intent: item.targetIntent,
          prompt,
          confidence: exact ? 0.99 : contained ? 0.94 : 0.9,
          route: item.targetRoute,
          parameters: item.parameters as Partial<SliceStructuredCommand["parameters"]>,
          summary: `Matched learned phrase: ${item.phrase}`,
        }),
      };
    }
  }

  for (const item of platformBrain?.corrections ?? []) {
    const phrase = normalize(item.originalCommand);

    if (!phrase || phrase.length < 3) continue;

    const exact = lower === phrase;
    const contained = phrase.length >= 7 && lower.includes(phrase);
    const fuzzy = similarity(lower, phrase) >= 0.82;

    if ((exact || contained || fuzzy) && isIntent(item.correctedIntent)) {
      return {
        matched: true,
        confidence: exact ? 0.99 : contained ? 0.94 : 0.9,
        reason: "saved_correction",
        command: baseCommand({
          intent: item.correctedIntent,
          prompt,
          confidence: exact ? 0.99 : contained ? 0.94 : 0.9,
          route: item.correctedRoute,
          parameters: item.parameters as Partial<SliceStructuredCommand["parameters"]>,
          summary: `Matched saved correction: ${item.originalCommand}`,
        }),
      };
    }
  }

  return null;
}

export function matchFastCommand(input: {
  prompt: string;
  platformBrain?: PlatformBrainContext;
}): FastCommandMatch | null {
  const prompt = input.prompt.trim();
  const lower = normalize(prompt);

  if (!prompt) {
    return {
      matched: true,
      confidence: 0.84,
      reason: "empty_prompt_recovery",
      command: baseCommand({
        intent: "help",
        prompt: "help",
        confidence: 0.84,
        summary: "Recovered empty command with help.",
      }),
    };
  }

  const learned = matchLearnedPhrase(prompt, input.platformBrain);
  if (learned) return learned;

  if (/^(help|what can you do|what are your commands|show commands|commands)\b/.test(lower)) {
    return {
      matched: true,
      confidence: 0.98,
      reason: "help_shortcut",
      command: baseCommand({
        intent: "help",
        prompt,
        confidence: 0.98,
        summary: "Help command recognized instantly.",
      }),
    };
  }

  const route = matchRoute(prompt, input.platformBrain);

  if (route && route.score >= 0.82) {
    return {
      matched: true,
      confidence: route.score,
      reason: `route_alias:${route.phrase}`,
      command: baseCommand({
        intent: "navigate",
        prompt,
        confidence: route.score,
        route: route.route,
        answer: `Opening ${route.label}.`,
        summary: `Fast navigation recognized: ${route.label}.`,
      }),
    };
  }

  if (/(approve|approved|accept)\s+(latest|last|most recent|pending)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.96,
      reason: "approval_approve_shortcut",
      command: baseCommand({
        intent: "approval_decision",
        prompt,
        confidence: 0.96,
        riskLevel: "High",
        parameters: { approvalDecision: "approve" },
        summary: "Approve latest pending item.",
      }),
    };
  }

  if (/(reject|decline|deny)\s+(latest|last|most recent|pending)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.96,
      reason: "approval_reject_shortcut",
      command: baseCommand({
        intent: "approval_decision",
        prompt,
        confidence: 0.96,
        riskLevel: "High",
        parameters: { approvalDecision: "reject" },
        summary: "Reject latest pending item.",
      }),
    };
  }

  if (/(run|start|execute|check)\s+.*(vendor health|backend health|provider health|integrations)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.95,
      reason: "backend_vendor_health",
      command: baseCommand({
        intent: "backend_job",
        prompt,
        confidence: 0.95,
        parameters: { jobKey: "vendor_health" },
        summary: "Run vendor health backend job.",
      }),
    };
  }

  if (/(run|start|execute|check)\s+.*(price check|watchlist price|prices|price alerts)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.95,
      reason: "backend_price_check",
      command: baseCommand({
        intent: "backend_job",
        prompt,
        confidence: 0.95,
        parameters: { jobKey: "watchlist_price_check" },
        summary: "Run watchlist price check.",
      }),
    };
  }

  if (/(process|run|start|execute)\s+.*(delivery|queue|notifications)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.93,
      reason: "backend_delivery_queue",
      command: baseCommand({
        intent: "backend_job",
        prompt,
        confidence: 0.93,
        parameters: { jobKey: "notification_delivery" },
        summary: "Process delivery queue.",
      }),
    };
  }

  if (/(advisor day|prioritize my day|what should i do today|daily advisor|plan my day)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.93,
      reason: "advisor_day_shortcut",
      command: baseCommand({
        intent: "advisor_day",
        prompt,
        confidence: 0.93,
        parameters: { jobKey: "advisor_day" },
        summary: "Generate Advisor Day.",
      }),
    };
  }

  if (/(find|show|get).*(source|proof|citation|link|evidence)/.test(lower) || lower.includes("where did this come from")) {
    return {
      matched: true,
      confidence: 0.91,
      reason: "source_lookup_shortcut",
      command: baseCommand({
        intent: "source_lookup",
        prompt,
        confidence: 0.91,
        summary: "Source lookup recognized.",
      }),
    };
  }

  if (/^(search|find|look through|ask the firm)\b/.test(lower) || lower.includes("firm for") || lower.includes("exposure to")) {
    return {
      matched: true,
      confidence: 0.89,
      reason: "platform_search_shortcut",
      command: baseCommand({
        intent: "platform_search",
        prompt,
        confidence: 0.89,
        summary: "Platform search recognized.",
      }),
    };
  }

  if (/(research|analyze|deep dive|thesis|diligence|look into|what is going on with|what's going on with|tell me about)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.88,
      reason: "research_shortcut",
      command: baseCommand({
        intent: "research",
        prompt,
        confidence: 0.88,
        summary: "Research command recognized.",
      }),
    };
  }

  if (/(sort|rank|highest|top|best|worst)\b/.test(lower)) {
    return {
      matched: true,
      confidence: 0.86,
      reason: "sort_shortcut",
      command: baseCommand({
        intent: "sort_data",
        prompt,
        confidence: 0.86,
        summary: "Sort/rank command recognized.",
      }),
    };
  }

  if (/(create|add|set|make).*(price alert|stock alert|alert)/.test(lower) || /(above|below|under|over).*\d/.test(lower)) {
    return {
      matched: true,
      confidence: 0.91,
      reason: "price_alert_shortcut",
      command: baseCommand({
        intent: "create_price_alert",
        prompt,
        confidence: 0.91,
        summary: "Price alert command recognized.",
      }),
    };
  }

  if (/^(create|add|make)\s+(a\s+)?(task|to do|todo)\b/.test(lower) || lower.startsWith("remind me to")) {
    return {
      matched: true,
      confidence: 0.91,
      reason: "task_shortcut",
      command: baseCommand({
        intent: "create_task",
        prompt,
        confidence: 0.91,
        parameters: {
          title: cleanTaskTitle(prompt),
          detail: prompt,
        },
        summary: "Task command recognized.",
      }),
    };
  }

  if (/(create|add|new)\s+client/.test(lower)) {
    return {
      matched: true,
      confidence: 0.9,
      reason: "client_shortcut",
      command: baseCommand({
        intent: "create_client",
        prompt,
        confidence: 0.9,
        summary: "Client creation recognized.",
      }),
    };
  }

  if (/(create|add|new)\s+project/.test(lower)) {
    return {
      matched: true,
      confidence: 0.9,
      reason: "project_shortcut",
      command: baseCommand({
        intent: "create_project",
        prompt,
        confidence: 0.9,
        summary: "Project creation recognized.",
      }),
    };
  }

  if (/(add|track|watch).*(watchlist|ticker|stock)/.test(lower) || lower.startsWith("watch ")) {
    return {
      matched: true,
      confidence: 0.89,
      reason: "watchlist_shortcut",
      command: baseCommand({
        intent: "create_watchlist_item",
        prompt,
        confidence: 0.89,
        summary: "Watchlist command recognized.",
      }),
    };
  }

  if (/(draft|write|prepare).*(email|message)/.test(lower) || lower.includes("email investors")) {
    return {
      matched: true,
      confidence: 0.87,
      reason: "email_draft_shortcut",
      command: baseCommand({
        intent: "draft_email",
        prompt,
        confidence: 0.87,
        riskLevel: "High",
        requiresApproval: true,
        summary: "Email draft command recognized.",
      }),
    };
  }

  if (/(create|generate|make).*(pdf|report|briefing)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.88,
      reason: "report_shortcut",
      command: baseCommand({
        intent: "create_report",
        prompt,
        confidence: 0.88,
        riskLevel: "High",
        requiresApproval: true,
        summary: "Report command recognized.",
      }),
    };
  }

  if (lower.startsWith("remember ") || lower.includes(" remember that ")) {
    return {
      matched: true,
      confidence: 0.92,
      reason: "memory_shortcut",
      command: baseCommand({
        intent: "remember",
        prompt,
        confidence: 0.92,
        summary: "Memory command recognized.",
      }),
    };
  }

  if (/(change|set|make).*(theme|color|scheme)/.test(lower)) {
    return {
      matched: true,
      confidence: 0.9,
      reason: "theme_shortcut",
      command: baseCommand({
        intent: "theme",
        prompt,
        confidence: 0.9,
        summary: "Theme command recognized.",
      }),
    };
  }

  const ticker = extractTicker(prompt);

  if (ticker) {
    return {
      matched: true,
      confidence: 0.84,
      reason: "ticker_research_fallback",
      command: baseCommand({
        intent: "research",
        prompt,
        confidence: 0.84,
        parameters: {
          ticker,
          symbol: ticker,
          query: prompt,
        },
        summary: `Ticker detected, defaulting to research: ${ticker}.`,
      }),
    };
  }

  if (lower.length >= 8) {
    return {
      matched: true,
      confidence: 0.82,
      reason: "rough_command_answer_fallback",
      command: baseCommand({
        intent: "answer",
        prompt,
        confidence: 0.82,
        summary: "Rough command recovered as an answer/action request.",
      }),
    };
  }

  return {
    matched: true,
    confidence: 0.82,
    reason: "short_command_help_fallback",
    command: baseCommand({
      intent: "help",
      prompt,
      confidence: 0.82,
      summary: "Short unclear command recovered with help.",
    }),
  };
}