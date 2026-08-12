import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function cleanValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvironmentFiles() {
  const externallyDefined = new Set(Object.keys(process.env));

  for (const [name, allowLocalOverride] of [
    [".env", false],
    [".env.local", true],
  ]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = cleanValue(line.slice(separator + 1));

      // Shell, CI, and deployment variables always win. .env.local may only
      // override a value that came from .env during this loader invocation.
      if (externallyDefined.has(key)) continue;
      if (allowLocalOverride || process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function parseArguments(argv = process.argv.slice(2)) {
  const output = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const inline = item.indexOf("=");
    if (inline > 2) {
      output.set(item.slice(2, inline), item.slice(inline + 1));
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      output.set(key, next);
      index += 1;
    } else {
      output.set(key, "true");
    }
  }
  return output;
}

export function parsePostgresUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) throw new Error("A PostgreSQL connection URL is required.");
  const url = new URL(value);
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("The database URL must use postgres:// or postgresql://.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("The database URL does not identify a database.");

  return {
    raw: value,
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslMode: url.searchParams.get("sslmode") || "prefer",
  };
}

export function postgresEnvironment(connection, extra = {}) {
  return {
    ...process.env,
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGUSER: connection.user,
    PGPASSWORD: connection.password,
    PGDATABASE: connection.database,
    PGSSLMODE: connection.sslMode,
    ...extra,
  };
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}${
            stderr.trim() ? `: ${stderr.trim().slice(0, 2_000)}` : ""
          }`,
        ),
      );
    });
  });
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  const stream = createReadStream(file);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

export async function verifyBackupArchive(input) {
  const file = resolve(process.cwd(), input.file);
  const manifestPath = input.manifest
    ? resolve(process.cwd(), input.manifest)
    : `${file}.manifest.json`;

  if (!existsSync(file)) throw new Error(`Backup file not found: ${file}`);
  if (!existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const checksum = await sha256File(file);

  if (checksum !== manifest.sha256) {
    throw new Error("Backup checksum does not match its manifest.");
  }

  const listing = await runCommand(
    process.platform === "win32" ? "pg_restore.exe" : "pg_restore",
    ["--list", file],
    { capture: true },
  );
  const entries = listing.stdout
    .split(/\r?\n/)
    .filter((line) => /^\d+;/.test(line.trim()));

  if (!entries.length) {
    throw new Error("pg_restore did not find archive entries.");
  }

  return {
    file,
    manifestPath,
    manifest,
    checksum,
    archiveEntries: entries.length,
  };
}

export function safeDatabaseIdentity(connection) {
  return {
    host: connection.host,
    port: connection.port,
    database: connection.database,
    sslMode: connection.sslMode,
  };
}