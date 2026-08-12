import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  AccessControlError,
  clientScopeWhere,
  hasFirmPermission,
  requireClientInScope,
  type AccessContext,
} from "@/lib/access-control";
import { ApiError } from "@/lib/api-route";
import {
  cleanEmail,
  cleanMoneyLike,
  cleanNullableText,
  cleanText,
  cleanTicker,
  recordClientMutation,
} from "@/lib/client-data-security";
import { encryptSensitiveText, vaultStatus } from "@/lib/data-vault";
import { prisma } from "@/lib/prisma";
import {
  getClientDetail,
  requireClientRepositoryContext,
} from "@/lib/clients/repository";

export const CLIENT_MUTATION_ACTIONS = [
  "createClient",
  "updateClient",
  "addHolding",
  "updateHolding",
  "removeHolding",
  "bulkAddHoldings",
  "addNote",
  "addTask",
  "completeTask",
  "addDocument",
  "addRiskReview",
] as const;

export type ClientMutationAction = (typeof CLIENT_MUTATION_ACTIONS)[number];

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

type MutationInput = {
  user: CurrentUserShape;
  request: Request;
  body: Record<string, unknown>;
};

type MutationOutcome = {
  action: ClientMutationAction;
  clientId: string;
  entityId: string | null;
  affectedCount: number;
  message: string;
};

function readAction(value: unknown): ClientMutationAction {
  const action = cleanText(value, "createClient");

  if (!CLIENT_MUTATION_ACTIONS.includes(action as ClientMutationAction)) {
    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_CLIENT_ACTION",
      message: `Unsupported client action. Supported actions: ${CLIENT_MUTATION_ACTIONS.join(", ")}.`,
      expose: true,
    });
  }

  return action as ClientMutationAction;
}

function required(value: unknown, label: string) {
  const clean = cleanText(value);

  if (!clean) {
    throw new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: `${label} is required.`,
      expose: true,
    });
  }

  return clean;
}

function parseDate(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return null;

  const date = new Date(`${clean}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError({
      status: 400,
      code: "INVALID_DATE",
      message: "Enter a valid date.",
      expose: true,
    });
  }

  return date;
}

function parseScore(value: unknown, fallback = 70) {
  const score = Number(value);
  return Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : fallback;
}

async function requireMutationContext(userId: string) {
  const context = await requireClientRepositoryContext(userId);

  if (!hasFirmPermission(context, "clients.manage")) {
    throw new AccessControlError({
      status: 403,
      code: "CLIENT_MANAGE_PERMISSION_REQUIRED",
      message: "You do not have permission to modify client records.",
    });
  }

  return context;
}

async function requireScopedClient(input: {
  context: AccessContext;
  clientId: string;
}) {
  return requireClientInScope({
    context: input.context,
    clientId: input.clientId,
  });
}

async function createClient(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const fullName = required(input.body.fullName, "Client full name");
  const rawEmail = cleanText(input.body.email);
  const email = rawEmail ? cleanEmail(rawEmail) : null;

  if (rawEmail && !email) {
    throw new ApiError({
      status: 400,
      code: "INVALID_CLIENT_EMAIL",
      message: "Client email is invalid.",
      expose: true,
    });
  }

  if (!context.membership) {
    throw new AccessControlError({
      status: 403,
      code: "MEMBERSHIP_REQUIRED_FOR_CLIENT_CREATE",
      message: "An active firm membership is required to create a client.",
    });
  }

  const client = await prisma.clientProfile.create({
    data: {
      userId: input.user.id,
      firmId: context.firm!.id,
      assignedAdvisorMembershipId: context.membership.id,
      assignedAdvisorAt: new Date(),
      assignedByUserId: input.user.id,
      fullName,
      email: encryptSensitiveText(email),
      phone: encryptSensitiveText(cleanNullableText(input.body.phone)),
      householdName: cleanNullableText(input.body.householdName),
      preferredContactMethod: cleanText(
        input.body.preferredContactMethod,
        "Portal + email",
      ),
      clientType: cleanText(input.body.clientType, "Private Client"),
      riskProfile: cleanText(input.body.riskProfile, "Balanced"),
      liquidityNeeds: cleanText(input.body.liquidityNeeds, "Moderate"),
      timeHorizon: cleanText(input.body.timeHorizon, "5-10 years"),
      objective: cleanText(
        input.body.objective,
        "Long-term wealth growth",
      ),
      portfolioValue: encryptSensitiveText(
        cleanMoneyLike(input.body.portfolioValue),
      ),
      status: cleanText(input.body.status, "Active"),
      notes: encryptSensitiveText(cleanNullableText(input.body.notes)),
    },
    select: {
      id: true,
      clientType: true,
      riskProfile: true,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId: client.id,
    action: "create",
    title: "Client profile created",
    detail: "A client profile was created through the bounded client API.",
    metadata: {
      firmId: context.firm!.id,
      assignedAdvisorMembershipId: context.membership.id,
      hasEmail: Boolean(email),
      clientType: client.clientType,
      riskProfile: client.riskProfile,
      vault: vaultStatus(),
    },
  });

  return {
    action: "createClient",
    clientId: client.id,
    entityId: client.id,
    affectedCount: 1,
    message: "Client profile created.",
  };
}

async function updateClient(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  await requireScopedClient({ context, clientId });

  const data: Prisma.ClientProfileUncheckedUpdateManyInput = {};

  if (typeof input.body.fullName === "string") {
    data.fullName = required(input.body.fullName, "Client full name");
  }

  if (typeof input.body.email === "string") {
    const rawEmail = cleanText(input.body.email);
    const email = rawEmail ? cleanEmail(rawEmail) : null;

    if (rawEmail && !email) {
      throw new ApiError({
        status: 400,
        code: "INVALID_CLIENT_EMAIL",
        message: "Client email is invalid.",
        expose: true,
      });
    }

    data.email = encryptSensitiveText(email);
  }

  if (typeof input.body.phone === "string") {
    data.phone = encryptSensitiveText(cleanNullableText(input.body.phone));
  }

  if (typeof input.body.householdName === "string") {
    data.householdName = cleanNullableText(input.body.householdName);
  }

  if (typeof input.body.preferredContactMethod === "string") {
    data.preferredContactMethod = cleanText(
      input.body.preferredContactMethod,
      "Portal + email",
    );
  }

  if (typeof input.body.clientType === "string") {
    data.clientType = cleanText(input.body.clientType);
  }

  if (typeof input.body.riskProfile === "string") {
    data.riskProfile = cleanText(input.body.riskProfile);
  }

  if (typeof input.body.liquidityNeeds === "string") {
    data.liquidityNeeds = cleanText(input.body.liquidityNeeds);
  }

  if (typeof input.body.timeHorizon === "string") {
    data.timeHorizon = cleanText(input.body.timeHorizon);
  }

  if (typeof input.body.objective === "string") {
    data.objective = cleanText(input.body.objective);
  }

  if (typeof input.body.status === "string") {
    data.status = cleanText(input.body.status);
  }

  if (typeof input.body.portfolioValue === "string") {
    data.portfolioValue = encryptSensitiveText(
      cleanMoneyLike(input.body.portfolioValue),
    );
  }

  if (typeof input.body.notes === "string") {
    data.notes = encryptSensitiveText(cleanNullableText(input.body.notes));
  }

  if (!Object.keys(data).length) {
    throw new ApiError({
      status: 400,
      code: "NO_CLIENT_CHANGES",
      message: "No client changes were supplied.",
      expose: true,
    });
  }

  const result = await prisma.clientProfile.updateMany({
    where: {
      id: clientId,
      ...clientScopeWhere(context),
    },
    data,
  });

  if (!result.count) {
    throw new AccessControlError({
      status: 404,
      code: "CLIENT_NOT_FOUND",
      message: "Client not found.",
    });
  }

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "update",
    title: "Client profile updated",
    detail: "A client profile was updated through the bounded client API.",
    metadata: {
      changedFields: Object.keys(data),
      vault: vaultStatus(),
    },
  });

  return {
    action: "updateClient",
    clientId,
    entityId: clientId,
    affectedCount: result.count,
    message: "Client profile updated.",
  };
}

async function addHolding(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const symbol = cleanTicker(input.body.symbol);

  if (!symbol) {
    throw new ApiError({
      status: 400,
      code: "HOLDING_SYMBOL_REQUIRED",
      message: "Security symbol is required.",
      expose: true,
    });
  }

  await requireScopedClient({ context, clientId });

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
    select: {
      id: true,
    },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.add",
    title: "Client holding added",
    detail: "A security was added without requiring position amounts.",
    metadata: {
      holdingId: holding.id,
      symbol,
      amountStored: false,
    },
  });

  return {
    action: "addHolding",
    clientId,
    entityId: holding.id,
    affectedCount: 1,
    message: `${symbol} added to the client profile.`,
  };
}

async function bulkAddHoldings(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  await requireScopedClient({ context, clientId });

  const values = Array.isArray(input.body.holdings)
    ? input.body.holdings
    : Array.isArray(input.body.symbols)
      ? input.body.symbols
      : [];

  const holdings = values
    .map((item) => {
      if (typeof item === "string") {
        const symbol = cleanTicker(item);
        return symbol
          ? {
              clientId,
              symbol,
              assetName: symbol,
              assetClass: "Stock",
              riskLevel: "Medium",
              value: null,
              allocationPct: null,
              costBasis: null,
            }
          : null;
      }

      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const symbol = cleanTicker(record.symbol);

      return symbol
        ? {
            clientId,
            symbol,
            assetName: cleanText(record.assetName, symbol),
            assetClass: cleanText(record.assetClass, "Stock"),
            riskLevel: cleanText(record.riskLevel, "Medium"),
            thesis: encryptSensitiveText(cleanNullableText(record.thesis)),
            value: null,
            allocationPct: null,
            costBasis: null,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 100);

  if (!holdings.length) {
    throw new ApiError({
      status: 400,
      code: "NO_VALID_HOLDINGS",
      message: "No valid security symbols were supplied.",
      expose: true,
    });
  }

  const result = await prisma.portfolioHolding.createMany({
    data: holdings,
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.bulk_add",
    title: "Client holdings added",
    detail: "Multiple securities were added to the client profile.",
    metadata: {
      requestedCount: holdings.length,
      createdCount: result.count,
      amountStored: false,
    },
  });

  return {
    action: "bulkAddHoldings",
    clientId,
    entityId: null,
    affectedCount: result.count,
    message: `${result.count} holding${result.count === 1 ? "" : "s"} added.`,
  };
}

async function updateHolding(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const holdingId = required(input.body.holdingId, "Holding ID");
  await requireScopedClient({ context, clientId });

  const existing = await prisma.portfolioHolding.findFirst({
    where: {
      id: holdingId,
      clientId,
    },
    select: {
      id: true,
      symbol: true,
    },
  });

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "HOLDING_NOT_FOUND",
      message: "Holding not found.",
      expose: true,
    });
  }

  const symbol = cleanTicker(input.body.symbol) || existing.symbol;

  await prisma.portfolioHolding.update({
    where: { id: holdingId },
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
    detail: "A client security holding was updated.",
    metadata: {
      holdingId,
      symbol,
      amountStored: false,
    },
  });

  return {
    action: "updateHolding",
    clientId,
    entityId: holdingId,
    affectedCount: 1,
    message: `${symbol} updated.`,
  };
}

async function removeHolding(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const holdingId = required(input.body.holdingId, "Holding ID");
  await requireScopedClient({ context, clientId });

  const existing = await prisma.portfolioHolding.findFirst({
    where: {
      id: holdingId,
      clientId,
    },
    select: {
      id: true,
      symbol: true,
    },
  });

  if (!existing) {
    throw new ApiError({
      status: 404,
      code: "HOLDING_NOT_FOUND",
      message: "Holding not found.",
      expose: true,
    });
  }

  await prisma.portfolioHolding.delete({
    where: { id: holdingId },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "holding.delete",
    title: "Client holding removed",
    detail: "A security was removed from the client profile.",
    metadata: {
      holdingId,
      symbol: existing.symbol,
    },
  });

  return {
    action: "removeHolding",
    clientId,
    entityId: holdingId,
    affectedCount: 1,
    message: `${existing.symbol} removed.`,
  };
}

async function addNote(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const title = required(input.body.title, "Note title");
  const body = required(input.body.body, "Note body");
  await requireScopedClient({ context, clientId });

  const note = await prisma.advisorNote.create({
    data: {
      userId: input.user.id,
      clientId,
      title: encryptSensitiveText(title) ?? title,
      body: encryptSensitiveText(body) ?? body,
      noteType: cleanText(input.body.noteType, "General"),
    },
    select: { id: true },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "note.create",
    title: "Client note created",
    detail: "An advisor note was attached to the client profile.",
    metadata: {
      noteId: note.id,
      noteType: cleanText(input.body.noteType, "General"),
      vault: vaultStatus(),
    },
  });

  return {
    action: "addNote",
    clientId,
    entityId: note.id,
    affectedCount: 1,
    message: "Client note added.",
  };
}

async function addTask(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const title = required(input.body.title, "Task title");
  await requireScopedClient({ context, clientId });

  const task = await prisma.meetingTask.create({
    data: {
      userId: input.user.id,
      clientId,
      title,
      description: cleanNullableText(input.body.description),
      dueDate: parseDate(input.body.dueDate),
      priority: cleanText(input.body.priority, "Medium"),
      status: cleanText(input.body.status, "Open"),
    },
    select: { id: true },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "task.create",
    title: "Client task created",
    detail: "A client follow-up task was created.",
    metadata: {
      taskId: task.id,
      priority: cleanText(input.body.priority, "Medium"),
    },
  });

  return {
    action: "addTask",
    clientId,
    entityId: task.id,
    affectedCount: 1,
    message: "Client task created.",
  };
}

async function completeTask(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const taskId = required(input.body.taskId, "Task ID");
  const status = cleanText(input.body.status, "Done");
  await requireScopedClient({ context, clientId });

  const result = await prisma.meetingTask.updateMany({
    where: {
      id: taskId,
      clientId,
    },
    data: { status },
  });

  if (!result.count) {
    throw new ApiError({
      status: 404,
      code: "TASK_NOT_FOUND",
      message: "Task not found.",
      expose: true,
    });
  }

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "task.update",
    title: "Client task updated",
    detail: "A client task status was updated.",
    metadata: { taskId, status },
  });

  return {
    action: "completeTask",
    clientId,
    entityId: taskId,
    affectedCount: result.count,
    message: "Client task updated.",
  };
}

async function addDocument(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const fileName = required(input.body.fileName, "Document name");
  await requireScopedClient({ context, clientId });

  const document = await prisma.documentVaultItem.create({
    data: {
      userId: input.user.id,
      clientId,
      fileName: encryptSensitiveText(fileName) ?? fileName,
      documentType: cleanText(input.body.documentType, "General"),
      status: cleanText(input.body.status, "Needs Review"),
      notes: encryptSensitiveText(cleanNullableText(input.body.notes)),
    },
    select: { id: true },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "document.create",
    title: "Client document reference created",
    detail: "A client document reference was added.",
    metadata: {
      documentId: document.id,
      documentType: cleanText(input.body.documentType, "General"),
      vault: vaultStatus(),
    },
  });

  return {
    action: "addDocument",
    clientId,
    entityId: document.id,
    affectedCount: 1,
    message: "Document reference added.",
  };
}

async function addRiskReview(
  input: MutationInput,
  context: AccessContext,
): Promise<MutationOutcome> {
  const clientId = required(input.body.clientId, "Client ID");
  const client = await requireScopedClient({ context, clientId });
  const [holdingsCount, highRiskHoldings] = await Promise.all([
    prisma.portfolioHolding.count({
      where: { clientId },
    }),
    prisma.portfolioHolding.count({
      where: {
        clientId,
        riskLevel: {
          in: ["High", "Aggressive", "Extreme"],
        },
      },
    }),
  ]);
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
              (holdingsCount >= 5 ? 6 : 0),
          ),
        );
  const flags = [
    highRiskHoldings
      ? `${highRiskHoldings} higher-risk holding(s) require review.`
      : null,
    holdingsCount === 0
      ? "No holdings are attached to this profile yet."
      : null,
    !client.email ? "Client email is missing." : null,
    client.riskProfile === "Aggressive"
      ? "Aggressive risk profile requires documented suitability context."
      : null,
  ].filter((item): item is string => Boolean(item));

  const review = await prisma.riskReview.create({
    data: {
      clientId,
      score,
      suitabilityStatus:
        score >= 78
          ? "Aligned"
          : score >= 60
            ? "Review Recommended"
            : "Needs Advisor Review",
      summary:
        cleanText(input.body.summary) ||
        "Automated profile check based on stored profile context and security-level holdings. Position amounts are not required.",
      flagsJson: JSON.stringify(flags),
    },
    select: { id: true },
  });

  await recordClientMutation({
    user: input.user,
    request: input.request,
    clientId,
    action: "risk_review.create",
    title: "Client risk review created",
    detail: "A client risk review was generated from stored profile context.",
    metadata: {
      reviewId: review.id,
      score,
      flags,
      holdingsCount,
      highRiskHoldings,
    },
  });

  return {
    action: "addRiskReview",
    clientId,
    entityId: review.id,
    affectedCount: 1,
    message: "Risk review created.",
  };
}

export async function dispatchClientMutation(
  input: MutationInput,
  options: {
    includeClientDetail?: boolean;
  } = {},
) {
  const context = await requireMutationContext(input.user.id);
  const action = readAction(input.body.action);
  let outcome: MutationOutcome;

  switch (action) {
    case "createClient":
      outcome = await createClient(input, context);
      break;
    case "updateClient":
      outcome = await updateClient(input, context);
      break;
    case "addHolding":
      outcome = await addHolding(input, context);
      break;
    case "updateHolding":
      outcome = await updateHolding(input, context);
      break;
    case "removeHolding":
      outcome = await removeHolding(input, context);
      break;
    case "bulkAddHoldings":
      outcome = await bulkAddHoldings(input, context);
      break;
    case "addNote":
      outcome = await addNote(input, context);
      break;
    case "addTask":
      outcome = await addTask(input, context);
      break;
    case "completeTask":
      outcome = await completeTask(input, context);
      break;
    case "addDocument":
      outcome = await addDocument(input, context);
      break;
    case "addRiskReview":
      outcome = await addRiskReview(input, context);
      break;
  }

  const client =
    options.includeClientDetail === false
      ? null
      : await getClientDetail({
          context,
          clientId: outcome.clientId,
        });

  return {
    ok: true as const,
    ...outcome,
    client,
    updatedAt: new Date().toISOString(),
    refreshRecommended: true,
  };
}