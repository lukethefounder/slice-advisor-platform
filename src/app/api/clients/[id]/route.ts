import "server-only";

import {
  clientScopeWhere,
  hasFirmPermission,
} from "@/lib/access-control";
import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import {
  hasSensitiveActionConfirmation,
  noStoreJson,
  protectClientDataRoute,
  recordClientMutation,
} from "@/lib/client-data-security";
import { dispatchClientMutation } from "@/lib/clients/mutations";
import {
  getClientCompatibilityDetail,
  getClientDetail,
  requireClientRepositoryContext,
} from "@/lib/clients/repository";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function authenticatedUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
      expose: true,
    });
  }

  return user;
}

function protectedResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>,
) {
  return (
    protection.response ??
    noStoreJson(
      { error: "Security policy blocked this client-data request." },
      { status: 403 },
    )
  );
}

async function exposeClientErrors(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.expose) {
      return apiJson(
        {
          ok: false,
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    throw error;
  }
}

export const GET = async (request: Request, routeContext: RouteContext) => {
  const handler = withApiRoute(
    {
      route: "/api/clients/[id]",
      timeoutMs: 12_000,
      cacheControl: "private, no-store, max-age=0",
    },
    async () =>
      exposeClientErrors(async () => {
        const user = await authenticatedUser();
        const protection = await protectClientDataRoute({
          request,
          user,
          area: "Client Data",
          eventType: "client.read",
          title: "Client profile read",
          limit: 120,
          windowMs: 60 * 1000,
        });

        if (!protection.allowed) return protectedResponse(protection);

        const { id } = await routeContext.params;
        const clientId = id.trim();

        if (!clientId) {
          throw new ApiError({
            status: 400,
            code: "CLIENT_ID_REQUIRED",
            message: "Client ID is required.",
            expose: true,
          });
        }

        const context = await requireClientRepositoryContext(user.id);
        const view = new URL(request.url).searchParams.get("view") ?? "overview";

        if (view === "compat") {
          return apiJson({
            ok: true,
            client: await getClientCompatibilityDetail({
              context,
              clientId,
            }),
            compatibility: {
              bounded: true,
              childCollectionLimit: 25,
            },
          });
        }

        if (view !== "overview") {
          throw new ApiError({
            status: 400,
            code: "INVALID_CLIENT_VIEW",
            message: "view must be overview or compat.",
            expose: true,
          });
        }

        return apiJson({
          ok: true,
          client: await getClientDetail({
            context,
            clientId,
          }),
          sections: [
            "holdings",
            "notes",
            "tasks",
            "documents",
            "risk-reviews",
            "briefings",
          ],
          sectionPageSize: 25,
        });
      }),
  );

  return handler(request);
};

export const PATCH = async (request: Request, routeContext: RouteContext) => {
  const handler = withApiRoute(
    {
      route: "/api/clients/[id]",
      timeoutMs: 15_000,
      cacheControl: "private, no-store, max-age=0",
    },
    async () =>
      exposeClientErrors(async () => {
        const user = await authenticatedUser();
        const protection = await protectClientDataRoute({
          request,
          user,
          area: "Client Data",
          eventType: "client.update",
          title: "Client profile update",
          limit: 50,
          windowMs: 60 * 1000,
        });

        if (!protection.allowed) return protectedResponse(protection);

        const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

        if (!contentType.includes("application/json")) {
          throw new ApiError({
            status: 415,
            code: "JSON_REQUIRED",
            message: "This endpoint requires an application/json request body.",
            expose: true,
          });
        }

        const { id } = await routeContext.params;
        let body: Record<string, unknown>;

        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          throw new ApiError({
            status: 400,
            code: "INVALID_JSON",
            message: "The request body is not valid JSON.",
            expose: true,
          });
        }

        return apiJson(
          await dispatchClientMutation({
            user,
            request,
            body: {
              ...body,
              action: "updateClient",
              clientId: id,
            },
          }),
        );
      }),
  );

  return handler(request);
};

export const DELETE = async (request: Request, routeContext: RouteContext) => {
  const handler = withApiRoute(
    {
      route: "/api/clients/[id]",
      timeoutMs: 15_000,
      cacheControl: "private, no-store, max-age=0",
    },
    async () =>
      exposeClientErrors(async () => {
        const user = await authenticatedUser();
        const protection = await protectClientDataRoute({
          request,
          user,
          area: "Client Data",
          eventType: "client.delete",
          title: "Client profile deletion",
          limit: 10,
          windowMs: 60 * 1000,
        });

        if (!protection.allowed) return protectedResponse(protection);

        const { id } = await routeContext.params;
        const clientId = id.trim();
        const context = await requireClientRepositoryContext(user.id);

        if (
          !hasFirmPermission(context, "clients.assign") &&
          !hasFirmPermission(context, "firm.manage")
        ) {
          throw new ApiError({
            status: 403,
            code: "CLIENT_DELETE_PERMISSION_REQUIRED",
            message:
              "Lead-advisor or firm-management access is required to delete a client profile.",
            expose: true,
          });
        }

        if (!hasSensitiveActionConfirmation(request, "confirm-delete-client")) {
          throw new ApiError({
            status: 403,
            code: "SENSITIVE_CONFIRMATION_REQUIRED",
            message:
              "Sensitive action confirmation is required. Send x-slice-sensitive-action: confirm-delete-client.",
            expose: true,
          });
        }

        const existing = await prisma.clientProfile.findFirst({
          where: {
            id: clientId,
            ...clientScopeWhere(context),
          },
          select: {
            id: true,
            fullName: true,
          },
        });

        if (!existing) {
          throw new ApiError({
            status: 404,
            code: "CLIENT_NOT_FOUND",
            message: "Client not found.",
            expose: true,
          });
        }

        const activeDocumentCount = await prisma.documentVaultItem.count({
          where: {
            clientId,
            deletedAt: null,
          },
        });

        if (activeDocumentCount > 0) {
          throw new ApiError({
            status: 409,
            code: "CLIENT_DOCUMENT_RETENTION_REVIEW_REQUIRED",
            message:
              "Resolve the client’s active secure documents before deleting the client profile.",
            expose: true,
            details: {
              activeDocumentCount,
              actionUrl: `/workspace/documents?clientId=${encodeURIComponent(clientId)}`,
            },
          });
        }

        const [, result] = await prisma.$transaction([
          prisma.documentVaultItem.updateMany({
            where: {
              clientId,
              deletedAt: {
                not: null,
              },
            },
            data: {
              clientId: null,
            },
          }),
          prisma.clientProfile.deleteMany({
            where: {
              id: clientId,
              ...clientScopeWhere(context),
            },
          }),
        ]);

        if (!result.count) {
          throw new ApiError({
            status: 404,
            code: "CLIENT_NOT_FOUND",
            message: "Client not found.",
            expose: true,
          });
        }

        await recordClientMutation({
          user,
          request,
          clientId,
          action: "delete",
          title: "Client profile deleted",
          detail:
            "An authorized firm manager deleted the client profile after secure-document retention checks passed.",
          metadata: {
            clientName: existing.fullName,
            deletedCount: result.count,
            firmId: context.firm?.id ?? null,
            activeDocumentCount,
            retainedDocumentAuditRecords: true,
          },
        });

        return apiJson({
          ok: true,
          clientId,
          deleted: true,
        });
      }),
  );

  return handler(request);
};