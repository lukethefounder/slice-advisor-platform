export const FORECAST_HORIZONS = [
  "5-30m",
  "intraday",
  "1d",
  "2-5d",
  "1-4w",
  "1-3m",
  "3-12m",
  "1-3y",
] as const;

export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export type MarketRegime =
  | "Trending Bull"
  | "Trending Bear"
  | "Range Bound"
  | "High-Volatility Risk-Off"
  | "Low-Volatility Expansion"
  | "Liquidity Stress"
  | "Recovery"
  | "Unknown";

export type AgreementLevel =
  | "Very Low"
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

export type ForecastDirection = "Bullish" | "Neutral" | "Bearish";

export type DataQualityLevel =
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

export type MarketSnapshot = {
  schemaVersion: "slice-forecast-input-1.0.0";
  requestId: string;
  symbol: string;
  asOf: string;

  price: {
    current: number;
    previousClose: number;
    volume: number;
  };

  slice: {
    sentimentScore: number;
    sentimentConfidence: number;
    dataQuality: number;
    sourceCount: number;
    independentSourceCount: number;
    duplicateCount: number;
    staleData: boolean;
  };

  technicals: {
    trendScore: number;
    momentumScore: number;
    riskScore: number;
    volumeScore: number;
    rsi14: number;
    volatility20: number;
    momentum30: number;
    drawdownFromHigh: number;
    volumeTrend: number;
  };

  fundamentals: {
    peRatio: number;
    pegRatio: number;
    profitMargin: number;
    operatingMargin: number;
    returnOnEquity: number;
    quarterlyRevenueGrowthYOY: number;
    quarterlyEarningsGrowthYOY: number;
    analystTargetPrice: number;
    beta: number;
  };

  news: {
    relevanceWeightedSentiment: number;
    articleCount: number;
    noveltyScore: number;
    sourceReliability: number;
    contradictionScore: number;
    eventMagnitude: number;
  };

  macro: {
    regime: MarketRegime;
    alignmentScore: number;
    stressScore: number;
    liquidityScore: number;
    surpriseScore: number;
  };

  positioning: {
    optionsScore: number;
    crowdingScore: number;
    shortInterestScore: number;
    dealerGammaScore: number;
    impliedVolatilityPercent: number;
    skewScore: number;
  };

  environment: {
    alignmentScore: number;
    disruptionRisk: number;
    geographicExposure: number;
  };

  supplyChain: {
    resilienceScore: number;
    propagationRisk: number;
    concentrationRisk: number;
  };

  simulation: {
    enabled: boolean;
    paths: number;
    seed: number;
  };
};

export type CamelBehavioralFeatures = {
  schemaVersion: "slice-camel-output-1.0.0";
  status: "completed" | "degraded" | "disabled";
  generatedAt: string;
  modelVersion: string;
  confidence: number;
  directionalPressure: number;
  agentDisagreement: number;
  narrativeConcentration: number;
  reversalRisk: number;
  contagionRisk: number;
  liquidityStress: number;
  institutionalRepricingDelay: number;
  shortCoveringPotential: number;
  dominantNarrative: string;
  dominantBuyers: string[];
  dominantSellers: string[];
  positiveDrivers: string[];
  negativeDrivers: string[];
  contradictions: string[];
  limitations: string[];

  audit: {
    workforceMode: "PIPELINE" | "FALLBACK" | "DISABLED";
    sharedMemory: false;
    tradingExecutionEnabled: false;
    credentialsExposedToAgents: false;
    toolsUsed: string[];
    agentRoles: string[];
  };
};

export type ForecastFactorContribution = {
  factor:
    | "Slice Sentiment"
    | "Technical"
    | "Fundamental"
    | "News"
    | "Macro"
    | "Options & Positioning"
    | "Environmental"
    | "Supply Chain"
    | "Simulation"
    | "Risk Penalty";

  normalizedSignal: number;
  weight: number;
  contribution: number;
  explanation: string;
};

export type ForecastHorizonResult = {
  horizon: ForecastHorizon;
  label: string;
  direction: ForecastDirection;
  positiveReturnProbability: number;
  expectedReturnPercent: number;
  expectedPrice: number;

  expectedRangePercent: {
    low: number;
    high: number;
  };

  expectedPriceRange: {
    low: number;
    high: number;
  };

  volatilityPercent: number;
  confidence: number;
  modelAgreement: AgreementLevel;
  simulationAgreement: AgreementLevel;
  dataQuality: DataQualityLevel;
  modelDisagreement: number;
  primaryUncertainty: string;
  contributions: ForecastFactorContribution[];
};

export type SimulationPathSummary = {
  pathId: number;
  returnPercent: number;
  netDemand: number;
  liquidityStress: number;
  contagion: number;
  reversalOccurred: boolean;
  dominantNarrative: string;
  dominantBuyer: string;
  dominantSeller: string;
};

export type SimulationSummary = {
  enabled: boolean;
  engineVersion: string;
  seed: number;
  paths: number;
  medianOutcomePercent: number;
  bullishTailPercent: number;
  bearishTailPercent: number;
  probabilityPositive: number;
  agentDisagreement: number;
  pathEntropy: number;
  narrativeConcentration: number;
  reversalFrequency: number;
  liquidityStressFrequency: number;
  contagionBreadth: number;
  shortCoveringFrequency: number;
  dominantNarrative: string;
  dominantBuyers: string[];
  dominantSellers: string[];
  knownLimitations: string[];
  samplePaths: SimulationPathSummary[];
};

export type ForecastResponse = {
  schemaVersion: "slice-forecast-output-1.0.0";
  requestId: string;
  symbol: string;
  generatedAt: string;
  asOf: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  sliceSentimentScore: number;
  marketRegime: MarketRegime;
  dataQualityScore: number;
  staleDataWarning: string | null;
  horizons: ForecastHorizonResult[];
  simulation: SimulationSummary;
  camel: CamelBehavioralFeatures;

  drivers: {
    positive: string[];
    negative: string[];
    technical: string[];
    macro: string[];
    environmental: string[];
    supplyChain: string[];
    optionsAndPositioning: string[];
    contradictions: string[];
    historicalAnalogies: string[];
  };

  provenance: {
    sourceCount: number;
    independentSourceCount: number;
    duplicateCount: number;
    pointInTimeField: "asOf";
    inputSchemaVersion: string;
    forecastCodePath: string;
  };

  limitations: string[];

  safeguards: {
    simulatedConsensusIsTruth: false;
    autonomousTradingEnabled: false;
    simulationWeightCapped: true;
    simulationMaximumWeight: number;
    probabilityCalibratedMathematically: true;
    humanReviewRecommended: true;
  };
};

export type ForecastApiError = {
  error: string;
  detail?: string;
  issues?: string[];
};