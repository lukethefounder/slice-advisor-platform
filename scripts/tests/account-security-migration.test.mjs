import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  MIGRATION_PATH, SecurityUpgradeError, parseUpgradeArguments, createUpgradeConfig,
  loadUpgradeEnvironment, applyAccountSecurity, runUpgradeCli,
} from "../apply-account-security.mjs";

let assertions = 0;
function check(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
function rejectsCode(run, code, message) { assert.throws(run, error => error instanceof SecurityUpgradeError && error.code === code, message); assertions++; }
const secret = "NEVER_PRINT_THIS_PASSWORD", direct = `postgresql://fixture:${secret}@database.example.test/slice?schema=public&sslmode=verify-full`;
const sql = readFileSync(MIGRATION_PATH, "utf8");
const normal = () => createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: direct });

check(parseUpgradeArguments([]), { check: false, help: false, schema: undefined, connectionTimeoutMs: 10000, lockTimeoutMs: 10000, statementTimeoutMs: 120000 }, "Defaults have bounded operations");
check(parseUpgradeArguments(["--check", "--schema=tenant_a", "--connection-timeout-ms", "12000", "--lock-timeout-ms=20000", "--statement-timeout-ms", "240000"]).statementTimeoutMs, 240000, "Both supported value flag forms are parsed");
for (const args of [["--url", direct], ["--check=false"], ["--check", "--check"], ["--schema"], ["--statement-timeout-ms", "0"], ["--connection-timeout-ms=-1"], ["--lock-timeout-ms", "NaN"], ["--statement-timeout-ms=9999999"]]) {
  assert.throws(() => parseUpgradeArguments(args), error => error instanceof SecurityUpgradeError && !error.message.includes(secret)); assertions++;
}
rejectsCode(() => parseUpgradeArguments(["--lock-timeout-ms=20000", "--statement-timeout-ms=10000"]), "INVALID_TIMEOUT", "A lock wait cannot exceed the statement bound");
const preferred = createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: direct, DATABASE_URL: "postgresql://other:other@localhost/incorrect" });
check([preferred.connectionSource, new URL(preferred.client.connectionString).hostname], ["DIRECT_URL", "database.example.test"], "Direct URL wins over the runtime connection");
check([preferred.client.query_timeout, preferred.client.statement_timeout, preferred.client.lock_timeout, preferred.client.connectionTimeoutMillis], [125000,120000,10000,10000], "Server and client operations have explicit finite time bounds");
check(new URL(preferred.client.connectionString).searchParams.has("schema"), false, "The Prisma schema parameter is removed from the PG transport URL");
check(createUpgradeConfig(parseUpgradeArguments(["--schema", "tenant_b"]), { DIRECT_URL: direct }).schema, "tenant_b", "An explicit schema takes precedence over the URL schema");
for (const value of ["postgresql://u:p@pooler.example.test:6543/db", "postgresql://u:p@ep-abc-pooler.us-east-1.aws.neon.tech/db", "postgresql://u:p@ep-abc%2Dpooler.us-east-1.aws.neon.tech/db", "postgresql://u:p@db.example.test/db?pgbouncer=true", "postgresql://u:p@db.example.test/db?pgbouncer=1"]) {
  rejectsCode(() => createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: value }), "TRANSACTION_POOLING_UNSUPPORTED", "Known transaction-pooling endpoints cannot be used");
}
check(createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/db" }).connectionSource, "DIRECT_URL", "A provider's explicit session-mode endpoint is permitted");
for (const environment of [{ DATABASE_URL: direct }, { NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost/db" }, { VERCEL_ENV: "production", DATABASE_URL: "postgresql://u:p@localhost/db" }, { SLICE_ENV_VALIDATION_MODE: "production", DATABASE_URL: "postgresql://u:p@localhost/db" }])
  rejectsCode(() => createUpgradeConfig(parseUpgradeArguments([]), environment), "DIRECT_URL_REQUIRED", "Remote and production installations require a deliberate direct URL");
for (const host of ["localhost", "127.0.0.1", "[::1]"]) check(createUpgradeConfig(parseUpgradeArguments([]), { NODE_ENV: "development", DATABASE_URL: `postgresql://u:p@${host}/db` }).connectionSource, "DATABASE_URL", "Loopback development fallback is permitted");
for (const parameter of ["host=other-host", "port=6543", "options=-c%20statement_timeout%3D0", "connectionTimeoutMillis=0", "statement_timeout=0", "schema=public&schema=other"]) {
  rejectsCode(() => createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: `postgresql://u:p@db.test/db?${parameter}` }), "UNSUPPORTED_DATABASE_PARAMETER", "URI overrides cannot bypass endpoint or timeout checks");
}
for (const schema of ["pg_catalog", "pg_temp", "information_schema", "public;DROP TABLE", "", "x".repeat(64)])
  rejectsCode(() => createUpgradeConfig({ ...parseUpgradeArguments([]), schema }, { DIRECT_URL: direct }), "INVALID_SCHEMA", "Only a non-system SQL identifier can select a schema");
for (const url of ["mysql://u:p@localhost/db", "postgresql://localhost/db", "postgresql://u:p@localhost", "not-a-url"]) {
  rejectsCode(() => createUpgradeConfig(parseUpgradeArguments([]), { DIRECT_URL: url }), "INVALID_DATABASE_URL", "Invalid connection configuration fails before a client is created");
}

// Use actual Next environment loading against temporary fixtures; no project credentials are read.
const environmentBefore = { ...process.env }, fixture = mkdtempSync(join(tmpdir(), "slice-security-env-"));
try {
  process.env.NODE_ENV = "development"; process.env.DIRECT_URL = "postgresql://parent:parent@localhost/parent"; delete process.env.DATABASE_URL;
  writeFileSync(join(fixture, ".env"), 'DIRECT_URL="postgresql://base:base@localhost/base"\nDATABASE_URL="postgresql://base:base@localhost/base"\nSLICE_SECURITY_TEST_BASE=from-base\n');
  writeFileSync(join(fixture, ".env.local"), 'DIRECT_URL="postgresql://local:local@localhost/local"\nDATABASE_URL="postgresql://local:local@localhost/local"\n');
  loadUpgradeEnvironment(fixture);
  check(process.env.DIRECT_URL, "postgresql://parent:parent@localhost/parent", "Shell credentials cannot be overwritten by environment files");
  check(process.env.DATABASE_URL, "postgresql://local:local@localhost/local", "Local environment values override the base file");
  check(process.env.SLICE_SECURITY_TEST_BASE, "from-base", "The base file fills values not supplied elsewhere");
} finally {
  for (const key of Object.keys(process.env)) if (!Object.hasOwn(environmentBefore, key)) delete process.env[key];
  Object.assign(process.env, environmentBefore); rmSync(fixture, { recursive: true, force: true });
}

const fields = (table, specification) => Object.entries(specification).map(([name, type]) => ({ table_name: table, table_kind: "r", column_name: name, data_type: type.replace("?", ""), not_null: !type.endsWith("?") }));
const unique = (table, name, primary = false) => ({ table_name: table, columns: [name], is_primary: primary, is_unique: true, is_valid: true, is_ready: true, is_plain: true });
function catalog(complete, schema = "public") {
  const snapshot = {
    columns: [
      ...fields("User", { id: "text", name: "text", email: "text", passwordHash: "text", createdAt: "timestamp" }),
      ...fields("Session", { id: "text", tokenHash: "text", userId: "text", expiresAt: "timestamp", createdAt: "timestamp" }),
      ...fields("UserSecuritySetting", { id: "text", userId: "text", mfaEnabled: "bool", requireReauthForSensitiveActions: "bool", alertOnNewLogin: "bool", advisorModeEnabled: "bool", sessionTimeoutMinutes: "int4", lastSecurityReviewAt: "timestamp?", createdAt: "timestamp", updatedAt: "timestamp" }),
    ], indexes: [unique("User", "id", true), unique("Session", "id", true), unique("Session", "tokenHash"), unique("UserSecuritySetting", "id", true), unique("UserSecuritySetting", "userId")], foreignKeys: [],
  };
  if (complete) {
    snapshot.columns.push(...fields("Session", { lastSeenAt: "timestamp", mfaVerifiedAt: "timestamp?", userAgent: "text?", ipHash: "text?" }), ...fields("UserSecuritySetting", { idleTimeoutMinutes: "int4" }),
      ...fields("UserAuthenticator", { id: "text", userId: "text", secretEncrypted: "text?", pendingSecretEncrypted: "text?", pendingExpiresAt: "timestamp?", enabledAt: "timestamp?", lastUsedStep: "int4?", recoveryCodeHashesJson: "text", createdAt: "timestamp", updatedAt: "timestamp" }));
    snapshot.indexes.push(unique("UserAuthenticator", "id", true), unique("UserAuthenticator", "userId"));
    snapshot.foreignKeys.push({ table_name: "UserAuthenticator", columns: ["userId"], target_table: "User", target_columns: ["id"], target_schema: schema, is_valid: true, on_delete: "c", on_update: "c" });
  }
  return snapshot;
}
function mockDatabase(options = {}) {
  const history = [], stats = { created: 0, connected: 0, ended: 0, applied: 0 }, schema = options.schema ?? "public";
  let snapshot = options.snapshot ?? catalog(options.complete ?? false, schema), backup;
  return {
    history, stats, current: () => snapshot,
    createClient(config) {
      stats.created++; check(config.connectionTimeoutMillis >= 1000, true, "Every mocked PG client receives a finite connection bound");
      return {
        on() {},
        async connect() { stats.connected++; if (options.connectError) throw options.connectError; },
        async query(input) {
          const query = typeof input === "string" ? { text: input } : input;
          history.push(structuredClone(query));
          if (query.text.startsWith("BEGIN")) { backup = structuredClone(snapshot); return { rows: [] }; }
          if (query.text === "ROLLBACK") { if (options.rollbackError) throw options.rollbackError; snapshot = backup; return { rows: [] }; }
          if (query.text === "COMMIT") { if (options.commitError) throw options.commitError; backup = null; return { rows: [] }; }
          if (query.text.includes("pg_advisory_xact_lock")) { if (options.lockError) throw options.lockError; return { rows: [] }; }
          if (query.text === sql) {
            stats.applied++; snapshot = catalog(true, schema);
            if (options.afterApply) options.afterApply(snapshot);
            if (options.applyError) throw options.applyError;
            return { rows: [] };
          }
          if (query.text.includes("security-upgrade:columns")) { check(query.values[0], schema, "Catalog inspection is scoped to the selected schema"); return { rows: structuredClone(snapshot.columns) }; }
          if (query.text.includes("security-upgrade:indexes")) return { rows: structuredClone(snapshot.indexes) };
          if (query.text.includes("security-upgrade:foreign-keys")) return { rows: structuredClone(snapshot.foreignKeys) };
          if (query.text.includes("pg_catalog.set_config")) return { rows: [] };
          throw new Error(`Unexpected query: ${query.text}`);
        },
        async end() { stats.ended++; },
      };
    },
  };
}
let mock = mockDatabase(); let result = await applyAccountSecurity(normal(), mock);
check([result.ok, result.mode, result.verified, result.securityColumns], [true, "apply", true, 15], "A successful apply verifies the new schema before reporting completion");
check(result.sha256, createHash("sha256").update(sql).digest("hex"), "The result identifies the exact bundled SQL that ran");
check([mock.stats.applied,mock.stats.ended], [1,1], "Only one release SQL batch is applied and the client is always closed");
check([mock.history[0].text,mock.history.at(-1).text], ["BEGIN","COMMIT"], "The migration and postchecks share one transaction");
check(mock.history.findIndex(query => query.text.includes("pg_advisory_xact_lock")) < mock.history.findIndex(query => query.text === sql), true, "Concurrent installer runs serialize before additive DDL");
check(mock.history.some(query => /_prisma_migrations|DROP\s|TRUNCATE\s/i.test(query.text)), false, "The installer cannot replay/reset history or delete tables");
const firstColumns = structuredClone(mock.current().columns);
result = await applyAccountSecurity(normal(), mock);
check([result.ok,mock.stats.applied,mock.stats.ended], [true,2,2], "The same additive installer can be safely rerun against an upgraded schema");
check(mock.current().columns, firstColumns, "A repeated run preserves the completed schema");
mock = mockDatabase({ complete: true });
result = await applyAccountSecurity({ ...normal(), check: true }, mock);
check([result.mode,mock.stats.applied,mock.history[0].text.includes("READ ONLY")], ["check",0,true], "Check mode uses a read-only transaction and never applies SQL");
check(mock.history.some(query => query.text.includes("pg_advisory_xact_lock")), false, "Read-only checks do not acquire installer write coordination locks");
mock = mockDatabase();
await assert.rejects(() => applyAccountSecurity({ ...normal(), check: true }, mock), error => error.code === "SECURITY_SCHEMA_INCOMPLETE"); assertions++;
check([mock.stats.applied,mock.history.at(-1).text,mock.stats.ended], [0,"ROLLBACK",1], "An incomplete check fails without any schema mutation");
for (const defect of [snapshot => { snapshot.columns = snapshot.columns.filter(row => row.table_name !== "User"); }, snapshot => { snapshot.columns.find(row => row.table_name === "Session" && row.column_name === "userId").data_type = "int4"; }, snapshot => { snapshot.indexes = snapshot.indexes.filter(row => row.table_name !== "UserSecuritySetting"); }]) {
  const before = catalog(false); defect(before); mock = mockDatabase({ snapshot: before });
  await assert.rejects(() => applyAccountSecurity(normal(), mock), error => error.code === "FOUNDATION_SCHEMA_REQUIRED"); assertions++;
  check([mock.stats.applied,mock.history.at(-1).text,mock.stats.ended], [0,"ROLLBACK",1], "A missing foundation stops before any release SQL runs");
}
const incompatible = catalog(true); incompatible.columns.find(row => row.table_name === "UserAuthenticator" && row.column_name === "secretEncrypted").not_null = true;
mock = mockDatabase({ snapshot: incompatible });
await assert.rejects(() => applyAccountSecurity(normal(), mock), error => error.code === "INCOMPATIBLE_SECURITY_SCHEMA"); assertions++;
check(mock.stats.applied, 0, "An incompatible pre-existing authenticator table is never rebuilt destructively");
mock = mockDatabase({ afterApply(snapshot) { snapshot.indexes = snapshot.indexes.filter(row => !(row.table_name === "UserAuthenticator" && row.columns[0] === "userId")); } });
await assert.rejects(() => applyAccountSecurity(normal(), mock), error => error.code === "SECURITY_SCHEMA_INCOMPLETE" && error.details.rollbackConfirmed); assertions++;
check([mock.current().columns.some(row => row.table_name === "UserAuthenticator"),mock.history.at(-1).text], [false,"ROLLBACK"], "Post-apply verification failure rolls back the entire additive batch");
mock = mockDatabase({ complete: true, schema: "tenant_a" });
result = await applyAccountSecurity({ ...normal(), schema: "tenant_a", check: true }, mock);
check(result.schema, "tenant_a", "Custom schemas are inspected and verified without assuming public");
const foreign = catalog(true); foreign.foreignKeys[0].on_delete = "a";
mock = mockDatabase({ snapshot: foreign });
await assert.rejects(() => applyAccountSecurity({ ...normal(), check: true }, mock), error => error.code === "SECURITY_SCHEMA_INCOMPLETE"); assertions++;

// Every driver failure is sanitized, the transaction is rolled back where possible, and connection cleanup still runs.
for (const [stage, code] of [["connectError","28P01"],["lockError","55P03"],["applyError","57014"],["commitError","ECONNRESET"]]) {
  const error = Object.assign(new Error(`password=${secret} URL=${direct}`), { code, detail: secret }); mock = mockDatabase({ [stage]: error });
  let captured;
  try { await applyAccountSecurity(normal(), mock); } catch (failure) { captured = failure; }
  check(captured instanceof SecurityUpgradeError && !JSON.stringify({ message: captured.message, details: captured.details }).includes(secret), true, "Driver text and credentials never enter public diagnostics");
  check(mock.stats.ended, 1, "Failed connections and transactions are always closed");
  if (stage !== "connectError") check(mock.history.at(-1).text, "ROLLBACK", "Failure inside the transaction attempts rollback");
  if (stage === "commitError") check(captured.code, "COMMIT_UNCONFIRMED", "Commit ambiguity is reported honestly and directs the user to check");
}
mock = mockDatabase({ applyError: new Error(secret), rollbackError: new Error(secret) });
await assert.rejects(() => applyAccountSecurity(normal(), mock), error => error.details.rollbackConfirmed === false && !error.message.includes(secret)); assertions++;
check(mock.stats.ended, 1, "A failed rollback still closes the client to end its transaction");
let created = false;
await assert.rejects(() => applyAccountSecurity(normal(), { createClient() { created = true; }, readMigration() { throw new Error(secret); } }), error => error.code === "MIGRATION_FILE_REQUIRED" && !error.message.includes(secret)); assertions++;
check(created, false, "A missing fixed release SQL file fails before connecting");
let stdout = "", stderr = "", environmentLoads = 0;
check(await runUpgradeCli(["--help"], { writeOut: text => { stdout += text; }, writeError: text => { stderr += text; }, loadEnvironment() { environmentLoads++; }, createClient() { throw new Error("Help must never connect"); } }), 0, "Help succeeds without a database");
check([environmentLoads,stderr.length,stdout.includes("--check")], [0,0,true], "Help avoids even environment loading");
stdout = ""; stderr = ""; mock = mockDatabase({ connectError: Object.assign(new Error(secret), { code: "28P01" }) });
check(await runUpgradeCli([], { ...mock, environment: { DIRECT_URL: direct }, loadEnvironment() {}, writeOut: text => { stdout += text; }, writeError: text => { stderr += text; } }), 1, "CLI failure returns a nonzero exit code");
check([stdout.length,stderr.includes(secret),JSON.parse(stderr).ok], [0,false,false], "CLI output is structured and omits credentials");
stdout = ""; stderr = ""; mock = mockDatabase({ complete: true });
check(await runUpgradeCli(["--check"], { ...mock, environment: { DIRECT_URL: direct }, loadEnvironment() {}, writeOut: text => { stdout += text; }, writeError: text => { stderr += text; } }), 0, "CLI check success exits zero");
check([JSON.parse(stdout).verified,stderr.length,mock.stats.applied], [true,0,0], "CLI check produces a usable verification report without applying SQL");
console.log(`Account security installer checks passed (${assertions} assertions): environment precedence, endpoint/configuration guards, bounded PG options, foundation/schema/key checks, fixed additive SQL, read-only checks, reruns, transaction rollback, commit ambiguity, and credential-safe failures. Every database client was mocked; no database was contacted.`);
