import "server-only";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  ensureUserSecuritySetting,
  recordAuditLog,
} from "@/lib/audit";

import {
  prisma,
} from "@/lib/prisma";

const USAGE_EVENT_TYPE =
  "INTELLIGENCE_OPERATION_USAGE";

const FAILURE_EVENT_TYPE =
  "INTELLIGENCE_OPERATION_FAILURE";

const CIRCUIT_EVENT_TYPE =
  "INTELLIGENCE_CIRCUIT_STATE";

const INCIDENT_EVENT_TYPE =
  "INTELLIGENCE_SECURITY_INCIDENT";

const BUDGET_EVENT_TYPE =
  "INTELLIGENCE_BUDGET_POLICY";

const HEALTH_EVENT_TYPE =
  "INTELLIGENCE_PRODUCTION_HEALTH_SCAN";

const DEFAULT_DAILY_BUDGET_USD =
  8;

const DEFAULT_BUDGET_WARNING_PERCENT =
  70;

const CIRCUIT_FAILURE_THRESHOLD =
  5;

const CIRCUIT_FAILURE_WINDOW_MINUTES =
  10;

const CIRCUIT_OPEN_MINUTES =
  15;

type JsonRecord =
  Record<string, unknown>;

export type IntelligenceOperation =
  | "forecast.generate"
  | "advisor.chat"
  | "advisor.brief"
  | "simulation.run"
  | "horizon-model.train"
  | "ensemble.train"
  | "ensemble.generate"
  | "graph.sync"
  | "warehouse.audit"
  | "security.scan";

type OperationPolicy = {
  operation:
    IntelligenceOperation;

  service:
    string;

  perMinute:
    number;

  perDay:
    number;

  estimatedCostUsd:
    number;

  description:
    string;
};

type BudgetPolicy = {
  dailyEstimatedCostLimitUsd:
    number;

  warningPercent:
    number;

  hardStopEnabled:
    boolean;

  updatedAt:
    string;
};

export type OperationGuardTicket = {
  eventId:
    string;

  requestId:
    string;

  operation:
    IntelligenceOperation;

  service:
    string;

  estimatedCostUsd:
    number;

  startedAt:
    string;
};

export type ProductionHealthCheck = {
  key:
    string;

  label:
    string;

  status:
    "Healthy" | "Warning" | "Critical";

  detail:
    string;

  remediation:
    string;
};

const OPERATION_POLICIES:
  Record<
    IntelligenceOperation,
    OperationPolicy
  > = {
    "forecast.generate": {
      operation:
        "forecast.generate",

      service:
        "forecast-engine",

      perMinute:
        6,

      perDay:
        150,

      estimatedCostUsd:
        0.03,

      description:
        "Full forecast generation including CAMEL-AI and persistence.",
    },

    "advisor.chat": {
      operation:
        "advisor.chat",

      service:
        "advisor-ai",

      perMinute:
        12,

      perDay:
        250,

      estimatedCostUsd:
        0.012,

      description:
        "Advisor-bot reasoning request.",
    },

    "advisor.brief": {
      operation:
        "advisor.brief",

      service:
        "advisor-ai",

      perMinute:
        2,

      perDay:
        10,

      estimatedCostUsd:
        0.025,

      description:
        "Advisor morning-brief generation.",
    },

    "simulation.run": {
      operation:
        "simulation.run",

      service:
        "agent-simulation",

      perMinute:
        4,

      perDay:
        50,

      estimatedCostUsd:
        0.015,

      description:
        "Heterogeneous-agent scenario simulation.",
    },

    "horizon-model.train": {
      operation:
        "horizon-model.train",

      service:
        "horizon-training",

      perMinute:
        1,

      perDay:
        4,

      estimatedCostUsd:
        0.04,

      description:
        "Horizon-specific model training.",
    },

    "ensemble.train": {
      operation:
        "ensemble.train",

      service:
        "ensemble-training",

      perMinute:
        1,

      perDay:
        4,

      estimatedCostUsd:
        0.05,

      description:
        "Ensemble optimization and ablation training.",
    },

    "ensemble.generate": {
      operation:
        "ensemble.generate",

      service:
        "ensemble-engine",

      perMinute:
        8,

      perDay:
        200,

      estimatedCostUsd:
        0.008,

      description:
        "Shadow ensemble generation for one stored forecast.",
    },

    "graph.sync": {
      operation:
        "graph.sync",

      service:
        "neo4j",

      perMinute:
        8,

      perDay:
        250,

      estimatedCostUsd:
        0.004,

      description:
        "Neo4j provenance synchronization.",
    },

    "warehouse.audit": {
      operation:
        "warehouse.audit",

      service:
        "evidence-warehouse",

      perMinute:
        8,

      perDay:
        300,

      estimatedCostUsd:
        0.003,

      description:
        "Point-in-time evidence audit.",
    },

    "security.scan": {
      operation:
        "security.scan",

      service:
        "production-controls",

      perMinute:
        4,

      perDay:
        100,

      estimatedCostUsd:
        0.001,

      description:
        "Production security and health scan.",
    },
  };

export class IntelligenceGuardError extends Error {
  readonly code:
    string;

  readonly status:
    number;

  readonly retryAfterSeconds:
    number | null;

  constructor(input: {
    message:
      string;

    code:
      string;

    status:
      number;

    retryAfterSeconds?:
      number | null;
  }) {
    super(
      input.message,
    );

    this.name =
      "IntelligenceGuardError";

    this.code =
      input.code;

    this.status =
      input.status;

    this.retryAfterSeconds =
      input.retryAfterSeconds ??
      null;
  }
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

function parseJson(
  value: string,
): unknown {
  try {
    return JSON.parse(
      value,
    ) as unknown;
  } catch {
    return null;
  }
}

function safeJson(
  value: unknown,
  fallback: string,
) {
  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return fallback;
  }
}

function cleanText(
  value: unknown,
  maximumLength:
    number,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maximumLength,
        )
    : "";
}

function finiteNumber(
  value: unknown,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
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
      value *
      factor,
    ) /
    factor
  );
}

function utcDayStart(
  date = new Date(),
) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

function shortUserHash(
  userId: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      userId,
    )
    .digest(
      "hex",
    )
    .slice(
      0,
      20,
    );
}

function requestFingerprint(
  request?: Request,
) {
  if (!request) {
    return null;
  }

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    ) ??
    "";

  const realIp =
    request.headers.get(
      "x-real-ip",
    ) ??
    "";

  const userAgent =
    request.headers.get(
      "user-agent",
    ) ??
    "";

  const raw =
    [
      forwardedFor,
      realIp,
      userAgent,
      process.env
        .INTELLIGENCE_LOG_SALT ??
        "slice-local-log-salt",
    ].join(
      "|",
    );

  if (
    !forwardedFor &&
    !realIp &&
    !userAgent
  ) {
    return null;
  }

  return createHash(
    "sha256",
  )
    .update(
      raw,
    )
    .digest(
      "hex",
    )
    .slice(
      0,
      32,
    );
}

function operationPolicy(
  operation:
    IntelligenceOperation,
) {
  return OPERATION_POLICIES[
    operation
  ];
}

function defaultBudgetPolicy():
  BudgetPolicy {
  return {
    dailyEstimatedCostLimitUsd:
      DEFAULT_DAILY_BUDGET_USD,

    warningPercent:
      DEFAULT_BUDGET_WARNING_PERCENT,

    hardStopEnabled:
      true,

    updatedAt:
      new Date().toISOString(),
  };
}

async function getBudgetPolicy(
  userId: string,
) {
  const event =
    await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId,

          eventKey:
            "intelligence-budget-policy",
        },
      },
    });

  if (!event) {
    return defaultBudgetPolicy();
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return defaultBudgetPolicy();
  }

  return {
    dailyEstimatedCostLimitUsd:
      Math.max(
        0.1,
        finiteNumber(
          parsed.dailyEstimatedCostLimitUsd,
          DEFAULT_DAILY_BUDGET_USD,
        ),
      ),

    warningPercent:
      clamp(
        finiteNumber(
          parsed.warningPercent,
          DEFAULT_BUDGET_WARNING_PERCENT,
        ),
        1,
        100,
      ),

    hardStopEnabled:
      parsed.hardStopEnabled !==
      false,

    updatedAt:
      cleanText(
        parsed.updatedAt,
        100,
      ) ||
      event.updatedAt.toISOString(),
  } satisfies BudgetPolicy;
}

export async function updateIntelligenceBudgetPolicy(
  input: {
    userId:
      string;

    dailyEstimatedCostLimitUsd:
      number;

    warningPercent:
      number;

    hardStopEnabled:
      boolean;

    request?:
      Request;
  },
) {
  const policy:
    BudgetPolicy = {
    dailyEstimatedCostLimitUsd:
      round(
        clamp(
          input.dailyEstimatedCostLimitUsd,
          0.1,
          10_000,
        ),
        2,
      ),

    warningPercent:
      round(
        clamp(
          input.warningPercent,
          1,
          100,
        ),
        0,
      ),

    hardStopEnabled:
      input.hardStopEnabled,

    updatedAt:
      new Date().toISOString(),
  };

  const event =
    await prisma.backendPlatformEvent.upsert({
      where: {
        userId_eventKey: {
          userId:
            input.userId,

          eventKey:
            "intelligence-budget-policy",
        },
      },

      update: {
        eventType:
          BUDGET_EVENT_TYPE,

        area:
          "Security",

        title:
          "Intelligence estimated-cost budget",

        detail:
          `Daily estimated-cost limit: $${policy.dailyEstimatedCostLimitUsd.toFixed(
            2,
          )}.`,

        severity:
          "Info",

        status:
          "Active",

        sourceType:
          "BudgetPolicy",

        metadataJson:
          safeJson(
            policy,
            "{}",
          ),
      },

      create: {
        userId:
          input.userId,

        eventKey:
          "intelligence-budget-policy",

        eventType:
          BUDGET_EVENT_TYPE,

        area:
          "Security",

        title:
          "Intelligence estimated-cost budget",

        detail:
          `Daily estimated-cost limit: $${policy.dailyEstimatedCostLimitUsd.toFixed(
            2,
          )}.`,

        severity:
          "Info",

        status:
          "Active",

        sourceType:
          "BudgetPolicy",

        sourceId:
          null,

        metadataJson:
          safeJson(
            policy,
            "{}",
          ),
      },
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_BUDGET_POLICY_UPDATED",

    severity:
      "Info",

    area:
      "Security",

    title:
      "Updated intelligence estimated-cost budget",

    detail:
      event.detail ??
      undefined,

    metadata: {
      ...policy,

      estimatedCostOnly:
        true,

      vendorInvoiceReconciliationRequired:
        true,
    },

    request:
      input.request,
  });

  return {
    event,

    policy,
  };
}

function circuitEventKey(
  service: string,
) {
  return `intelligence-circuit:${service}`;
}

function parseCircuitMetadata(
  value: string,
) {
  const parsed =
    parseJson(value);

  if (!isRecord(parsed)) {
    return {
      service:
        "",

      state:
        "Closed",

      reason:
        "",

      openedAt:
        null,

      openUntil:
        null,

      updatedAt:
        null,

      automatic:
        false,
    };
  }

  return {
    service:
      cleanText(
        parsed.service,
        100,
      ),

    state:
      parsed.state ===
      "Open"
        ? "Open"
        : "Closed",

    reason:
      cleanText(
        parsed.reason,
        2_000,
      ),

    openedAt:
      typeof parsed.openedAt ===
      "string"
        ? parsed.openedAt
        : null,

    openUntil:
      typeof parsed.openUntil ===
      "string"
        ? parsed.openUntil
        : null,

    updatedAt:
      typeof parsed.updatedAt ===
      "string"
        ? parsed.updatedAt
        : null,

    automatic:
      parsed.automatic ===
      true,
  };
}

export async function setIntelligenceCircuitState(
  input: {
    userId:
      string;

    service:
      string;

    state:
      "Open" | "Closed";

    reason:
      string;

    minutes?:
      number;

    automatic?:
      boolean;

    request?:
      Request;
  },
) {
  const service =
    cleanText(
      input.service,
      100,
    );

  if (!service) {
    throw new Error(
      "A service name is required.",
    );
  }

  const now =
    new Date();

  const minutes =
    Math.round(
      clamp(
        input.minutes ??
        CIRCUIT_OPEN_MINUTES,
        1,
        1_440,
      ),
    );

  const metadata = {
    service,

    state:
      input.state,

    reason:
      cleanText(
        input.reason,
        2_000,
      ) ||
      (
        input.state ===
        "Open"
          ? "Circuit opened."
          : "Circuit closed."
      ),

    openedAt:
      input.state ===
      "Open"
        ? now.toISOString()
        : null,

    openUntil:
      input.state ===
      "Open"
        ? new Date(
            now.getTime() +
            minutes *
            60 *
            1_000,
          ).toISOString()
        : null,

    updatedAt:
      now.toISOString(),

    automatic:
      input.automatic ===
      true,
  };

  const event =
    await prisma.backendPlatformEvent.upsert({
      where: {
        userId_eventKey: {
          userId:
            input.userId,

          eventKey:
            circuitEventKey(
              service,
            ),
        },
      },

      update: {
        eventType:
          CIRCUIT_EVENT_TYPE,

        area:
          "Security",

        title:
          `${service} circuit ${input.state.toLowerCase()}`,

        detail:
          metadata.reason,

        severity:
          input.state ===
          "Open"
            ? "Critical"
            : "Info",

        status:
          input.state,

        sourceType:
          service,

        metadataJson:
          safeJson(
            metadata,
            "{}",
          ),
      },

      create: {
        userId:
          input.userId,

        eventKey:
          circuitEventKey(
            service,
          ),

        eventType:
          CIRCUIT_EVENT_TYPE,

        area:
          "Security",

        title:
          `${service} circuit ${input.state.toLowerCase()}`,

        detail:
          metadata.reason,

        severity:
          input.state ===
          "Open"
            ? "Critical"
            : "Info",

        status:
          input.state,

        sourceType:
          service,

        sourceId:
          null,

        metadataJson:
          safeJson(
            metadata,
            "{}",
          ),
      },
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      input.state ===
      "Open"
        ? "INTELLIGENCE_CIRCUIT_OPENED"
        : "INTELLIGENCE_CIRCUIT_CLOSED",

    severity:
      input.state ===
      "Open"
        ? "Critical"
        : "Info",

    area:
      "Security",

    title:
      event.title,

    detail:
      metadata.reason,

    metadata,

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    event,

    metadata,
  };
}

async function getActiveCircuit(
  userId: string,
  service: string,
) {
  const event =
    await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId,

          eventKey:
            circuitEventKey(
              service,
            ),
        },
      },
    });

  if (!event) {
    return null;
  }

  const metadata =
    parseCircuitMetadata(
      event.metadataJson,
    );

  if (
    metadata.state !==
    "Open"
  ) {
    return null;
  }

  const openUntil =
    metadata.openUntil
      ? new Date(
          metadata.openUntil,
        )
      : null;

  if (
    openUntil &&
    Number.isFinite(
      openUntil.getTime(),
    ) &&
    openUntil.getTime() <=
    Date.now()
  ) {
    await setIntelligenceCircuitState({
      userId,

      service,

      state:
        "Closed",

      reason:
        "Automatic circuit timeout expired.",

      automatic:
        true,
    }).catch(
      console.error,
    );

    return null;
  }

  return {
    event,

    metadata,
  };
}

async function dailyUsage(
  userId: string,
) {
  const start =
    utcDayStart();

  const events =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId,

        eventType:
          USAGE_EVENT_TYPE,

        createdAt: {
          gte:
            start,
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        10_000,

      select: {
        id:
          true,

        sourceType:
          true,

        status:
          true,

        createdAt:
          true,

        metadataJson:
          true,
      },
    });

  let estimatedCostUsd =
    0;

  const byOperation =
    new Map<
      string,
      {
        count:
          number;

        estimatedCostUsd:
          number;

        completed:
          number;

        failed:
          number;
      }
    >();

  for (
    const event of
      events
  ) {
    const parsed =
      parseJson(
        event.metadataJson,
      );

    const metadata =
      isRecord(parsed)
        ? parsed
        : {};

    const estimatedCost =
      Math.max(
        0,
        finiteNumber(
          metadata.estimatedCostUsd,
          0,
        ),
      );

    estimatedCostUsd +=
      estimatedCost;

    const operation =
      event.sourceType ??
      "unknown";

    const summary =
      byOperation.get(
        operation,
      ) ?? {
        count:
          0,

        estimatedCostUsd:
          0,

        completed:
          0,

        failed:
          0,
      };

    summary.count +=
      1;

    summary.estimatedCostUsd +=
      estimatedCost;

    if (
      event.status ===
      "Completed"
    ) {
      summary.completed +=
        1;
    }

    if (
      event.status ===
      "Failed"
    ) {
      summary.failed +=
        1;
    }

    byOperation.set(
      operation,
      summary,
    );
  }

  return {
    dayStart:
      start.toISOString(),

    operationCount:
      events.length,

    estimatedCostUsd:
      round(
        estimatedCostUsd,
        4,
      ),

    byOperation:
      Array.from(
        byOperation.entries(),
      )
        .map(
          ([
            operation,
            summary,
          ]) => ({
            operation,

            count:
              summary.count,

            estimatedCostUsd:
              round(
                summary.estimatedCostUsd,
                4,
              ),

            completed:
              summary.completed,

            failed:
              summary.failed,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.estimatedCostUsd -
            left.estimatedCostUsd,
        ),

    events,
  };
}

export async function guardIntelligenceOperation(
  input: {
    userId:
      string;

    operation:
      IntelligenceOperation;

    request?:
      Request;
  },
): Promise<OperationGuardTicket> {
  const policy =
    operationPolicy(
      input.operation,
    );

  const [
    budget,
    circuit,
  ] =
    await Promise.all([
      getBudgetPolicy(
        input.userId,
      ),

      getActiveCircuit(
        input.userId,
        policy.service,
      ),
    ]);

  if (circuit) {
    const openUntil =
      circuit.metadata
        .openUntil
        ? new Date(
            circuit.metadata.openUntil,
          )
        : null;

    const retryAfter =
      openUntil &&
      Number.isFinite(
        openUntil.getTime(),
      )
        ? Math.max(
            1,
            Math.ceil(
              (
                openUntil.getTime() -
                Date.now()
              ) /
              1_000,
            ),
          )
        : 60;

    throw new IntelligenceGuardError({
      message:
        `${policy.service} is temporarily unavailable because its circuit breaker is open.`,

      code:
        "CIRCUIT_OPEN",

      status:
        503,

      retryAfterSeconds:
        retryAfter,
    });
  }

  const now =
    new Date();

  const minuteStart =
    new Date(
      now.getTime() -
      60 *
      1_000,
    );

  const dayStart =
    utcDayStart(
      now,
    );

  const [
    minuteCount,
    dayCount,
    usage,
  ] =
    await Promise.all([
      prisma.backendPlatformEvent.count({
        where: {
          userId:
            input.userId,

          eventType:
            USAGE_EVENT_TYPE,

          sourceType:
            input.operation,

          createdAt: {
            gte:
              minuteStart,
          },
        },
      }),

      prisma.backendPlatformEvent.count({
        where: {
          userId:
            input.userId,

          eventType:
            USAGE_EVENT_TYPE,

          sourceType:
            input.operation,

          createdAt: {
            gte:
              dayStart,
          },
        },
      }),

      dailyUsage(
        input.userId,
      ),
    ]);

  if (
    minuteCount >=
    policy.perMinute
  ) {
    throw new IntelligenceGuardError({
      message:
        `The ${input.operation} per-minute limit has been reached.`,

      code:
        "RATE_LIMIT_MINUTE",

      status:
        429,

      retryAfterSeconds:
        60,
    });
  }

  if (
    dayCount >=
    policy.perDay
  ) {
    const tomorrow =
      new Date(
        dayStart.getTime() +
        24 *
        60 *
        60 *
        1_000,
      );

    throw new IntelligenceGuardError({
      message:
        `The ${input.operation} daily operation limit has been reached.`,

      code:
        "RATE_LIMIT_DAY",

      status:
        429,

      retryAfterSeconds:
        Math.max(
          60,
          Math.ceil(
            (
              tomorrow.getTime() -
              Date.now()
            ) /
            1_000,
          ),
        ),
    });
  }

  const projectedCost =
    usage.estimatedCostUsd +
    policy.estimatedCostUsd;

  if (
    budget.hardStopEnabled &&
    projectedCost >
    budget.dailyEstimatedCostLimitUsd
  ) {
    throw new IntelligenceGuardError({
      message:
        "The daily estimated intelligence-cost budget has been reached.",

      code:
        "DAILY_COST_BUDGET",

      status:
        429,

      retryAfterSeconds:
        Math.max(
          60,
          Math.ceil(
            (
              new Date(
                dayStart.getTime() +
                24 *
                60 *
                60 *
                1_000,
              ).getTime() -
              Date.now()
            ) /
            1_000,
          ),
        ),
    });
  }

  const requestId =
    input.request
      ?.headers
      .get(
        "x-request-id",
      )
      ?.trim() ||
    randomUUID();

  const eventKey = [
    "intelligence-operation",
    input.operation,
    Date.now(),
    randomUUID(),
  ].join(
    ":",
  );

  const startedAt =
    new Date().toISOString();

  const event =
    await prisma.backendPlatformEvent.create({
      data: {
        userId:
          input.userId,

        eventKey,

        eventType:
          USAGE_EVENT_TYPE,

        area:
          "Market Intelligence",

        actorName:
          "Authenticated user",

        title:
          `${input.operation} started`,

        detail:
          policy.description,

        severity:
          "Info",

        status:
          "Running",

        sourceType:
          input.operation,

        sourceId:
          requestId,

        metadataJson:
          safeJson(
            {
              requestId,

              operation:
                input.operation,

              service:
                policy.service,

              estimatedCostUsd:
                policy.estimatedCostUsd,

              startedAt,

              requestFingerprint:
                requestFingerprint(
                  input.request,
                ),

              limits: {
                perMinute:
                  policy.perMinute,

                perDay:
                  policy.perDay,

                dailyEstimatedCostLimitUsd:
                  budget.dailyEstimatedCostLimitUsd,
              },

              estimatedCostOnly:
                true,

              autonomousTradingEnabled:
                false,
            },
            "{}",
          ),
      },
    });

  return {
    eventId:
      event.id,

    requestId,

    operation:
      input.operation,

    service:
      policy.service,

    estimatedCostUsd:
      policy.estimatedCostUsd,

    startedAt,
  };
}

export async function completeIntelligenceOperation(
  input: {
    userId:
      string;

    ticket:
      OperationGuardTicket;

    success:
      boolean;

    detail?:
      string;

    actualEstimatedCostUsd?:
      number;

    error?:
      unknown;

    request?:
      Request;
  },
) {
  const event =
    await prisma.backendPlatformEvent.findFirst({
      where: {
        id:
          input.ticket.eventId,

        userId:
          input.userId,
      },
    });

  if (!event) {
    return null;
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  const existing =
    isRecord(parsed)
      ? parsed
      : {};

  const completedAt =
    new Date();

  const startedAt =
    new Date(
      input.ticket.startedAt,
    );

  const durationMs =
    Number.isFinite(
      startedAt.getTime(),
    )
      ? Math.max(
          0,
          completedAt.getTime() -
          startedAt.getTime(),
        )
      : 0;

  const errorMessage =
    input.error instanceof Error
      ? input.error.message
      : input.error
        ? String(
            input.error,
          ).slice(
            0,
            2_000,
          )
        : null;

  const estimatedCostUsd =
    Math.max(
      0,
      input.actualEstimatedCostUsd ??
      input.ticket.estimatedCostUsd,
    );

  const updated =
    await prisma.backendPlatformEvent.update({
      where: {
        id:
          event.id,
      },

      data: {
        title:
          `${input.ticket.operation} ${
            input.success
              ? "completed"
              : "failed"
          }`,

        detail:
          cleanText(
            input.detail,
            2_000,
          ) ||
          errorMessage ||
          event.detail,

        severity:
          input.success
            ? "Info"
            : "Warning",

        status:
          input.success
            ? "Completed"
            : "Failed",

        metadataJson:
          safeJson(
            {
              ...existing,

              completedAt:
                completedAt.toISOString(),

              durationMs,

              success:
                input.success,

              estimatedCostUsd:
                round(
                  estimatedCostUsd,
                  6,
                ),

              error:
                errorMessage,
            },
            "{}",
          ),
      },
    });

  if (input.success) {
    return updated;
  }

  await prisma.backendPlatformEvent.create({
    data: {
      userId:
        input.userId,

      eventKey: [
        "intelligence-operation-failure",
        input.ticket.service,
        Date.now(),
        randomUUID(),
      ].join(
        ":",
      ),

      eventType:
        FAILURE_EVENT_TYPE,

      area:
        "Security",

      actorName:
        "Production guard",

      title:
        `${input.ticket.service} operation failure`,

      detail:
        errorMessage ??
        "Unknown operation failure.",

      severity:
        "Warning",

      status:
        "Open",

      sourceType:
        input.ticket.service,

      sourceId:
        input.ticket.eventId,

      metadataJson:
        safeJson(
          {
            operation:
              input.ticket.operation,

            service:
              input.ticket.service,

            requestId:
              input.ticket.requestId,

            failedAt:
              completedAt.toISOString(),

            durationMs,

            error:
              errorMessage,
          },
          "{}",
        ),
    },
  });

  const failureWindowStart =
    new Date(
      Date.now() -
      CIRCUIT_FAILURE_WINDOW_MINUTES *
      60 *
      1_000,
    );

  const recentFailures =
    await prisma.backendPlatformEvent.count({
      where: {
        userId:
          input.userId,

        eventType:
          FAILURE_EVENT_TYPE,

        sourceType:
          input.ticket.service,

        createdAt: {
          gte:
            failureWindowStart,
        },
      },
    });

  if (
    recentFailures >=
    CIRCUIT_FAILURE_THRESHOLD
  ) {
    await setIntelligenceCircuitState({
      userId:
        input.userId,

      service:
        input.ticket.service,

      state:
        "Open",

      reason:
        `${recentFailures} failures occurred within ${CIRCUIT_FAILURE_WINDOW_MINUTES} minutes.`,

      minutes:
        CIRCUIT_OPEN_MINUTES,

      automatic:
        true,

      request:
        input.request,
    });
  }

  return updated;
}

export function guardErrorResponse(
  error:
    IntelligenceGuardError,
) {
  return {
    status:
      error.status,

    headers: {
      "Cache-Control":
        "no-store",

      ...(error.retryAfterSeconds
        ? {
            "Retry-After":
              String(
                error.retryAfterSeconds,
              ),
          }
        : {}),
    },

    body: {
      error:
        error.message,

      code:
        error.code,

      retryAfterSeconds:
        error.retryAfterSeconds,

      safeguards: {
        autonomousTradingEnabled:
          false,

        requestExecuted:
          false,
      },
    },
  };
}

export async function ensureProductionSecurityBaselines(
  userId: string,
) {
  const userHash =
    shortUserHash(
      userId,
    );

  const [
    securitySetting,
    ownerPolicy,
    advisorPolicy,
    researchPolicy,
    notificationRule,
    budgetEvent,
  ] =
    await Promise.all([
      ensureUserSecuritySetting(
        userId,
      ),

      prisma.backendRolePolicy.upsert({
        where: {
          policyKey:
            `${userHash}:intelligence-owner`,
        },

        update: {
          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.train",
                "intelligence.approve-internal-actions",
                "intelligence.manage-circuits",
                "intelligence.manage-budget",
                "intelligence.manage-incidents",
                "intelligence.export-audit",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },

        create: {
          userId,

          policyKey:
            `${userHash}:intelligence-owner`,

          roleKey:
            "intelligence-owner",

          roleName:
            "Intelligence Owner",

          description:
            "Full Slice intelligence administration without trading or money-movement authority.",

          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.train",
                "intelligence.approve-internal-actions",
                "intelligence.manage-circuits",
                "intelligence.manage-budget",
                "intelligence.manage-incidents",
                "intelligence.export-audit",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },
      }),

      prisma.backendRolePolicy.upsert({
        where: {
          policyKey:
            `${userHash}:intelligence-advisor`,
        },

        update: {
          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.create-drafts",
                "intelligence.approve-internal-actions",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },

        create: {
          userId,

          policyKey:
            `${userHash}:intelligence-advisor`,

          roleKey:
            "intelligence-advisor",

          roleName:
            "Intelligence Advisor",

          description:
            "Research, forecasting, simulation, and internal approval access without infrastructure administration.",

          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.create-drafts",
                "intelligence.approve-internal-actions",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },
      }),

      prisma.backendRolePolicy.upsert({
        where: {
          policyKey:
            `${userHash}:intelligence-researcher`,
        },

        update: {
          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.approvals.read-only",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },

        create: {
          userId,

          policyKey:
            `${userHash}:intelligence-researcher`,

          roleKey:
            "intelligence-researcher",

          roleName:
            "Intelligence Researcher",

          description:
            "Read and research access without approval or infrastructure authority.",

          permissionsJson:
            safeJson(
              [
                "intelligence.read",
                "intelligence.generate",
                "intelligence.simulate",
                "intelligence.approvals.read-only",
                "trading.disabled",
                "money-movement.disabled",
              ],
              "[]",
            ),

          status:
            "Active",
        },
      }),

      prisma.backendNotificationRule.upsert({
        where: {
          ownerRuleKey:
            `${userHash}:intelligence-security-notifications`,
        },

        update: {
          ruleName:
            "Intelligence security and health alerts",

          scopeType:
            "Area",

          scopeValue:
            "Security",

          channel:
            "Dashboard",

          minScore:
            70,

          minUrgency:
            "Medium",

          digestOnly:
            false,

          maxPerDay:
            25,

          approvalRequired:
            false,

          status:
            "Active",
        },

        create: {
          userId,

          ownerRuleKey:
            `${userHash}:intelligence-security-notifications`,

          ruleName:
            "Intelligence security and health alerts",

          scopeType:
            "Area",

          scopeValue:
            "Security",

          channel:
            "Dashboard",

          minScore:
            70,

          minUrgency:
            "Medium",

          digestOnly:
            false,

          quietHoursStart:
            null,

          quietHoursEnd:
            null,

          maxPerDay:
            25,

          approvalRequired:
            false,

          status:
            "Active",
        },
      }),

      prisma.backendPlatformEvent.upsert({
        where: {
          userId_eventKey: {
            userId,

            eventKey:
              "intelligence-budget-policy",
          },
        },

        update: {},

        create: {
          userId,

          eventKey:
            "intelligence-budget-policy",

          eventType:
            BUDGET_EVENT_TYPE,

          area:
            "Security",

          title:
            "Intelligence estimated-cost budget",

          detail:
            `Daily estimated-cost limit: $${DEFAULT_DAILY_BUDGET_USD.toFixed(
              2,
            )}.`,

          severity:
            "Info",

          status:
            "Active",

          sourceType:
            "BudgetPolicy",

          sourceId:
            null,

          metadataJson:
            safeJson(
              defaultBudgetPolicy(),
              "{}",
            ),
        },
      }),
    ]);

  return {
    securitySetting,

    rolePolicies: [
      ownerPolicy,
      advisorPolicy,
      researchPolicy,
    ],

    notificationRule,

    budgetEvent,
  };
}

function environmentConfiguration() {
  const neo4jEnabled =
    String(
      process.env
        .NEO4J_ENABLED ??
      "false",
    )
      .trim()
      .toLowerCase() ===
    "true";

  return {
    nodeEnvironment:
      process.env
        .NODE_ENV ??
      "development",

    databaseConfigured:
      Boolean(
        process.env
          .DATABASE_URL,
      ),

    cronSecretConfigured:
      Boolean(
        process.env
          .CRON_SECRET,
      ),

    openAiConfigured:
      Boolean(
        process.env
          .OPENAI_API_KEY,
      ),

    camelServiceUrlConfigured:
      Boolean(
        process.env
          .CAMEL_AI_SERVICE_URL,
      ),

    camelServiceTokenConfigured:
      Boolean(
        process.env
          .CAMEL_AI_SERVICE_TOKEN,
      ),

    neo4jEnabled,

    neo4jUriConfigured:
      Boolean(
        process.env
          .NEO4J_URI,
      ),

    neo4jUsernameConfigured:
      Boolean(
        process.env
          .NEO4J_USERNAME,
      ),

    neo4jPasswordConfigured:
      Boolean(
        process.env
          .NEO4J_PASSWORD,
      ),

    cronProtectionRequired:
      process.env
        .NODE_ENV ===
      "production",

    requestLogSaltConfigured:
      Boolean(
        process.env
          .INTELLIGENCE_LOG_SALT,
      ),

    secretValuesExposed:
      false,
  };
}

async function createHealthAlert(
  input: {
    userId:
      string;

    check:
      ProductionHealthCheck;
  },
) {
  if (
    input.check.status ===
    "Healthy"
  ) {
    return null;
  }

  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const dedupeKey = [
    "intelligence-health",
    input.check.key,
    date,
  ].join(
    ":",
  );

  return prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId:
          input.userId,

        dedupeKey,
      },
    },

    update: {
      title:
        input.check.label,

      body:
        `${input.check.detail} ${input.check.remediation}`,

      source:
        "Slice Production Controls",

      urgency:
        input.check.status ===
        "Critical"
          ? "Critical"
          : "Medium",

      score:
        input.check.status ===
        "Critical"
          ? 95
          : 75,

      channel:
        "Dashboard",

      status:
        "Unread",

      aiBriefing:
        input.check.detail,
    },

    create: {
      userId:
        input.userId,

      dedupeKey,

      title:
        input.check.label,

      body:
        `${input.check.detail} ${input.check.remediation}`,

      source:
        "Slice Production Controls",

      ticker:
        null,

      urgency:
        input.check.status ===
        "Critical"
          ? "Critical"
          : "Medium",

      score:
        input.check.status ===
        "Critical"
          ? 95
          : 75,

      channel:
        "Dashboard",

      status:
        "Unread",

      sourceUrl:
        null,

      aiBriefing:
        input.check.detail,
    },
  });
}

export async function createIntelligenceIncident(
  input: {
    userId:
      string;

    title:
      string;

    summary:
      string;

    severity:
      "Info" | "Warning" | "Critical";

    sourceType?:
      string;

    sourceId?:
      string;

    request?:
      Request;
  },
) {
  const title =
    cleanText(
      input.title,
      300,
    );

  const summary =
    cleanText(
      input.summary,
      4_000,
    );

  if (
    !title ||
    !summary
  ) {
    throw new Error(
      "Incident title and summary are required.",
    );
  }

  const incidentId =
    randomUUID();

  const event =
    await prisma.backendPlatformEvent.create({
      data: {
        userId:
          input.userId,

        eventKey:
          `intelligence-incident:${incidentId}`,

        eventType:
          INCIDENT_EVENT_TYPE,

        area:
          "Security",

        actorName:
          "Slice Production Controls",

        title,

        detail:
          summary,

        severity:
          input.severity,

        status:
          "Open",

        sourceType:
          cleanText(
            input.sourceType,
            100,
          ) ||
          "ManualIncident",

        sourceId:
          cleanText(
            input.sourceId,
            200,
          ) ||
          null,

        metadataJson:
          safeJson(
            {
              incidentId,

              openedAt:
                new Date().toISOString(),

              openedByUserId:
                input.userId,

              severity:
                input.severity,

              summary,

              resolution:
                null,

              tradingDisabled:
                true,

              moneyMovementDisabled:
                true,
            },
            "{}",
          ),
      },
    });

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId:
          input.userId,

        dedupeKey:
          event.eventKey,
      },
    },

    update: {
      title,

      body:
        summary,

      source:
        "Slice Production Controls",

      urgency:
        input.severity,

      score:
        input.severity ===
        "Critical"
          ? 100
          : input.severity ===
              "Warning"
            ? 80
            : 60,

      channel:
        "Dashboard",

      status:
        "Unread",

      aiBriefing:
        summary,
    },

    create: {
      userId:
        input.userId,

      dedupeKey:
        event.eventKey,

      title,

      body:
        summary,

      source:
        "Slice Production Controls",

      ticker:
        null,

      urgency:
        input.severity,

      score:
        input.severity ===
        "Critical"
          ? 100
          : input.severity ===
              "Warning"
            ? 80
            : 60,

      channel:
        "Dashboard",

      status:
        "Unread",

      sourceUrl:
        null,

      aiBriefing:
        summary,
    },
  });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_INCIDENT_OPENED",

    severity:
      input.severity,

    area:
      "Security",

    title,

    detail:
      summary,

    metadata: {
      incidentEventId:
        event.id,

      incidentKey:
        event.eventKey,

      tradingDisabled:
        true,

      moneyMovementDisabled:
        true,
    },

    request:
      input.request,
  });

  return event;
}

export async function resolveIntelligenceIncident(
  input: {
    userId:
      string;

    incidentId:
      string;

    resolution:
      string;

    request?:
      Request;
  },
) {
  const event =
    await prisma.backendPlatformEvent.findFirst({
      where: {
        id:
          input.incidentId,

        userId:
          input.userId,

        eventType:
          INCIDENT_EVENT_TYPE,
      },
    });

  if (!event) {
    throw new Error(
      "Incident was not found.",
    );
  }

  if (
    event.status ===
    "Resolved"
  ) {
    return event;
  }

  const resolution =
    cleanText(
      input.resolution,
      4_000,
    );

  if (
    resolution.length <
    10
  ) {
    throw new Error(
      "A resolution of at least 10 characters is required.",
    );
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  const metadata =
    isRecord(parsed)
      ? parsed
      : {};

  const resolved =
    await prisma.backendPlatformEvent.update({
      where: {
        id:
          event.id,
      },

      data: {
        status:
          "Resolved",

        detail:
          `${event.detail ?? ""}\n\nResolution: ${resolution}`.trim(),

        metadataJson:
          safeJson(
            {
              ...metadata,

              resolvedAt:
                new Date().toISOString(),

              resolvedByUserId:
                input.userId,

              resolution,
            },
            "{}",
          ),
      },
    });

  const alert =
    await prisma.alertEvent.findUnique({
      where: {
        userId_dedupeKey: {
          userId:
            input.userId,

          dedupeKey:
            event.eventKey,
        },
      },
    });

  if (alert) {
    await prisma.alertEvent.update({
      where: {
        id:
          alert.id,
      },

      data: {
        status:
          "Read",

        readAt:
          new Date(),
      },
    });
  }

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_INCIDENT_RESOLVED",

    severity:
      "Info",

    area:
      "Security",

    title:
      event.title,

    detail:
      resolution,

    metadata: {
      incidentEventId:
        event.id,

      resolvedByUserId:
        input.userId,
    },

    request:
      input.request,
  });

  return resolved;
}

export async function runProductionHealthScan(
  input: {
    userId:
      string;

    persist?:
      boolean;

    request?:
      Request;
  },
) {
  await ensureProductionSecurityBaselines(
    input.userId,
  );

  const configuration =
    environmentConfiguration();

  let databaseConnected =
    true;

  let databaseError:
    string | null =
    null;

  try {
    await prisma.$queryRaw`
      SELECT 1
    `;
  } catch (error) {
    databaseConnected =
      false;

    databaseError =
      error instanceof Error
        ? error.message
        : "Unknown database error.";
  }

  const now =
    new Date();

  const oneHourAgo =
    new Date(
      now.getTime() -
      60 *
      60 *
      1_000,
    );

  const oneDayAgo =
    new Date(
      now.getTime() -
      24 *
      60 *
      60 *
      1_000,
    );

  const approvalCutoff =
    new Date(
      now.getTime() -
      24 *
      60 *
      60 *
      1_000,
    );

  const [
    securitySetting,
    activeSessions,
    recentFailures,
    pendingOldApprovals,
    criticalDriftAlerts,
    dataQualityReviewCount,
    overdueSettlementCount,
    productionModelCount,
    openIncidents,
    circuitEvents,
    usage,
  ] =
    await Promise.all([
      ensureUserSecuritySetting(
        input.userId,
      ),

      prisma.session.count({
        where: {
          userId:
            input.userId,

          expiresAt: {
            gt:
              now,
          },
        },
      }),

      prisma.backendPlatformEvent.count({
        where: {
          userId:
            input.userId,

          eventType:
            FAILURE_EVENT_TYPE,

          createdAt: {
            gte:
              oneHourAgo,
          },
        },
      }),

      prisma.backendApprovalItem.count({
        where: {
          userId:
            input.userId,

          status:
            "Pending",

          createdAt: {
            lt:
              approvalCutoff,
          },
        },
      }),

      prisma.intelligenceForecastDriftAlert.count({
        where: {
          userId:
            input.userId,

          status:
            "Open",

          severity:
            "Critical",
        },
      }),

      prisma.backendDataQualityRecord.count({
        where: {
          userId:
            input.userId,

          status:
            "Needs Review",
        },
      }),

      prisma.intelligenceForecastHorizon.count({
        where: {
          userId:
            input.userId,

          status:
            "Pending",

          targetAt: {
            lte:
              now,
          },
        },
      }),

      prisma.intelligenceForecastModel.count({
        where: {
          userId:
            input.userId,

          status:
            "Production",
        },
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId:
            input.userId,

          eventType:
            INCIDENT_EVENT_TYPE,

          status:
            "Open",
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          50,
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId:
            input.userId,

          eventType:
            CIRCUIT_EVENT_TYPE,
        },

        orderBy: {
          updatedAt:
            "desc",
        },

        take:
          50,
      }),

      dailyUsage(
        input.userId,
      ),
    ]);

  const budget =
    await getBudgetPolicy(
      input.userId,
    );

  const activeCircuits =
    circuitEvents
      .map(
        (event) => ({
          event,

          metadata:
            parseCircuitMetadata(
              event.metadataJson,
            ),
        }),
      )
      .filter(
        (item) => {
          if (
            item.metadata.state !==
            "Open"
          ) {
            return false;
          }

          if (
            !item.metadata.openUntil
          ) {
            return true;
          }

          const openUntil =
            new Date(
              item.metadata.openUntil,
            );

          return (
            !Number.isFinite(
              openUntil.getTime(),
            ) ||
            openUntil.getTime() >
            Date.now()
          );
        },
      );

  const budgetPercent =
    budget.dailyEstimatedCostLimitUsd >
    0
      ? (
          usage.estimatedCostUsd /
          budget.dailyEstimatedCostLimitUsd
        ) *
        100
      : 0;

  const checks:
    ProductionHealthCheck[] = [];

  checks.push({
    key:
      "database-connectivity",

    label:
      "PostgreSQL connectivity",

    status:
      databaseConnected
        ? "Healthy"
        : "Critical",

    detail:
      databaseConnected
        ? "The PostgreSQL health query succeeded."
        : `The PostgreSQL health query failed: ${databaseError}`,

    remediation:
      databaseConnected
        ? "No action required."
        : "Verify DATABASE_URL, database availability, network access, and Prisma deployment state.",
  });

  checks.push({
    key:
      "sensitive-action-reauthentication",

    label:
      "Sensitive-action reauthentication",

    status:
      securitySetting
        .requireReauthForSensitiveActions
        ? "Healthy"
        : "Critical",

    detail:
      securitySetting
        .requireReauthForSensitiveActions
        ? "Sensitive-action reauthentication is enabled."
        : "Sensitive-action reauthentication is disabled.",

    remediation:
      securitySetting
        .requireReauthForSensitiveActions
        ? "No action required."
        : "Enable reauthentication before allowing sensitive approvals.",
  });

  checks.push({
    key:
      "mfa-status",

    label:
      "Multi-factor authentication",

    status:
      securitySetting
        .mfaEnabled
        ? "Healthy"
        : "Warning",

    detail:
      securitySetting
        .mfaEnabled
        ? "MFA is marked as enabled."
        : "MFA is not currently marked as enabled.",

    remediation:
      securitySetting
        .mfaEnabled
        ? "Continue periodic MFA review."
        : "Implement and verify MFA before broad production use.",
  });

  checks.push({
    key:
      "session-duration",

    label:
      "Session timeout",

    status:
      securitySetting
        .sessionTimeoutMinutes <=
      1_440
        ? "Healthy"
        : "Warning",

    detail:
      `Configured session timeout: ${securitySetting.sessionTimeoutMinutes} minutes.`,

    remediation:
      securitySetting
        .sessionTimeoutMinutes <=
      1_440
        ? "No action required."
        : "Reduce production session duration to 24 hours or less unless a documented policy requires otherwise.",
  });

  checks.push({
    key:
      "new-login-alerts",

    label:
      "New-login alerts",

    status:
      securitySetting
        .alertOnNewLogin
        ? "Healthy"
        : "Warning",

    detail:
      securitySetting
        .alertOnNewLogin
        ? "New-login alerting is enabled."
        : "New-login alerting is disabled.",

    remediation:
      securitySetting
        .alertOnNewLogin
        ? "No action required."
        : "Enable new-login alerts before production onboarding.",
  });

  checks.push({
    key:
      "cron-secret",

    label:
      "Scheduled-route authentication",

    status:
      !configuration
        .cronProtectionRequired ||
      configuration
        .cronSecretConfigured
        ? "Healthy"
        : "Critical",

    detail:
      configuration
        .cronSecretConfigured
        ? "CRON_SECRET is configured."
        : configuration
            .cronProtectionRequired
          ? "CRON_SECRET is missing in production."
          : "CRON_SECRET is not configured in this non-production environment.",

    remediation:
      configuration
        .cronProtectionRequired &&
      !configuration
        .cronSecretConfigured
        ? "Configure a strong CRON_SECRET before deployment."
        : "Verify the value exists in every deployed environment.",
  });

  checks.push({
    key:
      "camel-configuration",

    label:
      "CAMEL-AI configuration",

    status:
      configuration
        .camelServiceUrlConfigured &&
      configuration
        .camelServiceTokenConfigured
        ? "Healthy"
        : "Warning",

    detail:
      configuration
        .camelServiceUrlConfigured &&
      configuration
        .camelServiceTokenConfigured
        ? "CAMEL-AI URL and shared token are configured."
        : "CAMEL-AI is missing a service URL or shared token.",

    remediation:
      "Verify CAMEL_AI_SERVICE_URL and CAMEL_AI_SERVICE_TOKEN without exposing either value.",
  });

  checks.push({
    key:
      "neo4j-configuration",

    label:
      "Neo4j configuration",

    status:
      !configuration
        .neo4jEnabled ||
      (
        configuration
          .neo4jUriConfigured &&
        configuration
          .neo4jUsernameConfigured &&
        configuration
          .neo4jPasswordConfigured
      )
        ? "Healthy"
        : "Critical",

    detail:
      !configuration
        .neo4jEnabled
        ? "Neo4j integration is disabled."
        : (
            configuration
              .neo4jUriConfigured &&
            configuration
              .neo4jUsernameConfigured &&
            configuration
              .neo4jPasswordConfigured
          )
          ? "Neo4j integration is enabled and its required variables are configured."
          : "Neo4j is enabled but one or more credentials are missing.",

    remediation:
      "Keep Neo4j disabled until every required credential is configured securely.",
  });

  checks.push({
    key:
      "request-log-salt",

    label:
      "Request-fingerprint salt",

    status:
      configuration
        .requestLogSaltConfigured
        ? "Healthy"
        : "Warning",

    detail:
      configuration
        .requestLogSaltConfigured
        ? "A dedicated request-fingerprint salt is configured."
        : "The optional INTELLIGENCE_LOG_SALT is not configured.",

    remediation:
      "Configure a long random INTELLIGENCE_LOG_SALT in production.",
  });

  checks.push({
    key:
      "active-circuits",

    label:
      "Service circuit breakers",

    status:
      activeCircuits.length ===
      0
        ? "Healthy"
        : "Critical",

    detail:
      activeCircuits.length ===
      0
        ? "No service circuit breaker is open."
        : `${activeCircuits.length} service circuit breaker(s) are open.`,

    remediation:
      activeCircuits.length ===
      0
        ? "No action required."
        : "Review the underlying failures before manually closing any circuit.",
  });

  checks.push({
    key:
      "recent-operation-failures",

    label:
      "Recent operation failures",

    status:
      recentFailures >=
      10
        ? "Critical"
        : recentFailures >
            0
          ? "Warning"
          : "Healthy",

    detail:
      `${recentFailures} guarded operation failure(s) occurred during the last hour.`,

    remediation:
      recentFailures
        ? "Inspect failure events and provider status before restoring full operation."
        : "No action required.",
  });

  checks.push({
    key:
      "critical-model-drift",

    label:
      "Critical model drift",

    status:
      criticalDriftAlerts >
      0
        ? "Critical"
        : "Healthy",

    detail:
      `${criticalDriftAlerts} critical open model-drift alert(s) exist.`,

    remediation:
      criticalDriftAlerts
        ? "Keep affected models in shadow or disable them until reviewed."
        : "No action required.",
  });

  checks.push({
    key:
      "overdue-settlement",

    label:
      "Forecast settlement backlog",

    status:
      overdueSettlementCount >
      25
        ? "Critical"
        : overdueSettlementCount >
            0
          ? "Warning"
          : "Healthy",

    detail:
      `${overdueSettlementCount} forecast horizon(s) are due but remain pending.`,

    remediation:
      overdueSettlementCount
        ? "Review market-data availability and the settlement cron."
        : "No action required.",
  });

  checks.push({
    key:
      "data-quality-review",

    label:
      "Evidence quality review",

    status:
      dataQualityReviewCount >
      50
        ? "Critical"
        : dataQualityReviewCount >
            0
          ? "Warning"
          : "Healthy",

    detail:
      `${dataQualityReviewCount} evidence-quality record(s) require review.`,

    remediation:
      dataQualityReviewCount
        ? "Review stale, missing, fallback, and future-dated evidence."
        : "No action required.",
  });

  checks.push({
    key:
      "production-model",

    label:
      "Production model designation",

    status:
      productionModelCount >
      0
        ? "Healthy"
        : "Warning",

    detail:
      `${productionModelCount} model(s) currently have Production status.`,

    remediation:
      productionModelCount >
      0
        ? "Continue model-governance monitoring."
        : "Keep all models in shadow until a validated model receives human promotion.",
  });

  checks.push({
    key:
      "estimated-cost-budget",

    label:
      "Estimated daily AI and infrastructure cost",

    status:
      budgetPercent >=
      100
        ? "Critical"
        : budgetPercent >=
            budget.warningPercent
          ? "Warning"
          : "Healthy",

    detail:
      `$${usage.estimatedCostUsd.toFixed(
        4,
      )} of the $${budget.dailyEstimatedCostLimitUsd.toFixed(
        2,
      )} estimated daily budget has been allocated.`,

    remediation:
      budgetPercent >=
      budget.warningPercent
        ? "Review operation volume and estimated-cost policy."
        : "No action required.",
  });

  checks.push({
    key:
      "open-incidents",

    label:
      "Open production incidents",

    status:
      openIncidents.some(
        (incident) =>
          incident.severity ===
          "Critical",
      )
        ? "Critical"
        : openIncidents.length >
            0
          ? "Warning"
          : "Healthy",

    detail:
      `${openIncidents.length} production incident(s) remain open.`,

    remediation:
      openIncidents.length
        ? "Resolve incidents only after documenting root cause, containment, and recovery."
        : "No action required.",
  });

  checks.push({
    key:
      "active-sessions",

    label:
      "Active authenticated sessions",

    status:
      activeSessions <=
      25
        ? "Healthy"
        : "Warning",

    detail:
      `${activeSessions} active session(s) are currently stored for this user.`,

    remediation:
      activeSessions <=
      25
        ? "No action required."
        : "Review session cleanup and unexpected concurrent access.",
  });

  let score =
    100;

  for (
    const check of
      checks
  ) {
    if (
      check.status ===
      "Critical"
    ) {
      score -=
        15;
    }

    if (
      check.status ===
      "Warning"
    ) {
      score -=
        5;
    }
  }

  score =
    Math.round(
      clamp(
        score,
        0,
        100,
      ),
    );

  const status =
    checks.some(
      (check) =>
        check.status ===
        "Critical",
    )
      ? "Critical"
      : checks.some(
          (check) =>
            check.status ===
            "Warning",
        )
        ? "Needs Review"
        : "Healthy";

  const result = {
    generatedAt:
      new Date().toISOString(),

    score,

    status,

    checks,

    configuration,

    securitySetting,

    activeSessions,

    activeCircuits:
      activeCircuits.map(
        (item) => ({
          id:
            item.event.id,

          service:
            item.metadata.service,

          reason:
            item.metadata.reason,

          openedAt:
            item.metadata.openedAt,

          openUntil:
            item.metadata.openUntil,

          automatic:
            item.metadata.automatic,
        }),
      ),

    openIncidents,

    usage: {
      ...usage,

      budget,

      budgetPercent:
        round(
          budgetPercent,
          2,
        ),
    },

    metrics: {
      recentFailures,

      pendingOldApprovals,

      criticalDriftAlerts,

      dataQualityReviewCount,

      overdueSettlementCount,

      productionModelCount,
    },

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      secretsReturnedToClient:
        false,

      costFiguresAreEstimates:
        true,

      circuitBreakersEnabled:
        true,

      auditLoggingEnabled:
        true,
    },
  };

  if (
    input.persist !==
    false
  ) {
    for (
      const check of
        checks
    ) {
      await createHealthAlert({
        userId:
          input.userId,

        check,
      }).catch(
        console.error,
      );
    }

    await prisma.backendPlatformEvent.create({
      data: {
        userId:
          input.userId,

        eventKey: [
          "intelligence-health-scan",
          Date.now(),
          randomUUID(),
        ].join(
          ":",
        ),

        eventType:
          HEALTH_EVENT_TYPE,

        area:
          "Security",

        actorName:
          "Slice Production Controls",

        title:
          `Production health: ${status}`,

        detail:
          `Health score ${score}/100.`,

        severity:
          status ===
          "Critical"
            ? "Critical"
            : status ===
                "Needs Review"
              ? "Warning"
              : "Info",

        status:
          "Recorded",

        sourceType:
          "ProductionHealthScan",

        sourceId:
          null,

        metadataJson:
          safeJson(
            result,
            "{}",
          ),
      },
    });

    await recordAuditLog({
      userId:
        input.userId,

      eventType:
        "INTELLIGENCE_PRODUCTION_HEALTH_SCANNED",

      severity:
        status ===
        "Critical"
          ? "Critical"
          : status ===
              "Needs Review"
            ? "Warning"
            : "Info",

      area:
        "Security",

      title:
        `Production health: ${status}`,

      detail:
        `Health score ${score}/100.`,

      metadata: {
        score,

        status,

        criticalCheckCount:
          checks.filter(
            (check) =>
              check.status ===
              "Critical",
          ).length,

        warningCheckCount:
          checks.filter(
            (check) =>
              check.status ===
              "Warning",
          ).length,

        autonomousTradingEnabled:
          false,

        secretValuesExposed:
          false,
      },

      request:
        input.request,
    }).catch(
      console.error,
    );
  }

  return result;
}

export async function getProductionControlOverview(
  userId: string,
) {
  const baseline =
    await ensureProductionSecurityBaselines(
      userId,
    );

  const health =
    await runProductionHealthScan({
      userId,

      persist:
        false,
    });

  const [
    incidents,
    circuitEvents,
    recentOperations,
    recentAuditLogs,
  ] =
    await Promise.all([
      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            INCIDENT_EVENT_TYPE,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          100,
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            CIRCUIT_EVENT_TYPE,
        },

        orderBy: {
          updatedAt:
            "desc",
        },

        take:
          100,
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            USAGE_EVENT_TYPE,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          100,
      }),

      prisma.auditLog.findMany({
        where: {
          userId,

          area:
            "Security",
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          50,
      }),
    ]);

  return {
    generatedAt:
      new Date().toISOString(),

    health,

    securitySetting:
      baseline.securitySetting,

    rolePolicies:
      baseline.rolePolicies.map(
        (policy) => ({
          ...policy,

          permissions:
            parseJson(
              policy.permissionsJson,
            ),
        }),
      ),

    notificationRule:
      baseline.notificationRule,

    operationPolicies:
      Object.values(
        OPERATION_POLICIES,
      ),

    incidents:
      incidents.map(
        (incident) => ({
          ...incident,

          metadata:
            parseJson(
              incident.metadataJson,
            ),
        }),
      ),

    circuits:
      circuitEvents.map(
        (event) => ({
          ...event,

          metadata:
            parseCircuitMetadata(
              event.metadataJson,
            ),
        }),
      ),

    recentOperations:
      recentOperations.map(
        (event) => ({
          ...event,

          metadata:
            parseJson(
              event.metadataJson,
            ),
        }),
      ),

    recentAuditLogs,

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      secretValuesExposed:
        false,

      estimatedCostAccounting:
        true,

      vendorBillingReconciliationRequired:
        true,
    },
  };
}