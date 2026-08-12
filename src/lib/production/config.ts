import "server-only";

export type ProductionConfigurationIssue = {
  severity: "error" | "warning";
  key: string;
  message: string;
};

export type ProductionConfiguration = {
  webVitalsSampleRate: number;
  webVitalsRetentionDays: number;
  completedJobRetentionDays: number;
  failedJobRetentionDays: number;
  maintenanceBatchSize: number;
  cspReportOnly: boolean;
  rateLimitFailOpen: boolean;
  marketSnapshotRetentionDays: number | null;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const PLACEHOLDER_PATTERN =
  /(replace[-_ ]?me|change[-_ ]?me|your[-_ ].*here|example[-_ ]?secret|sample[-_ ]?secret)/i;

function clean(key: string) {
  return String(process.env[key] ?? "").trim();
}

function booleanValue(key: string, fallback: boolean) {
  const raw = clean(key).toLowerCase();
  if (TRUE_VALUES.has(raw)) return true;
  if (FALSE_VALUES.has(raw)) return false;
  return fallback;
}

function integerValue(
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(clean(key));
  return Number.isInteger(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

function numberValue(
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(clean(key));
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

function nullableRetentionDays(key: string) {
  const raw = clean(key);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return null;
  return Math.max(7, Math.min(3_650, parsed));
}

function validateSecret(
  key: string,
  required: boolean,
  issues: ProductionConfigurationIssue[],
) {
  const value = clean(key);

  if (!value) {
    if (required) {
      issues.push({
        severity: "error",
        key,
        message: `${key} is required in production.`,
      });
    }
    return;
  }

  if (value.length < 32 || PLACEHOLDER_PATTERN.test(value)) {
    issues.push({
      severity: "error",
      key,
      message: `${key} must be a non-placeholder random value of at least 32 characters.`,
    });
  }
}

export function getProductionConfiguration(): ProductionConfiguration {
  return {
    webVitalsSampleRate: numberValue(
      "NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE",
      0.25,
      0,
      1,
    ),
    webVitalsRetentionDays: integerValue(
      "WEB_VITALS_RETENTION_DAYS",
      30,
      7,
      365,
    ),
    completedJobRetentionDays: integerValue(
      "COMPLETED_JOB_RETENTION_DAYS",
      45,
      7,
      365,
    ),
    failedJobRetentionDays: integerValue(
      "FAILED_JOB_RETENTION_DAYS",
      180,
      30,
      730,
    ),
    maintenanceBatchSize: integerValue(
      "MAINTENANCE_BATCH_SIZE",
      2_000,
      100,
      10_000,
    ),
    cspReportOnly: booleanValue("SECURITY_CSP_REPORT_ONLY", false),
    rateLimitFailOpen: booleanValue("SECURITY_RATE_LIMIT_FAIL_OPEN", false),
    marketSnapshotRetentionDays: nullableRetentionDays(
      "MARKET_SNAPSHOT_RETENTION_DAYS",
    ),
  };
}

export function validateProductionConfiguration(options?: {
  production?: boolean;
}) {
  const production =
    options?.production ??
    (process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production");
  const issues: ProductionConfigurationIssue[] = [];
  const configuration = getProductionConfiguration();

  validateSecret("SECURITY_PEPPER", production, issues);

  if (production) {
    validateSecret("CRON_SECRET", true, issues);
    validateSecret("SLICE_SECRET_ENCRYPTION_KEY", true, issues);
  }

  if (clean("BLOB_READ_WRITE_TOKEN")) {
    const signingSecret =
      clean("DOCUMENT_ACCESS_SIGNING_SECRET") ||
      clean("SECURITY_PEPPER") ||
      clean("SLICE_SECRET_ENCRYPTION_KEY") ||
      clean("NEXTAUTH_SECRET");

    if (!signingSecret) {
      issues.push({
        severity: "error",
        key: "DOCUMENT_ACCESS_SIGNING_SECRET",
        message:
          "Private document storage requires DOCUMENT_ACCESS_SIGNING_SECRET or another approved server-only signing secret.",
      });
    }
  }

  if (production && configuration.cspReportOnly) {
    issues.push({
      severity: "warning",
      key: "SECURITY_CSP_REPORT_ONLY",
      message:
        "CSP is report-only in production. Switch to enforcement after reviewing violation reports.",
    });
  }

  if (production && configuration.rateLimitFailOpen) {
    issues.push({
      severity: "warning",
      key: "SECURITY_RATE_LIMIT_FAIL_OPEN",
      message:
        "Distributed rate limiting is configured to fail open. Use this only during a documented incident.",
    });
  }

  const appUrl = clean("APP_URL") || clean("NEXT_PUBLIC_APP_URL");
  if (production && appUrl && !appUrl.startsWith("https://")) {
    issues.push({
      severity: "error",
      key: "APP_URL",
      message: "Production application URLs must use HTTPS.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    production,
    configuration,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}