import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  encryptSecret,
  safeJsonParse,
} from "@/lib/secret-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdvisorSourceRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanString(
  value: unknown,
  fallback = "",
) {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function sanitizeHeaders(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return undefined;
  }

  const headers =
    value as Record<
      string,
      unknown
    >;

  const sanitized: Record<
    string,
    string
  > = {};

  for (
    const [
      key,
      rawValue,
    ] of Object.entries(
      headers,
    )
  ) {
    const headerName =
      key.trim();

    if (!headerName) {
      continue;
    }

    /*
     * Authentication credentials are stored through the encrypted
     * secret field, not inside the ordinary headers JSON.
     */
    if (
      /authorization|api[-_ ]?key|token|secret|password|cookie/i.test(
        headerName,
      )
    ) {
      continue;
    }

    if (
      typeof rawValue ===
        "string" &&
      rawValue.trim()
    ) {
      sanitized[
        headerName
      ] = rawValue.trim();
    }
  }

  return JSON.stringify(
    sanitized,
  );
}

async function resolveSourceId(
  context:
    AdvisorSourceRouteContext,
) {
  /*
   * Dynamic App Router params are asynchronous in the current
   * Next.js route-handler contract.
   */
  const { id } =
    await context.params;

  const sourceId =
    cleanString(id);

  if (!sourceId) {
    throw new Error(
      "Advisor source ID is required.",
    );
  }

  return sourceId;
}

export async function PATCH(
  request: Request,
  context:
    AdvisorSourceRouteContext,
) {
  try {
    const user =
      await requireCurrentUser();

    const id =
      await resolveSourceId(
        context,
      );

    const body =
      (await request
        .json()
        .catch(
          () => ({}),
        )) as Record<
        string,
        unknown
      >;

    const existing =
      await prisma.advisorRealtimeSource.findFirst(
        {
          where: {
            id,
            userId:
              user.id,
          },
        },
      );

    if (!existing) {
      return Response.json(
        {
          error:
            "Advisor source not found.",
        },
        {
          status: 404,
        },
      );
    }

    const authHeaderName =
      cleanString(
        body.authHeaderName,
      );

    const authHeaderValue =
      cleanString(
        body.authHeaderValue,
      );

    if (
      /cookie|password/i.test(
        authHeaderName,
      )
    ) {
      throw new Error(
        "Do not store website passwords, browser cookies, or paywall session cookies. Use approved API credentials.",
      );
    }

    const encryptedSecretJson =
      authHeaderName &&
      authHeaderValue
        ? encryptSecret(
            JSON.stringify(
              {
                authHeaderName,
                authHeaderValue,
              },
            ),
          )
        : undefined;

    const headersJson =
      sanitizeHeaders(
        body.headers,
      );

    const updated =
      await prisma.advisorRealtimeSource.update(
        {
          where: {
            id,
          },

          data: {
            name:
              typeof body.name ===
              "string"
                ? body.name.trim()
                : undefined,

            platformType:
              typeof body.platformType ===
              "string"
                ? body.platformType.trim()
                : undefined,

            enabled:
              typeof body.enabled ===
              "boolean"
                ? body.enabled
                : undefined,

            termsAcknowledged:
              typeof body.termsAcknowledged ===
              "boolean"
                ? body.termsAcknowledged
                : undefined,

            headersJson,
            encryptedSecretJson,

            minScoreToRetain:
              Number.isFinite(
                Number(
                  body.minScoreToRetain,
                ),
              )
                ? Math.max(
                    1,
                    Math.min(
                      100,
                      Number(
                        body.minScoreToRetain,
                      ),
                    ),
                  )
                : undefined,

            minScoreToAlert:
              Number.isFinite(
                Number(
                  body.minScoreToAlert,
                ),
              )
                ? Math.max(
                    1,
                    Math.min(
                      100,
                      Number(
                        body.minScoreToAlert,
                      ),
                    ),
                  )
                : undefined,

            maxItemsPerRun:
              Number.isFinite(
                Number(
                  body.maxItemsPerRun,
                ),
              )
                ? Math.max(
                    1,
                    Math.min(
                      100,
                      Number(
                        body.maxItemsPerRun,
                      ),
                    ),
                  )
                : undefined,
          },
        },
      );

    return Response.json({
      source: {
        ...updated,

        headers:
          safeJsonParse(
            updated.headersJson,
            {},
          ),

        /*
         * Never include the encrypted secret value in the API response.
         */
        encryptedSecretJson:
          undefined,

        hasSecret:
          Boolean(
            updated.encryptedSecretJson,
          ),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          "Unable to update advisor source.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 400,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context:
    AdvisorSourceRouteContext,
) {
  try {
    const user =
      await requireCurrentUser();

    const id =
      await resolveSourceId(
        context,
      );

    const existing =
      await prisma.advisorRealtimeSource.findFirst(
        {
          where: {
            id,
            userId:
              user.id,
          },
        },
      );

    if (!existing) {
      return Response.json(
        {
          error:
            "Advisor source not found.",
        },
        {
          status: 404,
        },
      );
    }

    await prisma.advisorRealtimeSource.delete(
      {
        where: {
          id,
        },
      },
    );

    return Response.json({
      ok: true,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          "Unable to delete advisor source.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 400,
      },
    );
  }
}