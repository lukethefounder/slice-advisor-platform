import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const ENTITY_TYPE =
  "IntelligenceForecastEvidence";

const OVERALL_SOURCE =
  "Overall Snapshot";

const FUTURE_TOLERANCE_MS =
  5 * 60 * 1000;

const MAX_SCOPE_RUNS =
  5_000;

type JsonRecord =
  Record<string, unknown>;

type TimestampEvidence = {
  path: string;
  observedAt: Date;
};

type ForecastRunLike = {
  id: string;
  userId: string;
  requestId: string;
  symbol: string;
  asOfAt: Date;
  generatedAt: Date;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  dataQualityScore: number;
  staleDataWarning: string | null;
  inputJson: string;
  outputJson: string;
  status: string;
};

type SourceDefinition = {
  sourceName: string;
  aliases: string[];
  required: boolean;
};

export type EvidenceCategoryReport = {
  sourceName: string;
  present: boolean;
  required: boolean;
  qualityScore: number;
  liveStatus: string;
  freshnessStatus: string;
  fallbackUsed: boolean;
  stale: boolean;
  futureTimestampCount: number;
  asOfAt: Date | null;
  warnings: string[];
  status: "Validated" | "Needs Review";
};

export type PointInTimeEvidenceReport = {
  runId: string;
  requestId: string;
  symbol: string;
  generatedAt: Date;
  runAsOfAt: Date;
  inputAsOfAt: Date | null;
  earliestEvidenceAt: Date | null;
  latestEvidenceAt: Date | null;
  timestampCount: number;
  futureEvidenceCount: number;
  futureEvidencePaths: string[];
  missingRequiredCategories: string[];
  fallbackCategories: string[];
  staleCategories: string[];
  integrityScore: number;
  pointInTimeSafe: boolean;
  warnings: string[];
  categories: EvidenceCategoryReport[];
};

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    sourceName: "Market Price",
    aliases: [
      "price",
      "quote",
      "marketPrice",
      "marketData",
    ],
    required: true,
  },
  {
    sourceName: "Technicals",
    aliases: [
      "technicals",
      "technical",
      "technicalIndicators",
    ],
    required: true,
  },
  {
    sourceName: "Fundamentals",
    aliases: [
      "fundamentals",
      "fundamental",
      "financials",
    ],
    required: true,
  },
  {
    sourceName: "News",
    aliases: [
      "news",
      "headlines",
      "sentiment",
      "newsSentiment",
    ],
    required: true,
  },
  {
    sourceName: "Macro",
    aliases: [
      "macro",
      "macroeconomic",
      "economy",
      "economic",
    ],
    required: true,
  },
  {
    sourceName: "Positioning",
    aliases: [
      "positioning",
      "options",
      "marketPositioning",
      "flows",
    ],
    required: true,
  },
  {
    sourceName: "Environment",
    aliases: [
      "environment",
      "environmental",
      "climate",
    ],
    required: true,
  },
  {
    sourceName: "Supply Chain",
    aliases: [
      "supplyChain",
      "supply_chain",
      "supplychain",
    ],
    required: true,
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

function normalizeKey(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    );
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
      value * factor,
    ) / factor
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
    ) / values.length
  );
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

function parseJsonRecord(
  value: string,
) {
  try {
    const parsed =
      JSON.parse(
        value,
      ) as unknown;

    return isRecord(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function parseDateValue(
  value: unknown,
) {
  if (
    typeof value ===
    "string"
  ) {
    const trimmed =
      value.trim();

    if (
      !/^\d{4}-\d{2}-\d{2}/.test(
        trimmed,
      )
    ) {
      return null;
    }

    const parsed =
      new Date(
        trimmed,
      );

    return Number.isFinite(
      parsed.getTime(),
    )
      ? parsed
      : null;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    const milliseconds =
      value >
      10_000_000_000
        ? value
        : value * 1_000;

    const parsed =
      new Date(
        milliseconds,
      );

    return Number.isFinite(
      parsed.getTime(),
    )
      ? parsed
      : null;
  }

  return null;
}

function isTimestampKey(
  key: string,
) {
  const normalized =
    normalizeKey(key);

  return [
    "asof",
    "asofat",
    "timestamp",
    "providertimestamp",
    "receivedat",
    "publishedat",
    "updatedat",
    "filingat",
    "filingdate",
    "reportdate",
    "eventdate",
    "observedat",
  ].some(
    (candidate) =>
      normalized ===
        candidate ||
      normalized.endsWith(
        candidate,
      ),
  );
}

function collectTimestampEvidence(
  value: unknown,
  path = "$",
  depth = 0,
  output:
    TimestampEvidence[] = [],
) {
  if (depth > 10) {
    return output;
  }

  if (
    Array.isArray(value)
  ) {
    value.forEach(
      (item, index) => {
        collectTimestampEvidence(
          item,
          `${path}[${index}]`,
          depth + 1,
          output,
        );
      },
    );

    return output;
  }

  if (!isRecord(value)) {
    return output;
  }

  for (
    const [
      key,
      childValue,
    ] of Object.entries(
      value,
    )
  ) {
    const childPath =
      `${path}.${key}`;

    if (
      isTimestampKey(key)
    ) {
      const parsed =
        parseDateValue(
          childValue,
        );

      if (parsed) {
        output.push({
          path:
            childPath,
          observedAt:
            parsed,
        });
      }
    }

    if (
      isRecord(
        childValue,
      ) ||
      Array.isArray(
        childValue,
      )
    ) {
      collectTimestampEvidence(
        childValue,
        childPath,
        depth + 1,
        output,
      );
    }
  }

  return output;
}

function unwrapSnapshot(
  root: JsonRecord,
) {
  const wrapperNames = [
    "immutableEvidenceSnapshot",
    "marketSnapshot",
    "snapshot",
    "evidenceSnapshot",
  ];

  for (
    const name of
      wrapperNames
  ) {
    const value =
      findValueByAliases(
        root,
        [name],
      );

    if (isRecord(value)) {
      return value;
    }
  }

  return root;
}

function findValueByAliases(
  root: JsonRecord,
  aliases: string[],
) {
  const normalizedAliases =
    new Set(
      aliases.map(
        normalizeKey,
      ),
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      root,
    )
  ) {
    if (
      normalizedAliases.has(
        normalizeKey(key),
      )
    ) {
      return value;
    }
  }

  return undefined;
}

function valueIsPresent(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value ===
    "string"
  ) {
    return (
      value.trim().length >
      0
    );
  }

  if (
    Array.isArray(value)
  ) {
    return (
      value.length > 0
    );
  }

  if (isRecord(value)) {
    return (
      Object.keys(value)
        .length > 0
    );
  }

  return true;
}

function findNumericScore(
  value: unknown,
  depth = 0,
): number | null {
  if (depth > 5) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const preferredKeys = [
    "dataQuality",
    "dataQualityScore",
    "qualityScore",
    "confidence",
    "confidenceScore",
  ];

  for (
    const preferredKey of
      preferredKeys
  ) {
    const matched =
      Object.entries(
        value,
      ).find(
        ([key]) =>
          normalizeKey(key) ===
          normalizeKey(
            preferredKey,
          ),
      );

    if (!matched) {
      continue;
    }

    const numeric =
      Number(
        matched[1],
      );

    if (
      Number.isFinite(
        numeric,
      )
    ) {
      return clamp(
        numeric,
        0,
        100,
      );
    }
  }

  for (
    const child of
      Object.values(value)
  ) {
    if (isRecord(child)) {
      const nested =
        findNumericScore(
          child,
          depth + 1,
        );

      if (
        nested !== null
      ) {
        return nested;
      }
    }
  }

  return null;
}

function containsText(
  value: unknown,
  patterns: string[],
  depth = 0,
): boolean {
  if (depth > 7) {
    return false;
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.toLowerCase();

    return patterns.some(
      (pattern) =>
        normalized.includes(
          pattern,
        ),
    );
  }

  if (
    Array.isArray(value)
  ) {
    return value.some(
      (child) =>
        containsText(
          child,
          patterns,
          depth + 1,
        ),
    );
  }

  if (isRecord(value)) {
    return Object.values(
      value,
    ).some(
      (child) =>
        containsText(
          child,
          patterns,
          depth + 1,
        ),
    );
  }

  return false;
}

function containsBooleanFlag(
  value: unknown,
  keys: string[],
  expectedValue: boolean,
  depth = 0,
): boolean {
  if (
    depth > 7 ||
    !isRecord(value)
  ) {
    return false;
  }

  const normalizedKeys =
    new Set(
      keys.map(
        normalizeKey,
      ),
    );

  for (
    const [
      key,
      childValue,
    ] of Object.entries(
      value,
    )
  ) {
    if (
      normalizedKeys.has(
        normalizeKey(key),
      ) &&
      childValue ===
        expectedValue
    ) {
      return true;
    }

    if (
      isRecord(
        childValue,
      ) &&
      containsBooleanFlag(
        childValue,
        keys,
        expectedValue,
        depth + 1,
      )
    ) {
      return true;
    }
  }

  return false;
}

function collectWarnings(
  value: unknown,
  depth = 0,
  output:
    string[] = [],
) {
  if (
    depth > 7 ||
    output.length >= 20
  ) {
    return output;
  }

  if (!isRecord(value)) {
    return output;
  }

  for (
    const [
      key,
      childValue,
    ] of Object.entries(
      value,
    )
  ) {
    const normalized =
      normalizeKey(key);

    const warningKey =
      normalized.includes(
        "warning",
      ) ||
      normalized.includes(
        "error",
      ) ||
      normalized.includes(
        "limitation",
      );

    if (
      warningKey &&
      typeof childValue ===
        "string" &&
      childValue.trim()
    ) {
      output.push(
        childValue
          .trim()
          .slice(
            0,
            500,
          ),
      );
    }

    if (
      warningKey &&
      Array.isArray(
        childValue,
      )
    ) {
      for (
        const warning of
          childValue
      ) {
        if (
          typeof warning ===
            "string" &&
          warning.trim()
        ) {
          output.push(
            warning
              .trim()
              .slice(
                0,
                500,
              ),
          );
        }
      }
    }

    if (
      isRecord(
        childValue,
      )
    ) {
      collectWarnings(
        childValue,
        depth + 1,
        output,
      );
    }
  }

  return Array.from(
    new Set(output),
  ).slice(
    0,
    20,
  );
}

function findInputAsOf(
  snapshot: JsonRecord,
) {
  const value =
    findValueByAliases(
      snapshot,
      [
        "asOf",
        "asOfAt",
        "timestamp",
        "snapshotAt",
      ],
    );

  return parseDateValue(
    value,
  );
}

function latestDate(
  dates: Date[],
) {
  if (!dates.length) {
    return null;
  }

  return new Date(
    Math.max(
      ...dates.map(
        (date) =>
          date.getTime(),
      ),
    ),
  );
}

function earliestDate(
  dates: Date[],
) {
  if (!dates.length) {
    return null;
  }

  return new Date(
    Math.min(
      ...dates.map(
        (date) =>
          date.getTime(),
      ),
    ),
  );
}

function categoryReport(
  input: {
    definition:
      SourceDefinition;
    snapshot:
      JsonRecord;
    generatedAt:
      Date;
    defaultQuality:
      number;
    rootStale:
      boolean;
  },
): EvidenceCategoryReport {
  const categoryValue =
    findValueByAliases(
      input.snapshot,
      input.definition
        .aliases,
    );

  const present =
    valueIsPresent(
      categoryValue,
    );

  const timestamps =
    collectTimestampEvidence(
      categoryValue,
      `${
        input.definition
          .sourceName
      }`,
    );

  const futureTimestamps =
    timestamps.filter(
      (item) =>
        item.observedAt.getTime() >
        input.generatedAt.getTime() +
          FUTURE_TOLERANCE_MS,
    );

  const categoryWarnings =
    collectWarnings(
      categoryValue,
    );

  const fallbackUsed =
    containsText(
      categoryValue,
      [
        "demo fallback",
        "demo data",
        "fallback",
        "synthetic value",
      ],
    ) ||
    containsBooleanFlag(
      categoryValue,
      [
        "isRealtime",
      ],
      false,
    );

  const explicitlyStale =
    containsBooleanFlag(
      categoryValue,
      [
        "stale",
        "staleData",
        "isStale",
      ],
      true,
    ) ||
    containsText(
      categoryValue,
      [
        "stale data",
        "provider timestamp is stale",
      ],
    );

  const rootStaleApplies =
    input.rootStale &&
    [
      "Market Price",
      "News",
    ].includes(
      input.definition
        .sourceName,
    );

  const stale =
    explicitlyStale ||
    rootStaleApplies;

  const explicitQuality =
    findNumericScore(
      categoryValue,
    );

  let qualityScore =
    present
      ? explicitQuality ??
        input.defaultQuality
      : 0;

  if (fallbackUsed) {
    qualityScore -= 20;
  }

  if (stale) {
    qualityScore -= 15;
  }

  if (
    futureTimestamps.length
  ) {
    qualityScore -= 40;
  }

  qualityScore =
    round(
      clamp(
        qualityScore,
        0,
        100,
      ),
    );

  const warnings = [
    ...categoryWarnings,
  ];

  if (
    input.definition
      .required &&
    !present
  ) {
    warnings.unshift(
      `${input.definition.sourceName} evidence is missing.`,
    );
  }

  if (fallbackUsed) {
    warnings.push(
      `${input.definition.sourceName} used fallback or non-live evidence.`,
    );
  }

  if (stale) {
    warnings.push(
      `${input.definition.sourceName} contains stale evidence.`,
    );
  }

  if (
    futureTimestamps.length
  ) {
    warnings.push(
      `${futureTimestamps.length} future-dated timestamp(s) were detected.`,
    );
  }

  const needsReview =
    (
      input.definition
        .required &&
      !present
    ) ||
    fallbackUsed ||
    stale ||
    futureTimestamps.length >
      0 ||
    qualityScore < 50;

  return {
    sourceName:
      input.definition
        .sourceName,

    present,

    required:
      input.definition
        .required,

    qualityScore,

    liveStatus:
      !present
        ? "Missing"
        : fallbackUsed
          ? "Fallback"
          : "Captured",

    freshnessStatus:
      futureTimestamps.length
        ? "Future-dated"
        : stale
          ? "Stale"
          : timestamps.length
            ? "Point-in-time timestamp"
            : "Timestamp unavailable",

    fallbackUsed,

    stale,

    futureTimestampCount:
      futureTimestamps.length,

    asOfAt:
      latestDate(
        timestamps.map(
          (item) =>
            item.observedAt,
        ),
      ),

    warnings:
      Array.from(
        new Set(
          warnings,
        ),
      ).slice(
        0,
        20,
      ),

    status:
      needsReview
        ? "Needs Review"
        : "Validated",
  };
}

export function buildPointInTimeEvidenceReport(
  run: ForecastRunLike,
): PointInTimeEvidenceReport {
  const parsedInput =
    parseJsonRecord(
      run.inputJson,
    );

  const snapshot =
    unwrapSnapshot(
      parsedInput,
    );

  const inputAsOfAt =
    findInputAsOf(
      snapshot,
    );

  const collectedTimestamps = [
    {
      path:
        "$.forecastRun.asOfAt",

      observedAt:
        run.asOfAt,
    },

    ...collectTimestampEvidence(
      snapshot,
    ),
  ];

  if (inputAsOfAt) {
    collectedTimestamps.push({
      path:
        "$.snapshot.asOf",

      observedAt:
        inputAsOfAt,
    });
  }

  const futureEvidence =
    collectedTimestamps.filter(
      (item) =>
        item.observedAt.getTime() >
        run.generatedAt.getTime() +
          FUTURE_TOLERANCE_MS,
    );

  const rootStale =
    Boolean(
      run.staleDataWarning,
    ) ||
    containsBooleanFlag(
      snapshot,
      [
        "stale",
        "staleData",
        "isStale",
      ],
      true,
    );

  const categories =
    SOURCE_DEFINITIONS.map(
      (definition) =>
        categoryReport({
          definition,

          snapshot,

          generatedAt:
            run.generatedAt,

          defaultQuality:
            clamp(
              run.dataQualityScore,
              0,
              100,
            ),

          rootStale,
        }),
    );

  const missingRequiredCategories =
    categories
      .filter(
        (category) =>
          category.required &&
          !category.present,
      )
      .map(
        (category) =>
          category.sourceName,
      );

  const fallbackCategories =
    categories
      .filter(
        (category) =>
          category.fallbackUsed,
      )
      .map(
        (category) =>
          category.sourceName,
      );

  const staleCategories =
    categories
      .filter(
        (category) =>
          category.stale,
      )
      .map(
        (category) =>
          category.sourceName,
      );

  const runAsOfSafe =
    run.asOfAt.getTime() <=
    run.generatedAt.getTime() +
      FUTURE_TOLERANCE_MS;

  const inputAsOfSafe =
    !inputAsOfAt ||
    inputAsOfAt.getTime() <=
      run.generatedAt.getTime() +
        FUTURE_TOLERANCE_MS;

  const pointInTimeSafe =
    runAsOfSafe &&
    inputAsOfSafe &&
    futureEvidence.length ===
      0;

  let integrityScore =
    100;

  integrityScore -=
    missingRequiredCategories.length *
    12;

  integrityScore -=
    fallbackCategories.length *
    6;

  integrityScore -=
    staleCategories.length *
    5;

  integrityScore -=
    futureEvidence.length *
    20;

  if (!runAsOfSafe) {
    integrityScore -= 35;
  }

  if (!inputAsOfSafe) {
    integrityScore -= 35;
  }

  integrityScore =
    round(
      clamp(
        integrityScore,
        0,
        100,
      ),
    );

  const warnings:
    string[] = [];

  if (!runAsOfSafe) {
    warnings.push(
      "The forecast run as-of timestamp occurs after forecast generation.",
    );
  }

  if (!inputAsOfSafe) {
    warnings.push(
      "The input snapshot as-of timestamp occurs after forecast generation.",
    );
  }

  if (
    futureEvidence.length
  ) {
    warnings.push(
      `${futureEvidence.length} evidence timestamp(s) occur after forecast generation.`,
    );
  }

  if (
    missingRequiredCategories.length
  ) {
    warnings.push(
      `Missing required categories: ${missingRequiredCategories.join(", ")}.`,
    );
  }

  if (
    fallbackCategories.length
  ) {
    warnings.push(
      `Fallback evidence detected in: ${fallbackCategories.join(", ")}.`,
    );
  }

  if (
    staleCategories.length
  ) {
    warnings.push(
      `Stale evidence detected in: ${staleCategories.join(", ")}.`,
    );
  }

  if (
    run.staleDataWarning
  ) {
    warnings.push(
      run.staleDataWarning,
    );
  }

  return {
    runId:
      run.id,

    requestId:
      run.requestId,

    symbol:
      run.symbol,

    generatedAt:
      run.generatedAt,

    runAsOfAt:
      run.asOfAt,

    inputAsOfAt,

    earliestEvidenceAt:
      earliestDate(
        collectedTimestamps.map(
          (item) =>
            item.observedAt,
        ),
      ),

    latestEvidenceAt:
      latestDate(
        collectedTimestamps.map(
          (item) =>
            item.observedAt,
        ),
      ),

    timestampCount:
      collectedTimestamps.length,

    futureEvidenceCount:
      futureEvidence.length,

    futureEvidencePaths:
      futureEvidence
        .map(
          (item) =>
            item.path,
        )
        .slice(
          0,
          50,
        ),

    missingRequiredCategories,

    fallbackCategories,

    staleCategories,

    integrityScore,

    pointInTimeSafe,

    warnings:
      Array.from(
        new Set(
          warnings,
        ),
      ),

    categories,
  };
}

async function materializeReport(
  input: {
    run: ForecastRunLike;
    report:
      PointInTimeEvidenceReport;
  },
) {
  const checkedAt =
    new Date();

  await prisma.$transaction(
    async (tx) => {
      for (
        const category of
          input.report
            .categories
      ) {
        await tx.backendDataQualityRecord.upsert(
          {
            where: {
              userId_entityType_entityId_sourceName:
                {
                  userId:
                    input.run.userId,

                  entityType:
                    ENTITY_TYPE,

                  entityId:
                    input.run.id,

                  sourceName:
                    category.sourceName,
                },
            },

            update: {
              liveStatus:
                category.liveStatus,

              freshnessStatus:
                category.freshnessStatus,

              asOfAt:
                category.asOfAt,

              lastCheckedAt:
                checkedAt,

              qualityScore:
                Math.round(
                  category.qualityScore,
                ),

              fallbackUsed:
                category.fallbackUsed,

              warning:
                category
                  .warnings[0] ??
                null,

              warningsJson:
                safeJson(
                  category.warnings,
                  "[]",
                ),

              status:
                category.status,
            },

            create: {
              userId:
                input.run.userId,

              entityType:
                ENTITY_TYPE,

              entityId:
                input.run.id,

              sourceName:
                category.sourceName,

              liveStatus:
                category.liveStatus,

              freshnessStatus:
                category.freshnessStatus,

              asOfAt:
                category.asOfAt,

              lastCheckedAt:
                checkedAt,

              qualityScore:
                Math.round(
                  category.qualityScore,
                ),

              fallbackUsed:
                category.fallbackUsed,

              warning:
                category
                  .warnings[0] ??
                null,

              warningsJson:
                safeJson(
                  category.warnings,
                  "[]",
                ),

              status:
                category.status,
            },
          },
        );
      }

      await tx.backendDataQualityRecord.upsert(
        {
          where: {
            userId_entityType_entityId_sourceName:
              {
                userId:
                  input.run.userId,

                entityType:
                  ENTITY_TYPE,

                entityId:
                  input.run.id,

                sourceName:
                  OVERALL_SOURCE,
              },
          },

          update: {
            liveStatus:
              "Captured",

            freshnessStatus:
              input.report
                .pointInTimeSafe
                ? "Point-in-time safe"
                : "Integrity violation",

            asOfAt:
              input.report
                .inputAsOfAt ??
              input.report
                .runAsOfAt,

            lastCheckedAt:
              checkedAt,

            qualityScore:
              Math.round(
                input.report
                  .integrityScore,
              ),

            fallbackUsed:
              input.report
                .fallbackCategories
                .length > 0,

            warning:
              input.report
                .warnings[0] ??
              null,

            warningsJson:
              safeJson(
                {
                  warnings:
                    input.report
                      .warnings,

                  report: {
                    timestampCount:
                      input.report
                        .timestampCount,

                    futureEvidenceCount:
                      input.report
                        .futureEvidenceCount,

                    futureEvidencePaths:
                      input.report
                        .futureEvidencePaths,

                    missingRequiredCategories:
                      input.report
                        .missingRequiredCategories,

                    fallbackCategories:
                      input.report
                        .fallbackCategories,

                    staleCategories:
                      input.report
                        .staleCategories,

                    earliestEvidenceAt:
                      input.report
                        .earliestEvidenceAt,

                    latestEvidenceAt:
                      input.report
                        .latestEvidenceAt,

                    pointInTimeSafe:
                      input.report
                        .pointInTimeSafe,

                    integrityScore:
                      input.report
                        .integrityScore,
                  },
                },
                "{}",
              ),

            status:
              input.report
                .pointInTimeSafe &&
              input.report
                .integrityScore >=
                70
                ? "Validated"
                : "Needs Review",
          },

          create: {
            userId:
              input.run.userId,

            entityType:
              ENTITY_TYPE,

            entityId:
              input.run.id,

            sourceName:
              OVERALL_SOURCE,

            liveStatus:
              "Captured",

            freshnessStatus:
              input.report
                .pointInTimeSafe
                ? "Point-in-time safe"
                : "Integrity violation",

            asOfAt:
              input.report
                .inputAsOfAt ??
              input.report
                .runAsOfAt,

            lastCheckedAt:
              checkedAt,

            qualityScore:
              Math.round(
                input.report
                  .integrityScore,
              ),

            fallbackUsed:
              input.report
                .fallbackCategories
                .length > 0,

            warning:
              input.report
                .warnings[0] ??
              null,

            warningsJson:
              safeJson(
                {
                  warnings:
                    input.report
                      .warnings,

                  report: {
                    timestampCount:
                      input.report
                        .timestampCount,

                    futureEvidenceCount:
                      input.report
                        .futureEvidenceCount,

                    futureEvidencePaths:
                      input.report
                        .futureEvidencePaths,

                    missingRequiredCategories:
                      input.report
                        .missingRequiredCategories,

                    fallbackCategories:
                      input.report
                        .fallbackCategories,

                    staleCategories:
                      input.report
                        .staleCategories,

                    earliestEvidenceAt:
                      input.report
                        .earliestEvidenceAt,

                    latestEvidenceAt:
                      input.report
                        .latestEvidenceAt,

                    pointInTimeSafe:
                      input.report
                        .pointInTimeSafe,

                    integrityScore:
                      input.report
                        .integrityScore,
                  },
                },
                "{}",
              ),

            status:
              input.report
                .pointInTimeSafe &&
              input.report
                .integrityScore >=
                70
                ? "Validated"
                : "Needs Review",
          },
        },
      );
    },
  );
}

function forecastRunSelect() {
  return {
    id: true,
    userId: true,
    requestId: true,
    symbol: true,
    asOfAt: true,
    generatedAt: true,
    engineVersion: true,
    modelVersion: true,
    calibrationVersion: true,
    marketRegime: true,
    dataQualityScore: true,
    staleDataWarning: true,
    inputJson: true,
    outputJson: true,
    status: true,
  } as const;
}

export async function auditForecastEvidenceRun(
  input: {
    userId: string;
    runId: string;
    request?: Request;
  },
) {
  const run =
    await prisma.intelligenceForecastRun.findFirst(
      {
        where: {
          id:
            input.runId,

          userId:
            input.userId,
        },

        select:
          forecastRunSelect(),
      },
    );

  if (!run) {
    throw new Error(
      "Forecast run was not found.",
    );
  }

  const report =
    buildPointInTimeEvidenceReport(
      run,
    );

  await materializeReport({
    run,
    report,
  });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_EVIDENCE_WAREHOUSE_AUDITED",

    severity:
      report.pointInTimeSafe &&
      report.integrityScore >=
        70
        ? "Info"
        : "Warning",

    area:
      "Market Intelligence",

    title:
      `Audited ${run.symbol} point-in-time evidence`,

    detail:
      `Integrity score ${report.integrityScore}. ` +
      `${
        report.pointInTimeSafe
          ? "No look-ahead timestamp was detected."
          : "Point-in-time review is required."
      }`,

    metadata: {
      forecastRunId:
        run.id,

      requestId:
        run.requestId,

      symbol:
        run.symbol,

      modelVersion:
        run.modelVersion,

      pointInTimeSafe:
        report.pointInTimeSafe,

      integrityScore:
        report.integrityScore,

      futureEvidenceCount:
        report.futureEvidenceCount,

      missingRequiredCategories:
        report.missingRequiredCategories,

      fallbackCategories:
        report.fallbackCategories,

      staleCategories:
        report.staleCategories,

      autonomousTradingEnabled:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    run,
    report,
  };
}

export async function auditForecastWarehouseBatch(
  input: {
    userId: string;
    limit?: number;
    onlyMissing?: boolean;
  },
) {
  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.limit ?? 25,
        ),
      ),
    );

  const candidateRuns =
    await prisma.intelligenceForecastRun.findMany(
      {
        where: {
          userId:
            input.userId,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        take:
          Math.min(
            300,
            limit * 3,
          ),

        select:
          forecastRunSelect(),
      },
    );

  let selectedRuns =
    candidateRuns;

  if (
    input.onlyMissing !==
    false &&
    candidateRuns.length
  ) {
    const existing =
      await prisma.backendDataQualityRecord.findMany(
        {
          where: {
            userId:
              input.userId,

            entityType:
              ENTITY_TYPE,

            sourceName:
              OVERALL_SOURCE,

            entityId: {
              in:
                candidateRuns.map(
                  (run) =>
                    run.id,
                ),
            },
          },

          select: {
            entityId:
              true,
          },
        },
      );

    const existingIds =
      new Set(
        existing.map(
          (record) =>
            record.entityId,
        ),
      );

    selectedRuns =
      candidateRuns.filter(
        (run) =>
          !existingIds.has(
            run.id,
          ),
      );
  }

  selectedRuns =
    selectedRuns.slice(
      0,
      limit,
    );

  const audited: Array<{
    runId: string;
    symbol: string;
    pointInTimeSafe: boolean;
    integrityScore: number;
  }> = [];

  const failed: Array<{
    runId: string;
    symbol: string;
    error: string;
  }> = [];

  for (
    const run of
      selectedRuns
  ) {
    try {
      const report =
        buildPointInTimeEvidenceReport(
          run,
        );

      await materializeReport({
        run,
        report,
      });

      audited.push({
        runId:
          run.id,

        symbol:
          run.symbol,

        pointInTimeSafe:
          report.pointInTimeSafe,

        integrityScore:
          report.integrityScore,
      });
    } catch (error) {
      failed.push({
        runId:
          run.id,

        symbol:
          run.symbol,

        error:
          error instanceof Error
            ? error.message
            : "Unknown warehouse audit error.",
      });
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    candidateCount:
      candidateRuns.length,

    selectedCount:
      selectedRuns.length,

    auditedCount:
      audited.length,

    failedCount:
      failed.length,

    audited,

    failed,
  };
}

function cleanSymbol(
  value:
    | string
    | null
    | undefined,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9.\-:$]/g,
      "",
    )
    .slice(
      0,
      20,
    );
}

function readRecordWarnings(
  value: string,
) {
  try {
    const parsed =
      JSON.parse(
        value,
      ) as unknown;

    if (
      Array.isArray(parsed)
    ) {
      return parsed.filter(
        (
          item,
        ): item is string =>
          typeof item ===
          "string",
      );
    }

    if (
      isRecord(parsed) &&
      Array.isArray(
        parsed.warnings,
      )
    ) {
      return parsed.warnings.filter(
        (
          item,
        ): item is string =>
          typeof item ===
          "string",
      );
    }

    return [];
  } catch {
    return [];
  }
}

export async function getForecastWarehouseOverview(
  input: {
    userId: string;
    symbol?: string | null;
    limit?: number;
  },
) {
  const symbol =
    cleanSymbol(
      input.symbol,
    );

  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.limit ?? 25,
        ),
      ),
    );

  const runWhere = {
    userId:
      input.userId,

    ...(symbol
      ? {
          symbol,
        }
      : {}),
  };

  const [
    totalRuns,
    recentRuns,
    scopeRuns,
  ] =
    await Promise.all([
      prisma.intelligenceForecastRun.count(
        {
          where:
            runWhere,
        },
      ),

      prisma.intelligenceForecastRun.findMany(
        {
          where:
            runWhere,

          orderBy: {
            generatedAt:
              "desc",
          },

          take:
            limit,

          select:
            forecastRunSelect(),
        },
      ),

      prisma.intelligenceForecastRun.findMany(
        {
          where:
            runWhere,

          orderBy: {
            generatedAt:
              "desc",
          },

          take:
            MAX_SCOPE_RUNS,

          select: {
            id: true,
          },
        },
      ),
    ]);

  const scopeIds =
    scopeRuns.map(
      (run) =>
        run.id,
    );

  const recentIds =
    recentRuns.map(
      (run) =>
        run.id,
    );

  const [
    scopeRecords,
    recentRecords,
  ] =
    await Promise.all([
      scopeIds.length
        ? prisma.backendDataQualityRecord.findMany(
            {
              where: {
                userId:
                  input.userId,

                entityType:
                  ENTITY_TYPE,

                sourceName:
                  OVERALL_SOURCE,

                entityId: {
                  in:
                    scopeIds,
                },
              },
            },
          )
        : Promise.resolve(
            [],
          ),

      recentIds.length
        ? prisma.backendDataQualityRecord.findMany(
            {
              where: {
                userId:
                  input.userId,

                entityType:
                  ENTITY_TYPE,

                entityId: {
                  in:
                    recentIds,
                },
              },

              orderBy: {
                sourceName:
                  "asc",
              },
            },
          )
        : Promise.resolve(
            [],
          ),
    ]);

  const recordsByRun =
    new Map<
      string,
      typeof recentRecords
    >();

  for (
    const record of
      recentRecords
  ) {
    const group =
      recordsByRun.get(
        record.entityId,
      ) ?? [];

    group.push(
      record,
    );

    recordsByRun.set(
      record.entityId,
      group,
    );
  }

  const overviewRuns =
    recentRuns.map(
      (run) => {
        const report =
          buildPointInTimeEvidenceReport(
            run,
          );

        const materialized =
          recordsByRun.get(
            run.id,
          ) ?? [];

        const overall =
          materialized.find(
            (record) =>
              record.sourceName ===
              OVERALL_SOURCE,
          );

        const categories =
          report.categories.map(
            (category) => {
              const stored =
                materialized.find(
                  (record) =>
                    record.sourceName ===
                    category.sourceName,
                );

              return {
                ...category,

                materialized:
                  Boolean(
                    stored,
                  ),

                materializedStatus:
                  stored?.status ??
                  null,

                lastCheckedAt:
                  stored
                    ?.lastCheckedAt ??
                  null,
              };
            },
          );

        return {
          id:
            run.id,

          requestId:
            run.requestId,

          symbol:
            run.symbol,

          asOfAt:
            run.asOfAt,

          generatedAt:
            run.generatedAt,

          engineVersion:
            run.engineVersion,

          modelVersion:
            run.modelVersion,

          calibrationVersion:
            run.calibrationVersion,

          marketRegime:
            run.marketRegime,

          forecastStatus:
            run.status,

          warehouseStatus:
            overall
              ? overall.status
              : "Not Audited",

          warehouseCheckedAt:
            overall
              ?.lastCheckedAt ??
            null,

          materializedWarnings:
            overall
              ? readRecordWarnings(
                  overall.warningsJson,
                )
              : [],

          pointInTimeSafe:
            report.pointInTimeSafe,

          integrityScore:
            report.integrityScore,

          timestampCount:
            report.timestampCount,

          futureEvidenceCount:
            report.futureEvidenceCount,

          futureEvidencePaths:
            report.futureEvidencePaths,

          missingRequiredCategories:
            report.missingRequiredCategories,

          fallbackCategories:
            report.fallbackCategories,

          staleCategories:
            report.staleCategories,

          earliestEvidenceAt:
            report.earliestEvidenceAt,

          latestEvidenceAt:
            report.latestEvidenceAt,

          warnings:
            report.warnings,

          categories,
        };
      },
    );

  const auditedRuns =
    scopeRecords.length;

  const validatedRuns =
    scopeRecords.filter(
      (record) =>
        record.status ===
        "Validated",
    ).length;

  const needsReviewRuns =
    scopeRecords.filter(
      (record) =>
        record.status ===
        "Needs Review",
    ).length;

  const recentIntegrityScores =
    overviewRuns.map(
      (run) =>
        run.integrityScore,
    );

  return {
    generatedAt:
      new Date().toISOString(),

    filters: {
      symbol:
        symbol || null,

      limit,
    },

    summary: {
      totalRuns,

      coverageScopeCount:
        scopeIds.length,

      coverageCapped:
        totalRuns >
        scopeIds.length,

      auditedRuns,

      notAuditedRuns:
        Math.max(
          0,
          Math.min(
            totalRuns,
            scopeIds.length,
          ) -
            auditedRuns,
        ),

      validatedRuns,

      needsReviewRuns,

      coveragePercent:
        scopeIds.length
          ? round(
              (
                auditedRuns /
                scopeIds.length
              ) *
                100,
            )
          : 0,

      recentPointInTimeSafe:
        overviewRuns.filter(
          (run) =>
            run.pointInTimeSafe,
        ).length,

      recentNeedsReview:
        overviewRuns.filter(
          (run) =>
            !run.pointInTimeSafe ||
            run.integrityScore <
              70,
        ).length,

      recentAverageIntegrityScore:
        round(
          average(
            recentIntegrityScores,
          ),
        ),
    },

    safeguards: {
      autonomousTradingEnabled:
        false,

      futureDatedEvidenceAccepted:
        false,

      demoEvidencePromotedToTruth:
        false,

      humanReviewRequiredForViolations:
        true,
    },

    runs:
      overviewRuns,
  };
}