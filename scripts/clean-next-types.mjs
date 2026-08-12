import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

/*
 * Remove the complete Next.js compiler output instead of deleting selected
 * declaration folders. A Turbopack "module factory is not available" error
 * means the browser and development server can be holding different module
 * graphs; partial cleanup can leave the stale graph behind.
 *
 * Every removed path is generated and recreated by npm install, next typegen,
 * next dev, or next build. Source files, environment files, Prisma migrations,
 * uploaded documents, and database data are not touched.
 */
const targets = [
  ".next",
  ".turbo",
  "node_modules/.cache",
  "next-env.d.ts",
  "tsconfig.tsbuildinfo",
];

const removed = [];
const failures = [];

for (const target of targets) {
  const absolutePath = resolve(
    root,
    target,
  );

  try {
    await rm(
      absolutePath,
      {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      },
    );

    removed.push(
      target,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown cleanup error.";

    failures.push({
      target,
      message,
    });
  }
}

if (failures.length) {
  const details = failures
    .map(
      ({
        target,
        message,
      }) =>
        `- ${target}: ${message}`,
    )
    .join("\n");

  throw new Error(
    "Unable to clear every generated Next.js cache. Stop all running Slice " +
      `development servers and retry.\n${details}`,
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      action:
        "clean-complete-next-compiler-output",
      removed,
      cleanedAt:
        new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);