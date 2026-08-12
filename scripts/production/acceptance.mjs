import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = process.cwd();
const required = [
  ".env.example",
  ".gitignore",
  ".github/workflows/quality.yml",
  "next.config.ts",
  "vercel.json",
  "prisma/schema.prisma",
  "prisma/migrations/20260804120000_production_security_observability/migration.sql",
  "src/middleware.ts",
  "src/instrumentation.ts",
  "src/lib/api-route.ts",
  "src/lib/security.ts",
  "src/lib/security-headers.ts",
  "src/lib/rate-limit.ts",
  "src/lib/production/config.ts",
  "src/lib/production/readiness.ts",
  "src/lib/production/maintenance.ts",
  "src/components/production/web-vitals-reporter.tsx",
  "src/app/layout.tsx",
  "src/app/api/operations/web-vitals/route.ts",
  "src/app/api/operations/production-readiness/route.ts",
  "src/app/api/security/csp-report/route.ts",
  "src/app/api/cron/maintenance/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/register/route.ts",
  "src/app/system/page.tsx",
  "scripts/tests/phase-12-security.test.mjs",
  "scripts/production/smoke.mjs",
  "scripts/production/backup-postgres.mjs",
  "scripts/production/verify-backup.mjs",
  "scripts/production/restore-postgres.mjs",
  "docs/PRODUCTION_RUNBOOK.md",
];
const failures = [];
const warnings = [];

const commandArguments = new Set(process.argv.slice(2));
const productionMode =
  commandArguments.has("--mode=production") ||
  process.env.SLICE_ENV_VALIDATION_MODE === "production" ||
  process.env.VERCEL_ENV === "production";

function environmentValue(key) {
  return String(process.env[key] ?? "").trim();
}

function validateProductionEnvironment() {
  if (!productionMode) return;
  const longSecrets = [
    "CRON_SECRET",
    "SLICE_SECRET_ENCRYPTION_KEY",
    "SECURITY_PEPPER",
  ];
  for (const key of longSecrets) {
    const value = environmentValue(key);
    if (value.length < 32) failures.push(`${key} must contain at least 32 characters in production mode`);
  }
  const appUrl = environmentValue("APP_URL") || environmentValue("NEXT_PUBLIC_APP_URL");
  try {
    if (!appUrl || new URL(appUrl).protocol !== "https:") {
      failures.push("Production APP_URL or NEXT_PUBLIC_APP_URL must use HTTPS");
    }
  } catch {
    failures.push("Production application URL is invalid");
  }
  const sampleRate = Number(environmentValue("NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE") || "0.25");
  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    failures.push("NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE must be between 0 and 1");
  }
}
const read = (path) => readFileSync(resolve(root, path), "utf8");

for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`Missing required file: ${path}`);
}

if (!failures.length) {
  let packageJson;
  try {
    packageJson = JSON.parse(read("package.json"));
  } catch (error) {
    failures.push(`package.json is invalid: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  for (const script of [
    "validate:phase12",
    "test:phase12",
    "test:smoke",
    "backup:database",
    "verify:backup",
    "restore:database",
  ]) {
    if (!packageJson?.scripts?.[script]) failures.push(`package.json is missing ${script}`);
  }

  const schema = read("prisma/schema.prisma");
  for (const model of ["SecurityRateLimitBucket", "WebVitalSample"]) {
    if (!schema.includes(`model ${model} {`)) failures.push(`Prisma schema is missing ${model}`);
  }

  const migration = read(
    "prisma/migrations/20260804120000_production_security_observability/migration.sql",
  );
  for (const forbidden of ["DROP TABLE", "TRUNCATE", "DELETE FROM \"AuditLog\""]) {
    if (migration.toUpperCase().includes(forbidden.toUpperCase())) {
      failures.push(`Phase 12 migration contains forbidden SQL: ${forbidden}`);
    }
  }

  const apiRoute = read("src/lib/api-route.ts");
  if (!/export\s+(?:class|const)\s+ApiError\b/.test(apiRoute)) {
    failures.push("api-route.ts is missing the exported ApiError contract");
  }
  for (const signature of ["export function apiJson", "export function withApiRoute"]) {
    if (!apiRoute.includes(signature)) failures.push(`api-route.ts is missing ${signature}`);
  }

  const nextConfig = read("next.config.ts");
  if (!nextConfig.includes("staticSecurityHeaders")) failures.push("next.config.ts must use the shared security-header source");
  if (nextConfig.includes('key: "Content-Security-Policy"')) failures.push("next.config.ts must not create a second CSP");

  const middleware = read("src/middleware.ts");
  for (const signature of [
    "slice_client_portal_session",
    "/api/documents/upload",
    "/api/operations/web-vitals",
    "securityHeadersForRequest",
  ]) {
    if (!middleware.includes(signature)) failures.push(`Middleware is missing ${signature}`);
  }
  if (middleware.includes('/api/personal-bot/pdf-report')) failures.push("Personal-bot PDF route must not be globally public");
  if (middleware.includes('"/api/intelligence/scan"')) failures.push("Authenticated intelligence scans must not be globally public");

  const rootLayout = read("src/app/layout.tsx");
  if (!rootLayout.includes("WebVitalsReporter")) failures.push("Root layout does not mount WebVitalsReporter");

  const systemPage = read("src/app/system/page.tsx");
  for (const destructive of ["runSeed", "runReset", "/api/system/seed", "/api/system/reset"]) {
    if (systemPage.includes(destructive)) failures.push(`Production operations page contains ${destructive}`);
  }

  const vercel = JSON.parse(read("vercel.json"));
  if (!vercel.crons?.some((cron) => String(cron.path).startsWith("/api/cron/maintenance"))) {
    failures.push("vercel.json is missing production maintenance cron");
  }

  const gitignore = read(".gitignore");
  for (const rule of ["/backups/", "/.artifacts/", "*.dump"]) {
    if (!gitignore.includes(rule)) failures.push(`.gitignore is missing ${rule}`);
  }

  const envExample = read(".env.example");
  for (const variable of [
    "SECURITY_PEPPER",
    "NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE",
    "WEB_VITALS_RETENTION_DAYS",
    "DATABASE_RESTORE_URL",
  ]) {
    if (!envExample.includes(variable)) failures.push(`.env.example is missing ${variable}`);
  }

  const workflow = read(".github/workflows/quality.yml");
  for (const command of [
    "npm run test:phase12",
    "npm run test:smoke",
    "npm run backup:database",
    "npm run restore:database",
  ]) {
    if (!workflow.includes(command)) failures.push(`CI workflow is missing ${command}`);
  }
}

function walk(directory) {
  const output = [];
  if (!existsSync(directory)) return output;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) output.push(...walk(path));
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) output.push(path);
  }
  return output;
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{24,}\b/g,
  /\bre_[A-Za-z0-9_-]{24,}\b/g,
  /\bAC[a-f0-9]{32}\b/gi,
  /\bghp_[A-Za-z0-9]{30,}\b/g,
];
for (const file of walk(resolve(root, "src"))) {
  const content = readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) failures.push(`Potential committed credential in ${file.slice(root.length + 1)}`);
    pattern.lastIndex = 0;
  }
  if (/prisma\s+as\s+any/.test(content)) warnings.push(`Avoidable Prisma any cast remains in ${file.slice(root.length + 1)}`);
}

validateProductionEnvironment();

if (failures.length) {
  process.stderr.write(`Phase 12 acceptance failed:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  if (warnings.length) process.stderr.write(`Warnings:\n${warnings.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({ ok: true, phase: "12-production-acceptance", checkedFiles: required.length, warnings: warnings.slice(0, 50), checkedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}