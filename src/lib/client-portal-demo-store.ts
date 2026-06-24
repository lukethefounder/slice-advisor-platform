export type ClientPortalEventType =
  | "Meeting Request"
  | "Buy Request"
  | "Sell Request"
  | "Portfolio Preference Update"
  | "Holdings Permission"
  | "Risk Tolerance Update"
  | "Document Upload"
  | "Advisor Document Sent"
  | "Document Signed"
  | "Document Returned"
  | "Document Removed"
  | "Advisor Access Revoked"
  | "Secure Message"
  | "Platform Access"
  | "Team Assignment"
  | "Invite Created";

export type ClientPortalEventStatus =
  | "New"
  | "Advisor Review"
  | "Needs Follow-Up"
  | "Assigned"
  | "Scheduled"
  | "Waiting on Client"
  | "Waiting on Advisor"
  | "Approved for Discussion"
  | "Declined"
  | "Completed"
  | "Archived";

export type ClientPortalUrgency = "Low" | "Normal" | "High" | "Urgent";

export type ClientPortalDocument = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  note?: string;
};

export type ClientPortalSession = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  advisorId: string;
  advisorName: string;
  firmId: string;
  firmName: string;
  inviteCode: string;
  signupComplete: boolean;
  riskSurveyComplete: boolean;
  signedInAt: string;
};

export type ClientPortalRiskSurvey = {
  riskTolerance: string;
  timeHorizon: string;
  objective: string;
  liquidityNeeds: string;
  investingExperience: string;
  volatilityComfort: string;
  incomeNeed: string;
  taxSensitivity: string;
  restrictions: string;
  preferences: string;
};

export type ClientInvestmentOption = {
  id: string;
  label: string;
  category: string;
  description: string;
  risk: "Low" | "Moderate" | "High" | "Very High";
  liquidity: "Daily" | "Frequent" | "Limited" | "Illiquid";
};

export type ClientAllocationSlice = {
  id: string;
  label: string;
  category: string;
  percent: number;
};

export type AdvisorAccessStatus = "Active" | "Limited" | "Revoked";

export type ClientPortalProfile = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  phone: string;
  preferredContactMethod: string;
  advisorId: string;
  advisorName: string;
  firmId: string;
  firmName: string;
  householdName: string;
  onboardingStep: "Signup" | "Risk Survey" | "Portal Ready";
  riskSurvey: ClientPortalRiskSurvey;
  allocation: ClientAllocationSlice[];
  permissionsAcknowledged: boolean;
  advisorAccessStatus: AdvisorAccessStatus;
  advisorAccessNote: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientPortalEvent = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  advisorId: string;
  advisorName: string;
  firmId: string;
  firmName: string;
  type: ClientPortalEventType;
  title: string;
  message: string;
  urgency: ClientPortalUrgency;
  status: ClientPortalEventStatus;
  assignedToId?: string;
  assignedToName?: string;
  assignedTeam?: string;
  createdAt: string;
  updatedAt: string;
  source: "Client Portal" | "Advisor Invite" | "Advisor Portal" | "Demo Seed";
  payload: Record<string, unknown>;
  documents: ClientPortalDocument[];
};

export type ClientPortalMessage = {
  id: string;
  threadId: string;
  senderRole: "Client" | "Advisor" | "Team";
  senderName: string;
  senderEmail?: string;
  body: string;
  createdAt: string;
  readByClient: boolean;
  readByAdvisor: boolean;
  attachments: ClientPortalDocument[];
};

export type ClientPortalConversationThread = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  advisorId: string;
  advisorName: string;
  firmId: string;
  firmName: string;
  subject: string;
  category:
    | "General"
    | "Meeting"
    | "Portfolio"
    | "Documents"
    | "Risk"
    | "Trade Discussion"
    | "Service";
  status: "Open" | "Waiting on Client" | "Waiting on Advisor" | "Closed" | "Archived";
  priority: ClientPortalUrgency;
  assignedToId?: string;
  assignedToName?: string;
  assignedTeam?: string;
  createdAt: string;
  updatedAt: string;
  messages: ClientPortalMessage[];
};

export type ClientPortalDocumentPacket = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  advisorId: string;
  advisorName: string;
  firmId: string;
  firmName: string;
  title: string;
  description: string;
  documentType:
    | "IPS"
    | "Risk Disclosure"
    | "Advisory Agreement"
    | "Investment Policy"
    | "Transfer Form"
    | "Performance Report"
    | "Planning Document"
    | "Other";
  status:
    | "Sent"
    | "Viewed"
    | "Signed"
    | "Returned"
    | "Removed By Client"
    | "Advisor Access Revoked"
    | "Archived";
  requiresSignature: boolean;
  signatureName?: string;
  signatureDate?: string;
  clientRemovedAt?: string;
  advisorAccessRevokedAt?: string;
  assignedToId?: string;
  assignedToName?: string;
  assignedTeam?: string;
  createdAt: string;
  updatedAt: string;
  files: ClientPortalDocument[];
  history: Array<{
    id: string;
    action: string;
    actor: string;
    createdAt: string;
    note?: string;
  }>;
};

export type ClientPortalTeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Lead Advisor" | "Associate Advisor" | "Client Service" | "Portfolio Analyst" | "Compliance";
  team: string;
  color: string;
  active: boolean;
};

export type ClientPortalInvite = {
  id: string;
  firmId: string;
  firmName: string;
  advisorId: string;
  advisorName: string;
  assignedToId: string;
  assignedToName: string;
  clientEmail: string;
  clientName: string;
  inviteCode: string;
  status: "Draft" | "Sent" | "Accepted" | "Expired" | "Revoked";
  createdAt: string;
  acceptedAt?: string;
  note: string;
};

export const CLIENT_PORTAL_EVENTS_KEY = "slice-client-portal-events-v3";
export const CLIENT_PORTAL_SESSION_KEY = "slice-client-portal-session-v3";
export const CLIENT_PORTAL_PROFILE_KEY = "slice-client-portal-profile-v3";
export const CLIENT_PORTAL_THREADS_KEY = "slice-client-portal-threads-v3";
export const CLIENT_PORTAL_DOCUMENT_PACKETS_KEY = "slice-client-portal-document-packets-v3";
export const CLIENT_PORTAL_TEAM_KEY = "slice-client-portal-team-v3";
export const CLIENT_PORTAL_INVITES_KEY = "slice-client-portal-invites-v3";

export const CLIENT_PORTAL_INVITE_CODE = "SLICE-DEMO-CLIENT";
export const DEFAULT_FIRM_ID = "firm-royal-advisory";
export const DEFAULT_FIRM_NAME = "Royal Advisory Group";

export const DEMO_CLIENT_SESSION: ClientPortalSession = {
  clientId: "demo-client-claire-morgan",
  clientName: "Claire Morgan",
  clientEmail: "claire@demo-client.com",
  advisorId: "advisor-ava-royal",
  advisorName: "Ava Royal, CFP®",
  firmId: DEFAULT_FIRM_ID,
  firmName: DEFAULT_FIRM_NAME,
  inviteCode: CLIENT_PORTAL_INVITE_CODE,
  signupComplete: true,
  riskSurveyComplete: false,
  signedInAt: new Date().toISOString(),
};

export const DEFAULT_RISK_SURVEY: ClientPortalRiskSurvey = {
  riskTolerance: "Moderate",
  timeHorizon: "5-10 years",
  objective: "Growth with risk controls",
  liquidityNeeds: "Moderate liquidity needs",
  investingExperience: "Intermediate",
  volatilityComfort: "I can tolerate normal market volatility if I understand the reason.",
  incomeNeed: "Some income is helpful, but growth is still important.",
  taxSensitivity: "Medium",
  restrictions: "No margin. Avoid excessive concentration.",
  preferences: "Prefer ETF-first explanations with plain-English reasoning.",
};

export const RISK_SURVEY_OPTIONS: Record<keyof ClientPortalRiskSurvey, string[]> = {
  riskTolerance: ["Very Conservative", "Conservative", "Moderate", "Growth", "Aggressive"],
  timeHorizon: ["0-2 years", "3-5 years", "5-10 years", "10+ years", "Multi-generational"],
  objective: [
    "Capital preservation",
    "Income",
    "Growth with risk controls",
    "Aggressive growth",
    "Tax-aware wealth transfer",
    "Retirement income planning",
  ],
  liquidityNeeds: [
    "Very high liquidity needs",
    "Moderate liquidity needs",
    "Low liquidity needs",
    "Emergency reserve already covered",
    "Unknown / discuss with advisor",
  ],
  investingExperience: ["Beginner", "Intermediate", "Advanced", "Professional / institutional"],
  volatilityComfort: [
    "I am uncomfortable with losses greater than 5%.",
    "I can tolerate 5-10% temporary declines.",
    "I can tolerate normal market volatility if I understand the reason.",
    "I can tolerate significant volatility for long-term growth.",
    "I prefer the advisor to explain volatility before making changes.",
  ],
  incomeNeed: [
    "No income needed",
    "Some income is helpful, but growth is still important.",
    "Regular income is important.",
    "Income is the primary objective.",
    "Need to discuss income needs with advisor.",
  ],
  taxSensitivity: ["Low", "Medium", "High", "Very high", "Unknown / discuss with advisor"],
  restrictions: [
    "No restrictions",
    "No margin. Avoid excessive concentration.",
    "Avoid speculative investments.",
    "Avoid illiquid investments.",
    "Avoid concentrated single-stock exposure.",
    "ESG / values-based preferences apply.",
    "Need to discuss restrictions with advisor.",
  ],
  preferences: [
    "Prefer ETF-first explanations with plain-English reasoning.",
    "Prefer individual stock discussions.",
    "Prefer conservative allocation changes.",
    "Prefer tax-aware recommendations.",
    "Prefer income-focused recommendations.",
    "Prefer simple explanations and fewer changes.",
    "Need advisor guidance before deciding preferences.",
  ],
};

export const INVESTMENT_OPTIONS: ClientInvestmentOption[] = [
  {
    id: "us-large-cap",
    label: "U.S. Large Cap Stocks",
    category: "Equity",
    description: "Large, established U.S. public companies.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "us-mid-cap",
    label: "U.S. Mid Cap Stocks",
    category: "Equity",
    description: "Medium-sized U.S. public companies.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "us-small-cap",
    label: "U.S. Small Cap Stocks",
    category: "Equity",
    description: "Smaller U.S. public companies with higher variability.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "international-developed",
    label: "International Developed Stocks",
    category: "Equity",
    description: "Developed-market international equity exposure.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "emerging-markets",
    label: "Emerging Market Stocks",
    category: "Equity",
    description: "Higher-growth, higher-volatility international exposure.",
    risk: "Very High",
    liquidity: "Daily",
  },
  {
    id: "sector-technology",
    label: "Technology Sector",
    category: "Sector",
    description: "Technology-focused equity exposure.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "sector-healthcare",
    label: "Healthcare Sector",
    category: "Sector",
    description: "Healthcare and life sciences exposure.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "sector-energy",
    label: "Energy Sector",
    category: "Sector",
    description: "Energy, oil, gas, and related infrastructure exposure.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "investment-grade-bonds",
    label: "Investment Grade Bonds",
    category: "Fixed Income",
    description: "Higher-quality bond exposure.",
    risk: "Low",
    liquidity: "Daily",
  },
  {
    id: "treasuries",
    label: "U.S. Treasuries",
    category: "Fixed Income",
    description: "U.S. government bond exposure.",
    risk: "Low",
    liquidity: "Daily",
  },
  {
    id: "municipal-bonds",
    label: "Municipal Bonds",
    category: "Fixed Income",
    description: "Tax-sensitive municipal bond exposure.",
    risk: "Low",
    liquidity: "Frequent",
  },
  {
    id: "high-yield-bonds",
    label: "High Yield Bonds",
    category: "Fixed Income",
    description: "Higher income bond exposure with more credit risk.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "cash",
    label: "Cash / Money Market",
    category: "Cash",
    description: "Cash reserves and short-term liquidity.",
    risk: "Low",
    liquidity: "Daily",
  },
  {
    id: "real-estate",
    label: "Real Estate / REITs",
    category: "Real Assets",
    description: "Public real estate and REIT exposure.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "commodities",
    label: "Commodities",
    category: "Real Assets",
    description: "Commodity-linked exposure.",
    risk: "High",
    liquidity: "Daily",
  },
  {
    id: "gold",
    label: "Gold / Precious Metals",
    category: "Real Assets",
    description: "Gold and precious metals exposure.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "private-equity",
    label: "Private Equity",
    category: "Alternatives",
    description: "Private company investment exposure.",
    risk: "Very High",
    liquidity: "Illiquid",
  },
  {
    id: "private-credit",
    label: "Private Credit",
    category: "Alternatives",
    description: "Private lending and credit exposure.",
    risk: "High",
    liquidity: "Illiquid",
  },
  {
    id: "hedge-funds",
    label: "Hedge Fund Strategies",
    category: "Alternatives",
    description: "Alternative strategy exposure.",
    risk: "High",
    liquidity: "Limited",
  },
  {
    id: "buffered-etfs",
    label: "Buffered / Defined Outcome ETFs",
    category: "Structured",
    description: "Outcome-oriented ETF structures.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "covered-call-etfs",
    label: "Covered Call ETFs",
    category: "Income",
    description: "Income-oriented options-based ETF exposure.",
    risk: "Moderate",
    liquidity: "Daily",
  },
  {
    id: "crypto",
    label: "Crypto / Digital Assets",
    category: "Speculative",
    description: "Digital asset exposure.",
    risk: "Very High",
    liquidity: "Daily",
  },
];

export const DEFAULT_CLIENT_ALLOCATION: ClientAllocationSlice[] = [
  {
    id: "us-large-cap",
    label: "U.S. Large Cap Stocks",
    category: "Equity",
    percent: 35,
  },
  {
    id: "international-developed",
    label: "International Developed Stocks",
    category: "Equity",
    percent: 10,
  },
  {
    id: "investment-grade-bonds",
    label: "Investment Grade Bonds",
    category: "Fixed Income",
    percent: 25,
  },
  {
    id: "treasuries",
    label: "U.S. Treasuries",
    category: "Fixed Income",
    percent: 10,
  },
  {
    id: "real-estate",
    label: "Real Estate / REITs",
    category: "Real Assets",
    percent: 5,
  },
  {
    id: "cash",
    label: "Cash / Money Market",
    category: "Cash",
    percent: 15,
  },
];

export const DEFAULT_CLIENT_PROFILE: ClientPortalProfile = {
  clientId: DEMO_CLIENT_SESSION.clientId,
  clientName: DEMO_CLIENT_SESSION.clientName,
  clientEmail: DEMO_CLIENT_SESSION.clientEmail,
  phone: "(555) 010-2026",
  preferredContactMethod: "Portal + email",
  advisorId: DEMO_CLIENT_SESSION.advisorId,
  advisorName: DEMO_CLIENT_SESSION.advisorName,
  firmId: DEMO_CLIENT_SESSION.firmId,
  firmName: DEMO_CLIENT_SESSION.firmName,
  householdName: "Morgan Household",
  onboardingStep: "Risk Survey",
  riskSurvey: DEFAULT_RISK_SURVEY,
  allocation: DEFAULT_CLIENT_ALLOCATION,
  permissionsAcknowledged: true,
  advisorAccessStatus: "Active",
  advisorAccessNote: "Advisor has portal access to client-submitted items.",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_TEAM_MEMBERS: ClientPortalTeamMember[] = [
  {
    id: "advisor-ava-royal",
    name: "Ava Royal",
    email: "ava@royaladvisory.com",
    role: "Lead Advisor",
    team: "Planning",
    color: "red",
    active: true,
  },
  {
    id: "team-mia-service",
    name: "Mia Chen",
    email: "mia@royaladvisory.com",
    role: "Client Service",
    team: "Service",
    color: "cyan",
    active: true,
  },
  {
    id: "team-noah-portfolio",
    name: "Noah Brooks",
    email: "noah@royaladvisory.com",
    role: "Portfolio Analyst",
    team: "Portfolio",
    color: "green",
    active: true,
  },
  {
    id: "team-sofia-compliance",
    name: "Sofia Patel",
    email: "sofia@royaladvisory.com",
    role: "Compliance",
    team: "Compliance",
    color: "amber",
    active: true,
  },
];

export function makeClientPortalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeFirmInviteCode(firmName = DEFAULT_FIRM_NAME, clientEmail = "") {
  const firm = firmName.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() || "SLICE";
  const emailSeed = clientEmail.split("@")[0]?.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "CLNT";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `${firm}-${emailSeed}-${suffix}`;
}

export function formatPortalDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDocumentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function allocationTotal(allocation: ClientAllocationSlice[]) {
  return allocation.reduce((sum, item) => sum + Number(item.percent || 0), 0);
}

export function allocationByCategory(allocation: ClientAllocationSlice[]) {
  const grouped = allocation.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + Number(item.percent || 0);
    return acc;
  }, {});

  return Object.entries(grouped).map(([category, percent]) => ({
    category,
    percent,
  }));
}

export function normalizeAllocation(allocation: ClientAllocationSlice[]) {
  const total = allocationTotal(allocation);

  if (!total) return allocation;

  return allocation.map((item) => ({
    ...item,
    percent: Number(((Number(item.percent || 0) / total) * 100).toFixed(1)),
  }));
}

export function createPortalEvent(
  input: Omit<
    Partial<ClientPortalEvent>,
    "id" | "createdAt" | "updatedAt" | "status"
  > & {
    type: ClientPortalEventType;
    title: string;
    message: string;
  },
): ClientPortalEvent {
  const now = new Date().toISOString();

  return {
    id: makeClientPortalId("client_portal_event"),
    clientId: input.clientId ?? DEMO_CLIENT_SESSION.clientId,
    clientName: input.clientName ?? DEMO_CLIENT_SESSION.clientName,
    clientEmail: input.clientEmail ?? DEMO_CLIENT_SESSION.clientEmail,
    advisorId: input.advisorId ?? DEMO_CLIENT_SESSION.advisorId,
    advisorName: input.advisorName ?? DEMO_CLIENT_SESSION.advisorName,
    firmId: input.firmId ?? DEMO_CLIENT_SESSION.firmId,
    firmName: input.firmName ?? DEMO_CLIENT_SESSION.firmName,
    type: input.type,
    title: input.title,
    message: input.message,
    urgency: input.urgency ?? "Normal",
    status: "New",
    assignedToId: input.assignedToId,
    assignedToName: input.assignedToName,
    assignedTeam: input.assignedTeam,
    createdAt: now,
    updatedAt: now,
    source: input.source ?? "Client Portal",
    payload: input.payload ?? {},
    documents: input.documents ?? [],
  };
}

export function seedClientPortalEvents(): ClientPortalEvent[] {
  return [
    createPortalEvent({
      type: "Platform Access",
      title: "Client portal invite accepted",
      message:
        "Client accepted the advisor invite and entered the hands-on client workflow.",
      urgency: "Normal",
      source: "Demo Seed",
      payload: {
        inviteCode: CLIENT_PORTAL_INVITE_CODE,
        advisorConnected: true,
      },
    }),
    createPortalEvent({
      type: "Risk Tolerance Update",
      title: "Initial risk profile ready for review",
      message:
        "Client indicated moderate growth orientation, medium volatility tolerance, and preference for advisor-reviewed recommendations.",
      urgency: "Normal",
      source: "Demo Seed",
      payload: DEFAULT_RISK_SURVEY,
    }),
    createPortalEvent({
      type: "Portfolio Preference Update",
      title: "Client created preferred allocation pie chart",
      message:
        "Client submitted a desired investment-type allocation for advisor discussion.",
      urgency: "High",
      source: "Demo Seed",
      payload: {
        allocation: DEFAULT_CLIENT_ALLOCATION,
        total: allocationTotal(DEFAULT_CLIENT_ALLOCATION),
        reviewOnly:
          "Client preference only. Advisor must review before recommendation or implementation.",
      },
    }),
  ].map((event, index) => ({
    ...event,
    id: `seed_client_portal_${index + 1}`,
  }));
}

export function createMessage(
  threadId: string,
  input: Omit<Partial<ClientPortalMessage>, "id" | "threadId" | "createdAt"> & {
    senderRole: ClientPortalMessage["senderRole"];
    senderName: string;
    body: string;
  },
): ClientPortalMessage {
  return {
    id: makeClientPortalId("portal_message"),
    threadId,
    senderRole: input.senderRole,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    body: input.body,
    createdAt: new Date().toISOString(),
    readByClient: input.readByClient ?? input.senderRole === "Client",
    readByAdvisor: input.readByAdvisor ?? input.senderRole !== "Client",
    attachments: input.attachments ?? [],
  };
}

export function createThread(
  input: Omit<Partial<ClientPortalConversationThread>, "id" | "createdAt" | "updatedAt" | "messages"> & {
    subject: string;
    firstMessage: string;
    senderRole: ClientPortalMessage["senderRole"];
    senderName: string;
  },
): ClientPortalConversationThread {
  const now = new Date().toISOString();
  const threadId = makeClientPortalId("portal_thread");

  return {
    id: threadId,
    clientId: input.clientId ?? DEMO_CLIENT_SESSION.clientId,
    clientName: input.clientName ?? DEMO_CLIENT_SESSION.clientName,
    clientEmail: input.clientEmail ?? DEMO_CLIENT_SESSION.clientEmail,
    advisorId: input.advisorId ?? DEMO_CLIENT_SESSION.advisorId,
    advisorName: input.advisorName ?? DEMO_CLIENT_SESSION.advisorName,
    firmId: input.firmId ?? DEMO_CLIENT_SESSION.firmId,
    firmName: input.firmName ?? DEMO_CLIENT_SESSION.firmName,
    subject: input.subject,
    category: input.category ?? "General",
    status: input.status ?? "Open",
    priority: input.priority ?? "Normal",
    assignedToId: input.assignedToId,
    assignedToName: input.assignedToName,
    assignedTeam: input.assignedTeam,
    createdAt: now,
    updatedAt: now,
    messages: [
      createMessage(threadId, {
        senderRole: input.senderRole,
        senderName: input.senderName,
        senderEmail: input.clientEmail,
        body: input.firstMessage,
      }),
    ],
  };
}

export function seedClientPortalThreads(): ClientPortalConversationThread[] {
  return [
    createThread({
      subject: "Question about adding more broad market exposure",
      firstMessage:
        "I would like to understand whether adding more broad market ETF exposure makes sense for me. I am not asking you to trade yet — I want to discuss it.",
      senderRole: "Client",
      senderName: DEMO_CLIENT_SESSION.clientName,
      category: "Portfolio",
      priority: "High",
      assignedToId: "team-noah-portfolio",
      assignedToName: "Noah Brooks",
      assignedTeam: "Portfolio",
    }),
    createThread({
      subject: "Please review my updated risk tolerance",
      firstMessage:
        "I updated my risk profile and want to make sure my current allocation still matches my comfort level.",
      senderRole: "Client",
      senderName: DEMO_CLIENT_SESSION.clientName,
      category: "Risk",
      priority: "Normal",
      assignedToId: "advisor-ava-royal",
      assignedToName: "Ava Royal",
      assignedTeam: "Planning",
    }),
  ];
}

export function createDocumentPacket(
  input: Omit<Partial<ClientPortalDocumentPacket>, "id" | "createdAt" | "updatedAt" | "history"> & {
    title: string;
    description: string;
  },
): ClientPortalDocumentPacket {
  const now = new Date().toISOString();

  return {
    id: makeClientPortalId("portal_document_packet"),
    clientId: input.clientId ?? DEMO_CLIENT_SESSION.clientId,
    clientName: input.clientName ?? DEMO_CLIENT_SESSION.clientName,
    clientEmail: input.clientEmail ?? DEMO_CLIENT_SESSION.clientEmail,
    advisorId: input.advisorId ?? DEMO_CLIENT_SESSION.advisorId,
    advisorName: input.advisorName ?? DEMO_CLIENT_SESSION.advisorName,
    firmId: input.firmId ?? DEMO_CLIENT_SESSION.firmId,
    firmName: input.firmName ?? DEMO_CLIENT_SESSION.firmName,
    title: input.title,
    description: input.description,
    documentType: input.documentType ?? "Other",
    status: input.status ?? "Sent",
    requiresSignature: input.requiresSignature ?? true,
    signatureName: input.signatureName,
    signatureDate: input.signatureDate,
    assignedToId: input.assignedToId,
    assignedToName: input.assignedToName,
    assignedTeam: input.assignedTeam,
    createdAt: now,
    updatedAt: now,
    files: input.files ?? [],
    history: [
      {
        id: makeClientPortalId("document_history"),
        action: "Document packet created",
        actor: input.advisorName ?? DEMO_CLIENT_SESSION.advisorName,
        createdAt: now,
        note: "Demo packet created locally.",
      },
    ],
  };
}

export function seedClientPortalDocumentPackets(): ClientPortalDocumentPacket[] {
  return [
    createDocumentPacket({
      title: "Updated Investment Policy Statement",
      description:
        "Please review and sign the updated IPS acknowledgement before our next review meeting.",
      documentType: "Investment Policy",
      requiresSignature: true,
      status: "Sent",
      assignedToId: "advisor-ava-royal",
      assignedToName: "Ava Royal",
      assignedTeam: "Planning",
      files: [
        {
          id: "seed-doc-ips",
          name: "Morgan_IPS_Update.pdf",
          size: 420000,
          type: "application/pdf",
          uploadedAt: new Date().toISOString(),
        },
      ],
    }),
    createDocumentPacket({
      title: "Risk Disclosure Acknowledgement",
      description:
        "Please review the disclosure acknowledgement related to concentrated equity and alternative investment discussions.",
      documentType: "Risk Disclosure",
      requiresSignature: true,
      status: "Viewed",
      assignedToId: "team-sofia-compliance",
      assignedToName: "Sofia Patel",
      assignedTeam: "Compliance",
      files: [
        {
          id: "seed-doc-risk",
          name: "Risk_Disclosure_Acknowledgement.pdf",
          size: 310000,
          type: "application/pdf",
          uploadedAt: new Date().toISOString(),
        },
      ],
    }),
  ];
}

export function loadJson<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadClientPortalEvents() {
  return loadJson<ClientPortalEvent[]>(CLIENT_PORTAL_EVENTS_KEY, seedClientPortalEvents());
}

export function saveClientPortalEvents(events: ClientPortalEvent[]) {
  saveJson(CLIENT_PORTAL_EVENTS_KEY, events);
}

export function addClientPortalEvent(event: ClientPortalEvent) {
  const events = loadClientPortalEvents();
  const next = [event, ...events];
  saveClientPortalEvents(next);
  return next;
}

export function updateClientPortalEventStatus(
  eventId: string,
  status: ClientPortalEventStatus,
) {
  const events = loadClientPortalEvents();
  const next = events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          status,
          updatedAt: new Date().toISOString(),
        }
      : event,
  );

  saveClientPortalEvents(next);
  return next;
}

export function assignClientPortalEvent(
  eventId: string,
  member: ClientPortalTeamMember,
) {
  const events = loadClientPortalEvents();
  const next = events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          assignedToId: member.id,
          assignedToName: member.name,
          assignedTeam: member.team,
          status: "Assigned" as ClientPortalEventStatus,
          updatedAt: new Date().toISOString(),
        }
      : event,
  );

  saveClientPortalEvents(next);
  return next;
}

export function loadClientPortalSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CLIENT_PORTAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientPortalSession;
  } catch {
    return null;
  }
}

export function saveClientPortalSession(session: ClientPortalSession) {
  saveJson(CLIENT_PORTAL_SESSION_KEY, session);
}

export function clearClientPortalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLIENT_PORTAL_SESSION_KEY);
}

export function loadClientPortalProfile() {
  return loadJson<ClientPortalProfile>(CLIENT_PORTAL_PROFILE_KEY, DEFAULT_CLIENT_PROFILE);
}

export function saveClientPortalProfile(profile: ClientPortalProfile) {
  saveJson(CLIENT_PORTAL_PROFILE_KEY, {
    ...profile,
    updatedAt: new Date().toISOString(),
  });
}

export function loadClientPortalThreads() {
  return loadJson<ClientPortalConversationThread[]>(
    CLIENT_PORTAL_THREADS_KEY,
    seedClientPortalThreads(),
  );
}

export function saveClientPortalThreads(threads: ClientPortalConversationThread[]) {
  saveJson(CLIENT_PORTAL_THREADS_KEY, threads);
}

export function addClientPortalThread(thread: ClientPortalConversationThread) {
  const threads = loadClientPortalThreads();
  const next = [thread, ...threads];
  saveClientPortalThreads(next);
  return next;
}

export function addClientPortalMessage(threadId: string, message: ClientPortalMessage) {
  const threads = loadClientPortalThreads();
  const next = threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          messages: [...thread.messages, message],
          updatedAt: new Date().toISOString(),
          status:
            message.senderRole === "Client"
              ? ("Waiting on Advisor" as const)
              : ("Waiting on Client" as const),
        }
      : thread,
  );

  saveClientPortalThreads(next);
  return next;
}

export function assignClientPortalThread(
  threadId: string,
  member: ClientPortalTeamMember,
) {
  const threads = loadClientPortalThreads();
  const next = threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          assignedToId: member.id,
          assignedToName: member.name,
          assignedTeam: member.team,
          updatedAt: new Date().toISOString(),
        }
      : thread,
  );

  saveClientPortalThreads(next);
  return next;
}

export function closeClientPortalThread(threadId: string) {
  const threads = loadClientPortalThreads();
  const next = threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          status: "Closed" as const,
          updatedAt: new Date().toISOString(),
        }
      : thread,
  );

  saveClientPortalThreads(next);
  return next;
}

export function loadClientPortalDocumentPackets() {
  return loadJson<ClientPortalDocumentPacket[]>(
    CLIENT_PORTAL_DOCUMENT_PACKETS_KEY,
    seedClientPortalDocumentPackets(),
  );
}

export function saveClientPortalDocumentPackets(packets: ClientPortalDocumentPacket[]) {
  saveJson(CLIENT_PORTAL_DOCUMENT_PACKETS_KEY, packets);
}

export function addClientPortalDocumentPacket(packet: ClientPortalDocumentPacket) {
  const packets = loadClientPortalDocumentPackets();
  const next = [packet, ...packets];
  saveClientPortalDocumentPackets(next);
  return next;
}

export function updateClientPortalDocumentPacket(packet: ClientPortalDocumentPacket) {
  const packets = loadClientPortalDocumentPackets();
  const next = packets.map((item) => (item.id === packet.id ? packet : item));
  saveClientPortalDocumentPackets(next);
  return next;
}

export function signClientPortalDocumentPacket(
  packetId: string,
  signatureName: string,
  actor = DEMO_CLIENT_SESSION.clientName,
) {
  const packets = loadClientPortalDocumentPackets();
  const now = new Date().toISOString();

  const next = packets.map((packet) =>
    packet.id === packetId
      ? {
          ...packet,
          status: "Returned" as const,
          signatureName,
          signatureDate: now,
          updatedAt: now,
          history: [
            ...packet.history,
            {
              id: makeClientPortalId("document_history"),
              action: "Signed and returned",
              actor,
              createdAt: now,
              note: "Demo signature captured locally.",
            },
          ],
        }
      : packet,
  );

  saveClientPortalDocumentPackets(next);
  return next;
}

export function removeClientPortalDocumentPacket(
  packetId: string,
  actor = DEMO_CLIENT_SESSION.clientName,
) {
  const packets = loadClientPortalDocumentPackets();
  const now = new Date().toISOString();

  const next = packets.map((packet) =>
    packet.id === packetId
      ? {
          ...packet,
          status: "Removed By Client" as const,
          clientRemovedAt: now,
          updatedAt: now,
          history: [
            ...packet.history,
            {
              id: makeClientPortalId("document_history"),
              action: "Removed by client",
              actor,
              createdAt: now,
            },
          ],
        }
      : packet,
  );

  saveClientPortalDocumentPackets(next);
  return next;
}

export function revokeAdvisorDocumentAccess(
  packetId: string,
  actor = DEMO_CLIENT_SESSION.clientName,
) {
  const packets = loadClientPortalDocumentPackets();
  const now = new Date().toISOString();

  const next = packets.map((packet) =>
    packet.id === packetId
      ? {
          ...packet,
          status: "Advisor Access Revoked" as const,
          advisorAccessRevokedAt: now,
          updatedAt: now,
          history: [
            ...packet.history,
            {
              id: makeClientPortalId("document_history"),
              action: "Advisor access revoked",
              actor,
              createdAt: now,
            },
          ],
        }
      : packet,
  );

  saveClientPortalDocumentPackets(next);
  return next;
}

export function loadClientPortalTeam() {
  return loadJson<ClientPortalTeamMember[]>(CLIENT_PORTAL_TEAM_KEY, DEFAULT_TEAM_MEMBERS);
}

export function saveClientPortalTeam(team: ClientPortalTeamMember[]) {
  saveJson(CLIENT_PORTAL_TEAM_KEY, team);
}

export function loadClientPortalInvites() {
  return loadJson<ClientPortalInvite[]>(CLIENT_PORTAL_INVITES_KEY, [
    {
      id: "seed-invite-claire",
      firmId: DEFAULT_FIRM_ID,
      firmName: DEFAULT_FIRM_NAME,
      advisorId: DEMO_CLIENT_SESSION.advisorId,
      advisorName: DEMO_CLIENT_SESSION.advisorName,
      assignedToId: "advisor-ava-royal",
      assignedToName: "Ava Royal",
      clientEmail: DEMO_CLIENT_SESSION.clientEmail,
      clientName: DEMO_CLIENT_SESSION.clientName,
      inviteCode: CLIENT_PORTAL_INVITE_CODE,
      status: "Accepted",
      createdAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
      note: "Demo invite accepted.",
    },
  ]);
}

export function saveClientPortalInvites(invites: ClientPortalInvite[]) {
  saveJson(CLIENT_PORTAL_INVITES_KEY, invites);
}

export function addClientPortalInvite(invite: ClientPortalInvite) {
  const invites = loadClientPortalInvites();
  const next = [invite, ...invites];
  saveClientPortalInvites(next);
  return next;
}