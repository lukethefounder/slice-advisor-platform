import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  executeNeo4j,
  getNeo4jConfiguration,
  isNeo4jConfigured,
  recordToNative,
  verifyNeo4jConnectivity,
} from "@/lib/neo4j";

import {
  prisma,
} from "@/lib/prisma";

const QUALITY_ENTITY_TYPE =
  "IntelligenceForecastEvidence";

const KNOWN_EVIDENCE_SOURCES = [
  "Market Price",
  "Technicals",
  "Fundamentals",
  "News",
  "Macro",
  "Positioning",
  "Environment",
  "Supply Chain",
  "CAMEL-AI Analysis",
] as const;

const globalForGraph =
  globalThis as unknown as {
    sliceGraphSchemaPromise?: Promise<void>;
  };

type JsonRecord =
  Record<
    string,
    unknown
  >;

type GraphEvidence = {
  key: string;
  tenantKey: string;
  runKey: string;
  sourceName: string;
  liveStatus: string;
  freshnessStatus: string;
  qualityScore: number;
  fallbackUsed: boolean;
  status: string;
  asOfAt: string;
  warning: string;
};

type GraphHorizon = {
  key: string;
  tenantKey: string;
  runKey: string;
  assetKey: string;
  horizonId: string;
  horizon: string;
  label: string;
  targetAt: string;
  direction: string;
  probability: number;
  expectedReturnPercent: number;
  expectedPrice: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  status: string;
};

type GraphOutcome = {
  key: string;
  tenantKey: string;
  horizonKey: string;
  outcomeId: string;
  observedAt: string;
  observedPrice: number;
  realizedReturnPercent: number;
  positiveOutcome: boolean;
  brierScore: number;
  logLoss: number;
  intervalCovered: boolean;
  directionalCorrect: boolean;
  absoluteReturnError: number;
  provider: string;
};

type GraphClaim = {
  key: string;
  tenantKey: string;
  runKey: string;
  assetKey: string;
  horizonKey: string;
  evidenceKey: string;
  kind: string;
  text: string;
  polarity: string;
  confidence: number;
  sourceName: string;
};

type GraphContradiction = {
  key: string;
  tenantKey: string;
  runKey: string;
  type: string;
  text: string;
  severity: string;
  fromClaimKey: string;
  toClaimKey: string;
};

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

function parseRecord(
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

function parseArray(
  value: string,
) {
  try {
    const parsed =
      JSON.parse(
        value,
      ) as unknown;

    return Array.isArray(
      parsed,
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function cleanText(
  value: unknown,
  maximumLength =
    2_000,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .replace(
          /\s+/g,
          " ",
        )
        .slice(
          0,
          maximumLength,
        )
    : "";
}

function finiteNumber(
  value: unknown,
  fallback = 0,
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

function hash(
  value: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}

function tenantKey(
  userId: string,
) {
  return `tenant:${hash(
    userId,
  ).slice(
    0,
    32,
  )}`;
}

function runKey(
  userId: string,
  runId: string,
) {
  return `${tenantKey(
    userId,
  )}:run:${runId}`;
}

function assetKey(
  userId: string,
  symbol: string,
) {
  return `${tenantKey(
    userId,
  )}:asset:${symbol}`;
}

function modelKey(
  userId: string,
  version: string,
) {
  return `${tenantKey(
    userId,
  )}:model:${hash(
    version,
  ).slice(
    0,
    24,
  )}`;
}

function evidenceKey(
  userId: string,
  runId: string,
  sourceName: string,
) {
  return `${runKey(
    userId,
    runId,
  )}:evidence:${hash(
    sourceName,
  ).slice(
    0,
    16,
  )}`;
}

function horizonKey(
  userId: string,
  horizonId: string,
) {
  return `${tenantKey(
    userId,
  )}:horizon:${horizonId}`;
}

function outcomeKey(
  userId: string,
  outcomeId: string,
) {
  return `${tenantKey(
    userId,
  )}:outcome:${outcomeId}`;
}

function claimKey(
  userId: string,
  runId: string,
  index: number,
) {
  return `${runKey(
    userId,
    runId,
  )}:claim:${index}`;
}

function contradictionKey(
  userId: string,
  runId: string,
  index: number,
) {
  return `${runKey(
    userId,
    runId,
  )}:contradiction:${index}`;
}

function polarityFromDirection(
  value: string,
) {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      "bull",
    ) ||
    normalized.includes(
      "positive",
    ) ||
    normalized.includes(
      "upside",
    )
  ) {
    return "bullish";
  }

  if (
    normalized.includes(
      "bear",
    ) ||
    normalized.includes(
      "negative",
    ) ||
    normalized.includes(
      "downside",
    )
  ) {
    return "bearish";
  }

  if (
    normalized.includes(
      "mixed",
    )
  ) {
    return "mixed";
  }

  return "neutral";
}

function opposite(
  left: string,
  right: string,
) {
  return (
    (
      left ===
        "bullish" &&
      right ===
        "bearish"
    ) ||
    (
      left ===
        "bearish" &&
      right ===
        "bullish"
    )
  );
}

function extractArrayStrings(
  value: unknown,
) {
  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (item) =>
          cleanText(
            item,
          ),
      )
      .filter(
        Boolean,
      );
  }

  const single =
    cleanText(
      value,
    );

  return single
    ? [
        single,
      ]
    : [];
}

function findCamelObject(
  output: JsonRecord,
) {
  const direct =
    output.camel;

  return isRecord(
    direct,
  )
    ? direct
    : {};
}

function findEvidenceRecord(
  records: Array<{
    sourceName: string;
    liveStatus: string;
    freshnessStatus: string;
    qualityScore: number;
    fallbackUsed: boolean;
    status: string;
    asOfAt: Date | null;
    warning: string | null;
  }>,
  sourceName: string,
) {
  return records.find(
    (record) =>
      record.sourceName ===
      sourceName,
  );
}

function buildEvidence(
  input: {
    userId: string;
    runId: string;
    generatedAt: Date;
    dataQualityScore: number;
    camelStatus: string;
    qualityRecords: Array<{
      sourceName: string;
      liveStatus: string;
      freshnessStatus: string;
      qualityScore: number;
      fallbackUsed: boolean;
      status: string;
      asOfAt: Date | null;
      warning: string | null;
    }>;
  },
) {
  const tenant =
    tenantKey(
      input.userId,
    );

  const run =
    runKey(
      input.userId,
      input.runId,
    );

  return KNOWN_EVIDENCE_SOURCES.map(
    (
      sourceName,
    ): GraphEvidence => {
      const stored =
        findEvidenceRecord(
          input.qualityRecords,
          sourceName,
        );

      if (
        sourceName ===
        "CAMEL-AI Analysis"
      ) {
        const completed =
          input.camelStatus ===
          "completed";

        return {
          key:
            evidenceKey(
              input.userId,
              input.runId,
              sourceName,
            ),

          tenantKey:
            tenant,

          runKey:
            run,

          sourceName,

          liveStatus:
            completed
              ? "Completed"
              : "Fallback",

          freshnessStatus:
            "Generated with forecast",

          qualityScore:
            completed
              ? 85
              : 45,

          fallbackUsed:
            !completed,

          status:
            completed
              ? "Validated"
              : "Needs Review",

          asOfAt:
            input.generatedAt.toISOString(),

          warning:
            completed
              ? ""
              : "CAMEL-AI did not complete its full pipeline.",
        };
      }

      return {
        key:
          evidenceKey(
            input.userId,
            input.runId,
            sourceName,
          ),

        tenantKey:
          tenant,

        runKey:
          run,

        sourceName,

        liveStatus:
          stored
            ?.liveStatus ??
          "Not Audited",

        freshnessStatus:
          stored
            ?.freshnessStatus ??
          "Unknown",

        qualityScore:
          stored
            ?.qualityScore ??
          Math.round(
            clamp(
              input.dataQualityScore,
              0,
              100,
            ),
          ),

        fallbackUsed:
          stored
            ?.fallbackUsed ??
          false,

        status:
          stored
            ?.status ??
          "Not Audited",

        asOfAt:
          stored
            ?.asOfAt
            ?.toISOString() ??
          input.generatedAt.toISOString(),

        warning:
          stored
            ?.warning ??
          "",
      };
    },
  );
}

function buildClaims(
  input: {
    userId: string;
    runId: string;
    symbol: string;
    horizons: Array<{
      id: string;
      horizon: string;
      label: string;
      direction: string;
      positiveReturnProbability: number;
      expectedReturnPercent: number;
      expectedPrice: number;
      confidence: number;
      primaryUncertainty: string;
      contributionsJson: string;
    }>;
    output: JsonRecord;
  },
) {
  const claims:
    GraphClaim[] = [];

  const tenant =
    tenantKey(
      input.userId,
    );

  const run =
    runKey(
      input.userId,
      input.runId,
    );

  const asset =
    assetKey(
      input.userId,
      input.symbol,
    );

  function addClaim(
    claim: Omit<
      GraphClaim,
      | "key"
      | "tenantKey"
      | "runKey"
      | "assetKey"
    >,
  ) {
    const text =
      cleanText(
        claim.text,
      );

    if (!text) {
      return;
    }

    claims.push({
      key:
        claimKey(
          input.userId,
          input.runId,
          claims.length,
        ),

      tenantKey:
        tenant,

      runKey:
        run,

      assetKey:
        asset,

      ...claim,

      text,
    });
  }

  for (
    const horizon of
      input.horizons
  ) {
    const polarity =
      polarityFromDirection(
        horizon.direction,
      );

    const confidence =
      clamp(
        horizon.confidence,
        0,
        100,
      );

    addClaim({
      horizonKey:
        horizonKey(
          input.userId,
          horizon.id,
        ),

      evidenceKey:
        "",

      kind:
        "horizon-direction",

      text:
        `${input.symbol} is classified as ${horizon.direction} over ${horizon.label}. ` +
        `Positive-return probability is ${horizon.positiveReturnProbability.toFixed(
          2,
        )}% and expected return is ${horizon.expectedReturnPercent.toFixed(
          2,
        )}%.`,

      polarity,

      confidence,

      sourceName:
        "Forecast Model",
    });

    addClaim({
      horizonKey:
        horizonKey(
          input.userId,
          horizon.id,
        ),

      evidenceKey:
        "",

      kind:
        "expected-price",

      text:
        `${input.symbol} has an expected ${horizon.label} price of ${horizon.expectedPrice.toFixed(
          4,
        )}.`,

      polarity,

      confidence,

      sourceName:
        "Forecast Model",
    });

    const uncertainty =
      cleanText(
        horizon.primaryUncertainty,
      );

    if (uncertainty) {
      addClaim({
        horizonKey:
          horizonKey(
            input.userId,
            horizon.id,
          ),

        evidenceKey:
          "",

        kind:
          "uncertainty",

        text:
          uncertainty,

        polarity:
          "mixed",

        confidence:
          clamp(
            100 -
              horizon.confidence,
            0,
            100,
          ),

        sourceName:
          "Forecast Model",
      });
    }

    const contributions =
      parseArray(
        horizon.contributionsJson,
      );

    for (
      const contribution of
        contributions.slice(
          0,
          12,
        )
    ) {
      if (
        !isRecord(
          contribution,
        )
      ) {
        continue;
      }

      const label =
        cleanText(
          contribution.label ??
            contribution.name ??
            contribution.factor ??
            contribution.source,
          200,
        );

      const value =
        finiteNumber(
          contribution.contribution ??
            contribution.value ??
            contribution.score ??
            contribution.weight,
          0,
        );

      const direction =
        cleanText(
          contribution.direction ??
            contribution.effect ??
            contribution.polarity,
          50,
        );

      if (!label) {
        continue;
      }

      addClaim({
        horizonKey:
          horizonKey(
            input.userId,
            horizon.id,
          ),

        evidenceKey:
          "",

        kind:
          "factor-contribution",

        text:
          `${label} contributed ${value.toFixed(
            4,
          )} to the ${horizon.label} forecast.`,

        polarity:
          polarityFromDirection(
            direction ||
              (
                value > 0
                  ? "bullish"
                  : value < 0
                    ? "bearish"
                    : "neutral"
              ),
          ),

        confidence,

        sourceName:
          label,
      });
    }
  }

  const camel =
    findCamelObject(
      input.output,
    );

  const narrative =
    cleanText(
      camel.dominantNarrative ??
        camel.narrative ??
        camel.summary,
    );

  if (narrative) {
    addClaim({
      horizonKey:
        "",

      evidenceKey:
        evidenceKey(
          input.userId,
          input.runId,
          "CAMEL-AI Analysis",
        ),

      kind:
        "camel-narrative",

      text:
        narrative,

      polarity:
        polarityFromDirection(
          narrative,
        ),

      confidence:
        finiteNumber(
          camel.confidence,
          60,
        ),

      sourceName:
        "CAMEL-AI",
    });
  }

  const buyers =
    extractArrayStrings(
      camel.dominantBuyers ??
        camel.buyers,
    );

  for (
    const buyer of
      buyers.slice(
        0,
        10,
      )
  ) {
    addClaim({
      horizonKey:
        "",

      evidenceKey:
        evidenceKey(
          input.userId,
          input.runId,
          "CAMEL-AI Analysis",
        ),

      kind:
        "participant-buyer",

      text:
        `Potential buying participant: ${buyer}.`,

      polarity:
        "bullish",

      confidence:
        60,

      sourceName:
        "CAMEL-AI",
    });
  }

  const sellers =
    extractArrayStrings(
      camel.dominantSellers ??
        camel.sellers,
    );

  for (
    const seller of
      sellers.slice(
        0,
        10,
      )
  ) {
    addClaim({
      horizonKey:
        "",

      evidenceKey:
        evidenceKey(
          input.userId,
          input.runId,
          "CAMEL-AI Analysis",
        ),

      kind:
        "participant-seller",

      text:
        `Potential selling participant: ${seller}.`,

      polarity:
        "bearish",

      confidence:
        60,

      sourceName:
        "CAMEL-AI",
    });
  }

  return claims;
}

function buildContradictions(
  input: {
    userId: string;
    runId: string;
    claims: GraphClaim[];
    output: JsonRecord;
  },
) {
  const contradictions:
    GraphContradiction[] = [];

  const tenant =
    tenantKey(
      input.userId,
    );

  const run =
    runKey(
      input.userId,
      input.runId,
    );

  const directionClaims =
    input.claims.filter(
      (claim) =>
        claim.kind ===
        "horizon-direction",
    );

  for (
    let leftIndex = 0;
    leftIndex <
    directionClaims.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex =
        leftIndex + 1;
      rightIndex <
      directionClaims.length;
      rightIndex += 1
    ) {
      const left =
        directionClaims[
          leftIndex
        ];

      const right =
        directionClaims[
          rightIndex
        ];

      if (
        !opposite(
          left.polarity,
          right.polarity,
        )
      ) {
        continue;
      }

      contradictions.push({
        key:
          contradictionKey(
            input.userId,
            input.runId,
            contradictions.length,
          ),

        tenantKey:
          tenant,

        runKey:
          run,

        type:
          "cross-horizon-direction",

        text:
          `Opposing directional conclusions exist across forecast horizons: ` +
          `${left.text} ${right.text}`,

        severity:
          "Informational",

        fromClaimKey:
          left.key,

        toClaimKey:
          right.key,
      });
    }
  }

  const camel =
    findCamelObject(
      input.output,
    );

  const explicit =
    extractArrayStrings(
      camel.contradictions ??
        camel.disagreements ??
        camel.conflictingSignals,
    );

  for (
    const statement of
      explicit.slice(
        0,
        20,
      )
  ) {
    contradictions.push({
      key:
        contradictionKey(
          input.userId,
          input.runId,
          contradictions.length,
        ),

      tenantKey:
        tenant,

      runKey:
        run,

      type:
        "explicit-model-contradiction",

      text:
        statement,

      severity:
        "Review",

      fromClaimKey:
        "",

      toClaimKey:
        "",
    });
  }

  return contradictions;
}

export async function ensureProvenanceGraphSchema() {
  if (
    globalForGraph
      .sliceGraphSchemaPromise
  ) {
    return globalForGraph
      .sliceGraphSchemaPromise;
  }

  globalForGraph
    .sliceGraphSchemaPromise =
    (async () => {
      const statements = [
        `
          CREATE CONSTRAINT slice_tenant_key IF NOT EXISTS
          FOR (node:SliceTenant)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_asset_key IF NOT EXISTS
          FOR (node:SliceAsset)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_forecast_run_key IF NOT EXISTS
          FOR (node:SliceForecastRun)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_model_version_key IF NOT EXISTS
          FOR (node:SliceModelVersion)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_evidence_key IF NOT EXISTS
          FOR (node:SliceEvidence)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_horizon_key IF NOT EXISTS
          FOR (node:SliceForecastHorizon)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_outcome_key IF NOT EXISTS
          FOR (node:SliceForecastOutcome)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_claim_key IF NOT EXISTS
          FOR (node:SliceClaim)
          REQUIRE node.key IS UNIQUE
        `,
        `
          CREATE CONSTRAINT slice_contradiction_key IF NOT EXISTS
          FOR (node:SliceContradiction)
          REQUIRE node.key IS UNIQUE
        `,
      ];

      for (
        const statement of
          statements
      ) {
        await executeNeo4j(
          statement,
        );
      }
    })();

  try {
    await globalForGraph
      .sliceGraphSchemaPromise;
  } catch (error) {
    globalForGraph
      .sliceGraphSchemaPromise =
      undefined;

    throw error;
  }
}

export async function syncForecastRunToGraph(
  input: {
    userId: string;
    runId: string;
  },
) {
  if (
    !isNeo4jConfigured()
  ) {
    throw new Error(
      "Neo4j is not configured.",
    );
  }

  await ensureProvenanceGraphSchema();

  const run =
    await prisma.intelligenceForecastRun.findFirst(
      {
        where: {
          id:
            input.runId,

          userId:
            input.userId,
        },

        include: {
          horizons: {
            orderBy: {
              targetAt:
                "asc",
            },

            include: {
              outcome:
                true,
            },
          },
        },
      },
    );

  if (!run) {
    throw new Error(
      "Forecast run was not found.",
    );
  }

  const qualityRecords =
    await prisma.backendDataQualityRecord.findMany(
      {
        where: {
          userId:
            input.userId,

          entityType:
            QUALITY_ENTITY_TYPE,

          entityId:
            run.id,
        },
      },
    );

  const output =
    parseRecord(
      run.outputJson,
    );

  const tenant =
    tenantKey(
      input.userId,
    );

  const graphRunKey =
    runKey(
      input.userId,
      run.id,
    );

  const graphAssetKey =
    assetKey(
      input.userId,
      run.symbol,
    );

  const graphModelKey =
    modelKey(
      input.userId,
      run.modelVersion,
    );

  const evidence =
    buildEvidence({
      userId:
        input.userId,

      runId:
        run.id,

      generatedAt:
        run.generatedAt,

      dataQualityScore:
        run.dataQualityScore,

      camelStatus:
        run.camelStatus,

      qualityRecords,
    });

  const horizons:
    GraphHorizon[] =
    run.horizons.map(
      (horizon) => ({
        key:
          horizonKey(
            input.userId,
            horizon.id,
          ),

        tenantKey:
          tenant,

        runKey:
          graphRunKey,

        assetKey:
          graphAssetKey,

        horizonId:
          horizon.id,

        horizon:
          horizon.horizon,

        label:
          horizon.label,

        targetAt:
          horizon.targetAt.toISOString(),

        direction:
          horizon.direction,

        probability:
          horizon.positiveReturnProbability,

        expectedReturnPercent:
          horizon.expectedReturnPercent,

        expectedPrice:
          horizon.expectedPrice,

        rangeLow:
          horizon.priceRangeLow,

        rangeHigh:
          horizon.priceRangeHigh,

        confidence:
          horizon.confidence,

        status:
          horizon.status,
      }),
    );

  const outcomes:
    GraphOutcome[] =
    run.horizons
      .filter(
        (
          horizon,
        ): horizon is typeof horizon & {
          outcome:
            NonNullable<
              typeof horizon.outcome
            >;
        } =>
          Boolean(
            horizon.outcome,
          ),
      )
      .map(
        (horizon) => ({
          key:
            outcomeKey(
              input.userId,
              horizon.outcome.id,
            ),

          tenantKey:
            tenant,

          horizonKey:
            horizonKey(
              input.userId,
              horizon.id,
            ),

          outcomeId:
            horizon.outcome.id,

          observedAt:
            horizon.outcome.observedAt.toISOString(),

          observedPrice:
            horizon.outcome.observedPrice,

          realizedReturnPercent:
            horizon.outcome.realizedReturnPercent,

          positiveOutcome:
            horizon.outcome.positiveOutcome,

          brierScore:
            horizon.outcome.brierScore,

          logLoss:
            horizon.outcome.logLoss,

          intervalCovered:
            horizon.outcome.intervalCovered,

          directionalCorrect:
            horizon.outcome.directionalCorrect,

          absoluteReturnError:
            horizon.outcome.absoluteReturnError,

          provider:
            horizon.outcome.priceProvider,
        }),
      );

  const claims =
    buildClaims({
      userId:
        input.userId,

      runId:
        run.id,

      symbol:
        run.symbol,

      horizons:
        run.horizons,

      output,
    });

  const contradictions =
    buildContradictions({
      userId:
        input.userId,

      runId:
        run.id,

      claims,

      output,
    });

  await executeNeo4j(
    `
      MERGE (tenant:SliceTenant {
        key: $tenantKey
      })
      SET
        tenant.updatedAt = $syncedAt

      MERGE (asset:SliceAsset {
        key: $assetKey
      })
      SET
        asset.tenantKey = $tenantKey,
        asset.symbol = $symbol,
        asset.updatedAt = $syncedAt

      MERGE (run:SliceForecastRun {
        key: $runKey
      })
      SET
        run.tenantKey = $tenantKey,
        run.runId = $runId,
        run.requestId = $requestId,
        run.symbol = $symbol,
        run.asOfAt = $asOfAt,
        run.generatedAt = $generatedAt,
        run.engineVersion = $engineVersion,
        run.modelVersion = $modelVersion,
        run.calibrationVersion = $calibrationVersion,
        run.marketRegime = $marketRegime,
        run.sliceSentimentScore = $sliceSentimentScore,
        run.dataQualityScore = $dataQualityScore,
        run.simulationPaths = $simulationPaths,
        run.camelStatus = $camelStatus,
        run.camelWorkforceMode = $camelWorkforceMode,
        run.status = $status,
        run.inputHash = $inputHash,
        run.outputHash = $outputHash,
        run.updatedAt = $syncedAt

      MERGE (model:SliceModelVersion {
        key: $modelKey
      })
      SET
        model.tenantKey = $tenantKey,
        model.modelVersion = $modelVersion,
        model.engineVersion = $engineVersion,
        model.calibrationVersion = $calibrationVersion,
        model.updatedAt = $syncedAt

      MERGE (tenant)-[:OWNS_ASSET]->(asset)
      MERGE (tenant)-[:OWNS_FORECAST]->(run)
      MERGE (tenant)-[:USES_MODEL]->(model)
      MERGE (run)-[:FORECASTS]->(asset)
      MERGE (run)-[:USED_MODEL]->(model)
    `,
    {
      tenantKey:
        tenant,

      assetKey:
        graphAssetKey,

      runKey:
        graphRunKey,

      modelKey:
        graphModelKey,

      runId:
        run.id,

      requestId:
        run.requestId,

      symbol:
        run.symbol,

      asOfAt:
        run.asOfAt.toISOString(),

      generatedAt:
        run.generatedAt.toISOString(),

      engineVersion:
        run.engineVersion,

      modelVersion:
        run.modelVersion,

      calibrationVersion:
        run.calibrationVersion,

      marketRegime:
        run.marketRegime,

      sliceSentimentScore:
        run.sliceSentimentScore,

      dataQualityScore:
        run.dataQualityScore,

      simulationPaths:
        run.simulationPaths,

      camelStatus:
        run.camelStatus,

      camelWorkforceMode:
        run.camelWorkforceMode,

      status:
        run.status,

      inputHash:
        hash(
          run.inputJson,
        ),

      outputHash:
        hash(
          run.outputJson,
        ),

      syncedAt:
        new Date().toISOString(),
    },
  );

  await executeNeo4j(
    `
      MATCH (run:SliceForecastRun {
        key: $runKey
      })

      OPTIONAL MATCH (run)-[:USED_EVIDENCE]->(old:SliceEvidence)
      WHERE NOT old.key IN $keys
      DETACH DELETE old

      WITH run
      UNWIND $items AS item

      MERGE (evidence:SliceEvidence {
        key: item.key
      })
      SET
        evidence.tenantKey = item.tenantKey,
        evidence.runKey = item.runKey,
        evidence.sourceName = item.sourceName,
        evidence.liveStatus = item.liveStatus,
        evidence.freshnessStatus = item.freshnessStatus,
        evidence.qualityScore = item.qualityScore,
        evidence.fallbackUsed = item.fallbackUsed,
        evidence.status = item.status,
        evidence.asOfAt = item.asOfAt,
        evidence.warning = item.warning

      MERGE (run)-[:USED_EVIDENCE]->(evidence)
    `,
    {
      runKey:
        graphRunKey,

      keys:
        evidence.map(
          (item) =>
            item.key,
        ),

      items:
        evidence,
    },
  );

  await executeNeo4j(
    `
      MATCH (run:SliceForecastRun {
        key: $runKey
      })

      MATCH (asset:SliceAsset {
        key: $assetKey
      })

      UNWIND $items AS item

      MERGE (horizon:SliceForecastHorizon {
        key: item.key
      })
      SET
        horizon.tenantKey = item.tenantKey,
        horizon.runKey = item.runKey,
        horizon.assetKey = item.assetKey,
        horizon.horizonId = item.horizonId,
        horizon.horizon = item.horizon,
        horizon.label = item.label,
        horizon.targetAt = item.targetAt,
        horizon.direction = item.direction,
        horizon.probability = item.probability,
        horizon.expectedReturnPercent = item.expectedReturnPercent,
        horizon.expectedPrice = item.expectedPrice,
        horizon.rangeLow = item.rangeLow,
        horizon.rangeHigh = item.rangeHigh,
        horizon.confidence = item.confidence,
        horizon.status = item.status

      MERGE (run)-[:HAS_HORIZON]->(horizon)
      MERGE (horizon)-[:FOR_ASSET]->(asset)
    `,
    {
      runKey:
        graphRunKey,

      assetKey:
        graphAssetKey,

      items:
        horizons,
    },
  );

  if (
    outcomes.length
  ) {
    await executeNeo4j(
      `
        UNWIND $items AS item

        MATCH (horizon:SliceForecastHorizon {
          key: item.horizonKey
        })

        MERGE (outcome:SliceForecastOutcome {
          key: item.key
        })
        SET
          outcome.tenantKey = item.tenantKey,
          outcome.outcomeId = item.outcomeId,
          outcome.observedAt = item.observedAt,
          outcome.observedPrice = item.observedPrice,
          outcome.realizedReturnPercent = item.realizedReturnPercent,
          outcome.positiveOutcome = item.positiveOutcome,
          outcome.brierScore = item.brierScore,
          outcome.logLoss = item.logLoss,
          outcome.intervalCovered = item.intervalCovered,
          outcome.directionalCorrect = item.directionalCorrect,
          outcome.absoluteReturnError = item.absoluteReturnError,
          outcome.provider = item.provider

        MERGE (horizon)-[:SETTLED_BY]->(outcome)
      `,
      {
        items:
          outcomes,
      },
    );
  }

  await executeNeo4j(
    `
      MATCH (run:SliceForecastRun {
        key: $runKey
      })

      OPTIONAL MATCH (run)-[:ASSERTS]->(old:SliceClaim)
      WHERE NOT old.key IN $keys
      DETACH DELETE old

      WITH run
      MATCH (asset:SliceAsset {
        key: $assetKey
      })

      UNWIND $items AS item

      MERGE (claim:SliceClaim {
        key: item.key
      })
      SET
        claim.tenantKey = item.tenantKey,
        claim.runKey = item.runKey,
        claim.kind = item.kind,
        claim.text = item.text,
        claim.polarity = item.polarity,
        claim.confidence = item.confidence,
        claim.sourceName = item.sourceName

      MERGE (run)-[:ASSERTS]->(claim)
      MERGE (claim)-[:ABOUT]->(asset)

      WITH claim, item

      OPTIONAL MATCH (horizon:SliceForecastHorizon {
        key: item.horizonKey
      })

      FOREACH (
        ignored IN
        CASE
          WHEN horizon IS NULL
          THEN []
          ELSE [1]
        END |
        MERGE (claim)-[:TARGETS_HORIZON]->(horizon)
      )

      WITH claim, item

      OPTIONAL MATCH (evidence:SliceEvidence {
        key: item.evidenceKey
      })

      FOREACH (
        ignored IN
        CASE
          WHEN evidence IS NULL
          THEN []
          ELSE [1]
        END |
        MERGE (claim)-[:DERIVED_FROM]->(evidence)
      )
    `,
    {
      runKey:
        graphRunKey,

      assetKey:
        graphAssetKey,

      keys:
        claims.map(
          (item) =>
            item.key,
        ),

      items:
        claims,
    },
  );

  await executeNeo4j(
    `
      MATCH (run:SliceForecastRun {
        key: $runKey
      })

      OPTIONAL MATCH (run)-[:HAS_CONTRADICTION]->(old:SliceContradiction)
      WHERE NOT old.key IN $keys
      DETACH DELETE old

      WITH run
      UNWIND $items AS item

      MERGE (contradiction:SliceContradiction {
        key: item.key
      })
      SET
        contradiction.tenantKey = item.tenantKey,
        contradiction.runKey = item.runKey,
        contradiction.type = item.type,
        contradiction.text = item.text,
        contradiction.severity = item.severity

      MERGE (run)-[:HAS_CONTRADICTION]->(contradiction)

      WITH contradiction, item

      OPTIONAL MATCH (leftClaim:SliceClaim {
        key: item.fromClaimKey
      })

      FOREACH (
        ignored IN
        CASE
          WHEN leftClaim IS NULL
          THEN []
          ELSE [1]
        END |
        MERGE (contradiction)-[:INVOLVES]->(leftClaim)
      )

      WITH contradiction, item

      OPTIONAL MATCH (rightClaim:SliceClaim {
        key: item.toClaimKey
      })

      FOREACH (
        ignored IN
        CASE
          WHEN rightClaim IS NULL
          THEN []
          ELSE [1]
        END |
        MERGE (contradiction)-[:INVOLVES]->(rightClaim)
      )
    `,
    {
      runKey:
        graphRunKey,

      keys:
        contradictions.map(
          (item) =>
            item.key,
        ),

      items:
        contradictions,
    },
  );

  return {
    runId:
      run.id,

    symbol:
      run.symbol,

    nodes: {
      evidence:
        evidence.length,

      horizons:
        horizons.length,

      outcomes:
        outcomes.length,

      claims:
        claims.length,

      contradictions:
        contradictions.length,
    },

    syncedAt:
      new Date().toISOString(),

    safeguards: {
      autonomousTradingEnabled:
        false,

      rawCredentialsStored:
        false,

      rawInputStoredInGraph:
        false,

      rawOutputStoredInGraph:
        false,

      tenantIdentifierHashed:
        true,
    },
  };
}

export async function syncForecastGraphBatch(
  input: {
    userId: string;
    limit?: number;
  },
) {
  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.limit ??
            25,
        ),
      ),
    );

  const runs =
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
          limit,

        select: {
          id:
            true,

          symbol:
            true,
        },
      },
    );

  const synced: Array<{
    runId: string;
    symbol: string;
  }> = [];

  const failed: Array<{
    runId: string;
    symbol: string;
    error: string;
  }> = [];

  for (
    const run of
      runs
  ) {
    try {
      await syncForecastRunToGraph({
        userId:
          input.userId,

        runId:
          run.id,
      });

      synced.push({
        runId:
          run.id,

        symbol:
          run.symbol,
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
            : "Unknown graph synchronization error.",
      });
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    selectedCount:
      runs.length,

    syncedCount:
      synced.length,

    failedCount:
      failed.length,

    synced,

    failed,
  };
}

async function countNodes(
  label: string,
  tenant: string,
) {
  const allowed =
    new Set([
      "SliceAsset",
      "SliceForecastRun",
      "SliceModelVersion",
      "SliceEvidence",
      "SliceForecastHorizon",
      "SliceForecastOutcome",
      "SliceClaim",
      "SliceContradiction",
    ]);

  if (
    !allowed.has(
      label,
    )
  ) {
    throw new Error(
      "Unsupported graph label.",
    );
  }

  const result =
    await executeNeo4j(
      `
        MATCH (node:${label} {
          tenantKey: $tenantKey
        })
        RETURN count(node) AS count
      `,
      {
        tenantKey:
          tenant,
      },
    );

  return Number(
    recordToNative(
      result.records[0],
    ).count ??
      0,
  );
}

export async function getProvenanceGraphOverview(
  input: {
    userId: string;
    runId?: string | null;
    symbol?: string | null;
    limit?: number;
  },
) {
  const configuration =
    getNeo4jConfiguration();

  const connectivity =
    await verifyNeo4jConnectivity();

  if (
    !configuration.configured ||
    !connectivity.ok
  ) {
    return {
      configured:
        configuration.configured,

      connectivity,

      counts: {
        assets:
          0,
        runs:
          0,
        models:
          0,
        evidence:
          0,
        horizons:
          0,
        outcomes:
          0,
        claims:
          0,
        contradictions:
          0,
      },

      recentRuns:
        [],

      selectedRun:
        null,

      provenancePaths:
        [],
    };
  }

  await ensureProvenanceGraphSchema();

  const tenant =
    tenantKey(
      input.userId,
    );

  const symbol =
    cleanText(
      input.symbol,
      20,
    )
      .toUpperCase()
      .replace(
        /[^A-Z0-9.\-:$]/g,
        "",
      );

  const limit =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          input.limit ??
            25,
        ),
      ),
    );

  const counts = {
    assets:
      await countNodes(
        "SliceAsset",
        tenant,
      ),

    runs:
      await countNodes(
        "SliceForecastRun",
        tenant,
      ),

    models:
      await countNodes(
        "SliceModelVersion",
        tenant,
      ),

    evidence:
      await countNodes(
        "SliceEvidence",
        tenant,
      ),

    horizons:
      await countNodes(
        "SliceForecastHorizon",
        tenant,
      ),

    outcomes:
      await countNodes(
        "SliceForecastOutcome",
        tenant,
      ),

    claims:
      await countNodes(
        "SliceClaim",
        tenant,
      ),

    contradictions:
      await countNodes(
        "SliceContradiction",
        tenant,
      ),
  };

  const recentResult =
    await executeNeo4j(
      `
        MATCH (run:SliceForecastRun {
          tenantKey: $tenantKey
        })-[:FORECASTS]->(asset:SliceAsset)

        WHERE
          $symbol = "" OR
          asset.symbol = $symbol

        OPTIONAL MATCH (run)-[:ASSERTS]->(claim:SliceClaim)
        OPTIONAL MATCH (run)-[:HAS_CONTRADICTION]->(contradiction:SliceContradiction)
        OPTIONAL MATCH (run)-[:HAS_HORIZON]->(horizon:SliceForecastHorizon)
        OPTIONAL MATCH (horizon)-[:SETTLED_BY]->(outcome:SliceForecastOutcome)

        RETURN
          run.runId AS runId,
          run.requestId AS requestId,
          run.symbol AS symbol,
          run.generatedAt AS generatedAt,
          run.modelVersion AS modelVersion,
          run.marketRegime AS marketRegime,
          run.camelStatus AS camelStatus,
          run.status AS status,
          count(DISTINCT claim) AS claimCount,
          count(DISTINCT contradiction) AS contradictionCount,
          count(DISTINCT horizon) AS horizonCount,
          count(DISTINCT outcome) AS outcomeCount

        ORDER BY run.generatedAt DESC
        LIMIT $limit
      `,
      {
        tenantKey:
          tenant,

        symbol,

        limit,
      },
    );

  const recentRuns =
    recentResult.records.map(
      recordToNative,
    );

  const requestedRunKey =
    input.runId
      ? runKey(
          input.userId,
          input.runId,
        )
      : "";

  const selectedResult =
    await executeNeo4j(
      `
        MATCH (run:SliceForecastRun {
          tenantKey: $tenantKey
        })-[:FORECASTS]->(asset:SliceAsset)

        WHERE
          (
            $runKey = "" OR
            run.key = $runKey
          )
          AND
          (
            $symbol = "" OR
            asset.symbol = $symbol
          )

        RETURN
          properties(run) AS run,
          properties(asset) AS asset

        ORDER BY run.generatedAt DESC
        LIMIT 1
      `,
      {
        tenantKey:
          tenant,

        runKey:
          requestedRunKey,

        symbol,
      },
    );

  if (
    !selectedResult
      .records.length
  ) {
    return {
      configured:
        true,

      connectivity,

      counts,

      recentRuns,

      selectedRun:
        null,

      provenancePaths:
        [],
    };
  }

  const selectedNative =
    recordToNative(
      selectedResult
        .records[0],
    );

  const selectedRun =
    selectedNative.run as
      | Record<
          string,
          unknown
        >
      | undefined;

  const selectedAsset =
    selectedNative.asset as
      | Record<
          string,
          unknown
        >
      | undefined;

  const selectedKey =
    cleanText(
      selectedRun?.key,
      500,
    );

  const detailResult =
    await executeNeo4j(
      `
        MATCH (run:SliceForecastRun {
          key: $runKey
        })

        OPTIONAL MATCH (run)-[:USED_MODEL]->(model:SliceModelVersion)
        OPTIONAL MATCH (run)-[:USED_EVIDENCE]->(evidence:SliceEvidence)
        OPTIONAL MATCH (run)-[:HAS_HORIZON]->(horizon:SliceForecastHorizon)
        OPTIONAL MATCH (horizon)-[:SETTLED_BY]->(outcome:SliceForecastOutcome)
        OPTIONAL MATCH (run)-[:ASSERTS]->(claim:SliceClaim)
        OPTIONAL MATCH (run)-[:HAS_CONTRADICTION]->(contradiction:SliceContradiction)

        RETURN
          collect(DISTINCT properties(model)) AS models,
          collect(DISTINCT properties(evidence)) AS evidence,
          collect(DISTINCT properties(horizon)) AS horizons,
          collect(DISTINCT properties(outcome)) AS outcomes,
          collect(DISTINCT properties(claim)) AS claims,
          collect(DISTINCT properties(contradiction)) AS contradictions
      `,
      {
        runKey:
          selectedKey,
      },
    );

  const detail =
    detailResult.records.length
      ? recordToNative(
          detailResult
            .records[0],
        )
      : {};

  const contradictionResult =
    await executeNeo4j(
      `
        MATCH (run:SliceForecastRun {
          key: $runKey
        })-[:HAS_CONTRADICTION]->(contradiction:SliceContradiction)

        OPTIONAL MATCH (contradiction)-[:INVOLVES]->(claim:SliceClaim)

        RETURN
          contradiction.key AS key,
          contradiction.type AS type,
          contradiction.text AS text,
          contradiction.severity AS severity,
          collect(
            DISTINCT properties(claim)
          ) AS involvedClaims

        ORDER BY contradiction.key
      `,
      {
        runKey:
          selectedKey,
      },
    );

  const contradictions =
    contradictionResult.records.map(
      recordToNative,
    );

  const evidenceItems =
    Array.isArray(
      detail.evidence,
    )
      ? detail.evidence
      : [];

  const horizonItems =
    Array.isArray(
      detail.horizons,
    )
      ? detail.horizons
      : [];

  const outcomeItems =
    Array.isArray(
      detail.outcomes,
    )
      ? detail.outcomes
      : [];

  const claimItems =
    Array.isArray(
      detail.claims,
    )
      ? detail.claims
      : [];

  const provenancePaths: Array<{
    type: string;
    path: string[];
    status: string;
  }> = [];

  for (
    const evidenceItem of
      evidenceItems
  ) {
    if (
      !isRecord(
        evidenceItem,
      )
    ) {
      continue;
    }

    provenancePaths.push({
      type:
        "evidence-to-forecast",

      path: [
        cleanText(
          evidenceItem.sourceName,
        ) ||
          "Evidence",

        cleanText(
          selectedRun?.requestId,
        ) ||
          "Forecast Run",

        cleanText(
          selectedAsset?.symbol,
        ) ||
          "Asset",
      ],

      status:
        cleanText(
          evidenceItem.status,
        ) ||
        "Unknown",
    });
  }

  for (
    const horizonItem of
      horizonItems
  ) {
    if (
      !isRecord(
        horizonItem,
      )
    ) {
      continue;
    }

    const matchingOutcome =
      outcomeItems.find(
        (outcomeItem) =>
          isRecord(
            outcomeItem,
          ) &&
          cleanText(
            outcomeItem.key,
          ).includes(
            cleanText(
              horizonItem.horizonId,
            ),
          ),
      );

    provenancePaths.push({
      type:
        "forecast-to-outcome",

      path: [
        cleanText(
          selectedRun?.requestId,
        ) ||
          "Forecast Run",

        cleanText(
          horizonItem.label,
        ) ||
          "Horizon",

        isRecord(
          matchingOutcome,
        )
          ? `Observed ${cleanText(
              matchingOutcome.observedPrice,
            )}`
          : "Pending Outcome",
      ],

      status:
        isRecord(
          matchingOutcome,
        )
          ? "Settled"
          : cleanText(
              horizonItem.status,
            ) ||
            "Pending",
    });
  }

  for (
    const claimItem of
      claimItems.slice(
        0,
        100,
      )
  ) {
    if (
      !isRecord(
        claimItem,
      )
    ) {
      continue;
    }

    provenancePaths.push({
      type:
        "claim-path",

      path: [
        cleanText(
          selectedRun?.requestId,
        ) ||
          "Forecast Run",

        cleanText(
          claimItem.kind,
        ) ||
          "Claim",

        cleanText(
          claimItem.text,
          300,
        ),
      ],

      status:
        cleanText(
          claimItem.polarity,
        ) ||
        "neutral",
    });
  }

  return {
    configured:
      true,

    connectivity,

    counts,

    recentRuns,

    selectedRun: {
      run:
        selectedRun ??
        {},

      asset:
        selectedAsset ??
        {},

      models:
        detail.models ??
        [],

      evidence:
        evidenceItems,

      horizons:
        horizonItems,

      outcomes:
        outcomeItems,

      claims:
        claimItems,

      contradictions,
    },

    provenancePaths:
      provenancePaths.slice(
        0,
        300,
      ),
  };
}