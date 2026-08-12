import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { getCurrentUser } from "@/lib/auth";
import {
  clientScopeWhere,
  hasFirmPermission,
  requireCurrentAccessContext,
} from "@/lib/access-control";
import {
  cleanText,
  hasSensitiveActionConfirmation,
  protectClientDataRoute,
  recordClientMutation,
} from "@/lib/client-data-security";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Compatibility endpoint retained for older client screens.
 * Newer code should use DELETE /api/clients/[id].
 */
export const POST = withApiRoute(
  {
    route: "/api/clients/delete",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const user = await getCurrentUser();

    if (!user) {
      throw new ApiError({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required.",
        expose: true,
      });
    }

    const protection = await protectClientDataRoute({
      request,
      user,
      area: "Client Data",
      eventType: "client.delete",
      title: "Client profile deletion",
      limit: 10,
      windowMs: 60_000,
    });

    if (!protection.allowed) return protection.response!;

    if (!hasSensitiveActionConfirmation(request, "confirm-delete-client")) {
      throw new ApiError({
        status: 403,
        code: "SENSITIVE_CONFIRMATION_REQUIRED",
        message:
          "Sensitive action confirmation is required. Send x-slice-sensitive-action: confirm-delete-client.",
        expose: true,
      });
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const clientId = cleanText(body?.clientId);

    if (!clientId) {
      throw new ApiError({
        status: 400,
        code: "CLIENT_ID_REQUIRED",
        message: "Client ID is required.",
        expose: true,
      });
    }

    const context = await requireCurrentAccessContext();

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
  },
);