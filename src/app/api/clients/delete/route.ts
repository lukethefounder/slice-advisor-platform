import { getCurrentUser } from "@/lib/auth";
import {
  canManageClientRouting,
  ensureAdvisorFirmContext,
} from "@/lib/client-access";
import { prisma } from "@/lib/prisma";
import {
  cleanText,
  noStoreJson,
  protectClientDataRoute,
  recordClientMutation,
  requireClientAccess,
} from "@/lib/client-data-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>,
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client delete request.",
      },
      { status: 403 },
    )
  );
}

export async function POST(request: Request) {
  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.delete",
    title: "Client profile deletion",
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const clientId = cleanText(body.clientId);

    if (!clientId) {
      return noStoreJson(
        { error: "Client ID is required." },
        { status: 400 },
      );
    }

    const membership = await ensureAdvisorFirmContext(user.id);

    if (!canManageClientRouting(membership)) {
      return noStoreJson(
        {
          error:
            "Lead-advisor or firm-management access is required to delete a client profile.",
        },
        { status: 403 },
      );
    }

    const access = await requireClientAccess({
      user,
      request,
      clientId,
      scope: "delete",
    });

    if (!access.allowed) {
      return access.response!;
    }

    const client = await prisma.clientProfile.findFirst({
      where: {
        id: clientId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    if (!client) {
      return noStoreJson({ error: "Client not found." }, { status: 404 });
    }

    await recordClientMutation({
      user,
      request,
      clientId,
      action: "delete",
      title: "Client profile deleted",
      detail:
        "A client profile and related client records were deleted through the protected client-data API.",
      metadata: {
        fullName: client.fullName,
      },
    });

    await prisma.$transaction([
      prisma.portfolioHolding.deleteMany({
        where: {
          clientId,
        },
      }),
      prisma.advisorNote.deleteMany({
        where: {
          clientId,
        },
      }),
      prisma.meetingTask.deleteMany({
        where: {
          clientId,
        },
      }),
      prisma.riskReview.deleteMany({
        where: {
          clientId,
        },
      }),
      prisma.documentVaultItem.deleteMany({
        where: {
          clientId,
        },
      }),
      prisma.clientProfile.deleteMany({
        where: {
          id: clientId,
        },
      }),
    ]);

    return noStoreJson({
      ok: true,
      deletedClientId: clientId,
      deletedClientName: client.fullName,
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Client deletion failed.",
      },
      { status: 500 },
    );
  }
}