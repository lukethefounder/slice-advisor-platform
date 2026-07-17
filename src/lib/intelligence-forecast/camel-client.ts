import {
  createDisabledCamelFeatures,
} from "@/lib/intelligence-forecast/engine";

import type {
  CamelBehavioralFeatures,
  MarketSnapshot,
} from "@/lib/intelligence-forecast/types";

const CAMEL_OUTPUT_SCHEMA =
  "slice-camel-output-1.0.0" as const;

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.max(
    min,
    Math.min(
      max,
      Number.isFinite(value)
        ? value
        : min,
    ),
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
  fallback = "",
) {
  return typeof value === "string"
    ? value.trim().slice(0, 2_000)
    : fallback;
}

function readStringArray(
  value: unknown,
  maxItems = 10,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map((item) =>
      item.trim().slice(0, 500),
    )
    .filter(Boolean)
    .slice(0, maxItems);
}

function readScore(
  value: unknown,
  fallback = 50,
) {
  const numeric = Number(value);

  return clamp(
    Number.isFinite(numeric)
      ? numeric
      : fallback,
    0,
    100,
  );
}

function readDirectional(
  value: unknown,
) {
  const numeric = Number(value);

  return clamp(
    Number.isFinite(numeric)
      ? numeric
      : 0,
    -1,
    1,
  );
}

function validateServiceUrl(
  raw: string,
) {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "CAMEL_AI_SERVICE_URL is not a valid URL.",
    );
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "CAMEL_AI_SERVICE_URL must use HTTPS in production.",
    );
  }

  if (
    !["http:", "https:"].includes(
      url.protocol,
    )
  ) {
    throw new Error(
      "CAMEL_AI_SERVICE_URL must use HTTP or HTTPS.",
    );
  }

  return url;
}

function normalizeCamelResponse(
  value: unknown,
): CamelBehavioralFeatures {
  if (!isRecord(value)) {
    throw new Error(
      "CAMEL-AI returned a non-object payload.",
    );
  }

  const audit = isRecord(value.audit)
    ? value.audit
    : {};

  const status =
    value.status === "completed"
      ? "completed"
      : "degraded";

  return {
    schemaVersion:
      CAMEL_OUTPUT_SCHEMA,

    status,

    generatedAt: readString(
      value.generatedAt,
      new Date().toISOString(),
    ),

    modelVersion: readString(
      value.modelVersion,
      "unknown",
    ),

    confidence: readScore(
      value.confidence,
      40,
    ),

    directionalPressure:
      readDirectional(
        value.directionalPressure,
      ),

    agentDisagreement: readScore(
      value.agentDisagreement,
      60,
    ),

    narrativeConcentration:
      readScore(
        value.narrativeConcentration,
        50,
      ),

    reversalRisk: readScore(
      value.reversalRisk,
      50,
    ),

    contagionRisk: readScore(
      value.contagionRisk,
      50,
    ),

    liquidityStress: readScore(
      value.liquidityStress,
      50,
    ),

    institutionalRepricingDelay:
      readScore(
        value.institutionalRepricingDelay,
        50,
      ),

    shortCoveringPotential:
      readScore(
        value.shortCoveringPotential,
        0,
      ),

    dominantNarrative: readString(
      value.dominantNarrative,
      "CAMEL-AI did not identify a dominant narrative.",
    ),

    dominantBuyers: readStringArray(
      value.dominantBuyers,
      5,
    ),

    dominantSellers: readStringArray(
      value.dominantSellers,
      5,
    ),

    positiveDrivers: readStringArray(
      value.positiveDrivers,
      8,
    ),

    negativeDrivers: readStringArray(
      value.negativeDrivers,
      8,
    ),

    contradictions: readStringArray(
      value.contradictions,
      8,
    ),

    limitations: readStringArray(
      value.limitations,
      12,
    ),

    audit: {
      workforceMode:
        audit.workforceMode ===
        "PIPELINE"
          ? "PIPELINE"
          : "FALLBACK",

      /*
       * These values are deliberately
       * enforced locally. The external
       * service is never trusted to weaken
       * Slice's security policy.
       */
      sharedMemory: false,
      tradingExecutionEnabled: false,
      credentialsExposedToAgents: false,

      toolsUsed: readStringArray(
        audit.toolsUsed,
        20,
      ),

      agentRoles: readStringArray(
        audit.agentRoles,
        30,
      ),
    },
  };
}

function camelRequest(
  snapshot: MarketSnapshot,
) {
  return {
    schemaVersion:
      "slice-camel-bridge-1.0.0",

    requestId:
      snapshot.requestId,

    symbol:
      snapshot.symbol,

    asOf:
      snapshot.asOf,

    /*
     * Agents receive only an immutable,
     * normalized evidence snapshot.
     *
     * No database credentials, cookies,
     * user secrets, deployment access,
     * broker access, or arbitrary tools
     * are placed in this payload.
     */
    immutableEvidenceSnapshot: {
      sliceSentimentScore:
        snapshot.slice
          .sentimentScore,

      sentimentConfidence:
        snapshot.slice
          .sentimentConfidence,

      dataQuality:
        snapshot.slice.dataQuality,

      sourceCount:
        snapshot.slice.sourceCount,

      independentSourceCount:
        snapshot.slice
          .independentSourceCount,

      duplicateCount:
        snapshot.slice
          .duplicateCount,

      staleData:
        snapshot.slice.staleData,

      technicals:
        snapshot.technicals,

      fundamentals:
        snapshot.fundamentals,

      news:
        snapshot.news,

      macro:
        snapshot.macro,

      positioning:
        snapshot.positioning,

      environment:
        snapshot.environment,

      supplyChain:
        snapshot.supplyChain,
    },

    policy: {
      decisionSupportOnly: true,

      autonomousTradingEnabled:
        false,

      credentialsExposedToAgents:
        false,

      sharedMemory:
        false,

      allowedTools: [
        "read_immutable_evidence_snapshot",
        "calculate_structured_behavioral_features",
      ],

      forbiddenTools: [
        "broker_execution",
        "shell",
        "deployment",
        "production_database_write",
        "credential_read",
        "arbitrary_web_browse",
      ],
    },
  };
}

export async function callCamelWorkforce(
  snapshot: MarketSnapshot,
): Promise<CamelBehavioralFeatures> {
  const rawUrl =
    process.env
      .CAMEL_AI_SERVICE_URL
      ?.trim();

  const token =
    process.env
      .CAMEL_AI_SERVICE_TOKEN
      ?.trim();

  /*
   * CAMEL is optional. Slice must still
   * produce a deterministic forecast when
   * the workforce service is unavailable.
   */
  if (!rawUrl || !token) {
    return createDisabledCamelFeatures(
      "CAMEL_AI_SERVICE_URL or CAMEL_AI_SERVICE_TOKEN is not configured. Deterministic Slice simulation remains active.",
    );
  }

  let baseUrl: URL;

  try {
    baseUrl =
      validateServiceUrl(rawUrl);
  } catch (error) {
    return createDisabledCamelFeatures(
      error instanceof Error
        ? error.message
        : "Invalid CAMEL-AI service URL.",
    );
  }

  const endpoint = new URL(
    "/v1/workforce/analyze",
    baseUrl,
  );

  const timeoutMs = clamp(
    Number(
      process.env
        .CAMEL_AI_TIMEOUT_MS ??
        18_000,
    ),
    2_000,
    45_000,
  );

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(
      endpoint,
      {
        method: "POST",

        signal:
          controller.signal,

        cache: "no-store",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          "User-Agent":
            "SliceIntelligenceBridge/1.0",
        },

        body: JSON.stringify(
          camelRequest(snapshot),
        ),
      },
    );

    if (!response.ok) {
      const detail = (
        await response.text()
      ).slice(0, 500);

      return createDisabledCamelFeatures(
        `CAMEL-AI service returned HTTP ${
          response.status
        }${
          detail
            ? `: ${detail}`
            : ""
        }.`,
      );
    }

    const responseBody: unknown =
      await response.json();

    return normalizeCamelResponse(
      responseBody,
    );
  } catch (error) {
    const reason =
      error instanceof Error &&
      error.name === "AbortError"
        ? `CAMEL-AI exceeded the ${timeoutMs}ms timeout.`
        : error instanceof Error
          ? error.message
          : "Unknown CAMEL-AI service error.";

    return createDisabledCamelFeatures(
      `${reason} Deterministic Slice simulation completed without CAMEL forecast weight.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}