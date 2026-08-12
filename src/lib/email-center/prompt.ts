import type {
  EmailClientOption,
  EmailPromptPlan,
} from "@/lib/email-center/contracts";

const CURRENT_FACT_PATTERN =
  /\b(today|current|currently|latest|recent|this week|this month|market|price|performance|earnings|economic|inflation|interest rate|fed|regulat|law|tax|news|volatility|company|stock|security|portfolio|distribution|dividend|yield)\b/i;

const META_LEAD_PATTERN =
  /^(?:please\s+)?(?:write|draft|create|generate|prepare|compose|build|send)\s+(?:me\s+)?(?:an?\s+)?(?:[^.!?\n]{0,80}?\s+)?(?:client\s+)?(?:email|message|note)\b(?:\s+(?:to|for)\s+(?:the\s+)?(?:selected\s+)?clients?)?\s*(?:about|regarding|concerning|on|covering|explaining)?\s*/i;

const INSTRUCTION_PREFIX =
  /^(?:please\s+)?(?:also\s+)?(?:include|mention|explain|cover|emphasize|note|tell|remind|address|state|clarify|reassure|ask|invite)\s+(?:the\s+client\s+|them\s+|that\s+)?/i;

function clean(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function words(value: string) {
  return value
    .replace(/[^a-zA-Z0-9$%&'’.-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function sentences(value: string) {
  return value
    .split(/(?:\n+|(?<=[.!?])\s+|;\s*)/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[], maximum = 12) {
  return Array.from(
    new Map(
      values
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value]),
    ).values(),
  ).slice(0, maximum);
}

function trimPunctuation(value: string) {
  return value
    .replace(/^[,;:\-–—\s]+|[,;:\-–—.!?\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  const small = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "for",
    "from",
    "in",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
  ]);

  return words(trimPunctuation(value))
    .slice(0, 12)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      if (/^[A-Z0-9$]{2,6}(?:\.[A-Z])?$/.test(word)) return word;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function stripMetaInstruction(value: string) {
  return trimPunctuation(
    value
      .replace(META_LEAD_PATTERN, "")
      .replace(
        /\b(?:in|with)\s+(?:a\s+)?(?:calm|warm|professional|polished|measured|concise|detailed|reassuring|client-friendly|informative)\s+(?:tone|style|voice)\b/gi,
        "",
      )
      .replace(/\b(?:tone|purpose|subject|body|call to action|cta|instructions?)\s*:\s*/gi, ""),
  );
}

function compactFocus(prompt: string) {
  const first = sentences(prompt)[0] ?? prompt;
  const explicit = first.match(
    /\b(?:about|regarding|concerning|on the topic of|covering|explaining|addressing)\s+(.+?)(?=\s*[,;]|\s+and\s+(?:reassure|invite|ask|mention|include|avoid|explain|tell|remind|note)|$)/i,
  )?.[1];
  const source = stripMetaInstruction(explicit || first)
    .replace(
      /\b(?:and|while)\s+(?:reassure|invite|ask|mention|include|avoid|explain|tell|remind|note)\b.*$/i,
      "",
    );
  const selected = words(source).slice(0, 10).join(" ");

  return trimPunctuation(selected || "an important planning update");
}

function detectMessageType(prompt: string): EmailPromptPlan["messageType"] {
  const lower = prompt.toLowerCase();

  if (/\b(follow[- ]?up|following our|after our|recap|meeting recap|conversation recap)\b/.test(lower)) {
    return "Meeting Follow-up";
  }
  if (/\b(document|statement|form|upload|signature|paperwork|tax return|brokerage statement|record request)\b/.test(lower)) {
    return "Document Request";
  }
  if (
    /\b(portfolio|allocation|holding|holdings|rebalance|concentration|diversification|investment position|income strategy|distribution rate|dividend|yield|security exposure)\b/.test(
      lower,
    )
  ) {
    return "Portfolio Review";
  }
  if (
    /\b(market|volatility|stock market|earnings|inflation|interest rate|fed|economic|news|regulat|company development|market update)\b/.test(
      lower,
    )
  ) {
    return "Market Update";
  }
  if (/\b(plan|planning|retirement|estate|tax planning|cash flow|liquidity|goal|beneficiary)\b/.test(lower)) {
    return "Planning Update";
  }
  if (
    /\b(schedule|scheduling|book|availability|choose a time|calendar link|appointment|annual review meeting)\b/.test(
      lower,
    )
  ) {
    return "Scheduling";
  }

  return "General Update";
}

function detectLength(prompt: string): EmailPromptPlan["desiredLength"] {
  const lower = prompt.toLowerCase();
  if (/\b(very short|brief|concise|quick note|under \d+ words?)\b/.test(lower)) {
    return "Concise";
  }
  if (/\b(detailed|thorough|comprehensive|long form|in depth|deep|informative)\b/.test(lower)) {
    return "Detailed";
  }
  return "Standard";
}

function detectUrgency(prompt: string): EmailPromptPlan["urgency"] {
  const lower = prompt.toLowerCase();
  if (/\b(urgent|immediately|as soon as possible|today|time[- ]sensitive)\b/.test(lower)) {
    return "Time Sensitive";
  }
  if (/\b(soon|this week|promptly|upcoming|before \w+day)\b/.test(lower)) {
    return "Elevated";
  }
  return "Routine";
}

function detectCallToAction(
  prompt: string,
  messageType: EmailPromptPlan["messageType"],
) {
  const explicit = prompt.match(
    /(?:call to action|cta|ask (?:the client|them) to|request (?:that )?they|invite (?:the client|them) to)\s*[:\-]?\s*([^\n.?!]+[.?!]?)/i,
  )?.[1];

  if (explicit) {
    const normalized = trimPunctuation(explicit)
      .replace(/^to\s+/i, "")
      .replace(/^schedule\s+a\s+review\s+if\s+they\s+have\s+questions$/i, "reply with any questions or schedule a review");
    return `Please ${normalized}.`;
  }

  if (/\binvite (?:the client|them) to schedule\b|\bschedule a review\b/i.test(prompt)) {
    return "Please reply with any questions, or let us know if you would like to schedule a review together.";
  }

  switch (messageType) {
    case "Scheduling":
      return "Please reply with a convenient time, or use the scheduling link below to choose a time that works for you.";
    case "Document Request":
      return "Please upload the requested documents through the secure client portal, and contact us if you have any questions.";
    case "Meeting Follow-up":
      return "Please reply if anything in this recap needs clarification or if you would like us to adjust the next steps.";
    case "Portfolio Review":
    case "Planning Update":
      return "Please reply with any questions, or let us know if you would like to schedule time to review this together.";
    default:
      return "Please reply with any questions or if you would like to discuss how this relates to your financial plan.";
  }
}

function extractSymbols(prompt: string) {
  const explicitDollar = [...prompt.matchAll(/\$([A-Z]{1,6})\b/g)].map(
    (match) => match[1] || "",
  );
  const explicitUppercase = [...prompt.matchAll(/\b([A-Z]{2,6}(?:\.[A-Z])?)\b/g)].map(
    (match) => match[1] || "",
  );
  const knownCompanyMentions: Record<string, string> = {
    nvidia: "NVDA",
    apple: "AAPL",
    microsoft: "MSFT",
    tesla: "TSLA",
    meta: "META",
    alphabet: "GOOGL",
    google: "GOOGL",
    amazon: "AMZN",
    "s&p 500": "SPY",
  };
  const lower = prompt.toLowerCase();
  const inferred = Object.entries(knownCompanyMentions)
    .filter(([name]) => lower.includes(name))
    .map(([, symbol]) => symbol);
  const stop = new Set([
    "AI",
    "AND",
    "THE",
    "FOR",
    "WITH",
    "EMAIL",
    "CLIENT",
    "CTA",
    "TODAY",
    "THIS",
    "THAT",
    "PLEASE",
    "SLICE",
    "MARKET",
    "UPDATE",
    "WRITE",
    "DRAFT",
    "CREATE",
    "GENERATE",
    "SEND",
    "PDF",
    "BEST",
  ]);

  return unique(
    [...explicitDollar, ...explicitUppercase, ...inferred]
      .map((value) => value.toUpperCase())
      .filter((value) => value && !stop.has(value)),
    12,
  );
}

function instructionClauses(prompt: string) {
  return sentences(prompt)
    .flatMap((sentence) =>
      sentence.split(
        /,\s*(?:and\s+)?(?=(?:please\s+)?(?:also\s+)?(?:include|mention|explain|cover|emphasize|note|tell|remind|address|reassure|invite|ask|avoid|do not|don't|must not)\b)/i,
      ),
    )
    .map((line) =>
      line
        .replace(/^[-*•\d.)\s]+/, "")
        .replace(/^and\s+/i, "")
        .trim(),
    )
    .filter(Boolean);
}

function extractRequiredPoints(prompt: string) {
  return unique(
    instructionClauses(prompt)
      .filter((line) =>
        /\b(include|mention|explain|cover|emphasize|note|tell|remind|address|reassure|invite|ask)\b/i.test(
          line,
        ),
      )
      .filter((line) => !/\b(do not|don't|avoid|must not|exclude)\b/i.test(line))
      .map((line) => trimPunctuation(line.replace(INSTRUCTION_PREFIX, "")))
      .filter(Boolean),
    10,
  );
}

function extractProhibitedPoints(prompt: string) {
  return unique(
    instructionClauses(prompt)
      .filter((line) => /\b(do not|don't|avoid|must not|without mentioning|exclude)\b/i.test(line))
      .map((line) =>
        trimPunctuation(
          line.replace(
            /^.*?\b(do not|don't|avoid|must not|without mentioning|exclude)\b\s*/i,
            "",
          ),
        ),
      )
      .filter(Boolean),
    8,
  );
}

function isMetaOnlySentence(value: string) {
  return META_LEAD_PATTERN.test(value) &&
    !/\b\d+(?:\.\d+)?%?\b|\$\d|\b20\d{2}\b/.test(value);
}

function neutralizeInstruction(value: string) {
  const original = trimPunctuation(value);
  if (!original) return "";

  if (/^reassure\b/i.test(original)) {
    return trimPunctuation(
      original
        .replace(/^reassure\s+(?:the\s+client|them)\s+that\s+/i, "")
        .replace(/^reassure\s+that\s+/i, ""),
    );
  }
  if (/^(?:ask|invite)\b/i.test(original)) {
    return "";
  }

  return trimPunctuation(original.replace(INSTRUCTION_PREFIX, ""));
}

function extractMeaningfulDetails(prompt: string) {
  const clauses = instructionClauses(prompt);
  const keyFacts: string[] = [];
  const supportingDetails: string[] = [];

  for (const [index, clause] of clauses.entries()) {
    if (index === 0 && isMetaOnlySentence(clause)) continue;

    const cleaned = neutralizeInstruction(
      index === 0 ? stripMetaInstruction(clause) : clause,
    );
    if (!cleaned || words(cleaned).length < 4) continue;
    if (/\b(do not|don't|avoid|must not|without mentioning|exclude)\b/i.test(cleaned)) {
      continue;
    }

    const hasConcreteFact =
      /\b\d+(?:\.\d+)?%?\b|\$\d|\b(?:today|yesterday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|Q[1-4]|20\d{2})\b|\b[A-Z]{2,6}(?:\.[A-Z])?\b/.test(
        cleaned,
      );

    if (hasConcreteFact) keyFacts.push(cleaned);
    else supportingDetails.push(cleaned);
  }

  return {
    keyFacts: unique(keyFacts, 8),
    supportingDetails: unique(supportingDetails, 10),
  };
}

function informationArchitecture(messageType: EmailPromptPlan["messageType"]) {
  const byType: Record<EmailPromptPlan["messageType"], string[]> = {
    "Market Update": [
      "What changed or is creating questions",
      "Verified facts and what the advisory team is monitoring",
      "Planning and portfolio relevance",
      "What the client should do next",
    ],
    "Portfolio Review": [
      "Portfolio issue being reviewed",
      "Concentration, risk, liquidity, and time-horizon context",
      "Known facts versus items still requiring verification",
      "Advisor review and next step",
    ],
    "Planning Update": [
      "Planning objective",
      "Work completed or considerations in progress",
      "Information or decision still needed",
      "Next planning action",
    ],
    "Meeting Follow-up": [
      "Purpose of the conversation",
      "Key takeaways",
      "Confirmed responsibilities or documents",
      "Next meeting or follow-up action",
    ],
    Scheduling: [
      "Reason for the meeting",
      "Topics to cover",
      "Expected preparation",
      "Simple scheduling action",
    ],
    "Document Request": [
      "Documents requested",
      "Why each item matters",
      "Secure delivery method",
      "Deadline or follow-up action",
    ],
    "General Update": [
      "Purpose of the update",
      "Most relevant information",
      "Planning implication",
      "Next action",
    ],
  };

  return byType[messageType];
}

function audienceOutcome(prompt: string, messageType: EmailPromptPlan["messageType"]) {
  const lower = prompt.toLowerCase();

  if (/\b(reassure|reduce anxiety|calm|confidence|comfortable)\b/.test(lower)) {
    return "The client should understand the issue without feeling pushed into a reactive decision.";
  }
  if (/\b(upload|send|provide|return|complete|sign|reply)\b/.test(lower)) {
    return "The client should know exactly what information or action is needed and how to complete it.";
  }
  if (/\b(schedule|book|meeting|review call|conversation)\b/.test(lower)) {
    return "The client should understand why a conversation is useful and have an easy way to schedule it.";
  }
  if (messageType === "Portfolio Review") {
    return "The client should understand the portfolio issue, the planning lens being applied, and the next review step.";
  }

  return "The client should understand why the update matters, what the advisor is doing, and what happens next.";
}

function missingInformation(
  prompt: string,
  messageType: EmailPromptPlan["messageType"],
  currentFactsRequired: boolean,
  keyFacts: string[],
) {
  const missing: string[] = [];

  if (currentFactsRequired && !keyFacts.length) {
    missing.push(
      "Current facts, dates, or source details were not supplied and should be verified before external delivery.",
    );
  }
  if (
    messageType === "Document Request" &&
    !/\b(pdf|statement|return|form|document|record|report|agreement|identification|ID)\b/i.test(
      prompt,
    )
  ) {
    missing.push("The exact requested document list should be confirmed.");
  }
  if (
    messageType === "Scheduling" &&
    !/\b(link|calendar|availability|time|date)\b/i.test(prompt)
  ) {
    missing.push("The scheduling method or available timing should be confirmed.");
  }

  return missing.slice(0, 6);
}

function subjectCandidates(input: {
  messageType: EmailPromptPlan["messageType"];
  focus: string;
  urgency: EmailPromptPlan["urgency"];
}) {
  const focus = titleCase(input.focus).slice(0, 105) || "Important Planning Update";
  const prefix = input.urgency === "Time Sensitive" ? "Time-Sensitive: " : "";

  const byType: Record<EmailPromptPlan["messageType"], string[]> = {
    "Market Update": [
      `${prefix}${focus}: What We Are Monitoring`,
      `${prefix}A Measured Perspective on ${focus}`,
      `${prefix}${focus} and Your Financial Plan`,
    ],
    "Portfolio Review": [
      `${prefix}${focus}: Portfolio Context and Next Steps`,
      `${prefix}Reviewing ${focus} Within Your Plan`,
      `${prefix}Your Portfolio Review: ${focus}`,
    ],
    "Planning Update": [
      `${prefix}${focus}: Planning Priorities and Next Steps`,
      `${prefix}An Update on ${focus}`,
      `${prefix}${focus} and Your Broader Financial Plan`,
    ],
    "Meeting Follow-up": [
      `${prefix}Follow-Up and Next Steps: ${focus}`,
      `${prefix}Recap of Our Conversation About ${focus}`,
      `${prefix}${focus}: Confirmed Next Steps`,
    ],
    Scheduling: [
      `${prefix}Scheduling Our ${focus} Review`,
      `${prefix}Choose a Time to Discuss ${focus}`,
      `${prefix}Planning Our Next Conversation`,
    ],
    "Document Request": [
      `${prefix}Documents Needed for ${focus}`,
      `${prefix}Secure Document Request: ${focus}`,
      `${prefix}Next Step for ${focus}`,
    ],
    "General Update": [
      `${prefix}${focus}: What to Know and What Comes Next`,
      `${prefix}An Update on ${focus}`,
      `${prefix}Important Information About ${focus}`,
    ],
  };

  return unique(
    byType[input.messageType].map((value) =>
      trimPunctuation(value).replace(/\s+/g, " ").slice(0, 140),
    ),
    3,
  );
}

function deriveSummary(
  messageType: EmailPromptPlan["messageType"],
  focus: string,
  requiredPoints: string[],
  prohibitedPoints: string[],
) {
  const base: Record<EmailPromptPlan["messageType"], string> = {
    "Market Update": `Explain ${focus} in measured plain English, distinguish short-term headlines from planning-relevant facts, and reassure the client that decisions remain grounded in the broader plan.`,
    "Portfolio Review": `Explain how ${focus} is being evaluated within the client's portfolio, objectives, risk profile, liquidity needs, and time horizon without implying an automatic investment action.`,
    "Planning Update": `Summarize the planning work related to ${focus}, clarify the priorities being monitored, and provide practical next steps.`,
    "Meeting Follow-up": `Recap the discussion about ${focus}, confirm the key takeaways, and clearly state the agreed next steps.`,
    Scheduling: `Invite the client to schedule a focused conversation about ${focus} and make the next step easy to complete.`,
    "Document Request": `Explain which documents are needed for ${focus}, why they matter, and how to send them securely.`,
    "General Update": `Provide a polished advisor update about ${focus}, explain why it matters, and connect it to the client's broader financial plan.`,
  };
  const requirements = requiredPoints.length
    ? ` Required elements: ${requiredPoints.join("; ")}.`
    : "";
  const restrictions = prohibitedPoints.length
    ? ` Avoid: ${prohibitedPoints.join("; ")}.`
    : "";

  return `${base[messageType]}${requirements}${restrictions}`.slice(0, 900);
}

export function compileEmailPrompt(input: {
  prompt: unknown;
  tone?: unknown;
  legacyTopic?: unknown;
  legacyPurpose?: unknown;
  legacyInstructions?: unknown;
  legacyCallToAction?: unknown;
}): EmailPromptPlan {
  const prompt =
    clean(input.prompt, 12_000) ||
    clean(
      [
        input.legacyTopic,
        input.legacyPurpose,
        input.legacyInstructions,
        input.legacyCallToAction,
      ]
        .filter(Boolean)
        .join("\n"),
      12_000,
    );
  const focus = compactFocus(prompt);
  const messageType = detectMessageType(prompt);
  const tone =
    clean(input.tone, 80) ||
    (messageType === "Market Update" ? "Calm and reassuring" : "Professional");
  const requiredPoints = extractRequiredPoints(prompt);
  const prohibitedPoints = extractProhibitedPoints(prompt);
  const symbols = extractSymbols(prompt);
  const currentFactsRequired = CURRENT_FACT_PATTERN.test(prompt);
  const meaningfulDetails = extractMeaningfulDetails(prompt);
  const callToAction =
    clean(input.legacyCallToAction, 700) || detectCallToAction(prompt, messageType);
  const communicationGoal = deriveSummary(
    messageType,
    focus,
    requiredPoints,
    prohibitedPoints,
  );

  return {
    schemaVersion: 1,
    originalPrompt: prompt,
    promptSummary: communicationGoal.slice(0, 500),
    messageType,
    subjectFocus: focus,
    communicationGoal,
    tone,
    desiredLength: detectLength(prompt),
    urgency: detectUrgency(prompt),
    callToAction,
    requiredPoints,
    prohibitedPoints,
    publicResearchTopics: currentFactsRequired
      ? unique(
          [focus, ...symbols.map((symbol) => `${symbol} current public context`)],
          8,
        )
      : [],
    symbols,
    currentFactsRequired,
    subjectCandidates: subjectCandidates({
      messageType,
      focus,
      urgency: detectUrgency(prompt),
    }),
    keyFacts: meaningfulDetails.keyFacts,
    supportingDetails: meaningfulDetails.supportingDetails,
    informationArchitecture: informationArchitecture(messageType),
    missingInformation: missingInformation(
      prompt,
      messageType,
      currentFactsRequired,
      meaningfulDetails.keyFacts,
    ),
    audienceOutcome: audienceOutcome(prompt, messageType),
  };
}

function openingParagraph(plan: EmailPromptPlan) {
  switch (plan.messageType) {
    case "Market Update":
      return `Recent developments related to ${plan.subjectFocus.replace(/^recent\s+/i, "")} may be creating questions. We are reviewing the available information carefully and separating short-term headlines from facts that may be relevant to your longer-term plan.`;
    case "Portfolio Review":
      return `We have been reviewing ${plan.subjectFocus} within the context of your portfolio and broader objectives. The purpose of this note is to explain the specific considerations we are evaluating without treating a short-term development as a reason for an automatic decision.`;
    case "Planning Update":
      return `We are continuing our work on ${plan.subjectFocus}. This update summarizes the planning priorities we are monitoring and the next steps that can help keep the work aligned with your goals, time horizon, and liquidity needs.`;
    case "Meeting Follow-up":
      return `Thank you for the recent conversation about ${plan.subjectFocus}. I wanted to provide a written recap so the key information, responsibilities, and next steps are easy to reference.`;
    case "Scheduling":
      return `I would like to arrange time to review ${plan.subjectFocus} with you. A focused conversation will allow us to address the relevant questions and confirm the next appropriate planning steps.`;
    case "Document Request":
      return `To continue the work on ${plan.subjectFocus}, we need a few supporting documents. Collecting them through the secure portal will help us keep the review organized and protect sensitive information.`;
    default:
      return `I wanted to share a substantive update regarding ${plan.subjectFocus}. We are evaluating it within the context of your broader financial plan and separating verified information from assumptions or short-term noise.`;
  }
}

function clientFacingSentence(value: string) {
  let result = trimPunctuation(value).replace(/^and\s+/i, "");
  if (!result) return "";

  if (/^reassure\b/i.test(result)) {
    result = result.replace(
      /^reassure\s+(?:the\s+client|them)\s+that\s+/i,
      "We want to reassure you that ",
    );
  } else if (/^(?:ask|invite)\b/i.test(result)) {
    return "";
  } else {
    result = result.replace(INSTRUCTION_PREFIX, "");
  }

  result = result
    .replace(/^that\s+/i, "")
    .replace(/\bthe client\b/gi, "you")
    .replace(/\btheir\b/gi, "your")
    .replace(/\bthem\b/gi, "you")
    .replace(/\bthey\b/gi, "you")
    .replace(/\byou holds\b/gi, "you hold")
    .replace(/\byou has\b/gi, "you have")
    .replace(/\byou is\b/gi, "you are")
    .replace(/\byou was\b/gi, "you were")
    .replace(/\s+/g, " ")
    .trim();

  if (!result) return "";
  result = `${result.charAt(0).toUpperCase()}${result.slice(1)}`;
  return /[.!?]$/.test(result) ? result : `${result}.`;
}

function informativeParagraphs(plan: EmailPromptPlan) {
  const facts = (plan.keyFacts ?? []).map(clientFacingSentence).filter(Boolean);
  const details = (plan.supportingDetails ?? []).map(clientFacingSentence).filter(Boolean);
  const selected = unique([...facts, ...details], plan.desiredLength === "Concise" ? 3 : 6);

  if (!selected.length) {
    const fallback: Record<EmailPromptPlan["messageType"], string> = {
      "Market Update":
        "We are evaluating the situation through three lenses: the verified facts, the relevance to your portfolio and cash-flow needs, and whether the development changes any long-term planning assumption.",
      "Portfolio Review":
        "Our review considers concentration, diversification, liquidity, taxes, time horizon, risk tolerance, and whether the original investment thesis remains supported by current evidence.",
      "Planning Update":
        "The review is focused on what has been completed, what information is still needed, and which decisions will have the greatest effect on the broader plan.",
      "Meeting Follow-up":
        "This recap is intended to keep the discussion, responsibilities, and next decisions organized in one place.",
      Scheduling:
        "The meeting will focus on the questions most relevant to your plan, any changes since our last review, and the next decisions that require your input.",
      "Document Request":
        "The requested records allow us to verify current information, reduce assumptions, and complete the planning review with a more accurate picture.",
      "General Update":
        "We are separating verified information from assumptions, evaluating the planning relevance, and identifying the next decision or follow-up that may be needed.",
    };

    return [fallback[plan.messageType]];
  }

  if (plan.desiredLength === "Concise" && selected.length <= 3) {
    return [selected.join(" ")];
  }

  return [
    "The most relevant information is:",
    selected.map((item) => `• ${item}`).join("\n"),
  ];
}


function normalizedToken(value: string) {
  const lower = value.toLowerCase();
  if (lower.length > 5 && lower.endsWith("ing")) return lower.slice(0, -3);
  if (lower.length > 4 && lower.endsWith("ed")) return lower.slice(0, -2);
  if (lower.length > 4 && lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

function contentTokenSet(value: string) {
  return new Set(
    words(value)
      .filter((token) => token.length >= 3)
      .map(normalizedToken),
  );
}

function humanJoin(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function contextualParagraph(
  plan: EmailPromptPlan,
  client: Pick<EmailClientOption, "riskProfile" | "holdingSymbols">,
) {
  const mentionedHoldings = plan.symbols.filter((symbol) =>
    client.holdingSymbols.some((holding) => holding.toUpperCase() === symbol),
  );

  if (mentionedHoldings.length) {
    return `Because your portfolio includes ${humanJoin(mentionedHoldings)}, we are paying particular attention to the verified facts, portfolio concentration, liquidity implications, and whether any development changes the assumptions behind the plan. No change is being recommended solely because of a headline or short-term price movement.`;
  }

  if (client.riskProfile) {
    return `Any decision will be evaluated against your ${client.riskProfile.toLowerCase()} risk profile, along with your objectives, time horizon, liquidity needs, tax considerations, and the evidence available at the time of review.`;
  }

  return "Any decision will be evaluated against your objectives, time horizon, liquidity needs, risk tolerance, tax considerations, and the evidence available at the time of review.";
}

function uncoveredRequiredPoints(plan: EmailPromptPlan, existingBody: string) {
  const existingTokens = contentTokenSet(existingBody);
  return (plan.requiredPoints ?? [])
    .filter((point) => {
      const tokens = words(point)
        .filter((token) => token.length >= 3)
        .map(normalizedToken);
      return (
        tokens.length > 0 &&
        !tokens.some((token) => existingTokens.has(token))
      );
    })
    .map(clientFacingSentence)
    .filter(Boolean)
    .slice(0, 3);
}

export function buildImmediateEmailDraft(input: {
  plan: EmailPromptPlan;
  advisorName: string;
  client: EmailClientOption;
}) {
  const subject =
    input.plan.subjectCandidates[0] || "An Update From Your Advisory Team";
  const firstName =
    input.client.fullName.split(/\s+/)[0] || input.client.fullName || "there";
  const opening = openingParagraph(input.plan);
  const info = informativeParagraphs(input.plan);
  const context = contextualParagraph(input.plan, input.client);
  const workingBody = [opening, ...info, context].join("\n\n");
  const uncovered = uncoveredRequiredPoints(input.plan, workingBody);
  const verification = input.plan.missingInformation?.length
    ? "Before any decision or external conclusion, we will verify the remaining facts, dates, and source details so the discussion is based on current information."
    : "We will continue to monitor the relevant information and will contact you if the evidence changes the planning discussion.";
  const body = [
    `Hello ${firstName},`,
    opening,
    ...info,
    context,
    uncovered.length ? uncovered.join("\n\n") : "",
    verification,
    input.plan.callToAction,
    "Best,",
    input.advisorName,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    subject,
    body,
    strategy: `${input.plan.messageType}; ${input.plan.desiredLength.toLowerCase()} length; ${input.plan.urgency.toLowerCase()} communication.`,
  };
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}

function similarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function containsUnsupportedCertainty(value: string) {
  const normalized = value
    .replace(/\b(?:does|do|did|can|cannot|can't|will|would)\s+not\s+guarantee(?:d)?\b/gi, "")
    .replace(/\bno\s+guarantee(?:s|d)?\b/gi, "")
    .replace(/\bnot\s+guaranteed\b/gi, "")
    .replace(/\bwithout\s+guarantee(?:s|d)?\b/gi, "");

  return /\bguarantee(?:d|s)?\b|\brisk[- ]free\b|\bwill definitely\b/i.test(normalized);
}

export function assessGeneratedEmail(input: {
  plan: EmailPromptPlan;
  subject: string;
  body: string;
}) {
  const subject = clean(input.subject, 180);
  const body = clean(input.body, 24_000);
  const problems: string[] = [];
  let score = 100;
  const minimumBodyLength =
    input.plan.desiredLength === "Detailed"
      ? 520
      : input.plan.desiredLength === "Concise"
        ? 300
        : 360;

  if (words(subject).length < 3 || words(subject).length > 16) {
    score -= 18;
    problems.push("Subject should normally contain 3–16 words.");
  }
  if (/^(email|message|client email|draft|update)$/i.test(subject)) {
    score -= 35;
    problems.push("Subject is too generic.");
  }
  if (body.length < minimumBodyLength) {
    score -= 25;
    problems.push("Body is too short to be a complete client communication.");
  }
  if (
    META_LEAD_PATTERN.test(body) ||
    /\b(the prompt|your instructions|as requested,? i (?:wrote|created))\b/i.test(body)
  ) {
    score -= 40;
    problems.push("Body contains prompt or meta-instruction language.");
  }
  if (
    similarity(input.plan.originalPrompt, body) > 0.78 &&
    body.length < input.plan.originalPrompt.length * 1.6
  ) {
    score -= 35;
    problems.push("Body appears to echo the prompt instead of transforming it.");
  }
  if (!/\b(hello|hi|dear)\b/i.test(body.slice(0, 120))) {
    score -= 8;
    problems.push("Greeting is missing.");
  }
  if (!/\b(reply|schedule|contact|send|upload|let (?:me|us) know|next step)\b/i.test(body)) {
    score -= 10;
    problems.push("Clear next action is missing.");
  }
  if (containsUnsupportedCertainty(body)) {
    score -= 45;
    problems.push("Unsupported certainty or guarantee language was detected.");
  }

  const focusTokens = words(input.plan.subjectFocus)
    .filter((token) => token.length > 3)
    .map((token) => token.toLowerCase());
  if (
    focusTokens.length &&
    !focusTokens.some((token) => body.toLowerCase().includes(token))
  ) {
    score -= 18;
    problems.push("The email does not clearly address the prompt's main subject.");
  }

  const bodyTokens = contentTokenSet(body);
  const requiredCoverage = (input.plan.requiredPoints ?? []).filter((point) => {
    const tokens = words(point)
      .filter((token) => token.length >= 3)
      .map(normalizedToken);
    return tokens.length === 0 || tokens.some((token) => bodyTokens.has(token));
  }).length;
  if (
    (input.plan.requiredPoints ?? []).length > 1 &&
    requiredCoverage < Math.ceil((input.plan.requiredPoints ?? []).length / 2)
  ) {
    score -= 15;
    problems.push("Too many advisor-requested points are missing from the email.");
  }

  return {
    score: Math.max(0, score),
    acceptable: score >= 72,
    problems,
  };
}