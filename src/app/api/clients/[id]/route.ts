import { getCurrentUser } from "@/lib/auth";
import {
  canManageClientRouting,
  ensureAdvisorFirmContext,
} from "@/lib/client-access";
import { prisma } from "@/lib/prisma";
import {
  cleanEmail,
  cleanNullableText,
  cleanText,
  hasSensitiveActionConfirmation,
  noStoreJson,
  protectClientDataRoute,
  redactClientForSummary,
  recordClientMutation,
  requireClientAccess,
} from "@/lib/client-data-security";
import {
  decryptClientProfile,
  encryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>,
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client request.",
      },
      { status: 403 },
    )
  );
}

function clientAccessResponse(
  access: Awaited<ReturnType<typeof requireClientAccess>>,
) {
  return (
    access.response ??
    noStoreJson(
      {
        error: "Client access denied.",
      },
      { status: 404 },
    )
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.read",
    title: "Client profile read",
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const { id } = await context.params;

    const access = await requireClientAccess({
      user,
      clientId: id,
      scope: "read",
      request,
    });

    if (!access.allowed) {
      return clientAccessResponse(access);
    }

    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "full";

    const rawClient = await prisma.clientProfile.findFirst({
      where: {
        id,
      },
      include: {
        holdings: true,
        notesList: {
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!rawClient) {
      return noStoreJson({ error: "Client not found." }, { status: 404 });
    }

    const client = decryptClientProfile(rawClient);

    return noStoreJson({
      client: view === "summary" ? redactClientForSummary(client) : client,
      view,
      redacted: view === "summary",
      vault: vaultStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load client profile.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.update",
    title: "Client profile update",
    limit: 50,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const { id } = await context.params;

    const access = await requireClientAccess({
      user,
      clientId: id,
      scope: "write",
      request,
    });

    if (!access.allowed) {
      return clientAccessResponse(access);
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    let email: string | null | undefined = undefined;

    if (typeof body.email === "string") {
      email = body.email.trim() ? cleanEmail(body.email) : null;

      if (body.email.trim() && !email) {
        return noStoreJson(
          { error: "Client email is invalid." },
          { status: 400 },
        );
      }
    }

    await prisma.clientProfile.updateMany({
      where: {
        id,
      },
      data: {
        fullName:
          typeof body.fullName === "string"
            ? cleanText(body.fullName)
            : undefined,
        email:
          typeof body.email === "string"
            ? encryptSensitiveText(email)
            : undefined,
        householdName:
          typeof body.householdName === "string"
            ? cleanNullableText(body.householdName)
            : undefined,
        clientType:
          typeof body.clientType === "string"
            ? cleanText(body.clientType)
            : undefined,
        riskProfile:
          typeof body.riskProfile === "string"
            ? cleanText(body.riskProfile)
            : undefined,
        liquidityNeeds:
          typeof body.liquidityNeeds === "string"
            ? cleanText(body.liquidityNeeds)
            : undefined,
        timeHorizon:
          typeof body.timeHorizon === "string"
            ? cleanText(body.timeHorizon)
            : undefined,
        objective:
          typeof body.objective === "string"
            ? cleanText(body.objective)
            : undefined,
        portfolioValue:
          typeof body.portfolioValue === "string"
            ? encryptSensitiveText(cleanNullableText(body.portfolioValue))
            : undefined,
        status:
          typeof body.status === "string"
            ? cleanText(body.status)
            : undefined,
        notes:
          typeof body.notes === "string"
            ? encryptSensitiveText(cleanNullableText(body.notes))
            : undefined,
      },
    });

    const rawClient = await prisma.clientProfile.findFirst({
      where: {
        id,
      },
    });

    await recordClientMutation({
      user,
      request,
      clientId: id,
      action: "update",
      title: "Client profile updated",
      detail:
        "A client profile was updated through the protected client-data API.",
      metadata: {
        changedFields: Object.keys(body).filter(
          (key) => typeof body[key] !== "undefined",
        ),
        vault: vaultStatus(),
      },
    });

    return noStoreJson({
      client: rawClient ? decryptClientProfile(rawClient) : null,
      vault: vaultStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update client profile.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.delete",
    title: "Client profile deletion",
    limit: 10,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const { id } = await context.params;
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
      clientId: id,
      scope: "delete",
      request,
    });

    if (!access.allowed) {
      return clientAccessResponse(access);
    }

    if (!hasSensitiveActionConfirmation(request, "confirm-delete-client")) {
      await recordClientMutation({
        user,
        request,
        clientId: id,
        action: "delete.blocked_missing_confirmation",
        title: "Client deletion blocked",
        detail:
          "A client deletion was blocked because the required sensitive-action confirmation header was missing.",
      });

      return noStoreJson(
        {
          error:
            "Sensitive action confirmation is required. Send x-slice-sensitive-action: confirm-delete-client.",
        },
        { status: 403 },
      );
    }

    await prisma.clientProfile.deleteMany({
      where: {
        id,
      },
    });

    await recordClientMutation({
      user,
      request,
      clientId: id,
      action: "delete",
      title: "Client profile deleted",
      detail:
        "A client profile was deleted through the protected client-data API.",
    });

    return noStoreJson({ ok: true });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete client profile.",
      },
      { status: 500 },
    );
  }
}