import {
  loadEnvironmentFiles,
  parseArguments,
  parsePostgresUrl,
  postgresEnvironment,
  runCommand,
  safeDatabaseIdentity,
  verifyBackupArchive,
} from "./postgres-utils.mjs";

loadEnvironmentFiles();
const args = parseArguments();
const fileValue = args.get("file") || args.get("backup");
if (!fileValue) throw new Error("Pass --file <backup.dump>.");
const confirmation = args.get("confirm");
const targetValue = args.get("target") || process.env.DATABASE_RESTORE_URL;
if (!targetValue) {
  throw new Error(
    "Pass --target or configure DATABASE_RESTORE_URL for a dedicated restore database.",
  );
}

const verified = await verifyBackupArchive({
  file: fileValue,
  manifest: args.get("manifest"),
});
const target = parsePostgresUrl(targetValue);
const runtimeDatabase = process.env.DATABASE_URL
  ? parsePostgresUrl(process.env.DATABASE_URL)
  : null;
const sameAsRuntime = Boolean(
  runtimeDatabase &&
    runtimeDatabase.host === target.host &&
    runtimeDatabase.port === target.port &&
    runtimeDatabase.database === target.database,
);
const productionTarget =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production" ||
  sameAsRuntime;

if (productionTarget) {
  if (
    String(process.env.ALLOW_PRODUCTION_RESTORE).toLowerCase() !== "true" ||
    confirmation !== "RESTORE-PRODUCTION"
  ) {
    throw new Error(
      "Production restore is blocked. Set ALLOW_PRODUCTION_RESTORE=true and pass --confirm=RESTORE-PRODUCTION only during an approved incident.",
    );
  }
} else if (confirmation !== "RESTORE") {
  throw new Error("Restore requires --confirm=RESTORE.");
}

await runCommand(
  process.platform === "win32" ? "pg_restore.exe" : "pg_restore",
  [
    "--exit-on-error",
    "--single-transaction",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    target.database,
    verified.file,
  ],
  { env: postgresEnvironment(target) },
);

await runCommand(
  process.platform === "win32" ? "psql.exe" : "psql",
  ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--command", "SELECT 1;"],
  { env: postgresEnvironment(target), capture: true },
);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      restoredFile: verified.file,
      verifiedSha256: verified.checksum,
      archiveEntries: verified.archiveEntries,
      target: safeDatabaseIdentity(target),
      productionTarget,
    },
    null,
    2,
  )}\n`,
);