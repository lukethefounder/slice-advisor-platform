export const EMAIL_DRAFT_STATUSES = [
  "Draft",
  "Generating",
  "Generation Failed",
  "Edited",
  "Needs Advisor Approval",
  "Approved",
  "Scheduled",
  "Queued",
  "Sending",
  "Sent",
  "Simulated",
  "Delivery Failed",
  "Cancelled",
  "Archived",
] as const;

export type EmailDraftStatus = (typeof EMAIL_DRAFT_STATUSES)[number];

export const EMAIL_DELIVERY_STATUSES = [
  "Scheduled",
  "Email Queued",
  "Processing",
  "Sent",
  "Simulated",
  "Failed",
  "Cancelled",
] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export const EMAIL_GENERATION_SPEEDS = ["Quick", "Researched"] as const;

export type EmailGenerationSpeed = (typeof EMAIL_GENERATION_SPEEDS)[number];

export type EmailCenterUser = {
  id: string;
  name: string;
  email: string;
};

export type EmailResearchSource = {
  title: string;
  url: string;
  type?: string;
};

export type EmailPromptPlan = {
  schemaVersion: 1;
  originalPrompt: string;
  promptSummary: string;
  messageType:
    | "Market Update"
    | "Portfolio Review"
    | "Planning Update"
    | "Meeting Follow-up"
    | "Scheduling"
    | "Document Request"
    | "General Update";
  subjectFocus: string;
  communicationGoal: string;
  tone: string;
  desiredLength: "Concise" | "Standard" | "Detailed";
  urgency: "Routine" | "Elevated" | "Time Sensitive";
  callToAction: string;
  requiredPoints: string[];
  prohibitedPoints: string[];
  publicResearchTopics: string[];
  symbols: string[];
  currentFactsRequired: boolean;
  subjectCandidates: string[];
  keyFacts?: string[];
  supportingDetails?: string[];
  informationArchitecture?: string[];
  missingInformation?: string[];
  audienceOutcome?: string;
};

export type EmailBrandingPreference = {
  schemaVersion: 1;
  showSliceBrand: boolean;
  firmName: string;
  firmLogoUrl: string | null;
  accentColor: string;
  signature: {
    signOff: string;
    name: string;
    title: string;
    company: string;
    phone: string;
    email: string;
    website: string;
  };
  disclosure: string;
  updatedAt: string;
};

export type StoredEmailDraftVersion = {
  id: string;
  version: number;
  label: string;
  origin: "Manual" | "AI" | "Checkpoint" | "Imported" | "Polished";
  subjectEncrypted: string;
  bodyEncrypted: string;
  tone: string;
  contentHash: string;
  strategy?: string | null;
  researchSummary?: string | null;
  sources?: EmailResearchSource[];
  complianceNotes?: string[];
  branding: EmailBrandingPreference;
  createdByUserId: string;
  createdAt: string;
};

export type EmailDraftGenerationState = {
  jobId: string | null;
  status:
    | "None"
    | "Queued"
    | "Processing"
    | "Completed"
    | "Completed With Fallback"
    | "Failed";
  mode: "Generate" | "Polish";
  speedMode: EmailGenerationSpeed;
  starterReady: boolean;
  requestHash: string | null;
  optionCount: number;
  promptSummary: string | null;
  promptIntent?: EmailPromptPlan["messageType"] | null;
  subjectStrategy?: string | null;
  qualityScore?: number | null;
  provider: string | null;
  model: string | null;
  researchUsed: boolean;
  sources: EmailResearchSource[];
  error: string | null;
  requestedAt: string | null;
  completedAt: string | null;
};

export type EmailDraftApprovalState = {
  approvalId: string | null;
  status: "None" | "Pending" | "Approved" | "Rejected" | "Superseded";
  revision: number | null;
  contentHash: string | null;
  recipientEmailHash: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  notes: string | null;
};

export type EmailDraftDeliveryState = {
  deliveryId: string | null;
  jobId: string | null;
  status: EmailDeliveryStatus | "None";
  scheduledAt: string | null;
  sentAt: string | null;
  provider: string | null;
  providerId: string | null;
  failureReason: string | null;
};

export type EmailDraftRecipientState = {
  clientId: string | null;
  clientName: string | null;
  emailEncrypted: string | null;
  emailHash: string | null;
};

export type EmailDraftMetadata = {
  schemaVersion: 2;
  origin: "Manual" | "AI" | "Imported";
  revision: number;
  contentHash: string;
  selectedVersionId: string | null;
  humanEditCount: number;
  lastHumanEditAt: string | null;
  recipient: EmailDraftRecipientState;
  branding: EmailBrandingPreference;
  versions: StoredEmailDraftVersion[];
  generation: EmailDraftGenerationState;
  approval: EmailDraftApprovalState;
  delivery: EmailDraftDeliveryState;
  archivedFromStatus: EmailDraftStatus | null;
};

export type EmailDraftVersion = {
  id: string;
  version: number;
  label: string;
  origin: StoredEmailDraftVersion["origin"];
  subject: string;
  body: string;
  tone: string;
  contentHash: string;
  strategy: string | null;
  researchSummary: string | null;
  sources: EmailResearchSource[];
  complianceNotes: string[];
  branding: EmailBrandingPreference;
  createdByUserId: string;
  createdAt: string;
};

export const EMAIL_PORTFOLIO_BANDS = [
  "Unknown",
  "Under $250K",
  "$250K–$1M",
  "$1M–$5M",
  "$5M+",
] as const;

export type EmailPortfolioBand = (typeof EMAIL_PORTFOLIO_BANDS)[number];

export type EmailClientHoldingOption = {
  symbol: string;
  assetName: string;
  assetClass: string;
  valueNumber: number | null;
  allocationPctNumber: number | null;
  riskLevel: string;
};

export type EmailClientOption = {
  id: string;
  fullName: string;
  householdName: string | null;
  email: string | null;
  emailMissing: boolean;
  clientType: string;
  riskProfile: string;
  status: string;
  assignedAdvisorMembershipId: string | null;
  portfolioValueNumber: number | null;
  portfolioValueLabel: string;
  portfolioBand: EmailPortfolioBand;
  holdingSymbols: string[];
  holdings: EmailClientHoldingOption[];
};

export type EmailDraftSummary = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  clientId: string | null;
  clientName: string | null;
  recipientEmail: string | null;
  recipientMissing: boolean;
  subject: string;
  bodyPreview: string;
  status: EmailDraftStatus;
  tone: string;
  origin: EmailDraftMetadata["origin"];
  revision: number;
  versionCount: number;
  approval: EmailDraftApprovalState;
  delivery: EmailDraftDeliveryState;
  generation: EmailDraftGenerationState;
  deletable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailDraftDetail = EmailDraftSummary & {
  body: string;
  contentHash: string;
  selectedVersionId: string | null;
  humanEditCount: number;
  lastHumanEditAt: string | null;
  versions: EmailDraftVersion[];
  complianceNotes: string[];
  branding: EmailBrandingPreference;
  editable: boolean;
};

export type EmailApprovalDraftSnapshot = {
  draftId: string;
  ownerUserId: string;
  clientId: string | null;
  clientName: string | null;
  recipientEmailMasked: string | null;
  recipientEmailHash: string;
  revision: number;
  contentHash: string;
};

export type EmailApprovalPayload = {
  schemaVersion: 2;
  drafts: EmailApprovalDraftSnapshot[];
  requestedAt: string;
};

export type EmailApprovalView = {
  id: string;
  ownerUserId: string;
  title: string;
  summary: string;
  status: string;
  riskLevel: string;
  requestedBy: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  draftIds: string[];
  recipientCount: number;
  canDecide: boolean;
};

export type EmailDeliveryAttempt = {
  attempt: number;
  status: string;
  provider: string | null;
  providerId: string | null;
  requestId: string | null;
  errorCode: string | null;
  error: string | null;
  at: string;
};

export type EmailDeliveryPayload = {
  schemaVersion: 2;
  kind: "client-email";
  draftId: string;
  draftRevision: number;
  contentHash: string;
  clientId: string;
  clientName: string;
  recipientEmailHash: string;
  htmlEncrypted: string;
  scheduledAt: string;
  requestedByUserId: string;
  requestedByName: string;
  approvalId: string;
  jobId: string | null;
  providerId: string | null;
  attemptHistory: EmailDeliveryAttempt[];
};

export type EmailDeliveryView = {
  id: string;
  ownerUserId: string;
  draftId: string;
  clientId: string;
  clientName: string;
  recipientEmail: string | null;
  subject: string;
  status: EmailDeliveryStatus | string;
  scheduledAt: string;
  sentAt: string | null;
  provider: string | null;
  providerId: string | null;
  approvalRequired: boolean;
  approvedAt: string | null;
  failureReason: string | null;
  jobId: string | null;
  attemptHistory: EmailDeliveryAttempt[];
  createdAt: string;
  updatedAt: string;
  cancellable: boolean;
  retryable: boolean;
};


export type EmailArchiveRecipient = {
  clientId: string;
  clientName: string;
  email: string | null;
};

export type EmailArchiveItem = {
  id: string;
  deliveryId: string;
  draftId: string;
  ownerUserId: string;
  ownerName: string;
  subject: string;
  bodyPreview: string;
  recipients: EmailArchiveRecipient[];
  status: "Sent" | "Simulated";
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  approvalId: string;
  sentAt: string;
  scheduledAt: string;
  provider: string | null;
  providerId: string | null;
  revision: number;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export type EmailArchiveDetail = EmailArchiveItem & {
  body: string;
  html: string;
  attemptHistory: EmailDeliveryAttempt[];
  requestedByName: string;
  contentHash: string;
};

export type EmailArchivePayload = {
  ok: true;
  scope: "mine" | "firm";
  items: EmailArchiveItem[];
  activeItem: EmailArchiveDetail | null;
  metrics: {
    totalSent: number;
    liveSent: number;
    simulated: number;
    uniqueRecipients: number;
    lastSentAt: string | null;
  };
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    pageSize: number;
  };
  generatedAt: string;
};

export type EmailJobView = {
  id: string;
  jobKey: string;
  jobName: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  progress: {
    value: number;
    message: string | null;
    updatedAt: string | null;
  };
  error: string | null;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  payloadKeys: string[];
};

export type EmailDraftProgressPayload = {
  ok: true;
  draft: EmailDraftDetail;
  job: EmailJobView | null;
  locked: boolean;
  progress: {
    value: number;
    message: string;
    status: EmailDraftGenerationState["status"];
    updatedAt: string | null;
  };
  generatedAt: string;
};

export type EmailCenterMetrics = {
  clientsWithEmail: number;
  draftCount: number;
  generatingCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  scheduledCount: number;
  sendingCount: number;
  sentCount: number;
  archiveCount: number;
  failedCount: number;
};

export type EmailCenterPayload = {
  ok: true;
  scope: "mine" | "firm";
  permissions: {
    canCreate: boolean;
    canApprove: boolean;
    canApproveBulk: boolean;
    canViewFirm: boolean;
    canDeleteDrafts: boolean;
  };
  clients: EmailClientOption[];
  branding: EmailBrandingPreference;
  drafts: EmailDraftSummary[];
  activeDraft: EmailDraftDetail | null;
  approvals: EmailApprovalView[];
  deliveries: EmailDeliveryView[];
  jobs: EmailJobView[];
  metrics: EmailCenterMetrics;
  generatedAt: string;
};

export type EmailAiGenerationPayload = {
  schemaVersion: 2;
  mode: "Generate" | "Polish";
  draftId: string;
  topic: string;
  purpose: string;
  completePrompt?: string;
  promptPlan?: EmailPromptPlan;
  tone: string;
  advisorInstructions: string;
  callToAction: string;
  useResearch: boolean;
  speedMode: EmailGenerationSpeed;
  optionCount: number;
  requestedByUserId: string;
  requestedAt: string;
};