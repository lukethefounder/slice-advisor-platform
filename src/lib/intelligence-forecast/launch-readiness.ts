import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  REQUIRED_DISCLOSURES,
  recordAuditLog,
} from "@/lib/audit";

import {
  createIntelligenceIncident,
  runProductionHealthScan,
} from "@/lib/intelligence-forecast/production-controls";

import {
  prisma,
} from "@/lib/prisma";

export const INTELLIGENCE_LAUNCH_MODES = [
  "Shadow",
  "Pilot",
  "Production",
] as const;

export const INTELLIGENCE_RECOVERY_DRILLS = [
  {
    key: "RATE_LIMIT",
    label: "Rate-limit drill",
    description:
      "Confirm excess requests are rejected without executing the protected operation.",
  },
  {
    key: "CIRCUIT_BREAKER",
    label: "Circuit-breaker drill",
    description:
      "Open a service circuit, verify protected requests are blocked, document the cause, and restore the service.",
  },
  {
    key: "INCIDENT_RESPONSE",
    label: "Incident-response drill",
    description:
      "Open a test incident, document containment and root cause, and complete the resolution workflow.",
  },
  {
    key: "PROVIDER_OUTAGE",
    label: "Provider-outage drill",
    description:
      "Verify that an unavailable market-data, CAMEL-AI, Neo4j, or OpenAI provider produces a controlled fallback or explicit failure.",
  },
  {
    key: "DATABASE_RESTORE",
    label: "Database restore drill",
    description:
      "Restore a non-production PostgreSQL backup and verify the restored schema and representative forecast records.",
  },
] as const;

const READINESS_EVENT_TYPE =
  "INTELLIGENCE_LAUNCH_READINESS";

const LAUNCH_STATE_EVENT_TYPE =
  "INTELLIGENCE_LAUNCH_STATE";

const RELEASE_VALIDATION_EVENT_TYPE =
  "INTELLIGENCE_RELEASE_VALIDATION";

const RECOVERY_DRILL_EVENT_TYPE =
  "INTELLIGENCE_RECOVERY_DRILL";

const LAUNCH_APPROVAL_ACTION_TYPE =
  "APPROVE_INTELLIGENCE_LAUNCH";

const LAUNCH_STATE_EVENT_KEY =
  "intelligence-launch-state";

const EVIDENCE_ENTITY_TYPE =
  "IntelligenceForecastEvidence";

const EVIDENCE_OVERALL_SOURCE =
  "Overall Snapshot";

const USAGE_EVENT_TYPE =
  "INTELLIGENCE_OPERATION_USAGE";

const INCIDENT_EVENT_TYPE =
  "INTELLIGENCE_SECURITY_INCIDENT";

const CIRCUIT_EVENT_TYPE =
  "INTELLIGENCE_CIRCUIT_STATE";

type JsonRecord =
  Record<string, unknown>;

export type IntelligenceLaunchMode =
  (typeof INTELLIGENCE_LAUNCH_MODES)[number];

export type RecoveryDrillKey =
  (typeof INTELLIGENCE_RECOVERY_DRILLS)[number]["key"];

export type ReadinessGateStatus =
  | "Passed"
  | "Failed"
  | "Warning";

export type ReadinessGate = {
  key: string;
  label: string;
  required: boolean;
  status: ReadinessGateStatus;
  actual:
    | string
    | number
    | boolean
    | null;
  threshold:
    | string
    | number
    | boolean
    | null;
  detail: string;
  remediation: string;
};

export type ReleaseValidationEvidence = {
  eventId: string;
  commitSha: string;
  branch: string;
  generatedAt: string;
  typecheckPassed: boolean;
  buildPassed: boolean;
  testsPassed: boolean;
  dependencyAuditPassed: boolean;
  secretScanPassed: boolean;
  passed: boolean;
  notes: string;
};

export type RecoveryDrillEvidence = {
  eventId: string;
  drillKey: RecoveryDrillKey;
  label: string;
  passed: boolean;
  evidence: string;
  performedAt: string;
  performedByUserId: string;
  ageDays: number;
};

export type IntelligenceLaunchState = {
  mode: IntelligenceLaunchMode;
  status: "Active";
  activatedAt: string;
  approvedByUserId: string | null;
  approvalId: string | null;
  reason: string;
  previousMode: IntelligenceLaunchMode | null;
  releaseCommitSha: string | null;
  pilotStartedAt: string | null;
  safeguards: {
    autonomousTradingEnabled: false;
    moneyMovementEnabled: false;
    clientCommunicationAutomatic: false;
    automaticModelPromotionEnabled: false;
  };
};

type ReadinessMetrics = {
  healthScore: number;
  healthStatus: string;
  criticalHealthChecks: number;
  warningHealthChecks: number;
  databaseHealthy: boolean;

  mfaEnabled: boolean;
  reauthenticationEnabled: boolean;

  disclosureCount: number;
  acceptedDisclosureCount: number;
  allDisclosuresAccepted: boolean;

  totalForecastRuns: number;
  settledHorizonCount: number;
  coreHorizonCounts:
    Record<string, number>;
  overdueSettlementCount: number;

  evidenceAuditedCount: number;
  evidenceValidatedCount: number;
  evidenceCoveragePercent: number;
  evidenceValidatedPercent: number;
  futureEvidenceViolationCount: number;

  criticalDriftCount: number;
  productionModelCount: number;
  successfulBacktestExists: boolean;

  openIncidentCount: number;
  openCriticalIncidentCount: number;
  activeCircuitCount: number;

  recentOperationCount: number;
  recentCompletedOperationCount: number;
  recentFailedOperationCount: number;
  recentOperationSuccessPercent: number;

  validationEvidence:
    ReleaseValidationEvidence | null;
  validationEvidenceAgeDays: number | null;

  recoveryDrills:
    RecoveryDrillEvidence[];
  passedRecoveryDrillCount: number;
  recentPassedRecoveryDrillCount: number;

  currentLaunchState:
    IntelligenceLaunchState;
  pilotAgeDays: number | null;
};

export type LaunchReadinessResult = {
  generatedAt: string;
  targetMode: IntelligenceLaunchMode;
  currentState: IntelligenceLaunchState;
  score: number;
  status:
    | "Ready"
    | "Blocked";
  allRequiredGatesPassed: boolean;
  passedRequiredGateCount: number;
  requiredGateCount: number;
  gates: ReadinessGate[];
  blockers: string[];
  warnings: string[];
  metrics: ReadinessMetrics;
  confirmationPhrase: string;
  safeguards: {
    autonomousTradingEnabled: false;
    moneyMovementEnabled: false;
    automaticLaunchEnabled: false;
    humanApprovalRequired: true;
    exactConfirmationRequired: true;
  };
};

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
  maximumLength: number,
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
  decimals = 2,
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

function ageInDays(
  value: string | Date | null,
) {
  if (!value) {
    return null;
  }

  const parsed =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    !Number.isFinite(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return round(
    Math.max(
      0,
      Date.now() -
      parsed.getTime(),
    ) /
    (
      24 *
      60 *
      60 *
      1_000
    ),
    2,
  );
}

function isLaunchMode(
  value: string,
): value is IntelligenceLaunchMode {
  return (
    INTELLIGENCE_LAUNCH_MODES as readonly string[]
  ).includes(value);
}

function isRecoveryDrillKey(
  value: string,
): value is RecoveryDrillKey {
  return INTELLIGENCE_RECOVERY_DRILLS.some(
    (drill) =>
      drill.key ===
      value,
  );
}

function confirmationPhrase(
  mode: IntelligenceLaunchMode,
) {
  if (
    mode ===
    "Production"
  ) {
    return "LAUNCH SLICE INTELLIGENCE PRODUCTION";
  }

  if (
    mode ===
    "Pilot"
  ) {
    return "LAUNCH SLICE INTELLIGENCE PILOT";
  }

  return "RETURN SLICE INTELLIGENCE TO SHADOW";
}

function defaultLaunchState():
  IntelligenceLaunchState {
  return {
    mode:
      "Shadow",

    status:
      "Active",

    activatedAt:
      new Date().toISOString(),

    approvedByUserId:
      null,

    approvalId:
      null,

    reason:
      "Default safe operating state.",

    previousMode:
      null,

    releaseCommitSha:
      null,

    pilotStartedAt:
      null,

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      clientCommunicationAutomatic:
        false,

      automaticModelPromotionEnabled:
        false,
    },
  };
}

function parseLaunchState(
  value: string,
): IntelligenceLaunchState {
  const parsed =
    parseJson(value);

  if (!isRecord(parsed)) {
    return defaultLaunchState();
  }

  const modeValue =
    cleanText(
      parsed.mode,
      30,
    );

  const mode =
    isLaunchMode(
      modeValue,
    )
      ? modeValue
      : "Shadow";

  const previousValue =
    cleanText(
      parsed.previousMode,
      30,
    );

  return {
    mode,

    status:
      "Active",

    activatedAt:
      cleanText(
        parsed.activatedAt,
        100,
      ) ||
      new Date().toISOString(),

    approvedByUserId:
      cleanText(
        parsed.approvedByUserId,
        200,
      ) ||
      null,

    approvalId:
      cleanText(
        parsed.approvalId,
        200,
      ) ||
      null,

    reason:
      cleanText(
        parsed.reason,
        4_000,
      ) ||
      "No launch-state reason was stored.",

    previousMode:
      isLaunchMode(
        previousValue,
      )
        ? previousValue
        : null,

    releaseCommitSha:
      cleanText(
        parsed.releaseCommitSha,
        100,
      ) ||
      null,

    pilotStartedAt:
      cleanText(
        parsed.pilotStartedAt,
        100,
      ) ||
      null,

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      clientCommunicationAutomatic:
        false,

      automaticModelPromotionEnabled:
        false,
    },
  };
}

export async function getIntelligenceLaunchState(
  userId: string,
) {
  const event =
    await prisma.backendPlatformEvent.findUnique({
      where: {
        userId_eventKey: {
          userId,

          eventKey:
            LAUNCH_STATE_EVENT_KEY,
        },
      },
    });

  if (!event) {
    return defaultLaunchState();
  }

  return parseLaunchState(
    event.metadataJson,
  );
}

function parseValidationEvidence(
  event: {
    id: string;
    createdAt: Date;
    metadataJson: string;
  } | null,
): ReleaseValidationEvidence | null {
  if (!event) {
    return null;
  }

  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return null;
  }

  const evidence:
    ReleaseValidationEvidence = {
    eventId:
      event.id,

    commitSha:
      cleanText(
        parsed.commitSha,
        100,
      ),

    branch:
      cleanText(
        parsed.branch,
        200,
      ),

    generatedAt:
      cleanText(
        parsed.generatedAt,
        100,
      ) ||
      event.createdAt.toISOString(),

    typecheckPassed:
      parsed.typecheckPassed ===
      true,

    buildPassed:
      parsed.buildPassed ===
      true,

    testsPassed:
      parsed.testsPassed ===
      true,

    dependencyAuditPassed:
      parsed.dependencyAuditPassed ===
      true,

    secretScanPassed:
      parsed.secretScanPassed ===
      true,

    passed:
      false,

    notes:
      cleanText(
        parsed.notes,
        4_000,
      ),
  };

  evidence.passed =
    evidence.typecheckPassed &&
    evidence.buildPassed &&
    evidence.testsPassed &&
    evidence.dependencyAuditPassed &&
    evidence.secretScanPassed;

  return evidence;
}

async function getLatestValidationEvidence(
  userId: string,
) {
  const event =
    await prisma.backendPlatformEvent.findFirst({
      where: {
        userId,

        eventType:
          RELEASE_VALIDATION_EVENT_TYPE,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id:
          true,

        createdAt:
          true,

        metadataJson:
          true,
      },
    });

  return parseValidationEvidence(
    event,
  );
}

function parseRecoveryDrill(
  event: {
    id: string;
    createdAt: Date;
    userId: string;
    metadataJson: string;
  },
): RecoveryDrillEvidence | null {
  const parsed =
    parseJson(
      event.metadataJson,
    );

  if (!isRecord(parsed)) {
    return null;
  }

  const drillKey =
    cleanText(
      parsed.drillKey,
      100,
    );

  if (
    !isRecoveryDrillKey(
      drillKey,
    )
  ) {
    return null;
  }

  const definition =
    INTELLIGENCE_RECOVERY_DRILLS.find(
      (drill) =>
        drill.key ===
        drillKey,
    );

  return {
    eventId:
      event.id,

    drillKey,

    label:
      definition?.label ??
      drillKey,

    passed:
      parsed.passed ===
      true,

    evidence:
      cleanText(
        parsed.evidence,
        8_000,
      ),

    performedAt:
      cleanText(
        parsed.performedAt,
        100,
      ) ||
      event.createdAt.toISOString(),

    performedByUserId:
      cleanText(
        parsed.performedByUserId,
        200,
      ) ||
      event.userId,

    ageDays:
      ageInDays(
        cleanText(
          parsed.performedAt,
          100,
        ) ||
        event.createdAt,
      ) ??
      0,
  };
}

async function getLatestRecoveryDrills(
  userId: string,
) {
  const events =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId,

        eventType:
          RECOVERY_DRILL_EVENT_TYPE,
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        250,

      select: {
        id:
          true,

        userId:
          true,

        createdAt:
          true,

        metadataJson:
          true,
      },
    });

  const latest =
    new Map<
      RecoveryDrillKey,
      RecoveryDrillEvidence
    >();

  for (
    const event of
      events
  ) {
    const parsed =
      parseRecoveryDrill(
        event,
      );

    if (
      parsed &&
      !latest.has(
        parsed.drillKey,
      )
    ) {
      latest.set(
        parsed.drillKey,
        parsed,
      );
    }
  }

  return INTELLIGENCE_RECOVERY_DRILLS.map(
    (definition) =>
      latest.get(
        definition.key,
      ) ??
      {
        eventId:
          "",

        drillKey:
          definition.key,

        label:
          definition.label,

        passed:
          false,

        evidence:
          "",

        performedAt:
          "",

        performedByUserId:
          "",

        ageDays:
          Number.POSITIVE_INFINITY,
      },
  );
}

function gatesPassed(
  gatesJson: string,
) {
  const parsed =
    parseJson(
      gatesJson,
    );

  return (
    isRecord(parsed) &&
    parsed.allPassed ===
    true
  );
}

function circuitIsOpen(
  metadataJson: string,
) {
  const parsed =
    parseJson(
      metadataJson,
    );

  if (
    !isRecord(parsed) ||
    parsed.state !==
    "Open"
  ) {
    return false;
  }

  if (
    typeof parsed.openUntil !==
    "string"
  ) {
    return true;
  }

  const openUntil =
    new Date(
      parsed.openUntil,
    );

  return (
    !Number.isFinite(
      openUntil.getTime(),
    ) ||
    openUntil.getTime() >
    Date.now()
  );
}

async function collectReadinessMetrics(
  userId: string,
): Promise<ReadinessMetrics> {
  const now =
    new Date();

  const thirtyDaysAgo =
    new Date(
      now.getTime() -
      30 *
      24 *
      60 *
      60 *
      1_000,
    );

  const [
    health,
    launchState,
    validationEvidence,
    recoveryDrills,
    totalForecastRuns,
    evidenceAuditedCount,
    evidenceValidatedCount,
    futureEvidenceViolationCount,
    overdueSettlementCount,
    settledHorizons,
    criticalDriftCount,
    productionModels,
    disclosures,
    operationEvents,
    incidentEvents,
    circuitEvents,
  ] =
    await Promise.all([
      runProductionHealthScan({
        userId,

        persist:
          false,
      }),

      getIntelligenceLaunchState(
        userId,
      ),

      getLatestValidationEvidence(
        userId,
      ),

      getLatestRecoveryDrills(
        userId,
      ),

      prisma.intelligenceForecastRun.count({
        where: {
          userId,
        },
      }),

      prisma.backendDataQualityRecord.count({
        where: {
          userId,

          entityType:
            EVIDENCE_ENTITY_TYPE,

          sourceName:
            EVIDENCE_OVERALL_SOURCE,
        },
      }),

      prisma.backendDataQualityRecord.count({
        where: {
          userId,

          entityType:
            EVIDENCE_ENTITY_TYPE,

          sourceName:
            EVIDENCE_OVERALL_SOURCE,

          status:
            "Validated",
        },
      }),

      prisma.backendDataQualityRecord.count({
        where: {
          userId,

          entityType:
            EVIDENCE_ENTITY_TYPE,

          OR: [
            {
              freshnessStatus:
                "Integrity violation",
            },
            {
              warning: {
                contains:
                  "future",
                mode:
                  "insensitive",
              },
            },
          ],
        },
      }),

      prisma.intelligenceForecastHorizon.count({
        where: {
          userId,

          status:
            "Pending",

          targetAt: {
            lte:
              now,
          },
        },
      }),

      prisma.intelligenceForecastHorizon.findMany({
        where: {
          userId,

          status:
            "Settled",
        },

        select: {
          horizon:
            true,
        },

        take:
          25_000,
      }),

      prisma.intelligenceForecastDriftAlert.count({
        where: {
          userId,

          status:
            "Open",

          severity:
            "Critical",
        },
      }),

      prisma.intelligenceForecastModel.findMany({
        where: {
          userId,

          status:
            "Production",
        },

        select: {
          id:
            true,

          modelVersion:
            true,
        },
      }),

      prisma.disclosureAcceptance.findMany({
        where: {
          userId,
        },

        select: {
          disclosureKey:
            true,

          version:
            true,
        },
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            USAGE_EVENT_TYPE,

          createdAt: {
            gte:
              thirtyDaysAgo,
          },
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          20_000,

        select: {
          status:
            true,
        },
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            INCIDENT_EVENT_TYPE,

          status:
            "Open",
        },

        select: {
          id:
            true,

          severity:
            true,
        },
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            CIRCUIT_EVENT_TYPE,
        },

        select: {
          metadataJson:
            true,
        },
      }),
    ]);

  const productionModelIds =
    productionModels.map(
      (model) =>
        model.id,
    );

  const latestBacktest =
    productionModelIds.length
      ? await prisma.intelligenceForecastBacktestRun.findFirst({
          where: {
            userId,

            modelId: {
              in:
                productionModelIds,
            },

            status:
              "Completed",
          },

          orderBy: {
            completedAt:
              "desc",
          },

          select: {
            gatesJson:
              true,
          },
        })
      : null;

  const coreHorizonCounts:
    Record<string, number> = {
    "1d":
      0,

    "2-5d":
      0,

    "1-4w":
      0,
  };

  for (
    const horizon of
      settledHorizons
  ) {
    if (
      horizon.horizon in
      coreHorizonCounts
    ) {
      coreHorizonCounts[
        horizon.horizon
      ] +=
        1;
    }
  }

  const completedOperations =
    operationEvents.filter(
      (event) =>
        event.status ===
        "Completed",
    ).length;

  const failedOperations =
    operationEvents.filter(
      (event) =>
        event.status ===
        "Failed",
    ).length;

  const decidedOperations =
    completedOperations +
    failedOperations;

  const operationSuccessPercent =
    decidedOperations
      ? (
          completedOperations /
          decidedOperations
        ) *
        100
      : 0;

  const acceptedDisclosureCount =
    REQUIRED_DISCLOSURES.filter(
      (required) =>
        disclosures.some(
          (accepted) =>
            accepted.disclosureKey ===
              required.disclosureKey &&
            accepted.version ===
              required.version,
        ),
    ).length;

  const healthCritical =
    health.checks.filter(
      (check) =>
        check.status ===
        "Critical",
    ).length;

  const healthWarnings =
    health.checks.filter(
      (check) =>
        check.status ===
        "Warning",
    ).length;

  const databaseHealthy =
    health.checks.some(
      (check) =>
        check.key ===
          "database-connectivity" &&
        check.status ===
          "Healthy",
    );

  const passedDrills =
    recoveryDrills.filter(
      (drill) =>
        drill.passed,
    );

  const recentPassedDrills =
    recoveryDrills.filter(
      (drill) =>
        drill.passed &&
        drill.ageDays <=
          90,
    );

  return {
    healthScore:
      health.score,

    healthStatus:
      health.status,

    criticalHealthChecks:
      healthCritical,

    warningHealthChecks:
      healthWarnings,

    databaseHealthy,

    mfaEnabled:
      health.securitySetting
        .mfaEnabled,

    reauthenticationEnabled:
      health.securitySetting
        .requireReauthForSensitiveActions,

    disclosureCount:
      REQUIRED_DISCLOSURES.length,

    acceptedDisclosureCount,

    allDisclosuresAccepted:
      acceptedDisclosureCount ===
      REQUIRED_DISCLOSURES.length,

    totalForecastRuns,

    settledHorizonCount:
      settledHorizons.length,

    coreHorizonCounts,

    overdueSettlementCount,

    evidenceAuditedCount,

    evidenceValidatedCount,

    evidenceCoveragePercent:
      totalForecastRuns
        ? round(
            (
              evidenceAuditedCount /
              totalForecastRuns
            ) *
            100,
          )
        : 0,

    evidenceValidatedPercent:
      evidenceAuditedCount
        ? round(
            (
              evidenceValidatedCount /
              evidenceAuditedCount
            ) *
            100,
          )
        : 0,

    futureEvidenceViolationCount,

    criticalDriftCount,

    productionModelCount:
      productionModels.length,

    successfulBacktestExists:
      latestBacktest
        ? gatesPassed(
            latestBacktest.gatesJson,
          )
        : false,

    openIncidentCount:
      incidentEvents.length,

    openCriticalIncidentCount:
      incidentEvents.filter(
        (incident) =>
          incident.severity ===
          "Critical",
      ).length,

    activeCircuitCount:
      circuitEvents.filter(
        (event) =>
          circuitIsOpen(
            event.metadataJson,
          ),
      ).length,

    recentOperationCount:
      decidedOperations,

    recentCompletedOperationCount:
      completedOperations,

    recentFailedOperationCount:
      failedOperations,

    recentOperationSuccessPercent:
      round(
        operationSuccessPercent,
      ),

    validationEvidence,

    validationEvidenceAgeDays:
      validationEvidence
        ? ageInDays(
            validationEvidence.generatedAt,
          )
        : null,

    recoveryDrills,

    passedRecoveryDrillCount:
      passedDrills.length,

    recentPassedRecoveryDrillCount:
      recentPassedDrills.length,

    currentLaunchState:
      launchState,

    pilotAgeDays:
      ageInDays(
        launchState.pilotStartedAt,
      ),
  };
}

function gate(input: {
  key: string;
  label: string;
  required: boolean;
  passed: boolean;
  warning?: boolean;
  actual:
    | string
    | number
    | boolean
    | null;
  threshold:
    | string
    | number
    | boolean
    | null;
  detail: string;
  remediation: string;
}): ReadinessGate {
  return {
    key:
      input.key,

    label:
      input.label,

    required:
      input.required,

    status:
      input.passed
        ? "Passed"
        : input.warning
          ? "Warning"
          : "Failed",

    actual:
      input.actual,

    threshold:
      input.threshold,

    detail:
      input.detail,

    remediation:
      input.remediation,
  };
}

function buildShadowGates(
  metrics: ReadinessMetrics,
) {
  return [
    gate({
      key:
        "database-connectivity",

      label:
        "Database connectivity",

      required:
        true,

      passed:
        metrics.databaseHealthy,

      actual:
        metrics.databaseHealthy,

      threshold:
        true,

      detail:
        "Shadow operation still requires persistent storage and audit logging.",

      remediation:
        "Restore PostgreSQL connectivity before operating Slice intelligence.",
    }),

    gate({
      key:
        "safe-operating-mode",

      label:
        "Safe operating mode",

      required:
        true,

      passed:
        true,

      actual:
        "Shadow",

      threshold:
        "Shadow",

      detail:
        "Shadow mode does not represent the system as validated production intelligence.",

      remediation:
        "No action required.",
    }),
  ];
}

function buildPilotGates(
  metrics: ReadinessMetrics,
) {
  const validationAge =
    metrics.validationEvidenceAgeDays;

  const pilotDrills: RecoveryDrillKey[] = [
    "RATE_LIMIT",
    "CIRCUIT_BREAKER",
    "INCIDENT_RESPONSE",
  ];

  const passedPilotDrills =
    metrics.recoveryDrills.filter(
      (drill) =>
        pilotDrills.includes(
          drill.drillKey,
        ) &&
        drill.passed &&
        drill.ageDays <=
          90,
    ).length;

  return [
    gate({
      key:
        "health-score",

      label:
        "Production health score",

      required:
        true,

      passed:
        metrics.healthScore >=
        75,

      actual:
        metrics.healthScore,

      threshold:
        75,

      detail:
        "Pilot operation requires a stable baseline without severe infrastructure degradation.",

      remediation:
        "Resolve critical security, database, provider, settlement, and incident findings.",
    }),

    gate({
      key:
        "critical-health",

      label:
        "Critical health checks",

      required:
        true,

      passed:
        metrics.criticalHealthChecks ===
        0,

      actual:
        metrics.criticalHealthChecks,

      threshold:
        0,

      detail:
        "A pilot cannot begin while a critical production-health check is failing.",

      remediation:
        "Resolve every critical health check before requesting pilot approval.",
    }),

    gate({
      key:
        "reauthentication",

      label:
        "Sensitive-action reauthentication",

      required:
        true,

      passed:
        metrics.reauthenticationEnabled,

      actual:
        metrics.reauthenticationEnabled,

      threshold:
        true,

      detail:
        "Sensitive approvals must remain protected by reauthentication policy.",

      remediation:
        "Enable reauthentication for sensitive actions.",
    }),

    gate({
      key:
        "disclosures",

      label:
        "Required disclosures",

      required:
        true,

      passed:
        metrics.allDisclosuresAccepted,

      actual:
        `${metrics.acceptedDisclosureCount}/${metrics.disclosureCount}`,

      threshold:
        `${metrics.disclosureCount}/${metrics.disclosureCount}`,

      detail:
        "All current disclosure versions must be accepted before pilot use.",

      remediation:
        "Review and accept every current Slice disclosure.",
    }),

    gate({
      key:
        "release-validation",

      label:
        "Recent release validation",

      required:
        true,

      passed:
        Boolean(
          metrics.validationEvidence
            ?.passed,
        ) &&
        validationAge !==
          null &&
        validationAge <=
          14,

      actual:
        metrics.validationEvidence
          ? `${metrics.validationEvidence.passed ? "Passed" : "Failed"} · ${validationAge ?? "unknown"} days old`
          : "Missing",

      threshold:
        "Passed within 14 days",

      detail:
        "Type checking, production build, tests, dependency audit, and secret scan must be recorded.",

      remediation:
        "Run the final validation script and record the resulting commit evidence.",
    }),

    gate({
      key:
        "forecast-history",

      label:
        "Stored forecast history",

      required:
        true,

      passed:
        metrics.totalForecastRuns >=
        3,

      actual:
        metrics.totalForecastRuns,

      threshold:
        3,

      detail:
        "A pilot needs representative stored forecasts for workflow testing.",

      remediation:
        "Generate and inspect at least three point-in-time forecasts.",
    }),

    gate({
      key:
        "settled-outcomes",

      label:
        "Settled outcome sample",

      required:
        true,

      passed:
        metrics.settledHorizonCount >=
        25,

      actual:
        metrics.settledHorizonCount,

      threshold:
        25,

      detail:
        "Pilot use requires an initial sample of realized forecast outcomes.",

      remediation:
        "Continue shadow forecasting and settlement until at least 25 outcomes are stored.",
    }),

    gate({
      key:
        "evidence-coverage",

      label:
        "Evidence warehouse coverage",

      required:
        true,

      passed:
        metrics.evidenceCoveragePercent >=
        70,

      actual:
        metrics.evidenceCoveragePercent,

      threshold:
        70,

      detail:
        "Most pilot forecasts must have materialized point-in-time evidence audits.",

      remediation:
        "Run the evidence warehouse batch audit and investigate failures.",
    }),

    gate({
      key:
        "validated-evidence",

      label:
        "Validated evidence percentage",

      required:
        true,

      passed:
        metrics.evidenceValidatedPercent >=
        60,

      actual:
        metrics.evidenceValidatedPercent,

      threshold:
        60,

      detail:
        "A majority of audited forecasts must pass the current evidence-integrity policy.",

      remediation:
        "Resolve missing, stale, fallback, and future-dated evidence.",
    }),

    gate({
      key:
        "future-evidence",

      label:
        "Future-dated evidence violations",

      required:
        true,

      passed:
        metrics.futureEvidenceViolationCount ===
        0,

      actual:
        metrics.futureEvidenceViolationCount,

      threshold:
        0,

      detail:
        "Look-ahead evidence cannot be accepted during pilot operation.",

      remediation:
        "Correct source timestamps and regenerate affected point-in-time records.",
    }),

    gate({
      key:
        "settlement-backlog",

      label:
        "Settlement backlog",

      required:
        true,

      passed:
        metrics.overdueSettlementCount <=
        10,

      actual:
        metrics.overdueSettlementCount,

      threshold:
        "10 or fewer",

      detail:
        "The settlement system must remain reasonably current during pilot use.",

      remediation:
        "Restore historical-price or market-snapshot settlement before pilot approval.",
    }),

    gate({
      key:
        "critical-drift",

      label:
        "Critical model drift",

      required:
        true,

      passed:
        metrics.criticalDriftCount ===
        0,

      actual:
        metrics.criticalDriftCount,

      threshold:
        0,

      detail:
        "A critically drifting model cannot enter pilot use.",

      remediation:
        "Keep affected models in Shadow or disable them until reviewed.",
    }),

    gate({
      key:
        "active-circuits",

      label:
        "Open circuit breakers",

      required:
        true,

      passed:
        metrics.activeCircuitCount ===
        0,

      actual:
        metrics.activeCircuitCount,

      threshold:
        0,

      detail:
        "All required pilot services must be restored before launch.",

      remediation:
        "Resolve underlying failures before closing service circuits.",
    }),

    gate({
      key:
        "critical-incidents",

      label:
        "Critical open incidents",

      required:
        true,

      passed:
        metrics.openCriticalIncidentCount ===
        0,

      actual:
        metrics.openCriticalIncidentCount,

      threshold:
        0,

      detail:
        "Critical incidents block pilot activation.",

      remediation:
        "Document root cause, containment, recovery, and resolution.",
    }),

    gate({
      key:
        "operation-sample",

      label:
        "Guarded operation sample",

      required:
        true,

      passed:
        metrics.recentOperationCount >=
        10,

      actual:
        metrics.recentOperationCount,

      threshold:
        10,

      detail:
        "Production controls need enough guarded requests to reveal basic reliability issues.",

      remediation:
        "Exercise forecast, advisor, simulation, and model workflows in Shadow mode.",
    }),

    gate({
      key:
        "operation-success",

      label:
        "Recent operation success rate",

      required:
        true,

      passed:
        metrics.recentOperationCount >=
          10 &&
        metrics.recentOperationSuccessPercent >=
          90,

      actual:
        metrics.recentOperationSuccessPercent,

      threshold:
        90,

      detail:
        "Pilot reliability must be at least 90% across decided guarded operations.",

      remediation:
        "Investigate recent failures and rerun validation after recovery.",
    }),

    gate({
      key:
        "pilot-recovery-drills",

      label:
        "Pilot recovery drills",

      required:
        true,

      passed:
        passedPilotDrills ===
        pilotDrills.length,

      actual:
        `${passedPilotDrills}/${pilotDrills.length}`,

      threshold:
        `${pilotDrills.length}/${pilotDrills.length}`,

      detail:
        "Rate limiting, circuit breaking, and incident response must be exercised within 90 days.",

      remediation:
        "Complete and document each required pilot recovery drill.",
    }),

    gate({
      key:
        "mfa-warning",

      label:
        "Multi-factor authentication",

      required:
        false,

      passed:
        metrics.mfaEnabled,

      warning:
        !metrics.mfaEnabled,

      actual:
        metrics.mfaEnabled,

      threshold:
        true,

      detail:
        "MFA is strongly recommended during pilot use and mandatory for production approval.",

      remediation:
        "Implement and verify MFA before the production launch request.",
    }),
  ];
}

function buildProductionGates(
  metrics: ReadinessMetrics,
) {
  const validationAge =
    metrics.validationEvidenceAgeDays;

  const everyCoreHorizon =
    Object.values(
      metrics.coreHorizonCounts,
    ).every(
      (count) =>
        count >=
        20,
    );

  const allDrillsRecent =
    metrics.recoveryDrills.every(
      (drill) =>
        drill.passed &&
        drill.ageDays <=
          90,
    );

  return [
    gate({
      key:
        "health-score",

      label:
        "Production health score",

      required:
        true,

      passed:
        metrics.healthScore >=
        90,

      actual:
        metrics.healthScore,

      threshold:
        90,

      detail:
        "Production operation requires a high security and reliability baseline.",

      remediation:
        "Resolve health warnings and critical checks before launch.",
    }),

    gate({
      key:
        "critical-health",

      label:
        "Critical health checks",

      required:
        true,

      passed:
        metrics.criticalHealthChecks ===
        0,

      actual:
        metrics.criticalHealthChecks,

      threshold:
        0,

      detail:
        "No critical production-health check may remain open.",

      remediation:
        "Resolve every critical health check.",
    }),

    gate({
      key:
        "warning-health",

      label:
        "Health warnings",

      required:
        true,

      passed:
        metrics.warningHealthChecks <=
        2,

      actual:
        metrics.warningHealthChecks,

      threshold:
        "2 or fewer",

      detail:
        "Only a small number of documented noncritical warnings may remain.",

      remediation:
        "Reduce or formally remediate remaining warning-level health checks.",
    }),

    gate({
      key:
        "mfa",

      label:
        "Multi-factor authentication",

      required:
        true,

      passed:
        metrics.mfaEnabled,

      actual:
        metrics.mfaEnabled,

      threshold:
        true,

      detail:
        "Production launch requires verified MFA policy.",

      remediation:
        "Implement and verify MFA before production approval.",
    }),

    gate({
      key:
        "reauthentication",

      label:
        "Sensitive-action reauthentication",

      required:
        true,

      passed:
        metrics.reauthenticationEnabled,

      actual:
        metrics.reauthenticationEnabled,

      threshold:
        true,

      detail:
        "Production approvals require sensitive-action reauthentication.",

      remediation:
        "Enable and test reauthentication for sensitive actions.",
    }),

    gate({
      key:
        "disclosures",

      label:
        "Required disclosures",

      required:
        true,

      passed:
        metrics.allDisclosuresAccepted,

      actual:
        `${metrics.acceptedDisclosureCount}/${metrics.disclosureCount}`,

      threshold:
        `${metrics.disclosureCount}/${metrics.disclosureCount}`,

      detail:
        "Every current disclosure version must be accepted.",

      remediation:
        "Review and accept every current disclosure.",
    }),

    gate({
      key:
        "release-validation",

      label:
        "Current release validation",

      required:
        true,

      passed:
        Boolean(
          metrics.validationEvidence
            ?.passed,
        ) &&
        validationAge !==
          null &&
        validationAge <=
          7,

      actual:
        metrics.validationEvidence
          ? `${metrics.validationEvidence.passed ? "Passed" : "Failed"} · ${validationAge ?? "unknown"} days old`
          : "Missing",

      threshold:
        "Passed within 7 days",

      detail:
        "The production commit must have recent typecheck, build, test, dependency, and secret-scan evidence.",

      remediation:
        "Run final validation against the exact production commit.",
    }),

    gate({
      key:
        "forecast-history",

      label:
        "Stored forecast history",

      required:
        true,

      passed:
        metrics.totalForecastRuns >=
        20,

      actual:
        metrics.totalForecastRuns,

      threshold:
        20,

      detail:
        "Production launch requires a representative operational forecast history.",

      remediation:
        "Continue Shadow and Pilot forecasting until at least 20 runs exist.",
    }),

    gate({
      key:
        "settled-outcomes",

      label:
        "Settled outcomes",

      required:
        true,

      passed:
        metrics.settledHorizonCount >=
        100,

      actual:
        metrics.settledHorizonCount,

      threshold:
        100,

      detail:
        "At least 100 settled horizon outcomes are required before production representation.",

      remediation:
        "Continue outcome collection and settlement.",
    }),

    gate({
      key:
        "core-horizon-samples",

      label:
        "Core-horizon outcome samples",

      required:
        true,

      passed:
        everyCoreHorizon,

      actual:
        JSON.stringify(
          metrics.coreHorizonCounts,
        ),

      threshold:
        "At least 20 each for 1d, 2-5d, and 1-4w",

      detail:
        "Core decision horizons need separate realized-outcome coverage.",

      remediation:
        "Continue forecasting until each core horizon reaches the minimum sample.",
    }),

    gate({
      key:
        "evidence-coverage",

      label:
        "Evidence warehouse coverage",

      required:
        true,

      passed:
        metrics.evidenceCoveragePercent >=
        95,

      actual:
        metrics.evidenceCoveragePercent,

      threshold:
        95,

      detail:
        "Nearly all stored forecasts must have materialized evidence audits.",

      remediation:
        "Audit missing forecasts and resolve failed evidence materialization.",
    }),

    gate({
      key:
        "validated-evidence",

      label:
        "Validated evidence percentage",

      required:
        true,

      passed:
        metrics.evidenceValidatedPercent >=
        90,

      actual:
        metrics.evidenceValidatedPercent,

      threshold:
        90,

      detail:
        "At least 90% of audited forecasts must pass current evidence-integrity policy.",

      remediation:
        "Resolve missing, stale, fallback, and low-quality evidence.",
    }),

    gate({
      key:
        "future-evidence",

      label:
        "Future-dated evidence violations",

      required:
        true,

      passed:
        metrics.futureEvidenceViolationCount ===
        0,

      actual:
        metrics.futureEvidenceViolationCount,

      threshold:
        0,

      detail:
        "Production validation cannot contain look-ahead evidence.",

      remediation:
        "Correct every future-dated evidence record.",
    }),

    gate({
      key:
        "settlement-backlog",

      label:
        "Settlement backlog",

      required:
        true,

      passed:
        metrics.overdueSettlementCount <=
        2,

      actual:
        metrics.overdueSettlementCount,

      threshold:
        "2 or fewer",

      detail:
        "Outcome settlement must remain operationally current.",

      remediation:
        "Restore market-data settlement and clear the overdue backlog.",
    }),

    gate({
      key:
        "production-model",

      label:
        "Human-promoted production model",

      required:
        true,

      passed:
        metrics.productionModelCount >=
        1,

      actual:
        metrics.productionModelCount,

      threshold:
        1,

      detail:
        "At least one model must have completed human-controlled promotion.",

      remediation:
        "Validate a candidate and promote it through Model Governance.",
    }),

    gate({
      key:
        "backtest-gates",

      label:
        "Successful model backtest gates",

      required:
        true,

      passed:
        metrics.successfulBacktestExists,

      actual:
        metrics.successfulBacktestExists,

      threshold:
        true,

      detail:
        "A production model needs a completed backtest with every required gate passed.",

      remediation:
        "Run point-in-time validation and resolve failed model gates.",
    }),

    gate({
      key:
        "critical-drift",

      label:
        "Critical model drift",

      required:
        true,

      passed:
        metrics.criticalDriftCount ===
        0,

      actual:
        metrics.criticalDriftCount,

      threshold:
        0,

      detail:
        "No production model may have an unresolved critical drift alert.",

      remediation:
        "Rollback or disable affected models and investigate the drift.",
    }),

    gate({
      key:
        "active-circuits",

      label:
        "Open circuit breakers",

      required:
        true,

      passed:
        metrics.activeCircuitCount ===
        0,

      actual:
        metrics.activeCircuitCount,

      threshold:
        0,

      detail:
        "Every production dependency must be restored before launch.",

      remediation:
        "Resolve the underlying service failures.",
    }),

    gate({
      key:
        "open-incidents",

      label:
        "Open incidents",

      required:
        true,

      passed:
        metrics.openIncidentCount ===
        0,

      actual:
        metrics.openIncidentCount,

      threshold:
        0,

      detail:
        "Production launch cannot proceed with an unresolved incident.",

      remediation:
        "Document root cause, containment, recovery, and incident resolution.",
    }),

    gate({
      key:
        "operation-sample",

      label:
        "Guarded operation sample",

      required:
        true,

      passed:
        metrics.recentOperationCount >=
        100,

      actual:
        metrics.recentOperationCount,

      threshold:
        100,

      detail:
        "Production controls require a meaningful recent request sample.",

      remediation:
        "Continue monitored Pilot usage until 100 decided guarded operations exist.",
    }),

    gate({
      key:
        "operation-success",

      label:
        "Recent operation success rate",

      required:
        true,

      passed:
        metrics.recentOperationCount >=
          100 &&
        metrics.recentOperationSuccessPercent >=
          97,

      actual:
        metrics.recentOperationSuccessPercent,

      threshold:
        97,

      detail:
        "The recent guarded-operation success rate must be at least 97%.",

      remediation:
        "Investigate failures, complete recovery, and repeat the Pilot observation period.",
    }),

    gate({
      key:
        "recovery-drills",

      label:
        "Complete recovery-drill set",

      required:
        true,

      passed:
        allDrillsRecent,

      actual:
        `${metrics.recentPassedRecoveryDrillCount}/${INTELLIGENCE_RECOVERY_DRILLS.length}`,

      threshold:
        `${INTELLIGENCE_RECOVERY_DRILLS.length}/${INTELLIGENCE_RECOVERY_DRILLS.length} within 90 days`,

      detail:
        "All five recovery and adversarial drills must be passed and documented.",

      remediation:
        "Complete every missing or expired recovery drill.",
    }),

    gate({
      key:
        "pilot-duration",

      label:
        "Controlled Pilot observation period",

      required:
        true,

      passed:
        metrics.currentLaunchState.mode ===
          "Pilot" &&
        metrics.pilotAgeDays !==
          null &&
        metrics.pilotAgeDays >=
          14,

      actual:
        metrics.currentLaunchState.mode ===
        "Pilot"
          ? `${metrics.pilotAgeDays ?? 0} days`
          : metrics.currentLaunchState.mode,

      threshold:
        "At least 14 days in Pilot",

      detail:
        "Production approval requires a minimum two-week controlled Pilot period.",

      remediation:
        "Launch Pilot first and complete at least 14 days of monitored operation.",
    }),
  ];
}

export async function evaluateLaunchReadiness(
  input: {
    userId: string;
    targetMode: IntelligenceLaunchMode;
  },
): Promise<LaunchReadinessResult> {
  const metrics =
    await collectReadinessMetrics(
      input.userId,
    );

  const gates =
    input.targetMode ===
    "Production"
      ? buildProductionGates(
          metrics,
        )
      : input.targetMode ===
          "Pilot"
        ? buildPilotGates(
            metrics,
          )
        : buildShadowGates(
            metrics,
          );

  const required =
    gates.filter(
      (item) =>
        item.required,
    );

  const passed =
    required.filter(
      (item) =>
        item.status ===
        "Passed",
    );

  const allPassed =
    required.every(
      (item) =>
        item.status ===
        "Passed",
    );

  const blockers =
    required
      .filter(
        (item) =>
          item.status !==
          "Passed",
      )
      .map(
        (item) =>
          item.label,
      );

  const warnings =
    gates
      .filter(
        (item) =>
          item.status ===
          "Warning",
      )
      .map(
        (item) =>
          item.label,
      );

  return {
    generatedAt:
      new Date().toISOString(),

    targetMode:
      input.targetMode,

    currentState:
      metrics.currentLaunchState,

    score:
      required.length
        ? round(
            (
              passed.length /
              required.length
            ) *
            100,
          )
        : 100,

    status:
      allPassed
        ? "Ready"
        : "Blocked",

    allRequiredGatesPassed:
      allPassed,

    passedRequiredGateCount:
      passed.length,

    requiredGateCount:
      required.length,

    gates,

    blockers,

    warnings,

    metrics,

    confirmationPhrase:
      confirmationPhrase(
        input.targetMode,
      ),

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      automaticLaunchEnabled:
        false,

      humanApprovalRequired:
        true,

      exactConfirmationRequired:
        true,
    },
  };
}

export async function recordReleaseValidationEvidence(
  input: {
    userId: string;
    commitSha: string;
    branch: string;
    typecheckPassed: boolean;
    buildPassed: boolean;
    testsPassed: boolean;
    dependencyAuditPassed: boolean;
    secretScanPassed: boolean;
    notes?: string;
    request?: Request;
  },
) {
  const commitSha =
    cleanText(
      input.commitSha,
      100,
    ).toLowerCase();

  if (
    !/^[a-f0-9]{7,64}$/.test(
      commitSha,
    )
  ) {
    throw new Error(
      "commitSha must contain 7 to 64 hexadecimal characters.",
    );
  }

  const branch =
    cleanText(
      input.branch,
      200,
    );

  if (!branch) {
    throw new Error(
      "A branch name is required.",
    );
  }

  const generatedAt =
    new Date().toISOString();

  const passed =
    input.typecheckPassed &&
    input.buildPassed &&
    input.testsPassed &&
    input.dependencyAuditPassed &&
    input.secretScanPassed;

  const metadata = {
    commitSha,

    branch,

    generatedAt,

    typecheckPassed:
      input.typecheckPassed,

    buildPassed:
      input.buildPassed,

    testsPassed:
      input.testsPassed,

    dependencyAuditPassed:
      input.dependencyAuditPassed,

    secretScanPassed:
      input.secretScanPassed,

    passed,

    notes:
      cleanText(
        input.notes,
        4_000,
      ),

    autonomousTradingEnabled:
      false,
  };

  const event =
    await prisma.backendPlatformEvent.create({
      data: {
        userId:
          input.userId,

        eventKey: [
          "release-validation",
          commitSha,
          Date.now(),
          randomUUID(),
        ].join(
          ":",
        ),

        eventType:
          RELEASE_VALIDATION_EVENT_TYPE,

        area:
          "Security",

        actorName:
          "Release reviewer",

        title:
          `Release validation ${passed ? "passed" : "failed"}`,

        detail:
          `Commit ${commitSha} on ${branch}.`,

        severity:
          passed
            ? "Info"
            : "Critical",

        status:
          passed
            ? "Passed"
            : "Failed",

        sourceType:
          "GitCommit",

        sourceId:
          commitSha,

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
      "INTELLIGENCE_RELEASE_VALIDATION_RECORDED",

    severity:
      passed
        ? "Info"
        : "Critical",

    area:
      "Security",

    title:
      event.title,

    detail:
      event.detail ??
      undefined,

    metadata,

    request:
      input.request,
  });

  return {
    event,

    evidence:
      parseValidationEvidence(
        {
          id:
            event.id,

          createdAt:
            event.createdAt,

          metadataJson:
            event.metadataJson,
        },
      ),
  };
}

export async function recordRecoveryDrill(
  input: {
    userId: string;
    drillKey: string;
    passed: boolean;
    evidence: string;
    request?: Request;
  },
) {
  if (
    !isRecoveryDrillKey(
      input.drillKey,
    )
  ) {
    throw new Error(
      "Unknown recovery drill.",
    );
  }

  const evidence =
    cleanText(
      input.evidence,
      8_000,
    );

  if (
    evidence.length <
    20
  ) {
    throw new Error(
      "Recovery-drill evidence must contain at least 20 characters.",
    );
  }

  const definition =
    INTELLIGENCE_RECOVERY_DRILLS.find(
      (drill) =>
        drill.key ===
        input.drillKey,
    );

  const performedAt =
    new Date().toISOString();

  const metadata = {
    drillKey:
      input.drillKey,

    label:
      definition?.label ??
      input.drillKey,

    description:
      definition?.description ??
      "",

    passed:
      input.passed,

    evidence,

    performedAt,

    performedByUserId:
      input.userId,

    autonomousTradingEnabled:
      false,
  };

  const event =
    await prisma.backendPlatformEvent.create({
      data: {
        userId:
          input.userId,

        eventKey: [
          "recovery-drill",
          input.drillKey,
          Date.now(),
          randomUUID(),
        ].join(
          ":",
        ),

        eventType:
          RECOVERY_DRILL_EVENT_TYPE,

        area:
          "Security",

        actorName:
          "Recovery drill reviewer",

        title:
          `${definition?.label ?? input.drillKey}: ${input.passed ? "Passed" : "Failed"}`,

        detail:
          evidence,

        severity:
          input.passed
            ? "Info"
            : "Warning",

        status:
          input.passed
            ? "Passed"
            : "Failed",

        sourceType:
          "RecoveryDrill",

        sourceId:
          input.drillKey,

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
      "INTELLIGENCE_RECOVERY_DRILL_RECORDED",

    severity:
      input.passed
        ? "Info"
        : "Warning",

    area:
      "Security",

    title:
      event.title,

    detail:
      evidence,

    metadata,

    request:
      input.request,
  });

  return {
    event,

    drill:
      parseRecoveryDrill(
        {
          id:
            event.id,

          userId:
            event.userId,

          createdAt:
            event.createdAt,

          metadataJson:
            event.metadataJson,
        },
      ),
  };
}

export async function requestIntelligenceLaunch(
  input: {
    userId: string;
    targetMode: IntelligenceLaunchMode;
    reason: string;
    request?: Request;
  },
) {
  const reason =
    cleanText(
      input.reason,
      4_000,
    );

  if (
    reason.length <
    20
  ) {
    throw new Error(
      "A launch reason of at least 20 characters is required.",
    );
  }

  const readiness =
    await evaluateLaunchReadiness({
      userId:
        input.userId,

      targetMode:
        input.targetMode,
    });

  if (
    input.targetMode !==
      "Shadow" &&
    !readiness
      .allRequiredGatesPassed
  ) {
    throw new Error(
      `Launch request is blocked by: ${readiness.blockers.join(
        ", ",
      )}.`,
    );
  }

  const existing =
    await prisma.backendApprovalItem.findFirst({
      where: {
        userId:
          input.userId,

        actionType:
          LAUNCH_APPROVAL_ACTION_TYPE,

        status:
          "Pending",

        payloadJson: {
          contains:
            `"targetMode":"${input.targetMode}"`,
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  if (existing) {
    return {
      approval:
        existing,

      readiness,

      reused:
        true,
    };
  }

  const approval =
    await prisma.backendApprovalItem.create({
      data: {
        userId:
          input.userId,

        title:
          `${input.targetMode} launch approval`,

        actionType:
          LAUNCH_APPROVAL_ACTION_TYPE,

        riskLevel:
          input.targetMode ===
          "Production"
            ? "High"
            : input.targetMode ===
                "Pilot"
              ? "Medium"
              : "Low",

        summary:
          reason,

        payloadJson:
          safeJson(
            {
              targetMode:
                input.targetMode,

              requestedAt:
                new Date().toISOString(),

              requestedByUserId:
                input.userId,

              reason,

              readinessSnapshot:
                readiness,

              exactConfirmationPhrase:
                confirmationPhrase(
                  input.targetMode,
                ),

              autonomousTradingEnabled:
                false,

              moneyMovementEnabled:
                false,
            },
            "{}",
          ),

        requestedBy:
          input.userId,

        status:
          "Pending",
      },
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_LAUNCH_REQUESTED",

    severity:
      input.targetMode ===
      "Production"
        ? "Critical"
        : "Warning",

    area:
      "Security",

    title:
      approval.title,

    detail:
      reason,

    metadata: {
      approvalId:
        approval.id,

      targetMode:
        input.targetMode,

      readinessScore:
        readiness.score,

      exactConfirmationRequired:
        true,

      automaticLaunchEnabled:
        false,
    },

    request:
      input.request,
  });

  return {
    approval,

    readiness,

    reused:
      false,
  };
}

function parseLaunchApprovalPayload(
  value: string,
) {
  const parsed =
    parseJson(value);

  if (!isRecord(parsed)) {
    throw new Error(
      "Launch approval payload is invalid.",
    );
  }

  const targetMode =
    cleanText(
      parsed.targetMode,
      30,
    );

  if (
    !isLaunchMode(
      targetMode,
    )
  ) {
    throw new Error(
      "Launch approval target mode is invalid.",
    );
  }

  return {
    targetMode,

    reason:
      cleanText(
        parsed.reason,
        4_000,
      ),

    requestedAt:
      cleanText(
        parsed.requestedAt,
        100,
      ),
  };
}

export async function decideIntelligenceLaunch(
  input: {
    userId: string;
    approvalId: string;
    decision:
      | "approve"
      | "reject";
    confirmationPhrase?: string;
    notes?: string;
    request?: Request;
  },
) {
  const approval =
    await prisma.backendApprovalItem.findFirst({
      where: {
        id:
          input.approvalId,

        userId:
          input.userId,

        actionType:
          LAUNCH_APPROVAL_ACTION_TYPE,
      },
    });

  if (!approval) {
    throw new Error(
      "Launch approval was not found.",
    );
  }

  if (
    approval.status !==
    "Pending"
  ) {
    throw new Error(
      "This launch approval has already been decided.",
    );
  }

  const payload =
    parseLaunchApprovalPayload(
      approval.payloadJson,
    );

  const notes =
    cleanText(
      input.notes,
      4_000,
    );

  if (
    input.decision ===
    "reject"
  ) {
    const rejected =
      await prisma.backendApprovalItem.update({
        where: {
          id:
            approval.id,
        },

        data: {
          status:
            "Rejected",

          approvedBy:
            input.userId,

          approvalNotes:
            notes ||
            "Launch request rejected.",

          decidedAt:
            new Date(),
        },
      });

    await recordAuditLog({
      userId:
        input.userId,

      eventType:
        "INTELLIGENCE_LAUNCH_REJECTED",

      severity:
        "Warning",

      area:
        "Security",

      title:
        approval.title,

      detail:
        notes ||
        "Launch request rejected.",

      metadata: {
        approvalId:
          approval.id,

        targetMode:
          payload.targetMode,
      },

      request:
        input.request,
    });

    return {
      approval:
        rejected,

      launchState:
        await getIntelligenceLaunchState(
          input.userId,
        ),

      readiness:
        null,
    };
  }

  const requiredPhrase =
    confirmationPhrase(
      payload.targetMode,
    );

  if (
    cleanText(
      input.confirmationPhrase,
      200,
    ) !==
    requiredPhrase
  ) {
    throw new Error(
      `The exact confirmation phrase is required: ${requiredPhrase}`,
    );
  }

  const readiness =
    await evaluateLaunchReadiness({
      userId:
        input.userId,

      targetMode:
        payload.targetMode,
    });

  if (
    payload.targetMode !==
      "Shadow" &&
    !readiness
      .allRequiredGatesPassed
  ) {
    throw new Error(
      `Launch approval is blocked by: ${readiness.blockers.join(
        ", ",
      )}.`,
    );
  }

  const currentState =
    await getIntelligenceLaunchState(
      input.userId,
    );

  const now =
    new Date().toISOString();

  const pilotStartedAt =
    payload.targetMode ===
    "Pilot"
      ? now
      : payload.targetMode ===
          "Production"
        ? currentState.pilotStartedAt
        : null;

  const launchState:
    IntelligenceLaunchState = {
    mode:
      payload.targetMode,

    status:
      "Active",

    activatedAt:
      now,

    approvedByUserId:
      input.userId,

    approvalId:
      approval.id,

    reason:
      notes ||
      payload.reason ||
      "Human-approved launch-state change.",

    previousMode:
      currentState.mode,

    releaseCommitSha:
      readiness.metrics
        .validationEvidence
        ?.commitSha ??
      currentState.releaseCommitSha,

    pilotStartedAt,

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      clientCommunicationAutomatic:
        false,

      automaticModelPromotionEnabled:
        false,
    },
  };

  await prisma.$transaction([
    prisma.backendPlatformEvent.upsert({
      where: {
        userId_eventKey: {
          userId:
            input.userId,

          eventKey:
            LAUNCH_STATE_EVENT_KEY,
        },
      },

      update: {
        eventType:
          LAUNCH_STATE_EVENT_TYPE,

        area:
          "Security",

        title:
          `Slice Intelligence operating mode: ${payload.targetMode}`,

        detail:
          launchState.reason,

        severity:
          payload.targetMode ===
          "Production"
            ? "Critical"
            : payload.targetMode ===
                "Pilot"
              ? "Warning"
              : "Info",

        status:
          "Active",

        sourceType:
          "LaunchState",

        sourceId:
          approval.id,

        metadataJson:
          safeJson(
            launchState,
            "{}",
          ),
      },

      create: {
        userId:
          input.userId,

        eventKey:
          LAUNCH_STATE_EVENT_KEY,

        eventType:
          LAUNCH_STATE_EVENT_TYPE,

        area:
          "Security",

        actorName:
          "Human launch reviewer",

        title:
          `Slice Intelligence operating mode: ${payload.targetMode}`,

        detail:
          launchState.reason,

        severity:
          payload.targetMode ===
          "Production"
            ? "Critical"
            : payload.targetMode ===
                "Pilot"
              ? "Warning"
              : "Info",

        status:
          "Active",

        sourceType:
          "LaunchState",

        sourceId:
          approval.id,

        metadataJson:
          safeJson(
            launchState,
            "{}",
          ),
      },
    }),

    prisma.backendApprovalItem.update({
      where: {
        id:
          approval.id,
      },

      data: {
        status:
          "Approved",

        approvedBy:
          input.userId,

        approvalNotes:
          notes ||
          `Approved transition to ${payload.targetMode}.`,

        decidedAt:
          new Date(),
      },
    }),
  ]);

  const alertKey = [
    "intelligence-launch-state",
    payload.targetMode,
    now.slice(
      0,
      10,
    ),
  ].join(
    ":",
  );

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId:
          input.userId,

        dedupeKey:
          alertKey,
      },
    },

    update: {
      title:
        `Slice Intelligence entered ${payload.targetMode}`,

      body:
        launchState.reason,

      source:
        "Slice Launch Controls",

      urgency:
        payload.targetMode ===
        "Production"
          ? "Critical"
          : "Medium",

      score:
        payload.targetMode ===
        "Production"
          ? 100
          : 80,

      channel:
        "Dashboard",

      status:
        "Unread",

      aiBriefing:
        launchState.reason,
    },

    create: {
      userId:
        input.userId,

      dedupeKey:
        alertKey,

      title:
        `Slice Intelligence entered ${payload.targetMode}`,

      body:
        launchState.reason,

      source:
        "Slice Launch Controls",

      ticker:
        null,

      urgency:
        payload.targetMode ===
        "Production"
          ? "Critical"
          : "Medium",

      score:
        payload.targetMode ===
        "Production"
          ? 100
          : 80,

      channel:
        "Dashboard",

      status:
        "Unread",

      sourceUrl:
        null,

      aiBriefing:
        launchState.reason,
    },
  });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_LAUNCH_APPROVED",

    severity:
      payload.targetMode ===
      "Production"
        ? "Critical"
        : "Warning",

    area:
      "Security",

    title:
      `Slice Intelligence entered ${payload.targetMode}`,

    detail:
      launchState.reason,

    metadata: {
      approvalId:
        approval.id,

      previousMode:
        currentState.mode,

      targetMode:
        payload.targetMode,

      releaseCommitSha:
        launchState.releaseCommitSha,

      readinessScore:
        readiness.score,

      exactConfirmationMatched:
        true,

      automaticLaunchEnabled:
        false,

      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,
    },

    request:
      input.request,
  });

  return {
    approval:
      await prisma.backendApprovalItem.findUnique({
        where: {
          id:
            approval.id,
        },
      }),

    launchState,

    readiness,
  };
}

async function persistReadinessSnapshot(
  input: {
    userId: string;
    result: LaunchReadinessResult;
  },
) {
  return prisma.backendPlatformEvent.create({
    data: {
      userId:
        input.userId,

      eventKey: [
        "launch-readiness",
        input.result.targetMode,
        Date.now(),
        randomUUID(),
      ].join(
        ":",
      ),

      eventType:
        READINESS_EVENT_TYPE,

      area:
        "Security",

      actorName:
        "Slice Launch Controls",

      title:
        `${input.result.targetMode} readiness: ${input.result.status}`,

      detail:
        `Score ${input.result.score}/100 with ${input.result.blockers.length} blocker(s).`,

      severity:
        input.result.status ===
        "Ready"
          ? "Info"
          : input.result.targetMode ===
              "Production"
            ? "Critical"
            : "Warning",

      status:
        input.result.status,

      sourceType:
        "LaunchReadiness",

      sourceId:
        input.result.targetMode,

      metadataJson:
        safeJson(
          input.result,
          "{}",
        ),
    },
  });
}

async function createReadinessRegressionAlert(
  input: {
    userId: string;
    result: LaunchReadinessResult;
  },
) {
  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const dedupeKey = [
    "launch-readiness-regression",
    input.result.currentState.mode,
    date,
  ].join(
    ":",
  );

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId:
          input.userId,

        dedupeKey,
      },
    },

    update: {
      title:
        `${input.result.currentState.mode} readiness regression`,

      body:
        `Current operating mode no longer satisfies its launch gates. Blockers: ${input.result.blockers.join(
          ", ",
        )}.`,

      source:
        "Slice Launch Controls",

      urgency:
        input.result.currentState.mode ===
        "Production"
          ? "Critical"
          : "High",

      score:
        input.result.currentState.mode ===
        "Production"
          ? 100
          : 90,

      channel:
        "Dashboard",

      status:
        "Unread",

      aiBriefing:
        `Readiness score ${input.result.score}/100.`,
    },

    create: {
      userId:
        input.userId,

      dedupeKey,

      title:
        `${input.result.currentState.mode} readiness regression`,

      body:
        `Current operating mode no longer satisfies its launch gates. Blockers: ${input.result.blockers.join(
          ", ",
        )}.`,

      source:
        "Slice Launch Controls",

      ticker:
        null,

      urgency:
        input.result.currentState.mode ===
        "Production"
          ? "Critical"
          : "High",

      score:
        input.result.currentState.mode ===
        "Production"
          ? 100
          : 90,

      channel:
        "Dashboard",

      status:
        "Unread",

      sourceUrl:
        null,

      aiBriefing:
        `Readiness score ${input.result.score}/100.`,
    },
  });

  if (
    input.result.currentState.mode ===
    "Production"
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        );

    const existing =
      await prisma.backendPlatformEvent.findFirst({
        where: {
          userId:
            input.userId,

          eventType:
            INCIDENT_EVENT_TYPE,

          sourceType:
            "LaunchReadinessRegression",

          status:
            "Open",

          createdAt: {
            gte:
              new Date(
                `${today}T00:00:00.000Z`,
              ),
          },
        },
      });

    if (!existing) {
      await createIntelligenceIncident({
        userId:
          input.userId,

        title:
          "Production readiness regression",

        summary:
          `Production launch gates are no longer satisfied. Blockers: ${input.result.blockers.join(
            ", ",
          )}. Review whether Slice should return to Shadow mode.`,

        severity:
          "Critical",

        sourceType:
          "LaunchReadinessRegression",

        sourceId:
          input.result.currentState.approvalId ??
          undefined,
      });
    }
  }
}

export async function runLaunchReadinessScan(
  input: {
    userId: string;
    targetMode: IntelligenceLaunchMode;
    persist?: boolean;
  },
) {
  const target =
    await evaluateLaunchReadiness({
      userId:
        input.userId,

      targetMode:
        input.targetMode,
    });

  if (
    input.persist !==
    false
  ) {
    await persistReadinessSnapshot({
      userId:
        input.userId,

      result:
        target,
    });
  }

  let currentModeReadiness:
    LaunchReadinessResult | null =
    null;

  if (
    target.currentState.mode !==
    "Shadow"
  ) {
    currentModeReadiness =
      target.currentState.mode ===
      target.targetMode
        ? target
        : await evaluateLaunchReadiness({
            userId:
              input.userId,

            targetMode:
              target.currentState.mode,
          });

    if (
      !currentModeReadiness
        .allRequiredGatesPassed
    ) {
      await createReadinessRegressionAlert({
        userId:
          input.userId,

        result:
          currentModeReadiness,
      });
    }
  }

  return {
    target,

    currentModeReadiness,
  };
}

export async function getLaunchReadinessOverview(
  input: {
    userId: string;
    targetMode: IntelligenceLaunchMode;
  },
) {
  const [
    scan,
    pendingApprovals,
    recentSnapshots,
  ] =
    await Promise.all([
      runLaunchReadinessScan({
        userId:
          input.userId,

        targetMode:
          input.targetMode,

        persist:
          false,
      }),

      prisma.backendApprovalItem.findMany({
        where: {
          userId:
            input.userId,

          actionType:
            LAUNCH_APPROVAL_ACTION_TYPE,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          25,
      }),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId:
            input.userId,

          eventType:
            READINESS_EVENT_TYPE,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          30,

        select: {
          id:
            true,

          title:
            true,

          status:
            true,

          severity:
            true,

          createdAt:
            true,

          metadataJson:
            true,
        },
      }),
    ]);

  return {
    generatedAt:
      new Date().toISOString(),

    targetMode:
      input.targetMode,

    readiness:
      scan.target,

    currentModeReadiness:
      scan.currentModeReadiness,

    pendingApprovals,

    recoveryDrillDefinitions:
      INTELLIGENCE_RECOVERY_DRILLS,

    recentSnapshots:
      recentSnapshots.map(
        (snapshot) => ({
          ...snapshot,

          metadata:
            parseJson(
              snapshot.metadataJson,
            ),
        }),
      ),

    safeguards: {
      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,

      automaticLaunchEnabled:
        false,

      automaticRollbackEnabled:
        false,

      humanApprovalRequired:
        true,

      exactConfirmationRequired:
        true,
    },
  };
}