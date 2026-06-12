export type ComplianceUseCase =
  | "general"
  | "research"
  | "source_review"
  | "draft_email"
  | "client_email"
  | "client_briefing"
  | "advisor_note"
  | "marketing"
  | "social_post"
  | "performance"
  | "portfolio_review"
  | "trade_review"
  | "private_investment"
  | "alternative_investment"
  | "meeting_prep"
  | "notification"
  | "task"
  | "site_action"
  | "website_content"
  | "create_recommendation";

export type ComplianceAudience =
  | "internal"
  | "advisor"
  | "client"
  | "prospect"
  | "public"
  | "regulator"
  | "unknown";

export type ComplianceChannel =
  | "workspace"
  | "email"
  | "sms"
  | "pdf"
  | "meeting"
  | "website"
  | "social"
  | "push"
  | "internal_note"
  | "unknown";

export type ComplianceSeverity = "low" | "medium" | "high" | "critical";
export type ComplianceStatus = "pass" | "needs_review" | "blocked";
export type ComplianceRiskLevel = "Low" | "Medium" | "High" | "Critical";

export type ComplianceSource = {
  title?: string | null;
  url?: string | null;
  publisher?: string | null;
  sourceType?: string | null;
  summary?: string | null;
  retrievedAt?: string | null;
  credibilityScore?: number | null;
};

export type ComplianceFlag = {
  id: string;
  title: string;
  severity: ComplianceSeverity;
  category:
    | "recommendation"
    | "performance"
    | "marketing"
    | "testimonial"
    | "private_investment"
    | "privacy"
    | "source_quality"
    | "books_records"
    | "delivery"
    | "ai_use"
    | "general";
  description: string;
  evidence?: string[];
  recommendation: string;
  ruleReference?: string;
  rationale?: string;
};

export type ComplianceAction = {
  id: string;
  title: string;
  priority: ComplianceSeverity;
  owner: "advisor" | "compliance" | "operations" | "system";
  description: string;
  completed?: boolean;
};

export type ComplianceReviewInput = {
  content: string;
  title?: string | null;
  useCase?: ComplianceUseCase | null;
  audience?: ComplianceAudience | null;
  channel?: ComplianceChannel | null;
  clientSpecific?: boolean | null;
  includesRecommendation?: boolean | null;
  includesPerformance?: boolean | null;
  includesTestimonial?: boolean | null;
  includesPrivateInvestment?: boolean | null;
  includesPII?: boolean | null;
  sources?: ComplianceSource[] | null;
  advisorName?: string | null;
  clientName?: string | null;
  firmName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ComplianceInput = ComplianceReviewInput;

export type SiteActionInput = {
  id?: string | null;
  title?: string | null;
  label?: string | null;
  action?: string | null;
  description?: string | null;
  content?: string | null;
  href?: string | null;
  url?: string | null;
  path?: string | null;
  cta?: string | null;
  buttonText?: string | null;
  useCase?: ComplianceUseCase | string | null;
  audience?: ComplianceAudience | string | null;
  channel?: ComplianceChannel | string | null;
  clientSpecific?: boolean | null;
  requiresApproval?: boolean | null;
  includesRecommendation?: boolean | null;
  includesPerformance?: boolean | null;
  includesTestimonial?: boolean | null;
  includesPrivateInvestment?: boolean | null;
  includesPII?: boolean | null;
  sources?: ComplianceSource[] | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type SiteComplianceAuditInput = {
  siteName?: string | null;
  firmName?: string | null;
  pages?: Array<{
    path?: string | null;
    title?: string | null;
    content?: string | null;
    audience?: ComplianceAudience | string | null;
    useCase?: ComplianceUseCase | string | null;
    actions?: SiteActionInput[] | null;
    sources?: ComplianceSource[] | null;
    metadata?: Record<string, unknown> | null;
  }> | null;
  actions?: SiteActionInput[] | null;
  content?: string | null;
  sources?: ComplianceSource[] | null;
  metadata?: Record<string, unknown> | null;
};

export type ComplianceReviewResult = {
  id: string;
  createdAt: string;
  status: ComplianceStatus;
  riskLevel: ComplianceRiskLevel;
  riskScore: number;
  score: number;
  useCase: ComplianceUseCase;
  audience: ComplianceAudience;
  channel: ComplianceChannel;
  summary: string;
  verdict: string;
  flags: ComplianceFlag[];
  requiredActions: ComplianceAction[];
  actions: ComplianceAction[];
  disclosures: string[];
  requiredDisclosures: string[];
  retentionNotes: string[];
  booksAndRecords: {
    retainPrompt: boolean;
    retainOutput: boolean;
    retainSources: boolean;
    retainApproval: boolean;
    recommendedRetentionYears: number;
    notes: string[];
  };
  approvedForAutoSend: boolean;
  approvedForSending: boolean;
  canSend: boolean;
  requiresHumanReview: boolean;
  requiresComplianceReview: boolean;
  blockedReasons: string[];
  metadata: Record<string, unknown>;
};

export type SiteActionReviewResult = ComplianceReviewResult & {
  actionId: string | null;
  actionTitle: string;
  actionHref: string | null;
  actionPath: string | null;
  siteAction: SiteActionInput;
  canPublish: boolean;
  canExecute: boolean;
  requiresApproval: boolean;
};

export type SiteComplianceAuditResult = {
  id: string;
  createdAt: string;
  siteName: string;
  status: ComplianceStatus;
  riskLevel: ComplianceRiskLevel;
  riskScore: number;
  summary: string;
  pageReviews: ComplianceReviewResult[];
  actionReviews: SiteActionReviewResult[];
  flags: ComplianceFlag[];
  requiredActions: ComplianceAction[];
  disclosures: string[];
  retentionNotes: string[];
  canPublish: boolean;
  requiresComplianceReview: boolean;
  metadata: Record<string, unknown>;
};

export type AdvisorComplianceReviewInput = ComplianceReviewInput;
export type AdvisorComplianceReviewResult = ComplianceReviewResult;
export type AdvisorComplianceFlag = ComplianceFlag;
export type AdvisorComplianceAction = ComplianceAction;

type PatternRule = {
  id: string;
  title: string;
  category: ComplianceFlag["category"];
  severity: ComplianceSeverity;
  score: number;
  ruleReference?: string;
  description: string;
  recommendation: string;
  patterns: RegExp[];
};

const DEFAULT_USE_CASE: ComplianceUseCase = "general";
const DEFAULT_AUDIENCE: ComplianceAudience = "unknown";
const DEFAULT_CHANNEL: ComplianceChannel = "unknown";

const VALID_USE_CASES: ComplianceUseCase[] = [
  "general",
  "research",
  "source_review",
  "draft_email",
  "client_email",
  "client_briefing",
  "advisor_note",
  "marketing",
  "social_post",
  "performance",
  "portfolio_review",
  "trade_review",
  "private_investment",
  "alternative_investment",
  "meeting_prep",
  "notification",
  "task",
  "site_action",
  "website_content",
  "create_recommendation",
];

const VALID_AUDIENCES: ComplianceAudience[] = [
  "internal",
  "advisor",
  "client",
  "prospect",
  "public",
  "regulator",
  "unknown",
];

const VALID_CHANNELS: ComplianceChannel[] = [
  "workspace",
  "email",
  "sms",
  "pdf",
  "meeting",
  "website",
  "social",
  "push",
  "internal_note",
  "unknown",
];

const RECOMMENDATION_PATTERNS: RegExp[] = [
  /\bbuy\b/i,
  /\bsell\b/i,
  /\bhold\b/i,
  /\brebalance\b/i,
  /\ballocate\b/i,
  /\boverweight\b/i,
  /\bunderweight\b/i,
  /\bincrease\b.*\bposition\b/i,
  /\breduce\b.*\bposition\b/i,
  /\btrim\b.*\bposition\b/i,
  /\badd\b.*\bexposure\b/i,
  /\bliquidate\b/i,
  /\bswitch\b.*\bto\b/i,
  /\bwe recommend\b/i,
  /\bmy recommendation\b/i,
  /\byou should\b/i,
  /\byou need to\b/i,
  /\bappropriate for you\b/i,
  /\bsuitable for you\b/i,
];

const PERFORMANCE_PATTERNS: RegExp[] = [
  /\breturn(?:ed|s)?\b/i,
  /\boutperform(?:ed|s)?\b/i,
  /\bunderperform(?:ed|s)?\b/i,
  /\bbenchmark\b/i,
  /\btrack record\b/i,
  /\bannualized\b/i,
  /\bbacktest(?:ed|ing)?\b/i,
  /\bhypothetical\b/i,
  /\bprojection\b/i,
  /\bprojected\b/i,
  /\bexpected return\b/i,
  /\btarget return\b/i,
  /\bIRR\b/i,
  /\bMOIC\b/i,
  /\bCAGR\b/i,
  /\b\d+(?:\.\d+)?%\b/i,
];

const GUARANTEE_PATTERNS: RegExp[] = [
  /\bguarantee(?:d|s)?\b/i,
  /\brisk[- ]?free\b/i,
  /\bno risk\b/i,
  /\bcannot lose\b/i,
  /\bwill definitely\b/i,
  /\bwill always\b/i,
  /\bassured return\b/i,
  /\bsecure return\b/i,
  /\bguaranteed income\b/i,
];

const TESTIMONIAL_PATTERNS: RegExp[] = [
  /\btestimonial\b/i,
  /\bendorsement\b/i,
  /\breview\b/i,
  /\brating\b/i,
  /\bfive[- ]star\b/i,
  /\bclient says\b/i,
  /\bclient said\b/i,
  /\bsuccess story\b/i,
  /\bcase study\b/i,
  /\btop advisor\b/i,
  /\bbest advisor\b/i,
];

const PRIVATE_INVESTMENT_PATTERNS: RegExp[] = [
  /\bprivate placement\b/i,
  /\bprivate fund\b/i,
  /\bhedge fund\b/i,
  /\bventure\b/i,
  /\bprivate equity\b/i,
  /\balternative investment\b/i,
  /\baccredited investor\b/i,
  /\bqualified purchaser\b/i,
  /\breg d\b/i,
  /\b506\(b\)\b/i,
  /\b506\(c\)\b/i,
  /\billiquid\b/i,
  /\block[- ]?up\b/i,
];

const PRIVACY_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\bssn\b/i,
  /\bsocial security\b/i,
  /\baccount number\b/i,
  /\brouting number\b/i,
  /\btax id\b/i,
  /\bdate of birth\b/i,
  /\bdob\b/i,
  /\bnet worth\b/i,
  /\bportfolio value\b/i,
  /\bhousehold income\b/i,
];

const AI_DISCLOSURE_PATTERNS: RegExp[] = [
  /\bAI generated\b/i,
  /\bgenerated by AI\b/i,
  /\bautomated recommendation\b/i,
  /\bautomatically generated\b/i,
];

const MARKETING_PATTERNS: RegExp[] = [
  /\blimited time\b/i,
  /\bact now\b/i,
  /\bdon't miss\b/i,
  /\bexclusive opportunity\b/i,
  /\bhot pick\b/i,
  /\bcan't miss\b/i,
  /\bslam dunk\b/i,
  /\bhigh conviction\b/i,
  /\bget rich\b/i,
];

const RULES: PatternRule[] = [
  {
    id: "recommendation-language",
    title: "Possible recommendation language",
    category: "recommendation",
    severity: "high",
    score: 28,
    ruleReference: "Advisor recommendation / suitability review",
    description:
      "The content appears to include language that may be interpreted as individualized investment advice or a securities recommendation.",
    recommendation:
      "Require advisor review. Confirm client objective, risk tolerance, time horizon, liquidity needs, concentration, tax considerations, restrictions, and rationale before delivery.",
    patterns: RECOMMENDATION_PATTERNS,
  },
  {
    id: "performance-claims",
    title: "Performance or return language",
    category: "performance",
    severity: "high",
    score: 24,
    ruleReference: "SEC Marketing Rule / performance advertising controls",
    description:
      "The content references returns, projections, backtests, benchmarks, percentages, or performance-related claims.",
    recommendation:
      "Verify calculation support, time period, benchmark, assumptions, limitations, fees, risks, and required disclosures before use.",
    patterns: PERFORMANCE_PATTERNS,
  },
  {
    id: "guarantee-language",
    title: "Guarantee or certainty language",
    category: "performance",
    severity: "critical",
    score: 36,
    ruleReference: "Anti-fraud / misleading statement controls",
    description:
      "The content may imply guaranteed, certain, risk-free, or assured investment outcomes.",
    recommendation:
      "Remove guarantee language. Replace with balanced risk disclosure and avoid certainty about future outcomes.",
    patterns: GUARANTEE_PATTERNS,
  },
  {
    id: "testimonial-endorsement-rating",
    title: "Testimonial, endorsement, or rating language",
    category: "testimonial",
    severity: "high",
    score: 24,
    ruleReference: "SEC Marketing Rule testimonial / endorsement controls",
    description:
      "The content appears to reference testimonials, endorsements, ratings, reviews, rankings, or client success stories.",
    recommendation:
      "Route to compliance review. Confirm required disclosures, compensation status, conflicts, substantiation, and firm policy approval.",
    patterns: TESTIMONIAL_PATTERNS,
  },
  {
    id: "private-investment-language",
    title: "Private or alternative investment language",
    category: "private_investment",
    severity: "high",
    score: 26,
    ruleReference: "Private offering / alternatives suitability controls",
    description:
      "The content references private placements, private funds, venture, alternatives, accredited investors, or illiquid investments.",
    recommendation:
      "Require eligibility, suitability, offering-document, risk, liquidity, fee, conflict, and approval review before client communication.",
    patterns: PRIVATE_INVESTMENT_PATTERNS,
  },
  {
    id: "privacy-sensitive-information",
    title: "Possible sensitive client information",
    category: "privacy",
    severity: "critical",
    score: 34,
    ruleReference: "Reg S-P / privacy and safeguarding controls",
    description:
      "The content may include personally identifiable information, financial account information, or sensitive household data.",
    recommendation:
      "Do not send externally until sensitive information is removed, masked, encrypted, or approved under firm privacy procedures.",
    patterns: PRIVACY_PATTERNS,
  },
  {
    id: "marketing-pressure-language",
    title: "Potentially promotional or pressure-based language",
    category: "marketing",
    severity: "medium",
    score: 16,
    ruleReference: "Marketing review / fair and balanced communication controls",
    description:
      "The content may use promotional, urgent, or pressure-based wording that can be inappropriate for advisor communications.",
    recommendation:
      "Rewrite in balanced, educational, and non-promissory language. Avoid urgency pressure unless required and approved.",
    patterns: MARKETING_PATTERNS,
  },
  {
    id: "ai-disclosure-language",
    title: "AI-generated communication language",
    category: "ai_use",
    severity: "medium",
    score: 12,
    ruleReference: "AI governance / supervision controls",
    description:
      "The content references AI generation or automated recommendations.",
    recommendation:
      "Confirm firm AI policy, human review, source verification, and required recordkeeping before use.",
    patterns: AI_DISCLOSURE_PATTERNS,
  },
];

function asComplianceUseCase(value: unknown): ComplianceUseCase {
  if (typeof value !== "string") return DEFAULT_USE_CASE;
  return VALID_USE_CASES.includes(value as ComplianceUseCase)
    ? (value as ComplianceUseCase)
    : DEFAULT_USE_CASE;
}

function asComplianceAudience(value: unknown): ComplianceAudience {
  if (typeof value !== "string") return DEFAULT_AUDIENCE;
  return VALID_AUDIENCES.includes(value as ComplianceAudience)
    ? (value as ComplianceAudience)
    : DEFAULT_AUDIENCE;
}

function asComplianceChannel(value: unknown): ComplianceChannel {
  if (typeof value !== "string") return DEFAULT_CHANNEL;
  return VALID_CHANNELS.includes(value as ComplianceChannel)
    ? (value as ComplianceChannel)
    : DEFAULT_CHANNEL;
}

function normalizeUseCase(value: ComplianceUseCase | null | undefined): ComplianceUseCase {
  return value || DEFAULT_USE_CASE;
}

function normalizeAudience(value: ComplianceAudience | null | undefined): ComplianceAudience {
  return value || DEFAULT_AUDIENCE;
}

function normalizeChannel(value: ComplianceChannel | null | undefined): ComplianceChannel {
  return value || DEFAULT_CHANNEL;
}

function cleanContent(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, 100_000)
    : "";
}

function uniqueEvidence(content: string, patterns: RegExp[]) {
  const evidence = new Set<string>();

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[0]) evidence.add(match[0]);
  }

  return Array.from(evidence).slice(0, 8);
}

function hasAny(content: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(content));
}

function addFlag(flags: ComplianceFlag[], flag: ComplianceFlag) {
  if (!flags.some((item) => item.id === flag.id)) {
    flags.push(flag);
  }
}

function addAction(actions: ComplianceAction[], action: ComplianceAction) {
  if (!actions.some((item) => item.id === action.id)) {
    actions.push(action);
  }
}

function scoreForSeverity(severity: ComplianceSeverity) {
  if (severity === "critical") return 35;
  if (severity === "high") return 25;
  if (severity === "medium") return 14;
  return 6;
}

function riskLevelForScore(score: number): ComplianceRiskLevel {
  if (score >= 80) return "Critical";
  if (score >= 55) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function statusForRisk(flags: ComplianceFlag[], score: number): ComplianceStatus {
  if (flags.some((flag) => flag.severity === "critical")) return "blocked";
  if (score >= 80) return "blocked";
  if (flags.length || score >= 25) return "needs_review";
  return "pass";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function averageSourceCredibility(sources: ComplianceSource[]) {
  const scores = sources
    .map((source) => source.credibilityScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  if (!scores.length) return null;

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function hasSourceUrls(sources: ComplianceSource[]) {
  return sources.some((source) => typeof source.url === "string" && source.url.trim());
}

function isExternalAudience(audience: ComplianceAudience) {
  return audience === "client" || audience === "prospect" || audience === "public";
}

function isExternalChannel(channel: ComplianceChannel) {
  return channel === "email" || channel === "sms" || channel === "pdf" || channel === "website" || channel === "social" || channel === "push";
}

function buildDisclosures(input: {
  flags: ComplianceFlag[];
  useCase: ComplianceUseCase;
  audience: ComplianceAudience;
  channel: ComplianceChannel;
}) {
  const disclosures = new Set<string>();

  if (input.flags.some((flag) => flag.category === "performance")) {
    disclosures.add(
      "Performance information should include relevant time period, limitations, assumptions, risks, fees where applicable, and a statement that past performance does not guarantee future results."
    );
  }

  if (input.flags.some((flag) => flag.category === "recommendation")) {
    disclosures.add(
      "Any client-specific recommendation must be reviewed against the client’s objectives, risk tolerance, time horizon, liquidity needs, restrictions, and overall financial situation."
    );
  }

  if (input.flags.some((flag) => flag.category === "private_investment")) {
    disclosures.add(
      "Private or alternative investments may involve illiquidity, leverage, limited transparency, complex fees, conflicts, eligibility restrictions, and risk of loss."
    );
  }

  if (input.flags.some((flag) => flag.category === "testimonial")) {
    disclosures.add(
      "Testimonials, endorsements, ratings, and rankings require review for compensation, conflicts, criteria, limitations, and required disclosures before use."
    );
  }

  if (input.flags.some((flag) => flag.category === "ai_use")) {
    disclosures.add(
      "AI-assisted content must be reviewed by a qualified human before delivery or use in regulated communications."
    );
  }

  if (isExternalAudience(input.audience) || isExternalChannel(input.channel)) {
    disclosures.add(
      "This communication is for informational purposes and should not be treated as a guarantee, tax advice, legal advice, or standalone investment recommendation."
    );
  }

  return Array.from(disclosures);
}

function buildRetentionNotes(input: {
  flags: ComplianceFlag[];
  useCase: ComplianceUseCase;
  audience: ComplianceAudience;
  channel: ComplianceChannel;
  sources: ComplianceSource[];
}) {
  const notes = new Set<string>();

  notes.add("Retain the final communication, review result, approval status, and delivery metadata.");

  if (input.sources.length) {
    notes.add("Retain source URLs, source summaries, retrieval dates, and any source-quality notes used to create the communication.");
  }

  if (input.flags.some((flag) => flag.category === "recommendation")) {
    notes.add("Retain recommendation rationale, client context, suitability basis, and advisor approval trail.");
  }

  if (input.flags.some((flag) => flag.category === "performance")) {
    notes.add("Retain performance calculations, assumptions, benchmarks, time periods, fee treatment, and substantiation.");
  }

  if (input.flags.some((flag) => flag.category === "marketing" || flag.category === "testimonial")) {
    notes.add("Retain marketing review, disclosures, substantiation, and approval history.");
  }

  if (input.flags.some((flag) => flag.category === "privacy")) {
    notes.add("Retain privacy/safeguarding review notes and avoid preserving unnecessary sensitive data in plain text.");
  }

  return Array.from(notes);
}

function summarize(flags: ComplianceFlag[], status: ComplianceStatus, riskLevel: ComplianceRiskLevel) {
  if (status === "pass") {
    return "No major compliance issues were detected. Standard advisor review and records retention still apply.";
  }

  const critical = flags.filter((flag) => flag.severity === "critical").length;
  const high = flags.filter((flag) => flag.severity === "high").length;

  if (status === "blocked") {
    return `Blocked pending review. Detected ${critical} critical and ${high} high-severity compliance issue(s).`;
  }

  return `Human review required. Detected ${flags.length} compliance issue(s), with overall ${riskLevel} risk.`;
}

function verdictFor(status: ComplianceStatus) {
  if (status === "pass") return "Pass with standard advisor review and retention.";
  if (status === "blocked") return "Blocked until the flagged issues are resolved and approved.";
  return "Needs advisor or compliance review before external use.";
}

function contentFromSiteAction(input: SiteActionInput) {
  return [
    input.title,
    input.label,
    input.action,
    input.cta,
    input.buttonText,
    input.description,
    input.content,
    input.href ? `Destination: ${input.href}` : null,
    input.url ? `URL: ${input.url}` : null,
    input.path ? `Path: ${input.path}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function reviewAdvisorCompliance(input: ComplianceReviewInput): ComplianceReviewResult {
  const content = cleanContent(input.content);
  const useCase = normalizeUseCase(input.useCase);
  const audience = normalizeAudience(input.audience);
  const channel = normalizeChannel(input.channel);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const flags: ComplianceFlag[] = [];
  const requiredActions: ComplianceAction[] = [];

  let riskScore = 0;

  if (!content) {
    addFlag(flags, {
      id: "empty-content",
      title: "No content provided",
      severity: "medium",
      category: "general",
      description: "The compliance engine did not receive content to review.",
      recommendation: "Provide the full draft, message, report, or recommendation text before review.",
    });
    riskScore += 14;
  }

  for (const rule of RULES) {
    if (hasAny(content, rule.patterns)) {
      addFlag(flags, {
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        category: rule.category,
        description: rule.description,
        evidence: uniqueEvidence(content, rule.patterns),
        recommendation: rule.recommendation,
        ruleReference: rule.ruleReference,
        rationale: rule.description,
      });
      riskScore += rule.score || scoreForSeverity(rule.severity);
    }
  }

  const detectedRecommendation =
    input.includesRecommendation === true ||
    hasAny(content, RECOMMENDATION_PATTERNS);

  if (detectedRecommendation || input.useCase === "create_recommendation") {
    addFlag(flags, {
      id: "client-specific-recommendation-review",
      title: "Possible investment recommendation",
      severity: "high",
      category: "recommendation",
      description:
        "The content or use case indicates that the advisor may be creating a client-specific recommendation.",
      evidence: uniqueEvidence(content, RECOMMENDATION_PATTERNS),
      recommendation:
        "Require advisor approval and suitability review. Confirm client objective, risk tolerance, time horizon, liquidity needs, restrictions, conflicts, fees, tax considerations, concentration, and documented rationale.",
      ruleReference: "Investment adviser fiduciary duty / recommendation supervision",
    });
    riskScore += 25;

    addAction(requiredActions, {
      id: "review-recommendation-rationale",
      title: "Review recommendation rationale",
      priority: "high",
      owner: "advisor",
      description:
        "Document why the recommendation is appropriate for the client before use or delivery.",
    });
  }

  if (input.includesPerformance === true) {
    addFlag(flags, {
      id: "explicit-performance-review",
      title: "Performance review required",
      severity: "high",
      category: "performance",
      description:
        "The input explicitly indicates that the content includes performance information.",
      recommendation:
        "Confirm calculation support, assumptions, limitations, time period, benchmark, fee treatment, and required disclosures.",
      ruleReference: "SEC Marketing Rule / books and records",
    });
    riskScore += 22;
  }

  if (input.includesTestimonial === true) {
    addFlag(flags, {
      id: "explicit-testimonial-review",
      title: "Testimonial or endorsement review required",
      severity: "high",
      category: "testimonial",
      description:
        "The input explicitly indicates testimonial, endorsement, rating, review, or ranking content.",
      recommendation:
        "Route to compliance review for disclosure, compensation, conflict, criteria, substantiation, and approval checks.",
      ruleReference: "SEC Marketing Rule",
    });
    riskScore += 22;
  }

  if (input.includesPrivateInvestment === true) {
    addFlag(flags, {
      id: "explicit-private-investment-review",
      title: "Private investment review required",
      severity: "high",
      category: "private_investment",
      description:
        "The input explicitly indicates private or alternative investment content.",
      recommendation:
        "Require offering-document, eligibility, suitability, risk, fee, conflict, liquidity, and approval review.",
    });
    riskScore += 24;
  }

  if (input.includesPII === true) {
    addFlag(flags, {
      id: "explicit-pii-review",
      title: "Privacy review required",
      severity: "critical",
      category: "privacy",
      description:
        "The input explicitly indicates personally identifiable or sensitive client information.",
      recommendation:
        "Do not send externally until sensitive data is removed, masked, encrypted, or approved under privacy procedures.",
      ruleReference: "Reg S-P / privacy safeguards",
    });
    riskScore += 34;
  }

  if (input.clientSpecific && isExternalAudience(audience)) {
    addFlag(flags, {
      id: "client-specific-external-communication",
      title: "Client-specific external communication",
      severity: "medium",
      category: "delivery",
      description:
        "The content appears client-specific and is intended for an external audience.",
      recommendation:
        "Confirm recipient, client context, suitability, accuracy, approval status, and delivery channel before sending.",
    });
    riskScore += 14;
  }

  if (isExternalAudience(audience) && isExternalChannel(channel)) {
    addAction(requiredActions, {
      id: "external-delivery-approval",
      title: "Approve before external delivery",
      priority: "medium",
      owner: "advisor",
      description:
        "Review and approve the communication before it is sent externally.",
    });
    riskScore += 6;
  }

  if (
    (useCase === "marketing" || useCase === "social_post" || audience === "public") &&
    flags.some((flag) => flag.category === "performance" || flag.category === "testimonial" || flag.category === "marketing")
  ) {
    addAction(requiredActions, {
      id: "marketing-compliance-review",
      title: "Marketing compliance review",
      priority: "high",
      owner: "compliance",
      description:
        "Route marketing, public, testimonial, rating, ranking, and performance content through compliance approval.",
    });
    riskScore += 18;
  }

  const averageCredibility = averageSourceCredibility(sources);

  if (
    (flags.some((flag) => flag.category === "performance" || flag.category === "recommendation" || flag.category === "private_investment") ||
      useCase === "create_recommendation") &&
    !sources.length
  ) {
    addFlag(flags, {
      id: "missing-source-support",
      title: "Missing source support",
      severity: "medium",
      category: "source_quality",
      description:
        "The content appears to include claims or recommendations but no sources were provided to support the review.",
      recommendation:
        "Attach source links, source summaries, issuer documents, market data, assumptions, and advisor rationale before approval.",
      ruleReference: "Books and records / substantiation",
    });
    riskScore += 14;
  }

  if (sources.length && !hasSourceUrls(sources)) {
    addFlag(flags, {
      id: "sources-without-urls",
      title: "Sources lack retrievable URLs",
      severity: "low",
      category: "source_quality",
      description:
        "Sources were supplied, but no retrievable URL was included.",
      recommendation:
        "Attach source URLs, document IDs, or retrievable references for books-and-records support.",
    });
    riskScore += 6;
  }

  if (averageCredibility !== null && averageCredibility < 60) {
    addFlag(flags, {
      id: "low-source-credibility",
      title: "Low source credibility",
      severity: "medium",
      category: "source_quality",
      description:
        "One or more sources appear to have a low credibility score.",
      recommendation:
        "Use higher-quality primary or authoritative sources before client delivery.",
    });
    riskScore += 12;
  }

  if (flags.some((flag) => flag.severity === "critical")) {
    addAction(requiredActions, {
      id: "compliance-review-critical",
      title: "Compliance review required",
      priority: "critical",
      owner: "compliance",
      description:
        "Critical flags must be cleared or approved by compliance before external delivery.",
    });
  }

  if (flags.some((flag) => flag.severity === "high")) {
    addAction(requiredActions, {
      id: "advisor-review-high-risk",
      title: "Advisor review required",
      priority: "high",
      owner: "advisor",
      description:
        "High-risk flags require advisor review, documented rationale, and approval before delivery.",
    });
  }

  addAction(requiredActions, {
    id: "retain-review-package",
    title: "Retain review package",
    priority: "medium",
    owner: "operations",
    description:
      "Retain the prompt, draft, sources, review result, approval status, and delivery metadata.",
  });

  const finalScore = clampScore(riskScore);
  const riskLevel = riskLevelForScore(finalScore);
  const status = statusForRisk(flags, finalScore);
  const disclosures = buildDisclosures({ flags, useCase, audience, channel });
  const retentionNotes = buildRetentionNotes({ flags, useCase, audience, channel, sources });
  const blockedReasons = flags
    .filter((flag) => flag.severity === "critical" || status === "blocked")
    .map((flag) => flag.title);

  const requiresComplianceReview =
    status === "blocked" ||
    flags.some((flag) => flag.severity === "critical" || flag.category === "marketing" || flag.category === "testimonial");

  const requiresHumanReview = status !== "pass" || isExternalAudience(audience) || isExternalChannel(channel);

  const approvedForAutoSend = status === "pass" && !requiresHumanReview;
  const approvedForSending = status === "pass" && !flags.some((flag) => flag.severity === "critical");
  const canSend = status === "pass";

  return {
    id: `compliance_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    status,
    riskLevel,
    riskScore: finalScore,
    score: finalScore,
    useCase,
    audience,
    channel,
    summary: summarize(flags, status, riskLevel),
    verdict: verdictFor(status),
    flags,
    requiredActions,
    actions: requiredActions,
    disclosures,
    requiredDisclosures: disclosures,
    retentionNotes,
    booksAndRecords: {
      retainPrompt: true,
      retainOutput: true,
      retainSources: sources.length > 0 || flags.some((flag) => flag.category === "source_quality"),
      retainApproval: requiresHumanReview,
      recommendedRetentionYears: 5,
      notes: retentionNotes,
    },
    approvedForAutoSend,
    approvedForSending,
    canSend,
    requiresHumanReview,
    requiresComplianceReview,
    blockedReasons,
    metadata: {
      ...(input.metadata ?? {}),
      sourceCount: sources.length,
      averageSourceCredibility,
      clientSpecific: input.clientSpecific === true,
      explicitRecommendation: input.includesRecommendation === true,
      explicitPerformance: input.includesPerformance === true,
      explicitTestimonial: input.includesTestimonial === true,
      explicitPrivateInvestment: input.includesPrivateInvestment === true,
      explicitPII: input.includesPII === true,
    },
  };
}

export function evaluateSiteAction(input: SiteActionInput): SiteActionReviewResult {
  const content = contentFromSiteAction(input);
  const actionTitle =
    cleanContent(input.title) ||
    cleanContent(input.label) ||
    cleanContent(input.action) ||
    cleanContent(input.cta) ||
    cleanContent(input.buttonText) ||
    "Site action";

  const review = reviewAdvisorCompliance({
    content,
    title: actionTitle,
    useCase: asComplianceUseCase(input.useCase || "site_action"),
    audience: asComplianceAudience(input.audience || "public"),
    channel: asComplianceChannel(input.channel || "website"),
    clientSpecific: input.clientSpecific === true,
    includesRecommendation: input.includesRecommendation === true,
    includesPerformance: input.includesPerformance === true,
    includesTestimonial: input.includesTestimonial === true,
    includesPrivateInvestment: input.includesPrivateInvestment === true,
    includesPII: input.includesPII === true,
    sources: Array.isArray(input.sources) ? input.sources : [],
    metadata: {
      ...(input.metadata ?? {}),
      actionId: input.id ?? null,
      href: input.href ?? null,
      url: input.url ?? null,
      path: input.path ?? null,
      requiresApproval: input.requiresApproval === true,
    },
  });

  return {
    ...review,
    actionId: input.id ?? null,
    actionTitle,
    actionHref: input.href ?? input.url ?? null,
    actionPath: input.path ?? null,
    siteAction: input,
    canPublish: review.status === "pass",
    canExecute: review.status === "pass",
    requiresApproval:
      input.requiresApproval === true ||
      review.requiresHumanReview ||
      review.requiresComplianceReview,
  };
}

export function reviewWealthManagementContent(input: ComplianceInput | string): ComplianceReviewResult {
  if (typeof input === "string") {
    return reviewAdvisorCompliance({
      content: input,
      useCase: "website_content",
      audience: "public",
      channel: "website",
    });
  }

  return reviewAdvisorCompliance({
    ...input,
    useCase: input.useCase ?? "website_content",
    audience: input.audience ?? "public",
    channel: input.channel ?? "website",
  });
}

export function runSiteComplianceAudit(input: SiteComplianceAuditInput = {}): SiteComplianceAuditResult {
  const pageReviews: ComplianceReviewResult[] = [];
  const actionReviews: SiteActionReviewResult[] = [];

  const siteName = cleanContent(input.siteName) || "Slice Advisor Platform";
  const topLevelSources = Array.isArray(input.sources) ? input.sources : [];

  if (input.content) {
    pageReviews.push(
      reviewAdvisorCompliance({
        content: input.content,
        title: siteName,
        useCase: "website_content",
        audience: "public",
        channel: "website",
        sources: topLevelSources,
        firmName: input.firmName,
        metadata: input.metadata ?? {},
      })
    );
  }

  for (const page of input.pages ?? []) {
    pageReviews.push(
      reviewAdvisorCompliance({
        content: page.content ?? "",
        title: page.title ?? page.path ?? "Website page",
        useCase: asComplianceUseCase(page.useCase || "website_content"),
        audience: asComplianceAudience(page.audience || "public"),
        channel: "website",
        sources: Array.isArray(page.sources) ? page.sources : topLevelSources,
        firmName: input.firmName,
        metadata: {
          ...(input.metadata ?? {}),
          ...(page.metadata ?? {}),
          path: page.path ?? null,
        },
      })
    );

    for (const action of page.actions ?? []) {
      actionReviews.push(
        evaluateSiteAction({
          ...action,
          path: action.path ?? page.path ?? null,
          audience: action.audience ?? page.audience ?? "public",
          sources: action.sources ?? page.sources ?? topLevelSources,
        })
      );
    }
  }

  for (const action of input.actions ?? []) {
    actionReviews.push(
      evaluateSiteAction({
        ...action,
        sources: action.sources ?? topLevelSources,
      })
    );
  }

  if (!pageReviews.length && !actionReviews.length) {
    pageReviews.push(
      reviewAdvisorCompliance({
        content:
          "Default website compliance audit initialized. Provide page content and site actions for a full review.",
        title: siteName,
        useCase: "website_content",
        audience: "public",
        channel: "website",
        metadata: input.metadata ?? {},
      })
    );
  }

  const allReviews = [...pageReviews, ...actionReviews];
  const allFlags = allReviews.flatMap((review) => review.flags);
  const allActions = allReviews.flatMap((review) => review.requiredActions);
  const allDisclosures = Array.from(new Set(allReviews.flatMap((review) => review.disclosures)));
  const allRetentionNotes = Array.from(new Set(allReviews.flatMap((review) => review.retentionNotes)));
  const maxScore = allReviews.reduce((max, review) => Math.max(max, review.riskScore), 0);
  const status: ComplianceStatus = allReviews.some((review) => review.status === "blocked")
    ? "blocked"
    : allReviews.some((review) => review.status === "needs_review")
      ? "needs_review"
      : "pass";

  const riskLevel = riskLevelForScore(maxScore);
  const requiresComplianceReview = allReviews.some((review) => review.requiresComplianceReview);
  const canPublish = status === "pass";

  return {
    id: `site_audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    siteName,
    status,
    riskLevel,
    riskScore: maxScore,
    summary:
      status === "pass"
        ? "Site audit passed with standard review and retention reminders."
        : `Site audit found ${allFlags.length} flag(s) requiring review before publication or use.`,
    pageReviews,
    actionReviews,
    flags: allFlags,
    requiredActions: Array.from(
      new Map(allActions.map((action) => [action.id, action])).values()
    ),
    disclosures: allDisclosures,
    retentionNotes: allRetentionNotes,
    canPublish,
    requiresComplianceReview,
    metadata: {
      ...(input.metadata ?? {}),
      pageCount: pageReviews.length,
      actionCount: actionReviews.length,
      flagCount: allFlags.length,
    },
  };
}

export function runAdvisorComplianceReview(input: ComplianceReviewInput) {
  return reviewAdvisorCompliance(input);
}

export function evaluateAdvisorCompliance(input: ComplianceReviewInput) {
  return reviewAdvisorCompliance(input);
}

export function reviewCompliance(input: ComplianceReviewInput) {
  return reviewAdvisorCompliance(input);
}

export function reviewAdvisorCommunication(input: ComplianceReviewInput) {
  return reviewAdvisorCompliance(input);
}

export async function reviewAdvisorComplianceAsync(input: ComplianceReviewInput) {
  return reviewAdvisorCompliance(input);
}

export const advisorComplianceEngine = {
  review: reviewAdvisorCompliance,
  run: reviewAdvisorCompliance,
  evaluate: reviewAdvisorCompliance,
  evaluateSiteAction,
  reviewWealthManagementContent,
  runSiteComplianceAudit,
};

export default reviewAdvisorCompliance;