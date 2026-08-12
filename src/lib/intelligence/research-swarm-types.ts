import type { MarketSnapshot } from "@/lib/intelligence-forecast/types";

export const RESEARCH_COHORTS = [
  "media",
  "technical",
  "economy",
] as const;

export type ResearchCohort = (typeof RESEARCH_COHORTS)[number];

export type ResearchAgentStatus =
  | "completed"
  | "degraded"
  | "insufficient-evidence";

export type ResearchEvidenceKind =
  | "news"
  | "social-narrative"
  | "filing"
  | "quote"
  | "intraday"
  | "technical"
  | "fundamental"
  | "economic-series"
  | "industry-context";

export type ResearchEvidence = {
  id: string;
  cohort: ResearchCohort;
  kind: ResearchEvidenceKind;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  retrievedAt: string;
  score: number;
  confidence: number;
  freshnessScore: number;
  relevanceScore: number;
  polarity: "positive" | "neutral" | "negative" | "mixed";
  symbol: string;
  sector: string;
  industry: string;
  topics: string[];
  metrics: Record<string, number | string | boolean | null>;
  warnings: string[];
};

export type ResearchAgent = {
  id: string;
  cohort: ResearchCohort;
  ordinal: number;
  role: string;
  pathway: string;
  status: ResearchAgentStatus;
  score: number;
  confidence: number;
  agreement: number;
  evidenceIds: string[];
  primaryEvidenceId: string | null;
  positiveDrivers: string[];
  negativeDrivers: string[];
  contradictions: string[];
  latencyMs: number;
  generatedAt: string;
};

export type ResearchCohortResult = {
  cohort: ResearchCohort;
  label: string;
  requestedAgents: number;
  completedAgents: number;
  degradedAgents: number;
  evidenceCount: number;
  independentSourceCount: number;
  score: number;
  confidence: number;
  agreement: number;
  dispersion: number;
  contributionToSliceScore: number;
  topPositiveDrivers: string[];
  topNegativeDrivers: string[];
  contradictions: string[];
};

export type SliceAgenticScore = {
  schemaVersion: "slice-agentic-score-1.0.0";
  overall: number;
  confidence: number;
  label:
    | "Strongly Bullish"
    | "Bullish"
    | "Neutral"
    | "Bearish"
    | "Strongly Bearish";
  generatedAt: string;
  providerAsOf: string | null;
  weighting: {
    media: number;
    technical: number;
    economy: number;
  };
  cohorts: Record<ResearchCohort, ResearchCohortResult>;
  quality: {
    realTimeConfirmed: boolean;
    delayed: boolean;
    marketOpen: boolean | null;
    evidenceCoverage: number;
    sourceDiversity: number;
    agentCompletionRate: number;
    contradictionPenalty: number;
    freshnessPenalty: number;
    /** Additive Phase 10 diagnostics; the existing score calculation remains unchanged. */
    stabilityScore?: number;
    sourceConcentration?: number;
    uncertaintyLow?: number;
    uncertaintyHigh?: number;
  };
  drivers: {
    positive: string[];
    negative: string[];
    contradictions: string[];
  };
  safeguards: {
    equalThirdWeighting: true;
    autonomousTradingEnabled: false;
    unavailableInputsNeutralized: true;
    simulatedAgentsAreObservedTruth: false;
    externalCallsPerAgent: false;
  };
};

export type EconomicSeriesPoint = {
  date: string;
  value: number;
};

export type EconomicSeriesEvidence = {
  id: string;
  functionName: string;
  label: string;
  description: string;
  interval: string;
  unit: string;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  retrievedAt: string;
  latestValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  score: number;
  confidence: number;
  industrySensitivity: number;
  data: EconomicSeriesPoint[];
  warning: string | null;
};

export type EconomicResearchSnapshot = {
  schemaVersion: "slice-economic-research-1.0.0";
  retrievedAt: string;
  sector: string;
  industry: string;
  score: number;
  confidence: number;
  regime:
    | "Expansion"
    | "Slowing Expansion"
    | "Balanced"
    | "Contraction Risk"
    | "High Inflation"
    | "Liquidity Stress";
  series: EconomicSeriesEvidence[];
  warnings: string[];
};

export type ResearchGraphNodeKind =
  | "run"
  | "asset"
  | "sector"
  | "industry"
  | "score"
  | "cohort"
  | "agent"
  | "evidence"
  | "source"
  | "topic"
  | "factor"
  | "economic-series"
  | "forecast";

export type ResearchGraphNode = {
  id: string;
  kind: ResearchGraphNodeKind;
  label: string;
  cohort: ResearchCohort | "shared";
  score: number | null;
  confidence: number | null;
  size: number;
  group: string;
  properties: Record<string, string | number | boolean | null>;
};

export type ResearchGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind:
    | "CONTAINS"
    | "RESEARCHES"
    | "USES_EVIDENCE"
    | "PUBLISHED_BY"
    | "ABOUT_TOPIC"
    | "CONTRIBUTES_TO"
    | "BELONGS_TO"
    | "OPERATES_IN"
    | "DERIVES"
    | "CONTRADICTS"
    | "SUPPORTS"
    | "OPPOSES";
  weight: number;
  cohort: ResearchCohort | "shared";
  properties: Record<string, string | number | boolean | null>;
};

export type ResearchGraphProjectionMode = "overview" | "balanced" | "full";

export type ResearchGraphProjection = {
  mode: ResearchGraphProjectionMode;
  originalNodeCount: number;
  originalEdgeCount: number;
  renderedNodeCount: number;
  renderedEdgeCount: number;
  omittedNodeCount: number;
  omittedEdgeCount: number;
  clipped: boolean;
  selectedNodeId: string | null;
  generatedAt: string;
};

export type ResearchKnowledgeGraph = {
  schemaVersion: "slice-research-graph-1.0.0";
  runId: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: ResearchGraphNode[];
  edges: ResearchGraphEdge[];
  clusters: Array<{
    id: string;
    label: string;
    cohort: ResearchCohort | "shared";
    nodeCount: number;
    averageScore: number;
  }>;
  /** Present when the server returns a level-of-detail projection. */
  projection?: ResearchGraphProjection;
};

export type ResearchGraphRankedNode = {
  id: string;
  label: string;
  kind: ResearchGraphNodeKind;
  cohort: ResearchCohort | "shared";
  score: number;
};

export type ResearchGraphCommunity = {
  id: string;
  label: string;
  cohort: ResearchCohort | "shared";
  nodeCount: number;
  edgeCount: number;
  averageScore: number;
  topNodeIds: string[];
};

export type ResearchGraphAnalytics = {
  density: number;
  visualComplexity: number;
  edgeIntensity: number;
  connectednessScore: number;
  centralityTop: Array<{
    id: string;
    label: string;
    kind: ResearchGraphNodeKind;
    cohort: ResearchCohort | "shared";
    degree: number;
    weightedDegree: number;
    centralityScore: number;
  }>;
  bridgeNodes: Array<{
    id: string;
    label: string;
    cohort: ResearchCohort | "shared";
    bridgeScore: number;
  }>;
  contradictionHotspots: Array<{
    id: string;
    label: string;
    cohort: ResearchCohort | "shared";
    contradictionCount: number;
    severity: number;
  }>;
  clusterPressure: Record<
    ResearchCohort | "shared",
    {
      score: number;
      confidence: number;
      pressure: number;
      nodeCount: number;
    }
  >;
  /** Phase 10 advanced diagnostics. Optional for backward compatibility. */
  algorithmVersion?: "slice-graph-analytics-3.0.0";
  pagerankTop?: ResearchGraphRankedNode[];
  betweennessTop?: ResearchGraphRankedNode[];
  communities?: ResearchGraphCommunity[];
  componentCount?: number;
  largestComponentPercent?: number;
  networkResilience?: number;
  sourceConcentration?: number;
  contradictionRatio?: number;
  averagePathLength?: number;
  analyzedNodeCount?: number;
  analyzedEdgeCount?: number;
  analysisDurationMs?: number;
};

export type ResearchGraphNodeDetail = {
  node: ResearchGraphNode;
  neighbors: Array<{
    node: ResearchGraphNode;
    edge: ResearchGraphEdge;
    direction: "incoming" | "outgoing";
  }>;
  pathToScore: string[];
  incomingCount: number;
  outgoingCount: number;
  contradictionCount: number;
};

export type ResearchBotTopology = {
  totalPathways: number;
  mediaToTechnicalTension: number;
  mediaToEconomyTension: number;
  technicalToEconomyTension: number;
  consensusScore: number;
  pathwayThroughputPerSecond: number;
  averageLatencyMs: number;
  completionRate: number;
  cohortHandoffs: Array<{
    from: ResearchCohort;
    to: ResearchCohort;
    relationship: "confirms" | "contradicts" | "diverges" | "reinforces";
    strength: number;
    description: string;
  }>;
};

export type ResearchForecastVector = {
  algorithmVersion: "slice-swarm-forecast-vector-2.0.0";
  forecastBias: "bullish" | "neutral" | "bearish";
  expectedDriftPercent: number;
  confidenceLift: number;
  tailRiskScore: number;
  regimePressure: number;
  dataFreshnessScore: number;
  networkAmplification: number;
  contradictionDrag: number;
  driverSummary: string;
};

export type ResearchMatrixRow = {
  cohort: ResearchCohort;
  dimension: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  agentCount: number;
  weight: number;
};

export type ResearchGraphPersistence =
  | {
      status: "persisted";
      nodeCount: number;
      edgeCount: number;
      persistedAt: string;
    }
  | {
      status: "skipped" | "failed";
      detail: string;
    };

export type ResearchSwarmAlgorithmDiagnostics = {
  version: "slice-swarm-diagnostics-3.0.0";
  scoreSemanticsPreserved: true;
  equalThirdWeightingPreserved: true;
  stabilityScore: number;
  sourceConcentration: number;
  uncertaintyBand: {
    low: number;
    high: number;
  };
  cohortRobustness: Record<
    ResearchCohort,
    {
      median: number;
      trimmedMean: number;
      interquartileRange: number;
      effectiveEvidence: number;
    }
  >;
  cache: {
    status: "hit" | "miss" | "coalesced" | "not-used";
    key: string;
    expiresAt: string | null;
  };
};

export type ResearchSwarmResponse = {
  schemaVersion: "slice-research-swarm-1.0.0";
  ok: true;
  runId: string;
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  requestedAgents: number;
  activeAgents: number;
  allocation: Record<ResearchCohort, number>;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerAsOf: string | null;
  retrievedAt: string;
  market: {
    provider: "Alpha Vantage";
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
    currency: string;
    freshnessMode: string;
    freshnessLabel: string;
    realTimeConfirmed: boolean;
    delayed: boolean;
    marketOpen: boolean | null;
    marketStatus: string;
    providerTimeZone: string;
  };
  score: SliceAgenticScore;
  cohorts: Record<ResearchCohort, ResearchCohortResult>;
  evidence: ResearchEvidence[];
  agents: ResearchAgent[];
  economy: EconomicResearchSnapshot;
  graph: ResearchKnowledgeGraph;
  graphPersistence: ResearchGraphPersistence;
  graphAnalytics: ResearchGraphAnalytics;
  botTopology: ResearchBotTopology;
  forecastVector: ResearchForecastVector;
  researchMatrix: ResearchMatrixRow[];
  forecastSnapshot: MarketSnapshot;
  warnings: string[];
  /** Additive Phase 10 metadata. */
  algorithm?: ResearchSwarmAlgorithmDiagnostics;
};

export type ResearchGraphViewResponse = {
  ok: true;
  source: "memory" | "neo4j";
  symbol: string;
  runId: string;
  generatedAt: string;
  graph: ResearchKnowledgeGraph;
  analytics: ResearchGraphAnalytics;
  selectedNode: ResearchGraphNodeDetail | null;
  metadata: {
    companyName?: string;
    sector?: string;
    industry?: string;
    requestedAgents?: number;
    activeAgents?: number;
    score?: number;
    confidence?: number;
    providerAsOf?: string | null;
    durationMs?: number;
  };
  persistence: {
    configured: boolean;
    status: "available" | "unavailable";
  };
};