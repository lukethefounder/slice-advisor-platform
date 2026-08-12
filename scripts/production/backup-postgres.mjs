import { chmodSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";

import {
  loadEnvironmentFiles,
  parseArguments,
  parsePostgresUrl,
  postgresEnvironment,
  runCommand,
  safeDatabaseIdentity,
  sha256File,
} from "./postgres-utils.mjs";

loadEnvironmentFiles();
const args = parseArguments();
const connection = parsePostgresUrl(
  args.get("url") || process.env.DIRECT_URL || process.env.DATABASE_URL,
);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const configuredDirectory =
  args.get("directory") || process.env.BACKUP_DIRECTORY || "./backups";
const requestedOutput = args.get("output");
const output = resolve(
  process.cwd(),
  requestedOutput || `${configuredDirectory}/slice-${timestamp}.dump`,
);
const publicDirectory = resolve(process.cwd(), "public");

if (output === publicDirectory || output.startsWith(`${publicDirectory}${sep}`)) {
  throw new Error("Database backups must never be written inside public/.");
}

mkdirSync(dirname(output), { recursive: true });

await runCommand(
  process.platform === "win32" ? "pg_dump.exe" : "pg_dump",
  [
    "--format=custom",
    "--compress=6",
    "--no-owner",
    "--no-privileges",
    "--file",
    output,
  ],
  { env: postgresEnvironment(connection) },
);

const checksum = await sha256File(output);
const manifestPath = `${output}.manifest.json`;
const manifest = {
  schemaVersion: "slice-postgres-backup-1.0.0",
  createdAt: new Date().toISOString(),
  fileName: basename(output),
  bytes: statSync(output).size,
  sha256: checksum,
  format: "PostgreSQL custom archive",
  database: safeDatabaseIdentity(connection),
  commitSha:
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (process.platform !== "win32") {
  chmodSync(output, 0o600);
  chmodSync(manifestPath, 0o600);
}

process.stdout.write(
  `${JSON.stringify({ ok: true, output, manifestPath, sha256: checksum, bytes: manifest.bytes }, null, 2)}\n`,
);