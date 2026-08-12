import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const ALLOWED_ALPHA_ENTITLEMENTS = new Set(["", "realtime", "delayed"]);
const ALLOWED_LOG_LEVELS = new Set(["", "debug", "info", "warn", "error"]);
const PLACEHOLDER_PATTERN =
  /(replace[-_ ]?me|change[-_ ]?me|your[-_ ].*here|example[-_ ]?secret|sample[-_ ]?secret)/i;
const issues = [];

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

function value(key) {
  return String(process.env[key] ?? "").trim();
}

function enabled(key) {
  return TRUE_VALUES.has(value(key).toLowerCase());
}

function add(level, key, message) {
  issues.push({ level, key, message });
}

function requireValue(key, message) {
  if (!value(key)) add("error", key, message);
}

function validatePostgresUrl(key, required) {
  const current = value(key);

  if (!current) {
    if (required) add("error", key, `${key} is required.`);
    return;
  }

  if (!current.startsWith("postgresql://") && !current.startsWith("postgres://")) {
    add("error", key, `${key} must be a PostgreSQL connection string.`);
  }
}

function validateHttpUrl(key, required = false) {
  const current = value(key);

  if (!current) {
    if (required) add("error", key, `${key} is required.`);
    return;
  }

  try {
    const parsed = new URL(current);

    if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
      add("error", key, `${key} must use http:// or https://.`);
    }

    if (parsed.username || parsed.password) {
      add("error", key, `${key} must not contain embedded credentials.`);
    }
  } catch {
    add("error", key, `${key} must be a valid absolute URL.`);
  }
}

function validateInteger(key, minimum, maximum) {
  const current = value(key);
  if (!current) return;

  const parsed = Number(current);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    add(
      "error",
      key,
      `${key} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}

function validateBoolean(key) {
  const current = value(key).toLowerCase();

  if (!current) return;
  if (TRUE_VALUES.has(current) || FALSE_VALUES.has(current)) return;

  add("error", key, `${key} must be true or false.`);
}

function validateLongSecret(key, required) {
  const current = value(key);

  if (!current) {
    if (required) add("error", key, `${key} is required in production.`);
    return;
  }

  if (current.length < 32 || PLACEHOLDER_PATTERN.test(current)) {
    add(
      "error",
      key,
      `${key} must be a non-placeholder random value of at least 32 characters.`,
    );
  }
}

function requestedMode() {
  const raw = process.argv.slice(2).find((argument) =>
    argument.startsWith("--mode="),
  );
  const argumentValue = raw ? raw.slice("--mode=".length) : "";
  const configured = argumentValue || value("SLICE_ENV_VALIDATION_MODE");

  if (["development", "ci", "production"].includes(configured)) {
    return configured;
  }

  if (value("CI")) return "ci";
  if (value("VERCEL_ENV") === "production" || value("NODE_ENV") === "production") {
    return "production";
  }

  return "development";
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

const mode = requestedMode();
const production = mode === "production";

validatePostgresUrl("DATABASE_URL", true);
validatePostgresUrl("DIRECT_URL", false);
validateHttpUrl("APP_URL", false);
validateHttpUrl("NEXT_PUBLIC_APP_URL", false);
validateInteger("SESSION_TTL_HOURS", 1, 720);
validateInteger("SESSION_MAX_ACTIVE", 1, 20);
validateInteger("DB_POOL_MAX", 1, 50);
validateInteger("DB_CONNECTION_TIMEOUT_MS", 1_000, 60_000);
validateInteger("DB_IDLE_TIMEOUT_MS", 1_000, 600_000);
validateInteger("DB_STATEMENT_TIMEOUT_MS", 1_000, 600_000);
validateInteger("DB_TRANSACTION_MAX_WAIT_MS", 1_000, 60_000);
validateInteger("DB_TRANSACTION_TIMEOUT_MS", 1_000, 120_000);
validateInteger("DB_SLOW_QUERY_MS", 50, 60_000);
validateInteger("ALPHA_VANTAGE_RECOMMENDED_POLL_MS", 15_000, 600_000);
validateInteger("ALPHA_VANTAGE_HISTORY_CACHE_MS", 60_000, 3_600_000);
validateInteger("ALPHA_VANTAGE_TECHNICAL_LIMIT", 0, 100);
validateInteger("NEXT_PUBLIC_SLICE_REALTIME_POLL_MS", 15_000, 120_000);

for (const key of [
  "ENABLE_LIVE_EMAIL",
  "ENABLE_LIVE_SMS",
  "NEO4J_ENABLED",
  "LOG_INCLUDE_STACKS",
  "DB_QUERY_LOGGING",
  "SLICE_STRICT_ENV",
]) {
  validateBoolean(key);
}

if (production) {
  const appUrl = value("APP_URL") || value("NEXT_PUBLIC_APP_URL") || value("VERCEL_URL");

  if (!appUrl) {
    add(
      "error",
      "APP_URL",
      "Production requires APP_URL, NEXT_PUBLIC_APP_URL, or VERCEL_URL.",
    );
  }

  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    add("error", "APP_URL", "Production must not use a local application URL.");
  }

  validateLongSecret("CRON_SECRET", true);
  validateLongSecret("SLICE_SECRET_ENCRYPTION_KEY", true);
}

const configuredPoolMaximum = Number(value("DB_POOL_MAX"));

if (
  production &&
  Number.isInteger(configuredPoolMaximum) &&
  configuredPoolMaximum > 10
) {
  add(
    "warning",
    "DB_POOL_MAX",
    "DB_POOL_MAX is above 10. Confirm that the database connection ceiling supports pool size multiplied by the maximum application instance count.",
  );
}

const databaseApplicationName = value("DB_APPLICATION_NAME");

if (
  databaseApplicationName &&
  (databaseApplicationName.length > 63 ||
    /[^a-zA-Z0-9._:-]/.test(databaseApplicationName))
) {
  add(
    "error",
    "DB_APPLICATION_NAME",
    "DB_APPLICATION_NAME must use only letters, numbers, dots, underscores, colons, or hyphens and be no longer than 63 characters.",
  );
}

if (!value("DIRECT_URL")) {
  add(
    "warning",
    "DIRECT_URL",
    "DIRECT_URL is recommended for Prisma migrations and administrative database operations.",
  );
}

const alphaEntitlement = value("ALPHA_VANTAGE_ENTITLEMENT").toLowerCase();
if (!ALLOWED_ALPHA_ENTITLEMENTS.has(alphaEntitlement)) {
  add(
    "error",
    "ALPHA_VANTAGE_ENTITLEMENT",
    "Use realtime, delayed, or leave the value blank.",
  );
}

if (alphaEntitlement && !value("ALPHA_VANTAGE_API_KEY")) {
  add(
    "error",
    "ALPHA_VANTAGE_API_KEY",
    "Alpha Vantage entitlement is configured without ALPHA_VANTAGE_API_KEY.",
  );
}

if (!ALLOWED_LOG_LEVELS.has(value("LOG_LEVEL").toLowerCase())) {
  add("error", "LOG_LEVEL", "Use debug, info, warn, error, or leave blank.");
}

if (enabled("ENABLE_LIVE_EMAIL")) {
  requireValue("RESEND_API_KEY", "Live email requires RESEND_API_KEY.");
  requireValue("RESEND_FROM", "Live email requires RESEND_FROM.");
}

if (enabled("ENABLE_LIVE_SMS")) {
  requireValue("TWILIO_ACCOUNT_SID", "Live SMS requires TWILIO_ACCOUNT_SID.");
  requireValue("TWILIO_AUTH_TOKEN", "Live SMS requires TWILIO_AUTH_TOKEN.");

  if (!value("TWILIO_PHONE_NUMBER") && !value("TWILIO_MESSAGING_SERVICE_SID")) {
    add(
      "error",
      "TWILIO_PHONE_NUMBER",
      "Live SMS requires TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
    );
  }
}

if (enabled("NEO4J_ENABLED")) {
  requireValue("NEO4J_URI", "Neo4j requires NEO4J_URI.");
  requireValue("NEO4J_USERNAME", "Neo4j requires NEO4J_USERNAME.");
  requireValue("NEO4J_PASSWORD", "Neo4j requires NEO4J_PASSWORD.");
}

for (const key of Object.keys(process.env)) {
  if (
    key.startsWith("NEXT_PUBLIC_") &&
    /(SECRET|PASSWORD|PRIVATE|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY)/i.test(key) &&
    value(key)
  ) {
    add("error", key, `${key} appears secret and must not use NEXT_PUBLIC_.`);
  }
}

const errors = issues.filter((issue) => issue.level === "error");
const warnings = issues.filter((issue) => issue.level === "warning");

process.stdout.write(
  `${JSON.stringify(
    {
      ok: errors.length === 0,
      mode,
      errors,
      warnings,
      checkedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

if (errors.length) process.exitCode = 1;