import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PHASE_3_INDEXES } from "./phase-3-indexes.mjs";

const migrationPath =
  "prisma/migrations/20260804030000_phase_3_database_performance/migration.sql";
const requiredFiles = [
  ".env.example",
  "package.json",
  "prisma/schema.prisma",
  migrationPath,
  "scripts/phase-3-indexes.mjs",
  "scripts/apply-phase-3-schema-indexes.mjs",
  "scripts/check-phase-3-database.mjs",
  "scripts/validate-env.mjs",
  "scripts/validate-phase-3.mjs",
  "src/lib/env.ts",
  "src/lib/health.ts",
  "src/lib/prisma.ts",
  "docs/PHASE_3_DATABASE_PERFORMANCE.md",
  "docs/PHASE_3_SCHEMA_INDEXES.md",
];
const failures = [];

function filePath(relativePath) {
  return resolve(process.cwd(), relativePath);
}

function read(relativePath) {
  return readFileSync(filePath(relativePath), "utf8");
}

function compact(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

for (const relativePath of requiredFiles) {
  if (!existsSync(filePath(relativePath))) {
    failures.push(`Missing required Phase 3 file: ${relativePath}`);
  }
}

if (!failures.length) {
  let packageJson;

  try {
    packageJson = JSON.parse(read("package.json"));
  } catch (error) {
    failures.push(
      `package.json is invalid JSON: ${
        error instanceof Error ? error.message : "Unknown JSON error"
      }`,
    );
  }

  const schema = read("prisma/schema.prisma");
  const migration = read(migrationPath);
  const migrationSql = migration.replace(/--.*$/gm, "");
  const prismaSource = read("src/lib/prisma.ts");
  const environmentSource = read("src/lib/env.ts");
  const healthSource = read("src/lib/health.ts");
  const envExample = read(".env.example");
  const envValidator = read("scripts/validate-env.mjs");
  const compactPrisma = compact(prismaSource);
  const compactHealth = compact(healthSource);

  for (const scriptName of [
    "validate:phase3",
    "db:phase3:prepare",
    "db:phase3:check",
  ]) {
    if (packageJson && !packageJson.scripts?.[scriptName]) {
      failures.push(`package.json is missing the "${scriptName}" script.`);
    }
  }

  for (const index of PHASE_3_INDEXES) {
    if (!schema.includes(`map: "${index.name}"`)) {
      failures.push(`prisma/schema.prisma is missing ${index.name}.`);
    }

    if (!migration.includes(`"${index.name}"`)) {
      failures.push(`${migrationPath} is missing ${index.name}.`);
    }
  }

  const createIndexCount = (
    migration.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) ?? []
  ).length;

  if (createIndexCount !== PHASE_3_INDEXES.length) {
    failures.push(
      `${migrationPath} must contain exactly ${PHASE_3_INDEXES.length} additive index statements; found ${createIndexCount}.`,
    );
  }

  if (/\b(DROP|TRUNCATE|DELETE|ALTER\s+TABLE|UPDATE|INSERT)\b/i.test(migrationSql)) {
    failures.push(
      `${migrationPath} must remain additive and must not contain destructive or data-changing SQL.`,
    );
  }

  if (!migration.includes("SET lock_timeout")) {
    failures.push(`${migrationPath} must set a bounded PostgreSQL lock timeout.`);
  }

  if (!compactPrisma.includes("new PrismaPg(adapterConfiguration())")) {
    failures.push(
      "src/lib/prisma.ts must configure PrismaPg with bounded pg driver settings.",
    );
  }

  if (!compactPrisma.includes("slicePrismaClient")) {
    failures.push("src/lib/prisma.ts must reuse one Prisma client per process.");
  }

  if (!compactPrisma.includes("$allOperations")) {
    failures.push("src/lib/prisma.ts must time Prisma model operations.");
  }

  for (const setting of [
    "DB_POOL_MAX",
    "DB_CONNECTION_TIMEOUT_MS",
    "DB_IDLE_TIMEOUT_MS",
    "DB_STATEMENT_TIMEOUT_MS",
    "DB_SLOW_QUERY_MS",
  ]) {
    if (!prismaSource.includes(setting)) {
      failures.push(`src/lib/prisma.ts must use ${setting}.`);
    }

    if (!environmentSource.includes(setting)) {
      failures.push(`src/lib/env.ts must validate ${setting}.`);
    }

    if (!envValidator.includes(setting)) {
      failures.push(`scripts/validate-env.mjs must validate ${setting}.`);
    }

    if (!envExample.includes(setting)) {
      failures.push(`.env.example must document ${setting}.`);
    }
  }

  if (!compactPrisma.includes('databaseLogger.warn("query.slow"')) {
    failures.push("src/lib/prisma.ts must report slow queries.");
  }

  if (/event\.params|params:\s*event\.params|args:\s*args/.test(prismaSource)) {
    failures.push("src/lib/prisma.ts must never log query parameters or Prisma arguments.");
  }

  if (!compactHealth.includes("databasePoolSnapshot()")) {
    failures.push(
      "src/lib/health.ts must expose pool utilization only in authorized diagnostics.",
    );
  }
}

if (failures.length) {
  process.stderr.write(
    `Phase 3 validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        phase: "3-database-and-prisma-performance",
        checkedFiles: requiredFiles.length,
        expectedIndexes: PHASE_3_INDEXES.length,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}