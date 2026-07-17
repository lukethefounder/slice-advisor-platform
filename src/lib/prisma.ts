import {
  PrismaPg,
} from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";

const UPSERT_MAX_ATTEMPTS =
  3;

function getDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Missing DATABASE_URL. Slice requires a Postgres database connection string for runtime access.",
    );
  }

  if (
    !databaseUrl.startsWith(
      "postgresql://",
    ) &&
    !databaseUrl.startsWith(
      "postgres://",
    )
  ) {
    throw new Error(
      "Invalid DATABASE_URL. Slice requires a Postgres URL that starts with postgresql:// or postgres://.",
    );
  }

  return databaseUrl;
}

function isPrismaUniqueConstraintError(
  error: unknown,
): error is {
  code: "P2002";
} {
  if (
    typeof error !==
      "object" ||
    error ===
      null ||
    !(
      "code" in
      error
    )
  ) {
    return false;
  }

  return (
    (
      error as {
        code?: unknown;
      }
    ).code ===
    "P2002"
  );
}

function retryDelay(
  attempt: number,
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        10 *
        (
          attempt +
          1
        ),
      );
    },
  );
}

function createPrismaClient() {
  const adapter =
    new PrismaPg({
      connectionString:
        getDatabaseUrl(),
    });

  const client =
    new PrismaClient({
      adapter,

      log:
        process.env.NODE_ENV ===
        "development"
          ? [
              "warn",
              "error",
            ]
          : [
              "error",
            ],
    });

  return client.$extends({
    name:
      "slice-resilient-upserts",

    query: {
      $allModels: {
        async upsert({
          args,
          query,
        }) {
          for (
            let attempt =
              0;
            attempt <
            UPSERT_MAX_ATTEMPTS;
            attempt +=
              1
          ) {
            try {
              return await query(
                args,
              );
            } catch (error) {
              const finalAttempt =
                attempt ===
                UPSERT_MAX_ATTEMPTS -
                1;

              if (
                !isPrismaUniqueConstraintError(
                  error,
                ) ||
                finalAttempt
              ) {
                throw error;
              }

              await retryDelay(
                attempt,
              );
            }
          }

          throw new Error(
            "Prisma upsert retry loop ended unexpectedly.",
          );
        },
      },
    },
  });
}

type SlicePrismaClient =
  ReturnType<
    typeof createPrismaClient
  >;

const globalForPrisma =
  globalThis as unknown as {
    prisma?:
      SlicePrismaClient;
  };

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (
  process.env.NODE_ENV !==
  "production"
) {
  globalForPrisma.prisma =
    prisma;
}