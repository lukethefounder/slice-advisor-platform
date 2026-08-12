import {
  matchFastCommand,
  type FastCommandMatch,
} from "@/lib/bot/fast-command-router";
import {
  generateUniversalAssistantReply,
  parseSliceCommandWithAi,
  type AiResponseResult,
  type AiSource,
  type AiSpeedMode,
  type SliceStructuredCommand,
} from "@/lib/integrations/ai";
import {
  SLICE_PLATFORM_CAPABILITIES,
  compactSlicePlatformContext,
  type SliceAiProfile,
  type SliceAiUser,
  type SlicePlatformContext,
} from "@/lib/ai-studio/platform-context";
import {
  loadCachedSlicePlatformContext,
  type SliceContextCacheState,
} from "@/lib/ai-studio/context-cache";

export type AiStudioAnswerMode = "quick" | "balanced" | "deep";

export type AiStudioRecentMessage = {
  role: string;
  content: string;
};

export type AiStudioOrchestrationInput = {
  user: SliceAiUser;
  profile: SliceAiProfile;
  prompt: string;
  voiceTranscript?: string | null;
  currentPath?: string | null;
  pageTitle?: string | null;
  answerMode?: AiStudioAnswerMode;
  recentMessages?: AiStudioRecentMessage[];
  advancedSettings?: Record<string, unknown> | null;
};

export type AiStudioRequestLane =
  | "direct"
  | "platform"
  | "analysis"
  | "research"
  | "deep-research";

export type AiStudioOrchestrationResult = {
  prompt: string;
  structuredCommand: SliceStructuredCommand;
  platformContext: SlicePlatformContext;
  compactPlatformContext: ReturnType<typeof compactSlicePlatformContext>;
  aiResponse: AiResponseResult | null;
  answer: string;
  sources: AiSource[];
  researchUsed: boolean;
  provider: string;
  status: string;
  parser: {
    ok: boolean;
    provider: string;
    error?: string;
  };
  fastRouter: {
    used: boolean;
    matched: boolean;
    confidence?: number;
    reason?: string;
  };
  routing: {
    lane: AiStudioRequestLane;
    requestedMode: AiStudioAnswerMode;
    effectiveSpeedMode: AiSpeedMode;
    researchRequired: boolean;
    researchReason: string;
    platformContextUsed: boolean;
    contextCacheState: SliceContextCacheState | "minimal";
    contextAgeMs: number;
    focusedSections: string[];
  };
};

const AI_CONTENT_INTENTS = new Set<SliceStructuredCommand["intent"]>([
  "answer",
  "research",
  "source_lookup",
  "create_report",
  "draft_email",
]);

const EARLY_DIRECT_INTENTS = new Set<SliceStructuredCommand["intent"]>([
  "navigate",
  "platform_search",
  "create_task",
  "create_client",
  "create_project",
  "create_watchlist_item",
  "create_price_alert",
  "advisor_day",
  "backend_job",
  "queue_delivery",
  "approval_decision",
  "remember",
  "theme",
  "help",
]);

const CURRENT_FACT_PATTERN =
  /\b(current|currently|latest|today|tonight|this week|this month|recent|right now|live|price|market|earnings|filing|economic|inflation|interest rate|fed|regulat|law|tax|news|company|stock|security|yield|valuation|forecast|outlook)\b/i;
const EXPLICIT_RESEARCH_PATTERN =
  /\b(research|sources?|citations?|evidence|verify|fact[- ]check|look up|web|primary source|filing|deep dive|diligence)\b/i;
const COMPLEXITY_PATTERN =
  /\b(compare|versus|vs\.?|scenario|trade[- ]off|valuation|catalyst|downside|risk|counterargument|bull case|bear case|sensitivity|probability|implications?|why|how should|memo|report)\b/i;
const INTERNAL_CONTEXT_PATTERN =
  /\b(slice|my firm|our firm|client|household|portfolio|holding|task|project|approval|email center|watchlist|document|portal|advisor day|workspace|team board|briefing|assigned advisor)\b/i;
const AMBIGUOUS_SIDE_EFFECT_PATTERN =
  /\b(create|add|update|delete|remove|assign|change|schedule|send|approve|reject|cancel|retry|run|execute|queue)\b/i;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s$#@._/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readSetting(
  input: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = input?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function minimalPlatformContext(input: AiStudioOrchestrationInput): SlicePlatformContext {
  return {
    generatedAt: new Date().toISOString(),
    user: {
      id: input.user.id,
      name: input.user.name,
    },
    firm: {
      id: input.profile.firmId,
      name: null,
      role: null,
      membershipId: null,
    },
    permissions: {
      canManageFirm: false,
      canManageProjects: false,
      canInviteMembers: false,
      canAccessPortfolios: false,
      canManageClientRouting: false,
    },
    privacy: {
      clientNamesIncludedInAiSnapshot: false,
      privateClientDataMayBeWebSearched: false,
      note:
        "Minimal fast-lane context. Private client identifiers are not available for public research.",
    },
    capabilities: SLICE_PLATFORM_CAPABILITIES,
    platformBrain: {
      routes: [],
      learnedPhrases: [],
      corrections: [],
    } as SlicePlatformContext["platformBrain"],
    metrics: {
      accessibleClients: 0,
      activeClients: 0,
      clientsNeedingReview: 0,
      clientHoldings: 0,
      openPersonalTasks: 0,
      openFirmTasks: 0,
      unreadAlerts: 0,
      highPriorityAlerts: 0,
      openOpportunities: 0,
      pendingApprovals: 0,
      activeWatchlistItems: 0,
      activePriceAlerts: 0,
      reportsReady: 0,
      activeProjects: 0,
      unreadAssignedClientMessages: 0,
    },
    recent: {
      alerts: [],
      opportunities: [],
      watchlistItems: [],
      researchNotes: [],
      tasks: [],
      projects: [],
      reports: [],
      approvals: [],
      clients: [],
      assignedClientMessages: [],
    },
    memory: [],
  };
}

function reliableFastMatch(match: FastCommandMatch | null) {
  if (!match) return false;
  if (match.reason === "empty_prompt_help") return true;
  if (match.reason === "chat_first_universal_answer") return true;
  if (match.reason === "ticker_answer_professional") return true;
  return match.confidence >= 0.84;
}

function canUseEarlyDirectLane(match: FastCommandMatch | null, prompt: string) {
  if (!match || !reliableFastMatch(match)) return false;
  if (!EARLY_DIRECT_INTENTS.has(match.command.intent)) return false;
  if (
    match.reason === "chat_first_universal_answer" &&
    AMBIGUOUS_SIDE_EFFECT_PATTERN.test(prompt)
  ) {
    return false;
  }
  return true;
}

function shouldUseFastParser(match: FastCommandMatch | null, prompt: string) {
  if (!match || !reliableFastMatch(match)) return false;
  if (
    match.reason === "chat_first_universal_answer" &&
    AMBIGUOUS_SIDE_EFFECT_PATTERN.test(prompt)
  ) {
    return false;
  }
  return true;
}

function needsPlatformContext(
  prompt: string,
  command: SliceStructuredCommand,
) {
  if (INTERNAL_CONTEXT_PATTERN.test(prompt)) return true;
  return [
    "platform_search",
    "sort_data",
    "advisor_day",
    "help",
  ].includes(command.intent);
}

function classifyResearch(input: {
  prompt: string;
  command: SliceStructuredCommand;
  mode: AiStudioAnswerMode;
  advancedSettings?: Record<string, unknown> | null;
}) {
  const normalized = normalize(input.prompt);
  const explicit = EXPLICIT_RESEARCH_PATTERN.test(input.prompt);
  const current = CURRENT_FACT_PATTERN.test(input.prompt);
  const complex = COMPLEXITY_PATTERN.test(input.prompt);
  const sourcePolicy = readSetting(input.advancedSettings, "sourcePolicy");
  const platformOnly =
    INTERNAL_CONTEXT_PATTERN.test(input.prompt) &&
    !current &&
    !explicit &&
    input.command.intent !== "research" &&
    input.command.intent !== "source_lookup";

  let researchRequired = false;
  let reason = "Stable or internal request; public research is not required.";

  if (input.command.intent === "research" || input.command.intent === "source_lookup") {
    researchRequired = true;
    reason = "The request explicitly asks for research or source verification.";
  } else if (input.command.intent === "create_report" && !platformOnly) {
    researchRequired = true;
    reason = "External report claims require current source support.";
  } else if (input.command.intent === "draft_email") {
    researchRequired = current || explicit;
    reason = researchRequired
      ? "The communication brief contains current or source-sensitive claims."
      : "The email can be drafted from supplied advisor and client context.";
  } else if (input.command.intent === "answer") {
    researchRequired = !platformOnly && (explicit || current || (input.mode === "deep" && complex));
    reason = researchRequired
      ? explicit
        ? "The user explicitly requested verification or sources."
        : current
          ? "The answer depends on current market, company, economic, or regulatory facts."
          : "Deep analysis requires evidence for complex financial claims."
      : reason;
  }

  if (
    sourcePolicy === "Fast" &&
    !explicit &&
    !current &&
    input.command.intent !== "research" &&
    input.command.intent !== "source_lookup"
  ) {
    researchRequired = false;
    reason = "Fast source policy selected for a non-current request.";
  }

  let effectiveSpeedMode: AiSpeedMode;
  if (input.mode === "deep") {
    effectiveSpeedMode = "quality";
  } else if (input.mode === "balanced") {
    effectiveSpeedMode = researchRequired ? "balanced" : "fast";
  } else {
    effectiveSpeedMode = researchRequired ? "fast" : "instant";
  }

  const lane: AiStudioRequestLane = researchRequired
    ? input.mode === "deep" || complex
      ? "deep-research"
      : "research"
    : needsPlatformContext(input.prompt, input.command)
      ? "platform"
      : "analysis";

  return {
    researchRequired,
    reason,
    effectiveSpeedMode,
    lane,
    normalized,
  };
}

function relevantCapability(
  prompt: string,
  capability: SlicePlatformContext["capabilities"][number],
) {
  const lower = normalize(prompt);
  const terms = [
    capability.label,
    capability.category,
    capability.description,
    ...capability.capabilities,
    ...capability.exampleCommands,
  ]
    .join(" ")
    .toLowerCase();

  return lower
    .split(" ")
    .filter((term) => term.length >= 4)
    .some((term) => terms.includes(term));
}

function focusPlatformContext(
  context: SlicePlatformContext,
  prompt: string,
  command: SliceStructuredCommand,
) {
  const compact = compactSlicePlatformContext(context);
  const lower = normalize(prompt);
  const client = /client|household|portfolio|holding|portal|advisor/.test(lower);
  const market = /market|stock|ticker|security|watchlist|price|valuation|risk|news|economic/.test(lower);
  const operations = /task|project|firm|approval|workflow|job|backend|team/.test(lower);
  const report = /report|brief|memo|pdf|email|communication/.test(lower);
  const focusedSections: string[] = [];

  if (client) focusedSections.push("clients", "assignedClientMessages");
  if (market) focusedSections.push("alerts", "opportunities", "watchlistItems", "researchNotes");
  if (operations) focusedSections.push("tasks", "projects", "approvals");
  if (report) focusedSections.push("reports", "approvals");
  if (!focusedSections.length && command.intent === "answer") {
    focusedSections.push("alerts", "opportunities");
  }

  const keep = new Set(focusedSections);
  const capabilities = compact.capabilities.filter((capability) =>
    relevantCapability(prompt, capability),
  );

  return {
    context: {
      ...compact,
      capabilities: (capabilities.length ? capabilities : compact.capabilities.slice(0, 8)).slice(0, 12),
      platformBrain: {
        ...compact.platformBrain,
        routes: (compact.platformBrain.routes ?? []).filter((route) => {
          const text = `${route.label} ${route.category} ${(route.aliases ?? []).join(" ")}`.toLowerCase();
          return lower.split(" ").some((term) => term.length >= 4 && text.includes(term));
        }).slice(0, 12),
        learnedPhrases: (compact.platformBrain.learnedPhrases ?? []).slice(0, 8),
        corrections: (compact.platformBrain.corrections ?? []).slice(0, 8),
      },
      recent: {
        alerts: keep.has("alerts") ? compact.recent.alerts.slice(0, 6) : [],
        opportunities: keep.has("opportunities") ? compact.recent.opportunities.slice(0, 6) : [],
        watchlistItems: keep.has("watchlistItems") ? compact.recent.watchlistItems.slice(0, 8) : [],
        researchNotes: keep.has("researchNotes") ? compact.recent.researchNotes.slice(0, 5) : [],
        tasks: keep.has("tasks") ? compact.recent.tasks.slice(0, 8) : [],
        projects: keep.has("projects") ? compact.recent.projects.slice(0, 6) : [],
        reports: keep.has("reports") ? compact.recent.reports.slice(0, 5) : [],
        approvals: keep.has("approvals") ? compact.recent.approvals.slice(0, 6) : [],
        clients: keep.has("clients") ? compact.recent.clients.slice(0, 12) : [],
        assignedClientMessages: keep.has("assignedClientMessages")
          ? compact.recent.assignedClientMessages.slice(0, 6)
          : [],
      },
      memory: compact.memory.slice(0, 6),
    } as ReturnType<typeof compactSlicePlatformContext>,
    focusedSections: Array.from(keep),
  };
}

function localCommandAnswer(command: SliceStructuredCommand) {
  if (command.intent === "navigate") {
    return (
      command.answer ||
      `I found the requested Slice section: ${
        command.route || command.parameters.route || "/workspace"
      }.`
    );
  }

  const messages: Partial<Record<SliceStructuredCommand["intent"], string>> = {
    platform_search:
      "I identified this as a permission-scoped search of Slice and firm records.",
    create_task:
      "I identified a task-creation command. Slice will validate the details and return the verified record.",
    create_client:
      "I identified a client-creation command. Slice will validate the required fields, firm context, and advisor assignment.",
    create_project:
      "I identified a firm-project command. Slice will verify project-management permission before creating it.",
    create_watchlist_item:
      "I identified a watchlist command. Slice will verify the symbol and save the item.",
    create_price_alert:
      "I identified a price-alert command. Slice will require a symbol and at least one target price.",
    advisor_day:
      "I identified an Advisor Day request. Slice will build the operating brief from current platform records.",
    backend_job:
      "I identified a backend operating command. The job runner will return a verified execution result.",
    queue_delivery:
      "I identified an external-delivery command. Slice will keep delivery approval-gated.",
    approval_decision:
      "I identified an approval decision. Slice will apply it only to a verified pending item.",
    remember:
      "I identified a memory command. Slice will store the preference in the user's AI memory.",
    theme:
      "I identified an appearance command. Slice will update the saved preference.",
    help:
      "Slice can research financial topics, navigate the platform, search permission-scoped records, create clients and projects, manage watchlists and alerts, draft approval-gated communications, create reports, run backend jobs, manage approvals, and remember preferences.",
  };

  return messages[command.intent] || command.answer ||
    "I interpreted the request and prepared it for the Slice command router.";
}

export async function orchestrateAiStudioRequest(
  input: AiStudioOrchestrationInput,
): Promise<AiStudioOrchestrationResult> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("AI Studio prompt is required.");

  const requestedMode = input.answerMode ?? "balanced";
  const initialFastMatch = matchFastCommand({ prompt });

  if (canUseEarlyDirectLane(initialFastMatch, prompt) && initialFastMatch) {
    const platformContext = minimalPlatformContext(input);
    const compactPlatformContext = compactSlicePlatformContext(platformContext);
    const command = initialFastMatch.command;

    return {
      prompt,
      structuredCommand: command,
      platformContext,
      compactPlatformContext,
      aiResponse: null,
      answer: localCommandAnswer(command),
      sources: [],
      researchUsed: false,
      provider: "Slice Deterministic Command Router",
      status: "Interpreted",
      parser: {
        ok: true,
        provider: "Slice Deterministic Command Router",
      },
      fastRouter: {
        used: true,
        matched: true,
        confidence: initialFastMatch.confidence,
        reason: initialFastMatch.reason,
      },
      routing: {
        lane: "direct",
        requestedMode,
        effectiveSpeedMode: "instant",
        researchRequired: false,
        researchReason: "Verified direct platform command; no language-model or web-search call required.",
        platformContextUsed: false,
        contextCacheState: "minimal",
        contextAgeMs: 0,
        focusedSections: [],
      },
    };
  }

  const provisionalCommand = initialFastMatch?.command ?? null;
  const usePlatformContext = provisionalCommand
    ? needsPlatformContext(prompt, provisionalCommand)
    : INTERNAL_CONTEXT_PATTERN.test(prompt);
  const loaded = usePlatformContext
    ? await loadCachedSlicePlatformContext({
        user: input.user,
        profile: input.profile,
      })
    : {
        context: minimalPlatformContext(input),
        cacheState: "minimal" as const,
        ageMs: 0,
      };
  const platformContext = loaded.context;
  const contextualFastMatch = matchFastCommand({
    prompt,
    platformBrain: platformContext.platformBrain,
  });
  const fastMatch = contextualFastMatch ?? initialFastMatch;

  let parser: {
    ok: boolean;
    provider: string;
    error?: string;
    command: SliceStructuredCommand;
  };

  if (shouldUseFastParser(fastMatch, prompt) && fastMatch) {
    parser = {
      ok: true,
      provider: "Slice Adaptive Command Router",
      command: fastMatch.command,
    };
  } else {
    const parsed = await parseSliceCommandWithAi({
      prompt,
      userName: input.user.name,
      userEmail: input.user.email,
      firmName: platformContext.firm.name,
      botName: input.profile.botName,
      memory: platformContext.memory
        .slice(0, 6)
        .map((item) => `${item.title}: ${item.value}`),
      openTasks:
        platformContext.metrics.openPersonalTasks +
        platformContext.metrics.openFirmTasks,
      unreadAlerts: platformContext.metrics.unreadAlerts,
      clients: platformContext.metrics.accessibleClients,
      portfolioValue: 0,
      platformBrain: platformContext.platformBrain,
      voiceTranscript: input.voiceTranscript,
      preferredTone: input.profile.preferredTone,
      commandStyle: input.profile.commandStyle,
      customInstructions: input.profile.customInstructions,
      personality: parseJson<Record<string, unknown>>(
        input.profile.personalityJson,
        {},
      ),
    });

    parser = {
      ok: parsed.ok,
      provider: parsed.provider,
      error: parsed.error,
      command: parsed.command,
    };
  }

  const command = parser.command;
  const research = classifyResearch({
    prompt,
    command,
    mode: requestedMode,
    advancedSettings: input.advancedSettings,
  });
  const focused = focusPlatformContext(platformContext, prompt, command);
  let aiResponse: AiResponseResult | null = null;

  if (AI_CONTENT_INTENTS.has(command.intent)) {
    aiResponse = await generateUniversalAssistantReply({
      prompt,
      userName: input.user.name,
      userEmail: input.user.email,
      botName: input.profile.botName,
      currentPath: input.currentPath,
      pageTitle: input.pageTitle,
      preferredTone: input.profile.preferredTone,
      commandStyle: input.profile.commandStyle,
      autonomyLevel: input.profile.autonomyLevel,
      customInstructions: input.profile.customInstructions,
      personality: parseJson<Record<string, unknown>>(
        input.profile.personalityJson,
        {},
      ),
      risk: parseJson<Record<string, unknown>>(
        input.profile.riskJson,
        {},
      ),
      memory: platformContext.memory
        .slice(0, 6)
        .map((item) => `${item.title}: ${item.value}`),
      recentMessages: (input.recentMessages ?? []).slice(-6),
      platformResult: null,
      commandIntent: command.intent,
      platformSnapshot: focused.context as unknown as Record<string, unknown>,
      financialContext: {
        parsedCommand: command,
        requestedMode,
        effectiveSpeedMode: research.effectiveSpeedMode,
        requestLane: research.lane,
        researchRequired: research.researchRequired,
        researchReason: research.reason,
        sourcePolicy:
          readSetting(input.advancedSettings, "sourcePolicy") ||
          (research.researchRequired ? "Primary First" : "Fast"),
        operatingMode:
          readSetting(input.advancedSettings, "operatingMode") ||
          (research.researchRequired ? "Research" : "Platform Ops"),
        focusedContextSections: focused.focusedSections,
        privacyRule:
          "Private client identifiers must never be used in public web-search queries. Public research must use only public entities, tickers, general topics, and authoritative sources.",
        answerQualityRules: [
          "Lead with the practical answer.",
          "Use exact dates for current claims.",
          "Prefer primary sources and distinguish facts from assumptions.",
          "Address counterarguments, downside risks, and data limitations when material.",
          "Do not repeat the user's prompt as the answer.",
        ],
      },
      enableWebSearch: research.researchRequired,
      requireResearch: research.researchRequired,
      speedMode: research.effectiveSpeedMode,
      safetyIdentifier: input.user.email,
    });
  }

  const answer = aiResponse?.text?.trim() || localCommandAnswer(command);

  return {
    prompt,
    structuredCommand: command,
    platformContext,
    compactPlatformContext: focused.context,
    aiResponse,
    answer,
    sources: aiResponse?.sources ?? [],
    researchUsed: Boolean(aiResponse?.researchUsed),
    provider:
      aiResponse?.provider || parser.provider || "Slice Adaptive Command Router",
    status: aiResponse
      ? aiResponse.ok
        ? "Complete"
        : aiResponse.status
      : "Interpreted",
    parser: {
      ok: parser.ok,
      provider: parser.provider,
      error: parser.error,
    },
    fastRouter: {
      used: shouldUseFastParser(fastMatch, prompt),
      matched: Boolean(fastMatch),
      confidence: fastMatch?.confidence,
      reason: fastMatch?.reason,
    },
    routing: {
      lane: research.lane,
      requestedMode,
      effectiveSpeedMode: research.effectiveSpeedMode,
      researchRequired: research.researchRequired,
      researchReason: research.reason,
      platformContextUsed: usePlatformContext,
      contextCacheState: loaded.cacheState,
      contextAgeMs: loaded.ageMs,
      focusedSections: focused.focusedSections,
    },
  };
}