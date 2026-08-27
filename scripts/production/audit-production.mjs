import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJsonPath = resolve(root, "package.json");
const packageLockPath = resolve(root, "package-lock.json");

const KNOWN_UPSTREAM_ADVISORY =
  "https://github.com/advisories/GHSA-ggr8-5vv4-36mx";

const KNOWN_UPSTREAM_CHAIN = new Set([
  "deepmerge-ts",
  "@prisma/config",
  "prisma",
]);

const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} could not be read: ${
        error instanceof Error
          ? error.message
          : "unknown error"
      }`,
    );
  }
}

function parseAuditJson(text) {
  const raw = String(text ?? "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start < 0 || end < start) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function runNpmAudit() {
  const auditArguments = [
    "audit",
    "--omit=dev",
    "--audit-level=high",
    "--json",
  ];

  const options = {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  };

  let result;

  /*
   * When this script runs through npm, npm_execpath points to the exact npm
   * CLI that started the script. This keeps local validation and GitHub
   * Actions on the same npm version.
   */
  if (process.env.npm_execpath) {
    result = spawnSync(
      process.execPath,
      [
        process.env.npm_execpath,
        ...auditArguments,
      ],
      options,
    );
  } else if (process.platform === "win32") {
    result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `npm ${auditArguments.join(" ")}`,
      ],
      options,
    );
  } else {
    result = spawnSync(
      "npm",
      auditArguments,
      options,
    );
  }

  if (result.error) {
    throw new Error(
      `npm audit could not start: ${result.error.message}`,
    );
  }

  const stdout = String(
    result.stdout ?? "",
  ).trim();

  const stderr = String(
    result.stderr ?? "",
  ).trim();

  const report =
    parseAuditJson(stdout) ??
    parseAuditJson(stderr) ??
    parseAuditJson(
      `${stdout}\n${stderr}`,
    );

  if (!report) {
    throw new Error(
      [
        "npm audit did not return a readable JSON report.",
        stderr,
        stdout,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (report.error) {
    const detail =
      typeof report.error === "string"
        ? report.error
        : JSON.stringify(
            report.error,
          );

    throw new Error(
      `npm audit registry request failed: ${detail}`,
    );
  }

  return {
    report,
    exitStatus: result.status ?? 1,
    stderr,
  };
}

function severityAtLeastHigh(value) {
  const severity = String(
    value ?? "",
  ).toLowerCase();

  return (
    (SEVERITY_RANK[severity] ?? -1) >=
    SEVERITY_RANK.high
  );
}

function isKnownAdvisoryReference(value) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const url = String(
    value.url ?? "",
  );

  const source = String(
    value.source ?? "",
  );

  const title = String(
    value.title ?? "",
  ).toLowerCase();

  const dependency = String(
    value.dependency ??
      value.name ??
      "",
  );

  return (
    dependency === "deepmerge-ts" &&
    (
      url ===
        KNOWN_UPSTREAM_ADVISORY ||
      url.endsWith(
        "GHSA-ggr8-5vv4-36mx",
      ) ||
      source ===
        "GHSA-ggr8-5vv4-36mx" ||
      title.includes(
        "stack exhaustion",
      )
    )
  );
}

function hasOnlyKnownViaEntries(
  vulnerability,
) {
  if (
    !Array.isArray(
      vulnerability?.via,
    ) ||
    !vulnerability.via.length
  ) {
    return false;
  }

  return vulnerability.via.every(
    (entry) => {
      if (
        typeof entry === "string"
      ) {
        return KNOWN_UPSTREAM_CHAIN.has(
          entry,
        );
      }

      return isKnownAdvisoryReference(
        entry,
      );
    },
  );
}

function hasOnlyKnownEffects(
  vulnerability,
) {
  if (
    !Array.isArray(
      vulnerability?.effects,
    )
  ) {
    return true;
  }

  return vulnerability.effects.every(
    (effect) =>
      KNOWN_UPSTREAM_CHAIN.has(
        String(effect),
      ),
  );
}

function packageMajor(value) {
  const match = String(
    value ?? "",
  ).match(/\d+/);

  return match
    ? Number(match[0])
    : Number.NaN;
}

function lockEntryIsDevelopmentOnly(
  entry,
) {
  return Boolean(
    entry &&
      (
        entry.dev === true ||
        entry.devOptional === true
      ),
  );
}

function isDevelopmentOnlyPrismaChain(
  packageJson,
  packageLock,
) {
  const rootDependencies =
    packageJson.dependencies ?? {};

  const rootDevDependencies =
    packageJson.devDependencies ?? {};

  const lockPackages =
    packageLock.packages ?? {};

  const prismaLock =
    lockPackages[
      "node_modules/prisma"
    ];

  const configLock =
    lockPackages[
      "node_modules/@prisma/config"
    ];

  const deepmergeLock =
    lockPackages[
      "node_modules/deepmerge-ts"
    ];

  const prismaDeclaredOnlyForDevelopment =
    Boolean(
      rootDevDependencies.prisma,
    ) &&
    !rootDependencies.prisma;

  const prismaMajor =
    packageMajor(
      rootDevDependencies.prisma,
    );

  const deepmergeMajor =
    packageMajor(
      deepmergeLock?.version,
    );

  const vulnerableChainIsNotDirectlyInstalled =
    !rootDependencies[
      "deepmerge-ts"
    ] &&
    !rootDependencies[
      "@prisma/config"
    ];

  return (
    prismaDeclaredOnlyForDevelopment &&
    prismaMajor === 7 &&
    Number.isFinite(
      deepmergeMajor,
    ) &&
    deepmergeMajor < 8 &&
    vulnerableChainIsNotDirectlyInstalled &&
    lockEntryIsDevelopmentOnly(
      prismaLock,
    ) &&
    lockEntryIsDevelopmentOnly(
      configLock,
    ) &&
    lockEntryIsDevelopmentOnly(
      deepmergeLock,
    )
  );
}

function compactVulnerability(
  name,
  vulnerability,
) {
  return {
    name,
    severity:
      vulnerability?.severity ??
      "unknown",
    direct: Boolean(
      vulnerability?.isDirect,
    ),
    range:
      vulnerability?.range ??
      "unknown",
    nodes: Array.isArray(
      vulnerability?.nodes,
    )
      ? vulnerability.nodes.slice(
          0,
          8,
        )
      : [],
    via: Array.isArray(
      vulnerability?.via,
    )
      ? vulnerability.via.map(
          (entry) =>
            typeof entry === "string"
              ? entry
              : {
                  source:
                    entry?.source,
                  title:
                    entry?.title,
                  url: entry?.url,
                  dependency:
                    entry?.dependency ??
                    entry?.name,
                },
        )
      : [],
  };
}

function writeSuccess(body) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        test:
          "production-dependency-audit",
        ...body,
      },
      null,
      2,
    )}\n`,
  );
}

function writeFailure(body) {
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        test:
          "production-dependency-audit",
        ...body,
      },
      null,
      2,
    )}\n`,
  );
}

function main() {
  const packageJson = readJson(
    packageJsonPath,
    "package.json",
  );

  const packageLock = readJson(
    packageLockPath,
    "package-lock.json",
  );

  const {
    report,
    exitStatus,
    stderr,
  } = runNpmAudit();

  const vulnerabilities =
    report?.vulnerabilities &&
    typeof report.vulnerabilities ===
      "object"
      ? report.vulnerabilities
      : {};

  const blocking = Object.entries(
    vulnerabilities,
  ).filter(
    ([, vulnerability]) =>
      severityAtLeastHigh(
        vulnerability?.severity,
      ),
  );

  /*
   * A non-zero npm exit without a corresponding high/critical finding is
   * treated as an audit execution failure, not as a clean report.
   */
  if (
    !blocking.length &&
    exitStatus !== 0
  ) {
    throw new Error(
      [
        `npm audit exited with status ${exitStatus} without a readable high or critical vulnerability.`,
        stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (!blocking.length) {
    writeSuccess({
      blockingHighOrCritical: 0,
      metadata:
        report?.metadata
          ?.vulnerabilities ?? {},
    });

    return;
  }

  const directDeepmergeAdvisoryPresent =
    blocking.some(
      ([name, vulnerability]) =>
        name === "deepmerge-ts" &&
        Array.isArray(
          vulnerability?.via,
        ) &&
        vulnerability.via.some(
          isKnownAdvisoryReference,
        ),
    );

  const onlyKnownNames =
    blocking.every(([name]) =>
      KNOWN_UPSTREAM_CHAIN.has(
        name,
      ),
    );

  const onlyKnownPaths =
    blocking.every(
      ([, vulnerability]) =>
        hasOnlyKnownViaEntries(
          vulnerability,
        ),
    );

  const onlyKnownEffects =
    blocking.every(
      ([, vulnerability]) =>
        hasOnlyKnownEffects(
          vulnerability,
        ),
    );

  const developmentOnly =
    isDevelopmentOnlyPrismaChain(
      packageJson,
      packageLock,
    );

  const acceptedUpstreamDevelopmentFinding =
    directDeepmergeAdvisoryPresent &&
    onlyKnownNames &&
    onlyKnownPaths &&
    onlyKnownEffects &&
    developmentOnly;

  if (
    acceptedUpstreamDevelopmentFinding
  ) {
    writeSuccess({
      blockingHighOrCritical: 0,
      acknowledgedDevelopmentOnlyFinding:
        {
          advisory:
            KNOWN_UPSTREAM_ADVISORY,
          chain: [
            ...KNOWN_UPSTREAM_CHAIN,
          ],
          reason:
            "The finding is confined to Prisma's development-only CLI/config chain. Prisma is not a production dependency, the affected lockfile entries are marked development-only or development-optional, and npm's automatic remediation would perform a breaking Prisma 7-to-6 downgrade. Any other high or critical finding remains blocking.",
        },
      metadata:
        report?.metadata
          ?.vulnerabilities ?? {},
    });

    if (stderr) {
      process.stderr.write(
        `${stderr}\n`,
      );
    }

    return;
  }

  writeFailure({
    npmAuditExitStatus:
      exitStatus,
    blockingHighOrCritical:
      blocking.map(
        ([name, vulnerability]) =>
          compactVulnerability(
            name,
            vulnerability,
          ),
      ),
    metadata:
      report?.metadata
        ?.vulnerabilities ?? {},
  });

  if (stderr) {
    process.stderr.write(
      `${stderr}\n`,
    );
  }

  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  writeFailure({
    error:
      error instanceof Error
        ? error.message
        : String(error),
  });

  process.exitCode = 1;
}