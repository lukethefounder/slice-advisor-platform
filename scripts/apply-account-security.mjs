import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

export const MIGRATION_NAME = "20261119060000_account_security_controls";
export const MIGRATION_PATH = fileURLToPath(new URL(`../prisma/migrations/${MIGRATION_NAME}/migration.sql`, import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const LIMITS = {
  connectionTimeoutMs: { flag: "connection-timeout-ms", default: 10_000, min: 1_000, max: 60_000 },
  lockTimeoutMs: { flag: "lock-timeout-ms", default: 10_000, min: 1_000, max: 120_000 },
  statementTimeoutMs: { flag: "statement-timeout-ms", default: 120_000, min: 1_000, max: 900_000 },
};
const BOOL_FLAGS = new Map([["--check", "check"], ["--help", "help"], ["-h", "help"]]);
const VALUE_FLAGS = new Map([["--schema", "schema"], ...Object.entries(LIMITS).map(([key, item]) => [`--${item.flag}`, key])]);
const TABLES = ["User", "Session", "UserSecuritySetting", "UserAuthenticator"];
const column = (type, nullable = false) => ({ type, nullable });
const FOUNDATIONS = {
  User: { id: column("text"), name: column("text"), email: column("text"), passwordHash: column("text"), createdAt: column("timestamp") },
  Session: { id: column("text"), tokenHash: column("text"), userId: column("text"), expiresAt: column("timestamp"), createdAt: column("timestamp") },
  UserSecuritySetting: {
    id: column("text"), userId: column("text"), mfaEnabled: column("bool"), requireReauthForSensitiveActions: column("bool"),
    alertOnNewLogin: column("bool"), advisorModeEnabled: column("bool"), sessionTimeoutMinutes: column("int4"),
    lastSecurityReviewAt: column("timestamp", true), createdAt: column("timestamp"), updatedAt: column("timestamp"),
  },
};
const UPGRADE = {
  Session: { lastSeenAt: column("timestamp"), mfaVerifiedAt: column("timestamp", true), userAgent: column("text", true), ipHash: column("text", true) },
  UserSecuritySetting: { idleTimeoutMinutes: column("int4") },
  UserAuthenticator: {
    id: column("text"), userId: column("text"), secretEncrypted: column("text", true), pendingSecretEncrypted: column("text", true),
    pendingExpiresAt: column("timestamp", true), enabledAt: column("timestamp", true), lastUsedStep: column("int4", true),
    recoveryCodeHashesJson: column("text"), createdAt: column("timestamp"), updatedAt: column("timestamp"),
  },
};

export class SecurityUpgradeError extends Error {
  constructor(code, message, details = {}) {
    super(message); this.name = "SecurityUpgradeError"; this.code = code; this.details = details;
  }
}
const problem = (code, message, details) => new SecurityUpgradeError(code, message, details);

export function parseUpgradeArguments(argv = []) {
  const options = { check: false, help: false, schema: undefined, ...Object.fromEntries(Object.entries(LIMITS).map(([key, rule]) => [key, rule.default])) };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (typeof token !== "string") throw problem("INVALID_ARGUMENT", "Arguments must use the documented flags. Run with --help.");
    const equals = token.indexOf("="), flag = equals >= 0 ? token.slice(0, equals) : token;
    const key = BOOL_FLAGS.get(flag) ?? VALUE_FLAGS.get(flag);
    if (!key || seen.has(key)) throw problem("INVALID_ARGUMENT", "An unknown or repeated option was supplied. Run with --help.");
    seen.add(key);
    if (BOOL_FLAGS.has(flag)) {
      if (equals >= 0) throw problem("INVALID_ARGUMENT", "Boolean options do not take a value. Run with --help.");
      options[key] = true; continue;
    }
    const value = equals >= 0 ? token.slice(equals + 1) : argv[++index];
    if (typeof value !== "string" || !value || value.startsWith("--")) throw problem("INVALID_ARGUMENT", "A value is missing for an installer option. Run with --help.");
    if (key === "schema") options.schema = value;
    else {
      const rule = LIMITS[key];
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < rule.min || Number(value) > rule.max)
        throw problem("INVALID_TIMEOUT", `--${rule.flag} must be an integer from ${rule.min} to ${rule.max}.`);
      options[key] = Number(value);
    }
  }
  if (options.lockTimeoutMs > options.statementTimeoutMs) throw problem("INVALID_TIMEOUT", "The lock timeout must not exceed the statement timeout.");
  return options;
}

/** Load Next's environment files while retaining parent-process values and keeping parser diagnostics private. */
export function loadUpgradeEnvironment(directory = PROJECT_ROOT) {
  let failed = false;
  try {
    nextEnv.loadEnvConfig(directory, process.env.NODE_ENV !== "production", { info() {}, error() { failed = true; } }, true);
  } catch { failed = true; }
  if (failed) throw problem("ENVIRONMENT_LOAD_FAILED", "An environment file could not be loaded. Check its syntax and file permissions.");
}

export function createUpgradeConfig(options, environment = process.env) {
  const value = key => String(environment[key] ?? "").trim();
  const direct = value("DIRECT_URL"), runtime = value("DATABASE_URL");
  if (!direct && !runtime) throw problem("DATABASE_URL_REQUIRED", "Set DIRECT_URL to the existing database's direct PostgreSQL connection before running this upgrade.");
  const connectionSource = direct ? "DIRECT_URL" : "DATABASE_URL";
  let url;
  try { url = new URL(direct || runtime); } catch { throw problem("INVALID_DATABASE_URL", `${connectionSource} is not a valid PostgreSQL URL.`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || !url.username || url.hash)
    throw problem("INVALID_DATABASE_URL", `${connectionSource} must identify a PostgreSQL host, database, and user.`);
  // Reject URI query overrides that could route a checked URL to a different endpoint or disable the bounds below.
  const transportParameters = new Set(["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "sslnegotiation", "channel_binding", "uselibpqcompat"]);
  const prismaParameters = new Set(["schema", "pgbouncer", "connection_limit", "pool_timeout", "connect_timeout", "statement_cache_size", "application_name"]);
  const seen = new Set();
  for (const [key] of url.searchParams) {
    if (seen.has(key) || (!transportParameters.has(key) && !prismaParameters.has(key)))
      throw problem("UNSUPPORTED_DATABASE_PARAMETER", "The database URL contains an unsupported or repeated parameter. Use the provider's direct connection URL and the installer's timeout flags.");
    seen.add(key);
  }
  let host;
  try { host = decodeURIComponent(url.hostname).toLowerCase(); } catch { throw problem("INVALID_DATABASE_URL", `${connectionSource} has an invalid host encoding.`); }
  if (!/^(?:\[[0-9a-f:.]+\]|[a-z0-9._-]+)$/.test(host)) throw problem("INVALID_DATABASE_URL", `${connectionSource} must use a PostgreSQL network hostname.`);
  if (url.port === "6543" || ["true", "1"].includes((url.searchParams.get("pgbouncer") ?? "").toLowerCase()) || host.includes("-pooler."))
    throw problem("TRANSACTION_POOLING_UNSUPPORTED", "This URL appears to use transaction pooling. Set DIRECT_URL to a direct or session connection; do not use the runtime transaction pool.");
  const production = value("NODE_ENV") === "production" || value("SLICE_ENV_VALIDATION_MODE") === "production" || (value("VERCEL_ENV") && value("VERCEL_ENV") !== "development");
  if (!direct && (production || !["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)))
    throw problem("DIRECT_URL_REQUIRED", "Remote or production upgrades require DIRECT_URL. DATABASE_URL fallback is supported only for loopback PostgreSQL in a non-production environment.");
  const schema = options.schema ?? url.searchParams.get("schema") ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(schema) || schema.toLowerCase().startsWith("pg_") || schema.toLowerCase() === "information_schema")
    throw problem("INVALID_SCHEMA", "Use a non-system schema name with 1–63 letters, digits, or underscores, starting with a letter or underscore.");
  // Prisma-only parameters are intentionally removed. Parent/URI options cannot override the installation time bounds.
  for (const key of [...url.searchParams.keys()]) if (!transportParameters.has(key)) url.searchParams.delete(key);
  const queryTimeoutMs = options.statementTimeoutMs + 5_000;
  return {
    check: options.check, schema, connectionSource,
    connectionTimeoutMs: options.connectionTimeoutMs, lockTimeoutMs: options.lockTimeoutMs, statementTimeoutMs: options.statementTimeoutMs,
    client: {
      connectionString: url.toString(), connectionTimeoutMillis: options.connectionTimeoutMs,
      statement_timeout: options.statementTimeoutMs, lock_timeout: options.lockTimeoutMs,
      idle_in_transaction_session_timeout: queryTimeoutMs + 5_000, query_timeout: queryTimeoutMs,
      application_name: "slice-account-security-upgrade", keepAlive: true,
      // Do not inherit PGOPTIONS: the script sets its own bounded operations and explicit schema.
      options: "-c search_path=pg_catalog",
    },
  };
}

async function inspectSchema(client, schema) {
  const columns = await client.query({ text: `/* security-upgrade:columns */
    SELECT c.relname AS table_name, c.relkind AS table_kind, a.attname AS column_name,
      t.typname AS data_type, a.attnotnull AS not_null
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`, values: [schema, TABLES] });
  const indexes = await client.query({ text: `/* security-upgrade:indexes */
    SELECT c.relname AS table_name, i.indisprimary AS is_primary,
      i.indisunique AS is_unique, i.indisvalid AS is_valid, i.indisready AS is_ready,
      i.indpred IS NULL AND i.indexprs IS NULL AS is_plain,
      ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
        WHERE k.position <= i.indnkeyatts ORDER BY k.position) AS columns
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid = i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`, values: [schema, TABLES] });
  const foreignKeys = await client.query({ text: `/* security-upgrade:foreign-keys */
    SELECT c.relname AS table_name, target.relname AS target_table, target_ns.nspname AS target_schema,
      fk.convalidated AS is_valid, fk.confdeltype AS on_delete, fk.confupdtype AS on_update,
      ARRAY(SELECT a.attname::text FROM unnest(fk.conkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum ORDER BY k.position) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(fk.confkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = target.oid AND a.attnum = k.attnum ORDER BY k.position) AS target_columns
    FROM pg_catalog.pg_constraint fk JOIN pg_catalog.pg_class c ON c.oid = fk.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_class target ON target.oid = fk.confrelid
    JOIN pg_catalog.pg_namespace target_ns ON target_ns.oid = target.relnamespace
    WHERE fk.contype = 'f' AND n.nspname = $1 AND c.relname = 'UserAuthenticator'`, values: [schema] });
  return { columns: columns.rows, indexes: indexes.rows, foreignKeys: foreignKeys.rows };
}
function columnProblems(snapshot, expected, missingAllowed = false) {
  const issues = [];
  for (const [table, fields] of Object.entries(expected)) {
    for (const [name, requirement] of Object.entries(fields)) {
      const found = snapshot.columns.find(item => item.table_name === table && item.column_name === name);
      if (!found) { if (!missingAllowed) issues.push(`${table}.${name}: missing`); continue; }
      if (!["r", "p"].includes(found.table_kind) || found.data_type !== requirement.type || found.not_null !== !requirement.nullable)
        issues.push(`${table}.${name}: incompatible type or nullability`);
    }
  }
  return issues;
}
function hasUniqueKey(snapshot, table, name, primary = false) {
  return snapshot.indexes.some(item => item.table_name === table && item.is_valid && item.is_ready && item.is_plain && item.is_unique && (!primary || item.is_primary) && item.columns?.length === 1 && item.columns[0] === name);
}
function verifyFoundations(snapshot) {
  const issues = columnProblems(snapshot, FOUNDATIONS);
  for (const table of Object.keys(FOUNDATIONS)) if (!hasUniqueKey(snapshot, table, "id", true)) issues.push(`${table}.id: primary key missing`);
  if (!hasUniqueKey(snapshot, "Session", "tokenHash")) issues.push("Session.tokenHash: unique key missing");
  if (!hasUniqueKey(snapshot, "UserSecuritySetting", "userId")) issues.push("UserSecuritySetting.userId: unique key missing");
  if (issues.length) throw problem("FOUNDATION_SCHEMA_REQUIRED", "The existing Slice account tables are missing or incompatible. This installer only adds security controls; it cannot initialize or reset a database.", { issues });
}
function verifyUpgradeable(snapshot) {
  const issues = columnProblems(snapshot, UPGRADE, true);
  if (snapshot.columns.some(item => item.table_name === "UserAuthenticator")) {
    issues.push(...columnProblems(snapshot, { UserAuthenticator: UPGRADE.UserAuthenticator }));
    if (!hasUniqueKey(snapshot, "UserAuthenticator", "id", true)) issues.push("UserAuthenticator.id: primary key missing");
  }
  if (issues.length) throw problem("INCOMPATIBLE_SECURITY_SCHEMA", "Existing security fields are incompatible with this additive upgrade. No destructive repair is attempted.", { issues: [...new Set(issues)] });
}
function verifyUpgrade(snapshot, schema) {
  const issues = columnProblems(snapshot, UPGRADE);
  if (!hasUniqueKey(snapshot, "UserAuthenticator", "id", true)) issues.push("UserAuthenticator.id: primary key missing");
  if (!hasUniqueKey(snapshot, "UserAuthenticator", "userId")) issues.push("UserAuthenticator.userId: unique key missing");
  if (!snapshot.foreignKeys.some(item => item.table_name === "UserAuthenticator" && item.target_table === "User" && item.target_schema === schema && item.is_valid && item.on_delete === "c" && item.on_update === "c" && item.columns?.length === 1 && item.columns[0] === "userId" && item.target_columns?.length === 1 && item.target_columns[0] === "id"))
    issues.push("UserAuthenticator.userId: validated User foreign key with cascade rules missing");
  if (issues.length) throw problem("SECURITY_SCHEMA_INCOMPLETE", "Account security schema verification failed. Run the additive upgrade after reviewing the reported fields.", { issues });
}

function safeDatabaseError(error, phase, rollbackConfirmed) {
  if (phase === "commit") return problem("COMMIT_UNCONFIRMED", "The database did not confirm commit. Reconnect and run --check to determine the current schema; the additive installer can be rerun.", { phase, rollbackConfirmed });
  if (error instanceof SecurityUpgradeError) return problem(error.code, error.message, { ...error.details, phase, rollbackConfirmed });
  const code = typeof error?.code === "string" ? error.code : "";
  const messages = {
    "28P01": "Database authentication failed. Check the direct connection credentials.",
    "28000": "Database authentication was rejected. Check the database role configuration.",
    "3D000": "The configured database does not exist. Select the existing Slice database.",
    "42501": "The database role lacks the required schema inspection or alteration permissions.",
    "55P03": "A database lock could not be acquired within the configured bound. Retry after competing schema work ends.",
    "57014": "A database statement exceeded its configured bound. Review database load or raise the documented statement timeout.",
    "23505": "Existing records violate a required unique security key. The installer does not delete or rewrite conflicting records.",
    "23503": "Existing records violate the required account foreign key. The installer does not remove account records.",
    "25006": "The database connection is read-only. Use an authorized direct connection for the apply command.",
    "ENOTFOUND": "The database hostname could not be resolved. Check the direct connection configuration.",
    "ECONNREFUSED": "The database connection was refused. Check database availability and network access.",
    "ETIMEDOUT": "The database connection timed out within its configured bound.",
  };
  return problem("DATABASE_OPERATION_FAILED", messages[code] ?? "The database operation failed. Check connection, TLS, permissions, and configured time bounds. Driver details are omitted to protect credentials.", { phase, rollbackConfirmed });
}
async function closeClient(client, timeoutMs) {
  let timer;
  const destroy = () => { try { client.connection?.stream?.destroy(); } catch { /* Cleanup must never expose a driver error. */ } };
  try {
    await Promise.race([
      Promise.resolve().then(() => client.end()).catch(destroy),
      new Promise(resolveClose => { timer = setTimeout(() => { destroy(); resolveClose(); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Imports are inert. A client is constructed only when this explicitly invoked function runs. */
export async function applyAccountSecurity(config, { createClient = options => new pg.Client(options), readMigration = () => readFileSync(MIGRATION_PATH, "utf8") } = {}) {
  let sql;
  try { sql = readMigration(); } catch { throw problem("MIGRATION_FILE_REQUIRED", "The bundled account security migration could not be read. Restore this release's migration file before running the installer."); }
  if (typeof sql !== "string" || !sql.trim() || Buffer.byteLength(sql) > 65_536) throw problem("INVALID_MIGRATION_FILE", "The bundled security migration is empty or outside the expected size bound.");
  const fingerprint = createHash("sha256").update(sql).digest("hex");
  let client, transaction = false, phase = "connect", rollbackConfirmed = false, asynchronousError;
  try {
    client = createClient(config.client);
    // pg emits idle connection errors. Never allow an unhandled driver error to print its credential-bearing details.
    client.on?.("error", error => { asynchronousError = error; });
    await client.connect();
    phase = "begin";
    await client.query(config.check ? "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN");
    transaction = true;
    phase = "configure";
    await client.query({ text: `SELECT pg_catalog.set_config('statement_timeout', $1, true),
      pg_catalog.set_config('lock_timeout', $2, true),
      pg_catalog.set_config('idle_in_transaction_session_timeout', $3, true),
      pg_catalog.set_config('search_path', pg_catalog.quote_ident($4), true)`,
      values: [String(config.statementTimeoutMs), String(config.lockTimeoutMs), String(config.statementTimeoutMs + 10_000), config.schema] });
    if (!config.check) {
      phase = "lock";
      await client.query("SELECT pg_catalog.pg_advisory_xact_lock(1397508419, 1397048149)");
    }
    phase = "foundations";
    const before = await inspectSchema(client, config.schema); verifyFoundations(before);
    if (config.check) verifyUpgrade(before, config.schema);
    else {
      verifyUpgradeable(before);
      phase = "apply";
      // Fixed release SQL only: no Prisma migration replay, schema reset, or fabricated migration-history records.
      await client.query(sql);
      phase = "verify";
      const after = await inspectSchema(client, config.schema); verifyFoundations(after); verifyUpgrade(after, config.schema);
    }
    if (asynchronousError) throw asynchronousError;
    phase = "commit";
    await client.query("COMMIT"); transaction = false;
    return { ok: true, mode: config.check ? "check" : "apply", connectionSource: config.connectionSource, schema: config.schema,
      migration: MIGRATION_NAME, sha256: fingerprint, verified: true, securityColumns: 15,
      message: config.check ? "Required account security tables, columns, and keys are present." : "The additive account security upgrade was applied and verified. Existing migration history was not changed." };
  } catch (error) {
    if (transaction && client) {
      try { await client.query({ text: "ROLLBACK", query_timeout: Math.min(5_000, config.connectionTimeoutMs) }); rollbackConfirmed = phase !== "commit"; } catch { /* Connection close is the remaining rollback boundary; never log a raw driver error. */ }
    }
    throw safeDatabaseError(error, phase, rollbackConfirmed);
  } finally { if (client) await closeClient(client, Math.min(5_000, config.connectionTimeoutMs)); }
}

export const HELP = `Usage: npm run db:security-upgrade -- [options]

Applies only the bundled additive account security migration in a transaction.
It never replays old migrations, resets a database, or changes migration history.
An existing Slice database with User, Session, and UserSecuritySetting is required.

Options:
  --check                        Verify required schema without changing tables or data.
  --schema NAME                  Schema to inspect/update (URL schema or public by default).
  --connection-timeout-ms N       Connection bound: 1000–60000; default 10000.
  --lock-timeout-ms N             Lock bound: 1000–120000; default 10000.
  --statement-timeout-ms N        Statement bound: 1000–900000; default 120000.
  --help, -h                     Show this help without connecting.

Both --flag=value and --flag value are supported for value options.
The lock bound must not exceed the statement bound. Timeouts cannot be disabled.
DIRECT_URL must use a direct or session PostgreSQL endpoint, not transaction pooling.
DATABASE_URL fallback is limited to loopback PostgreSQL outside production.
Next environment files are loaded from this project; existing parent variables win.
No database URLs or credentials are printed. Check mode exits 1 if schema is missing.
`;

export async function runUpgradeCli(argv = process.argv.slice(2), dependencies = {}) {
  const writeOut = dependencies.writeOut ?? (value => process.stdout.write(value));
  const writeError = dependencies.writeError ?? (value => process.stderr.write(value));
  try {
    const options = parseUpgradeArguments(argv);
    if (options.help) { writeOut(HELP); return 0; }
    (dependencies.loadEnvironment ?? loadUpgradeEnvironment)();
    const config = createUpgradeConfig(options, dependencies.environment ?? process.env);
    const result = await applyAccountSecurity(config, dependencies);
    writeOut(`${JSON.stringify(result, null, 2)}\n`); return 0;
  } catch (error) {
    const safe = error instanceof SecurityUpgradeError ? error : problem("INSTALLER_FAILED", "The account security installer could not complete. Check the local installation and configuration.");
    writeError(`${JSON.stringify({ ok: false, code: safe.code, message: safe.message, ...safe.details }, null, 2)}\n`); return 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await runUpgradeCli();
