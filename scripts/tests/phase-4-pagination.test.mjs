import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const sourcePath = new URL("../../src/lib/pagination.ts", import.meta.url);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "slice-phase4-pagination-"));
const outputPath = join(temporaryDirectory, "pagination.mjs");
const previousEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  SECURITY_PEPPER: process.env.SECURITY_PEPPER,
};

function restoreEnvironment() {
  if (previousEnvironment.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousEnvironment.NODE_ENV;
  }

  if (previousEnvironment.SECURITY_PEPPER === undefined) {
    delete process.env.SECURITY_PEPPER;
  } else {
    process.env.SECURITY_PEPPER = previousEnvironment.SECURITY_PEPPER;
  }
}

try {
  process.env.NODE_ENV = "test";
  process.env.SECURITY_PEPPER =
    "slice-phase-4-pagination-contract-test-secret-2026";

  const source = await readFile(sourcePath, "utf8");
  const testableSource = source
    .replace(/^import\s+["']server-only["'];?\s*$/m, "")
    .replace(
      /^import\s+\{\s*ApiError\s*\}\s+from\s+["']@\/lib\/api-route["'];?\s*$/m,
      `class ApiError extends Error {
  constructor(input) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.expose = input.expose ?? input.status < 500;
    this.details = input.details;
  }
}`,
    );

  const compiled = ts.transpileModule(testableSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    fileName: "pagination.ts",
    reportDiagnostics: true,
  });

  const compileErrors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  assert.equal(
    compileErrors.length,
    0,
    compileErrors
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
      .join("\n"),
  );

  await writeFile(outputPath, compiled.outputText, "utf8");

  const pagination = await import(
    `${pathToFileURL(outputPath).href}?version=${Date.now()}`
  );

  const firstScope = pagination.paginationScope({
    resource: "clients",
    userId: "user-1",
    firmId: "firm-1",
    filters: {
      q: "smith",
      status: "Active",
    },
  });

  const sameScopeDifferentKeyOrder = pagination.paginationScope({
    filters: {
      status: "Active",
      q: "smith",
    },
    firmId: "firm-1",
    userId: "user-1",
    resource: "clients",
  });

  assert.equal(
    firstScope,
    sameScopeDifferentKeyOrder,
    "Pagination scope hashing must be deterministic.",
  );

  const cursor = pagination.encodeCursor({
    id: "client-cursor-2",
    scope: firstScope,
  });

  assert.equal(
    pagination.decodeCursor(cursor, firstScope),
    "client-cursor-2",
    "A signed cursor must round-trip to its record ID.",
  );

  const otherScope = pagination.paginationScope({
    resource: "clients",
    userId: "user-2",
    firmId: "firm-1",
  });

  assert.throws(
    () => pagination.decodeCursor(cursor, otherScope),
    (error) => error?.code === "CURSOR_SCOPE_MISMATCH",
    "A cursor must not be reusable by another user or query scope.",
  );

  const decodedCursor = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  decodedCursor.mac = `${decodedCursor.mac.slice(0, -1)}${
    decodedCursor.mac.endsWith("A") ? "B" : "A"
  }`;
  const tamperedCursor = Buffer.from(
    JSON.stringify(decodedCursor),
    "utf8",
  ).toString("base64url");

  assert.throws(
    () => pagination.decodeCursor(tamperedCursor, firstScope),
    (error) => error?.code === "INVALID_CURSOR_SIGNATURE",
    "A modified cursor signature must be rejected.",
  );

  assert.equal(
    pagination.readPageSize(new URLSearchParams("limit=40"), {
      fallback: 25,
      maximum: 100,
    }),
    40,
  );

  assert.throws(
    () =>
      pagination.readPageSize(new URLSearchParams("limit=500"), {
        fallback: 25,
        maximum: 100,
      }),
    (error) => error?.code === "INVALID_PAGE_SIZE",
    "Page sizes above the hard limit must be rejected.",
  );

  assert.equal(
    pagination.readSearch(new URLSearchParams("q=%20Jane%20%20Doe%20")),
    "Jane Doe",
    "Search strings must be normalized before entering a query.",
  );

  const page = pagination.createCursorPage({
    rows: [{ id: "a" }, { id: "b" }, { id: "c" }],
    pageSize: 2,
    scope: firstScope,
  });

  assert.deepEqual(page.items, [{ id: "a" }, { id: "b" }]);
  assert.equal(page.pagination.hasMore, true);
  assert.equal(page.pagination.limit, 2);
  assert.equal(
    pagination.decodeCursor(page.pagination.nextCursor, firstScope),
    "b",
    "The next-page cursor must identify the final returned row.",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        test: "phase-4-pagination-contract",
        assertions: 12,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
} finally {
  restoreEnvironment();
  await rm(temporaryDirectory, { recursive: true, force: true });
}