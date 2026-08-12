import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "src/lib/pagination.ts",
  "src/lib/clients/contracts.ts",
  "src/lib/clients/repository.ts",
  "src/lib/clients/mutations.ts",
  "src/app/api/clients/route.ts",
  "src/app/api/clients/[id]/route.ts",
  "src/app/api/clients/[id]/sections/[section]/route.ts",
  "scripts/validate-phase-4.mjs",
  "scripts/tests/phase-4-pagination.test.mjs",
  "docs/PHASE_4_DATA_ACCESS.md",
];

const failures = [];

function pathFor(relativePath) {
  return resolve(process.cwd(), relativePath);
}

function read(relativePath) {
  return readFileSync(pathFor(relativePath), "utf8").replace(/\r\n?/g, "\n");
}

function requirePattern(source, pattern, failure) {
  if (!pattern.test(source)) failures.push(failure);
}

for (const file of requiredFiles) {
  if (!existsSync(pathFor(file))) {
    failures.push(`Missing required Phase 4 file: ${file}`);
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

  const pagination = read("src/lib/pagination.ts");
  const repository = read("src/lib/clients/repository.ts");
  const mutations = read("src/lib/clients/mutations.ts");
  const clientsRoute = read("src/app/api/clients/route.ts");
  const clientRoute = read("src/app/api/clients/[id]/route.ts");
  const sectionRoute = read(
    "src/app/api/clients/[id]/sections/[section]/route.ts",
  );

  if (packageJson && !packageJson.scripts?.["validate:phase4"]) {
    failures.push('package.json is missing the "validate:phase4" script.');
  }

  if (
    packageJson &&
    !String(packageJson.scripts?.quality ?? "").includes("validate:phase4")
  ) {
    failures.push("The quality script must include Phase 4 validation.");
  }

  if (packageJson && !packageJson.scripts?.["test:phase4"]) {
    failures.push('package.json is missing the "test:phase4" script.');
  }

  if (
    packageJson &&
    !String(packageJson.scripts?.quality ?? "").includes("test:phase4")
  ) {
    failures.push("The quality script must include the Phase 4 pagination contract test.");
  }

  requirePattern(
    pagination,
    /createHmac\(["']sha256["']/,
    "Pagination cursors must use an HMAC signature.",
  );
  requirePattern(
    pagination,
    /timingSafeEqual/,
    "Pagination cursor signatures must use timing-safe comparison.",
  );
  requirePattern(
    pagination,
    /base64url/,
    "Pagination cursors must be opaque base64url tokens.",
  );
  requirePattern(
    pagination,
    /CURSOR_SCOPE_MISMATCH/,
    "Pagination cursors must be bound to their query scope.",
  );
  requirePattern(
    pagination,
    /process\.env\.NODE_ENV\s*===\s*["']production["'][\s\S]*CURSOR_SECRET_MISSING/,
    "Production pagination must fail closed when no cursor-signing secret is configured.",
  );

  requirePattern(
    repository,
    /clientScopeWhere\(input\.context\)/,
    "Client repository queries must enforce the Phase 2 client scope.",
  );
  requirePattern(
    repository,
    /paginationScope\(\{[\s\S]*userId:\s*input\.context\.user\.id/,
    "Pagination cursors must be isolated to the authenticated user as well as the firm and permission scope.",
  );
  requirePattern(
    repository,
    /take:\s*input\.query\.limit\s*\+\s*1/,
    "Client directory reads must use bounded cursor pagination.",
  );
  requirePattern(
    repository,
    /MAX_COMPAT_CLIENTS\s*=\s*100/,
    "Legacy compatibility reads must have a hard client cap.",
  );
  requirePattern(
    repository,
    /MAX_COMPAT_CHILDREN\s*=\s*25/,
    "Legacy nested collections must have a hard child-record cap.",
  );
  requirePattern(
    repository,
    /mode:\s*["']insensitive["']/,
    "Client search must be performed server-side with case-insensitive filters.",
  );
  requirePattern(
    repository,
    /Promise\.all\(\[/,
    "Client summary metrics should run as bounded aggregate queries.",
  );
  requirePattern(
    repository,
    /select:\s*CLIENT_LIST_SELECT/,
    "Client lists must use a narrow explicit selector.",
  );
  requirePattern(
    repository,
    /section === ["']holdings["']/,
    "Client sections must be loaded independently on demand.",
  );
  requirePattern(
    repository,
    /maximumSectionPageSize:\s*MAX_SECTION_PAGE_SIZE/,
    "Client section page limits must be documented in the repository contract.",
  );

  if (/prisma\s+as\s+any/.test(repository) || /prisma\s+as\s+any/.test(mutations)) {
    failures.push("Phase 4 data-access code must not cast Prisma to any.");
  }

  if (/include\s*:/.test(repository)) {
    failures.push(
      "Phase 4 repository reads must use explicit select objects rather than broad include trees.",
    );
  }

  requirePattern(
    mutations,
    /refreshRecommended:\s*true/,
    "Client mutations must return a narrow result instead of reloading the entire client table.",
  );
  requirePattern(
    mutations,
    /CLIENT_MUTATION_ACTIONS/,
    "Client mutation actions must be explicitly allow-listed.",
  );
  requirePattern(
    mutations,
    /requireClientInScope/,
    "Client mutations must enforce authorization-aware record scope.",
  );

  requirePattern(
    clientsRoute,
    /mode\s*=\s*url\.searchParams\.get\(["']mode["']\).*\|\|\s*["']compat["']/s,
    "The existing client route must default to a bounded compatibility mode.",
  );
  requirePattern(
    clientsRoute,
    /mode === ["']list["']/,
    "The client route must expose the paginated list mode.",
  );
  requirePattern(
    clientsRoute,
    /responseMode === ["']compact["']/,
    "The client mutation route must expose a compact response mode for new interfaces.",
  );
  requirePattern(
    clientsRoute,
    /getCompatibilityClientPayload/,
    "The existing client workspace must receive a bounded compatibility response after mutations.",
  );
  requirePattern(
    clientsRoute,
    /withApiRoute/,
    "The client route must use Phase 1 request instrumentation.",
  );
  requirePattern(
    clientRoute,
    /view === ["']compat["']/,
    "The client detail route must preserve a bounded compatibility view.",
  );
  requirePattern(
    sectionRoute,
    /listClientSection/,
    "The client section route must delegate to the shared bounded repository.",
  );

  for (const [name, source] of [
    ["clients route", clientsRoute],
    ["client detail route", clientRoute],
    ["client section route", sectionRoute],
  ]) {
    if (/error\s+instanceof\s+Error[\s\S]{0,160}error\.message/.test(source)) {
      failures.push(`${name} must not expose raw exception messages.`);
    }
  }
}

if (failures.length) {
  process.stderr.write(
    `Phase 4 validation failed:\n${failures
      .map((failure) => `- ${failure}`)
      .join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        phase: "4-bounded-data-access-and-pagination",
        checkedFiles: requiredFiles.length,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}