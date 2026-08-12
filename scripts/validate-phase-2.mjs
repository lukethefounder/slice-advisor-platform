import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "src/lib/access-control.ts",
  "src/lib/client-access.ts",
  "src/lib/client-portal-auth.ts",
  "src/app/api/auth/me/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/advisor-routing/route.ts",
  "src/app/api/client-portal/access/route.ts",
  "src/app/api/client-portal/routing/route.ts",
  "scripts/validate-phase-2.mjs",
  "docs/PHASE_2_ACCESS_CONTROL.md",
];

const failures = [];

function pathFor(relativePath) {
  return resolve(process.cwd(), relativePath);
}

function read(relativePath) {
  return readFileSync(pathFor(relativePath), "utf8");
}

/**
 * Converts Windows CRLF and older CR line endings to standard LF,
 * then collapses formatting whitespace for resilient source checks.
 *
 * This prevents valid TypeScript from failing validation only because
 * it was saved on Windows instead of macOS or Linux.
 */
function compact(source) {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Runs a source-code regular expression after normalizing line endings.
 */
function containsPattern(source, pattern) {
  return pattern.test(
    source.replace(/\r\n?/g, "\n"),
  );
}

/**
 * Confirm that all required Phase 2 files exist before attempting
 * content-level validation.
 */
for (const relativePath of requiredFiles) {
  if (!existsSync(pathFor(relativePath))) {
    failures.push(
      `Missing required Phase 2 file: ${relativePath}`,
    );
  }
}

if (!failures.length) {
  let packageJson;

  try {
    packageJson = JSON.parse(
      read("package.json"),
    );
  } catch (error) {
    failures.push(
      `package.json is invalid JSON: ${
        error instanceof Error
          ? error.message
          : "Unknown JSON error"
      }`,
    );
  }

  const accessControl = read(
    "src/lib/access-control.ts",
  );

  const clientAccess = read(
    "src/lib/client-access.ts",
  );

  const portalAuth = read(
    "src/lib/client-portal-auth.ts",
  );

  const loginRoute = read(
    "src/app/api/auth/login/route.ts",
  );

  const meRoute = read(
    "src/app/api/auth/me/route.ts",
  );

  const logoutRoute = read(
    "src/app/api/auth/logout/route.ts",
  );

  const advisorRouting = read(
    "src/app/api/advisor-routing/route.ts",
  );

  const portalAccess = read(
    "src/app/api/client-portal/access/route.ts",
  );

  const portalRouting = read(
    "src/app/api/client-portal/routing/route.ts",
  );

  const accessControlCompact = compact(
    accessControl,
  );

  const clientAccessCompact = compact(
    clientAccess,
  );

  const portalAuthCompact = compact(
    portalAuth,
  );

  const loginRouteCompact = compact(
    loginRoute,
  );

  const meRouteCompact = compact(
    meRoute,
  );

  const logoutRouteCompact = compact(
    logoutRoute,
  );

  const advisorRoutingCompact = compact(
    advisorRouting,
  );

  const portalAccessCompact = compact(
    portalAccess,
  );

  const portalRoutingCompact = compact(
    portalRouting,
  );

  /**
   * Package command validation.
   */
  if (
    packageJson &&
    !packageJson.scripts?.["validate:phase2"]
  ) {
    failures.push(
      'package.json is missing the "validate:phase2" script.',
    );
  }

  /**
   * Central access-control validation.
   */
  if (
    !accessControlCompact.includes(
      "clientScopeWhere",
    )
  ) {
    failures.push(
      "access-control.ts must define firm-scoped client filtering.",
    );
  }

  if (
    !accessControlCompact.includes(
      "inboxScopeWhere",
    )
  ) {
    failures.push(
      "access-control.ts must define firm-scoped inbox filtering.",
    );
  }

  if (
    !accessControlCompact.includes(
      "hasFirmPermission",
    )
  ) {
    failures.push(
      "access-control.ts must enforce explicit permissions.",
    );
  }

  /**
   * Client-access validation.
   */
  if (
    /prisma\s+as\s+any/.test(
      clientAccess,
    )
  ) {
    failures.push(
      "client-access.ts must not cast the Prisma client to any.",
    );
  }

  if (
    !clientAccessCompact.includes(
      "firmId: membership.firmId",
    )
  ) {
    failures.push(
      "client-access.ts must retain firm-scoped client ownership.",
    );
  }

  /**
   * Client portal authorization validation.
   *
   * This regex is intentionally tolerant of:
   * - Windows CRLF line endings
   * - Unix LF line endings
   * - indentation differences
   * - single or double quotes
   * - formatting performed by Prettier
   */
  const validatesActiveFirm =
    containsPattern(
      portalAuth,
      /firm\s*:\s*\{\s*platformStatus\s*:\s*["']Active["']/m,
    );

  if (!validatesActiveFirm) {
    failures.push(
      "client-portal-auth.ts must validate active firm status.",
    );
  }

  /**
   * Confirm that the advisor membership itself must be active
   * before the nested active-firm check can grant portal access.
   */
  const validatesActiveAdvisorMembership =
    containsPattern(
      portalAuth,
      /status\s*:\s*["']Active["'][\s\S]*?firm\s*:\s*\{\s*platformStatus\s*:\s*["']Active["']/m,
    );

  if (
    !validatesActiveAdvisorMembership
  ) {
    failures.push(
      "client-portal-auth.ts must validate an active advisor membership before granting portal access.",
    );
  }

  if (
    !portalAuthCompact.includes(
      "assignedAdvisorMembershipId",
    )
  ) {
    failures.push(
      "client-portal-auth.ts must validate advisor assignment.",
    );
  }

  /**
   * Login route validation.
   */
  if (
    /Login failed:\s*\$\{\s*error\.message\s*\}/.test(
      loginRoute,
    )
  ) {
    failures.push(
      "The login route must not return raw exception messages.",
    );
  }

  if (
    !loginRouteCompact.includes(
      "withApiRoute",
    )
  ) {
    failures.push(
      "The login route must use Phase 1 request instrumentation.",
    );
  }

  /**
   * Logout route validation.
   */
  if (
    !logoutRouteCompact.includes(
      "hashSessionToken",
    )
  ) {
    failures.push(
      "The logout route must revoke the active database session.",
    );
  }

  /**
   * Current-user route validation.
   */
  if (
    !meRouteCompact.includes(
      "publicAccessContext",
    )
  ) {
    failures.push(
      "The current-user route must return safe access context.",
    );
  }

  /**
   * Advisor routing validation.
   */
  if (
    !advisorRoutingCompact.includes(
      "canSuperviseInbox",
    )
  ) {
    failures.push(
      "Advisor routing must enforce supervised inbox access.",
    );
  }

  if (
    !advisorRoutingCompact.includes(
      "firmId: membership.firmId",
    )
  ) {
    failures.push(
      "Advisor routing must enforce firm-scoped writes.",
    );
  }

  /**
   * Client portal access validation.
   */
  if (
    !portalAccessCompact.includes(
      "createClientPortalSession",
    )
  ) {
    failures.push(
      "Client portal access must use validated session creation.",
    );
  }

  /**
   * Client portal routing and idempotency validation.
   */
  if (
    !portalRoutingCompact.includes(
      "clientEventKey",
    )
  ) {
    failures.push(
      "Client portal routing must derive server-scoped event keys.",
    );
  }

  if (
    !containsPattern(
      portalRouting,
      /existing\.clientId\s*!==\s*current\.client\.id/,
    )
  ) {
    failures.push(
      "Client portal routing must reject cross-client idempotency collisions.",
    );
  }
}

/**
 * Print a clear failure list or a machine-readable success response.
 */
if (failures.length) {
  process.stderr.write(
    `Phase 2 validation failed:\n${failures
      .map(
        (failure) =>
          `- ${failure}`,
      )
      .join("\n")}\n`,
  );

  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        phase:
          "2-access-control-and-firm-isolation",
        checkedFiles:
          requiredFiles.length,
        checkedAt:
          new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}