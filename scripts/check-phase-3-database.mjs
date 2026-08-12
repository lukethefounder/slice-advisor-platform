import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

import { PHASE_3_INDEXES } from "./phase-3-indexes.mjs";

const { Client } = pg;

function cleanEnvValue(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(fileName, override = false) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = cleanEnvValue(line.slice(separator + 1));

    if (key && (override || process.env[key] === undefined)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const connectionString = String(
  process.env.DIRECT_URL || process.env.DATABASE_URL || "",
).trim();

if (!connectionString) {
  process.stderr.write(
    "Phase 3 database check failed:\n- DIRECT_URL or DATABASE_URL is required.\n",
  );
  process.exit(1);
}

if (
  !connectionString.startsWith("postgresql://") &&
  !connectionString.startsWith("postgres://")
) {
  process.stderr.write(
    "Phase 3 database check failed:\n- The database URL must be PostgreSQL.\n",
  );
  process.exit(1);
}

const connectionTimeoutMillis = Math.max(
  1_000,
  Math.min(60_000, Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 5_000),
);
const expectedNames = PHASE_3_INDEXES.map((index) => index.name);
const client = new Client({
  connectionString,
  connectionTimeoutMillis,
  application_name: "slice-phase-3-index-check",
});

try {
  await client.connect();

  const result = await client.query(
    `
      SELECT schemaname, tablename, indexname
      FROM pg_indexes
      WHERE schemaname = ANY(current_schemas(false))
        AND indexname = ANY($1::text[])
      ORDER BY indexname ASC
    `,
    [expectedNames],
  );

  const foundNames = new Set(result.rows.map((row) => String(row.indexname)));
  const missingIndexes = expectedNames.filter((name) => !foundNames.has(name));

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: missingIndexes.length === 0,
        expectedIndexCount: expectedNames.length,
        foundIndexCount: foundNames.size,
        missingIndexes,
        indexes: result.rows,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  if (missingIndexes.length) {
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `Phase 3 database check failed:\n- ${
      error instanceof Error ? error.message : "Unknown PostgreSQL error"
    }\n`,
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}