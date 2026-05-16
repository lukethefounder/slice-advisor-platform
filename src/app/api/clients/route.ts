import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cleanEmail,
  cleanNullableText,
  cleanText,
  noStoreJson,
  protectClientDataRoute,
  redactClientForSummary,
  recordClientMutation,
} from "@/lib/client-data-security";
import {
  decryptClientProfiles,
  encryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function protectedRouteResponse(
  protection: Awaited<ReturnType<typeof protectClientDataRoute>>
) {
  return (
    protection.response ??
    noStoreJson(
      {
        error: "Security policy blocked this client data request.",
      },
      { status: 403 }
    )
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.list",
    title: "Client list access",
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "full";

    const rawClients = await prisma.clientProfile.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: "desc" },
    });

    const clients = decryptClientProfiles(rawClients);

    const payload =
      view === "summary"
        ? {
            clients: clients.map(redactClientForSummary),
            view: "summary",
            redacted: true,
            vault: vaultStatus(),
          }
        : {
            clients,
            view: "full",
            redacted: false,
            vault: vaultStatus(),
          };

    return noStoreJson(payload);
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load client profiles.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const protection = await protectClientDataRoute({
    request,
    user,
    area: "Client Data",
    eventType: "client.create",
    title: "Client profile creation",
    limit: 30,
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

    const fullName = cleanText(body.fullName);

    if (!fullName) {
      return noStoreJson(
        { error: "Client full name is required." },
        { status: 400 }
      );
    }

    const email = cleanEmail(body.email);

    if (body.email && !email) {
      return noStoreJson(
        { error: "Client email is invalid." },
        { status: 400 }
      );
    }

    const client = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        fullName,
        email: encryptSensitiveText(email),
        householdName: cleanNullableText(body.householdName),
        clientType: cleanText(body.clientType, "Private Client"),
        riskProfile: cleanText(body.riskProfile, "Balanced"),
        liquidityNeeds: cleanText(body.liquidityNeeds, "Moderate"),
        timeHorizon: cleanText(body.timeHorizon, "5-10 years"),
        objective: cleanText(body.objective, "Long-term wealth growth"),
        portfolioValue: encryptSensitiveText(
          cleanNullableText(body.portfolioValue)
        ),
        status: cleanText(body.status, "Active"),
        notes: encryptSensitiveText(cleanNullableText(body.notes)),
      },
    });

    await recordClientMutation({
      user,
      request,
      clientId: client.id,
      action: "create",
      title: "Client profile created",
      detail:
        "A client profile was created through the protected client-data API.",
      metadata: {
        hasEmail: Boolean(email),
        hasNotes: Boolean(body.notes),
        clientType: client.clientType,
        riskProfile: client.riskProfile,
        vault: vaultStatus(),
      },
    });

    return noStoreJson({
      client: decryptClientProfiles([client])[0],
      vault: vaultStatus(),
    });
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create client profile.",
      },
      { status: 500 }
    );
  }
}