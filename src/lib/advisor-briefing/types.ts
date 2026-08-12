export const ADVISOR_BRIEF_SCHEDULE_MODES = [
  "Interval",
  "Daily",
  "Weekdays",
  "Weekly",
] as const;

export type AdvisorBriefScheduleMode =
  (typeof ADVISOR_BRIEF_SCHEDULE_MODES)[number];

export type AdvisorBriefPreference = {
  schemaVersion: "slice-advisor-brief-preference-1.0.0";
  enabled: boolean;
  scheduleMode: AdvisorBriefScheduleMode;
  intervalMinutes: number;
  localTime: string;
  weeklyDay: number;
  timezone: string;
  emailEnabled: boolean;
  emailAddress: string;
  weekdaysOnly: boolean;
  minimumDataQuality: number;
  lastGeneratedAt: string | null;
  lastScheduledRunAt: string | null;
  lastSentAt: string | null;
  lastDeliveryStatus: string | null;
  updatedAt: string;
};

export type AdvisorBriefSourceKind =
  | "realtime-quote"
  | "daily-history"
  | "company-overview"
  | "market-news"
  | "economic-release"
  | "market-status"
  | "methodology";

export type AdvisorBriefSource = {
  id: string;
  kind: AdvisorBriefSourceKind;
  provider: string;
  label: string;
  publisher: string;
  url: string;
  asOf: string | null;
  retrievedAt: string;
  usedFor: string[];
};

export type AdvisorBriefQuote = {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string | null;
  extendedHoursPrice: number | null;
  extendedHoursChangePercent: number | null;
};

export type AdvisorBriefTechnical = {
  asOf: string | null;
  observations: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  momentum20Percent: number | null;
  momentum60Percent: number | null;
  volatility20AnnualizedPercent: number | null;
  drawdown60Percent: number | null;
  volumeRatio5To20: number | null;
  trendScore: number;
  momentumScore: number;
  volumeScore: number;
  riskQualityScore: number;
};

export type AdvisorBriefFundamentals = {
  asOf: string | null;
  marketCapitalization: number;
  peRatio: number | null;
  pegRatio: number | null;
  profitMarginPercent: number | null;
  operatingMarginPercent: number | null;
  returnOnEquityPercent: number | null;
  revenueGrowthPercent: number | null;
  earningsGrowthPercent: number | null;
  analystTargetPrice: number | null;
  beta: number | null;
  fundamentalScore: number;
};

export type AdvisorBriefNewsItem = {
  id: string;
  title: string;
  summary: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
  sentimentScore: number;
  relevanceScore: number;
  tickers: string[];
};

export type AdvisorBriefSecurity = {
  symbol: string;
  name: string;
  industryId: string;
  industryName: string;
  industryRank: number;
  overallRank: number;
  score: number;
  confidence: number;
  quote: AdvisorBriefQuote;
  technical: AdvisorBriefTechnical;
  fundamentals: AdvisorBriefFundamentals;
  newsScore: number;
  newsConfidence: number;
  explanation: string;
  positiveDrivers: string[];
  riskFlags: string[];
  sourceIds: string[];
};

export type AdvisorBriefIndustry = {
  id: string;
  name: string;
  description: string;
  etfSymbol: string;
  rank: number;
  score: number;
  confidence: number;
  averageChangePercent: number;
  advancingSharePercent: number;
  technicalScore: number;
  newsScore: number;
  macroScore: number;
  liquidityScore: number;
  thesis: string;
  positiveDrivers: string[];
  riskFlags: string[];
  stocks: AdvisorBriefSecurity[];
  sourceIds: string[];
};

export type AdvisorBriefEconomicEvidence = {
  id: string;
  label: string;
  functionName: string;
  unit: string;
  interval: string;
  latestValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
  score: number;
  confidence: number;
  sourceId: string;
};

export type AdvisorMarketBrief = {
  schemaVersion: "slice-advisor-market-brief-1.0.0";
  briefId: string;
  title: string;
  generatedAt: string;
  marketAsOf: string | null;
  marketStatus: string;
  providerMode:
    | "Realtime"
    | "Delayed"
    | "Market Closed"
    | "End of Day"
    | "Degraded";
  realTimeConfirmed: boolean;
  dataQuality: number;
  quoteCoveragePercent: number;
  methodologyVersion: string;
  executiveSummary: string;
  topIndustries: AdvisorBriefIndustry[];
  overallRankedSecurities: AdvisorBriefSecurity[];
  economicEvidence: AdvisorBriefEconomicEvidence[];
  sources: AdvisorBriefSource[];
  warnings: string[];
  methodology: {
    industryWeights: Record<string, number>;
    securityWeights: Record<string, number>;
    selectionUniverseSize: number;
    industryUniverseSize: number;
    minimumDataQuality: number;
    description: string;
  };
};

export type AdvisorMarketBriefRecord = {
  id: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  brief: AdvisorMarketBrief;
};

export type AdvisorBriefEmailResult = {
  ok: boolean;
  provider: string;
  status: "sent" | "simulated" | "failed" | "disabled";
  id?: string;
  error?: string;
};

export type AdvisorBriefJobView = {
  id: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  progress: {
    value: number;
    message: string | null;
    updatedAt: string | null;
  };
  availableAt: string;
  completedAt: string | null;
  error: string | null;
  output: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorBriefApiPayload = {
  ok: boolean;
  preference: AdvisorBriefPreference;
  latest: AdvisorMarketBriefRecord | null;
  history: AdvisorMarketBriefRecord[];
  schedule: {
    label: string;
    nextRunAt: string | null;
    emailReady: boolean;
    cronCadence: "Every 5 minutes";
  };
  jobs: AdvisorBriefJobView[];
  delivery: {
    status: string;
    destination: string | null;
    createdAt: string;
    deliveredAt: string | null;
    reason: string | null;
    simulated: boolean;
  } | null;
  error?: string;
};