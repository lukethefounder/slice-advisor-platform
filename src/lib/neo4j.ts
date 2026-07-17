import "server-only";

import neo4j, {
  type Driver,
  type QueryResult,
} from "neo4j-driver";

type Neo4jQueryParameters =
  Record<string, unknown>;

type Neo4jConfiguration = {
  enabled: boolean;
  configured: boolean;
  uri: string;
  username: string;
  password: string;
  database: string;
  missing: string[];
};

const globalForNeo4j =
  globalThis as unknown as {
    sliceNeo4jDriver?: Driver;
    sliceNeo4jDriverPromise?: Promise<Driver>;
  };

function clean(
  value: string | undefined,
) {
  return String(
    value ?? "",
  ).trim();
}

function enabledFromEnvironment() {
  const raw =
    clean(
      process.env.NEO4J_ENABLED,
    ).toLowerCase();

  return ![
    "false",
    "0",
    "off",
    "disabled",
  ].includes(
    raw,
  );
}

export function getNeo4jConfiguration(): Neo4jConfiguration {
  const uri =
    clean(
      process.env.NEO4J_URI,
    );

  const username =
    clean(
      process.env.NEO4J_USERNAME,
    );

  const password =
    clean(
      process.env.NEO4J_PASSWORD,
    );

  const database =
    clean(
      process.env.NEO4J_DATABASE,
    ) ||
    "neo4j";

  const missing:
    string[] = [];

  if (!uri) {
    missing.push(
      "NEO4J_URI",
    );
  }

  if (!username) {
    missing.push(
      "NEO4J_USERNAME",
    );
  }

  if (!password) {
    missing.push(
      "NEO4J_PASSWORD",
    );
  }

  const enabled =
    enabledFromEnvironment();

  return {
    enabled,

    configured:
      enabled &&
      missing.length ===
        0,

    uri,

    username,

    password,

    database,

    missing,
  };
}

export function isNeo4jConfigured() {
  return getNeo4jConfiguration()
    .configured;
}

export async function getNeo4jDriver() {
  const configuration =
    getNeo4jConfiguration();

  if (
    !configuration.enabled
  ) {
    throw new Error(
      "Neo4j integration is disabled.",
    );
  }

  if (
    !configuration.configured
  ) {
    throw new Error(
      `Neo4j configuration is incomplete. Missing: ${configuration.missing.join(
        ", ",
      )}.`,
    );
  }

  if (
    globalForNeo4j
      .sliceNeo4jDriver
  ) {
    return globalForNeo4j
      .sliceNeo4jDriver;
  }

  if (
    globalForNeo4j
      .sliceNeo4jDriverPromise
  ) {
    return globalForNeo4j
      .sliceNeo4jDriverPromise;
  }

  globalForNeo4j
    .sliceNeo4jDriverPromise =
    (async () => {
      const driver =
        neo4j.driver(
          configuration.uri,

          neo4j.auth.basic(
            configuration.username,
            configuration.password,
          ),

          {
            telemetryDisabled:
              true,

            maxConnectionPoolSize:
              20,

            connectionAcquisitionTimeout:
              15_000,

            maxTransactionRetryTime:
              15_000,
          },
        );

      try {
        await driver.verifyConnectivity();

        globalForNeo4j
          .sliceNeo4jDriver =
          driver;

        return driver;
      } catch (error) {
        await driver
          .close()
          .catch(
            () => undefined,
          );

        throw error;
      } finally {
        globalForNeo4j
          .sliceNeo4jDriverPromise =
          undefined;
      }
    })();

  return globalForNeo4j
    .sliceNeo4jDriverPromise;
}

function findPaginationParameterNames(
  query: string,
) {
  const names =
    new Set<string>();

  const pattern =
    /\b(?:LIMIT|SKIP|OFFSET)\s+\$([A-Za-z_][A-Za-z0-9_]*)/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        pattern.exec(
          query,
        )
    ) !==
    null
  ) {
    const parameterName =
      match[1];

    if (
      parameterName
    ) {
      names.add(
        parameterName,
      );
    }
  }

  return names;
}

function toNeo4jPaginationInteger(
  value: unknown,
  parameterName: string,
) {
  if (
    neo4j.isInt(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value < 0
    ) {
      throw new TypeError(
        `Neo4j pagination parameter "${parameterName}" must be a non-negative safe integer.`,
      );
    }

    return neo4j.int(
      value,
    );
  }

  if (
    typeof value ===
    "bigint"
  ) {
    const stringValue =
      value.toString();

    if (
      stringValue.startsWith(
        "-",
      )
    ) {
      throw new TypeError(
        `Neo4j pagination parameter "${parameterName}" must be non-negative.`,
      );
    }

    return neo4j.int(
      stringValue,
    );
  }

  if (
    typeof value ===
      "string" &&
    /^\d+$/.test(
      value,
    )
  ) {
    return neo4j.int(
      value,
    );
  }

  throw new TypeError(
    `Neo4j pagination parameter "${parameterName}" must be an integer-compatible number, bigint, string, or Neo4j Integer.`,
  );
}

function normalizeNeo4jQueryParameters(
  query: string,
  parameters:
    Neo4jQueryParameters,
): Neo4jQueryParameters {
  const paginationParameters =
    findPaginationParameterNames(
      query,
    );

  if (
    paginationParameters.size ===
    0
  ) {
    return parameters;
  }

  const normalized:
    Neo4jQueryParameters = {
    ...parameters,
  };

  for (
    const parameterName of
      paginationParameters
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        normalized,
        parameterName,
      )
    ) {
      continue;
    }

    normalized[
      parameterName
    ] =
      toNeo4jPaginationInteger(
        normalized[
          parameterName
        ],
        parameterName,
      );
  }

  return normalized;
}

export async function executeNeo4j(
  query: string,
  parameters:
    Neo4jQueryParameters = {},
): Promise<QueryResult> {
  const configuration =
    getNeo4jConfiguration();

  const driver =
    await getNeo4jDriver();

  const normalizedParameters =
    normalizeNeo4jQueryParameters(
      query,
      parameters,
    );

  return driver.executeQuery(
    query,
    normalizedParameters,
    {
      database:
        configuration.database,
    },
  );
}

export async function verifyNeo4jConnectivity() {
  const configuration =
    getNeo4jConfiguration();

  if (
    !configuration.configured
  ) {
    return {
      ok:
        false,

      configured:
        false,

      enabled:
        configuration.enabled,

      database:
        configuration.database,

      missing:
        configuration.missing,

      detail:
        configuration.enabled
          ? "Neo4j environment variables are incomplete."
          : "Neo4j integration is disabled.",
    };
  }

  try {
    const driver =
      await getNeo4jDriver();

    const info =
      await driver.getServerInfo();

    return {
      ok:
        true,

      configured:
        true,

      enabled:
        true,

      database:
        configuration.database,

      address:
        String(
          info.address,
        ),

      agent:
        String(
          info.agent,
        ),

      protocolVersion:
        String(
          info.protocolVersion,
        ),

      missing:
        [],

      detail:
        "Neo4j connectivity verified.",
    };
  } catch (error) {
    return {
      ok:
        false,

      configured:
        true,

      enabled:
        true,

      database:
        configuration.database,

      missing:
        [],

      detail:
        error instanceof Error
          ? error.message
          : "Unknown Neo4j connection error.",
    };
  }
}

export function neo4jToNative(
  value: unknown,
): unknown {
  if (
    neo4j.isInt(
      value,
    )
  ) {
    return value.inSafeRange()
      ? value.toNumber()
      : value.toString();
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      neo4jToNative,
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const candidate =
      value as {
        toStandardDate?: () => Date;
        toString?: () => string;
        properties?: unknown;
      };

    if (
      typeof candidate
        .toStandardDate ===
      "function"
    ) {
      return candidate
        .toStandardDate()
        .toISOString();
    }

    if (
      candidate.properties &&
      typeof candidate
        .properties ===
        "object"
    ) {
      return neo4jToNative(
        candidate.properties,
      );
    }

    const output:
      Record<
        string,
        unknown
      > = {};

    for (
      const [
        key,
        child,
      ] of Object.entries(
        value,
      )
    ) {
      output[
        key
      ] =
        neo4jToNative(
          child,
        );
    }

    return output;
  }

  return value;
}

export function recordToNative(
  record: {
    toObject: () =>
      Record<
        string,
        unknown
      >;
  },
) {
  return neo4jToNative(
    record.toObject(),
  ) as Record<
    string,
    unknown
  >;
}

export async function closeNeo4jDriver() {
  const driver =
    globalForNeo4j
      .sliceNeo4jDriver;

  globalForNeo4j
    .sliceNeo4jDriver =
    undefined;

  globalForNeo4j
    .sliceNeo4jDriverPromise =
    undefined;

  if (
    driver
  ) {
    await driver.close();
  }
}