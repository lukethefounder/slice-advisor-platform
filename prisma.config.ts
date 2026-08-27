import {
  existsSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function cleanEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (
      trimmed.startsWith('"') &&
      trimmed.endsWith('"')
    ) ||
    (
      trimmed.startsWith("'") &&
      trimmed.endsWith("'")
    )
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/**
 * Loads a local environment file without overriding variables already
 * supplied by the operating system, Vercel CLI, CI, or another parent
 * process.
 */
function loadEnvFile(fileName: string) {
  const filePath = resolve(
    process.cwd(),
    fileName,
  );

  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(
    filePath,
    "utf8",
  );

  for (
    const rawLine of contents.split(
      /\r?\n/,
    )
  ) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#")
    ) {
      continue;
    }

    const equalsIndex =
      line.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = line
      .slice(0, equalsIndex)
      .trim();

    const value = cleanEnvValue(
      line.slice(equalsIndex + 1),
    );

    if (!key) {
      continue;
    }

    /*
     * Parent-process variables always win. This is essential when running:
     *
     * vercel env run -e production -- npx prisma migrate deploy
     */
    if (
      process.env[key] === undefined
    ) {
      process.env[key] = value;
    }
  }
}

/*
 * Load the more specific local file first. The regular .env file then fills
 * only values that are still missing. Neither file may override variables
 * injected by Vercel, GitHub Actions, or the shell.
 */
loadEnvFile(".env.local");
loadEnvFile(".env");

function environmentValue(
  key: string,
) {
  return String(
    process.env[key] ?? "",
  ).trim();
}

function isPostgresUrl(
  value: string,
) {
  return (
    value.startsWith(
      "postgresql://",
    ) ||
    value.startsWith(
      "postgres://",
    )
  );
}

function parsedPostgresUrl(
  key: string,
  value: string,
) {
  if (!isPostgresUrl(value)) {
    throw new Error(
      `${key} must begin with postgresql:// or postgres://.`,
    );
  }

  try {
    return new URL(value);
  } catch {
    throw new Error(
      `${key} is not a valid PostgreSQL connection URL.`,
    );
  }
}

function appearsTransactionPooled(
  url: URL,
) {
  const host =
    url.hostname.toLowerCase();

  const pgbouncer = (
    url.searchParams.get(
      "pgbouncer",
    ) ?? ""
  ).toLowerCase();

  /*
   * Common transaction-pooler indicators:
   *
   * - Supabase/Supavisor transaction mode commonly uses port 6543.
   * - Prisma's pgbouncer=true setting indicates a pooled runtime URL.
   * - Neon pooled endpoints contain "-pooler." in the hostname.
   *
   * Supabase session-pooler connections on port 5432 are not rejected here.
   */
  return (
    url.port === "6543" ||
    pgbouncer === "true" ||
    host.includes("-pooler.")
  );
}

const directUrl =
  environmentValue("DIRECT_URL");

const runtimeUrl =
  environmentValue("DATABASE_URL");

const productionLike =
  environmentValue("VERCEL_ENV") ===
    "production" ||
  environmentValue(
    "SLICE_ENV_VALIDATION_MODE",
  ) === "production";

if (
  productionLike &&
  !directUrl
) {
  throw new Error(
    "Missing DIRECT_URL in the production environment. Prisma migrations require a direct, non-transaction-pooled PostgreSQL connection.",
  );
}

const datasourceUrl =
  directUrl || runtimeUrl;

if (!datasourceUrl) {
  throw new Error(
    "Missing database connection string. Set DIRECT_URL for Prisma CLI operations and DATABASE_URL for runtime access.",
  );
}

const parsedDatasource =
  parsedPostgresUrl(
    directUrl
      ? "DIRECT_URL"
      : "DATABASE_URL",
    datasourceUrl,
  );

if (
  directUrl &&
  appearsTransactionPooled(
    parsedDatasource,
  )
) {
  throw new Error(
    "DIRECT_URL appears to use a transaction-pooling endpoint. Use the database provider's direct, unpooled, or session connection string for Prisma migrations.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: datasourceUrl,
  },
});