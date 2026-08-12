export type IntegrationStatus = {
  key: string;
  label: string;
  category: string;
  configured: boolean;
  liveEnabled?: boolean;
  requiredEnv: string[];
  safeStatus: "Ready" | "Missing" | "Disabled" | "Simulated";
  note: string;
};

export type EnvironmentValidationMode =
  | "development"
  | "ci"
  | "production";

export type EnvironmentIssue = {
  severity: "error" | "warning";
  key: string;
  message: string;
};

export type EnvironmentValidationResult = {
  ok: boolean;
  mode: EnvironmentValidationMode;
  errors: EnvironmentIssue[];
  warnings: EnvironmentIssue[];
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const PLACEHOLDER_PATTERN =
  /(replace[-_ ]?me|change[-_ ]?me|your[-_ ].*here|example[-_ ]?secret|sample[-_ ]?secret)/i;
const SERVER_SECRET_PUBLIC_NAME_PATTERN =
  /(SECRET|PASSWORD|PRIVATE|AUTH_TOKEN|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY)/i;
const LOG_LEVELS = new Set(["debug", "info", "warn", "error"]);
const ALPHA_ENTITLEMENTS = new Set(["", "delayed", "realtime"]);

function clean(value: string | undefined) {
  return String(value ?? "").trim();
}

function configuredMode(): EnvironmentValidationMode | null {
  const value = clean(process.env.SLICE_ENV_VALIDATION_MODE).toLowerCase();

  return value === "development" || value === "ci" || value === "production"
    ? value
    : null;
}

function currentValidationMode(): EnvironmentValidationMode {
  const explicit = configuredMode();

  if (explicit) return explicit;
  if (process.env.CI) return "ci";
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "production";
  }

  return "development";
}

function normalizeHttpUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Application URLs must use http:// or https://.");
  }

  if (url.username || url.password) {
    throw new Error("Application URLs must not contain embedded credentials.");
  }

  return url.toString().replace(/\/$/, "");
}

function isPostgresUrl(value: string) {
  return value.startsWith("postgresql://") || value.startsWith("postgres://");
}

function hasConfiguredAppUrl() {
  return Boolean(
    clean(process.env.APP_URL) ||
      clean(process.env.NEXT_PUBLIC_APP_URL) ||
      clean(process.env.VERCEL_URL),
  );
}

function validateInteger(
  key: string,
  minimum: number,
  maximum: number,
  issues: EnvironmentIssue[],
) {
  const raw = clean(process.env[key]);

  if (!raw) return;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    issues.push({
      severity: "error",
      key,
      message: `${key} must be an integer between ${minimum} and ${maximum}.`,
    });
  }
}

function validateBoolean(key: string, issues: EnvironmentIssue[]) {
  const value = clean(process.env[key]).toLowerCase();

  if (!value) return;
  if (TRUE_VALUES.has(value) || FALSE_VALUES.has(value)) return;

  issues.push({
    severity: "error",
    key,
    message: `${key} must be true or false.`,
  });
}

function requireKeys(
  keys: string[],
  message: string,
  issues: EnvironmentIssue[],
) {
  const missing = keys.filter((key) => !clean(process.env[key]));

  if (!missing.length) return;

  issues.push({
    severity: "error",
    key: missing.join(", "),
    message: `${message} Missing: ${missing.join(", ")}.`,
  });
}

function validateLongSecret(
  key: string,
  issues: EnvironmentIssue[],
  options: { required: boolean; minimumLength?: number },
) {
  const value = clean(process.env[key]);

  if (!value) {
    if (options.required) {
      issues.push({
        severity: "error",
        key,
        message: `${key} is required in this environment.`,
      });
    }
    return;
  }

  const minimumLength = options.minimumLength ?? 32;

  if (value.length < minimumLength || PLACEHOLDER_PATTERN.test(value)) {
    issues.push({
      severity: "error",
      key,
      message: `${key} must be a non-placeholder random value of at least ${minimumLength} characters.`,
    });
  }
}

export function boolEnv(key: string, fallback = false) {
  const value = clean(process.env[key]).toLowerCase();

  if (!value) return fallback;
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;

  return fallback;
}

export function numberEnv(
  key: string,
  fallback: number,
  options: { minimum?: number; maximum?: number } = {},
) {
  const parsed = Number(process.env[key]);

  if (!Number.isFinite(parsed)) return fallback;

  const minimum = options.minimum ?? Number.NEGATIVE_INFINITY;
  const maximum = options.maximum ?? Number.POSITIVE_INFINITY;

  return Math.max(minimum, Math.min(maximum, parsed));
}

export function getAppUrl() {
  const configured =
    clean(process.env.APP_URL) || clean(process.env.NEXT_PUBLIC_APP_URL);

  if (configured) {
    return normalizeHttpUrl(configured);
  }

  const vercelUrl = clean(process.env.VERCEL_URL);

  if (vercelUrl) {
    return normalizeHttpUrl(
      vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing application URL. Set APP_URL, NEXT_PUBLIC_APP_URL, or VERCEL_URL.",
    );
  }

  return "http://localhost:3000";
}

export function getRequiredEnv(key: string) {
  const value = clean(process.env[key]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getOptionalEnv(key: string) {
  return clean(process.env[key]);
}

export function isConfigured(keys: string[]) {
  return keys.every((key) => Boolean(clean(process.env[key])));
}

export function validateRuntimeEnvironment(
  options: { mode?: EnvironmentValidationMode } = {},
): EnvironmentValidationResult {
  const mode = options.mode ?? currentValidationMode();
  const issues: EnvironmentIssue[] = [];
  const databaseUrl = clean(process.env.DATABASE_URL);
  const directUrl = clean(process.env.DIRECT_URL);
  const entitlement = clean(process.env.ALPHA_VANTAGE_ENTITLEMENT).toLowerCase();
  const explicitAppUrl =
    clean(process.env.APP_URL) || clean(process.env.NEXT_PUBLIC_APP_URL);

  if (!databaseUrl) {
    issues.push({
      severity: "error",
      key: "DATABASE_URL",
      message: "DATABASE_URL is required for the Slice runtime.",
    });
  } else if (!isPostgresUrl(databaseUrl)) {
    issues.push({
      severity: "error",
      key: "DATABASE_URL",
      message: "DATABASE_URL must be a PostgreSQL connection string.",
    });
  }

  if (!directUrl) {
    issues.push({
      severity: "warning",
      key: "DIRECT_URL",
      message:
        "DIRECT_URL is recommended for Prisma migrations and administrative database operations.",
    });
  } else if (!isPostgresUrl(directUrl)) {
    issues.push({
      severity: "error",
      key: "DIRECT_URL",
      message: "DIRECT_URL must be a PostgreSQL connection string.",
    });
  }

  if (mode === "production" && !hasConfiguredAppUrl()) {
    issues.push({
      severity: "error",
      key: "APP_URL",
      message:
        "APP_URL, NEXT_PUBLIC_APP_URL, or VERCEL_URL is required in production.",
    });
  }

  if (explicitAppUrl) {
    try {
      normalizeHttpUrl(explicitAppUrl);
    } catch (error) {
      issues.push({
        severity: "error",
        key: "APP_URL",
        message:
          error instanceof Error
            ? error.message
            : "The configured application URL is invalid.",
      });
    }
  }

  if (mode === "production") {
    validateLongSecret("CRON_SECRET", issues, { required: true });
    validateLongSecret("SLICE_SECRET_ENCRYPTION_KEY", issues, {
      required: true,
    });
  }

  validateInteger("SESSION_TTL_HOURS", 1, 720, issues);
  validateInteger("SESSION_MAX_ACTIVE", 1, 20, issues);
  validateInteger("DB_POOL_MAX", 1, 50, issues);
  validateInteger("DB_CONNECTION_TIMEOUT_MS", 1_000, 60_000, issues);
  validateInteger("DB_IDLE_TIMEOUT_MS", 1_000, 600_000, issues);
  validateInteger("DB_STATEMENT_TIMEOUT_MS", 1_000, 600_000, issues);
  validateInteger("DB_TRANSACTION_MAX_WAIT_MS", 1_000, 60_000, issues);
  validateInteger("DB_TRANSACTION_TIMEOUT_MS", 1_000, 120_000, issues);
  validateInteger("DB_SLOW_QUERY_MS", 50, 60_000, issues);
  validateInteger("ALPHA_VANTAGE_RECOMMENDED_POLL_MS", 15_000, 600_000, issues);
  validateInteger("ALPHA_VANTAGE_HISTORY_CACHE_MS", 60_000, 3_600_000, issues);
  validateInteger("ALPHA_VANTAGE_TECHNICAL_LIMIT", 0, 100, issues);
  validateInteger("NEXT_PUBLIC_SLICE_REALTIME_POLL_MS", 15_000, 120_000, issues);

  for (const key of [
    "ENABLE_LIVE_EMAIL",
    "ENABLE_LIVE_SMS",
    "NEO4J_ENABLED",
    "LOG_INCLUDE_STACKS",
    "DB_QUERY_LOGGING",
    "SLICE_STRICT_ENV",
  ]) {
    validateBoolean(key, issues);
  }

  const configuredPoolMaximum = Number(clean(process.env.DB_POOL_MAX));

  if (
    mode === "production" &&
    Number.isInteger(configuredPoolMaximum) &&
    configuredPoolMaximum > 10
  ) {
    issues.push({
      severity: "warning",
      key: "DB_POOL_MAX",
      message:
        "DB_POOL_MAX is above 10. Confirm that the database connection ceiling can support pool size multiplied by the maximum number of application instances.",
    });
  }

  const databaseApplicationName = clean(process.env.DB_APPLICATION_NAME);

  if (
    databaseApplicationName.length > 63 ||
    /[^a-zA-Z0-9._:-]/.test(databaseApplicationName)
  ) {
    issues.push({
      severity: "error",
      key: "DB_APPLICATION_NAME",
      message:
        "DB_APPLICATION_NAME must contain only letters, numbers, dots, underscores, colons, or hyphens and be no longer than 63 characters.",
    });
  }

  const logLevel = clean(process.env.LOG_LEVEL).toLowerCase();

  if (logLevel && !LOG_LEVELS.has(logLevel)) {
    issues.push({
      severity: "error",
      key: "LOG_LEVEL",
      message: "LOG_LEVEL must be debug, info, warn, or error.",
    });
  }

  if (!ALPHA_ENTITLEMENTS.has(entitlement)) {
    issues.push({
      severity: "error",
      key: "ALPHA_VANTAGE_ENTITLEMENT",
      message: "ALPHA_VANTAGE_ENTITLEMENT must be blank, delayed, or realtime.",
    });
  }

  if (entitlement && !clean(process.env.ALPHA_VANTAGE_API_KEY)) {
    issues.push({
      severity: "error",
      key: "ALPHA_VANTAGE_API_KEY",
      message:
        "ALPHA_VANTAGE_API_KEY is required when ALPHA_VANTAGE_ENTITLEMENT is configured.",
    });
  }

  if (boolEnv("ENABLE_LIVE_EMAIL")) {
    requireKeys(
      ["RESEND_API_KEY", "RESEND_FROM"],
      "Live email delivery is enabled.",
      issues,
    );
  }

  if (boolEnv("ENABLE_LIVE_SMS")) {
    requireKeys(
      ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
      "Live SMS delivery is enabled.",
      issues,
    );

    if (
      !clean(process.env.TWILIO_PHONE_NUMBER) &&
      !clean(process.env.TWILIO_MESSAGING_SERVICE_SID)
    ) {
      issues.push({
        severity: "error",
        key: "TWILIO_PHONE_NUMBER",
        message:
          "Live SMS requires TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
      });
    }
  }

  if (boolEnv("NEO4J_ENABLED")) {
    requireKeys(
      ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
      "Neo4j is enabled.",
      issues,
    );
  }

  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("NEXT_PUBLIC_") &&
      SERVER_SECRET_PUBLIC_NAME_PATTERN.test(key) &&
      clean(process.env[key])
    ) {
      issues.push({
        severity: "error",
        key,
        message: `${key} appears secret and must not use the NEXT_PUBLIC_ prefix.`,
      });
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings,
  };
}

export function assertRuntimeEnvironment(
  options: { mode?: EnvironmentValidationMode } = {},
) {
  const result = validateRuntimeEnvironment(options);

  if (!result.ok) {
    throw new Error(
      `Slice environment validation failed: ${result.errors
        .map((issue) => `${issue.key}: ${issue.message}`)
        .join(" | ")}`,
    );
  }

  return result;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  const liveEmail = boolEnv("ENABLE_LIVE_EMAIL");
  const liveSms = boolEnv("ENABLE_LIVE_SMS");
  const neo4jEnabled = boolEnv("NEO4J_ENABLED");
  const databaseReady = isConfigured(["DATABASE_URL"]);
  const openAiReady = isConfigured(["OPENAI_API_KEY"]);
  const alphaVantageReady = isConfigured(["ALPHA_VANTAGE_API_KEY"]);
  const resendReady = isConfigured(["RESEND_API_KEY", "RESEND_FROM"]);
  const twilioReady =
    isConfigured(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]) &&
    Boolean(
      clean(process.env.TWILIO_PHONE_NUMBER) ||
        clean(process.env.TWILIO_MESSAGING_SERVICE_SID),
    );
  const blobReady = isConfigured(["BLOB_READ_WRITE_TOKEN"]);
  const neo4jReady = isConfigured([
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
  ]);

  return [
    {
      key: "postgresql",
      label: "PostgreSQL",
      category: "Database",
      configured: databaseReady,
      requiredEnv: ["DATABASE_URL"],
      safeStatus: databaseReady ? "Ready" : "Missing",
      note: databaseReady
        ? "Runtime database configuration is present."
        : "DATABASE_URL is missing.",
    },
    {
      key: "openai",
      label: "OpenAI",
      category: "AI",
      configured: openAiReady,
      requiredEnv: ["OPENAI_API_KEY"],
      safeStatus: openAiReady ? "Ready" : "Missing",
      note: openAiReady
        ? "AI provider configuration is present."
        : "OPENAI_API_KEY is missing. AI workflows must use approved fallback behavior.",
    },
    {
      key: "alpha_vantage",
      label: "Alpha Vantage",
      category: "Market Data",
      configured: alphaVantageReady,
      requiredEnv: ["ALPHA_VANTAGE_API_KEY"],
      safeStatus: alphaVantageReady ? "Ready" : "Missing",
      note: alphaVantageReady
        ? "Market-data provider configuration is present."
        : "ALPHA_VANTAGE_API_KEY is missing. Provider-backed market data is unavailable.",
    },
    {
      key: "resend",
      label: "Resend",
      category: "Email",
      configured: resendReady,
      liveEnabled: liveEmail,
      requiredEnv: ["RESEND_API_KEY", "RESEND_FROM"],
      safeStatus: !resendReady
        ? "Missing"
        : liveEmail
          ? "Ready"
          : "Simulated",
      note: !resendReady
        ? "Resend email configuration is missing."
        : liveEmail
          ? "Live email delivery is enabled."
          : "Email is configured but live delivery is disabled.",
    },
    {
      key: "twilio",
      label: "Twilio",
      category: "SMS",
      configured: twilioReady,
      liveEnabled: liveSms,
      requiredEnv: [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID",
      ],
      safeStatus: !twilioReady
        ? "Missing"
        : liveSms
          ? "Ready"
          : "Simulated",
      note: !twilioReady
        ? "Twilio SMS configuration is missing."
        : liveSms
          ? "Live SMS delivery is enabled."
          : "SMS is configured but live delivery is disabled.",
    },
    {
      key: "vercel_blob",
      label: "Vercel Blob",
      category: "Storage",
      configured: blobReady,
      requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
      safeStatus: blobReady ? "Ready" : "Missing",
      note: blobReady
        ? "Object-storage configuration is present."
        : "BLOB_READ_WRITE_TOKEN is missing. File storage cannot run in live mode.",
    },
    {
      key: "neo4j",
      label: "Neo4j",
      category: "Knowledge Graph",
      configured: neo4jReady,
      liveEnabled: neo4jEnabled,
      requiredEnv: ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"],
      safeStatus: !neo4jEnabled
        ? "Disabled"
        : neo4jReady
          ? "Ready"
          : "Missing",
      note: !neo4jEnabled
        ? "Neo4j is disabled."
        : neo4jReady
          ? "Knowledge-graph configuration is present."
          : "Neo4j is enabled but its connection settings are incomplete.",
    },
  ];
}