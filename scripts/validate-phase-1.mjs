import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  ".env.example",
  ".github/workflows/quality.yml",
  ".gitignore",
  ".nvmrc",
  "README.md",
  "docs/PHASE_1_STABILITY.md",
  "scripts/validate-env.mjs",
  "src/instrumentation.ts",
  "src/lib/logger.ts",
  "src/lib/api-route.ts",
  "src/lib/health.ts",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
  "src/app/api/health/route.ts",
  "src/app/api/health/live/route.ts",
  "src/app/api/health/ready/route.ts",
  "src/app/api/system/health/route.ts",
  "src/components/system-state-screen.tsx",
];

const failures = [];

function absolutePath(relativePath) {
  return resolve(process.cwd(), relativePath);
}

function fileExists(relativePath) {
  return existsSync(absolutePath(relativePath));
}

function readFile(relativePath) {
  return readFileSync(
    absolutePath(relativePath),
    "utf8",
  );
}

/*
 * Verify every required Phase 1 foundation file.
 */
for (const relativePath of requiredFiles) {
  if (!fileExists(relativePath)) {
    failures.push(
      `Missing required Phase 1 file: ${relativePath}`,
    );
  }
}

/*
 * Run content-level validation only after all required files exist.
 * This keeps missing-file errors clear and actionable.
 */
if (failures.length === 0) {
  const gitignore = readFile(".gitignore");
  const globalError = readFile(
    "src/app/global-error.tsx",
  );
  const legacyHealthRoute = readFile(
    "src/app/api/system/health/route.ts",
  );
  const logger = readFile("src/lib/logger.ts");

  let packageJson = null;

  try {
    packageJson = JSON.parse(
      readFile("package.json"),
    );
  } catch (error) {
    failures.push(
      `package.json could not be parsed as valid JSON: ${
        error instanceof Error
          ? error.message
          : "Unknown JSON parsing error"
      }`,
    );
  }

  /*
   * Confirm malformed shell transcript content was removed from
   * the repository's .gitignore file.
   */
  const invalidGitignoreArtifacts = [
    '@"',
    "Add-Content",
    "/$null",
    '"@ |',
  ];

  for (const artifact of invalidGitignoreArtifacts) {
    if (gitignore.includes(artifact)) {
      failures.push(
        `.gitignore still contains accidental shell text: ${artifact}`,
      );
    }
  }

  /*
   * Confirm the required package scripts exist.
   */
  if (packageJson) {
    const requiredPackageScripts = [
      "typecheck",
      "validate:env",
      "validate:phase1",
      "db:validate",
      "quality",
      "validate",
    ];

    for (const scriptName of requiredPackageScripts) {
      if (!packageJson.scripts?.[scriptName]) {
        failures.push(
          `package.json is missing the "${scriptName}" script.`,
        );
      }
    }
  }

  /*
   * A Next.js global error boundary replaces the root layout,
   * so it must render its own html and body elements.
   */
  if (
    !globalError.includes("<html") ||
    !globalError.includes("<body")
  ) {
    failures.push(
      "src/app/global-error.tsx must include its own <html> and <body> elements.",
    );
  }

  /*
   * The public compatibility health route must not perform
   * full-table counts or expose operational dataset sizes.
   */
  if (legacyHealthRoute.includes(".count(")) {
    failures.push(
      "src/app/api/system/health/route.ts must not expose database table counts.",
    );
  }

  /*
   * The compatibility health route must not send raw internal
   * exception messages to unauthenticated callers.
   */
  if (
    /error\.message|detail:\s*message/.test(
      legacyHealthRoute,
    )
  ) {
    failures.push(
      "src/app/api/system/health/route.ts must not expose raw server errors.",
    );
  }

  /*
   * Ensure structured logging continues to redact sensitive data.
   */
  if (!logger.includes("[REDACTED]")) {
    failures.push(
      "src/lib/logger.ts must retain sensitive-value redaction.",
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(
    [
      "Phase 1 validation failed:",
      ...failures.map(
        (failure) => `- ${failure}`,
      ),
      "",
    ].join("\n"),
  );

  process.exitCode = 1;
} else {
  const result = {
    ok: true,
    phase: "1-stability-baseline",
    checkedFiles: requiredFiles.length,
    checkedAt: new Date().toISOString(),
  };

  process.stdout.write(
    `${JSON.stringify(result, null, 2)}\n`,
  );
}