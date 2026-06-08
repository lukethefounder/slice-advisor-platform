import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cleanEmail,
  cleanMoneyLike,
  cleanNullableText,
  cleanText,
  cleanTicker,
  noStoreJson,
  protectClientDataRoute,
  recordClientMutation,
  requireClientAccess,
} from "@/lib/client-data-security";
import {
  decryptClientProfiles,
  encryptSensitiveText,
  vaultStatus,
} from "@/lib/data-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

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

function readAction(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "createClient";
}

function parseDate(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return null;

  const date = new Date(`${clean}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function parseScore(value: unknown) {
  const score = Number(value);

  if (!Number.isFinite(score)) return 70;

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function findClientForUser(userId: string, clientId: string) {
  return prisma.clientProfile.findFirst({
    where: {
      id: clientId,
      userId,
    },
    include: {
      holdings: {
        orderBy: {
          createdAt: "desc",
        },
      },
      notesList: {
        orderBy: {
          createdAt: "desc",
        },
      },
      tasks: {
        orderBy: {
          createdAt: "desc",
        },
      },
      reviews: {
        orderBy: {
          createdAt: "desc",
        },
      },
      documents: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

async function loadSingleClient(user: CurrentUserShape, clientId: string) {
  const client = await findClientForUser(user.id, clientId);

  if (!client) return null;

  return decryptClientProfiles([client])[0];
}

async function loadClientPayload(user: CurrentUserShape, view = "full") {
  const rawClients = await prisma.clientProfile.findMany({
    where: {
      userId: user.id,
    },
    include: {
      holdings: {
        orderBy: {
          createdAt: "desc",
        },
      },
      notesList: {
        orderBy: {
          createdAt: "desc",
        },
      },
      tasks: {
        orderBy: {
          createdAt: "desc",
        },
      },
      reviews: {
        orderBy: {
          createdAt: "desc",
        },
      },
      documents: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const clients = decryptClientProfiles(rawClients);

  const holdingsCount = clients.reduce(
    (sum, client) => sum + (client.holdings?.length ?? 0),
    0
  );

  const emailReadyCount = clients.filter((client) => Boolean(client.email)).length;
  const activeCount = clients.filter((client) => client.status === "Active").length;
  const reviewCount = clients.filter(
    (client) =>
      client.status !== "Active" ||
      client.riskProfile === "Aggressive" ||
      client.riskProfile === "Conservative"
  ).length;

  return {
    clients,
    view,
    redacted: false,
    vault: vaultStatus(),
    metrics: {
      clientCount: clients.length,
      activeCount,
      emailReadyCount,
      missingEmailCount: clients.length - emailReadyCount,
      holdingsCount,
      reviewCount,
      notesCount: clients.reduce(
        (sum, client) => sum + (client.notesList?.length ?? 0),
        0
      ),
      taskCount: clients.reduce(
        (sum, client) => sum + (client.tasks?.length ?? 0),
        0
      ),
      documentCount: clients.reduce(
        (sum, client) => sum + (client.documents?.length ?? 0),
        0
      ),
    },
    privacy: {
      holdingsMode: "Security names and symbols only. Position amounts are intentionally not required.",
      amountStorage: "Portfolio values and allocations are optional and are not shown in this client profile workspace.",
    },
  };
}

async function requireOwnedClient(input: {
  user: CurrentUserShape;
  request: Request;
  clientId: string;
  scope: "read" | "write" | "delete" | "export" | "email";
}) {
  const access = await requireClientAccess({
    user: input.user,
    request: input.request,
    clientId: input.clientId,
    scope: input.scope,
  });

  return access;
}

async function createClient(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const fullName = cleanText(input.body.fullName);

  if (!fullName) {
    return noStoreJson({ error: "Client full name is required." }, { status: 400 });
  }

  const email = cleanEmail(input.body.email);

  if (input.body.email && cleanText(input.body.email) && !email) {
    return noStoreJson({ error: "Client email is invalid." }, { status: 400 });
  }

  const client = await prisma.clientProfile.create({
    data: {
      userId: input.user.id,
      fullName,
      email: encryptSensitiveText(email),
      householdName: cleanNullableText(input.body.householdName),
      clientType: cleanText(input.body.clientType, "Private Client"),
      riskProfile: cleanText(input.body.riskProfile, "Balanced"),
      liquidityNeeds: cleanText(input.body.liquidityNeeds, "Moderate"),
      timeHorizon: cleanText(input.body.timeHorizon, "5-10 years"),
      objective: cleanText(input.body.objective, "Long-term wealth growth"),
      portfolioValue: encryptSensitiveText(cleanMoneyLike(input.body.portfolioValue)),
      status: cleanText(input.body.status, "Active"),
      notes: encryptSensitiveText(cleanNullableText(input.body.notes)),
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId: client.id,
    action: "create",
    title: "Client profile created",
    detail: "A client profile was created through the protected client-data API.",
    metadata: {
      hasEmail: Boolean(email),
      hasNotes: Boolean(input.body.notes),
      clientType: client.clientType,
      riskProfile: client.riskProfile,
      vault: vaultStatus(),
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, client.id),
    ...(await loadClientPayload(input.user)),
  });
}

async function updateClient(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);

  if (!clientId) {
    return noStoreJson({ error: "Client ID is required." }, { status: 400 });
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  const emailValue = cleanText(input.body.email);
  const email = emailValue ? cleanEmail(emailValue) : null;

  if (emailValue && !email) {
    return noStoreJson({ error: "Client email is invalid." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof input.body.fullName === "string") data.fullName = cleanText(input.body.fullName);
  if (typeof input.body.email === "string") data.email = encryptSensitiveText(email);
  if (typeof input.body.householdName === "string") data.householdName = cleanNullableText(input.body.householdName);
  if (typeof input.body.clientType === "string") data.clientType = cleanText(input.body.clientType, "Private Client");
  if (typeof input.body.riskProfile === "string") data.riskProfile = cleanText(input.body.riskProfile, "Balanced");
  if (typeof input.body.liquidityNeeds === "string") data.liquidityNeeds = cleanText(input.body.liquidityNeeds, "Moderate");
  if (typeof input.body.timeHorizon === "string") data.timeHorizon = cleanText(input.body.timeHorizon, "5-10 years");
  if (typeof input.body.objective === "string") data.objective = cleanText(input.body.objective, "Long-term wealth growth");
  if (typeof input.body.portfolioValue === "string") data.portfolioValue = encryptSensitiveText(cleanMoneyLike(input.body.portfolioValue));
  if (typeof input.body.status === "string") data.status = cleanText(input.body.status, "Active");
  if (typeof input.body.notes === "string") data.notes = encryptSensitiveText(cleanNullableText(input.body.notes));

  await prisma.clientProfile.update({
    where: {
      id: clientId,
    },
    data,
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "update",
    title: "Client profile updated",
    detail: "A client profile was updated.",
    metadata: {
      updatedFields: Object.keys(data),
      vault: vaultStatus(),
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function addHolding(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const symbol = cleanTicker(input.body.symbol);

  if (!clientId || !symbol) {
    return noStoreJson(
      { error: "Client ID and security symbol are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  const holding = await prisma.portfolioHolding.create({
    data: {
      clientId,
      symbol,
      assetName: cleanText(input.body.assetName, symbol),
      assetClass: cleanText(input.body.assetClass, "Stock"),
      riskLevel: cleanText(input.body.riskLevel, "Medium"),
      thesis: encryptSensitiveText(cleanNullableText(input.body.thesis)),
      value: null,
      allocationPct: null,
      costBasis: null,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.add",
    title: "Client holding added",
    detail: "A security was added to the client profile without storing position amount.",
    metadata: {
      symbol,
      holdingId: holding.id,
      amountStored: false,
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function updateHolding(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const holdingId = cleanText(input.body.holdingId);

  if (!clientId || !holdingId) {
    return noStoreJson(
      { error: "Client ID and holding ID are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  const holding = await prisma.portfolioHolding.findFirst({
    where: {
      id: holdingId,
      clientId,
    },
  });

  if (!holding) {
    return noStoreJson({ error: "Holding not found." }, { status: 404 });
  }

  const symbol = cleanTicker(input.body.symbol) || holding.symbol;

  await prisma.portfolioHolding.update({
    where: {
      id: holdingId,
    },
    data: {
      symbol,
      assetName:
        typeof input.body.assetName === "string"
          ? cleanText(input.body.assetName, symbol)
          : undefined,
      assetClass:
        typeof input.body.assetClass === "string"
          ? cleanText(input.body.assetClass, "Stock")
          : undefined,
      riskLevel:
        typeof input.body.riskLevel === "string"
          ? cleanText(input.body.riskLevel, "Medium")
          : undefined,
      thesis:
        typeof input.body.thesis === "string"
          ? encryptSensitiveText(cleanNullableText(input.body.thesis))
          : undefined,
      value: null,
      allocationPct: null,
      costBasis: null,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.update",
    title: "Client holding updated",
    detail: "A client security holding was updated without storing position amount.",
    metadata: {
      symbol,
      holdingId,
      amountStored: false,
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function removeHolding(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const holdingId = cleanText(input.body.holdingId);

  if (!clientId || !holdingId) {
    return noStoreJson(
      { error: "Client ID and holding ID are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "delete",
  });

  if (!access.allowed) return access.response!;

  const holding = await prisma.portfolioHolding.findFirst({
    where: {
      id: holdingId,
      clientId,
    },
  });

  if (!holding) {
    return noStoreJson({ error: "Holding not found." }, { status: 404 });
  }

  await prisma.portfolioHolding.delete({
    where: {
      id: holdingId,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.delete",
    title: "Client holding removed",
    detail: "A security was removed from the client profile.",
    metadata: {
      symbol: holding.symbol,
      holdingId,
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function addAdvisorNote(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const title = cleanText(input.body.title);
  const body = cleanText(input.body.body);

  if (!clientId || !title || !body) {
    return noStoreJson(
      { error: "Client, note title, and note body are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  await prisma.advisorNote.create({
    data: {
      userId: input.user.id,
      clientId,
      title: encryptSensitiveText(title) ?? title,
      body: encryptSensitiveText(body) ?? body,
      noteType: cleanText(input.body.noteType, "General"),
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "note.create",
    title: "Client note created",
    detail: "An advisor note was attached to a client profile.",
    metadata: {
      noteType: cleanText(input.body.noteType, "General"),
      vault: vaultStatus(),
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function addClientTask(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const title = cleanText(input.body.title);

  if (!clientId || !title) {
    return noStoreJson(
      { error: "Client and task title are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  await prisma.meetingTask.create({
    data: {
      userId: input.user.id,
      clientId,
      title,
      description: cleanNullableText(input.body.description),
      priority: cleanText(input.body.priority, "Medium"),
      dueDate: parseDate(input.body.dueDate),
      status: cleanText(input.body.status, "Open"),
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "task.create",
    title: "Client task created",
    detail: "A client follow-up task was created.",
    metadata: {
      priority: cleanText(input.body.priority, "Medium"),
      dueDate: cleanText(input.body.dueDate),
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function completeClientTask(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const taskId = cleanText(input.body.taskId);
  const status = cleanText(input.body.status, "Done");

  if (!clientId || !taskId) {
    return noStoreJson(
      { error: "Client ID and task ID are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  const task = await prisma.meetingTask.findFirst({
    where: {
      id: taskId,
      clientId,
      userId: input.user.id,
    },
  });

  if (!task) {
    return noStoreJson({ error: "Task not found." }, { status: 404 });
  }

  await prisma.meetingTask.update({
    where: {
      id: taskId,
    },
    data: {
      status,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "task.update",
    title: "Client task updated",
    detail: "A client follow-up task status was updated.",
    metadata: {
      taskId,
      status,
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function addClientDocument(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);
  const fileName = cleanText(input.body.fileName);

  if (!clientId || !fileName) {
    return noStoreJson(
      { error: "Client and document name are required." },
      { status: 400 }
    );
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  await prisma.documentVaultItem.create({
    data: {
      userId: input.user.id,
      clientId,
      fileName: encryptSensitiveText(fileName) ?? fileName,
      documentType: cleanText(input.body.documentType, "General"),
      status: cleanText(input.body.status, "Needs Review"),
      notes: encryptSensitiveText(cleanNullableText(input.body.notes)),
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "document.create",
    title: "Client document reference created",
    detail: "A client document reference was added.",
    metadata: {
      documentType: cleanText(input.body.documentType, "General"),
      vault: vaultStatus(),
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
}

async function addRiskReview(input: {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
}) {
  const clientId = cleanText(input.body.clientId);

  if (!clientId) {
    return noStoreJson({ error: "Client ID is required." }, { status: 400 });
  }

  const access = await requireOwnedClient({
    user: input.user,
    request: input.request,
    clientId,
    scope: "write",
  });

  if (!access.allowed) return access.response!;

  const client = await findClientForUser(input.user.id, clientId);

  if (!client) {
    return noStoreJson({ error: "Client not found." }, { status: 404 });
  }

  const holdingsCount = client.holdings.length;
  const highRiskHoldings = client.holdings.filter(
    (holding) => holding.riskLevel === "High" || holding.riskLevel === "Aggressive"
  ).length;

  const score =
    typeof input.body.score === "number"
      ? parseScore(input.body.score)
      : Math.max(
          45,
          Math.min(
            95,
            82 -
              highRiskHoldings * 8 +
              (client.riskProfile === "Balanced" ? 5 : 0) +
              (holdingsCount >= 5 ? 6 : 0)
          )
        );

  const flags = [
    highRiskHoldings ? `${highRiskHoldings} higher-risk holding(s) require review.` : null,
    holdingsCount === 0 ? "No holdings are attached to this profile yet." : null,
    !client.email ? "Client email is missing." : null,
    client.riskProfile === "Aggressive" ? "Aggressive risk profile requires documented suitability context." : null,
  ].filter(Boolean);

  await prisma.riskReview.create({
    data: {
      clientId,
      score,
      suitabilityStatus:
        score >= 78 ? "Aligned" : score >= 60 ? "Review Recommended" : "Needs Advisor Review",
      summary:
        cleanText(input.body.summary) ||
        "Automated profile check based on stored profile context and security-level holdings. Position amounts are not required.",
      flagsJson: JSON.stringify(flags),
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "risk_review.create",
    title: "Client risk review created",
    detail: "A client risk review was generated from stored profile context.",
    metadata: {
      score,
      flags,
      holdingsCount,
      highRiskHoldings,
    },
  });

  return noStoreJson({
    client: await loadSingleClient(input.user, clientId),
    ...(await loadClientPayload(input.user)),
  });
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

    return noStoreJson(await loadClientPayload(user, view));
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error ? error.message : "Unable to load client profiles.",
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
    eventType: "client.action",
    title: "Client profile action",
    limit: 80,
    windowMs: 60 * 1000,
  });

  if (!protection.allowed) {
    return protectedRouteResponse(protection);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = readAction(body.action);

    if (action === "createClient") return createClient({ user, request, body });
    if (action === "updateClient") return updateClient({ user, request, body });
    if (action === "addHolding") return addHolding({ user, request, body });
    if (action === "updateHolding") return updateHolding({ user, request, body });
    if (action === "removeHolding") return removeHolding({ user, request, body });
    if (action === "addNote") return addAdvisorNote({ user, request, body });
    if (action === "addTask") return addClientTask({ user, request, body });
    if (action === "completeTask") return completeClientTask({ user, request, body });
    if (action === "addDocument") return addClientDocument({ user, request, body });
    if (action === "addRiskReview") return addRiskReview({ user, request, body });

    return noStoreJson(
      {
        error: "Unsupported client action.",
        supportedActions: [
          "createClient",
          "updateClient",
          "addHolding",
          "updateHolding",
          "removeHolding",
          "addNote",
          "addTask",
          "completeTask",
          "addDocument",
          "addRiskReview",
        ],
      },
      { status: 400 }
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          error instanceof Error ? error.message : "Client profile action failed.",
      },
      { status: 500 }
    );
  }
}