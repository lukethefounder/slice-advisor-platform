export const CLIENT_LIST_SORTS = [
  "updatedAt",
  "createdAt",
  "fullName",
  "status",
] as const;

export type ClientListSort = (typeof CLIENT_LIST_SORTS)[number];

export const CLIENT_SECTION_NAMES = [
  "holdings",
  "notes",
  "tasks",
  "documents",
  "risk-reviews",
  "briefings",
] as const;

export type ClientSectionName = (typeof CLIENT_SECTION_NAMES)[number];

export type ClientAdvisorSummary = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  calendarColor: string;
  calendlyUrl: string | null;
  calendlyLabel: string;
};

export type ClientRecordCounts = {
  holdings: number;
  notes: number;
  tasks: number;
  reviews: number;
  documents: number;
  briefings: number;
};

export type ClientListItem = {
  id: string;
  fullName: string;
  email: string | null;
  householdName: string | null;
  clientType: string;
  riskProfile: string;
  status: string;
  portalEnabled: boolean;
  portalOnboardingStatus: string;
  assignedAdvisorMembershipId: string | null;
  assignedAdvisor: ClientAdvisorSummary | null;
  createdAt: string;
  updatedAt: string;
  counts: ClientRecordCounts;
};

export type ClientDirectoryMetrics = {
  totalClients: number;
  filteredClients: number;
  activeClients: number;
  needsReview: number;
  unassignedClients: number;
  openTasks: number;
  documentsNeedingReview: number;
  holdingsTracked: number;
};

export type CursorPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type ClientListPayload = {
  ok: true;
  mode: "list";
  clients: ClientListItem[];
  pagination: CursorPagination & {
    sort: ClientListSort;
    direction: "asc" | "desc";
  };
  filters: {
    q: string;
    status: string | null;
    risk: string | null;
    advisorMembershipId: string | null;
  };
  metrics: ClientDirectoryMetrics | null;
  searchCoverage: string[];
};

export type ClientOption = {
  id: string;
  fullName: string;
  householdName: string | null;
  riskProfile: string;
  status: string;
  assignedAdvisorMembershipId: string | null;
};

export type ClientOptionsPayload = {
  ok: true;
  mode: "options";
  clients: ClientOption[];
  pagination: CursorPagination;
};

export type ClientDetail = {
  id: string;
  userId: string;
  firmId: string | null;
  assignedAdvisorMembershipId: string | null;
  assignedAdvisorAt: string | null;
  assignedByUserId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  householdName: string | null;
  preferredContactMethod: string;
  clientType: string;
  riskProfile: string;
  liquidityNeeds: string;
  timeHorizon: string;
  objective: string;
  portfolioValue: string | null;
  status: string;
  notes: string | null;
  portalEnabled: boolean;
  portalInviteExpiresAt: string | null;
  portalOnboardingStatus: string;
  portalLastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAdvisor: ClientAdvisorSummary | null;
  counts: ClientRecordCounts;
};

export type ClientDetailPayload = {
  ok: true;
  client: ClientDetail;
  sections: ClientSectionName[];
  sectionPageSize: number;
};

export type ClientHoldingItem = {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: string;
  value: string | null;
  allocationPct: string | null;
  costBasis: string | null;
  riskLevel: string;
  thesis: string | null;
  createdAt: string;
};

export type ClientNoteItem = {
  id: string;
  title: string;
  body: string;
  noteType: string;
  createdAt: string;
};

export type ClientTaskItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
};

export type ClientDocumentItem = {
  id: string;
  fileName: string;
  documentType: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

export type ClientRiskReviewItem = {
  id: string;
  score: number;
  suitabilityStatus: string;
  summary: string;
  flagsJson: string;
  createdAt: string;
};

export type ClientBriefingItem = {
  id: string;
  title: string;
  audience: string;
  briefType: string;
  executiveSummary: string;
  status: string;
  createdAt: string;
};

export type ClientSectionItem =
  | ClientHoldingItem
  | ClientNoteItem
  | ClientTaskItem
  | ClientDocumentItem
  | ClientRiskReviewItem
  | ClientBriefingItem;

export type ClientSectionPayload = {
  ok: true;
  clientId: string;
  section: ClientSectionName;
  items: ClientSectionItem[];
  pagination: CursorPagination;
  filters: {
    q: string;
    status: string | null;
    type: string | null;
  };
};