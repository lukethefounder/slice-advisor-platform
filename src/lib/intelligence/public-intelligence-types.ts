export type PublicUrgency =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Suppressed";

export type PublicChannel = "SMS" | "Email" | "Dashboard" | "Digest";

export type PublicArticle = {
  id: string;
  sourceName: string;
  sourceDomain?: string;
  sourceKind: "official-feed" | "alpha-vantage-news" | "advisor-source";
  sourceTier?: string;
  sourceCategory?: string;
  title: string;
  summary: string;
  link?: string;
  publishedAt?: string;
  score: number;
  urgency: PublicUrgency;
  matchedTickers: string[];
  matchedCompanies: string[];
  matchedThemes: string[];
  reasons: string[];
  shouldAlert: boolean;
  channels: PublicChannel[];
  complianceLabel: string;
  alertCopy: string;
  sentimentScore?: number | null;
  sentimentLabel?: string;
  relevanceScore?: number | null;
  bannerImage?: string;
  authors?: string[];
};

export type PublicSourceStatus = {
  id: string;
  name: string;
  ok: boolean;
  fetched: number;
  provider: "Slice official feeds" | "Alpha Vantage";
  paid?: boolean;
  error?: string;
  checkedAt: string;
};

export type PublicTopicCount = {
  topic: string;
  count: number;
};

export type PublicIntelligenceSnapshot = {
  schemaVersion: "slice-public-intelligence-2.0.0";
  generatedAt: string;
  dateKey: string;
  marketTimeZone: "America/New_York";
  provider: "Slice Public Intelligence Mesh";
  refreshCadence: string;
  storage: "fresh" | "database" | "memory" | "stale";
  sources: PublicSourceStatus[];
  items: PublicArticle[];
  alertCandidates: PublicArticle[];
  digestCandidates: PublicArticle[];
  suppressed: PublicArticle[];
  topicCounts: PublicTopicCount[];
  warnings: string[];
};