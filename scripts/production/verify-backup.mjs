import { parseArguments, verifyBackupArchive } from "./postgres-utils.mjs";

const args = parseArguments();
const fileValue = args.get("file") || args.get("backup");
if (!fileValue) throw new Error("Pass --file <backup.dump>.");

const verified = await verifyBackupArchive({
  file: fileValue,
  manifest: args.get("manifest"),
});

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      file: verified.file,
      manifestPath: verified.manifestPath,
      sha256: verified.checksum,
      archiveEntries: verified.archiveEntries,
      database: verified.manifest.database,
    },
    null,
    2,
  )}\n`,
);