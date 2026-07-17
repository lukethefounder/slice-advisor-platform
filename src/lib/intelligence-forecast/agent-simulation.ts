import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  recordAuditLog,
} from "@/lib/audit";

import {
  prisma,
} from "@/lib/prisma";

const SIMULATION_ENGINE_VERSION =
  "slice-agent-simulation-2.0.0";

const SIMULATION_EVENT_TYPE =
  "INTELLIGENCE_AGENT_SIMULATION";

const MINIMUM_PATHS =
  50;

const MAXIMUM_PATHS =
  1_000;

type JsonRecord =
  Record<string, unknown>;

export const AGENT_SIMULATION_SCENARIOS = [
  "BASELINE",
  "RISK_OFF",
  "LIQUIDITY_SHOCK",
  "POSITIVE_CATALYST",
  "SHORT_SQUEEZE",
  "SUPPLY_DISRUPTION",
  "MACRO_EASING",
] as const;

export type AgentSimulationScenario =
  (typeof AGENT_SIMULATION_SCENARIOS)[number];

type HorizonFocus =
  | "short"
  | "medium"
  | "long";

type ScenarioShock = {
  sentiment: number;
  technical: number;
  fundamental: number;
  macro: number;
  liquidity: number;
  positioning: number;
  supply: number;
  volatilityMultiplier: number;
  jumpProbability: number;
  jumpMeanPercent: number;
  agentImpactMultiplier: number;
};

export type ScenarioDefinition = {
  id: AgentSimulationScenario;
  label: string;
  description: string;
  shock: ScenarioShock;
};

type AgentSignalWeights = {
  sentiment: number;
  technical: number;
  fundamental: number;
  macro: number;
  liquidity: number;
  positioning: number;
  supply: number;
};

type AgentDefinition = {
  id: string;
  label: string;
  category: string;
  description: string;
  weights: AgentSignalWeights;
  shortFocus: number;
  mediumFocus: number;
  longFocus: number;
  conviction: number;
  impact: number;
  persistence: number;
  idiosyncraticNoise: number;
};

type StoredHorizon = {
  id: string;
  horizon: string;
  label: string;
  targetAt: Date;
  initialPrice: number;
  direction: string;
  positiveReturnProbability: number;
  expectedReturnPercent: number;
  expectedPrice: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  volatilityPercent: number;
  confidence: number;
  modelAgreement: string;
  simulationAgreement: string;
  dataQuality: string;
  modelDisagreement: number;
  primaryUncertainty: string;
  status: string;
};

type StoredForecastRun = {
  id: string;
  requestId: string;
  symbol: string;
  generatedAt: Date;
  asOfAt: Date;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  camelStatus: string;
  camelWorkforceMode: string;
  status: string;
  inputJson: string;
  outputJson: string;
  horizons: StoredHorizon[];
};

export type SimulationAgentInfluence = {
  id: string;
  label: string;
  category: string;
  influenceSharePercent: number;
  signedSupport: number;
  dominantAction:
    | "Buy"
    | "Sell"
    | "Neutral";
};

export type SimulationHorizonResult = {
  horizon: string;
  label: string;
  targetAt: string;
  initialPrice: number;
  scenario: AgentSimulationScenario;
  paths: number;
  steps: number;
  positiveReturnProbability: number;
  meanReturnPercent: number;
  standardDeviationPercent: number;
  quantiles: {
    p05: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  expectedPrice: number;
  medianPrice: number;
  priceRangeP10: number;
  priceRangeP90: number;
  crashThresholdPercent: number;
  rallyThresholdPercent: number;
  crashProbability: number;
  rallyProbability: number;
  averageMaximumDrawdownPercent: number;
  maximumDrawdownP90Percent: number;
  agentAgreementPercent: number;
  netAgentSupport: number;
  agentInfluence: SimulationAgentInfluence[];
};

export type AgentSimulationResult = {
  schemaVersion:
    "slice-agent-simulation-2.0.0";
  simulationId: string;
  generatedAt: string;
  replayFingerprint: string;
  engineVersion: string;
  userScoped: true;
  forecastRunId: string;
  requestId: string;
  symbol: string;
  sourceModelVersion: string;
  sourceEngineVersion: string;
  sourceCalibrationVersion: string;
  marketRegime: string;
  scenario: ScenarioDefinition;
  configuration: {
    paths: number;
    seed: number;
    agentCount: number;
    horizonCount: number;
  };
  sourceForecast: {
    generatedAt: string;
    asOfAt: string;
    sliceSentimentScore: number;
    dataQualityScore: number;
    camelStatus: string;
    camelWorkforceMode: string;
    status: string;
  };
  horizons: SimulationHorizonResult[];
  safeguards: {
    autonomousTradingEnabled: false;
    simulationIsObservedTruth: false;
    simulationIsGuaranteedOutcome: false;
    simulationCanMoveFunds: false;
    deterministicReplaySupported: true;
    decisionSupportOnly: true;
  };
};

export type AgentSimulationHistoryItem = {
  id: string;
  eventKey: string;
  forecastRunId: string;
  symbol: string;
  scenario: AgentSimulationScenario;
  paths: number;
  seed: number;
  generatedAt: string;
  replayFingerprint: string;
  horizonCount: number;
  summary: {
    averagePositiveProbability: number;
    averageMedianReturnPercent: number;
    maximumCrashProbability: number;
    maximumRallyProbability: number;
  };
};

const SCENARIO_DEFINITIONS:
  Record<
    AgentSimulationScenario,
    ScenarioDefinition
  > = {
    BASELINE: {
      id: "BASELINE",
      label: "Baseline",
      description:
        "No external stress shock. Participants react to the stored forecast and normal stochastic variation.",
      shock: {
        sentiment: 0,
        technical: 0,
        fundamental: 0,
        macro: 0,
        liquidity: 0,
        positioning: 0,
        supply: 0,
        volatilityMultiplier: 1,
        jumpProbability: 0.01,
        jumpMeanPercent: 0,
        agentImpactMultiplier: 1,
      },
    },

    RISK_OFF: {
      id: "RISK_OFF",
      label: "Broad Risk-Off",
      description:
        "Macro stress, weaker sentiment, defensive allocation, and increased volatility.",
      shock: {
        sentiment: -0.55,
        technical: -0.35,
        fundamental: -0.08,
        macro: -0.7,
        liquidity: -0.38,
        positioning: -0.25,
        supply: -0.05,
        volatilityMultiplier: 1.65,
        jumpProbability: 0.06,
        jumpMeanPercent: -2.5,
        agentImpactMultiplier: 1.25,
      },
    },

    LIQUIDITY_SHOCK: {
      id: "LIQUIDITY_SHOCK",
      label: "Liquidity Shock",
      description:
        "Reduced market depth, forced deleveraging, widening spreads, and volatility-control selling.",
      shock: {
        sentiment: -0.35,
        technical: -0.25,
        fundamental: -0.05,
        macro: -0.35,
        liquidity: -0.95,
        positioning: -0.45,
        supply: 0,
        volatilityMultiplier: 2.1,
        jumpProbability: 0.09,
        jumpMeanPercent: -3.4,
        agentImpactMultiplier: 1.65,
      },
    },

    POSITIVE_CATALYST: {
      id: "POSITIVE_CATALYST",
      label: "Positive Catalyst",
      description:
        "Unexpected positive company or sector news with improved sentiment and follow-through demand.",
      shock: {
        sentiment: 0.8,
        technical: 0.42,
        fundamental: 0.35,
        macro: 0.08,
        liquidity: 0.18,
        positioning: 0.25,
        supply: 0.1,
        volatilityMultiplier: 1.25,
        jumpProbability: 0.07,
        jumpMeanPercent: 3,
        agentImpactMultiplier: 1.2,
      },
    },

    SHORT_SQUEEZE: {
      id: "SHORT_SQUEEZE",
      label: "Short Squeeze",
      description:
        "Rapid price appreciation caused by crowded short positioning, dealer hedging, and momentum demand.",
      shock: {
        sentiment: 0.65,
        technical: 0.75,
        fundamental: 0.05,
        macro: 0,
        liquidity: 0.12,
        positioning: 1,
        supply: 0,
        volatilityMultiplier: 2,
        jumpProbability: 0.12,
        jumpMeanPercent: 4.5,
        agentImpactMultiplier: 1.7,
      },
    },

    SUPPLY_DISRUPTION: {
      id: "SUPPLY_DISRUPTION",
      label: "Supply Disruption",
      description:
        "Operational disruption, input scarcity, concentrated suppliers, and margin pressure.",
      shock: {
        sentiment: -0.35,
        technical: -0.15,
        fundamental: -0.5,
        macro: -0.08,
        liquidity: -0.08,
        positioning: -0.1,
        supply: -0.95,
        volatilityMultiplier: 1.55,
        jumpProbability: 0.06,
        jumpMeanPercent: -2.8,
        agentImpactMultiplier: 1.2,
      },
    },

    MACRO_EASING: {
      id: "MACRO_EASING",
      label: "Macro Easing",
      description:
        "Improving liquidity, lower policy pressure, expanding risk appetite, and reduced financial stress.",
      shock: {
        sentiment: 0.35,
        technical: 0.18,
        fundamental: 0.1,
        macro: 0.75,
        liquidity: 0.7,
        positioning: 0.15,
        supply: 0.05,
        volatilityMultiplier: 0.82,
        jumpProbability: 0.03,
        jumpMeanPercent: 1.5,
        agentImpactMultiplier: 1.1,
      },
    },
  };

const AGENTS:
  AgentDefinition[] = [
    {
      id: "retail-momentum",
      label: "Retail Momentum",
      category: "Retail",
      description:
        "Chases visible price momentum and recent sentiment.",
      weights: {
        sentiment: 0.35,
        technical: 0.7,
        fundamental: 0.02,
        macro: 0.02,
        liquidity: 0.08,
        positioning: 0.18,
        supply: 0,
      },
      shortFocus: 1,
      mediumFocus: 0.55,
      longFocus: 0.12,
      conviction: 1.15,
      impact: 0.75,
      persistence: 0.62,
      idiosyncraticNoise: 0.45,
    },

    {
      id: "retail-contrarian",
      label: "Retail Contrarian",
      category: "Retail",
      description:
        "Buys weakness and sells perceived overextension.",
      weights: {
        sentiment: -0.18,
        technical: -0.55,
        fundamental: 0.12,
        macro: 0.02,
        liquidity: 0.03,
        positioning: -0.22,
        supply: 0,
      },
      shortFocus: 0.9,
      mediumFocus: 0.5,
      longFocus: 0.18,
      conviction: 0.9,
      impact: 0.45,
      persistence: 0.35,
      idiosyncraticNoise: 0.55,
    },

    {
      id: "systematic-trend",
      label: "Systematic Trend",
      category: "Systematic",
      description:
        "Responds to persistent direction and trend confirmation.",
      weights: {
        sentiment: 0.08,
        technical: 0.9,
        fundamental: 0.02,
        macro: 0.12,
        liquidity: 0.08,
        positioning: 0.16,
        supply: 0,
      },
      shortFocus: 0.75,
      mediumFocus: 1,
      longFocus: 0.65,
      conviction: 1.2,
      impact: 1,
      persistence: 0.86,
      idiosyncraticNoise: 0.22,
    },

    {
      id: "volatility-control",
      label: "Volatility Control",
      category: "Systematic",
      description:
        "Reduces risk as volatility and liquidity stress rise.",
      weights: {
        sentiment: 0.02,
        technical: 0.22,
        fundamental: 0,
        macro: 0.24,
        liquidity: 0.68,
        positioning: 0.18,
        supply: 0,
      },
      shortFocus: 0.8,
      mediumFocus: 1,
      longFocus: 0.55,
      conviction: 1.25,
      impact: 1.15,
      persistence: 0.8,
      idiosyncraticNoise: 0.18,
    },

    {
      id: "market-maker",
      label: "Market Maker",
      category: "Liquidity",
      description:
        "Provides liquidity in normal markets and withdraws during stress.",
      weights: {
        sentiment: -0.02,
        technical: -0.12,
        fundamental: 0,
        macro: 0.05,
        liquidity: 0.92,
        positioning: 0.22,
        supply: 0,
      },
      shortFocus: 1,
      mediumFocus: 0.45,
      longFocus: 0.05,
      conviction: 0.75,
      impact: 0.7,
      persistence: 0.42,
      idiosyncraticNoise: 0.3,
    },

    {
      id: "dealer-hedger",
      label: "Dealer Hedger",
      category: "Derivatives",
      description:
        "Adjusts hedges in response to options positioning and directional pressure.",
      weights: {
        sentiment: 0.04,
        technical: 0.24,
        fundamental: 0,
        macro: 0.04,
        liquidity: 0.2,
        positioning: 0.95,
        supply: 0,
      },
      shortFocus: 1,
      mediumFocus: 0.72,
      longFocus: 0.08,
      conviction: 1.2,
      impact: 1.1,
      persistence: 0.68,
      idiosyncraticNoise: 0.2,
    },

    {
      id: "long-only-fundamental",
      label: "Long-Only Fundamental",
      category: "Institutional",
      description:
        "Allocates based on earnings, durability, valuation support, and long-horizon fundamentals.",
      weights: {
        sentiment: 0.04,
        technical: 0.08,
        fundamental: 0.92,
        macro: 0.28,
        liquidity: 0.06,
        positioning: 0.02,
        supply: 0.22,
      },
      shortFocus: 0.08,
      mediumFocus: 0.65,
      longFocus: 1,
      conviction: 1,
      impact: 0.9,
      persistence: 0.93,
      idiosyncraticNoise: 0.15,
    },

    {
      id: "event-driven-fund",
      label: "Event-Driven Fund",
      category: "Institutional",
      description:
        "Trades catalysts, contradictions, and event-specific repricing.",
      weights: {
        sentiment: 0.58,
        technical: 0.2,
        fundamental: 0.5,
        macro: 0.08,
        liquidity: 0.08,
        positioning: 0.18,
        supply: 0.22,
      },
      shortFocus: 0.72,
      mediumFocus: 1,
      longFocus: 0.42,
      conviction: 1.15,
      impact: 0.9,
      persistence: 0.58,
      idiosyncraticNoise: 0.32,
    },

    {
      id: "fundamental-short",
      label: "Fundamental Short Seller",
      category: "Institutional",
      description:
        "Targets weakening fundamentals, crowding, and unsustainable expectations.",
      weights: {
        sentiment: -0.1,
        technical: -0.12,
        fundamental: -0.85,
        macro: -0.2,
        liquidity: -0.08,
        positioning: -0.4,
        supply: -0.35,
      },
      shortFocus: 0.18,
      mediumFocus: 0.72,
      longFocus: 1,
      conviction: 1.05,
      impact: 0.72,
      persistence: 0.82,
      idiosyncraticNoise: 0.22,
    },

    {
      id: "passive-flow",
      label: "Passive and Index Flow",
      category: "Passive",
      description:
        "Reflects broad allocation flows rather than security-specific judgment.",
      weights: {
        sentiment: 0.03,
        technical: 0.08,
        fundamental: 0.04,
        macro: 0.62,
        liquidity: 0.48,
        positioning: 0.08,
        supply: 0,
      },
      shortFocus: 0.28,
      mediumFocus: 0.72,
      longFocus: 0.9,
      conviction: 0.75,
      impact: 0.95,
      persistence: 0.9,
      idiosyncraticNoise: 0.12,
    },

    {
      id: "macro-allocator",
      label: "Macro Allocator",
      category: "Macro",
      description:
        "Changes exposure according to liquidity, policy, growth, and risk regime.",
      weights: {
        sentiment: 0.06,
        technical: 0.12,
        fundamental: 0.15,
        macro: 0.95,
        liquidity: 0.55,
        positioning: 0.1,
        supply: 0.08,
      },
      shortFocus: 0.22,
      mediumFocus: 0.82,
      longFocus: 1,
      conviction: 1.05,
      impact: 1,
      persistence: 0.88,
      idiosyncraticNoise: 0.18,
    },

    {
      id: "supply-chain-specialist",
      label: "Supply-Chain Specialist",
      category: "Structural",
      description:
        "Responds to resilience, concentration, disruption, and propagation risk.",
      weights: {
        sentiment: 0.02,
        technical: 0.04,
        fundamental: 0.35,
        macro: 0.08,
        liquidity: 0.02,
        positioning: 0,
        supply: 0.95,
      },
      shortFocus: 0.08,
      mediumFocus: 0.65,
      longFocus: 1,
      conviction: 0.95,
      impact: 0.6,
      persistence: 0.9,
      idiosyncraticNoise: 0.16,
    },
  ];

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseJson(
  value: string,
): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function safeJson(
  value: unknown,
  fallback: string,
) {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 6,
) {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor,
    ) /
    factor
  );
}

function average(
  values: number[],
) {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
    values.length
  );
}

function standardDeviation(
  values: number[],
) {
  if (
    values.length <
    2
  ) {
    return 0;
  }

  const mean =
    average(values);

  return Math.sqrt(
    average(
      values.map(
        (value) =>
          (
            value -
            mean
          ) **
          2,
      ),
    ),
  );
}

function quantile(
  sortedValues: number[],
  probability: number,
) {
  if (!sortedValues.length) {
    return 0;
  }

  const bounded =
    clamp(
      probability,
      0,
      1,
    );

  const position =
    (
      sortedValues.length -
      1
    ) *
    bounded;

  const lower =
    Math.floor(position);

  const upper =
    Math.ceil(position);

  if (
    lower ===
    upper
  ) {
    return sortedValues[
      lower
    ];
  }

  const fraction =
    position -
    lower;

  return (
    sortedValues[
      lower
    ] *
      (
        1 -
        fraction
      ) +
    sortedValues[
      upper
    ] *
      fraction
  );
}

function hashToSeed(
  value: string,
) {
  const digest =
    createHash(
      "sha256",
    )
      .update(value)
      .digest();

  return digest.readUInt32LE(
    0,
  );
}

function createRandom(
  seed: number,
) {
  let state =
    seed >>> 0;

  return () => {
    state +=
      0x6d2b79f5;

    let value =
      state;

    value =
      Math.imul(
        value ^
          (
            value >>>
            15
          ),
        value |
          1,
      );

    value ^=
      value +
      Math.imul(
        value ^
          (
            value >>>
            7
          ),
        value |
          61,
      );

    return (
      (
        value ^
        (
          value >>>
          14
        )
      ) >>>
      0
    ) /
      4_294_967_296;
  };
}

function normalRandom(
  random: () => number,
) {
  const first =
    Math.max(
      random(),
      Number.EPSILON,
    );

  const second =
    Math.max(
      random(),
      Number.EPSILON,
    );

  return (
    Math.sqrt(
      -2 *
      Math.log(first),
    ) *
    Math.cos(
      2 *
      Math.PI *
      second,
    )
  );
}

function focusForHorizon(
  horizon: string,
): HorizonFocus {
  if (
    horizon ===
      "5-30m" ||
    horizon ===
      "intraday" ||
    horizon ===
      "1d"
  ) {
    return "short";
  }

  if (
    horizon ===
      "2-5d" ||
    horizon ===
      "1-4w" ||
    horizon ===
      "1-3m"
  ) {
    return "medium";
  }

  return "long";
}

function focusWeight(
  agent: AgentDefinition,
  focus: HorizonFocus,
) {
  if (
    focus ===
    "short"
  ) {
    return agent.shortFocus;
  }

  if (
    focus ===
    "medium"
  ) {
    return agent.mediumFocus;
  }

  return agent.longFocus;
}

function stepsForHorizon(
  horizon: string,
) {
  const steps:
    Record<string, number> = {
      "5-30m": 12,
      intraday: 24,
      "1d": 24,
      "2-5d": 30,
      "1-4w": 32,
      "1-3m": 36,
      "3-12m": 48,
      "1-3y": 60,
    };

  return (
    steps[
      horizon
    ] ??
    30
  );
}

function regimeSignal(
  value: string,
) {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      "risk-on",
    ) ||
    normalized.includes(
      "bull",
    ) ||
    normalized.includes(
      "expansion",
    )
  ) {
    return 0.3;
  }

  if (
    normalized.includes(
      "risk-off",
    ) ||
    normalized.includes(
      "bear",
    ) ||
    normalized.includes(
      "contraction",
    ) ||
    normalized.includes(
      "stress",
    )
  ) {
    return -0.3;
  }

  return 0;
}

function agentSupport(
  input: {
    agent: AgentDefinition;
    focus: HorizonFocus;
    baseDirection: number;
    regime: number;
    shock: ScenarioShock;
    priorSupport: number;
    random: () => number;
  },
) {
  const signals = {
    sentiment:
      input.baseDirection *
        0.35 +
      input.shock.sentiment,

    technical:
      input.baseDirection *
        0.8 +
      input.shock.technical,

    fundamental:
      input.baseDirection *
        0.25 +
      input.shock.fundamental,

    macro:
      input.regime +
      input.shock.macro,

    liquidity:
      input.shock.liquidity,

    positioning:
      input.baseDirection *
        0.25 +
      input.shock.positioning,

    supply:
      input.shock.supply,
  };

  const raw =
    input.agent.weights
      .sentiment *
      signals.sentiment +
    input.agent.weights
      .technical *
      signals.technical +
    input.agent.weights
      .fundamental *
      signals.fundamental +
    input.agent.weights
      .macro *
      signals.macro +
    input.agent.weights
      .liquidity *
      signals.liquidity +
    input.agent.weights
      .positioning *
      signals.positioning +
    input.agent.weights
      .supply *
      signals.supply;

  const persistent =
    input.priorSupport *
    input.agent.persistence;

  const innovation =
    raw *
    focusWeight(
      input.agent,
      input.focus,
    ) *
    (
      1 -
      input.agent.persistence *
        0.55
    );

  const noise =
    normalRandom(
      input.random,
    ) *
    input.agent
      .idiosyncraticNoise;

  return clamp(
    persistent +
      innovation +
      noise,
    -3,
    3,
  );
}

function simulationId(
  input: {
    userId: string;
    runId: string;
    scenario: AgentSimulationScenario;
    paths: number;
    seed: number;
  },
) {
  return createHash(
    "sha256",
  )
    .update(
      [
        input.userId,
        input.runId,
        input.scenario,
        input.paths,
        input.seed,
        SIMULATION_ENGINE_VERSION,
      ].join("|"),
    )
    .digest("hex")
    .slice(
      0,
      40,
    );
}

function scenarioDefinition(
  scenario: AgentSimulationScenario,
) {
  return SCENARIO_DEFINITIONS[
    scenario
  ];
}

function validateScenario(
  value: string,
): AgentSimulationScenario {
  return (
    AGENT_SIMULATION_SCENARIOS as readonly string[]
  ).includes(value)
    ? value as AgentSimulationScenario
    : "BASELINE";
}

function summarizeHistory(
  result: AgentSimulationResult,
) {
  return {
    averagePositiveProbability:
      round(
        average(
          result.horizons.map(
            (horizon) =>
              horizon.positiveReturnProbability,
          ),
        ),
        2,
      ),

    averageMedianReturnPercent:
      round(
        average(
          result.horizons.map(
            (horizon) =>
              horizon.quantiles.p50,
          ),
        ),
        4,
      ),

    maximumCrashProbability:
      round(
        Math.max(
          0,
          ...result.horizons.map(
            (horizon) =>
              horizon.crashProbability,
          ),
        ),
        2,
      ),

    maximumRallyProbability:
      round(
        Math.max(
          0,
          ...result.horizons.map(
            (horizon) =>
              horizon.rallyProbability,
          ),
        ),
        2,
      ),
  };
}

async function loadForecastRun(
  userId: string,
  runId: string,
): Promise<StoredForecastRun> {
  const run =
    await prisma.intelligenceForecastRun.findFirst({
      where: {
        id: runId,
        userId,
      },

      include: {
        horizons: {
          orderBy: {
            targetAt:
              "asc",
          },
        },
      },
    });

  if (!run) {
    throw new Error(
      "Forecast run was not found.",
    );
  }

  if (
    !run.horizons.length
  ) {
    throw new Error(
      "The forecast run does not contain horizon records.",
    );
  }

  return run;
}

function runHorizonSimulation(
  input: {
    run: StoredForecastRun;
    horizon: StoredHorizon;
    scenario: ScenarioDefinition;
    paths: number;
    seed: number;
  },
): SimulationHorizonResult {
  const steps =
    stepsForHorizon(
      input.horizon
        .horizon,
    );

  const focus =
    focusForHorizon(
      input.horizon
        .horizon,
    );

  const baseDirection =
    clamp(
      (
        input.horizon
          .positiveReturnProbability -
        50
      ) /
        50,
      -1,
      1,
    );

  const regime =
    regimeSignal(
      input.run
        .marketRegime,
    );

  const totalVolatility =
    Math.max(
      0.0025,
      Math.abs(
        input.horizon
          .volatilityPercent,
      ) /
        100,
    ) *
    input.scenario
      .shock
      .volatilityMultiplier;

  const stepVolatility =
    totalVolatility /
    Math.sqrt(
      steps,
    );

  const scenarioSupport =
    average([
      input.scenario
        .shock
        .sentiment,
      input.scenario
        .shock
        .technical,
      input.scenario
        .shock
        .fundamental,
      input.scenario
        .shock
        .macro,
      input.scenario
        .shock
        .liquidity,
      input.scenario
        .shock
        .positioning,
      input.scenario
        .shock
        .supply,
    ]);

  const driftTotal =
    input.horizon
      .expectedReturnPercent /
      100 +
    scenarioSupport *
      totalVolatility *
      0.65;

  const driftStep =
    driftTotal /
    steps;

  const returns:
    number[] = [];

  const maximumDrawdowns:
    number[] = [];

  const influenceTotals =
    new Map<
      string,
      number
    >();

  const signedTotals =
    new Map<
      string,
      number
    >();

  for (
    const agent of
      AGENTS
  ) {
    influenceTotals.set(
      agent.id,
      0,
    );

    signedTotals.set(
      agent.id,
      0,
    );
  }

  for (
    let pathIndex = 0;
    pathIndex <
    input.paths;
    pathIndex += 1
  ) {
    const random =
      createRandom(
        (
          input.seed +
          pathIndex *
            2_654_435_761 +
          hashToSeed(
            input.horizon
              .horizon,
          )
        ) >>>
        0,
      );

    let price =
      input.horizon
        .initialPrice;

    let peak =
      price;

    let maximumDrawdown =
      0;

    const priorSupports =
      new Map<
        string,
        number
      >();

    for (
      const agent of
        AGENTS
    ) {
      priorSupports.set(
        agent.id,
        0,
      );
    }

    for (
      let step = 0;
      step <
      steps;
      step += 1
    ) {
      let aggregateFlow =
        0;

      for (
        const agent of
          AGENTS
      ) {
        const support =
          agentSupport({
            agent,
            focus,
            baseDirection,
            regime,
            shock:
              input.scenario
                .shock,
            priorSupport:
              priorSupports.get(
                agent.id,
              ) ??
              0,
            random,
          });

        priorSupports.set(
          agent.id,
          support,
        );

        const action =
          Math.tanh(
            support *
            agent.conviction,
          );

        const flow =
          action *
          agent.impact *
          (
            0.65 +
            random() *
              0.7
          );

        aggregateFlow +=
          flow;

        influenceTotals.set(
          agent.id,
          (
            influenceTotals.get(
              agent.id,
            ) ??
            0
          ) +
            Math.abs(flow),
        );

        signedTotals.set(
          agent.id,
          (
            signedTotals.get(
              agent.id,
            ) ??
            0
          ) +
            flow,
        );
      }

      const normalizedFlow =
        aggregateFlow /
        AGENTS.length;

      const agentReturn =
        normalizedFlow *
        totalVolatility *
        0.42 *
        input.scenario
          .shock
          .agentImpactMultiplier /
        Math.sqrt(
          steps,
        );

      const stochasticReturn =
        normalRandom(
          random,
        ) *
        stepVolatility;

      const jumpOccurs =
        random() <
        input.scenario
          .shock
          .jumpProbability /
          steps;

      const jumpReturn =
        jumpOccurs
          ? (
              input.scenario
                .shock
                .jumpMeanPercent /
                100 +
              normalRandom(
                random,
              ) *
                stepVolatility *
                2
            )
          : 0;

      const stepReturn =
        clamp(
          driftStep +
            agentReturn +
            stochasticReturn +
            jumpReturn,
          -0.3,
          0.3,
        );

      price *=
        Math.exp(
          stepReturn,
        );

      peak =
        Math.max(
          peak,
          price,
        );

      const drawdown =
        peak > 0
          ? (
              peak -
              price
            ) /
            peak
          : 0;

      maximumDrawdown =
        Math.max(
          maximumDrawdown,
          drawdown,
        );
    }

    const totalReturn =
      (
        price /
          input.horizon
            .initialPrice -
        1
      ) *
      100;

    returns.push(
      totalReturn,
    );

    maximumDrawdowns.push(
      maximumDrawdown *
      100,
    );
  }

  returns.sort(
    (
      left,
      right,
    ) =>
      left -
      right,
  );

  maximumDrawdowns.sort(
    (
      left,
      right,
    ) =>
      left -
      right,
  );

  const meanReturn =
    average(
      returns,
    );

  const deviation =
    standardDeviation(
      returns,
    );

  const crashThreshold =
    -Math.max(
      5,
      Math.abs(
        input.horizon
          .volatilityPercent,
      ) *
        2,
    );

  const rallyThreshold =
    Math.max(
      5,
      Math.abs(
        input.horizon
          .volatilityPercent,
      ) *
        2,
    );

  const positiveCount =
    returns.filter(
      (value) =>
        value > 0,
    ).length;

  const crashCount =
    returns.filter(
      (value) =>
        value <=
        crashThreshold,
    ).length;

  const rallyCount =
    returns.filter(
      (value) =>
        value >=
        rallyThreshold,
    ).length;

  const totalInfluence =
    Array.from(
      influenceTotals.values(),
    ).reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  const agentInfluence =
    AGENTS.map(
      (
        agent,
      ): SimulationAgentInfluence => {
        const influence =
          influenceTotals.get(
            agent.id,
          ) ??
          0;

        const signed =
          signedTotals.get(
            agent.id,
          ) ??
          0;

        const normalizedSigned =
          signed /
          Math.max(
            input.paths *
              steps,
            1,
          );

        return {
          id:
            agent.id,

          label:
            agent.label,

          category:
            agent.category,

          influenceSharePercent:
            totalInfluence > 0
              ? round(
                  (
                    influence /
                    totalInfluence
                  ) *
                    100,
                  2,
                )
              : 0,

          signedSupport:
            round(
              normalizedSigned,
              4,
            ),

          dominantAction:
            normalizedSigned >
            0.025
              ? "Buy"
              : normalizedSigned <
                  -0.025
                ? "Sell"
                : "Neutral",
        };
      },
    ).sort(
      (
        left,
        right,
      ) =>
        right.influenceSharePercent -
        left.influenceSharePercent,
    );

  const buyingAgents =
    agentInfluence.filter(
      (agent) =>
        agent.dominantAction ===
        "Buy",
    ).length;

  const sellingAgents =
    agentInfluence.filter(
      (agent) =>
        agent.dominantAction ===
        "Sell",
    ).length;

  const dominantCount =
    Math.max(
      buyingAgents,
      sellingAgents,
    );

  const medianReturn =
    quantile(
      returns,
      0.5,
    );

  return {
    horizon:
      input.horizon
        .horizon,

    label:
      input.horizon
        .label,

    targetAt:
      input.horizon
        .targetAt
        .toISOString(),

    initialPrice:
      input.horizon
        .initialPrice,

    scenario:
      input.scenario
        .id,

    paths:
      input.paths,

    steps,

    positiveReturnProbability:
      round(
        (
          positiveCount /
          input.paths
        ) *
          100,
        2,
      ),

    meanReturnPercent:
      round(
        meanReturn,
        4,
      ),

    standardDeviationPercent:
      round(
        deviation,
        4,
      ),

    quantiles: {
      p05:
        round(
          quantile(
            returns,
            0.05,
          ),
          4,
        ),

      p10:
        round(
          quantile(
            returns,
            0.1,
          ),
          4,
        ),

      p25:
        round(
          quantile(
            returns,
            0.25,
          ),
          4,
        ),

      p50:
        round(
          medianReturn,
          4,
        ),

      p75:
        round(
          quantile(
            returns,
            0.75,
          ),
          4,
        ),

      p90:
        round(
          quantile(
            returns,
            0.9,
          ),
          4,
        ),

      p95:
        round(
          quantile(
            returns,
            0.95,
          ),
          4,
        ),
    },

    expectedPrice:
      round(
        input.horizon
          .initialPrice *
          (
            1 +
            meanReturn /
              100
          ),
        4,
      ),

    medianPrice:
      round(
        input.horizon
          .initialPrice *
          (
            1 +
            medianReturn /
              100
          ),
        4,
      ),

    priceRangeP10:
      round(
        input.horizon
          .initialPrice *
          (
            1 +
            quantile(
              returns,
              0.1,
            ) /
              100
          ),
        4,
      ),

    priceRangeP90:
      round(
        input.horizon
          .initialPrice *
          (
            1 +
            quantile(
              returns,
              0.9,
            ) /
              100
          ),
        4,
      ),

    crashThresholdPercent:
      round(
        crashThreshold,
        2,
      ),

    rallyThresholdPercent:
      round(
        rallyThreshold,
        2,
      ),

    crashProbability:
      round(
        (
          crashCount /
          input.paths
        ) *
          100,
        2,
      ),

    rallyProbability:
      round(
        (
          rallyCount /
          input.paths
        ) *
          100,
        2,
      ),

    averageMaximumDrawdownPercent:
      round(
        average(
          maximumDrawdowns,
        ),
        4,
      ),

    maximumDrawdownP90Percent:
      round(
        quantile(
          maximumDrawdowns,
          0.9,
        ),
        4,
      ),

    agentAgreementPercent:
      round(
        (
          dominantCount /
          AGENTS.length
        ) *
          100,
        2,
      ),

    netAgentSupport:
      round(
        average(
          agentInfluence.map(
            (agent) =>
              agent.signedSupport,
          ),
        ),
        4,
      ),

    agentInfluence,
  };
}

async function persistSimulationResult(
  input: {
    userId: string;
    result: AgentSimulationResult;
  },
) {
  const eventKey = [
    "agent-simulation",
    input.result
      .forecastRunId,
    input.result
      .scenario
      .id,
    input.result
      .configuration
      .paths,
    input.result
      .configuration
      .seed,
    input.result
      .engineVersion,
  ].join(":");

  await prisma.backendPlatformEvent.upsert({
    where: {
      userId_eventKey: {
        userId:
          input.userId,
        eventKey,
      },
    },

    update: {
      eventType:
        SIMULATION_EVENT_TYPE,

      area:
        "Market Intelligence",

      title:
        `${input.result.symbol} ${input.result.scenario.label} agent simulation`,

      detail:
        `${input.result.configuration.paths} deterministic paths across ${input.result.horizons.length} horizons.`,

      severity:
        "Info",

      status:
        "Recorded",

      sourceType:
        "IntelligenceForecastRun",

      sourceId:
        input.result
          .forecastRunId,

      metadataJson:
        safeJson(
          input.result,
          "{}",
        ),
    },

    create: {
      userId:
        input.userId,

      eventKey,

      eventType:
        SIMULATION_EVENT_TYPE,

      area:
        "Market Intelligence",

      title:
        `${input.result.symbol} ${input.result.scenario.label} agent simulation`,

      detail:
        `${input.result.configuration.paths} deterministic paths across ${input.result.horizons.length} horizons.`,

      severity:
        "Info",

      status:
        "Recorded",

      sourceType:
        "IntelligenceForecastRun",

      sourceId:
        input.result
          .forecastRunId,

      metadataJson:
        safeJson(
          input.result,
          "{}",
        ),
    },
  });

  return eventKey;
}

export async function runAgentSimulation(
  input: {
    userId: string;
    runId: string;
    scenario?: string;
    paths?: number;
    seed?: number;
    request?: Request;
  },
) {
  const run =
    await loadForecastRun(
      input.userId,
      input.runId,
    );

  const scenario =
    validateScenario(
      input.scenario ??
      "BASELINE",
    );

  const paths =
    Math.max(
      MINIMUM_PATHS,
      Math.min(
        MAXIMUM_PATHS,
        Math.round(
          input.paths ??
          250,
        ),
      ),
    );

  const seed =
    Number.isFinite(
      input.seed,
    )
      ? (
          Math.round(
            input.seed ??
            0,
          ) >>>
          0
        )
      : hashToSeed(
          [
            input.userId,
            run.id,
            scenario,
            paths,
          ].join("|"),
        );

  const definition =
    scenarioDefinition(
      scenario,
    );

  const identifier =
    simulationId({
      userId:
        input.userId,
      runId:
        run.id,
      scenario,
      paths,
      seed,
    });

  const horizons =
    run.horizons.map(
      (horizon) =>
        runHorizonSimulation({
          run,
          horizon,
          scenario:
            definition,
          paths,
          seed:
            (
              seed +
              hashToSeed(
                horizon.horizon,
              )
            ) >>>
            0,
        }),
    );

  const result:
    AgentSimulationResult = {
    schemaVersion:
      "slice-agent-simulation-2.0.0",

    simulationId:
      identifier,

    generatedAt:
      new Date().toISOString(),

    replayFingerprint:
      identifier,

    engineVersion:
      SIMULATION_ENGINE_VERSION,

    userScoped:
      true,

    forecastRunId:
      run.id,

    requestId:
      run.requestId,

    symbol:
      run.symbol,

    sourceModelVersion:
      run.modelVersion,

    sourceEngineVersion:
      run.engineVersion,

    sourceCalibrationVersion:
      run.calibrationVersion,

    marketRegime:
      run.marketRegime,

    scenario:
      definition,

    configuration: {
      paths,
      seed,
      agentCount:
        AGENTS.length,
      horizonCount:
        horizons.length,
    },

    sourceForecast: {
      generatedAt:
        run.generatedAt.toISOString(),
      asOfAt:
        run.asOfAt.toISOString(),
      sliceSentimentScore:
        run.sliceSentimentScore,
      dataQualityScore:
        run.dataQualityScore,
      camelStatus:
        run.camelStatus,
      camelWorkforceMode:
        run.camelWorkforceMode,
      status:
        run.status,
    },

    horizons,

    safeguards: {
      autonomousTradingEnabled:
        false,

      simulationIsObservedTruth:
        false,

      simulationIsGuaranteedOutcome:
        false,

      simulationCanMoveFunds:
        false,

      deterministicReplaySupported:
        true,

      decisionSupportOnly:
        true,
    },
  };

  const eventKey =
    await persistSimulationResult({
      userId:
        input.userId,
      result,
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_AGENT_SIMULATION_COMPLETED",

    severity:
      "Info",

    area:
      "Market Intelligence",

    title:
      `Completed ${run.symbol} ${definition.label} simulation`,

    detail:
      `${paths} deterministic paths were simulated across ${horizons.length} horizons using ${AGENTS.length} participant archetypes.`,

    metadata: {
      eventKey,
      simulationId:
        identifier,
      forecastRunId:
        run.id,
      requestId:
        run.requestId,
      symbol:
        run.symbol,
      scenario,
      paths,
      seed,
      engineVersion:
        SIMULATION_ENGINE_VERSION,
      autonomousTradingEnabled:
        false,
      simulationIsObservedTruth:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return result;
}

function parseStoredSimulation(
  value: string,
): AgentSimulationResult | null {
  const parsed =
    parseJson(value);

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !==
      "slice-agent-simulation-2.0.0"
  ) {
    return null;
  }

  return parsed as unknown as AgentSimulationResult;
}

export async function replayAgentSimulation(
  input: {
    userId: string;
    eventId: string;
    request?: Request;
  },
) {
  const event =
    await prisma.backendPlatformEvent.findFirst({
      where: {
        id:
          input.eventId,
        userId:
          input.userId,
        eventType:
          SIMULATION_EVENT_TYPE,
      },
    });

  if (!event) {
    throw new Error(
      "Stored simulation was not found.",
    );
  }

  const stored =
    parseStoredSimulation(
      event.metadataJson,
    );

  if (!stored) {
    throw new Error(
      "Stored simulation metadata is invalid.",
    );
  }

  return runAgentSimulation({
    userId:
      input.userId,
    runId:
      stored.forecastRunId,
    scenario:
      stored.scenario.id,
    paths:
      stored.configuration.paths,
    seed:
      stored.configuration.seed,
    request:
      input.request,
  });
}

export async function getAgentSimulationOverview(
  input: {
    userId: string;
    runLimit?: number;
    historyLimit?: number;
  },
) {
  const runLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.runLimit ??
          50,
        ),
      ),
    );

  const historyLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.historyLimit ??
          30,
        ),
      ),
    );

  const [
    forecastRuns,
    events,
  ] =
    await Promise.all([
      prisma.intelligenceForecastRun.findMany({
        where: {
          userId:
            input.userId,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        take:
          runLimit,

        select: {
          id:
            true,
          requestId:
            true,
          symbol:
            true,
          generatedAt:
            true,
          modelVersion:
            true,
          marketRegime:
            true,
          status:
            true,
          horizons: {
            select: {
              id:
                true,
              horizon:
                true,
              label:
                true,
              targetAt:
                true,
              initialPrice:
                true,
              direction:
                true,
              positiveReturnProbability:
                true,
              expectedReturnPercent:
                true,
              volatilityPercent:
                true,
              confidence:
                true,
              status:
                true,
            },

            orderBy: {
              targetAt:
                "asc",
            },
          },
        },
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId:
            input.userId,
          eventType:
            SIMULATION_EVENT_TYPE,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          historyLimit,
      }),
    ]);

  const history:
    AgentSimulationHistoryItem[] = [];

  let latestResult:
    AgentSimulationResult | null =
    null;

  for (
    const event of
      events
  ) {
    const simulation =
      parseStoredSimulation(
        event.metadataJson,
      );

    if (!simulation) {
      continue;
    }

    if (!latestResult) {
      latestResult =
        simulation;
    }

    history.push({
      id:
        event.id,

      eventKey:
        event.eventKey,

      forecastRunId:
        simulation.forecastRunId,

      symbol:
        simulation.symbol,

      scenario:
        simulation.scenario.id,

      paths:
        simulation.configuration.paths,

      seed:
        simulation.configuration.seed,

      generatedAt:
        simulation.generatedAt,

      replayFingerprint:
        simulation.replayFingerprint,

      horizonCount:
        simulation.horizons.length,

      summary:
        summarizeHistory(
          simulation,
        ),
    });
  }

  return {
    generatedAt:
      new Date().toISOString(),

    engineVersion:
      SIMULATION_ENGINE_VERSION,

    scenarios:
      Object.values(
        SCENARIO_DEFINITIONS,
      ),

    agents:
      AGENTS.map(
        (agent) => ({
          id:
            agent.id,
          label:
            agent.label,
          category:
            agent.category,
          description:
            agent.description,
        }),
      ),

    limits: {
      minimumPaths:
        MINIMUM_PATHS,
      maximumPaths:
        MAXIMUM_PATHS,
    },

    forecastRuns,

    history,

    latestResult,

    safeguards: {
      autonomousTradingEnabled:
        false,
      simulationIsObservedTruth:
        false,
      deterministicReplaySupported:
        true,
      decisionSupportOnly:
        true,
    },
  };
}