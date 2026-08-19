import {
  execFileSync,
  spawnSync,
} from "node:child_process";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";

import {
  dirname,
  join,
  relative,
  resolve,
} from "node:path";

import {
  fileURLToPath,
} from "node:url";

const scriptDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const root =
  resolve(
    scriptDirectory,
    "..",
  );

const artifactsDirectory =
  join(
    root,
    "artifacts",
  );

const reportPath =
  join(
    artifactsDirectory,
    "intelligence-final-validation.json",
  );

const skipAudit =
  process.argv.includes(
    "--skip-audit",
  );

const results = [];

function now() {
  return new Date().toISOString();
}

function addResult(input) {
  results.push({
    checkedAt:
      now(),

    ...input,
  });
}

function runCommand(
  name,
  command,
) {
  const startedAt =
    Date.now();

  const result =
    spawnSync(
      command,
      {
        cwd:
          root,

        shell:
          true,

        encoding:
          "utf8",

        env: {
          ...process.env,

          NEXT_TELEMETRY_DISABLED:
            "1",
        },

        maxBuffer:
          20 *
          1024 *
          1024,
      },
    );

  const durationMs =
    Date.now() -
    startedAt;

  const passed =
    result.status ===
    0;

  addResult({
    name,

    category:
      "command",

    passed,

    durationMs,

    command,

    exitCode:
      result.status,

    stdout:
      String(
        result.stdout ??
        "",
      ).slice(
        -20_000,
      ),

    stderr:
      String(
        result.stderr ??
        "",
      ).slice(
        -20_000,
      ),
  });

  process.stdout.write(
    `\n[${passed ? "PASS" : "FAIL"}] ${name} (${durationMs}ms)\n`,
  );

  if (
    result.stdout
  ) {
    process.stdout.write(
      String(
        result.stdout,
      ),
    );
  }

  if (
    result.stderr
  ) {
    process.stderr.write(
      String(
        result.stderr,
      ),
    );
  }

  return passed;
}

function walkFiles(
  directory,
  output = [],
) {
  if (
    !existsSync(
      directory,
    )
  ) {
    return output;
  }

  for (
    const name of
      readdirSync(
        directory,
      )
  ) {
    const absolute =
      join(
        directory,
        name,
      );

    const stats =
      statSync(
        absolute,
      );

    if (
      stats.isDirectory()
    ) {
      if (
        [
          "node_modules",
          ".next",
          ".git",
          "artifacts",
          ".venv",
        ].includes(
          name,
        )
      ) {
        continue;
      }

      walkFiles(
        absolute,
        output,
      );

      continue;
    }

    output.push(
      absolute,
    );
  }

  return output;
}

function validateRequiredFiles() {
  const required = [
    "src/lib/intelligence-forecast/engine.ts",
    "src/lib/intelligence-forecast/settlement.ts",
    "src/lib/intelligence-forecast/model-governance.ts",
    "src/lib/intelligence-forecast/point-in-time-warehouse.ts",
    "src/lib/intelligence-forecast/provenance-graph.ts",
    "src/lib/intelligence-forecast/horizon-models.ts",
    "src/lib/intelligence-forecast/agent-simulation.ts",
    "src/lib/intelligence-forecast/ensemble-optimization.ts",
    "src/lib/intelligence-forecast/advisor-bot.ts",
    "src/lib/intelligence-forecast/production-controls.ts",
    "src/lib/intelligence-forecast/launch-readiness.ts",
    "src/app/api/intelligence/forecast/route.ts",
    "src/app/api/intelligence/advisor-bot/route.ts",
    "src/app/api/intelligence/production-controls/route.ts",
    "src/app/api/intelligence/launch-readiness/route.ts",
    "vercel.json",
    "prisma/schema.prisma",
  ];

  const missing =
    required.filter(
      (path) =>
        !existsSync(
          join(
            root,
            path,
          ),
        ),
    );

  addResult({
    name:
      "Required intelligence files",

    category:
      "static",

    passed:
      missing.length ===
      0,

    missing,
  });
}

function validateVercelConfiguration() {
  try {
    const parsed =
      JSON.parse(
        readFileSync(
          join(
            root,
            "vercel.json",
          ),
          "utf8",
        ),
      );

    const crons =
      Array.isArray(
        parsed.crons,
      )
        ? parsed.crons
        : [];

    const paths =
      crons.map(
        (cron) =>
          String(
            cron.path ??
            "",
          ),
      );

    const duplicatePaths =
      paths.filter(
        (
          path,
          index,
        ) =>
          paths.indexOf(
            path,
          ) !==
          index,
      );

    const missingSchedules =
      crons.filter(
        (cron) =>
          !cron.path ||
          !cron.schedule,
      );

    addResult({
      name:
        "Vercel cron configuration",

      category:
        "static",

      passed:
        duplicatePaths.length ===
          0 &&
        missingSchedules.length ===
          0,

      cronCount:
        crons.length,

      duplicatePaths,

      missingScheduleCount:
        missingSchedules.length,
    });
  } catch (error) {
    addResult({
      name:
        "Vercel cron configuration",

      category:
        "static",

      passed:
        false,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

function validateTrackedEnvironmentFiles() {
  try {
    const output =
      execFileSync(
        "git",
        [
          "ls-files",
          ".env",
          ".env.*",
        ],
        {
          cwd:
            root,

          encoding:
            "utf8",
        },
      );

    const tracked =
      output
        .split(
          /\r?\n/,
        )
        .map(
          (value) =>
            value.trim(),
        )
        .filter(
          Boolean,
        )
        .filter(
          (value) =>
            !value.endsWith(
              ".example",
            ),
        );

    addResult({
      name:
        "Tracked environment-secret files",

      category:
        "security",

      passed:
        tracked.length ===
        0,

      tracked,
    });
  } catch (error) {
    addResult({
      name:
        "Tracked environment-secret files",

      category:
        "security",

      passed:
        false,

      error:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

function validatePublicSecretNames() {
  const roots = [
    join(
      root,
      "src",
    ),
    join(
      root,
      "services",
    ),
  ];

  const files =
    roots.flatMap(
      (directory) =>
        walkFiles(
          directory,
        ),
    );

  const pattern =
    /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|PASSWORD|PRIVATE|TOKEN|API_KEY|ACCESS_KEY)/g;

  const findings = [];

  for (
    const file of
      files
  ) {
    const extension =
      file
        .split(
          ".",
        )
        .pop()
        ?.toLowerCase();

    if (
      ![
        "ts",
        "tsx",
        "js",
        "jsx",
        "mjs",
        "cjs",
        "py",
        "json",
      ].includes(
        extension ??
        "",
      )
    ) {
      continue;
    }

    const content =
      readFileSync(
        file,
        "utf8",
      );

    const matches =
      content.match(
        pattern,
      );

    if (
      matches?.length
    ) {
      findings.push({
        file:
          relative(
            root,
            file,
          ),

        names:
          Array.from(
            new Set(
              matches,
            ),
          ),
      });
    }
  }

  addResult({
    name:
      "Public secret-name scan",

    category:
      "security",

    passed:
      findings.length ===
      0,

    findings,
  });
}

function validateEnvironmentPresence() {
  const requiredNames = [
    "DATABASE_URL",
    "CRON_SECRET",
    "CAMEL_AI_SERVICE_URL",
    "CAMEL_AI_SERVICE_TOKEN",
    "INTELLIGENCE_LOG_SALT",
  ];

  const optionalNames = [
    "OPENAI_API_KEY",
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
    "ALPHA_VANTAGE_API_KEY",
    "FINNHUB_API_KEY",
    "TWELVE_DATA_API_KEY",
  ];

  const missingRequired =
    requiredNames.filter(
      (name) =>
        !String(
          process.env[
            name
          ] ??
          "",
        ).trim(),
    );

  const configuredOptional =
    optionalNames.filter(
      (name) =>
        Boolean(
          String(
            process.env[
              name
            ] ??
            "",
          ).trim(),
        ),
    );

  addResult({
    name:
      "Environment variable presence",

    category:
      "configuration",

    passed:
      missingRequired.length ===
      0,

    missingRequired,

    configuredOptional,

    valuesExposed:
      false,
  });
}

function writeReport() {
  mkdirSync(
    artifactsDirectory,
    {
      recursive:
        true,
    },
  );

  const failed =
    results.filter(
      (result) =>
        !result.passed,
    );

  const report = {
    schemaVersion:
      "slice-intelligence-final-validation-1.0.0",

    generatedAt:
      now(),

    root,

    skipAudit,

    passed:
      failed.length ===
      0,

    resultCount:
      results.length,

    passedCount:
      results.length -
      failed.length,

    failedCount:
      failed.length,

    results,

    safeguards: {
      secretsIncluded:
        false,

      autonomousTradingEnabled:
        false,

      moneyMovementEnabled:
        false,
    },
  };

  writeFileSync(
    reportPath,
    `${JSON.stringify(
      report,
      null,
      2,
    )}\n`,
    "utf8",
  );

  return report;
}

console.log(
  "Slice Intelligence final validation",
);

console.log(
  `Project root: ${root}`,
);

validateRequiredFiles();
validateVercelConfiguration();
validateTrackedEnvironmentFiles();
validatePublicSecretNames();
validateEnvironmentPresence();

runCommand(
  "Prisma schema validation",
  "npx prisma validate",
);

runCommand(
  "Prisma client generation",
  "npx prisma generate",
);

runCommand(
  "TypeScript validation",
  "npx tsc --noEmit",
);

runCommand(
  "Production build",
  "npm run build",
);

if (!skipAudit) {
  runCommand(
    "Production dependency audit",
    "npx --yes npm@10.9.8 run audit:production",
  );
}

const report =
  writeReport();

console.log(
  `\nValidation report: ${reportPath}`,
);

console.log(
  `Passed: ${report.passedCount}`,
);

console.log(
  `Failed: ${report.failedCount}`,
);

process.exit(
  report.passed
    ? 0
    : 1,
);